import { ALL_FEED_CATEGORIES, type FeedCategory } from './activityFeed';
import { supabase } from './supabaseClient';

export type NotificationVisibilityMap = Record<FeedCategory, boolean>;

function buildDefaultVisibility(): NotificationVisibilityMap {
  const defaults = {} as NotificationVisibilityMap;
  for (const category of ALL_FEED_CATEGORIES) {
    defaults[category] = true;
  }
  return defaults;
}

function isMissingTableError(error: any, tableName: string): boolean {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42P01' || msg.includes(`relation "${tableName}" does not exist`);
}

function parseFromObject(value: unknown): NotificationVisibilityMap {
  const defaults = buildDefaultVisibility();
  if (!value || typeof value !== 'object') return defaults;

  const input = value as Record<string, unknown>;
  for (const category of ALL_FEED_CATEGORIES) {
    if (typeof input[category] === 'boolean') {
      defaults[category] = input[category] as boolean;
    }
  }
  return defaults;
}

export function normalizeVisibilityInput(value: unknown): NotificationVisibilityMap {
  // Supports either object map or array [{ category, enabled }]
  if (Array.isArray(value)) {
    const defaults = buildDefaultVisibility();
    for (const row of value) {
      const category = String((row as any)?.category || '') as FeedCategory;
      const enabled = Boolean((row as any)?.enabled);
      if (ALL_FEED_CATEGORIES.includes(category)) {
        defaults[category] = enabled;
      }
    }
    return defaults;
  }
  return parseFromObject(value);
}

async function loadFromTable(tenantId: string): Promise<NotificationVisibilityMap | null> {
  const { data, error } = await supabase
    .from('tenant_notification_visibility')
    .select('category, is_enabled')
    .eq('tenant_id', tenantId);

  if (error) {
    if (isMissingTableError(error, 'tenant_notification_visibility')) return null;
    console.warn('[notificationVisibility] table read failed:', error.message);
    return null;
  }

  const map = buildDefaultVisibility();
  for (const row of data || []) {
    const category = String((row as any).category) as FeedCategory;
    if (!ALL_FEED_CATEGORIES.includes(category)) continue;
    map[category] = Boolean((row as any).is_enabled);
  }
  return map;
}

async function loadFromTenantSettings(tenantId: string): Promise<NotificationVisibilityMap | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  if (error || !data) return null;
  return parseFromObject((data as any).settings?.notification_visibility);
}

async function saveToTable(tenantId: string, visibility: NotificationVisibilityMap): Promise<boolean> {
  const rows = ALL_FEED_CATEGORIES.map((category) => ({
    tenant_id: tenantId,
    category,
    is_enabled: visibility[category],
  }));

  const { error } = await supabase
    .from('tenant_notification_visibility')
    .upsert(rows, { onConflict: 'tenant_id,category' });

  if (error) {
    if (isMissingTableError(error, 'tenant_notification_visibility')) return false;
    console.warn('[notificationVisibility] table upsert failed:', error.message);
    return false;
  }
  return true;
}

async function saveToTenantSettings(
  tenantId: string,
  visibility: NotificationVisibilityMap,
  updatedByEmail?: string
): Promise<void> {
  const { data } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const settings = ((data as any)?.settings || {}) as Record<string, unknown>;
  const nextSettings = {
    ...settings,
    notification_visibility: visibility,
    notification_visibility_updated_by: updatedByEmail || null,
    notification_visibility_updated_at: new Date().toISOString(),
  };

  await supabase
    .from('tenants')
    .update({ settings: nextSettings, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
}

export async function getTenantNotificationVisibility(tenantId: string): Promise<NotificationVisibilityMap> {
  const fromTable = await loadFromTable(tenantId);
  if (fromTable) return fromTable;

  const fromSettings = await loadFromTenantSettings(tenantId);
  if (fromSettings) return fromSettings;

  return buildDefaultVisibility();
}

export async function saveTenantNotificationVisibility(params: {
  tenantId: string;
  visibility: NotificationVisibilityMap;
  updatedByEmail?: string;
}): Promise<NotificationVisibilityMap> {
  const savedInTable = await saveToTable(params.tenantId, params.visibility);
  if (!savedInTable) {
    await saveToTenantSettings(params.tenantId, params.visibility, params.updatedByEmail);
  }
  return params.visibility;
}

export function getEnabledFeedCategories(visibility: NotificationVisibilityMap): FeedCategory[] {
  return ALL_FEED_CATEGORIES.filter((category) => visibility[category]);
}
