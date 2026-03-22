import { supabase } from './supabase';

// マイグレーション未適用時のフォールバック用管理者メールアドレス
const ADMIN_EMAILS = ['unfix.hamada@gmail.com'];

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
  fan: '/events',
  idol: '/idol',
  organizer: '/manage',
  admin: '/admin',
};

export const ROLE_MYPAGE: Record<string, string> = {
  fan: '/dashboard',
  idol: '/idol',
  organizer: '/manage',
  admin: '/admin',
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
 * テーブル未作成時は user_metadata.role → profiles.role にフォールバック
 * user_metadata.role は登録時の種別権限（最も信頼できるソース）
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const roles = new Set<string>();

  // 1. user_roles テーブルから取得
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (!error && data && data.length > 0) {
    for (const r of data) {
      roles.add(r.role);
    }
  }

  // 2. profiles.role からも展開してマージ（user_roles にロールが欠けている場合の補完）
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profile?.role) {
    for (const r of expandRoles(profile.role)) {
      roles.add(r);
    }
  }

  // 3. user_metadata.role からも展開してマージ（登録時の種別権限）
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.role) {
    for (const r of expandRoles(user.user_metadata.role)) {
      roles.add(r);
    }
  }

  // 4. 管理者メールアドレスによるフォールバック（user_rolesテーブル未設定時の救済）
  if (user?.email && ADMIN_EMAILS.includes(user.email)) {
    for (const r of expandRoles('admin')) {
      roles.add(r);
    }
  }

  if (roles.size > 0) return Array.from(roles);
  return ['fan'];
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
      await supabase.from('profiles').update({ role: newRole as import('./database.types').UserRole }).eq('id', user.id);
    }
  }

  // 注意: user_metadata.role は登録時の種別権限を保持するため更新しない
  // アクティブロールは localStorage + profiles.role で管理する
  localStorage.setItem('active_role', newRole);
  return true;
}
