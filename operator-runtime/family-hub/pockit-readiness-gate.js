/**
 * Route-specific readiness gates — Tier 1 block with warming UI (Plan 0278).
 * Clinic 0044 class: never tear down live native pads when readiness JSON flaps.
 */
(function initPockitReadinessGate(global) {
  const CACHE_MS = 8000;
  const AUTO_POLL_MS = 4500;
  let cache = null;
  let cacheAt = 0;
  let activePoll = null;
  /** @type {Record<string, boolean|undefined>} */
  const lastRouteOk = {};

  const NATIVE_ROUTE_SELECTOR = {
    voice: "#voice-pad",
    knowledge: "#knowledge-hud",
    "web-odysseus": "#odysseus-pad",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cassetteRouteKey(id) {
    const raw = String(id || "").trim();
    if (!raw || raw === "overview") return null;
    if (raw === "voice" || raw === "voice-cassette") return "voice";
    if (raw === "knowledge" || raw === "knowledge-cassette") return "knowledge";
    if (raw === "web-odysseus") return "web-odysseus";
    if (raw === "hello" || raw.startsWith("hello-")) return "hello";
    return null;
  }

  function mainContentRoot() {
    return document.getElementById("main-content")?.firstElementChild || null;
  }

  function mainHasNativeRoute(key) {
    const sel = NATIVE_ROUTE_SELECTOR[key];
    if (!sel) return false;
    const root = mainContentRoot();
    if (!root) return false;
    try {
      if (root.matches?.(sel)) return true;
    } catch {
      /* compound selector */
    }
    return Boolean(root.querySelector?.(sel) || document.querySelector(sel));
  }

  function isWarmingShown(mainEl, key) {
    const root = mainEl?.querySelector?.(".pockit-readiness-warm");
    if (!root) return false;
    if (!key) return true;
    return root.getAttribute("data-route-key") === key;
  }

  async function fetchReadiness() {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_MS) return cache;
    try {
      const r = await fetch("/pockit-readiness.json", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      cache = await r.json();
      cacheAt = now;
      return cache;
    } catch {
      return null;
    }
  }

  function invalidateCache() {
    cache = null;
    cacheAt = 0;
  }

  function voiceDisplay() {
    return global.VoiceAppDisplay || { name: "Super Rick", alias: "Rick", glyph: "🗣️", tagline: "Boss · slick · top shelf" };
  }

  function defaultVoiceSteps() {
    return [
      { id: "tower", label: "Voice routes on tower-api", ok: null },
      { id: "m5-stt", label: "M5 Whisper STT", ok: null },
      { id: "m5-tts", label: "M5 premium TTS", ok: null },
      { id: "dgx", label: "DGX voice stack", ok: null },
    ];
  }

  async function fetchVoiceWarmSteps() {
    try {
      const r = await fetch("/api/v1/voice/health", { credentials: "include", cache: "no-store" });
      let j = {};
      try {
        j = await r.json();
      } catch {
        j = {};
      }
      const m5 = j.m5_edge || {};
      return [
        { id: "tower", label: "tower-api voice routes", ok: r.status !== 404 },
        { id: "m5-stt", label: "M5 Whisper STT", ok: Boolean(m5.stt?.ok) },
        { id: "m5-tts", label: "M5 premium TTS", ok: Boolean(m5.tts?.ok) },
        { id: "dgx", label: "DGX voice stack", ok: Boolean(j.dgx_stack?.reachable) },
      ];
    } catch {
      return defaultVoiceSteps();
    }
  }

  function stepsHtml(steps) {
    return steps
      .map((step, i) => {
        const state = step.ok === true ? "done" : step.ok === false ? "pending" : "wait";
        return `<li class="pockit-readiness-warm__step pockit-readiness-warm__step--${state}" style="--step-i:${i}">
          <span class="pockit-readiness-warm__step-dot" aria-hidden="true"></span>
          <span class="pockit-readiness-warm__step-label">${esc(step.label)}</span>
        </li>`;
      })
      .join("");
  }

  function warmingHtml(block) {
    const mod = block.key ? ` pockit-readiness-warm--${esc(block.key)}` : "";
    const isVoice = block.key === "voice";
    const vd = voiceDisplay();
    const routeAttr = block.key ? ` data-route-key="${esc(block.key)}"` : "";

    if (isVoice) {
      return `
      <div class="pockit-readiness-warm${mod}" role="status" aria-live="polite"${routeAttr}>
        <div class="pockit-readiness-warm__stage">
          <div class="pockit-readiness-warm__orb" aria-hidden="true">
            <span class="pockit-readiness-warm__orb-ring"></span>
            <span class="pockit-readiness-warm__orb-ring pockit-readiness-warm__orb-ring--2"></span>
            <span class="pockit-readiness-warm__orb-core">${esc(vd.glyph)}</span>
          </div>
          <div class="pockit-readiness-warm__wave" aria-hidden="true">
            ${[0, 1, 2, 3, 4, 5, 6]
              .map((i) => `<span class="pockit-readiness-warm__wave-bar" style="--bar-i:${i}"></span>`)
              .join("")}
          </div>
        </div>
        <p class="pockit-readiness-warm__kicker">${esc(vd.name)}</p>
        <h2 class="pockit-readiness-warm__title">${esc(vd.alias)} is warming</h2>
        <p class="pockit-readiness-warm__detail">${esc(block.detail)}</p>
        <p class="pockit-readiness-warm__tagline">${esc(vd.tagline)}</p>
        <ol class="pockit-readiness-warm__steps" data-voice-steps>${stepsHtml(defaultVoiceSteps())}</ol>
        <p class="pockit-readiness-warm__hint">Checking every few seconds — no need to tap Retry.</p>
        <button type="button" class="comet-btn comet-btn--primary pockit-readiness-warm__retry">Retry now</button>
      </div>`;
    }

    return `
      <div class="pockit-readiness-warm${mod}" role="status" aria-live="polite"${routeAttr}>
        <div class="pockit-readiness-warm__pulse" aria-hidden="true"></div>
        <h2 class="pockit-readiness-warm__title">${esc(block.label)} warming</h2>
        <p class="pockit-readiness-warm__detail">${esc(block.detail)}</p>
        <button type="button" class="comet-btn comet-btn--primary pockit-readiness-warm__retry">Retry</button>
      </div>`;
  }

  function blockForKey(key, cassetteId) {
    const labels = {
      voice: [
        voiceDisplay().alias,
        "Whisper, Fish Speech, and the M5 edge are still spinning up on DGX or this Mac.",
      ],
      knowledge: ["Knowledge", "Qdrant + RAG retrieve on DGX is still warming."],
      "web-odysseus": ["Odysseus", "Odysseus surface (:8799) is not up yet."],
      hello: ["Hello chat", "Control Tower Vite may still be starting."],
    };
    const [label, detail] = labels[key] || [key, "Dependency still warming."];
    return { ok: false, label, detail, key, cassetteId };
  }

  async function checkRoute(cassetteId) {
    const key = cassetteRouteKey(cassetteId);
    if (!key) return { ok: true };

    if (mainHasNativeRoute(key)) {
      lastRouteOk[key] = true;
      return { ok: true, sticky: true };
    }

    const doc = await fetchReadiness();
    if (!doc?.routes?.[key]) {
      if (lastRouteOk[key] === false) return blockForKey(key, cassetteId);
      if (lastRouteOk[key] === true) return { ok: true, sticky: true };
      return { ok: true };
    }

    const route = doc.routes[key];
    if (route.ok) {
      lastRouteOk[key] = true;
      return { ok: true };
    }

    lastRouteOk[key] = false;
    return blockForKey(key, cassetteId);
  }

  function stopPoll() {
    if (activePoll) {
      clearInterval(activePoll);
      activePoll = null;
    }
  }

  async function refreshVoiceSteps(mainEl) {
    const list = mainEl.querySelector("[data-voice-steps]");
    if (!list) return;
    const steps = await fetchVoiceWarmSteps();
    list.innerHTML = stepsHtml(steps);
  }

  function startVoicePoll(mainEl, pollId, onRetry) {
    if (activePoll) return;
    activePoll = setInterval(async () => {
      if (!mainEl.querySelector(".pockit-readiness-warm")) {
        stopPoll();
        return;
      }
      await refreshVoiceSteps(mainEl);
      invalidateCache();
      const next = await checkRoute(pollId);
      if (next.ok) onRetry?.();
    }, AUTO_POLL_MS);
  }

  function mountWarming(mainEl, block, onRetry) {
    if (!mainEl) return;

    if (isWarmingShown(mainEl, block.key)) {
      if (block.key === "voice") {
        refreshVoiceSteps(mainEl);
        startVoicePoll(mainEl, block.cassetteId || "voice-cassette", onRetry);
      }
      return;
    }

    stopPoll();
    mainEl.innerHTML = warmingHtml(block);
    const root = mainEl.querySelector(".pockit-readiness-warm");
    root?.querySelector(".pockit-readiness-warm__retry")?.addEventListener("click", () => {
      invalidateCache();
      lastRouteOk[block.key] = undefined;
      onRetry?.();
    });

    if (block.key === "voice") {
      refreshVoiceSteps(mainEl);
      startVoicePoll(mainEl, block.cassetteId || "voice-cassette", onRetry);
    }
  }

  global.PockitReadinessGate = {
    cassetteRouteKey,
    fetchReadiness,
    checkRoute,
    mountWarming,
    stopPoll,
    invalidateCache,
    isWarmingShown,
    mainHasNativeRoute,
  };
})(typeof window !== "undefined" ? window : globalThis);
