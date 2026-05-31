---
title: RouteLM
emoji: 🤖
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Routes questions before RAG. Three corpora, LangGraph.
---

# RouteLM

An engineering study buddy for students who can't always afford coaching or a tutor on call. Voice and text. English, Hindi, or Hinglish. Routes every question to the right answer path before doing RAG, so the assistant doesn't make things up when it doesn't know.

LLM is hosted (Groq), embeddings run locally via sentence-transformers in production. Everything around them I built myself — routing, retrieval, multi-corpus indexing, voice in/out, the React UI, the reliability layer, the eval.

**Live demo:** `https://aradhyastuti-routelm.hf.space` · Login `demo` / password set via `DEMO_USER_PASSWORD`.

![Demo](docs/demo.gif)

## Why this exists

Indian engineering students study in Hindi and English; they ask doubts in Hinglish; they don't always have a senior to call at 11 PM the night before an exam. Existing course chatbots are English-only, text-only, and fail in two specific ways:

1. **Confidently wrong on off-topic.** Ask anything off-topic and they cheerfully attach five "Sources" to a fake answer. That's worse than being wrong, because it looks correct.
2. **Locked to one input modality and one language.** Typing in English. That's it.

RouteLM fixes both. Routing happens before retrieval, so off-topic questions never get fake citations. Voice input/output works in English and Hindi via the browser's Web Speech API. The LLM is prompted to match the student's language — including Hinglish.

So instead of "retrieve then hope," it's "decide first, then act." Relevance is a first-class step.

Three paths:

- `course_related` - filtered FAISS retrieval, grounded answer with citations
- `course_related_general` - no retrieval, LLM answers from priors with a "this isn't in my notes" preamble
- `off_topic` - fixed refusal in <500ms, no LLM call

Per-course thresholds in JSON. When I added more courses each got its own decision boundary instead of fighting over a shared one.

## What it covers

Fifteen indexed corpora across core engineering / CS subjects:

| Subject | Chunks | Sample topics |
|---|---|---|
| Andrew Ng - ML Specialization | 273 | regression, gradient descent, neural networks |
| GenAI, RAG & LangChain stack | 37 | transformers, RAG, LangChain, LangGraph |
| Data Science with Python | 40 | NumPy, pandas, scikit-learn, EDA, model eval |
| Data Structures | 34 | arrays, lists, trees, heaps, hash tables, graphs, tries, AVL/RB trees, B+ trees, skip lists, DSU, segment & Fenwick trees, suffix structures, Bloom filters, LRU cache |
| Algorithms | 34 | Big-O, sorting, DP, greedy, DFS/BFS, Dijkstra, two pointers, sliding window, KMP, Z, Bellman-Ford, SCC, NP-completeness, A*, randomized & approximation |
| Operating Systems | 34 | processes, threads, scheduling, deadlock, IPC, paging, replacement, file systems, disk scheduling, real-time, COW, signals, working set |
| DBMS | 34 | relational model, SQL, normalization, ACID, indexes, transactions, NoSQL, CAP, MVCC, WAL, sharding, replication, column stores, query planning |
| Computer Networks | 34 | OSI, TCP/UDP, IP, DNS, HTTP/2/3, QUIC, TLS, BGP, NAT, DHCP, ARP, ICMP, CDN, anycast, VPN, IPv6, 5G, SDN |
| Software Engineering | 34 | SDLC, Agile, Git, testing, CI/CD, SOLID, refactoring, DDD, hexagonal, EDA, CQRS, observability, post-mortems, A/B testing |
| Artificial Intelligence | 34 | search, A*, planning, NLP, vision, MDPs, Q-learning, policy gradients, neural nets, backprop, CNNs, RNNs, GANs, diffusion, transformers, RLHF, alignment |
| Compiler Design | 34 | lexing, parsing (LL/LR), semantic analysis, type systems, IR/SSA, optimization, register allocation, GC algorithms, JIT, profile-guided opt |
| Cyber Security | 34 | CIA triad, crypto (sym/asym), hashing, auth, OWASP Top 10, threat modelling, pen testing, CVE/CVSS, ROP, ransomware, zero trust, GDPR, SIEM, IR |
| Cloud Computing | 34 | IaaS/PaaS/SaaS, virtualization, AWS, Kubernetes, IaC, service mesh, 12-factor, multi-region DR, message queues, lakes/warehouses, GitOps |
| Web Development | 34 | HTML/CSS/JS, REST, React hooks, SSR/SSG, Next.js, Vite, TypeScript, GraphQL, gRPC, Web Workers, PWA, WCAG, Core Web Vitals, WebAssembly |
| Programming Fundamentals | 34 | variables, control flow, OOP, recursion, complexity, closures, generators, pattern matching, ADTs, immutability, async/await, memoization |

**~760 chunks total** indexed across the 15 corpora. The ML course is real Whisper transcripts of Andrew Ng's videos; the other 14 I wrote as study notes that double as the source material for the assistant. The classifier routes every question to the right course before retrieval, so off-topic questions can't pull noise from the wrong subject.

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

First version represented each course as a centroid - the average embedding of all its anchor phrases. Worked fine when the course was narrow, like Andrew Ng's ML (19 anchors all about supervised learning). It broke once I added broader domains like the GenAI course, where 31 anchors span LLM internals, RAG, LangChain APIs and production stuff.

The centroid collapsed into a semantic middle. Real queries and off-topic queries ended up with similar scores, around 0.48-0.50 - no clean separation.

Switched to max similarity over anchors. Compare the query against each anchor, take the highest score. That fixed it: real matches jumped to 0.65-0.85, off-topic stayed under 0.50. Clean bimodal split.

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
- WebSocket primary, SSE fallback (both transports tested)
- Circuit breaker on the LLM (3 fails -> 30s cooldown -> half-open)
- Rate limits via slowapi: 5/min register, 10/min login, 20/min chat (one shared limiter across all routes)
- Voice in (Web Speech `SpeechRecognition`) + voice out (Web Speech `SpeechSynthesis`); English `en-IN` and Hindi `hi-IN`
- Multilingual prompting: LLM replies in the student's language (EN / HI / Hinglish); technical terms stay in English
- Tests: pytest backend + Vitest frontend; all passing locally. CI runs the embedding-free subset (the rest skip via `@requires_embeddings` when Ollama isn't reachable).

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

All tests passing locally. In CI the embedding-dependent tests skip because Ollama isn't reachable from the runner.

## Plain RAG vs RouteLM

Wanted to verify that plain RAG actually misbehaves on off-topic input. Ran [`scripts/compare_baseline.py`](scripts/compare_baseline.py) on 10 queries (4 on-topic, 6 off-topic) against the same Groq model.

Raw: [`eval/baseline_comparison.json`](eval/baseline_comparison.json).

On-topic side they're tied. The gap is all on off-topic. Plain RAG always returns 5 source chunks even for off-topic questions, which the UI would render as "Sources: 5 chunks" attached to a non-answer. That's the bad kind of leak because at a glance it looks grounded.

The off-topic leak rate going from 100% to 0% without hurting on-topic performance is the part I'm actually proud of. The router changes system behaviour in a measurable way.

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

Set `LLM_PROVIDER=groq` + `GROQ_API_KEY=...` in `.env` if you want generation via Groq. Embeddings always go through the Ollama container.

## Render deploy (heads up)

[`render.yaml`](render.yaml) is a Render blueprint, but it isn't deployable as-is. The embedding service always calls Ollama, so you need either a reachable Ollama endpoint (set `OLLAMA_URL` in the dashboard) or you have to swap the embedder for a hosted one in [`backend/rag/embeddings.py`](backend/rag/embeddings.py). The blueprint has a comment block explaining this.

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
pytest tests/             # backend
cd frontend && npm test   # frontend (Vitest)
```

`@requires_embeddings` tests skip when Ollama isn't reachable or `embeddings.joblib` is missing, so CI stays green without a model running.

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

The static per-course thresholds work, but they're rigid in the edge cases. The next thing I'd add is a second-stage decision (a small LLM or a reranker) when two course scores are within 0.02 of each other - that's where the threshold approach is weakest.

After that:

- BGE-Reranker between FAISS and the LLM
- Hybrid search (BM25 + dense, RRF)
- Live ingestion endpoint - upload PDF/video, transcribe + embed + index without restarting
- Per-message RAGAS scoring logged into the DB

## Author

Aradhya Stuti, final-year major project. MIT licensed, see [LICENSE](LICENSE).
