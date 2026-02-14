-- =====================================================
-- 008: イベント出演者（アイドルグループ）の紐付け
-- event_performers: イベントと登録済アイドルグループの多対多リレーション
-- events.performers は「フリー入力」の出演者テキストとして継続利用
-- =====================================================

-- 1. event_performers: イベント × アイドルグループのジャンクションテーブル
create table event_performers (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  idol_group_id uuid not null references idol_groups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, idol_group_id)
);

comment on table event_performers is 'イベントの出演アイドルグループ（多対多）';
create index idx_event_performers_event on event_performers(event_id, sort_order);
create index idx_event_performers_group on event_performers(idol_group_id);

-- performers カラムのコメントを更新
comment on column events.performers is '出演者フリー入力テキスト（登録外の出演者用）';

-- =====================================================
-- RLS ポリシー
-- =====================================================

alter table event_performers enable row level security;

create policy "event_performers: 全ユーザーが閲覧可能"
  on event_performers for select using (true);

create policy "event_performers: イベント作成者が作成可能"
  on event_performers for insert
  with check (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_performers: イベント作成者が更新可能"
  on event_performers for update
  using (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "event_performers: イベント作成者が削除可能"
  on event_performers for delete
  using (
    exists (
      select 1 from events
      where events.id = event_id and events.organizer_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
