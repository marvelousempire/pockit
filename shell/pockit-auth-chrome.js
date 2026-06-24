/**
 * Plan 0297 — Profile + theme cluster in suite bar (phone/tablet mobile shell).
 * Desktop/TV/laptop: auth stays in player-rail footer (#auth-status).
 */
(function () {
  "use strict";

  function tier() {
    return window.PockitViewport?.tier || document.body?.dataset.pockitViewport || "desktop";
  }

  function orientation() {
    return document.body?.dataset.pockitOrientation || "portrait";
  }

  function isWatch() {
    return window.PockitViewport?.isWatch?.() === true;
  }

  function isMobileShell() {
    return window.PockitViewport?.isMobileShell?.() === true;
  }

  /** @returns {"rail"|"suite"|"hidden"} */
  function placement() {
    if (isWatch()) return "hidden";
    if (isMobileShell()) return "suite";
    return "rail";
  }

  /**
   * icon — theme glyphs + avatar only (SE, phone landscape)
   * compact — truncated email + theme
   * comfortable — tablet portrait
   * full — rail footer column stack
   */
  function density() {
    if (!isMobileShell()) return "full";
    const t = tier();
    const land = orientation() === "landscape";
    if (t === "phoneCompact") return "icon";
    if (t === "phoneLarge") return land ? "icon" : "compact";
    if (t === "tabletCompact" || t === "tabletLarge") return land ? "compact" : "comfortable";
    return "compact";
  }

  function layout() {
    return { placement: placement(), density: density(), tier: tier(), orientation: orientation() };
  }

  function mountEl() {
    const place = placement();
    if (place === "suite") return document.getElementById("suite-bar-auth-mount");
    if (place === "rail") return document.getElementById("auth-status");
    return null;
  }

  function clearInactiveMounts() {
    const active = mountEl();
    const rail = document.getElementById("auth-status");
    const suite = document.getElementById("suite-bar-auth-mount");
    if (rail && rail !== active) rail.innerHTML = "";
    if (suite && suite !== active) suite.innerHTML = "";
  }

  function refreshMount() {
    clearInactiveMounts();
    if (typeof window.__pockitRefreshAuthChrome === "function") {
      window.__pockitRefreshAuthChrome();
    }
  }

  function init() {
    if (window.__pockitAuthChromeBound) return;
    window.__pockitAuthChromeBound = true;
    window.addEventListener("pockit-viewport-change", refreshMount);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitAuthChrome = {
    layout,
    placement,
    density,
    mountEl,
    clearInactiveMounts,
    refreshMount,
    isSuitePlacement: () => placement() === "suite",
    isMobileShell,
  };
})();
