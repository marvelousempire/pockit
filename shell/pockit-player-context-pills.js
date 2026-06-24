/** Plan Voice App Mode — footer context pills + player-scoped control row. */
(function (global) {
  const registry = new Map();
  const footerRegistry = new Map();
  let boundHost = null;
  let boundFooterHost = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function register(scope, factory) {
    registry.set(scope, factory);
  }

  function registerFooterControls(scope, factory) {
    footerRegistry.set(scope, factory);
  }

  function pillsForScope(scope) {
    const factories = [];
    if (registry.has("*")) factories.push(registry.get("*"));
    if (scope && registry.has(scope)) factories.push(registry.get(scope));
    const out = [];
    const seen = new Set();
    for (const fn of factories) {
      const batch = typeof fn === "function" ? fn() : [];
      for (const pill of batch || []) {
        if (!pill?.id || seen.has(pill.id)) continue;
        seen.add(pill.id);
        out.push(pill);
      }
    }
    return out;
  }

  function footerControlsForScope(scope) {
    const factories = [];
    if (footerRegistry.has("*")) factories.push(footerRegistry.get("*"));
    if (scope && footerRegistry.has(scope)) factories.push(footerRegistry.get(scope));
    const playerScope = global.POCKIT_PLAYER ? `player:${global.POCKIT_PLAYER}` : null;
    if (playerScope && footerRegistry.has(playerScope)) factories.push(footerRegistry.get(playerScope));
    const out = [];
    const seen = new Set();
    for (const fn of factories) {
      const batch = typeof fn === "function" ? fn() : [];
      for (const ctrl of batch || []) {
        if (!ctrl?.id || seen.has(ctrl.id)) continue;
        seen.add(ctrl.id);
        out.push(ctrl);
      }
    }
    return out;
  }

  const FOOTER_GROUP_META = {
    navigate: { label: "Go to", hint: "Switch cassettes" },
    session: { label: "Voice session", hint: "Talk, route, and mode" },
    player: { label: "Player", hint: "Active console scope" },
    actions: { label: "Actions", hint: "" },
  };

  const PILL_SECTION_ORDER = ["processor", "device", "voice"];
  const PILL_SECTION_META = {
    processor: { label: "Processor", hint: "Silicon in the family stack" },
    device: { label: "Device", hint: "Form factor — this session vs fleet" },
    voice: { label: "Voice route", hint: "Live talk path" },
  };

  function pillSectionMeta(sectionId) {
    const fromCatalog = global.PockitSystemStatus?.sections?.[sectionId];
    const fallback = PILL_SECTION_META[sectionId] || { label: sectionId, hint: "" };
    return {
      label: fromCatalog?.label || fallback.label,
      hint: fromCatalog?.hint || fallback.hint,
    };
  }

  function groupPills(pills) {
    const unsectioned = [];
    const map = new Map();
    for (const pill of pills) {
      const section = pill.section || "";
      if (!section) {
        unsectioned.push(pill);
        continue;
      }
      if (!map.has(section)) map.set(section, []);
      map.get(section).push(pill);
    }
    const sections = PILL_SECTION_ORDER.filter((id) => map.has(id)).map((id) => ({
      id,
      pills: map.get(id),
    }));
    for (const [id, batch] of map) {
      if (!PILL_SECTION_ORDER.includes(id)) sections.push({ id, pills: batch });
    }
    return { unsectioned, sections };
  }

  function renderPillSection(sectionId, pills) {
    const meta = pillSectionMeta(sectionId);
    return `<section class="shell-footer-status-section" data-status-section="${esc(sectionId)}" aria-label="${esc(meta.label)}">
      <div class="shell-footer-section-head shell-footer-status-section__head">
        <span class="shell-footer-section-label">${esc(meta.label)}</span>
        ${meta.hint ? `<span class="shell-footer-section-hint">${esc(meta.hint)}</span>` : ""}
      </div>
      <span class="shell-player-context-pills shell-footer-rectangles__group" role="group" aria-label="${esc(meta.label)}">${pills.map(renderPill).join("")}</span>
    </section>`;
  }

  function groupFooterControls(controls) {
    const order = [];
    const map = new Map();
    for (const ctrl of controls) {
      const g = ctrl.group || "actions";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g).push(ctrl);
    }
    return order.map((id) => ({ id, controls: map.get(id) }));
  }

  function renderFooterControlSection(groupId, controls) {
    const meta = FOOTER_GROUP_META[groupId] || { label: groupId, hint: "" };
    return `<section class="shell-footer-controls__section" data-footer-group="${esc(groupId)}" aria-label="${esc(meta.label)}">
      <div class="shell-footer-section-head">
        <span class="shell-footer-section-label">${esc(meta.label)}</span>
        ${meta.hint ? `<span class="shell-footer-section-hint">${esc(meta.hint)}</span>` : ""}
      </div>
      <div class="shell-footer-controls__buttons" role="group" aria-label="${esc(meta.label)}">
        ${controls.map(renderFooterControl).join("")}
      </div>
    </section>`;
  }

  function renderLedLegend() {
    if (global.PockitLedLaw?.renderLegend) {
      return global.PockitLedLaw.renderLegend({ title: "LED law" });
    }
    const tip = "Red = not installed · Orange = installed not wired · Yellow = wired not started · Blue = ready to start · Green = started active";
    return `<div class="shell-footer-led-legend pockit-led-law" aria-label="Pockit LED status law" data-comet-tip="${esc(tip)}">
      <span class="pockit-led-law__title">LED law</span>
      <span class="pockit-led-law__item"><span class="pockit-led-law__dot pockit-led-law__dot--red" aria-hidden="true"></span>Missing</span>
      <span class="pockit-led-law__item"><span class="pockit-led-law__dot pockit-led-law__dot--orange" aria-hidden="true"></span>Unwired</span>
      <span class="pockit-led-law__item"><span class="pockit-led-law__dot pockit-led-law__dot--yellow" aria-hidden="true"></span>Stopped</span>
      <span class="pockit-led-law__item"><span class="pockit-led-law__dot pockit-led-law__dot--blue" aria-hidden="true"></span>Ready</span>
      <span class="pockit-led-law__item"><span class="pockit-led-law__dot pockit-led-law__dot--green" aria-hidden="true"></span>Active</span>
    </div>`;
  }

  function renderPill(pill) {
    const state = pill.state || "pending";
    const tip = pill.tip || pill.label || "";
    const active = state === "active" ? ' aria-pressed="true"' : "";
    return `<button type="button" class="shell-health-pill shell-health-pill--action shell-health-pill--${esc(state)}" data-pill-id="${esc(pill.id)}" data-comet-tip="${esc(tip)}"${active} aria-label="${esc(pill.label)}">
      <span class="shell-health-pill__led" aria-hidden="true"></span>
      <span class="shell-health-pill__label">${esc(pill.label)}</span>
    </button>`;
  }

  function renderFooterControl(ctrl) {
    const state = ctrl.state || "pending";
    const tip = ctrl.tip || ctrl.label || "";
    const active = state === "active" ? ' aria-pressed="true"' : "";
    return `<button type="button" class="shell-player-control shell-player-control--${esc(state)}" data-footer-control-id="${esc(ctrl.id)}" data-comet-tip="${esc(tip)}"${active} aria-label="${esc(ctrl.label)}">
      <span class="shell-player-control__led" aria-hidden="true"></span>
      <span class="shell-player-control__label">${esc(ctrl.label)}</span>
    </button>`;
  }

  function render(scope) {
    const pills = pillsForScope(scope);
    if (!pills.length) return "";
    const { unsectioned, sections } = groupPills(pills);
    const unsectionedHtml = unsectioned.length
      ? `<span class="shell-player-context-pills shell-footer-rectangles__group shell-footer-rectangles__group--inline" aria-label="Session">${unsectioned.map(renderPill).join("")}</span>`
      : "";
    const sectionsHtml = sections.map((s) => renderPillSection(s.id, s.pills)).join("");
    return `<div class="shell-footer-status-wrap">
      <div class="shell-footer-section-head shell-footer-status-wrap__head">
        <span class="shell-footer-section-label">System status</span>
        <span class="shell-footer-section-hint">Tap a pill for details</span>
      </div>
      ${unsectionedHtml}
      <div class="shell-footer-status-sections">${sectionsHtml}</div>
    </div>${renderLedLegend()}`;
  }

  function renderFooterControls(scope) {
    const controls = footerControlsForScope(scope);
    if (!controls.length) return "";
    const sections = groupFooterControls(controls)
      .map((g) => renderFooterControlSection(g.id, g.controls))
      .join("");
    return `<div class="shell-footer-controls__row shell-footer-pills__group" aria-label="Player actions">${sections}</div>`;
  }

  function closePillModal() {
    const el = document.getElementById("pockit-pill-modal");
    if (el?._pillModalKeyHandler) {
      document.removeEventListener("keydown", el._pillModalKeyHandler);
    }
    el?.remove();
  }

  function openPillModal(spec) {
    closePillModal();
    const variant = spec.variant ? ` pockit-pill-modal__panel--${esc(spec.variant)}` : "";
    const kicker = spec.kicker || "Family Office";
    const actions = (spec.actions || []).map((a, i) => ({ ...a, _idx: i }));
    actions.sort((a, b) => Number(!!a.primary) - Number(!!b.primary));
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay pockit-pill-modal comet-overlay-open";
    overlay.id = "pockit-pill-modal";
    overlay.innerHTML = `
      <div class="modal pockit-pill-modal__panel comet-modal-open${variant}" role="dialog" aria-modal="true" aria-labelledby="pockit-pill-modal-title">
        <header class="pockit-pill-modal__header">
          <div class="pockit-pill-modal__title-block">
            <span class="pockit-pill-modal__kicker">${esc(kicker)}</span>
            <h2 class="pockit-pill-modal__title" id="pockit-pill-modal-title">${esc(spec.title || "Control")}</h2>
          </div>
          <button type="button" class="pockit-pill-modal__close" aria-label="Close">×</button>
        </header>
        <div class="pockit-pill-modal__body">${spec.bodyHtml || `<p class="pockit-pill-modal__lead">${esc(spec.body || "")}</p>`}</div>
        <footer class="pockit-pill-modal__footer">
          ${actions.map((a) => `<button type="button" class="comet-btn ${a.primary ? "comet-btn--primary" : "comet-btn--ghost"}" data-pill-modal-action="${a._idx}">${esc(a.label)}</button>`).join("")}
        </footer>
      </div>`;
    overlay._pillModalKeyHandler = (e) => {
      if (e.key === "Escape") closePillModal();
    };
    overlay.querySelector(".pockit-pill-modal__close")?.addEventListener("click", closePillModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePillModal();
    });
    overlay.querySelectorAll("[data-pill-modal-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-pill-modal-action"));
        const action = spec.actions?.[idx]?.action;
        closePillModal();
        if (typeof action === "function") action();
      });
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", overlay._pillModalKeyHandler);
    overlay.querySelector(".pockit-pill-modal__close")?.focus();
  }

  async function buildAdvisorPillModal(pill) {
    const advisor = global.VoiceSystemAdvisor;
    if (!advisor?.buildAdvisorReport) return pillModalSpec(pill);
    const report = await advisor.buildAdvisorReport({ force: true });
    const rec = report.recommendation || {};
    const st = global.ParakeetVoicePad?.getState?.() || {};

    if (pill.id === "m5") {
      const online = Boolean(report.m5Healthy);
      const isRecommended = rec.route === "m5";
      return {
        title: "M5 voice edge",
        kicker: "Voice route",
        variant: "m5",
        bodyHtml: `<div class="pockit-advisor-report">
          <p class="pockit-advisor-host"><strong>${esc(report.hostLabel)}</strong>${report.hostDetail ? ` — ${esc(report.hostDetail)}` : ""}</p>
          ${rec.reasonHtml || ""}
          <ul class="pockit-pill-modal__list">
            <li>M5 Holler: <strong>${online ? "Online" : "Offline"}</strong></li>
            <li>Active route: <strong>${esc(st.route || "auto")}</strong>${st.route === "auto" ? ` → ${esc(report.effectiveRoute)}` : ""}</li>
            <li>Advisor: <strong>${esc(rec.headline || "M5 edge")}</strong> (${esc(rec.confidence || "medium")} confidence)</li>
          </ul>
          <p class="pockit-advisor-status">${esc(report.statusLine || "")}</p>
        </div>`,
        actions: online
          ? [
              { label: isRecommended ? "Use M5 (recommended)" : "Route via M5", primary: true, action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "m5" }) },
              { label: "Use Auto", action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "auto" }) },
              { label: "Close", action: () => {} },
            ]
          : [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    if (pill.id === "dgx") {
      const online = Boolean(report.dgxHealthy || report.sttHealthy);
      const isRecommended = rec.route === "dgx";
      return {
        title: "DGX Spark route",
        kicker: "Voice route",
        variant: "dgx",
        bodyHtml: `<div class="pockit-advisor-report">
          <p class="pockit-advisor-host"><strong>${esc(report.hostLabel)}</strong>${report.hostDetail ? ` — ${esc(report.hostDetail)}` : ""}</p>
          ${rec.reasonHtml || ""}
          <ul class="pockit-pill-modal__list">
            <li>DGX premium stack: <strong>${online ? "Online" : "Offline"}</strong></li>
            <li>Active route: <strong>${esc(st.route || "auto")}</strong>${st.route === "auto" ? ` → ${esc(report.effectiveRoute)}` : ""}</li>
            <li>Advisor: <strong>${esc(rec.headline || "DGX Spark")}</strong> (${esc(rec.confidence || "medium")} confidence)</li>
            <li>Deploy: <code>make deploy-voice-premium-dgx</code></li>
          </ul>
          <p class="pockit-advisor-status">${esc(report.statusLine || "")}</p>
        </div>`,
        actions: online
          ? [
              { label: isRecommended ? "Use DGX (recommended)" : "Route via DGX", primary: true, action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "dgx" }) },
              { label: "Use Auto", action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "auto" }) },
              { label: "Close", action: () => {} },
            ]
          : [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    return pillModalSpec(pill);
  }

  async function buildAutoRouteModal() {
    const advisor = global.VoiceSystemAdvisor;
    if (!advisor?.buildAdvisorReport) {
      return {
        title: "Auto route",
        bodyHtml: "<p>M5 first when healthy on this machine, otherwise DGX Spark.</p>",
        actions: [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    const report = await advisor.buildAdvisorReport({ force: true });
    const rec = report.recommendation || {};
    return {
      title: "Auto route — system advisor",
      kicker: "Voice route",
      variant: "voice",
      bodyHtml: `<div class="pockit-advisor-report">
        <p class="pockit-advisor-host"><strong>${esc(report.hostLabel)}</strong>${report.hostDetail ? ` — ${esc(report.hostDetail)}` : ""}</p>
        ${rec.reasonHtml || ""}
        <p><strong>Recommended:</strong> ${esc(rec.headline || rec.route)} (${esc(rec.confidence || "medium")} confidence)</p>
        <p class="pockit-advisor-status">${esc(report.statusLine || "")}</p>
      </div>`,
      actions: [
        { label: "Enable Auto", primary: true, action: () => {
          global.ParakeetVoicePad?.dispatchControl?.({ route: "auto" });
          advisor.applyAutoRouteIfNeeded?.();
        }},
        rec.route === "m5" ? { label: "Pin M5", action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "m5" }) }
          : rec.route === "dgx" ? { label: "Pin DGX", action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "dgx" }) }
          : null,
        { label: "Close", action: () => {} },
      ].filter(Boolean),
    };
  }

  function pillModalSpec(pill) {
    if (pill.modal) return pill.modal;
    if (pill.id === "focus") {
      const focusOn = Boolean(global.PockitConfig?.get?.()?.focus?.cinema_mode);
      return {
        title: "Focus mode",
        kicker: "Player",
        variant: "focus",
        bodyHtml: `<p class="pockit-pill-modal__lead"><strong>Focus</strong> hides the suite bar, both side rails, the center toolbar, and slides the bottom footer away so the canvas fills the screen.</p>
          <ul class="pockit-pill-modal__list">
            <li>Press <kbd>Esc</kbd> or click Focus again to restore chrome.</li>
            <li>Move the pointer to any screen edge to reveal that edge's drawer handle.</li>
            <li>Universal across every player — not tied to Voice or DustPan.</li>
          </ul>`,
        actions: [
          { label: focusOn ? "Exit Focus" : "Enter Focus", primary: true, action: () => global.PockitConfig?.togglePockitFocusMode?.() },
          { label: "Close", action: () => {} },
        ],
      };
    }
    if (pill.id === "m5") {
      const st = global.ParakeetVoicePad?.getState?.() || {};
      const h = st.health || {};
      const online = Boolean(h.m5Healthy);
      return {
        title: "M5 voice edge",
        kicker: "Voice route",
        variant: "m5",
        bodyHtml: `<p class="pockit-pill-modal__lead"><strong>M5</strong> is your Mac-local voice stack: Whisper STT + Holler TTS on this machine.</p>
          <ul class="pockit-pill-modal__list">
            <li>Status: <strong>${online ? "Online" : "Offline"}</strong></li>
            <li>Best for Grok-class latency when you tap Talk.</li>
            <li>Runs on-device — no cloud rent, no vendor lock-in.</li>
            <li>Install: <code>make ensure-m5-voice</code> from the Voice Stack rail.</li>
          </ul>`,
        actions: online
          ? [
              { label: "Route voice via M5", primary: true, action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "m5" }) },
              { label: "Close", action: () => {} },
            ]
          : [
              { label: "Close", primary: true, action: () => {} },
            ],
      };
    }
    if (pill.id === "dgx") {
      const st = global.ParakeetVoicePad?.getState?.() || {};
      const h = st.health || {};
      const online = Boolean(h.dgxHealthy || h.sttHealthy);
      return {
        title: "DGX Spark route",
        kicker: "Voice route",
        variant: "dgx",
        bodyHtml: `<p class="pockit-pill-modal__lead"><strong>DGX</strong> sends voice work to your NVIDIA Spark: premium Kokoro / Spark-TTS voices and deep RAG.</p>
          <ul class="pockit-pill-modal__list">
            <li>Status: <strong>${online ? "Online" : "Offline"}</strong></li>
            <li>Full 28+ voice roster when the premium stack is healthy.</li>
            <li>Deploy from the Stack rail: <code>make deploy-voice-premium-dgx</code>.</li>
          </ul>`,
        actions: online
          ? [
              { label: "Route voice via DGX", primary: true, action: () => global.ParakeetVoicePad?.dispatchControl?.({ route: "dgx" }) },
              { label: "Close", action: () => {} },
            ]
          : [
              { label: "Close", primary: true, action: () => {} },
            ],
      };
    }
    if (pill.id === "text" || pill.id === "voice-text") {
      return {
        title: "Text-only mode",
        bodyHtml: `<p>Premium TTS is offline. Nephew can still chat in text, but spoken replies may be unavailable until Holler or Spark-TTS is healthy again.</p>`,
        actions: [{ label: "Close", primary: true, action: () => {} }],
      };
    }
    return {
      title: pill.label || "Control",
      body: pill.tip || "No description available.",
      actions: pill.action
        ? [{ label: "Apply", primary: true, action: pill.action }, { label: "Close", action: () => {} }]
        : [{ label: "Close", primary: true, action: () => {} }],
    };
  }

  function bind(hostEl, scope) {
    if (!hostEl) return;
    boundHost = hostEl;
    const root = hostEl.querySelector(".shell-footer-rectangles") || hostEl;
    root.querySelectorAll(".shell-health-pill--action[data-pill-id]").forEach((btn) => {
      if (btn.dataset.pillBound === "1") return;
      btn.dataset.pillBound = "1";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-pill-id");
        const pill = pillsForScope(scope).find((p) => p.id === id);
        if (!pill) return;
        if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
        if (pill.id === "m5" || pill.id === "dgx" || pill.id === "proc-m5" || pill.id === "proc-dgx") {
          const routePill = { ...pill, id: pill.id.replace(/^proc-/, "") };
          openPillModal(await buildAdvisorPillModal(routePill));
          return;
        }
        if (pill.modal) {
          openPillModal(pill.modal);
          return;
        }
        openPillModal(pillModalSpec(pill));
      });
    });
  }

  function bindFooterControls(hostEl, scope) {
    if (!hostEl) return;
    boundFooterHost = hostEl;
    const root = hostEl.querySelector(".shell-footer-pills") || hostEl;
    root.querySelectorAll(".shell-player-control[data-footer-control-id]").forEach((btn) => {
      if (btn.dataset.footerControlBound === "1") return;
      btn.dataset.footerControlBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-footer-control-id");
        const ctrl = footerControlsForScope(scope).find((c) => c.id === id);
        const inPhoneChrome = window.isPhoneChromeEl?.(btn);
        if (ctrl?.modal) {
          if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
          openPillModal(ctrl.modal);
          return;
        }
        ctrl?.action?.(btn);
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
      });
    });
  }

  function refresh(scope) {
    if (!boundHost) return;
    const host = boundHost.querySelector("#main-footer-rectangles")
      || boundHost.querySelector(".shell-footer-rectangles");
    if (!host) return;
    const pills = pillsForScope(scope);
    if (!pills.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = render(scope);
    bind(boundHost, scope);
    global.CometTooltip?.refresh?.(boundHost);
  }

  function refreshFooterControls(scope) {
    if (!boundFooterHost) return;
    const inner = boundFooterHost.querySelector(".shell-footer-pills__inner");
    if (!inner) return;
    const controls = footerControlsForScope(scope);
    inner.querySelector(".shell-footer-controls__row")?.remove();
    if (!controls.length) return;
    const mount = document.createElement("div");
    mount.innerHTML = renderFooterControls(scope);
    const voiceStatus = inner.querySelector("#voice-footer-status");
    while (mount.firstChild) {
      inner.insertBefore(mount.firstChild, voiceStatus);
    }
    bindFooterControls(boundFooterHost, scope);
    global.CometTooltip?.refresh?.(boundFooterHost);
  }

  function pillStateFromCheck(c) {
    if (!c) return "pending";
    if (c.ok === false || c.status === "error") return "bad";
    if (c.status === "warning" || c.degraded) return "warn";
    if (c.ok === true || c.ok == null) return "ok";
    return "pending";
  }

  function familyHealthPill(id, fallbackLabel) {
    const checks = global.__pockitFamilyHealthChecks || {};
    const c = checks[id] || Object.values(checks).find((x) => x?.label === fallbackLabel);
    const label = c?.label || fallbackLabel;
    const detail = c?.detail || "Live status from the family gateway";
    return {
      id: `health-${id}`,
      label,
      state: pillStateFromCheck(c),
      tip: `${label}\n${detail}`,
    };
  }

  register("*", () => {
    const focusOn = Boolean(global.PockitConfig?.get?.()?.focus?.cinema_mode);
    const pills = [{
      id: "focus",
      label: "Focus",
      state: focusOn ? "active" : "pending",
      tip: "Focus mode\nHide chrome — footer slides away; edge hover reveals handles; Esc to exit",
    }];
    const sys = global.PockitSystemStatus?.pillsSync?.() || [];
    global.PockitSystemStatus?.scheduleFleetRefresh?.();
    return pills.concat(sys);
  });

  register("overview", () => [
    familyHealthPill("player", "Player"),
    familyHealthPill("web", "Family site"),
    familyHealthPill("directory", "Tape grid"),
  ]);

  register("web-odysseus", () => [
    { id: "odysseus-spark", label: "Spark", state: "pending", tip: "DGX Spark\nOdysseus stack host — stack health from odysseus.localhost" },
    { id: "odysseus-dgx", label: "DGX", state: "pending", tip: "DGX brain\nHeavy models and RAG for Odysseus chat" },
    { id: "odysseus-ifaces", label: "Interfaces", state: "pending", tip: "Interfaces\nChroma, Ollama, and upstream API doors" },
  ]);

  register("voice", () => global.PockitSystemStatus?.voiceRoutePills?.() || []);

  registerFooterControls("voice", () => {
    const st = global.ParakeetVoicePad?.getState?.() || {};
    const id = typeof global.currentCassetteId === "function" ? global.currentCassetteId() : "";
    const onVoice = id === "voice" || id === "voice-cassette" || st.conversation;
    const nav = [
      {
        id: "overview-apps",
        label: "Apps",
        group: "navigate",
        state: onVoice ? "ok" : "active",
        tip: "Apps overview\nAll cartridges — your home screen",
        action: () => global.setCassette?.("overview"),
      },
      {
        id: "overview-voice",
        label: global.VoiceAppDisplay?.alias || "Rick",
        group: "navigate",
        state: onVoice ? "active" : "ok",
        tip: `${global.VoiceAppDisplay?.name || "Super Rick"}\nLive talk with Nephew on this cassette`,
        action: () => global.setCassette?.("voice"),
      },
      {
        id: "overview-library",
        label: "Library",
        group: "navigate",
        state: "ok",
        tip: "Family library\nPlayers, tapes, and shared resources",
        action: () => global.setCassette?.("library"),
      },
    ];
    const voiceControls = [
      {
        id: "voice-talk",
        label: "Talk",
        group: "session",
        state: st.conversation ? "active" : "ok",
        tip: "Talk\nStart or end a live voice conversation",
        action: () => global.ParakeetVoicePad?.dispatchControl?.({ action: "talk" }),
      },
      {
        id: "voice-route-auto",
        label: "Auto",
        group: "session",
        state: st.route === "auto" ? "active" : "ok",
        tip: "Auto route\nAdvisor picks M5 on this Mac or DGX Spark",
        action: () => {
          global.ParakeetVoicePad?.dispatchControl?.({ route: "auto" });
          global.VoiceSystemAdvisor?.applyAutoRouteIfNeeded?.();
        },
      },
      {
        id: "voice-mode-chat",
        label: "Chat",
        group: "session",
        state: st.mode === "chat" ? "active" : "ok",
        tip: "Chat mode\nConversational back-and-forth with Nephew",
        action: () => global.ParakeetVoicePad?.dispatchControl?.({ mode: "chat" }),
      },
      {
        id: "voice-prime",
        label: "Prime",
        group: "session",
        state: st.prime ? "active" : "ok",
        tip: "Prime mode\nDeep RAG and largest models for harder questions",
        action: () => global.ParakeetVoicePad?.dispatchControl?.({ action: "prime" }),
      },
    ];
    return [...nav, ...voiceControls];
  });

  registerFooterControls("overview", () => [
    {
      id: "overview-apps",
      label: "Apps",
      group: "navigate",
      state: "active",
      tip: "Apps overview\nAll cassettes — your home screen",
      action: () => global.setCassette?.("overview"),
    },
    {
      id: "overview-voice",
      label: global.VoiceAppDisplay?.alias || "Rick",
      group: "navigate",
      state: "ok",
      tip: `${global.VoiceAppDisplay?.name || "Super Rick"}\nLive talk with Nephew`,
      action: () => global.setCassette?.("voice"),
    },
    {
      id: "overview-library",
      label: "Library",
      group: "navigate",
      state: "ok",
      tip: "Family library\nPlayers, tapes, and shared resources",
      action: () => global.setCassette?.("library"),
    },
    {
      id: "voice-talk",
      label: "Talk",
      group: "session",
      state: global.ParakeetVoicePad?.getState?.()?.conversation ? "active" : "ok",
      tip: "Talk\nOpen Voice and start a live conversation",
      action: () => {
        global.setCassette?.("voice");
        global.ParakeetVoicePad?.dispatchControl?.({ action: "talk" });
      },
    },
  ]);

  registerFooterControls("library", () => [
    {
      id: "library-back",
      label: "Apps",
      group: "navigate",
      state: "ok",
      tip: "Apps overview\nReturn to all cassettes",
      action: () => global.setCassette?.("overview"),
    },
  ]);

  registerFooterControls("*", () => {
    const playerId = typeof global.PockitQuickBarHooks?.getPlayer === "function"
      ? global.PockitQuickBarHooks.getPlayer()
      : global.POCKIT_PLAYER;
    if (!playerId || playerId === "pockit") return [];
    const catalog = typeof global.PockitQuickBarHooks?.getCatalog === "function"
      ? global.PockitQuickBarHooks.getCatalog()
      : global.POCKIT_CATALOG;
    const player = catalog?.players?.find((p) => p.id === playerId);
    if (!player) return [];
    return [
      {
        id: `player-home-${playerId}`,
        label: player.name || playerId,
        group: "player",
        state: "active",
        tip: `${player.name || playerId}\nActive player filter for this console`,
        action: () => global.openPlayerHome?.(playerId),
      },
      {
        id: `player-overview-${playerId}`,
        label: "All apps",
        group: "player",
        state: "ok",
        tip: "All apps\nShow every player in the overview",
        action: () => global.setCassette?.("overview"),
      },
    ];
  });

  global.PockitPlayerContextPills = {
    register,
    registerFooterControls,
    render,
    renderFooterControls,
    renderLedLegend,
    bind,
    bindFooterControls,
    refresh,
    refreshFooterControls,
    pillsForScope,
    footerControlsForScope,
    openPillModal,
  };
})(window);
