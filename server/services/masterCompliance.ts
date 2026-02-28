// genOS Full v1.0.0 "Lumina" — masterCompliance.ts
// 4-layer content validation: 25% each = score 0-100

import { supabase } from './supabaseClient';
import { applyConstraintKernel } from './constraintKernel';
import { DNAConstraints } from '../types/dna';

export interface ComplianceCheck {
  pass: boolean;
  score: number; // 0-25
  details: string;
}

export interface ComplianceResult {
  score: number; // 0-100
  checks: {
    forbidden_words: ComplianceCheck;
    tone_alignment: ComplianceCheck;
    length_compliance: ComplianceCheck;
    brand_consistency: ComplianceCheck;
    constraint_kernel: ComplianceCheck;
  };
  suggestions: string[];
  verdict: 'approved' | 'needs_revision' | 'rejected';
  transformedContent?: string;
}

interface BrandDna {
  forbidden_words: string[];
  voice_tone: Record<string, unknown>;
  content_rules: Record<string, unknown>;
  brand_values: Record<string, unknown>;
  persona_name: string;
}

interface ComplianceRule {
  rule_type: string;
  rule_config: Record<string, unknown>;
  severity: string;
}

/**
 * Layer 1: Forbidden Words Check (25%)
 */
function checkForbiddenWords(content: string, forbiddenWords: string[]): ComplianceCheck {
  const lowerContent = content.toLowerCase();
  const found = forbiddenWords.filter(word => lowerContent.includes(word.toLowerCase()));

  if (found.length === 0) {
    return { pass: true, score: 25, details: 'Nenhuma palavra proibida encontrada.' };
  }

  return {
    pass: false,
    score: 0,
    details: `Palavras proibidas encontradas: ${found.join(', ')}`,
  };
}

/**
 * Layer 2: Tone Alignment Check (25%)
 */
function checkToneAlignment(
  content: string,
  voiceTone: Record<string, unknown>
): ComplianceCheck {
  const suggestions: string[] = [];
  let score = 25;

  // Check for overly casual language if formality is expected
  const formality = voiceTone.formality as string || 'professional-casual';
  const casualWords = ['tipo', 'mano', 'cara', 'véi', 'tá ligado', 'kkkk', 'kkk', 'haha'];
  const foundCasual = casualWords.filter(w => content.toLowerCase().includes(w));

  if (formality.includes('professional') && foundCasual.length > 0) {
    score -= 10;
    suggestions.push(`Linguagem muito casual: ${foundCasual.join(', ')}`);
  }

  // Check energy level
  const energy = voiceTone.energy as string || 'high';
  if (energy === 'high') {
    const hasExclamation = content.includes('!');
    const hasAction = /\b(descubra|transforme|conquiste|acelere|evolua)\b/i.test(content);
    if (!hasExclamation && !hasAction) {
      score -= 5;
      suggestions.push('Energia baixa — considere adicionar CTAs dinâmicos ou exclamações.');
    }
  }

  return {
    pass: score >= 15,
    score: Math.max(0, score),
    details: suggestions.length > 0 ? suggestions.join(' | ') : 'Tom alinhado com o Brand DNA.',
  };
}

/**
 * Layer 3: Length Compliance Check (25%)
 */
function checkLengthCompliance(
  content: string,
  contentType: string,
  rules: ComplianceRule[]
): ComplianceCheck {
  const lengthRule = rules.find(r => r.rule_type === 'length_limit');
  if (!lengthRule) {
    return { pass: true, score: 25, details: 'Sem regra de comprimento definida.' };
  }

  const limits = lengthRule.rule_config as Record<string, { min: number; max: number }>;
  const typeLimit = limits[contentType];

  if (!typeLimit) {
    return { pass: true, score: 25, details: `Sem limite definido para tipo '${contentType}'.` };
  }

  const length = content.length;
  if (length < typeLimit.min) {
    return {
      pass: false,
      score: 10,
      details: `Conteúdo muito curto: ${length} caracteres (mínimo: ${typeLimit.min}).`,
    };
  }
  if (length > typeLimit.max) {
    return {
      pass: false,
      score: 10,
      details: `Conteúdo muito longo: ${length} caracteres (máximo: ${typeLimit.max}).`,
    };
  }

  return {
    pass: true,
    score: 25,
    details: `Comprimento OK: ${length} caracteres (${typeLimit.min}-${typeLimit.max}).`,
  };
}

/**
 * Layer 4: Brand Consistency Check (25%)
 */
function checkBrandConsistency(
  content: string,
  brandDna: BrandDna,
  rules: ComplianceRule[]
): ComplianceCheck {
  let score = 25;
  const issues: string[] = [];

  // Check for mandatory terms usage
  const mandatoryTerms = (brandDna.voice_tone as any)?.vocabulario_chave as string[] || [];
  const lowerContent = content.toLowerCase();
  const usedTerms = mandatoryTerms.filter(term => lowerContent.includes(term.toLowerCase()));
  const termUsageRate = mandatoryTerms.length > 0 ? usedTerms.length / mandatoryTerms.length : 1;

  if (termUsageRate < 0.3) {
    score -= 10;
    issues.push(`Poucos termos de marca usados (${usedTerms.length}/${mandatoryTerms.length}).`);
  }

  // Check hashtag rules
  const hashtagRule = rules.find(r => r.rule_type === 'hashtag_rule');
  if (hashtagRule) {
    const config = hashtagRule.rule_config as { min: number; max: number; branded_tags: string[] };
    const hashtags = content.match(/#\w+/g) || [];

    if (hashtags.length < (config.min || 0)) {
      score -= 5;
      issues.push(`Poucas hashtags: ${hashtags.length} (mínimo: ${config.min}).`);
    }
    if (hashtags.length > (config.max || 15)) {
      score -= 5;
      issues.push(`Muitas hashtags: ${hashtags.length} (máximo: ${config.max}).`);
    }

    const brandedTags = config.branded_tags || [];
    const missingBranded = brandedTags.filter(
      tag => !hashtags.some(h => h.toLowerCase() === tag.toLowerCase())
    );
    if (missingBranded.length > 0 && hashtags.length > 0) {
      score -= 5;
      issues.push(`Hashtags de marca ausentes: ${missingBranded.join(', ')}.`);
    }
  }

  return {
    pass: score >= 15,
    score: Math.max(0, score),
    details: issues.length > 0 ? issues.join(' | ') : 'Consistência de marca OK.',
  };
}

/**
 * Run full MasterCompliance check on content
 */
export async function checkCompliance(
  tenantId: string,
  content: string,
  contentType: string
): Promise<ComplianceResult> {
  // Fetch Brand DNA
  const { data: dna } = await supabase
    .from('brand_dna')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  const brandDna: BrandDna = {
    forbidden_words: dna?.forbidden_words || [],
    voice_tone: dna?.voice_tone || {},
    content_rules: dna?.content_rules || {},
    brand_values: dna?.brand_values || {},
    persona_name: dna?.persona_name || '',
  };

  // Fetch compliance rules
  const { data: rulesData } = await supabase
    .from('compliance_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const rules: ComplianceRule[] = (rulesData || []).map(r => ({
    rule_type: r.rule_type,
    rule_config: typeof r.rule_config === 'object' ? r.rule_config : {},
    severity: r.severity || 'medium',
  }));

  // Run Constraint Kernel (Strict baseline limits)
  const kernelResult = applyConstraintKernel(content, contentType, brandDna.content_rules as any as DNAConstraints);

  // Run all checks
  const checks = {
    forbidden_words: checkForbiddenWords(kernelResult.transformedContent, brandDna.forbidden_words),
    tone_alignment: checkToneAlignment(kernelResult.transformedContent, brandDna.voice_tone),
    length_compliance: checkLengthCompliance(kernelResult.transformedContent, contentType, rules),
    brand_consistency: checkBrandConsistency(kernelResult.transformedContent, brandDna, rules),
    constraint_kernel: {
      pass: kernelResult.isValid,
      score: kernelResult.isValid ? 25 : 0, // Extra layer logic or penalty
      details: kernelResult.isValid ? 'Constraint Kernel validado com sucesso.' : kernelResult.errors.join(' | ')
    }
  };

  // Adjusted scoring to account for the new strict layer (normalize to 100)
  const rawScore = checks.forbidden_words.score +
    checks.tone_alignment.score +
    checks.length_compliance.score +
    checks.brand_consistency.score;

  // If constraint kernel fails entirely, apply a heavy penalty
  const totalScore = kernelResult.isValid ? rawScore : Math.max(0, rawScore - 30);

  // Collect suggestions
  const suggestions: string[] = [...kernelResult.errors];
  for (const [key, check] of Object.entries(checks)) {
    if (key !== 'constraint_kernel' && !check.pass) {
      suggestions.push(check.details);
    }
  }

  // Determine verdict
  let verdict: 'approved' | 'needs_revision' | 'rejected';
  if (totalScore >= 75 && kernelResult.isValid) {
    verdict = 'approved';
  } else if (totalScore >= 40) {
    verdict = 'needs_revision';
  } else {
    verdict = 'rejected';
  }

  return {
    score: totalScore,
    checks,
    suggestions,
    verdict,
    transformedContent: kernelResult.transformedContent
  };
}
