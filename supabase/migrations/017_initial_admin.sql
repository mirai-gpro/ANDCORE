-- =====================================================
-- 017: 初期管理者の設定
-- unfix.hamada@gmail.com を ANDCORE管理者として登録
-- =====================================================

-- auth.usersからメールで検索してadminロールを付与
-- (ユーザーが既に登録済みの場合)
do $$
declare
  target_user_id uuid;
begin
  -- auth.users からメールアドレスで検索
  select id into target_user_id
  from auth.users
  where email = 'unfix.hamada@gmail.com'
  limit 1;

  if target_user_id is null then
    raise notice 'ユーザー unfix.hamada@gmail.com が見つかりません。登録後に手動でadminロールを付与してください。';
    return;
  end if;

  -- profiles.role を admin に更新
  update profiles set role = 'admin' where id = target_user_id;

  -- user_roles に admin を追加
  insert into user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  raise notice '初期管理者を設定しました: unfix.hamada@gmail.com (id: %)', target_user_id;
end;
$$;

-- find_user_by_email RPCが未作成なら作成（管理者がメールでユーザーを検索するため）
create or replace function find_user_by_email(search_email text)
returns table (id uuid, nickname text, points_balance integer, role text) as $$
begin
  -- admin権限チェック
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  return query
  select p.id, p.nickname, p.points_balance, p.role
  from auth.users u
  join profiles p on p.id = u.id
  where u.email = search_email;
end;
$$ language plpgsql security definer;

-- 管理者一覧を取得するRPC
create or replace function list_admins()
returns table (id uuid, email text, nickname text, created_at timestamptz) as $$
begin
  -- admin権限チェック
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  return query
  select ur.user_id as id, u.email, p.nickname, ur.created_at
  from user_roles ur
  join auth.users u on u.id = ur.user_id
  join profiles p on p.id = ur.user_id
  where ur.role = 'admin'
  order by ur.created_at;
end;
$$ language plpgsql security definer;

-- メールアドレスでユーザーにadminロールを付与するRPC
create or replace function grant_admin_by_email(target_email text)
returns void as $$
declare
  target_user_id uuid;
begin
  -- admin権限チェック
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  -- メールアドレスでユーザーを検索
  select u.id into target_user_id
  from auth.users u
  where u.email = target_email;

  if target_user_id is null then
    raise exception '該当するアカウントが見つかりません: %', target_email;
  end if;

  -- user_roles に admin を追加
  insert into user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  -- profiles.role も admin に更新
  update profiles set role = 'admin' where id = target_user_id;
end;
$$ language plpgsql security definer;

-- メールアドレスでユーザーからadminロールを剥奪するRPC
create or replace function revoke_admin_by_email(target_email text)
returns void as $$
declare
  target_user_id uuid;
begin
  -- admin権限チェック
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  -- メールアドレスでユーザーを検索
  select u.id into target_user_id
  from auth.users u
  where u.email = target_email;

  if target_user_id is null then
    raise exception '該当するアカウントが見つかりません: %', target_email;
  end if;

  -- 自分自身を削除させない
  if target_user_id = auth.uid() then
    raise exception '自分自身の管理者権限は削除できません';
  end if;

  -- user_roles から admin を削除
  delete from user_roles
  where user_id = target_user_id and role = 'admin';

  -- profiles.role が admin なら fan に戻す
  update profiles set role = 'fan'
  where id = target_user_id and role = 'admin';
end;
$$ language plpgsql security definer;
