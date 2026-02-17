"""
決済API（GMOペイメントゲートウェイ リンクタイプPlus）

エンドポイント:
- POST /api/payment/charge   → ポイントチャージ用の決済URL生成
- POST /api/payment/ticket   → チケット直接購入用の決済URL生成
- POST /api/payment/notify   → GMOからの結果通知（Webhook）
- GET  /api/payment/complete → 決済完了後のリダイレクト先
- GET  /api/payment/cancel   → 決済キャンセル時のリダイレクト先
- GET  /api/payment/orders   → 自分の注文履歴取得
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from supabase import create_client

from app.config import settings
from app.services.gmo_payment import (
    build_payment_url,
    generate_order_id,
    verify_result_notification,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["payment"])

# Supabase service client（RLSバイパス）
_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase


# =====================================================
# リクエスト/レスポンスモデル
# =====================================================
class PointChargeRequest(BaseModel):
    user_id: str
    points_amount: int = Field(gt=0, description="チャージするポイント数")
    amount: int = Field(gt=0, description="決済金額（円）")


class TicketPurchaseRequest(BaseModel):
    user_id: str
    ticket_product_id: str
    quantity: int = Field(default=1, gt=0, le=10)


class PaymentUrlResponse(BaseModel):
    payment_url: str
    order_id: str


class OrderResponse(BaseModel):
    id: str
    order_type: str
    status: str
    amount: int
    points_amount: int | None
    ticket_product_id: str | None
    gmo_order_id: str
    created_at: str
    completed_at: str | None


# =====================================================
# ポイントチャージ
# =====================================================
@router.post("/payment/charge", response_model=PaymentUrlResponse)
async def create_point_charge(req: PointChargeRequest):
    """ポイントチャージ用の決済URLを生成する"""
    supabase = get_supabase()
    order_id = generate_order_id()

    # 注文レコードを作成
    order_data = {
        "user_id": req.user_id,
        "order_type": "point_charge",
        "status": "pending",
        "amount": req.amount,
        "points_amount": req.points_amount,
        "gmo_order_id": order_id,
        "gmo_job_cd": "CAPTURE",
    }

    result = supabase.table("payment_orders").insert(order_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="注文の作成に失敗しました")

    # GMO決済URLを生成
    payment_url = build_payment_url(
        order_id=order_id,
        amount=req.amount,
        overview=f"アンコール ポイントチャージ {req.points_amount}pt",
    )

    return PaymentUrlResponse(payment_url=payment_url, order_id=order_id)


# =====================================================
# チケット直接購入
# =====================================================
@router.post("/payment/ticket", response_model=PaymentUrlResponse)
async def create_ticket_purchase(req: TicketPurchaseRequest):
    """チケット直接購入用の決済URLを生成する"""
    supabase = get_supabase()

    # チケット商品情報を取得
    ticket_result = (
        supabase.table("ticket_products")
        .select("*")
        .eq("id", req.ticket_product_id)
        .single()
        .execute()
    )
    if not ticket_result.data:
        raise HTTPException(status_code=404, detail="チケット商品が見つかりません")

    ticket = ticket_result.data

    # 在庫チェック
    if ticket.get("stock_limit") is not None:
        remaining = ticket["stock_limit"] - ticket.get("sold_count", 0)
        if remaining < req.quantity:
            raise HTTPException(status_code=400, detail="在庫が不足しています")

    # 金額計算（ポイント単価を円単価として扱う）
    amount = ticket["price_points"] * req.quantity

    order_id = generate_order_id()

    # 注文レコードを作成
    order_data = {
        "user_id": req.user_id,
        "order_type": "ticket_purchase",
        "status": "pending",
        "amount": amount,
        "ticket_product_id": req.ticket_product_id,
        "ticket_quantity": req.quantity,
        "gmo_order_id": order_id,
        "gmo_job_cd": "CAPTURE",
    }

    result = supabase.table("payment_orders").insert(order_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="注文の作成に失敗しました")

    # GMO決済URLを生成
    payment_url = build_payment_url(
        order_id=order_id,
        amount=amount,
        overview=f"アンコール チケット購入 x{req.quantity}",
    )

    return PaymentUrlResponse(payment_url=payment_url, order_id=order_id)


# =====================================================
# GMO結果通知（Webhook）
# =====================================================
@router.post("/payment/notify")
async def gmo_result_notification(request: Request):
    """
    GMOからの決済結果通知を受信する。
    GMOはPOSTでフォームデータを送信してくる。
    """
    form_data = await request.form()
    data = dict(form_data)

    logger.info(f"GMO結果通知受信: {data}")

    order_id = data.get("OrderID", "")
    shop_id = data.get("ShopID", "")
    amount = data.get("Amount", "")
    status = data.get("Status", "")
    job_cd = data.get("JobCd", "")
    access_id = data.get("AccessID", "")
    access_pass = data.get("AccessPass", "")
    forward = data.get("Forward", "")
    approve = data.get("Approve", "")
    tran_id = data.get("TranID", "")
    tran_date = data.get("TranDate", "")
    err_code = data.get("ErrCode", "")
    err_info = data.get("ErrInfo", "")
    hash_value = data.get("HashValue", "")

    # ハッシュ検証
    if hash_value and not verify_result_notification(
        order_id=order_id,
        amount=amount,
        shop_id=shop_id,
        hash_value=hash_value,
    ):
        logger.error(f"GMO結果通知: ハッシュ検証失敗 order_id={order_id}")
        return {"result": "NG"}

    supabase = get_supabase()

    # 注文レコードを取得
    order_result = (
        supabase.table("payment_orders")
        .select("*")
        .eq("gmo_order_id", order_id)
        .single()
        .execute()
    )

    if not order_result.data:
        logger.error(f"GMO結果通知: 注文が見つかりません order_id={order_id}")
        return {"result": "NG"}

    order = order_result.data

    # 既に完了済みの場合はスキップ（冪等性）
    if order["status"] == "completed":
        logger.info(f"GMO結果通知: 既に完了済み order_id={order_id}")
        return {"result": "OK"}

    # GMO取引情報を更新
    update_data = {
        "gmo_access_id": access_id,
        "gmo_access_pass": access_pass,
        "gmo_forward": forward,
        "gmo_approve": approve,
        "gmo_tran_id": tran_id,
        "gmo_tran_date": tran_date,
        "gmo_method": data.get("PayType", ""),
    }

    # 決済成功判定
    is_success = status in ("CAPTURE", "SALES") and not err_code

    if is_success:
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

        # 注文種別に応じた後処理
        if order["order_type"] == "point_charge":
            _process_point_charge(supabase, order)
        elif order["order_type"] == "ticket_purchase":
            _process_ticket_purchase(supabase, order)
    else:
        update_data["status"] = "failed"
        update_data["error_code"] = err_code
        update_data["error_message"] = err_info

    supabase.table("payment_orders").update(update_data).eq("id", order["id"]).execute()

    logger.info(
        f"GMO結果通知処理完了: order_id={order_id}, "
        f"success={is_success}, status={status}"
    )
    return {"result": "OK"}


def _process_point_charge(supabase, order: dict):
    """ポイントチャージの後処理: ポイント残高更新 + 取引履歴作成"""
    user_id = order["user_id"]
    points = order["points_amount"]

    # 現在のポイント残高を取得
    profile = (
        supabase.table("profiles")
        .select("points_balance")
        .eq("id", user_id)
        .single()
        .execute()
    )
    current_balance = profile.data["points_balance"]
    new_balance = current_balance + points

    # ポイント残高を更新
    supabase.table("profiles").update({"points_balance": new_balance}).eq(
        "id", user_id
    ).execute()

    # ポイント取引履歴を作成
    supabase.table("point_transactions").insert(
        {
            "user_id": user_id,
            "amount": points,
            "balance_after": new_balance,
            "type": "charge",
            "reference_id": order["gmo_order_id"],
            "description": f"ポイントチャージ（GMO決済: {order['amount']}円）",
        }
    ).execute()

    logger.info(f"ポイントチャージ完了: user={user_id}, points={points}")


def _process_ticket_purchase(supabase, order: dict):
    """チケット直接購入の後処理: チケット発行 + 販売数更新"""
    user_id = order["user_id"]
    ticket_product_id = order["ticket_product_id"]
    quantity = order.get("ticket_quantity", 1)

    # チケットを発行
    tickets = [
        {"user_id": user_id, "ticket_product_id": ticket_product_id, "status": "valid"}
        for _ in range(quantity)
    ]
    supabase.table("user_tickets").insert(tickets).execute()

    # 販売数を更新
    product = (
        supabase.table("ticket_products")
        .select("sold_count")
        .eq("id", ticket_product_id)
        .single()
        .execute()
    )
    new_sold_count = product.data["sold_count"] + quantity
    supabase.table("ticket_products").update({"sold_count": new_sold_count}).eq(
        "id", ticket_product_id
    ).execute()

    logger.info(
        f"チケット発行完了: user={user_id}, "
        f"product={ticket_product_id}, qty={quantity}"
    )


# =====================================================
# 決済完了/キャンセル リダイレクト
# =====================================================
@router.get("/payment/complete")
async def payment_complete(request: Request):
    """GMO決済完了後にユーザーをフロントエンドへリダイレクトする"""
    order_id = request.query_params.get("OrderID", "")
    return RedirectResponse(
        url=f"{settings.frontend_url}/payment/complete?order_id={order_id}"
    )


@router.get("/payment/cancel")
async def payment_cancel(request: Request):
    """GMO決済キャンセル時にユーザーをフロントエンドへリダイレクトする"""
    order_id = request.query_params.get("OrderID", "")
    # ステータスをキャンセルに更新
    if order_id:
        supabase = get_supabase()
        supabase.table("payment_orders").update({"status": "cancelled"}).eq(
            "gmo_order_id", order_id
        ).execute()

    return RedirectResponse(
        url=f"{settings.frontend_url}/payment/cancel?order_id={order_id}"
    )


# =====================================================
# 注文履歴
# =====================================================
@router.get("/payment/orders")
async def get_payment_orders(user_id: str, limit: int = 20, offset: int = 0):
    """ユーザーの決済注文履歴を取得する"""
    supabase = get_supabase()

    result = (
        supabase.table("payment_orders")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {"orders": result.data, "count": len(result.data)}
