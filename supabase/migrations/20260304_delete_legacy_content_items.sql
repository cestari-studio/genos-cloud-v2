-- genOS Structural Alignment (Phase 1)
-- Purge legacy content_items table and transfer active records to posts

-- 1. Transfer any records from content_items that don't exist in posts (if any)
INSERT INTO posts (
  tenant_id,
  format,
  status,
  title,
  description,
  hashtags,
  cta,
  card_data,
  scheduled_date,
  created_at,
  updated_at
)
SELECT 
  tenant_id,
  'feed' as format, -- fallback
  status,
  title,
  content as description,
  '' as hashtags,
  '' as cta,
  '[]'::jsonb as card_data,
  scheduled_at as scheduled_date,
  created_at,
  updated_at
FROM content_items
WHERE id NOT IN (SELECT id::text FROM posts WHERE id::text = content_items.id::text) 
AND status != 'deleted';

-- 2. Drop the legacy table
DROP TABLE IF EXISTS content_items;

-- 3. Cleanup legacy functions if they exist
DROP FUNCTION IF EXISTS handle_content_generation;
