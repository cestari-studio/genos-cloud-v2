-- ============================================================
-- genOS™ v5.0.0 - Phase 36: Onboarding & Provisioning Machine
-- ============================================================

-- 1. Create Projects Table for Content Packs
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'social_media',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed', 'pending')),
    briefing JSONB DEFAULT '{}'::jsonb,
    config JSONB DEFAULT '{}'::jsonb, -- e.g. { "posts_limit": 12, "reels_limit": 4 }
    stripe_product_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Security: Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Apply Hardened v5.0.0 RLS Policy (Silo Isolation)
CREATE POLICY "v5_Project_Silo" ON public.projects
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- 4. Audit: System Logs for Provisioning
COMMENT ON TABLE public.projects IS 'genOS v5.0.0: Individual content packs and project scopes';

-- 5. Trigger for updated_at (Reusing handle_updated_at from base schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
        EXECUTE 'CREATE TRIGGER set_projects_updated_at
            BEFORE UPDATE ON public.projects
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at()';
    END IF;
END $$;

-- 6. Grant Permissions
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
