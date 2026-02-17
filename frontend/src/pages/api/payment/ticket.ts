/**
 * POST /api/payment/ticket
 * チケット直接購入用の決済URL生成
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { buildPaymentUrl, generateOrderId } from '../../../lib/gmo-payment';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { user_id, ticket_product_id, quantity = 1 } = body;

    if (!user_id || !ticket_product_id || quantity <= 0 || quantity > 10) {
      return new Response(JSON.stringify({ detail: 'パラメータが不正です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // チケット商品情報を取得
    const { data: ticket, error: ticketError } = await supabase
      .from('ticket_products')
      .select('*')
      .eq('id', ticket_product_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ detail: 'チケット商品が見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 金額計算
    const amount = ticket.price_points * quantity;
    const orderId = generateOrderId();

    // 注文レコードを作成
    const { error } = await supabase.table('payment_orders').insert({
      user_id,
      order_type: 'ticket_purchase',
      status: 'pending',
      amount,
      ticket_product_id,
      ticket_quantity: quantity,
      gmo_order_id: orderId,
      gmo_job_cd: 'CAPTURE',
    });

    if (error) {
      console.error('Order creation failed:', error);
      return new Response(JSON.stringify({ detail: '注文の作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentUrl = await buildPaymentUrl(
      orderId,
      amount,
      `アンコール チケット購入 x${quantity}`,
    );

    return new Response(JSON.stringify({ payment_url: paymentUrl, order_id: orderId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Ticket purchase error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
