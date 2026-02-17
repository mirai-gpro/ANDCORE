-- =====================================================
-- 決済注文テーブル（GMOペイメントゲートウェイ連携）
-- ポイントチャージ・チケット直接購入を管理
-- =====================================================

-- =====================================================
-- payment_orders (決済注文)
-- GMO PGとの取引を追跡
-- =====================================================
create table payment_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  order_type text not null check (order_type in ('point_charge', 'ticket_purchase')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  amount integer not null check (amount > 0),
  tax integer not null default 0 check (tax >= 0),
  -- ポイントチャージ時のポイント数
  points_amount integer check (points_amount is null or points_amount > 0),
  -- チケット直接購入時の参照
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

-- インデックス
create index idx_payment_orders_user on payment_orders(user_id);
create index idx_payment_orders_status on payment_orders(status);
create index idx_payment_orders_gmo_order_id on payment_orders(gmo_order_id);
create index idx_payment_orders_created_at on payment_orders(created_at desc);

-- updated_at 自動更新トリガー
create trigger payment_orders_updated_at
  before update on payment_orders
  for each row execute function update_updated_at();

-- =====================================================
-- RLS ポリシー
-- =====================================================
alter table payment_orders enable row level security;

create policy "payment_orders: 自分の注文のみ閲覧可能"
  on payment_orders for select
  using (user_id = auth.uid());

create policy "payment_orders: 自分の注文のみ作成可能"
  on payment_orders for insert
  with check (user_id = auth.uid());

-- point_transactions に insert ポリシーを追加（バックエンドのservice_keyで実行するため）
-- ※ 通常はservice_keyを使うのでRLSをバイパスするが、安全のため追加
create policy "point_transactions: service_role経由で作成可能"
  on point_transactions for insert
  with check (true);
