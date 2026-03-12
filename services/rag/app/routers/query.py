from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.services.embedder import embed_query
from app.services.vectorstore import get_store

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    collection: str = "default"
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("")
async def rag_query(req: QueryRequest):
    """Retrieve relevant chunks for a question."""
    embedding = await embed_query(req.question)

    store = get_store()
    results = await store.search(
        req.collection, embedding, top_k=req.top_k, query_text=req.question
    )

    context = "\n\n---\n\n".join(r.content for r in results)
    sources = [
        {
            "content": r.content[:200],
            "score": round(r.score, 4),
            "metadata": r.metadata,
            "chunk_index": r.chunk_index,
        }
        for r in results
    ]

    return {
        "context": context,
        "sources": sources,
        "question": req.question,
        "collection": req.collection,
    }
