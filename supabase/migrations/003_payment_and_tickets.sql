-- =====================================================
-- 003 + 004 統合マイグレーション
-- 決済注文テーブル + チケット構造の再設計
-- Supabase SQL Editorで一括実行用
-- =====================================================


-- =====================================================
-- PART 1: payment_orders (決済注文)
-- =====================================================
create table payment_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  order_type text not null check (order_type in ('point_charge', 'ticket_purchase')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  amount integer not null check (amount > 0),
  tax integer not null default 0 check (tax >= 0),
  points_amount integer check (points_amount is null or points_amount > 0),
  ticket_product_id uuid references ticket_products(id),
  ticket_quantity integer check (ticket_quantity is null or ticket_quantity > 0),
  -- GMO PG 取引情報
  gmo_access_id text,
  gmo_access_pass text,
  gmo_order_id text not null unique,
  gmo_job_cd text not null default 'CAPTURE',
  gmo_method text,
  gmo_forward text,
  gmo_approve text,
  gmo_tran_id text,
  gmo_tran_date text,
  -- エラー情報
  error_code text,
  error_message text,
  -- メタデータ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table payment_orders is '決済注文（GMOペイメントゲートウェイ連携）';
comment on column payment_orders.order_type is '注文種別: point_charge=ポイントチャージ, ticket_purchase=チケット直接購入';
comment on column payment_orders.amount is '決済金額（税込、円）';
comment on column payment_orders.tax is '消費税額（円）';
comment on column payment_orders.points_amount is 'チャージするポイント数（ポイントチャージ時のみ）';
comment on column payment_orders.gmo_access_id is 'GMO PG: EntryTranで発行されるAccessID';
comment on column payment_orders.gmo_access_pass is 'GMO PG: EntryTranで発行されるAccessPass';
comment on column payment_orders.gmo_order_id is 'GMO PG: 加盟店側で管理する注文ID';
comment on column payment_orders.gmo_job_cd is 'GMO PG: 処理区分 (CAPTURE=即時売上, AUTH=仮売上)';

create index idx_payment_orders_user on payment_orders(user_id);
create index idx_payment_orders_status on payment_orders(status);
create index idx_payment_orders_gmo_order_id on payment_orders(gmo_order_id);
create index idx_payment_orders_created_at on payment_orders(created_at desc);

create trigger payment_orders_updated_at
  before update on payment_orders
  for each row execute function update_updated_at();

-- payment_orders RLS
alter table payment_orders enable row level security;

create policy "payment_orders: 自分の注文のみ閲覧可能"
  on payment_orders for select
  using (user_id = auth.uid());

create policy "payment_orders: 自分の注文のみ作成可能"
  on payment_orders for insert
  with check (user_id = auth.uid());

-- point_transactions insert ポリシー
create policy "point_transactions: service_role経由で作成可能"
  on point_transactions for insert
  with check (true);


-- =====================================================
-- PART 2: チケット構造の再設計
-- =====================================================

-- event_slot_members (タイムスロット毎の出演メンバー)
create table event_slot_members (
  id uuid primary key default uuid_generate_v4(),
  event_time_slot_id uuid not null references event_time_slots(id) on delete cascade,
  idol_id uuid references profiles(id),
  display_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table event_slot_members is 'タイムスロット毎の出演メンバー';
comment on column event_slot_members.idol_id is 'プロフィール参照（未登録メンバーはNULL可）';
comment on column event_slot_members.display_name is '表示名（プロフィール名と別管理可能）';

create index idx_event_slot_members_slot on event_slot_members(event_time_slot_id);
create index idx_event_slot_members_idol on event_slot_members(idol_id);

-- ticket_products にカラムを追加
alter table ticket_products
  add column if not exists event_slot_member_id uuid references event_slot_members(id) on delete cascade,
  add column if not exists ticket_type text not null default '撮影券',
  add column if not exists price integer not null default 0 check (price >= 0);

comment on column ticket_products.event_slot_member_id is '出演メンバー参照（新構造）';
comment on column ticket_products.ticket_type is '券種（撮影券、チェキ券、サイン券等）';
comment on column ticket_products.price is '価格（円）';

create index idx_ticket_products_slot_member on ticket_products(event_slot_member_id);

-- ticket_holds (チケット仮押さえ)
create table ticket_holds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  payment_order_id uuid references payment_orders(id),
  status text not null default 'held' check (status in ('held', 'purchased', 'released', 'expired')),
  total_amount integer not null default 0 check (total_amount >= 0),
  held_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

comment on table ticket_holds is 'チケット仮押さえ（決済前の在庫確保）';
comment on column ticket_holds.expires_at is '有効期限（デフォルト15分）';

create index idx_ticket_holds_user on ticket_holds(user_id);
create index idx_ticket_holds_status on ticket_holds(status);
create index idx_ticket_holds_expires on ticket_holds(expires_at);

-- ticket_hold_items (仮押さえ明細)
create table ticket_hold_items (
  id uuid primary key default uuid_generate_v4(),
  ticket_hold_id uuid not null references ticket_holds(id) on delete cascade,
  ticket_product_id uuid not null references ticket_products(id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

comment on table ticket_hold_items is '仮押さえ明細（チケット種×枚数）';

create index idx_ticket_hold_items_hold on ticket_hold_items(ticket_hold_id);
create index idx_ticket_hold_items_product on ticket_hold_items(ticket_product_id);

-- user_tickets にメタデータを追加
alter table user_tickets
  add column if not exists ticket_hold_id uuid references ticket_holds(id),
  add column if not exists payment_order_id uuid references payment_orders(id);


-- =====================================================
-- PART 3: RLS ポリシー（新テーブル用）
-- =====================================================

-- event_slot_members
alter table event_slot_members enable row level security;

create policy "event_slot_members: 全ユーザーが閲覧可能"
  on event_slot_members for select using (true);

create policy "event_slot_members: adminのみ作成可能"
  on event_slot_members for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "event_slot_members: adminのみ更新可能"
  on event_slot_members for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "event_slot_members: adminのみ削除可能"
  on event_slot_members for delete
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ticket_holds
alter table ticket_holds enable row level security;

create policy "ticket_holds: 自分の仮押さえのみ閲覧可能"
  on ticket_holds for select using (user_id = auth.uid());

create policy "ticket_holds: 自分の仮押さえのみ作成可能"
  on ticket_holds for insert with check (user_id = auth.uid());

create policy "ticket_holds: 自分の仮押さえのみ更新可能"
  on ticket_holds for update using (user_id = auth.uid());

-- ticket_hold_items
alter table ticket_hold_items enable row level security;

create policy "ticket_hold_items: 自分の仮押さえ明細のみ閲覧可能"
  on ticket_hold_items for select
  using (exists (
    select 1 from ticket_holds
    where ticket_holds.id = ticket_hold_items.ticket_hold_id
    and ticket_holds.user_id = auth.uid()
  ));

create policy "ticket_hold_items: 自分の仮押さえ明細のみ作成可能"
  on ticket_hold_items for insert
  with check (exists (
    select 1 from ticket_holds
    where ticket_holds.id = ticket_hold_items.ticket_hold_id
    and ticket_holds.user_id = auth.uid()
  ));

-- event_dates / event_time_slots のRLS
alter table event_dates enable row level security;

create policy "event_dates: 全ユーザーが閲覧可能"
  on event_dates for select using (true);

create policy "event_dates: adminのみ作成可能"
  on event_dates for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

alter table event_time_slots enable row level security;

create policy "event_time_slots: 全ユーザーが閲覧可能"
  on event_time_slots for select using (true);

create policy "event_time_slots: adminのみ作成可能"
  on event_time_slots for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
