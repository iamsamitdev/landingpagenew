-- ===== Supabase pgVector Setup for RAG Chatbot =====
-- Run this SQL in Supabase SQL Editor

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create a table for documents
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536), -- สำหรับ OpenAI text-embedding-3-small
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create an index for faster similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Create a function for similarity search
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. (Optional) Create RLS policies for security
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
-- CREATE POLICY "Allow read access" ON documents
--   FOR SELECT
--   USING (auth.role() = 'authenticated');

-- Allow insert access for service role only
-- CREATE POLICY "Allow insert for service role" ON documents
--   FOR INSERT
--   WITH CHECK (auth.role() = 'service_role');

-- ===== Done! =====
-- After running this SQL:
-- 1. Add documents to the 'documents' folder in your project
-- 2. Run: npx tsx scripts/ingest.ts
-- 3. Test the chatbot on your landing page
