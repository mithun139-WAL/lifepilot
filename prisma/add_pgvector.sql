-- ============================================================
-- pgvector setup for LifePilot RAG Knowledge Base
-- Run this ONCE against your Supabase / Postgres database
-- after running: prisma migrate dev
-- ============================================================

-- 1. Enable pgvector extension (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column to KnowledgeChunk
--    (Prisma migration creates the table; this adds the vector column)
ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- 3. Create an HNSW index for fast approximate nearest-neighbor search
--    (Much faster than IVFFlat for < 1M vectors)
CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
