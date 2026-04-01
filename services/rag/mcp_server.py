"""
ragU MCP Server — Expose document search tools to Claude via stdio.

Usage:
  Standalone test:  cd services/rag && python mcp_server.py
  Claude Code:      auto-discovered via .mcp.json in project root
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP

from app.config import settings
from app.services.embedder import embed_query
from app.services.vectorstore import get_store

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Store lifecycle
# ---------------------------------------------------------------------------

_store = None


async def _init_store():
    global _store
    _store = get_store()
    await _store.initialize()
    logger.info("ragU MCP: store initialized (%s)", settings.vector_db)


async def _close_store():
    global _store
    if _store:
        await _store.close()
        logger.info("ragU MCP: store closed")


@asynccontextmanager
async def server_lifespan(server):
    await _init_store()
    try:
        yield {}
    finally:
        await _close_store()


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "ragU",
    instructions="Search and browse documents in the ragU knowledge base",
    lifespan=server_lifespan,
)


@mcp.tool()
async def search_documents(
    question: str,
    collection: str = "default",
    top_k: int = 5,
) -> str:
    """Search documents in the ragU knowledge base using semantic + keyword hybrid search.

    Returns the most relevant chunks matching the question, with content, scores, and metadata.
    Use this to find information across uploaded documents (PDFs, DOCX, spreadsheets, etc).

    Args:
        question: The search query or question to find relevant document chunks for.
        collection: The document collection to search in (default: "default").
        top_k: Number of results to return, 1-20 (default: 5).
    """
    top_k = max(1, min(20, top_k))

    try:
        embedding = await embed_query(question)
        results = await _store.search(
            collection=collection,
            embedding=embedding,
            top_k=top_k,
            query_text=question,
        )
    except Exception as e:
        return json.dumps({"error": str(e)})

    if not results:
        return json.dumps({
            "message": f"No results found for '{question}' in collection '{collection}'.",
            "results": [],
        })

    return json.dumps({
        "question": question,
        "collection": collection,
        "result_count": len(results),
        "results": [
            {
                "rank": i + 1,
                "content": r.content,
                "score": round(r.score, 4),
                "filename": r.metadata.get("filename", "unknown"),
                "chunk_index": r.chunk_index,
                "metadata": r.metadata,
            }
            for i, r in enumerate(results)
        ],
    }, ensure_ascii=False)


@mcp.tool()
async def list_collections() -> str:
    """List all document collections in the ragU knowledge base.

    Returns collection names with chunk and document counts.
    Use this to discover what collections are available before searching.
    """
    try:
        collections = await _store.list_collections()
    except Exception as e:
        return json.dumps({"error": str(e)})

    if not collections:
        return json.dumps({
            "message": "No collections found. Upload documents first.",
            "collections": [],
        })

    return json.dumps({
        "collection_count": len(collections),
        "collections": collections,
    })


@mcp.tool()
async def get_document_chunks(
    filename: str,
    collection: str = "default",
) -> str:
    """Retrieve all chunks from a specific document in reading order.

    Use this to read the full content of a previously ingested document.

    Args:
        filename: The filename to retrieve (e.g. "report.pdf", "notes.md").
        collection: The collection the document belongs to (default: "default").
    """
    # Access the asyncpg pool from the store
    pool = getattr(_store, "pool", None)
    if pool is None:
        pg = getattr(_store, "pg", None)
        if pg:
            pool = getattr(pg, "pool", None)

    if pool is None:
        return json.dumps({
            "error": "Document chunk retrieval requires pgvector or hybrid mode.",
        })

    try:
        rows = await pool.fetch(
            """
            SELECT content, chunk_index, metadata::text, created_at::text
            FROM documents
            WHERE collection = $1 AND metadata->>'filename' = $2
            ORDER BY chunk_index
            """,
            collection,
            filename,
        )
    except Exception as e:
        return json.dumps({"error": str(e)})

    if not rows:
        return json.dumps({
            "message": f"No chunks found for '{filename}' in collection '{collection}'.",
            "chunks": [],
        })

    chunks = []
    for row in rows:
        meta = {}
        try:
            meta = json.loads(row["metadata"]) if row["metadata"] else {}
        except (json.JSONDecodeError, TypeError):
            pass
        chunks.append({
            "chunk_index": row["chunk_index"],
            "content": row["content"],
            "created_at": row["created_at"],
            "metadata": meta,
        })

    return json.dumps({
        "filename": filename,
        "collection": collection,
        "chunk_count": len(chunks),
        "chunks": chunks,
    }, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
