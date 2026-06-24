/**
 * Pockit viewport tiers — Plan 0260 / 0275
 * Sets body[data-pockit-viewport] + orientation + device identity; Device Lab override.
 */
"use strict";

(function () {
  const REG = () => window.PockitViewportRegistry;
  const SQUEEZE_CENTER_MIN = 320;
  const LAB_SESSION_KEY = "nephew-pockit-device-lab-v1";

  let labOverride = null;

  function readLabSession() {
    try {
      const raw = sessionStorage.getItem(LAB_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeLabSession(data) {
    try {
      if (!data) sessionStorage.removeItem(LAB_SESSION_KEY);
      else sessionStorage.setItem(LAB_SESSION_KEY, JSON.stringify(data));
    } catch (_) {
      /* private mode */
    }
  }

  function isCoarsePointer() {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch (_) {
      return false;
    }
  }

  function viewportSize() {
    if (labOverride?.width && labOverride?.height) {
      return { width: labOverride.width, height: labOverride.height };
    }
    return {
      width: window.innerWidth || 1024,
      height: window.innerHeight || 768,
    };
  }

  function layoutWidth() {
    const reg = REG();
    const { width, height } = viewportSize();
    if (!reg) return width;
    return reg.layoutWidthForViewport(width, height, isCoarsePointer());
  }

  function resolveCurrentTier() {
    const reg = REG();
    const { width, height } = viewportSize();
    if (!reg) return "desktop";
    if (labOverride?.tier) return labOverride.tier;
    if (labOverride?.deviceId) {
      const preset = reg.getPresetById(labOverride.deviceId);
      if (preset?.tier) return preset.tier;
    }
    return reg.resolveTier(width, height, { coarsePointer: isCoarsePointer() });
  }

  function ensureLabFrame() {
    let frame = document.getElementById("pockit-viewport-lab-frame");
    if (frame) return frame;
    const app = document.getElementById("app");
    if (!app?.parentNode) return null;
    frame = document.createElement("div");
    frame.id = "pockit-viewport-lab-frame";
    frame.className = "pockit-viewport-lab-frame";
    app.parentNode.insertBefore(frame, app);
    frame.appendChild(app);
    return frame;
  }

  function applyLabFrameSize(width, height) {
    const frame = ensureLabFrame();
    if (!frame) return;
    document.body.classList.add("pockit-device-lab-active");
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
  }

  function clearLabFrameSize() {
    document.body.classList.remove("pockit-device-lab-active");
    const frame = document.getElementById("pockit-viewport-lab-frame");
    const app = document.getElementById("app");
    if (frame && app && frame.contains(app)) {
      frame.parentNode.insertBefore(app, frame);
      frame.remove();
    }
  }

  function applyTierState(tier, detail) {
    const body = document.body;
    if (!body) return;
    const prev = body.dataset.pockitViewport;
    body.dataset.pockitViewport = tier;
    body.dataset.pockitOrientation = detail.orientation || "portrait";
    body.dataset.pockitDeviceFamily = detail.deviceFamily || "desktop";
    body.dataset.pockitDeviceId = detail.deviceId || "generic";
    body.dataset.pockitDeviceLabel = detail.deviceLabel || "";

    const isPhone = tier === "phoneCompact" || tier === "phoneLarge";
    const isWatch = tier === "watch";
    const isTablet = tier === "tabletCompact" || tier === "tabletLarge";
    const isMobileShell = (isPhone || isTablet) && !isWatch;
    body.classList.toggle("pockit-viewport-watch", isWatch);
    body.classList.toggle("pockit-viewport-phone", isPhone);
    body.classList.toggle("pockit-phone-shell", isMobileShell);
    body.classList.toggle("pockit-viewport-tablet", isTablet);
    body.classList.toggle("pockit-viewport-laptop", tier === "laptop");
    body.classList.toggle("pockit-viewport-display", tier === "display");
    body.classList.toggle("pockit-viewport-tv", tier === "tv");

    const orient = detail.orientation || "portrait";
    const tileCols = REG()?.tileGridColumns?.(tier, orient) ?? 4;
    body.style.setProperty("--pockit-tile-grid-cols", String(tileCols));
    body.style.setProperty("--pockit-mobile-hud-cols", String(tileCols));

    if (prev !== tier || detail.forceEvent !== false) {
      window.dispatchEvent(new CustomEvent("pockit-viewport-change", { detail }));
    }

    if (tier === "tv" && window.PockitConfig?.setRailCollapsed) {
      try {
        window.PockitConfig.setRailCollapsed("player", false);
        window.PockitConfig.setRailCollapsed("cassette", false);
      } catch (_) {
        /* config not ready */
      }
    }

    window.PockitWatchCompanion?.sync?.();
  }

  function refresh(opts) {
    opts = opts || {};
    const reg = REG();
    const { width, height } = viewportSize();
    const tier = resolveCurrentTier();
    const orientation = reg?.orientationForViewport(width, height) || "portrait";
    let matched = reg?.matchDevicePreset(width, height) || null;
    if (!matched) matched = reg?.matchDevicePresetByTier?.(width, height, tier) || null;
    if (!matched && (tier === "phoneCompact" || tier === "phoneLarge")) {
      matched = reg?.iosUaDevicePreset?.() || null;
    }
    const deviceId = labOverride?.deviceId || matched?.id || "generic";
    const deviceLabel = matched?.label || "";
    const deviceFamily = matched?.family || reg?.TIER_TO_FAMILY?.[tier] || "desktop";

    applyTierState(tier, {
      tier,
      orientation,
      deviceFamily,
      deviceId,
      deviceLabel,
      width,
      height,
      labActive: Boolean(labOverride),
      forceEvent: opts.forceEvent !== false,
    });
  }

  function applyLabOverride(spec) {
    if (!spec?.width || !spec?.height) return;
    labOverride = {
      width: Number(spec.width),
      height: Number(spec.height),
      deviceId: spec.deviceId || spec.id || null,
      tier: spec.tier || null,
    };
    writeLabSession(labOverride);
    applyLabFrameSize(labOverride.width, labOverride.height);
    refresh({ forceEvent: true });
  }

  function clearLabOverride() {
    labOverride = null;
    writeLabSession(null);
    clearLabFrameSize();
    refresh({ forceEvent: true });
  }

  function getLabOverride() {
    return labOverride ? { ...labOverride } : null;
  }

  function initLabFromSession() {
    const saved = readLabSession();
    if (saved?.width && saved?.height) {
      labOverride = saved;
      applyLabFrameSize(saved.width, saved.height);
    }
  }

  window.PockitViewport = {
    get TIERS() {
      return REG()?.TIERS || [];
    },
    SQUEEZE_CENTER_MIN,
    tierForWidth: (w) => REG()?.tierForWidth(w) || "desktop",
    layoutWidth,
    viewportSize,
    resolveTier: (w, h, o) => REG()?.resolveTier(w, h, o) || "desktop",
    matchDevicePreset: (w, h) => REG()?.matchDevicePreset(w, h) || null,
    applyLabOverride,
    clearLabOverride,
    getLabOverride,
    get tier() {
      return document.body?.dataset.pockitViewport || "desktop";
    },
    get orientation() {
      return document.body?.dataset.pockitOrientation || "portrait";
    },
    get deviceId() {
      return document.body?.dataset.pockitDeviceId || "generic";
    },
    get deviceLabel() {
      return document.body?.dataset.pockitDeviceLabel || "";
    },
    get deviceFamily() {
      return document.body?.dataset.pockitDeviceFamily || "desktop";
    },
    isWatch() {
      return this.tier === "watch";
    },
    isPhone() {
      const t = this.tier;
      return t === "phoneCompact" || t === "phoneLarge";
    },
    isTablet() {
      const t = this.tier;
      return t === "tabletCompact" || t === "tabletLarge";
    },
    isMobileShell() {
      const t = this.tier;
      return (
        t === "phoneCompact"
        || t === "phoneLarge"
        || t === "tabletCompact"
        || t === "tabletLarge"
      );
    },
    tileGridColumns(tier, orientation) {
      return REG()?.tileGridColumns?.(tier, orientation) ?? 4;
    },
    refresh,
  };

  function boot() {
    initLabFromSession();
    REG()?.load?.().finally(() => refresh({ forceEvent: true }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", () => refresh(), { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => refresh({ forceEvent: true }), 100);
  }, { passive: true });
})();
