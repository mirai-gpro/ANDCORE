"""画像合成処理（フレーム合成・落書き焼き付け）"""

import io
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from PIL import Image

router = APIRouter(tags=["media"])


@router.post("/media/composite")
async def composite_image(
    base_image: UploadFile = File(..., description="元の撮影画像"),
    overlay_image: UploadFile = File(..., description="落書き/フレーム画像 (PNG透過)"),
    quality: int = Form(default=92, ge=1, le=100),
):
    """
    2つの画像を合成する。
    - base_image: 撮影した写真（JPEG）
    - overlay_image: アイドルが描いた落書きやフォトフレーム（PNG透過）
    """
    try:
        base_bytes = await base_image.read()
        overlay_bytes = await overlay_image.read()

        base = Image.open(io.BytesIO(base_bytes)).convert("RGBA")
        overlay = Image.open(io.BytesIO(overlay_bytes)).convert("RGBA")

        # オーバーレイを元画像のサイズにリサイズ
        overlay = overlay.resize(base.size, Image.Resampling.LANCZOS)

        # 合成
        composite = Image.alpha_composite(base, overlay)

        # RGB変換してJPEGで出力
        output = composite.convert("RGB")
        buf = io.BytesIO()
        output.save(buf, format="JPEG", quality=quality)
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"attachment; filename=encore_{uuid.uuid4().hex[:8]}.jpg"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"画像合成に失敗: {str(e)}")
