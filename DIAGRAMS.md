# ragU --- Mermaid Diagrams

> Visual documentation of the ragU playground architecture, data flows, and system interactions.
> Render these with any Mermaid-compatible viewer (GitHub, VS Code, Obsidian, mermaid.live).

---

## Table of Contents

1. [C4 Context --- System Landscape](#1-c4-context--system-landscape)
2. [C4 Container --- Services & Stores](#2-c4-container--services--stores)
3. [C4 Component --- RAG Backend Internals](#3-c4-component--rag-backend-internals)
4. [C4 Component --- Frontend Internals](#4-c4-component--frontend-internals)
5. [Sequence --- Chat Message with RAG](#5-sequence--chat-message-with-rag)
6. [Sequence --- Document Upload from Chat](#6-sequence--document-upload-from-chat)
7. [Sequence --- Hybrid Search (RRF Fusion)](#7-sequence--hybrid-search-rrf-fusion)
8. [Flow --- Document Ingestion Pipeline](#8-flow--document-ingestion-pipeline)
9. [Flow --- Vector Store Mode Selection](#9-flow--vector-store-mode-selection)
10. [Flow --- Startup Bootstrap (Hybrid Mode)](#10-flow--startup-bootstrap-hybrid-mode)
11. [State --- Ingestion Job Lifecycle](#11-state--ingestion-job-lifecycle)
12. [Flow --- Graceful Degradation](#12-flow--graceful-degradation)

---

## 1. C4 Context --- System Landscape

Who interacts with ragU and what are the system boundaries.

```mermaid
C4Context
    title ragU System Context

    Person(user, "Developer", "Experiments with local LLMs, uploads documents, tunes RAG parameters")

    System(ragu, "ragU Playground", "Fully local monorepo for LLM chat, RAG pipelines, and vector database experimentation")

    System_Ext(ollama, "Ollama", "Native macOS LLM runtime with Metal GPU acceleration")
    System_Ext(browser, "Web Browser", "Chrome / Firefox / Safari on localhost")

    Rel(user, browser, "Opens UI at localhost:5179")
    Rel(browser, ragu, "HTTP requests", "REST + SSE streaming")
    Rel(ragu, ollama, "Chat completion + embeddings", "HTTP :11434")
    Rel(user, ollama, "Manages models via CLI", "ollama pull / run")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## 2. C4 Container --- Services & Stores

All containers/services and how they communicate.

```mermaid
C4Container
    title ragU Container Diagram

    Person(user, "Developer")

    Container_Boundary(frontend_boundary, "Frontend Layer") {
        Container(web, "Web App", "React 19 + Vite 6 + Tailwind", "Chat UI, settings panel, file upload, markdown rendering")
    }

    Container_Boundary(api_boundary, "API Layer") {
        Container(gateway, "API Gateway", "Hono + Bun :3006", "Routes requests to Ollama or RAG backend")
    }

    Container_Boundary(backend_boundary, "Backend Layer") {
        Container(rag, "RAG Backend", "FastAPI + Python :8006", "Ingest, embed, search, retrieve documents")
    }

    Container_Boundary(llm_boundary, "LLM Layer") {
        ContainerDb(ollama, "Ollama", "Native macOS :11434", "llama3.2:3b + nomic-embed-text")
    }

    Container_Boundary(data_boundary, "Data Layer") {
        ContainerDb(postgres, "PostgreSQL + pgvector", "Docker :5438", "System of record: vectors, FTS, dedup")
        ContainerDb(qdrant, "Qdrant", "Docker :6339", "ANN vector engine, cosine similarity")
        ContainerDb(minio, "MinIO", "Docker :9008", "S3-compatible object store for documents")
        ContainerDb(redis, "Redis", "Docker :6379", "Future: cache, memory, task queues")
    }

    Rel(user, web, "Uses", "browser")
    Rel(web, gateway, "API calls", "HTTP + SSE")
    Rel(gateway, ollama, "Chat + model ops", "HTTP stream")
    Rel(gateway, rag, "RAG query + ingest", "HTTP")
    Rel(rag, ollama, "Embed texts", "HTTP")
    Rel(rag, postgres, "CRUD + search", "asyncpg")
    Rel(rag, qdrant, "Upsert + ANN search", "gRPC/HTTP")
    Rel(rag, minio, "Store/retrieve files", "S3 API")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

---

## 3. C4 Component --- RAG Backend Internals

Inside the FastAPI RAG service: routers, services, and stores.

```mermaid
C4Component
    title RAG Backend Components (services/rag/)

    Container_Boundary(routers, "Routers (API Layer)") {
        Component(ingest_router, "Ingest Router", "ingest.py", "POST /ingest, GET /ingest/status/:id")
        Component(query_router, "Query Router", "query.py", "POST /query --- embed + search + return context")
        Component(collections_router, "Collections Router", "collections.py", "GET/DELETE collections")
        Component(files_router, "Files Router", "files.py", "GET /files from MinIO")
    }

    Container_Boundary(services, "Services (Business Logic)") {
        Component(parser, "Parser", "parser.py", "Multi-format extraction: PDF, DOCX, XLSX, CSV, JSON, TXT, MD")
        Component(chunker, "Chunker", "chunker.py", "Fixed-size text splitting with configurable overlap")
        Component(embedder, "Embedder", "embedder.py", "Ollama nomic-embed-text API (768-dim vectors)")
        Component(storage, "Storage", "storage.py", "MinIO S3 client for document persistence")
        Component(vectorstore, "VectorStore Factory", "vectorstore.py", "get_store() factory with mode routing")
    }

    Container_Boundary(stores, "Stores (Data Access)") {
        Component(pg_store, "PgVectorStore", "pgvector_store.py", "PG vector search + FTS + RRF + dedup")
        Component(qd_store, "QdrantStore", "qdrant_store.py", "Pure Qdrant ANN search")
        Component(hybrid_store, "HybridStore", "hybrid_store.py", "Dual-write PG+Qdrant, RRF fusion, sync")
    }

    Rel(ingest_router, parser, "extract_text()")
    Rel(ingest_router, chunker, "chunk_text()")
    Rel(ingest_router, embedder, "embed_texts()")
    Rel(ingest_router, storage, "upload to MinIO")
    Rel(ingest_router, vectorstore, "store.add()")
    Rel(query_router, embedder, "embed query")
    Rel(query_router, vectorstore, "store.search()")
    Rel(files_router, storage, "list_files()")
    Rel(vectorstore, pg_store, "pgvector mode")
    Rel(vectorstore, qd_store, "qdrant mode")
    Rel(vectorstore, hybrid_store, "hybrid mode")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

---

## 4. C4 Component --- Frontend Internals

Inside the React web app: components, hooks, and state stores.

```mermaid
C4Component
    title Frontend Components (apps/web/)

    Container_Boundary(components, "Components (UI)") {
        Component(chat, "Chat", "Chat.tsx", "Main chat view: messages + RAG sources + input")
        Component(chat_input, "ChatInput", "ChatInput.tsx", "Message input with paperclip upload + drag-and-drop")
        Component(chat_msg, "ChatMessage", "ChatMessage.tsx", "Markdown-rendered bubbles with syntax highlight + copy")
        Component(settings, "SettingsPanel", "SettingsPanel.tsx", "Temperature, Top P/K, RAG toggle, Agent Guidelines")
        Component(model_sel, "ModelSelector", "ModelSelector.tsx", "Ollama model dropdown + pull new models")
        Component(doc_upload, "DocumentUpload", "DocumentUpload.tsx", "Dedicated document upload with progress")
    }

    Container_Boundary(hooks_stores, "Hooks & State") {
        Component(use_chat, "useChat", "useChat.ts", "Chat orchestration: system prompt + RAG context + streaming")
        Component(settings_store, "settingsStore", "settingsStore.ts", "Persisted settings: model, RAG, systemPrompt")
        Component(chat_store, "chatStore", "chatStore.ts", "Sessions, messages, streaming state")
    }

    Container_Boundary(api_layer, "API Layer") {
        Component(api, "API Client", "api.ts", "streamChat, ragQuery, uploadDocument, checkJobStatus")
    }

    Rel(chat, chat_input, "Renders")
    Rel(chat, chat_msg, "Renders per message")
    Rel(chat, use_chat, "sendMessage()")
    Rel(chat_input, api, "uploadDocument()")
    Rel(use_chat, settings_store, "reads systemPrompt, model, RAG config")
    Rel(use_chat, chat_store, "writes messages, streaming state")
    Rel(use_chat, api, "ragQuery() + streamChat()")
    Rel(settings, settings_store, "reads/writes settings")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## 5. Sequence --- Chat Message with RAG

The full journey of a user message when RAG mode is enabled.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React Frontend
    participant Hook as useChat Hook
    participant GW as Gateway (Hono)
    participant RAG as RAG Backend (FastAPI)
    participant Ollama as Ollama (native)
    participant PG as PostgreSQL + pgvector
    participant QD as Qdrant

    User->>UI: Types message + presses Enter
    UI->>Hook: sendMessage(text)

    Note over Hook: Check if RAG is enabled

    rect rgb(40, 40, 80)
        Note right of Hook: RAG Context Retrieval
        Hook->>GW: POST /api/rag/query {question, collection, top_k}
        GW->>RAG: POST /query
        RAG->>Ollama: POST /api/embeddings {model, prompt}
        Ollama-->>RAG: float[768] embedding vector

        alt VECTOR_DB = hybrid
            par Qdrant ANN Search
                RAG->>QD: search(vector, limit=top_k)
                QD-->>RAG: vec_results[] with scores
            and PG Keyword Search
                RAG->>PG: SELECT ... tsvector @@ tsquery
                PG-->>RAG: kw_results[] with ranks
            end
            Note over RAG: RRF Fusion<br/>score = 1/(60+vec_rank) + 1.5/(60+kw_rank)
        else VECTOR_DB = pgvector
            RAG->>PG: Vector search + FTS + RRF (SQL)
            PG-->>RAG: fused results[]
        else VECTOR_DB = qdrant
            RAG->>QD: ANN search only
            QD-->>RAG: results[]
        end

        RAG-->>GW: {context, sources[]}
        GW-->>Hook: RAG context + source metadata
    end

    Note over Hook: Build message array

    rect rgb(40, 80, 40)
        Note right of Hook: LLM Streaming
        Hook->>Hook: Combine [system_prompt + RAG_context, ...history, user_msg]
        Hook->>GW: POST /api/chat {messages, model, stream: true}
        GW->>Ollama: POST /api/chat (stream)

        loop SSE chunks
            Ollama-->>GW: {message.content: "chunk..."}
            GW-->>UI: SSE data chunk
            UI->>UI: Append to message bubble (real-time)
        end

        Ollama-->>GW: {done: true}
        GW-->>UI: Stream complete
    end

    UI->>User: Rendered markdown response + RAG sources
```

---

## 6. Sequence --- Document Upload from Chat

What happens when a user attaches a file via the paperclip button or drag-and-drop.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as ChatInput Component
    participant GW as Gateway (Hono)
    participant RAG as RAG Backend (FastAPI)
    participant MinIO as MinIO (S3)
    participant Ollama as Ollama
    participant Store as Vector Store

    User->>UI: Clicks paperclip / drags file
    UI->>UI: Show status chip: "document.pdf" + spinner

    UI->>GW: POST /api/documents/upload (multipart)
    GW->>RAG: POST /ingest (file + collection)

    RAG->>MinIO: PUT object {collection}/{uuid}_{filename}
    MinIO-->>RAG: 200 OK (file stored)

    RAG->>RAG: asyncio.create_task(background_process)
    RAG-->>GW: 202 Accepted {job_id}
    GW-->>UI: {job_id}

    rect rgb(60, 40, 40)
        Note right of RAG: Background Processing
        RAG->>RAG: extract_text(file) via Parser
        Note over RAG: PyMuPDF for PDF<br/>python-docx for DOCX<br/>openpyxl for XLSX
        RAG->>RAG: chunk_text(content, size=500, overlap=50)
        RAG->>Ollama: POST /api/embeddings (batch of chunks)
        Ollama-->>RAG: float[768][] embedding vectors

        alt hybrid mode
            RAG->>Store: add_returning_ids() into PG
            Store->>Store: INSERT ... ON CONFLICT (dedup)
            Store-->>RAG: int[] PG IDs
            RAG->>Store: Qdrant upsert (PG IDs as point IDs)
        else pgvector mode
            RAG->>Store: INSERT with SHA-256 dedup
        else qdrant mode
            RAG->>Store: Qdrant upsert with UUID IDs
        end
    end

    loop Poll every 1.5s
        UI->>GW: GET /api/documents/status/{job_id}
        GW->>RAG: GET /ingest/status/{job_id}
        RAG-->>GW: {status: "processing", chunks: N}
        GW-->>UI: status update
        UI->>UI: Update chip: "document.pdf (42 chunks)"
    end

    RAG-->>GW: {status: "completed", chunks: 42}
    GW-->>UI: Job complete
    UI->>UI: Show green checkmark on chip
    UI->>User: File ready for RAG queries
```

---

## 7. Sequence --- Hybrid Search (RRF Fusion)

Detailed view of how hybrid mode combines Qdrant ANN and PG keyword search.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Query Router
    participant HS as HybridStore
    participant QD as Qdrant (ANN)
    participant PG as PgVectorStore (FTS)

    Client->>HS: search(collection, query_embedding, query_text, top_k=5)

    par Vector Search (Qdrant)
        HS->>QD: search(collection, query_embedding, limit=top_k*2)
        Note over QD: HNSW ANN cosine similarity
        QD-->>HS: vec_results[{id, score, content}]
    and Keyword Search (PostgreSQL)
        HS->>PG: keyword_search(collection, query_text, limit=top_k*2)
        Note over PG: tsvector @@ plainto_tsquery<br/>ts_rank_cd scoring
        PG-->>HS: kw_results[{id, rank, content}]
    end

    Note over HS: Build rank maps

    rect rgb(50, 50, 30)
        Note over HS: Reciprocal Rank Fusion (RRF)
        HS->>HS: vec_ranks = {doc_id: position} from vec_results
        HS->>HS: kw_ranks = {doc_id: position} from kw_results
        HS->>HS: all_ids = union(vec_ranks.keys, kw_ranks.keys)

        loop For each document ID
            HS->>HS: vec_rank = vec_ranks.get(id, top_k*2+1)
            HS->>HS: kw_rank = kw_ranks.get(id, top_k*2+1)
            HS->>HS: score = 1/(60 + vec_rank) + 1.5/(60 + kw_rank)
        end

        HS->>HS: Sort by RRF score descending
        HS->>HS: Return top_k results
    end

    HS-->>Client: fused_results[{content, metadata, score}]
```

---

## 8. Flow --- Document Ingestion Pipeline

Decision tree for the full ingestion flow from file to vectors.

```mermaid
flowchart TD
    A([User uploads file]) --> B{File format?}

    B -->|.pdf| C[PyMuPDF extract]
    B -->|.docx| D[python-docx extract]
    B -->|.xlsx / .xls| E[openpyxl extract]
    B -->|.csv| F[CSV reader extract]
    B -->|.json| G[JSON parser extract]
    B -->|.txt / .md| H[Raw text read]

    C --> I[Raw text content]
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J[Store original file in MinIO]
    J --> K[Chunk text<br/>size=500, overlap=50]
    K --> L[Embed chunks via Ollama<br/>nomic-embed-text → 768-dim vectors]

    L --> M{VECTOR_DB mode?}

    M -->|pgvector| N[INSERT into PostgreSQL<br/>SHA-256 dedup ON CONFLICT]
    M -->|qdrant| O[Upsert to Qdrant<br/>UUID point IDs]
    M -->|hybrid| P[INSERT into PG<br/>get integer IDs]

    P --> Q[Upsert to Qdrant<br/>PG IDs as point IDs]
    Q --> R{Qdrant succeeded?}
    R -->|Yes| S([Dual-write complete])
    R -->|No| T[Log warning<br/>PG data is safe]
    T --> S

    N --> S
    O --> S

    style A fill:#4a9eff,color:#fff
    style S fill:#22c55e,color:#fff
    style T fill:#f59e0b,color:#000
    style M fill:#8b5cf6,color:#fff
```

---

## 9. Flow --- Vector Store Mode Selection

How `get_store()` factory routes to the correct implementation.

```mermaid
flowchart TD
    A([Application Startup]) --> B[Read VECTOR_DB env var]
    B --> C{VECTOR_DB value?}

    C -->|"pgvector" <i>default</i>| D[PgVectorStore]
    C -->|"qdrant"| E[QdrantStore]
    C -->|"hybrid"| F[HybridStore]

    D --> D1[Connect asyncpg pool]
    D1 --> D2[Run auto-migrations<br/>ALTER TABLE idempotent]
    D2 --> D3[Backfill tsvector + hashes]
    D3 --> D4([Ready: PG vector + FTS + RRF])

    E --> E1[Connect AsyncQdrantClient]
    E1 --> E2([Ready: Pure ANN search])

    F --> F1[Initialize PgVectorStore]
    F1 --> F2[Initialize Qdrant client]
    F2 --> F3{Qdrant healthy?}
    F3 -->|Yes| F4[_sync_pg_to_qdrant<br/>batch copy vectors]
    F3 -->|No| F5[Set qdrant_available = false<br/>log warning]
    F4 --> F6([Ready: Dual-store + RRF])
    F5 --> F7([Ready: PG-only fallback])

    style A fill:#4a9eff,color:#fff
    style D4 fill:#22c55e,color:#fff
    style E2 fill:#22c55e,color:#fff
    style F6 fill:#22c55e,color:#fff
    style F7 fill:#f59e0b,color:#000
    style F fill:#8b5cf6,color:#fff
```

---

## 10. Flow --- Startup Bootstrap (Hybrid Mode)

The sync process that copies pgvector data into Qdrant on first hybrid boot.

```mermaid
flowchart TD
    A([Hybrid mode startup]) --> B[Initialize PgVectorStore<br/>asyncpg pool + migrations]
    B --> C[Connect Qdrant client]
    C --> D{Qdrant responds<br/>to health check?}

    D -->|No| E[qdrant_available = false<br/>Graceful fallback to PG-only]
    D -->|Yes| F[qdrant_available = true]

    F --> G[List PG collections<br/>SELECT DISTINCT collection]

    G --> H{For each collection}

    H --> I[_ensure_qdrant_collection<br/>768-dim cosine config]
    I --> J{Qdrant collection<br/>points_count > 0?}

    J -->|Yes: already synced| K[Skip this collection]
    J -->|No: empty| L[SELECT id, content,<br/>chunk_index, embedding<br/>FROM documents]

    L --> M[Build Qdrant PointStruct list<br/>id=PG int, vector=embedding]
    M --> N{Batch of 100}
    N --> O[qdrant.upsert batch]
    O --> N
    N -->|All batches done| P[Log: synced N points]

    K --> H
    P --> H
    H -->|All collections done| Q([Hybrid store ready])

    style A fill:#4a9eff,color:#fff
    style Q fill:#22c55e,color:#fff
    style E fill:#f59e0b,color:#000
```

---

## 11. State --- Ingestion Job Lifecycle

State machine for background document processing jobs.

```mermaid
stateDiagram-v2
    [*] --> Queued: POST /ingest
    Queued --> Uploading: Background task starts
    Uploading --> Processing: File stored in MinIO
    Processing --> Processing: Chunks embedded (progress updates)
    Processing --> Completed: All chunks stored in vector DB
    Processing --> Failed: Parse error / embed failure

    Completed --> [*]
    Failed --> [*]

    state Processing {
        [*] --> Parsing: extract_text()
        Parsing --> Chunking: chunk_text()
        Chunking --> Embedding: embed_texts() via Ollama
        Embedding --> Storing: store.add() to vector DB
        Storing --> [*]: chunks_processed = N
    }

    note right of Queued
        Client receives job_id
        immediately (202 Accepted)
    end note

    note right of Processing
        Client polls every 1.5s
        GET /ingest/status/:id
    end note

    note left of Completed
        UI shows green checkmark
        + total chunk count
    end note
```

---

## 12. Flow --- Graceful Degradation

How hybrid mode handles Qdrant failures without losing data.

```mermaid
flowchart TD
    A([Hybrid search request]) --> B{Qdrant available?}

    B -->|Yes| C[Qdrant ANN search]
    B -->|No| D[Skip Qdrant entirely]

    C --> E{Qdrant search<br/>succeeded?}
    E -->|Yes| F[vec_results from Qdrant]
    E -->|No: timeout/error| G[Log warning<br/>vec_results = empty]

    F --> H[PG keyword search<br/>tsvector FTS]
    G --> H
    D --> I[PG-only hybrid search<br/>vector + FTS in SQL]

    H --> J[RRF Fusion in Python<br/>combine vec_ranks + kw_ranks]
    J --> K([Return fused results])

    I --> K

    subgraph Write Path
        W1([Dual-write request]) --> W2[INSERT into PG first<br/>system of record]
        W2 --> W3{Qdrant available?}
        W3 -->|Yes| W4[Upsert to Qdrant]
        W3 -->|No| W5[Skip Qdrant<br/>PG data is safe]
        W4 --> W6{Qdrant upsert<br/>succeeded?}
        W6 -->|Yes| W7([Both stores updated])
        W6 -->|No| W8[Log warning<br/>data in PG only]
        W5 --> W8
        W8 --> W9([PG is source of truth<br/>Qdrant will sync on restart])
    end

    style A fill:#4a9eff,color:#fff
    style K fill:#22c55e,color:#fff
    style W7 fill:#22c55e,color:#fff
    style W9 fill:#f59e0b,color:#000
    style G fill:#f59e0b,color:#000
    style W8 fill:#f59e0b,color:#000
```

---

## How to View These Diagrams

| Tool | How |
|------|-----|
| **GitHub** | Push this file --- GitHub renders Mermaid natively in markdown |
| **VS Code** | Install [Markdown Preview Mermaid](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension |
| **Obsidian** | Built-in Mermaid support |
| **mermaid.live** | Paste any diagram block at [mermaid.live](https://mermaid.live) |
| **CLI** | `npx @mermaid-js/mermaid-cli mmdc -i DIAGRAMS.md -o output.svg` |

---

<p align="center">
  <sub>Part of the <a href="README.md">ragU</a> playground &mdash; <a href="ARCHITECTURE.md">Architecture</a> &middot; <a href="DIAGRAMS.md">Diagrams</a></sub>
</p>
