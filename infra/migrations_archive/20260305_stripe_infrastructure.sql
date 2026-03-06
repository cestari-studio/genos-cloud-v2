-- Migration: Phase 13 Commercialization — Stripe Infrastructure
-- Adds tables for Stripe customer and subscription management

-- 1. Stripe Customers Mapping
CREATE TABLE IF NOT EXISTS public.stripe_customers (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Stripe Subscriptions Mapping
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL, -- active, past_due, cancelled, etc.
    tier TEXT DEFAULT 'starter', -- starter, growth, scale, enterprise
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own stripe customer" ON public.stripe_customers FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));
-- Note: In a multi-member tenant, this might need adjustment to allow agency/master
-- But for now keeping it simple as per the edge function usage.

CREATE POLICY "Tenants can view own stripe subscriptions" ON public.stripe_subscriptions FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_tenant ON public.stripe_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_id ON public.stripe_customers(stripe_customer_id);

COMMENT ON TABLE public.stripe_customers IS 'Mapping between genOS tenants and Stripe customers';
COMMENT ON TABLE public.stripe_subscriptions IS 'Local cache of Stripe subscription statuses';
