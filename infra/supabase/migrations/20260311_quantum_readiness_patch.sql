-- genOS™ v5.0.0 - IBM Quantum Readiness Remediation Patch v5.1
-- Remediation for Audit Prompts 1-4

-- 1. Extend Schema for Quantum Telemetry
ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS qhe_score FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS quantum_metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.matrix_assets 
    ADD COLUMN IF NOT EXISTS qhe_score FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS quantum_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Audit Trail Enrichment
ALTER TABLE public.usage_logs 
    ADD COLUMN IF NOT EXISTS quantum_operation_id UUID;

-- 3. Database Indexing Optimization (Quantum-Scale)
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_matrix_assets_tenant_id ON public.matrix_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_quantum_op ON public.usage_logs(quantum_operation_id);

-- 4. RLS Hardening (Matrix Assets Silo)
-- Drop the insecure policy
DROP POLICY IF EXISTS "Public Matrix Assets View" ON public.matrix_assets;
DROP POLICY IF EXISTS "Matrix Assets User Management" ON public.matrix_assets;

-- Implement mandatory Tenant-Silo pattern
ALTER TABLE public.matrix_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v5_Matrix_Assets_Silo" ON public.matrix_assets
    FOR ALL 
    TO authenticated
    USING (
        tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
        OR public.is_authorized_for_tenant(tenant_id) -- Master Bypass
    );

-- 5. FinOps Integration (Credit Waiver for Quantum Validation)
-- Placeholder for future quantum-pulse-credit-loop
COMMENT ON COLUMN public.usage_logs.quantum_operation_id IS 'Audit link to IBM Quantum Execution';

-- 6. Trigger Hierarchical Permissions Dependency Logic (Patch)
CREATE OR REPLACE FUNCTION public.check_feature_access_v2(p_tenant_id UUID, p_feature_slug TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_feature record;
    v_parent_slug TEXT;
BEGIN
    -- Obter slug do pai se houver
    SELECT p.slug INTO v_parent_slug 
    FROM public.genos_features_catalog f
    JOIN public.genos_features_catalog p ON f.parent_feature_id = p.id
    WHERE f.slug = p_feature_slug;

    -- Se houver pai, verifica se o pai está ativo recursivamente
    IF v_parent_slug IS NOT NULL THEN
        IF NOT public.check_feature_access_v2(p_tenant_id, v_parent_slug) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Executa a verificação padrão (chamando a original)
    RETURN public.check_feature_access(p_tenant_id, p_feature_slug);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
