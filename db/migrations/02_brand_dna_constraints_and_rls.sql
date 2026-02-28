-- db/migrations/02_brand_dna_constraints_and_rls.sql

-- 1. Extend brand_dna for the Constraint Kernel rules
ALTER TABLE public.brand_dna 
ADD COLUMN IF NOT EXISTS content_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS strict_compliance boolean NOT NULL DEFAULT true;

-- 2. Drop any existing generic policies on brand_dna to enforce strict Role-Based Access Control (RBAC)
DROP POLICY IF EXISTS "Tenant isolation for brand_dna" ON public.brand_dna;
DROP POLICY IF EXISTS "Enable read access for tenant members" ON public.brand_dna;
DROP POLICY IF EXISTS "Enable write access for agency operators" ON public.brand_dna;

-- 3. Create strict RLS for brand_dna based on Roles (Client, Workplace, Enterprise)
-- Read Policy: All authenticated members attached to the tenant can view the DNA.
CREATE POLICY "DNA: Enable read access for tenant members" ON public.brand_dna
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    );

-- Write Policy: Only Workplace and Enterprise roles can modify the DNA settings.
-- We check custom claims inside the JWT's app_metadata or user_metadata for the specific role.
CREATE POLICY "DNA: Enable write access for agency operators" ON public.brand_dna
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()) 
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'genOS_role') IN ('Workplace', 'Enterprise')
            OR (auth.jwt() -> 'user_metadata' ->> 'genOS_role') IN ('Workplace', 'Enterprise')
        )
    );

-- 4. Apply the exact same RLS logic for audience_analytics
DROP POLICY IF EXISTS "Tenant isolation for audience_analytics" ON public.audience_analytics;
DROP POLICY IF EXISTS "Audience: Enable read access for tenant members" ON public.audience_analytics;
DROP POLICY IF EXISTS "Audience: Enable write access for agency operators" ON public.audience_analytics;

CREATE POLICY "Audience: Enable read access for tenant members" ON public.audience_analytics
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Audience: Enable write access for agency operators" ON public.audience_analytics
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()) 
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'genOS_role') IN ('Workplace', 'Enterprise')
            OR (auth.jwt() -> 'user_metadata' ->> 'genOS_role') IN ('Workplace', 'Enterprise')
        )
    );
