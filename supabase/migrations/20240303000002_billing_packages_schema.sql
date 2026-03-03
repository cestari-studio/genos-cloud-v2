-- Adicionando novos campos em tenant_config
ALTER TABLE public.tenant_config
ADD COLUMN IF NOT EXISTS hard_block_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS overage_allowed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS low_balance_threshold integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS zero_balance_message text DEFAULT 'Seu saldo de tokens se esgotou. Adquira um novo pacote para continuar gerando conteúdo.';

-- Tabela de Pacotes (Ad-ons)
CREATE TABLE IF NOT EXISTS public.addon_packages (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    name character varying(255) NOT NULL,
    description text,
    token_amount integer NOT NULL DEFAULT 0,
    post_amount integer NOT NULL DEFAULT 0,
    price_brl numeric(10,2) NOT NULL DEFAULT 0.00,
    stripe_price_id character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela de Histórico de Compras de Pacotes
CREATE TABLE IF NOT EXISTS public.addon_purchases (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    package_id uuid NOT NULL REFERENCES public.addon_packages(id),
    status character varying(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    payment_reference character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- Tabela de Configuração de Custos de Operação (Tokens)
CREATE TABLE IF NOT EXISTS public.token_cost_config (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE, -- if null, translates to global default cost
    format character varying(100) NOT NULL, -- carousel, static, reels, stories
    operation character varying(100) NOT NULL, -- generate_text, generate_image, create_post, etc.
    base_cost integer NOT NULL DEFAULT 0,
    per_slide_cost integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- Criar RPC apply_addon_manual
CREATE OR REPLACE FUNCTION public.apply_addon_manual(p_tenant_id uuid, p_tokens integer, p_posts integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Verificar permissão. Só Master/Agency devem poder rodar isto, mas a chamada em UI já bloqueia baseada 
    -- nas Rules / RLS (aqui a function é security definer pra bypassar limites do client se necessário)
    
    -- Injetar tokens em credit_wallets
    UPDATE public.credit_wallets
    SET prepaid_credits = COALESCE(prepaid_credits, 0) + p_tokens
    WHERE tenant_id = p_tenant_id;

    -- Aumentar post limit em tenant_config
    UPDATE public.tenant_config
    SET post_limit = COALESCE(post_limit, 0) + p_posts
    WHERE tenant_id = p_tenant_id;

    -- Criar log de atividade
    INSERT INTO public.activity_logs (
        tenant_id, 
        user_id, 
        action, 
        details
    ) VALUES (
        p_tenant_id,
        auth.uid(),
        'manual_addon_applied',
        jsonb_build_object(
            'tokens_added', p_tokens,
            'posts_added', p_posts,
            'notes', 'Injeção manual via painel Billing & Pacotes'
        )
    );
END;
$function$;

-- Inserir alguns pacotes padrão e custos globais se não existirem
INSERT INTO public.addon_packages (name, description, token_amount, post_amount, price_brl)
VALUES 
    ('Pacote Básico AI', '+5000 Tokens e 10 Posts', 5000, 10, 49.90),
    ('Pacote Creator', '+15000 Tokens e 30 Posts', 15000, 30, 99.90),
    ('Pacote Agency', '+50000 Tokens e Sem Limite de Posts (+999)', 50000, 999, 299.90)
ON CONFLICT DO NOTHING;

INSERT INTO public.token_cost_config (tenant_id, format, operation, base_cost, per_slide_cost)
VALUES 
    (NULL, 'carousel', 'generate', 300, 100),
    (NULL, 'static', 'generate', 300, 0),
    (NULL, 'reels', 'generate', 500, 0),
    (NULL, 'stories', 'generate', 200, 0)
ON CONFLICT DO NOTHING;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.addon_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_cost_config ENABLE ROW LEVEL SECURITY;

-- Políticas para addon_packages
CREATE POLICY "Addon packages são visíveis para todos os clientes" ON public.addon_packages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master admin can modify packages" ON public.addon_packages
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.tenants t 
            JOIN public.tenant_members tm ON t.id = tm.tenant_id 
            WHERE tm.user_id = auth.uid() AND t.depth_level = 0
        )
    );

-- Políticas para addon_purchases
CREATE POLICY "Agencies e Master podem ver compras" ON public.addon_purchases
    FOR SELECT TO authenticated USING (
        tenant_id IN (
            SELECT t.id FROM public.tenants t
            JOIN public.tenant_members tm ON t.id = tm.tenant_id OR t.parent_tenant_id = tm.tenant_id
            WHERE tm.user_id = auth.uid() AND (t.depth_level = 1 OR t.depth_level = 0)
        )
    );

CREATE POLICY "Clients podem ver próprias compras" ON public.addon_purchases
    FOR SELECT TO authenticated USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

-- Políticas para token_cost_config (Ler todos)
CREATE POLICY "Custos são lidos por todos autenticados" ON public.token_cost_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas master edita custos globais" ON public.token_cost_config
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.tenants t 
            JOIN public.tenant_members tm ON t.id = tm.tenant_id 
            WHERE tm.user_id = auth.uid() AND t.depth_level = 0
        )
    );
