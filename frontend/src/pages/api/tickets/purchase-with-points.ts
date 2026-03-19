/**
 * POST /api/tickets/purchase-with-points
 * ポイントでチケットを購入する（仮押さえ → ポイント差引 → チケット発行）
 *
 * Body: { user_id: string, hold_id: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

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

    // ポイント残高チェック
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points_balance')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ detail: 'ユーザー情報の取得に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const currentBalance = profile.points_balance || 0;
    if (currentBalance < totalAmount) {
      return new Response(JSON.stringify({
        detail: `ポイントが不足しています（残高: ${currentBalance}pt、必要: ${totalAmount}pt）`,
        points_balance: currentBalance,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ポイント差引
    const newBalance = currentBalance - totalAmount;
    await supabase
      .from('profiles')
      .update({ points_balance: newBalance })
      .eq('id', user_id);

    // ポイント取引履歴
    await supabase.from('point_transactions').insert({
      user_id,
      amount: -totalAmount,
      balance_after: newBalance,
      type: 'purchase',
      reference_id: hold_id,
      description: `チケット購入（ポイント決済: ${totalAmount}pt）`,
    });

    // チケット発行
    for (const item of hold.ticket_hold_items || []) {
      const tickets = Array.from({ length: item.quantity }, () => ({
        user_id,
        ticket_product_id: item.ticket_product_id,
        ticket_hold_id: hold.id,
        status: 'valid',
      }));
      await supabase.from('user_tickets').insert(tickets);

      // 販売数を更新
      const { data: product } = await supabase
        .from('ticket_products')
        .select('sold_count')
        .eq('id', item.ticket_product_id)
        .single();

      if (product) {
        await supabase
          .from('ticket_products')
          .update({ sold_count: (product.sold_count || 0) + item.quantity })
          .eq('id', item.ticket_product_id);
      }
    }

    // 仮押さえを購入済みに更新
    await supabase
      .from('ticket_holds')
      .update({ status: 'purchased' })
      .eq('id', hold.id);

    return new Response(JSON.stringify({
      success: true,
      hold_id,
      points_used: totalAmount,
      points_balance: newBalance,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Point purchase error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
