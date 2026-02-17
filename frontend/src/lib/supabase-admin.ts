/**
 * Supabase Admin クライアント（サーバーサイド専用）
 * service_role キーを使用してRLSをバイパスする
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function getSupabaseAdmin() {
  const url = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  return createClient<Database>(url, serviceKey);
}
