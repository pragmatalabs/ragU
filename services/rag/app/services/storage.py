import io
from minio import Minio
from minio.error import S3Error

from app.config import settings

_client: Minio | None = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
    return _client


def ensure_bucket() -> None:
    client = get_minio()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = get_minio()
    client.put_object(
        settings.minio_bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return key


def get_file(key: str) -> bytes:
    client = get_minio()
    response = client.get_object(settings.minio_bucket, key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def list_files(prefix: str = "") -> list[dict]:
    client = get_minio()
    objects = client.list_objects(settings.minio_bucket, prefix=prefix, recursive=True)
    return [
        {
            "key": obj.object_name,
            "size": obj.size,
            "modified": obj.last_modified.isoformat() if obj.last_modified else None,
        }
        for obj in objects
        if obj.object_name is not None
    ]


def delete_file(key: str) -> None:
    client = get_minio()
    try:
        client.remove_object(settings.minio_bucket, key)
    except S3Error:
        pass
