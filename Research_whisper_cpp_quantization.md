# Whisper.cpp Quantization Levels (May 2026)

Whisper.cpp uses **GGML/GGUF-style integer quantization** (same system as llama.cpp). You convert original models using the built-in `quantize` tool.

### Common Quantization Types in Whisper.cpp

|Quant Type       |Bits |Approx. Size Reduction|Quality Impact (WER)|Memory Use|Speed on Edge |Best For Pockit                             |
|-----------------|-----|----------------------|--------------------|----------|--------------|--------------------------------------------|
|**Q8_0**         |8-bit|~50%                  |Negligible          |Medium    |Fast          |High accuracy on Mac Mini / strong VPS      |
|**Q5_0 / Q5_K**  |5-bit|~65–70%               |Very small          |Low       |Very fast     |**Sweet spot for most users**               |
|**Q4_0 / Q4_K_M**|4-bit|~75%                  |Small to moderate   |Very low  |Fastest       |**Recommended default for edge**            |
|**Q3_K**         |3-bit|~80%+                 |Noticeable          |Lowest    |Very fast     |Raspberry Pi 4 / ultra-low power            |
|**Q2_K**         |2-bit|~85%+                 |Higher loss         |Minimal   |Extremely fast|Only for tiniest models on very weak devices|

### Practical Recommendations for Pockit

**For Edge Devices (Raspberry Pi 5, future mobile):**

- **Default**: **Q4_K_M** or **Q5_0** — best balance of size, speed, and accuracy.
- Use **tiny** or **base** models quantized to Q4/Q5 for real-time voice journal.
- **Small** model at Q4 works well on Pi 5 8GB.

**For Mac Mini / Mid-tier VPS:**

- **Q5_K_M** or **Q8_0** on **medium** or **large-v3-turbo** models for excellent accuracy.

**Real-World Observations (from benchmarks):**

- Q4 often has almost no perceptible drop in transcription quality for everyday speech.
- Q5 is virtually lossless for most use cases.
- Going below Q4 (Q3/Q2) starts to introduce more hallucinations or missed words, especially with accents or background noise.

**How to Quantize (Example)**

```bash
# Convert and quantize
./quantize models/ggml-base.en.bin models/ggml-base.en-q5_0.bin q5_0

# Or for K-quant (better quality at same bit level)
./quantize models/ggml-medium.bin models/ggml-medium-q4_K_M.bin q4_K_M
```

**Recommendation for Pockit MVP**:

- Ship with **Q4_K_M** versions of `tiny`, `base`, and `small` as defaults.
- Offer Q5_K_M as an optional higher-quality download.
- Keep Q8_0 for users on stronger hardware who want maximum fidelity.

This keeps Pockit lightweight and fast on edge hardware while maintaining strong transcription quality.
