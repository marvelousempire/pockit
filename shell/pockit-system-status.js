/**
 * Plan 0437 — System status pills: Processor (M1/M4/M5/DGX) + Device (iPhone, MacBook, iMac…).
 */
(function (global) {
  "use strict";

  let catalog = null;
  let catalogPromise = null;
  let fleet = null;
  let fleetAt = 0;
  let advisorCtx = null;
  const FLEET_TTL_MS = 20_000;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch("/pockit-system-status.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        catalog = j;
        return catalog;
      })
      .catch(() => {
        catalog = { processors: [], devices: [], sections: {} };
        return catalog;
      });
    return catalogPromise;
  }

  async function fetchFleet(force = false) {
    const now = Date.now();
    if (!force && fleet && now - fleetAt < FLEET_TTL_MS) return fleet;
    try {
      const res = await fetch("/api/v1/yousirjuan-status", { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      fleet = await res.json();
      fleetAt = now;
    } catch {
      fleet = fleet || { devices: [] };
    }
    return fleet;
  }

  function inventoryRow(id) {
    const rows = fleet?.devices || [];
    return rows.find((d) => d.id === id) || null;
  }

  function inventoryState(ids) {
    const list = (ids || []).map((id) => inventoryRow(id)).filter(Boolean);
    if (!list.length) return "pending";
    const planned = list.every((d) => d.status === "planned");
    if (planned) return "pending";
    const reachable = list.some((d) => d.reachable === true);
    if (reachable) return "ok";
    const probed = list.some((d) => d.probe && d.probe !== "none");
    if (probed && list.every((d) => d.reachable === false)) return "bad";
    return "pending";
  }

  async function refreshAdvisor(force = false) {
    if (global.VoiceSystemAdvisor?.probe) {
      advisorCtx = await global.VoiceSystemAdvisor.probe(force);
    }
    return advisorCtx;
  }

  function chipMatches(proc, haystack) {
    const text = String(haystack || "");
    return (proc.match || []).some((m) => new RegExp(m, "i").test(text));
  }

  function detectProcessorId(ctx) {
    const c = ctx || advisorCtx || {};
    const hw = c.hw || {};
    const blob = [hw.detected, hw.chip, hw.summary, c.hostLabel, c.hostDetail].filter(Boolean).join(" ");
    const cat = catalog?.processors || [];
    for (const proc of cat) {
      if (chipMatches(proc, blob)) return proc.id;
    }
    if (/iPhone|iPad/i.test(navigator.userAgent || "")) return null;
    return null;
  }

  function presetBaseId() {
    const vp = global.PockitViewport;
    const deviceId = vp?.deviceId || document.body?.dataset?.pockitDeviceId || "";
    if (!deviceId || deviceId === "generic") return null;
    const preset = global.PockitViewportRegistry?.getPresetById?.(deviceId);
    return preset?.baseId || deviceId.replace(/-(portrait|landscape)$/, "") || null;
  }

  function detectDeviceId() {
    const base = presetBaseId();
    if (!base) {
      const ua = navigator.userAgent || "";
      if (/iPhone/i.test(ua)) {
        const sw = Math.max(window.screen?.width || 0, window.screen?.height || 0);
        return sw >= 900 ? "iphone-16-pro-max" : "iphone-16-pro";
      }
      return null;
    }
    const devices = catalog?.devices || [];
    const hit = devices.find((d) => d.presetBaseId === base);
    return hit?.id || null;
  }

  function processorPill(proc, currentId, voiceOverlay) {
    const ids = proc.inventoryIds || [];
    let state = inventoryState(ids);
    const isCurrent = currentId === proc.id;
    if (isCurrent) state = "active";

    const vo = voiceOverlay || {};
    if (proc.id === "m5" && vo.m5Pinned) state = "active";
    else if (proc.id === "m5" && vo.m5Healthy && state !== "active") state = vo.m5Pinned ? "active" : "ok";
    else if (proc.id === "dgx" && vo.dgxPinned) state = "active";
    else if (proc.id === "dgx" && vo.dgxHealthy && state !== "active") state = vo.dgxPinned ? "active" : "ok";

    if (proc.id === "m5" && vo.healthProbePending) state = "pending";
    else if (proc.id === "m5" && isCurrent && vo.m5Healthy === false) state = "bad";
    else if (proc.id === "dgx" && vo.dgxHealthy === false && (isCurrent || vo.dgxPinned)) state = "bad";

    const inv = ids.map((id) => inventoryRow(id)).find(Boolean);
    const detail = inv?.detail || inv?.notes || "";
    const reach = inv?.reachable === true ? "Online" : inv?.reachable === false ? "Offline" : inv?.status === "planned" ? "Planned" : "Unknown";
    const tip = `${proc.label}\n${isCurrent ? "This session's silicon" : "Family processor"} · ${reach}${detail ? `\n${detail}` : ""}`;

    return {
      id: `proc-${proc.id}`,
      label: proc.label,
      section: "processor",
      state,
      tip,
      modal: {
        title: `${proc.label} processor`,
        kicker: "System status",
        variant: proc.id,
        bodyHtml: `<p class="pockit-pill-modal__lead"><strong>${esc(proc.label)}</strong> — ${isCurrent ? "detected on this session." : "part of the family stack."}</p>
          <ul class="pockit-pill-modal__list">
            <li>Fleet: <strong>${esc(reach)}</strong></li>
            ${detail ? `<li>${esc(detail)}</li>` : ""}
            ${vo.m5Healthy != null && proc.id === "m5" ? `<li>Voice edge: <strong>${vo.m5Healthy ? "Holler online" : "Offline"}</strong></li>` : ""}
            ${vo.dgxHealthy != null && proc.id === "dgx" ? `<li>Spark stack: <strong>${vo.dgxHealthy ? "Premium TTS online" : "Offline"}</strong></li>` : ""}
          </ul>`,
        actions: [{ label: "Close", primary: true, action: () => {} }],
      },
    };
  }

  function devicePill(dev, currentId) {
    const isCurrent = currentId === dev.id;
    let state = inventoryState(dev.inventoryIds);
    if (isCurrent) state = "active";
    else if (state === "pending" && dev.presetBaseId && presetBaseId() === dev.presetBaseId) state = "active";

    const inv = (dev.inventoryIds || []).map((id) => inventoryRow(id)).find(Boolean);
    const vpLabel = global.PockitViewport?.deviceLabel || "";
    const detail = inv?.detail || vpLabel || dev.label;
    const reach = inv?.reachable === true ? "Online" : inv?.reachable === false ? "Offline" : inv?.status === "planned" ? "Planned" : isCurrent ? "This session" : "Preset";
    const tip = `${dev.label}\n${isCurrent ? "You are on this form factor" : "Family device preset"} · ${reach}`;

    return {
      id: `dev-${dev.id}`,
      label: dev.shortLabel || dev.label,
      section: "device",
      state,
      tip,
      modal: {
        title: dev.label,
        kicker: "System status",
        variant: "device",
        bodyHtml: `<p class="pockit-pill-modal__lead"><strong>${esc(dev.label)}</strong>${isCurrent ? " — active viewport for this session." : " — family device in the Pockit viewport matrix."}</p>
          <ul class="pockit-pill-modal__list">
            <li>Status: <strong>${esc(reach)}</strong></li>
            ${detail ? `<li>${esc(detail)}</li>` : ""}
            <li>Open <strong>Settings → Devices</strong> to preview this form factor in Device Lab.</li>
          </ul>`,
        actions: [
          isCurrent
            ? null
            : {
                label: "Open Device Lab",
                primary: true,
                action: () => global.openSettingsModal?.("devices"),
              },
          { label: "Close", action: () => {} },
        ].filter(Boolean),
      },
    };
  }

  function voiceRoutePills() {
    const st = global.ParakeetVoicePad?.getState?.() || {};
    const h = st.health || {};
    const pills = [];
    const probing = Boolean(h.healthProbePending);
    if (st.textOnly || h.premiumAvailable === false) {
      pills.push({
        id: "voice-text",
        label: "Text",
        section: "voice",
        state: "warn",
        tip: "Text-only mode\nAmber = premium voice offline — chat still works in text",
      });
    }
    if (probing) return pills;
    return pills;
  }

  function voiceOverlay() {
    const st = global.ParakeetVoicePad?.getState?.() || {};
    const h = st.health || {};
    return {
      m5Healthy: h.m5Healthy,
      dgxHealthy: h.dgxHealthy || h.sttHealthy,
      m5Pinned: st.route === "m5",
      dgxPinned: st.route === "dgx",
      healthProbePending: h.healthProbePending,
    };
  }

  async function buildPills() {
    await loadCatalog();
    await Promise.all([fetchFleet(), refreshAdvisor()]);
    const currentProc = detectProcessorId(advisorCtx);
    const currentDev = detectDeviceId();
    const vo = voiceOverlay();
    const pills = [];
    for (const proc of catalog.processors || []) {
      pills.push(processorPill(proc, currentProc, vo));
    }
    for (const dev of catalog.devices || []) {
      pills.push(devicePill(dev, currentDev));
    }
    return pills;
  }

  function pillsSync() {
    if (!catalog) return [];
    const currentProc = detectProcessorId(advisorCtx);
    const currentDev = detectDeviceId();
    const vo = voiceOverlay();
    const out = [];
    for (const proc of catalog.processors || []) {
      out.push(processorPill(proc, currentProc, vo));
    }
    for (const dev of catalog.devices || []) {
      out.push(devicePill(dev, currentDev));
    }
    return out;
  }

  let refreshTimer = null;

  function scheduleFleetRefresh(scope) {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(async () => {
      refreshTimer = null;
      await fetchFleet(true);
      await refreshAdvisor(true);
      global.PockitPlayerContextPills?.refresh?.(scope || global.currentCassetteId?.());
    }, 80);
  }

  async function init() {
    await loadCatalog();
    await fetchFleet();
    await refreshAdvisor();
    window.addEventListener("pockit-viewport-change", () => {
      global.PockitPlayerContextPills?.refresh?.(global.currentCassetteId?.());
      scheduleFleetRefresh();
    });
  }

  global.PockitSystemStatus = {
    loadCatalog,
    fetchFleet,
    refreshAdvisor,
    buildPills,
    pillsSync,
    voiceRoutePills,
    init,
    scheduleFleetRefresh,
    get sections() {
      return catalog?.sections || {};
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})(window);
