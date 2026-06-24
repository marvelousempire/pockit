/**
 * Plan 0274 — Pockit phone thumb dock (context-aware player rails + Family Office HUD).
 */
(function () {
  "use strict";

  const DOCK_ID = "pockit-phone-dock";

  const NAV_ITEMS = [
    { id: "home", label: "Home", icon: "HomeOutlined", action: "home" },
    { id: "players", label: "Players", icon: "TeamOutlined", action: "hud:players" },
    { id: "cassettes", label: "Cassettes", icon: "AppstoreOutlined", action: "hud:cassettes" },
    { id: "voice", label: (window.VoiceAppDisplay || { alias: "Rick" }).alias, icon: "ApiOutlined", action: "voice" },
    { id: "more", label: "More", icon: "MenuOutlined", action: "hud:consoles" },
  ];

  let activeId = "home";
  let paintedMode = null;

  function isMobileShell() {
    return window.PockitViewport?.isMobileShell?.() === true;
  }

  function tapeItems() {
    const L = window.PockitPhonePlayerChrome?.getLabels?.() || {};
    return [
      { id: "home", label: "Home", icon: "HomeOutlined", action: "home" },
      { id: "left", label: L.left || "Players", icon: "ControlOutlined", action: "hud:players" },
      { id: "right", label: L.right || "Cassettes", icon: "ClusterOutlined", action: "hud:cassettes" },
      { id: "session", label: L.bottom || "Session", icon: "SettingOutlined", action: "chrome:bottom" },
      { id: "more", label: "More", icon: "MenuOutlined", action: "hud:consoles" },
    ];
  }

  function dockItems() {
    const bridge = window.__pockitPhoneRailBridge;
    if (bridge?.isTape?.()) return tapeItems();
    return NAV_ITEMS;
  }

  function ensureDock() {
    let dock = document.getElementById(DOCK_ID);
    if (dock) return dock;
    dock = document.createElement("nav");
    dock.id = DOCK_ID;
    dock.className = "pockit-phone-dock";
    dock.setAttribute("aria-label", "Pockit navigation");
    dock.hidden = true;
    dock.addEventListener("click", onDockClick);
    document.body.appendChild(dock);
    return dock;
  }

  function paintDockItems() {
    const dock = ensureDock();
    const items = dockItems();
    const mode = items.map((i) => i.id).join(",");
    if (mode === paintedMode && dock.querySelector("[data-dock-id]")) {
      dock.querySelectorAll("[data-dock-id]").forEach((btn) => {
        const item = items.find((i) => i.id === btn.getAttribute("data-dock-id"));
        if (item) btn.querySelector(".pockit-phone-dock__label").textContent = item.label;
      });
      paintActive();
      return;
    }
    paintedMode = mode;
    dock.innerHTML = `<div class="pockit-phone-dock__inner" role="tablist">
      ${items.map((item) => `
        <button type="button" class="pockit-phone-dock__item" data-dock-id="${item.id}" data-dock-action="${item.action}" role="tab" aria-selected="false">
          <span class="pockit-phone-dock__icon" data-ant-icon="${item.icon}" aria-hidden="true"></span>
          <span class="pockit-phone-dock__label">${item.label}</span>
        </button>`).join("")}
    </div>`;
    paintActive();
    if (window.hydrateIcons) window.hydrateIcons(dock);
    else if (window.AntIcons?.hydrate) window.AntIcons.hydrate(dock);
  }

  function syncActiveFromRoute() {
    const hash = window.location.hash || "";
    const onTape = window.__pockitPhoneRailBridge?.isTape?.();
    if (onTape) {
      if (hash.includes("/c/voice") || hash.includes("voice")) activeId = "left";
      else activeId = "home";
    } else if (hash.includes("/c/voice") || hash.includes("voice")) {
      activeId = "voice";
    } else {
      activeId = "home";
    }
    paintActive();
  }

  function paintActive() {
    const dock = document.getElementById(DOCK_ID);
    if (!dock) return;
    dock.querySelectorAll("[data-dock-id]").forEach((btn) => {
      const on = btn.getAttribute("data-dock-id") === activeId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function onDockClick(ev) {
    const btn = ev.target.closest("[data-dock-action]");
    if (!btn) return;
    ev.preventDefault();
    const action = btn.getAttribute("data-dock-action") || "";
    activeId = btn.getAttribute("data-dock-id") || activeId;
    paintActive();

    if (action === "home") {
      if (typeof window.navigateFromConsolePicker === "function") window.navigateFromConsolePicker("overview");
      else if (typeof window.setCassette === "function") window.setCassette("overview");
      else window.location.hash = "#/c/overview";
      return;
    }
    if (action === "voice") {
      if (typeof window.navigateFromConsolePicker === "function") window.navigateFromConsolePicker("voice");
      else if (typeof window.setCassette === "function") window.setCassette("voice");
      else window.location.hash = "#/c/voice";
      return;
    }
    if (action.startsWith("chrome:")) {
      const tab = action.slice(7);
      window.PockitControlsSheet?.open?.(tab);
      return;
    }
    if (action.startsWith("hud:")) {
      window.openMobileHud?.(action.slice(4));
    }
  }

  function show() {
    if (!isMobileShell()) return hide();
    paintDockItems();
    const dock = ensureDock();
    dock.hidden = false;
    syncActiveFromRoute();
  }

  function hide() {
    const dock = document.getElementById(DOCK_ID);
    if (dock) dock.hidden = true;
  }

  function refresh() {
    if (isMobileShell()) show();
    else hide();
  }

  function init() {
    if (window.__pockitPhoneDockBound) return;
    window.__pockitPhoneDockBound = true;
    window.addEventListener("pockit-viewport-change", refresh);
    window.addEventListener("pockit-footer-scope-change", refresh);
    window.addEventListener("pockit-player-chrome-change", refresh);
    window.addEventListener("hashchange", syncActiveFromRoute, { passive: true });
    refresh();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  window.PockitPhoneDock = { refresh, show, hide, syncActiveFromRoute, _init: init };
})();
