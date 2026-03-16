-- =====================================================
-- 013: ticket_products の旧カラム制約を緩和
-- 新構造では event_slot_member_id + ticket_type + price で管理するため
-- 旧スキーマの idol_id, title, price_points, duration_seconds は不要
-- =====================================================

alter table ticket_products
  alter column idol_id drop not null;

alter table ticket_products
  alter column title drop not null;

alter table ticket_products
  alter column price_points drop not null,
  alter column price_points drop default,
  alter column price_points set default 0;

-- price_points の CHECK 制約 (> 0) を削除して >= 0 に変更
alter table ticket_products drop constraint if exists ticket_products_price_points_check;
alter table ticket_products add constraint ticket_products_price_points_check check (price_points >= 0);

alter table ticket_products
  alter column duration_seconds drop not null,
  alter column duration_seconds set default 0;

-- duration_seconds の CHECK 制約 (> 0) を削除して >= 0 に変更
alter table ticket_products drop constraint if exists ticket_products_duration_seconds_check;
alter table ticket_products add constraint ticket_products_duration_seconds_check check (duration_seconds >= 0);
