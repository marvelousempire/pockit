**Current Status of Pockit** — **Monday, May 18, 2026 19:43:17 EDT**

Here’s a clear **Code Structure Plan** (in plain English):

-----

### Pockit Code Structure Plan

#### Overall Approach

We will follow a **clean, modular backend-first** approach. We’ll define exactly what each folder and major file should do before writing any real code.

### 1. Project Structure (Final)

```
pockit/
├── README.md
├── CurrentStatus.md
├── MVP-SCOPE.md
├── ARCHITECTURE.md
├── docker-compose.yml
├── setup.sh
├── backend/
│   ├── main.py
│   ├── config/
│   ├── models/
│   ├── schemas/
│   ├── database/
│   ├── voice/
│   ├── questions/
│   ├── insights/
│   ├── api/
│   └── core/
├── frontend/
├── docs/
└── scripts/
```

### 2. Backend Breakdown (What Each Folder Does)

- **`backend/voice/`** — Handles everything related to speech
  - `vad.py` — Uses Silero VAD to detect when someone is speaking
  - `transcriber.py` — Calls Whisper.cpp and processes the audio
  - `voice_service.py` — Main service that ties VAD + transcription together
- **`backend/questions/`** — Controls the micro-question system
  - `question_generator.py` — Decides what question to ask the user
  - `scheduler.py` — Decides *when* to ask questions
- **`backend/insights/`** — Generates understanding
  - `pattern_analyzer.py` — Finds patterns in user behavior
  - `insight_generator.py` — Turns data into useful observations
- **`backend/database/`** — Handles storing everything
  - `models.py` — Defines what data we save
  - `repository.py` — Saves and retrieves data
- **`backend/api/`** — The web interface
  - `routes/` — Different endpoints (voice, questions, dashboard, etc.)
  - `dependencies.py` — Shared utilities

### 3. Development Order (What we build first)

1. Setup basic FastAPI project + docker
2. Build the **Voice Pipeline** (Whisper.cpp + Silero VAD)
3. Build the **Input System** (Color wheel + sliders)
4. Build basic storage for user responses
5. Create simple dashboard
6. Add the Micro-Question engine

Would you like me to expand any of these sections (especially the voice pipeline since we spent so much time researching it), or would you like me to create a more detailed breakdown for a specific folder?
