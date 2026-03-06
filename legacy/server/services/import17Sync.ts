// genOS Full v1.0.0 "Lumina" — import17Sync.ts (Addendum D)
// Import17: Bidirectional Wix CMS Sync + Feedback History Cycle
//
// FLOW:
//   PUSH: Supabase content_items → Wix CMS (via wixClient)
//   PULL: Wix CMS feedback → archive to feedbackHistory → clear Wix field → push cleared
//
// Feedback History Cycle:
//   1. Pull from Wix — detect items with non-empty _genOS_feedback
//   2. Archive: append {date, feedback, status} to content_items.feedback_history
//   3. Queue for processing in feedback_queue
//   4. Clear _genOS_feedback field in local + Wix
//   5. Push cleared state back to Wix

import { supabase } from './supabaseClient';
import * as wixClient from './wixClient';
import { emitFeedEvent } from './activityFeed';

interface Import17Config {
  wixCollection: string;
  tenantId: string;
  tenantSlug: string;
  fieldMapping: Record<string, string>;
}

interface Import17Result {
  pushed: number;
  pulled: number;
  archived: number;
  cleared: number;
  errors: string[];
  durationMs: number;
}

interface FeedbackHistoryEntry {
  date: string;
  feedback: string;
  status: string;
  archivedAt: string;
  source: string;
}

/**
 * Get Import17 configuration for a tenant from csv_registry
 * Looks for entries with sync_direction = 'bidirectional' and wix_collection set
 */
async function getImport17Config(tenantId: string): Promise<Import17Config[]> {
  const { data, error } = await supabase
    .from('csv_registry')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('sync_enabled', true)
    .not('wix_collection', 'is', null);

  if (error) throw new Error(`Import17: Failed to fetch config: ${error.message}`);

  return (data || []).map((r: any) => ({
    wixCollection: r.wix_collection,
    tenantId: r.tenant_id,
    tenantSlug: r.csv_slug,
    fieldMapping: r.field_mapping || {},
  }));
}

/**
 * PUSH: Supabase → Wix CMS
 * Reads approved/published content and pushes to Wix collection
 */
async function pushToWix(config: Import17Config): Promise<{ pushed: number; errors: string[] }> {
  const { data: items, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('tenant_id', config.tenantId)
    .in('status', ['approved', 'published', 'draft', 'review']);

  if (error) throw new Error(`Import17 push: ${error.message}`);
  if (!items || items.length === 0) return { pushed: 0, errors: [] };

  const wixItems: wixClient.WixItem[] = items.map(item => {
    const wixItem: wixClient.WixItem = {};
    const mapping = config.fieldMapping;

    // Apply field mapping: CSV col name → DB field
    for (const [wixField, dbField] of Object.entries(mapping)) {
      const value = (item as any)[dbField] ?? item.extra_fields?.[dbField] ?? '';
      wixItem[wixField] = String(value);
    }

    // Always include genOS metadata fields
    wixItem['_genOS_id'] = item.id;
    wixItem['_genOS_status'] = item.status || 'draft';
    wixItem['_genOS_score'] = String(item.compliance_score ?? '');
    wixItem['_genOS_feedback'] = ''; // Always push cleared feedback
    wixItem['_genOS_revision'] = String(item.revision_count || 0);
    wixItem['_genOS_lastSync'] = new Date().toISOString();

    return wixItem;
  });

  try {
    // Try bulk update first (items with existing Wix IDs)
    const existingItems = wixItems.filter(i => i._id);
    const newItems = wixItems.filter(i => !i._id);

    let pushed = 0;
    const errors: string[] = [];

    if (newItems.length > 0) {
      const insertResult = await wixClient.bulkInsert(config.wixCollection, newItems);
      pushed += insertResult.inserted;
      errors.push(...insertResult.errors);
    }

    if (existingItems.length > 0) {
      const updateResult = await wixClient.bulkUpdate(config.wixCollection, existingItems);
      pushed += updateResult.updated;
      errors.push(...updateResult.errors);
    }

    return { pushed, errors };
  } catch (err) {
    return { pushed: 0, errors: [String(err)] };
  }
}

/**
 * PULL + ARCHIVE: Wix CMS → Feedback History → Queue
 *
 * The feedback cycle:
 * 1. Query Wix for items with non-empty _genOS_feedback
 * 2. For each: archive feedback to content_items.feedback_history JSONB
 * 3. Insert into feedback_queue for processing
 * 4. Clear _genOS_feedback on the Wix side
 */
async function pullFeedbackAndArchive(config: Import17Config): Promise<{
  pulled: number;
  archived: number;
  cleared: number;
  errors: string[];
}> {
  let pulled = 0;
  let archived = 0;
  let cleared = 0;
  const errors: string[] = [];

  try {
    // Pull all items from Wix
    const { items } = await wixClient.queryCollection(config.wixCollection, {}, 1000);

    // Filter items with feedback
    const feedbackItems = items.filter(item => {
      const fb = item['_genOS_feedback'] as string;
      return fb && fb.trim().length > 0;
    });

    pulled = feedbackItems.length;

    for (const wixItem of feedbackItems) {
      const feedback = (wixItem['_genOS_feedback'] as string).trim();
      const genosId = wixItem['_genOS_id'] as string;
      const wixItemId = wixItem['_id'] as string;
      const status = (wixItem['_genOS_status'] as string) || 'unknown';

      if (!genosId) {
        errors.push(`Wix item ${wixItemId} has no _genOS_id — skipping`);
        continue;
      }

      // ── Step 1: Archive feedback to content_items.feedback_history ──
      try {
        const historyEntry: FeedbackHistoryEntry = {
          date: new Date().toISOString(),
          feedback,
          status,
          archivedAt: new Date().toISOString(),
          source: 'import17_wix',
        };

        // Read current feedback_history
        const { data: current } = await supabase
          .from('content_items')
          .select('feedback_history')
          .eq('id', genosId)
          .single();

        const existingHistory: FeedbackHistoryEntry[] = (current?.feedback_history as any) || [];
        const updatedHistory = [...existingHistory, historyEntry];

        // Update with appended history
        const { error: updateError } = await supabase
          .from('content_items')
          .update({
            feedback_history: updatedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', genosId);

        if (updateError) {
          errors.push(`Archive failed for ${genosId}: ${updateError.message}`);
          continue;
        }

        archived++;
      } catch (err) {
        errors.push(`Archive error for ${genosId}: ${String(err)}`);
        continue;
      }

      // ── Step 2: Queue feedback for processing ──
      try {
        await supabase.from('feedback_queue').insert({
          tenant_id: config.tenantId,
          csv_slug: config.tenantSlug,
          csv_row_id: genosId,
          wix_item_id: wixItemId,
          feedback_type: 'comment_only',
          client_comment: feedback,
          processing_status: 'pending',
        });
      } catch (err) {
        errors.push(`Queue insert failed for ${genosId}: ${String(err)}`);
      }

      // ── Step 3: Clear _genOS_feedback in Wix ──
      try {
        await wixClient.updateItem(config.wixCollection, wixItemId, {
          ...wixItem,
          _genOS_feedback: '',
          _genOS_lastSync: new Date().toISOString(),
        });
        cleared++;
      } catch (err) {
        errors.push(`Wix clear failed for ${wixItemId}: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Pull failed: ${String(err)}`);
  }

  return { pulled, archived, cleared, errors };
}

/**
 * FULL IMPORT17 SYNC — Complete bidirectional cycle
 * 1. Pull feedback from Wix → archive → clear
 * 2. Push content from Supabase → Wix
 */
export async function import17FullSync(tenantId: string): Promise<Import17Result> {
  const start = Date.now();
  const allErrors: string[] = [];
  let totalPushed = 0;
  let totalPulled = 0;
  let totalArchived = 0;
  let totalCleared = 0;

  try {
    const configs = await getImport17Config(tenantId);

    if (configs.length === 0) {
      return {
        pushed: 0,
        pulled: 0,
        archived: 0,
        cleared: 0,
        errors: ['No Import17 configurations found for this tenant'],
        durationMs: Date.now() - start,
      };
    }

    for (const config of configs) {
      // Step 1: Pull feedback first (before push overwrites)
      const pullResult = await pullFeedbackAndArchive(config);
      totalPulled += pullResult.pulled;
      totalArchived += pullResult.archived;
      totalCleared += pullResult.cleared;
      allErrors.push(...pullResult.errors);

      // Step 2: Push content to Wix
      const pushResult = await pushToWix(config);
      totalPushed += pushResult.pushed;
      allErrors.push(...pushResult.errors);
    }

    // Emit activity feed event
    await emitFeedEvent({
      tenant_id: tenantId,
      category: 'sync',
      action: 'import17_sync_completed',
      severity: allErrors.length > 0 ? 'warning' : 'success',
      summary: `Import17 sync: ${totalPushed} pushed, ${totalPulled} feedback pulled, ${totalArchived} archived`,
      detail: allErrors.length > 0 ? `Errors: ${allErrors.slice(0, 3).join('; ')}` : undefined,
      is_autonomous: false,
      show_toast: true,
    });
  } catch (err) {
    allErrors.push(`Import17 fatal: ${String(err)}`);
    await emitFeedEvent({
      tenant_id: tenantId,
      category: 'sync',
      action: 'import17_sync_failed',
      severity: 'error',
      summary: `Import17 sync failed: ${String(err)}`,
      is_autonomous: false,
      show_toast: true,
    });
  }

  // Log to csv_sync_log
  await supabase.from('csv_sync_log').insert({
    tenant_id: tenantId,
    direction: 'import17_bidirectional',
    rows_affected: totalPushed + totalPulled,
    status: allErrors.length > 0 ? 'partial' : 'success',
    error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
    duration_ms: Date.now() - start,
    triggered_by: 'manual',
  });

  return {
    pushed: totalPushed,
    pulled: totalPulled,
    archived: totalArchived,
    cleared: totalCleared,
    errors: allErrors,
    durationMs: Date.now() - start,
  };
}

/**
 * Get Import17 sync status for a tenant
 */
export async function getImport17Status(tenantId: string): Promise<{
  configured: boolean;
  collections: number;
  lastSync: string | null;
  pendingFeedback: number;
}> {
  const configs = await getImport17Config(tenantId);

  // Get last sync log
  const { data: lastLog } = await supabase
    .from('csv_sync_log')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('direction', 'import17_bidirectional')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get pending feedback count
  const { count } = await supabase
    .from('feedback_queue')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('processing_status', 'pending');

  return {
    configured: configs.length > 0,
    collections: configs.length,
    lastSync: lastLog?.created_at || null,
    pendingFeedback: count || 0,
  };
}

/**
 * Get feedback history for a specific content item
 */
export async function getContentFeedbackHistory(contentId: string): Promise<FeedbackHistoryEntry[]> {
  const { data, error } = await supabase
    .from('content_items')
    .select('feedback_history')
    .eq('id', contentId)
    .single();

  if (error) throw new Error(`Failed to get feedback history: ${error.message}`);
  return (data?.feedback_history as FeedbackHistoryEntry[]) || [];
}
