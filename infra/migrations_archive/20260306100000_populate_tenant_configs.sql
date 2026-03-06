-- Migration: Populate Missing Tenant Configurations
-- Ensures all 16 tenants have a row in tenant_config

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        INSERT INTO public.tenant_config (
            tenant_id, 
            post_limit, 
            token_balance, 
            onboarding_completed, 
            contract_signed
        )
        VALUES (
            t.id, 
            24,   -- Default legacy limit
            5000, -- Default baseline
            true, -- Assume true for existing legacy tenants
            true  -- Assume true for existing legacy tenants
        )
        ON CONFLICT (tenant_id) DO NOTHING;
    END LOOP;
END;
$$;
