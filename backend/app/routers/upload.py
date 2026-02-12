"""画像アップロード用Signed URL発行"""

import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["upload"])


class SignedUrlRequest(BaseModel):
    content_type: str = "image/jpeg"
    file_extension: str = "jpg"


class SignedUrlResponse(BaseModel):
    upload_url: str
    object_path: str


@router.post("/upload/signed-url", response_model=SignedUrlResponse)
async def generate_signed_url(req: SignedUrlRequest):
    """
    GCSへの直接アップロード用Signed URLを発行する。
    フロントエンドからGCSへ直接アップロードし、サーバー負荷を軽減する。
    """
    try:
        from google.cloud import storage as gcs

        client = gcs.Client()
        bucket = client.bucket(settings.gcs_bucket_name)

        object_name = f"uploads/{uuid.uuid4()}.{req.file_extension}"
        blob = bucket.blob(object_name)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="PUT",
            content_type=req.content_type,
        )

        return SignedUrlResponse(upload_url=url, object_path=object_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signed URL生成に失敗: {str(e)}")
