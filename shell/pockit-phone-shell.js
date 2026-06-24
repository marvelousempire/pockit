/**
 * Plan 0274 — Phone shell orchestrator (defaults, chrome, dock + controls wiring).
 */
(function () {
  "use strict";

  const INIT_KEY = "nephew-pockit-phone-shell-v1";

  function isMobileShell() {
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

  function enforcePhoneChrome() {
    if (!isMobileShell()) return;
    document.body.classList.add("pockit-phone-shell");

    const rails = getRailControls();
    if (rails?.setPlayerRailCollapsed) rails.setPlayerRailCollapsed(true, { persist: false });
    if (rails?.setCassetteRailCollapsed) rails.setCassetteRailCollapsed(true, { persist: false });

    window.PockitBottomChrome?.setBottomChrome?.(true, { persist: false });
    window.PockitTopChrome?.setTopChrome?.(false, { persist: false });

    window.PockitPhoneDock?.refresh?.();
    window.PockitControlsSheet?.refresh?.();
    window.PockitAuthChrome?.refreshMount?.();
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
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => onViewportChange(), { once: true });
    } else {
      onViewportChange();
    }
  }

  if (typeof document !== "undefined") {
    init();
  }

  window.PockitPhoneShell = { applyPhoneDefaults, enforcePhoneChrome, onViewportChange, _init: init };
})();
