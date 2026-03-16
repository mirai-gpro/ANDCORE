-- =====================================================
-- 010: マルチロール対応
-- 1つのアカウントで複数の種別権限を持てるようにする
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. user_roles テーブル作成
-- ─────────────────────────────────────────────────────
create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('fan', 'idol', 'organizer', 'admin')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

comment on table user_roles is 'ユーザーの種別権限（1アカウント複数ロール対応）';

create index if not exists idx_user_roles_user on user_roles(user_id);

-- RLS 有効化
alter table user_roles enable row level security;

-- 全ユーザーが自分のロール一覧を閲覧可能
drop policy if exists "user_roles: 自分のロール閲覧" on user_roles;
create policy "user_roles: 自分のロール閲覧"
  on user_roles for select
  using (user_id = auth.uid());

-- admin のみ他ユーザーのロールを閲覧可能
drop policy if exists "user_roles: adminが全閲覧" on user_roles;
create policy "user_roles: adminが全閲覧"
  on user_roles for select
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
  );

-- admin のみロール付与可能
drop policy if exists "user_roles: adminがロール付与" on user_roles;
create policy "user_roles: adminがロール付与"
  on user_roles for insert
  with check (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
    or user_id = auth.uid()  -- 自分自身（handle_new_user トリガー用）
  );

-- admin のみロール削除可能
drop policy if exists "user_roles: adminがロール削除" on user_roles;
create policy "user_roles: adminがロール削除"
  on user_roles for delete
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
  );

-- ─────────────────────────────────────────────────────
-- 2. 既存データの移行: profiles.role → user_roles
-- ─────────────────────────────────────────────────────
insert into user_roles (user_id, role)
select id, role from profiles
on conflict (user_id, role) do nothing;

-- ─────────────────────────────────────────────────────
-- 3. handle_new_user トリガー更新
-- 新規ユーザー作成時に user_roles にも fan を挿入
-- ─────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
declare
  initial_role text;
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

  -- user_roles にも挿入
  insert into user_roles (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;

  return new;
exception
  when others then
    raise log 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 4. ロール切替 RPC
-- フロントから supabase.rpc('switch_role', { new_role: '...' }) で呼ぶ
-- ─────────────────────────────────────────────────────
create or replace function switch_role(new_role text)
returns void as $$
begin
  -- ユーザーが該当ロールを持っているか確認
  if not exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = new_role
  ) then
    raise exception 'このロールは付与されていません: %', new_role;
  end if;

  -- profiles.role (active role) を更新
  update profiles set role = new_role where id = auth.uid();
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 5. ロール付与 RPC（admin専用）
-- supabase.rpc('grant_role', { target_user_id: '...', target_role: '...' })
-- ─────────────────────────────────────────────────────
create or replace function grant_role(target_user_id uuid, target_role text)
returns void as $$
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

  insert into user_roles (user_id, role)
  values (target_user_id, target_role)
  on conflict (user_id, role) do nothing;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 6. ロール剥奪 RPC（admin専用）
-- ─────────────────────────────────────────────────────
create or replace function revoke_role(target_user_id uuid, target_role text)
returns void as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception '管理者権限が必要です';
  end if;

  -- fan ロールは削除不可（最低1つは必要）
  if target_role = 'fan' then
    raise exception 'ファンロールは削除できません';
  end if;

  delete from user_roles
  where user_id = target_user_id and role = target_role;

  -- アクティブロールが削除された場合はfanに戻す
  update profiles set role = 'fan'
  where id = target_user_id and role = target_role;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────
-- 7. user_has_role 関数を user_roles テーブルベースに更新
-- ─────────────────────────────────────────────────────
create or replace function public.user_has_role(allowed_roles text[])
returns boolean as $$
begin
  return exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = any(allowed_roles)
  )
  or coalesce(
    auth.jwt()->'user_metadata'->>'role', ''
  ) = any(allowed_roles);
end;
$$ language plpgsql security definer stable;

-- ─────────────────────────────────────────────────────
-- 8. ensure_profile 更新 (user_roles にも挿入)
-- ─────────────────────────────────────────────────────
create or replace function ensure_profile(
  target_role text,
  target_nickname text default null,
  target_avatar_url text default null
)
returns void as $$
begin
  insert into profiles (id, role, nickname, avatar_url)
  values (auth.uid(), target_role, target_nickname, target_avatar_url)
  on conflict (id)
  do update set
    role = EXCLUDED.role,
    nickname = coalesce(EXCLUDED.nickname, profiles.nickname),
    avatar_url = coalesce(EXCLUDED.avatar_url, profiles.avatar_url);

  -- user_roles にも挿入
  insert into user_roles (user_id, role)
  values (auth.uid(), target_role)
  on conflict (user_id, role) do nothing;
end;
$$ language plpgsql security definer;
