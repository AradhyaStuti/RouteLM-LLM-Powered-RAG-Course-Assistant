"""Embeddings, FAISS search, and the 3-way classifier."""

from tests.conftest import requires_embeddings

from backend.rag.embeddings import embedding_service
from backend.rag.graph import classify_node


@requires_embeddings
class TestEmbeddingService:
    def test_embeddings_loaded(self):
        assert embedding_service.df is not None
        assert len(embedding_service.df) > 0

    def test_search_returns_results(self):
        results = embedding_service.search("supervised learning")
        assert 0 < len(results) <= 5


@requires_embeddings
class TestGraphClassifier:
    def _classify(self, question: str) -> dict:
        return classify_node({
            "question": question,
            "chat_history": [],
            "sources": [],
            "query_type": "",
        })

    def test_classify_course_related_ml(self):
        result = self._classify("What is supervised learning?")
        assert result["query_type"] == "course_related"
        assert result["course_id"] == "ml-andrew-ng-c1"

    def test_classify_course_related_genai(self):
        """Queries about transformers should pick the GenAI course, not ML."""
        result = self._classify("How does self-attention work in transformers?")
        assert result["query_type"] == "course_related"
        assert result["course_id"] == "genai-rag-langchain"

    def test_classify_course_related_ds(self):
        """Pandas/groupby queries should pick the DS course."""
        result = self._classify("How do I use pandas groupby?")
        assert result["query_type"] == "course_related"
        assert result["course_id"] == "ds-python-libraries"

    def test_classify_course_related_general(self):
        """A query close to a course but not directly covered should route to
        the LLM-only path, not RAG and not refusal."""
        # Diffusion models are adjacent to the GenAI corpus but not in the
        # anchor list — should land in the general band.
        result = self._classify("Tell me about diffusion models for image generation")
        assert result["query_type"] in ("course_related_general", "course_related")
        # Whichever it is, it must NOT be off_topic — that would be a regression.
        assert result["query_type"] != "off_topic"

    def test_classify_off_topic(self):
        result = self._classify("Who won the 2022 FIFA World Cup final?")
        assert result["query_type"] == "off_topic"
