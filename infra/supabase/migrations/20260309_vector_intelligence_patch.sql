-- ============================================================
-- genOS™ v5.0.0 - Vector Intelligence Patch
-- Fix: Missing pgvector extension and brand_dna_vectors table
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Create Vector Storage for Brand DNA
CREATE TABLE IF NOT EXISTS public.brand_dna_vectors (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding extensions.vector(1536), -- Standard OpenAI/Helian Embedding Size
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Security: Enable RLS
ALTER TABLE public.brand_dna_vectors ENABLE ROW LEVEL SECURITY;

-- 4. Apply Hardened v5.0.0 RLS Policy
CREATE POLICY "v5_BrandDNA_Vector_Silo" ON public.brand_dna_vectors
    FOR ALL USING (
        tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- 5. Indexing for Semantic Search (HNSW)
CREATE INDEX IF NOT EXISTS brand_dna_vectors_embedding_idx ON public.brand_dna_vectors 
USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE public.brand_dna_vectors IS 'genOS v5.0.0: High-Performance Semantic Map Storage';
