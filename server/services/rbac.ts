import type { Tenant } from './supabaseClient';
import { supabase } from './supabaseClient';

export type Role = 'super_admin' | 'agency_operator' | 'client_user';

export type Permission =
  | 'observatory.read'
  | 'observatory.write'
  | 'pricing.read'
  | 'pricing.write'
  | 'tokens.read'
  | 'tokens.write'
  | 'activity_feed.preferences.write'
  | 'content.generate.social'
  | 'tenant.hierarchy.read'
  | 'dashboard.read';

export interface AuthenticatedUser {
  email: string;
  source: string;
  role: Role;
  permissions: Permission[];
  tenantContext: { id: string; slug: string } | null;
  tenantScopeId: string | null;
}

interface RoleResolution {
  role: Role;
  tenantScopeId: string | null;
}

const SUPER_ADMIN_EMAIL = 'mail@cestari.studio';
const AGENCY_OPERATOR_EMAIL = 'ocestari89@gmail.com';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'observatory.read',
    'observatory.write',
    'pricing.read',
    'pricing.write',
    'tokens.read',
    'tokens.write',
    'activity_feed.preferences.write',
    'content.generate.social',
    'tenant.hierarchy.read',
    'dashboard.read',
  ],
  agency_operator: [
    'content.generate.social',
    'dashboard.read',
  ],
  client_user: [
    'dashboard.read',
  ],
};

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isRole(value: string): value is Role {
  return value === 'super_admin' || value === 'agency_operator' || value === 'client_user';
}

function isMissingTableError(error: any, tableName: string): boolean {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42P01' || msg.includes(`relation "${tableName}" does not exist`);
}

function resolveStaticRole(email: string): Role {
  if (email === SUPER_ADMIN_EMAIL) return 'super_admin';
  if (email === AGENCY_OPERATOR_EMAIL) return 'agency_operator';
  return 'client_user';
}

async function resolveRoleFromTable(email: string, tenantId?: string): Promise<RoleResolution | null> {
  const { data, error } = await supabase
    .from('user_access')
    .select('role, tenant_id, is_active')
    .eq('email', email)
    .eq('is_active', true);

  if (error) {
    if (isMissingTableError(error, 'user_access')) return null;
    console.warn('[rbac] user_access lookup failed:', error.message);
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  // Prefer tenant-scoped match, then global grant.
  const byTenant = tenantId ? data.find((row: any) => row.tenant_id === tenantId) : null;
  const global = data.find((row: any) => !row.tenant_id);
  const row = byTenant || global || data[0];

  if (!row?.role || !isRole(row.role)) return null;
  return {
    role: row.role,
    tenantScopeId: row.tenant_id || null,
  };
}

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(user: AuthenticatedUser | undefined | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.permissions.includes(permission);
}

export async function buildUserFromIdentity(params: {
  email: string;
  source: string;
  tenant?: Tenant | null;
}): Promise<AuthenticatedUser> {
  const normalizedEmail = normalizeEmail(params.email);
  const tenantId = params.tenant?.id;

  const dynamic = await resolveRoleFromTable(normalizedEmail, tenantId);
  const role = dynamic?.role || resolveStaticRole(normalizedEmail);

  return {
    email: normalizedEmail,
    source: params.source,
    role,
    permissions: getPermissionsForRole(role),
    tenantContext: params.tenant ? { id: params.tenant.id, slug: params.tenant.slug } : null,
    tenantScopeId: dynamic?.tenantScopeId || null,
  };
}
