// genOS v2 — API client service
// Direct Supabase access (no Express proxy in production)

import { supabase } from './supabase';

// ─── SECURITY VALIDATION ─────────────────────────────────────────────────────
if (import.meta.env.VITE_SUPABASE_ANON_KEY?.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
  try {
    const payload = JSON.parse(atob(import.meta.env.VITE_SUPABASE_ANON_KEY.split('.')[1]));
    if (payload.role !== 'anon') {
      console.error('🔴 SECURITY: VITE_SUPABASE_ANON_KEY is NOT an anon key! RLS is bypassed!');
    }
  } catch (e) {
    console.error('Failed to parse Supabase Key payload:', e);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  | 'tenants.manage'
  | 'dashboard.read';

// Role → Permissions map (mirrors server/services/rbac.ts)
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'observatory.read', 'observatory.write',
    'pricing.read', 'pricing.write',
    'tokens.read', 'tokens.write',
    'activity_feed.preferences.write',
    'content.generate.social',
    'tenant.hierarchy.read',
    'tenants.manage',
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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  wix_site_id: string | null;
  parent_tenant_id: string | null;
  depth_level: number;
  settings: Record<string, unknown>;
}

export interface CurrentUser {
  id: string;
  email: string;
  source: string;
  role: Role;
  permissions: Permission[];
  tenantContext: { id: string; slug: string } | null;
  tenantScopeId: string | null;
}

export interface WalletData {
  credits: number;
  overage: number;
}

export interface AddonPackage {
  id: string;
  name: string;
  description?: string;
  token_amount: number;
  post_amount: number;
  price_brl: number;
  stripe_price_id?: string;
  is_active: boolean;
}

export interface AddonPurchase {
  id: string;
  tenant_id: string;
  package_id: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_reference?: string;
  created_at: string;
  addon_packages?: AddonPackage;
  tenants?: { name: string };
}

export interface TokenCostConfig {
  id: string;
  tenant_id: string | null;
  format: string;
  operation: string;
  base_cost: number;
  per_slide_cost: number;
}

export interface CanGenerateResult {
  allowed: boolean;
  reason?: 'tokens_exhausted' | 'posts_exhausted';
  message?: string;
  tokens_remaining: number;
  posts_remaining: number;
  posts_used: number;
  posts_limit: number;
  low_balance?: boolean;
}

export interface MeResponse {
  authenticated: boolean;
  user: CurrentUser | null;
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'plan' | 'parent_tenant_id' | 'depth_level'> | null;
  wallet?: WalletData;
  config?: {
    post_limit: number;
    token_balance: number;
    post_language: string;
    ai_model: string;
    low_balance_threshold?: number;
    hard_block_enabled?: boolean;
    overage_allowed?: boolean;
    zero_balance_message?: string;
    schedule_enabled?: boolean;
    schedule_tier?: 'starter' | 'growth' | 'scale' | 'enterprise' | 'custom';
    schedule_post_limit?: number;
    schedule_billing_start?: string;
  };
  activeApp?: string;
  isPayPerUse?: boolean;
  usage?: {
    tokens_used: number;
    tokens_limit: number;
    posts_used: number;
    posts_limit: number;
    schedule_used: number;
    schedule_limit: number;
  };
}

let activeTenantId: string | null = localStorage.getItem('genOS_activeClient');
let activeUserEmail: string = localStorage.getItem('genOS_activeUserEmail') || '';
let tenantsList: Tenant[] = [];
let cachedMe: MeResponse | null = null;

// ─── Edge Function caller (for endpoints that need service_role) ────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function edgeFn<T = unknown>(fnName: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errData: any = {};
    try {
      errData = await res.json();
    } catch (_) {
      errData = { error: `HTTP ${res.status}` };
    }

    // Global 402 Interceptor for Billing Hard-Blocks
    if (res.status === 402) {
      window.dispatchEvent(new CustomEvent('hard-block', { detail: errData }));
      throw new Error(JSON.stringify({ isBillingError: true, ...errData }));
    }

    throw new Error(errData.error || errData.message || `Edge Function ${fnName} failed`);
  }

  const responseJson = await res.json();
  // Unwrap nested format from functions: { success: true, data: T }
  if (responseJson && typeof responseJson === 'object' && 'data' in responseJson) {
    return responseJson.data as T;
  }

  return responseJson as T;
}

function isRole(r: string): r is Role {
  return r === 'super_admin' || r === 'agency_operator' || r === 'client_user';
}

export const api = {
  // Edge Function helpers (replace Express proxy calls)
  edgeFn,

  // Tenant management — direct Supabase query
  async loadTenants(): Promise<Tenant[]> {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');
      if (error) throw error;
      tenantsList = (data || []) as Tenant[];
    } catch (err) {
      console.warn('genOS: tenant fetch failed', err);
      tenantsList = [];
    }
    return tenantsList;
  },

  getTenants: () => tenantsList,
  getActiveTenantId: () => activeTenantId,
  getActiveTenant: () => tenantsList.find(t => t.id === activeTenantId) || null,

  setActiveTenant(id: string) {
    activeTenantId = id;
    localStorage.setItem('genOS_activeClient', id);
    cachedMe = null; // bust cache when tenant switches
  },

  getActiveUserEmail: () => activeUserEmail,

  setActiveUserEmail(email: string) {
    activeUserEmail = email.trim().toLowerCase();
    localStorage.setItem('genOS_activeUserEmail', activeUserEmail);
    if (!email) cachedMe = null;
  },

  setCachedMe(me: MeResponse) {
    cachedMe = me;
  },

  logout() {
    activeUserEmail = '';
    activeTenantId = null;
    cachedMe = null;
    localStorage.removeItem('genOS_activeUserEmail');
    localStorage.removeItem('genOS_activeClient');
    sessionStorage.removeItem('genOS_system_analysis_after_login');
    supabase.auth.signOut();
  },

  // ─── getMe: fully resolved from Supabase (no Express proxy) ────────────
  getMe: async (forceRefresh?: boolean): Promise<MeResponse> => {
    if (cachedMe && !forceRefresh) return cachedMe;

    const NOT_AUTH: MeResponse = {
      authenticated: false,
      user: null,
      tenant: null,
      wallet: { credits: 0, overage: 0 },
      config: { post_limit: 0, token_balance: 0, post_language: 'pt-BR', ai_model: 'gemini-2.0-flash', low_balance_threshold: 50 },
      usage: { tokens_used: 0, tokens_limit: 5000, posts_used: 0, posts_limit: 24, schedule_used: 0, schedule_limit: 0 }
    };

    try {
      // 1. Try Supabase Auth session first, fallback to email-based lookup
      let userId: string | null = null;
      let email = '';

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        email = session.user.email || '';
      } else if (activeUserEmail) {
        email = activeUserEmail;
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('contact_email', email)
          .maybeSingle();

        if (tenant) {
          userId = tenant.id;
          if (!activeTenantId) {
            activeTenantId = tenant.id;
            localStorage.setItem('genOS_activeClient', tenant.id);
          }
        }
      }

      if (!userId || !email) return NOT_AUTH;

      // 2. Resolve role from tenant_members
      const tenantId = activeTenantId;
      let role: Role = 'client_user';
      let tenantScopeId: string | null = null;

      if (tenantId) {
        const { data: membership } = await supabase
          .from('tenant_members')
          .select('role, tenant_id')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (membership?.role && isRole(membership.role)) {
          role = membership.role;
          tenantScopeId = membership.tenant_id;
        }
      } else {
        const { data: memberships } = await supabase
          .from('tenant_members')
          .select('role, tenant_id')
          .eq('user_id', userId)
          .limit(1);

        if (memberships?.[0]) {
          const m = memberships[0];
          if (isRole(m.role)) role = m.role;
          tenantScopeId = m.tenant_id;
          activeTenantId = m.tenant_id;
          localStorage.setItem('genOS_activeClient', m.tenant_id);
        }
      }

      // 3. Resolve tenant info
      const resolvedTenantId = tenantScopeId || tenantId;
      let tenant: MeResponse['tenant'] = null;

      if (resolvedTenantId) {
        const { data: t } = await supabase
          .from('tenants')
          .select('id, name, slug, plan, parent_tenant_id, depth_level')
          .eq('id', resolvedTenantId)
          .maybeSingle();
        if (t) tenant = t;
      }

      // 4. Fetch wallet
      let wallet: WalletData = { credits: 0, overage: 0 };
      if (resolvedTenantId) {
        const { data: w } = await supabase
          .from('credit_wallets')
          .select('prepaid_credits, overage_amount')
          .eq('tenant_id', resolvedTenantId)
          .maybeSingle();
        if (w) {
          wallet = { credits: w.prepaid_credits || 0, overage: w.overage_amount || 0 };
        }
      }

      let config: MeResponse['config'] = { post_limit: 24, token_balance: 5000, post_language: 'pt-BR', ai_model: 'gemini-2.0-flash', low_balance_threshold: 50 };
      if (resolvedTenantId) {
        const { data: tc } = await supabase
          .from('tenant_config')
          .select('post_limit, token_balance, post_language, ai_model, low_balance_threshold, schedule_enabled, schedule_tier, schedule_post_limit, schedule_billing_start')
          .eq('tenant_id', resolvedTenantId)
          .maybeSingle();
        if (tc) {
          config = {
            post_limit: tc.post_limit || 24,
            token_balance: tc.token_balance || 5000,
            post_language: tc.post_language || 'pt-BR',
            ai_model: tc.ai_model || 'gemini-2.0-flash',
            low_balance_threshold: tc.low_balance_threshold || 50,
            schedule_enabled: tc.schedule_enabled || false,
            schedule_tier: tc.schedule_tier || 'starter',
            schedule_post_limit: tc.schedule_post_limit || 12,
            schedule_billing_start: tc.schedule_billing_start
          };
        }
      }

      const permissions = ROLE_PERMISSIONS[role] || [];

      const me: MeResponse = {
        authenticated: true,
        user: {
          id: userId,
          email,
          source: session?.user ? 'supabase' : 'wix-bridge',
          role,
          permissions,
          tenantContext: tenant ? { id: tenant.id, slug: tenant.slug } : null,
          tenantScopeId,
        },
        tenant,
        wallet,
        config,
        activeApp: 'content-factory',
        isPayPerUse: wallet.credits <= 0,
        usage: {
          tokens_used: 0,
          tokens_limit: config.token_balance,
          posts_used: 0,
          posts_limit: config.post_limit,
          schedule_used: 0,
          schedule_limit: config.schedule_post_limit || 0
        }
      };

      // 6. Fetch Usage (current month)
      if (resolvedTenantId) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const isoStart = startOfMonth.toISOString();

        const [{ data: usageLogs }, { count: postsUsedCount }, { data: scheduleUsage }] = await Promise.all([
          supabase.from('usage_logs').select('cost').eq('tenant_id', resolvedTenantId).gte('created_at', isoStart),
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('tenant_id', resolvedTenantId).gte('created_at', isoStart),
          supabase.from('schedule_usage_log').select('scheduled_count').eq('tenant_id', resolvedTenantId).eq('billing_month', isoStart).maybeSingle()
        ]);

        const tokensUsed = (usageLogs || []).reduce((sum: number, l: any) => sum + (Number(l.cost) || 0), 0);

        me.usage = {
          tokens_used: tokensUsed,
          tokens_limit: config.token_balance,
          posts_used: postsUsedCount || 0,
          posts_limit: config.post_limit,
          schedule_used: scheduleUsage?.scheduled_count || 0,
          schedule_limit: config.schedule_post_limit || 0
        };
      }

      cachedMe = me;
      return me;
    } catch (err) {
      console.warn('genOS getMe error:', err);
      return NOT_AUTH;
    }
  },

  /**
   * Calls the check_can_generate RPC to validate if the active tenant has enough
   * tokens and posts to run a generation cycle, based on the backend billing configs.
   */
  async checkCanGenerate(): Promise<CanGenerateResult> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      return { allowed: false, message: 'Nenhum tenant ativo.', tokens_remaining: 0, posts_remaining: 0, posts_used: 0, posts_limit: 0 };
    }

    try {
      const { data, error } = await supabase.rpc('check_can_generate', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as CanGenerateResult;
    } catch (err: any) {
      console.error('Error checking generation limits:', err);
      // Fail open or fail closed? We fail closed to prevent accidental overage abuse on errors
      return { allowed: false, message: 'Erro ao validar limites de faturamento do tenant.', tokens_remaining: 0, posts_remaining: 0, posts_used: 0, posts_limit: 0 };
    }
  },
};
