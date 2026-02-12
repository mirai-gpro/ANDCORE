"""アプリケーション設定"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Google Cloud Storage
    gcs_bucket_name: str = "encore-media"
    gcs_credentials_path: str | None = None

    # CORS
    allowed_origins: str = "http://localhost:4321"

    # App
    environment: str = "development"

    model_config = {"env_file": ".env"}


settings = Settings()
