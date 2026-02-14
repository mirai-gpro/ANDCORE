-- =====================================================
-- 003: 役割体系の再設計
-- fan / idol / organizer / admin の4ロール制
-- =====================================================

-- 1. profiles.role に organizer を追加
alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  check (role in ('fan', 'idol', 'organizer', 'admin'));

-- 2. organizer_id テーブル: アイドルが所属する運営者
-- idol は必ず organizer に所属する
create table if not exists idol_organizer (
  idol_id uuid not null references profiles(id) on delete cascade,
  organizer_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idol_id, organizer_id)
);

comment on table idol_organizer is 'アイドル ↔ 運営者の所属関係';
create index if not exists idx_idol_organizer_organizer on idol_organizer(organizer_id);

-- 3. RLSポリシーの更新: events
-- 既存ポリシーを削除して再作成
drop policy if exists "events: adminのみ作成可能" on events;
drop policy if exists "events: adminのみ更新可能" on events;

drop policy if exists "events: organizer/adminが作成可能" on events;
create policy "events: organizer/adminが作成可能"
  on events for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

drop policy if exists "events: organizer(自分のイベント)/adminが更新可能" on events;
create policy "events: organizer(自分のイベント)/adminが更新可能"
  on events for update
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 4. RLSポリシーの更新: ticket_products
drop policy if exists "ticket_products: adminのみ作成可能" on ticket_products;

drop policy if exists "ticket_products: organizer/adminが作成可能" on ticket_products;
create policy "ticket_products: organizer/adminが作成可能"
  on ticket_products for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

-- 5. RLSポリシーの更新: user_tickets
drop policy if exists "user_tickets: idol/adminがステータス更新可能" on user_tickets;

drop policy if exists "user_tickets: organizer/idol/adminがステータス更新可能" on user_tickets;
create policy "user_tickets: organizer/idol/adminがステータス更新可能"
  on user_tickets for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('idol', 'organizer', 'admin')
    )
  );

-- 6. RLSポリシーの更新: media_assets
drop policy if exists "media_assets: 自分が関わる写真のみ閲覧可能" on media_assets;
drop policy if exists "media_assets: idol/adminが作成可能" on media_assets;
drop policy if exists "media_assets: idol/adminが更新可能" on media_assets;

drop policy if exists "media_assets: idol/organizer/adminが作成可能" on media_assets;
drop policy if exists "media_assets: idol/organizer/adminが更新可能" on media_assets;

create policy "media_assets: 自分が関わる写真のみ閲覧可能"
  on media_assets for select
  using (
    user_id = auth.uid()
    or idol_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

create policy "media_assets: idol/organizer/adminが作成可能"
  on media_assets for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('idol', 'organizer', 'admin')
    )
  );

create policy "media_assets: idol/organizer/adminが更新可能"
  on media_assets for update
  using (
    idol_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

-- 7. idol_organizer の RLS
alter table idol_organizer enable row level security;

drop policy if exists "idol_organizer: 関係者が閲覧可能" on idol_organizer;
create policy "idol_organizer: 関係者が閲覧可能"
  on idol_organizer for select
  using (
    idol_id = auth.uid()
    or organizer_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "idol_organizer: organizer/adminが管理可能" on idol_organizer;
create policy "idol_organizer: organizer/adminが管理可能"
  on idol_organizer for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

drop policy if exists "idol_organizer: organizer/adminが削除可能" on idol_organizer;
create policy "idol_organizer: organizer/adminが削除可能"
  on idol_organizer for delete
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
