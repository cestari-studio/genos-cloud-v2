// genOS Full v1.0.0 "Lumina" — activityFeed.ts (Addendum C — AJUSTE 6)
// Shared event emitter for Activity Feed

import { supabase } from './supabaseClient';

export type FeedCategory =
  | 'system'
  | 'sync'
  | 'quality_gate'
  | 'sentiment'
  | 'ai_generation'
  | 'feedback'
  | 'schedule'
  | 'compliance';

export const ALL_FEED_CATEGORIES: FeedCategory[] = [
  'system',
  'sync',
  'quality_gate',
  'sentiment',
  'ai_generation',
  'feedback',
  'schedule',
  'compliance',
];

export interface FeedEvent {
  tenant_id: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  category: FeedCategory;
  action: string;
  summary: string;
  detail?: string;
  resource_type?: string;
  resource_id?: string;
  is_autonomous: boolean;
  show_toast: boolean;
  toast_duration?: number;
  metadata?: Record<string, unknown>;
}

// In-memory toast queue for polling
const toastQueues = new Map<string, FeedEvent[]>();

export async function emitFeedEvent(event: FeedEvent): Promise<void> {
  try {
    const { error } = await supabase.from('activity_log').insert({
      tenant_id: event.tenant_id,
      action: event.action,
      resource_type: event.resource_type || null,
      resource_id: event.resource_id || null,
      metadata: event.metadata || {},
      severity: event.severity,
      category: event.category,
      summary: event.summary,
      detail: event.detail || null,
      is_autonomous: event.is_autonomous,
      show_toast: event.show_toast,
      toast_duration: event.toast_duration || 8000,
    });

    if (error) {
      console.error('[activityFeed] Insert error:', error.message);
    }

    // Push to in-memory toast queue for polling
    if (event.show_toast) {
      const queue = toastQueues.get(event.tenant_id) || [];
      queue.push(event);
      // Keep max 50 toasts in memory
      if (queue.length > 50) queue.shift();
      toastQueues.set(event.tenant_id, queue);
    }
  } catch (err) {
    console.error('[activityFeed] Error emitting event:', err);
  }
}

export function consumeToasts(tenantId: string): FeedEvent[] {
  const queue = toastQueues.get(tenantId) || [];
  toastQueues.set(tenantId, []);
  return queue;
}

export async function getRecentFeed(
  tenantId: string,
  options: { since?: string; limit?: number; category?: string; categories?: FeedCategory[] } = {}
): Promise<any[]> {
  const { since, limit = 30, category, categories } = options;

  let query = supabase
    .from('activity_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gt('created_at', since);
  }
  if (category) {
    query = query.eq('category', category);
  } else if (categories && categories.length > 0) {
    query = query.in('category', categories as any);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[activityFeed] Query error:', error.message);
    return [];
  }
  return data || [];
}
