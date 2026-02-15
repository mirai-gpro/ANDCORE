-- =====================================================
-- 004: アイドル向けファンコミュニティ機能
-- ファンランキング・お知らせ・メッセージ
-- =====================================================

-- 1. fan_follows: ファン→アイドルの推し登録
create table if not exists fan_follows (
  fan_id uuid not null references profiles(id) on delete cascade,
  idol_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fan_id, idol_id)
);

comment on table fan_follows is 'ファンの推し登録（誰を推しているか）';
create index if not exists idx_fan_follows_idol on fan_follows(idol_id);

-- 2. fan_engagement: ファンのアイドル別エンゲージメントスコア
-- チケット購入、撮影参加、推し期間などから算出
create table if not exists fan_engagement (
  id uuid primary key default uuid_generate_v4(),
  fan_id uuid not null references profiles(id) on delete cascade,
  idol_id uuid not null references profiles(id) on delete cascade,
  total_points_spent integer not null default 0,
  event_count integer not null default 0,
  photo_count integer not null default 0,
  engagement_score integer not null default 0,
  rank_position integer,
  updated_at timestamptz not null default now(),
  unique (fan_id, idol_id)
);

comment on table fan_engagement is 'ファンのアイドル別エンゲージメント集計';
create index if not exists idx_fan_engagement_idol_score on fan_engagement(idol_id, engagement_score desc);

-- 3. idol_announcements: アイドルからファンへのお知らせ
create table if not exists idol_announcements (
  id uuid primary key default uuid_generate_v4(),
  idol_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table idol_announcements is 'アイドルからファンへのお知らせ投稿';
create index if not exists idx_idol_announcements_idol on idol_announcements(idol_id, published_at desc);

-- 4. fan_messages: ファン↔アイドルの1:1メッセージ
create table if not exists fan_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table fan_messages is 'ファン↔アイドル間のメッセージ';
create index if not exists idx_fan_messages_receiver on fan_messages(receiver_id, created_at desc);
create index if not exists idx_fan_messages_sender on fan_messages(sender_id, created_at desc);

-- =====================================================
-- RLS ポリシー
-- =====================================================

-- fan_follows
alter table fan_follows enable row level security;

drop policy if exists "fan_follows: 全ユーザーが閲覧可能" on fan_follows;
create policy "fan_follows: 全ユーザーが閲覧可能"
  on fan_follows for select using (true);

drop policy if exists "fan_follows: ファンが自分のフォローを管理" on fan_follows;
create policy "fan_follows: ファンが自分のフォローを管理"
  on fan_follows for insert
  with check (fan_id = auth.uid());

drop policy if exists "fan_follows: ファンが自分のフォローを解除" on fan_follows;
create policy "fan_follows: ファンが自分のフォローを解除"
  on fan_follows for delete
  using (fan_id = auth.uid());

-- fan_engagement
alter table fan_engagement enable row level security;

drop policy if exists "fan_engagement: アイドルが自分のファンランキングを閲覧" on fan_engagement;
create policy "fan_engagement: アイドルが自分のファンランキングを閲覧"
  on fan_engagement for select
  using (
    idol_id = auth.uid()
    or fan_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('organizer', 'admin'))
  );

-- idol_announcements
alter table idol_announcements enable row level security;

drop policy if exists "idol_announcements: フォロワー/関係者が閲覧可能" on idol_announcements;
create policy "idol_announcements: フォロワー/関係者が閲覧可能"
  on idol_announcements for select
  using (true);

drop policy if exists "idol_announcements: アイドルが自分のお知らせを投稿" on idol_announcements;
create policy "idol_announcements: アイドルが自分のお知らせを投稿"
  on idol_announcements for insert
  with check (idol_id = auth.uid());

drop policy if exists "idol_announcements: アイドルが自分のお知らせを編集" on idol_announcements;
create policy "idol_announcements: アイドルが自分のお知らせを編集"
  on idol_announcements for update
  using (idol_id = auth.uid());

drop policy if exists "idol_announcements: アイドルが自分のお知らせを削除" on idol_announcements;
create policy "idol_announcements: アイドルが自分のお知らせを削除"
  on idol_announcements for delete
  using (idol_id = auth.uid());

-- fan_messages
alter table fan_messages enable row level security;

drop policy if exists "fan_messages: 送受信者のみ閲覧可能" on fan_messages;
create policy "fan_messages: 送受信者のみ閲覧可能"
  on fan_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "fan_messages: 認証ユーザーが送信可能" on fan_messages;
create policy "fan_messages: 認証ユーザーが送信可能"
  on fan_messages for insert
  with check (sender_id = auth.uid());

drop policy if exists "fan_messages: 受信者が既読更新可能" on fan_messages;
create policy "fan_messages: 受信者が既読更新可能"
  on fan_messages for update
  using (receiver_id = auth.uid());
