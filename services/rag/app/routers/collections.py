from fastapi import APIRouter

from app.services.vectorstore import get_store

router = APIRouter()


@router.get("")
async def list_collections():
    """List all vector collections."""
    store = get_store()
    return await store.list_collections()


@router.delete("/{name}")
async def delete_collection(name: str):
    """Delete a vector collection."""
    store = get_store()
    await store.delete_collection(name)
    return {"status": "deleted", "collection": name}
