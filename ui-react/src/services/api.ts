// genOS Lumina — API client service
// Mirrors the previous app.js genOS object but as a typed service

import { supabase } from './supabase';

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

const DEFAULT_TENANT_ID = 'd98b169b-8e10-47b2-bdcf-85af4091a1e0';

let activeTenantId: string | null = localStorage.getItem('genOS_activeClient');
let activeUserEmail: string = localStorage.getItem('genOS_activeUserEmail') || '';
let tenantsList: Tenant[] = [];
let cachedMe: MeResponse | null = null;

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Attach Supabase JWT for authenticated requests
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  if (activeTenantId) {
    headers['X-Tenant-Id'] = activeTenantId;
  }
  return headers;
}

async function apiCall<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `/api${path}`;
  const resolvedHeaders = await getHeaders();
  const res = await fetch(url, {
    ...options,
    headers: { ...resolvedHeaders, ...(options.headers as Record<string, string>) },
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

export const api = {
  get: <T = unknown>(path: string) => apiCall<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    apiCall<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) =>
    apiCall<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) => apiCall<T>(path, { method: 'DELETE' }),

  // Tenant management
  async loadTenants(): Promise<Tenant[]> {
    let data: any[] | null = [];
    try {
      // Direct Supabase fetch instead of API proxy
      const { data: sbData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (error) throw error;
      data = sbData;
    } catch (err) {
      console.warn('genOS API: Supabase tenant fetch failed, using local fallback.', err);
      data = [
        { id: DEFAULT_TENANT_ID, name: 'Cestari Studio', slug: 'cestari-studio', plan: 'enterprise', status: 'active', wix_site_id: null, parent_tenant_id: null, settings: {} }
      ];
    }

    tenantsList = (data || []) as Tenant[];
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
    try {
      // Check for a valid Supabase session before calling backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { authenticated: false, user: null, tenant: null };
      }
      return await apiCall<MeResponse>('/me');
    } catch (err) {
      console.warn('Backend unavailable:', err);
      return { authenticated: false, user: null, tenant: null };
    }
  },
};
