from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    ollama_embed_model: str = "nomic-embed-text"

    vector_db: str = "pgvector"  # "pgvector", "qdrant", or "hybrid"

    postgres_url: str = "postgresql://ragu:ragu_local@localhost:5438/ragu"

    qdrant_url: str = "http://localhost:6339"

    redis_url: str = "redis://localhost:6379/0"

    # MinIO
    minio_endpoint: str = "localhost:9008"
    minio_access_key: str = "ragu"
    minio_secret_key: str = "ragu_local_s3"
    minio_bucket: str = "ragu-documents"

    chunk_size: int = 500
    chunk_overlap: int = 50

    model_config = {"env_file": ".env"}


settings = Settings()
