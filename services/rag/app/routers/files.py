import asyncio

from fastapi import APIRouter

from app.services.storage import list_files, delete_file, ensure_bucket

router = APIRouter()


@router.get("")
async def get_files(collection: str = ""):
    """List files in MinIO, optionally filtered by collection prefix."""
    await asyncio.to_thread(ensure_bucket)
    prefix = f"{collection}/" if collection else ""
    return await asyncio.to_thread(list_files, prefix)


@router.delete("/{key:path}")
async def remove_file(key: str):
    """Delete a file from MinIO."""
    await asyncio.to_thread(delete_file, key)
    return {"status": "deleted", "key": key}
