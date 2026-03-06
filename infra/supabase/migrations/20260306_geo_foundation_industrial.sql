-- genOS™ v5.0.0 — Módulo 7: GEO Intelligence™
-- Migration: Foundation & Permissions (Prompt 1)
-- Date: 2026-03-06

-- 1. Feature Registration in Global Catalog
INSERT INTO public.genos_features_catalog (slug, name, description, category, meta_info)
VALUES (
    'quantum-pulse',
    'GEO Intelligence™ Quantum Pulse',
    'Acesso industrial ao processamento quântico via IBM Quantum Network.',
    'intelligence',
    '{"qpu_limit_seconds": 600, "provider": "IBM Quantum"}'
) ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Slogan Compliance Guard Function
-- Ensures the manifesto 'Ciência que desperta a consciência' is Dr. Theo Webert's exclusive domain.
CREATE OR REPLACE FUNCTION public.fn_check_geo_slogan_compliance()
RETURNS TRIGGER AS $$
DECLARE
    v_theo_id UUID := 'ddfb2b85-c7a6-49c0-bc6a-4eb8589d3fef';
    v_restricted_slogan TEXT := 'Ciência que desperta a consciência';
BEGIN
    -- Check if execution_telemetry or any related field contains the restricted slogan
    IF (NEW.execution_telemetry::text ~* v_restricted_slogan) AND (NEW.tenant_id != v_theo_id) THEN
        RAISE EXCEPTION 'V5 Integrity Error: O slogan restricted é exclusivo para a instância do Dr. Theo Webert.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Audit Telemetry Logging Function
CREATE OR REPLACE FUNCTION public.fn_log_geo_telemetry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.finops_audit_trail (tenant_id, event_type, metadata)
    VALUES (
        NEW.tenant_id,
        'QUANTUM_EXECUTION',
        jsonb_build_object(
            'analysis_id', NEW.id,
            'instance_id', NEW.quantum_instance_id,
            'score_qhe', NEW.qhe_score,
            'seconds_consumed', COALESCE((NEW.execution_telemetry->>'seconds_consumed')::float, 0)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers
DROP TRIGGER IF EXISTS tr_geo_slogan_guard ON public.geo_intelligence_analytics;
CREATE TRIGGER tr_geo_slogan_guard
    BEFORE INSERT OR UPDATE ON public.geo_intelligence_analytics
    FOR EACH ROW EXECUTE FUNCTION public.fn_check_geo_slogan_compliance();

DROP TRIGGER IF EXISTS tr_log_geo_execution ON public.geo_intelligence_analytics;
CREATE TRIGGER tr_log_geo_execution
    AFTER INSERT ON public.geo_intelligence_analytics
    FOR EACH ROW EXECUTE FUNCTION public.fn_log_geo_telemetry();

-- 5. Finalizing RLS (Security Silo)
ALTER TABLE public.geo_intelligence_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v5_GEO_Silo ON public.geo_intelligence_analytics;
CREATE POLICY v5_GEO_Silo ON public.geo_intelligence_analytics
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'master')
    );

COMMENT ON TABLE public.geo_intelligence_analytics IS 'Módulo 7: Inteligência Geográfica Quântica com Isolamento Industrial.';
