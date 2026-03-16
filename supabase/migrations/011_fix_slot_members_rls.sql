-- =====================================================
-- 011: event_slot_members の RLS を organizer にも許可
-- organizer がイベント作成時にメンバーを追加できるようにする
-- =====================================================

-- 既存ポリシー削除
drop policy if exists "event_slot_members: adminのみ作成可能" on event_slot_members;
drop policy if exists "event_slot_members: adminのみ更新可能" on event_slot_members;
drop policy if exists "event_slot_members: adminのみ削除可能" on event_slot_members;

-- INSERT: organizer/admin が作成可能
create policy "event_slot_members: organizer/adminが作成可能"
  on event_slot_members for insert
  with check (
    user_has_role(array['organizer', 'admin'])
  );

-- UPDATE: organizer/admin が更新可能
create policy "event_slot_members: organizer/adminが更新可能"
  on event_slot_members for update
  using (
    user_has_role(array['organizer', 'admin'])
  );

-- DELETE: organizer/admin が削除可能
create policy "event_slot_members: organizer/adminが削除可能"
  on event_slot_members for delete
  using (
    user_has_role(array['organizer', 'admin'])
  );
