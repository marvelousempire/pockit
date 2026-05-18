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


**Current Status of Pockit** — **Monday, May 18, 2026 19:48:21 EDT**

Here’s a **detailed plain-English code plan** for the **Voice Pipeline** (the most important part for the MVP):

-----

### Voice Pipeline – Detailed Code Structure Plan

**Folder:** `backend/voice/`

#### Goal

Create a fast, accurate, fully self-hosted voice system using **Whisper.cpp + Silero VAD** that feels smooth on edge devices.

#### File-by-File Breakdown

**1. `vad.py` (Voice Activity Detection)**

- Loads Silero VAD model
- Takes small chunks of audio from the mobile app
- Returns `True` / `False` → “Is someone speaking right now?”
- Has settings for sensitivity (to avoid false positives from background noise)

**2. `transcriber.py`**

- Main wrapper for Whisper.cpp
- Loads quantized models (default = `base-q5_0` or `small-q4_K_M`)
- Accepts audio file or live stream
- Returns clean text + timestamps + confidence score
- Has fallback options if Whisper.cpp fails

**3. `voice_service.py`** ← The brain of the voice system

```python
class VoiceService:
    async def process_voice_memo(self, audio_bytes):
        # Step 1: Run Silero VAD to remove silence
        speech_segments = await vad.detect_speech(audio_bytes)
        
        # Step 2: Send only real speech to Whisper.cpp
        transcript = await transcriber.transcribe(speech_segments)
        
        # Step 3: Save raw audio + transcript + metadata
        await self.save_recording(audio_bytes, transcript)
        
        return transcript
```

**4. `voice_models.py`**

- Handles downloading quantized Whisper models on first run
- Manages different model sizes (tiny, base, small)
- Allows user to choose accuracy vs speed

**5. `voice_router.py` (in backend/api/routes/)**

- Accepts audio upload from mobile app via WebSocket or HTTP
- Calls `VoiceService`
- Returns transcription in real-time (streaming response)

### How It Will Work End-to-End (User Flow)

1. User taps “Try it with your voice” in the app
2. Mobile app records audio and sends chunks to backend
3. Backend runs Silero VAD → skips silence
4. Whisper.cpp transcribes only the actual speech
5. Transcript is saved + shown back to user instantly
6. Data goes into Long-term Memory Bank

-----

Would you like me to now create the detailed plan for the **Micro-Question Engine**, or expand any other part (like the Insights or Dashboard)?

Just say which one.
