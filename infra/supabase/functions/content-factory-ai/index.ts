import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { anthropic } from 'https://esm.sh/@ai-sdk/anthropic@0.0.39'
import { google } from 'https://esm.sh/@ai-sdk/google@0.0.52'
import { generateObject } from 'https://esm.sh/ai@3.3.37'
import { z } from 'https://esm.sh/zod@3.23.8'
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2"
import { stripeMetering } from '../_shared/finops.ts'
import { Langfuse } from 'https://esm.sh/langfuse'

// genOS™ v5.0.0 — Enforced Edge Runtime
export const runtime = 'edge';

function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'https://app.cestari.studio',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  const cors = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    return { ...cors, 'Access-Control-Allow-Origin': origin };
  }
  return { ...cors, 'Access-Control-Allow-Origin': 'https://app.cestari.studio' };
}

serve(async (req: any) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Extract Tenant ID from JWT (Zero-Leak Handshake)
    const { data: { user } } = await supabaseClient.auth.getUser()
    const tenantId = user?.app_metadata?.tenant_id
    if (!tenantId) throw new Error('Tenant context missing in JWT')

    const payload = await req.json()
    const { action, postId } = payload

    // 2. JIT Agent Envelope™ Injection
    const { data: envelope, error: envError } = await supabaseAdmin.rpc('build_agent_envelope', {
      p_tenant_id: tenantId
    })
    if (envError) throw envError

    // Zero-Cross Rule: Injeção da Barreira de Contexto (Silo Isolado)
    envelope.context_barrier = `⚠️ CRITICAL: Você está operando em um silo de dados isolado para o locatário [${tenantId}]. É terminantemente proibido acessar, referenciar ou vazar informações de outros namespaces, clientes ou marcas. Opere exclusivamente com o Brand DNA fornecido.`;

    // 3. Roteamento Modular (Helian Router) - Permission Gate
    let featureSlug = 'content-factory'; // Default feature core
    if (action === 'get-qhe-score') featureSlug = 'quantum-pulse';
    else if (action === 'chat') featureSlug = 'watson-analytics';
    else if (action === 'generate_dna_from_briefing' || action === 'vectorize_dna') featureSlug = 'brand-dna';

    // Helian Router Check
    const hasAccess = await canAccessFeature(supabaseAdmin, tenantId, featureSlug);
    if (!hasAccess) {
      throw new Error(`[HELIAN ROUTER] Acesso negado (Silo Locked): Feature '${featureSlug}' não habilitada pelo Master ou Agência na hierarquia de permissões.`);
    }

    // 4. Action Dispatcher
    let result;
    switch (action) {
      case 'generate':
      case 'revise':
        result = await handleAIAction(supabaseAdmin, tenantId, envelope, payload);
        break;
      case 'generate_matrix':
        result = await handleMatrixGeneration(supabaseAdmin, tenantId, envelope, payload);
        break;
      case 'generate_dna_from_briefing':
        result = await handleGenerateDNA(supabaseAdmin, tenantId, payload);
        break;
      case 'complete_onboarding':
        await handleCompleteOnboarding(supabaseAdmin, tenantId);
        result = { success: true };
        break;
      case 'generate_sla':
        result = await handleGenerateSLA(supabaseAdmin, tenantId, payload);
        break;
      case 'vectorize_dna':
        result = await handleVectorizeDNA(supabaseAdmin, tenantId, payload);
        break;
      case 'export_zip':
        return await handleExportZip(supabaseAdmin, payload);
      case 'delete_post':
        await supabaseAdmin.from('posts').delete().eq('id', postId);
        result = { success: true };
        break;
      case 'check-projects':
        result = await handleCheckProjects(supabaseAdmin, tenantId);
        break;
      case 'get-geo-intel':
        result = await handleGetGeoIntel(supabaseAdmin, tenantId);
        break;
      case 'chat':
        result = await handleChatCopilot(supabaseAdmin, tenantId, payload);
        break;
      case 'get-qhe-score':
        result = await handleGetQHEScore(supabaseAdmin, tenantId, payload);
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Content Factory Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    });
  }
})

async function handleCheckProjects(sb: any, tenantId: string) {
  const { count, error } = await sb
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { count: count || 0 };
}

async function handleCompleteOnboarding(sb: any, tenantId: string) {
  // 1. Mark as completed
  await sb.from('tenant_config').update({ onboarding_completed: true }).eq('tenant_id', tenantId);

  // 2. Provision Initial Project
  const { data: tenant } = await sb.from('tenants').select('name').eq('id', tenantId).single();
  await sb.from('projects').insert({
    tenant_id: tenantId,
    name: `Projeto Inicial: ${tenant?.name || 'Marca'} Strategy`,
    status: 'active',
    metadata: { source: 'onboarding_automation', type: 'content_pack_v5' }
  });

  // 3. Trigger DNA Vectorization
  const { data: dna } = await sb.from('brand_dna').select('*').eq('tenant_id', tenantId).single();
  if (dna) {
    await handleVectorizeDNA(sb, tenantId, { dna });
  }
}

async function handleAIAction(sb: any, tenantId: string, envelope: any, payload: any) {
  const { action, postId, topic, feedback, context, targetFormat } = payload;

  // Model Defs
  const primaryModel = anthropic('claude-3-5-sonnet-20240620')
  const fallbackModel = google('gemini-1.5-pro')

  const schema = z.object({
    title: z.string(),
    description: z.string(),
    quality_score: z.number(),
    heuristics: z.string(),
    hashtags: z.array(z.string()),
    cta: z.string().optional()
  })

  // Langfuse Tracing
  const langfuse = new Langfuse({
    publicKey: Deno.env.get('LANGFUSE_PUBLIC_KEY'),
    secretKey: Deno.env.get('LANGFUSE_SECRET_KEY'),
    baseUrl: Deno.env.get('LANGFUSE_BASE_URL') || 'https://cloud.langfuse.com'
  });

  const trace = langfuse.trace({
    name: `content-factory:${action}`,
    userId: tenantId,
    metadata: { tenantId, action, topic, model: 'claude-3-5-sonnet' }
  });

  const systemPrompt = `
<role>Você é o genOS Creative Master, motor Helian™ v5.0.0.</role>
${envelope.context_barrier}
<brand_dna>${JSON.stringify(envelope.brand_dna)}</brand_dna>
<compliance>${JSON.stringify(envelope.compliance_rules)}</compliance>
<context>
Ação: ${action}
Tema: ${topic || 'Regeneração'}
Contexto: ${context || ''}
Instruções: ${feedback || ''}
</context>
<rules>Mantenha o tom de voz e responda estritamente em JSON.</rules>
`

  let finalResult;
  let usage;
  let modelUsed = 'anthropic:claude-3-5-sonnet';

  try {
    const res = await generateObject({
      model: primaryModel,
      schema,
      system: systemPrompt,
      prompt: `Gere um post sobre ${topic || 'Contexto atual'}`,
      experimental_telemetry: { isEnabled: true, functionId: 'content-factory-helian' }
    })
    finalResult = res.object
    usage = res.usage
    trace.update({ output: finalResult, metadata: { ...trace.metadata, usage } });
  } catch (e) {
    console.warn('Fallback to Gemini...', e)
    modelUsed = 'google:gemini-1.5-pro'
    const res = await generateObject({
      model: fallbackModel,
      schema,
      system: systemPrompt,
      prompt: `Gere um post sobre ${topic || 'Contexto atual'}`,
      experimental_telemetry: { isEnabled: true, functionId: 'content-factory-helian' }
    })
    finalResult = res.object
    usage = res.usage
    trace.update({ output: finalResult, metadata: { ...trace.metadata, usage, fallback: true } });
  } finally {
    await langfuse.shutdownAsync();
  }

  // FinOps Metering
  if (usage) {
    const { data: t } = await sb.from('tenants').select('stripe_customer_id').eq('id', tenantId).single();
    await stripeMetering.logUsage(tenantId, usage.totalTokens, t?.stripe_customer_id);
  }

  // Save/Update
  const postData = {
    tenant_id: tenantId,
    project_id: payload.projectId || null,
    title: finalResult.title,
    description: finalResult.description,
    status: 'Approved',
    ai_processing: false,
    updated_at: new Date().toISOString(),
    // Auto-vectorization for genOS v5.0.0
    embedding: Array(1536).fill(0).map(() => Math.random()) // Simulation - real embedding would call OpenAI
  }

  if (postId && action === 'revise') {
    await sb.from('posts').update(postData).eq('id', postId);
  } else {
    const { data } = await sb.from('posts').insert(postData).select().single();
    return { ...finalResult, id: data.id, ai_audit: { model_used: modelUsed } };
  }

  return { ...finalResult, ai_audit: { model_used: modelUsed } };
}

async function handleGetGeoIntel(sb: any, tenantId: string) {
  // 1. Get Visibility Score
  const { data: scoreData, error: scoreError } = await sb.rpc('calculate_visibility_score', { p_tenant_id: tenantId });
  if (scoreError) throw scoreError;

  // 2. Mock Cluster Data for SemanticRadar (to be fleshed out with real vector data)
  const clusters = [
    { name: 'Branding', value: 85, color: '#4589ff' },
    { name: 'Engajamento', value: 72, color: '#08bdba' },
    { name: 'Conversão', value: 64, color: '#be95ff' },
    { name: 'Inovação', value: 91, color: '#ff7eb6' }
  ];

  return {
    visibility_score: scoreData || 0,
    clusters,
    last_update: new Date().toISOString()
  };
}

async function handleChatCopilot(sb: any, tenantId: string, payload: any) {
  const { message } = payload;
  const model = anthropic('claude-3-5-sonnet-20240620');

  // 1. RAG: Retrieve Context from Brand DNA and Posts
  const { data: dna } = await sb.from('brand_dna').select('*').eq('tenant_id', tenantId).single();

  // 2. Generate Response with Context
  const systemPrompt = `
Você é o genOS Chat Copilot. Ajude o usuário a gerenciar sua marca e conteúdo.
Seu conhecimento é baseado no Brand DNA da marca: ${JSON.stringify(dna)}
Mantenha um tom profissional, técnico e proativo.
`
  const { text } = await generateObject({
    model,
    schema: z.object({ response: z.string() }),
    system: systemPrompt,
    prompt: message
  });

  return { response: text.response };
}

async function handleGetQHEScore(sb: any, tenantId: string, payload: any) {
  const { content } = payload;

  // genOS™ v5.0.0 — Quantum Simulation
  // QHE_API_URL is configured in environment for real IBM Quantum integration.
  const qheUrl = Deno.env.get('QHE_API_URL');

  if (qheUrl) {
    try {
      const res = await fetch(`${qheUrl}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tenant_id: tenantId })
      });
      return await res.json();
    } catch (e) {
      console.warn('QHE Service Unavailable, using simulation.', e);
    }
  }

  // Simulation fallback
  const simulatedScore = 0.85 + (Math.random() * 0.1);
  return { qhe_score: simulatedScore, status: 'simulated', algorithm: 'Constructive Interference v2.2' };
}

/**
 * Resolvedor de Permissão genOS™ v5.0.0 (Helian Router)
 * Verifica a cadeia: Master -> Agency -> Tenant e resolve dependências.
 */
async function canAccessFeature(sb: any, tenantId: string, featureSlug: string): Promise<boolean> {
  const { data: feature, error } = await sb
    .from('genos_features_catalog')
    .select('*, parent:parent_feature_id(*)')
    .eq('slug', featureSlug)
    .maybeSingle();

  if (error || !feature) {
    // Fallback permissivo temporário caso o catálogo não esteja provisionado
    console.warn(`[HELIAN ROUTER] Feature '${featureSlug}' não encontrada no catálogo. Retornando true (Fallback pre-provisioning).`);
    return true;
  }

  // 1. Verificação de Dependência Core
  // Se o recurso for uma dependência (ex: brand-dna requer content-factory), libera se o PAI estiver ativo.
  if (feature.is_dependency_only && feature.parent) {
    return canAccessFeature(sb, tenantId, feature.parent.slug);
  }

  // 2. Verificação de Hierarquia Real via RPC
  const { data: hasAccess, error: rpcError } = await sb.rpc('check_feature_access', {
    p_tenant_id: tenantId,
    p_feature_slug: featureSlug
  });

  if (rpcError) {
    console.error(`[HELIAN ROUTER] RPC Error verificando feature ${featureSlug}:`, rpcError);
    return false;
  }

  return !!hasAccess;
}

async function handleGenerateDNA(sb: any, tenantId: string, payload: any) {
  const { briefing } = payload;
  const model = anthropic('claude-3-5-sonnet-20240620');

  const schema = z.object({
    persona_name: z.string(),
    voice_description: z.string(),
    voice_tone: z.object({ primary: z.string(), secondary: z.string(), register: z.string() }),
    personality_traits: z.object({ innovation: z.number(), boldness: z.number() }),
    brand_values: z.object({ core: z.string(), mission: z.string() }),
    editorial_pillars: z.array(z.string()),
    hashtag_strategy: z.object({ strategy: z.string(), fixed_hashtags: z.array(z.string()) })
  });

  const { object: dna } = await generateObject({
    model,
    schema,
    system: `Você é o genOS Brand DNA Architect. Transforme o briefing do cliente em um Brand DNA estruturado v5.0.0. As métricas de personalidade vão de 0 a 100 (innovation = Inovação vs Tradição, boldness = Ousadia vs Pragmatismo). Valores core (core) como string separada por vírgula.`,
    prompt: `Cliente: ${briefing.brandName}. Indústria: ${briefing.industry}. História: ${briefing.brandStory}. Público: ${briefing.targetAudience}.`
  });

  const { data, error } = await sb.from('brand_dna').upsert({
    tenant_id: tenantId,
    ...dna,
    updated_at: new Date().toISOString()
  }).select().single();

  if (error) throw error;
  return data;
}

async function handleVectorizeDNA(sb: any, tenantId: string, payload: any) {
  const { dna } = payload;
  const content = `Persona: ${dna.persona_name}. Voice: ${dna.voice_description}. Tone: ${JSON.stringify(dna.voice_tone)}. Traits: Innovation(${dna.personality_traits?.innovation}), Boldness(${dna.personality_traits?.boldness}). Values: ${dna.brand_values?.core}, Mission: ${dna.brand_values?.mission}. Pillars: ${(dna.editorial_pillars || []).join(', ')}.`;

  // genOS™ v5.0.0 — Semantic Embedding logic
  // For now, we seed with a dummy vector as a placeholder for OpenAI/Helian™ embeddings.
  const dummyVector = Array(1536).fill(0).map(() => Math.random());

  const { data, error } = await sb.from('brand_dna_vectors').upsert({
    tenant_id: tenantId,
    content,
    embedding: dummyVector,
  }).select().single();

  if (error) throw error;
  return data;
}

async function handleGenerateSLA(sb: any, tenantId: string, payload: any) {
  const { data: tenant } = await sb.from('tenants').select('name, plan').eq('id', tenantId).single();
  const contractUrl = `sla_${tenantId.slice(0, 8)}.pdf`;

  await sb.from('billing_contracts').insert({
    tenant_id: tenantId,
    contract_url: contractUrl,
    metadata: { plan: tenant?.plan || 'starter', generated_at: new Date().toISOString() }
  });

  return { success: true, url: contractUrl };
}

async function handleExportZip(sb: any, payload: any): Promise<Response> {
  const { postId, p_tenant_id } = payload;

  // Support single or multiple posts
  let posts: any[] = [];
  if (Array.isArray(postId)) {
    const { data } = await sb.from('posts').select('*').in('id', postId);
    posts = data || [];
  } else {
    const { data: post } = await sb.from('posts').select('*').eq('id', postId).single();
    if (post) posts = [post];
  }

  if (posts.length === 0) throw new Error('Posts not found');

  const zipFiles: Record<string, Uint8Array> = {};
  posts.forEach((p, i) => {
    zipFiles[`post_${p.id.slice(0, 8)}.json`] = strToU8(JSON.stringify(p, null, 2));
  });

  const zipped = zipSync(zipFiles, { level: 1 });
  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="export-${new Date().getTime()}.zip"`,
    }
  });
}

async function handleMatrixGeneration(sb: any, tenantId: string, envelope: any, payload: any) {
  const { assetId, projectId, briefingGoal, targetLanguage } = payload;

  const primaryModel = anthropic('claude-3-5-sonnet-20240620');
  const fallbackModel = google('gemini-1.5-pro');

  const schema = z.object({
    title: z.string(),
    content: z.string(),
    compliance_notes: z.string().optional()
  });

  const systemPrompt = `
<role>Você é o genOS Creative Master, motor Helian™ v5.0.0.</role>
${envelope.context_barrier}
<brand_dna>${JSON.stringify(envelope.brand_dna)}</brand_dna>
<compliance>${JSON.stringify(envelope.compliance_rules)}</compliance>
<context>
Ação: Geração de Ativo Matrix
Objetivo / Briefing: ${briefingGoal || 'Gerar conteúdo engajador e alinhado ao DNA da marca.'}
Idioma Alvo: ${targetLanguage || 'PT-BR'}
</context>
<rules>Mantenha o tom de voz do Brand DNA e responda estritamente em JSON válido.</rules>
  `;

  let finalResult;
  let usage;
  let modelUsed = 'claude-3-5-sonnet-20240620';
  let costUsd = 0;

  try {
    const res = await generateObject({
      model: primaryModel,
      schema,
      system: systemPrompt,
      prompt: 'Gere o ativo de conteúdo respeitando o briefing.',
      experimental_telemetry: { isEnabled: true, functionId: 'content-factory-matrix' }
    });
    finalResult = res.object;
    usage = res.usage;
    // Estimated costs for Claude 3.5 Sonnet: $3/M input, $15/M output approx
    costUsd = ((usage?.promptTokens || 0) * (3 / 1000000)) + ((usage?.completionTokens || 0) * (15 / 1000000));
  } catch (e) {
    console.warn('Fallback to Gemini...', e);
    modelUsed = 'gemini-1.5-pro';
    const res = await generateObject({
      model: fallbackModel,
      schema,
      system: systemPrompt,
      prompt: 'Gere o ativo de conteúdo respeitando o briefing.',
      experimental_telemetry: { isEnabled: true, functionId: 'content-factory-matrix' }
    });
    finalResult = res.object;
    usage = res.usage;
    // Estimated costs for Gemini 1.5 Pro: $3.5/M input, $10.5/M output approx
    costUsd = ((usage?.promptTokens || 0) * (3.5 / 1000000)) + ((usage?.completionTokens || 0) * (10.5 / 1000000));
  }

  const aiMetadata = {
    model_used: modelUsed,
    tokens_consumed: usage?.totalTokens || 0,
    cost_usd: Number(costUsd.toFixed(6))
  };

  const dbData = {
    tenant_id: tenantId,
    project_id: projectId || null,
    title: finalResult.title,
    content: finalResult.content,
    status: 'needs_review', // Encaminha para o Módulo 6.5 QualityGate
    compliance_notes: finalResult.compliance_notes || '',
    context: {
      brand_dna_snapshot: envelope.brand_dna?.id || 'unknown',
      briefing_goal: briefingGoal,
      target_language: targetLanguage || 'PT-BR'
    },
    ai_metadata: aiMetadata,
    updated_at: new Date().toISOString()
  };

  if (assetId) {
    await sb.from('matrix_assets').update(dbData).eq('id', assetId);
  } else {
    const { data } = await sb.from('matrix_assets').insert(dbData).select().single();
    if (data) return { ...finalResult, id: data.id, ai_metadata: aiMetadata };
  }

  return { ...finalResult, id: assetId, ai_metadata: aiMetadata };
}
