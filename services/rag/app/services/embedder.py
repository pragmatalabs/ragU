import httpx

from app.config import settings


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using Ollama batch API."""
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            f"{settings.ollama_host}/api/embed",
            json={"model": settings.ollama_embed_model, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"]


async def embed_query(text: str) -> list[float]:
    """Generate embedding for a single query."""
    result = await embed_texts([text])
    return result[0]
