// genOS Full v1.0.0 "Lumina" — popups.ts routes (Addendum F)
// Popup API: pending, action, conversion, addons catalog

import { Router, Request, Response } from 'express';
import { popupEngine } from '../services/popupEngine';
import { supabase } from '../services/supabaseClient';
import { requireRole } from '../middleware/identity';

export const popupsRouter = Router();

// ─── GET /api/popups/pending — Frontend polling ─────────────────────────────

popupsRouter.get('/pending', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const popups = await popupEngine.getPending(tenant.id);
    res.json(popups);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/popups/:id/action — Record user action ──────────────────────

popupsRouter.post('/:id/action', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action_taken } = req.body;

  if (!action_taken) {
    return res.status(400).json({ error: 'action_taken is required' });
  }

  try {
    await popupEngine.recordAction(id, action_taken);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/popups/:id/conversion — Record upsell conversion ────────────

popupsRouter.post('/:id/conversion', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { id } = req.params;
  const { addon_slug } = req.body;

  if (!addon_slug) {
    return res.status(400).json({ error: 'addon_slug is required' });
  }

  try {
    await popupEngine.recordConversion(id, addon_slug, tenant.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/popups/history — Popup history for tenant ─────────────────────

popupsRouter.get('/history', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { limit = '50', category, status } = req.query;

  try {
    let query = supabase
      .from('popup_events')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (category) query = query.eq('category', String(category));
    if (status) query = query.eq('status', String(status));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/popups/addons — Addons catalog ───────────────────────────────

popupsRouter.get('/addons', async (_req: Request, res: Response) => {
  try {
    const addons = await popupEngine.getAddonsCatalog();
    res.json(addons);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/popups/tenant-addons — Tenant's active addons ────────────────

popupsRouter.get('/tenant-addons', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const addons = await popupEngine.getTenantAddons(tenant.id);
    res.json(addons);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Observatory routes (cross-tenant) ──────────────────────────────────────

popupsRouter.get('/analytics', requireRole('super_admin'), async (_req: Request, res: Response) => {
  try {
    const analytics = await popupEngine.getAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

popupsRouter.get('/revenue', requireRole('super_admin'), async (_req: Request, res: Response) => {
  try {
    const revenue = await popupEngine.getRevenue();
    res.json(revenue);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
