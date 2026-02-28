// genOS Full v1.0.0 "Lumina" — routes/ai.ts
import { Router, Request, Response } from 'express';
import { generateContent, generateSocialContent, generateBrandDna, batchSocialGenerate, scheduleAdjust } from '../services/aiRouter';
import { buildEnvelope } from '../services/agentEnvelope';
import { checkCompliance } from '../services/masterCompliance';
import { processFeedbackQueue } from '../services/feedbackLoop';
import { supabase } from '../services/supabaseClient';
import { getRecentFeed, consumeToasts } from '../services/activityFeed';
import { runHealthCheck } from '../services/healthCheck';
import { evaluateContentQuality, batchEvaluate } from '../services/qualityGate';
import { runSentimentAnalysis, getLatestSentiment } from '../services/sentimentPulse';
import { runNotificationTriggers } from '../services/notificationTriggers';
import { getEnabledFeedCategories, getTenantNotificationVisibility } from '../services/notificationVisibility';
import { requirePermission } from '../middleware/identity';

export const aiRouter = Router();

// POST /api/ai/generate — Generate content via AI
aiRouter.post('/generate', requirePermission('content.generate.social'), async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { content_type, platform, prompt, context } = req.body;

  if (!content_type || !prompt) {
    return res.status(400).json({ error: 'content_type and prompt are required' });
  }

  try {
    const result = await generateContent({
      tenantId: tenant.id,
      contentType: content_type,
      platform: platform || 'instagram',
      topic: prompt,
      clientContext: context || {},
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/compliance-check — Run compliance check on content
aiRouter.post('/compliance-check', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { content, content_type, platform } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  try {
    const result = await checkCompliance(tenant.id, content, content_type || 'social_post');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/envelope — Build agent envelope (preview)
aiRouter.post('/envelope', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { content_type, platform, context } = req.body;

  try {
    const envelope = await buildEnvelope(
      tenant.id,
      content_type || 'social_post',
      context?.topic || 'general',
      {
        platform: platform || 'instagram',
        customContext: context ? JSON.stringify(context) : undefined,
      }
    );

    res.json(envelope);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/process-feedback — Process feedback queue
aiRouter.post('/process-feedback', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await processFeedbackQueue(tenant.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/ai/sessions — List AI sessions
aiRouter.get('/sessions', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { limit = '20' } = req.query;

  const { data, error } = await supabase
    .from('ai_sessions')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/ai/sessions/:id — Get single AI session
aiRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('ai_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('tenant_id', tenant.id)
    .single();

  if (error) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

// POST /api/ai/batch-generate — Batch content generation (Content Factory)
aiRouter.post('/batch-generate', requirePermission('content.generate.social'), async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required (content_type, platform, prompt)' });
  }

  if (items.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 items per batch' });
  }

  const results: Array<{
    index: number;
    status: string;
    contentItemId?: string;
    complianceScore?: number;
    complianceVerdict?: string;
    provider?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const aiResult = await generateContent({
        tenantId: tenant.id,
        contentType: item.content_type || 'social_post',
        platform: item.platform || 'instagram',
        topic: item.prompt,
        clientContext: item.context || '',
      });

      const compliance = await checkCompliance(
        tenant.id,
        aiResult.content,
        item.content_type || 'social_post'
      );

      const itemStatus = compliance.verdict === 'approved'
        ? 'approved'
        : compliance.verdict === 'rejected'
        ? 'rejected'
        : 'pending_review';

      const { data: contentItem, error: insertErr } = await supabase
        .from('content_items')
        .insert({
          tenant_id: tenant.id,
          title: item.prompt.substring(0, 120),
          body: aiResult.content,
          content_type: item.content_type || 'social_post',
          platform: item.platform || 'instagram',
          pillar: item.pillar || null,
          status: itemStatus,
          compliance_score: compliance.score,
          ai_provider_used: aiResult.provider,
          ai_model: aiResult.model,
          extra_fields: {
            ai_session_id: aiResult.sessionId,
            batch_generated: true,
            compliance_layers: compliance.checks,
          },
        })
        .select('id')
        .single();

      if (insertErr) throw new Error(insertErr.message);

      await supabase.from('activity_log').insert({
        tenant_id: tenant.id,
        action: 'content_batch_generated',
        resource_type: 'content_item',
        resource_id: contentItem?.id,
        metadata: { content_type: item.content_type, provider: aiResult.provider, score: compliance.score },
      });

      results.push({
        index: i,
        status: 'success',
        contentItemId: contentItem?.id,
        complianceScore: compliance.score,
        complianceVerdict: compliance.verdict,
        provider: aiResult.provider,
      });
    } catch (err) {
      results.push({ index: i, status: 'error', error: String(err) });
    }
  }

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({ total: items.length, succeeded, failed, results });
});

// POST /api/ai/generate-social — Format-specific social media generation (Reel/Carrossel/Estático)
aiRouter.post('/generate-social', requirePermission('content.generate.social'), async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { formato, platform, prompt, pilar, editoria, objetivo, mes, semana, dia_semana, horario_sugerido } = req.body;

  if (!formato || !prompt) {
    return res.status(400).json({ error: 'formato and prompt are required' });
  }

  const validFormats = ['reel', 'carrossel', 'estatico'];
  if (!validFormats.includes(formato)) {
    return res.status(400).json({ error: `formato must be one of: ${validFormats.join(', ')}` });
  }

  try {
    const socialResult = await generateSocialContent({
      tenantId: tenant.id,
      formato,
      platform: platform || 'instagram',
      prompt,
      pilar,
      editoria,
      objetivo,
      mes,
      semana,
      dia_semana,
      horario_sugerido,
    });

    // Auto-save to content_items with all 20 social fields in extra_fields
    const contentType = formato === 'carrossel' ? 'post_carrossel' : formato === 'reel' ? 'reels' : 'social_post';

    const { data: contentItem, error: insertErr } = await supabase
      .from('content_items')
      .insert({
        tenant_id: tenant.id,
        title: socialResult.titulo,
        body: socialResult.mainTextoPost,
        content_type: contentType,
        platform: platform || 'instagram',
        pillar: pilar || null,
        status: 'draft',
        ai_provider_used: socialResult.provider,
        ai_model: socialResult.model,
        extra_fields: {
          // Social media 20-field structure
          formato,
          titulo: socialResult.titulo,
          mainTextoPost: socialResult.mainTextoPost,
          textoCards: socialResult.textoCards,
          pilar: pilar || '',
          editoria: editoria || '',
          objetivo: objetivo || '',
          plataforma: platform || 'instagram',
          mes: mes || '',
          semana: semana || '',
          dia_semana: dia_semana || '',
          horario_sugerido: horario_sugerido || '',
          hashtags: '', // will be extracted from mainTextoPost
          cta: '',
          referencia_visual: '',
          observacoes: '',
          status_aprovacao: 'pendente',
          data_publicacao: '',
          link_publicacao: '',
          ai_session_id: socialResult.sessionId,
        },
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await supabase.from('activity_log').insert({
      tenant_id: tenant.id,
      action: 'social_content_generated',
      resource_type: 'content_item',
      resource_id: contentItem?.id,
      metadata: { formato, platform, provider: socialResult.provider },
    });

    res.status(201).json({
      item: contentItem,
      social: {
        titulo: socialResult.titulo,
        mainTextoPost: socialResult.mainTextoPost,
        textoCards: socialResult.textoCards,
      },
      ai: {
        provider: socialResult.provider,
        model: socialResult.model,
        tokensUsed: socialResult.tokensUsed,
        costUsd: socialResult.costUsd,
        sessionId: socialResult.sessionId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/generate-and-save — Generate single + compliance + save
aiRouter.post('/generate-and-save', requirePermission('content.generate.social'), async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { content_type, platform, prompt, pillar, context } = req.body;

  if (!content_type || !prompt) {
    return res.status(400).json({ error: 'content_type and prompt are required' });
  }

  try {
    const aiResult = await generateContent({
      tenantId: tenant.id,
      contentType: content_type,
      platform: platform || 'instagram',
      topic: prompt,
      clientContext: context || '',
    });

    const compliance = await checkCompliance(tenant.id, aiResult.content, content_type);

    const itemStatus = compliance.verdict === 'approved'
      ? 'approved'
      : compliance.verdict === 'rejected'
      ? 'rejected'
      : 'pending_review';

    const { data: contentItem, error: insertErr } = await supabase
      .from('content_items')
      .insert({
        tenant_id: tenant.id,
        title: prompt.substring(0, 120),
        body: aiResult.content,
        content_type,
        platform: platform || 'instagram',
        pillar: pillar || null,
        status: itemStatus,
        compliance_score: compliance.score,
        ai_provider_used: aiResult.provider,
        ai_model: aiResult.model,
        extra_fields: {
          ai_session_id: aiResult.sessionId,
          compliance_layers: compliance.checks,
        },
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await supabase.from('activity_log').insert({
      tenant_id: tenant.id,
      action: 'content_ai_generated',
      resource_type: 'content_item',
      resource_id: contentItem?.id,
      metadata: { content_type, provider: aiResult.provider, score: compliance.score },
    });

    res.status(201).json({
      item: contentItem,
      ai: { provider: aiResult.provider, model: aiResult.model, tokensUsed: aiResult.tokensUsed, costUsd: aiResult.costUsd, sessionId: aiResult.sessionId },
      compliance: { score: compliance.score, verdict: compliance.verdict, layers: compliance.checks },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 3: POST /api/ai/generate-dna
// ═══════════════════════════════════════════════════════════════
aiRouter.post('/generate-dna', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { brief, website, segment } = req.body;

  if (!brief) {
    return res.status(400).json({ error: 'brief is required' });
  }

  try {
    const result = await generateBrandDna(tenant.id, { brief, website, segment });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 4: POST /api/ai/batch-social
// ═══════════════════════════════════════════════════════════════
aiRouter.post('/batch-social', requirePermission('content.generate.social'), async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { date_start, date_end, posts_per_week, format_distribution, platform, pilar_distribution } = req.body;

  if (!date_start || !date_end) {
    return res.status(400).json({ error: 'date_start and date_end are required' });
  }

  try {
    const result = await batchSocialGenerate(tenant.id, {
      dateStart: date_start,
      dateEnd: date_end,
      postsPerWeek: posts_per_week || 5,
      formatDistribution: format_distribution || { reel: 40, carrossel: 40, estatico: 20 },
      platform: platform || 'instagram',
      pilarDistribution: pilar_distribution,
    });

    // Auto-save each generated item to content_items
    const savedItems: any[] = [];
    for (const item of result.items) {
      const contentType = item.formato === 'carrossel' ? 'post_carrossel' : item.formato === 'reel' ? 'reels' : 'social_post';

      const { data: contentItem, error: insertErr } = await supabase
        .from('content_items')
        .insert({
          tenant_id: tenant.id,
          title: item.titulo,
          body: item.mainTextoPost,
          content_type: contentType,
          platform: platform || 'instagram',
          pillar: item.pilar || null,
          status: 'draft',
          scheduled_date: item.scheduled_date || null,
          time_slot: item.horario_sugerido || null,
          ai_provider_used: result.provider,
          ai_model: result.model,
          extra_fields: {
            formato: item.formato,
            titulo: item.titulo,
            mainTextoPost: item.mainTextoPost,
            textoCards: item.textoCards || '',
            pilar: item.pilar || '',
            editoria: item.editoria || '',
            objetivo: item.objetivo || '',
            plataforma: platform || 'instagram',
            mes: item.mes || '',
            semana: item.semana || '',
            dia_semana: item.dia_semana || '',
            horario_sugerido: item.horario_sugerido || '',
            hashtags: '',
            cta: '',
            referencia_visual: '',
            observacoes: '',
            status_aprovacao: 'pendente',
            data_publicacao: item.scheduled_date || '',
            link_publicacao: '',
            batch_generated: true,
          },
        })
        .select('id, title, content_type, scheduled_date')
        .single();

      if (insertErr) {
        console.error('[batch-social] Insert error:', insertErr.message, insertErr.details, insertErr.hint);
      }
      if (!insertErr && contentItem) {
        savedItems.push(contentItem);
      }
    }

    await supabase.from('activity_log').insert({
      tenant_id: tenant.id,
      action: 'batch_social_generated',
      resource_type: 'content_item',
      metadata: {
        date_range: `${date_start} → ${date_end}`,
        total_generated: result.items.length,
        total_saved: savedItems.length,
        provider: result.provider,
      },
    });

    res.status(201).json({
      generated: result.items.length,
      saved: savedItems.length,
      items: savedItems,
      ai: { provider: result.provider, model: result.model, tokensUsed: result.tokensUsed, costUsd: result.costUsd },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 5: POST /api/ai/schedule-adjust
// ═══════════════════════════════════════════════════════════════
aiRouter.post('/schedule-adjust', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { command, date_range } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'command (natural language) is required' });
  }

  try {
    // Get current scheduled items for context
    let query = supabase
      .from('content_items')
      .select('id, title, content_type, platform, status, scheduled_date, time_slot, pillar, extra_fields')
      .eq('tenant_id', tenant.id)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true });

    if (date_range?.start) query = query.gte('scheduled_date', date_range.start);
    if (date_range?.end) query = query.lte('scheduled_date', date_range.end);

    const { data: scheduledItems } = await query;

    const result = await scheduleAdjust(tenant.id, {
      command,
      currentSchedule: scheduledItems || [],
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/schedule-apply — Apply confirmed schedule operations
aiRouter.post('/schedule-apply', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { operations } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations array is required' });
  }

  const results: Array<{ op: string; status: string; error?: string }> = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'move': {
          await supabase
            .from('content_items')
            .update({ scheduled_date: op.new_date, time_slot: op.new_time || null, updated_at: new Date().toISOString() })
            .eq('id', op.item_id)
            .eq('tenant_id', tenant.id);
          results.push({ op: `move ${op.item_id}`, status: 'success' });
          break;
        }
        case 'swap': {
          const { data: itemA } = await supabase.from('content_items').select('scheduled_date, time_slot').eq('id', op.item_a_id).single();
          const { data: itemB } = await supabase.from('content_items').select('scheduled_date, time_slot').eq('id', op.item_b_id).single();
          if (itemA && itemB) {
            await supabase.from('content_items').update({ scheduled_date: itemB.scheduled_date, time_slot: itemB.time_slot }).eq('id', op.item_a_id);
            await supabase.from('content_items').update({ scheduled_date: itemA.scheduled_date, time_slot: itemA.time_slot }).eq('id', op.item_b_id);
          }
          results.push({ op: `swap ${op.item_a_id} ↔ ${op.item_b_id}`, status: 'success' });
          break;
        }
        case 'delete': {
          await supabase.from('content_items').update({ scheduled_date: null, time_slot: null, status: 'archived' }).eq('id', op.item_id).eq('tenant_id', tenant.id);
          results.push({ op: `delete ${op.item_id}`, status: 'success' });
          break;
        }
        case 'update_content': {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (op.new_title) updates.title = op.new_title;
          if (op.new_body) updates.body = op.new_body;
          if (op.new_format) updates.content_type = op.new_format;
          await supabase.from('content_items').update(updates).eq('id', op.item_id).eq('tenant_id', tenant.id);
          results.push({ op: `update ${op.item_id}`, status: 'success' });
          break;
        }
        case 'change_format': {
          const contentType = op.new_format === 'carrossel' ? 'post_carrossel' : op.new_format === 'reel' ? 'reels' : 'social_post';
          await supabase.from('content_items').update({ content_type: contentType, updated_at: new Date().toISOString() }).eq('id', op.item_id).eq('tenant_id', tenant.id);
          results.push({ op: `change_format ${op.item_id} → ${op.new_format}`, status: 'success' });
          break;
        }
        default:
          results.push({ op: op.type, status: 'skipped', error: 'Unknown operation type' });
      }
    } catch (err) {
      results.push({ op: op.type, status: 'error', error: String(err) });
    }
  }

  await supabase.from('activity_log').insert({
    tenant_id: tenant.id,
    action: 'schedule_adjusted',
    resource_type: 'content_item',
    metadata: { operations_count: operations.length, results },
  });

  res.json({ applied: results.filter(r => r.status === 'success').length, total: operations.length, results });
});

// GET /api/ai/schedule — Get calendar data
aiRouter.get('/schedule', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { month, year } = req.query;

  let query = supabase
    .from('content_items')
    .select('id, title, content_type, platform, status, scheduled_date, time_slot, pillar, extra_fields, compliance_score')
    .eq('tenant_id', tenant.id)
    .not('scheduled_date', 'is', null)
    .order('scheduled_date', { ascending: true });

  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
    query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Map content_type → friendly format name for calendar rendering
  const CONTENT_TYPE_TO_FORMAT: Record<string, string> = {
    reels: 'reel',
    post_carrossel: 'carrossel',
    social_post: 'estatico',
    blog_post: 'estatico',
    blog_article: 'estatico',
    stories: 'reel',
    email_campaign: 'estatico',
    brief: 'estatico',
  };

  const enriched = (data || []).map((item: any) => ({
    ...item,
    format: item.extra_fields?.formato || CONTENT_TYPE_TO_FORMAT[item.content_type] || 'estatico',
    hook: item.extra_fields?.hook || item.extra_fields?.textoCards?.split('\n')[0]?.replace(/^\[.*?\]\s*/, '') || '',
    caption: item.extra_fields?.caption || item.extra_fields?.legenda || item.extra_fields?.mainTextoPost || '',
    cta: item.extra_fields?.cta || '',
  }));

  res.json(enriched);
});

// ═══════════════════════════════════════════════════════════════
// Addendum C — AJUSTE 6: Activity Feed + Health Check
// ═══════════════════════════════════════════════════════════════

// GET /api/ai/feed — Activity feed (polling)
aiRouter.get('/feed', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const user = (req as any).user;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { since, limit, category } = req.query;

  try {
    let allowedCategories: string[] | undefined;
    if (user?.role !== 'super_admin') {
      const visibility = await getTenantNotificationVisibility(tenant.id);
      allowedCategories = getEnabledFeedCategories(visibility);

      if (category && !allowedCategories.includes(String(category))) {
        return res.json([]);
      }
    }

    const events = await getRecentFeed(tenant.id, {
      since: since as string,
      limit: limit ? Number(limit) : 30,
      category: category as string,
      categories: allowedCategories as any,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/ai/feed/toasts — Consume pending toasts
aiRouter.get('/feed/toasts', (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const user = (req as any).user;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const toasts = consumeToasts(tenant.id);

  if (user?.role === 'super_admin') {
    return res.json(toasts);
  }

  // Keep toast filtering cheap by reusing the same visibility settings used by /feed.
  getTenantNotificationVisibility(tenant.id)
    .then((visibility) => {
      const enabled = new Set(getEnabledFeedCategories(visibility));
      const filtered = toasts.filter((toast) => enabled.has(toast.category));
      res.json(filtered);
    })
    .catch(() => {
      res.json([]);
    });
});

// GET /api/ai/health-check — Detailed system health check
aiRouter.get('/health-check', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const tenantId = tenant?.id;

  try {
    const result = await runHealthCheck(tenantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum C — AJUSTE 7: F10 Quality Gate
// ═══════════════════════════════════════════════════════════════

// POST /api/ai/quality-gate/:id — Evaluate single content item
aiRouter.post('/quality-gate/:id', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await evaluateContentQuality(tenant.id, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai/quality-gate/batch — Batch evaluate unscored items
aiRouter.post('/quality-gate-batch', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await batchEvaluate(tenant.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum C — AJUSTE 8: F5 Sentiment Pulse
// ═══════════════════════════════════════════════════════════════

// POST /api/ai/sentiment — Run sentiment analysis
aiRouter.post('/sentiment', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await runSentimentAnalysis(tenant.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/ai/sentiment/latest — Get latest sentiment
aiRouter.get('/sentiment/latest', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await getLatestSentiment(tenant.id);
    if (!result) return res.status(404).json({ error: 'No sentiment analysis found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Addendum C — AJUSTE 9: Notification Triggers
// ═══════════════════════════════════════════════════════════════

// POST /api/ai/notifications/check — Manually trigger notification checks
aiRouter.post('/notifications/check', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    await runNotificationTriggers(tenant.id);
    res.json({ status: 'ok', message: 'Notification triggers executed' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
