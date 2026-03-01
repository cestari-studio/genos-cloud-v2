// genOS Full v2.0.0 — routes/content.ts
// Operates on `posts` table (replaces legacy content_items)
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabaseClient';

export const contentRouter = Router();

// GET /api/content — List posts with optional filters
contentRouter.get('/', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { status, format, search, limit = '50', offset = '0', sort = 'created_at', order = 'desc' } = req.query;

  let query = supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order(sort as string, { ascending: (order as string) === 'asc' })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) query = query.eq('status', status as string);
  if (format) query = query.eq('format', format as string);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ items: data, total: count, limit: Number(limit), offset: Number(offset) });
});

// GET /api/content/:id — Get single post with media
contentRouter.get('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('posts')
    .select('*, post_media(*)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id)
    .single();

  if (error) return res.status(404).json({ error: 'Post not found' });
  res.json(data);
});

// POST /api/content — Create post
contentRouter.post('/', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const {
    title, description, format = 'feed', status = 'draft',
    hashtags, cta, card_data, media_slots = 1,
    scheduled_date, ai_instructions,
  } = req.body;

  const { data, error } = await supabase
    .from('posts')
    .insert({
      tenant_id: tenant.id,
      title,
      description,
      format,
      status,
      hashtags: hashtags || '',
      cta,
      card_data: card_data || [{ position: 1, text_primary: title, text_secondary: description || '' }],
      media_slots,
      scheduled_date,
      ai_instructions,
      created_by: (req as any).identity?.userId || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log activity
  await supabase.from('activity_log').insert({
    tenant_id: tenant.id,
    action: 'post_created',
    resource_type: 'post',
    resource_id: data.id,
    metadata: { title, format },
  });

  res.status(201).json(data);
});

// PUT /api/content/:id — Update post
contentRouter.put('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('posts')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/content/:id — Delete post
contentRouter.delete('/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});
