-- Migration: Foundation genOS v5.0
-- Adds missing Brand DNA columns and SaaS Onboarding flags

-- 1. Evolve brand_dna table
ALTER TABLE public.brand_dna 
ADD COLUMN IF NOT EXISTS brand_story TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS personality_traits TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS editorial_pillars JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS char_limits JSONB DEFAULT '{"reels_title": 60, "reels_caption": 2200, "static_title": 60, "static_caption": 2200, "carousel_card_text": 150}',
ADD COLUMN IF NOT EXISTS cta_defaults JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tone_modifiers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS target_audience_v2 JSONB DEFAULT '{}';

-- 2. Migrate legacy data if necessary (JSON to columns)
-- This is a safety step for existing tenants
UPDATE public.brand_dna SET 
    char_limits = COALESCE(content_rules->'char_limits', char_limits),
    editorial_pillars = COALESCE(content_rules->'editorial_pillars', editorial_pillars)
WHERE content_rules IS NOT NULL;

-- 3. Update tenant_config for SaaS flow
ALTER TABLE public.tenant_config
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT false;

-- 4. New Table for Contracts (Auditability)
CREATE TABLE IF NOT EXISTS public.billing_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_url TEXT NOT NULL,
    version TEXT DEFAULT '1.0.0',
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- RLS for Contracts
ALTER TABLE public.billing_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can view own contracts" ON public.billing_contracts FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));

-- 5. Add model_name to usage_logs for detailed Analytics
ALTER TABLE public.usage_logs
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gemini-2.0-flash',
ADD COLUMN IF NOT EXISTS tokens_input INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_output INT DEFAULT 0;

COMMENT ON TABLE public.brand_dna IS 'Foundation v5.0: Enhanced identity structure';
