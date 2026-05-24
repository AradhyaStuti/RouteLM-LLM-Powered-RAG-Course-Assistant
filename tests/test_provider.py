"""LLM provider abstraction and circuit breaker."""

from unittest.mock import patch

from backend.rag.generator import CircuitBreaker, format_context


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        assert cb.is_open is False

    def test_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=9999)
        cb.record_failure()
        cb.record_failure()
        assert cb.is_open is True

    def test_resets_on_success(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=9999)
        cb.record_failure()
        cb.record_success()
        cb.record_failure()
        assert cb.is_open is False


def test_format_context_with_video_sources():
    sources = [
        {"number": 1, "start": 10, "end": 20, "similarity": 0.9, "text": "Hello", "has_timestamps": True},
        {"number": 2, "start": 30, "end": 40, "similarity": 0.8, "text": "World", "has_timestamps": True},
    ]
    result = format_context(sources)
    assert "Video 1" in result and "Hello" in result
    assert "Video 2" in result and "World" in result
    assert "10s - 20s" in result


def test_format_context_with_note_sources():
    """Non-video chunks should render as Section labels, not Video timestamps."""
    sources = [
        {"number": "01", "title": "Self-attention", "similarity": 0.82,
         "text": "Attention scores are softmax-normalised.", "has_timestamps": False},
    ]
    result = format_context(sources)
    assert "Self-attention" in result
    assert "Video" not in result
    assert "s -" not in result  # no timestamp range


def test_groq_falls_back_to_ollama_without_api_key():
    from backend.rag.generator import _create_llm
    with patch("backend.rag.generator.LLM_PROVIDER", "groq"), \
         patch("backend.rag.generator.GROQ_API_KEY", ""):
        assert _create_llm() is not None
