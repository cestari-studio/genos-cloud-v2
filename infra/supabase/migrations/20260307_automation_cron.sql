-- ============================================================
-- genOS™ v5.0.0 - Social Scheduler™ - Automation Engine
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create Social Queue Table (if not exists)
CREATE TABLE IF NOT EXISTS public.social_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on queue
ALTER TABLE public.social_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v5_Social_Queue_Silo" ON public.social_queue
    FOR ALL USING (tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- 3. Automation Job: Social Scheduler
-- Runs every 5 minutes to trigger publishing
SELECT cron.schedule(
    'social-scheduler-job',
    '*/5 * * * *',
    $$
    WITH next_posts AS (
        SELECT id, tenant_id, post_id
        FROM public.social_queue
        WHERE status = 'pending'
          AND scheduled_for <= now()
        FOR UPDATE SKIP LOCKED
        LIMIT 10
    )
    SELECT net.http_post(
        url := (SELECT value FROM public.tenant_config WHERE key = 'SOCIAL_PUBLISHER_URL' LIMIT 1),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM public.tenant_config WHERE key = 'INTERNAL_API_KEY' LIMIT 1)
        ),
        body := jsonb_build_object(
            'queue_ids', (SELECT jsonb_agg(id) FROM next_posts)
        )
    )
    FROM next_posts;
    $$
);

COMMENT ON COLUMN public.social_queue.status IS 'genOS v5.0.0 automation status';
