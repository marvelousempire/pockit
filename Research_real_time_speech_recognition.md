**Real-time Speech Recognition (2026 Overview)**

Real-time (streaming) speech-to-text is more challenging than batch transcription because it needs **low latency** (ideally <500ms), continuous processing of live audio, and handling of partial results while the person is still speaking.

### Top Options for Pockit (Self-Hosted Focus)

|Option                        |Type             |Latency / Speed                             |Accuracy                 |Languages         |Hardware Needs        |Best For Pockit                    |Recommendation        |
|------------------------------|-----------------|--------------------------------------------|-------------------------|------------------|----------------------|-----------------------------------|----------------------|
|**NVIDIA Parakeet TDT**       |Open-source      |Extremely fast (RTFx >2000)                 |Very good (English-first)|English + variants|Low–Medium GPU        |Live voice journal, micro-questions|**Top pick for speed**|
|**Whisper Large-v3 Turbo**    |Open-source      |Good (~200-400ms with streaming)            |Excellent                |99+               |Medium–High GPU/CPU   |High-accuracy voice memos          |Strong all-rounder    |
|**Faster-Whisper + Streaming**|Optimized Whisper|Good (with whisper_streaming or WhisperLive)|Excellent                |99+               |Low–High              |Journal entries, hybrid input      |Easiest to integrate  |
|**Moonshine**                 |Open-source      |Very low latency                            |Good                     |Multiple          |Edge / Mobile friendly|On-device or lightweight VPS       |Great for mobile      |
|**RealtimeSTT**               |Library          |Low latency                                 |Depends on backend       |Multiple          |Low                   |Quick prototyping                  |Useful wrapper        |

### Key Takeaways for Pockit

- **For true real-time conversations or live voice agent mode**: NVIDIA **Parakeet TDT** or **Moonshine** are currently the strongest open-source options for low latency.
- **For highest accuracy + multilingual**: Stick with **Whisper Large-v3 Turbo** + streaming wrappers (WhisperLive or whisper_streaming).
- **Easiest path for MVP**: Use **Faster-Whisper** with a streaming library. It gives excellent quality while staying fully self-hosted and private.

### Practical Integration Ideas for Pockit

- Voice Journal Agent → Can start in near real-time (partial transcripts appear as you speak).
- Voice Memo button → Record short clips with live preview of transcription.
- Future voice-first agent → Use streaming STT so the AI can respond more naturally.

**WhisperLive** is one of the most popular and mature **nearly real-time streaming implementations** of OpenAI’s Whisper.

### Quick Summary (as of May 2026)

- **Repo**: [collabora/WhisperLive](https://github.com/collabora/WhisperLive)
- **Type**: Server + client setup for **low-latency, continuous transcription**.
- **Backend**: Uses **Faster-Whisper** (highly optimized) by default. Also supports TensorRT and OpenVINO for even faster performance.
- **Latency**: “Nearly live” — typically **300–800ms** depending on model size and hardware. Not true sub-200ms real-time, but very usable for voice journaling and interactive agents.

### How WhisperLive Works

1. Runs a **WebSocket server** that accepts live audio chunks.
2. Processes audio in small overlapping segments.
3. Returns partial + finalized transcripts in real time.
4. Supports microphone input, pre-recorded files, and browser extensions.

### Pros for Pockit

- Excellent balance of **accuracy + speed**.
- Easy to integrate with FastAPI/LangChain backend.
- Supports multiple clients and custom models.
- Fully self-hosted and privacy-friendly.
- Has browser extensions (Chrome/Firefox) for quick testing.

### Cons / Limitations

- Not true zero-latency (still has some delay).
- Larger models (large-v3) need decent GPU/CPU resources.
- Requires a running server (fits your self-hosted model perfectly).

### Recommended Setup for Pockit MVP

```bash
# 1. Install
pip install whisper-live

# 2. Run server (example with faster-whisper backend)
python run_server.py \
  --port 9090 \
  --backend faster_whisper \
  --model large-v3-turbo \
  --max_clients 10
```

You can then connect your mobile app (React Native/Flutter) via WebSocket to send live microphone audio and receive streaming transcripts.

### Alternatives Worth Considering

- **ufal/whisper_streaming** (or its successor SimulStreaming) — More research-oriented, adaptive latency.
- **whisper.cpp streaming** — Extremely lightweight, great for edge devices (Raspberry Pi/Mac Mini).
- **Faster-Whisper + custom streaming** — If you want full control.

**Recommendation for Pockit**:  
Start with **WhisperLive + Faster-Whisper (large-v3-turbo)** for the MVP. It’s the most plug-and-play solution that gives good real-time performance while staying fully self-hosted.

**NVIDIA Parakeet TDT** (specifically the **0.6B v2 / v3** models) is currently one of the strongest open-source ASR (Automatic Speech Recognition) models available in 2026, especially when **speed and throughput** matter.

### Key Details (May 2026)

- **Model Sizes**: Main version is **0.6B (600 million)** parameters. There are also 1.1B variants.
- **Architecture**: FastConformer-TDT (Token-and-Duration Transducer) — a hybrid that combines convolutional and transformer strengths, optimized for both accuracy and blazing-fast inference.
- **Languages**:
  - **v2**: Excellent English (en-US focused).
  - **v3** (released ~Aug 2025): Multilingual — supports 25+ European languages with automatic language detection. No extra prompting needed.
- **Performance Highlights**:
  - Extremely high **Real-Time Factor (RTFx)** — often **2,000x–3,800x** faster than real-time on GPU (e.g., transcribes 1 hour of audio in ~1 second in batch mode).
  - Very competitive **Word Error Rate (WER)** — frequently beats or matches Whisper large-v3 on English while being dramatically faster.
  - Built-in support for **punctuation, capitalization, word-level timestamps**, and even song lyrics transcription.
  - Low hallucination rate compared to older models.

### Comparison with Whisper (for Pockit context)

|Aspect             |Parakeet TDT 0.6B v3        |Whisper large-v3 / Turbo|Winner for Pockit               |
|-------------------|----------------------------|------------------------|--------------------------------|
|Speed / Throughput |Extremely fast (2000x+ RTFx)|Good but much slower    |**Parakeet** (clear winner)     |
|Accuracy (English) |Excellent                   |Excellent               |Very close / Parakeet often wins|
|Multilingual       |25+ European languages      |99+ languages           |Whisper                         |
|Real-time Streaming|Good with proper wrappers   |Good with WhisperLive   |Tie (both workable)             |
|Resource Use       |Lower (600M params)         |Higher (1.55B params)   |**Parakeet**                    |
|Self-Hosted Privacy|Excellent                   |Excellent               |Tie                             |

### Best Use Cases for Pockit

- **Voice Journal Agent** → Extremely fast transcription of daily voice entries.
- **Micro-Question responses** via voice.
- **High-throughput batch processing** of longer recordings.
- **Real-time / near real-time** voice interaction (with streaming wrappers).

### Integration Options

- Hugging Face (`nvidia/parakeet-tdt-0.6b-v3`)
- NVIDIA NeMo toolkit
- ONNX Runtime (good for CPU-only or cross-platform)
- MLX (excellent on Apple Silicon)
- FastAPI wrappers already exist in the community

**Recommendation for Pockit**:  
**Parakeet TDT 0.6B v3** is an outstanding choice for the core Voice Journal and Voice Memo features — especially because of its speed and efficiency on self-hosted hardware. Use it as the **primary engine** for English/European users, and keep Whisper as a fallback for broader language support or specific edge cases.

**Parakeet TDT vs Moonshine (2026 Comparison)**

Here’s a clear, up-to-date head-to-head for **Pockit** use cases (self-hosted, privacy-first, voice journal + real-time agent features).

|Category                         |**NVIDIA Parakeet TDT** (0.6B / 1.1B v3)   |**Moonshine** (Base / Medium / Streaming)                         |Winner for Pockit              |
|---------------------------------|-------------------------------------------|------------------------------------------------------------------|-------------------------------|
|**Model Size**                   |600M – 1.1B parameters                     |27M – 331M (Medium Streaming ~245M)                               |**Moonshine** (much lighter)   |
|**Accuracy (WER)**               |Excellent (~6.0–6.3% on English benchmarks)|Very good (~6.65% for Medium Streaming)                           |**Parakeet** (slight edge)     |
|**Speed / Throughput**           |Extremely fast (RTFx often >2,000–3,000x)  |Fast, but lower throughput                                        |**Parakeet** (clear winner)    |
|**Real-time Streaming / Latency**|Good with wrappers (~300–800ms)            |Excellent (designed for it: ~107–802ms)                           |**Moonshine** (better for live)|
|**On-Device / Edge**             |Good on GPU/CPU, but heavier               |Outstanding (runs well on Raspberry Pi, phones, low-power devices)|**Moonshine**                  |
|**Languages**                    |Strong English + ~25 European (v3)         |Primarily English (expanding)                                     |**Parakeet**                   |
|**Resource Efficiency**          |Higher memory/CPU use                      |Very efficient, lower power                                       |**Moonshine**                  |
|**Self-Hosted Privacy**          |Excellent                                  |Excellent                                                         |Tie                            |
|**Streaming Maturity**           |Good                                       |Purpose-built for live voice agents                               |**Moonshine**                  |

### Summary for Pockit

- **Choose Parakeet TDT** if you prioritize:
  - Highest raw accuracy on English
  - Batch processing (long journal entries)
  - High throughput on a VPS or Mac Mini with decent GPU/CPU
- **Choose Moonshine** if you prioritize:
  - True low-latency **live voice interaction** (real-time journal agent that responds while speaking)
  - Running on lighter hardware (Raspberry Pi touchscreen device, mobile, or low-cost VPS)
  - Better battery/power efficiency
  - On-device feel

**Best Hybrid Approach for Pockit** (Recommended):

- Use **Moonshine Streaming** as the **default** for Voice Journal Agent and real-time voice memos (low latency, lightweight).
- Fall back to **Parakeet TDT** for higher-accuracy batch transcription of longer recordings or when the user is on stronger hardware.

This gives you the best of both worlds: snappy real-time experience + top-tier accuracy when needed.


**Parakeet TDT vs Moonshine (2026 Comparison)**

Here’s a clear, up-to-date head-to-head for **Pockit** use cases (self-hosted, privacy-first, voice journal + real-time agent features).

|Category                         |**NVIDIA Parakeet TDT** (0.6B / 1.1B v3)   |**Moonshine** (Base / Medium / Streaming)                         |Winner for Pockit              |
|---------------------------------|-------------------------------------------|------------------------------------------------------------------|-------------------------------|
|**Model Size**                   |600M – 1.1B parameters                     |27M – 331M (Medium Streaming ~245M)                               |**Moonshine** (much lighter)   |
|**Accuracy (WER)**               |Excellent (~6.0–6.3% on English benchmarks)|Very good (~6.65% for Medium Streaming)                           |**Parakeet** (slight edge)     |
|**Speed / Throughput**           |Extremely fast (RTFx often >2,000–3,000x)  |Fast, but lower throughput                                        |**Parakeet** (clear winner)    |
|**Real-time Streaming / Latency**|Good with wrappers (~300–800ms)            |Excellent (designed for it: ~107–802ms)                           |**Moonshine** (better for live)|
|**On-Device / Edge**             |Good on GPU/CPU, but heavier               |Outstanding (runs well on Raspberry Pi, phones, low-power devices)|**Moonshine**                  |
|**Languages**                    |Strong English + ~25 European (v3)         |Primarily English (expanding)                                     |**Parakeet**                   |
|**Resource Efficiency**          |Higher memory/CPU use                      |Very efficient, lower power                                       |**Moonshine**                  |
|**Self-Hosted Privacy**          |Excellent                                  |Excellent                                                         |Tie                            |
|**Streaming Maturity**           |Good                                       |Purpose-built for live voice agents                               |**Moonshine**                  |

### Summary for Pockit

- **Choose Parakeet TDT** if you prioritize:
  - Highest raw accuracy on English
  - Batch processing (long journal entries)
  - High throughput on a VPS or Mac Mini with decent GPU/CPU
- **Choose Moonshine** if you prioritize:
  - True low-latency **live voice interaction** (real-time journal agent that responds while speaking)
  - Running on lighter hardware (Raspberry Pi touchscreen device, mobile, or low-cost VPS)
  - Better battery/power efficiency
  - On-device feel

**Best Hybrid Approach for Pockit** (Recommended):

- Use **Moonshine Streaming** as the **default** for Voice Journal Agent and real-time voice memos (low latency, lightweight).
- Fall back to **Parakeet TDT** for higher-accuracy batch transcription of longer recordings or when the user is on stronger hardware.

This gives you the best of both worlds: snappy real-time experience + top-tier accuracy when needed.
