/**
 * POST /api/tickets/release
 * 仮押さえを解放する
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

    const { error } = await supabase
      .from('ticket_holds')
      .update({ status: 'released' })
      .eq('id', hold_id)
      .eq('user_id', user_id)
      .eq('status', 'held');

    if (error) {
      console.error('Release error:', error);
      return new Response(JSON.stringify({ detail: '仮押さえの解放に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Release error:', e);
    return new Response(JSON.stringify({ detail: e.message || 'サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
