// genOS Full v1.0.0 "Lumina" — csvWatcher.ts
// Watches CSV files for changes and triggers sync pipeline

import chokidar from 'chokidar';
import path from 'path';
import { readCsv, diffRows, hashRow, type CsvRow } from './csvEngine';
import { supabase } from './supabaseClient';

const PROJECTS_DIR = path.resolve(__dirname, '..', '..', 'projects');

interface WatcherState {
  watcher: chokidar.FSWatcher | null;
  snapshots: Map<string, Map<string, string>>; // filePath -> (rowId -> hash)
  debounceTimers: Map<string, NodeJS.Timeout>;
  isRunning: boolean;
  tenantSlug: string;
  tenantId: string;
}

const state: WatcherState = {
  watcher: null,
  snapshots: new Map(),
  debounceTimers: new Map(),
  isRunning: false,
  tenantSlug: '',
  tenantId: '',
};

/**
 * Take a snapshot of a CSV file (row hashes for drift detection)
 */
function snapshotFile(filePath: string): Map<string, string> {
  const rows = readCsv(filePath);
  const hashes = new Map<string, string>();
  for (const row of rows) {
    const id = row['id'] || row['_id'] || row['_genOS_id'] || '';
    if (id) {
      hashes.set(id, hashRow(row));
    }
  }
  return hashes;
}

/**
 * Detect changes between old snapshot and current file
 */
function detectChanges(
  filePath: string,
  oldSnapshot: Map<string, string>
): { added: number; updated: number; deleted: number; rows: CsvRow[] } {
  const currentRows = readCsv(filePath);
  const currentHashes = new Map<string, string>();
  let added = 0;
  let updated = 0;

  for (const row of currentRows) {
    const id = row['id'] || row['_id'] || row['_genOS_id'] || '';
    if (!id) continue;
    const hash = hashRow(row);
    currentHashes.set(id, hash);

    const oldHash = oldSnapshot.get(id);
    if (!oldHash) {
      added++;
    } else if (oldHash !== hash) {
      updated++;
    }
  }

  let deleted = 0;
  for (const id of oldSnapshot.keys()) {
    if (!currentHashes.has(id)) {
      deleted++;
    }
  }

  return { added, updated, deleted, rows: currentRows };
}

/**
 * Handle a CSV file change event
 */
async function handleFileChange(filePath: string): Promise<void> {
  const relativePath = path.relative(
    path.join(PROJECTS_DIR, state.tenantSlug),
    filePath
  );

  console.log(`[csvWatcher] Change detected: ${relativePath}`);

  const oldSnapshot = state.snapshots.get(filePath) || new Map();
  const changes = detectChanges(filePath, oldSnapshot);

  // Update snapshot
  state.snapshots.set(filePath, snapshotFile(filePath));

  if (changes.added === 0 && changes.updated === 0 && changes.deleted === 0) {
    console.log(`[csvWatcher] No meaningful changes in ${relativePath}`);
    return;
  }

  console.log(
    `[csvWatcher] Changes: +${changes.added} ~${changes.updated} -${changes.deleted}`
  );

  // Find matching csv_registry entry
  const { data: registry } = await supabase
    .from('csv_registry')
    .select('*')
    .eq('tenant_id', state.tenantId)
    .eq('local_path', relativePath)
    .single();

  if (!registry) {
    console.log(`[csvWatcher] No registry entry for ${relativePath}, skipping`);
    return;
  }

  // Log the change detection
  await supabase.from('csv_sync_log').insert({
    tenant_id: state.tenantId,
    csv_registry_id: registry.id,
    direction: 'csv_change_detected',
    rows_affected: changes.added + changes.updated + changes.deleted,
    status: 'success',
    duration_ms: 0,
    triggered_by: 'watcher',
    metadata: {
      added: changes.added,
      updated: changes.updated,
      deleted: changes.deleted,
      file: relativePath,
    },
  });

  // If sync is enabled and direction allows CSV → DB sync
  if (
    registry.sync_enabled &&
    ['bidirectional', 'csv_to_db'].includes(registry.sync_direction)
  ) {
    await syncCsvChangesToDb(registry, changes.rows);
  }
}

/**
 * Sync CSV changes back to Supabase content_items
 */
async function syncCsvChangesToDb(
  registry: any,
  csvRows: CsvRow[]
): Promise<void> {
  const start = Date.now();
  const mapping = registry.field_mapping || {};
  let affected = 0;

  // Known direct columns on content_items
  const DIRECT_COLS = new Set([
    'title', 'body', 'status', 'content_type', 'client_feedback',
    'compliance_score', 'revision_count', 'client_code',
  ]);

  for (const row of csvRows) {
    const contentId = row['id'] || row['_genOS_id'];
    if (!contentId) continue;

    // Build update: direct columns go to top-level, others to extra_fields
    const dbUpdate: Record<string, unknown> = {};
    const extraFields: Record<string, unknown> = {};

    for (const [csvCol, dbField] of Object.entries(mapping)) {
      if (row[csvCol] !== undefined) {
        if (DIRECT_COLS.has(dbField as string)) {
          dbUpdate[dbField as string] = row[csvCol];
        } else {
          extraFields[dbField as string] = row[csvCol];
        }
      }
    }

    // Also pick up genOS metadata fields
    // _genOS_feedback is free-text → goes to client_comment (not client_feedback which is an enum)
    if (row['_genOS_feedback']) {
      dbUpdate['client_comment'] = row['_genOS_feedback'];
    }
    if (row['_genOS_status'] && DIRECT_COLS.has('status')) {
      dbUpdate['status'] = row['_genOS_status'];
    }

    if (Object.keys(extraFields).length > 0) {
      dbUpdate['extra_fields'] = extraFields;
    }

    dbUpdate['updated_at'] = new Date().toISOString();

    const { error } = await supabase
      .from('content_items')
      .update(dbUpdate)
      .eq('id', contentId)
      .eq('tenant_id', state.tenantId);

    if (error) {
      console.error(`[csvWatcher] Update error for ${contentId}: ${error.message}`);
    } else {
      affected++;
    }
  }

  // Log sync result
  await supabase.from('csv_sync_log').insert({
    tenant_id: state.tenantId,
    csv_registry_id: registry.id,
    direction: 'from_csv',
    rows_affected: affected,
    status: 'success',
    duration_ms: Date.now() - start,
    triggered_by: 'watcher',
  });

  // Update registry metadata
  await supabase
    .from('csv_registry')
    .update({
      last_sync_at: new Date().toISOString(),
      row_count: csvRows.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registry.id);

  console.log(
    `[csvWatcher] Synced ${affected} rows to DB for ${registry.csv_slug}`
  );
}

/**
 * Start watching CSV files for a tenant
 */
export function startWatcher(tenantId: string, tenantSlug: string): boolean {
  if (state.isRunning) {
    console.log('[csvWatcher] Already running, stopping first...');
    stopWatcher();
  }

  const watchDir = path.join(PROJECTS_DIR, tenantSlug);

  state.tenantId = tenantId;
  state.tenantSlug = tenantSlug;
  state.snapshots.clear();

  try {
    state.watcher = chokidar.watch(`${watchDir}/**/*.csv`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      depth: 5,
    });

    state.watcher.on('add', (filePath: string) => {
      // Initial snapshot on discovery
      state.snapshots.set(filePath, snapshotFile(filePath));
      console.log(`[csvWatcher] Tracking: ${path.basename(filePath)}`);
    });

    state.watcher.on('change', (filePath: string) => {
      // Debounce rapid changes (300ms)
      const existing = state.debounceTimers.get(filePath);
      if (existing) clearTimeout(existing);

      state.debounceTimers.set(
        filePath,
        setTimeout(() => {
          handleFileChange(filePath).catch(err =>
            console.error(`[csvWatcher] Error handling change: ${err}`)
          );
          state.debounceTimers.delete(filePath);
        }, 300)
      );
    });

    state.watcher.on('error', (err: Error) => {
      console.error(`[csvWatcher] Watcher error: ${err.message}`);
    });

    state.isRunning = true;
    console.log(`[csvWatcher] Started watching: ${watchDir}`);
    return true;
  } catch (err) {
    console.error(`[csvWatcher] Failed to start: ${err}`);
    return false;
  }
}

/**
 * Stop the file watcher
 */
export function stopWatcher(): void {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  for (const timer of state.debounceTimers.values()) {
    clearTimeout(timer);
  }
  state.debounceTimers.clear();
  state.snapshots.clear();
  state.isRunning = false;
  console.log('[csvWatcher] Stopped');
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): {
  isRunning: boolean;
  tenantSlug: string;
  trackedFiles: number;
} {
  return {
    isRunning: state.isRunning,
    tenantSlug: state.tenantSlug,
    trackedFiles: state.snapshots.size,
  };
}
