// genOS Full v1.0.0 "Lumina" — agentEnvelope.ts
// Assembles the full AI context: Brand DNA + System Prompt + Compliance Rules + Client Context

import { supabase } from './supabaseClient';

export interface AgentEnvelope {
  brandDna: Record<string, unknown>;
  systemPrompt: string;
  complianceRules: Array<Record<string, unknown>>;
  clientContext: string;
  fullPrompt: string;
  metadata: {
    tenantId: string;
    contentType: string;
    platform: string;
    rulesCount: number;
    hasBrandDna: boolean;
    hasSystemPrompt: boolean;
    assembledAt: string;
  };
}

/**
 * Fallback system prompts per content type (when none configured in DB)
 */
const FALLBACK_PROMPTS: Record<string, string> = {
  social_post: `Você é um especialista em social media. Crie um post para {{platform}} sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

REGRAS DE COMPLIANCE:
{{compliance_rules}}

CONTEXTO DO CLIENTE:
{{client_context}}

Formato: texto principal + hashtags + CTA. Mantenha o tom definido no Brand DNA.`,

  post_carrossel: `Você é um especialista em conteúdo visual. Crie um roteiro de carrossel para {{platform}} sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

Formato: Slide 1 (capa/hook) → Slides 2-7 (conteúdo) → Slide final (CTA).
Cada slide: título curto + texto de apoio (máx 150 chars).`,

  blog_post: `Você é um redator especialista em SEO e conteúdo educacional. Escreva um artigo de blog sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

REGRAS:
{{compliance_rules}}

Formato: Título H1 → Introdução (2-3 parágrafos) → H2 sections → Conclusão com CTA.
Tom: profissional, educativo, com personalidade de marca.`,

  blog_article: `Você é um redator especialista. Escreva um artigo completo sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

Inclua: título otimizado para SEO, meta description, subtítulos H2/H3, e conclusão com CTA.`,

  reels: `Crie um roteiro de Reels/Short sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

Formato:
- Hook (0-3s): frase de impacto
- Desenvolvimento (3-25s): conteúdo principal
- CTA (25-30s): chamada para ação
Incluir sugestões de texto na tela.`,

  stories: `Crie uma sequência de Stories sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

Formato: 3-5 stories sequenciais, cada um com texto + sugestão visual + interação (enquete/quiz/link).`,

  brief: `Crie um brief criativo para o projeto "{{topic}}".

CONTEXTO:
{{client_context}}

Inclua: objetivos, público-alvo, referências, tom de voz, entregas esperadas, prazos sugeridos.`,

  email_campaign: `Crie uma campanha de email sobre "{{topic}}".

BRAND DNA:
{{brand_dna}}

Formato: Subject line + Preview text + Body (header, conteúdo, CTA) + Footer.
Tom: pessoal e direto.`,

  general: `Crie conteúdo sobre "{{topic}}" seguindo as diretrizes da marca.

BRAND DNA:
{{brand_dna}}

{{compliance_rules}}`,
};

/**
 * Format-specific templates for social media content generation (Addendum A).
 * Each format returns structured JSON: { titulo, mainTextoPost, textoCards }
 */
export const SOCIAL_FORMAT_PROMPTS: Record<string, string> = {
  reel: `Você é um especialista em Reels/Shorts para {{platform}}.
Crie conteúdo sobre "{{topic}}" no formato REEL.

BRAND DNA:
{{brand_dna}}

REGRAS DE COMPLIANCE:
{{compliance_rules}}

IMPORTANTE — Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "titulo": "Título chamativo do Reel (gancho de 0-3s)",
  "mainTextoPost": "Legenda completa com CTA, hashtags e emojis. Máximo 2200 chars.",
  "textoCards": "[REEL_TITLE_01] Texto overlay 1\\n[REEL_TITLE_02] Texto overlay 2\\n[REEL_TITLE_03] Texto overlay 3"
}

Regras para textoCards:
- Mínimo 3, máximo 5 títulos de overlay (aparece na tela do vídeo)
- Cada título usa tag [REEL_TITLE_XX] seguido do texto
- Títulos curtos (máx 8 palavras), impactantes, diretos
- Separados por \\n`,

  carrossel: `Você é um especialista em carrosséis para {{platform}}.
Crie conteúdo sobre "{{topic}}" no formato CARROSSEL.

BRAND DNA:
{{brand_dna}}

REGRAS DE COMPLIANCE:
{{compliance_rules}}

IMPORTANTE — Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "titulo": "Título da capa do carrossel (Slide 1 = hook)",
  "mainTextoPost": "Legenda completa com CTA e hashtags. Máximo 2200 chars.",
  "textoCards": "[CAROUSEL_TITLE_01] Título card 1\\n[CAROUSEL_TEXT_01] Texto card 1\\n[CAROUSEL_TITLE_02] Título card 2\\n[CAROUSEL_TEXT_02] Texto card 2\\n..."
}

Regras para textoCards:
- Mínimo 3, máximo 6 cards (além da capa que usa o titulo principal)
- Cada card tem [CAROUSEL_TITLE_XX] + [CAROUSEL_TEXT_XX]
- Título do card: máx 10 palavras
- Texto do card: máx 150 caracteres
- Separados por \\n`,

  estatico: `Você é um especialista em posts estáticos para {{platform}}.
Crie conteúdo sobre "{{topic}}" no formato ESTÁTICO (imagem única).

BRAND DNA:
{{brand_dna}}

REGRAS DE COMPLIANCE:
{{compliance_rules}}

IMPORTANTE — Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "titulo": "Título principal do post (aparece na imagem)",
  "mainTextoPost": "Legenda completa com CTA e hashtags. Máximo 2200 chars.",
  "textoCards": "[STATIC_TITLE] Título da imagem\\n[STATIC_PARAGRAPH] Parágrafo curto de apoio (máx 280 chars)"
}

Regras para textoCards:
- Exatamente 1 [STATIC_TITLE] + 1 [STATIC_PARAGRAPH]
- O STATIC_TITLE aparece em destaque na imagem
- O STATIC_PARAGRAPH é o texto de apoio abaixo do título
- Separados por \\n`,
};

/**
 * Build the complete agent envelope for an AI generation request
 */
export async function buildEnvelope(
  tenantId: string,
  contentType: string,
  topic: string,
  options: {
    platform?: string;
    clientAccountId?: string;
    customContext?: string;
  } = {}
): Promise<AgentEnvelope> {
  const platform = options.platform || 'instagram';

  // 1. Fetch Brand DNA
  const { data: brandDna } = await supabase
    .from('brand_dna')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // 2. Fetch System Prompt for this content type (latest active version)
  const { data: prompt } = await supabase
    .from('system_prompts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('content_type', contentType)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  // 3. Fetch active Compliance Rules
  const { data: rules } = await supabase
    .from('compliance_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // 4. Build structured Brand DNA context
  const dnaContext = brandDna ? {
    voice_tone: brandDna.voice_tone,
    forbidden_words: brandDna.forbidden_words,
    persona: brandDna.persona_name,
    content_rules: brandDna.content_rules,
    brand_values: brandDna.brand_values,
    visual_identity: brandDna.visual_identity,
  } : {};

  // 5. Build structured compliance rules context
  const rulesContext = (rules || []).map(r => ({
    type: r.rule_type,
    config: r.rule_config,
    severity: r.severity,
    description: r.description,
  }));

  const complianceBlock = rulesContext.length > 0
    ? rulesContext.map(r => `- [${r.severity}] ${r.type}: ${r.description || JSON.stringify(r.config)}`).join('\n')
    : 'Nenhuma regra de compliance ativa.';

  // 6. Build client context
  let clientContext = options.customContext || '';
  if (options.clientAccountId) {
    const { data: clientContent } = await supabase
      .from('content_items')
      .select('title, content_type, status, compliance_score')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (clientContent && clientContent.length > 0) {
      clientContext += `\nConteúdo recente do tenant:`;
      for (const c of clientContent) {
        clientContext += `\n  • ${c.title || '(sem título)'} [${c.content_type}] — ${c.status} (score: ${c.compliance_score ?? 'N/A'})`;
      }
    }
  }

  // 7. Assemble full prompt with variable substitution
  const templateSource = prompt?.prompt_text
    || FALLBACK_PROMPTS[contentType]
    || FALLBACK_PROMPTS.general;

  const fullPrompt = templateSource
    .replace(/\{\{topic\}\}/g, topic)
    .replace(/\{\{platform\}\}/g, platform)
    .replace(/\{\{client_context\}\}/g, clientContext || 'N/A')
    .replace(/\{\{brand_dna\}\}/g, JSON.stringify(dnaContext, null, 2))
    .replace(/\{\{compliance_rules\}\}/g, complianceBlock)
    .replace(/\{\{content\}\}/g, topic);

  return {
    brandDna: dnaContext,
    systemPrompt: prompt?.prompt_text || '',
    complianceRules: rulesContext,
    clientContext,
    fullPrompt,
    metadata: {
      tenantId,
      contentType,
      platform,
      rulesCount: rulesContext.length,
      hasBrandDna: !!brandDna,
      hasSystemPrompt: !!prompt,
      assembledAt: new Date().toISOString(),
    },
  };
}
