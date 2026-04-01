<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/pot-of-food_1f372.png" width="80" />
</p>

<h1 align="center">ragU</h1>

<p align="center">
  <strong>A fully local playground for LLMs, RAG pipelines, and vector databases.</strong><br/>
  No cloud. No API keys. No data leaves your machine.<br/>
  Just you, your models, and your documents.
</p>

<p align="center">
  <a href="ARCHITECTURE.md"><img src="https://img.shields.io/badge/docs-Architecture-blue?style=flat-square" alt="Architecture" /></a>
  <a href="DIAGRAMS.md"><img src="https://img.shields.io/badge/docs-Diagrams_(Mermaid)-purple?style=flat-square" alt="Diagrams" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/status-experimental-orange?style=flat-square" alt="Experimental" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
</p>

---

## Why ragU?

I built ragU because I wanted a **single place** to experiment with local AI without juggling disconnected scripts, paying for API calls, or shipping my data to the cloud.

Most RAG tutorials end at "here's a Jupyter notebook." Real exploration needs a real environment --- a UI to chat with, a pipeline to ingest documents, vector stores to compare, and knobs to tweak. ragU is that environment.

**It's a playground, not a product.** Fork it, break it, rebuild it. That's the point.

> **Deep dives:** [Architecture](ARCHITECTURE.md) &middot; [Diagrams (Mermaid)](DIAGRAMS.md)

---

## What You Get

```
 You type a question
      |
      v
 +----------+     +----------+     +----------+
 |  React   | --> |  Hono    | --> |  Ollama  |  <-- your local LLM
 |  (Vite)  |     | (Gateway)|     | (native) |
 +----------+     +----+-----+     +----------+
                       |
                       v
                 +-----+------+
                 |  FastAPI   |  <-- RAG backend
                 |  (Python)  |
                 +--+---+--+--+
                    |   |  |
          +---------+   |  +---------+
          v             v            v
   +------+---+  +------+---+  +----+-----+
   | pgvector |  |  Qdrant  |  |  MinIO   |
   | (record) |  |  (ANN)   |  |  (files) |
   +----------+  +----------+  +----------+
```

- **Chat** with local LLMs --- streaming responses, markdown rendering, syntax highlighting
- **Upload documents** directly in the chat (paperclip or drag-and-drop) --- PDF, DOCX, XLSX, CSV, and more
- **RAG pipeline** --- automatic chunking, embedding, and retrieval with source attribution
- **Dual vector stores** --- PostgreSQL+pgvector as system of record, Qdrant as ANN engine, or both via hybrid mode
- **Hybrid search** --- vector similarity + full-text keyword search fused with Reciprocal Rank Fusion
- **Agent Guidelines** --- persistent system prompts per session (language, format, persona)
- **Model management** --- pull and switch Ollama models from the UI
- **Zero cloud dependencies** --- everything runs on your machine

---

## Quick Start

> **Prerequisites:** [Docker](https://docs.docker.com/get-docker/), [Ollama](https://ollama.ai) (native), [Bun](https://bun.sh), [Python 3.12+](https://www.python.org/), [pnpm](https://pnpm.io)

```bash
# Clone
git clone https://github.com/pragmatalabs/ragU.git
cd ragU

# 1. Environment
cp .env.example .env

# 2. Start infrastructure (PostgreSQL, MinIO, Qdrant, Redis, Ollama)
docker compose up -d

# 3. Pull embedding model into ragU's Ollama (first time only)
docker exec ragu-ollama ollama pull nomic-embed-text

# 4. Start RAG backend
cd services/rag
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8006 --reload &
cd ../..

# 5. Start gateway + frontend
bun install
bun run dev:all
```

Open **http://localhost:5179** --- upload a document, flip on RAG mode, and start asking questions.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Vite 6 + Tailwind CSS | Chat UI, settings, file upload |
| Gateway | Hono + Bun | API proxy and routing |
| RAG Backend | FastAPI + Python 3.12 | Ingest, embed, search, retrieve |
| LLM Runtime | Ollama (Docker, self-contained) | Embeddings + optional local chat |
| LLM Provider | Groq Cloud (default) | Fast chat generation for non-GPU environments |
| Vector DB | PostgreSQL + pgvector | System of record, hybrid search, dedup |
| Vector DB | Qdrant | High-performance ANN engine |
| Object Storage | MinIO | S3-compatible document storage |
| Cache | Redis | Reserved for memory + task queues |

### Vector Store Modes

Switch between engines with a single env var:

```bash
VECTOR_DB=pgvector   # PostgreSQL only (default) --- hybrid search built-in
VECTOR_DB=qdrant     # Qdrant only --- pure ANN
VECTOR_DB=hybrid     # Both --- PG as record + Qdrant as ANN, fused via RRF
```

In `hybrid` mode, existing pgvector data syncs to Qdrant automatically on startup. If Qdrant goes down, the system gracefully degrades to PG-only.

---

## Features

### Chat with Local Models
Stream responses from any Ollama model. Full markdown rendering with GitHub-Flavored Markdown, syntax highlighting, and copy-to-clipboard on code blocks.

### Document Upload in Chat
Click the paperclip or drag files onto the input. Supported: `.pdf`, `.docx`, `.xlsx`, `.xls`, `.csv`, `.json`, `.txt`, `.md`. Files are stored in MinIO, parsed, chunked, embedded, and indexed --- with real-time status chips showing progress.

### RAG Retrieval
Toggle RAG mode in the sidebar. Your question gets embedded, matched against your document store (vector + keyword search), and the top-K chunks are injected as context. Sources are displayed under each response.

### Agent Guidelines
Set persistent system instructions per session: response language, formatting rules, persona, domain constraints. Combined with RAG context when both are active.

### Hybrid Search with RRF
Cross-lingual retrieval that actually works. English queries find Spanish documents (and vice versa) by fusing embedding similarity with keyword matching:

```
score = 1/(k + vec_rank) + kw_weight/(k + kw_rank)
        k=60, kw_weight=1.5
```

### Content Deduplication
Re-uploading the same document won't bloat your index. SHA-256 content hashing with a unique constraint catches duplicates at the database level.

---

## Ports

All ports offset by `+6` from defaults to avoid collisions with other local services:

| Service | Port | Container |
|---------|------|-----------|
| Frontend | `5179` | - |
| Gateway | `3006` | - |
| RAG API | `8006` | - |
| Ollama | `11435` | `ragu-ollama` |
| PostgreSQL | `5438` | `ragu-postgres` |
| Qdrant | `6339` | `ragu-qdrant` |
| MinIO API | `9008` | `ragu-minio` |
| MinIO Console | `9009` | `ragu-minio` |
| Redis | `6379` | `ragu-redis` |

---

## Project Structure

```
ragU/
|-- apps/
|   |-- web/                  # React + Vite + Tailwind + Zustand
|   |-- gateway/              # Hono + Bun API proxy
|-- services/
|   |-- rag/                  # FastAPI RAG backend
|       |-- app/
|       |   |-- routers/      # ingest, query, collections, files
|       |   |-- services/     # parser, chunker, embedder, storage
|       |   |-- stores/       # pgvector_store, qdrant_store, hybrid_store
|       |   |-- config.py
|       |   |-- main.py
|       |-- requirements.txt
|-- packages/
|   |-- shared/               # Shared TypeScript types
|-- docker-compose.yml        # PostgreSQL, MinIO, Qdrant, Redis, Ollama
|-- ARCHITECTURE.md           # Deep-dive system documentation
|-- .env.example
|-- package.json              # Bun workspace root
```

> For a deep dive into how every layer connects, data flows, database schemas, and configuration reference, see the **[Architecture Document](ARCHITECTURE.md)**.

---

## Development

```bash
# Frontend only (proxies to gateway)
bun run dev

# Gateway only
bun run dev:gateway

# Both frontend + gateway
bun run dev:all

# RAG backend (with hot reload)
bun run dev:rag

# Docker services
docker compose up -d          # start
docker compose down            # stop
docker compose logs -f rag     # follow RAG logs
```

---

## Configuration

All settings via environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Default | What it does |
|----------|---------|-------------|
| `VECTOR_DB` | `pgvector` | Vector store mode: `pgvector`, `qdrant`, `hybrid` |
| `OLLAMA_HOST` | `http://localhost:11435` | Ollama endpoint for embeddings |
| `OLLAMA_MODEL` | `llama3.2:3b` | Default chat model (local fallback) |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model (768-dim) |
| `GROQ_API_KEY` | - | Groq Cloud API key (default LLM provider) |
| `CHUNK_SIZE` | `500` | Characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |

---

## Production Deployment (Digital Ocean + Traefik)

ragU ships with a production Docker Compose that includes Traefik for automatic HTTPS via Let's Encrypt.

```bash
# On your server (e.g. Digital Ocean droplet with Docker)
git clone https://github.com/pragmatalabs/ragU.git
cd ragU

# Configure production environment
cp .env.production .env
nano .env   # Set strong passwords!

# Deploy everything
bash scripts/deploy.sh
```

This spins up all services (Traefik, Nginx, Gateway, RAG, Ollama, PostgreSQL, Qdrant, MinIO, Redis) and pulls LLM models automatically.

**Live at:** `https://ragu.pragmata.cloud`

**Recommended droplet:** 4 vCPU / 8 GB RAM (CPU-optimized) for the 3B model. GPU droplets enable faster inference.

---

## Motivation

The AI ecosystem moves fast, but most of it is locked behind API paywalls and cloud platforms. I believe in **learning by building** --- and building locally means you own every bit of the stack.

ragU exists so anyone can:

- **Experiment freely** with LLMs, embeddings, and retrieval without cost barriers
- **Understand RAG end-to-end** --- from document parsing to vector search to generation
- **Compare vector databases** side-by-side with the same data and queries
- **Build intuition** about chunking strategies, embedding models, and search fusion
- **Prototype ideas** in a real full-stack environment, not just notebooks

If you're learning about AI infrastructure, exploring local LLMs, or just curious about how RAG works under the hood --- this is your sandbox.

---

## Troubleshooting & Tips

### File Upload Limit (10MB)

All document uploads are capped at **10MB** across the entire stack:

1. **Frontend** (`ChatInput.tsx`, `DocumentUpload.tsx`) -- rejects immediately with size error badge, no network request
2. **Gateway** (`documents.ts`) -- returns HTTP `413` before forwarding to backend
3. **RAG Backend** (`ingest.py`) -- final server-side guard, returns HTTP `413`

If you need to change the limit, update `MAX_FILE_SIZE` in all three layers.

### Ollama: Self-Contained vs Shared

ragU ships its own Ollama container (`ragu-ollama` on port `11435`) to avoid conflicts with other projects. If you already have Ollama running locally or in another stack:

```bash
# Point ragU to an existing Ollama instance instead
OLLAMA_HOST=http://localhost:11434   # native Ollama
OLLAMA_HOST=http://localhost:11444   # another Docker Ollama
```

Make sure the target Ollama has `nomic-embed-text` pulled -- embeddings will fail silently without it.

### Qdrant Health Check Fails

The Qdrant Docker image doesn't include `curl` or `wget`. The health check uses bash TCP probing:

```yaml
healthcheck:
  test: ["CMD-SHELL", "bash -c '</dev/tcp/localhost/6333' 2>/dev/null || exit 1"]
```

If you see `unhealthy` status, verify the port mapping matches (`6339:6333` by default).

### Rollup Native Module Error (Apple Silicon + Rosetta Node)

If you see `Cannot find module @rollup/rollup-darwin-x64` on an Apple Silicon Mac, your Node.js is the x86_64 build running under Rosetta, but pnpm only installs arm64 native modules.

**Fix:** Add `@rollup/rollup-darwin-x64` to `optionalDependencies` in `apps/web/package.json` (already included), then manually extract the tarball:

```bash
ROLLUP_VER=$(node -e "console.log(require('./node_modules/.pnpm/rollup@*/node_modules/rollup/package.json').version)")
curl -sL "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-${ROLLUP_VER}.tgz" -o /tmp/rollup-x64.tgz
mkdir -p apps/web/node_modules/@rollup/rollup-darwin-x64
tar -xzf /tmp/rollup-x64.tgz -C apps/web/node_modules/@rollup/rollup-darwin-x64 --strip-components=1
```

Or install native arm64 Node.js to avoid Rosetta entirely.

### Groq API Key Not Found in Dev

The gateway runs via Bun, which doesn't auto-load the root `.env`. Export it before starting:

```bash
source .env && export GROQ_API_KEY && bun run dev:all
```

### Port Already in Use

If `bun run dev:all` fails with `EADDRINUSE`, kill stale processes:

```bash
lsof -ti:3006 | xargs kill -9   # gateway
lsof -ti:5179 | xargs kill -9   # vite
lsof -ti:8006 | xargs kill -9   # RAG backend
```

### RAG Backend Crashes on Startup

Common causes:
- **`ModuleNotFoundError: No module named 'minio'`** -- run `pip install -r services/rag/requirements.txt`
- **`ConnectionRefusedError` on startup** -- Docker containers aren't ready yet. Run `docker compose up -d` and wait for all services to be `healthy`
- **Embeddings fail with `All connection attempts failed`** -- wrong `OLLAMA_HOST` in `.env`. Verify with `curl -s $OLLAMA_HOST/api/tags`

---

## License

**MIT** --- free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

This is a playground. Use it to learn, experiment, and build. No strings attached.

---

## Author

**Julian de la Rosa**

- GitHub: [@pragmatalabs](https://github.com/pragmatalabs)
- LinkedIn: [linkedin.com/in/jdlrs](https://www.linkedin.com/in/jdlrs/)

Built with curiosity and too much coffee.

---

<p align="center">
  <sub>If ragU helped you learn something, a star goes a long way.</sub>
</p>
