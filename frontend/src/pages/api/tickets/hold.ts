/**
 * POST /api/tickets/hold
 * チケット仮押さえ: 在庫を一時確保し、決済前に枠を確保する
 *
 * Body: {
 *   user_id: string,
 *   items: [{ ticket_product_id: string, quantity: number }]
 * }
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { user_id, items } = body;

    if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ detail: 'パラメータが不正です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 各チケット商品の在庫を確認
    let totalAmount = 0;
    const validatedItems: { ticket_product_id: string; quantity: number; unit_price: number }[] = [];

    for (const item of items) {
      if (!item.ticket_product_id || !item.quantity || item.quantity <= 0) continue;

      const { data: product, error } = await supabase
        .from('ticket_products')
        .select('id, price, stock_limit, sold_count')
        .eq('id', item.ticket_product_id)
        .single();

      if (error || !product) {
        return new Response(JSON.stringify({ detail: `チケット商品が見つかりません: ${item.ticket_product_id}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 在庫チェック（held分も考慮）
      if (product.stock_limit !== null) {
        // 現在の有効なholdの数を取得
        const { data: heldItems } = await supabase
          .from('ticket_hold_items')
          .select('quantity, ticket_holds!inner(status)')
          .eq('ticket_product_id', item.ticket_product_id)
          .eq('ticket_holds.status', 'held');

        const heldCount = (heldItems || []).reduce((sum: number, hi: any) => sum + hi.quantity, 0);
        const available = product.stock_limit - product.sold_count - heldCount;

        if (available < item.quantity) {
          return new Response(JSON.stringify({
            detail: `在庫が不足しています（残り${Math.max(0, available)}枚）`,
            ticket_product_id: item.ticket_product_id,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const unitPrice = product.price || 0;
      totalAmount += unitPrice * item.quantity;
      validatedItems.push({
        ticket_product_id: item.ticket_product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    if (validatedItems.length === 0) {
      return new Response(JSON.stringify({ detail: '有効なチケットがありません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 仮押さえを作成
    const { data: hold, error: holdError } = await supabase
      .from('ticket_holds')
      .insert({
        user_id,
        total_amount: totalAmount,
        status: 'held',
      })
      .select()
      .single();

    if (holdError || !hold) {
      console.error('Hold creation failed:', holdError);
      return new Response(JSON.stringify({ detail: '仮押さえの作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 仮押さえ明細を作成
    const holdItems = validatedItems.map((item) => ({
      ticket_hold_id: hold.id,
      ticket_product_id: item.ticket_product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from('ticket_hold_items')
      .insert(holdItems);

    if (itemsError) {
      console.error('Hold items creation failed:', itemsError);
      // ロールバック: holdを削除
      await supabase.from('ticket_holds').delete().eq('id', hold.id);
      return new Response(JSON.stringify({ detail: '仮押さえ明細の作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      hold_id: hold.id,
      total_amount: totalAmount,
      expires_at: hold.expires_at,
      items: validatedItems,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Hold error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
