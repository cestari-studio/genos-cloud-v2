-- Migration: Scheduling System Infrastructure (genOS v4.6.5)


-- 1. ADICIONAR COLUNAS DE AGENDAMENTO EM tenant_config
-- Estas colunas controlam o acesso ao recurso premium e limites de billing.
ALTER TABLE public.tenant_config 
ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS schedule_tier TEXT DEFAULT 'starter' CHECK (schedule_tier IN ('starter','growth','scale','enterprise','custom')),
ADD COLUMN IF NOT EXISTS schedule_post_limit INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS schedule_billing_start DATE,
ADD COLUMN IF NOT EXISTS schedule_price_cents INTEGER DEFAULT 29000;

-- 2. CRIAR TABELA DE SLOTS DE AGENDAMENTO (schedule_slots)
-- Armazena cada tarefa individual de publicação por plataforma.
CREATE TABLE IF NOT EXISTS public.schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram','facebook','instagram_stories','instagram_reels','whatsapp')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','published','failed','cancelled')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    published_at TIMESTAMPTZ,
    external_post_id TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, platform)
);

-- 3. CRIAR TABELA DE LOG DE USO MENSAL (schedule_usage_log)
-- Agrega o consumo do tenant para controle de limites performático.
CREATE TABLE IF NOT EXISTS public.schedule_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    billing_month DATE NOT NULL, -- Armazena o primeiro dia do mês correspondente
    scheduled_count INTEGER DEFAULT 0,
    published_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    UNIQUE(tenant_id, billing_month)
);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_usage_log ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE RLS (Master/Agency/Client Hierarchy)

-- Ajudante: Verifica se o usuário é master
-- Nota: Master (depth_level=0) pode tudo.
CREATE OR REPLACE FUNCTION public.is_master() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() AND t.depth_level = 0
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Ajudante: Verifica se o usuário é agency do tenant ou do parent do tenant
CREATE OR REPLACE FUNCTION public.can_manage_tenant(p_tenant_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() 
        AND (
            tm.tenant_id = p_tenant_id -- Membro do próprio tenant
            OR 
            EXISTS ( -- Ou é agency (depth 1) e o tenant alvo é seu "filho"
                SELECT 1 FROM public.tenants t_sub 
                WHERE t_sub.id = p_tenant_id AND t_sub.parent_tenant_id = tm.tenant_id AND t.depth_level = 1
            )
            OR
            t.depth_level = 0 -- Ou é Master
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Políticas para schedule_slots
DROP POLICY IF EXISTS "Schedule Slots RLS Policy" ON public.schedule_slots;
CREATE POLICY "Schedule Slots RLS Policy" ON public.schedule_slots
FOR ALL TO authenticated
USING (
    public.is_master() -- Master pode tudo
    OR
    (SELECT depth_level FROM public.tenants WHERE id = tenant_id) = 1 AND tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()) -- Agency no seu próprio
    OR
    tenant_id IN (SELECT id FROM public.tenants WHERE parent_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())) -- Agency nos seus filhos
    OR
    (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())) -- Client no seu próprio
)
WITH CHECK (
    public.is_master() OR public.can_manage_tenant(tenant_id)
);

-- Refinando as políticas de acordo com o pedido específico:
-- Client (depth_level 2+): SELECT only nos seus próprios
-- Agency (depth_level 1): CRUD em seus own e filhos
-- Master (depth_level 0): CRUD em tudo

DROP POLICY IF EXISTS "Master CRUD everything" ON public.schedule_slots;
CREATE POLICY "Master CRUD everything" ON public.schedule_slots FOR ALL TO authenticated 
USING (public.is_master());

DROP POLICY IF EXISTS "Agency CRUD own and children" ON public.schedule_slots;
CREATE POLICY "Agency CRUD own and children" ON public.schedule_slots FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() AND t.depth_level = 1 
        AND (tm.tenant_id = schedule_slots.tenant_id OR EXISTS (SELECT 1 FROM public.tenants t_c WHERE t_c.id = schedule_slots.tenant_id AND t_c.parent_tenant_id = tm.tenant_id))
    )
);

DROP POLICY IF EXISTS "Client SELECT own only" ON public.schedule_slots;
CREATE POLICY "Client SELECT own only" ON public.schedule_slots FOR SELECT TO authenticated
USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
);

-- Repetindo para schedule_usage_log
DROP POLICY IF EXISTS "Master CRUD usage" ON public.schedule_usage_log;
CREATE POLICY "Master CRUD usage" ON public.schedule_usage_log FOR ALL TO authenticated USING (public.is_master());

DROP POLICY IF EXISTS "Agency CRUD usage own and children" ON public.schedule_usage_log;
CREATE POLICY "Agency CRUD usage own and children" ON public.schedule_usage_log FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() AND t.depth_level = 1 
        AND (tm.tenant_id = schedule_usage_log.tenant_id OR EXISTS (SELECT 1 FROM public.tenants t_c WHERE t_c.id = schedule_usage_log.tenant_id AND t_c.parent_tenant_id = tm.tenant_id))
    )
);

DROP POLICY IF EXISTS "Client SELECT usage own only" ON public.schedule_usage_log;
CREATE POLICY "Client SELECT usage own only" ON public.schedule_usage_log FOR SELECT TO authenticated
USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
);


-- 6. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_slots_tenant_status_time ON public.schedule_slots(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_slots_queued_time ON public.schedule_slots(scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_usage_log_tenant_month ON public.schedule_usage_log(tenant_id, billing_month);

-- 7. AUTOMAÇÃO DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_slots_updated_at ON public.schedule_slots;
CREATE TRIGGER tr_slots_updated_at
    BEFORE UPDATE ON public.schedule_slots
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. FUNÇÃO DE VALIDAÇÃO DE LIMITE (check_schedule_limit)
-- Verifica se o tenant atingiu o limite de agendamentos no mês corrente.
CREATE OR REPLACE FUNCTION public.check_schedule_limit(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER;
    v_count INTEGER;
    v_month_start DATE;
BEGIN
    -- 1. Obter limite do tenant
    SELECT schedule_post_limit INTO v_limit 
    FROM public.tenant_config 
    WHERE tenant_id = p_tenant_id;
    
    -- Se não houver config, assumimos limite zero ou padrão
    v_limit := COALESCE(v_limit, 0);
    
    -- 2. Obter contagem do mês corrente
    v_month_start := date_trunc('month', now())::DATE;
    
    SELECT scheduled_count INTO v_count 
    FROM public.schedule_usage_log 
    WHERE tenant_id = p_tenant_id AND billing_month = v_month_start;
    
    -- Se não houver log para o mês, a contagem é zero
    v_count := COALESCE(v_count, 0);
    
    -- 3. Retornar se pode agendar (contagem < limite)
    RETURN v_count < v_limit;
END;
$$;

-- FIM DA MIGRATION
