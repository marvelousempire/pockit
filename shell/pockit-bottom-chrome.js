/**
 * Plan: Voice App Mode Rails — bottom footer drawer handle (mirrors pockit-top-chrome.js).
 *
 * #bottom-chrome-handle toggles body.pockit-bottom-chrome-collapsed, which slides
 * #main-footer down. Handle tracks the footer top seam via --pockit-bottom-handle-bottom.
 */
(function () {
  "use strict";

  const KEY = "nephew-pockit-bottom-chrome-collapsed";
  const CLASS = "pockit-bottom-chrome-collapsed";

  function isBottomChromeCollapsed() {
    return document.body.classList.contains(CLASS);
  }

  function syncBottomChromeHandle(handle, collapsed) {
    if (!handle) return;
    handle.classList.toggle("is-collapsed", collapsed);
    handle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    handle.setAttribute("aria-label", collapsed ? "Show footer" : "Hide footer");
    const tip = collapsed
      ? "Show footer\nSlide the status bar + versions back up"
      : "Hide footer\nSlide the status bar + versions down";
    if (window.CometTooltip?.set) window.CometTooltip.set(handle, tip);
    else handle.setAttribute("data-comet-tip", tip);
    const chevron = handle.querySelector(".rail-drawer-handle__chevron");
    if (chevron) chevron.textContent = collapsed ? "▴" : "▾";
  }

  function footerIsVisible() {
    const footer = document.getElementById("main-footer");
    if (!footer || footer.hidden) return false;
    if (isBottomChromeCollapsed()) return true;
    return footer.offsetHeight > 0 && getComputedStyle(footer).display !== "none";
  }

  function syncBottomHandlePosition() {
    const footer = document.getElementById("main-footer");
    const handle = document.getElementById("bottom-chrome-handle");
    if (!handle) return;

    const visible = footerIsVisible();
    handle.hidden = !visible;
    if (!visible) return;

    if (isBottomChromeCollapsed()) {
      document.documentElement.style.removeProperty("--pockit-footer-seam-bottom");
      return;
    }

    const rect = footer.getBoundingClientRect();
    const seamFromBottom = Math.max(0, window.innerHeight - rect.top);
    document.documentElement.style.setProperty("--pockit-footer-seam-bottom", `${seamFromBottom}px`);
  }

  function applyBottomChrome(collapsed) {
    document.body.classList.toggle(CLASS, collapsed);
    syncBottomChromeHandle(document.getElementById("bottom-chrome-handle"), collapsed);
    syncBottomHandlePosition();
  }

  function setBottomChrome(collapsed, { persist = true } = {}) {
    applyBottomChrome(!!collapsed);
    if (!persist) return;
    try {
      localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch (_) {
      /* private mode */
    }
  }

  function toggleBottomChrome(force) {
    const next = typeof force === "boolean" ? force : !isBottomChromeCollapsed();
    setBottomChrome(next);
    return next;
  }

  function restore() {
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch (_) {
      saved = null;
    }
    if (saved === "1") applyBottomChrome(true);
    else syncBottomHandlePosition();
  }

  function onClick(ev) {
    const t = ev.target;
    if (t && t.closest && t.closest("#bottom-chrome-handle")) {
      ev.preventDefault();
      toggleBottomChrome();
    }
  }

  function watchFooter() {
    const footer = document.getElementById("main-footer");
    if (!footer || footer.dataset.bottomChromeWatch === "1") return;
    footer.dataset.bottomChromeWatch = "1";

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => syncBottomHandlePosition());
      ro.observe(footer);
    }
    if (typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(() => syncBottomHandlePosition());
      mo.observe(footer, { attributes: true, attributeFilter: ["hidden", "class", "style"], childList: true, subtree: true });
    }
    window.addEventListener("resize", syncBottomHandlePosition, { passive: true });
  }

  function init() {
    if (window.__pockitBottomChromeBound) return;
    window.__pockitBottomChromeBound = true;
    restore();
    watchFooter();
    document.addEventListener("click", onClick);
    requestAnimationFrame(syncBottomHandlePosition);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitBottomChrome = {
    toggleBottomChrome,
    setBottomChrome,
    isBottomChromeCollapsed,
    syncBottomHandlePosition,
    _init: init,
  };
})();
