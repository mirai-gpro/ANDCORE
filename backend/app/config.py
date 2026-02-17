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
    frontend_url: str = "http://localhost:4321"

    # GMOペイメントゲートウェイ（リンクタイプPlus）
    gmo_shop_id: str = ""
    gmo_shop_pass: str = ""
    gmo_config_id: str = ""
    # テスト環境: https://stg.link.mul-pay.jp  本番: https://link.mul-pay.jp
    gmo_link_url: str = "https://stg.link.mul-pay.jp"
    # 結果通知の検証用ハッシュキー（管理画面で設定）
    gmo_result_hash_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
