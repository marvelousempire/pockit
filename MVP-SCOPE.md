**MVP-SCOPE.md**

# Pockit MVP Scope

**Product Name:** Pockit (P O C K I T)  
**Tagline:** Your Back Pocket AI Secretary

### Vision

Pockit is a personal truth engine that quietly builds a deeply accurate AI agent by learning who you *really* are through gentle daily interactions. Privacy-first and self-hosted by design.

### MVP Goal

Deliver a **minimum lovable product** in 4–6 weeks that proves the core loop:  
**Simple input → Honest data collection → Early insights**

Users should feel “this already knows me better than I expected” within the first 7–10 days.

### MVP Features (Must Have)

**1. Core Experience**

- Color Wheel Mood Input (large continuous spectrum)
- 0.0–1.0 Precision Rating Scale (1.0 = Unwavering Yes)
- Intelligent Micro-Question Engine (short, time-boxed questions)
- Voice Memo Input (“Try it with your voice” button)
- Voice Journal Agent (record → transcribe → save entry)

**2. Voice Processing (Edge-First)**

- **Primary Engine**: **Whisper.cpp** (latest version)
  - Optimized for edge devices (Raspberry Pi 5, Mac Mini, low-power VPS, future mobile on-device)
  - Quantized models (Q4/Q5) for minimal memory and fast inference
  - Streaming support via whisper.cpp `stream` for near real-time transcription
- **Voice Activity Detection (VAD)**: **Silero VAD v6.2+**
  - Integrated directly with Whisper.cpp
  - Skips silence automatically → only processes actual speech
  - Extremely lightweight (~1.6 MB) and fast (<1ms per chunk)
  - Greatly improves efficiency and battery life on edge hardware
- Fallback to Faster-Whisper / WhisperLive only on stronger hardware when maximum accuracy is required

**3. Supporting Intelligence**

- Basic Long-term Memory Bank (structured storage)
- Simple Pattern Recognition (early insights)
- Light Consistency Engine (flags obvious contradictions)

**4. Dashboard**

- Daily summary view
- Mood trends (last 7–30 days)
- Top insights / contradictions
- Simple profile of “What Pockit knows about you so far”

### Out of Scope for MVP

- Full LangChain multi-agent orchestration
- Advanced RAG / Vector search
- Ownership Fracturing & Node Mapping
- Sub-agents
- Business/team features
- Full health trackers
- Managed hosting & hardware leasing

### Technical Requirements (MVP)

**Backend (Edge Optimized)**

- FastAPI
- **Whisper.cpp** + **Silero VAD** as the default speech pipeline
- SQLite / PostgreSQL
- Simple vector store (Chroma or LanceDB)
- Docker + docker-compose for easy self-hosting

**Frontend**

- React Native (iOS + Android) or Flutter
- Clean, delightful, minimal UI

**Deployment**

- One-command setup script (`setup.sh`)
- Pre-configured Docker images optimized for Whisper.cpp + Silero VAD on CPU / Apple Silicon / low-end GPU
- Easy to run on Raspberry Pi 5, Mac Mini, or basic VPS

### Success Metrics for MVP

- Onboarding completed in < 3 minutes
- At least 3 meaningful insights delivered within first 10 days
- Daily active usage > 60%
- Strong performance on edge hardware (Raspberry Pi 5 or Mac Mini)

### Next Priorities After MVP (v0.2)

1. Full Vector Embeddings + RAG
2. Advanced Whisper.cpp streaming + tone analysis
3. Self-hosted deployment guides + one-click scripts
4. Managed hosting option
5. Business features

-----
