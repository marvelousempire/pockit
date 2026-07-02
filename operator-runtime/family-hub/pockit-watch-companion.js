/**
 * Plan 0275 — Apple Watch companion surface (minimal UI + deep links).
 */
(function () {
  "use strict";

  const MOUNT_ID = "pockit-watch-companion-mount";

  function isWatch() {
    return window.PockitViewport?.isWatch?.() === true;
  }

  function voiceUrl() {
    const base = typeof window.canonicalDoorUrl === "function"
      ? window.canonicalDoorUrl("pockit", { hash: "#/c/voice" })
      : "http://pockit.localhost/#/c/voice";
    return base;
  }

  function phoneUrl() {
    return typeof window.canonicalDoorUrl === "function"
      ? window.canonicalDoorUrl("pockit")
      : "http://pockit.localhost/";
  }

  function renderHtml() {
    return `<div class="pockit-watch-companion" id="${MOUNT_ID}">
      <div class="pockit-watch-companion__card">
        <p class="pockit-watch-companion__kicker">Nephew · Watch</p>
        <h1 class="pockit-watch-companion__title">Pockit companion</h1>
        <p class="pockit-watch-companion__lede">Full Family Office shell needs iPhone or iPad. Voice and status live here as quick links.</p>
        <div class="pockit-watch-companion__actions">
          <a class="pockit-watch-companion__btn pockit-watch-companion__btn--primary" href="${voiceUrl()}">Voice pad</a>
          <a class="pockit-watch-companion__btn" href="${phoneUrl()}">Open on iPhone</a>
        </div>
        <p class="pockit-watch-companion__meta" id="pockit-watch-companion-meta"></p>
      </div>
    </div>`;
  }

  function paintMeta() {
    const el = document.getElementById("pockit-watch-companion-meta");
    if (!el || !window.PockitViewport) return;
    const { width, height } = window.PockitViewport.viewportSize?.() || { width: 0, height: 0 };
    el.textContent = `${window.PockitViewport.tier} · ${window.PockitViewport.orientation} · ${width}×${height}`;
  }

  function showCompanion() {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (!document.getElementById(MOUNT_ID)) {
      main.innerHTML = renderHtml();
    }
    paintMeta();
    document.body.classList.add("pockit-watch-companion-active");
    window.PockitPhoneDock?.hide?.();
    window.PockitControlsSheet?.hideFab?.();
  }

  function hideCompanion() {
    document.body.classList.remove("pockit-watch-companion-active");
  }

  function sync() {
    if (isWatch()) showCompanion();
    else hideCompanion();
  }

  function init() {
    if (window.__pockitWatchCompanionBound) return;
    window.__pockitWatchCompanionBound = true;
    window.addEventListener("pockit-viewport-change", sync);
    sync();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitWatchCompanion = { sync, showCompanion, hideCompanion, renderHtml, _init: init };
})();
