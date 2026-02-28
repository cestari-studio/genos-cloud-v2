// genOS Full v1.0.0 "Lumina" — routes/sync.ts
import { Router, Request, Response } from 'express';
import { syncDbToCsv, syncCsvToWix, syncWixFeedback, syncFull, exportSocialCsv } from '../services/syncEngine';
import { startWatcher, stopWatcher, getWatcherStatus } from '../services/csvWatcher';
import { import17FullSync, getImport17Status, getContentFeedbackHistory } from '../services/import17Sync';
import { supabase } from '../services/supabaseClient';

export const syncRouter = Router();

// POST /api/sync/full — Run full sync pipeline
syncRouter.post('/full', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await syncFull(tenant.id, tenant.slug);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/sync/db-to-csv — Export DB to CSV
syncRouter.post('/db-to-csv', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await syncDbToCsv(tenant.id, tenant.slug);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/sync/csv-to-wix — Push CSV to Wix
syncRouter.post('/csv-to-wix', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await syncCsvToWix(tenant.id, tenant.slug);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/sync/wix-feedback — Pull Wix feedback
syncRouter.post('/wix-feedback', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await syncWixFeedback(tenant.id, tenant.slug);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sync/export-social-csv — Download social media CSV (;-delimited + BOM)
syncRouter.get('/export-social-csv', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { status, formato, platform } = req.query;

  try {
    const { csvString, filename, rowCount } = await exportSocialCsv(
      tenant.id,
      tenant.slug,
      {
        status: status as string | undefined,
        formato: formato as string | undefined,
        platform: platform as string | undefined,
      }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Row-Count', String(rowCount));
    res.send(csvString);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sync/log — Get sync history
syncRouter.get('/log', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { limit = '20' } = req.query;

  const { data, error } = await supabase
    .from('csv_sync_log')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/sync/status — Get current sync status
syncRouter.get('/status', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data: registries } = await supabase
    .from('csv_registry')
    .select('csv_slug, sync_direction, last_sync_at, row_count, sync_status')
    .eq('tenant_id', tenant.id);

  const { data: lastSync } = await supabase
    .from('csv_sync_log')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const watcher = getWatcherStatus();

  res.json({
    registries: registries || [],
    lastSync: lastSync || null,
    watcher,
  });
});

// ── Import17 Bidirectional Sync (Addendum D) ──

// POST /api/sync/import17/full — Run full Import17 bidirectional sync
syncRouter.post('/import17/full', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await import17FullSync(tenant.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sync/import17/status — Get Import17 sync status
syncRouter.get('/import17/status', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const status = await getImport17Status(tenant.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sync/import17/feedback-history/:contentId — Get feedback history for a content item
syncRouter.get('/import17/feedback-history/:contentId', async (req: Request, res: Response) => {
  try {
    const history = await getContentFeedbackHistory(req.params.contentId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/sync/watcher/start — Start CSV file watcher
syncRouter.post('/watcher/start', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const started = startWatcher(tenant.id, tenant.slug);
  res.json({ success: started, watcher: getWatcherStatus() });
});

// POST /api/sync/watcher/stop — Stop CSV file watcher
syncRouter.post('/watcher/stop', (_req: Request, res: Response) => {
  stopWatcher();
  res.json({ success: true, watcher: getWatcherStatus() });
});

// GET /api/sync/watcher/status — Get watcher status
syncRouter.get('/watcher/status', (_req: Request, res: Response) => {
  res.json(getWatcherStatus());
});
