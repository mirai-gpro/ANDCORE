/**
 * GET /api/payment/orders?user_id=xxx&limit=20
 * 決済注文履歴取得
 */
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get('user_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!userId) {
      return new Response(JSON.stringify({ detail: 'user_idは必須です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: orders, error } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Orders fetch error:', error);
      return new Response(JSON.stringify({ detail: '履歴の取得に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ orders: orders || [], count: orders?.length || 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Orders error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
