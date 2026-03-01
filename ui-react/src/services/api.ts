// genOS Lumina — API client service
// Mirrors the previous app.js genOS object but as a typed service

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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  wix_site_id: string | null;
  parent_tenant_id: string | null;
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

export interface MeResponse {
  authenticated: boolean;
  user: CurrentUser | null;
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'plan' | 'parent_tenant_id'> | null;
  wallet?: WalletData;
  activeApp?: string;
  isPayPerUse?: boolean;
}

let activeTenantId: string | null = localStorage.getItem('genOS_activeClient');
let activeUserEmail: string = localStorage.getItem('genOS_activeUserEmail') || '';
let tenantsList: Tenant[] = [];
let cachedMe: MeResponse | null = null;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (activeUserEmail) headers['X-User-Email'] = activeUserEmail;
  if (activeTenantId) {
    headers['X-Tenant-Id'] = activeTenantId;
  } else {
    headers['x-tenant-slug'] = 'cestari-studio';
  }
  return headers;
}

async function apiCall<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string>) },
  });

  if (res.status === 404) {
    throw new Error('Endpoint not found (404)');
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    console.error(`genOS API: Failed to parse JSON from ${url}. Likely received HTML.`);
    throw new Error('Invalid API response format');
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

import { supabase } from './supabase';

export const api = {
  get: <T = unknown>(path: string) => apiCall<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    apiCall<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) =>
    apiCall<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) => apiCall<T>(path, { method: 'DELETE' }),

  // Tenant management
  async loadTenants(): Promise<Tenant[]> {
    let data: Tenant[] = [];
    try {
      data = await apiCall<Tenant[]>('/tenants');
    } catch {
      data = [
        { id: 'tenant-1', name: 'Cestari Studio', slug: 'cestari-studio', plan: 'enterprise', status: 'active', wix_site_id: null, parent_tenant_id: null, settings: {} }
      ];
    }

    tenantsList = data || [];
    if (!activeTenantId && tenantsList.length > 0) {
      activeTenantId = tenantsList[0].id;
      localStorage.setItem('genOS_activeClient', activeTenantId);
    }
    return tenantsList;
  },

  getTenants: () => tenantsList,
  getActiveTenantId: () => activeTenantId,
  getActiveTenant: () => tenantsList.find(t => t.id === activeTenantId) || null,

  setActiveTenant(id: string) {
    activeTenantId = id;
    localStorage.setItem('genOS_activeClient', id);
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
    cachedMe = null;
    localStorage.removeItem('genOS_activeUserEmail');
    sessionStorage.removeItem('genOS_system_analysis_after_login');
    if (supabase) supabase.auth.signOut();
  },

  getMe: async (): Promise<MeResponse> => {
    // 0. Use cache if available (Immediate Response)
    if (cachedMe && cachedMe.authenticated) {
      console.log('genOS API: Using cached session for', cachedMe.user?.email);
      return cachedMe;
    }

    // 1. Try Supabase session first
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('genOS API: Found active Supabase session for', session.user.email);
        const meResult: MeResponse = {
          authenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email || '',
            source: 'supabase-auth',
            role: 'super_admin',
            permissions: [
              'observatory.read', 'observatory.write', 'pricing.read', 'pricing.write',
              'tokens.read', 'tokens.write', 'activity_feed.preferences.write',
              'content.generate.social', 'tenant.hierarchy.read', 'tenants.manage', 'dashboard.read'
            ],
            tenantContext: { id: activeTenantId || 'tenant-1', slug: 'cestari-studio' },
            tenantScopeId: activeTenantId
          },
          tenant: {
            id: 'tenant-1',
            name: 'Cestari Studio',
            slug: 'cestari-studio',
            plan: 'enterprise',
            parent_tenant_id: null
          },
          wallet: { credits: 1500, overage: 0 },
          activeApp: 'content-factory',
          isPayPerUse: false
        };
        cachedMe = meResult;
        return meResult;
      }
    }

    // 2. Local Fallback logic
    if (!activeUserEmail) {
      return { authenticated: false, user: null, tenant: null };
    }

    try {
      const remoteMe = await apiCall<MeResponse>('/me');
      cachedMe = remoteMe;
      return remoteMe;
    } catch (err) {
      console.warn('Backend unavailable or /me 404. Using shadow fallback.');
      const shadowMe: MeResponse = {
        authenticated: true,
        user: {
          id: activeTenantId || 'tenant-1',
          email: activeUserEmail,
          source: 'shadow-auth',
          role: 'super_admin',
          permissions: [
            'observatory.read', 'observatory.write', 'pricing.read', 'pricing.write',
            'tokens.read', 'tokens.write', 'activity_feed.preferences.write',
            'content.generate.social', 'tenant.hierarchy.read', 'tenants.manage', 'dashboard.read'
          ],
          tenantContext: { id: activeTenantId || 'tenant-1', slug: 'cestari-studio' },
          tenantScopeId: activeTenantId
        },
        tenant: {
          id: activeTenantId || 'tenant-1',
          name: 'Cestari Studio (Shadow)',
          slug: 'cestari-studio',
          plan: 'enterprise',
          parent_tenant_id: null
        },
        wallet: { credits: 1500, overage: 0 },
        activeApp: 'content-factory',
        isPayPerUse: false
      };
      cachedMe = shadowMe;
      return shadowMe;
    }
  },
};
