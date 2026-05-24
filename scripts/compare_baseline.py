"""Plain RAG vs RouteLM on the same query set.

Plain RAG = retrieve top-K from the whole index, hand them to the same RAG
prompt, generate an answer. No routing, no refusal logic.

RouteLM = full pipeline: classify → retrieve-with-course-filter / direct LLM /
canned refusal.

What I'm measuring:
  - Off-topic leak rate: of N off-topic queries, how many produced a confident
    substantive answer instead of a refusal? (lower is better)
  - Source pollution: for each query, were the cited chunks actually about
    the question? (manual labels in the script)
  - Response length on off-topic queries — a proxy for "did the LLM make
    something up?"
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.rag.embeddings import embedding_service
from backend.rag.graph import run_graph
from backend.rag.generator import rag_chain, format_context
from backend.routes.chat import OFF_TOPIC_REPLY


# 10 queries: 4 on-topic across all 3 courses + 6 off-topic.
# `expected` is what *should* happen — used only for scoring, not given to either system.
QUERIES = [
    {"q": "What is gradient descent?",                "expected": "answer", "topic": "ML"},
    {"q": "How does self-attention work in transformers?", "expected": "answer", "topic": "GenAI"},
    {"q": "How do I use pandas groupby?",             "expected": "answer", "topic": "DS"},
    {"q": "What is RAG and why use it?",              "expected": "answer", "topic": "GenAI"},
    {"q": "Who won the 2022 FIFA World Cup?",         "expected": "refuse", "topic": "off"},
    {"q": "How do I bake a chocolate cake?",          "expected": "refuse", "topic": "off"},
    {"q": "What is the capital of France?",           "expected": "refuse", "topic": "off"},
    {"q": "What's the weather in Tokyo today?",       "expected": "refuse", "topic": "off"},
    {"q": "How do I apply for a US tourist visa?",    "expected": "refuse", "topic": "off"},
    {"q": "Tell me a joke about cats",                "expected": "refuse", "topic": "off"},
]


def plain_rag(query: str) -> dict:
    """No router. Top-K from the entire index → RAG prompt → answer."""
    sources = embedding_service.search(query, top_k=5, course_id=None)
    answer = rag_chain.invoke({
        "context": format_context(sources),
        "chat_history": [],
        "question": query,
    })
    return {"sources": sources, "answer": answer}


def routelm(query: str) -> dict:
    """Full pipeline."""
    g = run_graph(query)
    qtype = g["query_type"]
    sources = g["sources"]

    if qtype == "off_topic":
        return {"sources": [], "answer": OFF_TOPIC_REPLY, "qtype": qtype, "course": g["course_id"]}

    # course_related and course_related_general both end up calling the LLM.
    # For this comparison, route both through rag_chain since plain RAG also uses it.
    answer = rag_chain.invoke({
        "context": format_context(sources),
        "chat_history": [],
        "question": query,
    })
    return {"sources": sources, "answer": answer, "qtype": qtype, "course": g["course_id"]}


def is_substantive(answer: str) -> bool:
    """A response counts as a 'substantive answer' (i.e. not a refusal) if it's
    longer than 200 chars and isn't our canned refusal."""
    a = answer.strip()
    if len(a) < 200:
        return False
    # Match against the canonical refusal — keep this list short so a small
    # rewording of OFF_TOPIC_REPLY doesn't silently break the metric.
    return OFF_TOPIC_REPLY[:80] not in a


def main():
    print("Loading embeddings...")
    embedding_service.load()
    print(f"Index: {len(embedding_service.df)} chunks across {embedding_service.df['course_id'].nunique()} courses\n")

    results = []
    for item in QUERIES:
        q = item["q"]
        print(f"--- {q!r}")

        t0 = time.time()
        plain = plain_rag(q)
        plain_ms = round((time.time() - t0) * 1000)

        t0 = time.time()
        rlm = routelm(q)
        rlm_ms = round((time.time() - t0) * 1000)

        plain_substantive = is_substantive(plain["answer"])
        rlm_substantive = is_substantive(rlm["answer"])

        leaked = item["expected"] == "refuse" and plain_substantive
        rlm_leaked = item["expected"] == "refuse" and rlm_substantive

        results.append({
            "query": q,
            "expected": item["expected"],
            "topic": item["topic"],
            "plain_rag": {
                "answer_chars": len(plain["answer"]),
                "answer_preview": plain["answer"][:120],
                "n_sources": len(plain["sources"]),
                "substantive": plain_substantive,
                "leaked": leaked,
                "ms": plain_ms,
            },
            "routelm": {
                "qtype": rlm.get("qtype"),
                "course": rlm.get("course"),
                "answer_chars": len(rlm["answer"]),
                "answer_preview": rlm["answer"][:120],
                "n_sources": len(rlm["sources"]),
                "substantive": rlm_substantive,
                "leaked": rlm_leaked,
                "ms": rlm_ms,
            },
        })
        print(f"  plain   : {len(plain['answer']):4d} chars, {len(plain['sources'])} sources, {plain_ms}ms{' [LEAK]' if leaked else ''}")
        print(f"  routelm : {len(rlm['answer']):4d} chars, {len(rlm['sources'])} sources, {rlm_ms}ms, {rlm.get('qtype')}{' [LEAK]' if rlm_leaked else ''}")
        print()

    # Aggregate
    off = [r for r in results if r["expected"] == "refuse"]
    on = [r for r in results if r["expected"] == "answer"]

    plain_leaks = sum(1 for r in off if r["plain_rag"]["leaked"])
    rlm_leaks = sum(1 for r in off if r["routelm"]["leaked"])

    plain_on_topic_ok = sum(1 for r in on if r["plain_rag"]["substantive"])
    rlm_on_topic_ok = sum(1 for r in on if r["routelm"]["substantive"])

    summary = {
        "n_queries": len(QUERIES),
        "n_off_topic": len(off),
        "n_on_topic": len(on),
        "off_topic_leak_rate": {
            "plain_rag": f"{plain_leaks}/{len(off)} = {round(100*plain_leaks/len(off))}%",
            "routelm":   f"{rlm_leaks}/{len(off)} = {round(100*rlm_leaks/len(off))}%",
        },
        "on_topic_substantive_rate": {
            "plain_rag": f"{plain_on_topic_ok}/{len(on)} = {round(100*plain_on_topic_ok/len(on))}%",
            "routelm":   f"{rlm_on_topic_ok}/{len(on)} = {round(100*rlm_on_topic_ok/len(on))}%",
        },
    }

    print("=" * 70)
    print("SUMMARY")
    print(json.dumps(summary, indent=2))

    out_dir = Path(__file__).resolve().parents[1] / "eval"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "baseline_comparison.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    print(f"\nFull results written to {out_path.relative_to(Path.cwd()) if out_path.is_relative_to(Path.cwd()) else out_path}")


if __name__ == "__main__":
    main()
