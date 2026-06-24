# RouteLM – Multilingual AI Study Assistant for Engineering Students

RouteLM is an intelligent study assistant designed specifically for engineering and computer science students who naturally switch between English, Hindi, and Hinglish while learning.

Unlike traditional Retrieval-Augmented Generation (RAG) systems that retrieve documents for every query, RouteLM introduces a routing-first architecture that determines whether a question is relevant before retrieval begins. This prevents hallucinated answers, eliminates irrelevant citations, and significantly improves response reliability.

The platform supports both text and voice interactions, multilingual conversations, real-time streaming responses, and retrieval across multiple engineering domains.

---

## Key Features

* Routing-first RAG architecture built with LangGraph
* Supports English, Hindi, and Hinglish conversations
* Voice input and output using browser speech APIs
* Retrieval across 15 engineering and computer science subjects
* Prevents off-topic hallucinations through intelligent query classification
* Real-time response streaming using WebSockets and Server-Sent Events (SSE)
* User authentication and secure session management
* Persistent chat history and conversation tracking
* Fast response times with optimized retrieval pipelines

---

## Why RouteLM?

Most educational chatbots retrieve documents for every incoming query, regardless of whether the question is related to the available knowledge base. This often produces confident but misleading answers supported by irrelevant citations.

RouteLM solves this problem by introducing a routing layer before retrieval.

### Query Routing Workflow

#### 1. Course-Related Queries

* Routed to a FAISS-powered RAG pipeline
* Retrieves relevant documents
* Generates grounded responses with source citations

#### 2. General Academic Queries

* Answered directly by the language model
* Includes a transparency disclaimer indicating that no course material was retrieved

#### 3. Off-Topic Queries

* Rejected immediately
* No retrieval performed
* No unnecessary LLM generation

This architecture reduced off-topic citation leakage from 100% to 0% during evaluation while maintaining answer quality for relevant queries.

---

## Knowledge Base

RouteLM currently indexes approximately 760 semantic chunks distributed across 15 engineering and computer science domains:

* Machine Learning
* Artificial Intelligence
* Generative AI & RAG
* Data Structures & Algorithms
* Operating Systems
* Database Management Systems (DBMS)
* Computer Networks
* Software Engineering
* Compiler Design
* Cyber Security
* Cloud Computing
* Web Development
* Programming Fundamentals
* System Design
* Computer Science Foundations

---

## Routing Methodology

Each subject domain is represented using a collection of carefully curated semantic anchor phrases embedded with BGE-M3.

For every incoming query:

1. Generate the query embedding.
2. Compare it against all anchor embeddings.
3. Identify the highest similarity score.
4. Apply course-specific routing thresholds.
5. Route the query to the appropriate response path.

### Maximum-Anchor Similarity Strategy

Instead of relying on centroid embeddings, RouteLM uses a maximum-anchor similarity approach. A query is matched against individual anchor concepts, allowing more precise separation between relevant and irrelevant questions.

This strategy significantly improved routing accuracy and reduced false-positive retrievals.

---

## System Architecture

### Backend

* FastAPI
* LangGraph
* SQLite (WAL Mode)
* FAISS
* JWT Authentication

### AI Stack

* Groq (Llama 3.3 70B)
* Ollama
* BGE-M3 Embeddings
* Sentence Transformers

### Frontend

* React
* Vite

### Infrastructure

* Docker
* WebSockets
* Server-Sent Events (SSE)
* Circuit Breaker Pattern
* Rate Limiting

---

## Performance & Results

* 18/18 routing evaluation queries classified correctly
* Typical end-to-end response latency: 1–2 seconds
* Eliminated off-topic citation leakage
* Maintained retrieval quality for relevant queries
* Supports multilingual and voice-based interactions

---

## Future Enhancements

* Cross-Encoder Re-ranking
* Hybrid Search (BM25 + Dense Retrieval)
* Dynamic Knowledge Base Ingestion
* Automated RAG Evaluation Framework
* Observability & Monitoring Dashboard
* Multi-Agent Query Routing
* Ambiguous Query Re-routing Layer
* Personalized Learning Context and Memory

---

## Core Innovation

The key innovation behind RouteLM is its routing-first retrieval strategy.

Rather than asking, *"Which documents should I retrieve?"*, RouteLM first asks:

> "Should retrieval happen at all?"

By making relevance determination the first step of the pipeline, the system avoids unnecessary retrieval, prevents misleading citations, reduces hallucinations, and delivers a more trustworthy educational experience for engineering students.
