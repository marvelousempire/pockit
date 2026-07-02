/**
 * Plan: Voice App Mode Rails — Phase 7, top-chrome drawer handle.
 *
 * A manual collapse for the top chrome, mirroring the left/right rail handles:
 * #top-chrome-handle toggles body.pockit-top-chrome-collapsed, which slides
 * #suite-bar + .main-header up (CSS in pockit-rail-drawer.css). Persisted in
 * localStorage and restored on load. Distinct from Focus mode (PockitConfig
 * .togglePockitFocusMode) — this is an always-available, sticky top-bar collapse.
 *
 * Cassette discipline: self-contained, self-initialising plug-in — pockit.js is
 * not edited; one delegated click handler wires the handle.
 *
 * API: toggleTopChrome(force?) · isTopChromeCollapsed()
 */
(function () {
  "use strict";

  const KEY = "nephew-pockit-top-chrome-collapsed";
  const CLASS = "pockit-top-chrome-collapsed";

  function isTopChromeCollapsed() {
    return document.body.classList.contains(CLASS);
  }

  function syncTopChromeHandle(handle, collapsed) {
    if (!handle) return;
    handle.classList.toggle("is-collapsed", collapsed);
    handle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    handle.setAttribute("aria-label", collapsed ? "Show top chrome" : "Hide top chrome");
    const tip = collapsed
      ? "Show top chrome\nSlide the suite bar + header back down"
      : "Hide top chrome\nSlide the suite bar + header up";
    if (window.CometTooltip?.set) window.CometTooltip.set(handle, tip);
    else handle.setAttribute("data-comet-tip", tip);
    const chevron = handle.querySelector(".rail-drawer-handle__chevron");
    if (chevron) chevron.textContent = collapsed ? "▾" : "▴";
  }

  function applyTopChrome(collapsed) {
    document.body.classList.toggle(CLASS, collapsed);
    syncTopChromeHandle(document.getElementById("top-chrome-handle"), collapsed);
  }

  function setTopChrome(collapsed, { persist = true } = {}) {
    applyTopChrome(!!collapsed);
    if (!persist) return;
    try {
      localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch (_) {
      /* private mode — collapse still works for the session */
    }
  }

  function toggleTopChrome(force) {
    const next = typeof force === "boolean" ? force : !isTopChromeCollapsed();
    setTopChrome(next);
    return next;
  }

  function restore() {
    if (window.PockitViewport?.isMobileShell?.()) return;
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch (_) {
      saved = null;
    }
    if (saved === "1") applyTopChrome(true);
  }

  function onClick(ev) {
    const t = ev.target;
    if (t && t.closest && t.closest("#top-chrome-handle")) {
      ev.preventDefault();
      toggleTopChrome();
    }
  }

  function init() {
    if (window.__pockitTopChromeBound) return;
    window.__pockitTopChromeBound = true;
    restore();
    document.addEventListener("click", onClick);
    window.addEventListener("pockit-viewport-change", () => {
      if (window.PockitViewport?.isMobileShell?.()) {
        setTopChrome(false, { persist: false });
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitTopChrome = { toggleTopChrome, setTopChrome, isTopChromeCollapsed, _init: init };
})();
