-- =====================================================
-- 012: ロール自動付与ルール
-- 登録種別に応じて複数ロールを自動付与する
--
-- fan       → [fan]
-- idol      → [fan, idol]
-- organizer → [fan, idol, organizer]
-- admin     → [fan, idol, organizer, admin]
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. ロール展開ヘルパー関数
-- 指定ロールに付随する全ロールの配列を返す
-- ─────────────────────────────────────────────────────
create or replace function expand_roles(base_role text)
returns text[] as $$
begin
  return case base_role
    when 'admin'     then array['fan', 'idol', 'organizer', 'admin']
    when 'organizer' then array['fan', 'idol', 'organizer']
    when 'idol'      then array['fan', 'idol']
    else                  array['fan']
  end;
end;
$$ language plpgsql immutable;

-- ─────────────────────────────────────────────────────
-- 2. handle_new_user 更新
-- 新規ユーザー作成時に付随ロールも全て挿入
-- ─────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
declare
  initial_role text;
  r text;
begin
  initial_role := coalesce(new.raw_user_meta_data->>'role', 'fan');

  insert into profiles (id, role, nickname, avatar_url)
  values (
    new.id,
    initial_role,
    coalesce(
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- 付随ロールを全て挿入
  foreach r in array expand_roles(initial_role) loop
    insert into user_roles (user_id, role)
    values (new.id, r)
    on conflict (user_id, role) do nothing;
  end loop;

  return new;
exception
  when others then
    raise log 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 3. ensure_profile 更新
-- ログイン/ページアクセス時に付随ロールも全て挿入
-- ─────────────────────────────────────────────────────
create or replace function ensure_profile(
  target_role text,
  target_nickname text default null,
  target_avatar_url text default null
)
returns void as $$
declare
  r text;
begin
  insert into profiles (id, role, nickname, avatar_url)
  values (auth.uid(), target_role, target_nickname, target_avatar_url)
  on conflict (id)
  do update set
    role = EXCLUDED.role,
    nickname = coalesce(EXCLUDED.nickname, profiles.nickname),
    avatar_url = coalesce(EXCLUDED.avatar_url, profiles.avatar_url);

  -- 付随ロールを全て挿入
  foreach r in array expand_roles(target_role) loop
    insert into user_roles (user_id, role)
    values (auth.uid(), r)
    on conflict (user_id, role) do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 4. grant_role 更新
-- admin がロール付与する際にも付随ロールを自動付与
-- ─────────────────────────────────────────────────────
create or replace function grant_role(target_user_id uuid, target_role text)
returns void as $$
declare
  r text;
begin
  -- 呼び出し元がadminか確認
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  -- ロール値の検証
  if target_role not in ('fan', 'idol', 'organizer', 'admin') then
    raise exception '無効なロール: %', target_role;
  end if;

  -- 付随ロールを全て付与
  foreach r in array expand_roles(target_role) loop
    insert into user_roles (user_id, role)
    values (target_user_id, r)
    on conflict (user_id, role) do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 5. 既存データの修正
-- 既に登録済みのユーザーにも付随ロールを付与
-- ─────────────────────────────────────────────────────

-- organizer → fan, idol も付与
insert into user_roles (user_id, role)
select ur.user_id, unnest(array['fan', 'idol'])
from user_roles ur where ur.role = 'organizer'
on conflict (user_id, role) do nothing;

-- idol → fan も付与
insert into user_roles (user_id, role)
select ur.user_id, 'fan'
from user_roles ur where ur.role = 'idol'
on conflict (user_id, role) do nothing;

-- admin → fan, idol, organizer も付与
insert into user_roles (user_id, role)
select ur.user_id, unnest(array['fan', 'idol', 'organizer'])
from user_roles ur where ur.role = 'admin'
on conflict (user_id, role) do nothing;
