/** Plan 0187 — Global Pockit operator config (chrome auto-hide, defaults, cinema mode). */
(function () {
  const STORAGE_KEY = "nephew-pockit-config";
  const POCKIT_SETTINGS_ID = "pockit";
  const IDLE_MS = 3200;
  const REVEAL_MS = 2400;
  const EDGE_PX = 28;
  const FOCUS_EDGE_PX = 36;

  const AUTO_HIDE_OPTIONS = [
    { value: "off", label: "Always visible" },
    { value: "on_idle", label: "Hide when idle (edge to reveal)" },
    { value: "always", label: "Hidden until edge hover" },
  ];

  const DEFAULTS = {
    schema_version: 1,
    chrome: {
      player_rail: { collapsed: false, auto_hide: "off" },
      cassette_rail: { collapsed: false, auto_hide: "off" },
      main_header: { auto_hide: "off" },
      main_footer: { auto_hide: "off" },
    },
    filter: { default_scope: "all", default_player: "" },
    theme: { mode: "light" },
    focus: { cinema_mode: false },
    runtime: { always_on_stack: false },
    about: { rack_open: true, rag_open: true, privacy_open: true },
  };

  let config = null;
  let railControls = null;
  let idleTimer = null;
  let revealTimer = null;
  let cinemaActive = false;
  let focusRevealTimer = null;
  /** @type {{ bottomCollapsed: boolean } | null} */
  let preFocusSnapshot = null;

  const FOCUS_REVEAL_CLASSES = [
    "pockit-focus-reveal-top",
    "pockit-focus-reveal-bottom",
    "pockit-focus-reveal-left",
    "pockit-focus-reveal-right",
  ];

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function deepMerge(base, patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
        out[k] = deepMerge(base[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  function migrateLegacy(stored) {
    const patch = { ...stored };
    if (localStorage.getItem("nephew-hub-player-rail-collapsed") === "1") {
      patch.chrome = patch.chrome || {};
      patch.chrome.player_rail = { ...(patch.chrome.player_rail || {}), collapsed: true };
    }
    if (
      localStorage.getItem("nephew-hub-cassette-rail-collapsed") === "1" ||
      localStorage.getItem("nephew-hub-sidebar-collapsed") === "1"
    ) {
      patch.chrome = patch.chrome || {};
      patch.chrome.cassette_rail = { ...(patch.chrome.cassette_rail || {}), collapsed: true };
    }
    const scope = localStorage.getItem("nephew-pockit-scope") || localStorage.getItem("nephew-launchpad-scope");
    if (scope) {
      patch.filter = { ...(patch.filter || {}), default_scope: scope };
    }
    const player = localStorage.getItem("nephew-pockit-player") || localStorage.getItem("nephew-launchpad-player");
    if (player) {
      patch.filter = { ...(patch.filter || {}), default_player: player };
    }
    const theme = localStorage.getItem("nephew-hub-theme");
    if (theme) {
      patch.theme = { ...(patch.theme || {}), mode: theme };
    }
    return patch;
  }

  function load() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      stored = {};
    }
    if (!stored.schema_version) {
      stored = migrateLegacy(stored);
    }
    config = deepMerge(DEFAULTS, stored);
    config.schema_version = 1;
    return config;
  }

  function save(next) {
    config = deepMerge(DEFAULTS, next || config);
    config.schema_version = 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    syncLegacyKeys(config);
    window.dispatchEvent(new CustomEvent("nephew-pockit-config", { detail: { config } }));
    return config;
  }

  function get() {
    if (!config) load();
    return config;
  }

  function syncLegacyKeys(cfg) {
    try {
      localStorage.setItem("nephew-hub-player-rail-collapsed", cfg.chrome.player_rail.collapsed ? "1" : "0");
      localStorage.setItem("nephew-hub-cassette-rail-collapsed", cfg.chrome.cassette_rail.collapsed ? "1" : "0");
      if (cfg.filter.default_scope) localStorage.setItem("nephew-pockit-scope", cfg.filter.default_scope);
      if (cfg.filter.default_player) localStorage.setItem("nephew-pockit-player", cfg.filter.default_player);
      else localStorage.removeItem("nephew-pockit-player");
      if (cfg.theme.mode) localStorage.setItem("nephew-hub-theme", cfg.theme.mode);
    } catch {
      /* ignore quota */
    }
  }

  function shouldAutoHide(part, cinema) {
    if (cinema) return true;
    if (!part || part.auto_hide === "off") return false;
    if (document.body.classList.contains("pockit-chrome-reveal")) return false;
    return part.auto_hide === "always" || part.auto_hide === "on_idle";
  }

  function bodyClassesFor(cfg) {
    const c = cfg || get();
    const cinema = Boolean(c.focus.cinema_mode);
    const revealing = document.body.classList.contains("pockit-chrome-reveal");

    document.body.classList.toggle("pockit-cinema-mode", cinema);
    document.body.classList.toggle(
      "pockit-chrome-hide-player-rail",
      !c.chrome.player_rail.collapsed && shouldAutoHide(c.chrome.player_rail, cinema),
    );
    document.body.classList.toggle(
      "pockit-chrome-hide-cassette-rail",
      !c.chrome.cassette_rail.collapsed && shouldAutoHide(c.chrome.cassette_rail, cinema),
    );
    document.body.classList.toggle("pockit-chrome-hide-header", shouldAutoHide(c.chrome.main_header, cinema));
    if (!cinema) document.body.classList.remove("pockit-focus-mode");
    document.body.classList.remove("pockit-chrome-hide-footer");
    document.body.classList.toggle("pockit-chrome-reveal-active", revealing && !cinema);
    window.PadSurface?.ensureVersionChrome?.();
    window.PadSurface?.syncVersionBadgePlacement?.();
    window.PadSurface?.syncFloatedBadgeOffset?.();
  }

  function scheduleIdleHide() {
    clearTimeout(idleTimer);
    const cfg = get();
    if (document.body.classList.contains("hero-mode")) return;
    const anyIdle = ["player_rail", "cassette_rail"].some((k) => cfg.chrome[k]?.auto_hide === "on_idle")
      || cfg.chrome.main_header?.auto_hide === "on_idle"
      || cfg.chrome.main_footer?.auto_hide === "on_idle";
    if (!anyIdle && !cfg.focus.cinema_mode) return;
    idleTimer = window.setTimeout(() => {
      document.body.classList.remove("pockit-chrome-reveal");
      bodyClassesFor(cfg);
    }, IDLE_MS);
  }

  function revealChromeBriefly() {
    document.body.classList.add("pockit-chrome-reveal");
    bodyClassesFor(get());
    clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      document.body.classList.remove("pockit-chrome-reveal");
      bodyClassesFor(get());
      scheduleIdleHide();
    }, REVEAL_MS);
  }

  function clearFocusHandleReveal() {
    clearTimeout(focusRevealTimer);
    document.body.classList.remove(...FOCUS_REVEAL_CLASSES);
  }

  function focusEdgeZone(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const hits = [];
    if (y <= FOCUS_EDGE_PX) hits.push({ id: "top", dist: y });
    if (y >= h - FOCUS_EDGE_PX) hits.push({ id: "bottom", dist: h - y });
    if (x <= FOCUS_EDGE_PX) hits.push({ id: "left", dist: x });
    if (x >= w - FOCUS_EDGE_PX) hits.push({ id: "right", dist: w - x });
    if (!hits.length) return null;
    hits.sort((a, b) => a.dist - b.dist);
    return hits[0].id;
  }

  function setFocusHandleReveal(edge) {
    clearFocusHandleReveal();
    if (edge) document.body.classList.add(`pockit-focus-reveal-${edge}`);
  }

  function onFocusPointerActivity(e) {
    const x = e.clientX ?? 0;
    const y = e.clientY ?? 0;
    const edge = focusEdgeZone(x, y);
    clearTimeout(focusRevealTimer);
    if (edge) {
      setFocusHandleReveal(edge);
      return;
    }
    focusRevealTimer = window.setTimeout(clearFocusHandleReveal, 420);
  }

  function restorePreFocusChrome() {
    if (!preFocusSnapshot) return;
    window.PockitBottomChrome?.setBottomChrome?.(preFocusSnapshot.bottomCollapsed, { persist: false });
    if (typeof preFocusSnapshot.topCollapsed === "boolean") {
      window.PockitTopChrome?.setTopChrome?.(preFocusSnapshot.topCollapsed, { persist: false });
    }
    if (typeof preFocusSnapshot.playerRailCollapsed === "boolean" && railControls?.setPlayerRailCollapsed) {
      railControls.setPlayerRailCollapsed(preFocusSnapshot.playerRailCollapsed, { persist: false });
    }
    if (typeof preFocusSnapshot.cassetteRailCollapsed === "boolean" && railControls?.setCassetteRailCollapsed) {
      railControls.setCassetteRailCollapsed(preFocusSnapshot.cassetteRailCollapsed, { persist: false });
    }
    preFocusSnapshot = null;
  }

  function enterFocusChrome() {
    preFocusSnapshot = {
      bottomCollapsed: window.PockitBottomChrome?.isBottomChromeCollapsed?.() ?? false,
      topCollapsed: window.PockitTopChrome?.isTopChromeCollapsed?.() ?? false,
      playerRailCollapsed: railControls?.isPlayerRailCollapsed?.() ?? false,
      cassetteRailCollapsed: railControls?.isCassetteRailCollapsed?.() ?? false,
    };
    window.PockitTopChrome?.setTopChrome?.(true, { persist: false });
    window.PockitBottomChrome?.setBottomChrome?.(true, { persist: false });
    if (railControls?.setPlayerRailCollapsed) railControls.setPlayerRailCollapsed(true, { persist: false });
    if (railControls?.setCassetteRailCollapsed) railControls.setCassetteRailCollapsed(true, { persist: false });
    clearFocusHandleReveal();
  }

  function exitFocusChrome() {
    clearFocusHandleReveal();
    restorePreFocusChrome();
  }

  function onPointerActivity(e) {
    const cfg = get();
    if (document.body.classList.contains("hero-mode")) return;
    if (document.body.classList.contains("pockit-focus-mode")) {
      onFocusPointerActivity(e);
      return;
    }
    const y = e.clientY ?? 0;
    const x = e.clientX ?? 0;
    const w = window.innerWidth;
    const nearEdge =
      y <= EDGE_PX ||
      y >= window.innerHeight - EDGE_PX ||
      x <= EDGE_PX ||
      x >= w - EDGE_PX;
    const anyAuto =
      cfg.focus.cinema_mode ||
      Object.values(cfg.chrome).some((part) => part.auto_hide && part.auto_hide !== "off");
    if (nearEdge && anyAuto) {
      revealChromeBriefly();
      return;
    }
    if (cfg.focus.cinema_mode) return;
    document.body.classList.add("pockit-chrome-reveal");
    bodyClassesFor(cfg);
    scheduleIdleHide();
  }

  function startIdleWatcher() {
    stopIdleWatcher();
    document.addEventListener("mousemove", onPointerActivity, { passive: true });
    document.addEventListener("touchstart", onPointerActivity, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    scheduleIdleHide();
  }

  function stopIdleWatcher() {
    clearTimeout(idleTimer);
    clearTimeout(revealTimer);
    document.removeEventListener("mousemove", onPointerActivity);
    document.removeEventListener("touchstart", onPointerActivity);
    document.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key !== "Escape") return;
    const cfg = get();
    if (!cfg.focus.cinema_mode && !document.body.classList.contains("pockit-cinema-mode")) return;
    cfg.focus.cinema_mode = false;
    cinemaActive = false;
    document.body.classList.remove("pockit-focus-mode");
    exitFocusChrome();
    save(cfg);
    apply(cfg);
  }

  function registerRailControls(controls) {
    railControls = controls;
    const cfg = get();
    if (railControls?.setPlayerRailCollapsed) {
      railControls.setPlayerRailCollapsed(Boolean(cfg.chrome.player_rail.collapsed), { persist: false });
    }
    if (railControls?.setCassetteRailCollapsed) {
      railControls.setCassetteRailCollapsed(Boolean(cfg.chrome.cassette_rail.collapsed), { persist: false });
    }
  }

  // Voice App Mode Rails — Phase 7: Focus = cinema (rails/header hide) + suite bar
  // hidden + footer slid down. Drawer handles hide too; edge hover reveals the
  // handle tab for that edge only (not full chrome).
  function togglePockitFocusMode(force) {
    const cfg = get();
    const next = typeof force === "boolean" ? force : !cfg.focus.cinema_mode;
    if (next) enterFocusChrome();
    else exitFocusChrome();
    cfg.focus.cinema_mode = next;
    cinemaActive = next;
    document.body.classList.toggle("pockit-focus-mode", next);
    save(cfg);
    apply(cfg);
    window.__pockitSyncChromeChip?.();
    return next;
  }

  function apply(next) {
    const cfg = next ? save(next) : get();
    bodyClassesFor(cfg);
    if (railControls?.setPlayerRailCollapsed) {
      railControls.setPlayerRailCollapsed(Boolean(cfg.chrome.player_rail.collapsed), { persist: false });
    }
    if (railControls?.setCassetteRailCollapsed) {
      railControls.setCassetteRailCollapsed(Boolean(cfg.chrome.cassette_rail.collapsed), { persist: false });
    }
    startIdleWatcher();
    window.__pockitSyncChromeChip?.();
    return cfg;
  }

  function renderSelect(key, label, value, options, desc) {
    const opts = options
      .map((o) => `<option value="${esc(o.value)}" ${String(value) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`)
      .join("");
    const hint = desc ? `<small class="cs-field-desc">${esc(desc)}</small>` : "";
    return `<label class="cs-field"><span class="cs-field-label">${esc(label)}</span>${hint}<select class="pc-pref" data-pc-key="${esc(key)}">${opts}</select></label>`;
  }

  function renderToggle(key, label, checked, desc) {
    const hint = desc ? `<small class="cs-field-desc">${esc(desc)}</small>` : "";
    return `<label class="cs-field cs-field--toggle"><span class="cs-field-label">${esc(label)}</span>${hint}<input type="checkbox" class="pc-pref" data-pc-key="${esc(key)}" ${checked ? "checked" : ""} /></label>`;
  }

  function renderAboutPanels() {
    return `<section class="cs-section" id="pc-about-section"><h2>ℹ About Nephew</h2>
      <details class="cs-card pc-about-panel" open>
        <summary><strong>Family Office Rack System</strong></summary>
        <p class="cs-hint">Four racks share one Pockit frame without colliding: <strong>RAG</strong> (Brain A library shelves on Qdrant), <strong>Stack</strong> (Container Deck compose grids), <strong>Cassette</strong> (hosted tapes on the player rail), and <strong>Model</strong> (Hermes, embeddings, Python sidecars on DGX). Each workload gets an isolated slot — docker networks, allowlisted actions, collection-scoped retrieve.</p>
      </details>
      <details class="cs-card pc-about-panel" open>
        <summary><strong>Family RAG — the product heart</strong></summary>
        <p class="cs-hint">Nephew indexes rules, plans, clinic, Historia, cassettes, and your sovereign vault on family hardware. Query via <code>POST /api/v1/retrieve</code> or open the Knowledge HUD.</p>
        <p class="cs-hint"><a href="#/c/knowledge">Open Knowledge cassette →</a></p>
      </details>
      <details class="cs-card pc-about-panel" open>
        <summary><strong>Privacy &amp; AI</strong></summary>
        <p class="cs-hint"><strong>Sovereign (default):</strong> local Ollama/Hermes on DGX — nothing leaves the house unless you opt in.</p>
        <p class="cs-hint"><strong>BYOK (optional):</strong> wire your own provider API keys at the Nephew boundary for Claude/GPT/etc. Keys stay local; never committed to git.</p>
      </details>
      <details class="cs-card pc-about-panel">
        <summary><strong>iPhone — Add to Home Screen</strong></summary>
        <p class="cs-hint">On home Wi‑Fi: Safari → <strong>http://pockit.localhost/</strong> → Share → <strong>Add to Home Screen</strong>. Opens standalone Pockit with the phone shell; your last cassette route restores on next tap.</p>
        <p class="cs-hint">Away from home: WireGuard on iPhone, then <strong>https://jailynmarvin.com/</strong>. Native App Store app is Phase 2 — see docs/pockit/Pockit-iOS-App-Prototype.md.</p>
      </details>
    </section>`;
  }

  function renderSettingsPage() {
    const cfg = get();
    const runtime = cfg.runtime || DEFAULTS.runtime;
    return `<article class="cassette-settings-page pockit-config-page"><header class="cs-hero">
      <button type="button" class="comet-btn comet-btn--ghost" id="pc-back">← Back</button>
      <div class="cs-hero-title"><span class="cs-glyph">⚙</span><div><h1>Pockit Config</h1><p class="cs-hero-sub">Your layout · chrome auto-hide · defaults</p></div></div>
      <button type="button" class="comet-btn comet-btn--primary" id="pc-save">Save</button></header>
      <div class="cs-sections">
        <section class="cs-section"><h2>🎬 Focus</h2><div class="cs-card">
          ${renderToggle("focus.cinema_mode", "Cinema mode (hide all chrome)", cfg.focus.cinema_mode, "Esc exits cinema mode. Maximizes cassette canvas.")}
        </div></section>
        <section class="cs-section"><h2>↔ Rails</h2><div class="cs-card">
          ${renderToggle("chrome.player_rail.collapsed", "Start with Consoles rail collapsed", cfg.chrome.player_rail.collapsed)}
          ${renderSelect("chrome.player_rail.auto_hide", "Consoles rail auto-hide", cfg.chrome.player_rail.auto_hide, AUTO_HIDE_OPTIONS, "Left rail — consoles and Accessory apps.")}
          ${renderToggle("chrome.cassette_rail.collapsed", "Start with Cartridges rail collapsed", cfg.chrome.cassette_rail.collapsed)}
          ${renderSelect("chrome.cassette_rail.auto_hide", "Cartridges rail auto-hide", cfg.chrome.cassette_rail.auto_hide, AUTO_HIDE_OPTIONS, "Right rail — tape list.")}
        </div></section>
        <section class="cs-section"><h2>▤ Chrome</h2><div class="cs-card">
          ${renderSelect("chrome.main_header.auto_hide", "Main header auto-hide", cfg.chrome.main_header.auto_hide, AUTO_HIDE_OPTIONS, "Breadcrumb + actions bar. When on, a chip shows in the header — not a broken UI.")}
          ${renderSelect("chrome.main_footer.auto_hide", "Main footer auto-hide", cfg.chrome.main_footer.auto_hide, AUTO_HIDE_OPTIONS, "Health pills + version bar. Edge-hover reveals chrome.")}
        </div></section>
        <section class="cs-section"><h2>🔧 Defaults</h2><div class="cs-card">
          ${renderSelect("filter.default_scope", "Default door filter", cfg.filter.default_scope, [
            { value: "all", label: "All doors" },
            { value: "local", label: "Local only" },
            { value: "web", label: "Web only" },
          ])}
          <label class="cs-field"><span class="cs-field-label">Default console filter</span><small class="cs-field-desc">Empty = All consoles</small><input type="text" class="pc-pref" data-pc-key="filter.default_player" value="${esc(cfg.filter.default_player || "")}" placeholder="e.g. nephew-deck" /></label>
          ${renderSelect("theme.mode", "Theme", cfg.theme.mode, [
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "auto", label: "Follow system" },
          ])}
        </div></section>
        <section class="cs-section" id="pc-stack-section"><h2>🖥 Always-on stack</h2><div class="cs-card">
          <p class="cs-hint" id="pc-stack-status">Checking local stack daemon…</p>
          ${renderToggle(
            "runtime.always_on_stack",
            "Keep Pockit stack running between app clicks",
            runtime.always_on_stack,
            "Installs a Mac LaunchAgent (or Linux systemd timer) — same as make install-pockit-stack-daemon. Gateway + tower-api stay up for mobile and faster daily boot.",
          )}
          <p class="cs-hint" id="pc-stack-detail"></p>
        </div></section>
        <section class="cs-section"><h2>📋 Backup</h2><div class="cs-card">
          <button type="button" class="comet-btn comet-btn--ghost" id="pc-export">Copy JSON</button>
          <button type="button" class="comet-btn comet-btn--ghost" id="pc-reset">Reset to defaults</button>
          <p class="cs-hint" id="pc-export-status"></p>
        </div></section>
        ${renderAboutPanels()}
      </div></article>`;
  }

  function collectFromRoot(root) {
    const next = deepMerge(DEFAULTS, get());
    root.querySelectorAll(".pc-pref").forEach((el) => {
      const key = el.getAttribute("data-pc-key");
      if (!key) return;
      const parts = key.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] || {};
        cur = cur[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      if (el.type === "checkbox") cur[leaf] = el.checked;
      else cur[leaf] = el.value;
    });
    return next;
  }

  async function fetchStackDaemonStatus() {
    const r = await fetch("/api/v1/runtime/pockit-stack-daemon", { credentials: "include", cache: "no-store" });
    if (r.status === 404) {
      return { hidden: false, api_missing: true, manageable: false };
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.error || `HTTP ${r.status}`);
      err.status = r.status;
      err.body = j;
      throw err;
    }
    return j;
  }

  async function applyStackDaemon(enabled) {
    const r = await fetch("/api/v1/runtime/pockit-stack-daemon", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.error || j.detail || `HTTP ${r.status}`);
      err.status = r.status;
      err.body = j;
      throw err;
    }
    return j;
  }

  function formatStackStatus(st) {
    if (!st) return { hidden: true };
    if (st.api_missing) {
      return {
        hidden: false,
        line: "Always-on stack API not loaded yet — run make doors on this Mac, then hard refresh.",
        detail: "CLI fallback: make install-pockit-stack-daemon",
        checked: false,
        disabled: true,
      };
    }
    if (st.hidden) return { hidden: true };
    if (!st.manageable) {
      return {
        hidden: false,
        line: "Always-on stack can only be configured on this Mac or Linux host.",
        detail: "",
        checked: false,
        disabled: true,
      };
    }
    const installed = Boolean(st.installed && st.active);
    const health = st.stack_health;
    const healthLine = health?.ok
      ? "Stack healthy (gateway + tower-api)."
      : health
        ? "Stack daemon installed — last health check reported issues."
        : "Daemon status loaded.";
    return {
      hidden: false,
      line: installed
        ? `Always-on stack active (${st.label || "daemon"} · every ${st.interval_seconds || 300}s). ${healthLine}`
        : `Always-on stack off. ${healthLine}`,
      detail: st.log_path ? `Log: ${st.log_path}` : "",
      checked: installed,
      disabled: false,
    };
  }

  async function refreshStackDaemonUi(root) {
    const section = root.querySelector("#pc-stack-section");
    const statusEl = root.querySelector("#pc-stack-status");
    const detailEl = root.querySelector("#pc-stack-detail");
    const toggle = root.querySelector('.pc-pref[data-pc-key="runtime.always_on_stack"]');
    if (!section || !statusEl) return;

    try {
      const st = await fetchStackDaemonStatus();
      const view = formatStackStatus(st);
      if (view.hidden) {
        section.hidden = true;
        return;
      }
      section.hidden = false;
      statusEl.textContent = view.line;
      if (detailEl) detailEl.textContent = view.detail;
      if (toggle) {
        toggle.checked = view.checked;
        toggle.disabled = view.disabled;
        const cfg = get();
        cfg.runtime = cfg.runtime || {};
        cfg.runtime.always_on_stack = view.checked;
        config = cfg;
      }
    } catch (err) {
      section.hidden = false;
      if (err.status === 401 || err.status === 403) {
        statusEl.textContent = "Sign in as a Family Office operator to manage the always-on stack.";
        if (toggle) toggle.disabled = true;
        return;
      }
      statusEl.textContent = `Could not load stack daemon status: ${err.message || err}`;
      if (toggle) toggle.disabled = true;
    }
  }

  function bindSettingsPage(root, hooks) {
    root.querySelector("#pc-back")?.addEventListener("click", () => hooks.onBack?.());
    refreshStackDaemonUi(root);
    root.querySelector('.pc-pref[data-pc-key="runtime.always_on_stack"]')?.addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      const statusEl = root.querySelector("#pc-stack-status");
      const prev = !enabled;
      e.target.disabled = true;
      if (statusEl) statusEl.textContent = enabled ? "Installing always-on stack…" : "Removing always-on stack…";
      try {
        const st = await applyStackDaemon(enabled);
        const cfg = get();
        cfg.runtime = cfg.runtime || {};
        cfg.runtime.always_on_stack = Boolean(st.installed && st.active);
        save(cfg);
        const view = formatStackStatus(st);
        if (statusEl) statusEl.textContent = view.line;
        const detailEl = root.querySelector("#pc-stack-detail");
        if (detailEl) detailEl.textContent = view.detail;
        e.target.checked = cfg.runtime.always_on_stack;
      } catch (err) {
        e.target.checked = prev;
        if (statusEl) {
          statusEl.textContent = `Stack daemon change failed: ${err.message || err}`;
        }
      } finally {
        e.target.disabled = false;
      }
    });
    root.querySelector("#pc-save")?.addEventListener("click", async () => {
      const next = collectFromRoot(root);
      apply(next);
      if (window.PockitSettingsRenderer) {
        const delta = await window.PockitSettingsRenderer.collectExtendedSettings(root);
        const results = await window.PockitSettingsRenderer.applyPockitSettings(delta);
        if (results.errors?.length) {
          const st = root.querySelector("#pc-export-status");
          if (st) st.textContent = results.errors.join("; ");
        }
      }
      hooks.onApplied?.(next);
      const st = root.querySelector("#pc-export-status");
      if (st && !st.textContent) {
        st.textContent = "Saved — layout applied.";
        window.setTimeout(() => { if (st.textContent === "Saved — layout applied.") st.textContent = ""; }, 2500);
      }
    });
    root.querySelector("#pc-export")?.addEventListener("click", async () => {
      const json = JSON.stringify(get(), null, 2);
      const st = root.querySelector("#pc-export-status");
      try {
        await navigator.clipboard.writeText(json);
        if (st) st.textContent = "Config JSON copied to clipboard.";
      } catch {
        if (st) st.textContent = json;
      }
    });
    root.querySelector("#pc-reset")?.addEventListener("click", () => {
      if (!window.confirm("Reset Pockit Config to defaults?")) return;
      localStorage.removeItem(STORAGE_KEY);
      config = null;
      load();
      apply(get());
      hooks.onBack?.();
    });
  }

  const BASE_SETTINGS_MODAL_TABS = [
    { id: "layout", label: "Layout", icon: "LayoutOutlined" },
    { id: "appearance", label: "Appearance", icon: "BgColorsOutlined" },
    { id: "devices", label: "Devices", icon: "MobileOutlined" },
    { id: "focus", label: "Focus", icon: "CompressOutlined" },
    { id: "system", label: "System", icon: "CloudServerOutlined" },
    { id: "about", label: "About", icon: "InfoCircleOutlined" },
  ];
  const SETTINGS_MODAL_TABS = window.PockitSettingsRenderer
    ? window.PockitSettingsRenderer.mergeSettingsTabs(BASE_SETTINGS_MODAL_TABS)
    : BASE_SETTINGS_MODAL_TABS;

  function renderSettingsModalTabPanel(tabId) {
    const extended = window.PockitSettingsRenderer?.renderExtendedTabPanel(tabId);
    if (extended) return extended;
    const cfg = get();
    const runtime = cfg.runtime || DEFAULTS.runtime;
    if (tabId === "layout") {
      return `<div class="pockit-settings-pane">
        <h3 class="pockit-settings-pane__title">Rails</h3>
        <div class="cs-card">
          ${renderToggle("chrome.player_rail.collapsed", "Start with Consoles rail collapsed", cfg.chrome.player_rail.collapsed)}
          ${renderSelect("chrome.player_rail.auto_hide", "Consoles rail auto-hide", cfg.chrome.player_rail.auto_hide, AUTO_HIDE_OPTIONS, "Left rail — consoles and Accessory apps.")}
          ${renderToggle("chrome.cassette_rail.collapsed", "Start with Cartridges rail collapsed", cfg.chrome.cassette_rail.collapsed)}
          ${renderSelect("chrome.cassette_rail.auto_hide", "Cartridges rail auto-hide", cfg.chrome.cassette_rail.auto_hide, AUTO_HIDE_OPTIONS, "Right rail — tape list.")}
        </div>
        <h3 class="pockit-settings-pane__title">Toolbar chrome</h3>
        <div class="cs-card">
          ${renderSelect("chrome.main_header.auto_hide", "Main header auto-hide", cfg.chrome.main_header.auto_hide, AUTO_HIDE_OPTIONS, "Breadcrumb + actions bar.")}
          ${renderSelect("chrome.main_footer.auto_hide", "Main footer auto-hide", cfg.chrome.main_footer.auto_hide, AUTO_HIDE_OPTIONS, "Health pills + version bar.")}
        </div>
      </div>`;
    }
    if (tabId === "appearance") {
      return `<div class="pockit-settings-pane">
        <h3 class="pockit-settings-pane__title">Theme & defaults</h3>
        <div class="cs-card">
          ${renderSelect("theme.mode", "Theme", cfg.theme.mode, [
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "auto", label: "Follow system" },
          ])}
          ${renderSelect("filter.default_scope", "Default door filter", cfg.filter.default_scope, [
            { value: "all", label: "All doors" },
            { value: "local", label: "Local only" },
            { value: "web", label: "Web only" },
          ])}
          <label class="cs-field"><span class="cs-field-label">Default console filter</span><small class="cs-field-desc">Empty = All consoles</small><input type="text" class="pc-pref" data-pc-key="filter.default_player" value="${esc(cfg.filter.default_player || "")}" placeholder="e.g. nephew-deck" /></label>
        </div>
      </div>`;
    }
    if (tabId === "focus") {
      return `<div class="pockit-settings-pane">
        <h3 class="pockit-settings-pane__title">Focus mode</h3>
        <div class="cs-card">
          ${renderToggle("focus.cinema_mode", "Cinema mode (hide all chrome)", cfg.focus.cinema_mode, "Esc exits cinema mode. Maximizes cassette canvas.")}
        </div>
      </div>`;
    }
    if (tabId === "devices") {
      return window.PockitDeviceLab?.renderPanelHtml?.()
        || `<div class="pockit-settings-pane"><p class="cs-hint">Device Lab loading…</p></div>`;
    }
    if (tabId === "system") {
      return `<div class="pockit-settings-pane">
        <h3 class="pockit-settings-pane__title">Always-on stack</h3>
        <div class="cs-card" id="pc-stack-section">
          <p class="cs-hint" id="pc-stack-status">Checking local stack daemon…</p>
          ${renderToggle(
            "runtime.always_on_stack",
            "Keep Pockit stack running between app clicks",
            runtime.always_on_stack,
            "Gateway + tower-api stay up for mobile and faster daily boot.",
          )}
          <p class="cs-hint" id="pc-stack-detail"></p>
        </div>
        <h3 class="pockit-settings-pane__title">Backup</h3>
        <div class="cs-card">
          <button type="button" class="comet-btn comet-btn--ghost" id="pc-export">Copy JSON</button>
          <button type="button" class="comet-btn comet-btn--ghost" id="pc-reset">Reset to defaults</button>
          <p class="cs-hint" id="pc-export-status"></p>
        </div>
      </div>`;
    }
    if (tabId === "about") {
      return `<div class="pockit-settings-pane">${renderAboutPanels()}</div>`;
    }
    return `<div class="pockit-settings-pane"><p class="cs-hint">Choose a settings section on the left.</p></div>`;
  }

  function bindSettingsTabActions(content, tabId) {
    if (!content) return;
    if (window.PockitSettingsRenderer?.extendedTabIds().includes(tabId)) {
      window.PockitSettingsRenderer.bindExtendedTabActions(content, tabId);
      return;
    }
    if (tabId === "devices") {
      window.PockitViewportRegistry?.load?.().then(() => {
        window.PockitDeviceLab?.bindPanel?.(content);
      });
      return;
    }
    if (tabId !== "system") return;
    refreshStackDaemonUi(content);
    const stackToggle = content.querySelector('.pc-pref[data-pc-key="runtime.always_on_stack"]');
    if (stackToggle && stackToggle.dataset.stackBound !== "1") {
      stackToggle.dataset.stackBound = "1";
      stackToggle.addEventListener("change", async (e) => {
        const enabled = e.target.checked;
        const statusEl = content.querySelector("#pc-stack-status");
        const prev = !enabled;
        e.target.disabled = true;
        if (statusEl) statusEl.textContent = enabled ? "Installing always-on stack…" : "Removing always-on stack…";
        try {
          const st = await applyStackDaemon(enabled);
          const cfg = get();
          cfg.runtime = cfg.runtime || {};
          cfg.runtime.always_on_stack = Boolean(st.installed && st.active);
          save(cfg);
          const view = formatStackStatus(st);
          if (statusEl) statusEl.textContent = view.line;
          const detailEl = content.querySelector("#pc-stack-detail");
          if (detailEl) detailEl.textContent = view.detail;
          e.target.checked = cfg.runtime.always_on_stack;
        } catch (err) {
          e.target.checked = prev;
          if (statusEl) statusEl.textContent = `Stack daemon change failed: ${err.message || err}`;
        } finally {
          e.target.disabled = false;
        }
      });
    }
    const exportBtn = content.querySelector("#pc-export");
    if (exportBtn && exportBtn.dataset.bound !== "1") {
      exportBtn.dataset.bound = "1";
      exportBtn.addEventListener("click", async () => {
        const json = JSON.stringify(get(), null, 2);
        const st = content.querySelector("#pc-export-status");
        try {
          await navigator.clipboard.writeText(json);
          if (st) st.textContent = "Config JSON copied to clipboard.";
        } catch {
          if (st) st.textContent = json;
        }
      });
    }
    const resetBtn = content.querySelector("#pc-reset");
    if (resetBtn && resetBtn.dataset.bound !== "1") {
      resetBtn.dataset.bound = "1";
      resetBtn.addEventListener("click", () => {
        if (!window.confirm("Reset Pockit Config to defaults?")) return;
        localStorage.removeItem(STORAGE_KEY);
        config = null;
        load();
        apply(get());
      });
    }
  }

  function bindSettingsModalPanel(root, hooks) {
    if (root.dataset.settingsModalPanelBound === "1") return;
    root.dataset.settingsModalPanelBound = "1";
    root.querySelector("#pc-save")?.addEventListener("click", async () => {
      const next = collectFromRoot(root);
      apply(next);
      if (window.PockitSettingsRenderer) {
        const delta = await window.PockitSettingsRenderer.collectExtendedSettings(root);
        const results = await window.PockitSettingsRenderer.applyPockitSettings(delta);
        if (results.errors?.length) {
          const st = root.querySelector("#pc-export-status");
          if (st) st.textContent = results.errors.join("; ");
        }
      }
      hooks.onApplied?.(next);
      const st = root.querySelector("#pc-export-status");
      if (st && !st.textContent) {
        st.textContent = "Saved — layout applied.";
        window.setTimeout(() => { if (st.textContent === "Saved — layout applied.") st.textContent = ""; }, 2500);
      }
    });
  }

  function mountSettingsPage(hooks) {
    return { html: renderSettingsPage(), bind: (root) => bindSettingsPage(root, hooks) };
  }

  function setRailCollapsed(side, collapsed, { persist = true } = {}) {
    const cfg = get();
    if (side === "player") cfg.chrome.player_rail.collapsed = collapsed;
    else cfg.chrome.cassette_rail.collapsed = collapsed;
    if (persist) save(cfg);
    else config = cfg;
  }

  load();

  window.PockitConfig = {
    POCKIT_SETTINGS_ID,
    STORAGE_KEY,
    load,
    save,
    get,
    apply,
    togglePockitFocusMode,
    registerRailControls,
    setRailCollapsed,
    startIdleWatcher,
    stopIdleWatcher,
    renderSettingsPage,
    bindSettingsPage,
    mountSettingsPage,
    SETTINGS_MODAL_TABS,
    renderSettingsModalTabPanel,
    bindSettingsModalPanel,
    bindSettingsTabActions,
    DEFAULTS,
  };
})();
