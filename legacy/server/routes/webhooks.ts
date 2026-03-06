// genOS Full v1.0.0 "Lumina" — routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabaseClient';

export const webhooksRouter = Router();

// POST /webhooks/wix — Receive Wix CMS webhooks
webhooksRouter.post('/wix', async (req: Request, res: Response) => {
  const { event, data, instanceId } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: 'Missing event or data' });
  }

  try {
    // Find tenant by wix site ID in settings
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, slug')
      .filter('settings->wix_site_id', 'eq', instanceId || '');

    const tenant = tenants?.[0];

    // Log webhook event
    await supabase.from('activity_log').insert({
      tenant_id: tenant?.id || null,
      action: `webhook_wix_${event}`,
      resource_type: 'webhook',
      resource_id: data._id || data.id || 'unknown',
      metadata: { event, instanceId, dataKeys: Object.keys(data) },
    });

    switch (event) {
      case 'item/created':
      case 'item/updated':
        // Queue for feedback processing
        if (tenant) {
          await supabase.from('feedback_queue').insert({
            tenant_id: tenant.id,
            source: 'wix_webhook',
            content_item_id: null,
            feedback_type: event === 'item/created' ? 'new_content' : 'revision_request',
            feedback_data: data,
            processing_status: 'pending',
          });
        }
        break;

      case 'item/deleted':
        // Log deletion, no action needed
        break;

      default:
        console.log(`[Webhook] Unknown Wix event: ${event}`);
    }

    res.json({ received: true, event });
  } catch (err) {
    console.error('[Webhook] Error processing Wix webhook:', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /webhooks/stripe — Receive Stripe payment webhooks (future)
webhooksRouter.post('/stripe', async (req: Request, res: Response) => {
  // Placeholder for Stripe integration
  res.json({ received: true, message: 'Stripe webhook handler not yet implemented' });
});

// POST /webhooks/custom — Generic webhook endpoint
webhooksRouter.post('/custom/:source', async (req: Request, res: Response) => {
  const { source } = req.params;
  const tenantSlug = req.headers['x-tenant-slug'] as string;

  try {
    if (tenantSlug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenant) {
        await supabase.from('activity_log').insert({
          tenant_id: tenant.id,
          action: `webhook_custom_${source}`,
          resource_type: 'webhook',
          resource_id: source,
          metadata: req.body,
        });
      }
    }

    res.json({ received: true, source });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
