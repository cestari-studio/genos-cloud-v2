// genOS Full v1.0.0 "Lumina" — syncEngine.ts
// Pipeline: DB → CSV → Wix (push) | Wix → CSV → DB (feedback pull)

import { supabase } from './supabaseClient';
import { readCsv, writeCsv, writeCsvSemicolon, generateCsvStringSemicolon, getCsvPath, hashRow, type CsvRow } from './csvEngine';
import * as wixClient from './wixClient';

interface SyncResult {
  csvSlug: string;
  direction: string;
  rowsAffected: number;
  status: 'success' | 'partial' | 'error';
  error?: string;
  durationMs: number;
}

interface CsvRegistryEntry {
  id: string;
  tenant_id: string;
  csv_slug: string;
  display_name: string;
  local_path: string;
  wix_collection: string | null;
  sync_direction: string;
  field_mapping: Record<string, string>;
}

/**
 * Get all CSV registry entries for a tenant
 */
async function getCsvRegistries(tenantId: string): Promise<CsvRegistryEntry[]> {
  const { data, error } = await supabase
    .from('csv_registry')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('sync_enabled', true);

  if (error) throw new Error(`Failed to fetch csv_registry: ${error.message}`);
  return (data || []) as CsvRegistryEntry[];
}

/**
 * DB → CSV: Export content_items to CSV based on csv_registry mapping
 */
export async function syncDbToCsv(
  tenantId: string,
  tenantSlug: string,
  csvSlug?: string
): Promise<SyncResult[]> {
  const registries = await getCsvRegistries(tenantId);
  const targets = csvSlug ? registries.filter(r => r.csv_slug === csvSlug) : registries;
  const results: SyncResult[] = [];

  for (const reg of targets) {
    const start = Date.now();
    try {
      // Get content items associated with this CSV
      const { data: items, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('csv_source_slug', reg.csv_slug);

      if (error) throw new Error(error.message);

      const rows: CsvRow[] = (items || []).map(item => {
        const row: CsvRow = { id: item.id };
        const mapping = reg.field_mapping || {};

        // Map DB fields to CSV columns
        for (const [csvCol, dbField] of Object.entries(mapping)) {
          const value = item[dbField as keyof typeof item] ?? item.extra_fields?.[dbField] ?? '';
          row[csvCol] = String(value);
        }

        // Always include genOS fields
        row['_genOS_status'] = item.status || 'draft';
        row['_genOS_score'] = String(item.compliance_score ?? '');
        row['_genOS_feedback'] = item.client_comment || item.client_feedback || '';
        row['_genOS_revision'] = String(item.revision_count || 0);
        row['_genOS_lastSync'] = new Date().toISOString();

        return row;
      });

      const csvPath = getCsvPath(tenantSlug, reg.local_path);
      writeCsv(csvPath, rows);

      // Update registry metadata
      await supabase
        .from('csv_registry')
        .update({
          last_sync_at: new Date().toISOString(),
          row_count: rows.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reg.id);

      results.push({
        csvSlug: reg.csv_slug,
        direction: 'db_to_csv',
        rowsAffected: rows.length,
        status: 'success',
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        csvSlug: reg.csv_slug,
        direction: 'db_to_csv',
        rowsAffected: 0,
        status: 'error',
        error: String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}

/**
 * CSV → Wix: Push CSV data to Wix Collections
 */
export async function syncCsvToWix(
  tenantId: string,
  tenantSlug: string,
  csvSlug?: string
): Promise<SyncResult[]> {
  const registries = await getCsvRegistries(tenantId);
  const targets = csvSlug
    ? registries.filter(r => r.csv_slug === csvSlug)
    : registries.filter(r => r.sync_direction !== 'local_only');
  const results: SyncResult[] = [];

  for (const reg of targets) {
    if (!reg.wix_collection) continue;
    const start = Date.now();

    try {
      const csvPath = getCsvPath(tenantSlug, reg.local_path);
      const rows = readCsv(csvPath);

      if (rows.length === 0) {
        results.push({
          csvSlug: reg.csv_slug,
          direction: 'csv_to_wix',
          rowsAffected: 0,
          status: 'success',
          durationMs: Date.now() - start,
        });
        continue;
      }

      // Map CSV rows to Wix items
      const wixItems = rows.map(row => {
        const item: wixClient.WixItem = {};
        const reverseMapping = Object.fromEntries(
          Object.entries(reg.field_mapping || {}).map(([k, v]) => [v, k])
        );

        for (const [key, value] of Object.entries(row)) {
          const wixField = reverseMapping[key] || key;
          item[wixField] = value;
        }

        return item;
      });

      // Push to Wix (bulk insert/update)
      const { inserted, errors } = await wixClient.bulkInsert(reg.wix_collection, wixItems);

      results.push({
        csvSlug: reg.csv_slug,
        direction: 'csv_to_wix',
        rowsAffected: inserted,
        status: errors.length > 0 ? 'partial' : 'success',
        error: errors.length > 0 ? errors.join('; ') : undefined,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        csvSlug: reg.csv_slug,
        direction: 'csv_to_wix',
        rowsAffected: 0,
        status: 'error',
        error: String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}

/**
 * Wix → CSV → DB: Pull feedback from Wix back to DB
 */
export async function syncWixFeedback(
  tenantId: string,
  tenantSlug: string,
  csvSlug?: string
): Promise<SyncResult[]> {
  const registries = await getCsvRegistries(tenantId);
  const targets = csvSlug
    ? registries.filter(r => r.csv_slug === csvSlug)
    : registries.filter(r => r.sync_direction === 'bidirectional');
  const results: SyncResult[] = [];

  for (const reg of targets) {
    if (!reg.wix_collection) continue;
    const start = Date.now();

    try {
      // Pull from Wix
      const { items } = await wixClient.queryCollection(reg.wix_collection, {}, 1000);

      // Check for feedback changes (items with _genOS_feedback set)
      let feedbackCount = 0;
      for (const item of items) {
        const feedback = item['_genOS_feedback'] as string;
        if (feedback && feedback.trim()) {
          feedbackCount++;

          // Queue the feedback for processing
          await supabase.from('feedback_queue').insert({
            tenant_id: tenantId,
            csv_slug: reg.csv_slug,
            csv_row_id: String(item['_id'] || ''),
            wix_item_id: String(item['_id'] || ''),
            feedback_type: 'comment_only',
            client_comment: feedback,
            processing_status: 'pending',
          });
        }
      }

      results.push({
        csvSlug: reg.csv_slug,
        direction: 'wix_to_db',
        rowsAffected: feedbackCount,
        status: 'success',
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        csvSlug: reg.csv_slug,
        direction: 'wix_to_db',
        rowsAffected: 0,
        status: 'error',
        error: String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}

/**
 * Full sync cycle: DB → CSV → Wix + Wix → CSV → DB
 */
export async function syncFull(tenantId: string, tenantSlug: string): Promise<SyncResult[]> {
  const allResults: SyncResult[] = [];

  // 1. DB → CSV
  const dbToCsv = await syncDbToCsv(tenantId, tenantSlug);
  allResults.push(...dbToCsv);

  // 2. CSV → Wix
  const csvToWix = await syncCsvToWix(tenantId, tenantSlug);
  allResults.push(...csvToWix);

  // 3. Wix → CSV → DB (feedback)
  const wixFeedback = await syncWixFeedback(tenantId, tenantSlug);
  allResults.push(...wixFeedback);

  // Look up registry IDs for logging
  const registries = await getCsvRegistries(tenantId);
  const registryMap = new Map(registries.map(r => [r.csv_slug, r.id]));

  // Log to sync_log
  for (const result of allResults) {
    await supabase.from('csv_sync_log').insert({
      tenant_id: tenantId,
      csv_registry_id: registryMap.get(result.csvSlug) || null,
      direction: result.direction === 'db_to_csv' ? 'to_csv' :
                 result.direction === 'csv_to_wix' ? 'to_wix' : 'from_wix',
      rows_affected: result.rowsAffected,
      status: result.status,
      error_message: result.error,
      duration_ms: result.durationMs,
      triggered_by: 'manual',
    });
  }

  return allResults;
}

/**
 * Export social media content as CSV with ; delimiter + UTF-8 BOM
 * Returns the CSV string ready for HTTP response download
 * The 20-field social media CSV structure from Addendum A
 */
export async function exportSocialCsv(
  tenantId: string,
  tenantSlug: string,
  options: { status?: string; formato?: string; platform?: string } = {}
): Promise<{ csvString: string; filename: string; rowCount: number }> {
  // Query social content items (content_type in social types)
  let query = supabase
    .from('content_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('content_type', ['social_post', 'post_carrossel', 'reels', 'post_estatico']);

  if (options.status) query = query.eq('status', options.status);
  if (options.platform) query = query.eq('platform', options.platform);

  const { data: items, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows: CsvRow[] = (items || []).map(item => {
    const ef = item.extra_fields || {};
    return {
      id: item.id,
      formato: ef.formato || item.content_type || '',
      titulo: ef.titulo || item.title || '',
      mainTextoPost: ef.mainTextoPost || item.body || '',
      textoCards: ef.textoCards || '',
      pilar: ef.pilar || item.pillar || '',
      editoria: ef.editoria || '',
      objetivo: ef.objetivo || '',
      plataforma: ef.plataforma || item.platform || '',
      mes: ef.mes || '',
      semana: ef.semana || '',
      dia_semana: ef.dia_semana || '',
      horario_sugerido: ef.horario_sugerido || '',
      hashtags: ef.hashtags || (item.hashtags || []).join(', '),
      cta: ef.cta || '',
      referencia_visual: ef.referencia_visual || '',
      observacoes: ef.observacoes || '',
      status_aprovacao: ef.status_aprovacao || item.status || '',
      data_publicacao: ef.data_publicacao || '',
      link_publicacao: ef.link_publicacao || '',
    };
  });

  // Filter by formato if specified
  const filtered = options.formato
    ? rows.filter(r => r.formato === options.formato)
    : rows;

  const csvString = generateCsvStringSemicolon(filtered);

  // Also save to disk
  const filename = `social-media-${tenantSlug}-${new Date().toISOString().slice(0,10)}.csv`;
  const csvPath = getCsvPath(tenantSlug, `exports/${filename}`);
  writeCsvSemicolon(csvPath, filtered);

  return { csvString, filename, rowCount: filtered.length };
}
