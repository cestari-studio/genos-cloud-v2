-- ============================================================
-- genOS™ v5.0.0 - Foundation: Hardened RLS & AI Engine RPCs
-- ============================================================

-- 1. AI Engine: build_agent_envelope
-- Unified context aggregator for Content Factory
CREATE OR REPLACE FUNCTION public.build_agent_envelope(
    p_tenant_id UUID,
    p_prompt_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_brand_dna RECORD;
    v_system_prompt RECORD;
    v_compliance_rules JSONB;
    v_result JSONB;
BEGIN
    -- Get Brand DNA
    SELECT * INTO v_brand_dna FROM public.brand_dna WHERE tenant_id = p_tenant_id;
    
    -- Get System Prompt
    IF p_prompt_name IS NOT NULL THEN
        SELECT * INTO v_system_prompt 
        FROM public.ai_prompts 
        WHERE tenant_id = p_tenant_id 
          AND name = p_prompt_name 
          AND is_active = true
        LIMIT 1;
    ELSE
        SELECT * INTO v_system_prompt 
        FROM public.ai_prompts 
        WHERE tenant_id = p_tenant_id 
          AND is_primary = true 
          AND is_active = true
        LIMIT 1;
    END IF;

    -- Get Compliance Rules
    SELECT jsonb_agg(cr) INTO v_compliance_rules 
    FROM public.constraint_rules cr 
    WHERE tenant_id = p_tenant_id AND enabled = true;

    -- Build the envelope
    v_result := jsonb_build_object(
        'brand_dna', row_to_json(v_brand_dna)::jsonb,
        'system_prompt', row_to_json(v_system_prompt)::jsonb,
        'compliance_rules', COALESCE(v_compliance_rules, '[]'::jsonb),
        'metadata', jsonb_build_object(
            'generated_at', now(),
            'tenant_id', p_tenant_id
        )
    );

    RETURN v_result;
END;
$$;

-- 2. Security: is_claims_admin()
-- Restrict to service_role and verified admins only
CREATE OR REPLACE FUNCTION public.is_claims_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict check: only service_role or users with explicit master role in JWT
  RETURN (
    current_setting('role') = 'service_role' OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_claims_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_claims_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_claims_admin() TO service_role;


-- 3. RLS HARDENING - Optimized for Query Planner
-- Using explicit sub-queries as per genOS™ v5.0.0 standards

-- Drop old hierarchical policies
DROP POLICY IF EXISTS "Hierarchical Tenant Visibility" ON public.tenants;
DROP POLICY IF EXISTS "Hierarchical Tenant Modification" ON public.tenants;
DROP POLICY IF EXISTS "Hierarchical Tenant Members Visibility" ON public.tenant_members;
DROP POLICY IF EXISTS "Hierarchical Brand DNA Visibility" ON public.brand_dna;
DROP POLICY IF EXISTS "Hierarchical Brand DNA Modification" ON public.brand_dna;
DROP POLICY IF EXISTS "Hierarchical Posts Visibility" ON public.posts;
DROP POLICY IF EXISTS "Hierarchical Posts Modification" ON public.posts;
DROP POLICY IF EXISTS "Hierarchical Config Visibility" ON public.tenant_config;
DROP POLICY IF EXISTS "Hierarchical Billing Visibility" ON public.billing_contracts;

-- Enable RLS globally
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brand_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_members ENABLE ROW LEVEL SECURITY;

-- Apply Hardened Policies
-- Syntax: USING (tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)

-- A. Tenants
CREATE POLICY "v5_Tenant_Silo" ON public.tenants
    FOR SELECT USING (
        id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR parent_tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- B. Brand DNA
CREATE POLICY "v5_Brand_DNA_Silo" ON public.brand_dna
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- C. Content Items / Posts
CREATE POLICY "v5_Content_Silo" ON public.content_items
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

CREATE POLICY "v5_Posts_Silo" ON public.posts
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- D. Billing & Config
CREATE POLICY "v5_Billing_Silo" ON public.billing_contracts
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

CREATE POLICY "v5_Config_Silo" ON public.tenant_config
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- E. Finance & Wallet
CREATE POLICY "v5_Wallet_Silo" ON public.credit_wallets
    FOR SELECT USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

COMMENT ON TABLE public.tenants IS 'genOS v5.0.0: Zero-Leak Security enabled';
