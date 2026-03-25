CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    collection VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    tsv tsvector,
    content_hash VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_documents_tsv ON documents USING gin(tsv);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_dedup ON documents (collection, content_hash);

-- Interaction logging for admin dashboard
CREATE TABLE IF NOT EXISTS interaction_log (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model VARCHAR(255),
    provider VARCHAR(64),
    rag_enabled BOOLEAN DEFAULT FALSE,
    collection VARCHAR(255),
    sources_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_log_created ON interaction_log(created_at DESC);

-- Vote column on interaction_log
DO $$ BEGIN
  ALTER TABLE interaction_log ADD COLUMN vote SMALLINT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Response cache: voted-good answers reused for similar questions
CREATE TABLE IF NOT EXISTS response_cache (
    id SERIAL PRIMARY KEY,
    question_hash VARCHAR(64) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model VARCHAR(255),
    provider VARCHAR(64),
    collection VARCHAR(255),
    vote_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_response_cache_hash ON response_cache (question_hash, collection);
CREATE INDEX IF NOT EXISTS idx_response_cache_lookup ON response_cache (question_hash);
