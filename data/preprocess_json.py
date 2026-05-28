"""Embed transcript chunks from a JSON file and write/merge into embeddings.joblib.

Usage:
    python preprocess_json.py                                       # default course, jsons.json, Ollama
    python preprocess_json.py --course ds-python-libraries --input ds_python_chunks.json
    python preprocess_json.py --embedder sentence_transformers      # no Ollama needed (HF Spaces build)
"""

import argparse
import json
import os
import sys

import joblib
import pandas as pd

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "bge-m3")
ST_EMBED_MODEL = os.getenv("ST_EMBED_MODEL", "BAAI/bge-m3")
DEFAULT_COURSE_ID = "ml-andrew-ng-c1"


def _embed_via_ollama(text_list):
    import requests
    payload = {"model": EMBED_MODEL, "input": text_list}
    r = requests.post(f"{OLLAMA_URL}/api/embed", json=payload, timeout=60)
    r.raise_for_status()
    embeddings = r.json().get("embeddings")
    if embeddings is None:
        raise ValueError("Response JSON missing 'embeddings'")
    return embeddings


_st_model = None  # cached so repeated calls don't reload the weights


def _embed_via_sentence_transformers(text_list):
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer(ST_EMBED_MODEL)
    # `normalize_embeddings=True` matches LangChain's HuggingFaceEmbeddings
    # default and the way the FAISS index is built (IP on unit-norm vectors).
    return _st_model.encode(
        text_list, normalize_embeddings=True, show_progress_bar=False
    ).tolist()


def create_embedding(text_list, backend="ollama"):
    if isinstance(text_list, str):
        text_list = [text_list]
    if backend == "sentence_transformers":
        return _embed_via_sentence_transformers(text_list)
    return _embed_via_ollama(text_list)


def main():
    parser = argparse.ArgumentParser(description="Embed transcript chunks for one course.")
    parser.add_argument("--course", default=DEFAULT_COURSE_ID, help="Course id matching data/courses.json")
    parser.add_argument("--input", default="jsons.json", help="Input transcript JSON file")
    parser.add_argument("--output", default="embeddings.joblib", help="Output joblib")
    parser.add_argument("--replace", action="store_true",
                        help="Replace existing rows for this course (default: merge/append)")
    parser.add_argument(
        "--embedder",
        choices=["ollama", "sentence_transformers"],
        default=os.getenv("EMBEDDER", "ollama"),
        help="Which backend to embed with. Default reads from EMBEDDER env, then ollama.",
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Input not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        content = json.load(f)

    chunks = content.get("chunks", [])
    if not chunks:
        raise RuntimeError(f"No 'chunks' found in {args.input}")

    texts = [c.get("text", "") for c in chunks]
    embeddings = create_embedding(texts, backend=args.embedder)

    if len(embeddings) != len(texts):
        raise ValueError(f"Embeddings count ({len(embeddings)}) != chunks count ({len(texts)})")

    rows = []
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        chunk["chunk_id"] = idx
        chunk["embedding"] = list(emb)
        chunk["course_id"] = args.course
        rows.append(chunk)

    new_df = pd.DataFrame.from_records(rows)

    if os.path.exists(args.output) and not args.replace:
        existing = joblib.load(args.output)
        if "course_id" not in existing.columns:
            existing["course_id"] = DEFAULT_COURSE_ID
        existing = existing[existing["course_id"] != args.course]
        merged = pd.concat([existing, new_df], ignore_index=True)
    else:
        merged = new_df

    joblib.dump(merged, args.output)
    print(f"Wrote {args.output}: {len(merged)} total rows ({len(new_df)} new for course={args.course!r})")


if __name__ == "__main__":
    main()
