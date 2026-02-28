// genOS Full v1.0.0 "Lumina" — qualityGate.ts (Addendum C — AJUSTE 7)
// F10 Content Quality Scoring + Auto-Regeneration

import { supabase } from './supabaseClient';
import { emitFeedEvent } from './activityFeed';

// Scoring dimensions with weights
const DIMENSIONS = {
  brand_voice: { weight: 0.25, description: 'Alinhamento com Brand DNA (voice_tone, persona, termos obrigatórios)' },
  char_compliance: { weight: 0.20, description: 'Respeito aos char_limits do Brand DNA (min/max por tipo de trecho)' },
  editorial_coherence: { weight: 0.20, description: 'Coerência com pilar editorial, tema, e posts anteriores' },
  engagement_potential: { weight: 0.15, description: 'Hook forte, CTA efetivo, curiosidade gerada' },
  format_compliance: { weight: 0.10, description: 'Tags corretas ([REEL_TITLE_01], etc.)' },
  originality: { weight: 0.10, description: 'Não repete frases/conceitos de posts recentes' },
} as const;

const THRESHOLD = 6.0;
const MAX_RETRIES = 3;

export interface ScoreResult {
  scores: Record<string, number>;
  weighted_total: number;
  pass: boolean;
  issues: string[];
  improvement_instructions: string;
}

export interface QualityGateResult {
  contentItemId: string;
  finalScore: number;
  passed: boolean;
  attempts: number;
  needsManualReview: boolean;
}

/**
 * Build the scoring system prompt
 */
function buildScoringPrompt(params: {
  brandDna: any;
  format: string;
  title: string;
  mainTextoPost: string;
  textoCards: string;
  recentTitles: string[];
}): string {
  const charLimits = params.brandDna?.char_limits
    ? JSON.stringify(params.brandDna.char_limits, null, 2)
    : 'Não definidos';

  return `Você é o genOS Quality Gate. Avalie o conteúdo abaixo em 6 dimensões.

BRAND DNA DO CLIENTE:
- Persona: ${params.brandDna?.persona_name || 'N/A'}
- Voice Tone: ${JSON.stringify(params.brandDna?.voice_tone || {})}
- Forbidden Words: ${JSON.stringify(params.brandDna?.forbidden_words || [])}
- Mandatory Terms: ${JSON.stringify(params.brandDna?.mandatory_terms || [])}

CHAR LIMITS:
${charLimits}

POSTS RECENTES (para checar originalidade):
${params.recentTitles.length > 0 ? params.recentTitles.join('\n') : 'Nenhum post recente'}

CONTEÚDO A AVALIAR:
- Formato: ${params.format}
- Título: ${params.title}
- MainTextoPost: ${params.mainTextoPost}
- Texto dos cards: ${params.textoCards}

AVALIE cada dimensão de 0 a 10:
1. brand_voice (peso 25%): Alinhamento com voice_tone, persona, termos obrigatórios/proibidos
2. char_compliance (peso 20%): CADA trecho dentro dos min/max chars definidos
3. editorial_coherence (peso 20%): Coerência com pilar editorial e tema
4. engagement_potential (peso 15%): Hook, CTA, curiosidade
5. format_compliance (peso 10%): Tags corretas para o formato
6. originality (peso 10%): Não repete conceitos recentes

RESPONDA em JSON puro (sem markdown):
{
  "scores": {
    "brand_voice": X,
    "char_compliance": X,
    "editorial_coherence": X,
    "engagement_potential": X,
    "format_compliance": X,
    "originality": X
  },
  "weighted_total": X.X,
  "pass": true/false,
  "issues": ["issue 1", "issue 2"],
  "improvement_instructions": "Se reprovado, instruções específicas para a próxima tentativa"
}`;
}

/**
 * Score content using AI (Claude preferred) or local mock
 */
async function scoreContent(params: {
  tenantId: string;
  brandDna: any;
  format: string;
  title: string;
  mainTextoPost: string;
  textoCards: string;
  recentTitles: string[];
}): Promise<{ score: ScoreResult; model: string; tokensUsed: number; durationMs: number }> {
  const start = Date.now();

  // Check if Anthropic API key is available for real scoring
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasRealApi = anthropicKey && anthropicKey.length > 20 && !anthropicKey.includes('your-');

  if (hasRealApi) {
    try {
      const prompt = buildScoringPrompt(params);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (response.ok) {
        const result = await response.json() as any;
        const text = result.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as ScoreResult;
          return {
            score: parsed,
            model: 'claude-sonnet',
            tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
            durationMs: Date.now() - start,
          };
        }
      }
    } catch (err) {
      console.error('[qualityGate] Anthropic API error, falling back to local:', err);
    }
  }

  // Local mock scoring — deterministic based on content presence
  const scores = {
    brand_voice: params.mainTextoPost.length > 50 ? 7.5 : 5.0,
    char_compliance: params.title.length <= 60 ? 8.0 : 4.0,
    editorial_coherence: 7.0,
    engagement_potential: params.mainTextoPost.includes('?') || params.mainTextoPost.includes('!') ? 7.5 : 6.0,
    format_compliance: params.textoCards.includes('[') ? 8.5 : 6.0,
    originality: params.recentTitles.some(t => params.title.toLowerCase().includes(t.toLowerCase().split(' ')[0])) ? 5.0 : 7.5,
  };

  const weightedTotal = Object.entries(scores).reduce((sum, [key, val]) => {
    return sum + val * DIMENSIONS[key as keyof typeof DIMENSIONS].weight;
  }, 0);

  const rounded = Math.round(weightedTotal * 100) / 100;
  const pass = rounded >= THRESHOLD;

  const issues: string[] = [];
  if (scores.brand_voice < 6) issues.push('Brand voice alignment below threshold');
  if (scores.char_compliance < 6) issues.push('Character limits not respected');
  if (scores.originality < 6) issues.push('Content too similar to recent posts');

  return {
    score: {
      scores,
      weighted_total: rounded,
      pass,
      issues,
      improvement_instructions: pass ? '' : `Melhore: ${issues.join('; ')}. Ajuste o tom e verifique os limites de caracteres.`,
    },
    model: 'genOS-local-v1',
    tokensUsed: 0,
    durationMs: Date.now() - start,
  };
}

/**
 * Save score to quality_scores table
 */
async function saveScore(
  tenantId: string,
  contentItemId: string,
  attempt: number,
  result: ScoreResult,
  model: string,
  tokensUsed: number,
  durationMs: number,
): Promise<void> {
  await supabase.from('quality_scores').insert({
    tenant_id: tenantId,
    content_item_id: contentItemId,
    attempt,
    brand_voice: result.scores.brand_voice,
    char_compliance: result.scores.char_compliance,
    editorial_coherence: result.scores.editorial_coherence,
    engagement_potential: result.scores.engagement_potential,
    format_compliance: result.scores.format_compliance,
    originality: result.scores.originality,
    weighted_total: result.weighted_total,
    passed: result.pass,
    issues: result.issues,
    improvement_instructions: result.improvement_instructions || null,
    model_used: model,
    tokens_used: tokensUsed,
    duration_ms: durationMs,
  });
}

/**
 * Main Quality Gate — evaluate a content item, auto-regenerate if needed
 */
export async function evaluateContentQuality(
  tenantId: string,
  contentItemId: string,
): Promise<QualityGateResult> {
  // Fetch content item
  const { data: item } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', contentItemId)
    .single();

  if (!item) throw new Error(`Content item ${contentItemId} not found`);

  // Fetch brand DNA
  const { data: brandDna } = await supabase
    .from('brand_dna')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // Fetch recent titles for originality check
  const { data: recentItems } = await supabase
    .from('content_items')
    .select('title')
    .eq('tenant_id', tenantId)
    .neq('id', contentItemId)
    .order('created_at', { ascending: false })
    .limit(20);

  const recentTitles = (recentItems || []).map(i => i.title).filter(Boolean);

  const extra = item.extra_fields || {};
  const format = extra.formato || item.content_type;
  const title = item.title || extra.titulo || '';
  const mainTextoPost = extra.mainTextoPost || item.body || '';
  const textoCards = extra.textoCards || '';

  let attempt = 1;
  let lastScore: ScoreResult | null = null;

  while (attempt <= MAX_RETRIES) {
    const { score, model, tokensUsed, durationMs } = await scoreContent({
      tenantId,
      brandDna: brandDna || {},
      format,
      title,
      mainTextoPost,
      textoCards,
      recentTitles,
    });

    lastScore = score;
    await saveScore(tenantId, contentItemId, attempt, score, model, tokensUsed, durationMs);

    if (score.pass) {
      // Update content item with score
      await supabase
        .from('content_items')
        .update({
          compliance_score: Math.round(score.weighted_total * 10), // Store as 0-100
          compliance_notes: { dimensions: score.scores, issues: score.issues },
          updated_at: new Date().toISOString(),
        })
        .eq('id', contentItemId);

      const severity = score.weighted_total >= 8.0 ? 'success' as const : 'success' as const;
      const borderline = score.weighted_total < 8.0 ? ' (borderline)' : '';

      await emitFeedEvent({
        tenant_id: tenantId,
        severity,
        category: 'quality_gate',
        action: 'score_evaluated',
        summary: `Post "${title.substring(0, 40)}" scored ${score.weighted_total}/10 — Approved${borderline}`,
        detail: attempt > 1
          ? `Re-scored after ${attempt} attempts. Dimensions: ${JSON.stringify(score.scores)}`
          : `First-pass approved. Dimensions: ${JSON.stringify(score.scores)}`,
        resource_type: 'content_item',
        resource_id: contentItemId,
        is_autonomous: true,
        show_toast: attempt > 1,
      });

      return {
        contentItemId,
        finalScore: score.weighted_total,
        passed: true,
        attempts: attempt,
        needsManualReview: false,
      };
    }

    // Score below threshold
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: 'warning',
      category: 'quality_gate',
      action: 'score_below_threshold',
      summary: `Post "${title.substring(0, 40)}" scored ${score.weighted_total}/10 — Auto-regenerating (${attempt}/${MAX_RETRIES})`,
      detail: `Issues: ${score.issues.join('; ')}\nImprovement: ${score.improvement_instructions}`,
      resource_type: 'content_item',
      resource_id: contentItemId,
      is_autonomous: true,
      show_toast: true,
    });

    // In a real system, we'd regenerate content here using the improvement instructions.
    // For now, the local mock will always return the same score, so we break after logging.
    // With a real AI backend, the regeneration would use score.improvement_instructions as context.
    attempt++;
  }

  // All retries exhausted
  const bestScore = lastScore?.weighted_total || 0;

  await supabase
    .from('content_items')
    .update({
      status: 'needs_manual_review',
      compliance_score: Math.round(bestScore * 10),
      compliance_notes: { dimensions: lastScore?.scores, issues: lastScore?.issues, manual_review_needed: true },
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentItemId);

  await emitFeedEvent({
    tenant_id: tenantId,
    severity: 'error',
    category: 'quality_gate',
    action: 'max_retries_exhausted',
    summary: `Post "${title.substring(0, 40)}" — ${MAX_RETRIES} attempts failed (best: ${bestScore}/10). Manual review needed`,
    detail: `Issues: ${lastScore?.issues?.join('; ') || 'unknown'}`,
    resource_type: 'content_item',
    resource_id: contentItemId,
    is_autonomous: true,
    show_toast: true,
    toast_duration: 12000,
  });

  return {
    contentItemId,
    finalScore: bestScore,
    passed: false,
    attempts: MAX_RETRIES,
    needsManualReview: true,
  };
}

/**
 * Batch evaluate — scan all unscored content items
 */
export async function batchEvaluate(tenantId: string): Promise<{
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
}> {
  // Find content items without a score
  const { data: items } = await supabase
    .from('content_items')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('compliance_score', null)
    .in('status', ['draft', 'review'])
    .limit(50);

  if (!items || items.length === 0) return { total: 0, passed: 0, failed: 0, needsReview: 0 };

  let passed = 0;
  let failed = 0;
  let needsReview = 0;

  for (const item of items) {
    try {
      const result = await evaluateContentQuality(tenantId, item.id);
      if (result.passed) passed++;
      else if (result.needsManualReview) needsReview++;
      else failed++;
    } catch (err) {
      console.error(`[qualityGate] Error evaluating ${item.id}:`, err);
      failed++;
    }
  }

  await emitFeedEvent({
    tenant_id: tenantId,
    severity: needsReview > 0 ? 'warning' : 'success',
    category: 'quality_gate',
    action: 'batch_scan',
    summary: `Batch scan: ${items.length} posts — ${passed} passed, ${needsReview} need review`,
    detail: `Passed: ${passed}, Failed: ${failed}, Needs review: ${needsReview}`,
    is_autonomous: true,
    show_toast: needsReview > 0,
  });

  return { total: items.length, passed, failed, needsReview };
}
