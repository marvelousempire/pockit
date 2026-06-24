/**
 * Pockit device viewport registry — Plan 0275 (loads pockit-device-viewports.json).
 */
"use strict";

(function () {
  const TIERS = [
    { id: "watch", max: 320 },
    { id: "phoneCompact", max: 390 },
    { id: "phoneLarge", max: 480 },
    { id: "tabletCompact", max: 834 },
    { id: "tabletLarge", max: 1194 },
    { id: "laptop", max: 1800 },
    { id: "desktop", max: 2560 },
    { id: "display", max: 3840 },
    { id: "tv", max: Infinity },
  ];

  const TIER_TO_FAMILY = {
    watch: "watch",
    phoneCompact: "phone",
    phoneLarge: "phone",
    tabletCompact: "tablet",
    tabletLarge: "tablet",
    laptop: "laptop",
    desktop: "desktop",
    display: "display",
    tv: "tv",
  };

  const FAMILY_LABELS = {
    tv: "TV",
    display: "Display",
    laptop: "Laptop",
    tablet: "Tablet",
    phone: "Phone",
    watch: "Watch",
  };

  let presets = [];
  let loadPromise = null;

  function tierForWidth(w) {
    const width = Number(w) || 0;
    for (const t of TIERS) {
      if (width <= t.max) return t.id;
    }
    return "tv";
  }

  function isCoarsePointer() {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch (_) {
      return false;
    }
  }

  const TABLET_LARGE_MAX = 1194;
  const TABLET_COMPACT_MAX = 834;
  const BROWSER_TABLET_BAND_MAX_W = 1376;
  const BROWSER_TABLET_BAND_MAX_H = 1032;

  function layoutWidthForViewport(width, height, coarse) {
    const w = Number(width) || 1024;
    const h = Number(height) || 768;
    const minDim = Math.min(w, h);
    if (coarse) return minDim;
    if (w <= TABLET_LARGE_MAX) return w;
    if (w <= BROWSER_TABLET_BAND_MAX_W && minDim <= BROWSER_TABLET_BAND_MAX_H) return minDim;
    if (minDim <= TABLET_COMPACT_MAX) return minDim;
    return w;
  }

  function orientationForViewport(width, height) {
    return (Number(width) || 0) >= (Number(height) || 0) ? "landscape" : "portrait";
  }

  function resolveTier(width, height, opts) {
    opts = opts || {};
    if (opts.forceTier) return opts.forceTier;
    const coarse = opts.coarsePointer != null ? opts.coarsePointer : isCoarsePointer();
    const lw = layoutWidthForViewport(width, height, coarse);
    return tierForWidth(lw);
  }

  /** Tile grid columns for mobile HUD / controls sheet / console picker (tier × orientation). Max 10 on TV. */
  function tileGridColumns(tier, orientation) {
    const landscape = orientation === "landscape";
    switch (tier) {
      case "watch":
        return landscape ? 3 : 2;
      case "phoneCompact":
      case "phoneLarge":
        return landscape ? 5 : 4;
      case "tabletCompact":
        return landscape ? 8 : 5;
      case "tabletLarge":
        return landscape ? 8 : 6;
      case "laptop":
        return landscape ? 8 : 6;
      case "desktop":
        return landscape ? 9 : 7;
      case "display":
        return landscape ? 10 : 8;
      case "tv":
        return landscape ? 10 : 8;
      default:
        return landscape ? 8 : 5;
    }
  }

  function scorePreset(width, height, preset) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const dw = Math.abs((preset.width || 0) - w);
    const dh = Math.abs((preset.height || 0) - h);
    const wAllow = Math.max(60, Math.round((preset.width || 0) * 0.15));
    const hAllow = Math.max(100, Math.round((preset.height || 0) * 0.22));
    if (dw > wAllow || dh > hAllow) return null;
    return dw + dh;
  }

  function matchDevicePreset(width, height, list) {
    const arr = list || presets;
    if (!arr.length) return null;
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    let best = null;
    let bestScore = Infinity;
    for (const p of arr) {
      const score = scorePreset(w, h, p);
      if (score != null && score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  function matchDevicePresetByTier(width, height, tier, list) {
    const arr = list || presets;
    if (!arr.length || !tier) return null;
    const orient = orientationForViewport(width, height);
    const family = TIER_TO_FAMILY[tier];
    const candidates = arr.filter(
      (p) => p.tier === tier && p.orientation === orient && (!family || p.family === family),
    );
    if (!candidates.length) return null;
    const w = Number(width) || 0;
    let best = null;
    let bestDw = Infinity;
    for (const p of candidates) {
      const dw = Math.abs((p.width || 0) - w);
      if (dw < bestDw) {
        bestDw = dw;
        best = p;
      }
    }
    return best;
  }

  function iosUaDevicePreset(list) {
    const arr = list || presets;
    if (!arr.length || typeof navigator === "undefined") return null;
    if (!/iPhone/i.test(navigator.userAgent || "")) return null;
    const sw = Number(window.screen?.width) || 0;
    const sh = Number(window.screen?.height) || 0;
    const orient = (window.innerWidth || 0) > (window.innerHeight || 0) ? "landscape" : "portrait";
    const baseId = Math.max(sw, sh) >= 900 ? "iphone-16-pro-max" : "iphone-se";
    return (
      arr.find((p) => p.baseId === baseId && p.orientation === orient)
      || arr.find((p) => p.baseId === baseId && p.orientation === "portrait")
      || arr.find((p) => p.family === "phone" && p.orientation === orient)
      || null
    );
  }

  function presetsByFamily(list) {
    const map = new Map();
    for (const p of list || presets) {
      const fam = p.family || "desktop";
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam).push(p);
    }
    const order = ["tv", "display", "laptop", "tablet", "phone", "watch"];
    return order.filter((f) => map.has(f)).map((f) => ({
      family: f,
      label: FAMILY_LABELS[f] || f,
      presets: map.get(f),
    }));
  }

  function getPresetById(id) {
    return presets.find((p) => p.id === id) || null;
  }

  async function load() {
    if (presets.length) return presets;
    if (loadPromise) return loadPromise;
    loadPromise = fetch("/pockit-device-viewports.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        presets = Array.isArray(j.presets) ? j.presets : [];
        return presets;
      })
      .catch(() => {
        presets = [];
        return presets;
      });
    return loadPromise;
  }

  window.PockitViewportRegistry = {
    TIERS,
    TIER_TO_FAMILY,
    FAMILY_LABELS,
    tierForWidth,
    layoutWidthForViewport,
    orientationForViewport,
    resolveTier,
    tileGridColumns,
    matchDevicePreset,
    matchDevicePresetByTier,
    iosUaDevicePreset,
    presetsByFamily,
    getPresetById,
    load,
    get presets() {
      return presets;
    },
  };
})();
