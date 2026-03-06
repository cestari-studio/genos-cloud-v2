-- ============================================================
-- genOS™ v5.0.0 - Posts Vectorization Support
-- ============================================================

-- 1. Add embedding column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- 2. Create index for fast semantic search on posts
CREATE INDEX IF NOT EXISTS posts_embedding_idx ON public.posts 
USING hnsw (embedding vector_cosine_ops);

-- 3. Match Posts Vectors (Standard RAG Function for Posts)
CREATE OR REPLACE FUNCTION public.match_posts (
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM posts p
  WHERE p.tenant_id = p_tenant_id
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
