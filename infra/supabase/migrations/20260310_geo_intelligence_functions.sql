-- ============================================================
-- genOS™ v5.0.0 - GEO Intelligence SQL Functions
-- Description: Semantic Search and Authority Scoring
-- ============================================================

-- 1. Match Brand DNA Vectors (Standard RAG Function)
CREATE OR REPLACE FUNCTION public.match_brand_dna_vectors (
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bdv.id,
    bdv.content,
    1 - (bdv.embedding <=> query_embedding) AS similarity
  FROM brand_dna_vectors bdv
  WHERE bdv.tenant_id = p_tenant_id
    AND 1 - (bdv.embedding <=> query_embedding) > match_threshold
  ORDER BY bdv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Calculate Visibility Score (Semantic Authority)
-- Aggregates the average similarity of content items against the Brand DNA
-- This is a simplified version of the authority score logic.
CREATE OR REPLACE FUNCTION public.calculate_visibility_score(p_tenant_id uuid)
RETURNS float
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score float;
BEGIN
    -- For now, we take the average quality_score of content items as a proxy
    -- In a full implementation, this involve a more complex vector aggregation.
    SELECT COALESCE(AVG(quality_score), 0)
    INTO v_score
    FROM content_items
    WHERE tenant_id = p_tenant_id;
    
    RETURN v_score;
END;
$$;

COMMENT ON FUNCTION public.match_brand_dna_vectors IS 'genOS v5.0.0: Semantic match for RAG and Copilot';
COMMENT ON FUNCTION public.calculate_visibility_score IS 'genOS v5.0.0: High-level visibility scoring';
