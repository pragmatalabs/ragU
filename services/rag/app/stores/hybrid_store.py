import json
import logging

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings
from app.services.vectorstore import SearchResult, VectorStore
from app.stores.pgvector_store import PgVectorStore

VECTOR_SIZE = 768  # nomic-embed-text dimension

logger = logging.getLogger(__name__)


def _parse_pg_vector(text: str) -> list[float]:
    """Parse a pgvector text representation '[0.1,0.2,...]' into a list of floats."""
    return [float(x) for x in text.strip("[]").split(",")]


class HybridStore(VectorStore):
    """Dual-store: PostgreSQL (system of record) + Qdrant (ANN engine).

    - Dual-write: PG first, then Qdrant (best-effort)
    - Search: Qdrant ANN for vector ranking + PG keyword search, fused via RRF
    - Graceful degradation: falls back to PG-only if Qdrant is unreachable
    """

    def __init__(self):
        self.pg = PgVectorStore()
        self.qdrant: AsyncQdrantClient | None = None
        self._qdrant_healthy = False

    async def initialize(self) -> None:
        # PG is always required (system of record)
        await self.pg.initialize()

        # Qdrant is best-effort
        try:
            import warnings

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self.qdrant = AsyncQdrantClient(url=settings.qdrant_url)
            await self.qdrant.get_collections()  # health check
            self._qdrant_healthy = True
            logger.info("Qdrant connected at %s", settings.qdrant_url)
        except Exception as e:
            logger.warning("Qdrant unavailable (%s) — running PG-only", e)
            self._qdrant_healthy = False

        if self._qdrant_healthy:
            await self._sync_pg_to_qdrant()

    async def close(self) -> None:
        await self.pg.close()
        if self.qdrant:
            await self.qdrant.close()

    async def _ensure_qdrant_collection(self, collection: str) -> None:
        """Create Qdrant collection if it doesn't exist."""
        assert self.qdrant is not None
        collections = await self.qdrant.get_collections()
        names = [c.name for c in collections.collections]
        if collection not in names:
            await self.qdrant.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE, distance=Distance.COSINE
                ),
            )
            logger.info("Created Qdrant collection: %s", collection)

    async def _sync_pg_to_qdrant(self) -> None:
        """One-time sync: copy PG vectors into Qdrant for existing data."""
        assert self.qdrant is not None
        collections = await self.pg.list_collections()
        for col in collections:
            name = col["name"]
            await self._ensure_qdrant_collection(name)

            # Skip if Qdrant already has data
            info = await self.qdrant.get_collection(name)
            if info.points_count and info.points_count > 0:
                logger.info(
                    "Qdrant collection %s already has %d points — skipping sync",
                    name,
                    info.points_count,
                )
                continue

            # Batch-read from PG
            assert self.pg.pool is not None
            async with self.pg.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, embedding::text, content, chunk_index, metadata
                    FROM documents
                    WHERE collection = $1 AND embedding IS NOT NULL
                    """,
                    name,
                )

            if not rows:
                continue

            # Build points and upsert in batches
            points = [
                PointStruct(
                    id=row["id"],
                    vector=_parse_pg_vector(row["embedding"]),
                    payload={
                        "content": row["content"],
                        "chunk_index": row["chunk_index"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                    },
                )
                for row in rows
            ]

            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                await self.qdrant.upsert(collection_name=name, points=batch)

            logger.info(
                "Synced %d points to Qdrant collection %s", len(points), name
            )

    async def add(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata: list[dict],
    ) -> None:
        # PG first (system of record) — returns integer IDs for Qdrant
        ids = await self.pg.add_returning_ids(collection, texts, embeddings, metadata)

        # Qdrant (best-effort)
        if self._qdrant_healthy and self.qdrant:
            try:
                await self._ensure_qdrant_collection(collection)
                points = [
                    PointStruct(
                        id=pg_id,
                        vector=emb,
                        payload={"content": text, "chunk_index": i, "metadata": meta},
                    )
                    for pg_id, i, text, emb, meta in zip(
                        ids, range(len(texts)), texts, embeddings, metadata
                    )
                ]
                await self.qdrant.upsert(
                    collection_name=collection, points=points
                )
            except Exception as e:
                logger.warning("Qdrant write failed (%s) — data safe in PG", e)

    async def search(
        self,
        collection: str,
        embedding: list[float],
        top_k: int = 5,
        query_text: str | None = None,
    ) -> list[SearchResult]:
        # If Qdrant is down or no query text, delegate to PG (which has its own hybrid search)
        if not self._qdrant_healthy or not self.qdrant or not query_text:
            return await self.pg.search(collection, embedding, top_k, query_text)

        try:
            return await self._dual_hybrid_search(
                collection, embedding, query_text, top_k
            )
        except Exception as e:
            logger.warning("Qdrant search failed (%s) — falling back to PG", e)
            return await self.pg.search(collection, embedding, top_k, query_text)

    async def _dual_hybrid_search(
        self,
        collection: str,
        embedding: list[float],
        query_text: str,
        top_k: int,
        rrf_k: int = 60,
        kw_weight: float = 3.0,
        candidate_multiplier: int = 4,
    ) -> list[SearchResult]:
        """Fuse Qdrant ANN results + PG keyword results via RRF in Python."""
        assert self.qdrant is not None
        candidates = top_k * candidate_multiplier

        # 1. Qdrant ANN vector search
        qdrant_results = await self.qdrant.query_points(
            collection_name=collection,
            query=embedding,
            limit=candidates,
        )

        # 2. PG keyword search
        ts_query = PgVectorStore._to_or_tsquery(query_text)
        logger.info(
            "Dual hybrid search: ts_query=%r, candidates=%d", ts_query, candidates
        )

        if not ts_query:
            # No meaningful keywords — use Qdrant results only
            return [
                SearchResult(
                    content=hit.payload.get("content", "") if hit.payload else "",
                    score=hit.score if hit.score is not None else 0.0,
                    metadata=hit.payload.get("metadata", {}) if hit.payload else {},
                    chunk_index=(
                        hit.payload.get("chunk_index", 0) if hit.payload else 0
                    ),
                )
                for hit in qdrant_results.points[:top_k]
            ]

        # Keyword results from PG
        assert self.pg.pool is not None
        async with self.pg.pool.acquire() as conn:
            kw_rows = await conn.fetch(
                """
                SELECT id, content, chunk_index, metadata,
                       ts_rank_cd(tsv, to_tsquery('simple', $2)) AS kw_score
                FROM documents
                WHERE collection = $1
                  AND tsv @@ to_tsquery('simple', $2)
                ORDER BY kw_score DESC
                LIMIT $3
                """,
                collection,
                ts_query,
                candidates,
            )

        # 3. RRF fusion in Python
        # Build rank maps: id -> rank (1-based)
        vec_ranks: dict[int, int] = {}
        vec_data: dict[int, dict] = {}
        for rank, hit in enumerate(qdrant_results.points, 1):
            point_id = hit.id if isinstance(hit.id, int) else int(hit.id)
            vec_ranks[point_id] = rank
            vec_data[point_id] = {
                "content": hit.payload.get("content", "") if hit.payload else "",
                "chunk_index": (
                    hit.payload.get("chunk_index", 0) if hit.payload else 0
                ),
                "metadata": {},
            }

        kw_ranks: dict[int, int] = {}
        kw_data: dict[int, dict] = {}
        for rank, row in enumerate(kw_rows, 1):
            doc_id = row["id"]
            kw_ranks[doc_id] = rank
            kw_data[doc_id] = {
                "content": row["content"],
                "chunk_index": row["chunk_index"],
                "metadata": json.loads(row["metadata"]),
            }

        # All candidate IDs
        all_ids = set(vec_ranks.keys()) | set(kw_ranks.keys())

        # Compute RRF scores
        scored: list[tuple[int, float]] = []
        for doc_id in all_ids:
            vec_score = 1.0 / (rrf_k + vec_ranks[doc_id]) if doc_id in vec_ranks else 0
            kw_score = (
                kw_weight / (rrf_k + kw_ranks[doc_id]) if doc_id in kw_ranks else 0
            )
            scored.append((doc_id, vec_score + kw_score))

        # Sort by fused score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Build results — prefer kw_data metadata (has filename) over vec_data (empty)
        results: list[SearchResult] = []
        for doc_id, score in scored[:top_k]:
            vd = vec_data.get(doc_id, {})
            kd = kw_data.get(doc_id, {})
            # Use kw_data metadata if vec_data has none (Qdrant payloads lack filename)
            metadata = kd.get("metadata", {}) if kd.get("metadata") else vd.get("metadata", {})
            content = vd.get("content") or kd.get("content", "")
            chunk_index = vd.get("chunk_index") if vd else kd.get("chunk_index", 0)
            results.append(
                SearchResult(
                    content=content,
                    score=score,
                    metadata=metadata,
                    chunk_index=chunk_index,
                )
            )

        return results

    async def list_collections(self) -> list[dict]:
        # PG is the source of truth
        return await self.pg.list_collections()

    async def delete_collection(self, collection: str) -> None:
        # Delete from both stores
        await self.pg.delete_collection(collection)
        if self._qdrant_healthy and self.qdrant:
            try:
                await self.qdrant.delete_collection(collection_name=collection)
            except Exception as e:
                logger.warning("Qdrant delete failed (%s) — PG already cleaned", e)
