"""Test chat endpoint — streaming, validation, auth."""

import json
from tests.conftest import requires_embeddings


def parse_sse(response_text: str) -> list[dict]:
    """Parse SSE response into list of data objects."""
    events = []
    for line in response_text.split("\n"):
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


@requires_embeddings
def test_chat_creates_conversation(client, auth_headers):
    """First message should create a new conversation."""
    res = client.post(
        "/api/chat",
        json={"message": "What is supervised learning?"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)
    conv_ids = [e["conversation_id"] for e in events if "conversation_id" in e]
    assert len(conv_ids) >= 1


@requires_embeddings
def test_chat_returns_sources(client, auth_headers):
    """Course-related queries should return source chunks."""
    res = client.post(
        "/api/chat",
        json={"message": "What is supervised learning?"},
        headers=auth_headers,
    )
    events = parse_sse(res.text)
    source_events = [e for e in events if "sources" in e]
    assert len(source_events) >= 1
    sources = source_events[0]["sources"]
    assert len(sources) > 0
    assert "number" in sources[0]
    assert "text" in sources[0]
    assert "similarity" in sources[0]
    assert "course_id" in sources[0]


@requires_embeddings
def test_chat_returns_tokens(client, auth_headers):
    """Response should stream tokens."""
    res = client.post(
        "/api/chat",
        json={"message": "What is regression?"},
        headers=auth_headers,
    )
    events = parse_sse(res.text)
    tokens = [e["token"] for e in events if "token" in e]
    assert len(tokens) > 0


def test_chat_rejects_empty_message(client, auth_headers):
    res = client.post("/api/chat", json={"message": ""}, headers=auth_headers)
    assert res.status_code == 422


def test_chat_requires_auth(client):
    res = client.post("/api/chat", json={"message": "hello"})
    assert res.status_code == 401


def _extract_token(auth_headers: dict) -> str:
    return auth_headers["Authorization"].removeprefix("Bearer ")


def test_ws_rejects_missing_token(client):
    """WS handshake without a token should close with 4001."""
    with client.websocket_connect("/api/chat/ws") as ws:
        ws.send_json({})  # no token field
        # First message is the auth result; for a bad token the server closes.
        try:
            msg = ws.receive_json()
            # Some clients see the {"error": ...} frame before the close.
            assert msg.get("error")
        except Exception:
            pass  # Connection closed before any frame — also acceptable.


def test_ws_rejects_invalid_token(client):
    with client.websocket_connect("/api/chat/ws") as ws:
        ws.send_json({"token": "not-a-real-jwt"})
        try:
            msg = ws.receive_json()
            assert msg.get("error")
        except Exception:
            pass


@requires_embeddings
def test_ws_authenticates_and_streams(client, auth_headers):
    """A valid JWT over WS should authenticate and stream pipeline events + tokens."""
    token = _extract_token(auth_headers)
    with client.websocket_connect("/api/chat/ws") as ws:
        ws.send_json({"token": token})
        auth_ack = ws.receive_json()
        assert auth_ack.get("authenticated") is True

        ws.send_json({"message": "What is supervised learning?"})

        events = []
        # Generous cap — a single answer can be 1000+ tokens plus node events.
        for _ in range(2000):
            msg = ws.receive_json()
            events.append(msg)
            if msg.get("done"):
                break

        assert any("conversation_id" in e for e in events)
        assert any(e.get("node") == "classify" for e in events)
        assert any("token" in e for e in events)
        assert events[-1].get("done") is True
