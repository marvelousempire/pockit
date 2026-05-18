**Current Status of Pockit** — **Monday, May 18, 2026 19:34:58 EDT**
-----

# Product Requirements Document (PRD)

**Product Name:** Pockit  
**Version:** 1.0 MVP  
**Date:** Monday, May 18, 2026

### 1. Product Overview

**Pockit** is a personal truth engine that builds a deeply accurate AI agent by quietly learning who you *really* are — not who you say you are — through gentle, contextual daily interactions.

**Core Promise:**  
The more honest data you give Pockit, the more useful and truthful your personal AI becomes.

### 2. Core Philosophy

- Privacy-first and self-hosted by design
- Respect the user’s time and attention
- Prioritize truth over flattery
- Data never leaves the user’s control
- Build trust before asking deeper questions

### 3. MVP Features

**Core Input Methods**

- Color Wheel Mood Input (continuous spectrum)
- 0.0–1.0 Precision Rating Scale
- Intelligent Micro-Question Engine (short, contextual questions)
- Voice Memo Input (“Try it with your voice”)
- Voice Journal Agent (natural voice conversations)

**Voice Processing Pipeline**

- Primary: **Whisper.cpp** + **Silero VAD**
- Optimized for edge devices (Raspberry Pi, Mac Mini, low-power VPS)
- Quantized models for efficiency
- Near real-time transcription

**Intelligence Layer**

- Basic Long-term Memory Bank
- Simple Pattern Recognition & Insights
- Light Consistency & Validation Engine

**User Interface**

- Clean, delightful, minimal mobile interface
- Daily dashboard with mood trends and insights
- Simple “What Pockit Knows About You” view

### 4. Non-Functional Requirements

- **Self-hosted first** — runs on user’s own infrastructure
- Requires HTTPS to function
- Must perform well on edge hardware (Raspberry Pi 5, Mac Mini)
- All personal data stays on user’s server
- Full data export and deletion capabilities

### 5. Out of Scope for MVP

- Full RAG / Vector search system
- Advanced LangChain agent orchestration
- Sub-agents (trainer, chef, designer, etc.)
- Business & team features
- Managed hosting
- Hardware leasing program

### 6. Success Criteria

- User completes onboarding in under 3 minutes
- User receives at least 3 meaningful insights within first 10 days
- Daily active usage > 60% of onboarded users
- Strong performance on edge devices

### 7. Future Roadmap (Post-MVP)

- Full vector embeddings + RAG
- Multiple specialized sub-agents
- Managed hosting option
- Hardware solutions (Mac Mini, Raspberry Pi touchscreen)
- Subscription tiers (6-month and annual)
- Business/enterprise features

-----

Would you like me to also create the **ARCHITECTURE.md** document next, or update the main README.md to match this PRD?
