from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import collections, files, ingest, query
from app.services.vectorstore import get_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = get_store()
    await store.initialize()
    yield
    await store.close()


app = FastAPI(
    title="ragU RAG Service",
    description="Local RAG backend for the ragU playground",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(query.router, prefix="/query", tags=["query"])
app.include_router(collections.router, prefix="/collections", tags=["collections"])
app.include_router(files.router, prefix="/files", tags=["files"])


@app.get("/health")
async def health():
    return {"status": "ok", "vector_db": settings.vector_db}
