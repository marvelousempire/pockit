/**
 * Family Office Suite — Adobe CC–style app strip + CleanMyMac-style welcome.
 * Periodic-table tiles: big letter + little letter, version as mass.
 */
"use strict";

(function () {
  const WELCOME_KEY = "pockit.suite.welcome.v1";

  function suiteVersion() {
    return window.PockitSurface?.version || window.PadSurface?.version || "—";
  }

  function massFromVersion(ver) {
    const v = String(ver || "").replace(/^v/, "");
    const parts = v.split(".");
    if (parts.length >= 3) return `${parts[1]}.${parts[2]}`;
    if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
    return v || "—";
  }

  function symbolFromName(name) {
    const n = String(name || "App").trim();
    if (n.length <= 2) return n;
    return n[0].toUpperCase() + (n[1] || "").toLowerCase();
  }

  /** Resolve hue from exported catalog (Crayola → HSL); fallback to static hue. */
  function suiteAppHue(app) {
    const cat = window.POCKIT_CATALOG;
    const player = cat?.players?.find((p) => p.id === app.id);
    if (player?.hue != null) return Number(player.hue);
    if (app.id === "voice") {
      const voice = cat?.console_hues?.switcher_apps?.voice;
      if (voice?.hue != null) return Number(voice.hue);
    }
    return app.hue;
  }

  /** @type {Array<{id:string,name:string,symbol:string,mass?:string,hue:number,blurb:string,action:string,loadId?:string,href?:string}>} */
  const SUITE_APPS = [
    {
      id: "pockit",
      name: "Pockit",
      symbol: "Po",
      hue: 204,
      blurb: "Player console — cassettes, voice, daily boot",
      action: "overview",
      loadId: "overview",
    },
    {
      id: "nephew-deck",
      name: "Nephew",
      symbol: "Ne",
      hue: 144,
      blurb: "Control Tower — fleet, infra, spark status",
      action: "load",
      loadId: "nephew-deck",
    },
    {
      id: "automata",
      name: "Automata",
      symbol: "Au",
      hue: 267,
      blurb: "Belief engine, pad, product schemas",
      action: "player",
      loadId: "automata",
    },
    {
      id: "historia",
      name: "Historia",
      symbol: "Hi",
      hue: 25,
      blurb: "Memory lake, vault, live capture",
      action: "load",
      loadId: "historia",
    },
    {
      id: "voice",
      name: "Voice",
      symbol: "Vo",
      hue: 337,
      blurb: "Parakeet — talk to Nephew on-device",
      action: "load",
      loadId: "voice",
    },
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function elementTile(app, { large = false, active = false } = {}) {
    const mass = app.mass || (app.id === "pockit" ? massFromVersion(suiteVersion()) : "—");
    const sym = app.symbol || symbolFromName(app.name);
    const cls = `suite-element${large ? " suite-element--lg" : ""}${active ? " is-active" : ""}`;
    return `
      <div class="${cls}" style="--suite-hue:${suiteAppHue(app)}" data-comet-tip="${escapeHtml(app.name)}&#10;Open ${escapeHtml(app.name)} in the center canvas">
        <span class="suite-element__mass">${escapeHtml(mass)}</span>
        <span class="suite-element__sym">
          <span class="suite-element__sym-big">${escapeHtml(sym[0] || "?")}</span>
          <span class="suite-element__sym-sm">${escapeHtml(sym.slice(1) || "")}</span>
        </span>
        <span class="suite-element__name">${escapeHtml(app.name)}</span>
      </div>`;
  }

  function shouldShowWelcome() {
    try {
      if (/[?&]welcome=1/.test(window.location.search)) return true;
      if (window.location.pathname.replace(/\/$/, "") === "/welcome") return true;
      return localStorage.getItem(WELCOME_KEY) !== "done";
    } catch {
      return false;
    }
  }

  function dismissWelcome() {
    try {
      localStorage.setItem(WELCOME_KEY, "done");
    } catch { /* private mode */ }
    const u = new URL(window.location.href);
    u.searchParams.delete("welcome");
    u.searchParams.delete("first");
    if (u.pathname === "/welcome") u.pathname = "/overview";
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
  }

  function mountSuiteBar(host) {
    if (!host) return;
    const active = document.body.dataset.suiteActive || "pockit";
    const brandApp =
      SUITE_APPS.find((a) => a.id === active || a.loadId === active)
      || SUITE_APPS.find((a) => a.id === "pockit")
      || SUITE_APPS[0];
    host.innerHTML = `
      <div class="suite-bar" role="navigation" aria-label="Family Office suite">
        <button type="button" id="suite-bar-console-trigger" class="suite-bar__brand console-picker-trigger"
          aria-haspopup="dialog" aria-expanded="false" aria-controls="pockit-console-modal"
          data-comet-tip="Switch console&#10;Pick a console or Family Office surface">
          <span class="suite-bar__brand-inner">
            <span class="suite-bar__brand-glyph comet-dropdown-trigger-glyph" aria-hidden="true">${elementTile(brandApp, { active: true })}</span>
            <span class="suite-bar__brand-copy">
              <span class="suite-bar__brand-kicker">Family Office</span>
              <span class="suite-bar__brand-console comet-dropdown-trigger-label">${escapeHtml(brandApp.name)}</span>
            </span>
          </span>
        </button>
        <div class="suite-bar__apps-wrap">
          <span class="suite-bar__quick-kicker">Quick Actions</span>
          <div class="suite-bar__apps-row">
            <button type="button" class="suite-bar__carousel-btn suite-bar__carousel-btn--prev" aria-label="Previous quick actions" data-comet-tip="Previous quick actions&#10;Scroll favorites left" hidden>‹</button>
            <div class="suite-bar__apps">
              ${window.PockitQuickBar?.render?.(active) || ""}
            </div>
            <button type="button" class="suite-bar__carousel-btn suite-bar__carousel-btn--next" aria-label="Next quick actions" data-comet-tip="Next quick actions&#10;Scroll favorites right" hidden>›</button>
          </div>
        </div>
        <div class="suite-bar__trailing">
          <button type="button" class="suite-bar__help-btn" data-suite-show-welcome data-comet-tip="Help Guide&#10;How to use Pockit — topics, doors, and operator workflows">
            <span class="suite-bar__help-btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.5V17h8v-2.5A7 7 0 0 0 12 2z"/></svg></span>
            <span class="suite-bar__help-btn-label">Help Guide</span>
          </button>
          <div class="suite-bar__account" id="suite-bar-auth-mount" aria-label="Account and theme"></div>
        </div>
      </div>`;
    host.querySelectorAll("[data-suite-show-welcome]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof window.setCassette === "function") window.setCassette("suite-welcome");
      });
    });
    const quickBar = host.querySelector(".suite-bar__quick-bar");
    if (quickBar && window.PockitQuickBar?.bind) window.PockitQuickBar.bind(quickBar);
    initSuiteBarCarousel(host.querySelector(".suite-bar"));
    window.__pockitSyncConsolePicker?.();
  }

  function initSuiteBarCarousel(bar) {
    if (!bar || bar.dataset.carouselBound === "1") return;
    bar.dataset.carouselBound = "1";
    const apps = bar.querySelector(".suite-bar__apps");
    const prev = bar.querySelector(".suite-bar__carousel-btn--prev");
    const next = bar.querySelector(".suite-bar__carousel-btn--next");
    if (!apps || !prev || !next) return;

    function bothRailsOpen() {
      const player = document.getElementById("player-rail");
      const cassette = document.getElementById("sidebar");
      return player && cassette
        && !player.classList.contains("collapsed")
        && !cassette.classList.contains("collapsed");
    }

    function updateCarousel() {
      const tier = window.PockitViewport?.tier || "desktop";
      const tablet = tier === "tabletCompact" || tier === "tabletLarge";
      const centerNarrow = apps.clientWidth > 0 && apps.scrollWidth > apps.clientWidth + 2;
      const squeeze = tablet && (bothRailsOpen() || centerNarrow
        || apps.clientWidth < (window.PockitViewport?.SQUEEZE_CENTER_MIN || 320));
      bar.classList.toggle("suite-bar--squeeze", squeeze);
      prev.hidden = !squeeze || apps.scrollLeft <= 2;
      next.hidden = !squeeze || apps.scrollLeft + apps.clientWidth >= apps.scrollWidth - 2;
    }

    prev.addEventListener("click", () => {
      apps.scrollBy({ left: -Math.max(120, apps.clientWidth * 0.6), behavior: "smooth" });
    });
    next.addEventListener("click", () => {
      apps.scrollBy({ left: Math.max(120, apps.clientWidth * 0.6), behavior: "smooth" });
    });
    apps.addEventListener("scroll", updateCarousel, { passive: true });
    window.addEventListener("pockit-viewport-change", updateCarousel);
    window.addEventListener("resize", updateCarousel, { passive: true });
    document.getElementById("player-rail-handle")?.addEventListener("click", () => {
      window.setTimeout(updateCarousel, 80);
    });
    document.getElementById("cassette-rail-handle")?.addEventListener("click", () => {
      window.setTimeout(updateCarousel, 80);
    });
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateCarousel);
      ro.observe(apps);
    }
    updateCarousel();
  }

  const WELCOME_STEPS = [
    {
      id: "doors",
      title: "Doors are open",
      lede: "tape-server, gateway, and tower-api boot when you launch Pockit.",
      hue: 212,
      cta: "Open overview",
      action: "overview",
    },
    {
      id: "players",
      title: "Pick a console",
      lede: "Automata, Nephew Control Tower, Dustpan — each owns its cassettes.",
      hue: 278,
      cta: "Browse consoles",
      action: "overview",
    },
    {
      id: "voice",
      title: "Voice pad",
      lede: "Parakeet lives under Apps → Voice. DGX route = best natural speech.",
      hue: 340,
      cta: "Open Voice",
      action: "load",
      loadId: "voice",
    },
    {
      id: "suite",
      title: "Family Office suite",
      lede: "Adobe-style app strip at the top — jump between Pockit, Nephew CT, Automata, and more.",
      hue: 152,
      cta: "Start exploring",
      action: "dismiss",
    },
  ];

  function renderWelcome() {
    const mass = massFromVersion(suiteVersion());
    return `
      <div class="suite-welcome">
        <div class="suite-welcome__mesh" aria-hidden="true"></div>
        <header class="suite-welcome__hero">
          <div class="suite-welcome__mark" style="--suite-hue:212">
            ${elementTile({ name: "Pockit", symbol: "Po", hue: 212, mass }, { large: true })}
          </div>
          <div class="suite-welcome__copy">
            <p class="suite-welcome__kicker">Family Office · Sovereign stack</p>
            <h1 class="suite-welcome__title">Welcome to Pockit</h1>
            <p class="suite-welcome__lede">Your player console — cassettes with speakers. Nephew Control Tower is one tap away in the suite bar.</p>
          </div>
        </header>
        <div class="suite-welcome__grid">
          ${WELCOME_STEPS.map((step, i) => `
            <article class="suite-welcome-card comet-enter" style="--suite-hue:${step.hue};--comet-delay:${i * 60}ms">
              <div class="suite-welcome-card__num">${i + 1}</div>
              <h2 class="suite-welcome-card__title">${escapeHtml(step.title)}</h2>
              <p class="suite-welcome-card__lede">${escapeHtml(step.lede)}</p>
              <button type="button" class="suite-welcome-card__cta comet-btn comet-btn--primary"
                data-welcome-action="${escapeHtml(step.action)}"
                ${step.loadId ? `data-welcome-load="${escapeHtml(step.loadId)}"` : ""}>
                ${escapeHtml(step.cta)}
              </button>
            </article>`).join("")}
        </div>
        <footer class="suite-welcome__foot">
          <button type="button" class="suite-welcome__skip" data-welcome-action="dismiss">Skip — I know the drill</button>
        </footer>
      </div>`;
  }

  function bindWelcome(root) {
    root?.querySelectorAll("[data-welcome-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-welcome-action");
        const loadId = btn.getAttribute("data-welcome-load");
        dismissWelcome();
        if (action === "load" && loadId && typeof window.setCassette === "function") {
          window.setCassette(loadId);
          return;
        }
        if (typeof window.setCassette === "function") window.setCassette("overview");
      });
    });
    window.PadSurface?.bindChangelogLinks?.(root);
    window.PadSurface?.load?.().then(() => window.PadSurface?.bindChangelogLinks?.(root)).catch(() => {});
  }

  window.PockitSuite = {
    SUITE_APPS,
    elementMassFromVersion: massFromVersion,
    elementSymbolFromName: symbolFromName,
    elementTile,
    shouldShowWelcome,
    dismissWelcome,
    mountSuiteBar,
    initSuiteBarCarousel,
    renderWelcome,
    bindWelcome,
  };
})();
