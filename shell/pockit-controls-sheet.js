/**
 * Plan 0274 — Player controls bottom sheet (left rail · right rail · footer session).
 */
(function () {
  "use strict";

  const SHEET_ID = "pockit-controls-sheet";
  const FAB_ID = "pockit-controls-fab";
  const LEFT_ID = "pockit-controls-sheet-rail-left";
  const RIGHT_ID = "pockit-controls-sheet-rail-right";
  const FOOTER_ID = "pockit-controls-sheet-footer";

  let activeTab = "bottom";

  function isMobileShell() {
    return window.PockitViewport?.isMobileShell?.() === true;
  }

  function chrome() {
    return window.PockitPhonePlayerChrome;
  }

  function currentScope() {
    return window.__pockitFooterScope || "overview";
  }

  function labels() {
    return chrome()?.getLabels?.() || { left: "Players", right: "Cassettes", bottom: "Controls", hasTapeRails: false };
  }

  function renderFooterPanel(scope) {
    const pills = window.PockitPlayerContextPills;
    if (!pills) return "<p class=\"pockit-controls-sheet__empty\">Controls loading…</p>";
    const controls = pills.renderFooterControls?.(scope) || "";
    const status = pills.render?.(scope) || "";
    const ledHtml = global.PockitLedLaw?.renderLegend?.({ title: "LED law", className: "pockit-led-law pockit-controls-sheet__led-law" })
      || "";
    const ledTip = global.PockitLedLaw?.tipText?.()
      || "Red = not installed · Orange = installed not wired · Yellow = wired not started · Blue = ready to start · Green = started active";
    const ledRow = ledHtml || `<div class="pockit-controls-sheet__led-row" data-comet-tip="${ledTip.replace(/"/g, "&quot;")}">
      <span class="pockit-controls-sheet__led-label">LED law</span>
      <button type="button" class="pockit-controls-sheet__led-help" aria-label="LED law help">?</button>
    </div>`;
    if (!controls && !status) {
      return `<p class="pockit-controls-sheet__empty">No session controls for this player yet.</p>${ledRow}`;
    }
    return `<div class="pockit-controls-sheet__stack">
      ${controls ? `<div class="pockit-controls-sheet__controls">${controls}</div>` : ""}
      ${status ? `<div class="pockit-controls-sheet__status">${status}</div>` : ""}
      ${ledRow}
    </div>`;
  }

  function paintTabs() {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;
    const L = labels();
    const tabs = sheet.querySelector(".pockit-controls-sheet__tabs");
    if (!tabs) return;
    tabs.innerHTML = `
      <button type="button" class="pockit-controls-sheet__tab" data-controls-tab="left" role="tab" aria-selected="false">${L.left}</button>
      <button type="button" class="pockit-controls-sheet__tab" data-controls-tab="right" role="tab" aria-selected="false">${L.right}</button>
      <button type="button" class="pockit-controls-sheet__tab" data-controls-tab="bottom" role="tab" aria-selected="false">${L.bottom}</button>`;
    tabs.querySelectorAll("[data-controls-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-controls-tab") === activeTab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const title = sheet.querySelector("#pockit-controls-sheet-title");
    if (title) {
      const tabLabel = activeTab === "left" ? L.left : activeTab === "right" ? L.right : L.bottom;
      title.textContent = tabLabel;
    }
    [LEFT_ID, RIGHT_ID, FOOTER_ID].forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      const key = id === LEFT_ID ? "left" : id === RIGHT_ID ? "right" : "bottom";
      const show = key === activeTab;
      panel.hidden = !show;
      panel.classList.toggle("is-active", show);
    });
  }

  function bindFooterPanel(scope) {
    const footer = document.getElementById(FOOTER_ID);
    if (!footer) return;
    window.PockitPlayerContextPills?.bindFooterControls?.(footer, scope);
    window.PockitPlayerContextPills?.bind?.(footer, scope);
    footer.querySelector(".pockit-controls-sheet__led-help")?.addEventListener("click", (e) => {
      e.preventDefault();
      const row = e.target.closest(".pockit-controls-sheet__led-row");
      const tip = row?.getAttribute("data-comet-tip") || "Status LED guide";
      if (window.CometTooltip?.showAt) window.CometTooltip.showAt(e.target, tip);
    });
    window.CometTooltip?.refresh?.(footer);
  }

  async function paintTab(tab) {
    if (tab) activeTab = tab;
    paintTabs();
    const scope = currentScope();
    if (activeTab === "left") {
      await chrome()?.paintLeft?.(document.getElementById(LEFT_ID));
      chrome()?.refreshVoiceHighlights?.();
    } else if (activeTab === "right") {
      await chrome()?.paintRight?.(document.getElementById(RIGHT_ID));
      chrome()?.refreshVoiceHighlights?.();
    } else {
      const footer = document.getElementById(FOOTER_ID);
      if (footer) {
        footer.innerHTML = renderFooterPanel(scope);
        bindFooterPanel(scope);
      }
    }
    updateFabLabel();
  }

  function renderMobileVersionPillHtml() {
    const ps = window.PadSurface?.surface;
    const ver = window.PadSurface?.runningVersion || ps?.version || "—";
    const name = (ps?.display_name || "Pockit").trim() || "Pockit";
    const label = ver && ver !== "—" ? `${name} v${ver}` : name;
    return `<button type="button" id="pockit-controls-sheet-version" class="pockit-mobile-version-pill shell-version-btn" data-action="pad-changelog" data-changelog-open-tab="pockit" aria-label="${label.replace(/"/g, "&quot;")} changelog">
      <span class="shell-version-btn__dot" aria-hidden="true"></span>
      <span class="shell-version-btn__label">${label.replace(/</g, "&lt;")}</span>
    </button>`;
  }

  function ensureControlsSheetVersionPill(sheet) {
    const header = sheet?.querySelector?.(".pockit-controls-sheet__header");
    if (!header || header.querySelector("#pockit-controls-sheet-version")) return;
    const closeBtn = header.querySelector(".pockit-controls-sheet__close");
    const trailing = document.createElement("div");
    trailing.className = "pockit-controls-sheet__header-trailing";
    trailing.innerHTML = `${renderMobileVersionPillHtml()}${closeBtn?.outerHTML || ""}`;
    if (closeBtn) closeBtn.remove();
    header.appendChild(trailing);
    window.PadSurface?.bindChangelogLinks?.(header);
  }

  function ensureSheet() {
    let sheet = document.getElementById(SHEET_ID);
    if (sheet) {
      ensureControlsSheetVersionPill(sheet);
      return sheet;
    }
    sheet = document.createElement("div");
    sheet.id = SHEET_ID;
    sheet.className = "pockit-controls-sheet";
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="pockit-controls-sheet__backdrop" data-action="close-controls-sheet"></div>
      <div class="pockit-controls-sheet__panel cotton-ball-settle" role="dialog" aria-modal="true" aria-labelledby="pockit-controls-sheet-title">
        <header class="pockit-controls-sheet__header">
          <h2 class="pockit-controls-sheet__title" id="pockit-controls-sheet-title">Controls</h2>
          <div class="pockit-controls-sheet__header-trailing">
            ${renderMobileVersionPillHtml()}
            <button type="button" class="pockit-controls-sheet__close" data-action="close-controls-sheet" aria-label="Close">×</button>
          </div>
        </header>
        <div class="pockit-controls-sheet__tabs" role="tablist" aria-label="Player controls"></div>
        <div class="pockit-controls-sheet__body">
          <div class="pockit-controls-sheet__panel-pane" id="${LEFT_ID}" role="tabpanel" hidden></div>
          <div class="pockit-controls-sheet__panel-pane" id="${RIGHT_ID}" role="tabpanel" hidden></div>
          <div class="pockit-controls-sheet__panel-pane" id="${FOOTER_ID}" role="tabpanel"></div>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=close-controls-sheet]")) close();
      const tabBtn = e.target.closest("[data-controls-tab]");
      if (tabBtn) {
        e.preventDefault();
        paintTab(tabBtn.getAttribute("data-controls-tab"));
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sheet && !sheet.hidden) close();
    });
    return sheet;
  }

  function updateFabLabel() {
    const fab = document.getElementById(FAB_ID);
    if (!fab) return;
    const L = labels();
    fab.textContent = L.bottom || "Controls";
    fab.setAttribute("aria-label", `Open ${L.bottom || "controls"}`);
  }

  function ensureFab() {
    let fab = document.getElementById(FAB_ID);
    if (fab) return fab;
    fab = document.createElement("button");
    fab.type = "button";
    fab.id = FAB_ID;
    fab.className = "pockit-controls-fab";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.hidden = true;
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      open(activeTab === "bottom" ? "bottom" : activeTab);
    });
    document.body.appendChild(fab);
    updateFabLabel();
    return fab;
  }

  function open(tab = "bottom") {
    if (!isMobileShell()) return;
    const sheet = ensureSheet();
    activeTab = tab || "bottom";
    sheet.hidden = false;
    sheet.classList.add("pockit-controls-sheet--open");
    document.getElementById(FAB_ID)?.setAttribute("aria-expanded", "true");
    paintTab(activeTab);
    window.PadSurface?.bindChangelogLinks?.(sheet);
    window.PadSurface?.notifyVersionChrome?.();
    sheet.querySelector(".pockit-controls-sheet__close")?.focus();
  }

  function close() {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove("pockit-controls-sheet--open");
    sheet.hidden = true;
    document.getElementById(FAB_ID)?.setAttribute("aria-expanded", "false");
  }

  /** Tap-to-apply: close phone chrome after a control fires (no manual save/dismiss). */
  function dismissAfterAction(opts = {}) {
    if (!isMobileShell()) return;
    if (opts.keepOpen) return;
    const delay = typeof opts.delay === "number" ? opts.delay : 0;
    window.setTimeout(() => {
      close();
      if (opts.closeHud !== false) window.closeMobileHud?.();
    }, delay);
  }

  function isPhoneChromeEl(el) {
    return Boolean(el?.closest?.(`#${SHEET_ID}, #pockit-mobile-hud`));
  }

  function showFab() {
    if (!isMobileShell()) return hideFab();
    const fab = ensureFab();
    fab.hidden = false;
    updateFabLabel();
  }

  function hideFab() {
    const fab = document.getElementById(FAB_ID);
    if (fab) fab.hidden = true;
    close();
  }

  function refresh() {
    if (isMobileShell()) {
      showFab();
      if (document.getElementById(SHEET_ID) && !document.getElementById(SHEET_ID).hidden) {
        paintTab(activeTab);
      }
    } else {
      hideFab();
    }
  }

  function paint() {
    paintTab(activeTab);
  }

  function init() {
    if (window.__pockitControlsSheetBound) return;
    window.__pockitControlsSheetBound = true;
    window.addEventListener("pockit-viewport-change", refresh);
    window.addEventListener("pockit-footer-scope-change", () => {
      refresh();
      window.PockitPhoneDock?.refresh?.();
    });
    window.addEventListener("pockit-player-chrome-change", () => {
      refresh();
      window.PockitPhoneDock?.refresh?.();
    });
    refresh();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitControlsSheet = { open, close, refresh, paint, paintTab, hideFab, dismissAfterAction, isPhoneChromeEl, _init: init };
  window.dismissPhoneChromeAfterAction = dismissAfterAction;
  window.isPhoneChromeEl = isPhoneChromeEl;
})();
