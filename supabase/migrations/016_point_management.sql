-- =====================================================
-- ポイント管理機能の拡張
-- =====================================================

-- 1. point_transactions の type に 'generate' と 'grant' を追加
alter table point_transactions drop constraint if exists point_transactions_type_check;
alter table point_transactions add constraint point_transactions_type_check
  check (type in ('charge', 'purchase', 'refund', 'bonus', 'generate', 'grant'));

-- 2. granted_by カラム追加（誰からの付与か）
alter table point_transactions add column if not exists granted_by uuid references profiles(id);

-- 3. RLSポリシー: point_transactions
alter table point_transactions enable row level security;

-- 自分の履歴は閲覧可能
drop policy if exists "point_transactions: 自分の履歴を閲覧可能" on point_transactions;
create policy "point_transactions: 自分の履歴を閲覧可能"
  on point_transactions for select
  using (user_id = auth.uid() or user_has_role(array['admin']));

-- admin/organizerがinsert可能
drop policy if exists "point_transactions: admin/organizerが作成可能" on point_transactions;
create policy "point_transactions: admin/organizerが作成可能"
  on point_transactions for insert
  with check (user_has_role(array['admin', 'organizer']));

-- 4. profilesのpoints_balance更新ポリシー（admin/organizerが更新可能）
drop policy if exists "profiles: admin/organizerがpoints更新可能" on profiles;
create policy "profiles: admin/organizerがpoints更新可能"
  on profiles for update
  using (
    id = auth.uid()
    or user_has_role(array['admin', 'organizer'])
  );

-- 5. ポイント生成RPC（admin専用）
create or replace function generate_points(amount integer)
returns json
language plpgsql
security definer
as $$
declare
  admin_id uuid := auth.uid();
  new_balance integer;
begin
  -- admin権限チェック
  if not user_has_role(array['admin']) then
    raise exception 'admin権限が必要です';
  end if;

  if amount <= 0 then
    raise exception 'ポイント数は1以上を指定してください';
  end if;

  -- adminのポイント残高を加算
  update profiles set points_balance = points_balance + amount where id = admin_id
    returning points_balance into new_balance;

  -- 取引履歴を記録
  insert into point_transactions (user_id, amount, balance_after, type, description)
  values (admin_id, amount, new_balance, 'generate', amount || 'pt 生成');

  return json_build_object('new_balance', new_balance);
end;
$$;

-- 6. ポイント付与RPC（admin→organizer/fan, organizer→fan）
create or replace function grant_points(
  target_user_id uuid,
  amount integer,
  note text default null
)
returns json
language plpgsql
security definer
as $$
declare
  granter_id uuid := auth.uid();
  granter_balance integer;
  target_balance integer;
  granter_new_balance integer;
  target_new_balance integer;
  target_nickname text;
begin
  -- 権限チェック
  if not user_has_role(array['admin', 'organizer']) then
    raise exception 'admin/organizer権限が必要です';
  end if;

  if amount <= 0 then
    raise exception 'ポイント数は1以上を指定してください';
  end if;

  if granter_id = target_user_id then
    raise exception '自分自身にはポイントを付与できません';
  end if;

  -- 付与元の残高チェック
  select points_balance into granter_balance from profiles where id = granter_id;
  if granter_balance < amount then
    raise exception '保有ポイントが不足しています（残高: %pt）', granter_balance;
  end if;

  -- 付与先の情報取得
  select nickname into target_nickname from profiles where id = target_user_id;
  if target_nickname is null then
    target_nickname := '不明';
  end if;

  -- 付与元のポイント減算
  update profiles set points_balance = points_balance - amount where id = granter_id
    returning points_balance into granter_new_balance;

  -- 付与先のポイント加算
  update profiles set points_balance = points_balance + amount where id = target_user_id
    returning points_balance into target_new_balance;

  -- 取引履歴: 付与元（支出）
  insert into point_transactions (user_id, amount, balance_after, type, granted_by, description)
  values (granter_id, -amount, granter_new_balance, 'grant', null,
    coalesce(target_nickname, '') || 'へ ' || amount || 'pt 付与' || coalesce(' (' || note || ')', ''));

  -- 取引履歴: 付与先（受領）
  insert into point_transactions (user_id, amount, balance_after, type, granted_by, description)
  values (target_user_id, amount, target_new_balance, 'grant', granter_id,
    amount || 'pt 受領' || coalesce(' (' || note || ')', ''));

  return json_build_object(
    'granter_new_balance', granter_new_balance,
    'target_new_balance', target_new_balance
  );
end;
$$;

-- 7. メールアドレスからユーザー検索RPC（admin/organizer専用）
create or replace function find_user_by_email(search_email text)
returns table(id uuid, nickname text, points_balance integer)
language plpgsql
security definer
as $$
declare
  found_user_id uuid;
begin
  -- 権限チェック
  if not user_has_role(array['admin', 'organizer']) then
    raise exception 'admin/organizer権限が必要です';
  end if;

  -- auth.usersからメールで検索
  select au.id into found_user_id
    from auth.users au
    where au.email = search_email;

  if found_user_id is null then
    return;
  end if;

  -- profilesの情報を返す
  return query
    select p.id, p.nickname, p.points_balance
    from profiles p
    where p.id = found_user_id;
end;
$$;
