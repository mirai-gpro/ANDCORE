"""ヘルスチェックエンドポイント"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
async def healthcheck():
    return {"status": "ok", "service": "encore-api"}
