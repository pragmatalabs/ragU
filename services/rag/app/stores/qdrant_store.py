import uuid

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings
from app.services.vectorstore import SearchResult, VectorStore

VECTOR_SIZE = 768  # nomic-embed-text dimension


class QdrantStore(VectorStore):
    def __init__(self):
        self.client: AsyncQdrantClient | None = None

    async def initialize(self) -> None:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.client = AsyncQdrantClient(url=settings.qdrant_url)

    async def close(self) -> None:
        if self.client:
            await self.client.close()

    async def _ensure_collection(self, collection: str) -> None:
        assert self.client is not None
        collections = await self.client.get_collections()
        names = [c.name for c in collections.collections]
        if collection not in names:
            await self.client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )

    async def add(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata: list[dict],
    ) -> None:
        assert self.client is not None
        await self._ensure_collection(collection)

        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb,
                payload={"content": text, "chunk_index": i, **meta},
            )
            for i, (text, emb, meta) in enumerate(zip(texts, embeddings, metadata))
        ]

        await self.client.upsert(collection_name=collection, points=points)

    async def search(
        self,
        collection: str,
        embedding: list[float],
        top_k: int = 5,
        query_text: str | None = None,
    ) -> list[SearchResult]:
        assert self.client is not None
        results = await self.client.query_points(
            collection_name=collection,
            query=embedding,
            limit=top_k,
        )

        return [
            SearchResult(
                content=hit.payload.get("content", "") if hit.payload else "",
                score=hit.score if hit.score is not None else 0.0,
                metadata={k: v for k, v in (hit.payload or {}).items() if k not in ("content", "chunk_index")},
                chunk_index=hit.payload.get("chunk_index", 0) if hit.payload else 0,
            )
            for hit in results.points
        ]

    async def list_collections(self) -> list[dict]:
        assert self.client is not None
        collections = await self.client.get_collections()
        result = []
        for c in collections.collections:
            info = await self.client.get_collection(c.name)
            result.append({
                "name": c.name,
                "chunk_count": info.points_count,
                "doc_count": info.points_count,  # approximate
            })
        return result

    async def delete_collection(self, collection: str) -> None:
        assert self.client is not None
        await self.client.delete_collection(collection_name=collection)
