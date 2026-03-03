-- Migration: Add RLS policies for global system notifications
-- These policies allow authenticated users to read system-wide 
-- announcements where tenant_id IS NULL (platform-level events)

-- popup_events: allow anon/authenticated to read global rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'popup_events'
    AND policyname = 'Allow read of global popup_events'
  ) THEN
    CREATE POLICY "Allow read of global popup_events"
    ON popup_events
    FOR SELECT
    TO anon, authenticated
    USING (tenant_id IS NULL);
  END IF;
END $$;

-- activity_log: allow anon/authenticated to read global rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_log'
    AND policyname = 'Allow read of global activity_log'
  ) THEN
    CREATE POLICY "Allow read of global activity_log"
    ON activity_log
    FOR SELECT
    TO anon, authenticated
    USING (tenant_id IS NULL);
  END IF;
END $$;
