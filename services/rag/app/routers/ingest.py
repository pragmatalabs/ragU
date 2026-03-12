import asyncio
import time
import uuid
import traceback
import logging

from fastapi import APIRouter, UploadFile
from fastapi.responses import JSONResponse

from app.services.chunker import chunk_text
from app.services.embedder import embed_texts
from app.services.parser import extract_text
from app.services.vectorstore import get_store
from app.services.storage import upload_file, get_file, ensure_bucket

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory job tracker
jobs: dict[str, dict] = {}

# Max time a job can stay in "processing" before being marked stale (seconds)
STALE_TIMEOUT = 300


async def _process_document(job_id: str, key: str, filename: str, collection: str):
    """Background task: read from MinIO → chunk → embed → store."""
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["started_at"] = time.time()
        logger.info(f"[{job_id}] Processing started: {filename}")

        # Read file from MinIO (sync → run in thread to avoid blocking event loop)
        data = await asyncio.to_thread(get_file, key)

        # Extract text using format-aware parser (PDF, DOCX, XLS, etc.)
        text = await asyncio.to_thread(extract_text, data, filename)
        logger.info(f"[{job_id}] Parsed {filename}: {len(text)} chars")

        # Chunk (CPU-bound → run in thread)
        chunks = await asyncio.to_thread(chunk_text, text)
        jobs[job_id]["chunks"] = len(chunks)
        logger.info(f"[{job_id}] Chunked: {len(chunks)} chunks")

        if not chunks:
            jobs[job_id]["status"] = "completed"
            logger.info(f"[{job_id}] No chunks, completed")
            return

        # Batch embed (single Ollama call — already async)
        logger.info(f"[{job_id}] Embedding {len(chunks)} chunks...")
        embeddings = await embed_texts(chunks)
        logger.info(f"[{job_id}] Embedded: {len(embeddings)} vectors")

        # Store in vector DB
        metadata = [{"filename": filename, "chunk_index": i, "minio_key": key} for i in range(len(chunks))]
        store = get_store()
        await store.add(collection, chunks, embeddings, metadata)
        logger.info(f"[{job_id}] Stored in vector DB")

        jobs[job_id]["status"] = "completed"
        logger.info(f"[{job_id}] Completed successfully")

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        logger.error(f"[{job_id}] Failed: {e}")
        traceback.print_exc()


@router.post("")
async def ingest_document(file: UploadFile, collection: str = "default"):
    """Upload file to MinIO and start async processing."""
    await asyncio.to_thread(ensure_bucket)

    content = await file.read()
    filename = file.filename or "unknown"

    # Store in MinIO under collection prefix (sync → thread)
    key = f"{collection}/{uuid.uuid4().hex}_{filename}"
    await asyncio.to_thread(
        upload_file, key, content, file.content_type or "application/octet-stream"
    )

    # Create job and start background processing
    job_id = uuid.uuid4().hex[:12]
    jobs[job_id] = {
        "status": "queued",
        "filename": filename,
        "collection": collection,
        "minio_key": key,
        "chunks": 0,
        "error": None,
        "created_at": time.time(),
        "started_at": None,
    }

    asyncio.create_task(_process_document(job_id, key, filename, collection))

    return JSONResponse(
        content={
            "job_id": job_id,
            "filename": filename,
            "collection": collection,
            "minio_key": key,
            "status": "queued",
        },
        status_code=202,
    )


@router.get("/status/{job_id}")
async def ingest_status(job_id: str):
    """Check processing status of an ingest job."""
    job = jobs.get(job_id)
    if not job:
        return JSONResponse(content={"error": "Job not found"}, status_code=404)

    # Detect stale processing jobs (background task lost during hot-reload)
    if job["status"] == "processing" and job.get("started_at"):
        elapsed = time.time() - job["started_at"]
        if elapsed > STALE_TIMEOUT:
            job["status"] = "failed"
            job["error"] = "Processing timed out (server may have restarted)"

    return {
        "job_id": job_id,
        "status": job["status"],
        "filename": job["filename"],
        "collection": job["collection"],
        "minio_key": job["minio_key"],
        "chunks": job["chunks"],
        "error": job["error"],
    }
