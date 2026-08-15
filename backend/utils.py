from __future__ import annotations

import math
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel


def to_jsonable(value: Any) -> Any:
    """Recursively convert objects to JSON-serializable types.

    Pydantic models use ``model_dump`` instead of ``dict`` in v2, so prefer
    that method when available to avoid deprecation warnings.
    """
    if isinstance(value, BaseModel):
        # `model_dump` returns a dict; fall back to `.dict()` for older versions
        data = value.model_dump() if hasattr(value, "model_dump") else value.dict()
        return to_jsonable(data)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    return value


def now_iso() -> str:
    """Return the current UTC time in ISO-8601 form."""
    return datetime.utcnow().isoformat()


def build_media_url(folder: str, filename: str, base_url: str) -> str:
    return f"{base_url.rstrip('/')}/uploads/{folder}/{filename}"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


def calc_sma(values: Sequence[float], period: int) -> List[Optional[float]]:
    result: List[Optional[float]] = []
    for idx in range(len(values)):
        if idx + 1 < period:
            result.append(None)
            continue
        window = values[idx + 1 - period : idx + 1]
        result.append(sum(window) / period)
    return result


def calc_ema(values: Sequence[float], period: int) -> List[Optional[float]]:
    result: List[Optional[float]] = []
    k = 2 / (period + 1)
    ema_prev: Optional[float] = None
    for price in values:
        if ema_prev is None:
            ema_prev = price
        else:
            ema_prev = (price * k) + (ema_prev * (1 - k))
        result.append(ema_prev)
    return result
