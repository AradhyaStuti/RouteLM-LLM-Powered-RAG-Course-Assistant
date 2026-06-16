RouteLM

An AI study assistant built for engineering students who switch between English, Hindi, and Hinglish while studying. Instead of blindly retrieving documents for every query, RouteLM first decides whether a question is relevant, then chooses the appropriate response path. This prevents hallucinated answers and fake citations for off-topic questions.

The system supports both voice and text interactions, multilingual responses, and retrieval across multiple engineering subjects.

Key Features
Built a routing-first RAG architecture using LangGraph.
Supports English, Hindi, and Hinglish conversations.
Voice input/output using browser speech APIs.
Retrieves answers from 15 engineering and computer science knowledge bases.
Prevents off-topic hallucinations by classifying queries before retrieval.
Real-time streaming responses via WebSockets and SSE.
User authentication, chat history, and conversation management.
What Makes It Different

Most educational chatbots retrieve documents for every query, even when the question is unrelated to the available knowledge base. This often leads to confident but incorrect answers backed by irrelevant citations.

RouteLM introduces a routing layer before retrieval:

Course-related queries → Answered using FAISS-based RAG with citations.
General academic queries → Answered directly by the LLM with a disclaimer.
Off-topic queries → Rejected instantly without retrieval or LLM generation.

This design reduced off-topic citation leakage from 100% to 0% during evaluation while maintaining answer quality for relevant queries.

Knowledge Base

Indexed approximately 760 chunks across 15 engineering and computer science domains, including:

Machine Learning
Generative AI & RAG
Data Structures & Algorithms
Operating Systems
DBMS
Computer Networks
Software Engineering
Artificial Intelligence
Compiler Design
Cyber Security
Cloud Computing
Web Development
Programming Fundamentals
Routing Methodology

Each course is represented by a set of semantic anchor phrases embedded using BGE-M3.

For every incoming query:

Generate the query embedding.
Compare it against all anchor embeddings.
Select the highest similarity score.
Route the query based on course-specific thresholds.

Instead of using centroid embeddings, RouteLM uses a maximum-anchor similarity strategy, which significantly improved separation between relevant and irrelevant queries.

Tech Stack

Backend

FastAPI
LangGraph
SQLite (WAL mode)
FAISS
JWT Authentication

AI Stack

Groq (Llama 3.3 70B)
Ollama
BGE-M3 Embeddings
Sentence Transformers

Frontend

React
Vite

Infrastructure

WebSockets & SSE
Circuit Breaker Pattern
Rate Limiting
Docker
Results
18/18 routing evaluation queries classified correctly.
Typical end-to-end response latency between 1–2 seconds.
Eliminated off-topic source leakage without reducing retrieval accuracy.
Supports multilingual and voice-based interactions.
Future Improvements
Cross-encoder reranking
Hybrid search (BM25 + Dense Retrieval)
Dynamic document ingestion
Automated RAG evaluation and monitoring
Ambiguous-query rerouting using a secondary decision layer
