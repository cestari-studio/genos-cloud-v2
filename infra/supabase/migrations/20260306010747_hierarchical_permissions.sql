-- Ultra Settings & Modular Routing Schema

-- 1. Catálogo Global de Funcionalidades (Gerenciado pelo Master)
CREATE TABLE public.genos_features_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- ex: 'quantum-pulse', 'watson-analytics', 'granite-engine'
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'AI', 'Quantum', 'Analysis', 'Marketing'
    is_beta BOOLEAN DEFAULT false,
    parent_feature_id UUID REFERENCES public.genos_features_catalog(id) ON DELETE SET NULL,
    is_dependency_only BOOLEAN DEFAULT false, -- Se true, não aparece no menu, só ativa via pai.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS no catálogo global
ALTER TABLE public.genos_features_catalog ENABLE ROW LEVEL SECURITY;

-- Política de leitura do catálogo (Apenas leitura para authenticated users) 
CREATE POLICY "Leitura do catálogo global" 
    ON public.genos_features_catalog FOR SELECT 
    TO authenticated 
    USING (true);

-- 2. Permissões de Agência (Master -> Agency)
-- O Master ativa ou desativa ferramentas para cada Agência (que são tenants com is_agency=true).
CREATE TABLE public.agency_features_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES public.genos_features_catalog(id) ON DELETE CASCADE,
    is_enabled_by_master BOOLEAN DEFAULT false,
    max_token_quota BIGINT DEFAULT 1000000, -- Limite de uso
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agency_id, feature_id)
);

-- Trigger para updated_at de agency_features_config
CREATE TRIGGER "set_updated_at" BEFORE UPDATE ON public.agency_features_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.agency_features_config ENABLE ROW LEVEL SECURITY;

-- Agências (ou Master) só podem ler as configs direcionadas ao seu próprio tenant (se forem agência)
CREATE POLICY "Leitura das permissões da agência" 
    ON public.agency_features_config FOR SELECT 
    TO authenticated 
    USING (
        agency_id IN (
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.is_authorized_for_tenant(agency_id) -- Regra master
    );

-- 3. Permissões de Tenant (Agency -> Tenant)
-- A Agência decide o que seus clientes podem usar. O agency_id corresponde ao tenant_id da agência pai.
CREATE TABLE public.tenant_features_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES public.genos_features_catalog(id) ON DELETE CASCADE,
    is_enabled_by_agency BOOLEAN DEFAULT false,
    custom_settings JSONB DEFAULT '{}'::jsonb, -- Configurações específicas para o tenant
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, feature_id)
);

-- Trigger para updated_at de tenant_features_config
CREATE TRIGGER "set_updated_at" BEFORE UPDATE ON public.tenant_features_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.tenant_features_config ENABLE ROW LEVEL SECURITY;

-- Tenants só podem ler suas próprias configs. Agências pai e Master também devem ter acesso a leitura/escrita, o que pode ser garantido por um bypass ou lógica extra. Aqui mantemos simplificado.
CREATE POLICY "Leitura e gestão das permissões de tenant" 
    ON public.tenant_features_config FOR ALL 
    TO authenticated 
    USING (
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
        )
        OR public.is_authorized_for_tenant(tenant_id)
        OR public.can_manage_tenant(tenant_id)
    );

-- 4. Função de Verificação de Herança (The Permission Gate)
-- Verifica se a funcionalidade está ativa em toda a cadeia.
CREATE OR REPLACE FUNCTION public.check_feature_access(p_tenant_id UUID, p_feature_slug TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_feature_id UUID;
    v_target_tenant public.tenants%ROWTYPE;
    v_agency_id UUID;
    v_master_allowed BOOLEAN;
    v_agency_allowed BOOLEAN;
BEGIN
    -- 1. Obter o ID da feature pelo slug
    SELECT id INTO v_feature_id FROM public.genos_features_catalog WHERE slug = p_feature_slug;
    IF v_feature_id IS NULL THEN
        RETURN FALSE; -- Feature não existe
    END IF;
    
    -- 2. Identificar a Agência dona do Tenant (ou se ele próprio é Master/Agency)
    SELECT * INTO v_target_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF v_target_tenant.depth_level = 0 THEN
        -- Master tem acesso a tudo
        RETURN TRUE;
    END IF;

    -- Se o nível é 1 (Agência), ou tem parent_tenant_id preenchido.
    v_agency_id := COALESCE(v_target_tenant.parent_tenant_id, p_tenant_id);

    -- 3. Verifica se o Master liberou para a Agência (ou se a Agência é o próprio target_tenant_id)
    SELECT is_enabled_by_master INTO v_master_allowed 
    FROM public.agency_features_config 
    WHERE agency_id = v_agency_id AND feature_id = v_feature_id;

    -- Se para a agência já está proibido, o tenant tbm não acessa.
    IF NOT COALESCE(v_master_allowed, false) THEN
        RETURN FALSE;
    END IF;

    -- Se for o próprio Tenant que é uma Agência (depth=1 avaliando a si mesmo), ele já tem permissão.
    IF v_agency_id = p_tenant_id THEN
        RETURN TRUE;
    END IF;

    -- 4. Verifica se a Agência liberou para o Tenant filho
    SELECT is_enabled_by_agency INTO v_agency_allowed 
    FROM public.tenant_features_config 
    WHERE tenant_id = p_tenant_id AND feature_id = v_feature_id;

    RETURN COALESCE(v_agency_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
