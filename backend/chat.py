from __future__ import annotations

from typing import Any, Dict, List

from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections and user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_to(self, user_id: int, payload: Dict[str, Any]) -> None:
        for conn in list(self.active_connections.get(user_id, [])):
            try:
                await conn.send_json(payload)
            except Exception:
                self.disconnect(user_id, conn)
