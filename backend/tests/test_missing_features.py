import time
import uuid

import pytest
from fastapi.testclient import TestClient

import backend.main as backend_main
from backend.main import app


client = TestClient(app)


def _register_user() -> tuple[int, dict, str]:
    stamp = int(time.time() * 1000)
    username = f"user_{stamp}_{uuid.uuid4().hex[:6]}".lower()[:20]
    payload = {
        "full_name": "Feature Test",
        "username": username,
        "email": f"{username}@example.com",
        "password": "Feature123",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    user_id = int(body["user"]["id"])
    token = body["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}, token


def _register_session_user() -> tuple[int, dict]:
    """Fresh user via the public register endpoint (no seeded backdoor accounts)."""
    user_id, headers, _ = _register_user()
    return user_id, headers


def test_confirm_gated_without_live_gateway(monkeypatch):
    """Mock-gateway confirm stays OFF unless PAYMENTS_LIVE=1 (self-mint gate)."""
    user_id, headers, _ = _register_user()
    monkeypatch.delenv("PAYMENTS_LIVE", raising=False)
    intent = client.post(
        "/payments/create-intent",
        headers=headers,
        json={"user_id": user_id, "amount": 10.0, "currency": "inr", "gateway": "mockpay"},
    )
    intent_id = intent.json()["intent_id"]
    confirm = client.post(
        "/payments/confirm",
        headers=headers,
        json={"intent_id": intent_id, "user_id": user_id},
    )
    assert confirm.status_code == 403, confirm.text


def test_media_upload_payment_and_checkout(monkeypatch):
    monkeypatch.setenv("PAYMENTS_LIVE", "1")
    user_id, headers, _ = _register_user()

    upload = client.post(
        "/media/upload",
        headers=headers,
        data={"folder": "stories", "media_kind": "image"},
        files={"file": ("demo.png", b"\x89PNG\r\n", "image/png")},
    )
    assert upload.status_code == 200, upload.text
    media_url = upload.json()["media_url"]
    assert "/uploads/" in media_url

    story = client.post("/stories", headers=headers, json={"image": media_url})
    assert story.status_code == 200, story.text
    assert story.json()["success"] is True

    add_cart = client.post(
        f"/cart/{user_id}/add",
        headers=headers,
        json={"product_id": 1, "seller_id": 1, "quantity": 2, "price": 50.0},
    )
    assert add_cart.status_code == 200, add_cart.text

    intent = client.post(
        "/payments/create-intent",
        headers=headers,
        json={
            "user_id": user_id,
            "amount": 100.0,
            "currency": "inr",
            "gateway": "mockpay",
        },
    )
    assert intent.status_code == 200, intent.text
    intent_id = intent.json()["intent_id"]

    confirm = client.post(
        "/payments/confirm",
        headers=headers,
        json={"intent_id": intent_id, "user_id": user_id},
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["status"] == "confirmed"

    checkout = client.post(
        f"/checkout/{user_id}",
        headers=headers,
        json={"address": "123 Test Street", "payment_intent_id": intent_id},
    )
    assert checkout.status_code == 200, checkout.text
    body = checkout.json()
    assert body["success"] is True
    assert body["payment_status"] == "confirmed"


def test_checkout_requires_payment_or_cod():
    """Silence no longer means free: no intent + no cod flag must reject."""
    user_id, headers, _ = _register_user()

    add_cart = client.post(
        f"/cart/{user_id}/add",
        headers=headers,
        json={"product_id": 1, "seller_id": 1, "quantity": 1, "price": 25.0},
    )
    assert add_cart.status_code == 200, add_cart.text

    rejected = client.post(
        f"/checkout/{user_id}",
        headers=headers,
        json={"address": "123 Test Street"},
    )
    assert rejected.status_code == 200, rejected.text
    assert "error" in rejected.json()
    assert "success" not in rejected.json()

    # Explicit COD is accepted and labeled honestly.
    cod_checkout = client.post(
        f"/checkout/{user_id}",
        headers=headers,
        json={"address": "123 Test Street", "cod": True},
    )
    assert cod_checkout.status_code == 200, cod_checkout.text
    cod_body = cod_checkout.json()
    assert cod_body["success"] is True
    assert cod_body["payment_status"] == "not_required"


def test_recommendations_and_support_chat():
    user_id, headers, _ = _register_user()

    recs = client.get(f"/recommendations/{user_id}", headers=headers)
    assert recs.status_code == 200, recs.text
    assert isinstance(recs.json(), list)

    chat = client.post(
        "/support/chat",
        headers=headers,
        json={"user_id": user_id, "message": "Can you check my order status?"},
    )
    assert chat.status_code == 200, chat.text
    assert "reply" in chat.json()


def test_live_shopping_dashboard_and_options_trade():
    user_id, headers = _register_session_user()

    contracts = client.get("/options/contracts?underlying=AAPL")
    assert contracts.status_code == 200, contracts.text
    assert isinstance(contracts.json(), list)

    # Honest portfolios start at zero cash, so an unfunded buy is rejected.
    broke_trade = client.post(
        "/options/trade",
        headers=headers,
        json={
            "user_id": user_id,
            "contract_symbol": "AAPL260320C00220000",
            "contracts": 1,
            "premium": 1.0,
            "side": "buy",
        },
    )
    assert broke_trade.status_code == 200, broke_trade.text
    assert broke_trade.json().get("error") == "Insufficient cash"

    portfolio = client.get(f"/portfolio/{user_id}", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    assert float(portfolio.json()["cash"]) == 0.0
    assert float(portfolio.json()["total_value"]) == 0.0

    sellers = client.get("/sellers")
    assert sellers.status_code == 200, sellers.text
    seller = next((s for s in sellers.json() if int(s["user_id"]) == user_id), None)
    if not seller:
        pytest.skip("No seller mapped to freshly registered user in current DB state.")

    event = client.post(
        "/live-shopping/events",
        headers=headers,
        json={
            "seller_id": seller["id"],
            "title": "Live Deals",
            "product_ids": [1, 2],
            "starts_at": "2026-02-25T18:00:00Z",
        },
    )
    assert event.status_code == 200, event.text
    event_id = event.json()["id"]

    go_live = client.post(f"/live-shopping/events/{event_id}/go-live", headers=headers)
    assert go_live.status_code == 200, go_live.text
    assert go_live.json()["status"] == "live"

    dashboard = client.get(f"/seller/{seller['id']}/dashboard", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    assert "total_revenue" in dashboard.json()


def test_websocket_chat_realtime_delivery():
    # Single socket only: starlette's TestClient gives each session its own
    # event loop, so server-side fanout across two sessions deadlocks. The
    # sender self-delivery branch exercises the same realtime pipeline.
    user1, _, token1 = _register_user()
    user2, _, _ = _register_user()

    with client.websocket_connect(f"/ws/chat/{user1}?token={token1}") as ws1:
        assert ws1.receive_json()["type"] == "connected"

        ws1.send_json({"receiver_id": user2, "content": "hello realtime"})
        incoming = ws1.receive_json()
        assert incoming["type"] == "message"
        assert incoming["message"]["content"] == "hello realtime"
        assert int(incoming["message"]["sender_id"]) == user1
        assert int(incoming["message"]["receiver_id"]) == user2


def test_list_users_pagination():
    resp = client.get("/users?page=1&per_page=2")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["page"] == 1
    assert body["per_page"] == 2


def test_trade_buy_rejects_unfunded_portfolio_and_sell_requires_holdings():
    user_id, headers = _register_session_user()

    # A zero-cash portfolio cannot buy: fail closed, leave zeros untouched.
    broke_buy = client.post(
        "/trade/buy",
        headers=headers,
        params={
            "user_id": user_id,
            "symbol": "AAPL",
            "quantity": 2.0,
            "price": 50.0,
            "asset_type": "stock",
        },
    )
    assert broke_buy.status_code == 400, broke_buy.text
    assert broke_buy.json()["detail"] == "Insufficient cash"

    portfolio = client.get(f"/portfolio/{user_id}", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    body = portfolio.json()
    assert float(body["cash"]) == 0.0
    assert float(body["invested"]) == 0.0
    assert float(body["total_value"]) == 0.0

    # Selling anything without holdings fails closed instead of minting cash.
    empty_sell = client.post(
        "/trade/sell",
        headers=headers,
        params={
            "user_id": user_id,
            "symbol": "AAPL",
            "quantity": 5.0,
            "price": 50.0,
            "asset_type": "stock",
        },
    )
    assert empty_sell.status_code == 400, empty_sell.text
    assert empty_sell.json()["detail"] == "No holdings to sell"


def test_options_sell_requires_holdings_and_clamps_to_held():
    user_id, headers = _register_session_user()

    # Selling with nothing held fails closed instead of minting cash.
    empty_sell = client.post(
        "/options/trade",
        headers=headers,
        json={
            "user_id": user_id,
            "contract_symbol": "AAPL260918C00220000",
            "contracts": 2,
            "premium": 3.0,
            "side": "sell",
        },
    )
    assert empty_sell.status_code == 400, empty_sell.text
    assert empty_sell.json()["detail"] == "No holdings to sell"

    # No public endpoint funds an options position either, so seed the ledger
    # exactly as a funded buy would leave it and clean up afterwards.
    portfolio = _seed_trading_state(user_id, cash=0.0, invested=200.0)
    seeded_buy = backend_main.Trade(
        id=max((t.id for t in backend_main.TRADES), default=0) + 1,
        user_id=user_id,
        symbol="AAPL260918C00220000",
        asset_name="AAPL260918C00220000",
        type="buy",
        quantity=2.0,
        price=1.0,
        total_amount=200.0,
        timestamp="2026-08-22T00:00:00",
        asset_type="options",
    )
    backend_main.TRADES.append(seeded_buy)

    try:
        # Requesting 5 contracts while holding only 2 sells what is held.
        oversell = client.post(
            "/options/trade",
            headers=headers,
            json={
                "user_id": user_id,
                "contract_symbol": "AAPL260918C00220000",
                "contracts": 5,
                "premium": 3.0,
                "side": "sell",
            },
        )
        assert oversell.status_code == 200, oversell.text
        # Credited for the clamped 2 * 3 * 100, not the requested 5 * 3 * 100.
        assert float(oversell.json()["total_amount"]) == 600.0

        refreshed = client.get(f"/portfolio/{user_id}", headers=headers)
        assert refreshed.status_code == 200, refreshed.text
        data = refreshed.json()
        assert float(data["cash"]) == 600.0
        # Invested drops only by cost basis of contracts sold (2 * 100).
        assert float(data["invested"]) == 0.0
        assert float(data["total_value"]) == 600.0

        # Position drained: further sells fail closed with no cash movement.
        repeat_sell = client.post(
            "/options/trade",
            headers=headers,
            json={
                "user_id": user_id,
                "contract_symbol": "AAPL260918C00220000",
                "contracts": 1,
                "premium": 4.0,
                "side": "sell",
            },
        )
        assert repeat_sell.status_code == 400, repeat_sell.text
        assert repeat_sell.json()["detail"] == "No holdings to sell"

        final = client.get(f"/portfolio/{user_id}", headers=headers)
        assert final.status_code == 200, final.text
        assert float(final.json()["cash"]) == 600.0
    finally:
        backend_main.PORTFOLIOS.pop(user_id, None)
        backend_main.TRADES[:] = [
            t for t in backend_main.TRADES if int(t.user_id) != int(user_id)
        ]


def test_crypto_buy_rejects_unfunded_and_invalid_input():
    user_id, headers = _register_session_user()

    bad_input = client.post(
        "/crypto/trade/buy",
        headers=headers,
        params={"user_id": user_id, "symbol": "BTC", "quantity": 0.0, "price": 50.0},
    )
    assert bad_input.status_code == 400, bad_input.text
    assert bad_input.json()["detail"] == "quantity and price must be > 0"

    # Zero-cash portfolio cannot fund a buy: fail closed, stay zero.
    broke_buy = client.post(
        "/crypto/trade/buy",
        headers=headers,
        params={"user_id": user_id, "symbol": "BTC", "quantity": 0.5, "price": 100.0},
    )
    assert broke_buy.status_code == 400, broke_buy.text
    assert broke_buy.json()["detail"] == "Insufficient cash"

    portfolio = client.get(f"/portfolio/{user_id}", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    body = portfolio.json()
    assert float(body["cash"]) == 0.0
    assert float(body["invested"]) == 0.0
    assert float(body["total_value"]) == 0.0


def test_crypto_sell_rejects_without_holdings():
    user_id, headers = _register_session_user()

    # Selling crypto with nothing held fails closed instead of minting cash.
    empty_sell = client.post(
        "/crypto/trade/sell",
        headers=headers,
        params={"user_id": user_id, "symbol": "BTC", "quantity": 2.0, "price": 100.0},
    )
    assert empty_sell.status_code == 400, empty_sell.text
    assert empty_sell.json()["detail"] == "No holdings to sell"

    portfolio = client.get(f"/portfolio/{user_id}", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    body = portfolio.json()
    assert float(body["cash"]) == 0.0
    assert float(body["total_value"]) == 0.0


def test_crypto_sell_clamps_oversell_and_drops_cost_basis():
    user_id, headers = _register_session_user()
    # No public endpoint funds a crypto position either, so seed state the
    # same way the app persists it and clean up afterwards.
    portfolio = _seed_trading_state(user_id, cash=0.0, invested=200.0)
    holding = backend_main.PortfolioHolding(
        id=max((h.id for h in backend_main.PORTFOLIO_HOLDINGS), default=0) + 1,
        portfolio_id=portfolio.id,
        asset_symbol="BTC",
        asset_name="BTC",
        quantity=5.0,
        buy_price=40.0,
        current_price=40.0,
        value=200.0,
        profit_loss=0.0,
        profit_loss_percent=0.0,
        type="crypto",
    )
    backend_main.PORTFOLIO_HOLDINGS.append(holding)

    try:
        # Requesting 8 while holding only 5 sells what is held.
        oversell = client.post(
            "/crypto/trade/sell",
            headers=headers,
            params={
                "user_id": user_id,
                "symbol": "BTC",
                "quantity": 8.0,
                "price": 50.0,
            },
        )
        assert oversell.status_code == 200, oversell.text
        # Credited for clamped 5 * 50, not the requested 8 * 50.
        assert float(oversell.json()["total_amount"]) == 250.0

        refreshed = client.get(f"/portfolio/{user_id}", headers=headers)
        assert refreshed.status_code == 200, refreshed.text
        data = refreshed.json()
        assert float(data["cash"]) == 250.0
        # Invested drops only by the cost basis of units sold (5 * 40).
        assert float(data["invested"]) == 0.0
        assert float(data["total_value"]) == 250.0

        holdings = client.get(f"/portfolio/{user_id}/holdings", headers=headers)
        assert holdings.status_code == 200, holdings.text
        assert holdings.json() == []
    finally:
        backend_main.PORTFOLIOS.pop(user_id, None)
        for stale in [
            h for h in backend_main.PORTFOLIO_HOLDINGS if h.portfolio_id == portfolio.id
        ]:
            backend_main.PORTFOLIO_HOLDINGS.remove(stale)


def test_crypto_sell_after_drain_rejects():
    user_id, headers = _register_session_user()
    portfolio = _seed_trading_state(user_id, cash=0.0, invested=120.0)
    holding = backend_main.PortfolioHolding(
        id=max((h.id for h in backend_main.PORTFOLIO_HOLDINGS), default=0) + 1,
        portfolio_id=portfolio.id,
        asset_symbol="BTC",
        asset_name="BTC",
        quantity=3.0,
        buy_price=40.0,
        current_price=40.0,
        value=120.0,
        profit_loss=0.0,
        profit_loss_percent=0.0,
        type="crypto",
    )
    backend_main.PORTFOLIO_HOLDINGS.append(holding)

    try:
        drain = client.post(
            "/crypto/trade/sell",
            headers=headers,
            params={
                "user_id": user_id,
                "symbol": "BTC",
                "quantity": 3.0,
                "price": 50.0,
            },
        )
        assert drain.status_code == 200, drain.text
        assert float(drain.json()["total_amount"]) == 150.0

        # Position drained: further sells fail closed with no cash movement.
        repeat_sell = client.post(
            "/crypto/trade/sell",
            headers=headers,
            params={
                "user_id": user_id,
                "symbol": "BTC",
                "quantity": 1.0,
                "price": 60.0,
            },
        )
        assert repeat_sell.status_code == 400, repeat_sell.text
        assert repeat_sell.json()["detail"] == "No holdings to sell"

        final = client.get(f"/portfolio/{user_id}", headers=headers)
        assert final.status_code == 200, final.text
        assert float(final.json()["cash"]) == 150.0
    finally:
        backend_main.PORTFOLIOS.pop(user_id, None)
        for stale in [
            h for h in backend_main.PORTFOLIO_HOLDINGS if h.portfolio_id == portfolio.id
        ]:
            backend_main.PORTFOLIO_HOLDINGS.remove(stale)


def _seed_trading_state(user_id: int, cash: float, invested: float):
    """Seed a funded portfolio directly.

    No public endpoint funds trading-portfolio cash (the wallet deposit path
    feeds the shopping Wallet, not the Portfolio), so tests seed state the
    same way the app persists it and exercise the endpoints under test.
    """
    portfolio = backend_main.Portfolio(
        id=max((p.id for p in backend_main.PORTFOLIOS.values()), default=0) + 1,
        user_id=user_id,
        total_value=cash + invested,
        cash=cash,
        invested=invested,
        profit_loss=0.0,
        profit_loss_percent=0.0,
    )
    backend_main.PORTFOLIOS[user_id] = portfolio
    return portfolio


def test_trade_buy_debits_cash_and_builds_holdings():
    user_id, headers = _register_session_user()
    _seed_trading_state(user_id, cash=1000.0, invested=0.0)

    bought = client.post(
        "/trade/buy",
        headers=headers,
        params={
            "user_id": user_id,
            "symbol": "AAPL",
            "quantity": 2.0,
            "price": 50.0,
            "asset_type": "stock",
        },
    )
    assert bought.status_code == 200, bought.text
    assert float(bought.json()["total_amount"]) == 100.0

    portfolio = client.get(f"/portfolio/{user_id}", headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    body = portfolio.json()
    assert float(body["cash"]) == 900.0
    assert float(body["invested"]) == 100.0
    assert float(body["total_value"]) == 1000.0

    holdings = client.get(f"/portfolio/{user_id}/holdings", headers=headers)
    assert holdings.status_code == 200, holdings.text
    rows = holdings.json()
    assert len(rows) == 1
    assert rows[0]["asset_symbol"] == "AAPL"
    assert float(rows[0]["quantity"]) == 2.0


def test_trade_sell_clamps_to_held_quantity_and_adjusts_invested():
    user_id, headers = _register_session_user()
    portfolio = _seed_trading_state(user_id, cash=0.0, invested=120.0)
    holding = backend_main.PortfolioHolding(
        id=max((h.id for h in backend_main.PORTFOLIO_HOLDINGS), default=0) + 1,
        portfolio_id=portfolio.id,
        asset_symbol="AAPL",
        asset_name="AAPL",
        quantity=3.0,
        buy_price=40.0,
        current_price=40.0,
        value=120.0,
        profit_loss=0.0,
        profit_loss_percent=0.0,
        type="stock",
    )
    backend_main.PORTFOLIO_HOLDINGS.append(holding)

    try:
        # Requesting more than held sells only what is actually held.
        oversell = client.post(
            "/trade/sell",
            headers=headers,
            params={
                "user_id": user_id,
                "symbol": "AAPL",
                "quantity": 5.0,
                "price": 50.0,
                "asset_type": "stock",
            },
        )
        assert oversell.status_code == 200, oversell.text
        # Credited for clamped 3 * 50, not the requested 5 * 50.
        assert float(oversell.json()["total_amount"]) == 150.0

        refreshed = client.get(f"/portfolio/{user_id}", headers=headers)
        assert refreshed.status_code == 200, refreshed.text
        data = refreshed.json()
        assert float(data["cash"]) == 150.0
        # Invested drops only by the cost basis of units sold (3 * 40).
        assert float(data["invested"]) == 0.0

        holdings = client.get(f"/portfolio/{user_id}/holdings", headers=headers)
        assert holdings.status_code == 200, holdings.text
        assert holdings.json() == []

        # Holdings drained: further sells fail closed with no cash movement.
        repeat_sell = client.post(
            "/trade/sell",
            headers=headers,
            params={
                "user_id": user_id,
                "symbol": "AAPL",
                "quantity": 1.0,
                "price": 60.0,
                "asset_type": "stock",
            },
        )
        assert repeat_sell.status_code == 400, repeat_sell.text
        assert repeat_sell.json()["detail"] == "No holdings to sell"

        final = client.get(f"/portfolio/{user_id}", headers=headers)
        assert final.status_code == 200, final.text
        assert float(final.json()["cash"]) == 150.0
    finally:
        backend_main.PORTFOLIOS.pop(user_id, None)
        for stale in [
            h for h in backend_main.PORTFOLIO_HOLDINGS if h.portfolio_id == portfolio.id
        ]:
            backend_main.PORTFOLIO_HOLDINGS.remove(stale)
