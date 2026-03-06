-- Migration for Módulo 6, 6.5, 8, and 9 (Matrix Assets & Social/FinOps infra)
-- Creates the matrix_assets table and related structures.

CREATE TYPE public.asset_status AS ENUM (
    'pending_generation',
    'generating',
    'needs_review',
    'approved',
    'rejected',
    'final_asset',
    'scheduled',
    'published',
    'failed'
);

CREATE TYPE public.asset_type AS ENUM (
    'post',
    'reels',
    'article',
    'carousel'
);

CREATE TABLE IF NOT EXISTS public.matrix_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID, -- Optional reference to a pack/project
    title TEXT NOT NULL,
    type public.asset_type DEFAULT 'post'::public.asset_type NOT NULL,
    status public.asset_status DEFAULT 'pending_generation'::public.asset_status NOT NULL,
    
    -- Content & Metadata
    content TEXT, -- The generated content
    context JSONB DEFAULT '{}'::jsonb NOT NULL, -- brand_dna_snapshot, briefing_goal, target_language
    ai_metadata JSONB DEFAULT '{}'::jsonb NOT NULL, -- model_used, tokens_consumed, cost_usd
    
    -- QualityGate & Logs
    q_score NUMERIC(5,2),
    compliance_notes TEXT,
    
    -- Social Hub
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.matrix_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Matrix Assets
CREATE POLICY "Tenants can manage their own matrix assets" 
ON public.matrix_assets 
FOR ALL 
USING (tenant_id = auth.uid()) 
WITH CHECK (tenant_id = auth.uid());

-- Triggers for updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON matrix_assets
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- FinOps Audit Trail Table (Módulo 9)
CREATE TABLE IF NOT EXISTS public.finops_audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'token_usage', 'module_activation', 'budget_limit'
    event_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.finops_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own finops logs" 
ON public.finops_audit_trail 
FOR SELECT 
USING (tenant_id = auth.uid());

-- Social Posts Queue (Módulo 8)
-- Extends the matrix_assets concepts specifically for pg_cron scheduling
CREATE TABLE IF NOT EXISTS public.social_posts_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.matrix_assets(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'linkedin', 'instagram', etc.
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0 NOT NULL,
    error_log TEXT,
    scheduled_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.social_posts_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their own social queue" 
ON public.social_posts_queue 
FOR ALL 
USING (tenant_id = auth.uid()) 
WITH CHECK (tenant_id = auth.uid());

CREATE TRIGGER handle_updated_at_social_queue BEFORE UPDATE ON social_posts_queue
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- pg_cron setup is required for Module 8. The actual cron job definition:
-- Note: This requires the pg_cron extension to be enabled in Supabase via Database > Extensions.
-- SELECT cron.schedule('social_scheduler', '*/5 * * * *', $$
--     SELECT net.http_post(
--         url:='https://[PROJECT_REF].supabase.co/functions/v1/social-publisher',
--         headers:='{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
--     );
-- $$);
