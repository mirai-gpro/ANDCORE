-- =====================================================
-- 005: アイドルグループ・メンバー管理
-- 運営者がグループとメンバーをCRUDできる構造
-- =====================================================

-- 1. idol_groups: アイドルグループ
create table idol_groups (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  catchphrase text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table idol_groups is 'アイドルグループ（運営者が管理）';
create index idx_idol_groups_organizer on idol_groups(organizer_id);

create trigger idol_groups_updated_at
  before update on idol_groups
  for each row execute function update_updated_at();

-- 2. idol_group_admins: グループの管理Googleアカウント（運営者含む複数人）
create table idol_group_admins (
  group_id uuid not null references idol_groups(id) on delete cascade,
  admin_email text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, admin_email)
);

comment on table idol_group_admins is 'グループ管理者のGoogleアカウント';

-- 3. idol_members: グループ所属メンバー
create table idol_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references idol_groups(id) on delete cascade,
  name text not null,
  google_email text,
  photo_url text,
  profile_id uuid references profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table idol_members is 'アイドルグループの個別メンバー';
create index idx_idol_members_group on idol_members(group_id, sort_order);
create index idx_idol_members_profile on idol_members(profile_id);

create trigger idol_members_updated_at
  before update on idol_members
  for each row execute function update_updated_at();

-- =====================================================
-- RLS ポリシー
-- =====================================================

-- idol_groups
alter table idol_groups enable row level security;

create policy "idol_groups: 全ユーザーが閲覧可能"
  on idol_groups for select using (true);

create policy "idol_groups: organizer/adminが作成可能"
  on idol_groups for insert
  with check (
    organizer_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role in ('organizer', 'admin'))
  );

create policy "idol_groups: 自分のグループまたはadminが更新可能"
  on idol_groups for update
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "idol_groups: 自分のグループまたはadminが削除可能"
  on idol_groups for delete
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- idol_group_admins
alter table idol_group_admins enable row level security;

create policy "idol_group_admins: 関係者が閲覧可能"
  on idol_group_admins for select
  using (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "idol_group_admins: グループオーナーが管理可能"
  on idol_group_admins for insert
  with check (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "idol_group_admins: グループオーナーが削除可能"
  on idol_group_admins for delete
  using (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- idol_members
alter table idol_members enable row level security;

create policy "idol_members: 全ユーザーが閲覧可能"
  on idol_members for select using (true);

create policy "idol_members: グループオーナーが作成可能"
  on idol_members for insert
  with check (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "idol_members: グループオーナーが更新可能"
  on idol_members for update
  using (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "idol_members: グループオーナーが削除可能"
  on idol_members for delete
  using (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
