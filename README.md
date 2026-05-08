# RouteLM

LLM course assistant that routes questions before doing RAG. A small classifier picks one of three paths (RAG, LLM-only, or refuse) before retrieval ever runs. Per-course thresholds, FAISS-backed, LangGraph wiring.

LLM is hosted (Groq), embeddings are hosted (Ollama). Everything around them I built myself - routing, retrieval, multi-corpus indexing, the React UI, the reliability layer, the eval.

Demo login: `demo` / password from `DEMO_USER_PASSWORD` (auto-seeded with `SEED_DEMO_USER=true`).

![Demo](docs/demo.gif)

## Why

Plain-RAG chat apps fail in obvious ways. Ask anything off-topic and they cheerfully return five "Sources" attached to a fake answer. Retrieval has no idea whether the question even belongs in the corpus. So I made routing the first step instead of a filter bolted on top.

Three paths:

- `course_related` - filtered FAISS retrieval, grounded answer with citations
- `course_related_general` - no retrieval, LLM answers from priors with a "this isn't in my notes" preamble
- `off_topic` - fixed refusal in <500ms, no LLM call

Per-course thresholds in JSON. When I added more courses each got its own decision boundary instead of fighting over a shared one.

## What it covers

| Course | Chunks | Topics |
|---|---|---|
| Andrew Ng - ML Specialization (Course 1) | 273 | regression, gradient descent, neural networks |
| GenAI, RAG & LangChain stack | 37 | transformers, RAG (theory + chunking + RAGAS), LangChain, LangGraph |
| Data Science with Python | 40 | NumPy, pandas, scikit-learn, EDA, model eval |

350 chunks total. ML course is real Whisper transcripts of Andrew Ng's videos. The other two I wrote as study notes and they double as the source for the assistant.

## How routing works

Each course in `data/courses.json` declares anchor phrases. They get embedded with `bge-m3` at startup.

For a new question:

1. Embed the question.
2. Score each course = `max(cosine_sim(query, anchor) for anchor in course.anchors)`. Max over anchors, not centroid - this part matters.
3. Best course wins, score gets compared against that course's thresholds.

| score | path | example |
|---|---|---|
| `>= course_threshold` | RAG | "How do I use pandas groupby?" |
| `>= general_threshold` | LLM-only | "Tell me about diffusion models" |
| `< general_threshold` | refuse | "Who won the 2022 World Cup?" |

Defaults around 0.58-0.60 / 0.50, calibrated for `bge-m3`.

## Why max-anchor and not centroid

First version averaged anchor embeddings into a centroid per course. Worked fine for the original ML course (19 anchors, all about supervised learning). It collapsed the moment I added the GenAI course (31 anchors spanning LLM internals, RAG, LangChain APIs, production). The centroid landed in some meaningless midpoint and legit queries scored 0.48 alongside actually off-topic ones at 0.50.

Switched to max over anchors. Real matches now hit 0.65-0.85, off-topic stays under 0.50, scores are clearly bimodal.

## Architecture

![Architecture](docs/architecture.png)

```
React frontend
     ↓  (WebSocket / SSE)
FastAPI
     ↓
LangGraph
   classify ─┬─> retrieve  ─┐
             ├─> direct     ├─> stream tokens
             └─> off_topic ─┘
     ↓
SQLite (auth + history)   ·   FAISS
```

Each node is a Python function reading/writing a `TypedDict`. The conditional edge after `classify` is the whole point of using a graph - same compiled object handles all three paths without `if/else` outside the router.

## Stack

- FastAPI + Pydantic + SQLite (WAL)
- React + Vite (built bundle served by FastAPI in production)
- LangGraph (3-node StateGraph)
- LLM: Groq `llama-3.3-70b-versatile`, fallback Ollama `llama3.2`
- Embeddings: `bge-m3` via Ollama, FAISS index
- JWT + bcrypt auth
- WebSocket primary, SSE fallback
- Circuit breaker on the LLM (3 fails -> 30s cooldown -> half-open)
- Rate limits via slowapi: 5/min register, 10/min login, 20/min chat
- Tests: pytest (36) + Vitest (7)

## Results

18 hand-picked queries, 18/18 correctly classified.

| Category | Queries | Correct |
|---|---|---|
| ML Course 1 | 3 | 3 / 3 |
| GenAI / RAG | 4 | 4 / 4 |
| DS / Python | 8 | 8 / 8 |
| Off-topic | 3 | 3 / 3 |

End-to-end with real Groq:

| Query | Course | Sources | Time |
|---|---|---|---|
| "How do I use pandas groupby?" | ds-python-libraries | 5 | 1.77 s |
| "What is RAG and why use it?" | genai-rag-langchain | 5 | 1.25 s |
| "What is gradient descent?" | ml-andrew-ng-c1 | 5 | 1.07 s |

Tests: 36 backend + 7 frontend, all passing.

## Plain RAG vs RouteLM

Wanted to verify that plain RAG actually misbehaves on off-topic input. Ran [`scripts/compare_baseline.py`](scripts/compare_baseline.py) on 10 queries (4 on-topic, 6 off-topic) against the same Groq model.

Raw: [`eval/baseline_comparison.json`](eval/baseline_comparison.json).

On-topic side they're tied. The gap is all on off-topic. Plain RAG always returns 5 source chunks even for off-topic questions, which the UI would render as "Sources: 5 chunks" attached to a non-answer. That's the bad kind of leak because at a glance it looks grounded.

## Setup

```bash
ollama pull bge-m3
python -m venv venv
pip install -r requirements.txt
```

Copy [.env.example](.env.example) to `.env` and fill in:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key
JWT_SECRET=your_long_random_string
```

Generate a JWT secret: `python -c "import secrets; print(secrets.token_hex(32))"`.

Build the frontend, then run:

```bash
cd frontend && npm install && npm run build && cd ..
ollama serve                                   # terminal 1
python -m uvicorn backend.main:app --reload    # terminal 2
```

Open `http://localhost:8000`.

## Docker

```bash
docker compose up
docker compose exec ollama ollama pull bge-m3   # first run only
```

## API

| | |
|---|---|
| `POST /api/auth/register` | account, returns JWT |
| `POST /api/auth/login` | returns JWT |
| `POST /api/chat` | SSE stream |
| `WS /api/chat/ws` | same stream over WS |
| `GET/POST/PATCH/DELETE /api/conversations` | CRUD + rename |
| `GET /api/health` | status, chunk count, breaker state |

## Tests

```bash
pytest tests/             # 36 backend tests
cd frontend && npm test   # 7 frontend tests
```

`@requires_embeddings` tests skip when Ollama isn't reachable, so CI stays green without a model.

## Adding a new course

1. Register in `data/courses.json`:

```json
"my-course-id": {
  "name": "My Course",
  "course_threshold": 0.60,
  "general_threshold": 0.50,
  "anchors": ["topic one", "topic two", ...]
}
```

10-30 anchor phrases work well.

2. Drop chunks into a JSON file shaped like `jsons.json`.
3. Embed and merge:

```bash
cd data
python preprocess_json.py --course my-course-id --input my_chunks.json
```

Restart picks it up. Each retrieved chunk carries its `course_id`, so the UI can show which course a citation came from.

## Things I'd build next

- BGE-Reranker between FAISS and the LLM
- Hybrid search (BM25 + dense, RRF)
- Live ingestion endpoint - upload PDF/video, transcribe + embed + index without restarting
- Per-message RAGAS scoring logged into the DB
- Small LLM as a tiebreaker when two courses score within 0.02 of each other

## Author

Aradhya Stuti, final-year major project. MIT licensed, see [LICENSE](LICENSE).
