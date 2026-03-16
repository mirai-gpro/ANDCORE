-- =====================================================
-- 013: ticket_products.idol_id を nullable に変更
-- 新構造では event_slot_member_id でメンバーを参照するため
-- idol_id の NOT NULL 制約は不要
-- =====================================================

alter table ticket_products
  alter column idol_id drop not null;
