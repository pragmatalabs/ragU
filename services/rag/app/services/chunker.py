from app.config import settings


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    """Split text into overlapping chunks using natural boundaries."""
    size = chunk_size or settings.chunk_size
    lap = overlap or settings.chunk_overlap

    if not text or not text.strip():
        return []

    text = text.strip()

    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    separators = ["\n\n", "\n", ". ", " "]
    start = 0
    min_advance = size - lap  # Minimum chars to advance (e.g. 500 - 50 = 450)

    while start < len(text):
        end = start + size

        if end >= len(text):
            chunk = text[start:].strip()
            if chunk:
                chunks.append(chunk)
            break

        # Try to break at a natural boundary (prefer later ones via rfind)
        split_pos = end
        for sep in separators:
            # Only look for separators in the second half of the chunk
            # to avoid splitting too early
            search_start = start + min_advance
            pos = text.rfind(sep, search_start, end)
            if pos > start:
                split_pos = pos + len(sep)
                break

        chunk = text[start:split_pos].strip()
        if chunk:
            chunks.append(chunk)

        # Advance: overlap back from split point, but always move forward by min_advance
        start = max(split_pos - lap, start + min_advance)

    return chunks
