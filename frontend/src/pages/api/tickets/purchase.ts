/**
 * POST /api/tickets/purchase
 * 仮押さえからGMO決済URLを生成する
 *
 * Body: { user_id: string, hold_id: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { buildPaymentUrl, generateOrderId } from '../../../lib/gmo-payment';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { user_id, hold_id } = body;

    if (!user_id || !hold_id) {
      return new Response(JSON.stringify({ detail: 'パラメータが不正です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 仮押さえを取得・検証
    const { data: hold, error: holdError } = await supabase
      .from('ticket_holds')
      .select('*, ticket_hold_items(*)')
      .eq('id', hold_id)
      .eq('user_id', user_id)
      .single();

    if (holdError || !hold) {
      return new Response(JSON.stringify({ detail: '仮押さえが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (hold.status !== 'held') {
      return new Response(JSON.stringify({ detail: `仮押さえの状態が不正です: ${hold.status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 有効期限チェック
    if (new Date(hold.expires_at) < new Date()) {
      await supabase.from('ticket_holds').update({ status: 'expired' }).eq('id', hold_id);
      return new Response(JSON.stringify({ detail: '仮押さえの有効期限が切れています。再度選択してください。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const totalAmount = hold.total_amount;
    const orderId = generateOrderId();

    // チケット枚数の合計を計算
    const totalQuantity = (hold.ticket_hold_items || []).reduce(
      (sum: number, item: any) => sum + item.quantity, 0
    );

    // 決済注文を作成
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        user_id,
        order_type: 'ticket_purchase',
        status: 'pending',
        amount: totalAmount,
        gmo_order_id: orderId,
        gmo_job_cd: 'CAPTURE',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation failed:', orderError);
      return new Response(JSON.stringify({ detail: '注文の作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 仮押さえに決済注文IDを紐付け
    await supabase
      .from('ticket_holds')
      .update({ payment_order_id: order.id })
      .eq('id', hold_id);

    // GMO決済URLを生成
    const paymentUrl = await buildPaymentUrl(
      orderId,
      totalAmount,
      `アンコール チケット${totalQuantity}枚`,
    );

    return new Response(JSON.stringify({
      payment_url: paymentUrl,
      order_id: orderId,
      hold_id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Purchase error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
