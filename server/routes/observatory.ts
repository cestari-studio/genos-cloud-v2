// genOS Full v1.0.0 "Lumina" — routes/observatory.ts
// Agency Observatory: cross-tenant dashboard + pricing management

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/identity';
import { supabase } from '../services/supabaseClient';

export const observatoryRouter = Router();

// All observatory routes require master account role.
observatoryRouter.use(requireRole('super_admin'));

// ═══════════════════════════════════════════════════
// 1. Dashboard Views (7 endpoints)
// ═══════════════════════════════════════════════════

// GET /api/observatory/token-summary — Aggregated token usage per tenant
observatoryRouter.get('/token-summary', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('v_observatory_token_summary')
      .select('*')
      .order('total_agency_cost', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/tenant-costs — Monthly costs per tenant
observatoryRouter.get('/tenant-costs', async (req: Request, res: Response) => {
  try {
    const { tenant_id, months = '6' } = req.query;
    let query = supabase
      .from('v_observatory_tenant_costs')
      .select('*')
      .order('month', { ascending: false });

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id as string);
    }

    const { data, error } = await query.limit(Number(months) * 20);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/daily-usage — Daily aggregated usage
observatoryRouter.get('/daily-usage', async (req: Request, res: Response) => {
  try {
    const { tenant_id, days = '30' } = req.query;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - Number(days));

    let query = supabase
      .from('v_observatory_daily_usage')
      .select('*')
      .gte('usage_date', sinceDate.toISOString().slice(0, 10))
      .order('usage_date', { ascending: false });

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id as string);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/model-breakdown — Usage breakdown by model
observatoryRouter.get('/model-breakdown', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('v_observatory_model_breakdown')
      .select('*')
      .order('total_agency_cost', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/profitability — Profitability per tenant
observatoryRouter.get('/profitability', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('v_observatory_profitability')
      .select('*')
      .order('margin', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/alerts — Active alert conditions
observatoryRouter.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('v_observatory_alerts')
      .select('*')
      .order('severity');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/tenants — All active tenants with summary
observatoryRouter.get('/tenants', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, status, settings, parent_tenant_id, created_at, updated_at')
      .eq('status', 'active')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════
// 2. Pricing Config CRUD (6 endpoints)
// ═══════════════════════════════════════════════════

// GET /api/observatory/pricing — List all pricing configs
observatoryRouter.get('/pricing', async (req: Request, res: Response) => {
  try {
    const { strategy, provider, is_active } = req.query;
    let query = supabase
      .from('pricing_config')
      .select('*')
      .order('strategy')
      .order('provider')
      .order('model');

    if (strategy) query = query.eq('strategy', strategy as string);
    if (provider) query = query.eq('provider', provider as string);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/observatory/pricing/:id — Get single pricing config
observatoryRouter.get('/pricing/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Pricing config not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/observatory/pricing — Create new pricing config
observatoryRouter.post('/pricing', async (req: Request, res: Response) => {
  try {
    const { strategy, tenant_id, tier, provider, model, markup_pct, flat_fee_per_1k_tokens, label } = req.body;

    if (!strategy || !provider || !model) {
      return res.status(400).json({ error: 'strategy, provider, and model are required' });
    }

    if (strategy === 'tenant' && !tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required for tenant strategy' });
    }
    if (strategy === 'tier' && !tier) {
      return res.status(400).json({ error: 'tier is required for tier strategy' });
    }

    const { data, error } = await supabase
      .from('pricing_config')
      .insert({
        strategy,
        tenant_id: tenant_id || null,
        tier: tier || null,
        provider,
        model,
        markup_pct: markup_pct ?? 30,
        flat_fee_per_1k_tokens: flat_fee_per_1k_tokens ?? 0,
        label: label || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/observatory/pricing/:id — Update pricing config
observatoryRouter.put('/pricing/:id', async (req: Request, res: Response) => {
  try {
    const updates: Record<string, any> = {};
    const allowed = ['markup_pct', 'flat_fee_per_1k_tokens', 'label', 'is_active', 'tier'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('pricing_config')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/observatory/pricing/:id — Delete pricing config
observatoryRouter.delete('/pricing/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('pricing_config')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/observatory/pricing/simulate — Simulate pricing for a scenario
observatoryRouter.post('/pricing/simulate', async (req: Request, res: Response) => {
  try {
    const { tenant_id, provider, model, input_tokens, output_tokens } = req.body;

    if (!tenant_id || !provider || !model) {
      return res.status(400).json({ error: 'tenant_id, provider, and model are required' });
    }

    // Import dynamically to avoid circular deps
    const { resolvePricing } = await import('../services/pricingResolver');
    const result = await resolvePricing(
      tenant_id,
      provider,
      model,
      input_tokens || 1000,
      output_tokens || 500
    );

    res.json({
      ...result,
      inputTokens: input_tokens || 1000,
      outputTokens: output_tokens || 500,
      totalTokens: (input_tokens || 1000) + (output_tokens || 500),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
