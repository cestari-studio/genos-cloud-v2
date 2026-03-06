-- genOS Migration: Background Automation (Cron)
-- Enables periodic processing of the social publishing queue

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the cron job
-- This will call the social-publisher-processor every 1 minute
SELECT cron.schedule(
    'process-social-queue', -- name
    '* * * * *',           -- every minute
    $$
    SELECT net.http_post(
        url := (SELECT value FROM secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/social-publisher-processor',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
        ),
        body := '{}'
    );
    $$
);

COMMENT ON EXTENSION pg_cron IS 'genOS: Automated publishing queue trigger';
