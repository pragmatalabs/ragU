# ragU Architecture

> A fully local monorepo playground for experimenting with LLMs, RAG pipelines, and vector databases. Everything runs on your machine --- no cloud dependencies.

> **See also:** [README](README.md) &middot; [Diagrams (Mermaid)](DIAGRAMS.md)

---

## System Overview

```
                          +------------------+
                          |    Frontend      |
                          |  React + Vite    |
                          |   (port 5179)    |
                          +--------+---------+
                                   |
                                   | HTTP
                                   v
                          +------------------+
                          |    Gateway       |
                          |  Hono + Bun      |
                          |   (port 3006)    |
                          +---+----------+---+
                              |          |
                  +-----------+          +-----------+
                  |                                  |
                  v                                  v
        +---------+--------+              +----------+---------+
        |     Ollama       |              |    RAG Backend     |
        |  (native macOS)  |              |  FastAPI + Python  |
        |   (port 11434)   |              |    (port 8006)     |
        +------------------+              +--+-----+-----+----+
                                             |     |     |
                          +------------------+     |     +------------------+
                          |                        |                        |
                          v                        v                        v
                +---------+--------+     +---------+--------+     +---------+--------+
                |   PostgreSQL     |     |     Qdrant       |     |      MinIO       |
                |   + pgvector     |     |  (vector engine) |     |  (object store)  |
                |   (port 5438)    |     |   (port 6339)    |     |   (port 9008)    |
                +------------------+     +------------------+     +------------------+
                                                                         |
                +---------+--------+                            uploaded documents
                |     Redis        |                            (PDF, DOCX, XLSX...)
                |  (future cache)  |
                |   (port 6379)    |
                +------------------+
```

---

## Layer Breakdown

### 1. Frontend --- `apps/web/`

| Detail | Value |
|--------|-------|
| Framework | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 3 |
| State | Zustand (persisted to localStorage) |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Icons | lucide-react |
| Port | `5179` |

**Key files:**

| File | Purpose |
|------|---------|
| `src/components/Chat.tsx` | Main chat view with messages, RAG sources, input |
| `src/components/ChatInput.tsx` | Message input with file attachment (paperclip) + drag-and-drop |
| `src/components/ChatMessage.tsx` | Markdown-rendered message bubbles with syntax highlighting and copy button |
| `src/components/SettingsPanel.tsx` | Temperature, Top P, Top K, RAG toggle, Agent Guidelines textarea |
| `src/components/DocumentUpload.tsx` | Document upload with async job polling |
| `src/components/ModelSelector.tsx` | Ollama model dropdown + pull |
| `src/hooks/useChat.ts` | Core chat orchestration: system prompt + RAG context + streaming |
| `src/stores/settingsStore.ts` | Persisted settings: model, RAG, collection, systemPrompt |
| `src/stores/chatStore.ts` | Chat sessions, messages, streaming state |
| `src/lib/api.ts` | Type-safe API layer: streamChat, ragQuery, uploadDocument |

**Data flow (sending a message):**

```
User types message
    |
    v
useChat.sendMessage(text)
    |
    +---> [if systemPrompt set] prepend as system message
    +---> [if RAG enabled]      call ragQuery() for context
    |       |
    |       +---> Gateway /api/rag/query ---> RAG Backend /query
    |       |       |
    |       |       +---> embed question via Ollama
    |       |       +---> hybrid search (vector + keyword)
    |       |       +---> return context + sources
    |       |
    |       +---> append RAG context to system message
    |
    +---> combine: [system, ...history, user]
    +---> streamChat(messages, model, opts)
            |
            +---> Gateway /api/chat ---> Ollama /api/chat (streaming)
            +---> yield chunks --> update UI in real-time
```

**File upload from chat:**

```
User clicks paperclip OR drags file onto input
    |
    v
uploadDocument(file, collection)
    |
    +---> Gateway /api/documents/upload
    |       +---> RAG Backend /ingest (returns job_id, 202 Accepted)
    |               +---> store in MinIO
    |               +---> asyncio.create_task(process)
    |
    +---> Poll /api/documents/status/{job_id} every 1.5s
    |       +---> queued -> processing (N chunks) -> completed
    |
    +---> Show inline status chip: filename + spinner + chunk count
```

---

### 2. Gateway --- `apps/gateway/`

| Detail | Value |
|--------|-------|
| Runtime | Bun |
| Framework | Hono |
| Port | `3006` |

A thin proxy layer that routes requests to the appropriate backend:

| Route | Upstream | Purpose |
|-------|----------|---------|
| `POST /api/chat` | Ollama `/api/chat` | Streaming LLM chat |
| `GET /api/models` | Ollama `/api/tags` | List available models |
| `POST /api/models/pull` | Ollama `/api/pull` | Download models |
| `POST /api/rag/query` | RAG Backend `/query` | Retrieval-augmented query |
| `GET /api/rag/collections` | RAG Backend `/collections` | List collections |
| `DELETE /api/rag/collections/:name` | RAG Backend `/collections/:name` | Delete collection |
| `POST /api/documents/upload` | RAG Backend `/ingest` | Upload + ingest document |
| `GET /api/documents/status/:id` | RAG Backend `/ingest/status/:id` | Poll job status |
| `GET /api/documents` | RAG Backend `/files` | List stored files |

---

### 3. RAG Backend --- `services/rag/`

| Detail | Value |
|--------|-------|
| Framework | FastAPI |
| Python | 3.12+ |
| Async DB | asyncpg |
| Vector Client | qdrant-client |
| Object Storage | minio |
| Port | `8006` |

**Routers:**

| Router | Endpoints | Responsibility |
|--------|-----------|----------------|
| `ingest.py` | `POST /ingest`, `GET /ingest/status/:id` | File upload to MinIO, async background processing (parse -> chunk -> embed -> store) |
| `query.py` | `POST /query` | Embed question, hybrid search, return context + sources |
| `collections.py` | `GET /collections`, `DELETE /collections/:name` | Manage vector store collections |
| `files.py` | `GET /files` | List files in MinIO |

**Services:**

| Service | File | Purpose |
|---------|------|---------|
| Parser | `parser.py` | Multi-format text extraction: PDF (PyMuPDF), DOCX, XLSX, XLS, CSV, JSON, TXT, Markdown |
| Chunker | `chunker.py` | Fixed-size text chunking with overlap (default 500 chars, 50 overlap) |
| Embedder | `embedder.py` | Ollama embedding API (`nomic-embed-text`, 768-dim vectors) |
| Storage | `storage.py` | MinIO S3-compatible object storage client |
| VectorStore | `vectorstore.py` | Abstract interface + factory (`get_store()`) |

---

### 4. Vector Store Architecture

The system supports three operational modes via `VECTOR_DB` environment variable:

```
VECTOR_DB=pgvector   # PostgreSQL only (default)
VECTOR_DB=qdrant     # Qdrant only
VECTOR_DB=hybrid     # Both: PG as record + Qdrant as ANN engine
```

#### `pgvector` mode --- `stores/pgvector_store.py`

PostgreSQL is the **system of record** with dual search:

- **Vector search**: pgvector cosine similarity (`embedding <=> query`)
- **Keyword search**: PostgreSQL full-text search (`tsvector` / `tsquery`)
- **Fusion**: Reciprocal Rank Fusion (RRF) combining both rankings

```
RRF score = 1/(k + vec_rank) + kw_weight/(k + kw_rank)
            k=60, kw_weight=1.5
```

This solves cross-lingual retrieval: English queries find Spanish documents by keyword match even when embeddings fail.

**Deduplication**: SHA-256 content hashing + unique index on `(collection, content_hash)` with `ON CONFLICT DO NOTHING`.

**Auto-migration on startup**: Idempotent `ALTER TABLE`, backfill tsvector/hashes, remove duplicates.

#### `qdrant` mode --- `stores/qdrant_store.py`

Pure Qdrant vector search using `AsyncQdrantClient`. UUID-based point IDs. No keyword search or deduplication.

#### `hybrid` mode --- `stores/hybrid_store.py`

Best of both worlds:

```
                   +-------------------+
                   |   HybridStore     |
                   +---+----------+----+
                       |          |
           +-----------+          +-----------+
           |                                  |
           v                                  v
  +--------+--------+              +----------+---------+
  | PgVectorStore   |              | AsyncQdrantClient  |
  | (system of      |              | (ANN vector        |
  |  record + FTS)  |              |  engine)           |
  +-----------------+              +--------------------+
```

- **Dual-write**: PG first (system of record), then Qdrant (best-effort)
- **Search**: Qdrant ANN for fast vector ranking + PG keyword search, fused via RRF in Python
- **Graceful degradation**: If Qdrant is down, falls back to PG-only hybrid search
- **Startup sync**: Copies existing PG vectors into Qdrant on first hybrid boot (`_sync_pg_to_qdrant`)
- **ID consistency**: PG integer IDs used as Qdrant point IDs

---

### 5. Data Stores

#### PostgreSQL + pgvector (System of Record)

```sql
CREATE TABLE documents (
    id            SERIAL PRIMARY KEY,
    collection    VARCHAR(255) NOT NULL,
    filename      VARCHAR(255) NOT NULL,
    content       TEXT NOT NULL,
    chunk_index   INTEGER NOT NULL,
    embedding     vector(768),
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMP DEFAULT NOW(),
    tsv           tsvector,        -- full-text search
    content_hash  VARCHAR(64)      -- SHA-256 for dedup
);

-- Indexes
idx_documents_collection  ON documents(collection)
idx_documents_embedding   USING ivfflat (embedding vector_cosine_ops)
idx_documents_tsv         USING gin(tsv)
idx_documents_dedup       UNIQUE ON (collection, content_hash)
```

#### Qdrant (ANN Vector Engine)

- Collections mirror PG collections by name
- Point IDs = PG integer IDs (for dual-store consistency)
- Vector size: 768 (nomic-embed-text)
- Distance: Cosine
- Payload: `{content, chunk_index}`

#### MinIO (Object Storage)

- S3-compatible document storage
- Bucket: `ragu-documents`
- Key format: `{collection}/{uuid}_{filename}`
- Stores original uploaded files (PDF, DOCX, XLSX, etc.)
- Console at port `9009`

#### Redis (Future)

- Available on port `6379`, persistence enabled (`appendonly yes`)
- Reserved for: short-term agent memory, query cache, task queues

---

### 6. LLM Layer --- Ollama

Ollama runs **natively on macOS** (not in Docker) for direct Metal/GPU access.

| Model | Purpose | Size |
|-------|---------|------|
| `llama3.2:3b` | Chat / generation | 2.0 GB |
| `nomic-embed-text` | Embeddings (768-dim) | 274 MB |

Additional models can be pulled from the UI via the model selector.

---

## Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_DB` | `pgvector` | Store mode: `pgvector`, `qdrant`, `hybrid` |
| `POSTGRES_PORT` | `5438` | PostgreSQL exposed port |
| `QDRANT_REST_PORT` | `6339` | Qdrant HTTP API port |
| `QDRANT_GRPC_PORT` | `6340` | Qdrant gRPC port |
| `REDIS_PORT` | `6379` | Redis port |
| `MINIO_API_PORT` | `9008` | MinIO S3 API port |
| `MINIO_CONSOLE_PORT` | `9009` | MinIO web console port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model |
| `CHUNK_SIZE` | `500` | Characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |

---

## Agent Guidelines (System Prompt)

The **Agent Guidelines** feature lets users define persistent system instructions per session:

- Configured in the sidebar under "Agent Guidelines"
- Persisted to `localStorage` via Zustand
- Prepended as a `system` message to every LLM call
- Combined with RAG context when both are active:

```
system: {agent_guidelines}
---
Use the following context to answer the question...
{rag_context}
```

Use cases: language preference, response format, persona, domain expertise.

---

## Document Ingestion Pipeline

```
File (PDF/DOCX/XLSX/CSV/JSON/TXT/MD)
    |
    v
[Upload to MinIO]  (async, returns job_id immediately)
    |
    v
[Background Task]
    |
    +---> extract_text()     # PyMuPDF, python-docx, openpyxl, etc.
    +---> chunk_text()       # Fixed-size with overlap
    +---> embed_texts()      # Ollama nomic-embed-text (batch)
    +---> store.add()        # Insert to active vector store
    |       |
    |       +---> [pgvector]  INSERT with ON CONFLICT dedup
    |       +---> [hybrid]    PG first, then Qdrant upsert
    |       +---> [qdrant]    Qdrant upsert with UUID points
    |
    v
Job status: queued -> processing -> completed
```

Supported formats: `.txt`, `.md`, `.pdf`, `.csv`, `.json`, `.docx`, `.doc`, `.xls`, `.xlsx`

---

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d        # PostgreSQL, MinIO, Qdrant, Redis

# 2. Install Ollama models (macOS native)
ollama pull llama3.2:3b
ollama pull nomic-embed-text

# 3. Start RAG backend
cd services/rag
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
VECTOR_DB=hybrid uvicorn app.main:app --port 8006

# 4. Start gateway
cd apps/gateway
bun install && bun run dev

# 5. Start frontend
cd apps/web
pnpm install && pnpm dev
```

Open `http://localhost:5179` --- upload documents, enable RAG mode, chat.

---

## Monorepo Structure

```
ragU/
+-- apps/
|   +-- web/                  # React frontend (Vite + Tailwind + Zustand)
|   +-- gateway/              # API gateway (Hono + Bun)
+-- services/
|   +-- rag/                  # RAG backend (FastAPI + Python)
|       +-- app/
|       |   +-- routers/      # ingest, query, collections, files
|       |   +-- services/     # parser, chunker, embedder, storage, vectorstore
|       |   +-- stores/       # pgvector_store, qdrant_store, hybrid_store
|       |   +-- config.py     # pydantic-settings
|       |   +-- main.py       # FastAPI lifespan
|       +-- init.sql          # PostgreSQL schema
|       +-- requirements.txt
+-- packages/
|   +-- shared/               # Shared TypeScript types
+-- docker-compose.yml        # PostgreSQL, MinIO, Qdrant, Redis
+-- package.json              # Workspace root (Bun)
+-- .env.example
+-- ARCHITECTURE.md           # This file
+-- DIAGRAMS.md               # Mermaid diagrams (C4, sequence, flows)
```

> See also: **[Mermaid Diagrams](DIAGRAMS.md)** --- C4 context/container/component views, sequence diagrams for chat and upload flows, and flowcharts for hybrid search, ingestion, and graceful degradation.
