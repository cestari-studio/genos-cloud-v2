// genOS Full v1.0.0 "Lumina" — aiRouter.ts
// AI provider selector: Gemini (bulk) | Claude (strategic) | Local (fallback)

import { supabase } from './supabaseClient';
import { buildEnvelope, SOCIAL_FORMAT_PROMPTS } from './agentEnvelope';
import { resolvePricingBlended } from './pricingResolver';

export interface AiRequest {
  tenantId: string;
  contentType: string;
  topic: string;
  platform?: string;
  clientContext?: string;
  brandDna?: Record<string, unknown>;
  systemPromptId?: string;
  customPrompt?: string;
}

export interface SocialGenerateRequest {
  tenantId: string;
  formato: 'reel' | 'carrossel' | 'estatico';
  platform: string;
  prompt: string;
  pilar?: string;
  editoria?: string;
  objetivo?: string;
  mes?: string;
  semana?: string;
  dia_semana?: string;
  horario_sugerido?: string;
}

export interface SocialGenerateResponse {
  titulo: string;
  mainTextoPost: string;
  textoCards: string;
  model: string;
  provider: string;
  tokensUsed: number;
  costUsd: number;
  sessionId?: string;
}

export interface AiResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
  costUsd: number;
  sessionId?: string;
}

/**
 * Check if a real API key is configured
 */
function hasGeminiKey(): boolean {
  const k = process.env.GEMINI_API_KEY;
  return !!k && k !== 'your-gemini-key-here' && k.length > 10;
}

function hasAnthropicKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !!k && k !== 'your-anthropic-key-here' && k.startsWith('sk-');
}

/**
 * Select AI provider based on task type and available keys
 * Priority: configured provider > fallback provider > local mock
 */
function selectProvider(contentType: string): { provider: string; model: string } {
  const strategicTypes = ['blog_article', 'blog_post', 'compliance_review', 'video_script', 'newsletter', 'brief', 'case_study'];

  const isStrategic = strategicTypes.includes(contentType);

  // Prefer the intended provider if key available
  if (isStrategic && hasAnthropicKey()) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' };
  }
  if (!isStrategic && hasGeminiKey()) {
    return { provider: 'google', model: 'gemini-2.0-flash' };
  }

  // Cross-fallback: use whichever key is available
  if (hasAnthropicKey()) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' };
  }
  if (hasGeminiKey()) {
    return { provider: 'google', model: 'gemini-2.0-flash' };
  }

  // No keys — use local mock
  return { provider: 'local', model: 'genOS-local-v1' };
}

/**
 * Local mock generator — produces structured content for testing
 * Uses the envelope + Brand DNA to generate template-based content
 */
async function callLocal(
  request: AiRequest,
  prompt: string
): Promise<{ content: string; tokensUsed: number }> {
  console.log('[aiRouter] Using LOCAL fallback (no API keys configured)');

  // Build envelope for rich context
  const envelope = await buildEnvelope(
    request.tenantId,
    request.contentType,
    request.topic,
    { platform: request.platform }
  );

  const persona = (envelope.brandDna as any)?.persona || 'Content Creator';
  const voiceTone = (envelope.brandDna as any)?.voice_tone;
  const primaryTone = voiceTone?.primary_tone || 'professional';
  const vocabKeys = voiceTone?.vocabulario_chave as string[] || [];
  const randomTerms = vocabKeys.slice(0, 3).join(', ');

  // Generate template content based on content type
  let content: string;

  switch (request.contentType) {
    case 'social_post':
    case 'post_carrossel':
    case 'post_estatico':
      content = `[LOCAL MOCK — ${request.contentType}]

${request.topic}

${primaryTone === 'visionário-técnico-autoritário'
  ? 'O futuro não espera por quem ainda está testando.'
  : 'Cada detalhe conta na construção de algo duradouro.'}

${randomTerms ? `Termos: ${randomTerms}` : ''}

#CestariStudio #FutureProofBrands #DesignSistemico`;
      break;

    case 'blog_post':
    case 'blog_article':
      content = `[LOCAL MOCK — ${request.contentType}]

# ${request.topic}

## Introdução
${request.topic} é um tema central para profissionais que buscam resultados mensuráveis.

## Desenvolvimento
Neste artigo, exploramos como ${randomTerms || 'as melhores práticas'} se aplicam na prática.

### Ponto 1: Fundamentos
A base de qualquer sistema robusto começa com governança e observabilidade.

### Ponto 2: Aplicação Prática
Implementação step-by-step com foco em ROI mensurável.

## Conclusão
Investir em ${request.topic.toLowerCase()} é investir no futuro do seu negócio.

---
*${persona} — Cestari Studio*`;
      break;

    case 'reels':
    case 'stories':
      content = `[LOCAL MOCK — ${request.contentType}]

🎬 Hook (0-3s): "${request.topic}" — Pare de ignorar isso.
📱 Desenvolvimento (3-25s): 3 pontos rápidos sobre o tema.
🔗 CTA (25-30s): Salve para aplicar ainda hoje.

Texto na tela: "${request.topic}"
Música sugerida: Tech/Corporate beat`;
      break;

    default:
      content = `[LOCAL MOCK — ${request.contentType}]

Conteúdo gerado localmente sobre: ${request.topic}

Persona: ${persona}
Tom: ${primaryTone}
Plataforma: ${request.platform || 'geral'}

${randomTerms ? `Termos-chave utilizados: ${randomTerms}` : ''}

---
⚠️ Este conteúdo foi gerado pelo modo LOCAL (sem API key).
Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY no .env para produção.`;
  }

  const estimatedTokens = Math.ceil(content.length / 4);
  return { content, tokensUsed: estimatedTokens };
}

/**
 * Call Gemini API
 */
async function callGemini(prompt: string): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = process.env.GEMINI_API_KEY!;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokens = data.usageMetadata?.totalTokenCount || 0;

  return { content: text, tokensUsed: tokens };
}

/**
 * Call Claude API
 */
async function callClaude(prompt: string, systemPrompt?: string): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: prompt },
  ];

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude API error [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  const text = data.content?.[0]?.text || '';
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  return { content: text, tokensUsed: inputTokens + outputTokens };
}

/**
 * Log token usage with dual cost tracking (Addendum E)
 */
async function logTokenUsage(params: {
  tenantId: string;
  aiSessionId?: string;
  provider: string;
  model: string;
  sessionType: string;
  tokensUsed: number;
  contentItemId?: string;
}): Promise<void> {
  try {
    const pricing = await resolvePricingBlended(
      params.tenantId,
      params.provider,
      params.model,
      params.tokensUsed
    );

    await supabase.from('token_usage').insert({
      tenant_id: params.tenantId,
      ai_session_id: params.aiSessionId || null,
      provider: params.provider,
      model: params.model,
      session_type: params.sessionType,
      input_tokens: Math.round(params.tokensUsed * 0.7), // estimate 70/30 split
      output_tokens: Math.round(params.tokensUsed * 0.3),
      agency_cost_usd: pricing.agencyCostUsd,
      client_cost_usd: pricing.clientCostUsd,
      pricing_strategy: pricing.pricingStrategy,
      pricing_config_id: pricing.pricingConfigId,
      content_item_id: params.contentItemId || null,
      metadata: { margin_pct: pricing.markupPct },
    });
  } catch (err) {
    console.error('[aiRouter] Failed to log token_usage:', err);
  }
}

/**
 * Generate content using AI (with automatic fallback chain)
 */
export async function generateContent(request: AiRequest): Promise<AiResponse> {
  const { provider, model } = selectProvider(request.contentType);

  // Get system prompt if specified
  let systemPromptText = request.customPrompt || '';
  if (request.systemPromptId && !systemPromptText) {
    const { data } = await supabase
      .from('system_prompts')
      .select('prompt_text')
      .eq('id', request.systemPromptId)
      .single();
    systemPromptText = data?.prompt_text || '';
  }

  // If no explicit prompt, find one by content_type
  if (!systemPromptText) {
    const { data } = await supabase
      .from('system_prompts')
      .select('prompt_text')
      .eq('tenant_id', request.tenantId)
      .eq('content_type', request.contentType)
      .eq('is_active', true)
      .limit(1)
      .single();
    systemPromptText = data?.prompt_text || '';
  }

  // Build the final prompt with variable substitution
  let prompt = systemPromptText || `Generate a ${request.contentType} about: ${request.topic}`;
  prompt = prompt
    .replace(/\{\{topic\}\}/g, request.topic)
    .replace(/\{\{platform\}\}/g, request.platform || 'instagram')
    .replace(/\{\{client_context\}\}/g, request.clientContext || 'N/A')
    .replace(/\{\{brand_dna\}\}/g, JSON.stringify(request.brandDna || {}))
    .replace(/\{\{content\}\}/g, request.topic);

  let result: { content: string; tokensUsed: number };

  if (provider === 'google') {
    result = await callGemini(prompt);
  } else if (provider === 'anthropic') {
    result = await callClaude(prompt, undefined);
  } else {
    // Local fallback
    result = await callLocal(request, prompt);
  }

  // Estimate cost
  const costUsd = provider === 'google'
    ? result.tokensUsed * 0.000001
    : provider === 'anthropic'
    ? result.tokensUsed * 0.000005
    : 0; // local is free

  // Log AI session
  const { data: session } = await supabase
    .from('ai_sessions')
    .insert({
      tenant_id: request.tenantId,
      session_type: 'content_generation',
      model_used: model,
      tokens_used: result.tokensUsed,
      cost_usd: costUsd,
      status: 'completed',
      context: {
        contentType: request.contentType,
        topic: request.topic,
        platform: request.platform,
        provider,
      },
    })
    .select('id')
    .single();

  // Dual cost tracking (Addendum E)
  await logTokenUsage({
    tenantId: request.tenantId,
    aiSessionId: session?.id,
    provider,
    model,
    sessionType: 'content_generation',
    tokensUsed: result.tokensUsed,
  });

  return {
    content: result.content,
    model,
    provider,
    tokensUsed: result.tokensUsed,
    costUsd,
    sessionId: session?.id,
  };
}

/**
 * Local mock for social format-specific generation
 * Returns structured JSON matching the social format schema
 */
function callLocalSocial(
  formato: string,
  topic: string,
  platform: string
): { titulo: string; mainTextoPost: string; textoCards: string; tokensUsed: number } {
  console.log(`[aiRouter] LOCAL social mock — formato=${formato}, topic="${topic}"`);

  switch (formato) {
    case 'reel':
      return {
        titulo: `${topic} — O que ninguém te conta`,
        mainTextoPost: `🎬 ${topic}\n\nVocê ainda está ignorando isso? Aqui vão 3 pontos que vão mudar sua perspectiva.\n\n💡 Salve este Reel e aplique ainda hoje.\n\n#CestariStudio #FutureProof #${platform}`,
        textoCards: `[REEL_TITLE_01] ${topic} — Pare e preste atenção\n[REEL_TITLE_02] Ponto 1: A maioria erra aqui\n[REEL_TITLE_03] Ponto 2: O segredo está nos detalhes\n[REEL_TITLE_04] Ponto 3: Aplique hoje mesmo\n[REEL_TITLE_05] Salve para não esquecer`,
        tokensUsed: 180,
      };

    case 'carrossel':
      return {
        titulo: `${topic} — Guia Completo`,
        mainTextoPost: `📚 Deslize para aprender tudo sobre ${topic}.\n\nNeste carrossel, você vai descobrir os fundamentos, as melhores práticas e como aplicar na prática.\n\n💾 Salve para consultar depois!\n\n#CestariStudio #Carrossel #${platform}`,
        textoCards: `[CAROUSEL_TITLE_01] O que é ${topic}?\n[CAROUSEL_TEXT_01] Uma visão geral clara e direta sobre o tema e por que ele importa.\n[CAROUSEL_TITLE_02] Por que isso importa?\n[CAROUSEL_TEXT_02] Entenda o impacto direto nos seus resultados e na sua estratégia.\n[CAROUSEL_TITLE_03] Como começar\n[CAROUSEL_TEXT_03] Passo a passo prático para implementar a partir de hoje.\n[CAROUSEL_TITLE_04] Erros comuns\n[CAROUSEL_TEXT_04] Evite esses 3 erros que 90% das pessoas cometem ao começar.\n[CAROUSEL_TITLE_05] Próximos passos\n[CAROUSEL_TEXT_05] Aplique o que aprendeu e acompanhe os resultados em 30 dias.`,
        tokensUsed: 280,
      };

    case 'estatico':
    default:
      return {
        titulo: `${topic}`,
        mainTextoPost: `✨ ${topic}\n\nCada detalhe conta na construção de algo duradouro. Descubra como transformar esta ideia em resultado concreto.\n\n👉 Comente \"EU QUERO\" para saber mais.\n\n#CestariStudio #DesignSistemico #${platform}`,
        textoCards: `[STATIC_TITLE] ${topic}\n[STATIC_PARAGRAPH] Descubra como aplicar este conceito na prática e transformar seus resultados.`,
        tokensUsed: 120,
      };
  }
}

/**
 * Generate social media content with format-specific structure
 * Returns structured {titulo, mainTextoPost, textoCards} for Reel, Carrossel, or Estático
 */
export async function generateSocialContent(request: SocialGenerateRequest): Promise<SocialGenerateResponse> {
  const { provider, model } = selectProvider('social_post');

  // Build envelope for brand context
  const envelope = await buildEnvelope(
    request.tenantId,
    'social_post',
    request.prompt,
    { platform: request.platform }
  );

  // Get format-specific template
  const template = SOCIAL_FORMAT_PROMPTS[request.formato] || SOCIAL_FORMAT_PROMPTS.estatico;
  const brandDnaStr = JSON.stringify(envelope.brandDna, null, 2);
  const complianceBlock = envelope.complianceRules.length > 0
    ? envelope.complianceRules.map((r: any) => `- [${r.severity}] ${r.type}: ${r.description || JSON.stringify(r.config)}`).join('\n')
    : 'Nenhuma regra de compliance ativa.';

  const fullPrompt = template
    .replace(/\{\{topic\}\}/g, request.prompt)
    .replace(/\{\{platform\}\}/g, request.platform)
    .replace(/\{\{brand_dna\}\}/g, brandDnaStr)
    .replace(/\{\{compliance_rules\}\}/g, complianceBlock);

  let titulo: string;
  let mainTextoPost: string;
  let textoCards: string;
  let tokensUsed: number;

  if (provider === 'local') {
    const mock = callLocalSocial(request.formato, request.prompt, request.platform);
    titulo = mock.titulo;
    mainTextoPost = mock.mainTextoPost;
    textoCards = mock.textoCards;
    tokensUsed = mock.tokensUsed;
  } else {
    // Real AI call — parse JSON response
    let result: { content: string; tokensUsed: number };
    if (provider === 'google') {
      result = await callGemini(fullPrompt);
    } else {
      result = await callClaude(fullPrompt, undefined);
    }

    tokensUsed = result.tokensUsed;

    // Try to parse JSON from AI response
    try {
      // Strip markdown code fences if present
      let cleaned = result.content.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      titulo = parsed.titulo || request.prompt;
      mainTextoPost = parsed.mainTextoPost || result.content;
      textoCards = parsed.textoCards || '';
    } catch {
      // If JSON parse fails, use raw content
      titulo = request.prompt;
      mainTextoPost = result.content;
      textoCards = '';
    }
  }

  // Estimate cost
  const costUsd = provider === 'google'
    ? tokensUsed * 0.000001
    : provider === 'anthropic'
    ? tokensUsed * 0.000005
    : 0;

  // Log AI session
  const { data: session } = await supabase
    .from('ai_sessions')
    .insert({
      tenant_id: request.tenantId,
      session_type: 'social_generation',
      model_used: model,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      status: 'completed',
      context: {
        formato: request.formato,
        platform: request.platform,
        topic: request.prompt,
        provider,
      },
    })
    .select('id')
    .single();

  // Dual cost tracking (Addendum E)
  await logTokenUsage({
    tenantId: request.tenantId,
    aiSessionId: session?.id,
    provider,
    model,
    sessionType: 'social_generation',
    tokensUsed,
  });

  return {
    titulo,
    mainTextoPost,
    textoCards,
    model,
    provider,
    tokensUsed,
    costUsd,
    sessionId: session?.id,
  };
}

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 3: Generate Brand DNA via AI
// ═══════════════════════════════════════════════════════════════
const BRAND_ARCHITECT_PROMPT = `Você é um Brand Architect especialista em construir identidades de marca para o mercado brasileiro.
Seu papel é receber um briefing de marca e gerar um Brand DNA completo e estruturado.

Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "voice_tone": {
    "primary_tone": "string — tom principal (ex: 'visionário-técnico-autoritário')",
    "secondary_tones": ["string"],
    "vocabulario_chave": ["string — termos-chave do vocabulário da marca"],
    "estilo_escrita": "string — descrição do estilo"
  },
  "personality_traits": {
    "arquetipo": "string",
    "traços": ["string"],
    "como_fala": "string",
    "como_nao_fala": "string"
  },
  "persona_name": "string — nome da persona da marca",
  "voice_description": "string — descrição da voz em 1-2 frases",
  "forbidden_words": ["string — palavras proibidas"],
  "mandatory_terms": ["string — termos obrigatórios"],
  "editorial_pillars": [
    {"name": "string", "weight_pct": 30, "description": "string", "keywords": ["string"]}
  ],
  "audience_profile": {
    "demographics": "string",
    "psychographics": "string",
    "pain_points": ["string"],
    "goals": ["string"]
  },
  "hashtag_strategy": {
    "always": ["#string"],
    "category_specific": {"pilar": ["#string"]},
    "max_per_post": 15
  },
  "brand_values": {
    "core": ["string"],
    "differentials": ["string"],
    "mission_summary": "string"
  },
  "content_rules": {
    "max_emojis_per_post": 5,
    "cta_required": true,
    "min_hashtags": 3,
    "language": "pt-BR"
  },
  "generation_notes": "string — notas livres para a geração AI"
}

REGRAS:
- Pilares editoriais devem somar 100% em weight_pct
- Mínimo 3 e máximo 6 pilares
- Forbidden words: inclua erros comuns do segmento
- Mandatory terms: inclua termos que reforçam posicionamento
- Hashtags: max 15, mix de branded + nicho + trending`;

export async function generateBrandDna(
  tenantId: string,
  input: { brief: string; website?: string; segment?: string }
): Promise<{ dna: Record<string, any>; provider: string; model: string; tokensUsed: number; costUsd: number }> {
  const { provider, model } = selectProvider('blog_article'); // strategic task

  const userPrompt = `BRIEFING DA MARCA:
${input.brief}

${input.website ? `WEBSITE: ${input.website}` : ''}
${input.segment ? `SEGMENTO: ${input.segment}` : ''}

Gere o Brand DNA completo conforme a estrutura especificada.`;

  let result: { content: string; tokensUsed: number };

  if (provider === 'anthropic') {
    result = await callClaude(userPrompt, BRAND_ARCHITECT_PROMPT);
  } else if (provider === 'google') {
    result = await callGemini(BRAND_ARCHITECT_PROMPT + '\n\n' + userPrompt);
  } else {
    // Local mock
    result = {
      content: JSON.stringify({
        voice_tone: { primary_tone: 'profissional-inovador', secondary_tones: ['educativo', 'inspiracional'], vocabulario_chave: ['inovação', 'resultado', 'estratégia'], estilo_escrita: 'Direto, com autoridade e dados' },
        personality_traits: { arquetipo: 'O Sábio', traços: ['analítico', 'visionário', 'pragmático'], como_fala: 'Com dados e exemplos', como_nao_fala: 'Genérico ou superficial' },
        persona_name: 'Brand Persona',
        voice_description: 'Voz profissional e inovadora com foco em resultados mensuráveis.',
        forbidden_words: ['barato', 'grátis', 'promoção', 'apenas'],
        mandatory_terms: ['estratégia', 'resultado', 'inovação'],
        editorial_pillars: [
          { name: 'Educativo', weight_pct: 40, description: 'Conteúdo que ensina', keywords: ['dica', 'guia', 'como'] },
          { name: 'Inspiracional', weight_pct: 30, description: 'Cases e resultados', keywords: ['case', 'resultado'] },
          { name: 'Institucional', weight_pct: 20, description: 'Marca e cultura', keywords: ['marca', 'equipe'] },
          { name: 'Promocional', weight_pct: 10, description: 'Ofertas diretas', keywords: ['lançamento', 'novo'] },
        ],
        audience_profile: { demographics: '25-45 anos, classe A/B', psychographics: 'Early adopters, valorizam qualidade', pain_points: ['Falta de consistência'], goals: ['Marca forte'] },
        hashtag_strategy: { always: ['#marca'], category_specific: {}, max_per_post: 15 },
        brand_values: { core: ['Inovação', 'Qualidade'], differentials: ['Abordagem sistêmica'], mission_summary: 'Soluções à prova do futuro.' },
        content_rules: { max_emojis_per_post: 5, cta_required: true, min_hashtags: 3, language: 'pt-BR' },
        generation_notes: `Gerado via AI a partir do briefing: ${input.brief.substring(0, 100)}`,
      }),
      tokensUsed: 500,
    };
  }

  // Parse AI response
  let dna: Record<string, any>;
  try {
    let cleaned = result.content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    dna = JSON.parse(cleaned.trim());
  } catch {
    dna = { generation_notes: result.content, voice_description: input.brief };
  }

  const costUsd = provider === 'google' ? result.tokensUsed * 0.000001 : provider === 'anthropic' ? result.tokensUsed * 0.000005 : 0;

  const { data: session } = await supabase.from('ai_sessions').insert({
    tenant_id: tenantId,
    session_type: 'brand_dna_generation',
    model_used: model,
    tokens_used: result.tokensUsed,
    cost_usd: costUsd,
    status: 'completed',
    context: { brief: input.brief.substring(0, 200), provider },
  }).select('id').single();

  // Dual cost tracking (Addendum E)
  await logTokenUsage({
    tenantId,
    aiSessionId: session?.id,
    provider,
    model,
    sessionType: 'brand_dna_generation',
    tokensUsed: result.tokensUsed,
  });

  return { dna, provider, model, tokensUsed: result.tokensUsed, costUsd };
}

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 4: Batch Social Generation
// ═══════════════════════════════════════════════════════════════
interface BatchSocialRequest {
  dateStart: string;
  dateEnd: string;
  postsPerWeek: number;
  formatDistribution: Record<string, number>;
  platform: string;
  pilarDistribution?: Record<string, number>;
}

interface BatchSocialItem {
  formato: string;
  titulo: string;
  mainTextoPost: string;
  textoCards: string;
  pilar: string;
  editoria: string;
  objetivo: string;
  scheduled_date: string;
  dia_semana: string;
  horario_sugerido: string;
  mes: string;
  semana: string;
}

const CONTENT_PLANNER_PROMPT = `Você é um Content Planner especialista em redes sociais para o mercado brasileiro.
Seu papel é gerar um calendário completo de posts para um período, respeitando a distribuição de formatos e pilares.

Responda EXCLUSIVAMENTE em JSON válido — um array de objetos com esta estrutura:
[
  {
    "formato": "reel" | "carrossel" | "estatico",
    "titulo": "string — título chamativo",
    "mainTextoPost": "string — legenda completa com CTA e hashtags",
    "textoCards": "string — texto dos cards/overlays com tags",
    "pilar": "string — pilar editorial",
    "editoria": "string — sub-editoria",
    "objetivo": "string — objetivo do post",
    "scheduled_date": "YYYY-MM-DD",
    "dia_semana": "string — seg/ter/qua/qui/sex/sab/dom",
    "horario_sugerido": "HH:MM",
    "mes": "string — nome do mês",
    "semana": "string — Semana 1/2/3/4/5"
  }
]

REGRAS PARA textoCards:
- Reel: [REEL_TITLE_01] texto, [REEL_TITLE_02] texto... (3-5 overlays)
- Carrossel: [CAROUSEL_TITLE_01] titulo\\n[CAROUSEL_TEXT_01] texto... (3-6 cards)
- Estático: [STATIC_TITLE] titulo\\n[STATIC_PARAGRAPH] texto

REGRAS GERAIS:
- Distribua posts nos dias úteis (seg-sex), evitando fins de semana a menos que necessário
- Horários recomendados: 10:00, 12:00, 17:00, 19:00
- Varie temas dentro de cada pilar
- Mantenha consistência de tom com o Brand DNA
- NÃO repita temas na mesma semana`;

export async function batchSocialGenerate(
  tenantId: string,
  request: BatchSocialRequest
): Promise<{ items: BatchSocialItem[]; provider: string; model: string; tokensUsed: number; costUsd: number }> {
  const { provider, model } = selectProvider('social_post');

  // Fetch brand DNA + pillars for context
  const { data: brandDna } = await supabase.from('brand_dna').select('*').eq('tenant_id', tenantId).single();

  const pillars = brandDna?.editorial_pillars || [];
  const pillarBlock = pillars.length > 0
    ? pillars.map((p: any) => `- ${p.name} (${p.weight_pct}%): ${p.description}`).join('\n')
    : 'Sem pilares definidos — distribua entre Educativo, Inspiracional e Promocional.';

  const charLimits = brandDna?.char_limits || {};
  const charLimitsBlock = Object.keys(charLimits).length > 0
    ? Object.entries(charLimits).map(([k, v]) => `- ${k}: ${v} chars`).join('\n')
    : '';

  const userPrompt = `PERÍODO: ${request.dateStart} até ${request.dateEnd}
FREQUÊNCIA: ${request.postsPerWeek} posts por semana
PLATAFORMA: ${request.platform}
DISTRIBUIÇÃO DE FORMATOS: ${JSON.stringify(request.formatDistribution)}

PILARES EDITORIAIS:
${pillarBlock}

${charLimitsBlock ? `LIMITES DE CARACTERES:\n${charLimitsBlock}\n` : ''}

BRAND DNA:
Tom: ${brandDna?.voice_tone?.primary_tone || 'profissional'}
Persona: ${brandDna?.persona_name || 'N/A'}
Termos obrigatórios: ${(brandDna?.mandatory_terms || []).join(', ') || 'N/A'}
Palavras proibidas: ${(brandDna?.forbidden_words || []).join(', ') || 'N/A'}

${brandDna?.generation_notes ? `NOTAS: ${brandDna.generation_notes}` : ''}

Gere o calendário completo de posts.`;

  let items: BatchSocialItem[];
  let tokensUsed: number;

  if (provider === 'local') {
    // Local mock: generate posts for the date range
    items = generateLocalBatchItems(request);
    tokensUsed = items.length * 200;
  } else {
    let result: { content: string; tokensUsed: number };
    if (provider === 'google') {
      result = await callGemini(CONTENT_PLANNER_PROMPT + '\n\n' + userPrompt);
    } else {
      result = await callClaude(userPrompt, CONTENT_PLANNER_PROMPT);
    }

    tokensUsed = result.tokensUsed;

    try {
      let cleaned = result.content.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      items = JSON.parse(cleaned.trim());
    } catch {
      // Fallback to local if parse fails
      items = generateLocalBatchItems(request);
    }
  }

  const costUsd = provider === 'google' ? tokensUsed * 0.000001 : provider === 'anthropic' ? tokensUsed * 0.000005 : 0;

  const { data: session } = await supabase.from('ai_sessions').insert({
    tenant_id: tenantId,
    session_type: 'batch_social_generation',
    model_used: model,
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    status: 'completed',
    context: { dateRange: `${request.dateStart}→${request.dateEnd}`, postsPerWeek: request.postsPerWeek, itemCount: items.length, provider },
  }).select('id').single();

  // Dual cost tracking — token_usage
  await logTokenUsage({
    tenantId,
    aiSessionId: session?.id,
    provider,
    model,
    sessionType: 'batch_social_generation',
    tokensUsed,
  });

  return { items, provider, model, tokensUsed, costUsd };
}

/**
 * Local mock: generate batch items for a date range
 */
function generateLocalBatchItems(request: BatchSocialRequest): BatchSocialItem[] {
  const items: BatchSocialItem[] = [];
  const formats = ['reel', 'carrossel', 'estatico'];
  const pillars = ['Educativo', 'Inspiracional', 'Institucional', 'Promocional'];
  const topics = [
    'Tendências do mercado', 'Como otimizar processos', 'Case de sucesso',
    'Bastidores da operação', 'Novidade no portfólio', 'Dica rápida do dia',
    'Guia completo', 'Mitos e verdades', 'O que ninguém te conta', 'Passo a passo prático',
  ];
  const days = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const hours = ['10:00', '12:00', '17:00', '19:00'];

  const start = new Date(request.dateStart);
  const end = new Date(request.dateEnd);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerWeek));

  let topicIdx = 0;

  for (let w = 0; w < weeks; w++) {
    for (let p = 0; p < request.postsPerWeek && p < 7; p++) {
      const postDate = new Date(start.getTime() + (w * 7 + Math.min(p, 4)) * 24 * 60 * 60 * 1000);
      if (postDate > end) break;

      const formato = formats[p % formats.length];
      const pilar = pillars[p % pillars.length];
      const topic = topics[topicIdx % topics.length];
      topicIdx++;

      const dateStr = postDate.toISOString().slice(0, 10);
      const dayOfWeek = days[postDate.getDay() === 0 ? 4 : Math.min(postDate.getDay() - 1, 4)];

      const mock = callLocalSocial(formato, topic, request.platform);

      items.push({
        formato,
        titulo: mock.titulo,
        mainTextoPost: mock.mainTextoPost,
        textoCards: mock.textoCards,
        pilar,
        editoria: pilar,
        objetivo: 'engajamento',
        scheduled_date: dateStr,
        dia_semana: dayOfWeek,
        horario_sugerido: hours[p % hours.length],
        mes: postDate.toLocaleString('pt-BR', { month: 'long' }),
        semana: `Semana ${w + 1}`,
      });
    }
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════
// Addendum B — AJUSTE 5: Schedule Adjust via Natural Language
// ═══════════════════════════════════════════════════════════════
const SCHEDULE_MANAGER_PROMPT = `Você é um Schedule Manager especialista em gestão de cronogramas de conteúdo.
Receba um comando em linguagem natural e o cronograma atual, e retorne operações estruturadas.

Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "operations": [
    {
      "type": "move" | "swap" | "delete" | "change_format" | "update_content" | "insert",
      "item_id": "uuid do item (para move/delete/change_format/update_content)",
      "item_a_id": "uuid (para swap)",
      "item_b_id": "uuid (para swap)",
      "new_date": "YYYY-MM-DD (para move/insert)",
      "new_time": "HH:MM (para move/insert)",
      "new_format": "reel/carrossel/estatico (para change_format)",
      "new_title": "string (para update_content)",
      "new_body": "string (para update_content)",
      "description": "string — descrição da operação para o usuário"
    }
  ],
  "summary": "string — resumo das alterações para o usuário"
}

TIPOS DE OPERAÇÃO:
- move: Mover um post para nova data/horário
- swap: Trocar posição de dois posts
- delete: Remover post do cronograma
- change_format: Alterar formato (reel↔carrossel↔estático)
- update_content: Atualizar título ou conteúdo
- insert: Inserir novo post (gerar conteúdo)

REGRAS:
- Sempre inclua item_id referenciando IDs do cronograma atual
- Para "insert", gere conteúdo completo no new_body
- summary deve ser em português, claro e conciso
- Evite colocar 2 posts no mesmo dia/horário`;

interface ScheduleAdjustInput {
  command: string;
  currentSchedule: any[];
}

export async function scheduleAdjust(
  tenantId: string,
  input: ScheduleAdjustInput
): Promise<{ operations: any[]; summary: string; provider: string; model: string }> {
  const { provider, model } = selectProvider('blog_article'); // strategic

  const scheduleBlock = input.currentSchedule.map(item =>
    `- ID: ${item.id} | ${item.scheduled_date} ${item.time_slot || ''} | ${item.content_type} | "${item.title}" | pilar: ${item.pillar || 'N/A'}`
  ).join('\n');

  const userPrompt = `COMANDO: ${input.command}

CRONOGRAMA ATUAL:
${scheduleBlock || '(vazio)'}

Analise o comando e gere as operações necessárias.`;

  let result: { content: string; tokensUsed: number };

  if (provider === 'anthropic') {
    result = await callClaude(userPrompt, SCHEDULE_MANAGER_PROMPT);
  } else if (provider === 'google') {
    result = await callGemini(SCHEDULE_MANAGER_PROMPT + '\n\n' + userPrompt);
  } else {
    // Local mock
    result = {
      content: JSON.stringify({
        operations: [],
        summary: `[LOCAL MOCK] Comando recebido: "${input.command}". Nenhuma operação gerada no modo local. Configure uma API key para funcionalidade completa.`,
      }),
      tokensUsed: 100,
    };
  }

  let parsed: { operations: any[]; summary: string };
  try {
    let cleaned = result.content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    parsed = JSON.parse(cleaned.trim());
  } catch {
    parsed = { operations: [], summary: 'Não foi possível interpretar o comando. Tente novamente com mais detalhes.' };
  }

  return { ...parsed, provider, model };
}
