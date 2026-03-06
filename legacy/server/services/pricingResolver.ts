// genOS Full v1.0.0 "Lumina" — services/pricingResolver.ts
// Resolves client pricing with priority: tenant override > tier > global fallback

import { supabase } from './supabaseClient';
import {
  calculateAgencyCost,
  calculateAgencyCostBlended,
  DEFAULT_MARKUP_PCT,
} from '../config/pricing';

export interface PricingResult {
  agencyCostUsd: number;
  clientCostUsd: number;
  marginUsd: number;
  pricingStrategy: string;
  pricingConfigId: string | null;
  markupPct: number;
  flatFeePer1kTokens: number;
}

interface PricingConfig {
  id: string;
  strategy: string;
  markup_pct: number;
  flat_fee_per_1k_tokens: number | null;
}

/**
 * Resolve pricing for a given tenant + provider + model
 * Priority: tenant-specific > tier-based > global fallback
 */
export async function resolvePricing(
  tenantId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<PricingResult> {
  // 1. Calculate real agency cost
  const agencyCostUsd = calculateAgencyCost(model, inputTokens, outputTokens);

  // 2. Find pricing config with priority resolution
  const config = await findPricingConfig(tenantId, provider, model);

  // 3. Calculate client cost
  const markupPct = config?.markup_pct ?? DEFAULT_MARKUP_PCT;
  const flatFee = config?.flat_fee_per_1k_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  const markupAmount = agencyCostUsd * (markupPct / 100);
  const flatFeeAmount = (totalTokens / 1000) * flatFee;
  const clientCostUsd = agencyCostUsd + markupAmount + flatFeeAmount;

  return {
    agencyCostUsd: round6(agencyCostUsd),
    clientCostUsd: round6(clientCostUsd),
    marginUsd: round6(clientCostUsd - agencyCostUsd),
    pricingStrategy: config?.strategy || 'default',
    pricingConfigId: config?.id || null,
    markupPct,
    flatFeePer1kTokens: flatFee,
  };
}

/**
 * Resolve pricing using blended cost estimate (when input/output split is unknown)
 */
export async function resolvePricingBlended(
  tenantId: string,
  provider: string,
  model: string,
  totalTokens: number
): Promise<PricingResult> {
  const agencyCostUsd = calculateAgencyCostBlended(model, totalTokens);
  const config = await findPricingConfig(tenantId, provider, model);

  const markupPct = config?.markup_pct ?? DEFAULT_MARKUP_PCT;
  const flatFee = config?.flat_fee_per_1k_tokens ?? 0;

  const markupAmount = agencyCostUsd * (markupPct / 100);
  const flatFeeAmount = (totalTokens / 1000) * flatFee;
  const clientCostUsd = agencyCostUsd + markupAmount + flatFeeAmount;

  return {
    agencyCostUsd: round6(agencyCostUsd),
    clientCostUsd: round6(clientCostUsd),
    marginUsd: round6(clientCostUsd - agencyCostUsd),
    pricingStrategy: config?.strategy || 'default',
    pricingConfigId: config?.id || null,
    markupPct,
    flatFeePer1kTokens: flatFee,
  };
}

/**
 * Find pricing config with priority:
 * 1. tenant-specific (strategy = 'tenant', matching tenant_id)
 * 2. tier-based (strategy = 'tier', matching tenant's plan)
 * 3. global fallback (strategy = 'global')
 */
async function findPricingConfig(
  tenantId: string,
  provider: string,
  model: string
): Promise<PricingConfig | null> {
  // 1. Try tenant-specific
  const { data: tenantConfig } = await supabase
    .from('pricing_config')
    .select('id, strategy, markup_pct, flat_fee_per_1k_tokens')
    .eq('strategy', 'tenant')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('model', model)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (tenantConfig) return tenantConfig as PricingConfig;

  // 2. Try tier-based — need tenant's plan
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (tenant?.plan) {
    const { data: tierConfig } = await supabase
      .from('pricing_config')
      .select('id, strategy, markup_pct, flat_fee_per_1k_tokens')
      .eq('strategy', 'tier')
      .eq('tier', tenant.plan)
      .eq('provider', provider)
      .eq('model', model)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (tierConfig) return tierConfig as PricingConfig;
  }

  // 3. Global fallback
  const { data: globalConfig } = await supabase
    .from('pricing_config')
    .select('id, strategy, markup_pct, flat_fee_per_1k_tokens')
    .eq('strategy', 'global')
    .eq('provider', provider)
    .eq('model', model)
    .eq('is_active', true)
    .limit(1)
    .single();

  return globalConfig as PricingConfig | null;
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
