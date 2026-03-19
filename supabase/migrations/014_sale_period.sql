-- =====================================================
-- 014: チケット販売期間の追加
-- 各開催日ごとに販売開始・終了日時を設定可能にする
-- =====================================================

alter table event_dates add column if not exists sale_start_at timestamptz;
alter table event_dates add column if not exists sale_end_at timestamptz;

comment on column event_dates.sale_start_at is 'チケット販売開始日時';
comment on column event_dates.sale_end_at is 'チケット販売終了日時';
