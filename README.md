# ragU

Local LLM / SLM / RAG / MCP Playground. All services run in Docker, no cloud required.

## Stack

| Layer       | Tech                                |
|-------------|-------------------------------------|
| LLM Runtime | Ollama (Llama 3.2:3b, quantized)   |
| RAG Backend | Python + FastAPI                    |
| API Gateway | TypeScript + Hono (bun)             |
| Frontend    | React + Vite + Tailwind CSS         |
| Vector DBs  | pgvector (PostgreSQL) + Qdrant      |
| Embeddings  | nomic-embed-text via Ollama         |

## Ports

All ports offset by +6 from defaults to avoid collisions:

| Service    | Port  |
|------------|-------|
| Frontend   | 5179  |
| Gateway    | 3006  |
| RAG API    | 8006  |
| Ollama     | 11440 |
| PostgreSQL | 5438  |
| Qdrant     | 6339  |

## Quick Start

```bash
# 1. Copy environment
cp .env.example .env

# 2. Install JS dependencies
bun install

# 3. Start all Docker services (Ollama, Qdrant, PostgreSQL, RAG, Gateway)
docker compose up -d

# 4. Pull models (first time only — takes a few minutes)
bash scripts/init-ollama.sh

# 5. Start the frontend (with hot reload)
bun run dev
```

Open http://localhost:5179 and start chatting.

## Features

- **Chat**: Stream responses from local LLMs via Ollama
- **Model Management**: Pull and switch between models from the UI
- **RAG**: Upload documents, chunk + embed, retrieve context for augmented responses
- **Vector DB Toggle**: Switch between pgvector and Qdrant via `VECTOR_DB` env var
- **Settings**: Temperature, Top P, Top K sliders
- **Dark Mode**: Default dark UI

## Architecture

```
Browser (React) → Gateway (Hono) → Ollama (LLM)
                                  → RAG Backend (FastAPI) → pgvector / Qdrant
                                                          → Ollama (embeddings)
```

## Development

```bash
# Frontend only (proxies API to gateway)
bun run dev

# Gateway only
bun run dev:gateway

# Both frontend + gateway
bun run dev:all

# Docker services
docker compose up -d      # start
docker compose down        # stop
docker compose logs -f     # follow logs
```

## Environment Variables

See `.env.example` for all configuration options. Key ones:

- `VECTOR_DB` — `qdrant` (default) or `pgvector`
- `OLLAMA_MODEL` — default chat model
- `OLLAMA_EMBED_MODEL` — embedding model for RAG
- `CHUNK_SIZE` / `CHUNK_OVERLAP` — RAG chunking parameters
