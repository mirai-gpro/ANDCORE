-- =====================================================
-- 006: handle_new_user トリガーの堅牢化
-- Google認証時のDB保存エラーを修正
-- =====================================================

-- 問題:
--   signInWithIdToken (Google) で新規ユーザー作成時に
--   "Database error saving new user" (500) が発生。
--   原因: トリガーが失敗すると auth.users の INSERT 全体がロールバックされる。
--
-- 修正:
--   1. ON CONFLICT DO NOTHING で重複エラーを防止
--   2. Google認証の metadata から full_name / avatar_url を取得
--   3. EXCEPTION ハンドリングでトリガー失敗時もユーザー作成を継続

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'fan'),
    coalesce(
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise log 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;
