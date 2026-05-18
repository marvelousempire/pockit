# Pockit MVP Scope

**Product Name:** Pockit (P O C K I T)  
**Tagline:** Your Back Pocket AI Secretary

### Vision

Pockit is a personal truth engine that quietly builds a deeply accurate AI agent by learning who you *really* are through gentle daily interactions.

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
- Basic Voice Journal Agent (record → transcribe → save entry)

**2. Supporting Intelligence**

- Basic Long-term Memory Bank (structured storage)
- Simple Pattern Recognition (early insights like “You rate high energy in mornings but mood drops at 3pm”)
- Consistency Engine (light version – flags obvious contradictions)

**3. Dashboard**

- Daily summary view
- Mood trends (last 7–30 days)
- Top insights / contradictions
- Simple profile of “What Pockit knows about you so far”

### Out of Scope for MVP (Will come later)

- Full LangChain multi-agent orchestration
- Advanced RAG / Vector search
- Ownership Fracturing & Node Mapping
- Sub-agents (chef, trainer, etc.)
- Self-hosted / Managed hosting setup
- Business / team features
- Health trackers (menstrual cycle, etc.)
- Voice tone & energy analysis

### Technical Requirements (MVP)

**Backend:**

- FastAPI
- LangChain (basic usage)
- SQLite or PostgreSQL
- Simple vector store (Chroma or LanceDB for MVP)
- Whisper for transcription

**Frontend:**

- React Native (iOS + Android) or Flutter
- Clean, minimal, delightful UI

**Deployment (MVP):**

- Docker + docker-compose for easy local/self-hosted testing
- Clear `.env.example`
- One-command setup script

### Success Metrics for MVP

- User can complete onboarding in < 3 minutes
- User receives at least 3 meaningful insights within first 10 days
- Daily active usage > 60% of users who complete onboarding
- Positive feedback on “this feels different / honest”

### Next Priorities After MVP (v0.2)

1. Full Vector + RAG system
2. Self-hosted deployment scripts
3. Managed hosting option
4. Business features (ownership fracturing, node mapping)

-----

This document is ready to hand off to another AI or developer.

Would you like me to also create the **ARCHITECTURE.md** document right now, or do you want to start with this one first?
