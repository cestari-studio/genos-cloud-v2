-- ============================================================
-- genOS™ v5.0.0 - Bloco 6: Tenant Hub & Client Cockpit
-- ============================================================

-- 1. RBAC Extension: Add 'freelancer' role to tenant_members
-- Since it's a check constraint on a text column, we drop and recreate it
ALTER TABLE public.tenant_members DROP CONSTRAINT IF EXISTS tenant_members_role_check;
ALTER TABLE public.tenant_members 
    ADD CONSTRAINT tenant_members_role_check 
    CHECK (role = ANY (ARRAY[
        'super_admin'::text, 
        'agency_operator'::text, 
        'client_user'::text, 
        'sys_admin'::text, 
        'agency_admin'::text, 
        'tenant_admin'::text, 
        'tenant_editor'::text, 
        'tenant_viewer'::text,
        'freelancer'::text -- New Role
    ]));

-- 2. Performance Metrics: Materialized View for ROI
-- Aggregates scores and engagement potential for high-performance dashboard loading
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_brand_performance AS
SELECT 
    tenant_id,
    COUNT(id) as total_posts,
    AVG(engagement_potential) as avg_engagement,
    AVG(weighted_total) as avg_quality_score,
    MAX(created_at) as last_updated
FROM public.quality_scores
GROUP BY tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_brand_performance_tenant ON public.mv_brand_performance(tenant_id);

-- 3. ROI RPC Function
CREATE OR REPLACE FUNCTION public.get_roi_metrics(p_tenant_id UUID)
RETURNS TABLE (
    total_posts BIGINT,
    avg_engagement NUMERIC,
    avg_quality NUMERIC,
    reach_estimate BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.total_posts,
        mv.avg_engagement,
        mv.avg_quality_score,
        (mv.total_posts * 1250)::BIGINT as reach_estimate -- Simplified reach algorithm for v5.0
    FROM public.mv_brand_performance mv
    WHERE mv.tenant_id = p_tenant_id;
END;
$$;

-- 4. Team Retrieval RPC
CREATE OR REPLACE FUNCTION public.get_tenant_team(p_tenant_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    status TEXT,
    joined_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.user_id,
        u.email,
        tm.role,
        tm.status,
        tm.created_at
    FROM public.tenant_members tm
    JOIN auth.users u ON u.id = tm.user_id
    WHERE tm.tenant_id = p_tenant_id;
END;
$$;

-- 5. Refresh helper (can be triggered via webhook or cron)
CREATE OR REPLACE FUNCTION public.refresh_brand_performance()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_brand_performance;
END;
$$;

GRANT SELECT ON public.mv_brand_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_roi_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_team(UUID) TO authenticated;

COMMENT ON MATERIALIZED VIEW public.mv_brand_performance IS 'Aggregated ROI metrics for Tenant Hub dashboards';
