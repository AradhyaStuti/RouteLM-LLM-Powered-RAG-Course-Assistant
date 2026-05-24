"""LLM generation: prompts, streaming, and a small circuit breaker."""

import logging
import time
import threading

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser

from backend.config import (
    LLM_PROVIDER, LLM_TIMEOUT,
    OLLAMA_URL, OLLAMA_LLM_MODEL,
    GROQ_API_KEY, GROQ_LLM_MODEL,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 1


class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_timeout=30):
        self._failure_count = 0
        self._threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._last_failure_time = 0
        self._lock = threading.Lock()

    @property
    def is_open(self) -> bool:
        with self._lock:
            if self._failure_count >= self._threshold:
                if time.time() - self._last_failure_time > self._recovery_timeout:
                    # half-open: let one request through
                    self._failure_count = self._threshold - 1
                    return False
                return True
            return False

    def record_success(self):
        with self._lock:
            self._failure_count = 0

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()


llm_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)


def _create_llm() -> BaseChatModel:
    if LLM_PROVIDER == "groq":
        if not GROQ_API_KEY:
            logger.warning("GROQ_API_KEY missing — falling back to Ollama")
            return _create_ollama_llm()
        return _create_groq_llm()
    return _create_ollama_llm()


def _create_groq_llm() -> BaseChatModel:
    from langchain_groq import ChatGroq
    logger.info("LLM provider: Groq (%s)", GROQ_LLM_MODEL)
    return ChatGroq(
        model=GROQ_LLM_MODEL,
        api_key=GROQ_API_KEY,
        temperature=0.3,
        max_tokens=1024,
    )


def _create_ollama_llm() -> BaseChatModel:
    from langchain_ollama import ChatOllama
    logger.info("LLM provider: Ollama (%s)", OLLAMA_LLM_MODEL)
    return ChatOllama(
        model=OLLAMA_LLM_MODEL,
        base_url=OLLAMA_URL,
        timeout=LLM_TIMEOUT,
    )


llm = _create_llm()

RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are RouteLM, a teaching assistant covering three areas:
1. Andrew Ng's Machine Learning Specialization (Course 1) — supervised/unsupervised learning, regression, gradient descent.
2. The modern LLM stack — transformers, LLMs, generative AI, RAG, LangChain, LangGraph, production concerns.
3. Data Science with Python — Python essentials, NumPy, pandas, matplotlib/seaborn, scikit-learn, EDA, statistics, feature engineering, model evaluation.

Use the following retrieved excerpts to answer the student's question:

{context}

Instructions:
- Answer in a clear, helpful, conversational way
- Reference specific source items (e.g. "In the LangGraph notes around 3:00...") when relevant
- Use markdown for readability (bold, lists, code blocks)
- If the retrieved context doesn't actually cover the question, say so honestly instead of stretching it""",
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ]
)

DIRECT_KNOWLEDGE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are RouteLM, a teaching assistant covering Andrew Ng's ML Specialization (Course 1), the modern LLM / RAG / LangChain / LangGraph stack, and Python data science (NumPy, pandas, scikit-learn, EDA, stats).

The student asked a related question that isn't in the indexed source material you have access to.

Answer from your own knowledge as a careful, accurate tutor.

Instructions:
- Start with: "This isn't in my indexed notes, but here's what I can tell you:"
- Give a clear, correct, thorough explanation
- Use examples or analogies where they help
- Use markdown (bold, lists, code blocks)
- If the topic connects to something you do have notes on, mention the connection
- Be honest about the limits — don't fabricate citations""",
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ]
)

TITLE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Generate a short, concise title (max 6 words) for a conversation that starts with this question. Return only the title, nothing else.",
        ),
        ("human", "{question}"),
    ]
)

rag_chain = RAG_PROMPT | llm | StrOutputParser()
direct_chain = DIRECT_KNOWLEDGE_PROMPT | llm | StrOutputParser()
title_chain = TITLE_PROMPT | llm | StrOutputParser()

BUSY_MESSAGE = (
    "I'm having trouble connecting to the AI model right now. "
    "Please try again in a few seconds."
)
FAILURE_MESSAGE = (
    "\n\nI couldn't generate a response. "
    "Please check your LLM configuration and try again."
)


def format_context(sources: list[dict]) -> str:
    """Render retrieved chunks for the RAG prompt.

    Video-transcript chunks render with a `[Video N | Ss - Ss | Relevance: X]`
    header so the LLM can cite a timestamp. Written-note chunks render with a
    `[<title or "Section N"> | Relevance: X]` header — no timestamp because
    there isn't one.
    """
    lines = []
    for s in sources:
        # `video` is the legacy key from the original single-course shape.
        number = s.get("number", s.get("video", "?"))
        title = s.get("title", "")
        sim = s.get("similarity", 0)
        text = s.get("text", "")
        if s.get("has_timestamps") and "start" in s and "end" in s:
            header = f"[Video {number} | {s['start']}s - {s['end']}s | Relevance: {sim}]"
        else:
            label = title or f"Section {number}"
            header = f"[{label} | Relevance: {sim}]"
        lines.append(f"{header}\n{text}")
    return "\n\n".join(lines)


def format_chat_history(history: list[dict]) -> list:
    messages = []
    for msg in history[-6:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    return messages


def _build_rag_input(question, sources, history):
    return {
        "context": format_context(sources),
        "chat_history": format_chat_history(history or []),
        "question": question,
    }


def _build_direct_input(question, history):
    return {
        "chat_history": format_chat_history(history or []),
        "question": question,
    }


def _stream_with_retry(chain, inputs, label):
    if llm_breaker.is_open:
        yield BUSY_MESSAGE
        return

    for attempt in range(MAX_RETRIES):
        try:
            for token in chain.stream(inputs):
                yield token
            llm_breaker.record_success()
            return
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                llm_breaker.record_failure()
                logger.error("%s stream failed after %d retries: %s", label, MAX_RETRIES, e)
                yield FAILURE_MESSAGE
                return
            wait = RETRY_DELAY * (2 ** attempt)
            logger.warning("%s stream attempt %d failed: %s. Retrying in %ss...", label, attempt + 1, e, wait)
            time.sleep(wait)


def stream_tokens(question: str, sources: list[dict], history: list[dict] = None):
    yield from _stream_with_retry(rag_chain, _build_rag_input(question, sources, history), "rag")


def stream_direct_tokens(question: str, history: list[dict] = None):
    yield from _stream_with_retry(direct_chain, _build_direct_input(question, history), "direct")


def generate_title(question: str) -> str:
    if llm_breaker.is_open:
        return question[:50]

    try:
        result = title_chain.invoke({"question": question})
        llm_breaker.record_success()
        return result.strip().strip('"')[:200]
    except Exception as e:
        llm_breaker.record_failure()
        logger.warning("Title generation failed: %s", e)
        return question[:50]
