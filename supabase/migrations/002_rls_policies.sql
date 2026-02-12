-- =====================================================
-- Row Level Security (RLS) ポリシー
-- 「自分のデータしか見れない」をDBレベルで強制
-- =====================================================

-- profiles
alter table profiles enable row level security;

create policy "profiles: 自分のプロフィールは閲覧可能"
  on profiles for select
  using (true);

create policy "profiles: 自分のプロフィールのみ更新可能"
  on profiles for update
  using (auth.uid() = id);

-- events
alter table events enable row level security;

create policy "events: 全ユーザーが閲覧可能"
  on events for select
  using (true);

create policy "events: adminのみ作成可能"
  on events for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "events: adminのみ更新可能"
  on events for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ticket_products
alter table ticket_products enable row level security;

create policy "ticket_products: 全ユーザーが閲覧可能"
  on ticket_products for select
  using (true);

create policy "ticket_products: adminのみ作成可能"
  on ticket_products for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- user_tickets
alter table user_tickets enable row level security;

create policy "user_tickets: 自分のチケットのみ閲覧可能"
  on user_tickets for select
  using (user_id = auth.uid());

create policy "user_tickets: fanが自分用に作成可能"
  on user_tickets for insert
  with check (user_id = auth.uid());

create policy "user_tickets: idol/adminがステータス更新可能"
  on user_tickets for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('idol', 'admin')
    )
  );

-- media_assets
alter table media_assets enable row level security;

create policy "media_assets: 自分が関わる写真のみ閲覧可能"
  on media_assets for select
  using (
    user_id = auth.uid()
    or idol_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "media_assets: idol/adminが作成可能"
  on media_assets for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('idol', 'admin')
    )
  );

create policy "media_assets: idol/adminが更新可能"
  on media_assets for update
  using (
    idol_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- point_transactions
alter table point_transactions enable row level security;

create policy "point_transactions: 自分の履歴のみ閲覧可能"
  on point_transactions for select
  using (user_id = auth.uid());
