/**
 * Super Rick — voice-first AI agent display names (cassette id stays `voice`).
 *
 * Naming (operator canon — see Nephew/Understandings/PRIVATE VOICE-FIRST AI SYSTEM — COMP.md):
 * Super Rick = best of three Ricks: Ross (boss / sovereign stack), Flair (slick / unstoppable
 * conversation), James (top shelf / premium private TTS). Alias "Rick" in tight UI chrome.
 */
(function (global) {
  global.VoiceAppDisplay = Object.freeze({
    id: "voice",
    name: "Super Rick",
    alias: "Rick",
    symbol: "Ri",
    glyph: "🗣️",
    tagline: "Boss · slick · top shelf — the best private voice stack on your hardware",
    padSubtitle: "Talk to Nephew · sovereign on your hardware",
    suiteBlurb: "Self-governed voice agent — boss authority, slick turns, top-shelf TTS",
    nameOrigin:
      "Super Rick blends three Ricks: Ross the Boss (sovereign, rent-free on your metal), "
      + "Flair the Style (slick, fluid, never stuck), and James the Top Shelf (the best private "
      + "STT/LLM/TTS you can run). Say Super Rick when you mean the full stack at full send.",
    conversationLore:
      "Super Rick is the best of three Ricks — Ross the Boss on your sovereign stack, "
      + "Flair the slick unstoppable conversation, James the top-shelf private voice. "
      + "Boss · slick · top shelf; can't get better on rented cloud.",
  });
})(typeof window !== "undefined" ? window : globalThis);
