**Current Status of Pockit** — **Monday, May 18, 2026 20:05:37 EDT**
-----

# Pockit Architecture

## Overview

Pockit is a **self-hosted**, privacy-first personal truth engine that builds a deeply accurate AI agent by learning who you really are through gentle daily interactions.

## High-Level Architecture

### Core Components

**1. Mobile Client**

- React Native or Flutter app
- Beautiful, minimal interface (Color Wheel, 0.0–1.0 sliders, voice input)
- Communicates securely with the user’s self-hosted backend

**2. Backend Service**

- FastAPI (Python)
- REST + WebSocket support
- Orchestrates all services

**3. Voice Processing Pipeline**

- **Silero VAD** — Voice Activity Detection (skips silence)
- **Whisper.cpp** — Primary speech-to-text engine (quantized models: Q4_K_M / Q5_0)
- Optimized for edge devices (Raspberry Pi 5, Mac Mini, low-power VPS)
- Near real-time transcription support

**4. Memory & Intelligence Layer**

- **Matryoshka Representation Learning (MRL)** using `nomic-embed-text-v1.5`
  - Full 768-dim embeddings stored
  - Flexible truncation at query time (768 → 512 → 256 → 128) based on hardware
- Vector database (Chroma or LanceDB for MVP)
- Structured database (PostgreSQL)
- Pattern recognition, consistency engine, and insight generator

**5. Micro-Question Engine**

- Smart, contextual question generation
- Time-window based scheduling
- Adaptive frequency and snooze support

**6. Dashboard & Insights**

- Daily/weekly summaries
- Mood trends
- Honest insights and contradictions
- “What Pockit Knows About You” view

## Data Flow

1. User inputs data (color wheel, slider, voice memo)
2. Voice is processed locally (Silero VAD → Whisper.cpp)
3. Data is embedded using Matryoshka embeddings and stored
4. Analysis engine runs to extract patterns and insights
5. Insights are delivered back to the mobile app

## Self-Hosting Design

- Entire stack runs via Docker + docker-compose
- All user data and memory stays on the user’s own infrastructure
- Requires valid HTTPS certificate to function
- Designed to run efficiently on Raspberry Pi 5, Mac Mini, or mid-tier VPS

## Technology Stack

- **Backend**: FastAPI + Python
- **Speech**: Whisper.cpp + Silero VAD
- **Embeddings**: nomic-embed-text-v1.5 (Matryoshka)
- **Vector Store**: Chroma / LanceDB
- **Database**: PostgreSQL
- **Frontend**: React Native or Flutter
- **Containerization**: Docker + docker-compose

## Security Considerations

- HTTPS enforcement (required to run)
- No user data sent to external servers
- Local-only authentication
- Full data export and deletion support

## Development Priorities

**MVP Focus**

- Voice pipeline (Whisper.cpp + Silero VAD)
- Core input methods (Color Wheel + 0.0–1.0)
- Micro-Question Engine
- Basic Memory + Dashboard

**Future**

- Full RAG capabilities
- Sub-agents
- Managed hosting options

-----

**Current Status of Pockit** — **Monday, May 18, 2026 19:57:41 EDT**

### Vector Embeddings for Long-Term Memory Bank

Vector embeddings are the foundation of Pockit’s **Long-term Memory Bank**. They convert journal entries, ratings, voice transcripts, moods, and insights into high-dimensional vectors so the AI can semantically search and recall relevant personal context later.

#### Best Embedding Models for Pockit (Self-Hosted Focus, 2026)

|Model                           |Size    |MTEB Score (approx)|Strengths for Pockit                              |Recommendation               |
|--------------------------------|--------|-------------------|--------------------------------------------------|-----------------------------|
|**nomic-embed-text-v1.5**       |137M    |~62+               |Excellent balance, fast, great for personal memory|**Strong default**           |
|**Snowflake Arctic Embed** (m/l)|109–335M|54–58+             |Very efficient, strong retrieval                  |Excellent for edge           |
|**BAAI/bge-base-en-v1.5**       |~109M   |~64                |High accuracy, widely used                        |Very good                    |
|**intfloat/e5-base-v2**         |~109M   |Strong             |Good without special prefixes                     |Solid alternative            |
|**all-MiniLM-L6-v2**            |23M     |Good               |Extremely lightweight & fast                      |For very low-resource devices|

**Recommendation for Pockit MVP**:

- Start with **`nomic-embed-text-v1.5`** or **Snowflake Arctic Embed** (medium size).
- Use quantized versions (via ONNX or sentence-transformers) for edge devices.
- Dimension: 768 or lower (Matryoshka models allow flexible dimensions to save storage).

#### Recommended Vector Databases (Self-Hosted)

- **Chroma** → Best for MVP (simple, local-first, works great with LangChain)
- **LanceDB** → Excellent for edge / embedded use (file-based)
- **Qdrant** → Strong for production self-hosted (Rust, fast, good filtering)
- **pgvector** → If you already use PostgreSQL (simple & efficient)

**For Pockit**: Use **Chroma** or **LanceDB** for the MVP — both are lightweight and perfect for personal memory on a user’s own server.

#### How It Will Work in Pockit

1. Every journal entry, mood rating, voice transcript, or answer gets converted to a vector using the embedding model.
2. The vector + metadata (timestamp, context, user rating) is stored in the vector database.
3. When the agent needs context, it performs a similarity search (“What did I say about my cinematic web kit last week?”) and retrieves the most relevant memories.
4. This powers RAG-style responses in the personal AI Secretary.

This setup keeps everything private, fast on edge hardware, and scalable as the user’s memory grows over months/years.

