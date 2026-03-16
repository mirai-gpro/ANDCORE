import { supabase } from './supabase';

export const ROLE_LABELS: Record<string, string> = {
  fan: 'ファン',
  idol: 'アイドルメンバー',
  organizer: '運営管理者',
  admin: 'アンコール管理者',
};

export const ROLE_COLORS: Record<string, string> = {
  fan: '#6366f1',
  idol: '#ec4899',
  organizer: '#f59e0b',
  admin: '#dc2626',
};

export const ROLE_DASHBOARDS: Record<string, string> = {
  fan: '/dashboard',
  idol: '/idol',
  organizer: '/manage',
  admin: '/dashboard',
};

/**
 * アクティブロールを取得する
 * localStorage > profiles.role > user_metadata.role の優先順
 */
export function getActiveRole(user: { user_metadata?: Record<string, any> }): string {
  const stored = localStorage.getItem('active_role');
  if (stored) return stored;
  return user.user_metadata?.role || 'fan';
}

/**
 * user_roles テーブルからユーザーの全ロールを取得
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (!data || data.length === 0) return ['fan'];
  return data.map(r => r.role);
}

/**
 * ロールを切り替える
 * - localStorage 更新
 * - profiles.role 更新 (via RPC)
 * - user_metadata 更新
 */
export async function switchRole(newRole: string): Promise<boolean> {
  const { error } = await supabase.rpc('switch_role', { new_role: newRole });
  if (error) {
    console.error('ロール切替失敗:', error.message);
    return false;
  }

  // user_metadata も更新（JWT反映のため）
  await supabase.auth.updateUser({ data: { role: newRole } });

  localStorage.setItem('active_role', newRole);
  return true;
}
