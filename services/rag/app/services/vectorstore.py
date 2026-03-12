from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.config import settings


@dataclass
class SearchResult:
    content: str
    score: float
    metadata: dict
    chunk_index: int


class VectorStore(ABC):
    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def add(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata: list[dict],
    ) -> None: ...

    @abstractmethod
    async def search(
        self,
        collection: str,
        embedding: list[float],
        top_k: int = 5,
        query_text: str | None = None,
    ) -> list[SearchResult]: ...

    @abstractmethod
    async def list_collections(self) -> list[dict]: ...

    @abstractmethod
    async def delete_collection(self, collection: str) -> None: ...


_store: VectorStore | None = None


def get_store() -> VectorStore:
    global _store
    if _store is not None:
        return _store

    if settings.vector_db == "pgvector":
        from app.stores.pgvector_store import PgVectorStore

        _store = PgVectorStore()
    elif settings.vector_db == "hybrid":
        from app.stores.hybrid_store import HybridStore

        _store = HybridStore()
    else:
        from app.stores.qdrant_store import QdrantStore

        _store = QdrantStore()

    return _store
