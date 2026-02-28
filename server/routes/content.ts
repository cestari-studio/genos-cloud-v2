// genOS Full v1.0.0 "Lumina" — routes/content.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabaseClient';

export const contentRouter = Router();

// GET /api/content — List content items with optional filters
contentRouter.get('/', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { status, content_type, platform, pillar, search, limit = '50', offset = '0', sort = 'created_at', order = 'desc' } = req.query;

  let query = supabase
    .from('content_items')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order(sort as string, { ascending: (order as string) === 'asc' })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) query = query.eq('status', status as string);
  if (content_type) query = query.eq('content_type', content_type as string);
  if (platform) query = query.eq('platform', platform as string);
  if (pillar) query = query.eq('pillar', pillar as string);
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ items: data, total: count, limit: Number(limit), offset: Number(offset) });
});

// GET /api/content/:id — Get single content item
contentRouter.get('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id)
    .single();

  if (error) return res.status(404).json({ error: 'Content not found' });
  res.json(data);
});

// POST /api/content — Create content item
contentRouter.post('/', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { title, body, content_type, platform, status = 'draft', hashtags, pillar, extra_fields } = req.body;

  const { data, error } = await supabase
    .from('content_items')
    .insert({
      tenant_id: tenant.id,
      title,
      body,
      content_type,
      platform,
      status,
      hashtags: hashtags || [],
      pillar,
      extra_fields: extra_fields || {},
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log activity
  await supabase.from('activity_log').insert({
    tenant_id: tenant.id,
    action: 'content_created',
    resource_type: 'content_item',
    resource_id: data.id,
    metadata: { title, content_type },
  });

  res.status(201).json(data);
});

// PUT /api/content/:id — Update content item
contentRouter.put('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('content_items')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/content/:id — Delete content item
contentRouter.delete('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { error } = await supabase
    .from('content_items')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});
