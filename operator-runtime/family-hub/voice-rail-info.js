/** Voice player rails — status LEDs, live labels, and info modals (Controller + Stack). */
(function (global) {
  const INFO_EYE_SVG =
    '<svg class="voice-rail-info-btn__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/></svg>';

  const SECTION_INFO = {
    Route: {
      title: "Route",
      kicker: "Controller · left rail",
      lead: "Choose where speech-to-text and text-to-speech run for this session.",
      bullets: [
        "Auto — system advisor picks M5 on this Mac or DGX Spark when healthy.",
        "M5 edge — local Holler + Whisper on this Mac (lowest latency).",
        "DGX route — premium Kokoro / Spark-TTS and deep models on Spark.",
      ],
    },
    Mode: {
      title: "Mode",
      kicker: "Controller · left rail",
      lead: "Controls how Nephew behaves when you talk or type.",
      bullets: [
        "Chat — full conversational back-and-forth with Nephew.",
        "Read aloud — TTS playback without starting a chat turn.",
        "Prime — largest models + deep RAG for harder questions.",
      ],
    },
    RAG: {
      title: "RAG",
      kicker: "Controller · left rail",
      lead: "Whether Nephew retrieves family corpus before answering.",
      bullets: [
        "Smart RAG (default) — prefetch family corpus, inject hits, stream fast — ChatGPT-like with your knowledge.",
        "Fast RAG — skip retrieve for snappier bare replies.",
        "Grounded RAG — deep retrieve every turn before the brain runs.",
      ],
    },
    Delivery: {
      title: "Delivery",
      kicker: "Controller · left rail",
      lead: "Speaker persona — who Nephew sounds like when speaking.",
      bullets: [
        "Speakers opens the full roster with preview.",
        "Jarvis, Warm host, and News anchor are quick persona shortcuts.",
      ],
    },
    "Quick actions": {
      title: "Quick actions",
      kicker: "Controller · left rail",
      lead: "Session controls for the live voice pad.",
      bullets: [
        "Talk — Conversation mode: one tap, Rick speaks, mic reopens (Grok-style). Tap each turn: mic every utterance. Stop ends the session.",
        "Stop — cancel playback and in-flight TTS.",
        "Clear log — empty the on-screen transcript.",
      ],
    },
    Links: {
      title: "Links",
      kicker: "Controller · left rail",
      lead: "Jump to related family cassettes and ops doors.",
      bullets: [
        "Knowledge — family RAG cassette.",
        "Voice console — voice.localhost operator door.",
        "Super Rick — COMP bridge LED table at voice.localhost/super-rick.",
        "The Presence — cinematic orb at voice.localhost/ (⚙ settings first; /presence alias for embed).",
      ],
    },
    "Stack health": {
      title: "Stack health",
      kicker: "Stack · right rail",
      lead: "Live probes from tower-api — green means that layer answered recently.",
      bullets: [
        "M5 edge — Holler STT + TTS on this Mac.",
        "DGX stack — premium models reachable on Spark.",
        "Spark-TTS — emotion sidecar or native 0.5B weights.",
        "Grounded RAG — retrieve substrate + Qdrant.",
        "Whisper STT — transcription path ready.",
        "Premium TTS — covenant engines up (not text-only).",
      ],
    },
    Deploy: {
      title: "Deploy",
      kicker: "Stack · right rail",
      lead: "Make targets that install, heal, or deploy voice services. Tier A runs on this machine.",
      bullets: ["Click ▶ to run make … on the tower.", "Watch output in the log panel below."],
    },
    "Quick ops": {
      title: "Quick ops",
      kicker: "Stack · right rail",
      lead: "One-shot operator commands — refs, sync, eval smoke.",
      bullets: ["Most are safe to re-run; they are idempotent heal steps."],
    },
    Speakers: {
      title: "Speakers",
      kicker: "Controller · left rail",
      lead: "Opens the Settings-style speaker picker — preview and pin a voice.",
      bullets: ["Current selection shows under Voices on the Controller rail."],
    },
  };

  const ITEM_INFO = {
    "voice-ctl-route-auto": {
      title: "Auto route",
      lead: "System advisor picks the best healthy path — usually M5 on this Mac, DGX when M5 is down.",
      controls: "Sets voice route preference to auto. Footer Auto pill mirrors this.",
    },
    "voice-ctl-route-m5": {
      title: "M5 edge",
      lead: "Pins STT + TTS to this Mac via Holler and Whisper.",
      controls: "Route: M5. Requires make ensure-m5-voice when offline.",
    },
    "voice-ctl-route-dgx": {
      title: "DGX route",
      lead: "Sends voice work to NVIDIA Spark — premium voices and larger models.",
      controls: "Route: DGX. Deploy with make deploy-voice-premium-dgx.",
    },
    "voice-ctl-mode-chat": {
      title: "Chat mode",
      lead: "Nephew replies in conversation — history is sent to the brain.",
      controls: "Mode: chat. Use Talk to start speaking.",
    },
    "voice-ctl-mode-read": {
      title: "Read aloud",
      lead: "TTS-only — Nephew speaks text without a full chat turn.",
      controls: "Mode: read. Does not start a live conversation by itself.",
    },
    "voice-ctl-mode-prime": {
      title: "Prime mode",
      lead: "Deep RAG + largest models for harder questions (more latency).",
      controls: "Toggles voicePrimeMode on the pad.",
    },
    "voice-ctl-rag-hybrid": {
      title: "Smart RAG",
      lead: "Prefetch family corpus, inject hits, and stream — default lane for grounded + fast replies.",
      controls: "RAG lane: hybrid. Matches Smart on the voice pad and Presence settings.",
    },
    "voice-ctl-rag-fast": {
      title: "Fast RAG",
      lead: "Skips corpus retrieve for snappier replies.",
      controls: "RAG lane: fast.",
    },
    "voice-ctl-rag-grounded": {
      title: "Grounded RAG",
      lead: "Retrieve family knowledge before Nephew answers.",
      controls: "RAG lane: grounded. Needs Qdrant + retrieve healthy.",
    },
    "voice-del-speakers": {
      title: "Speakers",
      lead: "Open the full voice roster with ▶ preview.",
      controls: "Opens PockitVoiceVoicesUI modal.",
    },
    "voice-del-jarvis": {
      title: "Jarvis",
      lead: "Calm assistant delivery persona.",
      controls: "Sets selected TTS voice to Jarvis alias.",
    },
    "voice-del-warm": {
      title: "Warm host",
      lead: "Friendly conversational tone.",
      controls: "Sets warm_host voice alias.",
    },
    "voice-del-news": {
      title: "News anchor",
      lead: "Crisp broadcast delivery.",
      controls: "Sets news_anchor voice alias.",
    },
    "voice-ctl-talk": {
      title: "Talk",
      lead: "Start or stop the live microphone conversation.",
      controls: "Triggers the voice mic — same as the Talk footer pill.",
    },
    "voice-ctl-stop": {
      title: "Stop",
      lead: "Cancel in-flight playback, fetch, and TTS queue.",
      controls: "Calls ParakeetVoicePad.stopPlayback().",
    },
    "voice-ctl-clear": {
      title: "Clear log",
      lead: "Empties the on-screen transcript and conversation buffer.",
      controls: "Clears voice pad log.",
    },
    "voice-link-knowledge": {
      title: "Knowledge",
      lead: "Jump to the family RAG / knowledge cassette.",
      controls: "Navigates to #/c/knowledge.",
    },
    "voice-link-console": {
      title: "Voice console",
      lead: "Opens voice.localhost ops door in a new tab.",
      controls: "External operator surface.",
    },
    "voice-link-super-rick": {
      title: "Super Rick",
      lead: "Opens the COMP bridge status table with LED law at voice.localhost/super-rick.",
      controls: "External operator surface — install / wire / start probes.",
    },
    "voice-link-presence": {
      title: "The Presence",
      lead: "Cinematic TSL/SDF orb UI — embedded in this pad or at voice.localhost/ (⚙ settings first).",
      controls: "Switches the main canvas to The Presence iframe. Plan 0429 · does not replace Console Talk.",
    },
    "voice-h-m5": {
      title: "M5 edge health",
      lead: "Holler STT + TTS on this Mac answered a recent probe.",
      controls: "Read-only status tile.",
    },
    "voice-h-dgx": {
      title: "DGX stack health",
      lead: "Premium voice stack on Spark is reachable.",
      controls: "Read-only status tile.",
    },
    "voice-h-spark": {
      title: "Spark-TTS health",
      lead: "Emotion sidecar :8092 or native 0.5B :8093 when weights are installed.",
      controls: "Read-only status tile.",
    },
    "voice-h-rag": {
      title: "Grounded RAG health",
      lead: "Retrieve + Qdrant substrate responded.",
      controls: "Read-only status tile.",
    },
    "voice-h-stt": {
      title: "Whisper STT health",
      lead: "Transcription path is ready.",
      controls: "Read-only status tile.",
    },
    "voice-h-tts": {
      title: "Premium TTS health",
      lead: "Covenant TTS engines are up — not text-only fallback.",
      controls: "Read-only status tile.",
    },
    "voice-h-swarmer": {
      title: "Emotion swarmer",
      lead: "Four-agent parallel merge picks tone and prosody before speak. Skips on fast lane when configured.",
      controls: "Read-only COMP processor tile — mirrors orb processor strip.",
    },
    "voice-h-doublepass": {
      title: "Double-pass audit",
      lead: "Draft reply on fast model, optional DGX audit on prime. Fast lane skips audit when skip_on_fast is on.",
      controls: "Read-only COMP processor tile.",
    },
    "voice-h-barge": {
      title: "Barge-in",
      lead: "You can interrupt Nephew while audio is playing — aligns pad VAD with turn-taking config.",
      controls: "Read-only COMP processor tile.",
    },
    "voice-h-turn": {
      title: "Turn-taking",
      lead: "Silence-based end-of-utterance detection — when you stop speaking, the turn posts.",
      controls: "Read-only COMP processor tile.",
    },
    "voice-h-brain": {
      title: "Inference backend",
      lead: "Mac Ollama is the low-latency lane on this Mac; DGX Ollama is the premium WireGuard path.",
      controls: "Read-only COMP processor tile.",
    },
    "voice-h-higgs": {
      title: "Higgs Audio v3",
      lead: "DGX scaffold engine — not the M5 speak path. Holler on M5 is premium covenant TTS today.",
      controls: "Read-only COMP processor tile.",
    },
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function padState() {
    return global.ParakeetVoicePad?.getState?.() || {};
  }

  function itemStatus(item, st = padState()) {
    const h = st.health || st;
    if (item.type === "voice-route") {
      const r = item._voiceRoute;
      const active = st.route === r;
      const ok = r === "m5" ? Boolean(h.m5Healthy) : r === "dgx" ? Boolean(h.dgxHealthy || h.sttHealthy) : true;
      return {
        state: active ? "active" : ok ? "ok" : "bad",
        text: active ? "Selected" : ok ? "Available" : "Offline",
      };
    }
    if (item.type === "voice-mode") {
      const active = st.mode === item._voiceMode;
      return { state: active ? "active" : "ok", text: active ? "On" : "Off" };
    }
    if (item.type === "voice-rag") {
      const active = st.rag === item._voiceRag;
      return { state: active ? "active" : "ok", text: active ? "On" : "Off" };
    }
    if (item.type === "voice-voice") {
      const active = st.voice === item._voiceId;
      return { state: active ? "active" : "ok", text: active ? "Selected" : "Available" };
    }
    if (item.type === "voice-action") {
      if (item._voiceAction === "talk") {
        const on = Boolean(st.conversation);
        return { state: on ? "active" : "ok", text: on ? "Live" : "Ready" };
      }
      if (item._voiceAction === "prime") {
        const on = Boolean(st.prime);
        return { state: on ? "active" : "ok", text: on ? "On" : "Off" };
      }
      return { state: "ok", text: "Tap to run" };
    }
    if (item.type === "voice-health") {
      if (item._healthPending) return { state: "pending", text: "Checking…" };
      return { state: item._healthOk ? "ok" : "bad", text: item._healthOk ? "Healthy" : "Offline" };
    }
    if (item.type === "make-run" || item.type === "make-copy") {
      return { state: "ok", text: item.type === "make-run" ? "Run ▶" : "Copy ⌘" };
    }
    return { state: "pending", text: item.subtitle || "" };
  }

  function statusDetail(item, st = padState()) {
    const base = itemStatus(item, st);
    const sub = item.subtitle ? String(item.subtitle) : "";
    if (item.type === "voice-route" && st.route === "auto" && item._voiceRoute === "auto") {
      const eff = st.effectiveRoute || (st.health?.m5Healthy ? "m5" : "dgx");
      return `${base.text} → ${eff}${sub ? ` · ${sub}` : ""}`;
    }
    if (item.type === "voice-route" || item.type === "voice-mode" || item.type === "voice-rag") {
      const hint = sub || base.text;
      return base.state === "active" ? `On · ${hint}` : `Off · ${hint}`;
    }
    if (item.type === "voice-action") {
      if (item._voiceAction === "talk" && st.conversation) return `Live · ${sub || "Mic open"}`;
      if (item._voiceAction === "prime") return st.prime ? `On · ${sub || "Deep RAG"}` : `Off · ${sub || "Tap to enable"}`;
    }
    if (item.type === "voice-voice" && st.voice && item._voiceId === st.voice) {
      return `${base.text}${sub ? ` · ${sub}` : ""}`;
    }
    if (item.type === "voice-health") {
      return sub || base.text;
    }
    return sub ? `${base.text} · ${sub}` : base.text;
  }

  function infoButtonHtml(infoKey, label) {
    return `<button type="button" class="voice-rail-info-btn" data-voice-info-id="${esc(infoKey)}" aria-label="${esc(label || "About this control")}" data-comet-tip="${esc(`${label || "About"}\nTap for full explanation`)}">${INFO_EYE_SVG}</button>`;
  }

  function sectionInfoButton(sectionName) {
    if (!SECTION_INFO[sectionName]) return "";
    return infoButtonHtml(`section:${sectionName}`, `About ${sectionName}`);
  }

  function leafExtrasHtml(c) {
    const voiceTypes = new Set([
      "voice-action", "voice-route", "voice-mode", "voice-rag", "voice-voice", "voice-health", "make-run", "make-copy",
    ]);
    if (!voiceTypes.has(c.type)) return { led: "", status: "", info: "" };
    const infoKey = c.id || "";
    const info = infoButtonHtml(infoKey, `About ${c.title || infoKey}`);
    const st = itemStatus(c);
    const sub = c.subtitle || st.text;
    return {
      led: `<span class="voice-rail-led voice-rail-led--${esc(st.state)}" aria-hidden="true"></span>`,
      status: `<span class="voice-rail-status" data-voice-status-id="${esc(c.id)}" data-default-subtitle="${esc(c.subtitle || "")}">${esc(sub)}</span>`,
      info,
    };
  }

  function modalSpecForKey(key, st = padState()) {
    if (key.startsWith("section:")) {
      const name = key.slice(8);
      const sec = SECTION_INFO[name];
      if (!sec) return null;
      return {
        title: sec.title,
        kicker: sec.kicker,
        variant: "voice",
        bodyHtml: `<p class="pockit-pill-modal__lead">${esc(sec.lead)}</p>
          <ul class="pockit-pill-modal__list">${(sec.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`,
        actions: [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    if (key.startsWith("make-")) {
      const makeId = key.replace(/^make-/, "");
      const el = document.querySelector(`[data-id="${key}"]`);
      const cmd = el?.querySelector("[data-make-cmd]")?.getAttribute("data-make-cmd") || `make ${makeId}`;
      return {
        title: el?.querySelector(".sidebar-label-text")?.textContent?.trim() || makeId,
        kicker: "Stack · Make target",
        variant: "voice",
        bodyHtml: `<p class="pockit-pill-modal__lead">Runs an operator Make target on the tower — output appears in the rail log below.</p>
          <p><strong>Command:</strong> <code>${esc(cmd)}</code></p>
          <p><strong>Status:</strong> ${el?.querySelector(".voice-rail-status")?.textContent?.trim() || "Ready"}</p>`,
        actions: [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    const item = ITEM_INFO[key];
    if (!item) {
      return {
        title: key,
        kicker: "Voice rail",
        variant: "voice",
        body: "No detailed help entry yet.",
        actions: [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    let statusLine = "";
    const statusEl = document.querySelector(`[data-voice-status-id="${key}"]`);
    if (statusEl?.textContent) statusLine = statusEl.textContent.trim();
    else if (key.startsWith("voice-h-")) {
      const el = document.querySelector(`[data-id="${key}"]`);
      statusLine = el?.classList.contains("is-pending")
        ? "Checking stack…"
        : el?.classList.contains("is-ok")
          ? "Healthy"
          : "Offline";
    } else {
      const route = key.replace("voice-ctl-route-", "");
      if (key.startsWith("voice-ctl-route-")) {
        statusLine = statusDetail({ type: "voice-route", _voiceRoute: route, subtitle: "" }, st);
      }
    }
    return {
      title: item.title,
      kicker: key.startsWith("voice-h-") ? "Stack health" : "Voice control",
      variant: "voice",
      bodyHtml: `<p class="pockit-pill-modal__lead">${esc(item.lead)}</p>
        <p><strong>Status:</strong> ${esc(statusLine || "—")}</p>
        <p><strong>Controls:</strong> ${esc(item.controls)}</p>`,
      actions: [{ label: "Close", primary: true, action: () => {} }],
    };
  }

  function openInfo(key) {
    const spec = modalSpecForKey(key);
    if (!spec) return;
    global.PockitPlayerContextPills?.openPillModal?.(spec);
  }

  function bindInfoButtons(rootSelector) {
    document.querySelectorAll(`${rootSelector} [data-voice-info-id]`).forEach((btn) => {
      if (btn.dataset.voiceInfoBound === "1") return;
      btn.dataset.voiceInfoBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openInfo(btn.getAttribute("data-voice-info-id") || "");
      });
    });
  }

  function syncChrome(st = padState()) {
    const roots = ["#player-rail-content", "#sidebar-content"];
    for (const sel of roots) {
      const root = document.querySelector(sel);
      if (!root) continue;
      root.querySelectorAll(".sidebar-item[data-id]").forEach((li) => {
        const id = li.getAttribute("data-id");
        const type = li.getAttribute("data-voice-type");
        if (!id) return;
        const item = {
          id,
          type: type || li.querySelector("[data-voice-route]") ? "voice-route"
            : li.querySelector("[data-voice-mode]") ? "voice-mode"
            : li.querySelector("[data-voice-rag]") ? "voice-rag"
            : li.querySelector("[data-voice-id]") ? "voice-voice"
            : li.querySelector("[data-voice-action]") ? "voice-action"
            : li.classList.contains("sidebar-item--voice-health") ? "voice-health"
            : li.classList.contains("sidebar-item--command") ? "make-run"
            : "",
          _voiceRoute: li.querySelector("[data-voice-route]")?.getAttribute("data-voice-route"),
          _voiceMode: li.querySelector("[data-voice-mode]")?.getAttribute("data-voice-mode"),
          _voiceRag: li.querySelector("[data-voice-rag]")?.getAttribute("data-voice-rag"),
          _voiceId: li.querySelector("[data-voice-id]")?.getAttribute("data-voice-id"),
          _voiceAction: li.querySelector("[data-voice-action]")?.getAttribute("data-voice-action"),
          _healthOk: li.classList.contains("is-ok"),
          _healthPending: li.classList.contains("is-pending"),
          subtitle: li.querySelector(".voice-rail-status")?.getAttribute("data-default-subtitle") || "",
        };
        if (!item.type) return;
        const stat = itemStatus(item, st);
        const led = li.querySelector(".voice-rail-led");
        if (led) led.className = `voice-rail-led voice-rail-led--${stat.state}`;
        const statusEl = li.querySelector(`[data-voice-status-id="${id}"]`);
        if (statusEl) statusEl.textContent = statusDetail(item, st);
        const main = li.querySelector(".sidebar-item-main");
        if (main) {
          main.classList.toggle("active", stat.state === "active");
          if (item._voiceRoute) main.classList.toggle("active", st.route === item._voiceRoute);
          if (item._voiceMode) main.classList.toggle("active", st.mode === item._voiceMode);
          if (item._voiceRag) main.classList.toggle("active", st.rag === item._voiceRag);
          if (item._voiceId) main.classList.toggle("active", st.voice === item._voiceId);
          if (item._voiceAction === "prime") main.classList.toggle("active", Boolean(st.prime));
          if (item._voiceAction === "talk") main.classList.toggle("active", Boolean(st.conversation));
        }
      });
    }
  }

  global.VoiceRailInfo = {
    sectionInfoButton,
    infoButtonHtml,
    leafExtrasHtml,
    bindInfoButtons,
    syncChrome,
    openInfo,
    itemStatus,
    statusDetail,
  };
})(window);
