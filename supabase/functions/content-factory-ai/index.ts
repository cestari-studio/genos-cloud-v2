import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* content-factory-ai v8 — genOS Cloud Platform
   Motor de IA do Content Factory.
   Acoes: revise, generate, format, update_status, delete_post, get_brand_dna */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostPayload {
  postId?: string;
  tenantId?: string;
  action: string;
  topic?: string;
  targetFormat?: 'feed' | 'carrossel' | 'stories' | 'reels';
  cardCount?: number;
  status?: string;
  ai_instructions?: string;
  scheduled_date?: string | null;
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
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) update.status = status;
  if (ai_instructions !== undefined) update.ai_instructions = ai_instructions;
  if (scheduled_date !== undefined) update.scheduled_date = scheduled_date;
  const { error } = await sb.from('posts').update(update).eq('id', postId);
  if (error) throw new Error(`Update error: ${error.message}`);
  return { postId, updated: update };
}

async function handleDeletePost(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { postId } = payload;
  if (!postId) throw new Error('postId is required for delete_post');
  await sb.from('post_media').delete().eq('post_id', postId);
  const { error } = await sb.from('posts').delete().eq('id', postId);
  if (error) throw new Error(`Delete error: ${error.message}`);
  return { postId, deleted: true };
}

async function handleGetBrandDna(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId } = payload;
  if (!tenantId) throw new Error('tenantId is required for get_brand_dna');
  const { data, error } = await sb.from('brand_dna').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error(`Brand DNA fetch error: ${error.message}`);
  return data;
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

  const finalMediaSlots = aiResult.card_data?.length || initialMediaSlots;
  const usageTokens = aiResult._usage?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'revise', post.format, finalMediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  return { postId, action: 'revise', ...aiResult, description };
}

async function handleGenerate(sb: ReturnType<typeof createClient>, payload: PostPayload) {
  const { tenantId, topic, targetFormat, cardCount } = payload;
  if (!tenantId) throw new Error('tenantId is required for generate action');
  if (!topic) throw new Error('topic is required for generate action');
  const format = targetFormat || 'feed';
  const resolvedCardCount = format === 'carrossel' ? (cardCount && cardCount >= 2 && cardCount <= 10 ? cardCount : 5) : 1;

  // ─── BILLING PRE-CHECK ──────────────────────────────────────────────
  const { data: billCheck, error: billErr } = await sb.rpc('check_can_generate', { p_tenant_id: tenantId });
  if (billErr) throw new Error(`Billing check error: ${billErr.message}`);
  // Generating a new post consumes both TOKENS and POST limits
  if (!billCheck?.allowed) {
    throw new Error(JSON.stringify({ isBillingError: true, ...billCheck }));
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

  const prompt = buildGeneratePrompt(topic, format, resolvedCardCount, brandDna, systemPrompt, complianceRules);
  const aiResult = await callGemini(prompt);
  const mediaSlots = format === 'carrossel' ? (aiResult.card_data?.length || resolvedCardCount) : 1;

  // Append fixed_description_footer if present
  let description = aiResult.description || '';
  const footer = brandDna.content_rules?.fixed_description_footer;
  if (footer) {
    description = `${description}\n\n${footer}`.trim();
  }

  const { data: newPost, error: insertErr } = await sb.from('posts').insert({
    tenant_id: tenantId, format, status: 'pending_review',
    title: aiResult.title || topic, description: description,
    hashtags: Array.isArray(aiResult.hashtags) ? aiResult.hashtags.join(' ') : (aiResult.hashtags || ''),
    cta: aiResult.cta || '',
    card_data: aiResult.card_data || [], media_slots: mediaSlots, ai_processing: false,
  }).select().single();
  if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

  const usageTokens = aiResult._usage?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'generate', format, mediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  return { postId: newPost.id, action: 'generate', ...aiResult, description };
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

  const usageTokens = aiResult._usage?.totalTokenCount || 0;
  await trackUsage(sb, tenantId, 'format', targetFormat, mediaSlots, 'gemini-2.0-flash', usageTokens, genCost);

  return { postId, action: 'format', targetFormat, ...aiResult };
}

function buildRevisePrompt(post: Record<string, unknown>, brandDna: Record<string, unknown>, systemPrompt: string, complianceRules: unknown[]): string {
  const charLimits = brandDna.char_limits || {};
  const hs = brandDna.hashtag_strategy || {};

  return `${systemPrompt ? `SYSTEM PROMPT DO TENANT:\n${systemPrompt}\n` : ''}
Voce e o genOS Content Factory AI. Revise o post abaixo seguindo RIGOROSAMENTE o Brand DNA do cliente.

LIMITES DE CARACTERES:
- Legenda/Descricao: ${charLimits.description || 2200}
- Título Estático: ${charLimits.static_title || 60}
- Parágrafo Estático: ${charLimits.static_paragraph || 200}
- Título Carrossel: ${charLimits.carousel_title || 60}
- Texto do Card: ${charLimits.carousel_card || 150}
- Título Reel: ${charLimits.reel_title || 40}

HASHTAGS:
- Fixas (obrigatorias): ${(hs.fixed_hashtags || []).join(' ')}
- Maximo total: ${hs.max_total || 30}

Brand DNA: ${JSON.stringify(brandDna)}
Compliance: ${complianceRules.length > 0 ? JSON.stringify(complianceRules) : 'Nenhuma regra adicional.'}
POST ATUAL: Formato: ${post.format} | Titulo: ${post.title} | Descricao: ${post.description || ''} | Hashtags: ${post.hashtags || ''} | CTA: ${post.cta || ''} | Cards: ${JSON.stringify(post.card_data || [])}
INSTRUCOES DO CLIENTE: ${post.ai_instructions || 'Sem instrucoes especificas.'}
RESPONDA APENAS em JSON valido: {"title":"...","description":"...","hashtags":["#tag1", "#tag2"],"cta":"...","card_data":[{"cardTitulo":"...","cardParagrafo":"..."}]}`;
}

function buildGeneratePrompt(topic: string, format: string, cardCount: number, brandDna: Record<string, unknown>, systemPrompt: string, complianceRules: unknown[]): string {
  const charLimits = brandDna.char_limits || {};
  const hs = brandDna.hashtag_strategy || {};
  const pillars = (brandDna.editorial_pillars || []).map((p: any) => `${p.name}: ${p.description}`).join(' | ');

  return `${systemPrompt ? `SYSTEM PROMPT DO TENANT:\n${systemPrompt}\n` : ''}
Voce e o genOS Content Factory AI. Gere um NOVO post de social media COMPLETO seguindo o Brand DNA.

LIMITES DE CARACTERES:
- Legenda/Descricao: ${charLimits.description || 2200}
- Título Estático: ${charLimits.static_title || 60}
- Parágrafo Estático: ${charLimits.static_paragraph || 200}
- Título Carrossel: ${charLimits.carousel_title || 60}
- Texto do Card: ${charLimits.carousel_card || 150}
- Título Reel: ${charLimits.reel_title || 40}

HASHTAGS:
- Fixas (incluir sempre): ${(hs.fixed_hashtags || []).join(' ')}
- Maximo total: ${hs.max_total || 30}
${hs.generate_remaining ? '- Gere o restante ate o limite baseado no tema.' : ''}

PILARES EDITORIAIS: ${pillars || 'Geral'}

Brand DNA: ${JSON.stringify(brandDna)}
Compliance: ${complianceRules.length > 0 ? JSON.stringify(complianceRules) : 'Nenhuma regra adicional.'}
Tema: ${topic} | Formato: ${format} | Cards: ${cardCount}
RESPONDA em JSON: {"title":"...","description":"...","hashtags":["#tag1", "#tag2"],"cta":"...","card_data":[{"position":1,"text_primary":"...","text_secondary":"..."}]}
Gere EXATAMENTE ${cardCount} card(s).`;
}

function buildFormatPrompt(post: Record<string, unknown>, targetFormat: string, brandDna: Record<string, unknown>): string {
  const charLimits = brandDna.char_limits || {};
  return `Voce e o genOS Content Factory AI. Converta o post para ${targetFormat}.

LIMITES DE CARACTERES:
- Legenda/Descricao: ${charLimits.description || 2200}
- Título Estático: ${charLimits.static_title || 60}
- Parágrafo Estático: ${charLimits.static_paragraph || 200}
- Título Carrossel: ${charLimits.carousel_title || 60}
- Texto do Card: ${charLimits.carousel_card || 150}
- Título Reel: ${charLimits.reel_title || 40}

Brand DNA (resumo): ${JSON.stringify({ voice_tone: brandDna.voice_tone, forbidden_words: brandDna.forbidden_words, language: brandDna.language })}
POST ORIGINAL: Formato: ${post.format} | Titulo: ${post.title} | Descricao: ${post.description || ''} | Cards: ${JSON.stringify(post.card_data || [])}
RESPONDA em JSON: {"description":"...","card_data":[{"position":1,"text_primary":"...","text_secondary":"..."}]}`;
}

async function callGemini(prompt: string): Promise<Record<string, unknown>> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini API error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(text);
  const usage = data?.usageMetadata || { totalTokenCount: 0 };
  parsed._usage = usage;
  return parsed;
}
