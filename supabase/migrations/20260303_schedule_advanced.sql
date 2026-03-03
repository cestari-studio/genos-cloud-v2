-- Migration: Advanced Scheduling Infrastructure (genOS v4.6.8)
-- Includes: billing_events, dashboard stats functions, and hierarchy refinements.

-- 1. CRIAR TABELA DE EVENTOS DE FATURAMENTO (billing_events)
-- Rastreia cobranças geradas por assinaturas ou excesso.
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('schedule_monthly', 'token_topup', 'overage_penalty')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    billing_month DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    external_invoice_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. HABILITAR RLS EM billing_events
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE RLS PARA billing_events
-- Master vê tudo
CREATE POLICY "Master CRUD billing_events" ON public.billing_events 
    FOR ALL TO authenticated USING (public.is_master());

-- Agency vê faturamento de seus clientes e próprio
CREATE POLICY "Agency VIEW billing_events" ON public.billing_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm 
            JOIN public.tenants t ON tm.tenant_id = t.id 
            WHERE tm.user_id = auth.uid() AND t.depth_level = 1 
            AND (tm.tenant_id = billing_events.tenant_id OR EXISTS (SELECT 1 FROM public.tenants t_c WHERE t_c.id = billing_events.tenant_id AND t_c.parent_tenant_id = tm.tenant_id))
        )
    );

-- Client: NÃO vê faturamento (bloqueado conforme requisito) - Ja coberto pelo default deny de RLS se nao houver politica superior.

-- 4. FUNÇÃO DE ESTATÍSTICAS DO DASHBOARD (get_schedule_dashboard_stats)
CREATE OR REPLACE FUNCTION public.get_schedule_dashboard_stats(p_tenant_id UUID)
RETURNS TABLE(
    current_month_used INT,
    current_month_limit INT,
    total_published INT,
    total_failed INT,
    success_rate NUMERIC,
    avg_publish_delay_minutes NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month_start DATE := date_trunc('month', now())::DATE;
BEGIN
    RETURN QUERY
    WITH current_usage AS (
        SELECT 
            COALESCE(scheduled_count, 0) as used,
            COALESCE(published_count, 0) as pub,
            COALESCE(failed_count, 0) as fail
        FROM public.schedule_usage_log
        WHERE tenant_id = p_tenant_id AND billing_month = v_month_start
    ),
    config AS (
        SELECT schedule_post_limit FROM public.tenant_config WHERE tenant_id = p_tenant_id
    ),
    delays AS (
        SELECT 
            AVG(EXTRACT(EPOCH FROM (published_at - scheduled_at))/60) as avg_delay
        FROM public.schedule_slots
        WHERE tenant_id = p_tenant_id AND status = 'published' AND published_at IS NOT NULL
    )
    SELECT 
        COALESCE((SELECT used FROM current_usage), 0)::INT,
        COALESCE((SELECT schedule_post_limit FROM config), 0)::INT,
        COALESCE((SELECT SUM(published_count)::INT FROM public.schedule_usage_log WHERE tenant_id = p_tenant_id), 0),
        COALESCE((SELECT SUM(failed_count)::INT FROM public.schedule_usage_log WHERE tenant_id = p_tenant_id), 0),
        CASE 
            WHEN (SELECT SUM(published_count + failed_count) FROM public.schedule_usage_log WHERE tenant_id = p_tenant_id) > 0 
            THEN (SELECT SUM(published_count)::NUMERIC / SUM(published_count + failed_count) * 100 FROM public.schedule_usage_log WHERE tenant_id = p_tenant_id)
            ELSE 100.0
        END::NUMERIC,
        COALESCE((SELECT avg_delay FROM delays), 0)::NUMERIC;
END;
$$;

-- 5. ÍNDICE ADICIONAL PARA BILLING
CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_month ON public.billing_events(tenant_id, billing_month);

-- 6. GARANTIR QUE can_manage_tenant AGORA CONSIDERE O NOVO FLUXO
-- (A função is_master() e can_manage_tenant() já foram criadas na migration anterior)

-- 7. FUNÇÕES PARA INCREMENTAR MÉTRICAS DE USO
CREATE OR REPLACE FUNCTION public.increment_schedule_count(p_tenant_id UUID, p_month DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.schedule_usage_log (tenant_id, billing_month, scheduled_count)
    VALUES (p_tenant_id, p_month, 1)
    ON CONFLICT (tenant_id, billing_month) DO UPDATE SET scheduled_count = schedule_usage_log.scheduled_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_published_count(p_tenant_id UUID, p_month DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.schedule_usage_log SET published_count = published_count + 1 
    WHERE tenant_id = p_tenant_id AND billing_month = p_month;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_failed_count(p_tenant_id UUID, p_month DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.schedule_usage_log SET failed_count = failed_count + 1 
    WHERE tenant_id = p_tenant_id AND billing_month = p_month;
END;
$$;

-- FIM DA MIGRATION ADVANCED
