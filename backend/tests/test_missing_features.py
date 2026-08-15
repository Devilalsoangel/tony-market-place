import time
import uuid

import pytest
from fastapi.testclient import TestClient

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


def _login_demo_user() -> tuple[int, dict]:
    response = client.post(
        "/auth/login",
        json={"email": "demo@unihub.com", "password": "Demo@123"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    user_id = int(body["user"]["id"])
    token = body["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def test_media_upload_payment_and_checkout():
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
        json={"user_id": user_id, "amount": 100.0, "currency": "usd", "gateway": "mockpay"},
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
    user_id, headers = _login_demo_user()

    sellers = client.get("/sellers")
    assert sellers.status_code == 200, sellers.text
    seller = next((s for s in sellers.json() if int(s["user_id"]) == user_id), None)
    if not seller:
        pytest.skip("No seller mapped to demo user in current DB state.")

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

    contracts = client.get("/options/contracts?underlying=AAPL")
    assert contracts.status_code == 200, contracts.text
    assert isinstance(contracts.json(), list)

    trade = client.post(
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
    assert trade.status_code == 200, trade.text
    assert trade.json().get("success") is True


def test_websocket_chat_realtime_delivery():
    user1, _, token1 = _register_user()
    user2, _, token2 = _register_user()

    with client.websocket_connect(f"/ws/chat/{user1}?token={token1}") as ws1:
        with client.websocket_connect(f"/ws/chat/{user2}?token={token2}") as ws2:
            ws1.receive_json()
            ws2.receive_json()

            ws1.send_json({"receiver_id": user2, "content": "hello realtime"})
            incoming = ws2.receive_json()
            assert incoming["type"] == "message"
            assert incoming["message"]["content"] == "hello realtime"
            assert int(incoming["message"]["receiver_id"]) == user2


def test_list_users_pagination():
    # ensure there are at least a couple of users (demo is seeded)
    resp = client.get("/users?page=1&per_page=2")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["page"] == 1
    assert body["per_page"] == 2
