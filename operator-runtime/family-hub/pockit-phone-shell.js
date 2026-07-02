/**
 * Plan 0274 — Phone shell orchestrator (defaults, chrome, dock + controls wiring).
 */
(function () {
  "use strict";

  const INIT_KEY = "nephew-pockit-phone-shell-v1";

  function isSuiteParentEmbed() {
    return window.PockitViewport?.isSuiteParentEmbed?.() === true;
  }

  function isMobileShell() {
    if (isSuiteParentEmbed()) return false;
    return window.PockitViewport?.isMobileShell?.() === true;
  }

  function waitForRailControls(maxMs = 12000) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function tick() {
        if (window.__pockitRailControls?.setPlayerRailCollapsed) {
          resolve(true);
          return;
        }
        if (Date.now() - start > maxMs) {
          resolve(false);
          return;
        }
        requestAnimationFrame(tick);
      })();
    });
  }

  function getRailControls() {
    return window.__pockitRailControls || null;
  }

  function applyPhoneDefaults() {
    try {
      if (localStorage.getItem(INIT_KEY) !== "1") {
        localStorage.setItem(INIT_KEY, "1");
      }
    } catch (_) {
      /* private mode */
    }
  }

  function collapseRailsDirect() {
    const playerRail = document.getElementById("player-rail");
    const cassetteRail = document.getElementById("sidebar");
    if (playerRail) playerRail.classList.add("collapsed");
    if (cassetteRail) {
      cassetteRail.classList.add("collapsed");
      document.getElementById("app")?.classList.add("sidebar-is-collapsed");
    }
    document.body.classList.add("pockit-player-rail-collapsed", "pockit-cassette-rail-collapsed");
    window.__pockitSyncImmersivePicker?.();
  }

  function enforcePhoneChrome() {
    if (!isMobileShell()) return;
    document.body.classList.add("pockit-phone-shell");

    const rails = getRailControls();
    if (rails?.setPlayerRailCollapsed && rails?.setCassetteRailCollapsed) {
      rails.setPlayerRailCollapsed(true, { persist: false });
      rails.setCassetteRailCollapsed(true, { persist: false });
    } else {
      collapseRailsDirect();
    }

    window.PockitBottomChrome?.setBottomChrome?.(true, { persist: false });
    window.PockitTopChrome?.setTopChrome?.(false, { persist: false });

    window.PockitPhoneDock?.refresh?.();
    window.PockitControlsSheet?.refresh?.();
    window.PockitAuthChrome?.refreshMount?.();
    window.dispatchEvent(new CustomEvent("pockit-phone-shell-layout"));
  }

  async function ensureLayout() {
    if (!isMobileShell()) return;
    await waitForRailControls();
    enforcePhoneChrome();
  }

  function syncMobileCanvasHeight() {
    if (!isMobileShell()) return;
    const content = document.getElementById("main-content");
    const frame = document.getElementById("main-frame");
    if (!content || !frame) return;
    const frameRect = frame.getBoundingClientRect();
    const header = frame.querySelector("header.main-header");
    const footer = frame.querySelector("footer.main-shell-footer");
    const headerH = header && !header.hidden ? header.getBoundingClientRect().height : 0;
    const footerH = footer && !footer.hidden ? footer.getBoundingClientRect().height : 0;
    const canvasH = Math.max(240, Math.floor(frameRect.height - headerH - footerH));
    content.style.minHeight = `${canvasH}px`;
  }

  function clearPhoneChrome() {
    if (window.PockitViewport?.isMobileShell?.()) return;
    document.body.classList.remove("pockit-phone-shell");
    window.PockitPhoneDock?.hide?.();
    window.PockitControlsSheet?.hideFab?.();
  }

  async function onViewportChange() {
    if (window.PockitViewport?.isWatch?.()) {
      clearPhoneChrome();
      window.PockitWatchCompanion?.sync?.();
      return;
    }
    if (isMobileShell()) {
      await waitForRailControls();
      applyPhoneDefaults();
      enforcePhoneChrome();
    } else {
      clearPhoneChrome();
    }
  }

  function init() {
    if (window.__pockitPhoneShellBound) return;
    window.__pockitPhoneShellBound = true;
    window.addEventListener("pockit-viewport-change", () => {
      onViewportChange();
    });
    window.addEventListener("pockit-phone-shell-layout", () => {
      requestAnimationFrame(() => syncMobileCanvasHeight());
    });
    window.addEventListener("resize", () => {
      if (isMobileShell()) requestAnimationFrame(() => syncMobileCanvasHeight());
    }, { passive: true });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => onViewportChange(), { once: true });
    } else {
      onViewportChange();
    }
  }

  if (typeof document !== "undefined") {
    init();
  }

  window.PockitPhoneShell = {
    applyPhoneDefaults,
    enforcePhoneChrome,
    ensureLayout,
    syncMobileCanvasHeight,
    onViewportChange,
    _init: init,
  };
})();
