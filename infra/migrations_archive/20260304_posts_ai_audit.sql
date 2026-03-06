-- Migration: Adicionar ai_audit na tabela posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_audit JSONB DEFAULT '{}'::jsonb;
