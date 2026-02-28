// genOS Full v1.0.0 "Lumina" — config/pricing.ts
// Real API cost constants per model (cost per 1K tokens in USD)
// Updated: 2025-02 — source: official provider pricing pages

export interface ModelCost {
  provider: string;
  model: string;
  inputPer1k: number;   // cost per 1K input tokens
  outputPer1k: number;  // cost per 1K output tokens
  blendedPer1k: number; // blended average (input-heavy estimate)
}

/**
 * Real API costs per model — used as agency_cost baseline
 * Blended = weighted average assuming ~70% input, 30% output
 */
export const MODEL_COSTS: Record<string, ModelCost> = {
  // Google Gemini
  'gemini-2.0-flash': {
    provider: 'google',
    model: 'gemini-2.0-flash',
    inputPer1k: 0.0001,
    outputPer1k: 0.0004,
    blendedPer1k: 0.00019, // 0.7*0.0001 + 0.3*0.0004
  },
  'gemini-1.5-pro': {
    provider: 'google',
    model: 'gemini-1.5-pro',
    inputPer1k: 0.00125,
    outputPer1k: 0.005,
    blendedPer1k: 0.002375,
  },

  // Anthropic Claude
  'claude-sonnet-4-5-20250929': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    blendedPer1k: 0.0066,
  },
  'claude-haiku-3-5-20241022': {
    provider: 'anthropic',
    model: 'claude-haiku-3-5-20241022',
    inputPer1k: 0.0008,
    outputPer1k: 0.004,
    blendedPer1k: 0.00176,
  },

  // Local fallback — zero cost
  'genOS-local-v1': {
    provider: 'local',
    model: 'genOS-local-v1',
    inputPer1k: 0,
    outputPer1k: 0,
    blendedPer1k: 0,
  },
};

/**
 * Get model cost config, fallback to blended estimate
 */
export function getModelCost(model: string): ModelCost {
  return MODEL_COSTS[model] || {
    provider: 'unknown',
    model,
    inputPer1k: 0.001,
    outputPer1k: 0.003,
    blendedPer1k: 0.0016,
  };
}

/**
 * Calculate agency cost (real API cost) from token counts
 */
export function calculateAgencyCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = getModelCost(model);
  return (inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k;
}

/**
 * Calculate agency cost from total tokens (blended estimate)
 */
export function calculateAgencyCostBlended(model: string, totalTokens: number): number {
  const costs = getModelCost(model);
  return (totalTokens / 1000) * costs.blendedPer1k;
}

/**
 * Default markup percentage when no pricing config is found
 */
export const DEFAULT_MARKUP_PCT = 30;
