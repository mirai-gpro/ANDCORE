-- =====================================================
-- 009: auth.users UPDATE 時に profiles.role を同期
--
-- 問題:
--   Google OAuth 登録では signInWithIdToken → handle_new_user()
--   が先に走り role='fan' で profiles が作られる。
--   その後 updateUser({ data: { role: 'organizer' } }) で
--   auth.users の metadata は更新されるが profiles.role は
--   更新されないため RLS INSERT ポリシーが拒否する。
--
-- 修正:
--   auth.users の UPDATE をフックして raw_user_meta_data の
--   role が変わったら profiles.role に反映する。
-- =====================================================

create or replace function sync_profile_role()
returns trigger as $$
declare
  new_role text;
begin
  new_role := new.raw_user_meta_data->>'role';

  -- role が設定されていて、かつ変更があった場合のみ更新
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

-- トリガー登録
drop trigger if exists on_auth_user_updated_sync_role on auth.users;
create trigger on_auth_user_updated_sync_role
  after update on auth.users
  for each row
  execute function sync_profile_role();
