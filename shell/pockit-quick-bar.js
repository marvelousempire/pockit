/**
 * Pockit Quick Actions bar — draggable favorite slots in the suite header.
 * Drop players, cassettes, Mac apps, and actions from the rails.
 */
"use strict";

(function initPockitQuickBar(global) {
  const STORAGE_KEY = "pockit.quickBar.v1";
  const SLOT_COUNT = 14;
  const MIME = "application/x-pockit-quick-bar+json";

  const ACTION_DEFS = {
    overview: { name: "Overview", symbol: "Ov", hue: 204 },
    library: { name: "Library", symbol: "Li", hue: 45 },
    voice: {
      name: (window.VoiceAppDisplay || { name: "Super Rick" }).name,
      symbol: (window.VoiceAppDisplay || { symbol: "Ri" }).symbol,
      hue: 337,
    },
    settings: { name: "Settings", symbol: "Se", hue: 210 },
    console: { name: "Console", symbol: "Co", hue: 200 },
  };

  /** Known player/action ids → human label (never show kebab-case in UI). */
  const ID_DISPLAY = {
    pockit: "Pockit",
    "nephew-deck": "Nephew",
    automata: "Automata",
    historia: "Historia",
    clinic: "Clinic",
    dustpan: "DustPan",
    bishop: "Bishop",
    wordpress: "WordPress",
    readyplay: "ReadyPlay",
    "search-my-engine": "Search",
    "container-deck": "Containers",
    voice: (window.VoiceAppDisplay || { alias: "Rick" }).alias,
    library: "Library",
    overview: "Overview",
    settings: "Settings",
    console: "Console",
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayLabel(raw, { id = "" } = {}) {
    const key = String(id || raw || "").trim();
    if (ID_DISPLAY[key]) return ID_DISPLAY[key];
    const s = String(raw || "").trim();
    if (!s) return "App";
    if (ID_DISPLAY[s]) return ID_DISPLAY[s];
    if (/^[A-Z][a-zA-Z0-9]*(\s+[A-Z][a-zA-Z0-9]*)*$/.test(s)) return s;
    if (/[-_]/.test(s) && !/\s/.test(s)) {
      return s
        .replace(/[-_]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
    if (/^[a-z]/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  }

  function symbolFromName(name) {
    const label = displayLabel(name);
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    const n = label.trim();
    if (n.length <= 2) return n.toUpperCase();
    return n[0].toUpperCase() + (n[1] || "").toLowerCase();
  }

  function defaultSlots() {
    return [
      { type: "player", id: "nephew-deck" },
      { type: "player", id: "automata" },
      { type: "player", id: "historia" },
      { type: "player", id: "clinic" },
      { type: "player", id: "dustpan" },
      { type: "action", id: "voice" },
      { type: "action", id: "library" },
      ...Array(SLOT_COUNT - 7).fill(null),
    ];
  }

  function normalizeState(raw) {
    const slots = Array.isArray(raw?.slots) ? raw.slots.slice(0, SLOT_COUNT) : [];
    while (slots.length < SLOT_COUNT) slots.push(null);
    return { schema_version: 1, slot_count: SLOT_COUNT, slots };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw?.slots?.length) return normalizeState(raw);
    } catch {
      /* private mode */
    }
    return normalizeState({ slots: defaultSlots() });
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
    } catch {
      /* private mode */
    }
  }

  let state = loadState();
  let boundHost = null;

  function catalogPlayers() {
    return global.POCKIT_CATALOG?.players || [];
  }

  function catalogMacApps() {
    return global.POCKIT_CATALOG?.mac_apps || [];
  }

  function findHostedCassette(id) {
    if (!id) return null;
    for (const p of catalogPlayers()) {
      const c = (p.hosted_cassettes || []).find(
        (x) => x.id === id || x.hub_card_id === id,
      );
      if (c) {
        return {
          id: c.hub_card_id || c.id,
          registryId: c.id,
          name: c.name || c.id,
          glyph: c.glyph,
          hue: p.hue ?? p.crayola?.hue ?? 212,
          playerId: p.id,
        };
      }
    }
    return null;
  }

  function resolveSlot(slot) {
    if (!slot?.type || !slot.id) return null;
    if (slot.type === "player") {
      const p = catalogPlayers().find((x) => x.id === slot.id);
      if (!p) {
        const name = displayLabel(slot.id, { id: slot.id });
        return { type: "player", id: slot.id, name, symbol: symbolFromName(name), hue: 212 };
      }
      const name = displayLabel(p.name || p.id, { id: p.id });
      return {
        type: "player",
        id: p.id,
        name,
        symbol: symbolFromName(name),
        hue: p.hue ?? p.crayola?.hue ?? 212,
      };
    }
    if (slot.type === "cassette") {
      const c = findHostedCassette(slot.id);
      if (c) {
        const name = displayLabel(c.name || c.id, { id: c.id });
        return {
          type: "cassette",
          id: c.id,
          registryId: c.registryId,
          name,
          symbol: c.glyph && c.glyph.length <= 2 ? c.glyph : symbolFromName(name),
          hue: c.hue,
        };
      }
      const name = displayLabel(slot.id, { id: slot.id });
      return {
        type: "cassette",
        id: slot.id,
        name,
        symbol: symbolFromName(name),
        hue: 212,
      };
    }
    if (slot.type === "mac-app") {
      const a = catalogMacApps().find((x) => x.id === slot.id);
      const name = displayLabel(a?.displayName || a?.name || slot.id, { id: slot.id });
      return {
        type: "mac-app",
        id: slot.id,
        name,
        symbol: a?.symbol || symbolFromName(name),
        hue: a?.hue ?? 212,
      };
    }
    if (slot.type === "action") {
      const def = ACTION_DEFS[slot.id];
      const name = def?.name || displayLabel(slot.id, { id: slot.id });
      return {
        type: "action",
        id: slot.id,
        name,
        symbol: def?.symbol || symbolFromName(name),
        hue: def?.hue ?? 212,
      };
    }
    return null;
  }

  function slotKeyForMeta(meta) {
    if (!meta?.type || !meta.id) return "";
    return `${meta.type}:${meta.id}`;
  }

  function cassetteKeysForId(id) {
    if (!id) return [];
    const keys = [`cassette:${id}`];
    const c = findHostedCassette(id);
    if (c?.registryId && c.registryId !== id) keys.push(`cassette:${c.registryId}`);
    if (c?.id && c.id !== id) keys.push(`cassette:${c.id}`);
    return keys;
  }

  function keysMatchActive(meta, activeKey) {
    if (!meta || !activeKey) return false;
    const key = slotKeyForMeta(meta);
    if (key === activeKey) return true;
    if (meta.type === "cassette") {
      return cassetteKeysForId(meta.id).includes(activeKey);
    }
    return false;
  }

  function elementTile(meta, { active = false } = {}) {
    const sym = String(meta.symbol || symbolFromName(meta.name));
    const cls = `suite-element suite-element--quick${active ? " is-active" : ""}`;
    return `
      <div class="${cls}" style="--suite-hue:${Number(meta.hue) || 212}" aria-hidden="true">
        <span class="suite-element__sym">
          <span class="suite-element__sym-big">${escapeHtml(sym[0] || "?")}</span>
          <span class="suite-element__sym-sm">${escapeHtml(sym.slice(1) || "")}</span>
        </span>
      </div>`;
  }

  function renderSlot(index, slot, activeKey) {
    const meta = resolveSlot(slot);
    const isActive = keysMatchActive(meta, activeKey);
    if (!meta) {
      return `
        <div class="suite-bar__quick-slot suite-bar__quick-slot--empty"
          data-slot-index="${index}"
          role="listitem"
          aria-label="Quick action slot ${index + 1} — drop a console, cartridge, or app"
          data-comet-tip="Quick action slot&#10;Drop a console, cartridge, or Accessory here">
          <span class="suite-bar__quick-slot-stack">
            <span class="suite-bar__quick-slot-glyph" aria-hidden="true">+</span>
            <span class="suite-bar__quick-slot-label">Drop</span>
          </span>
        </div>`;
    }
    return `
      <button type="button"
        class="suite-bar__quick-slot suite-bar__quick-slot--filled${isActive ? " is-active" : ""}"
        data-slot-index="${index}"
        data-quick-type="${escapeHtml(meta.type)}"
        data-quick-id="${escapeHtml(meta.id)}"
        draggable="true"
        data-comet-tip="${escapeHtml(meta.name)}&#10;Click to open · middle-click to remove · drag to reorder"
        aria-label="${escapeHtml(meta.name)}">
        <span class="suite-bar__quick-slot-stack">
          ${elementTile(meta, { active: isActive })}
          <span class="suite-bar__quick-slot-label">${escapeHtml(meta.name)}</span>
        </span>
        <span class="suite-bar__quick-slot-clear" data-quick-clear="${index}" aria-hidden="true" data-comet-tip="Remove&#10;Clear this quick action slot">×</span>
      </button>`;
  }

  function activeQuickKey() {
    const fromHooks = global.PockitQuickBarHooks?.activeKey;
    if (typeof fromHooks === "function") {
      const key = fromHooks();
      if (key) return key;
    }
    const cassette = typeof global.currentCassetteId === "function" ? global.currentCassetteId() : "";
    if (cassette === "library") return "action:library";
    if (cassette === "voice" || cassette === "voice-cassette") return "action:voice";
    if (cassette && cassette !== "overview") {
      if (ACTION_DEFS[cassette]) return `action:${cassette}`;
      return `cassette:${cassette}`;
    }
    const bodyActive = document.body.dataset.suiteActive || "";
    if (bodyActive && bodyActive !== "pockit") return `player:${bodyActive}`;
    return "action:overview";
  }

  function render(activeId) {
    const activeKey = activeId ? `player:${activeId}` : activeQuickKey();
    const slotsHtml = state.slots
      .map((slot, i) => renderSlot(i, slot, activeKey))
      .join("");
    return `
      <div class="suite-bar__quick-bar" role="list" aria-label="Quick Actions favorites">
        ${slotsHtml}
      </div>`;
  }

  function payloadFromSidebarButton(btn) {
    if (!btn) return null;
    const action = btn.getAttribute("data-action") || "load";
    const id = btn.getAttribute("data-id") || "";
    const macAppId = btn.getAttribute("data-mac-app-id");
    const playerId = btn.getAttribute("data-player-id");

    if (action === "select-mac-app" || macAppId) {
      return { type: "mac-app", id: macAppId || id.replace(/^mac-app-/, "") };
    }
    if (action === "open-player-home" && playerId) {
      return { type: "player", id: playerId };
    }
    if (action === "filter-player" && playerId) {
      return { type: "player", id: playerId };
    }
    if (action === "load" || action === "select-player-group") {
      if (id === "overview" || id === "library" || id === "voice" || id === "smoke-checklist") {
        return { type: "action", id: id === "smoke-checklist" ? "overview" : id };
      }
      if (playerId && (id.startsWith("player-nav-") || id.includes("player"))) {
        return { type: "player", id: playerId };
      }
      const p = catalogPlayers().find((x) => x.id === id);
      if (p) return { type: "player", id: p.id };
      return { type: "cassette", id };
    }
    return null;
  }

  function payloadFromDragEvent(e) {
    const raw = e.dataTransfer?.getData(MIME);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p?.type && p?.id) return { type: p.type, id: p.id };
      } catch {
        /* fall through */
      }
    }
    const btn = e.target.closest(".sidebar-item-main, .suite-bar__quick-slot--filled");
    if (btn?.classList.contains("suite-bar__quick-slot--filled")) {
      return {
        type: btn.getAttribute("data-quick-type"),
        id: btn.getAttribute("data-quick-id"),
      };
    }
    return payloadFromSidebarButton(btn);
  }

  function setDragPayload(e, payload) {
    if (!payload?.type || !payload.id) return;
    const json = JSON.stringify(payload);
    e.dataTransfer.setData(MIME, json);
    e.dataTransfer.setData("text/plain", `${payload.type}:${payload.id}`);
    e.dataTransfer.effectAllowed = "move";
  }

  function activateSlot(slot) {
    const hooks = global.PockitQuickBarHooks || {};
    if (!slot?.type || !slot.id) return;
    if (slot.type === "player") {
      if (typeof hooks.openPlayerHome === "function") hooks.openPlayerHome(slot.id);
      else if (typeof global.setCassette === "function") global.setCassette("overview");
      document.body.dataset.suiteActive = slot.id;
      return;
    }
    if (slot.type === "mac-app") {
      if (typeof hooks.selectMacApp === "function") hooks.selectMacApp(slot.id);
      return;
    }
    if (slot.type === "action") {
      if (slot.id === "settings") {
        hooks.openSettingsModal?.("layout");
        return;
      }
      if (slot.id === "console") {
        hooks.openConsoleModal?.();
        return;
      }
      if (typeof global.setCassette === "function") global.setCassette(slot.id);
      if (slot.id === "overview" || slot.id === "library" || slot.id === "voice") {
        document.body.dataset.suiteActive = slot.id === "voice" ? "voice" : "pockit";
      }
      return;
    }
    if (slot.type === "cassette" && typeof global.setCassette === "function") {
      const c = findHostedCassette(slot.id);
      global.setCassette(c?.id || slot.id);
    }
  }

  function clearSlot(index) {
    if (index < 0 || index >= SLOT_COUNT) return;
    state.slots[index] = null;
    saveState(state);
    refresh();
  }

  function assignSlot(index, payload, { sourceIndex = -1 } = {}) {
    if (index < 0 || index >= SLOT_COUNT || !payload?.type || !payload.id) return;
    const entry = { type: payload.type, id: payload.id };
    if (sourceIndex >= 0 && sourceIndex !== index) {
      const prevTarget = state.slots[index];
      state.slots[index] = entry;
      state.slots[sourceIndex] = prevTarget;
    } else {
      state.slots[index] = entry;
    }
    saveState(state);
    refresh();
  }

  function onDragStart(e) {
    const filled = e.target.closest(".suite-bar__quick-slot--filled");
    const sidebarBtn = e.target.closest(".sidebar-item-main");
    const payload = filled
      ? { type: filled.getAttribute("data-quick-type"), id: filled.getAttribute("data-quick-id") }
      : payloadFromSidebarButton(sidebarBtn);
    if (!payload?.type || !payload.id) {
      e.preventDefault();
      return;
    }
    if (filled) e.dataTransfer.setData("text/x-pockit-slot-index", filled.getAttribute("data-slot-index") || "-1");
    setDragPayload(e, payload);
    e.target.closest(".suite-bar__quick-slot--filled, .sidebar-item")?.classList.add("is-dragging");
  }

  function onDragEnd(e) {
    document.querySelectorAll(".is-dragging, .suite-bar__quick-slot--drop-target").forEach((el) => {
      el.classList.remove("is-dragging", "suite-bar__quick-slot--drop-target");
    });
  }

  function onDragOver(e) {
    const slot = e.target.closest(".suite-bar__quick-slot");
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".suite-bar__quick-slot--drop-target").forEach((el) => {
      if (el !== slot) el.classList.remove("suite-bar__quick-slot--drop-target");
    });
    slot.classList.add("suite-bar__quick-slot--drop-target");
  }

  function onDrop(e) {
    const slot = e.target.closest(".suite-bar__quick-slot");
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove("suite-bar__quick-slot--drop-target");
    const index = Number(slot.getAttribute("data-slot-index"));
    const payload = payloadFromDragEvent(e);
    const sourceIndex = Number(e.dataTransfer.getData("text/x-pockit-slot-index"));
    assignSlot(index, payload, { sourceIndex: Number.isFinite(sourceIndex) ? sourceIndex : -1 });
  }

  function bind(host) {
    boundHost = host || document.querySelector(".suite-bar__quick-bar");
    if (!boundHost || boundHost.dataset.quickBarBound === "1") return;
    boundHost.dataset.quickBarBound = "1";

    boundHost.addEventListener("click", (e) => {
      const clear = e.target.closest("[data-quick-clear]");
      if (clear) {
        e.preventDefault();
        e.stopPropagation();
        clearSlot(Number(clear.getAttribute("data-quick-clear")));
        return;
      }
      const btn = e.target.closest(".suite-bar__quick-slot--filled");
      if (!btn) return;
      if (e.button === 1) {
        e.preventDefault();
        clearSlot(Number(btn.getAttribute("data-slot-index")));
        return;
      }
      const idx = Number(btn.getAttribute("data-slot-index"));
      activateSlot(state.slots[idx]);
    });

    boundHost.addEventListener("auxclick", (e) => {
      if (e.button !== 1) return;
      const btn = e.target.closest(".suite-bar__quick-slot--filled");
      if (!btn) return;
      e.preventDefault();
      clearSlot(Number(btn.getAttribute("data-slot-index")));
    });

    boundHost.addEventListener("dragstart", onDragStart);
    boundHost.addEventListener("dragend", onDragEnd);
    boundHost.addEventListener("dragover", onDragOver);
    boundHost.addEventListener("dragleave", (e) => {
      e.target.closest(".suite-bar__quick-slot")?.classList.remove("suite-bar__quick-slot--drop-target");
    });
    boundHost.addEventListener("drop", onDrop);
  }

  function bindDragSources(root) {
    const scope = root || document;
    scope.querySelectorAll(".sidebar-item-main").forEach((btn) => {
      btn.setAttribute("draggable", "true");
      btn.classList.add("pockit-quick-bar-source");
    });
  }

  function bindGlobalDragSources() {
    if (document.body.dataset.quickBarGlobalDrag === "1") return;
    document.body.dataset.quickBarGlobalDrag = "1";
    document.addEventListener("dragstart", (e) => {
      if (e.target.closest(".suite-bar__quick-bar")) return;
      const btn = e.target.closest(".sidebar-item-main");
      if (!btn) return;
      const payload = payloadFromSidebarButton(btn);
      if (!payload?.type || !payload.id) return;
      setDragPayload(e, payload);
      btn.closest(".sidebar-item")?.classList.add("is-dragging");
    });
    document.addEventListener("dragend", (e) => {
      e.target.closest(".sidebar-item")?.classList.remove("is-dragging");
    });
  }

  function refresh(activeId) {
    const wrap = document.querySelector(".suite-bar__apps");
    if (!wrap) return;
    state = loadState();
    wrap.innerHTML = render(activeId);
    const bar = wrap.querySelector(".suite-bar__quick-bar");
    if (bar) {
      bar.dataset.quickBarBound = "";
      bind(bar);
    }
  }

  function resetToDefaults() {
    state = normalizeState({ slots: defaultSlots() });
    saveState(state);
    refresh();
  }

  global.PockitQuickBar = {
    SLOT_COUNT,
    loadState,
    saveState,
    render,
    bind,
    bindDragSources,
    bindGlobalDragSources,
    refresh,
    resetToDefaults,
    activateSlot,
    resolveSlot,
  };

  bindGlobalDragSources();
})(typeof window !== "undefined" ? window : globalThis);
