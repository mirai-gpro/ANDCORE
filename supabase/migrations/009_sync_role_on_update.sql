-- =====================================================
-- 009: ロール同期 & RLS ポリシー修正
--
-- 問題:
--   Google OAuth 登録では signInWithIdToken → handle_new_user()
--   が先に走り role='fan' で profiles が作られる。
--   その後 updateUser({ data: { role: 'organizer' } }) で
--   auth.users の metadata は更新されるが profiles.role は
--   更新されない → RLS INSERT ポリシーが拒否する。
--
-- 修正 (3段構え):
--   1. RLS ポリシーを JWT user_metadata.role もチェックするよう変更
--   2. auth.users UPDATE トリガーで profiles.role を同期
--   3. 既存ユーザーの profiles.role を一括修正
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. ヘルパー関数: JWT or profiles からロールを判定
-- ─────────────────────────────────────────────────────
create or replace function public.user_has_role(allowed_roles text[])
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = any(allowed_roles)
  )
  or coalesce(
    auth.jwt()->'user_metadata'->>'role', ''
  ) = any(allowed_roles);
end;
$$ language plpgsql security definer stable;

-- ─────────────────────────────────────────────────────
-- 2. RLS ポリシー再作成: idol_groups
-- ─────────────────────────────────────────────────────
drop policy if exists "idol_groups: organizer/adminが作成可能" on idol_groups;
create policy "idol_groups: organizer/adminが作成可能"
  on idol_groups for insert
  with check (
    organizer_id = auth.uid()
    and user_has_role(array['organizer', 'admin'])
  );

drop policy if exists "idol_groups: 自分のグループまたはadminが更新可能" on idol_groups;
create policy "idol_groups: 自分のグループまたはadminが更新可能"
  on idol_groups for update
  using (
    organizer_id = auth.uid()
    or user_has_role(array['admin'])
  );

drop policy if exists "idol_groups: 自分のグループまたはadminが削除可能" on idol_groups;
create policy "idol_groups: 自分のグループまたはadminが削除可能"
  on idol_groups for delete
  using (
    organizer_id = auth.uid()
    or user_has_role(array['admin'])
  );

-- ─────────────────────────────────────────────────────
-- 3. RLS ポリシー再作成: events
-- ─────────────────────────────────────────────────────
drop policy if exists "events: organizer/adminが作成可能" on events;
create policy "events: organizer/adminが作成可能"
  on events for insert
  with check (
    user_has_role(array['organizer', 'admin'])
  );

drop policy if exists "events: organizer(自分のイベント)/adminが更新可能" on events;
create policy "events: organizer(自分のイベント)/adminが更新可能"
  on events for update
  using (
    organizer_id = auth.uid()
    or user_has_role(array['admin'])
  );

-- ─────────────────────────────────────────────────────
-- 4. RLS ポリシー再作成: ticket_products
-- ─────────────────────────────────────────────────────
drop policy if exists "ticket_products: organizer/adminが作成可能" on ticket_products;
create policy "ticket_products: organizer/adminが作成可能"
  on ticket_products for insert
  with check (
    user_has_role(array['organizer', 'admin'])
  );

-- ─────────────────────────────────────────────────────
-- 5. RLS ポリシー再作成: idol_group_admins
-- ─────────────────────────────────────────────────────
drop policy if exists "idol_group_admins: グループオーナーが管理可能" on idol_group_admins;
create policy "idol_group_admins: グループオーナーが管理可能"
  on idol_group_admins for insert
  with check (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or user_has_role(array['admin'])
  );

-- ─────────────────────────────────────────────────────
-- 6. RLS ポリシー再作成: idol_members
-- ─────────────────────────────────────────────────────
drop policy if exists "idol_members: グループオーナーが作成可能" on idol_members;
create policy "idol_members: グループオーナーが作成可能"
  on idol_members for insert
  with check (
    exists (
      select 1 from idol_groups
      where idol_groups.id = group_id and idol_groups.organizer_id = auth.uid()
    )
    or user_has_role(array['admin'])
  );

-- ─────────────────────────────────────────────────────
-- 7. RLS ポリシー再作成: event_performers (008由来)
-- ─────────────────────────────────────────────────────
drop policy if exists "event_performers: organizer/adminが作成可能" on event_performers;
create policy "event_performers: organizer/adminが作成可能"
  on event_performers for insert
  with check (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or user_has_role(array['admin'])
  );

-- event_dates
drop policy if exists "event_dates: organizer/adminが作成可能" on event_dates;
create policy "event_dates: organizer/adminが作成可能"
  on event_dates for insert
  with check (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or user_has_role(array['admin'])
  );

-- event_time_slots
drop policy if exists "event_time_slots: organizer/adminが作成可能" on event_time_slots;
drop policy if exists "event_time_slots: イベント作成者が作成可能" on event_time_slots;
create policy "event_time_slots: organizer/adminが作成可能"
  on event_time_slots for insert
  with check (
    exists (
      select 1 from event_dates ed
      join events e on e.id = ed.event_id
      where ed.id = event_date_id and e.organizer_id = auth.uid()
    )
    or user_has_role(array['admin'])
  );

-- ─────────────────────────────────────────────────────
-- 8. auth.users UPDATE トリガー（profiles.role 同期）
-- ─────────────────────────────────────────────────────
create or replace function sync_profile_role()
returns trigger as $$
declare
  new_role text;
begin
  new_role := new.raw_user_meta_data->>'role';

  if new_role is not null
     and new_role is distinct from (old.raw_user_meta_data->>'role')
     and new_role in ('fan', 'idol', 'organizer', 'admin')
  then
    update profiles
       set role = new_role
     where id = new.id;
  end if;

  return new;
exception
  when others then
    raise log 'sync_profile_role failed for %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_updated_sync_role on auth.users;
create trigger on_auth_user_updated_sync_role
  after update on auth.users
  for each row
  execute function sync_profile_role();

-- ─────────────────────────────────────────────────────
-- 9. profiles に INSERT ポリシーを追加
-- handle_new_user トリガーが失敗した場合のフォールバック用
-- ─────────────────────────────────────────────────────
drop policy if exists "profiles: 自分のプロフィールを作成可能" on profiles;
create policy "profiles: 自分のプロフィールを作成可能"
  on profiles for insert
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────
-- 10. 既存ユーザーの profiles.role を一括修正
-- ─────────────────────────────────────────────────────
update profiles p
set role = u.raw_user_meta_data->>'role'
from auth.users u
where p.id = u.id
  and u.raw_user_meta_data->>'role' in ('organizer', 'idol', 'admin')
  and p.role = 'fan';
