-- =====================================================
-- アンコール (Encore) - 初期スキーマ定義
-- 特典会DXサービス
-- =====================================================

-- UUID生成の拡張
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. profiles (ユーザープロフィール)
-- auth.usersと1:1で紐付け、ロール識別はここで管理
-- =====================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('fan', 'idol', 'admin')) default 'fan',
  nickname text,
  avatar_url text,
  points_balance integer not null default 0 check (points_balance >= 0),
  rank_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'ユーザープロフィール（全ロール共通）';
comment on column profiles.points_balance is 'ポイント残高（0以上）';
comment on column profiles.rank_score is '推し活ランキングスコア';

-- =====================================================
-- 2. events (イベント)
-- =====================================================
create table events (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid not null references profiles(id),
  title text not null,
  description text,
  event_date timestamptz,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table events is '特典会イベント';

-- =====================================================
-- 3. ticket_products (特典券商品マスタ)
-- =====================================================
create table ticket_products (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  idol_id uuid not null references profiles(id),
  title text not null,
  description text,
  price_points integer not null check (price_points > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  stock_limit integer check (stock_limit is null or stock_limit > 0),
  sold_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table ticket_products is '特典券商品マスタ（2ショットチェキ等）';
comment on column ticket_products.duration_seconds is '撮影時間（秒）';
comment on column ticket_products.stock_limit is '販売上限（NULLは無制限）';

-- =====================================================
-- 4. user_tickets (購入済みチケット)
-- =====================================================
create table user_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  ticket_product_id uuid not null references ticket_products(id),
  status text not null default 'valid' check (status in ('valid', 'used', 'expired', 'refunded')),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table user_tickets is '購入済みチケット（ファンのインベントリ）';

-- =====================================================
-- 5. media_assets (撮影データ・成果物)
-- =====================================================
create table media_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  idol_id uuid not null references profiles(id),
  event_id uuid not null references events(id),
  ticket_id uuid references user_tickets(id),
  original_url text,
  decorated_url text,
  voice_message_url text,
  media_type text not null check (media_type in ('photo', 'video')),
  status text not null default 'pending_review' check (status in ('pending_review', 'published', 'rejected')),
  created_at timestamptz not null default now()
);

comment on table media_assets is '撮影データ（写真・動画）';
comment on column media_assets.original_url is 'GCS上の撮影生データパス';
comment on column media_assets.decorated_url is 'GCS上の落書き済みデータパス';
comment on column media_assets.voice_message_url is 'GCS上のボイスメッセージパス';

-- =====================================================
-- 6. point_transactions (ポイント取引履歴)
-- =====================================================
create table point_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  amount integer not null,
  balance_after integer not null,
  type text not null check (type in ('charge', 'purchase', 'refund', 'bonus')),
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);

comment on table point_transactions is 'ポイント取引履歴（入金・消費・返金・ボーナス）';

-- =====================================================
-- インデックス
-- =====================================================
create index idx_events_organizer on events(organizer_id);
create index idx_events_status on events(status);
create index idx_events_date on events(event_date);
create index idx_ticket_products_event on ticket_products(event_id);
create index idx_ticket_products_idol on ticket_products(idol_id);
create index idx_user_tickets_user on user_tickets(user_id);
create index idx_user_tickets_status on user_tickets(status);
create index idx_media_assets_user on media_assets(user_id);
create index idx_media_assets_idol on media_assets(idol_id);
create index idx_media_assets_event on media_assets(event_id);
create index idx_point_transactions_user on point_transactions(user_id);

-- =====================================================
-- updated_at 自動更新トリガー
-- =====================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger events_updated_at
  before update on events
  for each row execute function update_updated_at();

-- =====================================================
-- 新規ユーザー登録時に自動でprofilesレコードを作成
-- =====================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'fan'),
    new.raw_user_meta_data->>'nickname'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
