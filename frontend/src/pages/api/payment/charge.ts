/**
 * POST /api/payment/charge
 * ポイントチャージ用の決済URL生成
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { buildPaymentUrl, generateOrderId } from '../../../lib/gmo-payment';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { user_id, points_amount, amount } = body;

    if (!user_id || !points_amount || !amount || points_amount <= 0 || amount <= 0) {
      return new Response(JSON.stringify({ detail: 'パラメータが不正です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();
    const orderId = generateOrderId();

    // 注文レコードを作成
    const { data, error } = await supabase.table('payment_orders').insert({
      user_id,
      order_type: 'point_charge',
      status: 'pending',
      amount,
      points_amount,
      gmo_order_id: orderId,
      gmo_job_cd: 'CAPTURE',
    }).select().single();

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
      `アンコール ポイントチャージ ${points_amount}pt`,
    );

    return new Response(JSON.stringify({ payment_url: paymentUrl, order_id: orderId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Charge error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
