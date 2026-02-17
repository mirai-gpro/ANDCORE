"""
GMOペイメントゲートウェイ リンクタイプPlus クライアント

ハッシュ型接続方式:
1. 決済パラメータJSON → Base64エンコード（α）
2. α + ShopPass → SHA256ハッシュ（γ）
3. α.γ → 決済URL生成
"""

import base64
import hashlib
import json
import logging
import uuid

from app.config import settings

logger = logging.getLogger(__name__)


def generate_order_id() -> str:
    """一意な注文IDを生成する（GMO PGの制約: 英数字とハイフンのみ）"""
    return f"ENC-{uuid.uuid4().hex[:16].upper()}"


def build_payment_url(
    order_id: str,
    amount: int,
    overview: str = "アンコール決済",
) -> str:
    """
    GMOリンクタイプPlusのハッシュ型決済URLを生成する。

    Args:
        order_id: 注文ID（一意、英数字・ハイフンのみ）
        amount: 決済金額（円）
        overview: 取引概要

    Returns:
        GMO決済ページのURL
    """
    params = {
        "configid": settings.gmo_config_id,
        "transaction": {
            "OrderID": order_id,
            "Amount": str(amount),
            "Overview": overview,
        },
    }

    json_str = json.dumps(params, ensure_ascii=False, separators=(",", ":"))

    # Step 1: Base64エンコード → α
    alpha = base64.b64encode(json_str.encode("utf-8")).decode("ascii")

    # Step 2: α + ShopPass → β, SHA256(β) → γ
    beta = alpha + settings.gmo_shop_pass
    gamma = hashlib.sha256(beta.encode("utf-8")).hexdigest()

    # Step 3: α.γ → ε
    epsilon = f"{alpha}.{gamma}"

    # 決済URL
    url = f"{settings.gmo_link_url}/v1/plus/{settings.gmo_shop_id}/checkout/{epsilon}"

    logger.info(f"GMO決済URL生成: order_id={order_id}, amount={amount}")
    return url


def verify_result_notification(
    order_id: str,
    amount: str,
    shop_id: str,
    hash_value: str,
) -> bool:
    """
    GMOからの結果通知のハッシュ値を検証する。

    GMOは結果通知時に ShopID + OrderID + Amount + HashKey の
    SHA256ハッシュを送信する。これを検証して改ざんを検出する。
    """
    if not settings.gmo_result_hash_key:
        logger.warning("GMO結果通知ハッシュキーが未設定です")
        return True  # 開発環境では検証をスキップ

    raw = f"{shop_id}{order_id}{amount}{settings.gmo_result_hash_key}"
    expected = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    if expected != hash_value:
        logger.error(
            f"GMO結果通知ハッシュ不一致: order_id={order_id}, "
            f"expected={expected}, received={hash_value}"
        )
        return False

    return True
