-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create products table with vector support
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    brand TEXT,
    name TEXT,
    category TEXT,
    description TEXT,
    oe_reference TEXT,
    specs JSONB,
    price_usd NUMERIC,
    image_url TEXT,
    embedding vector(768) -- text-embedding-004 has 768 dimensions
);

-- 3. Create agent_memory table
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  embedding vector(768), -- Optimized for text-embedding-004
  agent_type TEXT,
  validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create index for vector similarity search
CREATE INDEX ON products USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX ON agent_memory USING ivfflat (embedding);

-- 5. Create RPC for matching products
CREATE OR REPLACE FUNCTION match_products (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id TEXT,
  brand TEXT,
  name TEXT,
  category TEXT,
  description TEXT,
  oe_reference TEXT,
  specs JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.brand,
    p.name,
    p.category,
    p.description,
    p.oe_reference,
    p.specs,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
