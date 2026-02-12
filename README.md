# ANDCORE - アンコール

特典会DXサービス「アンコール」- ファンとアイドルをつなぐデジタル特典会プラットフォーム

## Tech Stack

- **Frontend**: Astro (SSR) + React - Vercel
- **Backend**: Python / FastAPI - Google Cloud Run
- **Auth / DB**: Supabase (PostgreSQL)
- **Storage**: Google Cloud Storage

## Project Structure

```
ANDCORE/
├── frontend/          # Astro + React (Vercel)
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   ├── layouts/     # Astroレイアウト
│   │   ├── lib/         # Supabaseクライアント等
│   │   └── pages/       # ページルーティング
│   └── public/
├── backend/           # Python FastAPI (Cloud Run)
│   ├── app/
│   │   └── routers/   # APIエンドポイント
│   ├── Dockerfile
│   └── main.py
├── supabase/          # DBマイグレーション
│   └── migrations/
└── docs/              # 設計書・提案書
```

## Getting Started

### Frontend

```bash
cd frontend
cp .env.example .env  # Supabase接続情報を設定
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 環境変数を設定
uvicorn main:app --reload --port 8080
```

### Database

`supabase/migrations/` 内のSQLをSupabaseのSQL Editorで実行してください。

1. `001_initial_schema.sql` - テーブル定義
2. `002_rls_policies.sql` - Row Level Security
