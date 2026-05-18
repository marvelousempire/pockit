**Current Status of Pockit** — **Monday, May 18, 2026 19:40:28 EDT**
-----
# Pockit Architecture

## Overview

Pockit is a **self-hosted**, privacy-first personal truth engine. The system is designed to run entirely on the user’s infrastructure while providing a delightful mobile experience.

## High-Level Architecture

### Core Components

**1. Mobile Client**

- React Native or Flutter mobile app
- Color Wheel, 0.0–1.0 sliders, voice recording interface
- Communicates with user’s self-hosted backend via HTTPS

**2. Backend Service**

- **FastAPI** (Python)
- REST + WebSocket endpoints
- Orchestrates all core services

**3. Voice Processing Pipeline**

- **Silero VAD** — Voice Activity Detection (filters silence)
- **Whisper.cpp** — Primary speech-to-text engine (quantized models)
- Runs locally on user’s server for maximum privacy and performance

**4. Memory & Intelligence Layer**

- Structured data store (PostgreSQL)
- Vector database (ChromaDB or LanceDB)
- Basic pattern recognition and insight engine
- Consistency & validation system

**5. Question Engine**

- Context-aware micro-question scheduler
- Time-window based delivery system
- Adaptive based on user availability

**6. Dashboard & Insights**

- Daily summary and trends
- Pattern visualization
- “What Pockit Knows About You” view

## Data Flow

1. User inputs data via mobile app (color wheel, slider, voice)
2. Voice is processed locally using Whisper.cpp + Silero VAD
3. Data is stored in local structured + vector database
4. Analysis engine runs periodically to extract insights
5. Insights are served back to the mobile client

## Self-Hosting Design

- Entire stack runs in Docker containers
- All user memory stays on their own server
- Requires valid HTTPS certificate to function
- Designed to run efficiently on:
  - Raspberry Pi 5
  - Mac Mini
  - Mid-tier VPS

## Technology Stack

- **Backend**: FastAPI + Python
- **Speech**: Whisper.cpp + Silero VAD
- **Database**: PostgreSQL + Vector store
- **Frontend**: React Native or Flutter
- **Containerization**: Docker + docker-compose
- **Deployment**: One-command `setup.sh` script

## Security Considerations

- All traffic requires HTTPS
- No user data is sent to external servers
- Local-only authentication model
- Secure configuration defaults

-----

Would you like me to make any changes to this architecture document?
