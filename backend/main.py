"""
アンコール (Encore) - バックエンド API
特典会DXサービス: 画像合成・決済Webhook・バッチ処理
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, media, payment, upload

app = FastAPI(
    title="Encore API",
    description="特典会DXサービス「アンコール」バックエンドAPI",
    version="0.1.0",
)

# CORS設定
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:4321").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(upload.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(payment.router, prefix="/api")
