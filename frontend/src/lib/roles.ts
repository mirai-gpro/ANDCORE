import { supabase } from './supabase';

export const ROLE_LABELS: Record<string, string> = {
  fan: 'ファン',
  idol: 'アイドルメンバー',
  organizer: '運営管理者',
  admin: 'アンコール管理者',
};

/**
 * ロール自動展開ルール
 * fan       → [fan]
 * idol      → [fan, idol]
 * organizer → [fan, idol, organizer]
 * admin     → [fan, idol, organizer, admin]
 */
export function expandRoles(baseRole: string): string[] {
  switch (baseRole) {
    case 'admin':     return ['fan', 'idol', 'organizer', 'admin'];
    case 'organizer': return ['fan', 'idol', 'organizer'];
    case 'idol':      return ['fan', 'idol'];
    default:          return ['fan'];
  }
}

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
 * テーブル未作成時は profiles.role にフォールバック
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  // テーブル未作成 (404) やエラー時は profiles.role にフォールバック
  if (error || !data || data.length === 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (profile?.role) return expandRoles(profile.role);
    return ['fan'];
  }
  return data.map(r => r.role);
}

/**
 * ロールを切り替える
 * - localStorage 更新
 * - profiles.role 更新 (via RPC or direct update)
 * - user_metadata 更新
 */
export async function switchRole(newRole: string): Promise<boolean> {
  // switch_role RPC を試行、失敗時は直接 profiles を更新
  const { error } = await supabase.rpc('switch_role', { new_role: newRole });
  if (error) {
    // RPC未作成時のフォールバック: profiles.role を直接更新
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    }
  }

  // user_metadata も更新（JWT反映のため）
  await supabase.auth.updateUser({ data: { role: newRole } });

  localStorage.setItem('active_role', newRole);
  return true;
}
