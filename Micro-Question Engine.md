**Current Status of Pockit** — **Monday, May 18, 2026 19:51:03 EDT**

-----

### Micro-Question Engine – Detailed Code Structure Plan

**Folder:** `backend/questions/`

#### Goal

Create a smart, gentle, non-annoying system that asks short, contextual questions throughout the day to collect truthful data without feeling like an interrogation.

#### File-by-File Breakdown

**1. `generator.py`**

- Contains logic to create good questions
- Has different categories:
  - Mood / Energy questions
  - Behavior / Habit questions (“How many times in the last 2 hours did you…”)
  - Value / Priority questions
  - Consistency check questions (re-asking previous 1.0 ratings later)
- Uses user’s past data to make questions relevant

**2. `scheduler.py`**

- Decides **when** to ask questions
- Uses smart rules:
  - Not too many in one hour
  - Avoids asking during low mood times (if known)
  - Uses time windows (“In the last 30 minutes…”, “In the last 2 hours…”)
  - Respects user snooze / frequency preferences
  - Learns the user’s best times over time

**3. `repository.py`**

- Saves all user answers
- Tracks when a question was asked and how the user responded
- Stores the 0.0–1.0 ratings and voice transcripts

**4. `service.py`** ← Main brain of the engine

```python
class QuestionService:
    async def get_next_question(self, user_id):
        # Check user availability and mood
        # Generate relevant question
        # Return question + possible quick answers (0.0-1.0 or multiple choice)
        
    async def process_answer(self, user_id, question_id, answer):
        # Save the answer
        # Trigger any immediate insights if needed
        # Update user patterns
```

**5. `router.py` (in `backend/api/routes/`)**

- Endpoint: `GET /questions/next` → returns next question
- Endpoint: `POST /questions/answer` → submits user response
- WebSocket support for push notifications (optional for MVP)

### How the Micro-Question Engine Works (User Flow)

1. User opens the app or gets a gentle notification
2. App asks backend: “What’s the next good question?”
3. Backend returns something like:
- “In the last 2 hours, how many times did you work on your cinematic web kit?” (0 / 1 / 2-3 / 4+)
- Or “On a scale of 0.0 to 1.0, how much did you actually enjoy that meeting?”
4. User answers with taps or voice
5. Answer is saved → patterns are updated → future questions get smarter

### Key Design Rules

- Maximum 4–8 questions per day (adjustable)
- Questions feel helpful, not nosy
- Always easy to skip or snooze
- Prioritizes quality over quantity

-----
**Current Status of Pockit** — **Monday, May 18, 2026 19:54:12 EDT**

Here is the **complete detailed code structure plan** for all major remaining components:

-----

### 1. Insights Engine (`backend/insights/`)

**Files:**

- `pattern_analyzer.py` — Finds recurring patterns (mood drops, productivity blocks, contradictions)
- `insight_generator.py` — Turns patterns into readable, honest insights
- `consistency_checker.py` — Quietly tracks 1.0 ratings and re-asks later
- `service.py` — Main orchestrator

**Example Flow:**

- Detects “You rated your coding session 1.0 but only spent 12 minutes on it”
- Generates gentle insight: “You said you love working on the cinematic kit, but your actual time spent tells a different story.”

-----

### 2. Dashboard (`backend/dashboard/`)

**Files:**

- `service.py` — Pulls together all data for the home screen
- `summary_generator.py` — Creates daily/weekly summaries
- `visualization_helper.py` — Prepares data for charts (mood trends, etc.)

**What the Dashboard Shows:**

- Today’s mood summary (color wheel average)
- Key insights (3–5 most important)
- “What Pockit Knows About You” highlights
- Quick actions (e.g., “Answer 2 pending questions”)

-----

### 3. Database Layer (`backend/database/`)

**Files:**

- `models.py` — All data models (MoodEntry, JournalEntry, QuestionAnswer, Rating, etc.)
- `repository.py` — Clean CRUD interface
- `vector_store.py` — Simple vector embeddings storage (Chroma or LanceDB for MVP)
- `session.py` — Database connection management

**Storage Strategy:**

- PostgreSQL for structured data
- Vector store for semantic memory (future RAG)
- Raw voice recordings stored locally with metadata

-----

### 4. Core & Config (`backend/core/`)

**Files:**

- `config.py` — Settings, model paths, ports, etc.
- `security.py` — HTTPS enforcement, basic auth
- `dependencies.py` — Shared utilities used across the app
- `exceptions.py` — Custom error handling

-----

### 5. API Layer (`backend/api/`)

**Main Routes:**

- `/voice/` → Voice memos and journal
- `/questions/` → Get next question + submit answer
- `/ratings/` → Color wheel and 0.0–1.0 submissions
- `/dashboard/` → Main dashboard data
- `/insights/` → Get latest insights
- `/health/` → System health check

-----

### Full Development Priority Order (Recommended)

1. Project setup + Docker + FastAPI skeleton
2. **Voice Pipeline** (Whisper.cpp + Silero VAD)
3. Input System (Color Wheel + 0.0–1.0 ratings)
4. Database Layer
5. Micro-Question Engine
6. Basic Dashboard + Insights
7. Polish & Testing

-----

This gives you a complete English-language blueprint of how the entire codebase should be organized before we start writing actual code.

