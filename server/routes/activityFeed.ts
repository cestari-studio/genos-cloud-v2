import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/identity';
import {
  getTenantNotificationVisibility,
  normalizeVisibilityInput,
  saveTenantNotificationVisibility,
} from '../services/notificationVisibility';
import { ALL_FEED_CATEGORIES } from '../services/activityFeed';

export const activityFeedRouter = Router();

// GET /api/activity-feed/preferences?tenant_id=...
activityFeedRouter.get('/preferences', requirePermission('activity_feed.preferences.write'), async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenant_id || (req as any).tenant?.id || '');
  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id is required' });
  }

  try {
    const visibility = await getTenantNotificationVisibility(tenantId);
    const categories = ALL_FEED_CATEGORIES.map((category) => ({
      category,
      enabled: visibility[category],
    }));
    res.json({
      tenant_id: tenantId,
      categories,
      visibility,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/activity-feed/preferences?tenant_id=...
activityFeedRouter.put('/preferences', requirePermission('activity_feed.preferences.write'), async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenant_id || req.body?.tenant_id || (req as any).tenant?.id || '');
  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id is required' });
  }

  try {
    const visibility = normalizeVisibilityInput(req.body?.visibility || req.body?.categories || {});
    const saved = await saveTenantNotificationVisibility({
      tenantId,
      visibility,
      updatedByEmail: (req as any).user?.email,
    });

    const categories = ALL_FEED_CATEGORIES.map((category) => ({
      category,
      enabled: saved[category],
    }));

    res.json({
      tenant_id: tenantId,
      categories,
      visibility: saved,
      saved: true,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
