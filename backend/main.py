import logging
import time
import math
from functools import lru_cache
from typing import Any, Dict, List, Optional
from uuid import uuid4
import os
import urllib.parse
import urllib.request
import json
from pathlib import Path
from datetime import datetime
from enum import Enum

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

# unified import strategy: try relative (package), fall back to absolute (direct run)
try:
    from . import auth_routes, utils
    from .auth_db import get_user_by_id, init_auth_db, get_all_users
    from .auth_routes import get_current_user, router as auth_router
    from .auth_tokens import decode_token
    from .state_db import get_state, init_state_db, seed_state, set_state
    from .chat import ChatConnectionManager
    from .settings import settings
except ImportError:
    import auth_routes, utils
    from auth_db import get_user_by_id, init_auth_db, get_all_users
    from auth_routes import get_current_user, router as auth_router
    from auth_tokens import decode_token
    from state_db import get_state, init_state_db, seed_state, set_state
    from chat import ChatConnectionManager
    from settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # initialize databases and in-memory state on startup
    init_auth_db()
    init_state_db()
    _hydrate_all_state()
    _remove_legacy_seeded_mock_data()

    # sync auth DB users into USERS dict (non-fatal)
    try:
        auth_users = get_all_users()
        for u in auth_users:
            uid = int(u.get("id", 0) or 0)
            if uid and uid not in USERS:
                username = str(u.get("username") or f"user_{uid}")
                full_name = str(u.get("full_name") or username)
                avatar = f"https://ui-avatars.com/api/?name={urllib.parse.quote(full_name)}&background=2563eb&color=ffffff"
                USERS[uid] = User(id=uid, username=username, name=full_name, avatar=avatar, bio="", followers=0, following=0)
        _persist_state(STATE_KEYS["users"], USERS)
    except Exception:
        pass

    yield


app = FastAPI(title="UniHub API", description="Social Media + E-Commerce (Amazon, Temu, Facebook Marketplace style)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# directories and URLs driven by configuration
BACKEND_DIR = settings.backend_dir
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_BASE_URL = str(settings.media_base_url).rstrip("/")

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

STATE_KEYS = {
    "users": "users",
    "sellers": "sellers",
    "products": "products",
    "posts": "posts",
    "messages": "messages",
    "stories": "stories",
    "products_review": "products_review",
    "cart": "cart",
    "orders": "orders",
    "watchlists": "watchlists",
    "trades": "trades",
    "portfolios": "portfolios",
    "notifications": "notifications",
    "reviews": "reviews",
    "wishlists": "wishlists",
    "wallets": "wallets",
    "chat_messages": "chat_messages",
    "follows": "follows",
    "copy_traders": "copy_traders",
    "loyalty_points": "loyalty_points",
    "analytics_data": "analytics_data",
    "settings_data": "settings_data",
    "payment_intents": "payment_intents",
    "live_shopping_events": "live_shopping_events",
    "support_messages": "support_messages",
}

# configuration-driven constants
EXTERNAL_TIMEOUT_SECONDS = settings.external_timeout
LIVE_STOCK_SYMBOLS = settings.live_stock_symbols
NOMINATIM_BASE_URL = str(settings.nominatim_base_url).rstrip("/")
OVERPASS_API_URL = str(settings.overpass_api_url)
OSRM_BASE_URL = str(settings.osrm_base_url).rstrip("/")
OPENMETEO_BASE_URL = str(settings.openmeteo_base_url).rstrip("/")
FRANKFURTER_API_URL = str(settings.frankfurter_api_url).rstrip("/")
WORLDTIME_API_URL = str(settings.worldtime_api_url).rstrip("/")
NOMINATIM_USER_AGENT = settings.nominatim_user_agent



def _persist_state(key: str, value: Any) -> None:
    set_state(key, utils.to_jsonable(value))


def _save_upload_file(upload: UploadFile, folder: str, allowed_prefixes: List[str]) -> str:
    content_type = (upload.content_type or "").lower()
    if not any(content_type.startswith(prefix) for prefix in allowed_prefixes):
        allowed = ", ".join(allowed_prefixes)
        raise HTTPException(status_code=400, detail=f"Unsupported media type. Expected: {allowed}")

    extension = Path(upload.filename or "").suffix.lower()
    if not extension:
        extension = ".bin"
    safe_name = f"{uuid4().hex}{extension}"
    target_dir = UPLOADS_DIR / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / safe_name

    upload.file.seek(0)
    with open(target_path, "wb") as handle:
        handle.write(upload.file.read())

    return utils.build_media_url(folder, safe_name, MEDIA_BASE_URL)


def _message_to_payload(msg: Any) -> Dict[str, Any]:
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "sender_name": msg.sender_name,
        "content": msg.content,
        "timestamp": msg.timestamp,
        "read": msg.read,
    }


# CHAT_WS_MANAGER remains as imported from chat module
CHAT_WS_MANAGER = ChatConnectionManager()


def _user_from_access_token(access_token: str) -> Dict[str, Any]:
    if not access_token:
        raise HTTPException(status_code=401, detail="Missing access token.")

    try:
        payload = decode_token(access_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    user_id = int(payload.get("sub", "0"))
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def _fetch_json(url: str, headers: Optional[Dict[str, str]] = None) -> Optional[Any]:
    request = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=EXTERNAL_TIMEOUT_SECONDS) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except Exception:
        return None
    return None


def _fetch_json_post(url: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Optional[Any]:
    payload = urllib.parse.urlencode(data).encode("utf-8")
    request_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=payload, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=EXTERNAL_TIMEOUT_SECONDS + 8) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except Exception:
        return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
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


# simple in‑memory cache for external stock fetches
_last_stocks: List[Any] = []
_last_stocks_ts: float = 0.0


def _fetch_live_stocks() -> List[Any]:
    global _last_stocks, _last_stocks_ts
    now = time.time()
    # reuse cached result for 5 seconds to avoid hammering Yahoo
    if now - _last_stocks_ts < 5 and _last_stocks:
        return _last_stocks

    symbols = ",".join(LIVE_STOCK_SYMBOLS)
    payload = _fetch_json(f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}")
    if not isinstance(payload, dict):
        return []

    quote_response = payload.get("quoteResponse", {})
    results = quote_response.get("result", []) if isinstance(quote_response, dict) else []
    if not isinstance(results, list):
        return []

    live_stocks: List[Any] = []
    for idx, item in enumerate(results, start=1):
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol", "")).upper()
        name = str(item.get("longName") or item.get("shortName") or symbol)
        price = float(item.get("regularMarketPrice", 0) or 0)
        change_amount = float(item.get("regularMarketChange", 0) or 0)
        change_percent = float(item.get("regularMarketChangePercent", 0) or 0)
        market_cap_raw = float(item.get("marketCap", 0) or 0)
        volume_raw = float(item.get("regularMarketVolume", 0) or 0)

        if price <= 0:
            continue

        market_cap = f"{market_cap_raw / 1_000_000_000_000:.2f}T" if market_cap_raw >= 1_000_000_000_000 else f"{market_cap_raw / 1_000_000_000:.2f}B"
        volume = f"{volume_raw / 1_000_000:.1f}M" if volume_raw >= 1_000_000 else str(int(volume_raw))
        high_52 = float(item.get("fiftyTwoWeekHigh", price) or price)
        low_52 = float(item.get("fiftyTwoWeekLow", price) or price)
        pe_ratio = float(item.get("trailingPE", 0) or 0)
        dividend = float(item.get("trailingAnnualDividendYield", 0) or 0) * 100

        # Basic synthetic short sparkline based on current move.
        base = price - (change_amount * 3)
        chart = [max(0.01, base + change_amount * step) for step in [0.2, 0.5, 0.8, 1.0, 1.1, 1.2, 1.3]]

        live_stocks.append(
            Stock(
                id=idx,
                symbol=symbol,
                name=name,
                price=price,
                change=change_percent,
                change_amount=change_amount,
                market_cap=market_cap,
                volume=volume,
                high_52w=high_52,
                low_52w=low_52,
                pe_ratio=pe_ratio,
                dividend_yield=dividend,
                description=f"Live quote from Yahoo Finance for {symbol}.",
                chart_data=chart,
            )
        )

    _last_stocks = live_stocks
    _last_stocks_ts = now
    return live_stocks


# _calc_sma has been replaced by utils.calc_sma


# _calc_ema has been replaced by utils.calc_ema


def _calc_rsi(values: List[float], period: int = 14) -> List[Optional[float]]:
    if len(values) < 2:
        return [None for _ in values]

    gains = [0.0]
    losses = [0.0]
    for idx in range(1, len(values)):
        delta = values[idx] - values[idx - 1]
        gains.append(max(delta, 0.0))
        losses.append(abs(min(delta, 0.0)))

    rsi: List[Optional[float]] = []
    avg_gain = 0.0
    avg_loss = 0.0
    for idx in range(len(values)):
        if idx < period:
            rsi.append(None)
            continue
        if idx == period:
            avg_gain = sum(gains[1 : period + 1]) / period
            avg_loss = sum(losses[1 : period + 1]) / period
        else:
            avg_gain = ((avg_gain * (period - 1)) + gains[idx]) / period
            avg_loss = ((avg_loss * (period - 1)) + losses[idx]) / period

        if avg_loss == 0:
            rsi.append(100.0)
            continue

        rs = avg_gain / avg_loss
        rsi.append(100 - (100 / (1 + rs)))
    return rsi


def _fetch_stock_chart(symbol: str, chart_range: str, interval: str) -> Dict[str, Any]:
    safe_range = chart_range if chart_range in {"1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"} else "1mo"
    safe_interval = interval if interval in {"1m", "5m", "15m", "30m", "1h", "1d", "1wk"} else "1d"
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}"
        f"?range={safe_range}&interval={safe_interval}"
    )
    payload = _fetch_json(url)
    if not isinstance(payload, dict):
        payload = None

    chart = payload.get("chart", {}) if isinstance(payload, dict) else {}
    results = chart.get("result", []) if isinstance(chart, dict) else []
    timestamps: List[Any] = []
    opens: List[Any] = []
    highs: List[Any] = []
    lows: List[Any] = []
    closes: List[Any] = []
    volumes: List[Any] = []

    if isinstance(results, list) and results:
        result = results[0]
        timestamps = result.get("timestamp", []) if isinstance(result, dict) else []
        indicators = result.get("indicators", {}) if isinstance(result, dict) else {}
        quotes = indicators.get("quote", []) if isinstance(indicators, dict) else []
        quote = quotes[0] if isinstance(quotes, list) and quotes else {}
        opens = quote.get("open", []) if isinstance(quote, dict) else []
        highs = quote.get("high", []) if isinstance(quote, dict) else []
        lows = quote.get("low", []) if isinstance(quote, dict) else []
        closes = quote.get("close", []) if isinstance(quote, dict) else []
        volumes = quote.get("volume", []) if isinstance(quote, dict) else []

    # Fallback: derive candles from Stooq daily CSV data if Yahoo returns no usable chart points.
    if not timestamps:
        stooq_symbol = f"{symbol.lower()}.us"
        stooq_url = f"https://stooq.com/q/d/l/?s={urllib.parse.quote(stooq_symbol)}&i=d"
        try:
            with urllib.request.urlopen(stooq_url, timeout=EXTERNAL_TIMEOUT_SECONDS) as response:
                raw = response.read().decode("utf-8").strip().splitlines()
            if len(raw) > 1:
                rows = raw[1:]
                limit = 252 if safe_range == "1y" else 90 if safe_range == "3mo" else 30
                rows = rows[-limit:]
                parsed_rows = []
                for idx, row in enumerate(rows):
                    parts = row.split(",")
                    if len(parts) < 6:
                        continue
                    # Date,Open,High,Low,Close,Volume
                    o = float(parts[1])
                    h = float(parts[2])
                    l = float(parts[3])
                    c = float(parts[4])
                    v = float(parts[5])
                    ts = idx + 1
                    parsed_rows.append((ts, o, h, l, c, v))
                if parsed_rows:
                    timestamps = [row[0] for row in parsed_rows]
                    opens = [row[1] for row in parsed_rows]
                    highs = [row[2] for row in parsed_rows]
                    lows = [row[3] for row in parsed_rows]
                    closes = [row[4] for row in parsed_rows]
                    volumes = [row[5] for row in parsed_rows]
        except Exception:
            pass

    candles = []
    close_values: List[float] = []
    for idx, ts in enumerate(timestamps):
        try:
            o = float(opens[idx])
            h = float(highs[idx])
            l = float(lows[idx])
            c = float(closes[idx])
            v = float(volumes[idx] or 0)
        except Exception:
            continue
        close_values.append(c)
        candles.append(
            {
                "t": int(ts),
                "o": o,
                "h": h,
                "l": l,
                "c": c,
                "v": v,
            }
        )

    sma20 = utils.calc_sma(close_values, 20)
    ema20 = utils.calc_ema(close_values, 20)
    rsi14 = _calc_rsi(close_values, 14)

    return {
        "symbol": symbol.upper(),
        "range": safe_range,
        "interval": safe_interval,
        "candles": candles,
        "indicators": {
            "sma20": sma20,
            "ema20": ema20,
            "rsi14": rsi14,
        },
    }


def _hydrate_model_list(key: str, model_cls: Any, default_items: List[Any]) -> List[Any]:
    default_payload = utils.to_jsonable(default_items)
    raw_items = seed_state(key, default_payload)
    if not isinstance(raw_items, list):
        set_state(key, default_payload)
        return default_items
    hydrated = []
    for item in raw_items:
        try:
            hydrated.append(model_cls(**item))
        except Exception:
            continue
    if not raw_items:
        return []
    return hydrated if hydrated else default_items


def _hydrate_model_dict(key: str, model_cls: Any, default_items: Dict[int, Any]) -> Dict[int, Any]:
    default_payload = utils.to_jsonable(default_items)
    raw_items = seed_state(key, default_payload)
    if not isinstance(raw_items, dict):
        set_state(key, default_payload)
        return default_items

    hydrated: Dict[int, Any] = {}
    for raw_key, raw_value in raw_items.items():
        try:
            hydrated[int(raw_key)] = model_cls(**raw_value)
        except Exception:
            continue
    if not raw_items:
        return {}
    return hydrated if hydrated else default_items


def _hydrate_cart(default_cart: Dict[int, List[Any]]) -> Dict[int, List[Any]]:
    default_payload = utils.to_jsonable(default_cart)
    raw_cart = seed_state(STATE_KEYS["cart"], default_payload)
    if not isinstance(raw_cart, dict):
        set_state(STATE_KEYS["cart"], default_payload)
        return default_cart

    hydrated: Dict[int, List[CartItem]] = {}
    for raw_user_id, raw_items in raw_cart.items():
        if not isinstance(raw_items, list):
            continue
        items: List[CartItem] = []
        for raw_item in raw_items:
            try:
                items.append(CartItem(**raw_item))
            except Exception:
                continue
        hydrated[int(raw_user_id)] = items
    return hydrated


def _hydrate_primitive_list(key: str, default_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    default_payload = utils.to_jsonable(default_items)
    raw_items = seed_state(key, default_payload)
    if not isinstance(raw_items, list):
        set_state(key, default_payload)
        return default_items
    return raw_items


def _hydrate_all_state() -> None:
    global USERS, SELLERS, PRODUCTS
    global POSTS, MESSAGES, STORIES, PRODUCTS_REVIEW, CART, ORDERS, WATCHLISTS, TRADES, PORTFOLIOS
    global NOTIFICATIONS, REVIEWS, WISHLISTS, WALLETS, CHAT_MESSAGES, FOLLOWS
    global COPY_TRADERS, LOYALTY_POINTS, ANALYTICS_DATA, SETTINGS_DATA
    global PAYMENT_INTENTS, LIVE_SHOPPING_EVENTS, SUPPORT_MESSAGES

    USERS = _hydrate_model_dict(STATE_KEYS["users"], User, USERS)
    SELLERS = _hydrate_model_list(STATE_KEYS["sellers"], Seller, SELLERS)
    PRODUCTS = _hydrate_model_list(STATE_KEYS["products"], Product, PRODUCTS)
    POSTS = _hydrate_model_list(STATE_KEYS["posts"], Post, POSTS)
    MESSAGES = _hydrate_model_list(STATE_KEYS["messages"], Message, MESSAGES)
    STORIES = _hydrate_model_list(STATE_KEYS["stories"], Story, STORIES)
    PRODUCTS_REVIEW = _hydrate_model_list(STATE_KEYS["products_review"], Review, PRODUCTS_REVIEW)
    CART = _hydrate_cart(CART)
    ORDERS = _hydrate_model_list(STATE_KEYS["orders"], Order, ORDERS)
    WATCHLISTS = _hydrate_model_list(STATE_KEYS["watchlists"], Watchlist, WATCHLISTS)
    TRADES = _hydrate_model_list(STATE_KEYS["trades"], Trade, TRADES)
    PORTFOLIOS = _hydrate_model_dict(STATE_KEYS["portfolios"], Portfolio, PORTFOLIOS)
    NOTIFICATIONS = _hydrate_primitive_list(STATE_KEYS["notifications"], NOTIFICATIONS)
    REVIEWS = _hydrate_primitive_list(STATE_KEYS["reviews"], REVIEWS)
    WISHLISTS = _hydrate_primitive_list(STATE_KEYS["wishlists"], WISHLISTS)
    WALLETS = _hydrate_primitive_list(STATE_KEYS["wallets"], WALLETS)
    CHAT_MESSAGES = _hydrate_primitive_list(STATE_KEYS["chat_messages"], CHAT_MESSAGES)
    FOLLOWS = _hydrate_primitive_list(STATE_KEYS["follows"], FOLLOWS)
    COPY_TRADERS = _hydrate_primitive_list(STATE_KEYS["copy_traders"], COPY_TRADERS)
    LOYALTY_POINTS = _hydrate_primitive_list(STATE_KEYS["loyalty_points"], LOYALTY_POINTS)
    ANALYTICS_DATA = _hydrate_primitive_list(STATE_KEYS["analytics_data"], ANALYTICS_DATA)
    SETTINGS_DATA = _hydrate_primitive_list(STATE_KEYS["settings_data"], SETTINGS_DATA)
    PAYMENT_INTENTS = _hydrate_primitive_list(STATE_KEYS["payment_intents"], PAYMENT_INTENTS)
    LIVE_SHOPPING_EVENTS = _hydrate_primitive_list(STATE_KEYS["live_shopping_events"], LIVE_SHOPPING_EVENTS)
    SUPPORT_MESSAGES = _hydrate_primitive_list(STATE_KEYS["support_messages"], SUPPORT_MESSAGES)


def _remove_legacy_seeded_mock_data() -> None:
    global POSTS, PRODUCTS_REVIEW

    # Remove old hardcoded demo posts if they were previously persisted in state DB.
    if POSTS and len(POSTS) <= 3:
        looks_legacy_posts = all(
            p.user_id in {1, 2, 3}
            and "via.placeholder.com" in str(p.avatar)
            and ("via.placeholder.com" in str(p.image) or p.image is None)
            for p in POSTS
        )
        if looks_legacy_posts:
            POSTS = []
            _persist_state(STATE_KEYS["posts"], POSTS)

    # Remove old seeded product reviews tied to the previous demo catalog.
    if PRODUCTS_REVIEW and len(PRODUCTS_REVIEW) <= 3:
        legacy_usernames = {"john_doe", "jane_smith", "mike_tech"}
        looks_legacy_reviews = all(
            r.username in legacy_usernames and r.product_id in {1, 2}
            for r in PRODUCTS_REVIEW
        )
        if looks_legacy_reviews:
            PRODUCTS_REVIEW = []
            _persist_state(STATE_KEYS["products_review"], PRODUCTS_REVIEW)


def _require_user_access(user_id: int, current_user: Dict[str, Any]) -> None:
    if int(current_user["id"]) != int(user_id):
        raise HTTPException(status_code=403, detail="Forbidden: user scope mismatch.")




app.include_router(auth_router)


# Enums
class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# User Models
class User(BaseModel):
    id: int
    username: str
    name: str
    avatar: str
    bio: str
    followers: int
    following: int

# Social Models
class Post(BaseModel):
    id: int
    user_id: int
    username: str
    avatar: str
    content: str
    image: Optional[str]
    likes: int
    comments: int
    timestamp: str
    price: Optional[float] = None
    category: Optional[str] = None
    condition: Optional[str] = None
    hashtags: Optional[List[str]] = None
    seller_name: Optional[str] = None
    seller_avatar: Optional[str] = None

class Message(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    sender_name: str
    content: str
    timestamp: str
    read: bool

class Comment(BaseModel):
    id: int
    user_id: int
    username: str
    content: str
    timestamp: str

class Story(BaseModel):
    id: int
    user_id: int
    username: str
    avatar: str
    image: str
    expires_in: int  # seconds

# E-Commerce Models
class Seller(BaseModel):
    id: int
    user_id: int
    shop_name: str
    shop_avatar: str
    rating: float
    reviews_count: int
    followers: int
    bio: str

class Product(BaseModel):
    id: int
    seller_id: int
    seller_name: str
    seller_avatar: str
    name: str
    description: str
    price: float
    original_price: Optional[float]
    image: str
    images: Optional[List[str]]
    category: str
    rating: float
    reviews: int
    sold: int
    stock: int
    shipping_cost: float
    estimated_delivery: str

class CartItem(BaseModel):
    product_id: int
    seller_id: int
    quantity: int
    price: float

class Order(BaseModel):
    id: int
    user_id: int
    items: List[CartItem]
    total_price: float
    shipping_address: str
    status: OrderStatus
    created_at: str
    estimated_delivery: str

class Review(BaseModel):
    id: int
    product_id: int
    user_id: int
    username: str
    rating: float
    text: str
    timestamp: str
    helpful: int

# Forex & Stock Models
class Stock(BaseModel):
    id: int
    symbol: str
    name: str
    price: float
    change: float  # percentage change
    change_amount: float
    market_cap: str
    volume: str
    high_52w: float
    low_52w: float
    pe_ratio: float
    dividend_yield: float
    description: str
    chart_data: List[float]  # last 7 days

class ForexPair(BaseModel):
    id: int
    symbol: str  # e.g., EUR/USD
    name: str
    rate: float
    bid: float
    ask: float
    change: float
    change_percent: float
    high: float
    low: float
    description: str
    chart_data: List[float]

class Watchlist(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: str
    items: List[int]  # List of stock/forex IDs

class Portfolio(BaseModel):
    id: int
    user_id: int
    total_value: float
    cash: float
    invested: float
    profit_loss: float
    profit_loss_percent: float

class PortfolioHolding(BaseModel):
    id: int
    portfolio_id: int
    asset_symbol: str
    asset_name: str
    quantity: float
    buy_price: float
    current_price: float
    value: float
    profit_loss: float
    profit_loss_percent: float
    type: str  # "stock" or "forex"

class Trade(BaseModel):
    id: int
    user_id: int
    symbol: str
    asset_name: str
    type: str  # "buy" or "sell"
    quantity: float
    price: float
    total_amount: float
    timestamp: str
    asset_type: str  # "stock" or "forex"


class CheckoutRequest(BaseModel):
    address: str
    payment_intent_id: Optional[str] = None


class AmountRequest(BaseModel):
    amount: float


class LoyaltyPointsRequest(BaseModel):
    points: int


class ChatSendRequest(BaseModel):
    message: str


class SettingsUpdateRequest(BaseModel):
    dark_mode: Optional[bool] = None
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class SendMessageRequest(BaseModel):
    receiver_id: int
    content: str


class PostCommentRequest(BaseModel):
    content: str


class StoryCreateRequest(BaseModel):
    image: str


class CreatePostRequest(BaseModel):
    content: str
    image: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    condition: Optional[str] = None
    hashtags: Optional[List[str]] = None


class PaymentIntentRequest(BaseModel):
    user_id: int
    amount: float
    currency: str = "usd"
    gateway: str = "mockpay"


class PaymentConfirmRequest(BaseModel):
    intent_id: str
    user_id: int


class LiveShoppingEventRequest(BaseModel):
    seller_id: int
    title: str
    product_ids: List[int]
    starts_at: str
    stream_url: Optional[str] = None


class SupportChatRequest(BaseModel):
    user_id: int
    message: str


class OptionsTradeRequest(BaseModel):
    user_id: int
    contract_symbol: str
    contracts: int
    premium: float
    side: str = "buy"

USERS: Dict[int, User] = {}
SELLERS: List[Seller] = []
PRODUCTS: List[Product] = []
PRODUCTS_REVIEW: List[Review] = []
POSTS: List[Post] = [
    Post(
        id=1,
        user_id=1,
        username="fashion_king",
        avatar="https://ui-avatars.com/api/?name=Fashion+King&background=FF6B9D&color=ffffff",
        content="Nike Air Max 90 — barely worn, looks brand new! Size 10. Perfect for daily wear.",
        image="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        likes=47,
        comments=12,
        timestamp="2026-07-18T10:30:00Z",
        price=4999,
        category="Fashion",
        condition="Like New",
        hashtags=["nike", "sneakers", "fashion", "deals"],
        seller_name="Fashion King",
        seller_avatar="https://ui-avatars.com/api/?name=Fashion+King&background=FF6B9D&color=ffffff",
    ),
    Post(
        id=2,
        user_id=2,
        username="tech_dealer",
        avatar="https://ui-avatars.com/api/?name=Tech+Dealer&background=4A90D9&color=ffffff",
        content="iPhone 15 Pro Max 256GB — unlocked, warranty until Dec 2027. Box & accessories included.",
        image="https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800",
        likes=89,
        comments=23,
        timestamp="2026-07-18T09:15:00Z",
        price=129999,
        category="Electronics",
        condition="New",
        hashtags=["iphone", "apple", "phone", "electronics"],
        seller_name="Tech Dealer",
        seller_avatar="https://ui-avatars.com/api/?name=Tech+Dealer&background=4A90D9&color=ffffff",
    ),
    Post(
        id=3,
        user_id=3,
        username="beauty_parlour",
        avatar="https://ui-avatars.com/api/?name=Beauty+Parlour&background=FF69B4&color=ffffff",
        content="Bridal makeup package — includes hair, makeup, draping. Book now for wedding season!",
        image="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800",
        likes=34,
        comments=8,
        timestamp="2026-07-18T08:00:00Z",
        price=15000,
        category="Beauty",
        condition="New",
        hashtags=["bridal", "makeup", "beauty", "wedding"],
        seller_name="Beauty Parlour",
        seller_avatar="https://ui-avatars.com/api/?name=Beauty+Parlour&background=FF69B4&color=ffffff",
    ),
    Post(
        id=4,
        user_id=1,
        username="home_fixer",
        avatar="https://ui-avatars.com/api/?name=Home+Fixer&background=8B4513&color=ffffff",
        content="Professional plumbing services — leak repair, pipe fitting, bathroom renovation. 10+ years exp.",
        image="https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800",
        likes=21,
        comments=5,
        timestamp="2026-07-17T16:45:00Z",
        price=500,
        category="Home Services",
        condition="New",
        hashtags=["plumbing", "home", "repair", "services"],
        seller_name="Home Fixer",
        seller_avatar="https://ui-avatars.com/api/?name=Home+Fixer&background=8B4513&color=ffffff",
    ),
    Post(
        id=5,
        user_id=2,
        username="fresh_mart",
        avatar="https://ui-avatars.com/api/?name=Fresh+Mart&background=00C853&color=ffffff",
        content="Organic vegetable basket — farm fresh, delivered to your door. Includes tomato, spinach, capsicum, onion.",
        image="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800",
        likes=56,
        comments=15,
        timestamp="2026-07-17T14:20:00Z",
        price=399,
        category="Food",
        condition="New",
        hashtags=["organic", "vegetables", "fresh", "healthy"],
        seller_name="Fresh Mart",
        seller_avatar="https://ui-avatars.com/api/?name=Fresh+Mart&background=00C853&color=ffffff",
    ),
]
MESSAGES: List[Message] = []
STORIES: List[Story] = []
STOCKS: List[Stock] = []
FOREX_PAIRS: List[ForexPair] = []
PORTFOLIOS: Dict[int, Portfolio] = {}
PORTFOLIO_HOLDINGS: List[PortfolioHolding] = []
TRADES: List[Trade] = []
WATCHLISTS: List[Watchlist] = []

CART = {}  # user_id -> list of CartItems
ORDERS = []  # List of Order


def _ensure_user_profile(user_id: int) -> Optional[User]:
    existing = USERS.get(int(user_id))
    if existing:
        return existing

    auth_user = get_user_by_id(int(user_id))
    if not auth_user:
        return None

    username = str(auth_user.get("username") or f"user_{user_id}")
    full_name = str(auth_user.get("full_name") or username)
    avatar = f"https://ui-avatars.com/api/?name={urllib.parse.quote(full_name)}&background=2563eb&color=ffffff"
    profile = User(
        id=int(auth_user["id"]),
        username=username,
        name=full_name,
        avatar=avatar,
        bio="",
        followers=0,
        following=0,
    )
    USERS[profile.id] = profile
    _persist_state(STATE_KEYS["users"], USERS)
    return profile


# User endpoints
@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    profile = _ensure_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

@app.get("/users")
async def list_users(page: int = 1, per_page: int = 20):
    """Return paginated user profiles.

    Response is a JSON object containing paging metadata and a list of
    items so that the frontend can easily render page controls.
    """
    all_users = list(USERS.values())
    total = len(all_users)
    start = (page - 1) * per_page
    end = start + per_page
    return {"page": page, "per_page": per_page, "total": total, "items": all_users[start:end]}

# Feed endpoints
@app.get("/feed", response_model=List[Post])
async def get_feed():
    return sorted(POSTS, key=lambda post: post.id, reverse=True)

@app.post("/posts")
async def create_post(
    payload: CreatePostRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    new_id = max((p.id for p in POSTS), default=0) + 1
    username = str(current_user.get("username") or f"user_{current_user['id']}")
    full_name = str(current_user.get("full_name") or username)
    avatar = f"https://ui-avatars.com/api/?name={urllib.parse.quote(full_name)}&background=2563eb&color=ffffff"
    POSTS.append(
        Post(
            id=new_id,
            user_id=int(current_user["id"]),
            username=username,
            avatar=avatar,
            content=payload.content.strip(),
            image=payload.image,
            likes=0,
            comments=0,
            timestamp=utils.now_iso(),
            price=payload.price,
            category=payload.category,
            condition=payload.condition,
            hashtags=payload.hashtags,
            seller_name=full_name,
            seller_avatar=avatar,
        )
    )
    _persist_state(STATE_KEYS["posts"], POSTS)
    return {"success": True, "post_id": new_id}

@app.post("/posts/{post_id}/like")
async def like_post(post_id: int):
    for post in POSTS:
        if post.id == post_id:
            post.likes += 1
            _persist_state(STATE_KEYS["posts"], POSTS)
            return {"success": True, "likes": post.likes}
    return {"error": "Post not found"}

@app.post("/posts/{post_id}/comment")
async def comment_on_post(
    post_id: int,
    payload: PostCommentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    for post in POSTS:
        if post.id == post_id:
            if not payload.content.strip():
                return {"error": "Comment content required"}
            post.comments += 1
            _persist_state(STATE_KEYS["posts"], POSTS)
            return {"success": True, "comment_id": 1, "comments_count": post.comments}
    return {"error": "Post not found"}

# Messaging endpoints
@app.get("/messages", response_model=List[Message])
async def get_messages(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = int(current_user["id"])
    return [m for m in MESSAGES if m.sender_id == user_id or m.receiver_id == user_id]

@app.get("/messages/{user_id}", response_model=List[Message])
async def get_conversation(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [m for m in MESSAGES if m.sender_id == user_id or m.receiver_id == user_id]

@app.post("/messages")
async def send_message(
    payload: SendMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    new_id = max((m.id for m in MESSAGES), default=0) + 1
    sender_id = int(current_user["id"])
    sender_name = str(current_user.get("full_name") or current_user.get("username") or "User")
    stamp = utils.now_iso()
    MESSAGES.append(
        Message(
            id=new_id,
            sender_id=sender_id,
            receiver_id=payload.receiver_id,
            sender_name=sender_name,
            content=payload.content,
            timestamp=stamp,
            read=False,
        )
    )
    _persist_state(STATE_KEYS["messages"], MESSAGES)
    envelope = {"type": "message", "message": _message_to_payload(MESSAGES[-1])}
    await CHAT_WS_MANAGER.send_to(sender_id, envelope)
    if payload.receiver_id != sender_id:
        await CHAT_WS_MANAGER.send_to(payload.receiver_id, envelope)
    return {"success": True, "message_id": new_id}

@app.get("/conversations")
async def get_conversations(current_user: Dict[str, Any] = Depends(get_current_user)):
    current_user_id = int(current_user["id"])
    conversations = {}
    for msg in MESSAGES:
        if msg.sender_id != current_user_id and msg.receiver_id != current_user_id:
            continue
        other_user_id = msg.receiver_id if msg.sender_id == current_user_id else msg.sender_id
        if other_user_id not in conversations:
            conversations[other_user_id] = {
                "user_id": other_user_id,
                "user": USERS.get(other_user_id),
                "last_message": msg.content,
                "timestamp": msg.timestamp,
                "unread": not msg.read
            }
    return list(conversations.values())

# Stories endpoints
@app.get("/stories", response_model=List[Story])
async def get_stories():
    return STORIES

@app.post("/stories")
async def upload_story(
    payload: StoryCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    new_id = max((s.id for s in STORIES), default=0) + 1
    user_id = int(current_user["id"])
    username = str(current_user.get("username") or f"user_{user_id}")
    avatar = f"https://ui-avatars.com/api/?name={urllib.parse.quote(str(current_user.get('full_name') or username))}&background=2563eb&color=ffffff"
    STORIES.append(
        Story(
            id=new_id,
            user_id=user_id,
            username=username,
            avatar=avatar,
            image=payload.image,
            expires_in=24,
        )
    )
    _persist_state(STATE_KEYS["stories"], STORIES)
    return {"success": True, "story_id": new_id}


@app.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = Form("general"),
    media_kind: str = Form("image"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    safe_folder = "".join(ch for ch in folder.lower() if ch.isalnum() or ch in {"-", "_"}).strip() or "general"
    safe_kind = media_kind.strip().lower()
    allowed = ["video/"] if safe_kind == "video" else ["image/"]
    media_url = _save_upload_file(file, f"{safe_folder}/{int(current_user['id'])}", allowed)
    return {"success": True, "media_url": media_url, "media_kind": safe_kind}


@app.post("/posts/upload")
async def create_post_with_upload(
    content: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    image_url = _save_upload_file(file, f"posts/{int(current_user['id'])}", ["image/"])
    payload = CreatePostRequest(content=content, image=image_url)
    return await create_post(payload, current_user)


@app.post("/stories/upload")
async def upload_story_with_media(
    file: UploadFile = File(...),
    media_kind: str = Form("image"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    safe_kind = media_kind.strip().lower()
    allowed = ["video/"] if safe_kind == "video" else ["image/"]
    media_url = _save_upload_file(file, f"stories/{int(current_user['id'])}", allowed)
    payload = StoryCreateRequest(image=media_url)
    response = await upload_story(payload, current_user)
    return {**response, "media_kind": safe_kind}


@app.websocket("/ws/chat/{user_id}")
async def websocket_chat(user_id: int, websocket: WebSocket, token: str = Query(default="")):
    try:
        authed_user = _user_from_access_token(token)
    except HTTPException as exc:
        await websocket.close(code=1008, reason=exc.detail)
        return

    if int(authed_user["id"]) != int(user_id):
        await websocket.close(code=1008, reason="Forbidden user scope.")
        return

    await CHAT_WS_MANAGER.connect(user_id, websocket)
    await websocket.send_json({"type": "connected", "user_id": user_id})

    try:
        while True:
            payload = await websocket.receive_json()
            receiver_id = int(payload.get("receiver_id", 0))
            content = str(payload.get("content", "")).strip()
            if receiver_id <= 0 or not content:
                await websocket.send_json({"type": "error", "detail": "receiver_id and content are required."})
                continue

            new_id = max((m.id for m in MESSAGES), default=0) + 1
            stamp = utils.now_iso()
            sender_name = str(authed_user.get("full_name") or authed_user.get("username") or "User")
            message = Message(
                id=new_id,
                sender_id=user_id,
                receiver_id=receiver_id,
                sender_name=sender_name,
                content=content,
                timestamp=stamp,
                read=False,
            )
            MESSAGES.append(message)
            _persist_state(STATE_KEYS["messages"], MESSAGES)

            envelope = {"type": "message", "message": _message_to_payload(message)}
            await CHAT_WS_MANAGER.send_to(user_id, envelope)
            if receiver_id != user_id:
                await CHAT_WS_MANAGER.send_to(receiver_id, envelope)
    except WebSocketDisconnect:
        CHAT_WS_MANAGER.disconnect(user_id, websocket)

# ========== E-COMMERCE ENDPOINTS ==========

# Product endpoints
def _catalog_products() -> List[Product]:
    return PRODUCTS


@app.get("/products", response_model=List[Product])
async def get_products(category: str = "", search: str = ""):
    products = _catalog_products()
    if category:
        products = [p for p in products if p.category.lower() == category.lower()]
    if search:
        products = [p for p in products if search.lower() in p.name.lower() or search.lower() in p.description.lower()]
    return products


@app.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: int):
    for product in _catalog_products():
        if product.id == product_id:
            return product
    raise HTTPException(status_code=404, detail="Product not found")

@app.get("/products/{product_id}/reviews", response_model=List[Review])
async def get_product_reviews(product_id: int):
    return [r for r in PRODUCTS_REVIEW if r.product_id == product_id]

@app.post("/products/{product_id}/review")
async def add_review(product_id: int, review: Review):
    new_id = max((r.id for r in PRODUCTS_REVIEW), default=0) + 1
    PRODUCTS_REVIEW.append(Review(id=new_id, **review.dict()))
    _persist_state(STATE_KEYS["products_review"], PRODUCTS_REVIEW)
    return {"success": True, "review_id": new_id}

# Seller endpoints
@app.get("/sellers", response_model=List[Seller])
async def get_sellers():
    return SELLERS

@app.get("/sellers/{seller_id}", response_model=Seller)
async def get_seller(seller_id: int):
    for seller in SELLERS:
        if seller.id == seller_id:
            return seller
    raise HTTPException(status_code=404, detail="Seller not found")

@app.get("/sellers/{seller_id}/products", response_model=List[Product])
async def get_seller_products(seller_id: int):
    return [p for p in _catalog_products() if p.seller_id == seller_id]

# Cart endpoints
@app.get("/cart/{user_id}")
async def get_cart(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return {"items": CART.get(user_id, []), "total": sum(item.quantity * item.price for item in CART.get(user_id, []))}

@app.post("/cart/{user_id}/add")
async def add_to_cart(user_id: int, item: CartItem, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    if user_id not in CART:
        CART[user_id] = []
    CART[user_id].append(item)
    _persist_state(STATE_KEYS["cart"], CART)
    total = sum(ci.quantity * ci.price for ci in CART[user_id])
    return {"success": True, "cart_items": len(CART[user_id]), "total": total}

@app.post("/cart/{user_id}/remove/{product_id}")
async def remove_from_cart(user_id: int, product_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    if user_id in CART:
        CART[user_id] = [item for item in CART[user_id] if item.product_id != product_id]
        _persist_state(STATE_KEYS["cart"], CART)
    total = sum(ci.quantity * ci.price for ci in CART.get(user_id, []))
    return {"success": True, "cart_items": len(CART.get(user_id, [])), "total": total}

@app.post("/cart/{user_id}/clear")
async def clear_cart(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    CART[user_id] = []
    _persist_state(STATE_KEYS["cart"], CART)
    return {"success": True, "message": "Cart cleared"}

# Order endpoints
@app.post("/checkout/{user_id}")
async def checkout(
    user_id: int,
    payload: CheckoutRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    if user_id not in CART or not CART[user_id]:
        return {"error": "Cart is empty"}
    
    total = sum(item.quantity * item.price for item in CART[user_id])
    payment_status = "not_required"
    if payload.payment_intent_id:
        matched = next((p for p in PAYMENT_INTENTS if p["intent_id"] == payload.payment_intent_id), None)
        if not matched:
            return {"error": "Payment intent not found"}
        if int(matched["user_id"]) != int(user_id):
            return {"error": "Payment intent user mismatch"}
        if matched["status"] != "confirmed":
            return {"error": "Payment is not confirmed"}
        if float(matched["amount"]) + 0.001 < float(total):
            return {"error": "Payment amount is lower than checkout total"}
        payment_status = matched["status"]

    order_id = max((o.id for o in ORDERS), default=0) + 1
    order = Order(
        id=order_id,
        user_id=user_id,
        items=CART[user_id],
        total_price=total,
        shipping_address=payload.address,
        status=OrderStatus.PENDING,
        created_at=utils.now_iso(),
        estimated_delivery="3-5 business days"
    )
    ORDERS.append(order)
    CART[user_id] = []
    _persist_state(STATE_KEYS["orders"], ORDERS)
    _persist_state(STATE_KEYS["cart"], CART)
    return {
        "success": True,
        "order_id": order_id,
        "total": total,
        "status": OrderStatus.PENDING,
        "payment_status": payment_status,
    }

@app.get("/orders/{user_id}")
async def get_user_orders(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [o for o in ORDERS if o.user_id == user_id]

@app.get("/orders/{user_id}/{order_id}")
async def get_order(user_id: int, order_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    for order in ORDERS:
        if order.id == order_id and order.user_id == user_id:
            return order
    return {"error": "Order not found"}

@app.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: int):
    for order in ORDERS:
        if order.id == order_id and order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CANCELLED
            _persist_state(STATE_KEYS["orders"], ORDERS)
            return {"success": True, "message": "Order cancelled"}
    return {"error": "Order cannot be cancelled"}

# Categories endpoint
@app.get("/categories")
async def get_categories():
    categories = set(p.category for p in _catalog_products())
    return {"categories": list(categories)}

# ========== STOCKS & FOREX ENDPOINTS ==========

# Stock endpoints
@app.get("/stocks", response_model=List[Stock])
async def get_stocks():
    live = _fetch_live_stocks()
    if live:
        return live
    return STOCKS

@app.get("/stocks/{stock_id}", response_model=Stock)
async def get_stock(stock_id: int):
    stocks = _fetch_live_stocks() or STOCKS
    for stock in stocks:
        if stock.id == stock_id:
            return stock
    raise HTTPException(status_code=404, detail="Stock not found")

@app.get("/stocks/symbol/{symbol}", response_model=Stock)
async def get_stock_by_symbol(symbol: str):
    stocks = _fetch_live_stocks() or STOCKS
    for stock in stocks:
        if stock.symbol.upper() == symbol.upper():
            return stock
    raise HTTPException(status_code=404, detail="Stock not found")


@app.get("/stocks/symbol/{symbol}/chart")
async def get_stock_chart(symbol: str, range: str = "1mo", interval: str = "1d"):
    return _fetch_stock_chart(symbol, range, interval)

@app.get("/market/top-gainers")
async def get_top_gainers():
    stocks = _fetch_live_stocks() or STOCKS
    sorted_stocks = sorted(stocks, key=lambda x: x.change, reverse=True)[:5]
    return sorted_stocks

@app.get("/market/top-losers")
async def get_top_losers():
    stocks = _fetch_live_stocks() or STOCKS
    sorted_stocks = sorted(stocks, key=lambda x: x.change)[:5]
    return sorted_stocks

# Forex endpoints
@app.get("/forex", response_model=List[ForexPair])
async def get_forex_pairs():
    return FOREX_PAIRS

@app.get("/forex/{pair_id}", response_model=ForexPair)
async def get_forex_pair(pair_id: int):
    for pair in FOREX_PAIRS:
        if pair.id == pair_id:
            return pair
    raise HTTPException(status_code=404, detail="Forex pair not found")

@app.get("/forex/symbol/{symbol}", response_model=ForexPair)
async def get_forex_by_symbol(symbol: str):
    for pair in FOREX_PAIRS:
        if pair.symbol.upper() == symbol.upper():
            return pair
    raise HTTPException(status_code=404, detail="Forex pair not found")

# Portfolio endpoints
@app.get("/portfolio/{user_id}", response_model=Portfolio)
async def get_portfolio(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    portfolio = PORTFOLIOS.get(user_id)
    if portfolio:
        return portfolio
    created = Portfolio(
        id=max((p.id for p in PORTFOLIOS.values()), default=0) + 1,
        user_id=user_id,
        total_value=10000.0,
        cash=10000.0,
        invested=0.0,
        profit_loss=0.0,
        profit_loss_percent=0.0,
    )
    PORTFOLIOS[user_id] = created
    _persist_state(STATE_KEYS["portfolios"], PORTFOLIOS)
    return created

@app.get("/portfolio/{user_id}/holdings")
async def get_portfolio_holdings(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [h for h in PORTFOLIO_HOLDINGS if h.portfolio_id in [p.id for p in PORTFOLIOS.values() if p.user_id == user_id]]

# Watchlist endpoints
@app.get("/watchlists/{user_id}")
async def get_watchlists(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [w for w in WATCHLISTS if w.user_id == user_id]

@app.post("/watchlists/{user_id}")
async def create_watchlist(user_id: int, name: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    new_id = max((w.id for w in WATCHLISTS), default=0) + 1
    watchlist = Watchlist(id=new_id, user_id=user_id, name=name, created_at=utils.now_iso(), items=[])
    WATCHLISTS.append(watchlist)
    _persist_state(STATE_KEYS["watchlists"], WATCHLISTS)
    return {"success": True, "watchlist_id": new_id}

@app.post("/watchlists/{watchlist_id}/add/{asset_id}")
async def add_to_watchlist(watchlist_id: int, asset_id: int):
    for watchlist in WATCHLISTS:
        if watchlist.id == watchlist_id:
            if asset_id not in watchlist.items:
                watchlist.items.append(asset_id)
                _persist_state(STATE_KEYS["watchlists"], WATCHLISTS)
            return {"success": True, "items": watchlist.items}
    return {"error": "Watchlist not found"}

# Trading endpoints
@app.get("/trades/{user_id}")
async def get_user_trades(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [t for t in TRADES if t.user_id == user_id]

@app.post("/trade/buy")
async def execute_buy_trade(
    user_id: int,
    symbol: str,
    quantity: float,
    price: float,
    asset_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    new_id = max((t.id for t in TRADES), default=0) + 1
    total = quantity * price
    trade = Trade(
        id=new_id,
        user_id=user_id,
        symbol=symbol,
        asset_name=symbol,
        type="buy",
        quantity=quantity,
        price=price,
        total_amount=total,
        timestamp=utils.now_iso(),
        asset_type=asset_type
    )
    TRADES.append(trade)
    
    # Update portfolio
    if user_id in PORTFOLIOS:
        PORTFOLIOS[user_id].cash -= total
        PORTFOLIOS[user_id].invested += total
        PORTFOLIOS[user_id].total_value = PORTFOLIOS[user_id].cash + PORTFOLIOS[user_id].invested
    _persist_state(STATE_KEYS["trades"], TRADES)
    _persist_state(STATE_KEYS["portfolios"], PORTFOLIOS)
    
    return {"success": True, "trade_id": new_id, "total_amount": total}

@app.post("/trade/sell")
async def execute_sell_trade(
    user_id: int,
    symbol: str,
    quantity: float,
    price: float,
    asset_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    new_id = max((t.id for t in TRADES), default=0) + 1
    total = quantity * price
    trade = Trade(
        id=new_id,
        user_id=user_id,
        symbol=symbol,
        asset_name=symbol,
        type="sell",
        quantity=quantity,
        price=price,
        total_amount=total,
        timestamp=utils.now_iso(),
        asset_type=asset_type
    )
    TRADES.append(trade)
    
    # Update portfolio
    if user_id in PORTFOLIOS:
        PORTFOLIOS[user_id].cash += total
        PORTFOLIOS[user_id].invested -= total
        PORTFOLIOS[user_id].total_value = PORTFOLIOS[user_id].cash + PORTFOLIOS[user_id].invested
    _persist_state(STATE_KEYS["trades"], TRADES)
    _persist_state(STATE_KEYS["portfolios"], PORTFOLIOS)
    
    return {"success": True, "trade_id": new_id, "total_amount": total}

# Notifications
class Notification(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str  # order, message, follow, trading, review
    read: bool
    created_at: str

class CommunityReview(BaseModel):
    id: int
    product_id: int
    user_id: int
    username: str
    rating: int  # 1-5
    comment: str
    helpful_count: int
    created_at: str

class Wishlist(BaseModel):
    id: int
    user_id: int
    product_id: int
    added_at: str

class Wallet(BaseModel):
    id: int
    user_id: int
    balance: float
    total_spent: float
    total_earned: float
    created_at: str

class ChatMessage(BaseModel):
    id: int
    user_id: int
    seller_id: int
    message: str
    timestamp: str
    read: bool

class Follow(BaseModel):
    id: int
    follower_id: int
    following_id: int
    created_at: str

class Cryptocurrency(BaseModel):
    id: int
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    market_cap: str
    volume: str

class CopyTrade(BaseModel):
    id: int
    trader_id: int
    trader_name: str
    followers: int
    win_rate: float
    roi: float
    total_trades: int
    created_at: str

class LoyaltyPoint(BaseModel):
    id: int
    user_id: int
    points: int
    tier: str  # bronze, silver, gold, platinum
    created_at: str

class Analytics(BaseModel):
    id: int
    user_id: int
    type: str  # seller_sales, user_spending, trade_performance
    data: dict
    timestamp: str

class Settings(BaseModel):
    id: int
    user_id: int
    dark_mode: bool
    language: str  # en, es, fr, de, zh
    notifications_enabled: bool
    created_at: str


# Runtime data stores (persisted in state DB)
NOTIFICATIONS: List[Dict[str, Any]] = []
REVIEWS: List[Dict[str, Any]] = []
WISHLISTS: List[Dict[str, Any]] = []
WALLETS: List[Dict[str, Any]] = []
CHAT_MESSAGES: List[Dict[str, Any]] = []
FOLLOWS: List[Dict[str, Any]] = []
CRYPTOCURRENCIES: List[Dict[str, Any]] = []
COPY_TRADERS: List[Dict[str, Any]] = []
LOYALTY_POINTS: List[Dict[str, Any]] = []
ANALYTICS_DATA: List[Dict[str, Any]] = []
SETTINGS_DATA: List[Dict[str, Any]] = []

PAYMENT_INTENTS: List[Dict[str, Any]] = []

LIVE_SHOPPING_EVENTS: List[Dict[str, Any]] = []

SUPPORT_MESSAGES: List[Dict[str, Any]] = []

OPTIONS_CONTRACTS: List[Dict[str, Any]] = []


def _get_or_create_wallet(user_id: int) -> Dict[str, Any]:
    for wallet in WALLETS:
        if int(wallet.get("user_id", 0)) == int(user_id):
            return wallet
    wallet = {
        "id": max((int(w.get("id", 0)) for w in WALLETS), default=0) + 1,
        "user_id": int(user_id),
        "balance": 0.0,
        "total_spent": 0.0,
        "total_earned": 0.0,
        "created_at": utils.now_iso(),
    }
    WALLETS.append(wallet)
    _persist_state(STATE_KEYS["wallets"], WALLETS)
    return wallet


# Notification endpoints
@app.get("/notifications/{user_id}")
async def get_notifications(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [n for n in NOTIFICATIONS if n["user_id"] == user_id]

@app.post("/notifications/{user_id}/read/{notification_id}")
async def mark_notification_read(
    user_id: int,
    notification_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    for notif in NOTIFICATIONS:
        if notif["id"] == notification_id and notif["user_id"] == user_id:
            notif["read"] = True
            _persist_state(STATE_KEYS["notifications"], NOTIFICATIONS)
            return {"success": True}
    return {"error": "Notification not found"}

@app.get("/notifications/{user_id}/unread-count")
async def get_unread_count(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    count = len([n for n in NOTIFICATIONS if n["user_id"] == user_id and not n["read"]])
    return {"unread_count": count}

# Community review endpoints
@app.get("/products/{product_id}/community-reviews")
async def get_product_community_reviews(product_id: int):
    return [r for r in REVIEWS if r["product_id"] == product_id]

@app.post("/products/{product_id}/community-reviews")
async def add_product_community_review(product_id: int, user_id: int, username: str, rating: int, comment: str):
    new_id = max((int(r["id"]) for r in REVIEWS), default=0) + 1
    review = {
        "id": new_id,
        "product_id": product_id,
        "user_id": user_id,
        "username": username,
        "rating": rating,
        "comment": comment,
        "helpful_count": 0,
        "created_at": utils.now_iso(),
    }
    REVIEWS.append(review)
    _persist_state(STATE_KEYS["reviews"], REVIEWS)
    return {"success": True, "review_id": new_id}

@app.post("/community-reviews/{review_id}/helpful")
async def mark_community_review_helpful(review_id: int):
    for review in REVIEWS:
        if review["id"] == review_id:
            review["helpful_count"] += 1
            _persist_state(STATE_KEYS["reviews"], REVIEWS)
            return {"success": True, "helpful_count": review["helpful_count"]}
    return {"error": "Review not found"}

# Wishlist endpoints
@app.get("/wishlists/{user_id}")
async def get_wishlist(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    wishlist_items = [w for w in WISHLISTS if w["user_id"] == user_id]
    catalog_by_id = {p.id: p for p in _catalog_products()}
    result = []
    for item in wishlist_items:
        product = catalog_by_id.get(int(item["product_id"]))
        if product:
            result.append({**item, "product": product})
    return result

@app.post("/wishlists/{user_id}/add/{product_id}")
async def add_to_wishlist(
    user_id: int,
    product_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    if not any(w["user_id"] == user_id and w["product_id"] == product_id for w in WISHLISTS):
        new_id = max((int(w["id"]) for w in WISHLISTS), default=0) + 1
        wishlist = {"id": new_id, "user_id": user_id, "product_id": product_id, "added_at": utils.now_iso()}
        WISHLISTS.append(wishlist)
        _persist_state(STATE_KEYS["wishlists"], WISHLISTS)
        return {"success": True, "wishlist_id": new_id}
    return {"error": "Already in wishlist"}

@app.delete("/wishlists/{user_id}/remove/{product_id}")
async def remove_from_wishlist(
    user_id: int,
    product_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    global WISHLISTS
    WISHLISTS = [w for w in WISHLISTS if not (w["user_id"] == user_id and w["product_id"] == product_id)]
    _persist_state(STATE_KEYS["wishlists"], WISHLISTS)
    return {"success": True}

# Wallet endpoints
@app.get("/wallet/{user_id}")
async def get_wallet(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return _get_or_create_wallet(user_id)

@app.post("/wallet/{user_id}/deposit")
async def deposit_to_wallet(
    user_id: int,
    payload: AmountRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    amount = payload.amount
    if amount <= 0:
        return {"error": "Amount must be greater than zero"}
    wallet = _get_or_create_wallet(user_id)
    wallet["balance"] += amount
    wallet["total_earned"] += amount
    _persist_state(STATE_KEYS["wallets"], WALLETS)
    return {"success": True, "new_balance": wallet["balance"]}

@app.post("/wallet/{user_id}/withdraw")
async def withdraw_from_wallet(
    user_id: int,
    payload: AmountRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    amount = payload.amount
    if amount <= 0:
        return {"error": "Amount must be greater than zero"}
    wallet = _get_or_create_wallet(user_id)
    if wallet["balance"] >= amount:
        wallet["balance"] -= amount
        wallet["total_spent"] += amount
        _persist_state(STATE_KEYS["wallets"], WALLETS)
        return {"success": True, "new_balance": wallet["balance"]}
    return {"error": "Insufficient balance"}

# Chat endpoints
@app.get("/chat/{user_id}/{seller_id}")
async def get_chat(
    user_id: int,
    seller_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    return [m for m in CHAT_MESSAGES if (m["user_id"] == user_id and m["seller_id"] == seller_id)]

@app.post("/chat/{user_id}/{seller_id}/send")
async def send_chat_message(
    user_id: int,
    seller_id: int,
    payload: ChatSendRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    new_id = max((int(m["id"]) for m in CHAT_MESSAGES), default=0) + 1
    msg = {
        "id": new_id,
        "user_id": user_id,
        "seller_id": seller_id,
        "message": payload.message,
        "timestamp": utils.now_iso(),
        "read": False,
    }
    CHAT_MESSAGES.append(msg)
    _persist_state(STATE_KEYS["chat_messages"], CHAT_MESSAGES)
    return {"success": True, "message_id": new_id}

# Follow endpoints
@app.get("/followers/{user_id}")
async def get_followers(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [f for f in FOLLOWS if f["following_id"] == user_id]

@app.get("/following/{user_id}")
async def get_following(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [f for f in FOLLOWS if f["follower_id"] == user_id]

@app.post("/follow/{follower_id}/{following_id}")
async def follow_user(
    follower_id: int,
    following_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(follower_id, current_user)
    if not any(f["follower_id"] == follower_id and f["following_id"] == following_id for f in FOLLOWS):
        new_id = max((int(f["id"]) for f in FOLLOWS), default=0) + 1
        follow = {"id": new_id, "follower_id": follower_id, "following_id": following_id, "created_at": utils.now_iso()}
        FOLLOWS.append(follow)
        _persist_state(STATE_KEYS["follows"], FOLLOWS)
        return {"success": True, "follow_id": new_id}
    return {"error": "Already following"}

@app.delete("/unfollow/{follower_id}/{following_id}")
async def unfollow_user(
    follower_id: int,
    following_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(follower_id, current_user)
    global FOLLOWS
    FOLLOWS = [f for f in FOLLOWS if not (f["follower_id"] == follower_id and f["following_id"] == following_id)]
    _persist_state(STATE_KEYS["follows"], FOLLOWS)
    return {"success": True}

# Cryptocurrency endpoints
@app.get("/crypto")
async def get_cryptocurrencies():
    coingecko = _fetch_json(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h"
    )
    if isinstance(coingecko, list) and coingecko:
        live = []
        for idx, item in enumerate(coingecko, start=1):
            if not isinstance(item, dict):
                continue
            live.append(
                {
                    "id": idx,
                    "symbol": str(item.get("symbol", "")).upper(),
                    "name": str(item.get("name", "")),
                    "price": float(item.get("current_price", 0)),
                    "change": float(item.get("price_change_24h", 0) or 0),
                    "change_percent": float(item.get("price_change_percentage_24h", 0) or 0),
                    "market_cap": f"${float(item.get('market_cap', 0)) / 1_000_000_000:.2f}B",
                    "volume": f"${float(item.get('total_volume', 0)) / 1_000_000_000:.2f}B",
                }
            )
        if live:
            return live
    return CRYPTOCURRENCIES

@app.get("/crypto/{crypto_id}")
async def get_crypto(crypto_id: int):
    for crypto in CRYPTOCURRENCIES:
        if crypto["id"] == crypto_id:
            return crypto
    return {"error": "Crypto not found"}

@app.post("/crypto/trade/buy")
async def buy_crypto(
    user_id: int,
    symbol: str,
    quantity: float,
    price: float,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    total = quantity * price
    if user_id in PORTFOLIOS:
        portfolio = PORTFOLIOS[user_id]
        if isinstance(portfolio, dict):
            portfolio["cash"] -= total
            portfolio["total_value"] -= total
        else:
            portfolio.cash -= total
            portfolio.total_value -= total
        _persist_state(STATE_KEYS["portfolios"], PORTFOLIOS)
    return {"success": True, "symbol": symbol, "quantity": quantity, "total": total}

# Copy Trading endpoints
@app.get("/copy-traders")
async def get_copy_traders():
    return COPY_TRADERS

@app.post("/copy-traders/{trader_id}/follow")
async def follow_copy_trader(
    user_id: int,
    trader_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    for trader in COPY_TRADERS:
        if trader["trader_id"] == trader_id:
            trader["followers"] += 1
            _persist_state(STATE_KEYS["copy_traders"], COPY_TRADERS)
            break
    return {"success": True, "message": f"Now copying trades from trader {trader_id}"}

# Loyalty endpoints
@app.get("/loyalty/{user_id}")
async def get_loyalty_points(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    for lp in LOYALTY_POINTS:
        if lp["user_id"] == user_id:
            return lp
    return {"error": "Loyalty points not found"}

@app.post("/loyalty/{user_id}/add-points")
async def add_loyalty_points(
    user_id: int,
    payload: LoyaltyPointsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    points = payload.points
    for lp in LOYALTY_POINTS:
        if lp["user_id"] == user_id:
            lp["points"] += points
            if lp["points"] >= 5000:
                lp["tier"] = "platinum"
            elif lp["points"] >= 3000:
                lp["tier"] = "gold"
            elif lp["points"] >= 1000:
                lp["tier"] = "silver"
            _persist_state(STATE_KEYS["loyalty_points"], LOYALTY_POINTS)
            return {"success": True, "new_points": lp["points"], "tier": lp["tier"]}
    return {"error": "User not found"}

# Analytics endpoints
@app.get("/analytics/{user_id}/{analytics_type}")
async def get_analytics(
    user_id: int,
    analytics_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    analytics = [a for a in ANALYTICS_DATA if a["user_id"] == user_id and a["type"] == analytics_type]
    return analytics if analytics else {"error": "Analytics not found"}

# Settings endpoints
@app.get("/settings/{user_id}")
async def get_settings(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    for setting in SETTINGS_DATA:
        if setting["user_id"] == user_id:
            return setting
    return {"error": "Settings not found"}

@app.post("/settings/{user_id}/update")
async def update_settings(
    user_id: int,
    payload: SettingsUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    for setting in SETTINGS_DATA:
        if setting["user_id"] == user_id:
            if payload.dark_mode is not None:
                setting["dark_mode"] = payload.dark_mode
            if payload.language is not None:
                setting["language"] = payload.language
            if payload.notifications_enabled is not None:
                setting["notifications_enabled"] = payload.notifications_enabled
            _persist_state(STATE_KEYS["settings_data"], SETTINGS_DATA)
            return {"success": True, "settings": setting}
    return {"error": "Settings not found"}


def _require_seller_access(seller_id: int, current_user: Dict[str, Any]) -> Seller:
    seller = next((s for s in SELLERS if s.id == seller_id), None)
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found.")
    if int(seller.user_id) != int(current_user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden seller scope.")
    return seller


@app.post("/payments/create-intent")
async def create_payment_intent(
    payload: PaymentIntentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(payload.user_id, current_user)
    if payload.amount <= 0:
        return {"error": "Amount must be greater than zero"}

    intent_id = f"pi_{uuid4().hex[:20]}"
    client_secret = f"{intent_id}_secret_{uuid4().hex[:16]}"
    gateway = payload.gateway.strip().lower() or "mockpay"
    currency = payload.currency.strip().lower() or "usd"
    intent = {
        "intent_id": intent_id,
        "client_secret": client_secret,
        "user_id": payload.user_id,
        "amount": round(payload.amount, 2),
        "currency": currency,
        "gateway": gateway,
        "status": "requires_confirmation",
        "created_at": datetime.utcnow().isoformat(),
        "confirmed_at": None,
    }
    PAYMENT_INTENTS.append(intent)
    _persist_state(STATE_KEYS["payment_intents"], PAYMENT_INTENTS)
    return intent


@app.post("/payments/confirm")
async def confirm_payment_intent(
    payload: PaymentConfirmRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(payload.user_id, current_user)
    intent = next((p for p in PAYMENT_INTENTS if p["intent_id"] == payload.intent_id), None)
    if not intent:
        return {"error": "Payment intent not found"}
    if int(intent["user_id"]) != int(payload.user_id):
        return {"error": "Payment intent user mismatch"}

    intent["status"] = "confirmed"
    intent["confirmed_at"] = datetime.utcnow().isoformat()
    _persist_state(STATE_KEYS["payment_intents"], PAYMENT_INTENTS)
    return intent


@app.get("/payments/{user_id}")
async def list_user_payments(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [p for p in PAYMENT_INTENTS if int(p["user_id"]) == int(user_id)]


@app.get("/seller/{seller_id}/dashboard")
async def get_seller_dashboard(seller_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_seller_access(seller_id, current_user)
    seller_products = [p for p in _catalog_products() if p.seller_id == seller_id]
    product_ids = {p.id for p in seller_products}

    seller_orders: List[Dict[str, Any]] = []
    revenue = 0.0
    for order in ORDERS:
        matched_items = [item for item in order.items if item.product_id in product_ids]
        if not matched_items:
            continue
        subtotal = sum(item.quantity * item.price for item in matched_items)
        revenue += subtotal
        seller_orders.append(
            {
                "order_id": order.id,
                "buyer_id": order.user_id,
                "status": order.status,
                "subtotal": round(subtotal, 2),
                "created_at": order.created_at,
            }
        )

    ratings: List[float] = []
    for review in PRODUCTS_REVIEW:
        if review.product_id in product_ids:
            ratings.append(float(review.rating))
    for review in REVIEWS:
        if review["product_id"] in product_ids:
            ratings.append(float(review["rating"]))

    total_quantity_by_product: Dict[int, int] = {pid: 0 for pid in product_ids}
    for order in ORDERS:
        for item in order.items:
            if item.product_id in total_quantity_by_product:
                total_quantity_by_product[item.product_id] += int(item.quantity)
    top_products = sorted(
        [
            {
                "product_id": p.id,
                "name": p.name,
                "units_sold": total_quantity_by_product.get(p.id, 0),
                "price": p.price,
            }
            for p in seller_products
        ],
        key=lambda item: item["units_sold"],
        reverse=True,
    )[:5]

    return {
        "seller_id": seller_id,
        "products_count": len(seller_products),
        "orders_count": len(seller_orders),
        "total_revenue": round(revenue, 2),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
        "top_products": top_products,
        "recent_orders": seller_orders[-10:],
    }


@app.get("/seller/{seller_id}/orders")
async def get_seller_orders(seller_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_seller_access(seller_id, current_user)
    product_ids = {p.id for p in _catalog_products() if p.seller_id == seller_id}
    results = []
    for order in ORDERS:
        matched_items = [item for item in order.items if item.product_id in product_ids]
        if matched_items:
            results.append(
                {
                    "order_id": order.id,
                    "buyer_id": order.user_id,
                    "items": matched_items,
                    "status": order.status,
                    "created_at": order.created_at,
                }
            )
    return results


@app.get("/recommendations/{user_id}")
async def get_recommendations(
    user_id: int,
    limit: int = Query(default=12, ge=1, le=40),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(user_id, current_user)
    products = _catalog_products()
    if not products:
        return []

    by_id = {p.id: p for p in products}
    category_interest: Dict[str, float] = {}
    excluded: set = set()

    for item in CART.get(user_id, []):
        product = by_id.get(item.product_id)
        if not product:
            continue
        category_interest[product.category] = category_interest.get(product.category, 0.0) + 1.0
        excluded.add(product.id)

    for wl in WISHLISTS:
        if int(wl["user_id"]) != int(user_id):
            continue
        product = by_id.get(int(wl["product_id"]))
        if not product:
            continue
        category_interest[product.category] = category_interest.get(product.category, 0.0) + 1.5
        excluded.add(product.id)

    for order in ORDERS:
        if int(order.user_id) != int(user_id):
            continue
        for item in order.items:
            product = by_id.get(item.product_id)
            if not product:
                continue
            category_interest[product.category] = category_interest.get(product.category, 0.0) + 2.0
            excluded.add(product.id)

    def score(product: Product) -> float:
        popularity = min(float(product.sold) / 200.0, 5.0)
        rating = float(product.rating)
        affinity = category_interest.get(product.category, 0.0)
        return affinity + rating + popularity

    ranked = sorted(
        [p for p in products if p.id not in excluded],
        key=score,
        reverse=True,
    )
    return ranked[:limit]


@app.get("/stories/video")
async def get_video_stories():
    return [s for s in STORIES if str(s.image).lower().endswith((".mp4", ".mov", ".webm", ".m4v"))]


@app.get("/live-shopping/events")
async def list_live_shopping_events(status: str = ""):
    if not status:
        return LIVE_SHOPPING_EVENTS
    return [e for e in LIVE_SHOPPING_EVENTS if e["status"] == status]


@app.post("/live-shopping/events")
async def create_live_shopping_event(
    payload: LiveShoppingEventRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_seller_access(payload.seller_id, current_user)
    new_id = max((event["id"] for event in LIVE_SHOPPING_EVENTS), default=0) + 1
    event = {
        "id": new_id,
        "seller_id": payload.seller_id,
        "title": payload.title.strip(),
        "product_ids": payload.product_ids,
        "starts_at": payload.starts_at,
        "status": "scheduled",
        "viewer_count": 0,
        "stream_url": payload.stream_url or f"{MEDIA_BASE_URL}/live/{new_id}",
        "created_at": datetime.utcnow().isoformat(),
    }
    LIVE_SHOPPING_EVENTS.append(event)
    _persist_state(STATE_KEYS["live_shopping_events"], LIVE_SHOPPING_EVENTS)
    return event


@app.post("/live-shopping/events/{event_id}/go-live")
async def set_live_shopping_status_live(
    event_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    event = next((e for e in LIVE_SHOPPING_EVENTS if e["id"] == event_id), None)
    if not event:
        return {"error": "Event not found"}
    _require_seller_access(int(event["seller_id"]), current_user)
    event["status"] = "live"
    _persist_state(STATE_KEYS["live_shopping_events"], LIVE_SHOPPING_EVENTS)
    return event


@app.post("/live-shopping/events/{event_id}/join")
async def join_live_shopping_event(event_id: int):
    event = next((e for e in LIVE_SHOPPING_EVENTS if e["id"] == event_id), None)
    if not event:
        return {"error": "Event not found"}
    event["viewer_count"] = int(event.get("viewer_count", 0)) + 1
    _persist_state(STATE_KEYS["live_shopping_events"], LIVE_SHOPPING_EVENTS)
    return event


def _build_support_reply(user_id: int, message: str) -> str:
    text = message.lower().strip()
    if not text:
        return "Tell me what you need help with, like order status, refunds, or payment issues."

    if "order" in text and "status" in text:
        latest = next((o for o in reversed(ORDERS) if int(o.user_id) == int(user_id)), None)
        if latest:
            return f"Your latest order #{latest.id} is currently {latest.status}."
        return "I could not find any orders yet. Place an order first and I can track it."

    if "refund" in text or "cancel" in text:
        return "Refunds can be requested while an order is pending. Use the cancel order endpoint for fast processing."

    if "shipping" in text or "delivery" in text:
        return "Most orders arrive in 3-6 business days. You can check exact ETA from the orders screen."

    if "payment" in text:
        return "Payment support is active. Create an intent, confirm it, then checkout with payment_intent_id."

    return "Support can help with orders, shipping, refunds, and payment. Ask me a specific question."


@app.post("/support/chat")
async def support_chat(
    payload: SupportChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(payload.user_id, current_user)
    reply = _build_support_reply(payload.user_id, payload.message)
    entry = {
        "id": max((m["id"] for m in SUPPORT_MESSAGES), default=0) + 1,
        "user_id": payload.user_id,
        "message": payload.message,
        "reply": reply,
        "created_at": datetime.utcnow().isoformat(),
    }
    SUPPORT_MESSAGES.append(entry)
    _persist_state(STATE_KEYS["support_messages"], SUPPORT_MESSAGES)
    return entry


@app.get("/support/chat/{user_id}")
async def get_support_history(user_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    _require_user_access(user_id, current_user)
    return [m for m in SUPPORT_MESSAGES if int(m["user_id"]) == int(user_id)]


@app.get("/options/contracts")
async def get_options_contracts(underlying: str = ""):
    if not underlying:
        return OPTIONS_CONTRACTS
    return [c for c in OPTIONS_CONTRACTS if c["underlying"].upper() == underlying.upper()]


@app.post("/options/trade")
async def trade_options(
    payload: OptionsTradeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _require_user_access(payload.user_id, current_user)
    if payload.contracts <= 0 or payload.premium <= 0:
        return {"error": "contracts and premium must be > 0"}

    side = payload.side.strip().lower()
    if side not in {"buy", "sell"}:
        return {"error": "side must be buy or sell"}

    total = float(payload.contracts) * float(payload.premium) * 100.0
    portfolio = PORTFOLIOS.get(payload.user_id)
    if not portfolio:
        portfolio = Portfolio(
            id=max((p.id for p in PORTFOLIOS.values()), default=0) + 1,
            user_id=payload.user_id,
            total_value=10000.0,
            cash=10000.0,
            invested=0.0,
            profit_loss=0.0,
            profit_loss_percent=0.0,
        )
        PORTFOLIOS[payload.user_id] = portfolio

    if side == "buy":
        if portfolio.cash < total:
            return {"error": "Insufficient cash"}
        portfolio.cash -= total
        portfolio.invested += total
    else:
        portfolio.cash += total
        portfolio.invested = max(0.0, portfolio.invested - total)
    portfolio.total_value = portfolio.cash + portfolio.invested

    trade_id = max((t.id for t in TRADES), default=0) + 1
    TRADES.append(
        Trade(
            id=trade_id,
            user_id=payload.user_id,
            symbol=payload.contract_symbol,
            asset_name=payload.contract_symbol,
            type=side,
            quantity=payload.contracts,
            price=payload.premium,
            total_amount=total,
            timestamp=datetime.utcnow().isoformat(),
            asset_type="options",
        )
    )
    _persist_state(STATE_KEYS["portfolios"], PORTFOLIOS)
    _persist_state(STATE_KEYS["trades"], TRADES)
    return {"success": True, "trade_id": trade_id, "side": side, "total_amount": total}


@app.get("/map/geocode")
async def map_geocode(q: str = Query(..., min_length=2), limit: int = Query(default=8, ge=1, le=30)):
    query_text = q.strip()
    if not query_text:
        return []

    params = urllib.parse.urlencode(
        {
            "q": query_text,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": str(limit),
        }
    )
    url = f"{NOMINATIM_BASE_URL}/search?{params}"
    payload = _fetch_json(url, headers={"User-Agent": NOMINATIM_USER_AGENT})
    if not isinstance(payload, list):
        return []

    results = []
    for idx, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            continue
        try:
            lat = float(item.get("lat", 0))
            lon = float(item.get("lon", 0))
        except Exception:
            continue
        results.append(
            {
                "id": f"geo_{idx}",
                "title": str(item.get("name") or item.get("display_name") or query_text),
                "subtitle": str(item.get("display_name") or ""),
                "lat": lat,
                "lon": lon,
                "type": str(item.get("type") or "location"),
            }
        )
    return results


@app.get("/map/nearby")
async def map_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(default=2500, ge=100, le=15000),
    limit: int = Query(default=24, ge=1, le=100),
):
    overpass_query = f"""
[out:json][timeout:25];
(
  node(around:{radius_m},{lat},{lon})["shop"];
  node(around:{radius_m},{lat},{lon})["amenity"~"marketplace|supermarket|mall|restaurant|cafe|bank|pharmacy|fuel"];
);
out body {limit};
"""
    payload = _fetch_json_post(OVERPASS_API_URL, {"data": overpass_query.strip()})
    if not isinstance(payload, dict):
        return []

    elements = payload.get("elements", [])
    if not isinstance(elements, list):
        return []

    places = []
    for element in elements[:limit]:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags", {}) if isinstance(element.get("tags"), dict) else {}
        try:
            place_lat = float(element.get("lat", 0))
            place_lon = float(element.get("lon", 0))
        except Exception:
            continue
        if place_lat == 0 and place_lon == 0:
            continue

        category = str(tags.get("shop") or tags.get("amenity") or "place")
        name = str(tags.get("name") or category.replace("_", " ").title())
        dist_km = _haversine_km(lat, lon, place_lat, place_lon)
        places.append(
            {
                "id": f"poi_{element.get('id')}",
                "title": name,
                "subtitle": str(tags.get("addr:street") or tags.get("brand") or category),
                "category": category,
                "lat": place_lat,
                "lon": place_lon,
                "distance_km": round(dist_km, 2),
            }
        )

    places.sort(key=lambda item: float(item.get("distance_km", 0)))
    return places[:limit]


@app.get("/map/route")
async def map_route(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
    profile: str = Query(default="driving"),
):
    safe_profile = profile.strip().lower()
    if safe_profile not in {"driving", "walking", "cycling"}:
        safe_profile = "driving"

    url = (
        f"{OSRM_BASE_URL}/route/v1/{urllib.parse.quote(safe_profile)}"
        f"/{start_lon},{start_lat};{end_lon},{end_lat}"
        "?overview=false&alternatives=false&steps=false"
    )
    payload = _fetch_json(url)
    if not isinstance(payload, dict) or str(payload.get("code")) != "Ok":
        return {
            "error": "Route unavailable",
            "profile": safe_profile,
            "distance_km": round(_haversine_km(start_lat, start_lon, end_lat, end_lon), 2),
            "duration_minutes": None,
        }

    routes = payload.get("routes", [])
    if not isinstance(routes, list) or not routes:
        return {"error": "Route unavailable", "profile": safe_profile}

    route = routes[0] if isinstance(routes[0], dict) else {}
    distance_m = float(route.get("distance", 0) or 0)
    duration_s = float(route.get("duration", 0) or 0)
    return {
        "profile": safe_profile,
        "distance_km": round(distance_m / 1000.0, 2),
        "duration_minutes": round(duration_s / 60.0, 1),
        "eta_minutes": max(1, int(round(duration_s / 60.0))) if duration_s > 0 else None,
    }


@app.get("/mini-apps/weather")
async def mini_apps_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    timezone: str = Query(default="auto"),
):
    params = urllib.parse.urlencode(
        {
            "latitude": str(lat),
            "longitude": str(lon),
            "current_weather": "true",
            "hourly": "temperature_2m,precipitation_probability",
            "forecast_days": "1",
            "timezone": timezone or "auto",
        }
    )
    payload = _fetch_json(f"{OPENMETEO_BASE_URL}/forecast?{params}")
    if not isinstance(payload, dict):
        return {"error": "Weather unavailable"}

    current = payload.get("current_weather", {}) if isinstance(payload.get("current_weather"), dict) else {}
    hourly = payload.get("hourly", {}) if isinstance(payload.get("hourly"), dict) else {}
    temps = hourly.get("temperature_2m", []) if isinstance(hourly.get("temperature_2m"), list) else []
    precip = (
        hourly.get("precipitation_probability", [])
        if isinstance(hourly.get("precipitation_probability"), list)
        else []
    )

    return {
        "source": "open-meteo",
        "lat": lat,
        "lon": lon,
        "temperature_c": current.get("temperature"),
        "windspeed_kmh": current.get("windspeed"),
        "weather_code": current.get("weathercode"),
        "next_temp_c": temps[1] if len(temps) > 1 else None,
        "next_precip_prob": precip[1] if len(precip) > 1 else None,
        "time": current.get("time"),
    }


@app.get("/mini-apps/fx")
async def mini_apps_fx(base: str = "USD", symbols: str = "EUR,GBP,NGN"):
    base_currency = base.strip().upper() or "USD"
    targets = [part.strip().upper() for part in symbols.split(",") if part.strip()]
    targets = [code for code in targets if len(code) == 3 and code.isalpha()]
    if not targets:
        targets = ["EUR", "GBP"]

    params = urllib.parse.urlencode({"from": base_currency, "to": ",".join(targets)})
    payload = _fetch_json(f"{FRANKFURTER_API_URL}/latest?{params}")
    if not isinstance(payload, dict):
        return {"error": "FX rates unavailable", "base": base_currency, "symbols": targets}

    rates = payload.get("rates", {}) if isinstance(payload.get("rates"), dict) else {}
    return {
        "source": "frankfurter",
        "base": str(payload.get("base") or base_currency),
        "date": payload.get("date"),
        "rates": rates,
    }


@app.get("/mini-apps/time")
async def mini_apps_time(timezone: str = "America/New_York"):
    safe_timezone = urllib.parse.quote((timezone or "America/New_York").strip(), safe="/")
    payload = _fetch_json(f"{WORLDTIME_API_URL}/timezone/{safe_timezone}")
    if not isinstance(payload, dict):
        return {"error": "Time service unavailable", "timezone": timezone}
    return {
        "timezone": payload.get("timezone"),
        "datetime": payload.get("datetime"),
        "utc_offset": payload.get("utc_offset"),
        "day_of_week": payload.get("day_of_week"),
        "day_of_year": payload.get("day_of_year"),
        "week_number": payload.get("week_number"),
        "dst": payload.get("dst"),
    }


@app.get("/external/news")
async def external_news(query: str = "technology"):
    news_api_key = os.getenv("NEWSAPI_KEY", "").strip()
    if not news_api_key:
        return {"items": [], "source": "newsapi", "note": "Set NEWSAPI_KEY to enable live news"}

    encoded_query = urllib.parse.quote(query)
    url = (
        "https://newsapi.org/v2/everything"
        f"?q={encoded_query}&language=en&sortBy=publishedAt&pageSize=20&apiKey={news_api_key}"
    )
    payload = _fetch_json(url)
    if not isinstance(payload, dict):
        return {"items": [], "source": "newsapi", "note": "News API unavailable"}

    items = payload.get("articles", [])
    return {"items": items if isinstance(items, list) else [], "source": "newsapi"}


@app.get("/external/photos")
async def external_photos(query: str = "market"):
    pexels_key = os.getenv("PEXELS_API_KEY", "").strip()
    if not pexels_key:
        return {"items": [], "source": "pexels", "note": "Set PEXELS_API_KEY to enable live photos"}

    encoded_query = urllib.parse.quote(query)
    url = f"https://api.pexels.com/v1/search?query={encoded_query}&per_page=20&page=1"
    payload = _fetch_json(url, headers={"Authorization": pexels_key})
    if not isinstance(payload, dict):
        return {"items": [], "source": "pexels", "note": "Pexels API unavailable"}

    items = payload.get("photos", [])
    return {"items": items if isinstance(items, list) else [], "source": "pexels"}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to UniHub API",
        "version": "4.0.0",
        "features": [
            "Social Media",
            "E-Commerce",
            "Messaging",
            "Stories",
            "Media Uploads",
            "WebSocket Chat",
            "Products",
            "Recommendations",
            "Orders",
            "Payments",
            "Seller Dashboard",
            "Live Shopping",
            "Support Chatbot",
            "Stocks",
            "Forex",
            "Crypto",
            "Options",
            "Trading",
            "Map",
            "Mini Apps",
        ],
    }




