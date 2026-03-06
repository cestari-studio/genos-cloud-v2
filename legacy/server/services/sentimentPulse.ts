// genOS Full v1.0.0 "Lumina" — sentimentPulse.ts (Addendum C — AJUSTE 8)
// F5 Sentiment Pulse — Analyze client feedback patterns

import { supabase } from './supabaseClient';
import { emitFeedEvent } from './activityFeed';

export interface SentimentResult {
  sentiment_score: number;
  trend: 'improving' | 'stable' | 'declining';
  approval_rate_first_pass: number;
  dominant_patterns: Array<{
    type: string;
    frequency: 'high' | 'medium' | 'low';
    description: string;
    examples_count: number;
    recommendation: string;
  }>;
  positive_signals: string[];
  risk_signals: string[];
  prompt_adjustment_suggestions: string[];
}

/**
 * Build the sentiment analysis system prompt
 */
function buildSentimentPrompt(params: {
  clientName: string;
  feedbacks: string[];
  totalPosts: number;
  postsWithFeedback: number;
  postsSemFeedback: number;
}): string {
  return `Você é o genOS Sentiment Analyst. Analise os feedbacks abaixo do cliente "${params.clientName}".

FEEDBACKS (ordenados cronologicamente):
${params.feedbacks.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

TOTAL DE POSTS: ${params.totalPosts}
POSTS COM FEEDBACK: ${params.postsWithFeedback}
POSTS SEM FEEDBACK (aprovados silenciosamente): ${params.postsSemFeedback}

Analise e retorne JSON puro (sem markdown):
{
  "sentiment_score": 0-100,
  "trend": "improving" | "stable" | "declining",
  "approval_rate_first_pass": percentage,
  "dominant_patterns": [
    {
      "type": "categoria do padrão",
      "frequency": "high" | "medium" | "low",
      "description": "descrição clara em PT-BR",
      "examples_count": N,
      "recommendation": "ação concreta para melhorar"
    }
  ],
  "positive_signals": ["..."],
  "risk_signals": ["..."],
  "prompt_adjustment_suggestions": [
    "Sugestão 1 para melhorar os system prompts de geração",
    "Sugestão 2..."
  ]
}

REGRAS:
- Post sem feedback = aprovado silenciosamente (sinal positivo)
- Feedback curto ("A ver", "OK") = neutro/aguardando
- Feedback longo com sugestões = engajamento positivo MAS indica necessidade de ajuste
- Tom imperativo ("preciso que", "coloque") ≠ insatisfação, = direção criativa
- Score 80+ = excelente, 60-79 = bom, 40-59 = atenção, <40 = crítico`;
}

/**
 * Analyze client sentiment via AI or local mock
 */
async function analyzeSentiment(params: {
  clientName: string;
  feedbacks: string[];
  totalPosts: number;
  postsWithFeedback: number;
  postsSemFeedback: number;
}): Promise<{ result: SentimentResult; model: string; tokensUsed: number }> {
  // Check for Anthropic API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasRealApi = anthropicKey && anthropicKey.length > 20 && !anthropicKey.includes('your-');

  if (hasRealApi) {
    try {
      const prompt = buildSentimentPrompt(params);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as SentimentResult;
          return {
            result: parsed,
            model: 'claude-sonnet',
            tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          };
        }
      }
    } catch (err) {
      console.error('[sentimentPulse] Anthropic API error, falling back to local:', err);
    }
  }

  // Local mock analysis
  const { feedbacks, totalPosts, postsWithFeedback, postsSemFeedback } = params;
  const approvalRate = totalPosts > 0 ? Math.round((postsSemFeedback / totalPosts) * 100) : 0;

  // Heuristic scoring
  const longFeedbacks = feedbacks.filter(f => f.length > 50).length;
  const shortFeedbacks = feedbacks.filter(f => f.length <= 15).length;
  const directiveFeedbacks = feedbacks.filter(f =>
    f.includes('preciso') || f.includes('peço') || f.includes('coloque') || f.includes('sugiro')
  ).length;

  // Score: base from approval rate + adjustments
  let score = approvalRate + 15;
  if (directiveFeedbacks > feedbacks.length * 0.5) score -= 5; // Many directives = needs adjustment
  if (shortFeedbacks > feedbacks.length * 0.3) score += 5; // Short = trust
  score = Math.min(100, Math.max(0, score)); // Clamp after all adjustments

  const patterns: SentimentResult['dominant_patterns'] = [];

  if (directiveFeedbacks > 0) {
    patterns.push({
      type: 'specificity_request',
      frequency: directiveFeedbacks > 3 ? 'high' : 'medium',
      description: 'Cliente pede detalhes mais específicos nos conteúdos',
      examples_count: directiveFeedbacks,
      recommendation: 'Incluir mais dados concretos e nomes específicos nos posts',
    });
  }

  if (longFeedbacks > 2) {
    patterns.push({
      type: 'editorial_redirect',
      frequency: longFeedbacks > 5 ? 'high' : 'medium',
      description: 'Cliente redireciona tema ou abordagem dos posts',
      examples_count: longFeedbacks,
      recommendation: 'Revisar Brand DNA para refletir preferências de conteúdo do cliente',
    });
  }

  const result: SentimentResult = {
    sentiment_score: Math.round(score),
    trend: 'stable',
    approval_rate_first_pass: approvalRate,
    dominant_patterns: patterns,
    positive_signals: [
      `Aprova sem alteração ${postsSemFeedback} de ${totalPosts} posts (${approvalRate}%)`,
      ...(shortFeedbacks > 0 ? [`${shortFeedbacks} feedbacks curtos indicam confiança no processo`] : []),
    ],
    risk_signals: [
      ...(directiveFeedbacks > 3 ? ['Alto número de direcionamentos — AI precisa ser mais específica'] : []),
    ],
    prompt_adjustment_suggestions: [
      'Adicionar contexto do cliente (eventos, lançamentos) ao prompt de geração',
      'Reforçar uso de nomes próprios e detalhes específicos do projeto',
    ],
  };

  return { result, model: 'genOS-local-v1', tokensUsed: 0 };
}

/**
 * Run sentiment analysis for a tenant's client
 */
export async function runSentimentAnalysis(tenantId: string): Promise<SentimentResult & { id: string }> {
  // Get tenant name
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  const clientName = tenant?.name || 'Unknown';

  // Get all content items with their feedback
  const { data: items } = await supabase
    .from('content_items')
    .select('id, title, client_feedback, client_comment, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  const allItems = items || [];
  const totalPosts = allItems.length;

  // Collect non-empty feedbacks
  const feedbacks: string[] = allItems
    .map(i => i.client_feedback || i.client_comment || '')
    .filter(f => f.trim().length > 0);

  const postsWithFeedback = feedbacks.length;
  const postsSemFeedback = totalPosts - postsWithFeedback;

  if (totalPosts === 0) {
    throw new Error('No content items found for this tenant');
  }

  const { result, model, tokensUsed } = await analyzeSentiment({
    clientName,
    feedbacks,
    totalPosts,
    postsWithFeedback,
    postsSemFeedback,
  });

  // Save to sentiment_analysis table
  const { data: saved, error } = await supabase
    .from('sentiment_analysis')
    .insert({
      tenant_id: tenantId,
      sentiment_score: result.sentiment_score,
      trend: result.trend,
      approval_rate_first_pass: result.approval_rate_first_pass,
      dominant_patterns: result.dominant_patterns,
      positive_signals: result.positive_signals,
      risk_signals: result.risk_signals,
      prompt_adjustment_suggestions: result.prompt_adjustment_suggestions,
      posts_analyzed: totalPosts,
      posts_with_feedback: postsWithFeedback,
      period_start: allItems[0]?.created_at?.substring(0, 10) || null,
      period_end: allItems[allItems.length - 1]?.created_at?.substring(0, 10) || null,
      model_used: model,
      tokens_used: tokensUsed,
    })
    .select()
    .single();

  if (error) {
    console.error('[sentimentPulse] Save error:', error.message);
  }

  // Emit feed event
  const severity = result.sentiment_score >= 80 ? 'success' as const
    : result.sentiment_score >= 60 ? 'info' as const
    : result.sentiment_score >= 40 ? 'warning' as const
    : 'error' as const;

  await emitFeedEvent({
    tenant_id: tenantId,
    severity,
    category: 'sentiment',
    action: 'sentiment_analyzed',
    summary: `Sentiment '${clientName}': ${result.sentiment_score}/100 — ${
      result.sentiment_score >= 80 ? 'Excellent' :
      result.sentiment_score >= 60 ? 'Good' :
      result.sentiment_score >= 40 ? 'Attention needed' : 'Critical'
    }`,
    detail: `Approval rate: ${result.approval_rate_first_pass}%\nPatterns: ${
      result.dominant_patterns.map(p => p.description).join('; ') || 'None'
    }`,
    is_autonomous: false,
    show_toast: result.sentiment_score < 60,
  });

  return { ...result, id: saved?.id || '' };
}

/**
 * Get latest sentiment for a tenant
 */
export async function getLatestSentiment(tenantId: string): Promise<any | null> {
  const { data } = await supabase
    .from('sentiment_analysis')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}
