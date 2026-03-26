from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.services.embedder import embed_query
from app.services.vectorstore import get_store
from app.services.suggestions import compute_suggestions

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    collection: str = "default"
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("")
async def rag_query(req: QueryRequest):
    """Retrieve relevant chunks for a question, with proactive suggestions."""
    embedding = await embed_query(req.question)

    store = get_store()

    # Over-fetch 3x candidates for the suggestion engine
    fetch_k = req.top_k * 3
    candidate_pool = await store.search(
        req.collection, embedding, top_k=fetch_k, query_text=req.question
    )

    # Top results for the user
    top_results = candidate_pool[: req.top_k]

    # Compute proactive suggestions from the full pool
    suggestions = compute_suggestions(
        query_text=req.question,
        top_results=top_results,
        candidate_pool=candidate_pool,
        top_k=req.top_k,
    )

    # Sort by filename + chunk_index so context reads in document order
    sorted_for_context = sorted(
        top_results,
        key=lambda r: (r.metadata.get("filename", ""), r.chunk_index),
    )
    context = "\n\n---\n\n".join(r.content for r in sorted_for_context)
    sources = [
        {
            "content": r.content[:200],
            "score": round(r.score, 4),
            "metadata": r.metadata,
            "chunk_index": r.chunk_index,
        }
        for r in top_results
    ]

    return {
        "context": context,
        "sources": sources,
        "suggestions": suggestions,
        "question": req.question,
        "collection": req.collection,
    }
