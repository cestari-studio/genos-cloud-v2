-- genOS Lumina v1.0.0 Modular Cloud Schema Update

-- 1. Create Applications Table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the Content Factory module
INSERT INTO public.applications (name, slug, description)
VALUES ('Content Factory', 'content-factory', 'AI-powered mass content ideation and production module.')
ON CONFLICT (slug) DO NOTHING;

-- 2. Modify Tenants Table (Add Wix Email Bridge and agency mapping)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'TENANT_USER',
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.tenants(id);

-- 3. Create Subscriptions Table (Many-to-Many Tenants <-> Applications)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, app_id)
);

-- 4. Create Credit Wallets Table (Pay-per-use tracking)
CREATE TABLE IF NOT EXISTS public.credit_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    prepaid_credits NUMERIC DEFAULT 0.0,
    overage_amount NUMERIC DEFAULT 0.0,
    currency TEXT DEFAULT 'BRL',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Usage Logs Table (Tied to Specific App)
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_usd NUMERIC NOT NULL,
    price_charged NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'prepaid' or 'pay-per-use'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Update Content Items Table (Isolating by App and adding Heuristics)
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS app_slug TEXT DEFAULT 'content-factory',
ADD COLUMN IF NOT EXISTS heuristics TEXT;

-- Migration complete.
