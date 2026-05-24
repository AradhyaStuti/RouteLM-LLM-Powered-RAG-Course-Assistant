"""FAISS-backed embedding search with a small LRU cache."""

import logging
from collections import OrderedDict
from threading import Lock

import numpy as np
import faiss
import joblib
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_core.documents import Document

from backend.config import OLLAMA_URL, EMBED_MODEL, EMBEDDINGS_PATH, TOP_K
from backend.rag.courses import DEFAULT_COURSE_ID

logger = logging.getLogger(__name__)

CACHE_MAX_SIZE = 128


class LRUCache:
    def __init__(self, max_size=CACHE_MAX_SIZE):
        self._cache = OrderedDict()
        self._max_size = max_size
        self._lock = Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key):
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self.hits += 1
                return self._cache[key]
            self.misses += 1
            return None

    def put(self, key, value):
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self._max_size:
                    self._cache.popitem(last=False)
            self._cache[key] = value

    @property
    def stats(self):
        total = self.hits + self.misses
        rate = (self.hits / total * 100) if total > 0 else 0
        return {"size": len(self._cache), "hits": self.hits, "misses": self.misses, "hit_rate": f"{rate:.1f}%"}


class EmbeddingService:
    def __init__(self):
        self.df = None
        self.vectorstore = None
        self._cache = LRUCache()
        self.embeddings = OllamaEmbeddings(
            model=EMBED_MODEL,
            base_url=OLLAMA_URL,
        )

    def load(self):
        self.df = joblib.load(EMBEDDINGS_PATH)
        if "course_id" not in self.df.columns:
            self.df["course_id"] = DEFAULT_COURSE_ID

        documents = []
        embeddings_list = []

        for _, row in self.df.iterrows():
            # Two chunk shapes share the same FAISS index:
            #   - Video transcripts (ML course): integer `number` + start/end.
            #   - Written notes (GenAI, DS): no timestamps.
            # `has_timestamps` tells the UI and the prompt formatter which
            # citation style to render.
            number_raw = row.get("number")
            try:
                number = int(number_raw)
            except (TypeError, ValueError):
                number = str(number_raw) if number_raw is not None else ""

            start_raw = row.get("start")
            end_raw = row.get("end")
            has_timestamps = start_raw is not None and end_raw is not None

            metadata = {
                "number": number,
                "title": row.get("title", ""),
                "course_id": row.get("course_id", DEFAULT_COURSE_ID),
                "has_timestamps": has_timestamps,
            }
            if has_timestamps:
                metadata["start"] = round(float(start_raw), 1)
                metadata["end"] = round(float(end_raw), 1)

            doc = Document(
                page_content=row["text"].strip(),
                metadata=metadata,
            )
            documents.append(doc)
            embeddings_list.append(row["embedding"])

        emb_matrix = np.array(embeddings_list, dtype=np.float32)
        dimension = emb_matrix.shape[1]
        index = faiss.IndexFlatIP(dimension)
        faiss.normalize_L2(emb_matrix)
        index.add(emb_matrix)

        docstore = InMemoryDocstore(
            {str(i): doc for i, doc in enumerate(documents)}
        )

        self.vectorstore = FAISS(
            embedding_function=self.embeddings,
            index=index,
            docstore=docstore,
            index_to_docstore_id={i: str(i) for i in range(len(documents))},
        )
        logger.info("Loaded %d chunks into FAISS", len(self.df))

    def search(self, query: str, top_k: int = TOP_K, course_id: str | None = None) -> list[dict]:
        if self.vectorstore is None:
            raise RuntimeError("No vectorstore loaded")

        cache_key = (query.strip().lower(), top_k, course_id or "*")
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        # Over-fetch if filtering, then trim — keeps cache deterministic without
        # rebuilding the FAISS index per course.
        fetch_k = top_k * 4 if course_id else top_k
        docs_and_scores = self.vectorstore.similarity_search_with_score(query, k=fetch_k)

        results = []
        for doc, score in docs_and_scores:
            if course_id and doc.metadata.get("course_id") != course_id:
                continue
            md = doc.metadata
            result = {
                "number": md.get("number", ""),
                "title": md.get("title", ""),
                "course_id": md.get("course_id", DEFAULT_COURSE_ID),
                "text": doc.page_content,
                "similarity": round(float(score), 3),
                "has_timestamps": md.get("has_timestamps", False),
            }
            if md.get("has_timestamps"):
                result["start"] = md.get("start", 0)
                result["end"] = md.get("end", 0)
            results.append(result)
            if len(results) >= top_k:
                break

        self._cache.put(cache_key, results)
        return results

    @property
    def cache_stats(self):
        return self._cache.stats


embedding_service = EmbeddingService()
