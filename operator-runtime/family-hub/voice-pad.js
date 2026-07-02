/**
 * Parakeet Voice Pad — sovereign STT → Nephew chat → Kokoro TTS (Plan 0102 + 0085).
 * Loaded before pockit.js; pockit delegates renderVoicePad / bindVoiceActions here.
 */
(function (global) {
  const STORAGE_KEY = "nephew-voice-pad-v2";
  const SESSION_KEY = "pockit-voice-session-id";
  const RETRIEVE_CACHE_TTL_MS = 60_000;
  const RETRIEVE_TIMEOUT_MS = 4_000;
  const SMART_RAG_PREFETCH_MS = 3_500;
  /** Hybrid: never block the stream longer than this waiting on corpus prefetch. */
  const SMART_RAG_PREFETCH_BLOCK_MS = 800;
  const retrieveCache = new Map();

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function savePrefs(partial) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPrefs(), ...partial })); }
    catch { /* ignore */ }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function voiceBrand() {
    return window.VoiceAppDisplay || {
      name: "Super Rick",
      alias: "Rick",
      padSubtitle: "Talk to Nephew · sovereign on your hardware",
      conversationLore:
        "Super Rick is the best of three Ricks — Ross the Boss on your sovereign stack, "
        + "Flair the slick unstoppable conversation, James the top-shelf private voice. "
        + "Boss · slick · top shelf; can't get better on rented cloud.",
    };
  }

  function voiceLogEmptyHtml() {
    const V = voiceBrand();
    const lore = esc(V.conversationLore || V.nameOrigin || "");
    return `
        <div id="voice-log-empty" class="voice-log-empty">
          <p class="voice-log-empty__title">Your conversation lives here</p>
          <p class="voice-log-empty__lore"><span class="voice-log-empty__bulb" aria-hidden="true">💡</span>${lore}</p>
          <p class="voice-log-empty__hint">Tap <strong>Talk</strong> or type below — what you say and what Nephew answers back will stack in this window. The waveform under it lights up while you speak.</p>
        </div>`;
  }

  function defaultPresenceUrl() {
    return "http://voice.localhost/";
  }

  function isPublicPresenceDoor(url) {
    try {
      const u = new URL(url, window.location.href);
      const stem = u.hostname.replace(/\.localhost$/i, "");
      return stem === "voice";
    } catch {
      return false;
    }
  }

  /** Keep voice door URL as-is — public door embeds without Pockit SSO (Plan 0429 / v1.90.63). */
  function resolvePresenceDoorUrl(rawUrl) {
    const base = String(rawUrl || defaultPresenceUrl()).trim();
    try {
      return new URL(base, window.location.href).toString();
    } catch {
      return base;
    }
  }

  function render() {
    const V = voiceBrand();
    const prefs = loadPrefs();
    const uiSurface = prefs.uiSurface || "orb";
    const orbMode = uiSurface !== "console";
    return `
    <div id="voice-pad" class="voice-pad voice-pad-center cotton-ball-settle${orbMode ? " voice-pad--orb" : " voice-pad--console"}">
      <div class="voice-presence-layer" id="voice-presence-layer"${orbMode ? "" : " hidden"}>
        <iframe
          id="voice-presence-frame"
          class="voice-presence-frame"
          title="${esc(V.name)} — The Presence"
          allow="microphone"
          loading="lazy"
        ></iframe>
        <div class="voice-presence-vignette" aria-hidden="true"></div>
        <div class="voice-presence-sso-hint" id="voice-presence-sso-hint" hidden>
          <p class="voice-presence-sso-hint__title">Sign in to load The Presence</p>
          <p class="voice-presence-sso-hint__body">Family SSO runs on Pockit — not inside the orb iframe.</p>
          <a class="voice-presence-sso-hint__link" id="voice-presence-sso-link" href="/signin" target="_top" rel="noopener">Sign in to Pockit</a>
        </div>
        <a class="voice-presence-door-link" id="voice-presence-door-link" href="http://voice.localhost/" target="_blank" rel="noopener">Open full door</a>
        <button
          type="button"
          class="voice-presence-settings-btn"
          id="voice-presence-settings-btn"
          data-action="cassette-settings"
          data-substrate-id="voice"
          aria-label="Voice settings"
          data-comet-tip="Voice settings&#10;Route · RAG · speakers · Presence options"
        >⚙</button>
      </div>

      <div class="voice-console-layer" id="voice-console-layer">
      <header class="voice-hero${orbMode ? " voice-hero--orb" : ""}">
        <h2 class="voice-title">${esc(V.name)}</h2>
        <p class="voice-subtitle">${esc(V.padSubtitle)} · <a href="#/c/knowledge">Knowledge</a></p>
        <span class="voice-sovereign-badge">Holler + Kokoro · open-source premium · M5 edge + DGX</span>
      </header>

      <p class="voice-roster-hint voice-console-only">28+ human voices — US &amp; UK accents, male &amp; female. Holler on M5 for Grok-class speed; Kokoro on DGX when you want the full roster. Pick one, hit Preview, then Talk.</p>

      <div id="voice-log" class="voice-log voice-console-only" aria-live="polite">
        ${voiceLogEmptyHtml()}
      </div>

      <div class="voice-stage${orbMode ? " voice-stage--orb" : ""}">
        <canvas id="voice-visualizer" class="voice-console-only" width="640" height="56" aria-hidden="true"></canvas>
        <button type="button" id="voice-mic" class="voice-talk-btn voice-btn--primary" aria-label="Talk to Nephew" data-comet-tip="Talk to Nephew&#10;Hold to speak — releases send to voice chat">Talk</button>
        <div class="voice-stage-actions">
          <button type="button" id="voice-stop" class="voice-btn" disabled data-comet-tip="Stop&#10;Cancel playback or recording">Stop</button>
          <button type="button" id="voice-respeak" class="voice-btn voice-console-only" disabled data-comet-tip="Replay&#10;Hear Nephew's last reply again">Replay</button>
          <button type="button" id="voice-clear" class="voice-btn voice-console-only" data-comet-tip="Clear&#10;Empty the conversation log">Clear</button>
          <button type="button" id="voice-send-video" class="voice-btn voice-console-only" data-comet-tip="Send to Video&#10;Hand off transcript to Super Rick Video">Send to Video</button>
        </div>
      </div>

      <div class="voice-input-row voice-console-only">
        <textarea id="voice-transcript" class="voice-input" placeholder="Or type here…" rows="2"></textarea>
        <button type="button" id="voice-speak" class="voice-send-btn">Send</button>
      </div>

      <details class="voice-options voice-console-only">
        <summary>Voice options</summary>
        <div class="voice-options-body">
          <div class="voice-route-row" role="group" aria-label="Voice route">
            <span class="voice-route-label">Route</span>
            <button type="button" class="voice-btn voice-route-btn is-active" data-voice-route="auto" data-comet-tip="Auto route&#10;Prefer M5 edge — fall back to DGX if needed">Auto</button>
            <button type="button" class="voice-btn voice-route-btn" data-voice-route="m5" data-comet-tip="M5 edge&#10;Local STT + Holler TTS on this Mac">M5 edge</button>
            <button type="button" class="voice-btn voice-route-btn" data-voice-route="dgx" data-comet-tip="DGX route&#10;Premium models + deep RAG on Spark">DGX</button>
          </div>
          <div class="voice-picker-row">
            <label class="voice-route-label" for="voice-picker">Voice</label>
            <select id="voice-picker" class="voice-picker" aria-label="TTS voice">
              <option value="default">Default voice (loading…)</option>
            </select>
            <button type="button" id="voice-preview" class="voice-btn voice-preview-btn" data-comet-tip="Preview voice&#10;Hear a short sample of the selected TTS voice">Preview</button>
            <span id="voice-engine-badge" class="voice-engine-badge">Holler</span>
          </div>
          <div class="voice-style-row" role="group" aria-label="Delivery style">
            <span class="voice-route-label">Style</span>
            <button type="button" class="voice-btn voice-style-btn" data-voice-style="warm" data-comet-tip="Warm host&#10;Friendly, personable delivery (Nephew)">Warm</button>
            <button type="button" class="voice-btn voice-style-btn" data-voice-style="neutral" data-comet-tip="Neutral&#10;Clear, even default delivery (Jarvis)">Neutral</button>
            <button type="button" class="voice-btn voice-style-btn" data-voice-style="narrator" data-comet-tip="Narrator&#10;Deep, measured board voice (Board)">Narrator</button>
          </div>
          <div class="voice-mode-row" role="group" aria-label="Voice mode">
            <span class="voice-route-label">Mode</span>
            <button type="button" class="voice-btn voice-mode-btn is-active" data-voice-mode="chat">Chat</button>
            <button type="button" class="voice-btn voice-mode-btn" data-voice-mode="read">Read aloud</button>
            <button type="button" class="voice-btn voice-mode-btn" id="voice-prime-toggle" data-voice-prime="false" data-comet-tip="Prime mode&#10;Deep RAG + largest models on DGX">Prime</button>
            <button type="button" class="voice-btn voice-mode-btn is-active" id="voice-stt-confirm-toggle" data-voice-stt-confirm="true" data-comet-tip="Review STT&#10;Show transcription for edit before send — prevents misheard words going on record">Review STT</button>
          </div>
          <div class="voice-mode-row" role="group" aria-label="RAG lane">
            <span class="voice-route-label">RAG</span>
            <button type="button" class="voice-btn voice-rag-btn" data-voice-rag="hybrid" data-comet-tip="Smart RAG&#10;Prefetch family corpus · fast stream — ChatGPT-like with your knowledge">Smart</button>
            <button type="button" class="voice-btn voice-rag-btn is-active" data-voice-rag="fast" data-comet-tip="Fast RAG&#10;Skip corpus retrieve for lowest latency">Fast</button>
            <button type="button" class="voice-btn voice-rag-btn" data-voice-rag="grounded" data-comet-tip="Deep RAG&#10;Full server retrieve every turn — thorough, slower">Deep</button>
          </div>
          <details id="voice-sources" class="voice-sources hidden">
            <summary>Sources</summary>
            <ul id="voice-sources-list" class="voice-sources-list"></ul>
          </details>
          <details class="voice-dev-setup">
            <summary>Developer setup</summary>
            <button type="button" id="voice-auto-setup" class="voice-btn">Auto-tune M5 voice edge</button>
            <p class="voice-hint">Runs hybrid edge installers (Holler, STT, metrics). Safe to skip for daily Talk.</p>
          </details>
        </div>
      </details>

      <div class="voice-status" id="voice-status">Checking ${esc(voiceBrand().alias)} health…</div>
      <div class="voice-processor-strip" id="voice-processor-strip" aria-label="Voice COMP processors" hidden></div>
      <p class="voice-footer-tagline voice-console-only">For the boys — no cloud rent, no vendor lock-in. The voices that surprise people are the ones we run ourselves.</p>
      </div>
    </div>`;
  }

  const padApi = { render, bind };

  function bind() {
    const root = document.getElementById("voice-pad");
    if (!root || root.dataset.parakeetBound === "1") return;

    const micBtn = document.getElementById("voice-mic");
    const stopBtn = document.getElementById("voice-stop");
    const speakBtn = document.getElementById("voice-speak");
    const respeakBtn = document.getElementById("voice-respeak");
    const clearBtn = document.getElementById("voice-clear");
    const sendVideoBtn = document.getElementById("voice-send-video");
    const transcript = document.getElementById("voice-transcript");
    const voiceLog = document.getElementById("voice-log");
    const voicePicker = document.getElementById("voice-picker");
    const engineBadge = document.getElementById("voice-engine-badge");
    const canvas = document.getElementById("voice-visualizer");
    const status = document.getElementById("voice-status");
    const routeBtns = document.querySelectorAll("[data-voice-route]");
    const modeBtns = document.querySelectorAll("[data-voice-mode]");
    const ragBtns = document.querySelectorAll("[data-voice-rag]");
    const sourcesPanel = document.getElementById("voice-sources");
    const sourcesList = document.getElementById("voice-sources-list");

    if (!micBtn || !speakBtn || !transcript || !canvas || !status || !voiceLog) return;

    let voiceCatalog = null;
    let voiceStackMeta = {};
    let m5Healthy = false;
    let sttHealthy = false;
    let dgxHealthy = false;
    let healthProbePending = true;
    let loadMessage = `Starting ${voiceBrand().alias} voice stack…`;
    let initialHealthToastDone = false;
    const VOICE_LOAD_TOAST_ID = "voice-stack-load";

    // Always proxy STT/TTS through tower-api (avoids CORS from pockit.localhost → 127.0.0.1).
    const sttEndpoint = "/api/v1/voice/stt";
    const ttsEndpoint = "/api/v1/voice/tts";
    const voiceTurnEndpoint = "/api/v1/voice/turn";
    const voiceTurnStreamEndpoint = "/api/v1/voice/turn/stream";
    let chatEndpoint = "/api/v1/chat/completions";
    let turnTakingCfg = {
      conversation_mode: "conversation",
      auto_listen_after_speak: true,
      conversation_reopen_delay_ms: 400,
      vad_threshold: 0.5,
      silence_ms: 600,
      barge_in_enabled: true,
      min_utterance_ms: 300,
    };
    let voiceSttConfirm = false;
    let pendingSttRaw = "";
    let conversationSessionActive = false;

    function vadClientThreshold() {
      return Math.max(0.012, Number(turnTakingCfg.vad_threshold || 0.5) * 0.056);
    }

    function conversationModeEnabled() {
      return (turnTakingCfg.conversation_mode || "conversation") !== "tap_to_talk";
    }

    function shouldAutoReopenMic() {
      if (!conversationModeEnabled()) return false;
      if (turnTakingCfg.auto_listen_after_speak === false) return false;
      if (voiceSttConfirm) return false;
      if (voiceMode !== "chat") return false;
      if (!conversationSessionActive) return false;
      return true;
    }

    function scheduleConversationReopen() {
      if (!shouldAutoReopenMic()) {
        conversationSessionActive = false;
        notifyState();
        return;
      }
      const delay = Math.max(200, Number(turnTakingCfg.conversation_reopen_delay_ms) || 400);
      window.setTimeout(() => {
        if (!shouldAutoReopenMic() || isRecording || turnInProgress || isSpeaking || micStarting) return;
        micBtn.click();
      }, delay);
    }

    async function fetchJson(url, opts = {}) {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout((opts.timeout || 4) * 1000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    function voiceRouteHeader() {
      if (Boolean(window.voicePrimeMode) && dgxHealthy) return "prime";
      if (voiceRoute === "m5") return "m5";
      if (voiceRoute === "dgx") return "dgx";
      if (m5Healthy) return "m5";
      if (dgxHealthy) return "dgx";
      return "auto";
    }

    function getVoiceSessionId() {
      try {
        let id = localStorage.getItem(SESSION_KEY);
        if (!id) {
          id = `pockit-voice-${crypto.randomUUID?.() || Date.now().toString(36)}`;
          localStorage.setItem(SESSION_KEY, id);
        }
        return id;
      } catch {
        return `pockit-voice-ephemeral-${Date.now().toString(36)}`;
      }
    }

    function voiceChatHeaders({ useGrounded, isFastM5, clientRagInjected = false, inferenceFast = true } = {}) {
      // When the pad already injected retrieve hits into messages, do not trigger
      // a second server-side RAG pass (pockit-voice-grounded adds ~10s+).
      const serverGrounded = useGrounded && !isFastM5 && !clientRagInjected && !inferenceFast;
      return {
        "Content-Type": "application/json",
        "X-Voice-Agent": "pockit",
        "X-Voice-Rag": useGrounded ? "grounded" : "fast",
        "X-Voice-Session": getVoiceSessionId(),
        "X-Voice-Route": voiceRouteHeader(),
        "X-Voice-Memory": voiceMemoryEnabled ? "1" : "0",
        "X-Voice-Mcp": voiceMcpEnabled ? "1" : "0",
        ...((isFastM5 || inferenceFast) ? { "X-Voice-Fast": "1" } : {}),
        ...(serverGrounded ? { "X-Voice-Grounded": "1" } : {}),
      };
    }

    function groundedRetrieveDomains() {
      const domains = [
        "rules",
        "memory",
        "identity",
        "financial",
        "legal",
        "family",
        "general",
        "historia",
        "clinic",
        "vault",
        "agent-context",
      ];
      if (!voiceMemoryEnabled) {
        const i = domains.indexOf("memory");
        if (i >= 0) domains.splice(i, 1);
      }
      return domains;
    }

    function syncTowerVoiceSettings(partial = {}) {
      try {
        const towerKey = "tower-cassette-settings-voice";
        const tower = { ...JSON.parse(localStorage.getItem(towerKey) || "{}"), ...partial };
        localStorage.setItem(towerKey, JSON.stringify(tower));
      } catch { /* ignore */ }
    }

    async function fetchRetrieveCached(body, { timeoutMs = RETRIEVE_TIMEOUT_MS } = {}) {
      const key = JSON.stringify(body);
      const hit = retrieveCache.get(key);
      if (hit && Date.now() - hit.at < RETRIEVE_CACHE_TTL_MS) return hit.data;
      const ragRes = await fetch("/api/v1/retrieve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!ragRes.ok) throw new Error(`retrieve HTTP ${ragRes.status}`);
      const data = await ragRes.json();
      retrieveCache.set(key, { at: Date.now(), data });
      return data;
    }

    // Premium covenant: honest placeholder until health probe loads catalog
    populateBrowserVoices();

    const VOICE_RAG_SMART_DEFAULT_KEY = "voice-rag-smart-default-v1";

    function migrateSmartRagPrefs(prefs) {
      try {
        if (localStorage.getItem(VOICE_RAG_SMART_DEFAULT_KEY)) return prefs;
        const next = { ...prefs };
        // One-time marker only — do not override operator Fast RAG choice (hybrid prefetch
        // added ~3.5s+ before first token and Deep routed to the 180s grounded channel).
        if (!next.ragMode) next.ragMode = "fast";
        localStorage.setItem(VOICE_RAG_SMART_DEFAULT_KEY, "1");
        savePrefs(next);
        syncTowerVoiceSettings({ rag_lane: next.ragMode, rag_enabled: next.ragMode !== "fast" });
        return next;
      } catch {
        return prefs;
      }
    }

    function usesCorpusLane(mode, prime = false) {
      return mode === "hybrid" || mode === "grounded" || prime;
    }

    function ragModeLabel(mode) {
      if (mode === "hybrid") return "Smart RAG";
      if (mode === "grounded") return "Deep RAG";
      return "Fast RAG";
    }

    /** Holler on Mac M5 — Kokoro on :7851 (SSH tunnel) is ops-only, not covenant speak. */
    function m5TtsSpeakReady(tts) {
      if (!tts?.ok) return false;
      if (tts.speak_ready === true || tts.tts_speak_ready === true) return true;
      if (tts.engine === "holler" || tts.gateway === "m5-holler-tts-gateway") return true;
      if (tts.backend === "speaches-kokoro" || tts.service === "fish-speech") return false;
      return Boolean(tts.engine && tts.engine !== "kokoro");
    }

    function m5EdgeSpeakReady(edge) {
      if (!edge) return false;
      if (edge.tts_speak_ready === true) return Boolean(edge.stt?.ok) && m5TtsSpeakReady(edge.tts);
      return Boolean(edge.ok) && m5TtsSpeakReady(edge.tts);
    }

    const prefs = migrateSmartRagPrefs(loadPrefs());
    let voiceRoute = prefs.route || "auto";
    let voiceRagMode = prefs.ragMode || "fast";
    let uiSurface = prefs.uiSurface || "orb";
    let presenceUrl = resolvePresenceDoorUrl(prefs.presenceUrl || defaultPresenceUrl());
    if (prefs.presenceUrl && /family-embed\/voice/i.test(prefs.presenceUrl)) {
      presenceUrl = resolvePresenceDoorUrl(defaultPresenceUrl());
    }
    let primeMode = prefs.prime || false;
    if (!prefs.uiSurface) savePrefs({ uiSurface });
    if (!prefs.presenceUrl || presenceUrl !== prefs.presenceUrl) savePrefs({ presenceUrl });
    if (!prefs.ragMode) savePrefs({ ragMode: voiceRagMode });
    let voiceMemoryEnabled = true;
    let voiceMcpEnabled = false;
    let voiceMode = prefs.mode === "read" ? "read" : "chat";
    let selectedVoice = prefs.voice || "jarvis";
    if (prefs.conversationMode === "conversation" || prefs.conversationMode === "tap_to_talk") {
      turnTakingCfg.conversation_mode = prefs.conversationMode;
    }
    if (typeof prefs.autoListenAfterSpeak === "boolean") {
      turnTakingCfg.auto_listen_after_speak = prefs.autoListenAfterSpeak;
    }
    if (typeof prefs.sttConfirm === "boolean") {
      voiceSttConfirm = prefs.sttConfirm;
    }
    let activeChatModel = "qwen2.5:7b";
    let voiceStackReady = true;
    let dgxDegraded = false;
    let routePreferred = "auto";
    let dgxStack = null;
    let premiumAvailable = false;
    let activeEngine = "holler";
    let chatHistory = [];
    let lastReply = "";
    let lastUserTurn = "";
    let recognition = null;
    let isRecording = false;
    let mediaRecorder = null;
    let mediaStream = null;
    let audioContext = null;
    let analyser = null;
    let source = null;
    const ctx = canvas.getContext("2d");
    let animFrame = null;
    let currentAudio = null;
    let previewAbort = null;
    let previewSession = 0;
    let playbackAbort = null;
    let playbackCtx = null;
    let vadFrame = null;
    let streamingLogRow = null;
    let turnInProgress = false;
    let isSpeaking = false;
    let lastTurnType = null;
    let sparkHealthy = false;
    let sparkNative = false;
    let ragHealthy = false;

    const presenceLayer = document.getElementById("voice-presence-layer");
    const presenceFrame = document.getElementById("voice-presence-frame");
    const presenceSsoHint = document.getElementById("voice-presence-sso-hint");
    const presenceSsoLink = document.getElementById("voice-presence-sso-link");
    const presenceDoorLink = document.getElementById("voice-presence-door-link");
    let presenceMountGen = 0;

    if (presenceDoorLink) {
      presenceDoorLink.href = resolvePresenceDoorUrl(presenceUrl);
    }

    async function familySessionOk() {
      try {
        const r = await fetch("/api/v1/auth/me", { credentials: "include", cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        return Boolean(j?.authenticated);
      } catch {
        return false;
      }
    }

    function presenceSigninCallbackUrl(embedSrc) {
      try {
        const u = new URL(embedSrc, window.location.origin);
        return `${u.pathname}${u.search}${u.hash}`;
      } catch {
        return "/family-embed/voice/";
      }
    }

    function showPresenceSignInHint(embedSrc) {
      const cb = encodeURIComponent(presenceSigninCallbackUrl(embedSrc));
      if (presenceSsoLink) presenceSsoLink.href = `/signin?callbackUrl=${cb}`;
      presenceSsoHint?.removeAttribute("hidden");
      if (presenceFrame) {
        presenceFrame.removeAttribute("src");
        presenceFrame.src = "about:blank";
      }
    }

    function hidePresenceSignInHint() {
      presenceSsoHint?.setAttribute("hidden", "");
    }

    /** Door-ticket redeem bootstraps nephew_session inside the iframe navigation chain (Clinic 0044 layer B). */
    async function familyPresenceFrameSrc(embedSrc) {
      const absolute = new URL(embedSrc, window.location.origin).toString();
      try {
        const r = await fetch(
          `/api/v1/auth/door-ticket?target=${encodeURIComponent(absolute)}`,
          { credentials: "include", cache: "no-store" },
        );
        const j = await r.json().catch(() => ({}));
        if (j.ok && j.redeem_url) return j.redeem_url;
      } catch { /* fall through */ }
      return embedSrc;
    }

    async function mountPresenceFrame() {
      if (!presenceFrame || uiSurface !== "orb") return;
      const gen = ++presenceMountGen;
      const embedSrc = presenceEmbedSrc(presenceUrl);
      presenceFrame.removeAttribute("src");
      const publicDoor = isPublicPresenceDoor(embedSrc);
      if (!publicDoor) {
        const authed = await familySessionOk();
        if (gen !== presenceMountGen) return;
        if (!authed) {
          showPresenceSignInHint(embedSrc);
          return;
        }
      }
      hidePresenceSignInHint();
      const src = publicDoor ? embedSrc : await familyPresenceFrameSrc(embedSrc);
      if (gen !== presenceMountGen || uiSurface !== "orb") return;
      presenceFrame.src = src;
    }

    function presenceEmbedSrc(url) {
      try {
        const u = new URL(resolvePresenceDoorUrl(url), window.location.href);
        u.searchParams.delete("pockit_hud");
        u.searchParams.delete("embed");
        return u.toString();
      } catch {
        return resolvePresenceDoorUrl(url);
      }
    }

    function postPresenceState(state, emotion = "neutral") {
      if (uiSurface !== "orb" || !presenceFrame?.contentWindow) return;
      try {
        presenceFrame.contentWindow.postMessage(
          { source: "pockit-voice-pad", presenceState: state, emotion },
          "*",
        );
      } catch { /* cross-origin until load */ }
    }

    function setUiSurface(mode, { reloadPresence = true } = {}) {
      uiSurface = mode === "console" ? "console" : "orb";
      root.classList.toggle("voice-pad--orb", uiSurface === "orb");
      root.classList.toggle("voice-pad--console", uiSurface === "console");
      presenceLayer?.toggleAttribute("hidden", uiSurface !== "orb");
      if (reloadPresence && presenceFrame && uiSurface === "orb") {
        void mountPresenceFrame();
      }
      savePrefs({ uiSurface, presenceUrl });
      syncTowerVoiceSettings({ ui_surface: uiSurface, presence_url: presenceUrl });
      if (uiSurface === "orb") {
        setStatus(`${voiceBrand().name} · The Presence orb`);
        postPresenceState("idle", "neutral");
      }
    }

    setUiSurface(uiSurface, { reloadPresence: true });

    const VOICE_SYSTEM_PROMPT =
      "You are Nephew on a live voice call with the family. Reply in 1–3 short spoken sentences. " +
      "Speak like a natural Grok voice session: warm, direct, lightly emotional when it fits — never robotic or stiff. " +
      "Only state what you know; if unsure, say you are not sure. " +
      "Never invent family facts, names, dates, or system status. No lists, markdown, or emoji. " +
      "When corpus evidence is missing, say so briefly (grounded_miss tone). Greetings stay warm; errors stay calm.";

    function inferTurnType(userText, reply, retrieveMeta) {
      const user = String(userText || "").trim().toLowerCase();
      const text = String(reply || "").trim();
      const grounded = usesCorpusLane(voiceRagMode, Boolean(window.voicePrimeMode));
      if (!text) return "error";
      if (grounded && retrieveMeta?.hits_count === 0) return "not_in_corpus";
      if (grounded && retrieveMeta?.hits_count > 0) return "grounded_hit";
      if (/^(hi|hello|hey|good (morning|afternoon|evening)|what'?s up|howdy)\b/.test(user)) return "greeting";
      if (/^(how do|what is|explain|tell me|show me|where |when |why |help me|can you)\b/.test(user)) return "instruction";
      if (/congrat|awesome|great job|well done|celebrat|nice work/i.test(text)) return "celebration";
      if (/sorry|couldn't|failed|error|unavailable|not sure|can't reach/i.test(text)) return "error";
      return "default";
    }

    async function unlockPlaybackAudio() {
      try {
        if (!playbackCtx) playbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (playbackCtx.state === "suspended") await playbackCtx.resume();
        const tick = playbackCtx.createBuffer(1, 1, 22050);
        const src = playbackCtx.createBufferSource();
        src.buffer = tick;
        src.connect(playbackCtx.destination);
        src.start(0);
      } catch { /* best-effort — HTML Audio fallback still runs */ }
    }

    function catalogVoice(id) {
      return voiceCatalog?.voices?.find((v) => v.id === id || v.tts_voice === id) || null;
    }

    function stopPlayback() {
      previewSession += 1;
      previewAbort?.abort();
      previewAbort = null;
      playbackAbort?.abort();
      playbackAbort = null;
      window.speechSynthesis?.cancel?.();
      ttsQueue.cancel();
      streamAudioQueue.cancel();
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.removeAttribute("src");
          currentAudio.load();
        } catch { /* ignore */ }
        currentAudio = null;
      }
      isSpeaking = false;
      stopVisualizer();
      drawVisualizer(0.15);
    }

    function resolveTtsVoiceForApi(catalogKey) {
      const key = String(catalogKey || "").trim() || selectedVoice || voicePicker?.value || "jarvis";
      const entry = catalogVoice(key);
      if (entry?.tts_voice) return { catalogKey: entry.id, ttsVoice: entry.tts_voice };
      if (entry?.voice) return { catalogKey: entry.id, ttsVoice: entry.voice };
      const opt = voicePicker?.selectedOptions?.[0];
      if (opt && (opt.value === key || opt.dataset?.ttsVoice === key) && opt.dataset?.ttsVoice) {
        return { catalogKey: opt.value || key, ttsVoice: opt.dataset.ttsVoice };
      }
      return { catalogKey: key, ttsVoice: key };
    }

    function ttsVoiceId() {
      return resolveTtsVoiceForApi(selectedVoice || voicePicker?.value || "jarvis").ttsVoice;
    }

    async function fetchTtsBuffer(text, turnType = lastTurnType, { voiceId, ttsVoice: ttsVoiceOverride, signal, fastTts = false, preview = false } = {}) {
      const resolved = resolveTtsVoiceForApi(voiceId || selectedVoice || voicePicker?.value || "jarvis");
      const catalogKey = resolved.catalogKey;
      const ttsVoice = ttsVoiceOverride || resolved.ttsVoice;
      const effectiveTurn = preview ? null : (turnType === undefined ? lastTurnType : turnType);
      const useFastTts = fastTts || (!preview && m5Healthy && voiceMode === "chat" && !window.voicePrimeMode);
      const res = await fetch(ttsEndpoint, {
        method: "POST",
        credentials: "include",
        signal: signal || AbortSignal.timeout(useFastTts ? 45_000 : 90_000),
        headers: {
          "Content-Type": "application/json",
          "X-Voice-Route": voiceRouteHeader(),
          ...(preview ? { "X-Voice-Preview": "1" } : {}),
          ...(useFastTts ? { "X-Voice-Fast": "1" } : {}),
        },
        body: JSON.stringify({
          text,
          input: text,
          voice: ttsVoice,
          persona: catalogKey !== ttsVoice ? catalogKey : undefined,
          prime: Boolean(window.voicePrimeMode),
          ...(effectiveTurn ? { turn_type: effectiveTurn } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (res.status === 503 && /premium_unavailable/i.test(errText)) {
          const err = new Error("premium_unavailable");
          err.code = "premium_unavailable";
          throw err;
        }
        throw new Error(errText.slice(0, 120) || `TTS HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "audio/wav";
      const resolvedVoice = res.headers.get("X-Voice-Id") || ttsVoice;
      if (res.body?.getReader) {
        return { stream: res.body, contentType, streamThrough: true, resolvedVoice };
      }
      const buffer = await res.arrayBuffer();
      return { buffer, contentType, resolvedVoice };
    }

    async function playAudioBuffer(arrayBuffer, contentType = "audio/wav") {
      await unlockPlaybackAudio();
      const blob = new Blob([arrayBuffer], { type: contentType.split(";")[0].trim() || "audio/wav" });
      const url = URL.createObjectURL(blob);
      isSpeaking = true;
      drawVisualizer(0.35);
      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          isSpeaking = false;
          drawVisualizer(0.15);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          isSpeaking = false;
          drawVisualizer(0.15);
          reject(new Error("audio element playback failed"));
        };
        const p = audio.play();
        if (p?.catch) p.catch(reject);
      });
    }

    /** Plan 0202 — play streamed TTS once the WAV body is complete (Holler usually sends one chunk). */
    async function speakViaMediaSource(body, contentType = "audio/wav") {
      const reader = body?.getReader?.();
      if (!reader) throw new Error("speakViaMediaSource: missing stream body");
      const parts = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        parts.push(value);
        total += value.byteLength;
        if (total >= 4096) drawVisualizer(0.28);
      }
      if (!total) throw new Error("TTS stream empty");
      const merged = parts.length === 1
        ? parts[0]
        : (() => {
          const out = new Uint8Array(total);
          let offset = 0;
          for (const part of parts) {
            out.set(part, offset);
            offset += part.byteLength;
          }
          return out;
        })();
      await playAudioBuffer(merged.buffer || merged, contentType);
    }

    async function playTtsResult(result) {
      if (!result) throw new Error("TTS returned no audio");
      if (result.streamThrough && result.stream) {
        await speakViaMediaSource(result.stream, result.contentType);
      } else if (result.buffer?.byteLength) {
        await playAudioBuffer(result.buffer, result.contentType);
      } else {
        throw new Error("TTS returned no audio");
      }
    }

    const ttsQueue = (() => {
      const pending = [];
      let playing = false;
      let prefetchPromise = null;
      let playedCount = 0;
      let lastError = "";

      async function drain() {
        if (playing) return;
        playing = true;
        while (pending.length || prefetchPromise) {
          let chunk = prefetchPromise ? await prefetchPromise.catch(() => null) : null;
          prefetchPromise = null;
          if (!chunk && pending.length) {
            const text = pending.shift();
            try { chunk = await fetchTtsBuffer(text); } catch (e) {
              lastError = e.message || String(e);
              chunk = null;
            }
          }
          if (pending.length && !prefetchPromise) {
            prefetchPromise = fetchTtsBuffer(pending[0]).catch(() => null);
          }
          if (chunk) {
            try {
              await playTtsResult(chunk);
              playedCount += 1;
              haptic("speak");
            } catch (e) {
              lastError = e.message || String(e);
            }
          }
        }
        playing = false;
      }

      function waitIdle() {
        return new Promise((resolve) => {
          const tick = () => {
            if (!playing && pending.length === 0 && !prefetchPromise) resolve();
            else setTimeout(tick, 40);
          };
          tick();
        });
      }

      return {
        enqueue(text) {
          const t = String(text || "").trim();
          if (!t) return;
          pending.push(t);
          drain();
        },
        cancel() {
          pending.length = 0;
          prefetchPromise = null;
          lastError = "";
        },
        resetPlayedCount() { playedCount = 0; },
        getPlayedCount() { return playedCount; },
        getLastError() { return lastError; },
        waitIdle,
      };
    })();

    /** Plan 0455 Slice 2 — play server-emitted TTS chunks from /voice/turn/stream. */
    const streamAudioQueue = (() => {
      const pending = [];
      let playing = false;
      let playedCount = 0;
      let lastError = "";

      async function playB64(b64, contentType) {
        const binary = atob(String(b64 || ""));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        await playAudioBuffer(bytes.buffer, contentType || "audio/wav");
        playedCount += 1;
        haptic("speak");
      }

      async function drain() {
        if (playing) return;
        playing = true;
        while (pending.length) {
          const item = pending.shift();
          try {
            await playB64(item.b64, item.contentType);
          } catch (e) {
            lastError = e.message || String(e);
          }
        }
        playing = false;
      }

      function waitIdle() {
        return new Promise((resolve) => {
          const tick = () => {
            if (!playing && pending.length === 0) resolve();
            else setTimeout(tick, 40);
          };
          tick();
        });
      }

      return {
        enqueue(b64, contentType = "audio/wav") {
          if (!b64) return;
          pending.push({ b64, contentType });
          drain();
        },
        cancel() {
          pending.length = 0;
          lastError = "";
        },
        resetPlayedCount() { playedCount = 0; },
        getPlayedCount() { return playedCount; },
        getLastError() { return lastError; },
        waitIdle,
      };
    })();

    function haptic(kind) {
      if (!navigator.vibrate) return;
      if (kind === "think") navigator.vibrate(30);
      else if (kind === "speak") navigator.vibrate([40, 30, 40]);
      else if (kind === "error") navigator.vibrate([80, 40, 80]);
    }

    function setStatus(msg, isError = false, { loading = false } = {}) {
      status.textContent = msg;
      status.style.color = isError ? "var(--rose, #f66)" : "var(--fg-2, var(--ant-text-secondary))";
      status.classList.toggle("voice-status--loading", Boolean(loading));
      const footer = document.getElementById("voice-footer-status");
      if (footer) {
        footer.textContent = msg;
        footer.classList.toggle("voice-rail-status--loading", Boolean(loading));
      }
    }

    function processorPill(label, on, { pending = false, title = "" } = {}) {
      const state = pending ? "pending" : on ? "on" : "off";
      const tip = title ? ` title="${esc(title)}"` : "";
      return `<span class="voice-processor-pill voice-processor-pill--${state}"${tip}>${esc(label)}</span>`;
    }

    function updateProcessorStrip() {
      const strip = document.getElementById("voice-processor-strip");
      if (!strip) return;
      const sw = voiceStackMeta.emotion_swarmer || {};
      const dp = voiceStackMeta.double_pass || {};
      const tt = voiceStackMeta.turn_taking || turnTakingCfg || {};
      const barge = tt.barge_in_enabled !== false;
      const inference = voiceStackMeta.inference_backend || "auto";
      const higgs = voiceStackMeta.higgs_status || "scaffold";
      const pills = [
        processorPill("Swarmer", sw.enabled !== false && sw.ok !== false, { title: "Emotion swarmer — 4-agent parallel merge" }),
        processorPill("Double-pass", dp.enabled !== false, { title: dp.skip_on_fast ? "Audit skips on fast lane" : "Draft + DGX audit" }),
        processorPill("Barge-in", barge, { title: "Interrupt while Nephew speaks" }),
        processorPill("Turn-taking", true, { title: `VAD ${tt.silence_ms ?? 600}ms silence` }),
        processorPill(inference === "mac-ollama" ? "Mac brain" : inference, inference === "mac-ollama" || inference === "dgx-ollama", { title: `Inference: ${inference}` }),
        processorPill("Higgs", higgs === "live", { title: higgs === "live" ? "Higgs Audio v3 on DGX" : "Higgs v3 scaffolded — Holler speaks on M5" }),
      ];
      strip.innerHTML = pills.join("");
      strip.hidden = !voiceStackReady;
    }

    function setLoadPhase(msg) {
      loadMessage = String(msg || "").trim();
      if (!healthProbePending || !loadMessage) return;
      setStatus(`Loading — ${loadMessage}`, false, { loading: true });
      window.PockitToast?.update?.(VOICE_LOAD_TOAST_ID, loadMessage, { type: "loading" });
      notifyState();
    }

    function beginVoiceLoad(message = `Loading ${voiceBrand().alias} voice stack…`, { toast = true } = {}) {
      healthProbePending = true;
      loadMessage = message;
      root.classList.add("voice-pad--loading");
      setStatus(`Loading — ${loadMessage}`, false, { loading: true });
      if (toast) {
        window.PockitToast?.show(loadMessage, { id: VOICE_LOAD_TOAST_ID, type: "loading", sticky: true });
      }
      notifyState();
    }

    function pumpTurn(userText, reply, routeUsed) {
      try {
        fetch("/api/v1/telemetry", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "voice_turn",
            surface: "pockit-voice-pad",
            meta: {
              id: `voice-turn-${Date.now()}`,
              user: userText.slice(0, 500),
              reply: (reply || "").slice(0, 500),
              route: routeUsed,
              voice: ttsVoiceId(),
              timestamp: new Date().toISOString(),
            },
          }),
        }).catch(() => {});
      } catch { /* optional */ }
    }

    function hideVoiceLogEmpty() {
      document.getElementById("voice-log-empty")?.classList.add("hidden");
    }

    function appendLog(role, text) {
      if (!text?.trim()) return;
      hideVoiceLogEmpty();
      const row = document.createElement("div");
      row.className = `voice-log-line voice-log-line--${role}`;
      row.innerHTML = `<span class="voice-log-role">${role === "user" ? "You" : "Nephew"}</span><span class="voice-log-text">${esc(text.trim())}</span>`;
      voiceLog.appendChild(row);
      voiceLog.scrollTop = voiceLog.scrollHeight;
    }

    function beginStreamingNephewLog() {
      hideVoiceLogEmpty();
      streamingLogRow = document.createElement("div");
      streamingLogRow.className = "voice-log-line voice-log-line--nephew voice-log-line--streaming";
      streamingLogRow.innerHTML = `<span class="voice-log-role">Nephew</span><span class="voice-log-text"></span>`;
      voiceLog.appendChild(streamingLogRow);
      voiceLog.scrollTop = voiceLog.scrollHeight;
    }

    function appendStreamingNephewDelta(delta) {
      if (!delta) return;
      if (!streamingLogRow) beginStreamingNephewLog();
      const el = streamingLogRow.querySelector(".voice-log-text");
      if (el) el.textContent += delta;
      voiceLog.scrollTop = voiceLog.scrollHeight;
    }

    function finalizeStreamingNephewLog(full) {
      if (streamingLogRow) {
        const el = streamingLogRow.querySelector(".voice-log-text");
        if (el) el.textContent = String(full || "").trim();
        streamingLogRow.classList.remove("voice-log-line--streaming");
        streamingLogRow = null;
      } else if (full?.trim()) {
        appendLog("nephew", full);
      }
    }

    function drawVisualizer(amplitude = 0.2) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#34d399";
      ctx.beginPath();
      const midY = canvas.height / 2;
      for (let i = 0; i < 60; i++) {
        const x = (i / 60) * canvas.width;
        const y = midY + Math.sin(i / 3 + Date.now() / 200) * (canvas.height / 3) * amplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (isRecording || isSpeaking) {
        animFrame = requestAnimationFrame(() => drawVisualizer(isRecording ? 0.5 : 0.35));
      } else {
        animFrame = null;
      }
    }

    function setupRecordingAudio(stream) {
      stopVisualizer();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
    }

    function startSilenceVad(onSilence, { threshold = 0.028, silenceMs = 2200, maxMs = 30000, minMs = 800, graceMs = 1000, requireSpeech = true } = {}) {
      if (!analyser) return;
      if (vadFrame) cancelAnimationFrame(vadFrame);
      const data = new Uint8Array(analyser.fftSize);
      let lastVoice = Date.now();
      const started = Date.now();
      let heardSpeech = false;

      function tick() {
        if (!isRecording || !analyser) {
          vadFrame = null;
          return;
        }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms > threshold) {
          lastVoice = Date.now();
          heardSpeech = true;
        }
        const elapsed = Date.now() - started;
        const pastGrace = elapsed >= graceMs;
        const silenceLong = Date.now() - lastVoice >= silenceMs;
        const pastMin = elapsed >= minMs;
        const shouldStop =
          elapsed >= maxMs
          || (pastGrace && pastMin && silenceLong && (!requireSpeech || heardSpeech));

        if (shouldStop) {
          vadFrame = null;
          onSilence();
          return;
        }
        vadFrame = requestAnimationFrame(tick);
      }
      tick();
    }

    function drawRealVisualizer() {
      if (!analyser) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / dataArray.length;
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
        ctx.fillStyle = `rgb(${Math.min(255, 80 + dataArray[i])}, ${160 + (dataArray[i] >> 2)}, 110)`;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
      }
      animFrame = requestAnimationFrame(drawRealVisualizer);
    }

    function stopVisualizer() {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = null;
      if (audioContext) try { audioContext.close(); } catch { /* ignore */ }
      audioContext = null;
      analyser = null;
      source = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function resolveVoiceChatModel() {
      const primeOn = Boolean(window.voicePrimeMode);
      const catalogModel = primeOn
        ? (voiceCatalog?.prime_model || voiceCatalog?.default_model || "nephew:awq-f4-kv")
        : (voiceCatalog?.fast_model || "qwen2.5:7b");
      const live = activeChatModel || catalogModel;
      if (live.startsWith("nephew:")) {
        return primeOn
          ? (voiceCatalog?.prime_model || voiceCatalog?.default_model || "nephew:awq-f4-kv")
          : (voiceCatalog?.fast_model || "qwen2.5:7b");
      }
      return live;
    }

    function isUpstreamErrorReply(text) {
      return /\[error:\s*model/i.test(String(text || ""));
    }

    function setVoiceControlsEnabled(enabled) {
      const on = Boolean(enabled);
      if (!isRecording && !turnInProgress) micBtn.disabled = !on;
      speakBtn.disabled = !on;
    }

    async function speakViaTower(text) {
      const result = await fetchTtsBuffer(text);
      await playTtsResult(result);
    }

    function markTextOnlyStatus(detail = "") {
      const suffix = detail ? ` (${detail})` : "";
      setStatus(`Premium voice offline — text mode${suffix}`);
    }

    async function speakText(text, { queued = false } = {}) {
      if (!premiumAvailable) {
        if (!queued) markTextOnlyStatus();
        return "text-only";
      }
      const route = voiceRouteHeader();
      if (queued) {
        ttsQueue.enqueue(text);
        return route === "auto" ? (m5Healthy ? "m5-queued" : "dgx-queued") : `${route}-queued`;
      }
      try {
        await speakViaTower(text);
        haptic("speak");
        return route === "auto" ? (m5Healthy ? "m5" : "dgx") : route;
      } catch (e) {
        if (e?.code === "premium_unavailable" || /premium_unavailable/i.test(e?.message || "")) {
          markTextOnlyStatus("covenant");
          return "text-only";
        }
        markTextOnlyStatus(e.message || "TTS failed");
        return "text-only";
      }
    }

    async function ensureReplySpoken(reply, spokeLive, turnTypeOverride) {
      await streamAudioQueue.waitIdle();
      await ttsQueue.waitIdle();
      const streamPlayed = streamAudioQueue.getPlayedCount();
      if (streamPlayed > 0) return { route: "stream-audio", played: streamPlayed };
      const queuePlayed = ttsQueue.getPlayedCount();
      if (queuePlayed > 0) return { route: spokeLive ? "stream" : "batch", played: queuePlayed };

      const err = ttsQueue.getLastError();
      if (err) setStatus(`TTS did not play (${err}) — retrying full reply…`);

      setStatus("Speaking reply…");
      if (turnTypeOverride) lastTurnType = turnTypeOverride;
      const used = await speakText(reply);
      return { route: used, played: 1 };
    }

    function buildChatMessages(userText) {
      const messages = [{ role: "system", content: VOICE_SYSTEM_PROMPT }];
      for (const turn of chatHistory.slice(-6)) {
        if (turn?.role && turn?.content) messages.push({ role: turn.role, content: turn.content });
      }
      if (ragContextForTurn) {
        messages.push({
          role: "system",
          content: "Reference only — do not invent beyond this:\n" + ragContextForTurn,
        });
      }
      messages.push({ role: "user", content: userText });
      return messages;
    }

    let ragContextForTurn = "";

    function drainSpeakBuffer(buffer, { flushAll = false, eager = false } = {}) {
      let rest = String(buffer || "");
      if (eager && rest.trim().length >= 10) {
        const clause = rest.match(/^([\s\S]{8,}?[,;—–-]\s)/);
        if (clause?.[1]?.trim().length >= 8) {
          ttsQueue.enqueue(clause[1].trim());
          return rest.slice(clause[0].length);
        }
        if (rest.trim().length >= 24) {
          const space = rest.slice(0, 32).lastIndexOf(" ");
          const cut = space > 10 ? space : 24;
          ttsQueue.enqueue(rest.slice(0, cut).trim());
          return rest.slice(cut);
        }
      }
      while (rest.length >= 10) {
        const m = rest.match(/^([\s\S]*?[.!?…]+["']?)(\s+|$)/);
        if (!m || m[1].trim().length < 8) break;
        ttsQueue.enqueue(m[1].trim());
        rest = rest.slice(m[0].length);
      }
      if (flushAll && rest.trim()) ttsQueue.enqueue(rest.trim());
      return flushAll ? "" : rest;
    }

    function isTransientVoiceApiError(err) {
      const msg = String(err?.message || err || "").toLowerCase();
      return (
        msg.includes("socket hang up")
        || msg.includes("econnreset")
        || msg.includes("failed to fetch")
        || msg.includes("network")
        || msg.includes("tower-api unreachable")
        || msg.includes("http 502")
        || msg.includes("http 503")
        || msg.includes("http 504")
      );
    }

    async function askNephewViaSuperRickTurnWithRetry(userText, inputMeta = {}) {
      try {
        return await askNephewViaSuperRickTurn(userText, inputMeta);
      } catch (e) {
        if (!isTransientVoiceApiError(e)) throw e;
        setStatus("Rick reconnecting…", true);
        await new Promise((r) => setTimeout(r, 700));
        return askNephewViaSuperRickTurn(userText, inputMeta);
      }
    }

    async function consumeVoiceTurnStream(res) {
      const reader = res.body?.getReader?.();
      if (!reader) throw new Error("Voice stream body missing");
      const decoder = new TextDecoder();
      let sseBuf = "";
      let reply = "";
      let donePayload = null;

      const handleBlock = (block) => {
        if (!block.trim()) return;
        let ev = "message";
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLine = line.slice(6);
        }
        if (!dataLine) return;
        let j;
        try { j = JSON.parse(dataLine); } catch { return; }
        if (ev === "token") {
          const t = j.t ?? j.text ?? "";
          if (t) {
            reply += t;
            appendStreamingNephewDelta(t);
          }
        } else if (ev === "audio" && j.b64) {
          streamAudioQueue.enqueue(j.b64, j.content_type || "audio/wav");
        } else if (ev === "audio_skip") {
          const skipText = String(j.text || "").trim();
          if (skipText && premiumAvailable) {
            ttsQueue.enqueue(skipText);
          }
        } else if (ev === "done") {
          donePayload = j;
          if (j.reply) reply = String(j.reply);
        } else if (ev === "error") {
          throw new Error(j.error || "Voice stream error");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const parts = sseBuf.split("\n\n");
        sseBuf = parts.pop() || "";
        for (const block of parts) handleBlock(block);
      }
      if (sseBuf.trim()) handleBlock(sseBuf);
      return { reply: String(reply || donePayload?.reply || "").trim(), done: donePayload };
    }

    async function prefetchHybridCorpus(userText) {
      const prime = Boolean(window.voicePrimeMode);
      if (!usesCorpusLane(voiceRagMode, prime)) return null;
      const timeoutMs = voiceRagMode === "hybrid" && !prime ? SMART_RAG_PREFETCH_MS : RETRIEVE_TIMEOUT_MS;
      try {
        const ragPromise = fetchRetrieveCached({
          query: userText,
          domains: groundedRetrieveDomains(),
          top_k: prime ? 12 : voiceRagMode === "hybrid" ? 6 : 8,
          rerank: true,
          domain_boost: prime ? 1.25 : 1.1,
        }, { timeoutMs });
        const ragData = await Promise.race([
          ragPromise,
          new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
        if (!ragData) return null;
        const hits = ragData.hits || [];
        const context = hits
          .slice(0, 5)
          .map((h) => `${h.path || ""}\n${h.content || h.text || ""}`)
          .join("\n---\n");
        return {
          context,
          meta: {
            hits_count: hits.length,
            top_paths: hits.map((h) => h.path).filter(Boolean).slice(0, 8),
          },
        };
      } catch {
        return null;
      }
    }

    async function askNephewViaSuperRickTurn(userText, inputMeta = {}) {
      haptic("think");
      const primeModeOn = Boolean(window.voicePrimeMode);
      const useFastOnly = voiceRagMode === "fast" && !primeModeOn;
      const useDeep = voiceRagMode === "grounded" && !primeModeOn;
      const useSmart = voiceRagMode === "hybrid" || primeModeOn;

      let retrieveMeta = null;
      let ragContext = "";
      const wantsCorpus = useSmart || useDeep;
      if (wantsCorpus) {
        setStatus(useDeep ? "Deep retrieve (capped)…" : "Smart retrieve…");
        const prefPromise = prefetchHybridCorpus(userText);
        const blockMs = useDeep ? RETRIEVE_TIMEOUT_MS : SMART_RAG_PREFETCH_BLOCK_MS;
        const pref = await Promise.race([
          prefPromise,
          new Promise((resolve) => setTimeout(() => resolve(null), blockMs)),
        ]);
        if (pref?.context) {
          ragContext = pref.context;
          retrieveMeta = pref.meta;
          showVoiceSources(retrieveMeta);
          if (retrieveMeta.hits_count > 0) {
            setStatus(`Using ${retrieveMeta.hits_count} corpus hits…`);
          }
        } else {
          retrieveMeta = { hits_count: 0, top_paths: [], prefetch_miss: true };
          showVoiceSources(retrieveMeta);
        }
      }

      const useGrounded = wantsCorpus;
      const hasClientRag = Boolean(ragContext);
      // Inference stays on the fast Mac/Ollama lane for every interactive turn — Deep RAG
      // only changes how hard we retrieve, not the 180s pockit-voice-grounded channel.
      const inferenceFast = !primeModeOn;
      const isFast = inferenceFast;

      setStatus(
        useDeep
          ? (hasClientRag ? "Deep path (prefetch)…" : "Deep path (server retrieve)…")
          : useSmart
            ? (hasClientRag ? "Smart path…" : "Smart path (no prefetch)…")
            : isFast
              ? "Super Rick fast path…"
              : "Nephew is thinking…",
      );
      beginStreamingNephewLog();
      streamAudioQueue.cancel();
      streamAudioQueue.resetPlayedCount();
      await unlockPlaybackAudio();

      const inputSource = inputMeta.inputSource || "typed";
      const sttRaw = inputMeta.sttRaw;
      const headers = {
        "Content-Type": "application/json",
        "X-Voice-Agent": "pockit",
        "X-Voice-Route": voiceRouteHeader(),
        "X-Voice-Session": getVoiceSessionId(),
        "X-Voice-Rag": useGrounded ? "grounded" : "fast",
        Accept: "text/event-stream",
        "X-Voice-Input-Source": inputSource,
        ...(isFast ? { "X-Voice-Fast": "1" } : {}),
        ...(hasClientRag || (useDeep && !hasClientRag) ? { "X-Voice-Grounded": "1" } : {}),
      };
      const bodyObj = {
        query: userText,
        grounded: useGrounded,
        fast: isFast,
        rag_lane: voiceRagMode,
        server_retrieve: useDeep && !hasClientRag,
        prime: primeModeOn,
        stream_audio: true,
        voice: ttsVoiceId(),
        session_id: undefined,
        model: resolveVoiceChatModel(),
        channel: "pockit-voice",
        domains: groundedRetrieveDomains(),
        input_source: inputSource,
      };
      if (sttRaw) bodyObj.stt_raw = sttRaw;
      if (ragContext) {
        bodyObj.rag_context = ragContext;
        bodyObj.rag_hits_count = retrieveMeta?.hits_count;
        bodyObj.rag_top_paths = retrieveMeta?.top_paths;
      }
      const body = JSON.stringify(bodyObj);

      const res = await fetch(voiceTurnStreamEndpoint, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(isFast ? 90_000 : 180_000),
        headers,
        body,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText.slice(0, 140) || `Voice stream HTTP ${res.status}`);
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      let reply = "";
      let cacheHit = false;
      let elapsedMs = null;

      if (ct.includes("text/event-stream")) {
        const streamed = await consumeVoiceTurnStream(res);
        reply = streamed.reply;
        cacheHit = Boolean(streamed.done?.cache_hit);
        elapsedMs = streamed.done?.elapsed_ms;
        if (streamed.done?.first_audio_ms != null) {
          setStatus(`Streaming audio · first chunk ${streamed.done.first_audio_ms}ms`);
        }
      } else {
        const data = await res.json();
        reply = String(data.reply || "").trim();
        cacheHit = Boolean(data.cache_hit);
        elapsedMs = data.elapsed_ms;
        finalizeStreamingNephewLog(reply);
      }

      if (!reply) throw new Error("Nephew returned empty reply");
      if (isUpstreamErrorReply(reply)) {
        throw new Error(reply.replace(/^\s*\[error:\s*/i, "").replace(/\]\s*$/, "").trim());
      }
      finalizeStreamingNephewLog(reply);
      chatHistory.push({ role: "user", content: userText });
      chatHistory.push({ role: "assistant", content: reply });
      if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
      if (cacheHit) setStatus(`Semantic cache hit · ${elapsedMs ?? "?"}ms`);
      return reply;
    }

    async function askNephew(userText, inputMeta = {}) {
      if (voiceMode === "chat") {
        try {
          return await askNephewViaSuperRickTurnWithRetry(userText, inputMeta);
        } catch (e) {
          streamingLogRow = null;
          if (isTransientVoiceApiError(e)) {
            setStatus("Super Rick offline — streaming via tower-api…", true);
          } else {
            const fallback = `I couldn't reach Super Rick (${e.message || "error"}). Check make ensure-tower-api.`;
            finalizeStreamingNephewLog(fallback);
            return fallback;
          }
        }
      }

      haptic("think");
      const headerRoute = voiceRouteHeader();
      const primeModeOn = Boolean(window.voicePrimeMode);
      const useGrounded = usesCorpusLane(voiceRagMode, primeModeOn);
      const inferenceFast = !primeModeOn;
      const isFastM5 =
        voiceMode === "read" &&
        !useGrounded &&
        m5Healthy &&
        (voiceRoute === "m5" || (voiceRoute === "auto" && headerRoute === "m5"));
      const prime = primeModeOn;

      ragContextForTurn = "";
      let retrieveMeta = null;
      lastTurnType = null;
      const padPrefetchesRag = useGrounded && !isFastM5;
      if (padPrefetchesRag) {
        try {
          setStatus("Retrieving corpus…");
          const ragData = await fetchRetrieveCached({
            query: userText,
            domains: groundedRetrieveDomains(),
            top_k: prime ? 12 : voiceRagMode === "hybrid" ? 6 : 8,
            rerank: true,
            domain_boost: prime ? 1.25 : 1.1,
          }, { timeoutMs: voiceRagMode === "hybrid" ? SMART_RAG_PREFETCH_MS : RETRIEVE_TIMEOUT_MS });
          retrieveMeta = {
            hits_count: (ragData.hits || []).length,
            top_paths: (ragData.hits || []).map((h) => h.path).filter(Boolean).slice(0, 8),
          };
          ragContextForTurn = (ragData.hits || []).slice(0, 5).map((h) => `${h.path || ""}\n${h.content || h.text || ""}`).join("\n---\n");
        } catch {
          setStatus("Corpus slow — replying without retrieve");
        }
      }

      const messages = buildChatMessages(userText);

      const model = resolveVoiceChatModel();
      const streamSpeak = voiceMode === "chat";

      setStatus(isFastM5 ? "Nephew thinking (M5 fast path)…" : prime ? "Grounded reply…" : "Nephew is thinking…");
      beginStreamingNephewLog();

      try {
        const res = await fetch(chatEndpoint, {
          method: "POST",
          credentials: "include",
          signal: AbortSignal.timeout(isFastM5 ? 45_000 : 120_000),
          headers: voiceChatHeaders({
            useGrounded: useGrounded && !isFastM5,
            isFastM5,
            clientRagInjected: Boolean(ragContextForTurn),
            inferenceFast: inferenceFast || isFastM5,
          }),
          body: JSON.stringify({
            model,
            messages,
            max_tokens: isFastM5 ? 64 : prime ? 220 : useGrounded ? 140 : 100,
            stream: true,
            temperature: isFastM5 ? 0.35 : prime ? 0.6 : 0.5,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText.slice(0, 140) || `Chat HTTP ${res.status}`);
        }

        const cacheHit = res.headers.get("x-voice-cache-hit") === "1";
        const turnTypeHdr = res.headers.get("x-voice-turn-type");

        const reader = res.body?.getReader?.();
        if (!reader) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim() || "";
          if (!reply) throw new Error("empty reply");
          finalizeStreamingNephewLog(reply);
          chatHistory.push({ role: "user", content: userText });
          chatHistory.push({ role: "assistant", content: reply });
          return reply;
        }

        const decoder = new TextDecoder();
        let full = "";
        let speakBuffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const delta = j.choices?.[0]?.delta?.content || "";
              if (!delta) continue;
              full += delta;
              appendStreamingNephewDelta(delta);
              if (streamSpeak && !cacheHit) {
                speakBuffer += delta;
                speakBuffer = drainSpeakBuffer(speakBuffer, {
                  eager: ttsQueue.getPlayedCount() === 0,
                });
              }
            } catch { /* skip bad sse line */ }
          }
        }
        if (streamSpeak && cacheHit && full) {
          drainSpeakBuffer(full, { flushAll: true, eager: true });
        } else if (streamSpeak && !cacheHit) {
          drainSpeakBuffer(speakBuffer, { flushAll: true });
        }
        const reply = full.trim();
        if (!reply) throw new Error("Nephew returned empty reply");
        if (reply.trim().toLowerCase() === String(userText || "").trim().toLowerCase()) {
          throw new Error("empty model reply (echo)");
        }
        if (isUpstreamErrorReply(reply)) {
          throw new Error(reply.replace(/^\s*\[error:\s*/i, "").replace(/\]\s*$/, "").trim());
        }
        finalizeStreamingNephewLog(reply);
        chatHistory.push({ role: "user", content: userText });
        chatHistory.push({ role: "assistant", content: reply });
        if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
        lastTurnType = turnTypeHdr || inferTurnType(userText, reply, retrieveMeta);
        showVoiceSources(retrieveMeta);
        return reply;
      } catch (e) {
        streamingLogRow = null;
        const fallback = `I couldn't reach the brain (${e.message || "error"}). Check make ensure-tower-api.`;
        finalizeStreamingNephewLog(fallback);
        return fallback;
      }
    }

    function showVoiceSources(meta) {
      if (!sourcesPanel || !sourcesList) return;
      const grounded = usesCorpusLane(voiceRagMode, Boolean(window.voicePrimeMode));
      const empty = !meta || !meta.top_paths || meta.top_paths.length === 0;
      if (empty) {
        if (grounded) {
          sourcesPanel.classList.remove("hidden");
          sourcesList.innerHTML =
            '<li class="voice-sources-empty"><em>Not in indexed corpus</em> — no retrieval hits for this turn.</li>';
          return;
        }
        sourcesPanel.classList.add("hidden");
        sourcesList.innerHTML = "";
        return;
      }
      sourcesPanel.classList.remove("hidden");
      sourcesList.innerHTML = meta.top_paths
        .map((p) => `<li><code>${esc(p)}</code></li>`)
        .join("");
    }

    async function handleTurn(userText, inputMeta = {}) {
      const text = String(userText || "").trim();
      if (!text || turnInProgress) return;
      if (!inputMeta.inputSource && pendingSttRaw) {
        inputMeta = {
          inputSource: "stt-confirmed",
          sttRaw: pendingSttRaw.trim() !== text ? pendingSttRaw : undefined,
        };
      }
      pendingSttRaw = "";
      lastUserTurn = text;
      if (isSpeaking && turnTakingCfg.barge_in_enabled !== false) {
        stopPlayback();
        ttsQueue.cancel();
      } else if (isSpeaking || isRecording) {
        setStatus("Still speaking or listening — wait a moment.");
        return;
      }
      turnInProgress = true;
      micBtn.disabled = true;
      try {
        appendLog("user", text);
        transcript.value = "";
        if (voiceMode === "read") {
          setStatus("Read aloud — speaking your text (switch to Chat on the controller rail for conversation)");
          appendLog("nephew", `(read aloud) ${text}`);
          const used = await speakText(text);
          pumpTurn(text, text, used);
          setStatus(`Read aloud (${used})`);
          return;
        }
        setStatus("Nephew is thinking…");
        ttsQueue.cancel();
        ttsQueue.resetPlayedCount();
        streamAudioQueue.cancel();
        streamAudioQueue.resetPlayedCount();
        await unlockPlaybackAudio();
        const reply = await askNephew(text, inputMeta);
        lastReply = reply;
        if (respeakBtn) respeakBtn.disabled = !reply;
        const pipelineTurn = lastTurnType;
        const speakResult = await ensureReplySpoken(reply, false, pipelineTurn);
        if (!speakResult.played) {
          throw new Error("TTS did not play — check speakers and try Preview");
        }
        pumpTurn(text, reply, speakResult.route);
        setStatus(
          shouldAutoReopenMic()
            ? `Nephew spoke — listening again… (${speakResult.route} · ${ttsVoiceId()})`
            : `Nephew spoke (${speakResult.route} · ${ttsVoiceId()})`,
        );
        if (shouldAutoReopenMic()) scheduleConversationReopen();
        else {
          conversationSessionActive = false;
          notifyState();
        }
      } catch (e) {
        haptic("error");
        setStatus(`Voice error: ${e.message}`);
        conversationSessionActive = false;
        notifyState();
      } finally {
        turnInProgress = false;
        if (!isRecording) micBtn.disabled = false;
      }
    }

    async function transcribeBlob(blob) {
      const form = new FormData();
      form.append("file", blob, blob.type?.includes("webm") ? "audio.webm" : "audio.bin");
      const res = await fetch(sttEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "X-Voice-Route": voiceRouteHeader() },
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText.slice(0, 120) || `STT HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.text || data.transcript || "";
    }

    function engineBadgeLabel(sel) {
      if (!sel) return activeEngine;
      if (sel.engine === "holler") return "Holler · M5";
      if (sel.engine === "nemo-riva") return "Riva · DGX";
      if (sel.engine === "kokoro") return "Kokoro · DGX";
      if (sel.engine === "kokoro-m5") return "Kokoro · M5";
      return sel.engine || activeEngine;
    }

    function voiceKeyMatches(v, key) {
      if (!key || !v) return false;
      const k = String(key);
      return v.id === k || v.tts_voice === k || v.voice === k;
    }

    function resolveVoiceIdForCatalog(catalog, preferredKey) {
      const voices = (catalog?.voices || []).filter((v) => v.tier !== "fallback" && !v.hidden);
      if (!preferredKey) return null;
      const hit = voices.find((v) => voiceKeyMatches(v, preferredKey));
      return hit?.id || null;
    }

    /** Apply saved/in-memory voice to the picker without clobbering localStorage. */
    function applyVoiceSelection(catalog) {
      if (!voicePicker) return selectedVoice;
      const savedKey = loadPrefs().voice || selectedVoice;
      const resolved =
        resolveVoiceIdForCatalog(catalog, savedKey) ||
        resolveVoiceIdForCatalog(catalog, selectedVoice);
      const options = Array.from(voicePicker.options);
      if (resolved && options.some((o) => o.value === resolved)) {
        voicePicker.value = resolved;
        selectedVoice = resolved;
        if (savedKey !== resolved) savePrefs({ voice: selectedVoice });
        return selectedVoice;
      }
      const preferred =
        options.find((o) => /jarvis|kit/i.test(o.textContent)) || options[0];
      if (preferred) {
        voicePicker.value = preferred.value;
        selectedVoice = preferred.value;
        if (!savedKey) savePrefs({ voice: selectedVoice });
      }
      return selectedVoice;
    }

    function populateVoicePicker(catalog) {
      if (!voicePicker || !catalog?.voices?.length) return;
      voiceCatalog = catalog;
      try {
        localStorage.setItem("nephew-voice-catalog-v1", JSON.stringify(catalog));
      } catch { /* quota */ }
      const visible = catalog.voices.filter((v) => v.tier !== "fallback" && !v.hidden);
      const groups = new Map();
      for (const v of visible) {
        const g = v.group || "Voices";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(v);
      }
      voicePicker.innerHTML = "";
      for (const [group, voices] of groups) {
        const og = document.createElement("optgroup");
        og.label = group;
        for (const v of voices) {
          const opt = document.createElement("option");
          opt.value = v.id;
          opt.dataset.ttsVoice = v.tts_voice || v.voice || v.id;
          opt.textContent = v.label;
          og.appendChild(opt);
        }
        voicePicker.appendChild(og);
      }
      applyVoiceSelection(catalog);
      const sel = visible.find((v) => v.id === selectedVoice);
      if (engineBadge) engineBadge.textContent = engineBadgeLabel(sel);
      notifyState();
    }

    // Voice Quality Covenant (8a picker filter): the picker only ever lists
    // premium sovereign voices. We never seed browser (Web Speech) voices —
    // when no premium engine is healthy we show an honest placeholder instead,
    // so the operator can't pick a robotic voice that the covenant forbids.
    function populateBrowserVoices() {
      if (!voicePicker) return;
      if (voiceCatalog?.voices?.length) return; // premium catalog already loaded — keep it
      voicePicker.innerHTML =
        '<option value="default" disabled selected>Premium voice offline — text mode</option>';
      if (engineBadge) engineBadge.textContent = "Premium offline";
    }

    async function refreshVoiceHealthDeep() {
      try {
        const res = await fetch("/api/v1/voice/health", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        dgxStack = data?.dgx_stack || null;
        dgxHealthy = Boolean(dgxStack?.reachable ?? data?.fish_speech?.ok);
        dgxDegraded = Boolean(dgxStack?.degraded);
        m5Healthy = m5EdgeSpeakReady(data?.m5_edge);
        sttHealthy = m5Healthy || Boolean(dgxStack?.whisper?.ok ?? data?.whisper?.ok);
        premiumAvailable =
          m5Healthy ||
          Boolean(dgxStack?.nemo_riva?.ok) ||
          Boolean(dgxStack?.higgs_tts?.ok) ||
          Boolean(data?.nemo_riva?.ok) ||
          Boolean(data?.higgs_tts?.ok);
        sparkHealthy = Boolean(data?.spark_tts?.ok);
        sparkNative =
          data?.spark_tts?.mode === "native_spark" && Boolean(data?.spark_tts?.native?.ok);
        if (data?.turn_taking) turnTakingCfg = { ...turnTakingCfg, ...data.turn_taking };
        notifyState();
      } catch { /* background refresh */ }
    }

    async function probeVoiceHealth(opts = {}) {
      const showReadyToast = opts.toast !== false && !initialHealthToastDone;
      beginVoiceLoad("Loading voice roster…", { toast: showReadyToast });

      const catalogPromise = (async () => {
        try {
          setLoadPhase("Loading voice roster…");
          const vRes = await fetch("/api/v1/voice/voices", { credentials: "include", cache: "no-store" });
          if (vRes.ok) return await vRes.json();
        } catch { /* ignore */ }
        return null;
      })();

      try {
        setLoadPhase(`Checking ${voiceBrand().alias} stack…`);
        const [catalog, res] = await Promise.all([
          catalogPromise,
          fetch("/api/v1/voice/health?light=1", { credentials: "include", cache: "no-store" }),
        ]);
        const data = await res.json();

        if (catalog?.voices?.length) populateVoicePicker(catalog);
        else if (data?.catalog?.voices?.length) populateVoicePicker(data.catalog);

        setLoadPhase("Checking grounded RAG…");
        dgxStack = data?.dgx_stack || null;
        routePreferred = data?.route_preferred || "auto";
        m5Healthy = m5EdgeSpeakReady(data?.m5_edge);
        dgxHealthy = Boolean(dgxStack?.reachable ?? data?.fish_speech?.ok);
        dgxDegraded = Boolean(dgxStack?.degraded);
        sttHealthy = m5Healthy || Boolean(dgxStack?.whisper?.ok ?? data?.whisper?.ok);
        const premiumEngines =
          m5Healthy ||
          Boolean(dgxStack?.nemo_riva?.ok) ||
          Boolean(dgxStack?.higgs_tts?.ok) ||
          Boolean(data?.nemo_riva?.ok) ||
          Boolean(data?.higgs_tts?.ok);
        premiumAvailable = premiumEngines;
        sparkHealthy = Boolean(data?.spark_tts?.ok);
        sparkNative =
          data?.spark_tts?.mode === "native_spark" && Boolean(data?.spark_tts?.native?.ok);
        try {
          const rh = await fetch("/api/v1/retrieve/health", { credentials: "include", cache: "no-store" });
          if (rh.ok) {
            const rd = await rh.json();
            ragHealthy = rd.ok !== false && rd.status !== "error";
          } else {
            ragHealthy = false;
          }
        } catch {
          ragHealthy = false;
        }
        activeEngine = m5Healthy
          ? (data?.m5_edge?.tts?.engine || "holler")
          : premiumEngines
            ? (data?.higgs_tts?.ok ? "higgs-tts" : data?.nemo_riva?.ok ? "nemo-riva" : "holler")
            : "text-only";

        if (data?.chat_model) activeChatModel = data.chat_model;
        if (data?.turn_taking) turnTakingCfg = { ...turnTakingCfg, ...data.turn_taking };
        const higgsEngine = data?.catalog?.engines?.["higgs-tts"] || data?.catalog?.engines?.find?.((e) => e?.id === "higgs-tts");
        voiceStackMeta = {
          inference_backend: data?.inference_backend || "auto",
          emotion_swarmer: data?.emotion_swarmer || null,
          double_pass: data?.double_pass || null,
          turn_taking: data?.turn_taking || turnTakingCfg,
          processors: data?.processors || null,
          higgs_status: higgsEngine?.status || "scaffold",
        };
        updateProcessorStrip();

        const voiceLabel = voicePicker?.selectedOptions?.[0]?.textContent || selectedVoice;

        let label;
        const ttsEngine = data?.m5_edge?.tts?.engine || "holler";
        const prefetchActive =
          premiumAvailable &&
          voiceMode === "chat" &&
          (m5Healthy || sparkHealthy) &&
          activeEngine !== "text-only";
        const prefetchTag = prefetchActive ? "prefetch ON" : "text-only";
        if (m5Healthy) {
          const engLabel = ttsEngine === "holler" ? "Holler (Grok-class)" :
            ttsEngine === "kokoro-m5" ? "Kokoro M5 (install Python 3.13 for Holler)" : ttsEngine;
          const brainLabel = data?.inference_backend === "mac-ollama"
            ? `Mac Ollama · ${activeChatModel}`
            : data?.inference_backend || "hybrid";
          label = `${voiceBrand().alias} PREMIUM — ${engLabel} · chat ${brainLabel} · ${prefetchTag} · ${voiceLabel}`;
        } else if (data?.m5_edge?.tts?.ok && !m5TtsSpeakReady(data.m5_edge.tts)) {
          label = `${voiceBrand().alias} text-only — M5 TTS is Kokoro (tunnel?) · run: make ensure-pkg-voice · ${voiceLabel}`;
        } else if (premiumAvailable && dgxHealthy) {
          label = dgxDegraded
            ? `${voiceBrand().alias} premium — DGX reachable (slow probes) · ${voiceLabel}`
            : `${voiceBrand().alias} premium — DGX engines · ${voiceLabel}`;
        } else if (sttHealthy || dgxHealthy) {
          label = `${voiceBrand().alias} text-only — ops stack up, premium offline · ${voiceLabel}`;
        } else {
          label = `${voiceBrand().alias} text-only — run: make ensure-pkg-voice`;
        }
        setStatus(`Ready — ${label}`, false, { loading: false });
        voiceStackReady = true;
        setVoiceControlsEnabled(true);
        healthProbePending = false;
        loadMessage = "";
        root.classList.remove("voice-pad--loading");
        window.PockitToast?.dismiss?.(VOICE_LOAD_TOAST_ID);

        const voiceCount = catalogMeta.voices?.length || voiceCatalog?.voices?.length || 0;
        if (showReadyToast) {
          const toastLine = m5Healthy
            ? `${voiceBrand().alias} ready — Holler on M5 · ${voiceCount} voices`
            : premiumAvailable
              ? `${voiceBrand().alias} ready — DGX premium · ${voiceCount} voices`
              : `${voiceBrand().alias} text-only — premium offline · ${voiceCount} voices`;
          window.PockitToast?.show(toastLine, { type: premiumAvailable ? "success" : "error" });
          initialHealthToastDone = true;
        }

        if (data?.dgx_stack?.probe_skipped) {
          void refreshVoiceHealthDeep();
        }
      } catch {
        m5Healthy = false;
        dgxHealthy = false;
        sttHealthy = false;
        premiumAvailable = false;
        voiceStackReady = true;
        setVoiceControlsEnabled(true);
        setStatus("Voice health failed — text-only mode · run: make ensure-pkg-voice", true, { loading: false });
        healthProbePending = false;
        loadMessage = "";
        root.classList.remove("voice-pad--loading");
        window.PockitToast?.dismiss?.(VOICE_LOAD_TOAST_ID);
        if (showReadyToast) {
          window.PockitToast?.show("Voice stack failed to load — text-only mode", { type: "error" });
          initialHealthToastDone = true;
        }
      } finally {
        notifyState();
      }
    }

    setVoiceControlsEnabled(true);

    routeBtns.forEach((btn) => {
      if (btn.disabled) return;
      btn.classList.toggle("is-active", btn.getAttribute("data-voice-route") === voiceRoute);
      btn.addEventListener("click", async () => {
        let chosen = btn.getAttribute("data-voice-route") || "auto";
        if (chosen === "auto") {
          // Auto mode: detect hardware from the m5 services (written by m5-edge-services.sh on make nephew)
          try {
            const hw = await fetch("http://127.0.0.1:9876/m5-hardware.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
            if (hw && hw.detected && hw.detected.includes("M5")) {
              chosen = "m5"; // on this M5 Max, auto to local edge for fast natural (ANE + 128GB KV + 40c swarm)
              setStatus("Auto: detected your M5 Max 128GB/40c — using local edge for best speed/natural on this hardware (DGX offload for heavy)");
            } else {
              chosen = "dgx"; // offload to DGX for full power
            }
          } catch {
            chosen = "m5"; // default to m5 on FIVEMAC
          }
        }
        voiceRoute = chosen;
        routeBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-route") === chosen));
        savePrefs({ route: voiceRoute });
        probeVoiceHealth({ toast: false }).catch(() => {});
      });
    });

    // Delivery style — Warm / Neutral / Narrator map to premium personas.
    // (Nephew warm host · Jarvis neutral default · Board narrator). A friendly
    // shortcut over the voice picker; reuses the picker's change handler for badge.
    const STYLE_VOICE = { warm: "nephew", neutral: "jarvis", narrator: "board" };
    const styleBtns = document.querySelectorAll("[data-voice-style]");
    const syncStyleActive = () =>
      styleBtns.forEach((b) =>
        b.classList.toggle("is-active", STYLE_VOICE[b.getAttribute("data-voice-style")] === selectedVoice));
    syncStyleActive();
    styleBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = STYLE_VOICE[btn.getAttribute("data-voice-style")] || "jarvis";
        selectedVoice = v;
        savePrefs({ voice: selectedVoice });
        if (voicePicker && [...voicePicker.options].some((o) => o.value === v)) {
          voicePicker.value = v;
          voicePicker.dispatchEvent(new Event("change"));
        }
        syncStyleActive();
      });
    });

    ragBtns.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-voice-rag") === voiceRagMode);
      btn.addEventListener("click", () => {
        voiceRagMode = btn.getAttribute("data-voice-rag") || "hybrid";
        ragBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-rag") === voiceRagMode));
        savePrefs({ ragMode: voiceRagMode });
        syncTowerVoiceSettings({
          rag_lane: voiceRagMode,
          rag_enabled: voiceRagMode !== "fast",
        });
        setStatus(
          voiceRagMode === "hybrid"
            ? "Smart — prefetch corpus · fast stream"
            : voiceRagMode === "grounded"
              ? "Deep — full retrieve every turn"
              : "Fast — no corpus retrieve",
        );
        notifyState();
      });
    });

    function syncRagModeUi() {
      ragBtns.forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-voice-rag") === voiceRagMode);
      });
    }

    function applyCassetteSettings(towerPrefs = {}) {
      if (towerPrefs.voice_route && ["auto", "m5", "dgx"].includes(towerPrefs.voice_route)) {
        voiceRoute = towerPrefs.voice_route;
        routeBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-route") === voiceRoute));
        savePrefs({ route: voiceRoute });
      }
      if (towerPrefs.delivery_style && STYLE_VOICE[towerPrefs.delivery_style]) {
        selectedVoice = STYLE_VOICE[towerPrefs.delivery_style];
        savePrefs({ voice: selectedVoice });
        if (voicePicker && [...voicePicker.options].some((o) => o.value === selectedVoice)) {
          voicePicker.value = selectedVoice;
        }
        syncStyleActive();
      }
      if (
        towerPrefs.rag_lane === "fast" ||
        towerPrefs.rag_lane === "hybrid" ||
        towerPrefs.rag_lane === "grounded"
      ) {
        voiceRagMode = towerPrefs.rag_lane;
        savePrefs({ ragMode: voiceRagMode });
        syncRagModeUi();
        syncTowerVoiceSettings({
          rag_lane: voiceRagMode,
          rag_enabled: voiceRagMode !== "fast",
        });
      }
      if (typeof towerPrefs.rag_enabled === "boolean" && !towerPrefs.rag_lane) {
        voiceRagMode = towerPrefs.rag_enabled ? "hybrid" : "fast";
        savePrefs({ ragMode: voiceRagMode });
        syncRagModeUi();
      }
      if (typeof towerPrefs.memory_enabled === "boolean") {
        voiceMemoryEnabled = towerPrefs.memory_enabled;
      }
      if (typeof towerPrefs.mcp_enabled === "boolean") {
        voiceMcpEnabled = towerPrefs.mcp_enabled;
      }
      if (typeof towerPrefs.prime_mode === "boolean") {
        primeMode = towerPrefs.prime_mode;
        window.voicePrimeMode = primeMode;
        document.getElementById("voice-prime-toggle")?.classList.toggle("is-active", primeMode);
        savePrefs({ prime: primeMode });
      }
      if (typeof towerPrefs.barge_in === "boolean") {
        turnTakingCfg.barge_in_enabled = towerPrefs.barge_in;
        savePrefs({ bargeIn: towerPrefs.barge_in });
      }
      if (towerPrefs.conversation_mode === "conversation" || towerPrefs.conversation_mode === "tap_to_talk") {
        turnTakingCfg.conversation_mode = towerPrefs.conversation_mode;
        savePrefs({ conversationMode: towerPrefs.conversation_mode });
      }
      if (typeof towerPrefs.auto_listen_after_speak === "boolean") {
        turnTakingCfg.auto_listen_after_speak = towerPrefs.auto_listen_after_speak;
        savePrefs({ autoListenAfterSpeak: towerPrefs.auto_listen_after_speak });
      }
      if (typeof towerPrefs.stt_confirm_before_send === "boolean") {
        voiceSttConfirm = towerPrefs.stt_confirm_before_send;
        document
          .getElementById("voice-stt-confirm-toggle")
          ?.classList.toggle("is-active", voiceSttConfirm);
        savePrefs({ sttConfirm: voiceSttConfirm });
        syncTowerVoiceSettings({ stt_confirm_before_send: voiceSttConfirm });
      }
      if (typeof towerPrefs.double_pass === "boolean") {
        savePrefs({ doublePass: towerPrefs.double_pass });
      }
      if (typeof towerPrefs.presence_url === "string" && towerPrefs.presence_url.trim()) {
        presenceUrl = resolvePresenceDoorUrl(towerPrefs.presence_url.trim());
        savePrefs({ presenceUrl });
      }
      if (towerPrefs.ui_surface === "orb" || towerPrefs.ui_surface === "console") {
        setUiSurface(towerPrefs.ui_surface, { reloadPresence: true });
      } else if (presenceUrl !== prefs.presenceUrl) {
        setUiSurface(uiSurface, { reloadPresence: true });
      }
      const parts = [];
      if (towerPrefs.voice_route) parts.push(`Route ${voiceRoute}`);
      if (towerPrefs.delivery_style) parts.push(`Style ${towerPrefs.delivery_style}`);
      if (towerPrefs.rag_lane || typeof towerPrefs.rag_enabled === "boolean") {
        parts.push(ragModeLabel(voiceRagMode));
      }
      if (typeof towerPrefs.memory_enabled === "boolean") {
        parts.push(voiceMemoryEnabled ? "Memory on" : "Memory off");
      }
      if (typeof towerPrefs.mcp_enabled === "boolean") {
        parts.push(voiceMcpEnabled ? "MCP on" : "MCP off");
      }
      if (towerPrefs.ui_surface) parts.push(uiSurface === "orb" ? "Presence orb" : "Console pad");
      if (typeof towerPrefs.prime_mode === "boolean") {
        parts.push(primeMode ? "Prime on" : "Prime off");
      }
      if (parts.length) setStatus(`Settings applied · ${parts.join(" · ")}`);
      notifyState();
    }

    try {
      applyCassetteSettings(JSON.parse(localStorage.getItem("tower-cassette-settings-voice") || "{}"));
    } catch { /* ignore */ }

    window.addEventListener("nephew-cassette-settings", (e) => {
      if (e.detail?.cassetteId === "voice") applyCassetteSettings(e.detail.prefs || {});
    });

    modeBtns.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-voice-mode") === voiceMode);
      btn.addEventListener("click", () => {
        voiceMode = btn.getAttribute("data-voice-mode") === "read" ? "read" : "chat";
        modeBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
        savePrefs({ mode: voiceMode });
        setStatus(voiceMode === "read"
          ? "Read aloud — TTS repeats your words (pick Chat for conversation with Nephew)"
          : "Chat mode — Nephew will answer, not repeat");
        notifyState();
      });
    });
    if (voiceMode === "read") {
      setStatus("Read aloud mode — pick Chat on the controller rail for conversation");
    }

    // Prime Mode toggle — Top of the line: AWQ f4/f8 + KV Cache + Swarming + Deep RAGs (full stack)
    const primeBtn = document.getElementById("voice-prime-toggle");
    window.voicePrimeMode = primeMode;
    if (primeBtn) {
      primeBtn.classList.toggle("is-active", primeMode);
      primeBtn.onclick = () => {
        primeMode = !primeMode;
        primeBtn.classList.toggle("is-active", primeMode);
        window.voicePrimeMode = primeMode;
        savePrefs({ prime: primeMode });
        syncTowerVoiceSettings({ prime_mode: primeMode });
        setStatus(primeMode 
          ? "Prime Mode ON — AWQ-f4 + KV Cache + Swarm + Deep RAG (top of the line sovereign)" 
          : "Prime Mode OFF");
        probeVoiceHealth({ toast: false }).catch(() => {});
      };
    }

    const sttConfirmBtn = document.getElementById("voice-stt-confirm-toggle");
    if (sttConfirmBtn) {
      sttConfirmBtn.classList.toggle("is-active", voiceSttConfirm);
      sttConfirmBtn.onclick = () => {
        voiceSttConfirm = !voiceSttConfirm;
        sttConfirmBtn.classList.toggle("is-active", voiceSttConfirm);
        savePrefs({ sttConfirm: voiceSttConfirm });
        syncTowerVoiceSettings({ stt_confirm_before_send: voiceSttConfirm });
        setStatus(
          voiceSttConfirm
            ? "Review STT ON — mic fills the box; you confirm before Rick acts"
            : "Review STT OFF — mic sends immediately (watch for misheard words)",
        );
      };
    }
    window.voicePrimeMode = primeMode;

    voicePicker?.addEventListener("change", () => {
      selectedVoice = voicePicker.value;
      savePrefs({ voice: selectedVoice });
      const sel = voiceCatalog?.voices?.find((v) => v.id === selectedVoice);
      if (engineBadge) engineBadge.textContent = engineBadgeLabel(sel);
      const desc = sel?.description || sel?.note;
      if (desc) setStatus(desc);
    });

    document.getElementById("voice-preview")?.addEventListener("click", async () => {
      await unlockPlaybackAudio();
      const pickId = voicePicker?.value || selectedVoice || "jarvis";
      try {
        await previewVoice(pickId);
      } catch (e) {
        setStatus(`Preview failed: ${e.message}`, true);
      }
    });

    let micStarting = false;
    let micSessionId = 0;

    function stopRecording() {
      conversationSessionActive = false;
      notifyState();
      if (vadFrame) cancelAnimationFrame(vadFrame);
      vadFrame = null;
      isRecording = false;
      micBtn.disabled = false;
      micBtn.classList.remove("is-recording");
      stopBtn.disabled = true;
      if (recognition) { try { recognition.stop(); } catch { /* ignore */ } recognition = null; }
      if (mediaRecorder && mediaRecorder.state !== "inactive") { try { mediaRecorder.stop(); } catch { /* ignore */ } }
      if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
      mediaRecorder = null;
      stopVisualizer();
      drawVisualizer(0.15);
    }

    micBtn.onclick = async () => {
      if (micStarting || isRecording || turnInProgress) return;
      if (conversationModeEnabled()) {
        conversationSessionActive = true;
        notifyState();
      }
      if (isSpeaking && turnTakingCfg.barge_in_enabled !== false) {
        stopPlayback();
        ttsQueue.cancel();
      } else if (isSpeaking) {
        return;
      }
      micStarting = true;
      const sessionId = ++micSessionId;
      try {
        const useMic = voiceRoute !== "browser" && (
          voiceRoute === "m5" || voiceRoute === "dgx" || (voiceRoute === "auto" && (sttHealthy || m5Healthy))
        );
        if (useMic && navigator.mediaDevices?.getUserMedia) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          if (sessionId !== micSessionId) {
            mediaStream.getTracks().forEach((t) => t.stop());
            mediaStream = null;
            return;
          }
          mediaRecorder = new MediaRecorder(mediaStream);
          const chunks = [];
          mediaRecorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
          mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "audio/webm" });
            stopRecording();
            if (!blob.size) { setStatus("No audio captured — hold Talk a little longer."); return; }
            setStatus(m5Healthy ? "Transcribing (M5 Whisper)…" : "Transcribing (DGX Whisper)…");
            try {
              const text = (await transcribeBlob(blob)).trim();
              if (!text) { setStatus("No speech detected."); return; }
              if (voiceSttConfirm) {
                pendingSttRaw = text;
                transcript.value = text;
                setStatus("Review what I heard — edit if needed, then Speak");
                return;
              }
              await handleTurn(text, { inputSource: "stt-direct" });
            } catch (e) {
              haptic("error");
              setStatus(`Voice error: ${e.message}`);
            }
          };
          isRecording = true;
          micBtn.disabled = true;
          micBtn.classList.add("is-recording");
          stopBtn.disabled = false;
          setStatus("Listening… speak, then pause — or tap Stop");
          setupRecordingAudio(mediaStream);
          drawRealVisualizer();
          startSilenceVad(() => {
            if (isRecording && mediaRecorder?.state === "recording") mediaRecorder.stop();
          }, {
            threshold: vadClientThreshold(),
            silenceMs: Number(turnTakingCfg.silence_ms) || 600,
            minMs: Number(turnTakingCfg.min_utterance_ms) || 300,
          });
          mediaRecorder.start(250);
          void unlockPlaybackAudio();
          return;
        }
        await unlockPlaybackAudio();
        if (sessionId !== micSessionId) return;
        if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
          setStatus("Use DGX route for mic — browser STT unavailable.");
          return;
        }
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = async (event) => {
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
          }
          stopRecording();
          if (!final.trim()) return;
          const heard = final.trim();
          if (!heard) return;
          if (voiceSttConfirm) {
            pendingSttRaw = heard;
            transcript.value = heard;
            setStatus("Review what I heard — edit if needed, then Speak");
            return;
          }
          try { await handleTurn(heard, { inputSource: "stt-direct" }); }
          catch (e) { haptic("error"); setStatus(`Voice error: ${e.message}`); }
        };
        recognition.onerror = (e) => { haptic("error"); setStatus(`STT error: ${e.error}`); stopRecording(); };
        recognition.onend = () => {
          if (!isRecording) return;
          stopRecording();
        };
        recognition.start();
        isRecording = true;
        micBtn.disabled = true;
        micBtn.classList.add("is-recording");
        stopBtn.disabled = false;
        setStatus("Listening… (browser STT)");
        drawVisualizer(0.5);
      } catch (e) {
        haptic("error");
        setStatus(`Mic error: ${e.message}`);
        stopRecording();
      } finally {
        micStarting = false;
      }
    };

    stopBtn.onclick = () => {
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      else if (recognition && isRecording) stopRecording();
      else stopPlayback();
    };

    speakBtn.onclick = async () => {
      const text = transcript.value.trim();
      if (!text) { setStatus("Type or say something first."); return; }
      await unlockPlaybackAudio();
      try { await handleTurn(text); }
      catch (e) { haptic("error"); setStatus(`Failed: ${e.message}`); }
      finally { stopVisualizer(); drawVisualizer(0.15); }
    };

    respeakBtn.onclick = async () => {
      if (!lastReply) return;
      try {
        setStatus("Re-speaking…");
        const used = await speakText(lastReply);
        setStatus(`Re-spoke (${used} · ${ttsVoiceId()})`);
      } catch (e) { haptic("error"); setStatus(`Re-speak failed: ${e.message}`); }
    };

    clearBtn.onclick = () => {
      transcript.value = "";
      voiceLog.innerHTML = voiceLogEmptyHtml();
      chatHistory = [];
      lastReply = "";
      lastUserTurn = "";
      if (respeakBtn) respeakBtn.disabled = true;
      window.speechSynthesis?.cancel?.();
      ttsQueue.cancel();
      stopPlayback();
      setStatus("Cleared.");
      stopVisualizer();
      drawVisualizer(0.15);
    };

    sendVideoBtn?.addEventListener("click", async () => {
      const text = String(transcript.value || lastUserTurn || "").trim();
      if (!text) {
        setStatus("Nothing to send — talk or type first.");
        return;
      }
      setStatus("Sending to Super Rick Video…");
      try {
        const r = await fetch("/api/v1/video/handoff/from-voice", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            voice_session_id: sessionStorage.getItem(SESSION_KEY) || null,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setStatus(data.message || data.error || "Video handoff failed");
          return;
        }
        setStatus(`Video job ${data.job_id || "queued"} — opening pad…`);
        const dest = data.redirect || `#/c/video?handoff=${encodeURIComponent(data.job_id || "")}`;
        if (dest.startsWith("http")) window.location.href = dest;
        else window.location.hash = dest.includes("#") ? dest.split("#")[1] : `/c/video?handoff=${encodeURIComponent(data.job_id || "")}`;
      } catch (e) {
        setStatus(`Send to Video failed: ${e.message}`);
      }
    });

    const stateListeners = new Set();

    function notifyState() {
      updateProcessorStrip();
      global.VoiceRailInfo?.syncChrome?.(padApi.getState?.() || {});
      const snapshot = padApi.getState?.() || {};
      stateListeners.forEach((fn) => {
        try { fn(snapshot); } catch { /* ignore */ }
      });
      if (uiSurface !== "orb") return;
      let presenceState = "idle";
      let emotion = "neutral";
      if (isRecording) {
        presenceState = "listening";
        emotion = "calm";
      } else if (turnInProgress) {
        presenceState = "thinking";
        emotion = "neutral";
      } else if (isSpeaking) {
        presenceState = "speaking";
        emotion = "warm";
      }
      postPresenceState(presenceState, emotion);
    }

    async function previewVoice(voiceId, opts = {}) {
      stopPlayback();
      await unlockPlaybackAudio();
      const session = ++previewSession;
      previewAbort = new AbortController();
      const pickId = voiceId || selectedVoice || "jarvis";
      if (pickId && voicePicker) {
        selectedVoice = pickId;
        voicePicker.value = pickId;
        savePrefs({ voice: selectedVoice });
      }
      const sel = catalogVoice(pickId);
      if (engineBadge && sel) engineBadge.textContent = engineBadgeLabel(sel);
      const shortName = (sel?.label || pickId).split("—")[0].split("(")[0].trim();
      const engineHint = sel?.engine === "kokoro" ? "Kokoro on DGX" : sel?.engine === "holler" ? "Holler on M5" : sel?.engine || "";
      const line = `This is ${shortName}.`;
      setStatus(`Previewing ${shortName}${engineHint ? ` · ${engineHint}` : ""}…`, false, { loading: true });
      window.PockitToast?.show(`Previewing ${shortName}…`, { id: "voice-preview", type: "loading", sticky: true });
      try {
        const result = await fetchTtsBuffer(line, null, {
          voiceId: pickId,
          ttsVoice: opts.ttsVoice || sel?.tts_voice || sel?.voice,
          signal: previewAbort.signal,
          preview: true,
        });
        if (session !== previewSession) return { stopped: true };
        await playTtsResult(result);
        if (session !== previewSession) return { stopped: true };
        const usedVoice = result.resolvedVoice || resolveTtsVoiceForApi(pickId).ttsVoice;
        setStatus(`Preview done · ${shortName} · voice ${usedVoice}${engineHint ? ` · ${engineHint}` : ""}`, false, { loading: false });
        window.PockitToast?.dismiss?.("voice-preview");
        window.PockitToast?.show(`Preview ready · ${shortName} (${usedVoice})`, { type: "success", duration: 2800 });
        return { ok: true };
      } catch (e) {
        if (e.name === "AbortError" || session !== previewSession) return { stopped: true };
        setStatus(`Preview failed: ${e.message}`, true, { loading: false });
        window.PockitToast?.dismiss?.("voice-preview");
        window.PockitToast?.show(`Preview failed — ${e.message}`, { type: "error" });
        return { error: e.message };
      } finally {
        if (session === previewSession) previewAbort = null;
        notifyState();
      }
    }

    function dispatchControl(cmd = {}) {
      const { route, mode, rag, voice, action } = cmd;
      if (route) {
        voiceRoute = route;
        routeBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-route") === route));
        savePrefs({ route: voiceRoute });
        probeVoiceHealth({ toast: false }).catch(() => {});
      }
      if (mode) {
        voiceMode = mode === "read" ? "read" : "chat";
        modeBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-mode") === voiceMode));
        savePrefs({ mode: voiceMode });
      }
      if (rag) {
        voiceRagMode = rag;
        ragBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-voice-rag") === rag));
        savePrefs({ ragMode: voiceRagMode });
        syncTowerVoiceSettings({
          rag_lane: voiceRagMode,
          rag_enabled: voiceRagMode !== "fast",
        });
      }
      if (voice) {
        const resolved =
          resolveVoiceIdForCatalog(voiceCatalog, voice) || voice;
        selectedVoice = resolved;
        savePrefs({ voice: selectedVoice });
        if (voicePicker) {
          const hasOpt = Array.from(voicePicker.options).some((o) => o.value === resolved);
          if (hasOpt) voicePicker.value = resolved;
        }
        const sel = voiceCatalog?.voices?.find((v) => v.id === resolved);
        if (engineBadge) engineBadge.textContent = engineBadgeLabel(sel);
      }
      if (action === "talk") micBtn?.click();
      else if (action === "stop") stopPlayback();
      else if (action === "clear") clearBtn?.click();
      else if (action === "speak") speakBtn?.click();
      else if (action === "preview") root.querySelector("#voice-preview")?.click();
      else if (action === "prime") primeBtn?.click();
      else if (action === "memory") {
        voiceMemoryEnabled = !voiceMemoryEnabled;
        syncTowerVoiceSettings({ memory_enabled: voiceMemoryEnabled });
        setStatus(voiceMemoryEnabled
          ? "Memory recall on — long-term voice transcript can surface"
          : "Memory recall off — nephew-memory corpus skipped");
        notifyState();
      }
      else if (action === "mcp") {
        voiceMcpEnabled = !voiceMcpEnabled;
        syncTowerVoiceSettings({ mcp_enabled: voiceMcpEnabled });
        setStatus(voiceMcpEnabled
          ? "MCP tools on — Hermes can invoke tools on grounded turns"
          : "MCP tools off — chat-only replies");
        notifyState();
      }
      else if (action === "speakers") window.PockitVoiceVoicesUI?.openVoicePickerModal?.();
      else if (action === "console") window.open("http://voice.localhost/", "_blank", "noopener,noreferrer");
      else if (action === "super-rick") window.open("http://voice.localhost/super-rick", "_blank", "noopener,noreferrer");
      notifyState();
      return true;
    }

    padApi.getState = () => ({
      route: voiceRoute,
      mode: voiceMode,
      rag: voiceRagMode,
      memoryEnabled: voiceMemoryEnabled,
      mcpEnabled: voiceMcpEnabled,
      voice: selectedVoice,
      prime: Boolean(window.voicePrimeMode),
      conversation:
        isRecording ||
        turnInProgress ||
        (conversationSessionActive && conversationModeEnabled()),
      conversationMode: turnTakingCfg.conversation_mode || "conversation",
      textOnly: !voiceStackReady || !premiumAvailable,
      ready: voiceStackReady,
      stackReady: voiceStackReady,
      m5Healthy,
      dgxHealthy,
      dgxDegraded,
      routePreferred,
      dgx_stack: dgxStack,
      sparkHealthy,
      sparkNative,
      ragHealthy,
      sttHealthy,
      healthProbePending,
      loadMessage,
      statusText: status?.textContent || "",
      turnType: lastTurnType,
      health: {
        m5Healthy,
        dgxHealthy,
        dgxDegraded,
        routePreferred,
        dgx_stack: dgxStack,
        sparkHealthy,
        sparkNative,
        ragHealthy,
        sttHealthy,
        healthProbePending,
        loadMessage,
        premiumAvailable: voiceStackReady && premiumAvailable,
        voiceStack: voiceStackMeta,
        inferenceBackend: voiceStackMeta.inference_backend || null,
      },
      voiceStack: voiceStackMeta,
      inferenceBackend: voiceStackMeta.inference_backend || null,
    });
    padApi.previewVoice = previewVoice;
    padApi.applyCassetteSettings = applyCassetteSettings;
    padApi.stopPlayback = stopPlayback;
    padApi.getStatusText = () => status?.textContent || "";
    padApi.speakViaMediaSource = speakViaMediaSource;
    padApi.onStateChange = (fn) => {
      if (typeof fn !== "function") return () => {};
      stateListeners.add(fn);
      return () => stateListeners.delete(fn);
    };
    padApi.dispatchControl = dispatchControl;

    drawVisualizer(0.15);
    probeVoiceHealth({ toast: true }).then(() => {
      notifyState();
      window.VoiceSystemAdvisor?.applyAutoRouteIfNeeded?.();
    }).catch(() => notifyState());
    root.dataset.parakeetBound = "1";
  }

  global.ParakeetVoicePad = padApi;
})(typeof window !== "undefined" ? window : globalThis);
