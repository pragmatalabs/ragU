import hashlib
import json
import logging

import asyncpg

from app.config import settings
from app.services.vectorstore import SearchResult, VectorStore

logger = logging.getLogger(__name__)


class PgVectorStore(VectorStore):
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def initialize(self) -> None:
        self.pool = await asyncpg.create_pool(
            settings.postgres_url, min_size=2, max_size=10
        )
        await self._migrate()

    async def _migrate(self) -> None:
        """Run idempotent schema migrations on startup."""
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            # Step 1: Add new columns
            await conn.execute(
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tsv tsvector"
            )
            await conn.execute(
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)"
            )

            # Step 2: Backfill tsvector for existing rows
            updated_tsv = await conn.execute("""
                UPDATE documents
                SET tsv = to_tsvector('simple', content)
                WHERE tsv IS NULL
            """)
            if "UPDATE 0" not in updated_tsv:
                logger.info("Backfilled tsvector: %s", updated_tsv)

            # Step 3: Backfill content_hash for existing rows
            updated_hash = await conn.execute("""
                UPDATE documents
                SET content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')
                WHERE content_hash IS NULL
            """)
            if "UPDATE 0" not in updated_hash:
                logger.info("Backfilled content_hash: %s", updated_hash)

            # Step 4: Remove duplicates (keep lowest id per collection+content_hash)
            deleted = await conn.execute("""
                DELETE FROM documents d
                USING (
                    SELECT collection, content_hash, MIN(id) AS keep_id
                    FROM documents
                    WHERE content_hash IS NOT NULL
                    GROUP BY collection, content_hash
                    HAVING COUNT(*) > 1
                ) dups
                WHERE d.collection = dups.collection
                  AND d.content_hash = dups.content_hash
                  AND d.id != dups.keep_id
            """)
            if "DELETE 0" not in deleted:
                logger.info("Removed duplicate chunks: %s", deleted)

            # Step 5: Create indexes (safe after dedup)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_documents_tsv
                    ON documents USING gin(tsv)
            """)
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_dedup
                    ON documents (collection, content_hash)
            """)

        logger.info("PgVectorStore migration complete")

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def add_returning_ids(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata: list[dict],
    ) -> list[int]:
        """Insert chunks and return their PG integer IDs (for Qdrant sync)."""
        assert self.pool is not None
        ids: list[int] = []
        async with self.pool.acquire() as conn:
            for i, (text, emb, meta) in enumerate(zip(texts, embeddings, metadata)):
                vec_str = "[" + ",".join(str(x) for x in emb) + "]"
                content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
                row = await conn.fetchrow(
                    """
                    INSERT INTO documents
                        (collection, filename, content, chunk_index,
                         embedding, metadata, content_hash, tsv)
                    VALUES
                        ($1, $2, $3, $4, $5::vector, $6::jsonb, $7,
                         to_tsvector('simple', $8))
                    ON CONFLICT (collection, content_hash)
                    DO UPDATE SET id = documents.id
                    RETURNING id
                    """,
                    collection,
                    meta.get("filename", ""),
                    text,
                    i,
                    vec_str,
                    json.dumps(meta),
                    content_hash,
                    text,
                )
                ids.append(row["id"])
        return ids

    async def add(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata: list[dict],
    ) -> None:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            for i, (text, emb, meta) in enumerate(zip(texts, embeddings, metadata)):
                vec_str = "[" + ",".join(str(x) for x in emb) + "]"
                content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
                await conn.execute(
                    """
                    INSERT INTO documents
                        (collection, filename, content, chunk_index,
                         embedding, metadata, content_hash, tsv)
                    VALUES
                        ($1, $2, $3, $4, $5::vector, $6::jsonb, $7,
                         to_tsvector('simple', $8))
                    ON CONFLICT (collection, content_hash) DO NOTHING
                    """,
                    collection,
                    meta.get("filename", ""),
                    text,
                    i,
                    vec_str,
                    json.dumps(meta),
                    content_hash,
                    text,
                )

    async def search(
        self,
        collection: str,
        embedding: list[float],
        top_k: int = 5,
        query_text: str | None = None,
    ) -> list[SearchResult]:
        assert self.pool is not None
        vec_str = "[" + ",".join(str(x) for x in embedding) + "]"

        if query_text:
            return await self._hybrid_search(collection, vec_str, query_text, top_k)
        return await self._vector_search(collection, vec_str, top_k)

    async def _vector_search(
        self, collection: str, vec_str: str, top_k: int
    ) -> list[SearchResult]:
        """Pure vector cosine similarity search (original behavior)."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT content, chunk_index, metadata,
                       1 - (embedding <=> $1::vector) AS score,
                       created_at::text AS created_at
                FROM documents
                WHERE collection = $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                vec_str,
                collection,
                top_k,
            )
        return [
            SearchResult(
                content=row["content"],
                score=float(row["score"]),
                metadata=json.loads(row["metadata"]),
                chunk_index=row["chunk_index"],
                created_at=row.get("created_at"),
            )
            for row in rows
        ]

    # Common stop words to filter from keyword queries (EN + ES)
    _STOP_WORDS = frozenset(
        "a an the is are was were be been being am do does did will shall "
        "would could should may might can have has had having get got gets "
        "of in on at to for with by from and or not no but if so than that "
        "this these those it its he she they them we you i me my his her "
        "their our your what which who whom how when where why about into "
        "el la los las un una unos unas de en por para con sin que es son "
        "del al y o no se lo le su sus como pero".split()
    )

    @classmethod
    def _to_or_tsquery(cls, text: str) -> str:
        """Convert free-text query to OR-joined tsquery string.

        'What is the Oracle project?' -> 'oracle | project'
        Strips stop words so common terms don't drown out meaningful keywords.
        """
        import re
        words = re.findall(r"[a-zA-Z0-9\u00C0-\u024F]+", text.lower())
        meaningful = [w for w in words if w not in cls._STOP_WORDS and len(w) > 1]
        if not meaningful:
            # Fall back to all words if everything was a stop word
            meaningful = [w for w in words if len(w) > 1]
        if not meaningful:
            return ""
        return " | ".join(meaningful)

    async def _hybrid_search(
        self,
        collection: str,
        vec_str: str,
        query_text: str,
        top_k: int,
        rrf_k: int = 60,
        kw_weight: float = 1.5,
        candidate_multiplier: int = 4,
    ) -> list[SearchResult]:
        """Combine vector similarity + full-text keyword search via RRF.

        Reciprocal Rank Fusion: score = 1/(k+vec_rank) + w/(k+kw_rank)
        where k=60, w=1.5 (keyword matches are weighted higher because
        they represent precise term matches vs approximate semantic similarity).
        """
        candidates = top_k * candidate_multiplier
        ts_query = self._to_or_tsquery(query_text)

        # Fall back to pure vector search if no usable keywords
        logger.info("Hybrid search: ts_query=%r, candidates=%d", ts_query, candidates)
        if not ts_query:
            logger.info("No keywords — falling back to vector search")
            return await self._vector_search(collection, vec_str, top_k)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH vector_ranked AS (
                    SELECT id, content, chunk_index, metadata, created_at,
                           ROW_NUMBER() OVER (
                               ORDER BY embedding <=> $1::vector
                           ) AS vec_rank
                    FROM documents
                    WHERE collection = $2
                    ORDER BY embedding <=> $1::vector
                    LIMIT $4
                ),
                keyword_ranked AS (
                    SELECT id, content, chunk_index, metadata, created_at,
                           ROW_NUMBER() OVER (
                               ORDER BY ts_rank_cd(tsv, to_tsquery('simple', $3)) DESC
                           ) AS kw_rank
                    FROM documents
                    WHERE collection = $2
                      AND tsv @@ to_tsquery('simple', $3)
                    ORDER BY ts_rank_cd(tsv, to_tsquery('simple', $3)) DESC
                    LIMIT $4
                ),
                fused AS (
                    SELECT
                        COALESCE(v.id, k.id) AS id,
                        COALESCE(v.content, k.content) AS content,
                        COALESCE(v.chunk_index, k.chunk_index) AS chunk_index,
                        COALESCE(v.metadata, k.metadata) AS metadata,
                        COALESCE(v.created_at, k.created_at)::text AS created_at,
                        COALESCE(1.0 / ($5 + v.vec_rank), 0) +
                        COALESCE($7 / ($5 + k.kw_rank), 0) AS score
                    FROM vector_ranked v
                    FULL OUTER JOIN keyword_ranked k ON v.id = k.id
                )
                SELECT content, chunk_index, metadata, score, created_at
                FROM fused
                ORDER BY score DESC
                LIMIT $6
                """,
                vec_str,        # $1: embedding vector
                collection,     # $2: collection name
                ts_query,       # $3: OR-joined tsquery string
                candidates,     # $4: candidate pool size per ranking
                rrf_k,          # $5: RRF constant k=60
                top_k,          # $6: final result limit
                kw_weight,      # $7: keyword ranking weight
            )

        return [
            SearchResult(
                content=row["content"],
                score=float(row["score"]),
                metadata=json.loads(row["metadata"]),
                chunk_index=row["chunk_index"],
                created_at=row.get("created_at"),
            )
            for row in rows
        ]

    async def list_collections(self) -> list[dict]:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT collection, COUNT(*) as chunk_count,
                       COUNT(DISTINCT filename) as doc_count
                FROM documents
                GROUP BY collection
                """
            )
        return [
            {
                "name": row["collection"],
                "chunk_count": row["chunk_count"],
                "doc_count": row["doc_count"],
            }
            for row in rows
        ]

    async def delete_collection(self, collection: str) -> None:
        assert self.pool is not None
        async with self.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM documents WHERE collection = $1", collection
            )
