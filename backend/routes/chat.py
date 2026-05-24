"""Chat endpoints — WebSocket (primary) + SSE (fallback)."""

import json
import logging
import time
import threading

from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from jose import JWTError, jwt

from backend.config import MAX_MESSAGE_LENGTH, JWT_SECRET
from backend.limiter import limiter
from backend.auth.security import get_current_user, ALGORITHM
from backend.rag.graph import run_graph
from backend.rag.generator import stream_tokens, stream_direct_tokens, generate_title
from backend.db.store import (
    create_conversation,
    add_message,
    get_messages,
    get_conversation,
    update_conversation_title,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

OFF_TOPIC_REPLY = (
    "That question is outside what I'm set up to answer. I cover the indexed "
    "courses only — **Andrew Ng's ML Specialization**, the **LangChain / RAG / "
    "GenAI stack**, and **Python data science** (NumPy, pandas, scikit-learn). "
    "Ask me something in those areas and I'll do my best."
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)
    conversation_id: str | None = None


def _generate_title_async(conv_id: str, question: str):
    try:
        title = generate_title(question)
        if title:
            update_conversation_title(conv_id, title)
    except Exception as e:
        logger.warning("Title generation failed: %s", e)


def _prepare_turn(user: dict, query: str, conv_id: str | None):
    """Resolve conversation, persist user message, classify + retrieve."""
    if conv_id:
        if not get_conversation(conv_id, user["id"]):
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv_id = create_conversation(user["id"])["id"]

    add_message(conv_id, "user", query)

    history = get_messages(conv_id)
    history_for_context = [
        {"role": m["role"], "content": m["content"]}
        for m in history[:-1]
    ][-6:]

    graph_result = run_graph(query, history_for_context)
    sources = graph_result.get("sources", [])
    query_type = graph_result.get("query_type", "course_related")
    is_first_message = len(history) <= 1

    logger.info(
        "chat user=%s conv=%s type=%s sources=%d query=%r",
        user["username"], conv_id[:8], query_type, len(sources), query[:60],
    )
    return conv_id, sources, query_type, history_for_context, is_first_message


def _pick_token_stream(query_type: str, query: str, sources: list[dict], history: list[dict]):
    if query_type == "course_related_general":
        return stream_direct_tokens(query, history)
    return stream_tokens(query, sources, history)


def _stream_events(
    *,
    conv_id: str,
    query: str,
    sources: list[dict],
    query_type: str,
    history: list[dict],
    is_first_message: bool,
    transport: str,
):
    """Yield wire-format events for one chat turn.

    Side-effects (persisting messages, kicking off the title-gen thread,
    logging) happen inline. Both the SSE and WS handlers iterate this and
    emit each dict on their respective transport — that's the only
    transport-specific concern.
    """
    stream_start = time.time()

    yield {"conversation_id": conv_id}
    yield {"node": "classify", "query_type": query_type}

    if sources:
        yield {"node": "retrieve", "sources": sources}

    yield {"node": "generate", "streaming": True}

    if query_type == "off_topic":
        yield {"token": OFF_TOPIC_REPLY}
        add_message(conv_id, "assistant", OFF_TOPIC_REPLY, [])
    else:
        if is_first_message:
            threading.Thread(
                target=_generate_title_async,
                args=(conv_id, query),
                daemon=True,
            ).start()

        buf = []
        count = 0
        for token in _pick_token_stream(query_type, query, sources, history):
            buf.append(token)
            count += 1
            yield {"token": token}

        response = "".join(buf)
        add_message(conv_id, "assistant", response, sources)

        logger.info(
            "generate transport=%s conv=%s type=%s tokens=%d chars=%d time=%ss",
            transport, conv_id[:8], query_type, count, len(response),
            round(time.time() - stream_start, 2),
        )

    yield {"done": True}


@router.post("")
@limiter.limit("20/minute")
async def chat(request: Request, req: ChatRequest, user: dict = Depends(get_current_user)):
    query = req.message.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Empty message")

    try:
        conv_id, sources, query_type, history_for_context, is_first_message = _prepare_turn(
            user, query, req.conversation_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Chat pre-processing failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process message")

    def event_stream():
        try:
            for event in _stream_events(
                conv_id=conv_id,
                query=query,
                sources=sources,
                query_type=query_type,
                history=history_for_context,
                is_first_message=is_first_message,
                transport="sse",
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error("SSE streaming failed: %s", e)
            yield f"data: {json.dumps({'error': 'Response generation failed'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _authenticate_ws(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        if user_id and username:
            return {"id": user_id, "username": username}
    except JWTError:
        pass
    return None


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        auth_msg = await websocket.receive_json()
        user = _authenticate_ws(auth_msg.get("token", ""))
        if not user:
            await websocket.send_json({"error": "Authentication failed"})
            await websocket.close(code=4001)
            return
        await websocket.send_json({"authenticated": True})
    except Exception:
        await websocket.close(code=4001)
        return

    try:
        while True:
            data = await websocket.receive_json()
            query = (data.get("message", "") or "").strip()
            if not query or len(query) > MAX_MESSAGE_LENGTH:
                await websocket.send_json({"error": "Invalid message"})
                continue

            try:
                conv_id, sources, query_type, history_for_context, is_first_message = _prepare_turn(
                    user, query, data.get("conversation_id"),
                )

                for event in _stream_events(
                    conv_id=conv_id,
                    query=query,
                    sources=sources,
                    query_type=query_type,
                    history=history_for_context,
                    is_first_message=is_first_message,
                    transport="ws",
                ):
                    await websocket.send_json(event)

            except HTTPException as e:
                await websocket.send_json({"error": e.detail})
            except Exception as e:
                logger.error("WebSocket chat failed: %s", e)
                await websocket.send_json({"error": "Response generation failed. Check the backend logs."})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected user=%s", user["username"])
