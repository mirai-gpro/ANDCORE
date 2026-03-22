-- =====================================================
-- 018: Supabase Storage バケット作成
-- イベント画像・アイドル写真用のストレージ設定
-- =====================================================

-- photos バケット作成（公開アクセス可）
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- アップロードポリシー: organizer/admin がアップロード可能
create policy "photos: organizer/adminがアップロード可能"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
    and user_has_role(array['organizer', 'admin'])
  );

-- 更新ポリシー: organizer/admin が更新可能
create policy "photos: organizer/adminが更新可能"
  on storage.objects for update
  using (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
    and user_has_role(array['organizer', 'admin'])
  );

-- 閲覧ポリシー: 公開バケットなので全員閲覧可能
create policy "photos: 全員が閲覧可能"
  on storage.objects for select
  using (bucket_id = 'photos');

-- 削除ポリシー: organizer/admin が削除可能
create policy "photos: organizer/adminが削除可能"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
    and user_has_role(array['organizer', 'admin'])
  );
