from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # general
    backend_dir: Path = Path(__file__).resolve().parent
    media_base_url: AnyHttpUrl = AnyHttpUrl("http://localhost:8000")
    external_timeout: int = 6

    # cors
    cors_origins: List[AnyHttpUrl] = Field(
        default=[
            AnyHttpUrl("http://localhost:8081"),
            AnyHttpUrl("http://127.0.0.1:8081"),
            AnyHttpUrl("http://localhost:19006"),
            AnyHttpUrl("http://127.0.0.1:19006"),
        ],
        description="Allowed CORS origins for the FastAPI app.",
    )

    # database paths
    db_auth_path: Path = backend_dir / "unihub_auth.db"
    db_state_path: Path = backend_dir / "unihub_state.db"

    # domain-specific
    live_stock_symbols: List[str] = Field(
        default=["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD"],
        description="Symbols used by the live stocks widget.",
    )

    # various external APIs
    nominatim_base_url: AnyHttpUrl = AnyHttpUrl("https://nominatim.openstreetmap.org")
    overpass_api_url: AnyHttpUrl = AnyHttpUrl("https://overpass-api.de/api/interpreter")
    osrm_base_url: AnyHttpUrl = AnyHttpUrl("https://router.project-osrm.org")
    openmeteo_base_url: AnyHttpUrl = AnyHttpUrl("https://api.open-meteo.com/v1")
    frankfurter_api_url: AnyHttpUrl = AnyHttpUrl("https://api.frankfurter.app")
    worldtime_api_url: AnyHttpUrl = AnyHttpUrl("https://worldtimeapi.org/api")
    nominatim_user_agent: str = "UniHub/1.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# singleton instance used throughout the project
settings = Settings()
