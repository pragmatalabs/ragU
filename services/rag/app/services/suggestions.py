"""Proactive suggestion engine for ragU RAG pipeline.

Analyzes the retrieval pool to surface:
- Adjacency: near-miss documents with high similarity
- Recency: retrieved docs that may be outdated
- Risk: queries matching risk keywords in retrieved content
"""

import hashlib
import logging
from datetime import datetime, timezone

from app.services.vectorstore import SearchResult

logger = logging.getLogger(__name__)

RISK_KEYWORDS = frozenset(
    "migration cutover production deprecated breaking security incident "
    "rollback outage downtime vulnerability compliance audit".split()
)


def _months_since(date_str: str | None) -> float | None:
    """Return months since a date string, or None if unparseable."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace(" ", "T").split(".")[0])
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        delta = now - dt
        return delta.days / 30.0
    except (ValueError, TypeError):
        return None


def _suggestion_id(type_: str, title: str) -> str:
    """Generate a deterministic suggestion ID."""
    raw = f"{type_}:{title}"
    return f"sugg-{hashlib.md5(raw.encode()).hexdigest()[:12]}"


def compute_suggestions(
    query_text: str,
    top_results: list[SearchResult],
    candidate_pool: list[SearchResult],
    top_k: int,
    max_suggestions: int = 2,
    adjacency_threshold: float = 0.02,  # RRF score threshold for near-misses
    recency_months: int = 12,
) -> list[dict]:
    """Compute proactive suggestions from the retrieval pool.

    Args:
        query_text: The user's original question.
        top_results: The top-K results returned to the user.
        candidate_pool: The full over-fetched pool (top_k * 3).
        top_k: The original requested result count.
        max_suggestions: Cap on suggestions returned (default 2).
        adjacency_threshold: Minimum score for near-miss adjacency suggestions.
        recency_months: Months after which a doc is flagged as potentially outdated.

    Returns:
        List of suggestion dicts with {id, type, title, reason, snippet, score}.
    """
    suggestions: list[dict] = []
    top_filenames = {
        r.metadata.get("filename", "") for r in top_results if r.metadata
    }

    # --- Adjacency: near-miss documents not in top results ---
    near_misses = candidate_pool[top_k:]
    seen_adjacency_files: set[str] = set()

    for result in near_misses:
        filename = result.metadata.get("filename", "") if result.metadata else ""
        if not filename or filename in top_filenames or filename in seen_adjacency_files:
            continue
        if result.score < adjacency_threshold:
            continue

        seen_adjacency_files.add(filename)
        suggestions.append({
            "id": _suggestion_id("adjacency", filename),
            "type": "adjacency",
            "title": filename,
            "reason": f"This document has relevant content not in your top results (score: {result.score:.2f})",
            "snippet": result.content[:150] + "..." if len(result.content) > 150 else result.content,
            "score": result.score,  # Use as priority
        })

    # --- Recency: old docs in top results ---
    seen_recency_files: set[str] = set()
    for result in top_results:
        filename = result.metadata.get("filename", "") if result.metadata else ""
        if not filename or filename in seen_recency_files:
            continue

        months = _months_since(result.created_at)
        if months is not None and months > recency_months:
            seen_recency_files.add(filename)
            age_str = f"{int(months)} months" if months < 24 else f"{months / 12:.1f} years"
            suggestions.append({
                "id": _suggestion_id("recency", filename),
                "type": "recency",
                "title": filename,
                "reason": f"This document was ingested {age_str} ago. A newer version may exist.",
                "snippet": result.content[:150] + "..." if len(result.content) > 150 else result.content,
                "score": min(months / 24.0, 1.0),  # Older = higher priority
            })

    # --- Risk keywords ---
    query_lower = query_text.lower()
    matched_risk_words = [w for w in RISK_KEYWORDS if w in query_lower]

    if matched_risk_words:
        seen_risk_files: set[str] = set()
        for result in top_results:
            filename = result.metadata.get("filename", "") if result.metadata else ""
            if not filename or filename in seen_risk_files:
                continue

            content_lower = result.content.lower()
            overlap = [w for w in matched_risk_words if w in content_lower]
            if overlap:
                seen_risk_files.add(filename)
                suggestions.append({
                    "id": _suggestion_id("risk", filename),
                    "type": "risk",
                    "title": filename,
                    "reason": f"Risk keywords detected: {', '.join(overlap)}. Review this document carefully.",
                    "snippet": result.content[:150] + "..." if len(result.content) > 150 else result.content,
                    "score": 0.5 + len(overlap) * 0.1,
                })

    # Sort by score descending, cap at max_suggestions
    suggestions.sort(key=lambda s: s["score"], reverse=True)
    return suggestions[:max_suggestions]
