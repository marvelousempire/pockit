/**
 * Pockit Player — Comet tooltip layer + canonical copy registry.
 * Replaces native title bubbles with styled, two-line hints where helpful.
 */
(function () {
  const SHOW_MS = 380;
  const POCKIT_TIPS = {
    settings: "Settings\nLayout, theme, rails, and operator preferences",
    switchConsole: "Switch console\nPick a console or Family Office surface",
    playerRailHide: "Hide consoles rail\nMore room for the center canvas",
    playerRailShow: "Show consoles rail\nConsoles, apps, and settings",
    cassetteRailHide: "Hide cartridges rail\nFocus on the active tape",
    cassetteRailShow: "Show cartridges rail\nBrowse cartridges for this console",
    playerDrawerCollapse: "Collapse consoles drawer\nSlide the left rail closed",
    playerDrawerExpand: "Expand consoles drawer\nSlide the left rail open",
    cassetteDrawerCollapse: "Collapse cartridges drawer\nSlide the right rail closed",
    cassetteDrawerExpand: "Expand cartridges drawer\nSlide the right rail open",
    hubBack: "Back to overview\nReturn to the Pockit home grid",
    cassetteSettings: "Cartridge settings\nDoor URL, substrate, and operator fields",
    openNewTab: "Open in new tab\nLaunch this tape outside the shell",
    bonjour: "Family network\nDiscover doors and services on your LAN",
    pockitConfig: "Pockit config\nAuto-hide chrome, footer, and layout prefs",
    versionChangelog: "Pockit changelog\nWhat shipped in this build",
    towerApiVersion: "tower-api version\nFamily Office API on this machine",
    healthPill: "Tape health\nLive status from the family gateway",
    helpGuide: "Help Guide\nHow to use Pockit — topics, doors, and workflows",
    agentDoor: "Agent door\nCopy context for AI agents working on this console",
    quickActionSlot: "Quick action slot\nDrop a console, cartridge, or Accessory here",
    quickActionOpen: "Open quick action\nClick to launch · middle-click to remove",
    overviewSettings: "Cartridge settings\nConfigure this tape's door and fields",
    overviewWeb: "Open on web\nLaunch the public or LAN door in a new tab",
    overviewDoor: "Open tape door\nStandalone door URL in a new tab",
    sidebarNewTab: "Open in new tab\nExternal URL for this item",
    sidebarHome: "Console home\nJump to this console's overview",
    roleChip: "Framework role\nHow this cartridge participates in the stack",
    carouselPrev: "Previous quick actions\nScroll favorites left",
    carouselNext: "Next quick actions\nScroll favorites right",
    setupGuide: "Setup guide\nFamily Office onboarding and first-run checklist",
  };

  let layer;
  let bubble;
  let timer;
  let activeEl;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureLayer() {
    if (layer) return;
    layer = document.createElement("div");
    layer.id = "comet-tooltip-layer";
    layer.setAttribute("aria-hidden", "true");
    bubble = document.createElement("div");
    bubble.className = "comet-tooltip";
    bubble.setAttribute("role", "tooltip");
    layer.appendChild(bubble);
    document.body.appendChild(layer);
  }

  function tipTarget(node) {
    if (!node || node.nodeType !== 1) return null;
    if (node.matches("[data-comet-tip], [title]")) return node;
    return node.closest("[data-comet-tip], [title]");
  }

  function tipText(el) {
    return (el.getAttribute("data-comet-tip") || el.getAttribute("title") || "").trim();
  }

  function migrateTitle(el) {
    const title = el.getAttribute("title");
    if (!title || el.hasAttribute("data-comet-tip")) return;
    el.setAttribute("data-comet-tip", title);
    el.removeAttribute("title");
  }

  function renderBubble(text) {
    return text
      .split("\n")
      .map((line, index) => `<span class="comet-tooltip__line">${escapeHtml(line.trim())}</span>`)
      .join("");
  }

  function position(el) {
    const rect = el.getBoundingClientRect();
    bubble.style.visibility = "hidden";
    bubble.style.left = "0";
    bubble.style.top = "0";
    const bRect = bubble.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - bRect.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - bRect.width - 10));
    if (top + bRect.height > window.innerHeight - 10) {
      top = Math.max(10, rect.top - bRect.height - 8);
    }
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
    bubble.style.visibility = "";
  }

  function show(el) {
    const text = tipText(el);
    if (!text) return;
    migrateTitle(el);
    ensureLayer();
    bubble.innerHTML = renderBubble(text);
    if (el.id) bubble.id = `comet-tip-for-${el.id}`;
    else bubble.removeAttribute("id");
    layer.classList.add("is-visible");
    position(el);
    activeEl = el;
  }

  function hide() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    activeEl = null;
    layer?.classList.remove("is-visible");
  }

  function scheduleShow(el) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => show(el), SHOW_MS);
  }

  function bind() {
    document.addEventListener("mouseover", (event) => {
      const el = tipTarget(event.target);
      if (!el || el.closest("#comet-tooltip-layer")) return;
      if (activeEl === el) return;
      hide();
      scheduleShow(el);
    });

    document.addEventListener("mouseout", (event) => {
      const el = tipTarget(event.target);
      if (!el || activeEl !== el) return;
      const next = event.relatedTarget;
      if (next && el.contains(next)) return;
      hide();
    });

    document.addEventListener("focusin", (event) => {
      const el = tipTarget(event.target);
      if (!el) return;
      hide();
      show(el);
    });

    document.addEventListener("focusout", () => hide());
    window.addEventListener("scroll", () => hide(), true);
    window.addEventListener("blur", () => hide());
  }

  function setTip(el, text) {
    if (!el || text == null) return;
    el.setAttribute("data-comet-tip", String(text));
    el.removeAttribute("title");
  }

  window.CometTooltip = {
    tips: POCKIT_TIPS,
    tip(key) {
      return POCKIT_TIPS[key] || "";
    },
    set: setTip,
    refresh(root = document) {
      root.querySelectorAll("[title]").forEach(migrateTitle);
    },
    init() {
      ensureLayer();
      bind();
      this.refresh();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.CometTooltip.init(), { once: true });
  } else {
    window.CometTooltip.init();
  }
})();
