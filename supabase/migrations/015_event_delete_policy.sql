-- events: 作成者またはadminが削除可能
drop policy if exists "events: organizer(自分のイベント)/adminが削除可能" on events;
create policy "events: organizer(自分のイベント)/adminが削除可能"
  on events for delete
  using (
    organizer_id = auth.uid()
    or user_has_role(array['admin'])
  );

-- ticket_products: イベント作成者またはadminが削除可能
drop policy if exists "ticket_products: organizer/adminが削除可能" on ticket_products;
create policy "ticket_products: organizer/adminが削除可能"
  on ticket_products for delete
  using (
    exists (
      select 1 from events
      where events.id = ticket_products.event_id
        and (events.organizer_id = auth.uid() or user_has_role(array['admin']))
    )
  );

-- event_performers: イベント作成者またはadminが削除可能
drop policy if exists "event_performers: organizer/adminが削除可能" on event_performers;
create policy "event_performers: organizer/adminが削除可能"
  on event_performers for delete
  using (
    exists (
      select 1 from events
      where events.id = event_performers.event_id
        and (events.organizer_id = auth.uid() or user_has_role(array['admin']))
    )
  );
