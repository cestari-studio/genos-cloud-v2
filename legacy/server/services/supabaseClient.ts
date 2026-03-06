// genOS Full v1.0.0 "Lumina" — supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _supabaseAnon: SupabaseClient | null = null;

function getUrl(): string {
  return process.env.SUPABASE_URL || '';
}

function getServiceKey(): string {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  // Skip placeholder values — fall back to anon key
  if (serviceKey && serviceKey !== 'your-service-role-key-here' && serviceKey.startsWith('eyJ')) {
    return serviceKey;
  }
  return process.env.SUPABASE_ANON_KEY || '';
}

function getAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || '';
}

// Service role client (bypasses RLS) — lazy init after dotenv
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(getUrl(), getServiceKey(), {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

// Anon client (respects RLS) — lazy init
export function getSupabaseAnon(): SupabaseClient {
  if (!_supabaseAnon) {
    _supabaseAnon = createClient(getUrl(), getAnonKey(), {
      auth: { persistSession: false },
    });
  }
  return _supabaseAnon;
}

// Convenience getter matching previous `supabase` export
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

export const supabaseAnon: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAnon() as any)[prop];
  },
});

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings: Record<string, unknown>;
  owner_id: string | null;
  wix_site_id: string | null;
  parent_tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

// Cache tenant lookup to avoid repeated DB calls
const tenantCache = new Map<string, { tenant: Tenant; expiry: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const cached = tenantCache.get(slug);
  if (cached && cached.expiry > Date.now()) {
    return cached.tenant;
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;

  const tenant = data as Tenant;
  tenantCache.set(slug, { tenant, expiry: Date.now() + CACHE_TTL_MS });
  return tenant;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Tenant;
}
