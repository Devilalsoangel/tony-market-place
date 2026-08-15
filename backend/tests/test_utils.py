import time
from pathlib import Path

import pytest

from backend import utils, settings


def test_to_jsonable_primitives():
    assert utils.to_jsonable(123) == 123
    assert utils.to_jsonable("foo") == "foo"
    assert utils.to_jsonable([1, 2, 3]) == [1, 2, 3]
    assert utils.to_jsonable({"a": 1}) == {"a": 1}


def test_to_jsonable_models_and_enum():
    from pydantic import BaseModel
    from enum import Enum

    class MyEnum(Enum):
        A = "a"

    class M(BaseModel):
        x: int
        y: MyEnum

    m = M(x=5, y=MyEnum.A)
    result = utils.to_jsonable(m)
    # ensure conversion and no warnings; the exact dict structure should match
    assert result == {"x": 5, "y": "a"}


def test_now_iso_format():
    iso = utils.now_iso()
    # should parse with datetime
    from datetime import datetime

    dt = datetime.fromisoformat(iso)
    assert dt.tzinfo is None  # utc naive


def test_build_media_url():
    url = utils.build_media_url("stories", "pic.png", "http://example.com")
    assert url == "http://example.com/uploads/stories/pic.png"


def test_haversine():
    # distance between identical points should be zero
    assert utils.haversine_km(0, 0, 0, 0) == pytest.approx(0)


def test_calc_sma_and_ema():
    values = [1, 2, 3, 4, 5]
    sma3 = utils.calc_sma(values, 3)
    assert sma3[2] == pytest.approx(2.0)
    ema3 = utils.calc_ema(values, 3)
    assert isinstance(ema3, list)


def test_settings_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDIA_BASE_URL", "http://envhost")
    # reload settings by instantiating fresh Settings
    from backend.settings import Settings
    new = Settings()
    assert str(new.media_base_url).rstrip("/") == "http://envhost"
