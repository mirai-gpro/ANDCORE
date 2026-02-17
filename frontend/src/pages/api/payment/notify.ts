/**
 * POST /api/payment/notify
 * GMOからの決済結果通知（Webhook）
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { verifyResultNotification } from '../../../lib/gmo-payment';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = String(value);
    });

    console.log('GMO結果通知受信:', JSON.stringify(data));

    const orderId = data.OrderID || '';
    const shopId = data.ShopID || '';
    const amount = data.Amount || '';
    const status = data.Status || '';
    const accessId = data.AccessID || '';
    const accessPass = data.AccessPass || '';
    const forward = data.Forward || '';
    const approve = data.Approve || '';
    const tranId = data.TranID || '';
    const tranDate = data.TranDate || '';
    const errCode = data.ErrCode || '';
    const errInfo = data.ErrInfo || '';
    const hashValue = data.HashValue || '';

    // ハッシュ検証
    if (hashValue) {
      const isValid = await verifyResultNotification(orderId, amount, shopId, hashValue);
      if (!isValid) {
        console.error(`GMO結果通知: ハッシュ検証失敗 order_id=${orderId}`);
        return new Response('NG', { status: 200 });
      }
    }

    const supabase = getSupabaseAdmin();

    // 注文レコードを取得
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('gmo_order_id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`GMO結果通知: 注文が見つかりません order_id=${orderId}`);
      return new Response('NG', { status: 200 });
    }

    // 冪等性: 既に完了済みならスキップ
    if (order.status === 'completed') {
      console.log(`GMO結果通知: 既に完了済み order_id=${orderId}`);
      return new Response('OK', { status: 200 });
    }

    // 決済成功判定
    const isSuccess = (status === 'CAPTURE' || status === 'SALES') && !errCode;

    const updateData: Record<string, any> = {
      gmo_access_id: accessId,
      gmo_access_pass: accessPass,
      gmo_forward: forward,
      gmo_approve: approve,
      gmo_tran_id: tranId,
      gmo_tran_date: tranDate,
      gmo_method: data.PayType || '',
    };

    if (isSuccess) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();

      if (order.order_type === 'point_charge') {
        await processPointCharge(supabase, order);
      } else if (order.order_type === 'ticket_purchase') {
        await processTicketPurchase(supabase, order);
      }
    } else {
      updateData.status = 'failed';
      updateData.error_code = errCode;
      updateData.error_message = errInfo;
    }

    await supabase
      .from('payment_orders')
      .update(updateData)
      .eq('id', order.id);

    console.log(`GMO結果通知処理完了: order_id=${orderId}, success=${isSuccess}`);
    return new Response('OK', { status: 200 });
  } catch (e: any) {
    console.error('Notify error:', e);
    return new Response('NG', { status: 200 });
  }
};

async function processPointCharge(supabase: any, order: any) {
  const userId = order.user_id;
  const points = order.points_amount;

  // 現在のポイント残高を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('points_balance')
    .eq('id', userId)
    .single();

  const currentBalance = profile?.points_balance || 0;
  const newBalance = currentBalance + points;

  // ポイント残高を更新
  await supabase
    .from('profiles')
    .update({ points_balance: newBalance })
    .eq('id', userId);

  // ポイント取引履歴を作成
  await supabase.from('point_transactions').insert({
    user_id: userId,
    amount: points,
    balance_after: newBalance,
    type: 'charge',
    reference_id: order.gmo_order_id,
    description: `ポイントチャージ（GMO決済: ${order.amount}円）`,
  });

  console.log(`ポイントチャージ完了: user=${userId}, points=${points}`);
}

async function processTicketPurchase(supabase: any, order: any) {
  const userId = order.user_id;
  const ticketProductId = order.ticket_product_id;
  const quantity = order.ticket_quantity || 1;

  // チケットを発行
  const tickets = Array.from({ length: quantity }, () => ({
    user_id: userId,
    ticket_product_id: ticketProductId,
    status: 'valid',
  }));

  await supabase.from('user_tickets').insert(tickets);

  console.log(`チケット発行完了: user=${userId}, product=${ticketProductId}, qty=${quantity}`);
}
