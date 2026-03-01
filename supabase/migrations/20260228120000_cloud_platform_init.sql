-- Migration: Cloud Platform Init (v2)
-- Create new Modular tables

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, app_id)
);

CREATE TABLE IF NOT EXISTS public.credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    prepaid_credits NUMERIC NOT NULL DEFAULT 0,
    overage_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    operation TEXT NOT NULL,
    cost NUMERIC NOT NULL,
    is_overage BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed Applications
INSERT INTO public.applications (slug, name, is_active)
VALUES
    ('content-factory', 'Content Factory', true),
    ('geo-intelligence', 'GEO Intelligence', false),
    ('branding-dna', 'Branding DNA Studio', false),
    ('commerce-hub', 'Commerce Hub', false)
ON CONFLICT (slug) DO NOTHING;

-- Seed Subscriptions and Credit Wallets for existing tenants
DO $$
DECLARE
    t RECORD;
    v_app_id UUID;
BEGIN
    SELECT id INTO v_app_id FROM public.applications WHERE slug = 'content-factory';

    FOR t IN SELECT id FROM public.tenants LOOP
        -- Subscribe each tenant to content-factory
        INSERT INTO public.subscriptions (tenant_id, app_id, status)
        VALUES (t.id, v_app_id, 'active')
        ON CONFLICT (tenant_id, app_id) DO NOTHING;

        -- Create a baseline credit wallet (e.g. 1000 credits)
        INSERT INTO public.credit_wallets (tenant_id, prepaid_credits, overage_amount)
        VALUES (t.id, 1000, 0)
        ON CONFLICT (tenant_id) DO NOTHING;
    END LOOP;
END;
$$;

-- Alter content_items to reference the app_slug
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS app_slug TEXT DEFAULT 'content-factory';

-- RLS Policies
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Applications: Everyone can view active apps
CREATE POLICY "Public can view active applications" ON public.applications FOR SELECT USING (is_active = true);

-- Subscriptions: Tenants can view their own subscriptions
CREATE POLICY "Tenants can view own subscriptions" ON public.subscriptions FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));

-- Credit Wallets: Tenants can view their own wallet
CREATE POLICY "Tenants can view own wallet" ON public.credit_wallets FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));

-- Usage Logs: Tenants can view their own usage logs
CREATE POLICY "Tenants can view own usage logs" ON public.usage_logs FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant ON public.usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_items_app ON public.content_items(app_slug);
