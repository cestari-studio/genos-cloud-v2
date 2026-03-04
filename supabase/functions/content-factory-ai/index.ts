import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

/* content-factory-ai v8 — genOS Cloud Platform
   Motor de IA do Content Factory.
   Acoes: revise, generate, format, update_status, delete_post, get_brand_dna */

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://app.cestari.studio',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostPayload {
  postId?: string;
  tenantId?: string;
  action: string;
  topic?: string;
  context?: string;
  targetFormat?: 'feed' | 'carrossel' | 'stories' | 'reels';
  cardCount?: number;
  reelDuration?: number | null;
  feedMediaType?: 'image' | 'video' | null;
  status?: string;
  ai_instructions?: string;
  scheduled_date?: string | null;
  extraHashtags?: string;
  customCta?: string;
  briefing?: {
    brandName: string;
    industry: string;
    brandStory: string;
    targetAudience: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload: PostPayload = await req.json();
    const { action } = payload;
    if (!action) throw new Error('action is required');

    let result;
    switch (action) {
      case 'revise': result = await handleRevise(supabaseAdmin, payload); break;
      case 'generate': result = await handleGenerate(supabaseAdmin, payload); break;
      case 'format': result = await handleFormat(supabaseAdmin, payload); break;
      case 'update_status': result = await handleUpdateStatus(supabaseAdmin, payload); break;
      case 'delete_post': result = await handleDeletePost(supabaseAdmin, payload); break;
      case 'get_brand_dna': result = await handleGetBrandDna(supabaseAdmin, payload); break;
      case 'assign_media': result = await handleAssignMedia(supabaseAdmin, payload); break;
      case 'generate_dna_from_briefing': result = await handleGenerateDnaFromBriefing(supabaseAdmin, payload); break;
      case 'complete_onboarding': result = await handleCompleteOnboarding(supabaseAdmin, payload); break;
      case 'export_zip': {
        // Returns binary ZIP — bypass the normal JSON wrapper
        const zipResponse = await handleExportZip(supabaseAdmin, payload);
        return zipResponse;
      }
      default: throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    try {
      const body = await req.clone().json().catch(() => ({})) as Record<string, unknown>;
      if (body.postId && body.action !== 'delete_post') {
        await supabaseAdmin.from('posts').update({ ai_processing: false }).eq('id', body.postId as string);
      }
    } catch (_) { }

    let errObj = { success: false, error: error.message };
    let status = 400;

    // Handle Billing Error specifically
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.isBillingError) {
        errObj = { success: false, error: parsed.reason, message: parsed.message, tokens_remaining: parsed.tokens_remaining, posts_remaining: parsed.posts_remaining } as any;
        status = 402;
      }
    } catch (_) { }

    return new Response(JSON.stringify(errObj), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  }
});

async function trackUsage(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  operation: string,
  format: string,
  slideCount: number,
  aiModel: string,
  actualApiTokens: number,
  genosTokensDebited: number
) {
  // 1. Insert detailed usage log
  await sb.from('usage_logs').insert({
    tenant_id: tenantId,
    app_slug: 'content-factory',
    operation,
    cost: genosTokensDebited,
    is_overage: false,
    format,
    slide_count: slideCount,
    ai_model: aiModel,
    actual_api_tokens: actualApiTokens,
    genos_tokens_debited: genosTokensDebited
  });

  // 2. Debit credits
  await sb.rpc('debit_credits', { p_tenant_id: tenantId, p_amount: genosTokensDebited });

  // 3. Low balance check
  const { data: wallet } = await sb.from('credit_wallets').select('prepaid_credits').eq('tenant_id', tenantId).maybeSingle();
  const { data: config } = await sb.from('tenant_config').select('low_balance_threshold').eq('tenant_id', tenantId).maybeSingle();

  if (wallet && config && wallet.prepaid_credits <= (config.low_balance_threshold || 50)) {
    // Check if we already sent a low balance alert recently
    const { data: recentLog } = await sb.from('activity_log')
      .select('id').eq('tenant_id', tenantId)
      .eq('category', 'commercial').eq('title', 'Saldo baixo de tokens')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (!recentLog || recentLog.length === 0) {
      await sb.from('activity_log').insert({
        tenant_id: tenantId, category: 'commercial', title: 'Saldo baixo de tokens',
        detail: `Restam apenas ${wallet.prepaid_credits} tokens pré-pagos na carteira.`
      });
      await sb.from('popup_events').insert({
        tenant_id: tenantId, popup_code: 'low_balance', category: 'billing', title: 'Saldo Baixo',
        message: 'Seu saldo de tokens está baixo. Adquira um pacote adicional para evitar interrupções.',
        severity: 'warning', persistence: 'persistent', has_upsell: true, upsell_type: 'addon'
      });
    }
  }
}

async function handleUpdateStatus(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { postId, status, ai_instructions, scheduled_date } = payload;
  if (!postId) throw new Error('postId is required for update_status');

  // get existing to check if date changed for renaming media
  const { data: oldPost } = await sb.from('posts').select('scheduled_date, tenant_id').eq('id', postId).single();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) update.status = status;
  if (ai_instructions !== undefined) update.ai_instructions = ai_instructions;
  if (scheduled_date !== undefined) update.scheduled_date = scheduled_date;
  const { error } = await sb.from('posts').update(update).eq('id', postId);
  if (error) throw new Error(`Update error: ${error.message}`);

  // Re-rename media files if the date changed
  if (scheduled_date !== undefined && oldPost && String(oldPost.scheduled_date) !== String(scheduled_date)) {
    try {
      await renamePostMedia(sb, postId, oldPost.tenant_id, scheduled_date);
    } catch (err) {
      console.error("Auto-rename media failed:", err);
    }
  }

  return { postId, updated: update };
}

async function handleDeletePost(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { postId } = payload;
  if (!postId) throw new Error('postId is required for delete_post');

  // optionally we could delete bucket files here, but wix/supabase GC handles it usually
  await sb.from('post_media').delete().eq('post_id', postId);
  const { error } = await sb.from('posts').delete().eq('id', postId);
  if (error) throw new Error(`Delete error: ${error.message}`);
  return { postId, deleted: true };
}

// ─── Export ZIP: post CSV + all media files ──────────────────────────────────────
async function handleExportZip(sb: ReturnType<typeof createClient>, payload: PostPayload): Promise<Response> {
  const { postId } = payload;
  if (!postId) throw new Error('postId is required for export_zip');

  // 1. Fetch post
  const { data: post, error: postErr } = await sb
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();
  if (postErr || !post) throw new Error(`Post not found: ${postId}`);

  // 2. Fetch media
  const { data: mediaList } = await sb
    .from('post_media')
    .select('*')
    .eq('post_id', postId)
    .order('position');

  // 3. Build CSV content
  const csvRows: string[][] = [
    ['ID', 'Título', 'Formato', 'Status', 'Descrição', 'Hashtags', 'CTA', 'Data Agendada', 'Criado em'],
    [
      post.id,
      post.title || '',
      post.format || '',
      post.status || '',
      post.description || '',
      post.hashtags || '',
      post.cta || '',
      post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString('pt-BR') : '',
      post.created_at ? new Date(post.created_at).toLocaleDateString('pt-BR') : '',
    ],
  ];

  // Card data rows if carousel
  if (Array.isArray(post.card_data) && post.card_data.length > 0) {
    csvRows.push([]);
    csvRows.push(['---', 'CARDS', '---']);
    csvRows.push(['Posição', 'Título (text_primary)', 'Texto (text_secondary)', 'Caption', 'Header']);
    for (const card of post.card_data) {
      csvRows.push([
        String(card.position ?? ''),
        card.text_primary || card.cardTitulo || '',
        card.text_secondary || card.cardParagrafo || '',
        card.caption || '',
        card.header || '',
      ]);
    }
  }

  const csvContent = csvRows
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // 4. Start building ZIP files map
  const zipFiles: Record<string, Uint8Array> = {
    'post.csv': strToU8(csvContent),
  };

  // 5. Download each media file and add to ZIP
  const mediaEntries = mediaList || [];
  await Promise.all(
    mediaEntries.map(async (media: any, idx: number) => {
      if (!media.wix_media_url) return;
      try {
        const res = await fetch(media.wix_media_url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        // Determine extension from mime_type or URL
        const ext = media.mime_type
          ? media.mime_type.split('/')[1]?.split(';')[0] || 'bin'
          : media.wix_media_url.split('?')[0].split('.').pop() || 'bin';
        const fileName = `media/${String(idx + 1).padStart(2, '0')}_${media.id}.${ext}`;
        zipFiles[fileName] = new Uint8Array(buf);
      } catch {
        // Skip failed media downloads silently
      }
    })
  );

  // 6. Compress into ZIP
  const zipped = zipSync(zipFiles, { level: 1 });

  const zipFileName = `post-${postId.slice(0, 8)}.zip`;
  return new Response(zipped, {
    headers: {
      'Access-Control-Allow-Origin': 'https://app.cestari.studio',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName}"`,
      'Content-Length': String(zipped.byteLength),
    },
    status: 200,
  });
}

// ─── Rename Media Files Utility ───────────────────────────────────────────────
async function renamePostMedia(sb: ReturnType<typeof createClient>, postId: string, tenantId: string, scheduledDate: string | null | undefined) {
  const { data: tenant } = await sb.from('tenants').select('name').eq('id', tenantId).single();
  if (!tenant) return;

  const { data: mediaList } = await sb.from('post_media').select('*').eq('post_id', postId).order('position');
  if (!mediaList || mediaList.length === 0) return;

  let dateStr = 'SemData';
  // Use scheduled_date if provided, else fallback to picking from DB
  if (scheduledDate || scheduledDate === null) {
    if (scheduledDate) dateStr = new Date(scheduledDate).toISOString().split('T')[0];
  } else {
    const { data: p } = await sb.from('posts').select('scheduled_date, created_at').eq('id', postId).single();
    if (p?.scheduled_date) dateStr = new Date(p.scheduled_date).toISOString().split('T')[0];
    else if (p?.created_at) dateStr = new Date(p.created_at).toISOString().split('T')[0];
  }

  const tName = String(tenant.name).replace(/[^a-zA-Z0-9\s]/g, '').trim();

  for (const m of mediaList) {
    if (!m.wix_media_url || !m.wix_media_url.includes('content-media')) continue; // only rename our own supabase storage media
    const origUrl = new URL(m.wix_media_url);
    const pathParts = origUrl.pathname.split('/');
    const oldPath = pathParts.slice(pathParts.indexOf('content-media') + 1).join('/'); // get storage path
    if (!oldPath) continue;

    const ext = oldPath.split('.').pop();
    const finalName = `${tName} - ${dateStr} - ${postId.slice(0, 8)} - ${m.position}.${ext}`;
    const newPath = `${tenantId}/${postId}/${finalName}`;

    if (oldPath !== newPath) {
      const { error: moveErr } = await sb.storage.from('content-media').move(oldPath, newPath);
      if (!moveErr) {
        const { data: pubData } = sb.storage.from('content-media').getPublicUrl(newPath);
        await sb.from('post_media').update({ wix_media_url: pubData.publicUrl, file_name: finalName }).eq('id', m.id);
      }
    }
  }
}

// ─── Assign Media ─────────────────────────────────────────────────────────────
async function handleAssignMedia(sb: ReturnType<typeof createClient>, payload: any) {
  const { postId, assignments } = payload; // assignments: { tempPath: string, position: number, type: 'image' | 'video', mime_type: string, file_size: number }[]
  if (!postId || !assignments) throw new Error('postId and assignments required');

  const { data: post } = await sb.from('posts').select('*, tenants(name)').eq('id', postId).single();
  if (!post) throw new Error('Post not found');

  const tenantId = post.tenant_id;
  const tName = String(post.tenants?.name || 'Tenant').replace(/[^a-zA-Z0-9\s]/g, '').trim();

  let dateStr = 'SemData';
  if (post.scheduled_date) dateStr = new Date(post.scheduled_date).toISOString().split('T')[0];
  else if (post.created_at) dateStr = new Date(post.created_at).toISOString().split('T')[0];

  const results = [];
  // 1. Delete existing post_media rows to replace with new ones
  await sb.from('post_media').delete().eq('post_id', postId);

  // 2. Move and insert new medias
  for (const a of assignments) {
    const ext = a.tempPath.split('.').pop() || 'bin';
    const finalName = `${tName} - ${dateStr} - ${postId.slice(0, 8)} - ${a.position}.${ext}`;
    const newPath = `${tenantId}/${postId}/${finalName}`;

    const { error: moveErr } = await sb.storage.from('content-media').move(a.tempPath, newPath);
    if (moveErr) throw new Error(`Move error ${a.tempPath}: ${moveErr.message}`);

    const { data: pubData } = sb.storage.from('content-media').getPublicUrl(newPath);

    const { data: inserted, error: insErr } = await sb.from('post_media').insert({
      post_id: postId,
      position: a.position,
      type: a.type || 'image',
      wix_media_url: pubData.publicUrl,
      file_name: finalName,
      mime_type: a.mime_type,
      file_size: a.file_size,
      status: 'uploaded'
    }).select().single();

    if (insErr) throw new Error(`Insert error: ${insErr.message}`);
    results.push(inserted);
  }

  return results;
}


async function handleGetBrandDna(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId } = payload;
  if (!tenantId) throw new Error('tenantId is required for get_brand_dna');
  const { data, error } = await sb.from('brand_dna').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error(`Brand DNA fetch error: ${error.message}`);
  return data;
}

async function handleCompleteOnboarding(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId } = payload;
  if (!tenantId) throw new Error('tenantId is required');

  const { error } = await sb.from('tenant_config').update({ onboarding_completed: true }).eq('tenant_id', tenantId);
  if (error) throw new Error(`Failed to complete onboarding: ${error.message}`);
  return { success: true };
}

async function handleGenerateDnaFromBriefing(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId, briefing } = payload;
  if (!tenantId || !briefing) throw new Error('tenantId and briefing are required');

  const prompt = `Você é o genOS AI. Com base no seguinte briefing do cliente, gere um Brand DNA (Manual de Identidade Verbal e Tone of Voice).
  
  Nome da Marca: ${briefing.brandName}
  Indústria: ${briefing.industry}
  História da Marca / Propósito: ${briefing.brandStory}
  Público-Alvo: ${briefing.targetAudience}
  
  Aja de forma estratégica. Extraia os valores intrínsecos e a melhor persona de comunicação para esse mercado.
  
  RESPONDA APENAS EM JSON VÁLIDO no seguinte formato EXATO:
  {
    "voice_tone": {
      "primary": "Ex: Profissional",
      "secondary": "Ex: Acolhedor",
      "tertiary": "Ex: Autoridade"
    },
    "voice_description": "Descrição de como a marca fala, em 1 parágrafo",
    "persona_name": "Nome descritivo da persona comunicadora (o avatar textual)",
    "brand_values": ["Valor 1", "Valor 2", "Valor 3", "Valor 4"],
    "forbidden_words": ["palavra", "outra_palavra", "termo"],
    "content_rules": {
      "emoji_usage": "moderado",
      "fixed_description_footer": "💡 ${briefing.brandName}\\n[Gerado automaticamente pela IA]"
    },
    "industry": "${briefing.industry}",
    "brand_story": "Resumo otimizado e profissional da história recebida",
    "target_audience": [
      {"segment": "Público Principal", "pain_points": ["Dor 1", "Dor 2"], "motivations": ["Motivação 1"]}
    ],
    "editorial_pillars": [
      {"name": "Educação", "description": "Ensinar o público sobre a indústria.", "proportion": 40},
      {"name": "Autoridade", "description": "Casos de sucesso.", "proportion": 30},
      {"name": "Conversão", "description": "Vendas diretas.", "proportion": 30}
    ]
  }`;

  const aiResult = await callGemini(prompt);

  // Normalize AI result payload for insert/upsert
  const updatePayload = {
    voice_tone: aiResult.voice_tone,
    voice_description: aiResult.voice_description,
    persona_name: aiResult.persona_name,
    brand_values: aiResult.brand_values,
    forbidden_words: aiResult.forbidden_words,
    content_rules: aiResult.content_rules,
    industry: aiResult.industry,
    brand_story: aiResult.brand_story,
    target_audience_v2: aiResult.target_audience,
    editorial_pillars: aiResult.editorial_pillars
  };

  const { error } = await sb.from('brand_dna').update(updatePayload).eq('tenant_id', tenantId);
  if (error) {
    const { error: upsertErr } = await sb.from('brand_dna').upsert({ tenant_id: tenantId, ...updatePayload });
    if (upsertErr) throw new Error(`Failed to save Brand DNA: ${upsertErr.message}`);
  }

  // Generate default semantic map root topics based on the pillars
  try {
    const defaultTopics = (aiResult.editorial_pillars as any[]).map((p, idx) => ({
      tenant_id: tenantId,
      name: p.name,
      description: p.description,
      parent_id: null,
      level: 0,
      importance_weight: p.proportion || 1
    }));
    await sb.from('semantic_nodes').insert(defaultTopics);
  } catch (err) {
    // Ignore semantic map errors, non critical for onboarding flow
  }

  return { success: true, brand_dna: updatePayload };
}

async function handleRevise(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { postId } = payload;
  if (!postId) throw new Error('postId is required for revise action');
  const { data: post, error: postErr } = await sb.from('posts').select('*').eq('id', postId).single();
  if (postErr || !post) throw new Error(`Post not found: ${postId}`);

  const tenantId = post.tenant_id;

  // ─── BILLING PRE-CHECK ──────────────────────────────────────────────
  const { data: billCheck, error: billErr } = await sb.rpc('check_can_generate', { p_tenant_id: tenantId });
  if (billErr) throw new Error(`Billing check error: ${billErr.message}`);
  if (!billCheck?.allowed && billCheck?.reason === 'tokens_exhausted') {
    throw new Error(JSON.stringify({ isBillingError: true, ...billCheck }));
  }

  // ─── COST ESTIMATION ────────────────────────────────────────────────
  const initialMediaSlots = post.card_data?.length || 1;
  const { data: estCost } = await sb.rpc('calculate_token_cost', {
    p_tenant_id: tenantId, p_format: post.format, p_operation: 'revise', p_slide_count: initialMediaSlots, p_ai_model: 'gemini-2.0-flash'
  });
  const genCost = estCost || 1;

  await sb.from('posts').update({ ai_processing: true }).eq('id', postId);

  const { data: envelope, error: envErr } = await sb.rpc('get_agent_envelope_service', { p_tenant_id: tenantId });
  if (envErr) throw new Error(`Envelope error: ${envErr.message}`);

  const brandDna = envelope?.brand_dna || {};
  const systemPrompt = envelope?.system_prompt?.content || '';
  const complianceRules = envelope?.compliance_rules || [];

  const prompt = buildRevisePrompt(post, brandDna, systemPrompt, complianceRules);
  const aiResult = await callGemini(prompt);

  // Append fixed_description_footer if present
  let description = aiResult.description || post.description;
  const footer = brandDna.content_rules?.fixed_description_footer;
  if (footer) {
    // Only append if it's not already there to avoid duplicates on multiple revisions
    if (!description.includes(footer)) {
      description = `${description}\n\n${footer}`.trim();
    }
  }

  const updatePayload: Record<string, unknown> = {
    ai_processing: false, ai_instructions: null, status: 'pending_review', updated_at: new Date().toISOString(),
  };
  if (aiResult.title) updatePayload.title = aiResult.title;
  updatePayload.description = description;
  if (aiResult.hashtags) {
    updatePayload.hashtags = Array.isArray(aiResult.hashtags) ? aiResult.hashtags.join(' ') : aiResult.hashtags;
  }
  if (aiResult.cta) updatePayload.cta = aiResult.cta;
  if (aiResult.card_data) updatePayload.card_data = aiResult.card_data;

  const { error: updateErr } = await sb.from('posts').update(updatePayload).eq('id', postId);
  if (updateErr) throw new Error(`Update error: ${updateErr.message}`);

  const finalMediaSlots = (aiResult.card_data as any)?.length || initialMediaSlots;
  const usageTokens = (aiResult._usage as any)?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'revise', post.format, finalMediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  return { postId, action: 'revise', ...aiResult, description };
}

async function handleGenerate(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId, topic, context, targetFormat, cardCount, reelDuration, feedMediaType, ai_instructions, scheduled_date, extraHashtags, customCta } = payload;
  if (!tenantId) throw new Error('tenantId is required for generate action');
  if (!topic) throw new Error('topic is required for generate action');
  const format = targetFormat || 'feed';
  const resolvedCardCount = format === 'carrossel' || format === 'stories' ? (cardCount && cardCount >= 2 && cardCount <= 10 ? cardCount : 5) : 1;

  // ─── BILLING PRE-CHECK ──────────────────────────────────────────────
  const { data: billCheck, error: billErr } = await sb.rpc('check_can_generate', { p_tenant_id: tenantId });
  if (billErr) throw new Error(`Billing check error: ${billErr.message}`);
  // Generating a new post consumes both TOKENS and POST limits
  // ─── DATE VALIDATION ──────────
  if (scheduled_date) {
    const sDate = new Date(scheduled_date);
    const now = new Date();
    if (sDate < now) {
      throw new Error('A data de agendamento não pode ser no passado.');
    }
  }

  // ─── COST ESTIMATION ────────────────────────────────────────────────
  const { data: estCost } = await sb.rpc('calculate_token_cost', {
    p_tenant_id: tenantId, p_format: format, p_operation: 'generate', p_slide_count: resolvedCardCount, p_ai_model: 'gemini-2.0-flash'
  });
  const genCost = estCost || 1;

  const { data: envelope, error: envErr } = await sb.rpc('get_agent_envelope_service', { p_tenant_id: tenantId });
  if (envErr) throw new Error(`Envelope error: ${envErr.message}`);

  const brandDna = envelope?.brand_dna || {};
  const systemPrompt = envelope?.system_prompt?.content || '';
  const complianceRules = envelope?.compliance_rules || [];

  const promptArgs = { topic, context, format, cardCount: resolvedCardCount, reelDuration, feedMediaType, aiInstructions: ai_instructions, extraHashtags, customCta };
  const prompt = buildGeneratePrompt(promptArgs, brandDna, systemPrompt, complianceRules);
  const aiResult = await callGemini(prompt);
  const mediaSlots = format === 'carrossel' || format === 'stories' ? (aiResult.card_data?.length || resolvedCardCount) : 1;

  // Append fixed_description_footer if present
  let description = aiResult.description || '';
  const footer = (brandDna.content_rules as any)?.fixed_description_footer;
  if (footer && (description as string).includes(footer) === false) {
    description = `${description}\n\n${footer}`.trim();
  }

  // ─── DECISION FUSION LAYER (DFL) ────────────────────────────────────
  // Calls the external Quantum Heuristics Engine if configured.
  const qheUrl = Deno.env.get('QHE_API_URL');
  let qheScore = null;

  if (qheUrl && aiResult.audit) {
    const auditObj = aiResult.audit as any;
    try {
      const qheRes = await fetch(`${qheUrl}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          post_id: 'pending',
          features: {
            brand_alignment_score: (auditObj.brand_voice_score || 80) / 100,
            structural_integrity: (auditObj.char_limits_ok ? 1.0 : 0.5),
            emotion_intensity: 0.8, // placeholder metric
            clarity_score: (auditObj.overall_score || 85) / 100
          }
        })
      });
      if (qheRes.ok) {
        const qData = await qheRes.json();
        qheScore = qData.quantum_engagement_score;
        auditObj.quantum_confidence = qData.confidence;
      }
    } catch (e) {
      console.warn("QHE API unavailable, falling back to pure LLM score.", e);
    }
  }

  (aiResult.audit as any).final_engagement_score = qheScore !== null ? qheScore : ((aiResult.audit as any).overall_score || 80);

  const { data: newPost, error: insertErr } = await sb.from('posts').insert({
    tenant_id: tenantId, format, status: 'pending_review',
    title: aiResult.title || topic, description: description,
    hashtags: Array.isArray(aiResult.hashtags) ? aiResult.hashtags.join(' ') : (aiResult.hashtags || ''),
    cta: aiResult.cta || '',
    card_data: aiResult.card_data || [], media_slots: mediaSlots, ai_processing: false,
    scheduled_date: scheduled_date || null,
    ai_audit: aiResult.audit || {},
  }).select().single();
  if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

  const usageTokens = (aiResult._usage as any)?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'generate', format, mediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  // Re-fetch usage to compose return payload cost object accurately
  const { data: usageData } = await sb.from('usage').select('tokens_used, tokens_limit, posts_used, posts_limit').eq('tenant_id', tenantId).maybeSingle();
  const { data: walletData } = await sb.from('credit_wallets').select('prepaid_credits').eq('tenant_id', tenantId).maybeSingle();

  return {
    success: true,
    post: newPost,
    audit: aiResult.audit || {},
    cost: {
      tokens_consumed: genCost,
      new_balance: walletData?.prepaid_credits || 0,
      posts_used: usageData?.posts_used || 1,
      posts_limit: usageData?.posts_limit || 24
    }
  };
}

async function handleFormat(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { postId, targetFormat } = payload;
  if (!postId) throw new Error('postId is required');
  if (!targetFormat) throw new Error('targetFormat is required');
  const { data: post, error: postErr } = await sb.from('posts').select('*').eq('id', postId).single();
  if (postErr || !post) throw new Error(`Post not found: ${postId}`);

  const tenantId = post.tenant_id;

  // ─── BILLING PRE-CHECK ──────────────────────────────────────────────
  const { data: billCheck, error: billErr } = await sb.rpc('check_can_generate', { p_tenant_id: tenantId });
  if (billErr) throw new Error(`Billing check error: ${billErr.message}`);
  if (!billCheck?.allowed && billCheck?.reason === 'tokens_exhausted') {
    throw new Error(JSON.stringify({ isBillingError: true, ...billCheck }));
  }

  // ─── COST ESTIMATION ────────────────────────────────────────────────
  const initialMediaSlots = targetFormat === 'carrossel' ? 5 : 1;
  const { data: estCost } = await sb.rpc('calculate_token_cost', {
    p_tenant_id: tenantId, p_format: targetFormat, p_operation: 'format', p_slide_count: initialMediaSlots, p_ai_model: 'gemini-2.0-flash'
  });
  const genCost = estCost || 1;

  await sb.from('posts').update({ ai_processing: true }).eq('id', postId);

  const { data: envelope } = await sb.rpc('get_agent_envelope_service', { p_tenant_id: tenantId });
  const brandDna = envelope?.brand_dna || {};
  const prompt = buildFormatPrompt(post, targetFormat, brandDna);
  const aiResult = await callGemini(prompt);
  const mediaSlots = targetFormat === 'carrossel' ? (aiResult.card_data?.length || 5) : 1;

  await sb.from('posts').update({
    format: targetFormat, card_data: aiResult.card_data || post.card_data,
    description: aiResult.description || post.description, media_slots: mediaSlots,
    ai_processing: false, updated_at: new Date().toISOString(),
  }).eq('id', postId);

  const usageTokens = (aiResult._usage as any)?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'format', targetFormat, mediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  return { postId, action: 'format', targetFormat, ...aiResult };
}

function getNormalizedLimits(brandDna: Record<string, any>, format: string) {
  const cl = brandDna.char_limits || {};
  const isCarousel = format === 'carrossel';
  const isReel = format === 'reels';

  return {
    description: (isReel ? cl.reels_caption : isCarousel ? cl.carousel_caption : cl.static_caption) || 2200,
    title: (isReel ? cl.reels_title : isCarousel ? cl.carousel_card_title : cl.static_title) || 60,
    paragraph: cl.static_body || 280,
    card_title: cl.carousel_card_title || 60,
    card_text: cl.carousel_card_text || 150,
    reel_overlay: cl.reels_overlay || 40
  };
}

function buildRevisePrompt(post: Record<string, any>, brandDna: Record<string, any>, systemPrompt: string, complianceRules: any[]): string {
  const hs = brandDna.hashtag_strategy || {};
  const limits = getNormalizedLimits(brandDna, post.format);

  return `${systemPrompt ? `SYSTEM PROMPT DO TENANT:\n${systemPrompt}\n` : ''}
Voce e o genOS Content Factory AI. Revise o post abaixo seguindo RIGOROSAMENTE o Brand DNA do cliente.

INDÚSTRIA: ${brandDna.industry || 'Não especificada'}
BRAND STORY: ${brandDna.brand_story || 'Não especificada'}

LIMITES DE CARACTERES:
- Legenda/Descricao: ${limits.description}
- Título Estático/Card: ${limits.title}
- Parágrafo Estático: ${limits.paragraph}
- Texto do Card (Carrossel): ${limits.card_text}
- Título Reel: ${limits.title}

HASHTAGS:
- Fixas (obrigatorias): ${(hs.fixed_hashtags || []).join(' ')}
- Maximo total: ${hs.max_total || 30}

Brand DNA: ${JSON.stringify(brandDna)}
Compliance: ${complianceRules.length > 0 ? JSON.stringify(complianceRules) : 'Nenhuma regra adicional.'}
POST ATUAL: Formato: ${post.format} | Titulo: ${post.title} | Descricao: ${post.description || ''} | Hashtags: ${post.hashtags || ''} | CTA: ${post.cta || ''} | Cards: ${JSON.stringify(post.card_data || [])}
INSTRUCOES DO CLIENTE: ${post.ai_instructions || 'Sem instrucoes especificas.'}
RESPONDA APENAS em JSON valido: {"title":"...","description":"...","hashtags":["#tag1", "#tag2"],"cta":"...","card_data":[{"text_primary":"...","text_secondary":"..."}]}`;
}

function buildGeneratePrompt(args: any, brandDna: Record<string, unknown>, systemPrompt: string, complianceRules: unknown[]): string {
  const { topic, context, format, cardCount, reelDuration, aiInstructions, extraHashtags, customCta } = args;
  const hs = brandDna.hashtag_strategy as any || {};
  const vt = brandDna.voice_tone as any || {};
  const tone = [vt.primary, vt.secondary, vt.tertiary].filter(Boolean).join(', ') || 'Profissional e Engajador';
  const pillars = ((brandDna.editorial_pillars as any[]) || []).map((p: any) => `${p.name}: ${p.description}`).join(' | ');
  const limits = getNormalizedLimits(brandDna, format);

  let formatRules = `FORMATO DO POST: ${format}`;
  if (format === 'carrossel') formatRules += `\nGerar ${cardCount} cards com título e texto para cada.`;
  if (format === 'reels') formatRules += `\nDuração estimada: ${reelDuration || 30}s. Gerar script/roteiro dividido nos cards.`;
  if (format === 'stories') formatRules += `\nGerar ${cardCount} frames textuais isolados para cada story.`;

  const audience = (brandDna.target_audience || []).map((a: any) => a.segment || a).join(', ');

  return `${systemPrompt ? `SYSTEM PROMPT DO TENANT:\n${systemPrompt}\n` : ''}
Voce e o Helian v1.0, assistente de criação de conteúdo da genOS.
Gere um NOVO post de social media COMPLETO seguindo RIGOROSAMENTE o Brand DNA.

BRAND DNA DO CLIENTE:
- Indústria: ${brandDna.industry || 'Geral'}
- Brand Story: ${brandDna.brand_story || ''}
- Persona: ${brandDna.persona_name || 'Personalidade da Marca'}
- Tom de Voz: ${tone}
- Descrição da Voz: ${brandDna.voice_description || ''}
- Público-Alvo: ${audience || (brandDna.audience_profile as any)?.demographic || 'Geral'}
- Valores: ${(brandDna.brand_values || []).join(', ')}
- Palavras Proibidas: ${(brandDna.forbidden_words || []).join(', ')}
- Regras de Conteúdo: ${brandDna.content_rules ? JSON.stringify(brandDna.content_rules) : 'Nenhuma específica'}
- Pilares Editoriais: ${pillars || 'Geral'}
- Notas da Marca: ${brandDna.generation_notes || ''}

LIMITES DE CARACTERES MÁXIMOS DECLARADOS:
- Legenda/Descricao: ${limits.description} chars
- Título Estático: ${limits.title} chars
- Parágrafo Estático: ${limits.paragraph} chars
- Título Carrossel: ${limits.card_title} chars
- Texto do Card Carrossel: ${limits.card_text} chars
- Título Reel: ${limits.title} chars

HASHTAGS:
- Fixas (MANDATÓRIO incluir ao gerar): ${JSON.stringify((hs.fixed_hashtags as string[]) || [])}
- Máximo total: ${hs.max_total || 5}
- Gerar restantes: ${hs.generate_remaining ? 'Sim' : 'Não'}

ASSINATURA FIXA DE MARCA (FOOTER):
Ao final de TODA descrição, SE houver, SEMPRE reserve espaço para assinar:
${(brandDna.content_rules as any)?.fixed_description_footer || '(nenhuma assinatura configurada)'}

${formatRules}

TEMA PRINCIPAL: ${topic}
CONTEXTO ADICIONAL: ${context || '(nenhum explícito)'}

INSTRUÇÕES EXTRAS DO OPERADOR:
${aiInstructions || '(nenhuma)'}

HASHTAGS EXTRAS (OPERADOR):
${extraHashtags || '(nenhuma)'}

CTA PERSONALIZADO SOLICITADO:
${customCta || '(gerar CTA engajador sobre o tema considerando a voz da marca)'}

Compliance: ${complianceRules.length > 0 ? JSON.stringify(complianceRules) : 'Nenhuma regra adicional.'}

Você DEVE responder APENAS E EXCLUSIVAMENTE em um JSON válido com o seguinte schema estrito:
{
  "title": "string (Tirada principal curta)",
  "description": "string (A legenda formatada para a bio, incluindo emojis, chamadas para ação finais, e qualquer rodapé ou hashtags obrigatórias embutidas)",
  "hashtags": "string (Tags geradas e fixas em uma linha. Ex: #tag1 #tag2)",
  "cta": "string (o call-to-action final usado)",
  "card_data": [
     { "position": 1, "text_primary": "string (Título do slide/card)", "text_secondary": "string (Texto de apoio/parágrafo)", "caption": "string (Opcional - instrução visual)" }
  ],
  "ai_instructions": "string (Resumo curtinho sobre qual viés/foco você usou baseando-se no DNA interpretado)",
  "audit": {
    "brand_voice_score": number (de 0 a 100 qualificando o quão fiel você foi ao DNA),
    "char_limits_ok": boolean,
    "fixed_hashtags_included": boolean,
    "fixed_footer_included": boolean,
    "overall_score": number (0 a 100),
    "notes": ["string (Opcional - pontos críticos de adaptação feitos ou regras ignoradas por impossibilidade tática)"]
  }
}`;
}

function buildFormatPrompt(post: Record<string, any>, targetFormat: string, brandDna: Record<string, any>): string {
  const limits = getNormalizedLimits(brandDna, targetFormat);
  return `Voce e o genOS Content Factory AI. Converta o post para ${targetFormat}.

LIMITES DE CARACTERES:
- Legenda/Descricao: ${limits.description}
- Título Estático/Card: ${limits.title}
- Parágrafo Estático: ${limits.paragraph}
- Texto do Card: ${limits.card_text}
- Título Reel: ${limits.title}

Brand DNA (resumo): ${JSON.stringify({ voice_tone: brandDna.voice_tone, forbidden_words: brandDna.forbidden_words, language: brandDna.language })}
POST ORIGINAL: Formato: ${post.format} | Titulo: ${post.title} | Descricao: ${post.description || ''} | Cards: ${JSON.stringify(post.card_data || [])}
RESPONDA em JSON: {"description":"...","card_data":[{"position":1,"text_primary":"...","text_secondary":"..."}]}`;
}

async function callGemini(prompt: string, retries = 3): Promise<Record<string, unknown>> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured in Supabase Secrets');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.7, maxOutputTokens: 4096 },
      }),
    });

    if (response.status === 429 && attempt < retries) {
      const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.warn(`Gemini 429 — retry ${attempt + 1}/${retries} in ${waitMs}ms`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) throw new Error(`Gemini API error (${response.status}): ${await response.text()}`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(text);
    const usage = data?.usageMetadata || { totalTokenCount: 0 };
    parsed._usage = usage;
    return parsed;
  }

  throw new Error('Gemini API error: All retry attempts exhausted (RESOURCE_EXHAUSTED).');
}
