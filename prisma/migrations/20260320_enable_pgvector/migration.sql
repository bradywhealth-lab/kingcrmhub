-- Enable pgvector extension
-- This extension allows storing and querying vector embeddings for AI/ML applications
-- Migration: enable_pgvector
-- Date: 2026-03-20

-- Create the vector extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to UserAIProfile table (will be created in next task)
-- Using IF NOT EXISTS to avoid errors since the table doesn't exist yet
-- vector(1536) supports OpenAI's text-embedding-ada-002 embeddings
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '"UserAIProfile"') THEN
    ALTER TABLE "UserAIProfile" ADD COLUMN IF NOT EXISTS "profileEmbedding" vector(1536);
  END IF;
END $$;

-- Add embedding column to UserLearningEvent table (will be created in next task)
-- Using IF NOT EXISTS to avoid errors since the table doesn't exist yet
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '"UserLearningEvent"') THEN
    ALTER TABLE "UserLearningEvent" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
  END IF;
END $$;

-- Create indexes for efficient vector similarity search (when tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '"UserAIProfile"') THEN
    CREATE INDEX IF NOT EXISTS "UserAIProfile_profileEmbedding_idx" ON "UserAIProfile" USING ivfflat ("profileEmbedding" vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '"UserLearningEvent"') THEN
    CREATE INDEX IF NOT EXISTS "UserLearningEvent_embedding_idx" ON "UserLearningEvent" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

-- Add comment to document the migration
COMMENT ON EXTENSION vector IS 'Vector data type for embeddings and similarity search';
