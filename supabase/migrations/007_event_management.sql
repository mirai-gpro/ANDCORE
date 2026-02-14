-- =====================================================
-- 007: イベント管理機能の拡張
-- イベントに詳細情報・複数日程・時間帯を追加
-- =====================================================

-- 1. events テーブルにカラム追加
alter table events add column if not exists subtitle text;
alter table events add column if not exists performers text;
alter table events add column if not exists venue_name text;
alter table events add column if not exists venue_map_url text;
alter table events add column if not exists ticket_price integer;
alter table events add column if not exists image_url text;
alter table events add column if not exists youtube_url text;
alter table events add column if not exists x_url text;
alter table events add column if not exists instagram_url text;
alter table events add column if not exists tiktok_url text;

comment on column events.subtitle is 'イベントサブタイトル';
comment on column events.performers is '出演者（テキスト）';
comment on column events.venue_name is '会場名';
comment on column events.venue_map_url is '会場のGoogleMapリンク';
comment on column events.ticket_price is 'チケット代金（円）NULLは無料';
comment on column events.image_url is 'イベント画像URL';
comment on column events.youtube_url is 'YouTube リンク';
comment on column events.x_url is 'X (Twitter) リンク';
comment on column events.instagram_url is 'Instagram リンク';
comment on column events.tiktok_url is 'TikTok リンク';

-- 2. event_dates: イベント開催日（複数日程対応）
create table event_dates (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  event_date date not null,
  created_at timestamptz not null default now()
);

comment on table event_dates is 'イベント開催日（1イベントに複数日程）';
create index idx_event_dates_event on event_dates(event_id, event_date);

-- 3. event_time_slots: 開催日ごとの時間帯（同日複数回対応）
create table event_time_slots (
  id uuid primary key default uuid_generate_v4(),
  event_date_id uuid not null references event_dates(id) on delete cascade,
  start_time time not null,
  door_time time not null,
  created_at timestamptz not null default now()
);

comment on table event_time_slots is '開催日ごとの時間帯（開始時間・開場時間）';
create index idx_event_time_slots_date on event_time_slots(event_date_id);

-- =====================================================
-- RLS ポリシー
-- =====================================================

-- event_dates
alter table event_dates enable row level security;

create policy "event_dates: 全ユーザーが閲覧可能"
  on event_dates for select using (true);

create policy "event_dates: イベント作成者が作成可能"
  on event_dates for insert
  with check (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_dates: イベント作成者が更新可能"
  on event_dates for update
  using (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_dates: イベント作成者が削除可能"
  on event_dates for delete
  using (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- event_time_slots
alter table event_time_slots enable row level security;

create policy "event_time_slots: 全ユーザーが閲覧可能"
  on event_time_slots for select using (true);

create policy "event_time_slots: イベント作成者が作成可能"
  on event_time_slots for insert
  with check (
    exists (
      select 1 from event_dates
      join events on events.id = event_dates.event_id
      where event_dates.id = event_date_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_time_slots: イベント作成者が更新可能"
  on event_time_slots for update
  using (
    exists (
      select 1 from event_dates
      join events on events.id = event_dates.event_id
      where event_dates.id = event_date_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_time_slots: イベント作成者が削除可能"
  on event_time_slots for delete
  using (
    exists (
      select 1 from event_dates
      join events on events.id = event_dates.event_id
      where event_dates.id = event_date_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
