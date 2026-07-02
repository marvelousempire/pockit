// Plan 0116 Phase A — Hub as Cassette Player
//
// Layout: left sidebar (manifest-driven card list) + right main frame (cassette body).
// - Click a sidebar item → cassette loads in the main frame (iframe for external URLs)
// - Per-item ↗ button + main-header ↗ button → open same URL in new tab (shared session)
// - Hash routing: #/c/<id> selects a cassette; #/ or empty selects Overview
// - Overview is itself a "cassette" — renders the cards grid in the main frame
// - Iframe load-failure detection → falls back to "can't be embedded" prompt
//
// No framework, no build step. Single file, vanilla JS.

"use strict";

function pockitSurfaceLabel() {
  const s = window.PockitSurface?.surface || window.PadSurface?.surface || window.HubSurface?.surface;
  const name = (s?.display_name || "Pockit").trim();
  return name || "Pockit";
}
function hubCssVerFromBundle() {
  const src = document.querySelector('script[src*="pockit-surface.js"]')?.getAttribute("src") || "";
  const m = src.match(/[?&]v=([\d.]+)/);
  return m?.[1] || null;
}
function pockitSurfaceVersion() {
  const ps = window.PockitSurface || window.PadSurface || window.HubSurface;
  const live = ps?.runningVersion || ps?.surface?.version || ps?.version;
  if (live && live !== "—") return live;
  return hubCssVerFromBundle() || "—";
}
function syncFooterVersionChrome() {
  window.PadSurface?.notifyVersionChrome?.() || window.PadSurface?.ensureVersionChrome?.();
}

function renderMobileVersionPillHtml(id = "pockit-mobile-version-pill") {
  const ps = window.PadSurface?.surface || window.PockitSurface?.surface;
  const ver = pockitSurfaceVersion();
  const name = ps?.display_name || "Pockit";
  const label = ver && ver !== "—" ? `${name} v${ver}` : name;
  return `<button type="button" id="${escapeHtml(id)}" class="pockit-mobile-version-pill shell-version-btn" data-action="pad-changelog" data-changelog-open-tab="pockit" aria-label="${escapeHtml(label)} changelog">
    <span class="shell-version-btn__dot" aria-hidden="true"></span>
    <span class="shell-version-btn__label">${escapeHtml(label)}</span>
  </button>`;
}

function ensureMobileHudVersionPill(hud) {
  const header = hud?.querySelector?.(".pockit-mobile-hud__header");
  if (!header || header.querySelector("#pockit-mobile-hud-version")) return;
  const trailing = document.createElement("div");
  trailing.className = "pockit-mobile-hud__header-trailing";
  trailing.innerHTML = `${renderMobileVersionPillHtml("pockit-mobile-hud-version")}${header.querySelector(".pockit-mobile-hud__close")?.outerHTML || ""}`;
  const closeBtn = header.querySelector(".pockit-mobile-hud__close");
  if (closeBtn) closeBtn.remove();
  header.appendChild(trailing);
  window.PadSurface?.bindChangelogLinks?.(header);
  syncFooterVersionChrome();
}


function hubIcon(item) {
  return typeof AntIcons !== "undefined" ? AntIcons.forItem(item) : escapeHtml(item?.glyph || "·");
}
function optIcon(opt) {
  return typeof AntIcons !== "undefined" ? AntIcons.forOption(opt) : escapeHtml(opt?.glyph || "");
}
function antIcon(name) {
  return typeof AntIcons !== "undefined" ? AntIcons.render(name) : "";
}
function hydrateIcons(root) {
  if (typeof AntIcons !== "undefined") AntIcons.hydrate(root || document);
}

function renderStatusTag(label, state = "default", opts = {}) {
  const map = {
    ok: "success",
    warn: "warning",
    bad: "error",
    pending: "processing",
    success: "success",
    warning: "warning",
    error: "error",
    processing: "processing",
    default: "default",
  };
  const st = map[state] || state;
  const href = opts.href;
  const action = opts.action;
  const showDot = st !== "default";
  const dot = showDot ? `<span class="ant-status-tag__dot" aria-hidden="true"></span>` : "";
  let inner;
  if (action === "pad-changelog") {
    inner = `<button type="button" class="ant-status-tag__btn" data-action="pad-changelog">${escapeHtml(label)}</button>`;
  } else if (href) {
    inner = `<a class="ant-status-tag__link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  } else {
    inner = `<span class="ant-status-tag__label">${escapeHtml(label)}</span>`;
  }
  const interactive = action ? " ant-status-tag--interactive" : "";
  const tag = action ? "span" : "span";
  return `<${tag} class="ant-status-tag ant-status-tag--${st}${interactive}" role="status">${dot}${inner}</${tag}>`;
}

function renderHealthStatusTag(label, state = "pending", opts = {}) {
  return renderStatusTag(label, state, opts);
}

function healthCheckState(c) {
  if (c.ok) return "ok";
  if (c.label === "Chat" || c.warn === true) return "warn";
  return "bad";
}

function renderHealthStatusPills(checks) {
  const pills = [];
  for (const [, c] of Object.entries(checks || {})) {
    if (c.label === "Chat" && c.configured === false) continue;
    pills.push(renderHealthStatusTag(c.label, healthCheckState(c)));
  }
  return pills.join("");
}

let cachedHealthPillsHtml = "";
let cachedTowerApiVersion = "—";

function cometTipAttr(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "&#10;");
}

function pockitTip(key) {
  return window.CometTooltip?.tip?.(key) || "";
}

function refreshCometTooltips(root) {
  window.CometTooltip?.refresh?.(root || document);
}

function shellHealthState(state) {
  const map = { ok: "ok", warn: "warn", bad: "bad", pending: "pending", success: "ok", warning: "warn", error: "bad", processing: "pending" };
  return map[state] || "pending";
}

function renderShellHealthPill(label, state = "pending", title = label) {
  const st = shellHealthState(state);
  const detail = title && title !== label ? String(title).replace(/^[^:]+:\s*/, "").trim() : "Live status from the family gateway";
  const tip = `${label}\n${detail}`;
  return `<span class="shell-health-pill shell-health-pill--${st}" role="status" data-comet-tip="${cometTipAttr(tip)}">
    <span class="shell-health-pill__led" aria-hidden="true"></span>
    <span class="shell-health-pill__label">${escapeHtml(label)}</span>
  </span>`;
}

function renderShellHealthPills(checks) {
  const pills = [];
  for (const [, c] of Object.entries(checks || {})) {
    if (c.label === "Chat" && c.configured === false) continue;
    const title = c.detail ? `${c.label}: ${c.detail}` : c.label;
    pills.push(renderShellHealthPill(c.label, healthCheckState(c), title));
  }
  return pills.join("");
}




// Plan 0135 Phase 1 — cards are manifest-driven. DEFAULT_CARDS is the built-in
// fallback; on boot, loadCards() replaces CARDS with /family-hub-cards.json so
// the sidebar can be edited without touching this file. If the fetch fails or
// the payload is malformed, the Hub renders from DEFAULT_CARDS — never empty.
// Plan 0138 hardening (2026-06-03): DEFAULT_CARDS no longer ships the internal
// structure. Real cards come only from the auth-gated /api/v1/family/hub-cards
// after sign-in; anonymous visitors never receive the site map. This minimal
// fallback only shows if an authenticated load fails.
const DEFAULT_CARDS = [
  {
    section: "Home",
    items: [
      { id: "overview", title: "Overview", glyph: "⌂", subtitle: "All cartridges at a glance", url: null, type: "overview", pill: "Home" },
    ],
  },
  {
    section: "Prompt Library",
    items: [
      {
        id: "prompt-library",
        title: "Prompts",
        glyph: "📋",
        subtitle: "#Reporting #SystemArchitecture — operator prompt library",
        url: null,
        type: "prompt-library",
        pill: "Operator",
      },
    ],
  },
];

// Active card set — starts as the built-in default, replaced by the manifest on boot.
let CARDS = DEFAULT_CARDS;

// Plan 0154 — framework role catalog for sidebar chips (player vs tape in context).
let FRAMEWORK = null;
let FRAMEWORK_LIBRARY = null;
let POCKIT_CATALOG = null;
/** Full unfiltered fleet catalog after hydrate (Plan 0461 — settings toggles source). */
let POCKIT_FLEET_CATALOG = null;
/** Active catalog entitlements — core | fleet | custom (Plan 0461). */
let POCKIT_CATALOG_ENTITLEMENTS = null;
/** core → hydrating → operator (Plan 0460 — shell first, fleet catalog async). */
let POCKIT_CATALOG_PHASE = "core";

function syncFleetCatalogGlobal() {
  try {
    window.POCKIT_FLEET_CATALOG = POCKIT_FLEET_CATALOG;
  } catch {
    /* non-browser */
  }
}

async function loadCatalogEntitlements() {
  if (window.PockitCatalogEntitlements?.loadEntitlements) {
    POCKIT_CATALOG_ENTITLEMENTS = await window.PockitCatalogEntitlements.loadEntitlements();
    return POCKIT_CATALOG_ENTITLEMENTS;
  }
  POCKIT_CATALOG_ENTITLEMENTS = { schema_version: 1, mode: "fleet", players: {} };
  return POCKIT_CATALOG_ENTITLEMENTS;
}

function applyCatalogEntitlementsToDisplay() {
  const ent = POCKIT_CATALOG_ENTITLEMENTS || { mode: "fleet" };
  const filter = window.PockitCatalogEntitlements?.filterCatalogByEntitlements;
  if (ent.mode === "core") {
    return loadPockitCoreCatalog();
  }
  if (!POCKIT_FLEET_CATALOG || !filter) {
    POCKIT_CATALOG = POCKIT_FLEET_CATALOG;
    sanitizePockitPlayerSelection();
    return Promise.resolve(Boolean(POCKIT_CATALOG));
  }
  const filtered = filter(POCKIT_FLEET_CATALOG, ent);
  POCKIT_CATALOG = filtered || POCKIT_FLEET_CATALOG;
  sanitizePockitPlayerSelection();
  return Promise.resolve(true);
}

async function refreshCatalogFromEntitlements() {
  await applyCatalogEntitlementsToDisplay();
  if (POCKIT_CATALOG_ENTITLEMENTS?.mode === "core") {
    POCKIT_CATALOG_PHASE = "operator";
  }
  const routeId = currentCassetteId();
  if (routeId && routeId !== "overview" && routeId !== "library" && routeId !== "welcome" && !findCassette(routeId)) {
    queuePockitPendingRoute(routeId);
    if (POCKIT_CATALOG_PHASE === "operator") {
      setCassette("overview", { pushHistory: true, force: true });
    }
    return;
  }
  applyOperatorCatalogPostHydrate();
}
let POCKIT_FILTER = "";
let POCKIT_SCOPE = localStorage.getItem("nephew-pockit-scope") || localStorage.getItem("nephew-launchpad-scope") || "all";
let LAUNCHPAD_SECTION = "";
let POCKIT_PLAYER = localStorage.getItem("nephew-pockit-player") || localStorage.getItem("nephew-launchpad-player") || "";
if (POCKIT_PLAYER === "launchpad") POCKIT_PLAYER = "pockit";
/** Active sidebar_group for the selected player — drives the right cassette rail. */
let POCKIT_PLAYER_GROUP = "";
let POCKIT_MAC_APP = (() => {
  try {
    return localStorage.getItem("nephew-pockit-mac-app") || "pockit";
  } catch {
    return "pockit";
  }
})();
let familySsoWarmed = false;
/** Skip hashchange echo while setCassette drives location.hash. */
let hashSyncInFlight = false;
/** Suppress same-id setCassette re-entry while render/sync is in flight. */
let setCassetteInFlight = null;
(function seedPockitGatewayPort() {
  try {
    const p = window.location.port;
    if (p && p !== "80" && p !== "443") window.__pockitGatewayPort = p;
  } catch {
    /* ignore */
  }
})();
function releaseSetCassetteInFlight(routeId) {
  if (routeId && setCassetteInFlight === routeId) setCassetteInFlight = null;
}
/** Cancel stale mountFamilyCassetteIframe async completions. */
let mountFamilyIframeGeneration = 0;
const POCKIT_PENDING_DEEP_LINK_KEY = "pockit.pendingDeepLink";
/** Queued cassette route while core/operator catalog is still hydrating (Plan 0460 race). */
const POCKIT_PENDING_ROUTE_KEY = "pockit.pendingRoute";
/** Avoid remounting the main iframe when hash churn repeats the same cassette. */
let lastMainFrameKey = null;
/** Last canonical route that finished rendering — hashchange noop when settled. */
let lastSettledRouteId = null;
let lastRoutePersistTimer = null;

function persistPockitLastRoute(routeId) {
  if (!routeId || routeId === "welcome") return;
  const hash = cassetteHashFor(routeId);
  clearTimeout(lastRoutePersistTimer);
  lastRoutePersistTimer = setTimeout(() => {
    try {
      localStorage.setItem("nephew-pockit-last-hash", hash);
    } catch {
      /* ignore */
    }
    fetch("/api/v1/runtime/pockit-last-route", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    }).catch(() => {});
  }, 400);
}

async function renderMainFrameWithReadiness(c) {
  const routeId = canonicalHashCassetteId(c.id);
  try {
    const gate = window.PockitReadinessGate;
    if (!gate) {
      renderMainFrame(c);
      return;
    }
    const block = await gate.checkRoute(c.id);
    if (block.ok) {
      gate.stopPoll?.();
      renderMainFrame(c);
      return;
    }
    const content = document.getElementById("main-content");
    if (!content) return;
    const routeKey = gate.cassetteRouteKey?.(c.id) || block.key;
    if (gate.isWarmingShown?.(content, routeKey)) {
      gate.mountWarming(content, block, () => {
        gate.stopPoll?.();
        gate.invalidateCache?.();
        renderMainFrame(c);
      });
      finishMainFrameRender(c, { settled: false });
      return;
    }
    beginMainViewSwap();
    gate.mountWarming(content, block, () => {
      gate.stopPoll?.();
      gate.invalidateCache?.();
      renderMainFrame(c);
    });
    finishMainFrameRender(c, { settled: false });
  } finally {
    if (setCassetteInFlight === routeId && pendingIframeMountRouteId !== routeId) {
      releaseSetCassetteInFlight(routeId);
    }
  }
}
/** Family-door iframe mount awaiting SSO ticket — dedup until src lands. */
let pendingIframeMountRouteId = null;
const FRAMEWORK_BY_ID = new Map();
const FRAMEWORK_BY_HUB = new Map();
/** Player sidebar index — all tapes hosted by nephew-tape (from framework library). */
const TAPE_SIDEBAR_ITEMS = new Map();

async function loadFrameworkCatalog() {
  try {
    const r = await fetch("/api/v1/framework/catalog", tapeFetchInit({ cache: "no-cache" }));
    if (!r.ok) return;
    FRAMEWORK = await r.json();
    FRAMEWORK_BY_ID.clear();
    FRAMEWORK_BY_HUB.clear();
    for (const ent of FRAMEWORK.entities || []) {
      FRAMEWORK_BY_ID.set(ent.id, ent);
      if (ent.hub_card_id) FRAMEWORK_BY_HUB.set(ent.hub_card_id, ent);
    }
  } catch { /* optional */ }
}

async function loadFrameworkLibrary() {
  try {
    const r = await fetch("/api/v1/framework/library", tapeFetchInit({ cache: "no-cache" }));
    if (!r.ok) return;
    FRAMEWORK_LIBRARY = await r.json();
  } catch { /* optional */ }
}

const POCKIT_CORE_CATALOG_FALLBACK = {
  schema_version: 2,
  product: "pockit-core",
  players: [],
  unassigned_cassettes: [],
  mac_apps: [],
  mac_app_count: 0,
};

/** Tier 0 — minimal pocket (default Mac accessories only). */
async function loadPockitCoreCatalog() {
  try {
    const r = await fetch("/pockit-core-catalog.json", tapeFetchInit({ cache: "default" }));
    if (r.ok) {
      const data = await r.json();
      if (data?.product === "pockit-core" || data?.mac_apps) {
        POCKIT_CATALOG = data;
        POCKIT_CATALOG_PHASE = "core";
        sanitizePockitPlayerSelection();
        rebuildTapeSidebarIndex();
        return true;
      }
    }
  } catch {
    /* offline — use inline fallback */
  }
  POCKIT_CATALOG = { ...POCKIT_CORE_CATALOG_FALLBACK };
  POCKIT_CATALOG_PHASE = "core";
  return false;
}

/** Tier 1 — server-filtered catalog (operators may request ?full=1 for Settings tree). */
async function loadOperatorPockitCatalog(opts = {}) {
  const wantFull = opts.full === true;
  const tenant = opts.tenant || "default";
  const apiQuery = wantFull ? `?full=1&tenant=${encodeURIComponent(tenant)}` : `?tenant=${encodeURIComponent(tenant)}`;
  const sources = wantFull
    ? [`/api/v1/framework/pockit-catalog${apiQuery}`, "/pockit-catalog.json", "/launchpad-catalog.json"]
    : [`/api/v1/framework/pockit-catalog${apiQuery}`, "/api/v1/framework/launchpad-catalog", "/pockit-catalog.json", "/launchpad-catalog.json"];
  let catalog = null;
  let staticMacApps = null;
  let staticMacCount = null;

  for (const src of sources) {
    try {
      const r = await fetch(src, tapeFetchInit({ cache: "no-cache" }));
      if (!r.ok) continue;
      const data = await r.json();
      const hasPlayers = (data?.players?.length || 0) > 0;
      const isCore = data?.product === "pockit-core";
      if (!hasPlayers && !isCore && !data?.mac_apps?.length) continue;
      if (data.mac_apps?.length) {
        POCKIT_CATALOG = data;
        sanitizePockitPlayerSelection();
        return true;
      }
      if (src.includes("catalog.json")) {
        staticMacApps = data.mac_apps || null;
        staticMacCount = data.mac_app_count ?? null;
      }
      if (!catalog) catalog = data;
    } catch {
      /* try next source */
    }
  }

  if (!catalog) return false;

  if (!catalog.mac_apps?.length) {
    if (!staticMacApps?.length) {
      for (const src of ["/pockit-catalog.json", "/launchpad-catalog.json"]) {
        try {
          const r = await fetch(src, tapeFetchInit({ cache: "no-cache" }));
          if (!r.ok) continue;
          const data = await r.json();
          if (data.mac_apps?.length) {
            staticMacApps = data.mac_apps;
            staticMacCount = data.mac_app_count ?? data.mac_apps.length;
            break;
          }
        } catch {
          /* optional */
        }
      }
    }
    if (staticMacApps?.length) {
      catalog.mac_apps = staticMacApps;
      catalog.mac_app_count = staticMacCount ?? staticMacApps.length;
    }
  }

  POCKIT_CATALOG = catalog;
  sanitizePockitPlayerSelection();
  return true;
}

/** @deprecated use loadPockitCoreCatalog + loadOperatorPockitCatalog */
async function loadPockitCatalog() {
  await loadPockitCoreCatalog();
  return loadOperatorPockitCatalog();
}

function showCatalogHydrateBanner(show) {
  const app = document.getElementById("app");
  if (!show) {
    document.getElementById("pockit-catalog-hydrate")?.remove();
    document.body.classList.remove("pockit-catalog-hydrating");
    return;
  }
  document.body.classList.add("pockit-catalog-hydrating");
  let el = document.getElementById("pockit-catalog-hydrate");
  if (!el && app) {
    el = document.createElement("div");
    el.id = "pockit-catalog-hydrate";
    el.className = "pockit-catalog-hydrate";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    app.prepend(el);
  }
  if (el) el.textContent = "Loading your consoles and cartridges…";
}

function queuePockitPendingRoute(id) {
  const canon = canonicalHashCassetteId(id);
  if (!canon || canon === "overview" || canon === "library" || canon === "welcome") return;
  try {
    sessionStorage.setItem(POCKIT_PENDING_ROUTE_KEY, canon);
  } catch {
    /* private mode */
  }
}

function clearPockitPendingRoute() {
  try {
    sessionStorage.removeItem(POCKIT_PENDING_ROUTE_KEY);
  } catch {
    /* ignore */
  }
}

function peekPockitPendingRoute() {
  try {
    const id = sessionStorage.getItem(POCKIT_PENDING_ROUTE_KEY);
    return id && /^[\w:-]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function replayPockitPendingRoute() {
  const pending = peekPockitPendingRoute();
  if (!pending || !findCassette(pending)) return false;
  clearPockitPendingRoute();
  setCassette(pending, { pushHistory: false, force: true });
  return true;
}

function renderRouteLoadingCanvas(requestedId) {
  const content = document.getElementById("main-content");
  if (!content) return;
  const label = pockitDisplayLabel(requestedId) || requestedId;
  mountCenterCanvas(
    `<div class="loading pockit-route-loading" role="status" aria-live="polite">
      <p>Loading <strong>${escapeHtml(label)}</strong>…</p>
      <p class="hint-msg">Syncing your catalog — this view opens when ready.</p>
    </div>`,
    { id: requestedId, type: "loading", title: label },
  );
}

function applyOperatorCatalogPostHydrate() {
  if (replayPockitPendingRoute()) return;
  if (POCKIT_CATALOG?.mac_apps?.length && currentCassetteId() === "overview") {
    clearPockitPlayerFilter();
  }
  if (POCKIT_CATALOG?.players && POCKIT_PLAYER) {
    const known = new Set([
      ...POCKIT_CATALOG.players.map((p) => p.id),
      "_unassigned",
    ]);
    if (!known.has(POCKIT_PLAYER)) {
      POCKIT_PLAYER = "";
      POCKIT_PLAYER_GROUP = "";
      localStorage.removeItem("nephew-pockit-player");
    } else {
      POCKIT_PLAYER_GROUP = resolvePlayerGroupForPlayer(POCKIT_PLAYER, POCKIT_PLAYER_GROUP);
    }
  }
  rebuildTapeSidebarIndex();
  injectLibraryNav();
  renderSidebar();
  refreshCassetteRailDock();
  const routeId = currentCassetteId();
  if (routeId === "overview" || routeId === "library") {
    const card = findCassette(routeId);
    if (card) renderMainFrame(card);
  } else {
    const hashMatch = (window.location.hash || "").match(/^#\/c\/([\w-]+)/);
    const hashId = hashMatch?.[1];
    if (hashId && hashId !== "overview" && findCassette(hashId)) {
      setCassette(hashId, { pushHistory: false, force: true });
    } else if (routeId && routeId !== "welcome" && findCassette(routeId)) {
      setCassette(routeId, { pushHistory: false, force: true });
    } else {
      const pending = sessionStorage.getItem(POCKIT_PENDING_DEEP_LINK_KEY);
      if (pending && findCassette(pending)) {
        setCassette(pending, { pushHistory: false });
      }
    }
  }
}

async function hydrateOperatorManifest() {
  if (POCKIT_CATALOG_PHASE === "hydrating") return;
  await loadCatalogEntitlements();
  if (POCKIT_CATALOG_ENTITLEMENTS?.mode === "core") {
    POCKIT_CATALOG_PHASE = "operator";
    await loadPockitCoreCatalog();
    applyOperatorCatalogPostHydrate();
    return;
  }
  if (POCKIT_CATALOG_PHASE === "operator" && POCKIT_FLEET_CATALOG) {
    await applyCatalogEntitlementsToDisplay();
    applyOperatorCatalogPostHydrate();
    return;
  }
  POCKIT_CATALOG_PHASE = "hydrating";
  showCatalogHydrateBanner(true);
  try {
    const canFull = globalThis.POCKIT_ENTITLEMENTS_META?.can_request_full_catalog === true;
    await Promise.all([loadCards(), loadFrameworkCatalog(), loadFrameworkLibrary()]);
    if (canFull) {
      await loadOperatorPockitCatalog({ full: true });
      POCKIT_FLEET_CATALOG = JSON.parse(JSON.stringify(POCKIT_CATALOG));
      syncFleetCatalogGlobal();
    }
    await loadOperatorPockitCatalog({ full: false });
    if (canFull && POCKIT_FLEET_CATALOG) {
      await applyCatalogEntitlementsToDisplay();
    } else {
      sanitizePockitPlayerSelection();
    }
    mergeCatalogOperatorDoorsIntoCards();
    POCKIT_CATALOG_PHASE = "operator";
    applyOperatorCatalogPostHydrate();
  } catch (err) {
    console.warn("[pockit] operator catalog hydrate failed — core shell remains", err);
    POCKIT_CATALOG_PHASE = "core";
  } finally {
    showCatalogHydrateBanner(false);
  }
}

function renderEmptyPocketBlock(visibleTotal) {
  if (visibleTotal > 0) return "";
  if (POCKIT_CATALOG_PHASE === "hydrating") {
    return `<div class="pockit-empty-pocket" role="status" aria-live="polite">
      <p class="pockit-empty-pocket__title">Your pocket is open</p>
      <p class="pockit-empty-pocket__detail">Loading your consoles and cartridges from your configuration…</p>
    </div>`;
  }
  if (POCKIT_CATALOG_PHASE === "operator") {
    const mode = POCKIT_CATALOG_ENTITLEMENTS?.mode || "fleet";
    const modeHint =
      mode === "core"
        ? "Vanilla Pockit — open Settings → Catalog to load your full fleet."
        : mode === "custom"
          ? "Custom catalog — open Settings → Catalog to turn consoles on."
          : "No cartridges yet — open Library to add consoles, or use Accessory Desk to pin your first tape.";
    return `<div class="pockit-empty-pocket">
      <p class="pockit-empty-pocket__title">Your pocket is ready</p>
      <p class="pockit-empty-pocket__detail">${modeHint} <button type="button" class="comet-btn comet-btn--ghost" data-action="open-settings-modal">Settings</button> · <button type="button" class="comet-btn comet-btn--ghost" data-action="load" data-id="library">Library</button></p>
    </div>`;
  }
  return `<div class="pockit-empty-pocket" role="status" aria-live="polite">
    <p class="pockit-empty-pocket__title">Pockit core</p>
    <p class="pockit-empty-pocket__detail">Default accessories are available — your catalog will appear momentarily.</p>
  </div>`;
}

/** Clear stale localStorage player ids (e.g. "[object Object]") that hide all cassettes. */
function sanitizePockitPlayerSelection() {
  if (!POCKIT_PLAYER || !POCKIT_CATALOG?.players?.length) return;
  const valid =
    POCKIT_PLAYER === "_unassigned"
    || POCKIT_CATALOG.players.some((p) => p.id === POCKIT_PLAYER);
  if (valid) return;
  POCKIT_PLAYER = "";
  POCKIT_PLAYER_GROUP = "";
  try {
    localStorage.removeItem("nephew-pockit-player");
    localStorage.removeItem("nephew-launchpad-player");
  } catch {
    /* private mode */
  }
}

function injectLibraryNav() {
  if (isTape()) return;
  if (!CARDS.length || !CARDS[0].items) return;
  if (CARDS.some((s) => s.items.some((c) => c.id === "library"))) return;
  CARDS[0].items.splice(1, 0, {
    id: "library",
    title: "Library",
    glyph: "📚",
    subtitle: "Consoles + Cartridges catalog",
    type: "library",
  });
}

function frameworkEntityForCard(card) {
  if (!card) return null;
  return FRAMEWORK_BY_HUB.get(card.id) || FRAMEWORK_BY_ID.get(card.id) || null;
}

function roleDisplayLabel(role) {
  if (role === "player") return "console";
  return role;
}

function roleChipForCard(card) {
  const ent = frameworkEntityForCard(card);
  if (!ent) return "";
  const hostId = isTape() ? "nephew-tape" : "nephew-deck";
  const role = ent.framework_roles?.includes("tape") && hostId !== ent.id
    ? "tape"
    : ent.framework_roles?.includes("player")
      ? "player"
      : ent.framework_roles?.[0] || "";
  if (!role) return "";
  const label = roleDisplayLabel(role);
  return `<span class="role-chip role-chip--${role}" data-comet-tip="${cometTipAttr(pockitTip("roleChip") || "Framework role\nHow this cartridge participates in the stack")}">${label}</span>`;
}

// Load the card set, trying the richest source first and degrading gracefully so
// Pockit is never left empty:
//   1) /api/v1/family/hub-cards — tower-api endpoint that JOINS the curated cards
//      with the SSO manifest (auto-cards any new cassette). [Plan 0135 Phase 2]
//   2) /family-hub-cards.json   — the static curated manifest.                [Phase 1]
//   3) DEFAULT_CARDS            — built-in fallback.
async function loadCards() {
  for (const src of ["/api/v1/family/hub-cards", "/family-hub-cards.json"]) {
    try {
      const r = await fetch(src, tapeFetchInit({ cache: "no-cache", credentials: "include" }));
      if (!r.ok) continue;
      const data = await r.json();
      const cards = Array.isArray(data) ? data : data.cards;
      if (Array.isArray(cards) && cards.length && cards.every((s) => s && Array.isArray(s.items))) {
        CARDS = cards;
        return;
      }
    } catch { /* try the next source */ }
  }
  // all sources failed → keep DEFAULT_CARDS
}

function hubCardItemKey(item) {
  if (item?.url) {
    try {
      const u = new URL(item.url);
      const path = u.pathname.replace(/\/+$/, "") || "/";
      return `${u.origin}${path}`;
    } catch {
      /* fall through */
    }
  }
  return item?.id || "";
}

function collectHubCardKeys(cards) {
  const keys = new Set();
  const ids = new Set();
  for (const sec of cards || []) {
    for (const it of sec.items || []) {
      if (it.id) ids.add(it.id);
      keys.add(hubCardItemKey(it));
    }
  }
  return { keys, ids };
}

/** Mirror tower-api mergeOperatorDoors when hub-cards is auth-gated (Plan 0432). */
function mergeCatalogOperatorDoorsIntoCards() {
  if (!POCKIT_CATALOG?.players) return;
  const { keys, ids } = collectHubCardKeys(CARDS);
  const items = [];
  for (const p of POCKIT_CATALOG.players) {
    for (const c of p.hosted_cassettes || []) {
      if (!c.operator_door) continue;
      const hubId = c.hub_card_id || c.id;
      if (ids.has(hubId)) continue;
      const card = catalogEntryToHubCard(c);
      if (!card) continue;
      const key = hubCardItemKey(card);
      if (keys.has(key)) continue;
      ids.add(hubId);
      keys.add(key);
      items.push(card);
    }
  }
  if (!items.length) return;
  const existing = CARDS.find((s) => s.section === "My doors");
  if (existing) {
    existing.items.push(...items);
    return;
  }
  CARDS.push({ section: "My doors", items });
}

const $ = (q) => document.querySelector(q);

const TAPE_PLAYER_ID = "nephew-tape";

function isLocalTapeDoorHost() {
  try {
    const h = window.location.hostname.toLowerCase();
    if (h === "127.0.0.1" || h === "localhost" || h.endsWith(".localhost")) return true;
    if (h.endsWith(".local") && !h.endsWith(".localhost")) return true;
  } catch {
    return false;
  }
  return false;
}

/** True when operator is on port-80/443 door URLs (no gateway port in browser bar). */
function isCleanDoorsSession() {
  try {
    const h = window.location.hostname.toLowerCase();
    if (h !== "localhost" && !h.endsWith(".localhost")) return false;
    const p = window.location.port;
    return !p || p === "80" || p === "443";
  } catch {
    return false;
  }
}

/** When port-80 runway is dark, *.localhost doors need the live gateway port (Plan 0446). */
function resolveFamilyDoorUrl(href) {
  if (!href) return href;
  try {
    const u = new URL(String(href), window.location.href);
    if (u.hostname !== "localhost" && !u.hostname.endsWith(".localhost")) return u.href;
    if (isCleanDoorsSession()) {
      u.port = "";
      return u.href.replace(/:8782(?=\/|$)/, "");
    }
    if (u.port) return u.href.replace(/:8782(?=\/|$)/, "");
    const gw =
      window.__pockitGatewayPort ||
      (window.location.port && window.location.port !== "80" && window.location.port !== "443"
        ? window.location.port
        : "");
    if (gw) u.port = String(gw);
    return u.href.replace(/:8782(?=\/|$)/, "");
  } catch {
    return String(href).replace(/:8782/g, "");
  }
}

/** Hash-only SPA base — never leave /c/<id> on pathname while hash routes elsewhere. */
function pockitSpaBasePath() {
  if (isTape() || isApexFamilyHubHost()) return "/";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/index.html" ? "/" : path;
}

function hashIndicatesPockitHome(hash) {
  const h = hash || "";
  return !h || h === "#/" || h === "#/overview";
}

/** Apex Pockit (jailynmarvin.com) uses the same dual-rail shell as tape doors. */
function isApexFamilyHubHost() {
  try {
    const h = window.location.hostname.toLowerCase();
    return h === "jailynmarvin.com" || h === "www.jailynmarvin.com";
  } catch {
    return false;
  }
  return false;
}

function isTape() {
  const el = document.documentElement;
  if (el.dataset.tape === "1" || el.dataset.lanHub === "1") return true;
  if (isApexFamilyHubHost()) return true;
  return isLocalTapeDoorHost();
}

function isHelloHubCard(card) {
  const id = card?.id;
  return id === "hello-cassette" || id === "hello" || id === "nephew-hello";
}

function isVoiceHubCard(card) {
  const id = card?.id;
  return id === "voice-cassette" || id === "voice";
}

function isVideoHubCard(card) {
  const id = card?.id;
  return id === "video-cassette" || id === "video";
}

function isVoiceCassetteId(id) {
  return id === "voice" || id === "voice-cassette";
}

function isVideoCassetteId(id) {
  return id === "video" || id === "video-cassette";
}

function isVideoCassetteActive() {
  return isVideoCassetteId(currentCassetteId()) || document.body.classList.contains("pockit-video-active");
}

function isVoiceCassetteActive() {
  return isVoiceCassetteId(currentCassetteId()) || document.body.classList.contains("pockit-voice-active");
}

function isVoiceCatalogEntry(c) {
  if (!c) return false;
  if (c.id === "voice" || c.hub_card_id === "voice-cassette") return true;
  const surface = catalogSurface(c);
  return surface.pad_type === "voice" || (surface.pockit_pad === true && c.id === "voice");
}

function resolveNativeVoiceSidebarItem(item, catalogEntry) {
  if (!item) return item;
  if (isVoiceHubCard(item) || item.type === "voice" || isVoiceCatalogEntry(catalogEntry)) {
    return voicePadMenuItem();
  }
  return item;
}

function isVoiceNativeCassette(c) {
  return isVoiceHubCard(c) || c?.type === "voice";
}

/** Voice app mode — disable Mac weave, pink suite brand, controller/stack rails. */
function prepareVoicePadContext(c) {
  if (!isVoiceNativeCassette(c)) return;
  POCKIT_MAC_APP = "";
  try { localStorage.removeItem("nephew-pockit-mac-app"); } catch { /* ignore */ }
  POCKIT_PLAYER = "pockit";
  try { localStorage.setItem("nephew-pockit-player", "pockit"); } catch { /* ignore */ }
  document.body.classList.add("pockit-voice-active");
}

function clearVoicePadContextIfNeeded(c) {
  if (isVoiceNativeCassette(c)) return;
  document.body.classList.remove("pockit-voice-active", "pockit-voice-rails");
}

function isVideoNativeCassette(c) {
  return isVideoHubCard(c) || c?.type === "video";
}

function prepareVideoPadContext(c) {
  if (!isVideoNativeCassette(c)) return;
  POCKIT_MAC_APP = "";
  try { localStorage.removeItem("nephew-pockit-mac-app"); } catch { /* ignore */ }
  POCKIT_PLAYER = "pockit";
  try { localStorage.setItem("nephew-pockit-player", "pockit"); } catch { /* ignore */ }
  document.body.classList.add("pockit-video-active");
}

function clearVideoPadContextIfNeeded(c) {
  if (isVideoNativeCassette(c)) return;
  document.body.classList.remove("pockit-video-active", "pockit-video-rails");
}

function isKnowledgeCassetteId(id) {
  const cid = canonicalHashCassetteId(id);
  return cid === "knowledge" || cid === "knowledge-cassette";
}

function isKnowledgeCassetteActive() {
  return isKnowledgeCassetteId(currentCassetteId()) || document.body.classList.contains("pockit-knowledge-active");
}

function isKnowledgeNativeCassette(c) {
  return isKnowledgeHubCard(c) || c?.type === "knowledge";
}

/** Knowledge encompass — Scope/Brain rails, disable Mac weave overlay. */
function prepareKnowledgePadContext(c) {
  if (!isKnowledgeNativeCassette(c)) return;
  POCKIT_MAC_APP = "";
  try { localStorage.removeItem("nephew-pockit-mac-app"); } catch { /* ignore */ }
  POCKIT_PLAYER = "pockit";
  try { localStorage.setItem("nephew-pockit-player", "pockit"); } catch { /* ignore */ }
  document.body.classList.add("pockit-knowledge-active");
}

function clearKnowledgePadContextIfNeeded(c) {
  if (isKnowledgeNativeCassette(c)) return;
  document.body.classList.remove("pockit-knowledge-active", "pockit-knowledge-rails");
}

function isHelpCassetteId(id) {
  return id === "suite-welcome" || id === "pockit-help";
}

function isHelpConsoleActive() {
  return isHelpCassetteId(currentCassetteId()) || document.body.classList.contains("pockit-help-active");
}

function isHelpNativeCassette(c) {
  return isHelpCassetteId(c?.id) || c?.type === "suite-welcome" || c?.type === "pockit-help";
}

/** Help Guide console — Topics / Related rails, searchable help database. */
function prepareHelpConsoleContext(c) {
  if (!isHelpNativeCassette(c)) return;
  POCKIT_MAC_APP = "";
  try { localStorage.removeItem("nephew-pockit-mac-app"); } catch { /* ignore */ }
  POCKIT_PLAYER = "pockit";
  try { localStorage.setItem("nephew-pockit-player", "pockit"); } catch { /* ignore */ }
  document.body.classList.add("pockit-help-active");
}

function clearHelpConsoleContextIfNeeded(c) {
  if (isHelpNativeCassette(c)) return;
  document.body.classList.remove("pockit-help-active", "pockit-help-rails");
}

function isKnowledgeHubCard(card) {
  const id = card?.id;
  return id === "knowledge-cassette" || id === "knowledge";
}

function isPromptLibraryHubCard(card) {
  const id = card?.id;
  return id === "prompt-library" || id === "prompt-library-cassette" || card?.type === "prompt-library";
}

function isShipIntegrityHubCard(card) {
  const id = card?.id;
  return id === "ship-integrity" || id === "ship-integrity-cassette" || card?.type === "ship-integrity";
}

function isFamilyDeskHubCard(card) {
  const id = card?.id;
  return id === "family-desk" || id === "family-desk-cassette" || card?.type === "family-desk";
}

function isConfigurationsHubCard(card) {
  const id = card?.id;
  return id === "configurations" || id === "configurations-cassette" || card?.type === "configurations";
}

function isQuickDeskHubCard(card) {
  const id = card?.id;
  return id === "quick-desk" || id === "quick-desk-cassette" || card?.type === "quick-desk";
}

function isOdysseusHubCard(card) {
  const id = card?.id;
  return id === "web-odysseus" || id === "mac-app-odysseus" || card?.type === "odysseus";
}

function catalogSurface(catalogEntry) {
  return catalogEntry?.settings?.surface || catalogEntry?.surface || {};
}

function isEncompassNativePad(card, catalogEntry) {
  if (isOdysseusHubCard(card) || isKnowledgeHubCard(card)) return true;
  const cat = catalogEntry || findCatalogEntryByHubId(card?.id);
  const surface = catalogSurface(cat);
  return surface.pockit_pad === true || surface.encompass_mode === "native_pad";
}

function speakersDoorForCard(card) {
  const cat = findCatalogEntryByHubId(card?.id);
  const surface = catalogSurface(cat);
  if (surface.speakers_door) return surface.speakers_door;
  if (card?._speakers_door) return card._speakers_door;
  const family = cat?.family_url || cat?.overview?.family_url;
  if (family) return String(family).replace(/:8782\/?$/, "/");
  if (isOdysseusHubCard(card)) return "http://odysseus.localhost/";
  if (isKnowledgeHubCard(card)) return "http://knowledge.localhost/";
  return null;
}

const ENCOMPASS_MANIFESTS = { "web-odysseus": null, knowledge: null, "ext-archive": null, "ext-bank-reader": null, "ext-clinic": null };

const ENCOMPASS_HUD_CASSETTE_IDS = new Set(["ext-archive", "ext-bank-reader", "ext-clinic"]);

const ENCOMPASS_PLAYER_HOME_CASSETTE = {
  "search-my-engine": "ext-archive",
  "bank-reader": "ext-bank-reader",
  "clinic": "ext-clinic",
};

function isEncompassHudCassetteId(id) {
  const cid = canonicalHashCassetteId(id);
  return ENCOMPASS_HUD_CASSETTE_IDS.has(cid) || cid === "archive-search-engine";
}

function activeEncompassManifest() {
  const cid = encompassCassetteIdForActiveRoute();
  return cid ? ENCOMPASS_MANIFESTS[cid] || null : null;
}
let ENCOMPASS_PANEL = "chat";
let ENCOMPASS_IFRAME_PATH = "/";
let ENCOMPASS_ACTIVE_CASSETTE = null;

function isEncompassIframeConsole(card, catalogEntry) {
  const cat = catalogEntry || findCatalogEntryByHubId(card?.id);
  const surface = catalogSurface(cat);
  if (surface.encompass_mode === "iframe_console" || surface.encompass_mode === "hud_iframe") return true;
  const cid = cat?.id || card?.id;
  return isEncompassHudCassetteId(cid);
}

function encompassPlayerIdForManifest(manifest) {
  return manifest?.player_id || POCKIT_PLAYER || "search-my-engine";
}

function encompassCassetteIdForActiveRoute() {
  const routeId = canonicalHashCassetteId(currentCassetteId());
  const cat = findCatalogEntryByHubId(routeId);
  const surface = catalogSurface(cat);
  if (surface.encompass_mode === "iframe_console" || surface.encompass_mode === "hud_iframe") {
    return cat?.id || routeId;
  }
  if (ENCOMPASS_MANIFESTS[routeId]) return routeId;
  const substrate = HUB_CARD_SUBSTRATE_ALIASES[routeId];
  if (substrate && ENCOMPASS_MANIFESTS[substrate]) return substrate;
  if (POCKIT_PLAYER && ENCOMPASS_PLAYER_HOME_CASSETTE[POCKIT_PLAYER]) {
    return ENCOMPASS_PLAYER_HOME_CASSETTE[POCKIT_PLAYER];
  }
  return null;
}

function highlightEncompassNav(path) {
  const norm = path?.startsWith("/") ? path : `/${path || ""}`;
  document.querySelectorAll("#player-rail-content [data-encompass-path], #sidebar-content [data-encompass-path]").forEach((btn) => {
    const itemPath = btn.getAttribute("data-encompass-path") || "/";
    const itemEl = btn.closest(".sidebar-item");
    if (itemEl) itemEl.classList.toggle("active", itemPath === norm);
  });
  document.querySelectorAll("#main-footer [data-encompass-path], #main-footer [data-footer-path]").forEach((btn) => {
    const itemPath = btn.getAttribute("data-encompass-path") || btn.getAttribute("data-footer-path") || "/";
    btn.classList.toggle("shell-player-control--active", itemPath === norm);
    btn.classList.toggle("shell-encompass-footer-btn--active", itemPath === norm);
  });
}

function registerEncompassFooterControls(manifest) {
  if (!manifest?.bottom_nav?.length || !window.PockitPlayerContextPills?.registerFooterControls) return;
  const scope = `player:${encompassPlayerIdForManifest(manifest)}`;
  window.PockitPlayerContextPills.registerFooterControls(scope, () =>
    (manifest.bottom_nav || []).map((row) => ({
      id: `enc-footer-${row.id}`,
      label: row.label,
      group: "navigate",
      state: ENCOMPASS_IFRAME_PATH === (row.path || "/") ? "active" : "ok",
      tip: `${row.label}\n${row.path || "/"}`,
      path: row.path || "/",
      action: () => setEncompassIframeRoute(row.path || "/", manifest.cassette_id || "ext-archive"),
    })),
  );
}

function setEncompassIframeRoute(path, cassetteOrId) {
  const pathNorm = path?.startsWith("/") ? path : `/${path || ""}`;
  ENCOMPASS_IFRAME_PATH = pathNorm;
  const cassette = typeof cassetteOrId === "string" ? findCassette(cassetteOrId) : cassetteOrId;
  const cat = findCatalogEntryByHubId(cassette?.id);
  const manifest = ENCOMPASS_MANIFESTS[cat?.id || cassette?.id] || ENCOMPASS_MANIFESTS["ext-archive"] || null;
  const door = speakersDoorForCard(cassette) || manifest?.speakers_door || "http://search.localhost/";
  const playerId = encompassPlayerIdForManifest(manifest);
  let href;
  try {
    const u = new URL(pathNorm, door);
    href = withCassetteEmbedParams(u.toString(), { player: playerId });
  } catch {
    href = withCassetteEmbedParams(`${String(door).replace(/\/$/, "")}${pathNorm}`, { player: playerId });
  }
  const proxy = hubSameOriginEmbedUrl(href);
  const src = proxy || href;
  const iframe = document.querySelector("iframe[data-tape-frame='1']")
    || document.getElementById("cassette-iframe");
  if (iframe) {
    iframe.src = src;
  } else if (cassette) {
    setCassetteInFlight = null;
    mountFamilyCassetteIframe(href, canonicalHashCassetteId(cassette.id), cassette);
  }
  highlightEncompassNav(pathNorm);
  highlightActiveSidebarItem(cassette?.id || currentCassetteId());
  const scope = footerScopeForCassette(cassette || findCassette(currentCassetteId()));
  window.PockitPlayerContextPills?.refreshFooterControls?.(scope);
  refreshMainShellFooter(cassette || findCassette(currentCassetteId()));
}

function resetEncompassIframeRoute(cassette) {
  if (!isEncompassIframeConsole(cassette)) {
    ENCOMPASS_ACTIVE_CASSETTE = null;
    return;
  }
  const cid = cassette?.id;
  if (ENCOMPASS_ACTIVE_CASSETTE === cid) {
    highlightEncompassNav(ENCOMPASS_IFRAME_PATH);
    return;
  }
  ENCOMPASS_ACTIVE_CASSETTE = cid;
  const cat = findCatalogEntryByHubId(cid);
  const manifest = ENCOMPASS_MANIFESTS[cat?.id || cid] || ENCOMPASS_MANIFESTS["ext-archive"];
  const defaultPath = manifest?.center_default?.path || manifest?.center_default?.route || "/";
  ENCOMPASS_IFRAME_PATH = defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`;
  highlightEncompassNav(ENCOMPASS_IFRAME_PATH);
}

async function ensureEncompassManifest(cassetteId) {
  if (ENCOMPASS_MANIFESTS[cassetteId]) return ENCOMPASS_MANIFESTS[cassetteId];
  let staticManifest = null;
  try {
    const r = await fetch(`/cassette-surfaces/${cassetteId}.json`, { cache: "no-store" });
    if (r.ok) staticManifest = await r.json();
  } catch { /* offline hub */ }
  const door = staticManifest?.speakers_door || "http://search.localhost/";
  let stem = "search";
  try {
    stem = new URL(door, window.location.origin).hostname.replace(/\.localhost$/i, "") || "search";
  } catch { /* keep search */ }
  try {
    const liveRes = await fetch(`/family-embed/${stem}/api/pockit/console`, { cache: "no-store" });
    if (liveRes.ok) {
      const live = await liveRes.json();
      if (live?.cassette_id) {
        ENCOMPASS_MANIFESTS[cassetteId] = {
          ...staticManifest,
          ...live,
          speakers_door: live.speakers_door || door,
          center_default: live.center_default || staticManifest?.center_default,
        };
        registerEncompassFooterControls(ENCOMPASS_MANIFESTS[cassetteId]);
        return ENCOMPASS_MANIFESTS[cassetteId];
      }
    }
  } catch { /* fall through to static */ }
  if (staticManifest) {
    ENCOMPASS_MANIFESTS[cassetteId] = staticManifest;
    registerEncompassFooterControls(staticManifest);
    return staticManifest;
  }
  return null;
}

/** Native Pockit surfaces — full-page HTML in center canvas, never iframe embed mode. */
function isNativePockitHubSurface(cassette) {
  if (!cassette) return false;
  if (isVoiceHubCard(cassette) || isKnowledgeHubCard(cassette) || isOdysseusHubCard(cassette)) return true;
  if (isEncompassNativePad(cassette)) return true;
  const t = cassette.type;
  return t === "voice" || t === "knowledge" || t === "odysseus" || t === "overview" || t === "library"
    || t === "smoke-checklist" || t === "suite-welcome";
}

/** Same-origin Hello on Family tape doors — never the external nephew.jailynmarvin embed. */
function localHelloPlaybackUrl() {
  if (!isTape() && !isLocalTapeDoorHost()) return null;
  return withCassetteEmbedParams("/hello");
}
function activeEmbedPlayer(extraPlayer) {
  return extraPlayer || POCKIT_PLAYER || "nephew-deck";
}

function withCassetteEmbedParams(href, { player } = {}) {
  if (!href) return href;
  const playerId = activeEmbedPlayer(player);
  try {
    const u = new URL(href, window.location.origin);
    u.searchParams.set("cassette", "1");
    u.searchParams.set("player", playerId);
    if (isTape() || isLocalTapeDoorHost()) {
      u.searchParams.set("pockit_hud", "1");
    }
    if (u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    const [pathOnly, query = ""] = String(href).split("?");
    const params = new URLSearchParams(query);
    params.set("cassette", "1");
    params.set("player", playerId);
    if (isTape() || isLocalTapeDoorHost()) {
      params.set("pockit_hud", "1");
    }
    return `${pathOnly}?${params.toString()}`;
  }
}

/** Hub card id → catalogue substrate id (curated pins that differ from cassette id). */
const HUB_CARD_SUBSTRATE_ALIASES = {
  "archive-search-engine": "ext-archive",
  "hello-cassette": "hello",
  "voice-cassette": "voice",
  "knowledge-cassette": "knowledge",
};

function hubCardReverseAlias(hubCardId) {
  for (const [hub, substrate] of Object.entries(HUB_CARD_SUBSTRATE_ALIASES)) {
    if (substrate === hubCardId) return hub;
  }
  return null;
}

/** One stable hash id per cassette — stops knowledge ↔ knowledge-cassette hash churn. */
function canonicalHashCassetteId(id) {
  const raw = String(id || "").trim();
  if (!raw || raw === "overview" || raw === "library") return raw;
  if (raw.startsWith("settings:")) return raw;
  const cat = findCatalogEntryByHubId(raw);
  if (cat?.hub_card_id) return cat.hub_card_id;
  const hub = hubCardReverseAlias(raw);
  if (hub) return hub;
  return raw;
}

function isEmbedOnlyQueryValue(value) {
  return value === "1" || value === "true";
}

/** Never iframe the full Pockit shell (apex hash / local door) inside center canvas. */
function isPockitShellUrl(href) {
  if (!href) return false;
  try {
    const u = new URL(href, window.location.origin);
    if (u.hash && /^#\/c\//.test(u.hash)) return true;
    const host = u.hostname.toLowerCase();
    const apex = host === "jailynmarvin.com" || host === "www.jailynmarvin.com";
    const localPockit = host === "pockit.localhost" || host === "launchpad.localhost";
    if ((apex || localPockit) && (u.pathname === "/" || u.pathname === "/index.html" || /^\/c\/[\w-]+$/.test(u.pathname))) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function scrubParentEmbedQueryParams(params) {
  let dirty = false;
  for (const key of ["cassette", "c", "player", "pockit_hud", "console"]) {
    if (!params.has(key)) continue;
    if (key === "cassette" || key === "c") {
      if (isEmbedOnlyQueryValue(params.get(key))) {
        params.delete(key);
        dirty = true;
      }
      continue;
    }
    params.delete(key);
    dirty = true;
  }
  return dirty;
}

function syncParentSpaUrl(nextHash) {
  const params = new URLSearchParams(window.location.search || "");
  scrubParentEmbedQueryParams(params);
  const q = params.toString() ? `?${params.toString()}` : "";
  const nextUrl = `${pockitSpaBasePath()}${q}${nextHash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) return false;
  hashSyncInFlight = true;
  try {
    window.history.replaceState(null, "", nextUrl);
  } catch {
    hashSyncInFlight = false;
    window.location.hash = nextHash;
    return true;
  }
  queueMicrotask(() => {
    hashSyncInFlight = false;
  });
  return true;
}

function hubCardLookupIds(hubCardId) {
  const ids = new Set([hubCardId]);
  const reverse = hubCardReverseAlias(hubCardId);
  if (reverse) ids.add(reverse);
  const substrate = HUB_CARD_SUBSTRATE_ALIASES[hubCardId] || catalogueIdForHubCard(hubCardId);
  if (substrate) ids.add(substrate);
  const fw = FRAMEWORK_BY_HUB.get(hubCardId);
  if (fw?.id) ids.add(fw.id);
  if (fw?.hub_card_id) ids.add(fw.hub_card_id);
  return ids;
}

function catalogPlayerForHubId(hubCardId) {
  if (!POCKIT_CATALOG?.players || !hubCardId) return null;
  const ids = hubCardLookupIds(hubCardId);
  for (const p of POCKIT_CATALOG.players) {
    for (const c of p.hosted_cassettes || []) {
      if (ids.has(c.hub_card_id) || ids.has(c.id)) return p.id;
    }
  }
  return null;
}

function catalogPlayerForCard(card) {
  if (!card) return null;
  return catalogPlayerForHubId(card.id);
}


const PLAYER_HOME_HUB_IDS = {
  pockit: "hello-cassette",
  automata: "automata-pad-summary",
  dustpan: "dustpan-disks",
  "search-my-engine": "ext-archive",
  "bank-reader": "ext-bank-reader",
  "clinic": "ext-clinic",
  "container-deck": "container-deck",
};

function catalogPlayerById(playerId) {
  return POCKIT_CATALOG?.players?.find((p) => p.id === playerId) || null;
}

function defaultHubCardIdForPlayer(playerId) {
  if (!playerId) return null;
  if (PLAYER_HOME_HUB_IDS[playerId]) return PLAYER_HOME_HUB_IDS[playerId];
  const player = catalogPlayerById(playerId);
  const first = player?.hosted_cassettes?.[0];
  if (!first) return null;
  return first.hub_card_id || first.id;
}

function playerGroupStorageKey(playerId) {
  return `nephew-pockit-player-group:${playerId}`;
}

function rememberPlayerGroup(playerId, group) {
  if (!playerId || !group) return;
  try {
    localStorage.setItem(playerGroupStorageKey(playerId), group);
  } catch {
    /* ignore */
  }
}

function recallPlayerGroup(playerId) {
  if (!playerId) return "";
  try {
    return localStorage.getItem(playerGroupStorageKey(playerId)) || "";
  } catch {
    return "";
  }
}

function catalogSidebarGroup(entry) {
  return entry?.sidebar_group || "Other";
}

function playerHostedCatalogEntries(playerId) {
  if (!POCKIT_CATALOG || !playerId) return [];
  if (playerId === "_unassigned") return [...(POCKIT_CATALOG.unassigned_cassettes || [])];
  const player = POCKIT_CATALOG.players.find((p) => p.id === playerId);
  return player ? [...(player.hosted_cassettes || [])] : [];
}

function playerSidebarGroups(playerId) {
  const groups = new Map();
  for (const c of playerHostedCatalogEntries(playerId)) {
    const g = catalogSidebarGroup(c);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entries]) => ({ name, entries, count: entries.length }));
}

function playerGroupNavId(playerId, groupName) {
  return `player-group:${playerId}:${groupName}`;
}

function parsePlayerGroupNavId(id) {
  const m = String(id || "").match(/^player-group:([^:]+):(.+)$/);
  if (!m) return null;
  return { playerId: m[1], groupName: m[2] };
}

function resolvePlayerGroupForPlayer(playerId, preferred) {
  const groups = playerSidebarGroups(playerId);
  if (!groups.length) return "";
  if (preferred && groups.some((g) => g.name === preferred)) return preferred;
  const recalled = recallPlayerGroup(playerId);
  if (recalled && groups.some((g) => g.name === recalled)) return recalled;
  return groups[0].name;
}

function selectPlayerGroup(groupName, { persist = true } = {}) {
  if (!POCKIT_PLAYER || !groupName) return;
  POCKIT_PLAYER_GROUP = groupName;
  if (persist) rememberPlayerGroup(POCKIT_PLAYER, groupName);
  renderCassetteRail();
  highlightActiveRails(currentCassetteId());
}

/** User-initiated console / picker navigation — clear stale in-flight guard, prefer content dedup. */
function navigateFromConsolePicker(id) {
  setCassetteInFlight = null;
  setCassette(id);
}

function openPlayerConsole(playerId, { openHome = false, deferSidebar = false } = {}) {
  if (!playerId) return;
  POCKIT_PLAYER = playerId;
  POCKIT_PLAYER_GROUP = resolvePlayerGroupForPlayer(playerId);
  if (playerId !== "pockit") POCKIT_MAC_APP = "";
  else if (!POCKIT_MAC_APP) POCKIT_MAC_APP = "pockit";
  try {
    localStorage.setItem("nephew-pockit-player", POCKIT_PLAYER);
  } catch {
    /* ignore */
  }
  if (POCKIT_PLAYER_GROUP) rememberPlayerGroup(POCKIT_PLAYER, POCKIT_PLAYER_GROUP);
  const paintSidebar = () => {
    renderSidebar();
    syncPlayerAccent();
  };
  if (!openHome) {
    if (deferSidebar) queueMicrotask(paintSidebar);
    else paintSidebar();
    refreshPlayerRailDock();
    return;
  }
  setCassetteInFlight = null;
  const hubId = defaultHubCardIdForPlayer(playerId);
  const hubOwnedByPlayer = hubId && catalogPlayerForHubId(hubId) === playerId;
  if (hubOwnedByPlayer && findCassette(hubId)) navigateFromConsolePicker(hubId);
  else navigateFromConsolePicker("overview");
  queueMicrotask(paintSidebar);
}

function openPlayerHome(playerId) {
  openPlayerConsole(playerId, { openHome: true });
}

/** Consoles whose Console view is the player door HUD-embedded in Pockit center (not overview grid). */
const CONSOLE_SELF_EMBED_IDS = new Set([
  "nephew-deck",
  "search-my-engine",
  "bank-reader",
  "clinic",
  "family-office-platform",
]);

function catalogConsoleBrowsable(player) {
  if (!player) return false;
  if (player.browse_role === "hidden" || player.browse_role === "runtime") return false;
  if (player.is_runtime) return false;
  return true;
}

/** Consoles that appear in Library + Console picker — includes runtime umbrellas with a door. */
function catalogConsoleProjectable(player) {
  if (!player) return false;
  if (player.browse_role === "hidden") return false;
  if (catalogConsoleBrowsable(player)) return true;
  if ((player.browse_role === "runtime" || player.is_runtime) && consoleProjectionHref(player)) return true;
  return false;
}

function consoleProjectionHref(player) {
  const raw = player?.family_url || player?.open_url;
  if (!raw) return null;
  return resolveFamilyDoorUrl(raw);
}

function openConsoleConsoleView(playerId) {
  const player = catalogPlayerById(playerId);
  if (!player) return;
  if (playerId === "pockit") {
    clearPockitPlayerFilter();
    setCassette("overview", { force: true });
    return;
  }
  const door = consoleProjectionHref(player);
  if (!door) {
    openPlayerHome(playerId);
    return;
  }
  openPlayerConsole(playerId, { deferSidebar: true });
  const cardId = `console-embed-${playerId}`;
  const embedUrl = withCassetteEmbedParams(door, { player: playerId });
  const card = {
    id: cardId,
    title: player.name || playerId,
    url: embedUrl,
    iframe: true,
    type: "load",
    _consoleEmbed: true,
    _playerId: playerId,
  };
  TAPE_SIDEBAR_ITEMS.set(cardId, card);
  setCassette(cardId, { force: true });
  queueMicrotask(() => {
    renderSidebar();
    syncPlayerAccent();
  });
}

function clearPockitPlayerFilter() {
  POCKIT_PLAYER = "";
  POCKIT_PLAYER_GROUP = "";
  POCKIT_MAC_APP = "pockit";
  try {
    localStorage.removeItem("nephew-pockit-player");
  } catch {
    /* ignore */
  }
  renderSidebar();
  syncPlayerAccent();
  refreshPlayerRailDock();
}

function clearAllPockitFilters() {
  POCKIT_FILTER = "";
  POCKIT_SCOPE = "all";
  clearPockitPlayerFilter();
  try {
    localStorage.setItem("nephew-pockit-scope", "all");
    localStorage.removeItem("nephew-pockit-filter");
  } catch {
    /* ignore */
  }
  rerenderPockitView();
}

function syncPockitPlayerForCassette(card) {
  if (!isTape() || !card || card.type === "overview" || card.type === "library") return;
  const owner = catalogPlayerForCard(card);
  if (!owner) return;
  document.querySelectorAll("#player-rail-content .sidebar-item").forEach((el) => {
    const pid = el.querySelector("[data-player-id]")?.getAttribute("data-player-id");
    el.classList.toggle("sidebar-item--owner-hint", Boolean(pid && pid === owner && POCKIT_PLAYER && POCKIT_PLAYER !== owner));
  });
  if (POCKIT_PLAYER && POCKIT_PLAYER !== owner) return;
  if (POCKIT_PLAYER === owner) {
    const cat = findCatalogEntryByHubId(card.id);
    if (cat) {
      const group = catalogSidebarGroup(cat);
      if (group && group !== POCKIT_PLAYER_GROUP) {
        POCKIT_PLAYER_GROUP = group;
        rememberPlayerGroup(POCKIT_PLAYER, group);
        renderCassetteRail();
      }
    }
    return;
  }
  POCKIT_PLAYER = owner;
  POCKIT_PLAYER_GROUP = resolvePlayerGroupForPlayer(owner, catalogSidebarGroup(findCatalogEntryByHubId(card.id)));
  try { localStorage.setItem("nephew-pockit-player", POCKIT_PLAYER); } catch {}
  if (POCKIT_PLAYER_GROUP) rememberPlayerGroup(POCKIT_PLAYER, POCKIT_PLAYER_GROUP);
  renderPlayerRail();
  renderCassetteRail();
}


function syncTapesUiChrome() {
  document.body.classList.add("tapes-ui");
  const tape = isTape();
  if (tape) {
    document.documentElement.setAttribute("data-tape", "1");
    document.body.classList.add("hub-dashboard", "dual-rail-mode");
  } else {
    document.documentElement.removeAttribute("data-tape");
    document.body.classList.remove("hub-dashboard", "dual-rail-mode");
  }
  hydrateRailToggles();
}

function hydrateRailToggles() {
  if (!isTape()) return;
  document.querySelector('[data-widget="player-rail-toggle"]')?.classList.add("hidden");
  document.querySelector('[data-widget="cassette-rail-toggle"]')?.classList.add("hidden");
  document.getElementById("player-rail-handle")?.classList.remove("hidden");
  document.getElementById("cassette-rail-handle")?.classList.remove("hidden");
}

/** iPad-style short label under app icons. */
function dashboardShortLabel(text, max = 14) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function dashboardDetailTip(card) {
  const title = card?.title;
  const desc = cardDescription(card);
  const detail = cardDetailLine(card);
  const sub = [desc, detail].filter(Boolean).join(" · ");
  if (!title) return sub;
  return sub ? `${title}\n${sub}` : title;
}

function pockitHeroCopy() {
  if (!isTape()) {
    return {
      kicker: "Cartridge console",
      title: pockitGreeting(),
      lede: "Tap a cartridge — one Family sign-in covers every door.",
      statLabel: "Pockit",
    };
  }
  return {
    kicker: "Pockit",
    title: "Cartridges",
    lede: "Tap a cartridge to open it in the center canvas.",
    statLabel: "Pockit",
  };
}

function renderTowerBreadcrumb(cassette) {
  if (!isTape()) {
    return `<div class="tower-breadcrumb-shell"><span class="main-breadcrumb-title"><span class="main-breadcrumb-text">${escapeHtml(cassette?.title || "Pockit")}</span></span></div>`;
  }
  if (isVoiceNativeCassette(cassette)) {
    const V = voiceAppDisplay();
    const kickerInner = `<span class="tower-breadcrumb-kicker tower-breadcrumb-kicker--voice"><span class="tower-breadcrumb-kicker-dot tower-breadcrumb-kicker-dot--voice" aria-hidden="true"></span>${escapeHtml(V.alias)}</span>`;
    const iconHtml = hubIcon({ glyph: V.glyph.replace("️", ""), title: V.name });
    return `<div class="tower-breadcrumb-shell tower-breadcrumb-shell--voice">${kickerInner}<span class="main-breadcrumb-title">${iconHtml}<span class="main-breadcrumb-text">${escapeHtml(V.name)}</span></span></div>`;
  }
  const onOverview = cassette?.type === "overview" || cassette?.id === "overview";
  const title = onOverview ? "Apps" : escapeHtml(cassette?.title || "Pockit");
  const showBack = !onOverview
    && cassette?.id !== "changelog"
    && !String(cassette?.id || "").startsWith("settings:");
  let ownerChip = "";
  if (!onOverview && POCKIT_PLAYER) {
    const owner = catalogPlayerForCard(cassette);
    if (owner && owner !== POCKIT_PLAYER) {
      const p = catalogPlayerById(owner);
      ownerChip = `<span class="tower-breadcrumb-owner-chip" title="Hosted by ${escapeHtml(p?.name || owner)}">${escapeHtml(p?.name || owner)}</span>`;
    }
  }
  const kickerInner = showBack
    ? `<button type="button" class="tower-breadcrumb-kicker hub-back-kicker" data-action="hub-back" title="Back to Apps"><span class="tower-breadcrumb-kicker-dot" aria-hidden="true"></span>Tower · Tapes</button>`
    : `<span class="tower-breadcrumb-kicker"><span class="tower-breadcrumb-kicker-dot" aria-hidden="true"></span>Tower · Tapes</span>`;
  const iconHtml = onOverview ? hubIcon({ glyph: "📼", title: "Apps" }) : hubIcon(cassette);
  return `<div class="tower-breadcrumb-shell">${kickerInner}<span class="main-breadcrumb-title">${iconHtml}<span class="main-breadcrumb-text">${title}</span>${ownerChip}</span></div>`;
}

function syncHubBackButton(_cassette) {
  const btn = document.getElementById("hub-back-btn");
  if (!btn) return;
  btn.classList.add("hidden");
}

function healStuckPockitChrome() {
  [
    "pockit-rails-all-collapsed",
    "pockit-immersive",
    "suite-bar-drawer-lip",
    "suite-bar-drawer-hidden",
    "suite-bar-drawer-open",
  ].forEach((cls) => document.body.classList.remove(cls));
  try {
    localStorage.removeItem("pockit.suite-bar.drawer");
  } catch {
    /* private mode */
  }
}

function syncChromeHiddenChip() {
  const header = document.querySelector(".main-header");
  if (!header) return;
  let chip = header.querySelector(".pockit-chrome-hidden-chip");
  const hidden = document.body.classList.contains("pockit-cinema-mode")
    || ["pockit-chrome-hide-player-rail", "pockit-chrome-hide-cassette-rail", "pockit-chrome-hide-header"]
      .some((c) => document.body.classList.contains(c));
  if (!hidden) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement("span");
    chip.className = "pockit-chrome-hidden-chip";
    chip.dataset.widget = "chrome-hidden-hint";
    const stack = header.querySelector('[data-widget-stack="trailing"]')
      || header.querySelector(".main-actions");
    if (stack) stack.prepend(chip);
    else header.appendChild(chip);
  }
  chip.textContent = "Chrome hidden — move to edge to reveal";
}

window.__pockitSyncChromeChip = syncChromeHiddenChip;

let hubBackBound = false;
function ensureHubBackControls() {
  if (hubBackBound) return;
  hubBackBound = true;
  document.getElementById("hub-back-btn")?.addEventListener("click", () => setCassette("overview"));
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action=hub-back]")) {
      e.preventDefault();
      setCassette("overview");
    }
  });
  document.getElementById("cassette-settings-header")?.addEventListener("click", (e) => {
    e.preventDefault();
    const id = document.getElementById("cassette-settings-header")?.getAttribute("data-substrate-id");
    if (id) openCassetteSettings(id);
  });
  document.querySelector(".main-actions")?.addEventListener("click", (e) => {
    const changelog = e.target.closest("[data-action=pad-changelog]");
    if (changelog) {
      e.preventDefault();
      window.PadSurface?.openChangelogModal?.();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const id = currentCassetteId();
    if (id === "overview" || String(id).startsWith("settings:")) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (document.activeElement?.isContentEditable) return;
    setCassette("overview");
  });
}


function refreshTowerStatusRail(_cassette) {
  const headerRail = document.getElementById("tower-status-rail");
  if (headerRail) {
    headerRail.hidden = true;
    headerRail.innerHTML = "";
  }
  refreshFooterHealthStrip();
}

function paintMainFooterHealth() {
  const rail = document.getElementById("main-footer-health");
  if (!rail) return;
  rail.innerHTML = cachedHealthPillsHtml || renderShellHealthPill("Family tapes", "pending");
}

function refreshFooterHealthStrip() {
  if (isTape()) return;
  cachedHealthPillsHtml = renderShellHealthPill("Family tapes", "pending");
  paintMainFooterHealth();
  fetch("/family-health.json", { credentials: "include" })
    .catch(() => fetch("http://tapes.localhost:8782/family-health.json", { mode: "cors" }))
    .then((r) => r.json())
    .then((h) => {
      window.__pockitFamilyHealthChecks = h.checks || {};
      if (h.gateway_port && !isCleanDoorsSession()) window.__pockitGatewayPort = h.gateway_port;
      cachedHealthPillsHtml = renderShellHealthPills(h.checks) || renderShellHealthPill("Family tapes", "ok");
      paintMainFooterHealth();
      window.PockitPlayerContextPills?.refresh?.("overview");
    })
    .catch(() => {
      cachedHealthPillsHtml = renderShellHealthPill("Family tapes", "bad");
      paintMainFooterHealth();
    });
}

function bootCassetteId() {
  return document.documentElement.getAttribute("data-boot-cassette");
}

/** Family door or legacy boot attr — never show full hub sidebar. */
function isTapeOnlyMode() {
  return Boolean(bootCassetteId());
}

function findInHubCards(id) {
  for (const sec of CARDS) {
    for (const c of sec.items) if (c.id === id) return c;
  }
  return null;
}

function tapeHostedInPlayer(t) {
  return (t.playable_in || []).includes(TAPE_PLAYER_ID);
}

function playerHostedHubIds() {
  const ids = new Set();
  for (const t of FRAMEWORK_LIBRARY?.tapes || []) {
    if (!tapeHostedInPlayer(t)) continue;
    ids.add(t.hub_card_id || t.id);
  }
  return ids;
}

function libraryTapeToSidebarItem(t) {
  const hubId = t.hub_card_id || t.id;
  const pin = findInHubCards(hubId) || findInHubCards(t.id);
  const ent = FRAMEWORK_BY_HUB.get(hubId) || FRAMEWORK_BY_ID.get(t.id);
  let openPath = null;
  const rawPath = ent?.tape?.open_path || null;
  if (rawPath && rawPath !== "/") {
    openPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (openPath.startsWith("/hello") && !openPath.endsWith("/")) openPath += "/";
  }
  const nativeHello = Boolean(openPath?.startsWith("/hello"));
  return {
    id: hubId,
    title: t.name || pin?.title || hubId,
    glyph: t.glyph || pin?.glyph || "·",
    subtitle: pin?.subtitle || t.sidebar_group || "",
    url: pin?.url || t.web_url || null,
    iframe: pin?.iframe !== false,
    type: pin?.type,
    sidebar_group: t.sidebar_group || null,
    _open_path: openPath || null,
    _play_shell: openPath ? null : `/play/${hubId}/`,
  };
}


function findCatalogEntryByHubId(id) {
  if (!POCKIT_CATALOG) return null;
  for (const p of POCKIT_CATALOG.players || []) {
    for (const c of p.hosted_cassettes || []) {
      if (c.hub_card_id === id || c.id === id) return c;
    }
  }
  return (
    (POCKIT_CATALOG.unassigned_cassettes || []).find(
      (c) => c.hub_card_id === id || c.id === id,
    ) || null
  );
}

/** Guarantee `/play/` or local open_path for Player-console iframe loads. */
function ensureTapePlaybackFields(card, catalogEntry = null) {
  if (window.PockitTokenBridge?.resolvePlaybackFields) {
    return window.PockitTokenBridge.resolvePlaybackFields(card, catalogEntry);
  }
  if (!card || card.type === "overview" || card.type === "library") return card;
  const hubId = card.id;
  const cat = catalogEntry || findCatalogEntryByHubId(hubId);
  if (cat?.operator_door) {
    if (isTape()) {
      return {
        ...card,
        url: cat.url || card.url || null,
        iframe: cat.iframe !== false,
        _play_shell: `/play/${hubId}/`,
        _open_path: null,
      };
    }
    if (cat.url || card.url) {
      return {
        ...card,
        url: cat.url || card.url,
        iframe: cat.iframe !== false,
        _open_path: null,
        _play_shell: null,
      };
    }
  }
  if (card._play_shell || card._open_path) return card;
  const surface = catalogSurface(cat);
  if (surface.pockit_pad || surface.encompass_mode === "native_pad" || surface.type === "odysseus") {
    return {
      ...card,
      type: surface.type || card.type || "odysseus",
      iframe: false,
      _encompass: true,
      _speakers_door: surface.speakers_door || cat?.family_url,
    };
  }
  if (surface.encompass_mode === "hud_iframe" && isEncompassHudCassetteId(hubId || cat?.id)) {
    return {
      ...card,
      iframe: true,
      _encompass: true,
      _speakers_door: surface.speakers_door || cat?.family_url,
    };
  }
  // Mac .app weave — iframe the Family Office door URL, never synthesize /play/mac-app-*/
  if (card._macAppId || String(hubId || "").startsWith("mac-app-")) {
    return { ...card, iframe: card.iframe !== false };
  }
  const libTape = libraryTapeByCardId(hubId);
  const surfacePath = catalogEntry?.surface?.center_path || catalogEntry?.settings?.surface?.center_path;
  const rawPath =
    surfacePath ||
    libTape?.open_path ||
    catalogEntry?.path ||
    tapeOpenPath(card) ||
    null;
  if (rawPath && rawPath !== "/") {
    let openPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (openPath.startsWith("/hello") && !openPath.endsWith("/")) openPath += "/";
    return { ...card, _open_path: openPath, _play_shell: null };
  }
  if (isTape()) {
    return { ...card, _play_shell: `/play/${hubId}/`, iframe: card.iframe !== false };
  }
  return card;
}

/** Hub card for overview/load — curated pin, merged manifest, or catalog synthesis. */
function catalogEntryToHubCard(c) {
  const hubId = c.hub_card_id || c.id;
  const libTape = libraryTapeByCardId(hubId) || libraryTapeByCardId(c.id);
  const pin = hubCardById(hubId) || hubCardById(c.id);
  if (libTape) {
    const item = libraryTapeToSidebarItem(libTape);
    if (pin) {
      return ensureTapePlaybackFields({
        ...item,
        title: pin.title || item.title,
        glyph: pin.glyph || item.glyph,
        subtitle: pin.subtitle || item.subtitle,
        url: pin.url ?? item.url,
        iframe: pin.iframe !== false,
        type: pin.type ?? item.type,
        pill: pin.pill,
      }, c);
    }
    return item;
  }
  if (pin) return ensureTapePlaybackFields({ ...pin, id: hubId }, c);
  const isOpDoor = Boolean(c.operator_door);
  const rawPath = isOpDoor ? null : (libTape?.open_path || c.path || null);
  const openPath = rawPath && rawPath !== "/"
    ? (rawPath.startsWith("/") ? rawPath : `/${rawPath}`)
    : null;
  return ensureTapePlaybackFields({
    id: hubId,
    title: c.name || libTape?.name || hubId,
    glyph: c.glyph || libTape?.glyph || "📼",
    subtitle: c.niche || libTape?.niche || c.sidebar_group || (isOpDoor ? `${c.surface_kind || "door"} · operator` : ""),
    url: c.url || c.web_url || libTape?.web_url || null,
    iframe: c.iframe !== false,
    pill: c.parent_console || null,
    sidebar_group: c.sidebar_group || libTape?.sidebar_group || null,
    _operator_door: isOpDoor || undefined,
    _open_path: openPath,
    _play_shell: openPath ? null : (isOpDoor ? null : `/play/${hubId}/`),
  }, c);
}

function catalogEntryToSidebarItem(c) {
  if (isVoiceCatalogEntry(c)) return voicePadMenuItem();
  const hubId = c.hub_card_id || c.id;
  const hubCard = catalogEntryToHubCard(c);
  const libTape = libraryTapeByCardId(hubId) || libraryTapeByCardId(c.id);
  if (libTape) {
    const fromLib = libraryTapeToSidebarItem(libTape);
    const openPath = hubCard._open_path || fromLib._open_path;
    return ensureTapePlaybackFields({
      ...fromLib,
      title: hubCard.title || fromLib.title,
      glyph: hubCard.glyph || fromLib.glyph,
      subtitle: hubCard.subtitle || fromLib.subtitle,
      url: hubCard.url || fromLib.url,
      sidebar_group: c.sidebar_group || hubCard.sidebar_group || fromLib.sidebar_group || null,
      _open_path: openPath,
      _play_shell: openPath ? null : (hubCard._play_shell || fromLib._play_shell),
      iframe: hubCard.iframe !== false,
    }, c);
  }
  const pin = hubCardById(hubId) || hubCardById(c.id);
  if (pin) {
    return ensureTapePlaybackFields({
      id: hubId,
      title: pin.title,
      glyph: pin.glyph,
      subtitle: pin.subtitle || "",
      url: pin.url,
      iframe: pin.iframe !== false,
      type: pin.type,
    }, c);
  }
  return hubCard;
}

function registerMacAppSidebarCards() {
  if (!POCKIT_CATALOG?.mac_apps) return;
  for (const app of POCKIT_CATALOG.mac_apps) {
    const id = `mac-app-${app.id}`;
    TAPE_SIDEBAR_ITEMS.set(id, {
      id,
      title: app.displayName || app.id,
      url: app.door,
      iframe: true,
      type: "load",
      glyph: app.symbol || "📱",
      subtitle: app.surface_kind || "",
      _macAppId: app.id,
    });
  }
}

function rebuildTapeSidebarIndex() {
  TAPE_SIDEBAR_ITEMS.clear();
  if (!isTape()) return;

  const addCatalogEntry = (c) => {
    const item = catalogEntryToSidebarItem(c);
    if (item) TAPE_SIDEBAR_ITEMS.set(item.id, item);
  };

  if (POCKIT_CATALOG) {
    for (const p of POCKIT_CATALOG.players || []) {
      for (const c of p.hosted_cassettes || []) addCatalogEntry(c);
    }
    for (const c of POCKIT_CATALOG.unassigned_cassettes || []) addCatalogEntry(c);
    registerMacAppSidebarCards();
    return;
  }

  if (!FRAMEWORK_LIBRARY?.tapes) return;
  for (const t of FRAMEWORK_LIBRARY.tapes) {
    if (!tapeHostedInPlayer(t)) continue;
    const item = libraryTapeToSidebarItem(t);
    TAPE_SIDEBAR_ITEMS.set(item.id, item);
  }
}

function voiceAppDisplay() {
  return window.VoiceAppDisplay || {
    name: "Super Rick",
    alias: "Rick",
    symbol: "Ri",
    glyph: "🗣️",
    tagline: "Voice-first AI agent — sovereign STT/TTS on your hardware",
    padSubtitle: "Talk to Nephew · sovereign on your hardware",
    suiteBlurb: "Voice-first AI agent — talk to Nephew on-device",
  };
}

function voicePadMenuItem() {
  const V = voiceAppDisplay();
  return {
    id: "voice",
    title: V.name,
    icon: "AudioOutlined",
    glyph: V.glyph,
    subtitle: V.tagline,
    type: "voice",
  };
}

function knowledgePadMenuItem() {
  return {
    id: "knowledge",
    title: "Knowledge",
    icon: "BookOutlined",
    glyph: "🧠",
    subtitle: "Ask the family brain · cited RAG",
    type: "knowledge",
  };
}

function promptLibraryMenuItem() {
  return {
    id: "prompt-library",
    title: "Prompts",
    icon: "FileTextOutlined",
    glyph: "📋",
    subtitle: "Operator prompt library · Play in every surface",
    type: "prompt-library",
  };
}

function shipIntegrityMenuItem() {
  return {
    id: "ship-integrity",
    title: "Ship Integrity",
    icon: "SafetyCertificateOutlined",
    glyph: "🛡",
    subtitle: "Invisible pads · tower paths · Spark SSH probe",
    type: "ship-integrity",
  };
}

function familyDeskMenuItem() {
  return {
    id: "family-desk",
    title: "Family Wealth Desk",
    icon: "BankOutlined",
    glyph: "🏛",
    subtitle: "Net worth · allocation · cash flow · FOP entities",
    type: "family-desk",
  };
}

function configurationsMenuItem() {
  return {
    id: "configurations",
    title: "Configurations",
    icon: "SettingOutlined",
    glyph: "⚙️",
    subtitle: "Operator JSON registry · Voice · boot accessories",
    type: "configurations",
  };
}

/** Left rail — players only (never nested cassettes). */

function pockitNavDropdownOptions() {
  const opts = [
    { value: "apps", label: "Apps overview", icon: "AppstoreOutlined" },
    { value: "voice", label: "Voice (Parakeet)", icon: "AudioOutlined" },
    { value: "knowledge", label: "Knowledge", icon: "BookOutlined" },
    { value: "prompt-library", label: "Prompts", icon: "FileTextOutlined" },
    { value: "family-desk", label: "Family Desk", icon: "BankOutlined" },
    { value: "ship-integrity", label: "Ship Integrity", icon: "SafetyCertificateOutlined" },
    { value: "configurations", label: "Configurations", icon: "SettingOutlined" },
  ];
  if (POCKIT_CATALOG?.players) {
    opts.push({ value: "__players_header", label: "Consoles", icon: "", isHeader: true });
    for (const p of POCKIT_CATALOG.players) {
      const count = (p.hosted_cassettes || []).length;
      opts.push({
        value: p.id,
        label: count ? `${p.name || p.id} (${count})` : `${p.name || p.id}`,
        icon: "ClusterOutlined",
      });
    }
  }
  return opts;
}

function pockitNavDropdownLabel() {
  if (!POCKIT_PLAYER) return "Pockit";
  const player = catalogPlayerById(POCKIT_PLAYER);
  return player?.name || POCKIT_PLAYER;
}

/** Human label for console picker / suite-bar (never the long catalogue name). */
function pockitDisplayLabel(value) {
  const v = value != null ? value : pockitNavDropdownValue();
  if (v === "voice") return "Voice";
  if (v === "knowledge") return "Knowledge";
  if (v === "prompt-library") return "Prompts";
  if (v === "family-desk") return "Family Desk";
  if (v === "ship-integrity") return "Ship Integrity";
  if (v === "library") return "Library";
  if (!v || v === "apps") return "Pockit";
  const SHORT = {
    pockit: "Pockit",
    "nephew-deck": "Control Tower",
    automata: "Automata",
    dustpan: "DustPan",
    wordpress: "WordPress",
    bishop: "Bishop",
    "search-my-engine": "Search",
    "bank-reader": "Bank",
    "container-deck": "Stacks",
    "dockyard-console": "Containers",
    containers: "Containers",
    readyplay: "ReadyPlay",
    clinic: "Clinic",
  };
  if (SHORT[v]) return SHORT[v];
  const player = catalogPlayerById(v);
  let name = (player?.name || v).trim();
  name = name.replace(/^Nephew\s+/i, "").replace(/\s+·\s+.*/, "");
  if (name.length <= 22) return name;
  const first = name.split(/\s+/)[0];
  return first.length >= 4 ? first : name.slice(0, 20);
}

/** Short label for suite-bar brand + rail triggers — never the long catalogue name. */
function consolePickerShortLabel() {
  return pockitDisplayLabel(pockitNavDropdownValue());
}

function pockitNavDropdownValue() {
  const activeId = currentCassetteId();
  if (isVoiceCassetteId(activeId)) return "voice";
  if (activeId === "knowledge" || activeId === "knowledge-cassette") return "knowledge";
  if (activeId === "prompt-library" || activeId === "prompt-library-cassette") return "prompt-library";
  if (activeId === "family-desk" || activeId === "family-desk-cassette") return "family-desk";
  if (activeId === "ship-integrity" || activeId === "ship-integrity-cassette") return "ship-integrity";
  if (activeId === "library") return "library";
  if (activeId === "overview" || activeId === "smoke-checklist" || activeId === "suite-welcome") {
    if (!POCKIT_PLAYER || POCKIT_PLAYER === "pockit") return "apps";
  }
  if (!POCKIT_PLAYER) return "apps";
  return POCKIT_PLAYER;
}

function activeConsolePickerItem() {
  const value = pockitNavDropdownValue();
  return (
    consoleModalAppCards().find((c) => c.value === value)
    || consoleModalPlayerCards().find((c) => c.value === value)
    || null
  );
}

function consoleModalItemIconInner(item) {
  if (!item) {
    const pockit = catalogPlayerById("pockit");
    if (pockit) return hubIcon(pockit);
    return optIcon({ value: "pockit", icon: "ClusterOutlined" });
  }
  if (item.player) return hubIcon(item.player);
  if (item.glyph) return hubIcon({ glyph: item.glyph, title: item.title || item.value });
  return optIcon(item);
}

function suiteAppForConsoleValue(value) {
  const apps = window.PockitSuite?.SUITE_APPS;
  if (!apps) return null;
  return apps.find((a) => a.id === value || a.loadId === value) || null;
}

function consoleElementSymbol(label) {
  const symFn = window.PockitSuite?.elementSymbolFromName;
  const n = String(label || "App").trim().replace(/^Nephew\s+/i, "");
  const parts = n.split(/[\s·–-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${(parts[0][0] || "?").toUpperCase()}${(parts[1][0] || "").toLowerCase()}`;
  }
  if (symFn) return symFn(n);
  return n.slice(0, 2) || "??";
}

function consoleElementHue(seed, player) {
  if (player?.hue != null) return Number(player.hue);
  const fromPlayer = catalogPlayerById(String(seed || ""));
  if (fromPlayer?.hue != null) return Number(fromPlayer.hue);
  const suiteApp = suiteAppForConsoleValue(seed);
  if (suiteApp?.hue != null) return Number(suiteApp.hue);
  const switcherHue = POCKIT_CATALOG?.console_hues?.switcher_apps?.[seed];
  if (switcherHue != null) {
    if (typeof switcherHue === "object" && switcherHue.hue != null) return Number(switcherHue.hue);
    if (typeof switcherHue === "number") return Number(switcherHue);
  }
  const macApp = POCKIT_CATALOG?.mac_apps?.find((a) => a.player_id === seed && a.hue != null);
  if (macApp?.hue != null) return Number(macApp.hue);
  let h = 0;
  const key = String(seed || "");
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 16 + (h % 300);
}

/** Suite player accents — keep in sync with pockit-suite.css body[data-suite-active] rules. */
const PLAYER_SUITE_ACCENTS = {
  pockit: "hsl(204 70% 48%)",
  automata: "hsl(278 65% 62%)",
  "nephew-deck": "hsl(152 55% 48%)",
  voice: "hsl(340 70% 58%)",
  historia: "hsl(32 85% 52%)",
};

function playerAccentCss(playerId) {
  if (!playerId) return null;
  if (PLAYER_SUITE_ACCENTS[playerId]) return PLAYER_SUITE_ACCENTS[playerId];
  const hue = consoleElementHue(playerId);
  return `hsl(${hue} 65% 52%)`;
}

function effectivePlayerAccentId() {
  if (POCKIT_PLAYER) return POCKIT_PLAYER;
  const suiteActive = document.body.dataset.suiteActive;
  if (suiteActive && suiteActive !== "pockit") return suiteActive;
  return "";
}

/** Rail drawer handles + chrome tints follow the selected player's accent. */
function syncPlayerAccent() {
  const playerId = effectivePlayerAccentId();
  if (!playerId) {
    document.body.style.removeProperty("--accent");
    document.body.style.removeProperty("--accent-hover");
    document.body.style.removeProperty("--accent-dim");
    return;
  }
  const accent = playerAccentCss(playerId);
  document.body.style.setProperty("--accent", accent);
  document.body.style.setProperty("--accent-hover", accent);
  document.body.style.setProperty("--accent-dim", `color-mix(in srgb, ${accent} 15%, transparent)`);
}

function consoleElementTile(meta) {
  const suite = window.PockitSuite;
  if (!suite?.elementTile || !meta) return "";
  return suite.elementTile(meta, { active: false });
}

function playerConsoleElementTile(player) {
  if (!player) return "";
  const id = player.id || "player";
  const name = player.name || id;
  return consoleElementTile({
    id,
    name,
    symbol: consoleElementSymbol(name),
    hue: consoleElementHue(id, player),
  }) || hubIcon(player);
}

/** Native app icon for console switcher cards — large periodic tile for every player/app. */
function consoleModalCardIconHtml(item) {
  const value = item?.value;
  const suiteApp = suiteAppForConsoleValue(value);
  if (suiteApp && window.PockitSuite?.elementTile) {
    return window.PockitSuite.elementTile(suiteApp, { active: false });
  }
  if (item?.player) return playerConsoleElementTile(item.player);
  if (value === "apps") {
    return consoleElementTile({
      id: "apps",
      name: "Overview",
      symbol: "Ov",
      hue: consoleElementHue("apps"),
    }) || consoleModalItemIconInner(item);
  }
  if (value === "library") {
    return consoleElementTile({
      id: "library",
      name: "Library",
      symbol: "Li",
      hue: consoleElementHue("library"),
    }) || consoleModalItemIconInner(item);
  }
  return consoleModalItemIconInner(item);
}

/** Large native app icon for suite-bar brand — no white chrome wrapper. */
function consolePickerBrandIconHtml() {
  const value = pockitNavDropdownValue();
  const suite = window.PockitSuite;
  const suiteApp = suiteAppForConsoleValue(value);
  if (suiteApp && suite?.elementTile) {
    return suite.elementTile(suiteApp, { active: true });
  }
  if (value === "library") {
    return consoleElementTile({
      id: "library",
      name: "Library",
      symbol: "Li",
      hue: consoleElementHue("library"),
    }) || hubIcon({ glyph: "📚", title: "Library" });
  }
  if (value === "apps" || !POCKIT_PLAYER) {
    const pockit = suiteAppForConsoleValue("pockit");
    if (pockit && suite?.elementTile) return suite.elementTile(pockit, { active: true });
    return consoleElementTile({
      id: "apps",
      name: "Overview",
      symbol: "Ov",
      hue: consoleElementHue("apps"),
    }) || optIcon({ value: "pockit", icon: "ClusterOutlined" });
  }
  const player = catalogPlayerById(value);
  if (player) return playerConsoleElementTile(player);
  const options = pockitNavDropdownOptions();
  const iconOpt = options.find((o) => o.value === value && !o.isHeader) || options[0];
  return optIcon(iconOpt);
}

/** Compact glyph for rail / header console pickers (not suite-bar brand). */
function consolePickerTriggerIcon() {
  return consoleModalItemIconInner(activeConsolePickerItem());
}

function consolePickerTriggerHtml() {
  return `
    <div class="comet-dropdown comet-dropdown--rail-fullbleed console-picker-dropdown">
      <button type="button" class="comet-dropdown-trigger comet-dropdown-trigger--rail console-picker-trigger"
        aria-haspopup="dialog" aria-expanded="false" aria-controls="pockit-console-modal"
        title="Switch console — ${escapeHtml(consolePickerShortLabel())}">
        <span class="comet-dropdown-trigger-glyph" aria-hidden="true">${consolePickerTriggerIcon()}</span>
        <span class="comet-dropdown-trigger-label">${escapeHtml(consolePickerShortLabel())}</span>
        <span class="comet-dropdown-chevron" aria-hidden="true">${antIcon("DownOutlined")}</span>
      </button>
    </div>`;
}

function settingsTriggerHtml() {
  const icon = hubIcon({ title: "Settings", glyph: "⚙", icon: "SettingOutlined" });
  const tip = pockitTip("settings") || "Settings\nLayout, theme, rails, and operator preferences";
  return `
    <div class="sidebar-item sidebar-item--settings player-rail-settings-row">
      <button type="button" class="sidebar-item-main settings-modal-trigger player-rail-settings-trigger"
        aria-haspopup="dialog" aria-expanded="false" aria-controls="pockit-settings-modal"
        data-comet-tip="${cometTipAttr(tip)}" aria-label="Settings">
        <span class="sidebar-glyph-wrap sidebar-glyph-wrap--tile" aria-hidden="true">${icon}</span>
        <span class="sidebar-label">Settings</span>
      </button>
    </div>`;
}

function syncConsoleNavDropdown() {
  syncConsolePickerTriggers();
}

/** @deprecated use syncConsoleNavDropdown */
function syncPlayerRailNavDropdown() {
  syncConsoleNavDropdown();
}

function syncOneConsoleNavDropdown(dropdownId) {
  const dd = document.getElementById(dropdownId);
  if (!dd) return;
  const value = pockitNavDropdownValue();
  const options = pockitNavDropdownOptions();
  const current = options.find((o) => o.value === value) || options[0];
  dd.dataset.value = value;
  const trigger = dd.querySelector(".comet-dropdown-trigger");
  const panel = dd.querySelector(".comet-dropdown-panel");
  if (trigger) {
    const tg = trigger.querySelector(".comet-dropdown-trigger-glyph");
    const tl = trigger.querySelector(".comet-dropdown-trigger-label");
    const iconOpt = options.find((o) => o.value === value) || current;
    if (tg) tg.innerHTML = optIcon(iconOpt);
    if (tl) tl.textContent = consolePickerShortLabel();
  }
  if (panel) {
    panel.querySelectorAll(".comet-menu-item").forEach((el) => {
      const on = el.dataset.value === value;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
      const check = el.querySelector(".comet-menu-item-check");
      if (check) check.textContent = on ? "✓" : "";
    });
  }
}

function macAppWeaveActive() {
  if (isVoiceCassetteActive() || isKnowledgeCassetteActive() || isHelpConsoleActive()) return false;
  if (isEncompassIframeConsole(findCassette(currentCassetteId()))) return false;
  if (!isTape() || !(POCKIT_CATALOG?.mac_apps?.length) || typeof globalThis.PockitWeave === "undefined") {
    return false;
  }
  const routeId = currentCassetteId();
  if (routeId === "overview" || routeId === "library") return true;
  if (POCKIT_MAC_APP) return true;
  return !POCKIT_PLAYER || POCKIT_PLAYER === "pockit";
}

function macAppCatalogRow(appId) {
  return POCKIT_CATALOG?.mac_apps?.find((a) => a.id === appId) || null;
}

function isExtArchiveHubCard(card) {
  const id = card?.id || card?.hub_card_id;
  return id === "ext-archive" || canonicalHashCassetteId(id) === "ext-archive";
}

function isExtArchiveCassetteActive() {
  const cid = currentCassetteId();
  const card = findCassette(cid);
  return isExtArchiveHubCard(card) || isEncompassIframeConsole(card) || POCKIT_PLAYER === "search-my-engine";
}

function buildActiveCassetteWeaveState() {
  if (!isTape()) return null;
  if (macAppWeaveActive()) {
    const weave = buildMacAppWeaveStateInner();
    if (weave) return weave;
  }
  const cid = encompassCassetteIdForActiveRoute();
  if (!cid) return null;
  const manifest = ENCOMPASS_MANIFESTS[cid];
  if (!manifest || typeof PockitWeave.buildCassetteWeaveFromManifest !== "function") return null;
  return PockitWeave.buildCassetteWeaveFromManifest(manifest);
}

/** @deprecated use setEncompassIframeRoute */
function navigateEncompassHudPath(cassette, path) {
  setEncompassIframeRoute(path, cassette);
}

function buildMacAppWeaveStateInner() {
  if (!macAppWeaveActive()) return null;
  const weave = PockitWeave.buildMacAppWeave({
    catalog: POCKIT_CATALOG,
    activeMacAppId: POCKIT_MAC_APP,
    activeCassetteId: currentCassetteId(),
    toSidebarItem: (c) => catalogEntryToSidebarItem(c),
    findCatalogEntry: findCatalogEntryByHubId,
  });
  const cid = canonicalHashCassetteId(currentCassetteId());
  const manifest = ENCOMPASS_MANIFESTS[cid]
    || (isOdysseusHubCard(findCassette(cid)) ? ENCOMPASS_MANIFESTS["web-odysseus"] : null)
    || (isKnowledgeHubCard(findCassette(cid)) ? ENCOMPASS_MANIFESTS.knowledge : null);
  if (manifest && typeof PockitWeave.buildCassetteWeaveFromManifest === "function") {
    const enc = PockitWeave.buildCassetteWeaveFromManifest(manifest);
    if (enc?.rightSections?.length) weave.rightSections = enc.rightSections;
    if (enc?.leftSections?.length) {
      weave.leftSections = [...enc.leftSections, ...weave.leftSections];
    }
  }
  return weave;
}

function buildMacAppWeaveState() {
  return buildActiveCassetteWeaveState();
}

function macAppTileHtml(item) {
  const sym = String(item.symbol || item.title?.slice(0, 2) || "??");
  const hue = item.hue ?? 212;
  return `<span class="suite-element suite-element--rail" style="--suite-hue:${hue}" aria-hidden="true">
    <span class="suite-element__sym">
      <span class="suite-element__sym-big">${escapeHtml(sym[0] || "?")}</span>
      <span class="suite-element__sym-sm">${escapeHtml(sym.slice(1) || "")}</span>
    </span>
  </span>`;
}

function selectMacApp(appId, { openCenter = true } = {}) {
  if (!appId) return;
  if (appId === "accessory-desk") {
    selectAccessoryDesk({ openCenter });
    return;
  }
  POCKIT_MAC_APP = appId;
  POCKIT_PLAYER = "";
  POCKIT_PLAYER_GROUP = "";
  try {
    localStorage.setItem("nephew-pockit-mac-app", appId);
    localStorage.removeItem("nephew-pockit-player");
  } catch { /* private mode */ }
  renderSidebar();
  if (openCenter) openMacAppCenter(appId);
  highlightActiveRails(currentCassetteId());
  try {
    window.dispatchEvent(new CustomEvent("nephew-mac-app-intent", { detail: { appId } }));
  } catch { /* ignore */ }
}

function isAccessoryDeskHubCard(card) {
  return card?.id === "accessory-desk" || card?.type === "accessory-desk";
}

function openAccessoryDesk() {
  const card = {
    id: "accessory-desk",
    title: "Accessory Desk",
    type: "accessory-desk",
    _macAppId: "accessory-desk",
  };
  TAPE_SIDEBAR_ITEMS.set(card.id, card);
  setCassette(card.id);
}

function selectAccessoryDesk({ openCenter = true } = {}) {
  POCKIT_MAC_APP = "accessory-desk";
  try {
    localStorage.setItem("nephew-pockit-mac-app", "accessory-desk");
  } catch { /* ignore */ }
  renderSidebar();
  if (openCenter) openAccessoryDesk();
  highlightActiveRails(currentCassetteId());
  try {
    window.dispatchEvent(new CustomEvent("nephew-mac-app-intent", { detail: { appId: "accessory-desk" } }));
  } catch { /* ignore */ }
}

function consumeConsoleQueryDeepLink() {
  const params = new URLSearchParams(window.location.search || "");
  const consoleId = params.get("console");
  if (!consoleId || !CONSOLE_SELF_EMBED_IDS.has(consoleId)) return null;
  params.delete("console");
  scrubParentEmbedQueryParams(params);
  const q = params.toString() ? `?${params.toString()}` : "";
  try {
    window.history.replaceState({}, "", `${pockitSpaBasePath()}${q}${window.location.hash || ""}`);
  } catch {
    /* ignore */
  }
  return consoleId;
}

function openMacAppCenter(appId) {
  const app = macAppCatalogRow(appId);
  if (!app) return;
  if (appId === "suite") {
    selectAccessoryDesk();
    return;
  }
  if (appId === "pockit") {
    setCassette("overview");
    return;
  }
  const macPlayerId = app.player_id || null;
  if (
    macPlayerId &&
    CONSOLE_SELF_EMBED_IDS.has(macPlayerId) &&
    consoleProjectionHref(catalogPlayerById(macPlayerId))
  ) {
    POCKIT_MAC_APP = appId;
    openConsoleConsoleView(macPlayerId);
    return;
  }
  if (app.cassette_id) {
    if (app.surface_kind === "tape") {
      POCKIT_MAC_APP = appId;
      setCassette(app.cassette_id);
      return;
    }
    const ent = findCatalogEntryByHubId(app.cassette_id);
    const surface = catalogSurface(ent);
    if (surface.pockit_pad || surface.encompass_mode === "native_pad" || app.cassette_id === "web-odysseus") {
      POCKIT_MAC_APP = appId;
      setCassette(ent?.hub_card_id || app.cassette_id);
      return;
    }
    if (ent) {
      setCassette(ent.hub_card_id || app.cassette_id);
      return;
    }
  }
  if (appId === "odysseus") {
    POCKIT_MAC_APP = appId;
    setCassette("web-odysseus");
    return;
  }
  // Mac Accessory weave — iframe the Projection URL when not encompass-native.
  openMacAppDoor(
    appId,
    app.door || `http://${app.door_slug || appId}.localhost/`,
  );
}

function openMacAppDoor(appId, door) {
  const app = macAppCatalogRow(appId);
  // Speaker doors stay on their origin — do not hop dressed Pockit consoles (RL-POCKIT-CONSOLE-EMBED-001).
  const href = door || app?.door;
  if (!href) return;
  const card = {
    id: `mac-app-${appId}`,
    title: app?.displayName || appId,
    url: href,
    iframe: true,
    type: "load",
  };
  TAPE_SIDEBAR_ITEMS.set(card.id, card);
  setCassette(card.id);
}

function playerRailSections() {
  if (!isTape()) return CARDS;
  const sections = [];
  if (!POCKIT_CATALOG?.players) return sections;
  const playerItems = [];
  for (const p of POCKIT_CATALOG.players) {
    const count = (p.hosted_cassettes || []).length;
    if (!count) continue;
    playerItems.push({
      id: `player-nav-${p.id}`,
      _playerId: p.id,
      title: p.name,
      icon: "ClusterOutlined",
      subtitle: `${count} cassette${count === 1 ? "" : "s"}`,
      type: "player-nav",
    });
  }
  if (playerItems.length) sections.push({ section: "Consoles", items: playerItems });
  return sections;
}

function playerRailSectionsForCurrentRoute() {
  if (isHelpConsoleActive()) {
    return window.PockitRailContext?.buildHelpLeftRailSections?.() || [];
  }
  if (isVoiceCassetteActive()) {
    return window.PockitRailContext?.buildVoiceLeftRailSections?.() || [];
  }
  if (isVideoCassetteActive()) {
    return window.PockitRailContext?.buildVideoLeftRailSections?.() || [];
  }
  if (isKnowledgeCassetteActive()) {
    return window.PockitRailContext?.buildKnowledgeLeftRailSections?.() || [];
  }
  const weave = buildActiveCassetteWeaveState();
  if (weave?.leftSections?.length) return weave.leftSections;
  return getCurrentScopeMenuSections();
}

function syncVoiceRailDrawerLabels() {
  const voice = isVoiceCassetteActive();
  const video = isVideoCassetteActive();
  const knowledge = isKnowledgeCassetteActive();
  const help = isHelpConsoleActive();
  const encompass = isEncompassIframeConsole(findCassette(currentCassetteId()));
  const encManifest = encompass ? activeEncompassManifest() : null;
  const encRightLabel =
    encManifest?.nav_label
    || encManifest?.nav_sections?.[0]?.label
    || "Tools";
  const playerText = help
    ? "Topics"
    : voice
      ? "Controller"
      : video
        ? "Controller"
        : knowledge
          ? "Scope"
          : encompass
            ? (encManifest?.left_nav_label || "Archive")
            : "Consoles";
  const cassetteText = help
    ? "Related"
    : voice
      ? "Stack"
      : video
        ? "Stack"
        : knowledge
          ? "Brain"
          : encompass
            ? encRightLabel
            : "Cartridges";
  const playerHandle = document.getElementById("player-rail-handle");
  const cassetteHandle = document.getElementById("cassette-rail-handle");
  const playerToggle = document.getElementById("player-rail-toggle");
  const cassetteToggle = document.getElementById("cassette-rail-toggle");
  const playerLabel = playerHandle?.querySelector(".rail-drawer-handle__label");
  const cassetteLabel = cassetteHandle?.querySelector(".rail-drawer-handle__label");
  if (playerLabel) playerLabel.textContent = playerText;
  if (cassetteLabel) cassetteLabel.textContent = cassetteText;
  if (playerToggle) {
    const cap = playerToggle.querySelector(".icon-btn__caption");
    if (cap) cap.textContent = playerText;
  }
  if (cassetteToggle) {
    const cap = cassetteToggle.querySelector(".icon-btn__caption");
    if (cap) cap.textContent = cassetteText;
  }
  document.body.classList.toggle("pockit-voice-rails", voice);
  document.body.classList.toggle("pockit-video-rails", video);
  document.body.classList.toggle("pockit-knowledge-rails", knowledge);
  document.body.classList.toggle("pockit-help-rails", help);
}

function syncKnowledgeRailDrawerLabels() {
  syncVoiceRailDrawerLabels();
}

function syncVoiceRailSpeakerLabel(st = {}) {
  const labelEl = document.getElementById("voice-rail-speaker-label");
  if (!labelEl) return;
  const padPicker = document.getElementById("voice-picker");
  const sel = padPicker?.selectedOptions?.[0];
  if (sel?.textContent) {
    labelEl.textContent = sel.textContent.trim();
    return;
  }
  if (st.voice) labelEl.textContent = st.voice;
}

function bindVoicePickerRailSync() {
  const padPicker = document.getElementById("voice-picker");
  const railPicker = document.getElementById("voice-rail-picker");
  if (!padPicker || !railPicker || railPicker.dataset.syncBound === "1") return;
  railPicker.dataset.syncBound = "1";
  const syncToRail = () => {
    railPicker.innerHTML = padPicker.innerHTML;
    if (railPicker.value !== padPicker.value) railPicker.value = padPicker.value;
  };
  syncToRail();
  padPicker.addEventListener("change", syncToRail);
  railPicker.addEventListener("change", () => {
    if (padPicker.value !== railPicker.value) {
      padPicker.value = railPicker.value;
      padPicker.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function bindVoiceRailActions(rootSelector) {
  document.querySelectorAll(`${rootSelector} [data-action=voice-control]`).forEach((btn) => {
    if (btn.dataset.voiceRailBound === "1") return;
    btn.dataset.voiceRailBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const inPhoneChrome = window.isPhoneChromeEl?.(btn);
      if (!inPhoneChrome) e.stopPropagation();
      const voiceId = btn.getAttribute("data-voice-id");
      if (voiceId) {
        window.ParakeetVoicePad?.dispatchControl?.({ voice: voiceId });
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const spec = {
        action: btn.getAttribute("data-voice-action") || undefined,
        route: btn.getAttribute("data-voice-route") || undefined,
        mode: btn.getAttribute("data-voice-mode") || undefined,
        rag: btn.getAttribute("data-voice-rag") || undefined,
      };
      if (window.ParakeetVoicePad?.dispatchControl?.(spec)) {
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      if (spec.action === "talk") document.getElementById("voice-mic")?.click();
      if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
    });
  });
  window.PockitRailContext?.bindMakeActions?.(rootSelector);
  window.PockitRailContext?.bindSectionJump?.(rootSelector);
  window.VoiceRailInfo?.bindInfoButtons?.(rootSelector);
}

function bindKnowledgeRailActions(rootSelector) {
  document.querySelectorAll(`${rootSelector} [data-action=knowledge-control]`).forEach((btn) => {
    if (btn.dataset.knowledgeRailBound === "1") return;
    btn.dataset.knowledgeRailBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const inPhoneChrome = window.isPhoneChromeEl?.(btn);
      if (!inPhoneChrome) e.stopPropagation();
      const scope = btn.getAttribute("data-knowledge-scope");
      if (scope) {
        window.KnowledgeHud?.setScope?.(scope);
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const panel = btn.getAttribute("data-knowledge-panel");
      if (panel) {
        setEncompassPanel(panel, findCassette(currentCassetteId()));
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
      }
    });
  });
  window.PockitRailContext?.bindMakeActions?.(rootSelector);
  window.KnowledgeRailInfo?.bindInfoButtons?.(rootSelector);
}

function bindHelpRailActions(rootSelector) {
  document.querySelectorAll(`${rootSelector} [data-action=help-control]`).forEach((btn) => {
    if (btn.dataset.helpRailBound === "1") return;
    btn.dataset.helpRailBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const inPhoneChrome = window.isPhoneChromeEl?.(btn);
      if (!inPhoneChrome) e.stopPropagation();
      const sectionId = btn.getAttribute("data-help-section-id");
      const articleId = btn.getAttribute("data-help-article-id");
      if (sectionId && articleId) {
        window.PockitHelpConsole?.setSelection?.(sectionId, articleId);
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const nav = btn.getAttribute("data-help-nav");
      if (nav === "overview") {
        setCassette("overview");
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const loadId = btn.getAttribute("data-help-load-id");
      if (loadId) {
        setCassette(loadId);
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const url = btn.getAttribute("data-help-url");
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const makeTarget = btn.getAttribute("data-help-make");
      if (makeTarget) {
        window.PockitRailContext?.runMakeTarget?.(makeTarget, { source: "help-rail" });
        if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
      }
    });
  });
  window.PockitRailContext?.bindMakeActions?.(rootSelector);
}

function highlightHelpRailSelections(st = {}) {
  const roots = [
    document.getElementById("player-rail-content"),
    document.getElementById("sidebar-content"),
    document.getElementById("pockit-controls-sheet-rail-left"),
    document.getElementById("pockit-controls-sheet-rail-right"),
    document.getElementById("pockit-mobile-hud-body"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!root || !st) continue;
    root.querySelectorAll("[data-help-section-id][data-help-article-id]").forEach((btn) => {
      const on = btn.getAttribute("data-help-section-id") === st.sectionId
        && btn.getAttribute("data-help-article-id") === st.articleId;
      btn.classList.toggle("active", on);
    });
  }
}

function highlightKnowledgeRailSelections(st = {}) {
  window.KnowledgeRailInfo?.syncChrome?.(st);
  const roots = [
    document.getElementById("player-rail-content"),
    document.getElementById("sidebar-content"),
    document.getElementById("pockit-controls-sheet-rail-left"),
    document.getElementById("pockit-controls-sheet-rail-right"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!root || !st) continue;
    root.querySelectorAll("[data-knowledge-scope]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-knowledge-scope") === st.scope);
    });
    root.querySelectorAll("[data-knowledge-panel]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-knowledge-panel") === st.panel);
    });
  }
}

function highlightVoiceRailSelections(st = {}) {
  window.VoiceRailInfo?.syncChrome?.(st);
  const roots = [
    document.getElementById("player-rail-content"),
    document.getElementById("sidebar-content"),
    document.getElementById("pockit-controls-sheet-rail-left"),
    document.getElementById("pockit-controls-sheet-rail-right"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!root || !st) continue;
    root.querySelectorAll("[data-voice-route]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-voice-route") === st.route);
    });
    root.querySelectorAll("[data-voice-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-voice-mode") === st.mode);
    });
    root.querySelectorAll("[data-voice-rag]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-voice-rag") === st.rag);
    });
    root.querySelectorAll("[data-voice-id]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-voice-id") === st.voice);
    });
    root.querySelectorAll('[data-voice-action="prime"]').forEach((btn) => {
      btn.classList.toggle("active", Boolean(st.prime));
    });
    root.querySelectorAll('[data-voice-action="talk"]').forEach((btn) => {
      btn.classList.toggle("active", Boolean(st.conversation));
    });
  }
}

function getCurrentScopeMenuSections() {
  if (!isTape()) return CARDS;
  const appsShortcuts = [
    { id: "overview", title: "Overview", icon: "AppstoreOutlined", subtitle: "Apps overview", type: "overview" },
    voicePadMenuItem(),
    knowledgePadMenuItem(),
    familyDeskMenuItem(),
    promptLibraryMenuItem(),
    shipIntegrityMenuItem(),
    configurationsMenuItem(),
    { id: "library", title: "Library", icon: "BookOutlined", subtitle: "All resources", type: "library" },
  ];
  if (!POCKIT_PLAYER) {
    return [{ section: "Apps", items: appsShortcuts }];
  }
  const player = POCKIT_CATALOG?.players?.find((p) => p.id === POCKIT_PLAYER);
  const playerName = player?.name || POCKIT_PLAYER;
  const groups = playerSidebarGroups(POCKIT_PLAYER);
  const groupItems = groups.map((g) => ({
    id: playerGroupNavId(POCKIT_PLAYER, g.name),
    title: g.name,
    icon: "FolderOutlined",
    glyph: "📁",
    subtitle: `${g.count} cassette${g.count === 1 ? "" : "s"}`,
    type: "player-group",
    _groupName: g.name,
    _playerId: POCKIT_PLAYER,
  }));
  return [
    { section: "Apps", items: appsShortcuts },
    { section: playerName, items: groupItems.length ? groupItems : [{ id: "overview", title: "No cartridges", type: "overview", subtitle: "This console has no hosted tapes yet." }] },
  ];
}

function getSubMenuItemsForCassette(cassetteId) {
  // Collect direct children from the sidebar index (parents have submenu children)
  const item = TAPE_SIDEBAR_ITEMS.get(cassetteId);
  if (item && item.children && item.children.length) {
    return item.children;
  }
  // Fallback: look for sidebar items that list this as parent
  const subs = [];
  TAPE_SIDEBAR_ITEMS.forEach((it, key) => {
    if (it.parentId === cassetteId) subs.push(it);
  });
  return subs;
}

function addCassetteTopSubMenu(cassette) {
  if (!cassette || cassette.type === "overview" || cassette.type === "library") return;
  const content = document.getElementById("main-content");
  if (!content) return;
  // Remove previous top subnav if present
  const prev = content.querySelector(".cassette-top-subnav");
  if (prev) prev.remove();
  const subs = getSubMenuItemsForCassette(cassette.id);
  if (!subs || !subs.length) return;
  const nav = document.createElement("div");
  nav.className = "cassette-top-subnav";
  nav.innerHTML = subs
    .map(
      (sub) => `
    <button type="button" class="mini-sub-drop comet-dropdown-trigger" data-sub-id="${escapeHtml(sub.id)}" title="${escapeHtml(sub.title)}">
      <span class="mini-sub-label">${escapeHtml(sub.title)}</span>
      ${sub.children && sub.children.length ? `<span class="mini-chevron">${antIcon("DownOutlined")}</span>` : ""}
    </button>
  `
    )
    .join("");
  // Insert at top of main content (before the holder or panel)
  content.insertBefore(nav, content.firstChild);
  // Bind clicks: load the sub cassette (mini dropdown effect reuses existing setCassette)
  nav.querySelectorAll("button[data-sub-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const subId = btn.getAttribute("data-sub-id");
      if (subId) setCassette(subId);
    });
  });
  // Optional: add simple hover expand for items that have further children using existing submenu style if needed
}

// ─── Knowledge HUD — see knowledge-hud.js ───

function renderKnowledgeHud() {
  if (window.KnowledgeHud?.render) return window.KnowledgeHud.render();
  return `<div class="knowledge-hud"><p>Knowledge HUD failed to load — hard refresh.</p></div>`;
}

function bindKnowledgeActions() {
  if (window.KnowledgeHud?.bind) window.KnowledgeHud.bind();
  if (!window.__knowledgePadStateHook) {
    window.__knowledgePadStateHook = true;
    window.KnowledgeHud.onStateChange?.((st) => {
      if (!isKnowledgeCassetteActive()) return;
      highlightKnowledgeRailSelections(st);
      renderKnowledgeCassetteRail().catch(() => {});
    });
  }
  highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
}

function bindHelpActions() {
  const root = document.getElementById("pockit-help-console")
    || document.querySelector(".pockit-center-canvas--native");
  window.PockitHelpConsole?.bindShell?.(root);
  if (!window.__helpConsoleStateHook) {
    window.__helpConsoleStateHook = true;
    window.PockitHelpConsole?.onStateChange?.((st) => {
      if (!isHelpConsoleActive()) return;
      highlightHelpRailSelections(st);
      renderHelpCassetteRail().catch(() => {});
      renderPlayerRail();
    });
  }
  highlightHelpRailSelections(window.PockitHelpConsole?.getState?.() || {});
}

// ─── Family Wealth Desk — see pockit-family-desk.js ───

function renderFamilyDesk() {
  if (window.PockitFamilyDesk?.render) return window.PockitFamilyDesk.render();
  return `<div id="family-desk" class="family-desk"><p>Family Desk failed to load — hard refresh.</p></div>`;
}

function bindFamilyDeskActions() {
  if (window.PockitFamilyDesk?.bind) window.PockitFamilyDesk.bind();
}

// ─── Ship Integrity — see pockit-ship-integrity.js ───

function renderShipIntegrity() {
  if (window.PockitShipIntegrity?.render) return window.PockitShipIntegrity.render();
  return `<div id="ship-integrity" class="ship-integrity"><p>Ship Integrity failed to load — hard refresh.</p></div>`;
}

function bindShipIntegrityActions() {
  if (window.PockitShipIntegrity?.bind) window.PockitShipIntegrity.bind();
}

// ─── Configurations Center — see pockit-configurations-center.js ───

function renderConfigurationsCenter() {
  if (window.PockitConfigurationsCenter?.render) return window.PockitConfigurationsCenter.render();
  return `<div id="configurations-center" class="config-center"><p>Configurations Center failed to load — hard refresh.</p></div>`;
}

function bindConfigurationsCenterActions() {
  if (window.PockitConfigurationsCenter?.bind) window.PockitConfigurationsCenter.bind();
}

// ─── Accessory Desk — see pockit-accessory-desk-panel.js ───

function renderAccessoryDesk() {
  if (window.PockitAccessoryDeskPanel?.render) return window.PockitAccessoryDeskPanel.render();
  return `<div id="accessory-desk-panel" class="accessory-desk"><p>Accessory Desk failed to load — hard refresh.</p></div>`;
}

function bindAccessoryDeskActions() {
  if (window.PockitAccessoryDeskPanel?.bind) window.PockitAccessoryDeskPanel.bind();
}

// ─── Quick Desk — see pockit-quick-desk-panel.js ───

function renderQuickDesk() {
  if (window.PockitQuickDeskPanel?.render) return window.PockitQuickDeskPanel.render();
  return `<div id="quick-desk-panel" class="quick-desk"><p>Quick Desk failed to load — hard refresh.</p></div>`;
}

function bindQuickDeskActions() {
  if (window.PockitQuickDeskPanel?.bind) window.PockitQuickDeskPanel.bind();
}

// ─── Prompt Library — see pockit-prompt-library.js ───

function renderPromptLibrary() {
  if (window.PromptLibrary?.render) return window.PromptLibrary.render();
  return `<div id="prompt-library" class="prompt-library"><p>Prompt Library failed to load — hard refresh.</p></div>`;
}

function bindPromptLibraryActions() {
  if (window.PromptLibrary?.bind) window.PromptLibrary.bind();
}

function renderOdysseusPad() {
  if (window.OdysseusPad?.render) return window.OdysseusPad.render();
  return `<div id="odysseus-pad" class="odysseus-pad"><p>Odysseus pad failed to load — hard refresh.</p></div>`;
}

function bindOdysseusActions() {
  if (window.OdysseusPad?.bind) window.OdysseusPad.bind();
}

function encompassManifestForCard(c) {
  const card = c || findCassette(currentCassetteId());
  if (isKnowledgeHubCard(card)) return ENCOMPASS_MANIFESTS.knowledge;
  if (isOdysseusHubCard(card)) return ENCOMPASS_MANIFESTS["web-odysseus"];
  const cid = canonicalHashCassetteId(card?.id);
  return ENCOMPASS_MANIFESTS[cid] || null;
}

function setEncompassPanel(panelId, cassette) {
  ENCOMPASS_PANEL = panelId || "chat";
  const c = cassette || findCassette(currentCassetteId());
  if (isEncompassIframeConsole(c)) {
    const cat = findCatalogEntryByHubId(c.id);
    const manifest = ENCOMPASS_MANIFESTS[cat?.id || c.id] || ENCOMPASS_MANIFESTS["ext-archive"];
    const rows = [
      ...(manifest?.left_nav || []),
      ...(manifest?.nav_sections || []).flatMap((s) => s.items || []),
      ...(manifest?.nav || []),
      ...(manifest?.bottom_nav || []),
    ];
    const match = rows.find((r) => r.id === panelId || r.center_panel === panelId);
    if (match?.path) {
      setEncompassIframeRoute(match.path, c);
      return;
    }
  }
  if (isKnowledgeHubCard(c)) {
    const manifest = encompassManifestForCard(c);
    const panelDef = manifest?.panels?.find((p) => p.id === ENCOMPASS_PANEL);
    if (panelDef?.pad_module === "knowledge-hud" || ["chat", "inventory", "probe", "rag-console"].includes(ENCOMPASS_PANEL)) {
      if (!mainContentMatchesCassette(c)) {
        mountCenterCanvas(renderKnowledgeHud(), c);
      }
      bindKnowledgeActions();
      window.KnowledgeHud?.setPanel?.(ENCOMPASS_PANEL);
      highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
      refreshCometTooltips?.();
      return;
    }
    const door = speakersDoorForCard(c);
    const hash = ENCOMPASS_PANEL.startsWith("#") ? ENCOMPASS_PANEL : `#${ENCOMPASS_PANEL}`;
    if (door) window.open(`${door.replace(/\/$/, "")}${hash}`, "_blank", "noopener,noreferrer");
    return;
  }
  const odysseus = c || findCassette("web-odysseus");
  if (ENCOMPASS_PANEL === "chat" || ENCOMPASS_PANEL === "sessions" || ENCOMPASS_PANEL === "new-chat") {
    mountCenterCanvas(renderOdysseusPad(), odysseus);
    bindOdysseusActions();
    refreshCometTooltips?.();
    return;
  }
  const door = speakersDoorForCard(odysseus);
  const hash = ENCOMPASS_PANEL.startsWith("#") ? ENCOMPASS_PANEL : `#${ENCOMPASS_PANEL}`;
  if (door) window.open(`${door.replace(/\/$/, "")}${hash}`, "_blank", "noopener,noreferrer");
}

// ─── Voice Pad (Parakeet) — see voice-pad.js ───

function renderVoicePad() {
  if (window.ParakeetVoicePad?.render) return window.ParakeetVoicePad.render();
  return `<div class="voice-pad"><p>Voice Pad failed to load — hard refresh.</p></div>`;
}

// ─── Video Pad (Super Rick Video) — see video-pad.js ───

function renderVideoPad() {
  if (window.ParakeetVideoPad?.render || window.VideoPad?.render) {
    return (window.ParakeetVideoPad || window.VideoPad).render();
  }
  return `<div class="video-pad"><p>Video Pad failed to load — hard refresh.</p></div>`;
}

function bindVideoActions() {
  const api = window.ParakeetVideoPad || window.VideoPad;
  if (api && typeof api.bind === "function") {
    const pad = document.getElementById("video-pad");
    if (pad && pad.dataset.videoBound !== "1") api.bind();
    if (!window.__videoPadStateHook) {
      window.__videoPadStateHook = true;
      api.onStateChange?.((st) => {
        if (!isVideoCassetteActive()) return;
        renderVideoCassetteRail().catch(() => {});
        window.PockitPlayerContextPills?.refresh?.("video");
      });
      window.addEventListener("video-pad-state", () => {
        if (!isVideoCassetteActive()) return;
        renderVideoCassetteRail().catch(() => {});
      });
    }
  }
}

function bindVoiceActions() {
  if (window.ParakeetVoicePad && typeof window.ParakeetVoicePad.bind === "function") {
    const pad = document.getElementById("voice-pad");
    if (pad && pad.dataset.parakeetBound !== "1") {
      window.ParakeetVoicePad.bind();
    }
    const footerStatus = document.getElementById("voice-footer-status");
    if (footerStatus) footerStatus.textContent = window.ParakeetVoicePad?.getStatusText?.() || "";
    syncVoiceRailSpeakerLabel(window.ParakeetVoicePad?.getState?.() || {});
    if (!window.__voicePadStateHook) {
      window.__voicePadStateHook = true;
      window.ParakeetVoicePad.onStateChange?.((st) => {
        if (!isVoiceCassetteActive()) return;
        highlightVoiceRailSelections(st);
        renderVoiceCassetteRail().catch(() => {});
        window.PockitPlayerContextPills?.refresh?.("voice");
        window.PockitPlayerContextPills?.refreshFooterControls?.("voice");
        const footerStatus = document.getElementById("voice-footer-status");
        if (footerStatus && st.statusText) footerStatus.textContent = st.statusText;
        syncVoiceRailSpeakerLabel(st);
      });
    }
    return;
  }

  // Fallback (should rarely be needed)
  const pad = document.getElementById("voice-pad");
  if (!pad) return;

  const micBtn = document.getElementById("voice-mic");
  const stopBtn = document.getElementById("voice-stop");
  const speakBtn = document.getElementById("voice-speak");
  const clearBtn = document.getElementById("voice-clear");
  const transcript = document.getElementById("voice-transcript");
  const canvas = document.getElementById("voice-visualizer");
  const status = document.getElementById("voice-status");
  const routeBtns = pad.querySelectorAll("[data-voice-route]");

  if (!micBtn || !speakBtn || !transcript || !canvas || !status) return;

  let voiceRoute = "auto";
  let mediaRecorder = null;
  let mediaStream = null;
  let isRecording = false;
  let audioChunks = [];
  let conversation = []; // [{role:'user'|'assistant', text:string}]
  const ctx = canvas.getContext("2d");
  let vizTimer = null;

  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? "var(--rose, #f66)" : "var(--fg-2)";
  }

  function updateRouteUI() {
    routeBtns.forEach((b) => {
      const r = b.dataset.voiceRoute;
      b.classList.toggle("is-active", r === voiceRoute);
    });
  }

  routeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      voiceRoute = btn.dataset.voiceRoute;
      updateRouteUI();
      setStatus(`Route: ${voiceRoute === "dgx" ? "DGX Parakeet (sovereign)" : voiceRoute === "auto" ? "Auto (DGX preferred)" : "Browser Web Speech"}`);
    });
  });
  updateRouteUI();

  function drawVisualizer(level = 0, isActive = false) {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isActive ? "var(--accent, #3a7)" : "var(--fg-3, #666)";
    const bars = 12;
    const barW = w / (bars * 1.6);
    for (let i = 0; i < bars; i++) {
      const barH = Math.max(4, (h - 10) * (0.2 + Math.random() * 0.8 * (level || (isActive ? 0.6 : 0.15))));
      const x = 8 + i * (barW + 4);
      ctx.fillRect(x, h - barH - 4, barW, barH);
    }
  }

  function startViz(active) {
    if (vizTimer) clearInterval(vizTimer);
    vizTimer = setInterval(() => drawVisualizer(active ? 0.7 + Math.random() * 0.3 : 0.1, active), 120);
  }
  function stopViz() {
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
    drawVisualizer(0, false);
  }
  drawVisualizer(0, false);

  async function doSTT(audioBlob) {
    setStatus("Transcribing with sovereign whisper…");
    try {
      const fd = new FormData();
      fd.append("file", audioBlob, "audio.webm");
      const res = await fetch("/api/v1/voice/stt", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`STT ${res.status}`);
      const j = await res.json();
      const text = (j.text || j.transcript || "").trim();
      if (text) {
        conversation.push({ role: "user", text });
        renderConversation();
        transcript.value = text;
        setStatus("Heard you. Tap Speak or Reply with Nephew.");
        return text;
      }
      setStatus("No speech detected. Try again.", true);
      return "";
    } catch (e) {
      setStatus("STT failed: " + e.message, true);
      return "";
    }
  }

  async function doTTS(text, speakNow = true) {
    if (!text) return;
    setStatus("Nephew is speaking (Parakeet on DGX)…");
    try {
      const res = await fetch("/api/v1/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, route: voiceRoute }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setStatus("Ready. Tap mic or type."); stopViz(); };
      if (speakNow) {
        startViz(true);
        await audio.play().catch(() => {});
      }
      return blob;
    } catch (e) {
      setStatus("TTS error (fallback browser if available): " + e.message, true);
      // simple browser fallback
      try {
        const u = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(u);
      } catch {}
      return null;
    }
  }

  async function doChatReply(userText) {
    if (!userText) return;
    setStatus("Thinking with family models…");
    try {
      // Use the OpenAI-compatible chat endpoint (proxies to sovereign Hermes on DGX)
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nephew", // or whatever the compat accepts; adapter handles
          messages: [
            { role: "system", content: "You are Nephew, a helpful, natural-sounding family orchestrator. Reply concisely and warmly. Use the user's language." },
            ...conversation.slice(-6).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
            { role: "user", content: userText }
          ],
          max_tokens: 220,
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`chat ${res.status}`);
      const j = await res.json();
      const reply = (j.choices?.[0]?.message?.content || j.choices?.[0]?.text || "Got it.").trim();
      conversation.push({ role: "assistant", text: reply });
      renderConversation();
      setStatus("Replying in natural Parakeet voice…");
      await doTTS(reply, true);
      return reply;
    } catch (e) {
      setStatus("Chat unavailable — reply shown as text only.", true);
      const msg = `I couldn't reach the brain (${e.message || "error"}).`;
      conversation.push({ role: "assistant", text: msg });
      renderConversation();
    }
  }

  function renderConversation() {
    // If there's no dedicated log yet, create one above the textarea for family usability
    let log = pad.querySelector("#voice-log");
    if (!log) {
      log = document.createElement("div");
      log.id = "voice-log";
      log.style.cssText = "max-height:260px;overflow:auto;margin-bottom:12px;border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--bg-1);font-size:14px;line-height:1.4";
      transcript.parentNode.insertBefore(log, transcript);
    }
    log.innerHTML = conversation.map((m, i) => {
      const who = m.role === "user" ? "You" : "Nephew";
      const cls = m.role === "user" ? "user" : "assistant";
      const speakIcon = m.role === "assistant" ? `<button class="voice-btn" data-replay="${i}" style="font-size:10px;padding:2px 6px;margin-left:6px">🔊</button>` : "";
      return `<div style="margin:6px 0;padding:6px 8px;border-radius:8px;background:${m.role==="user"?"var(--bg-3)":"var(--bg-2)"}"><strong>${who}:</strong> ${escapeHtml(m.text)} ${speakIcon}</div>`;
    }).join("");
    // wire replays
    log.querySelectorAll("[data-replay]").forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.dataset.replay, 10);
        const t = conversation[idx]?.text;
        if (t) doTTS(t, true);
      };
    });
    log.scrollTop = log.scrollHeight;
  }

  // Mic
  micBtn.onclick = async () => {
    if (isRecording) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        mediaStream.getTracks().forEach(t => t.stop());
        isRecording = false;
        micBtn.disabled = false;
        stopBtn.disabled = true;
        stopViz();
        const heard = await doSTT(blob);
        if (heard) {
          // Auto-offer chat reply for natural back-and-forth
          const auto = confirm("Reply with Nephew (voice chat) or just keep the text?");
          if (auto) await doChatReply(heard);
        }
      };
      mediaRecorder.start();
      isRecording = true;
      micBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus("Listening… (sovereign whisper on DGX)");
      startViz(true);
      drawVisualizer(0.8, true);
    } catch (e) {
      setStatus("Mic error — check browser permissions: " + e.message, true);
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  // Speak current text (or last user line)
  speakBtn.onclick = async () => {
    const txt = (transcript.value || conversation.findLast(m => m.role === "user")?.text || "").trim();
    if (!txt) { setStatus("Type or dictate something first.", true); return; }
    await doTTS(txt, true);
  };

  clearBtn.onclick = () => {
    conversation = [];
    transcript.value = "";
    const log = pad.querySelector("#voice-log");
    if (log) log.innerHTML = "";
    setStatus("Cleared. Ready for new dictation or chat.");
    stopViz();
    drawVisualizer(0, false);
  };

  // Bonus: typing + send as chat
  transcript.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const txt = transcript.value.trim();
      if (txt) {
        conversation.push({ role: "user", text: txt });
        renderConversation();
        await doChatReply(txt);
      }
    }
  });

  // Initial status + health hint — probe so we can guide the user if backend (tower-api) is down
  (async () => {
    try {
      const h = await fetch("/api/v1/voice/health", { cache: "no-store" });
      if (h.ok) {
        const j = await h.json();
        const ok = j?.ok && j?.whisper?.ok && j?.fish_speech?.ok;
        setStatus(ok 
          ? "Ready. Hold/click mic for natural dictation (sovereign whisper), or type + Speak / Ctrl+Enter for chat+voice (Hermes → Parakeet). This is the real family voice you heard speaking English." 
          : "Voice backend partial — some services may be warming. Try anyway.");
      } else {
        throw new Error("health not ok");
      }
    } catch (e) {
      setStatus("Auth / Voice API unreachable — start tower-api first:  make tower-api  (or make up / make pockit in the root). Then hard-refresh this page. The mic + natural spoken replies will work once the brain is up (same DGX Parakeet that spoke in the tests).", true);
    }
  })();
  drawVisualizer(0, false);

  // Make the pad feel full and settled in center
  pad.style.minHeight = "420px";
}

/** Right rail — cassettes for the active player group (left rail selection). */
function cassetteRailSections() {
  if (!isTape()) return CARDS;
  const weave = buildMacAppWeaveState();
  if (weave) return weave.rightSections;
  rebuildTapeSidebarIndex();
  const cassetteItems = [];
  if (!POCKIT_CATALOG?.players) {
    cassetteItems.push(
      ...[...TAPE_SIDEBAR_ITEMS.values()].sort((a, b) => String(a.title).localeCompare(String(b.title))),
    );
    return [{ section: "Cartridges", items: cassetteItems }];
  }

  let entries = [];
  let sectionTitle = "Cartridges";

  if (!POCKIT_PLAYER) {
    const pockit = POCKIT_CATALOG.players.find((p) => p.id === "pockit");
    entries = pockit?.hosted_cassettes || [];
    sectionTitle = pockit?.name || "Pockit";
  } else if (POCKIT_PLAYER === "_unassigned") {
    entries = POCKIT_CATALOG.unassigned_cassettes || [];
    sectionTitle = "Other cartridges";
  } else {
    const player = POCKIT_CATALOG.players.find((p) => p.id === POCKIT_PLAYER);
    const all = player?.hosted_cassettes || [];
    if (POCKIT_PLAYER_GROUP) {
      entries = all.filter((c) => catalogSidebarGroup(c) === POCKIT_PLAYER_GROUP);
      sectionTitle = POCKIT_PLAYER_GROUP;
    } else {
      entries = all;
      sectionTitle = player?.name || POCKIT_PLAYER;
    }
  }

  const seen = new Set();
  for (const c of entries) {
    const item = TAPE_SIDEBAR_ITEMS.get(c.hub_card_id || c.id) || catalogEntryToSidebarItem(c);
    if (!item || seen.has(item.id)) continue;
    if (POCKIT_FILTER.trim() && !cardMatchesFilter(item, POCKIT_FILTER.trim())) continue;
    if (!cardMatchesScope(item, POCKIT_SCOPE)) continue;
    seen.add(item.id);
    cassetteItems.push(item);
  }
  cassetteItems.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return [{ section: sectionTitle, items: cassetteItems }];
}

/** Legacy single-sidebar sections (family apex hub). */
function sidebarCardSections() {
  if (!isTape()) return CARDS;
  return cassetteRailSections();
}

function allTapesSubmenuExpanded() {
  return localStorage.getItem("nephew-all-tapes-expanded") !== "0";
}

function setAllTapesSubmenuExpanded(expanded) {
  localStorage.setItem("nephew-all-tapes-expanded", expanded ? "1" : "0");
}

function catalogPlayerRecordForHubId(hubId) {
  if (!POCKIT_CATALOG?.players || !hubId) return null;
  for (const p of POCKIT_CATALOG.players) {
    for (const c of p.hosted_cassettes || []) {
      if (c.hub_card_id === hubId || c.id === hubId) return p;
    }
  }
  return null;
}

/** HSL hue for sidebar row tint — matches hosting player / mac app icon tile. */
function sidebarCardHue(c) {
  if (!c) return 212;
  if (c.hue != null && !Number.isNaN(Number(c.hue))) return Number(c.hue);
  const id = String(c.id || "");
  if (c.type === "mac-app" || id.startsWith("mac-app-")) {
    const macId = c._macAppId || id.replace(/^mac-app-/, "");
    const app = POCKIT_CATALOG?.mac_apps?.find((a) => a.id === macId);
    if (app?.hue != null) return Number(app.hue);
    if (app?.player_id) return consoleElementHue(app.player_id);
  }
  if (c._playerId) return consoleElementHue(c._playerId);
  if (id === "library" || id === "voice" || id === "voice-cassette" || id === "overview") {
    return consoleElementHue(id === "voice-cassette" ? "voice" : id);
  }
  if (c.type === "player-group" && c._playerId) return consoleElementHue(c._playerId);
  const cat = catalogMetaForCard(c) || findCatalogEntryByHubId(id);
  if (cat?.hue != null) return Number(cat.hue);
  if (cat?.crayola?.hue != null) return Number(cat.crayola.hue);
  const owner = catalogPlayerRecordForHubId(cat?.hub_card_id || cat?.id || id);
  if (owner?.hue != null) return Number(owner.hue);
  if (POCKIT_PLAYER) return consoleElementHue(POCKIT_PLAYER);
  return consoleElementHue(id);
}

function hueFromSidebarItemEl(itemEl) {
  if (!itemEl) return 212;
  const raw = itemEl.getAttribute("data-hue");
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  const tile = itemEl.querySelector(".suite-element");
  const fromStyle = tile?.style?.getPropertyValue("--suite-hue")?.trim();
  if (fromStyle) {
    const n = Number(fromStyle);
    if (!Number.isNaN(n)) return n;
  }
  return sidebarCardHue({ id: itemEl.getAttribute("data-id") });
}

function renderSidebarLeaf(c) {
  const childStyle = c._child ? ` style="--comet-delay:${(c._childIndex || 0) * 32}ms"` : "";
  const tip = dashboardDetailTip(c);
  const roleChip = roleChipForCard(c);
  const labelHtml = roleChip
    ? `<span class="sidebar-label sidebar-label--with-chip"><span class="sidebar-label-text">${escapeHtml(c.title)}</span>${roleChip}</span>`
    : `<span class="sidebar-label">${escapeHtml(c.title)}</span>`;
  const newtabHtml = !c.url
    ? ""
    : `<a class="sidebar-item-newtab" href="${c.url}" target="_blank" rel="noopener noreferrer" data-comet-tip="${cometTipAttr(pockitTip("sidebarNewTab") || "Open in new tab\nExternal URL for this item")}" aria-label="Open ${escapeHtml(c.title)} in new tab">↗</a>`;
  const homeHtml = c.type === "player-nav" && c._playerId
    ? `<button type="button" class="sidebar-item-home" data-action="open-player-home" data-player-id="${escapeHtml(c._playerId)}" data-comet-tip="${cometTipAttr(pockitTip("sidebarHome") || "Player home\nJump to this console's overview")}" aria-label="Open ${escapeHtml(c.title)} home">⌂</button>`
    : "";
  const action = c.type === "accessory-desk"
    ? "select-accessory-desk"
    : c.type === "accessory-desk-action"
      ? "accessory-desk-action"
      : c.type === "mac-app"
    ? "select-mac-app"
    : c.type === "mac-app-open"
      ? "mac-app-open"
      : c.type === "mac-app-nav"
        ? "mac-app-nav"
        : c.type === "encompass-nav"
          ? "encompass-nav"
          : c.type === "player-nav"
            ? "filter-player"
            : c.type === "player-group"
              ? "select-player-group"
              : c.type === "voice-action" || c.type === "voice-route" || c.type === "voice-mode" || c.type === "voice-rag" || c.type === "voice-voice"
                ? "voice-control"
                : c.type === "knowledge-scope" || c.type === "knowledge-panel"
                  ? "knowledge-control"
                  : c.type === "make-run"
                  ? "make-run"
                  : c.type === "make-copy"
                    ? "make-copy"
                    : c.type === "section-jump"
                      ? "section-jump"
                      : "load";
  const playerAttr = c._playerId ? ` data-player-id="${escapeHtml(c._playerId)}"` : "";
  const groupAttr = c._groupName ? ` data-group-name="${escapeHtml(c._groupName)}"` : "";
  const macAttr = c._macAppId ? ` data-mac-app-id="${escapeHtml(c._macAppId)}"` : "";
  const navAttr = c._navPath ? ` data-nav-path="${escapeHtml(c._navPath)}"` : "";
  const doorAttr = c._door ? ` data-door="${escapeHtml(c._door)}"` : "";
  const encPanelAttr = c._centerPanel ? ` data-encompass-panel="${escapeHtml(c._centerPanel)}"` : "";
  const encPathAttr = c._encompassPath ? ` data-encompass-path="${escapeHtml(c._encompassPath)}"` : "";
  const encSpeakersAttr = c._speakersOnly ? ` data-encompass-speakers="1"` : "";
  const encDoorAttr = c._speakersDoor ? ` data-encompass-door="${escapeHtml(c._speakersDoor)}"` : "";
  const encCassetteAttr = c._encompassCassetteId ? ` data-encompass-cassette="${escapeHtml(c._encompassCassetteId)}"` : "";
  const voiceActionAttr = c._voiceAction ? ` data-voice-action="${escapeHtml(c._voiceAction)}"` : "";
  const voiceRouteAttr = c._voiceRoute ? ` data-voice-route="${escapeHtml(c._voiceRoute)}"` : "";
  const voiceModeAttr = c._voiceMode ? ` data-voice-mode="${escapeHtml(c._voiceMode)}"` : "";
  const voiceRagAttr = c._voiceRag ? ` data-voice-rag="${escapeHtml(c._voiceRag)}"` : "";
  const voiceIdAttr = c._voiceId ? ` data-voice-id="${escapeHtml(c._voiceId)}"` : "";
  const knowledgeScopeAttr = c._knowledgeScope ? ` data-knowledge-scope="${escapeHtml(c._knowledgeScope)}"` : "";
  const knowledgePanelAttr = c._knowledgePanel ? ` data-knowledge-panel="${escapeHtml(c._knowledgePanel)}"` : "";
  const sectionAttr = c._sectionId ? ` data-section-id="${escapeHtml(c._sectionId)}"` : "";
  const makeTargetAttr = c._makeTarget ? ` data-make-target="${escapeHtml(c._makeTarget)}"` : "";
  const makeCmdAttr = c._makeCmd ? ` data-make-cmd="${escapeHtml(c._makeCmd)}"` : "";
  const deskActionAttr = c._deskAction ? ` data-desk-action="${escapeHtml(c._deskAction)}"` : "";
  const itemHue = sidebarCardHue(c);
  const macTileTypes = new Set(["mac-app", "mac-app-nav", "mac-app-open", "accessory-desk", "accessory-desk-action"]);
  const macWeaveRow = macTileTypes.has(c.type);
  const glyphHtml = macWeaveRow && (c.symbol || c.type === "mac-app" || c.type === "accessory-desk")
    ? `<span class="sidebar-glyph-wrap sidebar-glyph-wrap--mac-tile">${macAppTileHtml(c)}</span>`
    : `<span class="sidebar-glyph-wrap sidebar-glyph-wrap--tile">${hubIcon(c)}</span>`;
  if (c.type === "voice-health") {
    const healthClass = c._healthPending ? "is-pending" : c._healthOk ? "is-ok" : "is-bad";
    const extras = window.VoiceRailInfo?.leafExtrasHtml?.(c) || {};
    return `
    <li class="sidebar-item sidebar-item--voice-health sidebar-item--voice-ctl ${healthClass}" data-id="${c.id}" data-voice-type="voice-health">
      <div class="sidebar-item-main sidebar-item-main--health sidebar-item-main--voice" data-comet-tip="${cometTipAttr(tip)}">
        ${extras.led || ""}
        ${glyphHtml}
        <span class="sidebar-label-stack">
          ${labelHtml}
          ${extras.status || `<span class="voice-rail-status" data-voice-status-id="${escapeHtml(c.id)}" data-default-subtitle="${escapeHtml(c.subtitle || "")}">${escapeHtml(c.subtitle || "")}</span>`}
        </span>
      </div>
      ${extras.info || ""}
    </li>`;
  }
  if (c.type === "knowledge-health") {
    const healthClass = c._healthPending ? "is-pending" : c._healthOk ? "is-ok" : "is-bad";
    const extras = window.KnowledgeRailInfo?.leafExtrasHtml?.(c) || {};
    return `
    <li class="sidebar-item sidebar-item--voice-health sidebar-item--voice-ctl ${healthClass}" data-id="${c.id}" data-knowledge-type="knowledge-health">
      <div class="sidebar-item-main sidebar-item-main--health sidebar-item-main--voice" data-comet-tip="${cometTipAttr(tip)}">
        ${extras.led || ""}
        ${glyphHtml}
        <span class="sidebar-label-stack">
          ${labelHtml}
          ${extras.status || `<span class="voice-rail-status" data-knowledge-status-id="${escapeHtml(c.id)}" data-default-subtitle="${escapeHtml(c.subtitle || "")}">${escapeHtml(c.subtitle || "")}</span>`}
        </span>
      </div>
      ${extras.info || ""}
    </li>`;
  }
  if (c.type === "help-article" || c.type === "help-link" || c.type === "help-nav") {
    const helpSectionAttr = c._helpSectionId ? ` data-help-section-id="${escapeHtml(c._helpSectionId)}"` : "";
    const helpArticleAttr = c._helpArticleId ? ` data-help-article-id="${escapeHtml(c._helpArticleId)}"` : "";
    const helpNavAttr = c._helpNav ? ` data-help-nav="${escapeHtml(c._helpNav)}"` : "";
    const helpLoadAttr = c._helpLoadId ? ` data-help-load-id="${escapeHtml(c._helpLoadId)}"` : "";
    const helpMakeAttr = c._helpLink?.make ? ` data-help-make="${escapeHtml(c._helpLink.make)}"` : "";
    const helpUrlAttr = c._helpLink?.url ? ` data-help-url="${escapeHtml(c._helpLink.url)}"` : "";
    return `
    <li class="sidebar-item sidebar-item--help${c._child ? " sidebar-item--child" : ""}"${childStyle} data-id="${c.id}" data-hue="${itemHue}">
      <button class="sidebar-item-main sidebar-item-main--help pockit-quick-bar-source" draggable="true" data-action="help-control" data-id="${c.id}" data-help-type="${escapeHtml(c.type)}"${helpSectionAttr}${helpArticleAttr}${helpNavAttr}${helpLoadAttr}${helpMakeAttr}${helpUrlAttr} aria-label="${escapeHtml(c.title)}" data-comet-tip="${cometTipAttr(tip)}">
        ${glyphHtml}
        <span class="sidebar-label-stack">
          ${labelHtml}
          ${c.subtitle ? `<span class="voice-rail-status">${escapeHtml(c.subtitle)}</span>` : ""}
        </span>
      </button>
    </li>`;
  }
  const voiceCtlTypes = new Set(["voice-action", "voice-route", "voice-mode", "voice-rag", "voice-voice", "make-run", "make-copy"]);
  const knowledgeCtlTypes = new Set(["knowledge-scope", "knowledge-panel"]);
  if (voiceCtlTypes.has(c.type)) {
    const extras = window.VoiceRailInfo?.leafExtrasHtml?.(c) || {};
    return `
    <li class="sidebar-item sidebar-item--voice-ctl${c._child ? " sidebar-item--child" : ""}${c.type === "mac-app" ? " sidebar-item--mac-app" : ""}"${childStyle} data-id="${c.id}" data-hue="${itemHue}" data-voice-type="${escapeHtml(c.type)}">
      <button class="sidebar-item-main sidebar-item-main--voice pockit-quick-bar-source" draggable="true" data-action="${action}" data-id="${c.id}"${playerAttr}${groupAttr}${macAttr}${navAttr}${doorAttr}${encPanelAttr}${encPathAttr}${encSpeakersAttr}${encDoorAttr}${encCassetteAttr}${voiceActionAttr}${voiceRouteAttr}${voiceModeAttr}${voiceRagAttr}${voiceIdAttr}${sectionAttr}${makeTargetAttr}${makeCmdAttr}${deskActionAttr} aria-label="${escapeHtml(c.title)}" data-comet-tip="${cometTipAttr(tip)}">
        ${extras.led || ""}
        ${glyphHtml}
        <span class="sidebar-label-stack">
          ${labelHtml}
          ${extras.status || `<span class="voice-rail-status" data-voice-status-id="${escapeHtml(c.id)}" data-default-subtitle="${escapeHtml(c.subtitle || "")}">${escapeHtml(c.subtitle || "")}</span>`}
        </span>
      </button>
      ${extras.info || ""}
      ${homeHtml}
      ${newtabHtml}
    </li>`;
  }
  if (knowledgeCtlTypes.has(c.type)) {
    const extras = window.KnowledgeRailInfo?.leafExtrasHtml?.(c) || {};
    return `
    <li class="sidebar-item sidebar-item--voice-ctl${c._child ? " sidebar-item--child" : ""}"${childStyle} data-id="${c.id}" data-hue="${itemHue}" data-knowledge-type="${escapeHtml(c.type)}">
      <button class="sidebar-item-main sidebar-item-main--voice pockit-quick-bar-source" draggable="true" data-action="${action}" data-id="${c.id}"${playerAttr}${groupAttr}${macAttr}${navAttr}${doorAttr}${encPanelAttr}${encSpeakersAttr}${encDoorAttr}${knowledgeScopeAttr}${knowledgePanelAttr}${sectionAttr}${makeTargetAttr}${makeCmdAttr}${deskActionAttr} aria-label="${escapeHtml(c.title)}" data-comet-tip="${cometTipAttr(tip)}">
        ${extras.led || ""}
        ${glyphHtml}
        <span class="sidebar-label-stack">
          ${labelHtml}
          ${extras.status || `<span class="voice-rail-status" data-knowledge-status-id="${escapeHtml(c.id)}" data-default-subtitle="${escapeHtml(c.subtitle || "")}">${escapeHtml(c.subtitle || "")}</span>`}
        </span>
      </button>
      ${extras.info || ""}
      ${homeHtml}
      ${newtabHtml}
    </li>`;
  }
  return `
    <li class="sidebar-item${c._child ? " sidebar-item--child" : ""}${c.type === "mac-app" ? " sidebar-item--mac-app" : ""}"${childStyle} data-id="${c.id}" data-hue="${itemHue}">
      <button class="sidebar-item-main pockit-quick-bar-source" draggable="true" data-action="${action}" data-id="${c.id}"${playerAttr}${groupAttr}${macAttr}${navAttr}${doorAttr}${encPanelAttr}${encPathAttr}${encSpeakersAttr}${encDoorAttr}${encCassetteAttr}${voiceActionAttr}${voiceRouteAttr}${voiceModeAttr}${voiceRagAttr}${voiceIdAttr}${sectionAttr}${makeTargetAttr}${makeCmdAttr}${deskActionAttr} aria-label="${escapeHtml(c.title)}" data-comet-tip="${cometTipAttr(tip)}">
        ${glyphHtml}
        ${labelHtml}
      </button>
      ${homeHtml}
      ${newtabHtml}
    </li>`;
}

function renderSidebarParentWithChildren(parent) {
  const expanded = allTapesSubmenuExpanded();
  const children = (parent.children || []).map((c) => ({ ...c, _child: true }));
  const parentHue = sidebarCardHue(parent);
  return `
    <li class="sidebar-item sidebar-item--parent${expanded ? " expanded" : " collapsed"}" data-id="${parent.id}" data-hue="${parentHue}">
      <div class="sidebar-parent-row">
        <button type="button" class="sidebar-chevron-btn" data-action="toggle-all-tapes" aria-expanded="${expanded}" aria-label="Toggle tape list">${antIcon("DownOutlined")}</button>
        <button type="button" class="sidebar-item-main sidebar-item-main--parent" data-action="${parent.type === "player-group" ? "filter-player" : "load"}" data-id="${parent.id}"${parent._playerId ? ` data-player-id="${escapeHtml(parent._playerId)}"` : ""} aria-label="${escapeHtml(parent.title)}">
          <span class="sidebar-glyph-wrap sidebar-glyph-wrap--tile">${hubIcon(parent)}</span>
          <span class="sidebar-label">${escapeHtml(parent.title)}<span class="sidebar-count">${children.length}</span></span>
        </button>
      </div>
      <ul class="sidebar-submenu comet-menu-cascader comet-collapse${expanded ? " is-open" : ""}">
        ${children.map((c, i) => renderSidebarLeaf({ ...c, _child: true, _childIndex: i })).join("")}
      </ul>
    </li>`;
}


function isFamilyDoorHref(href) {
  if (!href) return false;
  try {
    const u = new URL(href, window.location.origin);
    const h = u.hostname.toLowerCase();
    if (h.endsWith(".localhost") || h === "localhost") return true;
    if (h === "jailynmarvin.com" || h.endsWith(".jailynmarvin.com")) return true;
  } catch {
    return false;
  }
  return false;
}

function needsFamilyDoorTicket(href) {
  if (!isFamilyDoorHref(href)) return false;
  try {
    return new URL(href, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Door origin for a catalogue card — drives /family-embed/<stem> proxy (Search, Gitea, …). */
function tapeDoorOriginForCard(card) {
  if (!card) return null;
  const href = tapePlaybackSrc(card) || card.url || card._play_shell;
  if (!href) return null;
  try {
    const u = new URL(href, window.location.origin);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

/** Gateway /family-embed/ only works for tape-endpoints local_routes — not tape-server doors. */
function familyEmbedProxyStem(stem) {
  const s = String(stem || "").trim().replace(/\.localhost$/i, "");
  if (!s) return false;
  const stems = POCKIT_CATALOG?.family_embed_stems;
  if (Array.isArray(stems) && stems.length && stems.includes(s)) return true;
  // Plan 0268 — every Mac .app door_slug uses same-origin embed (one fix, all apps).
  const macApps = POCKIT_CATALOG?.mac_apps;
  if (Array.isArray(macApps) && macApps.some((a) => a.door_slug === s || a.id === s)) {
    return true;
  }
  return s === "cassette-factory";
}

/** Same-origin embed proxy — parent Pockit session cookie rides in iframe (Clinic 0044 / Factory SSO). */
function hubSameOriginEmbedUrl(href) {
  if (!href || (!isTape() && !isApexFamilyHubHost())) return null;
  if (!needsFamilyDoorTicket(href)) return null;
  try {
    const u = new URL(href, window.location.origin);
    if (u.origin === window.location.origin) return null;
    const stem = u.hostname.replace(/\.localhost$/i, "");
    if (!stem || stem === "localhost") return null;
    if (!familyEmbedProxyStem(stem)) return null;
    const path = u.pathname || "/";
    return `${window.location.origin}/family-embed/${stem}${path}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

async function familyAuthenticatedHref(href) {
  const absolute = new URL(href, window.location.origin).toString();
  if (!needsFamilyDoorTicket(absolute)) return absolute;
  try {
    const r = await fetch(
      `/api/v1/auth/door-ticket?target=${encodeURIComponent(absolute)}`,
      tapeFetchInit({ credentials: "include", cache: "no-store" }),
    );
    const j = await r.json();
    if (j.ok && j.redeem_url) return j.redeem_url;
  } catch {
    /* fall through */
  }
  return absolute;
}

function bindSpaDeepLinks() {
  if (document.documentElement.dataset.spaDeepLinksBound === "1") return;
  document.documentElement.dataset.spaDeepLinksBound = "1";
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = String(a.getAttribute("href") || "").trim();
    if (!href) return;
    let cassetteId = null;
    const hashMatch = href.match(/^#\/c\/([\w-]+)$/);
    if (hashMatch) cassetteId = hashMatch[1];
    const pathMatch = href.match(/^\/c\/([\w-]+)\/?(?:[?#].*)?$/);
    if (!cassetteId && pathMatch) cassetteId = pathMatch[1];
    if (!cassetteId || typeof setCassette !== "function") return;
    e.preventDefault();
    setCassette(cassetteId);
  });
}

function initFamilyDoorLinks() {
  document.addEventListener(
    "click",
    async (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || !needsFamilyDoorTicket(href)) return;
      const newTab = a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey;
      if (!newTab && !a.classList.contains("overview-newtab") && !a.classList.contains("overview-door-link") && !a.classList.contains("family-door-link") && a.id !== "main-newtab") return;
      e.preventDefault();
      e.stopPropagation();
      const url = await familyAuthenticatedHref(href);
      if (newTab || a.target === "_blank") window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
    },
    true,
  );
}

function embedCanvasEl(content) {
  if (!content) return null;
  const direct = content.querySelector(".pockit-center-canvas--embed");
  if (direct) return direct;
  const wrapped = content.firstElementChild;
  if (wrapped?.classList?.contains("pockit-center-canvas--embed")) return wrapped;
  return null;
}

function embedLoadingHtml() {
  return `<div class="iframe-holder"><p class="loading" style="padding:48px;text-align:center">Opening cassette…</p></div>`;
}

function ensureEmbedCanvas(content, cassette) {
  const existing = embedCanvasEl(content);
  if (existing) return existing;
  mountCenterCanvas(embedLoadingHtml(), cassette || { id: "overview" }, { embed: true });
  return embedCanvasEl(content);
}

function wireIframeLoadProbe(iframe) {
  if (!iframe || iframe.dataset.loadProbeBound === "1") return;
  iframe.dataset.loadProbeBound = "1";
  let loaded = false;
  iframe.addEventListener("load", () => {
    loaded = true;
  });
  setTimeout(() => {
    if (!loaded) showIframeFallback();
  }, 6000);
}

function iframeFallbackHtml(canonical) {
  const canonicalUrl = String(canonical || "").replace(/:8782/g, "");
  return `
      <div class="iframe-holder" style="height:100%; min-height:420px; display:flex; flex-direction:column;">
        <iframe class="tape-frame" data-tape-frame="1" id="cassette-iframe" src="__SRC__" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="strict-origin" style="flex:1; border:0; width:100%; min-height:420px;"></iframe>
        <div class="iframe-fallback hidden" id="iframe-fallback" style="padding:24px; text-align:center;">
          <h2 style="margin-top:0;">Best viewed directly (by design)</h2>
          <p style="max-width:520px;margin:12px auto;opacity:0.85;">Full family surfaces (Hello chat, custom Open WebUI, complex dashboards) intentionally limit embeds for security, your session, and correct layout. Use the player for quick access and open direct for the real experience.</p>
          <a class="primary family-door-link" href="${escapeHtml(canonicalUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:10px;background:var(--accent);color:white;text-decoration:none;">Open ${escapeHtml(canonicalUrl.replace(/https?:\/\//, ""))} ↗ (recommended)</a>
          <div style="margin-top:12px;font-size:12px;opacity:0.6;">Or use the clean door in a new tab: <code style="background:var(--bg-2);padding:1px 4px;">http://&lt;name&gt;.localhost/</code></div>
        </div>
      </div>
    `;
}

function mountIframeHolderInCanvas(canvas, src, { canonical } = {}) {
  if (!canvas || !src) return null;
  const playbackKey = stablePlaybackKey(src);
  const existing = canvas.querySelector("iframe[data-tape-frame='1']");
  if (canvas.dataset.mountPlaybackKey === playbackKey && existing) {
    const cur = existing.getAttribute("src") || "";
    if (cur !== src && stablePlaybackKey(cur) === playbackKey) {
      wireIframeLoadProbe(existing);
      return existing;
    }
    if (cur !== src) existing.setAttribute("src", src);
    wireIframeLoadProbe(existing);
    return existing;
  }
  canvas.dataset.mountPlaybackKey = playbackKey;
  const holderHtml = iframeFallbackHtml(canonical || src).replace("__SRC__", escapeHtml(src));
  canvas.innerHTML = holderHtml;
  const iframe = canvas.querySelector("iframe[data-tape-frame='1']");
  wireIframeLoadProbe(iframe);
  return iframe;
}

function absolutePlaybackUrl(playback) {
  return new URL(playback, window.location.origin).toString();
}

function resolveCrossDoorIframeSrc(playback) {
  const absolute = resolveFamilyDoorUrl(absolutePlaybackUrl(playback));
  const embedSrc = hubSameOriginEmbedUrl(absolute);
  if (embedSrc) return { src: embedSrc, async: false, absolute };
  if (needsFamilyDoorTicket(absolute)) return { src: null, async: true, absolute };
  return { src: absolute, async: false, absolute };
}

async function mountFamilyCassetteIframe(playback, routeId, cassette) {
  const content = document.getElementById("main-content");
  if (!content) return;
  const generation = ++mountFamilyIframeGeneration;
  const mountRouteId = routeId || pendingIframeMountRouteId;
  if (mountRouteId) pendingIframeMountRouteId = mountRouteId;
  const canvas = ensureEmbedCanvas(content, cassette || findCassette(routeId) || { id: routeId || "overview" });
  if (window.PockitViewport?.isMobileShell?.()) {
    window.PockitPhoneShell?.syncMobileCanvasHeight?.();
  } else {
    content.style.minHeight = "420px";
  }
  if (!canvas.querySelector("iframe[data-tape-frame='1']")) {
    canvas.innerHTML = embedLoadingHtml();
  }

  let resolvedPlayback = playback;
  if (isLocalTapeDoorHost()) {
    try {
      const u = new URL(playback, window.location.origin);
      const isHelloDoor =
        u.pathname === "/hello" ||
        u.pathname === "/hello/" ||
        u.pathname.startsWith("/play/hello-cassette");
      if (isHelloDoor && u.origin !== window.location.origin) {
        resolvedPlayback = localHelloPlaybackUrl() || withCassetteEmbedParams("/hello");
      }
    } catch {
      /* keep playback */
    }
  }
  const absolute = resolveFamilyDoorUrl(new URL(resolvedPlayback, window.location.origin).toString());
  try {
    const embedSrc = hubSameOriginEmbedUrl(absolute);
    const src = embedSrc
      ? embedSrc
      : needsFamilyDoorTicket(absolute)
        ? await familyAuthenticatedHref(absolute)
        : absolute;

    if (generation !== mountFamilyIframeGeneration) return;

    mountIframeHolderInCanvas(canvas, src, { canonical: absolute });
  } finally {
    if (generation === mountFamilyIframeGeneration) {
      if (mountRouteId && pendingIframeMountRouteId === mountRouteId) {
        pendingIframeMountRouteId = null;
      }
      if (mountRouteId && setCassetteInFlight === mountRouteId) {
        lastSettledRouteId = mountRouteId;
        persistPockitLastRoute(mountRouteId);
        releaseSetCassetteInFlight(mountRouteId);
      }
    }
  }
}


function ctOrigin() {
  if (window.NEPHEW_CT_ORIGIN) return window.NEPHEW_CT_ORIGIN.replace(/\/$/, "");
  const h = window.location.hostname;
  if (h.endsWith(".localhost") || h === "localhost") return "http://nephew.localhost:8780";
  return "https://nephew.jailynmarvin.com";
}

function catalogMetaForCard(card) {
  if (!card || !POCKIT_CATALOG?.players) return null;
  const hubId = card.id;
  for (const p of POCKIT_CATALOG.players) {
    for (const c of p.hosted_cassettes || []) {
      if (c.hub_card_id === hubId || c.id === hubId) return c;
    }
  }
  return (
    (POCKIT_CATALOG.unassigned_cassettes || []).find(
      (c) => c.hub_card_id === hubId || c.id === hubId,
    ) || null
  );
}

function cardDescription(card) {
  const tape = libraryTapeByCardId(card.id);
  const cat = catalogMetaForCard(card);
  const ent = frameworkEntityForCard(card);
  return card.subtitle || cat?.niche || tape?.niche || ent?.niche || "";
}

function cardDetailLine(card) {
  const tape = libraryTapeByCardId(card.id);
  const cat = catalogMetaForCard(card);
  const niche = cat?.niche || tape?.niche;
  const subtitle = card.subtitle || "";
  if (niche && niche !== subtitle) return niche;
  if (cat?.boot_command) return `Boot: ${cat.boot_command}`;
  return "";
}


function catalogueIdForHubCard(hubCardId) {
  if (!POCKIT_CATALOG) return hubCardId;
  const all = [];
  for (const p of POCKIT_CATALOG.players || []) all.push(...(p.hosted_cassettes || []));
  all.push(...(POCKIT_CATALOG.unassigned_cassettes || []));
  const hit = all.find((c) => c.hub_card_id === hubCardId || c.id === hubCardId);
  return hit?.id || hubCardId;
}

function hubCardById(id) {
  return findInHubCards(id);
}
window.hubCardById = hubCardById;

/** Overview shows the full Pockit catalog; player pill filters by console, not nephew-tape playable_in. */
function pockitTapeHostedIds() {
  return null;
}

function catalogHubIdsForPlayer(playerId) {
  if (!POCKIT_CATALOG) return new Set();
  if (!playerId) return null;
  if (playerId === "_unassigned") {
    return new Set((POCKIT_CATALOG.unassigned_cassettes || []).map((c) => c.hub_card_id || c.id));
  }
  const player = POCKIT_CATALOG.players.find((p) => p.id === playerId);
  if (!player) return new Set();
  const ids = new Set();
  for (const c of player.hosted_cassettes || []) {
    if (c.hub_card_id) ids.add(c.hub_card_id);
    if (c.id) ids.add(c.id);
    const alias = HUB_CARD_SUBSTRATE_ALIASES[c.hub_card_id || c.id];
    if (alias) ids.add(alias);
  }
  return ids;
}

function cardMatchesPlayer(card) {
  if (!POCKIT_PLAYER || !POCKIT_CATALOG) return true;
  const ids = catalogHubIdsForPlayer(POCKIT_PLAYER);
  if (!ids) return true;
  if (ids.has(card.id)) return true;
  for (const id of hubCardLookupIds(card.id)) {
    if (ids.has(id)) return true;
  }
  return false;
}

function catalogPlayerVisibleCount(player, hosted) {
  return (player.hosted_cassettes || []).filter((c) => {
    const hubId = c.hub_card_id || c.id;
    if (hosted?.size && !hosted.has(hubId)) return false;
    const card = hubCardById(hubId) || catalogEntryToHubCard(c);
    if (!card) return false;
    if (!cardMatchesScope(card, POCKIT_SCOPE)) return false;
    if (POCKIT_FILTER.trim() && !cardMatchesFilter(card, POCKIT_FILTER.trim())) return false;
    return true;
  }).length;
}

function pockitPlayerOptions() {
  if (!POCKIT_CATALOG?.players) {
    return [{ value: "", label: "All players", icon: "AppstoreOutlined" }];
  }
  const hosted = pockitTapeHostedIds();
  const opts = [{ value: "", label: "All", icon: "AppstoreOutlined" }];
  for (const p of POCKIT_CATALOG.players.filter(catalogConsoleProjectable)) {
    const count = catalogPlayerVisibleCount(p, hosted);
    opts.push({
      value: p.id,
      label: count ? `${p.name || p.id} (${count})` : `${p.name || p.id}`,
      icon: "ClusterOutlined",
    });
  }
  const unassigned = POCKIT_CATALOG.unassigned_cassettes || [];
  if (unassigned.length) {
    const unCount = unassigned.filter((c) => {
      const hubId = c.hub_card_id || c.id;
      if (hosted?.size && !hosted.has(hubId)) return false;
      const card = hubCardById(hubId);
      if (!card) return false;
      if (!cardMatchesScope(card, POCKIT_SCOPE)) return false;
      if (POCKIT_FILTER.trim() && !cardMatchesFilter(card, POCKIT_FILTER.trim())) return false;
      return true;
    }).length;
    if (unCount || POCKIT_PLAYER === "_unassigned") {
      opts.push({ value: "_unassigned", label: unCount ? `Other (${unCount})` : "Other", icon: "InboxOutlined" });
    }
  }
  return opts;
}

function cassetteToOverviewItem(c) {
  const card = hubCardById(c.hub_card_id || c.id) || catalogEntryToHubCard(c);
  if (!card) return null;
  return { card, substrateId: c.id };
}

function renderOverviewCard(c, cardIndex, substrateId) {
  const delay = cardIndex * 28;
  const intentBadge =
    typeof window.PockitIntentionBadge !== "undefined"
      ? window.PockitIntentionBadge.badgeHtmlForHubCard(c)
      : "";
  if (isTape()) {
    const tape = libraryTapeByCardId(c.id);
    const away = tape?.web_url || c.url;
    const tip = dashboardDetailTip(c);
    return `
          <article class="overview-card overview-card--app comet-enter" role="button" tabindex="0" data-action="load" data-id="${c.id}" data-comet-tip="${cometTipAttr(tip)}" style="--comet-delay:${delay}ms">
            ${intentBadge}
            <button type="button" class="overview-app-more" data-action="cassette-settings" data-substrate-id="${escapeHtml(substrateId || c.id)}" data-comet-tip="${cometTipAttr(`${c.title}\nCartridge settings and operator fields`)}" aria-label="Settings" onclick="event.stopPropagation()">${antIcon("SettingOutlined")}</button>
            ${away ? `<a class="overview-app-ext" href="${away}" target="_blank" rel="noopener noreferrer" data-comet-tip="${cometTipAttr(pockitTip("overviewWeb") || "Open on web\nLaunch the public or LAN door")}" aria-label="Open on web" onclick="event.stopPropagation()">${antIcon("ExportOutlined")}</a>` : ""}
            <span class="overview-app-icon">${hubIcon(c)}</span>
            <span class="overview-app-label">${escapeHtml(dashboardShortLabel(c.title))}</span>
          </article>`;
  }
  const tape = libraryTapeByCardId(c.id);
  const home = tape?.family_url;
  const away = tape?.web_url || c.url;
  const desc = cardDescription(c);
  const detail = cardDetailLine(c);
  const doorBadge = home
    ? `<span class="overview-door overview-door--local">Local door</span>`
    : away
      ? `<span class="overview-door overview-door--web">Web</span>`
      : "";
  const tip = dashboardDetailTip(c);
  return `
          <article class="overview-card comet-enter" role="button" tabindex="0" data-action="load" data-id="${c.id}" data-comet-tip="${cometTipAttr(tip)}" style="--comet-delay:${delay}ms">
            ${intentBadge}
            <span class="overview-card-accent" aria-hidden="true"></span>
            <div class="overview-card-header">
              <span class="overview-glyph-wrap">${hubIcon(c)}</span>
              <div class="overview-card-titles">
                <span class="overview-title">${escapeHtml(c.title)}</span>
                ${c.pill ? `<span class="overview-pill">${escapeHtml(c.pill)}</span>` : ""}
              </div>
              ${away ? `<a class="overview-newtab" href="${away}" target="_blank" rel="noopener noreferrer" data-comet-tip="${cometTipAttr(pockitTip("overviewWeb") || "Open on web\nLaunch the public or LAN door")}" aria-label="Open on web" onclick="event.stopPropagation()">↗</a>` : ""}
            </div>
            ${desc ? `<div class="overview-subtitle">${escapeHtml(desc)}</div>` : ""}
            ${detail ? `<p class="overview-detail">${escapeHtml(detail)}</p>` : ""}
            <div class="overview-card-footer">
              ${doorBadge}
              ${home ? `<span class="overview-host">${escapeHtml(tape.family_host || "localhost")}:${escapeHtml(String(tape.family_port || ""))}</span>` : ""}
              ${home ? `<a class="overview-door-link" href="${escapeHtml(home)}" target="_blank" rel="noopener noreferrer" data-comet-tip="${cometTipAttr(pockitTip("overviewDoor") || "Open tape door\nStandalone door URL in a new tab")}" aria-label="Open tape door in new tab" onclick="event.stopPropagation()">↗</a>` : ""}
              <button type="button" class="overview-settings ant-btn-icon-only" data-action="cassette-settings" data-substrate-id="${escapeHtml(substrateId || c.id)}" data-comet-tip="${cometTipAttr(pockitTip("overviewSettings") || "Cartridge settings\nDoor URL, substrate, and operator fields")}" aria-label="Cartridge settings" onclick="event.stopPropagation()">${antIcon("SettingOutlined")}</button>
            </div>
          </article>`;
}

function renderOverviewPlayerSection(player, items, startIndex) {
  const playerId = player.id || "_unassigned";
  const dashHead = isTape()
    ? `<header class="overview-section-head overview-section-head--dash">
        <span class="overview-player-glyph overview-player-glyph--tile">${hubIcon(player)}</span>
        <h2>${escapeHtml(player.name)}</h2>
        <span class="overview-section-count">${items.length}</span>
      </header>
      ${player.niche ? `<p class="overview-player-niche overview-player-niche--dash">${escapeHtml(player.niche)}</p>` : ""}`
    : "";
  if (isTape()) {
    return `
    <section class="overview-section overview-section--player overview-section--apps" data-player="${escapeHtml(playerId)}">
      ${dashHead}
      <div class="overview-grid overview-grid--apps">
        ${items.map(({ card, substrateId }, i) => renderOverviewCard(card, startIndex + i, substrateId)).join("")}
      </div>
    </section>`;
  }
  return `
    <section class="overview-section overview-section--player comet-section-enter" data-player="${escapeHtml(playerId)}" style="--comet-delay:${Math.min(startIndex * 36, 280)}ms">
      <header class="overview-section-head">
        <span class="overview-player-glyph" aria-hidden="true">${hubIcon(player)}</span>
        <h2>${escapeHtml(player.name)}</h2>
        <span class="role-chip role-chip--player">player</span>
        <span class="overview-section-count">${items.length}</span>
      </header>
      ${player.niche ? `<p class="overview-player-niche">${escapeHtml(player.niche)}</p>` : ""}
      <div class="overview-grid">
        ${items.map(({ card, substrateId }, i) => renderOverviewCard(card, startIndex + i, substrateId)).join("")}
      </div>
    </section>`;
}

function renderOverviewByPlayers(hosted, filterQ) {
  let visibleTotal = 0;
  let cardIndex = 0;
  const sections = [];
  const players = POCKIT_CATALOG.players.filter((p) => !POCKIT_PLAYER || POCKIT_PLAYER === p.id);
  for (const player of players) {
    let items = (player.hosted_cassettes || [])
      .map((c) => cassetteToOverviewItem(c))
      .filter(Boolean);
    if (hosted?.size) items = items.filter((x) => hosted.has(x.card.id));
    if (filterQ) items = items.filter((x) => cardMatchesFilter(x.card, filterQ));
    items = items.filter((x) => cardMatchesScope(x.card, POCKIT_SCOPE));
    if (!items.length) continue;
    visibleTotal += items.length;
    sections.push(renderOverviewPlayerSection(player, items, cardIndex));
    cardIndex += items.length;
  }
  if (!POCKIT_PLAYER || POCKIT_PLAYER === "_unassigned") {
    let items = (POCKIT_CATALOG.unassigned_cassettes || [])
      .map((c) => cassetteToOverviewItem(c))
      .filter(Boolean);
    if (hosted?.size) items = items.filter((x) => hosted.has(x.card.id));
    if (filterQ) items = items.filter((x) => cardMatchesFilter(x.card, filterQ));
    items = items.filter((x) => cardMatchesScope(x.card, POCKIT_SCOPE));
    if (items.length) {
      visibleTotal += items.length;
      sections.push(
        renderOverviewPlayerSection({ id: "_unassigned", name: "Other cartridges", glyph: "📦", niche: null }, items, cardIndex),
      );
      cardIndex += items.length;
    }
  }
  return { html: sections.join(""), visibleTotal, playerSections: sections.length };
}

function renderOverviewByHubSections(hosted, filterQ) {
  let visibleTotal = 0;
  let cardIndex = 0;
  const sections = CARDS.filter((s) => s.section !== "Home").map((sec) => {
    const slug = sectionSlug(sec.section);
    if (LAUNCHPAD_SECTION && slug !== LAUNCHPAD_SECTION) return "";
    let items = hosted?.size ? sec.items.filter((c) => hosted.has(c.id)) : sec.items;
    if (filterQ) items = items.filter((c) => cardMatchesFilter(c, filterQ));
    items = items.filter((c) => cardMatchesScope(c, POCKIT_SCOPE));
    items = items.filter((c) => cardMatchesPlayer(c));
    if (!items.length) return "";
    visibleTotal += items.length;
    const block = isTape()
      ? `
    <section class="overview-section overview-section--apps" data-section="${escapeHtml(slug)}">
      <div class="overview-grid overview-grid--apps">
        ${items.map((c, i) => renderOverviewCard(c, cardIndex + i, catalogueIdForHubCard(c.id))).join("")}
      </div>
    </section>`
      : `
    <section class="overview-section" data-section="${escapeHtml(slug)}">
      <header class="overview-section-head">
        <h2>${escapeHtml(sec.section)}</h2>
        <span class="overview-section-count">${items.length}</span>
      </header>
      <div class="overview-grid">
        ${items.map((c, i) => renderOverviewCard(c, cardIndex + i, catalogueIdForHubCard(c.id))).join("")}
      </div>
    </section>`;
    cardIndex += items.length;
    return block;
  }).filter(Boolean).join("");
  return { html: sections, visibleTotal, playerSections: 0 };
}

function cardMatchesFilter(card, query) {
  if (!query) return true;
  const tape = libraryTapeByCardId(card.id);
  const cat = catalogMetaForCard(card);
  const hay = [
    card.title,
    card.subtitle,
    card.pill,
    card.id,
    tape?.niche,
    tape?.name,
    cat?.niche,
    cat?.name,
    cat?.overview?.search_aliases?.join?.(" "),
    frameworkEntityForCard(card)?.niche,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tokens = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => hay.includes(t));
}


// ─── Comet menu UX (GL KVM segment + dropdown) ───────────────────

function pockitScopeOptions() {
  return [
    { value: "all", label: "All", icon: "AppstoreOutlined" },
    { value: "local", label: "Local", icon: "HddOutlined" },
    { value: "web", label: "Web", icon: "GlobalOutlined" },
  ];
}

function pockitSectionOptions() {
  const hosted = null;
  const opts = [{ value: "", label: "All sections", icon: "LayoutOutlined" }];
  for (const sec of CARDS.filter((s) => s.section !== "Home")) {
    const items = hosted?.size ? sec.items.filter((c) => hosted.has(c.id)) : sec.items;
    if (!items.length) continue;
    opts.push({ value: sectionSlug(sec.section), label: sec.section, icon: "FolderOutlined" });
  }
  return opts;
}

function renderCometSegment({ id, name, value, options, compact = false, scrollable = false, extraClass = "" }) {
  return `
  <div class="comet-segment${compact ? " comet-segment--compact" : ""}${scrollable ? " comet-segment--players" : ""}${extraClass ? ` ${extraClass}` : ""}" id="${id}" role="radiogroup" aria-label="${escapeHtml(name)}">
    <div class="comet-segment-pill" aria-hidden="true"></div>
    ${options
      .map(
        (o) => `
      <button type="button" class="comet-segment-btn${o.value === value ? " is-active" : ""}" role="radio" aria-checked="${o.value === value ? "true" : "false"}" data-value="${escapeHtml(o.value)}" data-comet-tip="${cometTipAttr(`${o.label}\nFilter the catalog by ${o.label.toLowerCase()}`)}" aria-label="${escapeHtml(o.label)}">
        <span class="comet-segment-glyph" aria-hidden="true">${optIcon(o)}</span>
        <span class="comet-segment-label">${escapeHtml(o.label)}</span>
      </button>`,
      )
      .join("")}
  </div>`;
}

function updateCometSegmentPill(segmentEl) {
  if (!segmentEl) return;
  const pill = segmentEl.querySelector(".comet-segment-pill");
  const active =
    segmentEl.querySelector('.comet-segment-btn[aria-checked="true"]') ||
    segmentEl.querySelector(".comet-segment-btn.is-active");
  if (!pill || !active) return;
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.height = `${active.offsetHeight}px`;
  pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
}

function bindCometSegment(segmentEl, onChange) {
  if (!segmentEl || segmentEl.dataset.bound === "1") return;
  segmentEl.dataset.bound = "1";
  const activate = (btn) => {
    segmentEl.querySelectorAll(".comet-segment-btn").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    requestAnimationFrame(() => updateCometSegmentPill(segmentEl));
    onChange?.(btn.dataset.value);
  };
  segmentEl.querySelectorAll(".comet-segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => activate(btn));
  });
  requestAnimationFrame(() => updateCometSegmentPill(segmentEl));
}

function renderCometDropdown({ id, value, options, triggerClass = "", fullBleed = false, finderCaption = "" }) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  const fallback = { value: value || "", label: "—", icon: "AppstoreOutlined" };
  const selectable = list.filter((o) => !o.isHeader);
  const current =
    selectable.find((o) => o.value === value)
    || selectable[0]
    || list[0]
    || fallback;
  const caption = finderCaption || current.label || fallback.label;
  const triggerInner = fullBleed && finderCaption
    ? `<span class="rail-header-stack">
        <span class="comet-dropdown-trigger-glyph" aria-hidden="true">${optIcon(current)}</span>
        <span class="comet-dropdown-trigger-caption">${escapeHtml(caption)}</span>
      </span>
      <span class="comet-dropdown-chevron" aria-hidden="true">${antIcon("DownOutlined")}</span>`
    : `<span class="comet-dropdown-trigger-glyph" aria-hidden="true">${optIcon(current)}</span>
      <span class="comet-dropdown-trigger-label">${escapeHtml(current.label || fallback.label)}</span>
      <span class="comet-dropdown-chevron" aria-hidden="true">${antIcon("DownOutlined")}</span>`;
  const menuOptions = list.length ? list : [fallback];
  return `
  <div class="comet-dropdown${fullBleed ? " comet-dropdown--rail-fullbleed" : ""}${finderCaption ? " comet-dropdown--finder" : ""}" id="${id}" data-value="${escapeHtml(value)}">
    <button type="button" class="comet-dropdown-trigger${triggerClass ? ` ${triggerClass}` : ""}${finderCaption ? " comet-dropdown-trigger--finder" : ""}" aria-haspopup="listbox" aria-expanded="false">
      ${triggerInner}
    </button>
    <div class="comet-dropdown-panel comet-menu-cascader" role="listbox" hidden>
      ${menuOptions
        .map((o) => {
          if (o.isHeader) {
            return `<div class="comet-menu-section" aria-hidden="true">${escapeHtml(o.label)}</div>`;
          }
          return `
        <button type="button" class="comet-menu-item${o.value === value ? " is-selected" : ""}" role="option" data-value="${escapeHtml(o.value)}" aria-selected="${o.value === value ? "true" : "false"}">
          <span class="comet-menu-item-glyph" aria-hidden="true">${optIcon(o)}</span>
          <span class="comet-menu-item-label">${escapeHtml(o.label)}</span>
          <span class="comet-menu-item-check" aria-hidden="true">${o.value === value ? "✓" : ""}</span>
        </button>`;
        })
        .join("")}
    </div>
  </div>`;
}

function closeCometDropdowns(except) {
  document.querySelectorAll(".comet-dropdown.is-open").forEach((dd) => {
    if (except && dd === except) return;
    dd.classList.remove("is-open");
    const panel = dd.querySelector(".comet-dropdown-panel");
    const trigger = dd.querySelector(".comet-dropdown-trigger");
    if (panel) {
      panel.hidden = true;
      clearRailDropdownPanelPosition(panel);
    }
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function syncRailDropdownPanelPosition(dd) {
  const trigger = dd.querySelector(".comet-dropdown-trigger");
  const panel = dd.querySelector(".comet-dropdown-panel");
  if (!trigger || !panel || panel.hidden) return;
  if (!dd.closest(".player-rail, .cassette-rail")) return;
  const rect = trigger.getBoundingClientRect();
  panel.classList.add("comet-dropdown-panel--rail-float");
  panel.style.top = `${Math.round(rect.bottom + 6)}px`;
  panel.style.left = `${Math.round(rect.left)}px`;
  panel.style.minWidth = `${Math.max(Math.round(rect.width), 252)}px`;
  panel.style.maxWidth = `${Math.min(320, window.innerWidth - 16)}px`;
}

function clearRailDropdownPanelPosition(panel) {
  if (!panel) return;
  panel.classList.remove("comet-dropdown-panel--rail-float");
  panel.style.top = "";
  panel.style.left = "";
  panel.style.minWidth = "";
  panel.style.maxWidth = "";
}

function bindCometDropdowns(root = document, handlers = {}) {
  root.querySelectorAll(".comet-dropdown").forEach((dd) => {
    if (dd.dataset.bound === "1") return;
    dd.dataset.bound = "1";
    const trigger = dd.querySelector(".comet-dropdown-trigger");
    const panel = dd.querySelector(".comet-dropdown-panel");
    if (!trigger || !panel) return;

    const selectItem = (item) => {
      const value = item.dataset.value;
      dd.dataset.value = value;
      panel.querySelectorAll(".comet-menu-item").forEach((el) => {
        const on = el === item;
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
        const check = el.querySelector(".comet-menu-item-check");
        if (check) check.textContent = on ? "✓" : "";
      });
      const label = item.querySelector(".comet-menu-item-label")?.textContent || "";
      const tg = trigger.querySelector(".comet-dropdown-trigger-glyph");
      const tl = trigger.querySelector(".comet-dropdown-trigger-label");
      if (tg) tg.innerHTML = item.querySelector(".comet-menu-item-glyph")?.innerHTML || "";
      if (tl) tl.textContent = label;
      closeCometDropdowns();
      const handler = handlers[dd.id];
      if (handler) handler(value, item);
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains("is-open");
      closeCometDropdowns(open ? dd : null);
      dd.classList.toggle("is-open", open);
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        panel.classList.remove("comet-dropdown-panel--animate");
        void panel.offsetWidth;
        panel.classList.add("comet-dropdown-panel--animate");
        syncRailDropdownPanelPosition(dd);
      }
    });

    panel.querySelectorAll(".comet-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        selectItem(item);
      });
    });
  });

  if (!document.documentElement.dataset.cometDropdownDocBound) {
    document.documentElement.dataset.cometDropdownDocBound = "1";
    document.addEventListener("click", () => closeCometDropdowns());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCometDropdowns();
    });
    window.addEventListener(
      "resize",
      () => {
        document.querySelectorAll(".comet-segment").forEach((el) => updateCometSegmentPill(el));
      },
      { passive: true },
    );
  }
}

function cardMatchesScope(card, scope) {
  if (!scope || scope === "all") return true;
  const tape = libraryTapeByCardId(card.id);
  const cat = catalogMetaForCard(card);
  if (scope === "local") return Boolean(tape?.family_url || cat?.family_url);
  if (scope === "web") return Boolean(card.url || tape?.web_url || cat?.web_url);
  return true;
}

function catalogEntryMatchesScope(entry, scope) {
  if (!scope || scope === "all") return true;
  if (scope === "local") return Boolean(entry.family_url);
  if (scope === "web") return Boolean(entry.web_url);
  return true;
}

function pockitFilterBar(placeholder = "Search cassettes…", { showPlayer = true } = {}) {
  if (isTape()) showPlayer = false;
  const playerSeg = showPlayer && POCKIT_CATALOG?.players
    ? renderCometSegment({
        id: "pockit-player-segment",
        name: "Filter by player",
        value: POCKIT_PLAYER,
        options: pockitPlayerOptions(),
        compact: true,
        scrollable: true,
      })
    : "";
  return `<div class="pockit-nav">
    <div class="pockit-search-row comet-menu-panel">
      <span class="pockit-filter-icon" aria-hidden="true">${antIcon("SearchOutlined")}</span>
      <input type="search" id="pockit-filter" class="pockit-filter" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(POCKIT_FILTER)}" autocomplete="off" spellcheck="false" />
      ${POCKIT_FILTER ? `<button type="button" class="pockit-filter-clear" id="pockit-filter-clear" aria-label="Clear search">×</button>` : ""}
    </div>
    <div class="pockit-toolbar pockit-toolbar--filters">
      ${playerSeg}
      ${renderCometSegment({ id: "pockit-scope-segment", name: "Filter by door type", value: POCKIT_SCOPE, options: pockitScopeOptions(), compact: true })}
      <button type="button" class="comet-btn comet-btn--ghost pockit-config-btn" data-action="open-pockit-config" data-comet-tip="${cometTipAttr(pockitTip("pockitConfig") || "Pockit config\nAuto-hide chrome, footer, and layout prefs")}">${antIcon("SettingOutlined")}<span>Pockit Config</span></button>
      ${pockitWifiDropdownHtml()}
    </div>
  </div>`;
}

function bindPockitWifiDropdown() {
  const dd = document.getElementById("pockit-wifi-dropdown");
  if (!dd || dd.dataset.bound === "1") return;
  dd.dataset.bound = "1";
  const trigger = dd.querySelector(".comet-dropdown-trigger");
  const panel = dd.querySelector(".comet-dropdown-panel");
  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !dd.classList.contains("is-open");
    closeCometDropdowns(open ? dd : null);
    dd.classList.toggle("is-open", open);
    if (panel) {
      panel.hidden = !open;
      if (open) {
        panel.classList.remove("comet-dropdown-panel--animate");
        void panel.offsetWidth;
        panel.classList.add("comet-dropdown-panel--animate");
      }
    }
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function bindPockitFilter() {
  bindPockitWifiDropdown();
  const input = document.getElementById("pockit-filter");
  if (input && !input.dataset.bound) {
    input.dataset.bound = "1";
    input.addEventListener("input", () => {
      POCKIT_FILTER = input.value.trim();
      rerenderPockitView();
    });
  }
  const clearBtn = document.getElementById("pockit-filter-clear");
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = "1";
    clearBtn.addEventListener("click", () => {
      POCKIT_FILTER = "";
      rerenderPockitView();
    });
  }
  bindCometSegment(document.getElementById("pockit-player-segment"), (value) => {
    if (value) openPlayerHome(value);
    else {
      clearPockitPlayerFilter();
      rerenderPockitView();
    }
  });
  bindCometSegment(document.getElementById("pockit-scope-segment"), (value) => {
    POCKIT_SCOPE = value;
    localStorage.setItem("nephew-pockit-scope", value);
    rerenderPockitView();
  });
  document.querySelectorAll("[data-action=clear-pockit-filters]").forEach((btn) => {
    if (btn.dataset.clearFiltersBound === "1") return;
    btn.dataset.clearFiltersBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      clearAllPockitFilters();
    });
  });
}

function rerenderPockitView() {
  const id = currentCassetteId();
  const c = findCassette(id);
  if (!c) return;
  const content = document.getElementById("main-content");
  if (c.type === "overview") {
    const sectionsHost = content.querySelector(".pockit-sections");
    if (sectionsHost) {
      const hosted = pockitTapeHostedIds();
      const filterQ = POCKIT_FILTER.trim();
      let sectionsHtml = "";
      let visibleTotal = 0;
      let stats = overviewStats(hosted, filterQ);
      if (POCKIT_CATALOG?.players) {
        const byPlayer = renderOverviewByPlayers(hosted, filterQ);
        sectionsHtml = byPlayer.html;
        visibleTotal = byPlayer.visibleTotal;
      } else {
        const byHub = renderOverviewByHubSections(hosted, filterQ);
        sectionsHtml = byHub.html;
        visibleTotal = byHub.visibleTotal;
      }
      sectionsHost.innerHTML = sectionsHtml;
      let emptyEl = content.querySelector(".pockit-empty-filter");
      const emptyHtml =
        (filterQ || POCKIT_PLAYER) && !visibleTotal
          ? `No cartridges match${filterQ ? ` “${filterQ}”` : ""}${POCKIT_PLAYER ? " for this console" : ""}.`
          : "";
      if (emptyHtml) {
        if (emptyEl) emptyEl.textContent = emptyHtml;
        else {
          emptyEl = document.createElement("p");
          emptyEl.className = "pockit-empty-filter";
          emptyEl.textContent = emptyHtml;
          sectionsHost.parentElement.insertBefore(emptyEl, sectionsHost);
        }
      } else if (emptyEl) {
        emptyEl.remove();
      }
      renderCassetteRail();
      refreshMainShellFooter(c, { visibleTotal, filterQ, stats });
    } else {
      content.innerHTML = renderOverview();
      window.PockitIntentionBadge?.attachDelegates?.(content);
      bindPockitFilter();
      renderCassetteRail();
      refreshMainShellFooter(c);
    }
  } else if (c.type === "library") {
    content.innerHTML = renderLibrary();
    bindLibraryActions();
    bindPockitFilter();
    refreshMainShellFooter(c);
  } else if (c.type === "smoke-checklist") {
    content.innerHTML = renderSmokeChecklist();
    bindSmokeChecklistActions();
    refreshMainShellFooter(c);
  }
}

async function fetchSsoBootstrap() {
  try {
    const r = await fetch("/api/v1/auth/sso/bootstrap", tapeFetchInit({ credentials: "include" }));
    if (!r.ok) return { apps: [] };
    const body = await r.json();
    return { apps: Array.isArray(body.apps) ? body.apps : [] };
  } catch {
    return { apps: [] };
  }
}

function warmFamilySsoSessions(apps) {
  if (!apps?.length || typeof document === "undefined") return;
  const origin = window.location.origin;
  for (const app of apps) {
    const warm = String(app.warm_url || "").trim();
    if (!warm) continue;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", `SSO warm ${app.label || app.app_id || "app"}`);
    iframe.style.cssText =
      "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none";
    iframe.src = warm.startsWith("/") ? `${origin}${warm}` : warm;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 90_000);
  }
}

async function ensureFamilySsoWarm() {
  if (familySsoWarmed) return;
  familySsoWarmed = true;
  const { apps } = await fetchSsoBootstrap();
  warmFamilySsoSessions(apps);
}

function tapeOpenPath(card) {
  if (card?._open_path) return card._open_path;
  const ent = frameworkEntityForCard(card);
  const raw = ent?.tape?.open_path || null;
  if (!raw || raw === "/") return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Same-origin CT embed paths need /ct prefix on tape doors (proxyCt on tape-server). */
function normalizeCtEmbedPath(path) {
  if (!path || !isTape()) return path;
  const p = String(path).split("?")[0];
  if (p.startsWith("/ct/")) return path;
  if (p.startsWith("/local/") || p.startsWith("/play/") || p.startsWith("/hello")) return path;
  if (
    p.startsWith("/web-cassette/") ||
    p.startsWith("/external-cassette/") ||
    p.startsWith("/dockyard") ||
    p.startsWith("/player-overview") ||
    p.startsWith("/ct-pockit-wire")
  ) {
    const qs = path.includes("?") ? path.slice(path.indexOf("?")) : "";
    const base = p.startsWith("/") ? p : `/${p}`;
    return `/ct${base}${qs}`;
  }
  return path;
}

/** Plan 0163 — native hello in Hub/Player iframe. */
function helloNativeCtPlaybackUrl(card) {
  if (isHelloHubCard(card)) {
    const local = localHelloPlaybackUrl();
    if (local) return local;
  }
  const ent = frameworkEntityForCard(card);
  if (ent?.tape?.ct_ui !== "native") return null;
  if (isTape()) {
    const open = tapeOpenPath(card);
    if (open) {
      const pathOnly = open.split("?")[0].replace(/\/$/, "") || "/hello";
      return withCassetteEmbedParams(pathOnly);
    }
  }
  return withCassetteEmbedParams(`${ctOrigin()}/hello`);
}

function isNativeCtDeckEmbed(cassette) {
  if (!cassette || cassette.type === "overview" || cassette.type === "library") return false;
  if (isVoiceHubCard(cassette) || isKnowledgeHubCard(cassette) || isPromptLibraryHubCard(cassette) || isFamilyDeskHubCard(cassette) || isShipIntegrityHubCard(cassette) || isConfigurationsHubCard(cassette) || isAccessoryDeskHubCard(cassette) || isQuickDeskHubCard(cassette) || cassette.type === "voice" || cassette.type === "knowledge" || cassette.type === "prompt-library" || cassette.type === "family-desk" || cassette.type === "ship-integrity" || cassette.type === "configurations" || cassette.type === "accessory-desk" || cassette.type === "quick-desk") {
    return false;
  }
  if (isTape() && tapeOpenPath(cassette)) return true;
  if (isHelloHubCard(cassette) && (isTape() || isLocalTapeDoorHost())) return true;
  const ent = frameworkEntityForCard(cassette);
  if (ent?.tape?.ct_ui === "native" && isHelloHubCard(cassette)) return true;
  // Plan 0196 — same-origin CT playback: Pockit owns chrome; center is canvas-only.
  if ((isTape() || isLocalTapeDoorHost()) && isTapeBodyCassette(cassette)) {
    const pb = tapePlaybackSrc(cassette);
    if (pb) {
      try {
        const u = new URL(pb, window.location.origin);
        if (u.origin === window.location.origin) return true;
      } catch {
        /* fall through */
      }
    }
  }
  return false;
}

/** Plan 0165 H.3 — external URL cassettes get Pockit nav on the right (home + tape). */
function isExternalHubCassette(cassette) {
  if (!cassette) return false;
  if (cassette.type === "overview" || cassette.type === "library") return false;
  if (isNativeCtDeckEmbed(cassette)) return false;
  if (cassette.url && !tapeOpenPath(cassette) && !cassette._play_shell) return true;
  const playback = tapePlaybackSrc(cassette);
  if (!playback) return false;
  try {
    const target = new URL(playback, window.location.origin);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function usesNativeCenterCanvas(cassette) {
  if (!cassette) return false;
  return isVoiceHubCard(cassette) || isKnowledgeHubCard(cassette) || isPromptLibraryHubCard(cassette) || isFamilyDeskHubCard(cassette) || isShipIntegrityHubCard(cassette) || isConfigurationsHubCard(cassette) || isAccessoryDeskHubCard(cassette) || isQuickDeskHubCard(cassette) || isOdysseusHubCard(cassette)
    || isEncompassNativePad(cassette)
    || cassette.type === "voice" || cassette.type === "knowledge" || cassette.type === "prompt-library" || cassette.type === "family-desk" || cassette.type === "ship-integrity" || cassette.type === "configurations" || cassette.type === "accessory-desk" || cassette.type === "quick-desk" || cassette.type === "odysseus";
}

function tapePlaybackSrc(card) {
  if (usesNativeCenterCanvas(card)) return null;
  if (isHelloHubCard(card)) {
    const localHello = localHelloPlaybackUrl();
    if (localHello) return localHello;
    const native = helloNativeCtPlaybackUrl(card);
    if (native) return native;
  }
  const openFromCard = card?._open_path || tapeOpenPath(card);
  if (openFromCard && isTape()) {
    const pathOnly = openFromCard.split("?")[0].replace(/\/$/, "") || openFromCard;
    const qs = openFromCard.includes("?") ? openFromCard.split("?").slice(1).join("?") : "";
    const normalized = normalizeCtEmbedPath(`${pathOnly}${qs ? `?${qs}` : ""}`);
    if (!isPockitShellUrl(normalized) && (!normalized.startsWith("/local/") || !card?._play_shell)) {
      return withCassetteEmbedParams(normalized);
    }
  }
  if (card?._play_shell && isTape() && !isPockitShellUrl(card._play_shell)) {
    return withCassetteEmbedParams(card._play_shell);
  }
  if (card?.url && !isPockitShellUrl(card.url)) {
    return withCassetteEmbedParams(card.url);
  }
  return null;
}

function isTapeBodyCassette(cassette) {
  if (!cassette) return false;
  if (cassette.type === "overview" || cassette.type === "library") return false;
  return Boolean(
    cassette._play_shell ||
      tapeOpenPath(cassette) ||
      cassette.url,
  );
}

function setTapeBodyMode(cassette) {
  const content = document.getElementById("main-content");
  document.body.classList.remove(
    "tape-body-mode",
    "tape-only-mode",
    "deck-embed-mode",
    "sidebar-right-rail",
  );
  if (isTapeOnlyMode()) {
    document.body.classList.add("tape-only-mode");
    content?.classList.remove("center-mode-embed");
    return;
  }
  if (isTape() || isApexFamilyHubHost()) {
    document.body.classList.add("hub-dashboard", "dual-rail-mode", "tape-body-mode");
  }
  const nativeSurface = isNativePockitHubSurface(cassette);
  const embedCenter =
    !nativeSurface && isNativeCtDeckEmbed(cassette) && isTapeBodyCassette(cassette);
  content?.classList.toggle("center-mode-embed", Boolean(embedCenter));
  document.body.classList.toggle("pockit-voice-active", isVoiceNativeCassette(cassette));
  document.body.classList.toggle("pockit-knowledge-active", isKnowledgeNativeCassette(cassette));
  document.body.classList.toggle("pockit-help-active", isHelpNativeCassette(cassette));
}

function tapeFetchInit(extra = {}) {
  const headers = { ...(extra.headers || {}) };
  if (isTape()) headers["X-Nephew-Tape"] = "1";
  return { ...extra, headers };
}

// ─── Cassette state ────────────────────────────────────────────────

function findCassette(id) {
  if (isTape()) rebuildTapeSidebarIndex();
  const lookupIds = id ? [...hubCardLookupIds(id), id] : [id];
  const seen = new Set();
  for (const lid of lookupIds) {
    if (!lid || seen.has(lid)) continue;
    seen.add(lid);
    if (isTape() && TAPE_SIDEBAR_ITEMS.has(lid)) {
      const cat = findCatalogEntryByHubId(lid);
      const item = resolveNativeVoiceSidebarItem(TAPE_SIDEBAR_ITEMS.get(lid), cat);
      return ensureTapePlaybackFields(item, cat);
    }
  }
  for (const sec of CARDS) {
    for (const c of sec.items) {
      if (!lookupIds.includes(c.id)) continue;
      const cat = findCatalogEntryByHubId(c.id);
      if (isTape() && cat) {
        const item = resolveNativeVoiceSidebarItem(catalogEntryToSidebarItem(cat), cat);
        if (item) return ensureTapePlaybackFields(item, cat);
      }
      return ensureTapePlaybackFields(resolveNativeVoiceSidebarItem(c, cat), cat);
    }
  }
  if (isTape()) {
    for (const lid of lookupIds) {
      if (!lid) continue;
      const cat = findCatalogEntryByHubId(lid);
      if (cat) {
        const item = resolveNativeVoiceSidebarItem(catalogEntryToSidebarItem(cat), cat);
        if (item) {
          TAPE_SIDEBAR_ITEMS.set(item.id, item);
          return ensureTapePlaybackFields(item, cat);
        }
      }
    }
  }
  if (id === "overview" && isTape()) {
    return {
      id: "overview",
      title: "Apps",
      glyph: "📼",
      subtitle: `${POCKIT_CATALOG?.cassette_count || TAPE_SIDEBAR_ITEMS.size} cassettes`,
      type: "overview",
    };
  }
  if (id === "library") {
    return { id: "library", title: "Library", glyph: "📚", subtitle: "Consoles + tapes", type: "library" };
  }
  if (id === "smoke-checklist") {
    return {
      id: "smoke-checklist",
      title: "Smoke checklist",
      glyph: "✓",
      subtitle: "Console + cartridge QA",
      type: "smoke-checklist",
    };
  }
  if (isVoiceCassetteId(id)) {
    return voicePadMenuItem();
  }
  if (id === "knowledge" || id === "knowledge-cassette") {
    return knowledgePadMenuItem();
  }
  if (id === "prompt-library" || id === "prompt-library-cassette") {
    return promptLibraryMenuItem();
  }
  if (id === "family-desk" || id === "family-desk-cassette") {
    return familyDeskMenuItem();
  }
  if (id === "ship-integrity" || id === "ship-integrity-cassette") {
    return shipIntegrityMenuItem();
  }
  if (id === "suite-welcome") {
    return {
      id: "suite-welcome",
      title: "Welcome",
      glyph: "Po",
      subtitle: "Family Office setup",
      type: "suite-welcome",
    };
  }
  for (const lid of lookupIds) {
    if (!lid) continue;
    const cat = findCatalogEntryByHubId(lid);
    if (!cat) continue;
    const item = catalogEntryToSidebarItem(cat);
    if (item) return ensureTapePlaybackFields(item, cat);
  }
  return null;
}

function allCassettes() {
  return CARDS.flatMap((s) => s.items);
}

function getReturnUrl() {
  try {
    const u = new URL(window.location.href);
    const r = u.searchParams.get("return");
    if (!r) return null;
    const p = new URL(r);
    if (p.hostname.endsWith(".jailynmarvin.com") || p.hostname === "jailynmarvin.com") return p.toString();
    return null;
  } catch { return null; }
}

function capturePockitPendingDeepLink() {
  try {
    const id = resolveDeepLinkCassetteIdFromLocation({ includeSession: false });
    if (id && id !== "overview") {
      sessionStorage.setItem(POCKIT_PENDING_DEEP_LINK_KEY, id);
    }
  } catch {
    /* private mode */
  }
}

function clearPockitPendingDeepLink() {
  try {
    sessionStorage.removeItem(POCKIT_PENDING_DEEP_LINK_KEY);
  } catch {
    /* ignore */
  }
}

function resolveDeepLinkCassetteIdFromLocation({ includeSession = true } = {}) {
  const hash = window.location.hash || "";
  if (hash === "#/library") return "library";
  if (hash === "#/checklist") return "smoke-checklist";
  if (hash === "#/welcome") return "suite-welcome";
  const settings = hash.match(/^#\/settings\/([\w-]+)$/);
  if (settings) return `settings:${settings[1]}`;
  const cassette = hash.match(/^#\/c\/([\w-]+)$/);
  if (cassette) return canonicalHashCassetteId(cassette[1]);

  // Explicit home hash wins over stale /c/<id> pathname or session pending (Clinic flicker loop).
  if (hashIndicatesPockitHome(hash)) return null;

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const pathCassette = path.match(/^\/c\/([\w-]+)$/);
  if (pathCassette) return canonicalHashCassetteId(pathCassette[1]);

  try {
    const params = new URLSearchParams(window.location.search || "");
    const queryCassette = params.get("c") || params.get("cassette");
    if (queryCassette && /^[\w-]+$/.test(queryCassette) && !isEmbedOnlyQueryValue(queryCassette)) {
      return canonicalHashCassetteId(queryCassette);
    }
  } catch {
    /* ignore */
  }

  if (includeSession) {
    try {
      const pending = sessionStorage.getItem(POCKIT_PENDING_DEEP_LINK_KEY);
      if (pending && /^[\w-]+$/.test(pending) && !isEmbedOnlyQueryValue(pending)) {
        return canonicalHashCassetteId(pending);
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function currentCassetteId() {
  const deep = resolveDeepLinkCassetteIdFromLocation();
  if (deep) return deep;
  const boot = document.documentElement.getAttribute("data-boot-cassette");
  if (boot && findCassette(boot)) return boot;
  return "overview";
}

/** Plan 0220 — operator agent door URL when view is under a console with a door. */
const AGENT_DOOR_OPERATOR_URLS = {
  wordpress: "http://wordpress-agent.localhost/",
};

function agentDoorConsoleId() {
  const id = currentCassetteId();
  if (id === "overview" || id.startsWith("settings:") || id === "wordpress-agent") return null;
  if (id === "wordpress") return "wordpress";
  const cat = findCatalogEntryByHubId(id);
  if (cat?.parent_console === "wordpress") return "wordpress";
  const cassette = findCassette(id);
  if (cassette?.parent_console === "wordpress") return "wordpress";
  return null;
}

function shellAgentDoorLinkHtml() {
  const consoleId = agentDoorConsoleId();
  const url = consoleId && AGENT_DOOR_OPERATOR_URLS[consoleId];
  if (!url) return "";
  return `<a class="shell-version-btn shell-agent-door-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-comet-tip="${cometTipAttr(`${consoleId} agent door\nCopy context for AI agents on this console`)}">
    <span class="shell-version-btn__dot" aria-hidden="true"></span>
    <span>Agent door</span>
  </a>`;
}

let SETTINGS_RETURN_ID = "overview";

async function openCassetteSettings(substrateId) {
  if (substrateId === window.PockitConfig?.POCKIT_SETTINGS_ID) {
    return openPockitConfigSettings();
  }
  SETTINGS_RETURN_ID = currentCassetteId().startsWith("settings:") ? "overview" : currentCassetteId();
  lastMainFrameKey = `settings:${substrateId}\0settings`;
  const newHash = `#/settings/${substrateId}`;
  if (window.location.hash !== newHash) history.pushState({ id: `settings:${substrateId}` }, "", newHash);
  const content = document.getElementById("main-content");
  const breadcrumb = document.getElementById("main-breadcrumb");
  const newtabBtn = document.getElementById("main-newtab");
  beginMainViewSwap();
  if (newtabBtn) {
    newtabBtn.classList.add("hidden");
    window.PockitShellLayout?.setWidgetHidden?.("new-tab", true);
  }
  content.innerHTML = `<div class="loading" style="padding:48px;text-align:center">Loading cassette settings…</div>`;
  try {
    const { sub, html, bind } = await window.CassetteSubstrateUi.mountSettingsPage(substrateId, tapeFetchInit(), {
      onBack: () => setCassette(SETTINGS_RETURN_ID),
      onOpenRoute: (_path, cassetteSub) => {
        const hubId = cassetteSub.hub_card_id;
        if (hubId && findCassette(hubId)) setCassette(hubId);
      },
    });
    content.innerHTML = html;
    if (breadcrumb) breadcrumb.textContent = `${sub.name} · Settings`;
    refreshTowerStatusRail({ id: "settings", title: `${sub.name} settings`, glyph: sub.glyph });
    const root = content.querySelector(".cassette-settings-page");
    if (root) bind(root);
    finishMainFrameRender({ id: "settings", type: "settings", title: `${sub.name} settings`, glyph: sub.glyph });
  } catch (err) {
    content.innerHTML = `<p class="pockit-empty-filter">Could not load settings: ${escapeHtml(err.message || err)}</p>`;
    finishMainFrameRender({ id: "settings", type: "settings", title: "Cartridge settings" });
  }
}

function openPockitConfigSettings() {
  if (!window.PockitConfig?.mountSettingsPage) {
    const content = document.getElementById("main-content");
    if (content) {
      content.innerHTML = `<p class="pockit-empty-filter">Pockit Config did not load — hard refresh the page.</p>`;
    }
    return;
  }
  SETTINGS_RETURN_ID = currentCassetteId().startsWith("settings:") ? "overview" : currentCassetteId();
  lastMainFrameKey = "settings:pockit\0settings";
  const content = document.getElementById("main-content");
  const breadcrumb = document.getElementById("main-breadcrumb");
  const newtabBtn = document.getElementById("main-newtab");
  beginMainViewSwap();
  if (newtabBtn) {
    newtabBtn.classList.add("hidden");
    window.PockitShellLayout?.setWidgetHidden?.("new-tab", true);
  }
  const { html, bind } = window.PockitConfig.mountSettingsPage({
    onBack: () => setCassette(SETTINGS_RETURN_ID),
    onApplied: (cfg) => {
      if (cfg.filter?.default_scope) {
        POCKIT_SCOPE = cfg.filter.default_scope;
        localStorage.setItem("nephew-pockit-scope", POCKIT_SCOPE);
      }
      if (cfg.theme?.mode && typeof applyTheme === "function") applyTheme(cfg.theme.mode);
    },
  });
  content.innerHTML = html;
  if (breadcrumb) breadcrumb.textContent = "Pockit · Config";
  refreshTowerStatusRail({ id: "settings:pockit", title: "Pockit Config", glyph: "⚙" });
  const root = content.querySelector(".pockit-config-page");
  if (root) bind(root);
  finishMainFrameRender({ id: "settings:pockit", type: "settings", title: "Pockit Config", glyph: "⚙" });
}

function cassetteHashFor(id) {
  if (id === "overview") return "#/";
  if (id === "suite-welcome") return "#/welcome";
  if (id === "library") return "#/library";
  if (id === "smoke-checklist") return "#/checklist";
  if (String(id).startsWith("settings:")) {
    return `#/settings/${String(id).slice("settings:".length)}`;
  }
  return `#/c/${canonicalHashCassetteId(id)}`;
}

function stablePlaybackKey(playback) {
  if (!playback) return "";
  try {
    const u = new URL(playback, window.location.origin);
    const path = u.pathname.replace(/\/$/, "") || u.pathname;
    // Hostname distinguishes cross-door iframes that share a path (office vs fop).
    return `${u.hostname}${path}`;
  } catch {
    return String(playback).split("?")[0].split("#")[0];
  }
}

function mainFrameKey(cassette) {
  if (!cassette) return "";
  if (cassette.id === "suite-welcome" || cassette.type === "suite-welcome") {
    return "suite-welcome\0welcome";
  }
  if (String(cassette.id).startsWith("settings:")) {
    return `${cassette.id}\0settings`;
  }
  const routeId = canonicalHashCassetteId(cassette.id);
  if (usesNativeCenterCanvas(cassette)) {
    return `${routeId}\0native-center`;
  }
  const playback = tapePlaybackSrc(cassette);
  return `${routeId}\0${stablePlaybackKey(playback) || stablePlaybackKey(cassette.url) || cassette.type || ""}`;
}

function mainContentFirstChild() {
  return document.getElementById("main-content")?.firstElementChild || null;
}

function mainContentHas(selector) {
  const root = mainContentFirstChild();
  if (!root) return false;
  try {
    if (root.matches?.(selector)) return true;
  } catch {
    /* compound selector */
  }
  return Boolean(root.querySelector?.(selector));
}

function mainContentMatchesCassette(cassette) {
  const root = mainContentFirstChild();
  if (!cassette || !root) return false;
  const id = String(cassette.id || "");
  const routeId = canonicalHashCassetteId(cassette.id);
  if (pendingIframeMountRouteId && pendingIframeMountRouteId === routeId) {
    return mainContentHas(".iframe-holder, .loading, iframe[data-tape-frame='1']");
  }
  if (id.startsWith("settings:")) {
    if (id === "settings:pockit") {
      return root.classList.contains("pockit-config-page") || mainContentHas(".pockit-config-page");
    }
    return (
      (root.classList.contains("cassette-settings-page") && !root.classList.contains("pockit-config-page"))
      || mainContentHas(".cassette-settings-page:not(.pockit-config-page)")
    );
  }
  if (id === "overview") return mainContentHas(".pockit");
  if (id === "library") return mainContentHas(".pockit-library");
  if (id === "smoke-checklist") return mainContentHas(".pockit-smoke-checklist, .pockit-checklist");
  if (id === "suite-welcome") return mainContentHas("#pockit-help-console, .suite-welcome");
  if (usesNativeCenterCanvas(cassette)) {
    if (isVoiceHubCard(cassette) || cassette.type === "voice") {
      return mainContentHas("#voice-pad");
    }
    if (isVideoHubCard(cassette) || cassette.type === "video") {
      return mainContentHas("#video-pad");
    }
    if (isKnowledgeHubCard(cassette) || cassette.type === "knowledge") {
      return mainContentHas("#knowledge-hud");
    }
    if (isOdysseusHubCard(cassette) || cassette.type === "odysseus") {
      return mainContentHas("#odysseus-pad");
    }
    if (isPromptLibraryHubCard(cassette) || cassette.type === "prompt-library") {
      return mainContentHas("#prompt-library");
    }
    if (isFamilyDeskHubCard(cassette) || cassette.type === "family-desk") {
      return mainContentHas("#family-desk");
    }
    if (isShipIntegrityHubCard(cassette) || cassette.type === "ship-integrity") {
      return mainContentHas("#ship-integrity");
    }
    if (isConfigurationsHubCard(cassette) || cassette.type === "configurations") {
      return mainContentHas("#configurations-center");
    }
    if (isAccessoryDeskHubCard(cassette) || cassette.type === "accessory-desk") {
      return mainContentHas("#accessory-desk-panel");
    }
    if (isQuickDeskHubCard(cassette) || cassette.type === "quick-desk") {
      return mainContentHas("#quick-desk-panel");
    }
  }
  if (tapePlaybackSrc(cassette) || cassette._play_shell || (cassette._macAppId && !isAccessoryDeskHubCard(cassette)) || id.startsWith("mac-app-")) {
    const pb = tapePlaybackSrc(cassette) || cassette.url;
    const canvas = mainContentFirstChild();
    if (pb && canvas?.classList?.contains("pockit-center-canvas--embed")) {
      try {
        const resolved = resolveCrossDoorIframeSrc(pb);
        const key = stablePlaybackKey(resolved.src || resolved.absolute || pb);
        if (canvas.dataset.mountPlaybackKey === key && canvas.querySelector("iframe[data-tape-frame='1']")) {
          return true;
        }
      } catch {
        /* fall through */
      }
    }
    return mainContentHas("iframe.tape-frame, iframe[data-tape-frame='1'], .iframe-holder");
  }
  return false;
}

function syncMainNewTabButton(cassette, newtabBtn) {
  if (!newtabBtn) return;
  const speakersDoor = speakersDoorForCard(cassette);
  const playback = tapePlaybackSrc(cassette);
  if (speakersDoor && (usesNativeCenterCanvas(cassette) || cassette._encompass)) {
    newtabBtn.href = speakersDoor;
    newtabBtn.classList.remove("hidden");
    window.PockitShellLayout?.setWidgetHidden?.("new-tab", false);
    familyAuthenticatedHref(new URL(speakersDoor, window.location.origin).toString()).then((u) => {
      if (newtabBtn) newtabBtn.href = u;
    });
    return;
  }
  if (playback) {
    newtabBtn.href = playback;
    newtabBtn.classList.remove("hidden");
    window.PockitShellLayout?.setWidgetHidden?.("new-tab", false);
    familyAuthenticatedHref(new URL(playback, window.location.origin).toString()).then((u) => {
      if (newtabBtn) newtabBtn.href = u;
    });
    return;
  }
  if (cassette.url && !isPockitShellUrl(cassette.url)) {
    newtabBtn.href = cassette.url;
    newtabBtn.classList.remove("hidden");
    window.PockitShellLayout?.setWidgetHidden?.("new-tab", false);
    familyAuthenticatedHref(new URL(cassette.url, window.location.origin).toString()).then((u) => {
      if (newtabBtn) newtabBtn.href = u;
    });
    return;
  }
  newtabBtn.classList.add("hidden");
  window.PockitShellLayout?.setWidgetHidden?.("new-tab", true);
}

function refreshMainChrome(cassette) {
  const breadcrumb = document.getElementById("main-breadcrumb");
  const newtabBtn = document.getElementById("main-newtab");
  const settingsBtn = document.getElementById("cassette-settings-header");
  if (breadcrumb) breadcrumb.innerHTML = renderTowerBreadcrumb(cassette);
  syncHubBackButton(cassette);
  refreshTowerStatusRail(cassette);
  refreshMainShellFooter(cassette);
  syncTapesUiChrome();
  const substrateId = catalogueIdForHubCard(cassette.id);
  if (settingsBtn) {
    const onOverview = cassette.type === "overview" || cassette.id === "overview";
    const showSettings =
      onOverview ||
      (cassette.type !== "library" && cassette.id !== "changelog");
    settingsBtn.classList.toggle("hidden", !showSettings);
    window.PockitShellLayout?.setWidgetHidden?.("cassette-settings", !showSettings);
    if (showSettings) {
      settingsBtn.setAttribute(
        "data-substrate-id",
        onOverview ? (window.PockitConfig?.POCKIT_SETTINGS_ID || "pockit") : substrateId,
      );
    } else {
      settingsBtn.removeAttribute("data-substrate-id");
    }
  }
  syncMainNewTabButton(cassette, newtabBtn);
}

function setCassette(id, { pushHistory = true, force = false } = {}) {
  if (String(id).startsWith("settings:")) {
    const substrateId = String(id).slice("settings:".length);
    const newHash = `#/settings/${substrateId}`;
    if (pushHistory && window.location.hash !== newHash) {
      window.location.hash = newHash;
      return;
    }
    openCassetteSettings(substrateId);
    return;
  }
  const resolved = findCassette(id);
  const requestedRouteId = canonicalHashCassetteId(id);
  if (
    !resolved &&
    id &&
    id !== "overview" &&
    id !== "library" &&
    !String(id).startsWith("settings:") &&
    (POCKIT_CATALOG_PHASE === "core" || POCKIT_CATALOG_PHASE === "hydrating")
  ) {
    queuePockitPendingRoute(requestedRouteId);
    setCassetteInFlight = requestedRouteId;
    syncParentSpaUrl(cassetteHashFor(requestedRouteId));
    renderRouteLoadingCanvas(requestedRouteId);
    highlightActiveSidebarItem(id);
    syncSuiteChrome(requestedRouteId);
    releaseSetCassetteInFlight(requestedRouteId);
    return;
  }
  const c = resolved || findCassette("overview");
  const routeId = resolved ? requestedRouteId : "overview";
  if (!resolved && id && id !== "overview" && id !== "library") {
    clearPockitPendingRoute();
  }
  if (setCassetteInFlight === routeId && !force) return;
  if (force && setCassetteInFlight === routeId) setCassetteInFlight = null;
  setCassetteInFlight = routeId;

  const newHash = cassetteHashFor(resolved ? id : c.id);
  syncParentSpaUrl(newHash);

  try {
    if (resolved) clearPockitPendingDeepLink();
    prepareVoicePadContext(c);
    clearVoicePadContextIfNeeded(c);
    prepareKnowledgePadContext(c);
    clearKnowledgePadContextIfNeeded(c);
    prepareHelpConsoleContext(c);
    clearHelpConsoleContextIfNeeded(c);
    if (c.id === "overview" || c.type === "overview") {
      POCKIT_PLAYER = "";
      POCKIT_PLAYER_GROUP = "";
      try { localStorage.removeItem("nephew-pockit-player"); } catch { /* ignore */ }
    }
    syncPockitPlayerForCassette(c);
    const frameKey = mainFrameKey(c);
    setTapeBodyMode(c);
    const mainChild = mainContentFirstChild();
    const mainStillLoading = Boolean(
      mainChild?.classList?.contains("loading")
      || mainChild?.querySelector?.(".loading"),
    );
    const prevRouteCassette = lastSettledRouteId ? findCassette(lastSettledRouteId) : null;
    const playerSurfaceChanged = Boolean(
      prevRouteCassette
      && (isVoiceNativeCassette(prevRouteCassette) !== isVoiceNativeCassette(c)
        || (POCKIT_PLAYER && catalogPlayerForCard(prevRouteCassette) !== catalogPlayerForCard(c))),
    );
    if (
      !force &&
      !playerSurfaceChanged &&
      frameKey === lastMainFrameKey &&
      mainChild &&
      !mainStillLoading &&
      mainContentMatchesCassette(c)
    ) {
      refreshMainChrome(c);
      syncPlayerChromeContext(c);
      highlightActiveSidebarItem(c.id);
      syncPlayerRailNavDropdown();
      syncSuiteChrome(c.id);
      lastSettledRouteId = routeId;
      persistPockitLastRoute(routeId);
      releaseSetCassetteInFlight(routeId);
      return;
    }
    lastMainFrameKey = frameKey;
    void renderMainFrameWithReadiness(c);
    highlightActiveSidebarItem(c.id);
    syncPlayerRailNavDropdown();
    syncSuiteChrome(c.id);
  } catch (err) {
    releaseSetCassetteInFlight(routeId);
    throw err;
  }
}

// ─── Family Office suite bar (Adobe CC–style) ─────────────────────

function quickBarActiveKey() {
  const id = currentCassetteId();
  if (id === "library") return "action:library";
  if (id === "voice" || id === "voice-cassette") return "action:voice";
  if (id === "overview" || id === "suite-welcome" || id === "smoke-checklist") {
    if (POCKIT_PLAYER) return `player:${POCKIT_PLAYER}`;
    return "action:overview";
  }
  if (id && String(id).startsWith("mac-app-")) {
    const macId = POCKIT_MAC_APP || String(id).replace(/^mac-app-/, "");
    return `mac-app:${macId}`;
  }
  if (id) {
    if (catalogPlayerById(id)) return `player:${id}`;
    return `cassette:${id}`;
  }
  if (POCKIT_PLAYER) return `player:${POCKIT_PLAYER}`;
  const bodyActive = document.body.dataset.suiteActive;
  if (bodyActive && bodyActive !== "pockit") return `player:${bodyActive}`;
  return "action:overview";
}

function suiteActiveIdForCassette(id) {
  const suite = window.PockitSuite;
  if (!suite?.SUITE_APPS) return "pockit";
  if (id === "suite-welcome") return "pockit";
  if (isVoiceCassetteId(id)) return "voice";
  const hit = suite.SUITE_APPS.find((a) => a.id === id || a.loadId === id);
  return hit?.id || "pockit";
}

function syncSuiteChrome(cassetteId) {
  const suite = window.PockitSuite;
  const barHost = document.getElementById("suite-bar");
  if (!suite || !barHost) return;
  const nextActive = suiteActiveIdForCassette(cassetteId);
  document.body.classList.add("suite-bar-visible");
  const prevActive = document.body.dataset.suiteActive;
  document.body.dataset.suiteActive = nextActive;
  if (prevActive === nextActive && barHost.querySelector(".suite-bar")) {
    window.PockitQuickBar?.refresh?.();
    renderConsolePickerMounts();
    syncRailChromeLayout();
    window.PockitSurface?.syncUpdateBadge?.();
    window.PockitAuthChrome?.refreshMount?.();
    return;
  }
  suite.mountSuiteBar(barHost);
  renderConsolePickerMounts();
  syncRailChromeLayout();
  window.PockitQuickBar?.refresh?.(document.body.dataset.suiteActive);
  window.PockitSurface?.syncUpdateBadge?.();
  syncPlayerAccent();
  window.PockitAuthChrome?.refreshMount?.();
}

function clearSuiteChrome() {
  document.body.classList.remove("suite-bar-visible");
  delete document.body.dataset.suiteActive;
  syncPlayerAccent();
  const barHost = document.getElementById("suite-bar");
  if (barHost) barHost.innerHTML = "";
}

function initialAuthenticatedCassetteId() {
  let id = currentCassetteId();
  if (id === "suite-welcome") return id;
  if (id !== "overview") return id;
  const hash = window.location.hash || "";
  const onHome = !hash || hash === "#/" || hash === "#/overview";
  if (window.PockitSuite?.shouldShowWelcome?.() && onHome) return "suite-welcome";
  return id;
}

// ─── Auth ─────────────────────────────────────────────────────────

async function fetchMe() {
  try {
    const r = await fetch("/api/v1/auth/me", { credentials: "include", cache: "no-store" });
    if (r.status >= 500 || r.status === 502) {
      return { ok: false, authenticated: false, apiError: true };
    }
    const data = await r.json();
    if (!r.ok) return { ...data, authenticated: false };
    return data;
  } catch {
    return { ok: false, authenticated: false, apiError: true };
  }
}

/** Plan 0254 — local Mac SSH keys → nephew_session without password (tower-api reads ~/.ssh). */
async function tryFamilySshSilentLogin() {
  try {
    const r = await fetch("/api/v1/auth/ssh/login-local", tapeFetchInit({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    if (!r.ok) return false;
    const data = await r.json().catch(() => ({}));
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

async function resolveFamilySession() {
  let me = await fetchMe();
  if (!me.authenticated && !me.apiError) {
    const sshOk = await tryFamilySshSilentLogin();
    if (sshOk) me = await fetchMe();
  }
  return me;
}

async function signIn(email, password) {
  const r = await fetch("/api/v1/auth/sign-in", tapeFetchInit({
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
  return await r.json();
}

async function fetchLoginHint() {
  try {
    const r = await fetch("/api/v1/auth/login-hint", tapeFetchInit({ credentials: "include", cache: "no-store" }));
    if (!r.ok) return { configured: false };
    return await r.json();
  } catch {
    return { configured: false };
  }
}

async function signOut() {
  try { await fetch("/api/v1/auth/sign-out", { method: "POST", credentials: "include" }); } catch {}
  familySsoWarmed = false;
  render();
}

async function fetchVersion() {
  try {
    const r = await fetch("/api/v1/surface-changelog/tower-api/version", {
      credentials: "include",
      cache: "no-store",
    });
    if (r.ok) {
      const j = await r.json();
      if (j.version) return j.version;
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch("/api/v1/version", { credentials: "include", cache: "no-store" });
    const j = await r.json();
    return j.version || "—";
  } catch {
    return "—";
  }
}

// ─── Theme ────────────────────────────────────────────────────────
// Three-state toggle: dark → light → auto → dark.
// "auto" follows the OS via prefers-color-scheme and re-applies on change.

const THEME_OPTIONS_META = {
  dark: { icon: "MoonOutlined" },
  light: { icon: "SunOutlined" },
  auto: { icon: "DesktopOutlined" },
};
const THEME_TITLE = {
  dark: "Theme: dark (click for light)",
  light: "Theme: light (click for follow system)",
  auto: "Theme: follow system (click for dark)",
};

function effectiveTheme(saved) {
  if (saved === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return saved;
}

function syncThemeChrome(saved) {
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.innerHTML = antIcon(THEME_OPTIONS_META[saved]?.icon || "MoonOutlined");
    btn.title = THEME_TITLE[saved] || THEME_TITLE.dark;
  }
  const themeSeg = document.getElementById("theme-segment");
  if (themeSeg) {
    themeSeg.querySelectorAll(".comet-segment-btn").forEach((b) => {
      const on = b.dataset.value === saved;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    requestAnimationFrame(() => updateCometSegmentPill(themeSeg));
  }
}
window.__pockitSyncThemeChrome = syncThemeChrome;

function applyTheme(saved) {
  if (window.PockitAppearance?.applyColorMode) {
    window.PockitAppearance.applyColorMode(saved);
    return;
  }
  document.documentElement.setAttribute("data-theme", effectiveTheme(saved));
  localStorage.setItem("nephew-hub-theme", saved);
  syncThemeChrome(saved);
}

function nextTheme(saved) {
  return saved === "dark" ? "light" : saved === "light" ? "auto" : "dark";
}

function initTheme() {
  if (window.PockitAppearance?.initAppearance) {
    window.PockitAppearance.initAppearance();
    return;
  }
  const saved = localStorage.getItem("nephew-hub-theme") || "light";
  applyTheme(saved);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const cur = localStorage.getItem("nephew-hub-theme") || "light";
    if (cur === "auto") applyTheme("auto");
  };
  if (mq.addEventListener) mq.addEventListener("change", handler);
  else if (mq.addListener) mq.addListener(handler);
}

// ─── Sidebar ─────────────────────────────────────────────────────

let sidebarPillScrollBound = false;
let sidebarPillScrollEndTimer = null;

function scheduleSidebarActivePill() {
  const pill = document.getElementById("sidebar-active-pill");
  if (pill) pill.classList.add("is-scrolling");
  if (sidebarPillScrollEndTimer) clearTimeout(sidebarPillScrollEndTimer);
  requestAnimationFrame(() => updateSidebarActivePill());
  sidebarPillScrollEndTimer = setTimeout(() => {
    pill?.classList.remove("is-scrolling");
  }, 140);
}

function ensureSidebarActivePill() {
  const sc = document.getElementById("sidebar-content");
  if (!sc || document.getElementById("sidebar-active-pill")) return;
  const pill = document.createElement("div");
  pill.id = "sidebar-active-pill";
  pill.className = "sidebar-active-pill";
  pill.setAttribute("aria-hidden", "true");
  sc.prepend(pill);
  if (!sidebarPillScrollBound) {
    sidebarPillScrollBound = true;
    sc.addEventListener("scroll", () => scheduleSidebarActivePill(), { passive: true });
    window.addEventListener("resize", () => scheduleSidebarActivePill(), { passive: true });
  }
}

function sidebarActiveItemTarget(item) {
  if (!item) return null;
  return (
    item.querySelector(":scope > .sidebar-item-main")
    || item.querySelector(":scope > .sidebar-parent-row > .sidebar-item-main")
    || item
  );
}

function updateSidebarActivePill() {
  const pill = document.getElementById("sidebar-active-pill");
  const sc = document.getElementById("sidebar-content");
  if (!pill || !sc) return;
  const active =
    [...sc.querySelectorAll(".sidebar-submenu .sidebar-item.active")].pop()
    || sc.querySelector(".sidebar-item.active:not(.sidebar-item--parent)")
    || sc.querySelector(".sidebar-item.active");
  if (!active || !sc.contains(active)) {
    pill.classList.remove("is-visible");
    return;
  }
  const target = sidebarActiveItemTarget(active);
  const scRect = sc.getBoundingClientRect();
  const itemRect = target.getBoundingClientRect();
  const top = itemRect.top - scRect.top + sc.scrollTop;
  const left = itemRect.left - scRect.left + sc.scrollLeft;
  pill.style.height = `${Math.round(itemRect.height)}px`;
  pill.style.width = `${Math.round(itemRect.width)}px`;
  pill.style.left = `${Math.round(left)}px`;
  pill.style.right = "auto";
  pill.style.transform = `translateY(${Math.round(top)}px)`;
  pill.style.setProperty("--sidebar-pill-hue", String(hueFromSidebarItemEl(active)));
  pill.classList.add("is-visible");
}

function beginMainViewSwap() {
  const content = document.getElementById("main-content");
  if (!content) return;
  content.classList.remove("comet-view-swap");
  void content.offsetWidth;
  content.classList.add("comet-view-swap");
}

function cometModalOpen(overlay) {
  overlay.classList.add("comet-overlay-open");
  const modal = overlay.querySelector(".modal");
  if (modal) modal.classList.add("comet-modal-open");
}

function renderRailSectionHtml(sections, opts = {}) {
  const voiceRail = Boolean(opts.voiceRail);
  const videoRail = Boolean(opts.videoRail);
  const knowledgeRail = Boolean(opts.knowledgeRail);
  const helpRail = Boolean(opts.helpRail);
  const productRail = voiceRail || videoRail || knowledgeRail || helpRail;
  return sections
    .map((sec) => {
      const infoBtn = voiceRail
        ? (window.VoiceRailInfo?.sectionInfoButton?.(sec.section) || "")
        : videoRail
          ? (window.VideoRailInfo?.sectionInfoButton?.(sec.section) || "")
          : knowledgeRail
            ? (window.KnowledgeRailInfo?.sectionInfoButton?.(sec.section) || "")
            : "";
      const sectionHead = productRail
        ? `<div class="sidebar-section-head-row">
            <h3><span class="sidebar-section-dot" aria-hidden="true"></span>${escapeHtml(sec.section)}</h3>
            ${infoBtn}
          </div>`
        : `<h3><span class="sidebar-section-dot" aria-hidden="true"></span>${escapeHtml(sec.section)}</h3>`;
      return `
    <section class="sidebar-section${productRail ? " sidebar-section--voice" : ""}" data-section="${escapeHtml(sectionSlug(sec.section))}">
      ${sectionHead}
      <ul>
        ${sec.items.map((c) => renderSidebarLeaf(c)).join("")}
      </ul>
    </section>
  `;
    })
    .join("");
}

function bindRailLoadActions(rootSelector) {
  document.querySelectorAll(`${rootSelector} [data-action=load]`).forEach((btn) => {
    if (btn.dataset.railLoadBound === "1") return;
    btn.dataset.railLoadBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-id");
      if (id === "overview") clearPockitPlayerFilter();
      setCassette(id);
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
}

function bindMacAppRailActions(rootSelector) {
  document.querySelectorAll(`${rootSelector} [data-action=select-accessory-desk]`).forEach((btn) => {
    if (btn.dataset.deskBound === "1") return;
    btn.dataset.deskBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectAccessoryDesk();
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=accessory-desk-action]`).forEach((btn) => {
    if (btn.dataset.deskActionBound === "1") return;
    btn.dataset.deskActionBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = btn.getAttribute("data-desk-action") || "";
      const appId = btn.getAttribute("data-mac-app-id") || "";
      if (action === "install-missing") {
        window.PockitAccessoryDesk?.installMissing?.().catch(() => {});
      } else if (action === "install" && appId) {
        window.PockitAccessoryDesk?.install?.(appId)
          ?.then(() => window.PockitAccessoryDeskPanel?.refresh?.())
          ?.catch(() => {});
      } else if (action === "launch" && appId) {
        window.PockitAccessoryDesk?.launch?.(appId)?.catch(() => {});
      } else if (action === "open-app" && appId) {
        window.PockitAccessoryDesk?.openApp?.(appId)?.catch(() => {});
      } else if (action === "refresh") {
        if (window.PockitAccessoryDeskPanel?.refresh) {
          window.PockitAccessoryDeskPanel.refresh().catch(() => {});
        } else {
          openAccessoryDesk();
        }
      }
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=select-mac-app]`).forEach((btn) => {
    if (btn.dataset.macAppBound === "1") return;
    btn.dataset.macAppBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectMacApp(btn.getAttribute("data-mac-app-id") || btn.getAttribute("data-id")?.replace(/^mac-app-/, "") || "");
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=mac-app-open]`).forEach((btn) => {
    if (btn.dataset.macOpenBound === "1") return;
    btn.dataset.macOpenBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const appId = btn.getAttribute("data-mac-app-id") || "";
      openMacAppDoor(appId, btn.getAttribute("data-door") || btn.getAttribute("data-nav-path"));
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=mac-app-nav]`).forEach((btn) => {
    if (btn.dataset.macNavBound === "1") return;
    btn.dataset.macNavBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const appId = btn.getAttribute("data-mac-app-id") || "";
      openMacAppDoor(appId, btn.getAttribute("data-nav-path"));
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=encompass-nav]`).forEach((btn) => {
    if (btn.dataset.encNavBound === "1") return;
    btn.dataset.encNavBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const encCassetteId = btn.getAttribute("data-encompass-cassette")
        || (isKnowledgeCassetteActive() ? "knowledge-cassette" : "web-odysseus");
      const cassette = findCassette(encCassetteId) || findCassette(currentCassetteId()) || findCassette("web-odysseus");
      if (btn.getAttribute("data-encompass-speakers") === "1") {
        const door = btn.getAttribute("data-encompass-door") || speakersDoorForCard(cassette);
        if (door) window.open(door, "_blank", "noopener,noreferrer");
        return;
      }
      const encPath = btn.getAttribute("data-encompass-path");
      if (encPath) {
        setEncompassIframeRoute(encPath, cassette);
        if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
        return;
      }
      const panel = btn.getAttribute("data-encompass-panel") || "chat";
      setEncompassPanel(panel, cassette);
      highlightActiveSidebarItem(cassette?.id || "web-odysseus");
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
}

function bindPlayerRailActions(rootSelector = "#player-rail-content") {
  document.querySelectorAll(`${rootSelector} [data-action=filter-player]`).forEach((btn) => {
    if (btn.dataset.playerRailBound === "1") return;
    btn.dataset.playerRailBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openPlayerHome(btn.getAttribute("data-player-id") || "");
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=select-player-group]`).forEach((btn) => {
    if (btn.dataset.playerGroupBound === "1") return;
    btn.dataset.playerGroupBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const group = btn.getAttribute("data-group-name");
      if (group) selectPlayerGroup(group);
      if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
    });
  });
  document.querySelectorAll(`${rootSelector} [data-action=open-player-home]`).forEach((btn) => {
    if (btn.dataset.playerHomeBound === "1") return;
    btn.dataset.playerHomeBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const inPhoneChrome = window.isPhoneChromeEl?.(btn);
      if (!inPhoneChrome) e.stopPropagation();
      openPlayerHome(btn.getAttribute("data-player-id") || "");
      if (inPhoneChrome) window.dismissPhoneChromeAfterAction?.();
    });
  });
}

function renderCassetteRailDropdownMount() {
  const mount = document.getElementById("cassette-rail-dropdown");
  if (!mount || !isTape()) {
    if (mount) mount.innerHTML = "";
    return;
  }
  mount.innerHTML = renderCometDropdown({
    id: "cassette-rail-nav-dropdown",
    value: cassetteRailDropdownValue(),
    options: cassetteRailDropdownOptions(),
    triggerClass: "comet-dropdown-trigger--rail",
    fullBleed: true,
    finderCaption: "Cartridges",
  });
  const trigger = mount.querySelector(".comet-dropdown-trigger");
  if (trigger) {
    const label = trigger.querySelector(".comet-dropdown-trigger-label");
    if (label) label.textContent = cassetteRailDropdownLabel();
  }
  bindCometDropdowns(mount, {
    "cassette-rail-nav-dropdown": (selected) => {
      if (selected === "__all__") {
        POCKIT_PLAYER_GROUP = "";
        renderCassetteRail();
        highlightActiveRails(currentCassetteId());
        return;
      }
      if (selected) selectPlayerGroup(selected);
    },
  });
  hydrateIcons(mount);
}

function cassetteRailDropdownOptions() {
  if (!POCKIT_PLAYER) {
    const pockit = POCKIT_CATALOG?.players?.find((p) => p.id === "pockit");
    const count = (pockit?.hosted_cassettes || []).length;
    return [{
      value: "__all__",
      label: count ? `Pockit cassettes (${count})` : "Pockit cassettes",
      icon: "AppstoreOutlined",
    }];
  }
  const groups = playerSidebarGroups(POCKIT_PLAYER);
  const opts = groups.map((g) => ({
    value: g.name,
    label: `${g.name} (${g.count})`,
    icon: "FolderOutlined",
  }));
  if (opts.length > 1) {
    opts.unshift({ value: "__all__", label: "All groups", icon: "ClusterOutlined" });
  }
  if (!opts.length) {
    const player = catalogPlayerById(POCKIT_PLAYER);
    opts.push({
      value: "__all__",
      label: player?.name ? `${player.name} cartridges` : "Cartridges",
      icon: "AppstoreOutlined",
    });
  }
  return opts;
}

function cassetteRailDropdownValue() {
  if (!POCKIT_PLAYER) return "__all__";
  if (!POCKIT_PLAYER_GROUP) return "__all__";
  return POCKIT_PLAYER_GROUP;
}

function cassetteRailDropdownLabel() {
  if (!POCKIT_PLAYER) {
    const pockit = POCKIT_CATALOG?.players?.find((p) => p.id === "pockit");
    return pockit?.name ? `${pockit.name} cartridges` : "Cartridges";
  }
  if (POCKIT_PLAYER_GROUP) return POCKIT_PLAYER_GROUP;
  const player = catalogPlayerById(POCKIT_PLAYER);
  return player?.name ? `${player.name} cartridges` : "Cartridges";
}

function onConsoleNavSelected(value) {
  closeConsoleModal({ instant: true });
  closeMobileHud();
  setCassetteInFlight = null;
  if (value === "voice") {
    navigateFromConsolePicker("voice");
  } else if (value === "knowledge") {
    navigateFromConsolePicker("knowledge");
  } else if (value === "prompt-library") {
    navigateFromConsolePicker("prompt-library");
  } else if (value === "family-desk") {
    navigateFromConsolePicker("family-desk");
  } else if (value === "ship-integrity") {
    navigateFromConsolePicker("ship-integrity");
  } else if (value === "configurations") {
    navigateFromConsolePicker("configurations");
  } else if (value === "library") {
    navigateFromConsolePicker("library");
  } else if (value === "apps" || !value) {
    POCKIT_PLAYER = "";
    POCKIT_PLAYER_GROUP = "";
    POCKIT_MAC_APP = "pockit";
    try {
      localStorage.removeItem("nephew-pockit-player");
    } catch {
      /* ignore */
    }
    navigateFromConsolePicker("overview");
    queueMicrotask(() => {
      renderSidebar();
      syncPlayerAccent();
    });
  } else if (value && !value.startsWith("__")) {
    if (CONSOLE_SELF_EMBED_IDS.has(value) && consoleProjectionHref(catalogPlayerById(value))) {
      openConsoleConsoleView(value);
    } else {
      openPlayerHome(value);
    }
  }
  syncConsolePickerTriggers();
}

function consoleModalAppCards() {
  return [
    {
      value: "apps",
      title: "Overview",
      subtitle: "Apps grid — every cassette",
      icon: "AppstoreOutlined",
      glyph: "📼",
    },
    {
      value: "voice",
      title: "Voice (Parakeet)",
      subtitle: "Talk to Nephew on-device",
      icon: "AudioOutlined",
      glyph: "🗣️",
    },
    {
      value: "knowledge",
      title: "Knowledge",
      subtitle: "Ask the family brain · cited RAG",
      icon: "BookOutlined",
      glyph: "🧠",
    },
    {
      value: "prompt-library",
      title: "Prompts",
      subtitle: "Operator prompt library · Play in every surface",
      icon: "FileTextOutlined",
      glyph: "📋",
    },
    {
      value: "family-desk",
      title: "Family Wealth Desk",
      subtitle: "Net worth · allocation · FOP entity filter",
      icon: "BankOutlined",
      glyph: "🏛",
    },
    {
      value: "ship-integrity",
      title: "Ship Integrity",
      subtitle: "Invisible pads · tower paths · Spark SSH probe",
      icon: "SafetyCertificateOutlined",
      glyph: "🛡",
    },
    {
      value: "configurations",
      title: "Configurations",
      subtitle: "Operator JSON registry · Voice · boot accessories",
      icon: "SettingOutlined",
      glyph: "⚙️",
    },
    {
      value: "library",
      title: "Library",
      subtitle: "Consoles, tapes, resources",
      icon: "BookOutlined",
      glyph: "📚",
    },
  ];
}

function consoleModalPlayerCards() {
  if (!POCKIT_CATALOG?.players) return [];
  return POCKIT_CATALOG.players.filter(catalogConsoleProjectable).map((p) => {
    const count = (p.hosted_cassettes || []).length;
    return {
      value: p.id,
      title: p.name || p.id,
      subtitle: p.niche || "Family Office player",
      count,
      player: p,
      icon: "ClusterOutlined",
    };
  });
}

function renderConsoleModalCard(item, active) {
  const iconInner = consoleModalCardIconHtml(item);
  const badge =
    item.count != null && item.count > 0
      ? `<span class="console-modal-card__badge">${item.count} cassette${item.count === 1 ? "" : "s"}</span>`
      : "";
  return `
    <button type="button" class="console-modal-card${active ? " is-active" : ""}"
      data-console-value="${escapeHtml(item.value)}"
      aria-pressed="${active ? "true" : "false"}">
      <span class="console-modal-card__icon console-modal-card__icon--native" aria-hidden="true">${iconInner}</span>
      <span class="console-modal-card__title">${escapeHtml(item.title)}</span>
      <span class="console-modal-card__sub">${escapeHtml(item.subtitle)}</span>
      ${badge}
    </button>`;
}

function renderConsoleModalBodyHtml() {
  const active = pockitNavDropdownValue();
  const apps = consoleModalAppCards();
  const players = consoleModalPlayerCards();
  return `
    <section class="pockit-console-modal__section" aria-label="Apps">
      <h3 class="pockit-console-modal__section-title">Apps</h3>
      <div class="pockit-console-modal__grid">
        ${apps.map((item) => renderConsoleModalCard(item, active === item.value)).join("")}
      </div>
    </section>
    ${
      players.length
        ? `<section class="pockit-console-modal__section" aria-label="Consoles">
      <h3 class="pockit-console-modal__section-title">Consoles</h3>
      <div class="pockit-console-modal__grid">
        ${players.map((item) => renderConsoleModalCard(item, active === item.value)).join("")}
      </div>
    </section>`
        : ""
    }`;
}

let settingsModalBound = false;
let consoleModalBound = false;
let settingsModalTab = "layout";
let mobileHudBound = false;
let mobileHudTab = "consoles";

function renderSettingsModalTabContent(tabId) {
  return window.PockitConfig?.renderSettingsModalTabPanel?.(tabId)
    || `<div class="pockit-settings-pane"><p class="cs-hint">Settings unavailable.</p></div>`;
}

function renderSettingsModalSidebarHtml() {
  const tabs = window.PockitConfig?.SETTINGS_MODAL_TABS || [];
  return tabs
    .map(
      (t) => `<button type="button" role="tab" class="pockit-settings-modal__tab${settingsModalTab === t.id ? " is-active" : ""}"
        data-settings-tab="${escapeHtml(t.id)}" aria-selected="${settingsModalTab === t.id ? "true" : "false"}">
        <span class="pockit-settings-modal__tab-icon" data-ant-icon="${escapeHtml(t.icon)}" aria-hidden="true"></span>
        <span class="pockit-settings-modal__tab-label">${escapeHtml(t.label)}</span>
      </button>`,
    )
    .join("");
}

function paintSettingsModalContent(modal) {
  const sidebar = modal?.querySelector(".pockit-settings-modal__sidebar");
  const content = modal?.querySelector("#pockit-settings-modal-content");
  if (sidebar) sidebar.innerHTML = renderSettingsModalSidebarHtml();
  if (content) {
    content.innerHTML = renderSettingsModalTabContent(settingsModalTab);
    hydrateIcons(content);
    window.PockitConfig?.bindSettingsTabActions?.(content, settingsModalTab);
    if (settingsModalTab === "devices") {
      content.querySelector(".pockit-device-lab__catalog")?.focus?.({ preventScroll: true });
    }
  }
  const panel = modal?.querySelector(".pockit-settings-modal__panel");
  if (panel) {
    window.PockitConfig?.bindSettingsModalPanel?.(panel, {
      onClose: () => closeSettingsModal(),
      onApplied: () => {},
    });
  }
  if (sidebar) hydrateIcons(sidebar);
}

function ensureSettingsModal() {
  let modal = document.getElementById("pockit-settings-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "pockit-settings-modal";
  modal.className = "pockit-console-modal pockit-settings-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Family Office settings");
  modal.innerHTML = `
    <div class="pockit-console-modal__backdrop pockit-settings-modal__backdrop" data-action="close-settings-modal"></div>
    <div class="pockit-console-modal__panel pockit-settings-modal__panel">
      <header class="pockit-console-modal__header pockit-settings-modal__header">
        <div>
          <span class="pockit-console-modal__kicker">Family Office</span>
          <h2 class="pockit-console-modal__title">Settings</h2>
        </div>
        <button type="button" class="pockit-console-modal__close" data-action="close-settings-modal" aria-label="Close">×</button>
      </header>
      <div class="pockit-settings-modal__body">
        <nav class="pockit-settings-modal__sidebar" role="tablist" aria-label="Settings sections"></nav>
        <div class="pockit-settings-modal__content" id="pockit-settings-modal-content" role="tabpanel" tabindex="-1"></div>
      </div>
      <footer class="pockit-settings-modal__footer">
        <button type="button" class="comet-btn comet-btn--primary" id="pc-save">Save changes</button>
      </footer>
    </div>`;
  document.body.appendChild(modal);
  if (!settingsModalBound) {
    settingsModalBound = true;
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=close-settings-modal]")) closeSettingsModal();
      const tabBtn = e.target.closest("[data-settings-tab]");
      if (tabBtn) {
        e.preventDefault();
        settingsModalTab = tabBtn.getAttribute("data-settings-tab") || "layout";
        paintSettingsModalContent(modal);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const el = document.getElementById("pockit-settings-modal");
      if (el && !el.hidden) closeSettingsModal();
    });
  }
  return modal;
}

function paintConsoleModalContent(modal) {
  const body = modal?.querySelector("#pockit-console-modal-body");
  if (body) {
    body.innerHTML = renderConsoleModalBodyHtml();
    hydrateIcons(body);
  }
}

function ensureConsoleModal() {
  let modal = document.getElementById("pockit-console-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "pockit-console-modal";
  modal.className = "pockit-console-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Switch console");
  modal.innerHTML = `
    <div class="pockit-console-modal__backdrop" data-action="close-console-modal"></div>
    <div class="pockit-console-modal__panel">
      <header class="pockit-console-modal__header">
        <div>
          <span class="pockit-console-modal__kicker">Family Office</span>
          <h2 class="pockit-console-modal__title">Switch console</h2>
        </div>
        <button type="button" class="pockit-console-modal__close" data-action="close-console-modal" aria-label="Close">×</button>
      </header>
      <div class="pockit-console-modal__body" id="pockit-console-modal-body"></div>
    </div>`;
  document.body.appendChild(modal);
  if (!consoleModalBound) {
    consoleModalBound = true;
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=close-console-modal]")) closeConsoleModal();
      const card = e.target.closest("[data-console-value]");
      if (card) {
        e.preventDefault();
        onConsoleNavSelected(card.getAttribute("data-console-value"));
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const el = document.getElementById("pockit-console-modal");
      if (el && !el.hidden) closeConsoleModal();
    });
  }
  return modal;
}

function openConsoleModal() {
  if (window.PockitViewport?.isMobileShell?.()) {
    openMobileHud("consoles");
    return;
  }
  closeSettingsModal();
  closeMobileHud();
  const modal = ensureConsoleModal();
  paintConsoleModalContent(modal);
  modal.classList.remove("pockit-console-modal--closing", "pockit-console-modal--open");
  modal.hidden = false;
  void modal.offsetWidth;
  modal.classList.add("pockit-console-modal--open");
  document.querySelectorAll(".console-picker-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "true");
  });
}

function closeConsoleModal(opts = {}) {
  const modal = document.getElementById("pockit-console-modal");
  if (!modal || modal.hidden) return;
  if (opts.instant) {
    modal.hidden = true;
    modal.classList.remove("pockit-console-modal--open", "pockit-console-modal--closing");
    document.querySelectorAll(".console-picker-trigger").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
    return;
  }
  modal.classList.remove("pockit-console-modal--open");
  modal.classList.add("pockit-console-modal--closing");
  document.querySelectorAll(".console-picker-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("pockit-console-modal--closing");
  }, 360);
}

function openSettingsModal(tab = "layout") {
  closeConsoleModal();
  closeMobileHud();
  settingsModalTab = tab || "layout";
  const modal = ensureSettingsModal();
  paintSettingsModalContent(modal);
  modal.classList.remove("pockit-console-modal--closing", "pockit-console-modal--open");
  modal.hidden = false;
  document.body.classList.add("pockit-settings-modal-open");
  void modal.offsetWidth;
  modal.classList.add("pockit-console-modal--open");
  modal.querySelector(".pockit-settings-modal__content")?.focus?.({ preventScroll: true });
  document.querySelectorAll(".settings-modal-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "true");
  });
}

function closeSettingsModal() {
  const modal = document.getElementById("pockit-settings-modal");
  if (!modal || modal.hidden) return;
  modal.classList.remove("pockit-console-modal--open");
  modal.classList.add("pockit-console-modal--closing");
  document.body.classList.remove("pockit-settings-modal-open");
  document.querySelectorAll(".settings-modal-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("pockit-console-modal--closing");
  }, 360);
}

function ensureMobileHud() {
  let hud = document.getElementById("pockit-mobile-hud");
  if (hud) {
    ensureMobileHudVersionPill(hud);
    return hud;
  }
  hud = document.createElement("div");
  hud.id = "pockit-mobile-hud";
  hud.className = "pockit-mobile-hud";
  hud.hidden = true;
  hud.setAttribute("role", "dialog");
  hud.setAttribute("aria-modal", "true");
  hud.setAttribute("aria-label", "Family Office menu");
  hud.innerHTML = `
    <div class="pockit-mobile-hud__backdrop" data-action="close-mobile-hud"></div>
    <div class="pockit-mobile-hud__sheet cotton-ball-settle">
      <header class="pockit-mobile-hud__header">
        <h2 class="pockit-mobile-hud__title">Family Office</h2>
        <div class="pockit-mobile-hud__header-trailing">
          ${renderMobileVersionPillHtml("pockit-mobile-hud-version")}
          <button type="button" class="pockit-mobile-hud__close" data-action="close-mobile-hud" aria-label="Close">×</button>
        </div>
      </header>
      <div class="pockit-mobile-hud__tabs" role="tablist">
        <button type="button" class="pockit-mobile-hud__tab is-active" data-hud-tab="consoles" role="tab">Consoles</button>
        <button type="button" class="pockit-mobile-hud__tab" data-hud-tab="players" role="tab">Players</button>
        <button type="button" class="pockit-mobile-hud__tab" data-hud-tab="cassettes" role="tab">Cartridges</button>
        <button type="button" class="pockit-mobile-hud__tab" data-hud-tab="suite" role="tab">Suite</button>
      </div>
      <div class="pockit-mobile-hud__body" id="pockit-mobile-hud-body"></div>
    </div>`;
  document.body.appendChild(hud);
  if (!mobileHudBound) {
    mobileHudBound = true;
    hud.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=close-mobile-hud]")) closeMobileHud();
      const tabBtn = e.target.closest("[data-hud-tab]");
      if (tabBtn) {
        e.preventDefault();
        openMobileHud(tabBtn.getAttribute("data-hud-tab"));
      }
      const card = e.target.closest("[data-console-value]");
      if (card) {
        e.preventDefault();
        onConsoleNavSelected(card.getAttribute("data-console-value"));
        closeMobileHud();
      }
      const suiteBtn = e.target.closest("[data-hud-suite-load]");
      if (suiteBtn) {
        e.preventDefault();
        const loadId = suiteBtn.getAttribute("data-hud-suite-load");
        if (loadId && typeof window.setCassette === "function") window.setCassette(loadId);
        closeMobileHud();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const el = document.getElementById("pockit-mobile-hud");
      if (el && !el.hidden) closeMobileHud();
    });
  }
  return hud;
}

function renderMobileHudRailHtml(sections, opts = {}) {
  const html = renderRailSectionHtml(sections, opts);
  return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid">${html}</div>`;
}

function renderMobileHudBodyHtml(tab) {
  if (tab === "consoles") return renderConsoleModalBodyHtml();
  if (tab === "players") {
    const voice = isVoiceCassetteActive();
    const knowledge = isKnowledgeCassetteActive();
    const sections = playerRailSectionsForCurrentRoute();
    const voicePicker = voice ? (window.PockitRailContext?.renderVoicePickerRailHtml?.() || "") : "";
    if (!sections.length) {
      return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid"><p class="pockit-rail-empty">No player controls.</p></div>`;
    }
    const railHtml = renderRailSectionHtml(sections, { voiceRail: voice, knowledgeRail: knowledge });
    return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid">${voicePicker}${railHtml}</div>`;
  }
  if (tab === "cassettes") {
    if (isVoiceCassetteActive()) {
      return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid" id="pockit-mobile-hud-cassette-rail"><p class="pockit-rail-empty">Loading stack…</p></div>`;
    }
    if (isKnowledgeCassetteActive()) {
      return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid" id="pockit-mobile-hud-cassette-rail"><p class="pockit-rail-empty">Loading brain…</p></div>`;
    }
    const weave = buildMacAppWeaveState();
    if (weave) {
      const html = weave.emptyRightMessage && !weave.rightSections.some((s) => s.items?.length)
        ? `<p class="pockit-rail-empty">${escapeHtml(weave.emptyRightMessage)}</p>`
        : renderRailSectionHtml(weave.rightSections);
      return `<div class="pockit-mobile-hud__rail pockit-mobile-hud__rail--grid">${html}</div>`;
    }
    const sections = isTape() ? cassetteRailSections() : sidebarCardSections();
    return renderMobileHudRailHtml(sections);
  }
  if (tab === "suite" && window.PockitSuite?.SUITE_APPS) {
    return `<div class="pockit-mobile-hud__tile-grid pockit-mobile-hud__suite-grid">
      ${window.PockitSuite.SUITE_APPS.map((a) => `
        <button type="button" class="pockit-mobile-hud__suite-btn" data-hud-suite-load="${escapeHtml(a.loadId || a.id)}">
          ${window.PockitSuite.elementTile(a)}
          <span>${escapeHtml(a.name)}</span>
        </button>`).join("")}
    </div>`;
  }
  return "";
}

function openMobileHud(tab = "consoles") {
  if (!window.PockitViewport?.isMobileShell?.()) return;
  mobileHudTab = tab || "consoles";
  const hud = ensureMobileHud();
  const body = hud.querySelector("#pockit-mobile-hud-body");
  hud.querySelectorAll("[data-hud-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-hud-tab") === mobileHudTab);
  });
  const paintHudBody = async () => {
    if (!body) return;
    body.innerHTML = renderMobileHudBodyHtml(mobileHudTab);
    hydrateIcons(body);
    bindRailLoadActions("#pockit-mobile-hud-body");
    bindMacAppRailActions("#pockit-mobile-hud-body");
    bindPlayerRailActions("#pockit-mobile-hud-body");
    if (isVoiceCassetteActive()) {
      bindVoiceRailActions("#pockit-mobile-hud-body");
      window.VoiceRailInfo?.bindInfoButtons?.("#pockit-mobile-hud-body");
      if (mobileHudTab === "cassettes") {
        const routeAtStart = currentCassetteId();
        const ent = findCatalogEntryByHubId(routeAtStart);
        const st = window.ParakeetVoicePad?.getState?.() || {};
        const health = { ...(st.health || st) };
        if (health.healthProbePending !== false) health.healthProbePending = true;
        const sections = await window.PockitRailContext?.buildVoiceRightRailSections?.(health, ent);
        const mount = body.querySelector("#pockit-mobile-hud-cassette-rail");
        if (mount && isVoiceCassetteActive() && currentCassetteId() === routeAtStart) {
          mount.innerHTML = renderRailSectionHtml(sections || [], { voiceRail: true });
          bindVoiceRailActions("#pockit-mobile-hud-body");
          window.PockitRailContext?.bindMakeActions?.("#pockit-mobile-hud-body");
          window.VoiceRailInfo?.bindInfoButtons?.("#pockit-mobile-hud-body");
          highlightVoiceRailSelections(st);
        }
      } else {
        highlightVoiceRailSelections(window.ParakeetVoicePad?.getState?.() || {});
      }
    }
    if (isKnowledgeCassetteActive()) {
      bindKnowledgeRailActions("#pockit-mobile-hud-body");
      window.KnowledgeRailInfo?.bindInfoButtons?.("#pockit-mobile-hud-body");
      if (mobileHudTab === "cassettes") {
        const routeAtStart = currentCassetteId();
        const ent = findCatalogEntryByHubId(routeAtStart);
        const sections = await window.PockitRailContext?.buildKnowledgeRightRailSections?.(ent);
        const mount = body.querySelector("#pockit-mobile-hud-cassette-rail");
        if (mount && isKnowledgeCassetteActive() && currentCassetteId() === routeAtStart) {
          mount.innerHTML = renderRailSectionHtml(sections || [], { knowledgeRail: true });
          bindKnowledgeRailActions("#pockit-mobile-hud-body");
          window.PockitRailContext?.bindMakeActions?.("#pockit-mobile-hud-body");
          window.KnowledgeRailInfo?.bindInfoButtons?.("#pockit-mobile-hud-body");
          highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
        }
      } else {
        highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
      }
    }
    window.PockitRailContext?.bindMakeActions?.("#pockit-mobile-hud-body");
    window.PockitRailContext?.bindSectionJump?.("#pockit-mobile-hud-body");
    refreshCometTooltips(body);
  };
  paintHudBody();
  hud.hidden = false;
  hud.classList.add("pockit-mobile-hud--open");
  syncFooterVersionChrome();
  window.PadSurface?.bindChangelogLinks?.(hud);
  document.querySelectorAll(".console-picker-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "true");
  });
}

function closeMobileHud() {
  const hud = document.getElementById("pockit-mobile-hud");
  if (!hud || hud.hidden) return;
  hud.classList.remove("pockit-mobile-hud--open");
  hud.hidden = true;
  document.querySelectorAll(".console-picker-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

window.openMobileHud = openMobileHud;
window.closeMobileHud = closeMobileHud;
window.highlightVoiceRailSelections = highlightVoiceRailSelections;
window.highlightKnowledgeRailSelections = highlightKnowledgeRailSelections;
window.highlightHelpRailSelections = highlightHelpRailSelections;

async function phoneRailLeftHtml() {
  if (!isTape()) {
    return { html: `<p class="pockit-rail-empty">Open a cassette to see player controls.</p>`, voice: false, knowledge: false, help: false };
  }
  const voice = isVoiceCassetteActive();
  const knowledge = isKnowledgeCassetteActive();
  const help = isHelpConsoleActive();
  const sections = playerRailSectionsForCurrentRoute();
  const voicePicker = voice ? (window.PockitRailContext?.renderVoicePickerRailHtml?.() || "") : "";
  const html = sections.length
    ? `${voicePicker}${renderRailSectionHtml(sections, { voiceRail: voice, knowledgeRail: knowledge, helpRail: help })}`
    : `<p class="pockit-rail-empty">No player controls for this view.</p>`;
  return { html, voice, knowledge, help };
}

async function phoneRailRightHtml() {
  if (!isTape()) {
    return { html: `<p class="pockit-rail-empty">Open a cassette to see stack controls.</p>`, voice: false, knowledge: false, help: false };
  }
  const help = isHelpConsoleActive();
  if (help) {
    const routeAtStart = currentCassetteId();
    await window.PockitHelpConsole?.init?.().catch(() => {});
    const st = window.PockitHelpConsole?.getState?.() || {};
    const sections = await window.PockitRailContext?.buildHelpRightRailSections?.(st) || [];
    if (!isHelpConsoleActive() || currentCassetteId() !== routeAtStart) {
      return { html: "", voice: false, knowledge: false, help: true };
    }
    return { html: renderRailSectionHtml(sections || [], { helpRail: true }), voice: false, knowledge: false, help: true };
  }
  const voice = isVoiceCassetteActive();
  if (voice) {
    const routeAtStart = currentCassetteId();
    const ent = findCatalogEntryByHubId(routeAtStart);
    const st = window.ParakeetVoicePad?.getState?.() || {};
    const health = { ...(st.health || st) };
    if (health.healthProbePending !== false) health.healthProbePending = true;
    const sections = await window.PockitRailContext?.buildVoiceRightRailSections?.(health, ent);
    if (!isVoiceCassetteActive() || currentCassetteId() !== routeAtStart) {
      return { html: "", voice: true };
    }
    return { html: renderRailSectionHtml(sections || [], { voiceRail: true }), voice: true, knowledge: false };
  }
  const knowledge = isKnowledgeCassetteActive();
  if (knowledge) {
    const routeAtStart = currentCassetteId();
    const ent = findCatalogEntryByHubId(routeAtStart);
    const sections = await window.PockitRailContext?.buildKnowledgeRightRailSections?.(ent);
    if (!isKnowledgeCassetteActive() || currentCassetteId() !== routeAtStart) {
      return { html: "", voice: false, knowledge: true };
    }
    return { html: renderRailSectionHtml(sections || [], { knowledgeRail: true }), voice: false, knowledge: true };
  }
  const weave = buildMacAppWeaveState();
  if (weave) {
    if (weave.emptyRightMessage && !weave.rightSections.some((s) => s.items?.length)) {
      return { html: `<p class="pockit-rail-empty">${escapeHtml(weave.emptyRightMessage)}</p>`, voice: false, knowledge: false };
    }
    return { html: renderRailSectionHtml(weave.rightSections), voice: false, knowledge: false };
  }
  const sections = isTape() ? cassetteRailSections() : sidebarCardSections();
  return { html: renderRailSectionHtml(sections), voice: false, knowledge: false };
}

function phoneRailLabels() {
  const voice = isVoiceCassetteActive();
  const knowledge = isKnowledgeCassetteActive();
  const help = isHelpConsoleActive();
  const encompass = isEncompassIframeConsole(findCassette(currentCassetteId()));
  return {
    left: help ? "Topics" : voice ? "Controller" : knowledge ? "Scope" : encompass ? "Archive" : "Consoles",
    right: help ? "Related" : voice ? "Stack" : knowledge ? "Brain" : encompass ? "Intelligence" : "Cartridges",
    bottom: help ? "Guide" : voice ? "Session" : knowledge ? "Ask" : encompass ? "Quick" : "Controls",
    hasTapeRails: isTape(),
  };
}

function bindPhoneRailPanel(rootSelector, { voice = false, knowledge = false, help = false } = {}) {
  bindRailLoadActions(rootSelector);
  bindMacAppRailActions(rootSelector);
  bindPlayerRailActions(rootSelector);
  if (voice) bindVoiceRailActions(rootSelector);
  if (knowledge) bindKnowledgeRailActions(rootSelector);
  if (help) bindHelpRailActions(rootSelector);
  window.PockitRailContext?.bindMakeActions?.(rootSelector);
  window.PockitRailContext?.bindSectionJump?.(rootSelector);
  window.VoiceRailInfo?.bindInfoButtons?.(rootSelector);
  window.KnowledgeRailInfo?.bindInfoButtons?.(rootSelector);
  const root = document.querySelector(rootSelector);
  if (root) refreshCometTooltips(root);
  if (voice) highlightVoiceRailSelections(window.ParakeetVoicePad?.getState?.() || {});
  if (knowledge) highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
  if (help) highlightHelpRailSelections(window.PockitHelpConsole?.getState?.() || {});
}

window.__pockitPhoneRailBridge = {
  getLeftHtml: phoneRailLeftHtml,
  getRightHtml: phoneRailRightHtml,
  getLabels: phoneRailLabels,
  bindPanel: bindPhoneRailPanel,
  isTape,
};

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openConsoleModal = openConsoleModal;
window.closeConsoleModal = closeConsoleModal;

function syncConsolePickerTriggers() {
  document.querySelectorAll(".console-picker-trigger").forEach((trigger) => {
    const tg = trigger.querySelector(".comet-dropdown-trigger-glyph, .suite-bar__brand-glyph");
    const tl = trigger.querySelector(".comet-dropdown-trigger-label, .suite-bar__brand-console");
    if (tg) {
      const isSuiteBrand = trigger.id === "suite-bar-console-trigger";
      tg.innerHTML = isSuiteBrand ? consolePickerBrandIconHtml() : consolePickerTriggerIcon();
      hydrateIcons(tg);
    }
    if (tl) tl.textContent = consolePickerShortLabel();
    const tip = `Switch console — ${consolePickerShortLabel()}\nPick a console or Family Office surface`;
    if (window.CometTooltip?.set) window.CometTooltip.set(trigger, tip);
    else trigger.setAttribute("data-comet-tip", tip);
  });
  const consoleModal = document.getElementById("pockit-console-modal");
  if (consoleModal && !consoleModal.hidden) {
    paintConsoleModalContent(consoleModal);
  }
  const modal = document.getElementById("pockit-settings-modal");
  if (modal && !modal.hidden) {
    paintSettingsModalContent(modal);
  }
  const hudBody = document.getElementById("pockit-mobile-hud-body");
  if (hudBody && mobileHudTab === "consoles" && !document.getElementById("pockit-mobile-hud")?.hidden) {
    hudBody.innerHTML = renderMobileHudBodyHtml("consoles");
    hydrateIcons(hudBody);
  }
}

window.__pockitSyncConsolePicker = syncConsolePickerTriggers;

function bindSettingsModalTrigger(trigger) {
  if (!trigger || trigger.dataset.settingsModalBound === "1") return;
  trigger.dataset.settingsModalBound = "1";
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSettingsModal("layout");
  });
}

window.bindSettingsModalTrigger = bindSettingsModalTrigger;

function bindConsolePickerTrigger(trigger) {
  if (!trigger || trigger.dataset.consolePickerBound === "1") return;
  trigger.dataset.consolePickerBound = "1";
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.PockitViewport?.isMobileShell?.()) openMobileHud("consoles");
    else openConsoleModal();
  });
}

function renderConsolePickerMount(mountId, enabled) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  if (!enabled || !isTape()) {
    mount.innerHTML = "";
    return;
  }
  mount.innerHTML = consolePickerTriggerHtml();
  bindConsolePickerTrigger(mount.querySelector(".console-picker-trigger"));
  hydrateIcons(mount);
}

function isPlayerRailCollapsed() {
  return document.getElementById("player-rail")?.classList.contains("collapsed") ?? false;
}

function syncRailChromeLayout() {
  const playerCollapsed = isPlayerRailCollapsed();
  document.body.classList.toggle("pockit-player-rail-collapsed", playerCollapsed);
  const headerPickerWidget = document.querySelector('[data-widget="main-console-picker"]');
  if (headerPickerWidget) {
    const suiteOn = document.body.classList.contains("suite-bar-visible");
    headerPickerWidget.classList.toggle("hidden", suiteOn || !playerCollapsed);
  }
  renderConsolePickerMounts();
}

function renderSettingsMount(mountId, enabled) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  if (!enabled || !isTape()) {
    mount.innerHTML = "";
    return;
  }
  mount.innerHTML = settingsTriggerHtml();
  bindSettingsModalTrigger(mount.querySelector(".player-rail-settings-trigger"));
  hydrateIcons(mount);
}

function renderSuiteBarConsoleTrigger(enabled) {
  const trigger = document.getElementById("suite-bar-console-trigger");
  if (!trigger) return;
  trigger.disabled = !enabled || !isTape();
  if (enabled && isTape()) bindConsolePickerTrigger(trigger);
  syncConsolePickerTriggers();
}

function renderConsolePickerMounts() {
  const suiteOn = document.body.classList.contains("suite-bar-visible");
  const playerOpen = !isPlayerRailCollapsed();
  renderSuiteBarConsoleTrigger(suiteOn);
  if (suiteOn) {
    renderSettingsMount("player-rail-dropdown", playerOpen);
    renderConsolePickerMount("main-header-console-picker", false);
  } else {
    renderConsolePickerMount("player-rail-dropdown", true);
    renderConsolePickerMount("main-header-console-picker", !playerOpen);
  }
  syncConsolePickerTriggers();
}

window.__pockitSyncImmersivePicker = () => renderConsolePickerMounts();

function renderPlayerRailDropdownMount() {
  renderConsolePickerMounts();
}

function renderPlayerRail() {
  const el = document.getElementById("player-rail-content");
  if (!el) return;
  if (!isTape()) {
    el.innerHTML = "";
    renderPlayerRailDropdownMount();
    return;
  }
  const sections = playerRailSectionsForCurrentRoute();
  const voice = isVoiceCassetteActive();
  const knowledge = isKnowledgeCassetteActive();
  const help = isHelpConsoleActive();
  const voicePicker = voice ? (window.PockitRailContext?.renderVoicePickerRailHtml?.() || "") : "";
  const emptyMsg = help ? "Help topics loading…" : voice ? "Voice controls loading…" : knowledge ? "Scope controls loading…" : "No player controls.";
  el.innerHTML = sections.length
    ? `${voicePicker}${renderRailSectionHtml(sections, { voiceRail: voice, knowledgeRail: knowledge, helpRail: help })}`
    : `<p class="pockit-rail-empty">${emptyMsg}</p>`;
  bindRailLoadActions("#player-rail-content");
  bindMacAppRailActions("#player-rail-content");
  bindVoiceRailActions("#player-rail-content");
  bindKnowledgeRailActions("#player-rail-content");
  bindHelpRailActions("#player-rail-content");
  bindVoicePickerRailSync();
  bindPlayerRailActions();
  if (voice) {
    window.PockitRailContext?.detachScrollspy?.();
    syncVoiceRailDrawerLabels();
    highlightVoiceRailSelections(window.ParakeetVoicePad?.getState?.() || {});
  }
  if (knowledge) {
    window.PockitRailContext?.detachScrollspy?.();
    syncKnowledgeRailDrawerLabels();
    highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
  }
  if (help) {
    window.PockitRailContext?.detachScrollspy?.();
    syncVoiceRailDrawerLabels();
    highlightHelpRailSelections(window.PockitHelpConsole?.getState?.() || {});
  } else if (isEncompassIframeConsole(findCassette(currentCassetteId()))) {
    highlightEncompassNav(ENCOMPASS_IFRAME_PATH);
  }
  renderPlayerRailDropdownMount();
  refreshCometTooltips(el);
}

async function renderKnowledgeCassetteRail() {
  const el = document.getElementById("sidebar-content");
  const rail = window.PockitRailContext;
  if (!el || !rail) return;
  const routeAtStart = currentCassetteId();
  const ent = findCatalogEntryByHubId(routeAtStart);
  const sections = await rail.buildKnowledgeRightRailSections(ent);
  if (!isKnowledgeCassetteActive() || currentCassetteId() !== routeAtStart) return;
  el.innerHTML = `${renderRailSectionHtml(sections, { knowledgeRail: true })}<pre class="rail-make-log hidden" id="rail-make-log" aria-live="polite"></pre>`;
  rail.bindMakeActions("#sidebar-content");
  window.KnowledgeRailInfo?.bindInfoButtons?.("#sidebar-content");
  bindKnowledgeRailActions("#sidebar-content");
  highlightKnowledgeRailSelections(window.KnowledgeHud?.getState?.() || {});
  syncKnowledgeRailDrawerLabels();
  ensureSidebarActivePill();
  scheduleSidebarActivePill();
  renderCassetteRailDropdownMount();
  window.PockitQuickBar?.refresh?.();
  refreshCometTooltips(el);
}

async function renderVideoCassetteRail() {
  const el = document.getElementById("sidebar-content");
  const rail = window.PockitRailContext;
  if (!el || !rail) return;
  const routeAtStart = currentCassetteId();
  const ent = findCatalogEntryByHubId(routeAtStart);
  const st = window.ParakeetVideoPad?.getState?.() || window.VideoPad?.getState?.() || {};
  const sections = await rail.buildVideoRightRailSections(st, ent);
  if (!isVideoCassetteActive() || currentCassetteId() !== routeAtStart) return;
  el.innerHTML = `${renderRailSectionHtml(sections, { videoRail: true })}<pre class="rail-make-log hidden" id="rail-make-log" aria-live="polite"></pre>`;
  rail.bindMakeActions("#sidebar-content");
  window.VideoRailInfo?.bindInfoButtons?.("#sidebar-content");
  ensureSidebarActivePill();
  scheduleSidebarActivePill();
  renderCassetteRailDropdownMount();
  window.PockitQuickBar?.refresh?.();
  refreshCometTooltips(el);
}

async function renderVoiceCassetteRail() {
  const el = document.getElementById("sidebar-content");
  const rail = window.PockitRailContext;
  if (!el || !rail) return;
  const routeAtStart = currentCassetteId();
  const ent = findCatalogEntryByHubId(routeAtStart);
  const st = window.ParakeetVoicePad?.getState?.() || {};
  const health = { ...(st.health || st) };
  if (health.healthProbePending !== false) health.healthProbePending = true;
  const sections = await rail.buildVoiceRightRailSections(health, ent);
  if (!isVoiceCassetteActive() || currentCassetteId() !== routeAtStart) return;
  el.innerHTML = `${renderRailSectionHtml(sections, { voiceRail: true })}<pre class="rail-make-log hidden" id="rail-make-log" aria-live="polite"></pre>`;
  rail.bindMakeActions("#sidebar-content");
  window.VoiceRailInfo?.bindInfoButtons?.("#sidebar-content");
  highlightVoiceRailSelections(st);
  syncVoiceRailDrawerLabels();
  ensureSidebarActivePill();
  scheduleSidebarActivePill();
  renderCassetteRailDropdownMount();
  window.PockitQuickBar?.refresh?.();
  refreshCometTooltips(el);
}

async function renderHelpCassetteRail() {
  const el = document.getElementById("sidebar-content");
  const rail = window.PockitRailContext;
  if (!el || !rail) return;
  const routeAtStart = currentCassetteId();
  await window.PockitHelpConsole?.init?.().catch(() => {});
  const st = window.PockitHelpConsole?.getState?.() || {};
  const sections = await rail.buildHelpRightRailSections?.(st) || window.PockitHelpConsole?.buildRightRailSections?.(st) || [];
  if (!isHelpConsoleActive() || currentCassetteId() !== routeAtStart) return;
  el.innerHTML = `${renderRailSectionHtml(sections, { helpRail: true })}<pre class="rail-make-log hidden" id="rail-make-log" aria-live="polite"></pre>`;
  rail.bindMakeActions?.("#sidebar-content");
  bindHelpRailActions("#sidebar-content");
  highlightHelpRailSelections(st);
  syncVoiceRailDrawerLabels();
  ensureSidebarActivePill();
  scheduleSidebarActivePill();
  renderCassetteRailDropdownMount();
  window.PockitQuickBar?.refresh?.();
  refreshCometTooltips(el);
}

function renderCassetteRail() {
  if (isHelpConsoleActive()) {
    renderHelpCassetteRail().catch(() => {
      const el = document.getElementById("sidebar-content");
      if (el) el.innerHTML = `<p class="pockit-rail-empty">Help topics failed to load.</p>`;
    });
    return;
  }
  if (isVoiceCassetteActive()) {
    renderVoiceCassetteRail().catch(() => {
      const el = document.getElementById("sidebar-content");
      if (el) el.innerHTML = `<p class="pockit-rail-empty">Voice commands failed to load.</p>`;
    });
    return;
  }
  if (isVideoCassetteActive()) {
    renderVideoCassetteRail().catch(() => {
      const el = document.getElementById("sidebar-content");
      if (el) el.innerHTML = `<p class="pockit-rail-empty">Video stack failed to load.</p>`;
    });
    return;
  }
  if (isKnowledgeCassetteActive()) {
    renderKnowledgeCassetteRail().catch(() => {
      const el = document.getElementById("sidebar-content");
      if (el) el.innerHTML = `<p class="pockit-rail-empty">Knowledge brain rail failed to load.</p>`;
    });
    return;
  }
  const el = document.getElementById("sidebar-content");
  if (!el) return;
  const weave = buildActiveCassetteWeaveState();
  if (weave) {
    if (weave.emptyRightMessage && !weave.rightSections.some((s) => s.items?.length)) {
      el.innerHTML = `<p class="pockit-rail-empty">${escapeHtml(weave.emptyRightMessage)}</p>`;
    } else {
      el.innerHTML = renderRailSectionHtml(weave.rightSections);
    }
    bindRailLoadActions("#sidebar-content");
    bindMacAppRailActions("#sidebar-content");
    if (isEncompassIframeConsole(findCassette(currentCassetteId()))) {
      highlightEncompassNav(ENCOMPASS_IFRAME_PATH);
    }
  } else {
    const sections = isTape() ? cassetteRailSections() : sidebarCardSections();
    el.innerHTML = renderRailSectionHtml(sections);
    bindRailLoadActions("#sidebar-content");
  }
  ensureSidebarActivePill();
  scheduleSidebarActivePill();
  renderCassetteRailDropdownMount();
  window.PockitQuickBar?.refresh?.();
  refreshCometTooltips(el);
}

function syncPlayerChromeContext(cassette) {
  document.body.classList.toggle("pockit-encompass-console", isEncompassIframeConsole(cassette));
  syncVoiceRailDrawerLabels();
  renderPlayerRail();
  renderCassetteRail();
  if (cassette) highlightActiveSidebarItem(cassette.id);
  window.PockitQuickBar?.bindDragSources?.(document.getElementById("player-rail-content"));
  window.PockitQuickBar?.bindDragSources?.(document.getElementById("sidebar-content"));
  window.PockitQuickBar?.refresh?.();
  renderConsolePickerMounts();
  window.dispatchEvent(new CustomEvent("pockit-player-chrome-change", { detail: { cassetteId: cassette?.id } }));
  refreshPlayerRailDock();
}

function renderSidebar() {
  syncVoiceRailDrawerLabels();
  renderPlayerRail();
  renderCassetteRail();
  window.PockitQuickBar?.bindDragSources?.(document.getElementById("player-rail-content"));
  window.PockitQuickBar?.bindDragSources?.(document.getElementById("sidebar-content"));
  window.PockitQuickBar?.refresh?.();
}

function highlightActiveSidebarItem(id) {
  highlightActiveRails(id);
}

function highlightActiveRails(id) {
  const onOverview = id === "overview";
  const onLibrary = id === "library";
  const onVoice = id === "voice" || id === "voice-cassette";
  const activeGroupId = POCKIT_PLAYER && POCKIT_PLAYER_GROUP
    ? playerGroupNavId(POCKIT_PLAYER, POCKIT_PLAYER_GROUP)
    : null;

  document.querySelectorAll("#player-rail-content .sidebar-item").forEach((el) => {
    const elId = el.getAttribute("data-id");
    let active = false;
    if (onOverview && elId === "overview") active = true;
    if (onLibrary && elId === "library") active = true;
    if (onVoice && (elId === "voice" || elId === "voice-cassette")) active = true;
    if (activeGroupId && elId === activeGroupId) active = true;
    if (POCKIT_MAC_APP && (elId === `mac-app-${POCKIT_MAC_APP}` || (POCKIT_MAC_APP === "accessory-desk" && elId === "accessory-desk"))) active = true;
    el.classList.toggle("active", active);
  });

  document.querySelectorAll("#sidebar-content .sidebar-item").forEach((el) => {
    const elId = el.getAttribute("data-id");
    const lookupIds = id ? [...hubCardLookupIds(id), id] : [];
    const active = lookupIds.includes(elId);
    el.classList.toggle("active", active);
  });

  if (TAPE_SIDEBAR_ITEMS.has(id)) {
    document.querySelectorAll(".sidebar-item--parent").forEach((parent) => {
      const child = parent.querySelector(`[data-id="${id}"]`);
      if (!child) return;
      const submenu = parent.querySelector(".sidebar-submenu");
      parent.classList.add("expanded");
      parent.classList.remove("collapsed");
      if (submenu) submenu.classList.add("is-open");
      parent.classList.toggle("active", false);
      child.classList.add("active");
    });
  }

  if (onLibrary) {
    document.querySelectorAll('.sidebar-item[data-id="library"]').forEach((el) => el.classList.add("active"));
  }

  scheduleSidebarActivePill();
}

// ─── Main frame: cassette renderer ─────────────────────────────────

function centerCanvasClass(cassette, { embed = false } = {}) {
  return embed
    ? "pockit-center-canvas pockit-center-canvas--embed"
    : "pockit-center-canvas pockit-center-canvas--native";
}

function mountCenterCanvas(innerHtml, cassette, { embed = false } = {}) {
  const content = document.getElementById("main-content");
  if (!content) return;
  content.innerHTML = `<div class="${centerCanvasClass(cassette, { embed })}">${innerHtml}</div>`;
}

function renderMainFrame(cassette) {
  const breadcrumb = document.getElementById("main-breadcrumb");
  const newtabBtn = document.getElementById("main-newtab");
  const settingsBtn = document.getElementById("cassette-settings-header");
  const content = document.getElementById("main-content");
  if (!content) return;
  if (!mainContentMatchesCassette(cassette)) {
    beginMainViewSwap();
  }
  if (window.PockitViewport?.isWatch?.()) {
    window.PockitWatchCompanion?.showCompanion?.();
    finishMainFrameRender(cassette || { id: "overview", type: "overview", title: "Pockit" });
    return;
  }
  const playback = tapePlaybackSrc(cassette);
  setTapeBodyMode(cassette);
  syncTapesUiChrome();
  if (breadcrumb) breadcrumb.innerHTML = renderTowerBreadcrumb(cassette);
  syncHubBackButton(cassette);
  refreshTowerStatusRail(cassette);
  syncChromeHiddenChip();
  const substrateId = catalogueIdForHubCard(cassette.id);
  if (settingsBtn) {
    const onOverview = cassette.type === "overview" || cassette.id === "overview";
    const showSettings =
      onOverview ||
      (cassette.type !== "library" && cassette.id !== "changelog");
    settingsBtn.classList.toggle("hidden", !showSettings);
    window.PockitShellLayout?.setWidgetHidden?.("cassette-settings", !showSettings);
    if (showSettings) {
      settingsBtn.setAttribute(
        "data-substrate-id",
        onOverview ? (window.PockitConfig?.POCKIT_SETTINGS_ID || "pockit") : substrateId,
      );
    } else {
      settingsBtn.removeAttribute("data-substrate-id");
    }
  }
  syncMainNewTabButton(cassette, newtabBtn);
  if (cassette.type === "overview") {
    if (mainContentMatchesCassette(cassette)) {
      bindPockitFilter();
      bindRailLoadActions("#main-content");
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderOverview(), cassette);
    bindPockitFilter();
    bindRailLoadActions("#main-content");
    finishMainFrameRender(cassette);
    return;
  }
  if (cassette.id === "suite-welcome" || cassette.type === "suite-welcome") {
    prepareHelpConsoleContext(cassette);
    const paintHelp = async () => {
      let html = `<div class="loading">Loading Help Guide…</div>`;
      try {
        if (window.PockitHelpConsole?.render) {
          html = await window.PockitHelpConsole.render();
        } else if (window.PockitSuite?.renderWelcome) {
          html = window.PockitSuite.renderWelcome();
        }
      } catch {
        html = `<div class="pockit-help-console"><p>Help Guide failed to load — hard refresh.</p></div>`;
      }
      if (currentCassetteId() !== "suite-welcome") return;
      mountCenterCanvas(html, cassette);
      bindHelpActions();
      if (settingsBtn) {
        settingsBtn.classList.add("hidden");
        window.PockitShellLayout?.setWidgetHidden?.("cassette-settings", true);
      }
      if (newtabBtn) {
        newtabBtn.classList.add("hidden");
        window.PockitShellLayout?.setWidgetHidden?.("new-tab", true);
      }
      if (breadcrumb) {
        breadcrumb.innerHTML = renderTowerBreadcrumb({
          id: "suite-welcome",
          title: "Help Guide",
          type: "suite-welcome",
          glyph: "💡",
        });
      }
      finishMainFrameRender(cassette);
    };
    if (mainContentMatchesCassette(cassette)) {
      bindHelpActions();
      if (breadcrumb) {
        breadcrumb.innerHTML = renderTowerBreadcrumb({
          id: "suite-welcome",
          title: "Help Guide",
          type: "suite-welcome",
          glyph: "💡",
        });
      }
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(`<div class="loading">Loading Help Guide…</div>`, cassette);
    paintHelp().catch(() => {
      if (currentCassetteId() !== "suite-welcome") return;
      mountCenterCanvas(`<div class="pockit-help-console"><p>Help Guide failed to load.</p></div>`, cassette);
      finishMainFrameRender(cassette);
    });
    return;
  }
  if (isVoiceHubCard(cassette) || cassette.type === "voice") {
    prepareVoicePadContext(cassette);
    clearVideoPadContextIfNeeded(cassette);
    if (mainContentMatchesCassette(cassette)) {
      bindVoiceActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderVoicePad(), cassette);
    bindVoiceActions();
    finishMainFrameRender(cassette);
    return;
  }
  if (isVideoHubCard(cassette) || cassette.type === "video") {
    prepareVideoPadContext(cassette);
    clearVoicePadContextIfNeeded(cassette);
    if (mainContentMatchesCassette(cassette)) {
      bindVideoActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderVideoPad(), cassette);
    bindVideoActions();
    finishMainFrameRender(cassette);
    return;
  }
  if (isKnowledgeHubCard(cassette) || cassette.type === "knowledge") {
    if (mainContentMatchesCassette(cassette)) {
      bindKnowledgeActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderKnowledgeHud(), cassette);
    bindKnowledgeActions();
    finishMainFrameRender(cassette);
    return;
  }
  if (isPromptLibraryHubCard(cassette) || cassette.type === "prompt-library") {
    if (mainContentMatchesCassette(cassette)) {
      bindPromptLibraryActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderPromptLibrary(), cassette);
    bindPromptLibraryActions();
    finishMainFrameRender(cassette);
    return;
  }
  if (isFamilyDeskHubCard(cassette) || cassette.type === "family-desk") {
    if (mainContentMatchesCassette(cassette)) {
      bindFamilyDeskActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderFamilyDesk(), cassette);
    bindFamilyDeskActions();
    if (window.PockitFamilyDesk?.refresh) {
      window.PockitFamilyDesk.refresh().catch(() => {});
    }
    finishMainFrameRender(cassette);
    return;
  }
  if (isShipIntegrityHubCard(cassette) || cassette.type === "ship-integrity") {
    if (mainContentMatchesCassette(cassette)) {
      bindShipIntegrityActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderShipIntegrity(), cassette);
    bindShipIntegrityActions();
    if (window.PockitShipIntegrity?.runCheck) {
      window.PockitShipIntegrity.runCheck().catch(() => {});
    }
    finishMainFrameRender(cassette);
    return;
  }
  if (isQuickDeskHubCard(cassette) || cassette.type === "quick-desk") {
    if (mainContentMatchesCassette(cassette)) {
      bindQuickDeskActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderQuickDesk(), cassette);
    bindQuickDeskActions();
    if (window.PockitQuickDeskPanel?.refresh) {
      window.PockitQuickDeskPanel.refresh().catch(() => {});
    }
    finishMainFrameRender(cassette);
    return;
  }
  if (isConfigurationsHubCard(cassette) || cassette.type === "configurations") {
    if (mainContentMatchesCassette(cassette)) {
      bindConfigurationsCenterActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderConfigurationsCenter(), cassette);
    bindConfigurationsCenterActions();
    if (window.PockitConfigurationsCenter?.refresh) {
      window.PockitConfigurationsCenter.refresh().catch(() => {});
    }
    finishMainFrameRender(cassette);
    return;
  }
  if (isAccessoryDeskHubCard(cassette) || cassette.type === "accessory-desk") {
    if (mainContentMatchesCassette(cassette)) {
      bindAccessoryDeskActions();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderAccessoryDesk(), cassette);
    bindAccessoryDeskActions();
    if (window.PockitAccessoryDeskPanel?.refresh) {
      window.PockitAccessoryDeskPanel.refresh().catch(() => {});
    }
    finishMainFrameRender(cassette);
    return;
  }
  if (isOdysseusHubCard(cassette) || cassette.type === "odysseus" || isEncompassNativePad(cassette)) {
    mountCenterCanvas(renderOdysseusPad(), cassette);
    bindOdysseusActions();
    finishMainFrameRender(cassette);
    return;
  }
  if (cassette.type === "library") {
    if (mainContentMatchesCassette(cassette)) {
      bindLibraryActions();
      bindPockitFilter();
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(renderLibrary(), cassette);
    bindLibraryActions();
    bindPockitFilter();
    finishMainFrameRender(cassette);
    return;
  }
  if (cassette.type === "smoke-checklist") {
    mountCenterCanvas(renderSmokeChecklist(), cassette);
    bindSmokeChecklistActions();
    finishMainFrameRender(cassette);
    return;
  }
  const canEmbedPlayback = playback && (
    cassette.iframe !== false ||
    cassette._play_shell ||
    tapeOpenPath(cassette) ||
    (isTape() && String(playback).startsWith("/"))
  );
  if (canEmbedPlayback) {
    const door = resolveCrossDoorIframeSrc(playback);
    if (door.async) {
      const iframeRouteId = canonicalHashCassetteId(cassette.id);
      pendingIframeMountRouteId = iframeRouteId;
      mountCenterCanvas(embedLoadingHtml(), cassette, { embed: true });
      mountFamilyCassetteIframe(playback, iframeRouteId, cassette);
      finishMainFrameRender(cassette);
      return;
    }
    mountCenterCanvas(embedLoadingHtml(), cassette, { embed: true });
    const canvas = embedCanvasEl(content);
    if (canvas) mountIframeHolderInCanvas(canvas, door.src || playback, { canonical: door.absolute });
    finishMainFrameRender(cassette);
    return;
  }
  if (cassette.url && cassette.iframe && !isPockitShellUrl(cassette.url)) {
    mountCenterCanvas(`
      <div class="iframe-holder">
        <iframe class="tape-frame" data-tape-frame="1" id="cassette-iframe" src="${cassette.url}" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="strict-origin"></iframe>
        <div class="iframe-fallback hidden" id="iframe-fallback">
          <h2>Best viewed directly</h2>
          <p>The service at <code>${escapeHtml(cassette.url)}</code> blocks iframes (X-Frame-Options / CSP).
          You can still open it directly — your session is shared across all jailynmarvin.com surfaces.</p>
          <a class="primary" href="${cassette.url}" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
        </div>
      </div>
    `, cassette, { embed: true });
    // Detect iframe load failure (timeout + 'load' event check)
    const iframe = document.getElementById("cassette-iframe");
    let loaded = false;
    iframe.addEventListener("load", () => { loaded = true; });
    setTimeout(() => {
      if (!loaded) showIframeFallback();
    }, 6000);
    finishMainFrameRender(cassette);
    return;
  }
  // External (non-iframe) cassette: render a "open" panel
  mountCenterCanvas(`
    <div class="open-panel">
      <span class="open-glyph">${hubIcon(cassette)}</span>
      <h2>${escapeHtml(cassette.title)}</h2>
      <p>${escapeHtml(cassette.subtitle || "")}</p>
      <p class="url"><code>${escapeHtml(cassette.url)}</code></p>
      <a class="primary" href="${cassette.url}" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
      <p class="hint">External services (GitLab, GitHub) block iframes — opens in a new tab. Your Family Office session rides along.</p>
    </div>
  `, cassette);
  finishMainFrameRender(cassette);
}

function showIframeFallback() {
  const fb = document.getElementById("iframe-fallback");
  if (fb) fb.classList.remove("hidden");
}

function libraryTapeByCardId(cardId) {
  if (!FRAMEWORK_LIBRARY?.tapes) return null;
  return FRAMEWORK_LIBRARY.tapes.find(
    (t) => t.id === cardId || t.hub_card_id === cardId,
  );
}

function renderLibraryHealthStrip() {
  return `<div class="library-health tower-status-rail" id="library-health" aria-live="polite">
    ${renderHealthStatusTag("Checking home", "pending")}
  </div>`;
}

function renderCatalogCassetteCard(c, webOrigin, cardIndex = 0) {
  const hubId = c.hub_card_id || c.id;
  const pin = findInHubCards(hubId) || findInHubCards(c.id);
  const home = c.family_url;
  const away = c.web_url || pin?.url || webOrigin;
  const delay = cardIndex * 24;
  return `
    <article class="library-card library-card--tape comet-enter" data-cassette-id="${escapeHtml(c.id)}" style="--comet-delay:${delay}ms">
      <header>
        <span class="library-glyph">${hubIcon(c)}</span>
        <div>
          <h3>${escapeHtml(c.name || c.id)}</h3>
          <span class="role-chip role-chip--tape">cassette</span>
        </div>
      </header>
      ${c.niche ? `<p class="library-meta">${escapeHtml(c.niche)}</p>` : ""}
      <div class="library-actions library-actions--primary">
        ${home ? `<a class="library-open-door primary family-door-link" href="${escapeHtml(home)}">Open at home ↗</a>` : ""}
        ${away ? `<a class="library-open-door secondary family-door-link" href="${escapeHtml(away)}" target="_blank" rel="noopener noreferrer">Open on web ↗</a>` : ""}
        <button type="button" class="library-load comet-btn comet-btn--primary" data-tape-id="${escapeHtml(c.id)}" data-hub-id="${escapeHtml(hubId)}">Load in hub</button>
      </div>
      ${c.boot_command ? `<details class="library-operator"><summary>Operator boot</summary><code class="library-cmd">${escapeHtml(c.boot_command)}</code></details>` : ""}
    </article>`;
}

function catalogEntryMatchesFilter(entry, query, fields) {
  if (!query) return true;
  const surfaceBits = (entry.surface?.nav || []).map((n) => `${n.label} ${n.id} ${n.path || ""}`);
  const hay = [...fields(entry).filter(Boolean), ...surfaceBits].join(" ").toLowerCase();
  const tokens = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => hay.includes(t));
}

function renderLibrary() {
  if (!FRAMEWORK_LIBRARY && !POCKIT_CATALOG) {
    return `<div class="library-empty"><p>Framework library unavailable. Start Pockit with <strong>make pockit</strong> or tower-api.</p></div>`;
  }
  const catalog = POCKIT_CATALOG;
  const lib = FRAMEWORK_LIBRARY;
  const dir = catalog?.family_directory || lib?.family_directory;
  const webOrigin = catalog?.web_origin || lib?.web_origin || "https://jailynmarvin.com";
  const noviceRule = catalog?.novice_rule || lib?.novice_rule || "Tap your tape. Sign in once. Same login everywhere.";
  const filterQ = POCKIT_FILTER.trim();
  let libraryCardIndex = 0;

  const players = (catalog?.players || []).filter((p) =>
    catalogConsoleProjectable(p) &&
    (!POCKIT_PLAYER || POCKIT_PLAYER === p.id) &&
    catalogEntryMatchesFilter(p, filterQ, (x) => [x.name, x.niche, x.id, x.boot_command]) &&
    catalogEntryMatchesScope(p, POCKIT_SCOPE),
  );
  const playerCards = players.map((p) => {
    const delay = libraryCardIndex++ * 24;
    const projection = consoleProjectionHref(p);
    const projectionLabel = p.id === "nephew-deck" ? "Open Control Tower · Projection" : `Open ${p.name} · Projection`;
    return `
    <article class="library-card library-card--player comet-enter" id="catalog-player-${escapeHtml(p.id)}" style="--comet-delay:${delay}ms">
      <header>
        <span class="library-glyph">${hubIcon(p)}</span>
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <span class="role-chip role-chip--console">console</span>
        </div>
      </header>
      <p class="library-meta">${escapeHtml(p.niche || "Family Office console")} · ${p.hosted_count} cartridge(s)${p.port ? ` · :${p.port}` : ""}</p>
      <div class="library-actions library-actions--primary">
        <button type="button" class="library-console-view comet-btn comet-btn--primary" data-action="console-view" data-player-id="${escapeHtml(p.id)}">Console view</button>
        ${projection ? `<a class="library-open-door secondary family-door-link" href="${escapeHtml(projection)}" target="_blank" rel="noopener noreferrer">${escapeHtml(projectionLabel)} ↗</a>` : ""}
        <button type="button" class="library-console-cartridges comet-btn comet-btn--ghost" data-action="console-cartridges" data-player-id="${escapeHtml(p.id)}">Cartridges</button>
      </div>
      ${p.boot_command ? `<details class="library-operator"><summary>Operator</summary><code class="library-cmd">${escapeHtml(p.boot_command)}</code></details>` : ""}
    </article>
  `;
  }).join("");

  const playerSections = players
    .map((p) => {
      const hosted = (p.hosted_cassettes || []).filter((c) =>
        catalogEntryMatchesFilter(c, filterQ, (x) => [x.name, x.niche, x.id, x.boot_command]) &&
        catalogEntryMatchesScope(c, POCKIT_SCOPE),
      );
      if (!hosted.length) return "";
      return `
    <section class="library-section library-section--player" id="catalog-tapes-${escapeHtml(p.id)}">
      <header class="overview-section-head">
        <h3><span class="library-glyph-inline">${hubIcon(p)}</span> ${escapeHtml(p.name)}</h3>
        <span class="overview-section-count">${hosted.length}</span>
      </header>
      <p class="library-player-niche">${escapeHtml(p.niche || "")}</p>
      <div class="library-grid">${hosted.map((c) => renderCatalogCassetteCard(c, webOrigin, libraryCardIndex++)).join("")}</div>
    </section>`;
    })
    .filter(Boolean)
    .join("");

  const unassigned = (catalog?.unassigned_cassettes || [])
    .filter((c) => catalogEntryMatchesFilter(c, filterQ, (x) => [x.name, x.niche, x.id, x.boot_command]) && catalogEntryMatchesScope(c, POCKIT_SCOPE))
    .map((c) => renderCatalogCassetteCard(c, webOrigin, libraryCardIndex++))
    .join("");
  const legacyTapeCards = (!catalog && lib?.tapes ? lib.tapes : []).map((t) => {
    const home = t.family_url;
    const away = t.web_url || webOrigin;
    return `
    <article class="library-card library-card--tape">
      <header>
        <span class="library-glyph">${hubIcon(t)}</span>
        <div>
          <h3>${escapeHtml(t.name)}</h3>
          <span class="role-chip role-chip--tape">cassette</span>
        </div>
      </header>
      <div class="library-actions library-actions--primary">
        ${home ? `<a class="library-open-door primary family-door-link" href="${escapeHtml(home)}">Open at home ↗</a>` : ""}
        <a class="library-open-door secondary family-door-link" href="${escapeHtml(away)}" target="_blank" rel="noopener noreferrer">Open on web ↗</a>
        <button type="button" class="library-load comet-btn comet-btn--primary" data-tape-id="${escapeHtml(t.id)}" data-hub-id="${escapeHtml(t.hub_card_id || t.id)}">Load in hub</button>
      </div>
    </article>`;
  }).join("");

  const cassetteSections = playerSections || (legacyTapeCards ? `<section class="library-section"><div class="library-grid">${legacyTapeCards}</div></section>` : "");
  const emptyFilter = filterQ && !playerCards && !cassetteSections && !unassigned
    ? `<p class="pockit-empty-filter">No catalog entries match “${escapeHtml(filterQ)}”.</p>`
    : "";

  return `
    <div class="library-page">
      <header class="library-header">
        <h2>${antIcon("BookOutlined")} Consoles &amp; Cartridges</h2>
        <p class="library-novice"><strong>${escapeHtml(noviceRule)}</strong> Each console has a <strong>Console view</strong> in Pockit and a <strong>Projection</strong> door.</p>
        ${renderLibraryHealthStrip()}
        ${pockitFilterBar("Search consoles & cartridges…")}
        ${emptyFilter}
        ${dir?.family_url ? `<p class="library-directory"><a class="library-open-door primary family-door-link" href="${escapeHtml(dir.family_url)}">Open tape grid at home ↗</a>${dir.family_wifi_url ? ` · <span class="library-wifi-hint">Wi‑Fi: ${escapeHtml(dir.family_wifi_url)}</span>` : ""}</p>` : `<p class="library-directory">Home grid not running — use <a href="${escapeHtml(webOrigin)}/">family site</a> or ask a grown-up to run <strong>make pockit</strong>.</p>`}
        <div class="library-stats tower-status-rail" aria-label="Catalog summary">
          ${renderStatusTag(`${catalog?.player_count ?? (lib?.players || []).length} consoles`, "default")}
          ${renderStatusTag(`${catalog?.cassette_count ?? (lib?.tapes || []).length} cartridges`, "default")}
        </div>
      </header>
      <section class="library-section">
        <header class="overview-section-head">
          <h3>Consoles</h3>
          <span class="overview-section-count">${players.length || (lib?.players || []).length}</span>
        </header>
        <div class="library-grid">${playerCards || (lib?.players || []).map((p) => `<article class="library-card library-card--player"><h3>${escapeHtml(p.name)}</h3><p class="library-meta">${escapeHtml(p.niche || "")}</p></article>`).join("")}</div>
      </section>
      <section class="library-section">
        <header class="overview-section-head">
          <h3>Cartridges by console</h3>
          <span class="overview-section-count">${catalog?.cassette_count ?? ""}</span>
        </header>
        ${cassetteSections || '<p class="library-empty">No cartridges cataloged yet.</p>'}
        ${unassigned ? `<section class="library-section"><h3>Other cartridges</h3><div class="library-grid">${unassigned}</div></section>` : ""}
      </section>    </div>
  `;
}


function bindLibraryActions() {
  const healthEl = document.getElementById("library-health");
  if (healthEl) {
    fetch("http://tapes.localhost:8782/family-health.json", { mode: "cors" })
      .then((r) => r.json())
      .then((h) => {
        healthEl.innerHTML = renderHealthStatusPills(h.checks);
      })
      .catch(() => {
        healthEl.innerHTML = renderHealthStatusTag("Home grid", "error") + renderHealthStatusTag("Family site", "success", { href: "https://jailynmarvin.com/" });
      });
  }
  document.querySelectorAll(".library-load").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hubId = btn.getAttribute("data-hub-id");
      if (hubId && findCassette(hubId)) setCassette(hubId);
      else {
        const tapeId = btn.getAttribute("data-tape-id");
        const ent = FRAMEWORK_BY_ID.get(tapeId);
        const cardId = ent?.hub_card_id || tapeId;
        if (findCassette(cardId)) setCassette(cardId);
      }
    });
  });
  document.querySelectorAll("[data-action=console-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const playerId = btn.getAttribute("data-player-id");
      if (playerId) openConsoleConsoleView(playerId);
    });
  });
  document.querySelectorAll("[data-action=console-cartridges]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const playerId = btn.getAttribute("data-player-id");
      if (playerId) openPlayerHome(playerId);
    });
  });
}

function sectionSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function overviewStats(hosted, filterQ = "") {
  if (POCKIT_CATALOG?.players) {
    let total = 0;
    let playerSections = 0;
    const players = POCKIT_CATALOG.players.filter((p) => !POCKIT_PLAYER || POCKIT_PLAYER === p.id);
    for (const p of players) {
      const count = catalogPlayerVisibleCount(p, hosted);
      if (!count) continue;
      playerSections += 1;
      total += count;
    }
    if (!POCKIT_PLAYER || POCKIT_PLAYER === "_unassigned") {
      const un = (POCKIT_CATALOG.unassigned_cassettes || []).filter((c) => {
        const hubId = c.hub_card_id || c.id;
        if (hosted?.size && !hosted.has(hubId)) return false;
        const card = hubCardById(hubId) || catalogEntryToHubCard(c);
        if (!card) return false;
        if (!cardMatchesScope(card, POCKIT_SCOPE)) return false;
        if (filterQ && !cardMatchesFilter(card, filterQ)) return false;
        return true;
      }).length;
      if (un) {
        playerSections += 1;
        total += un;
      }
    }
    return {
      total,
      sections: playerSections,
      playerCount: POCKIT_CATALOG.player_count,
      catalogCassettes: POCKIT_CATALOG.cassette_count,
    };
  }
  let total = 0;
  let sections = 0;
  CARDS.filter((s) => s.section !== "Home").forEach((sec) => {
    const items = hosted?.size ? sec.items.filter((c) => hosted.has(c.id)) : sec.items;
    if (items.length) {
      sections += 1;
      total += items.length;
    }
  });
  const playerCount = POCKIT_CATALOG?.player_count ?? null;
  const catalogCassettes = POCKIT_CATALOG?.cassette_count ?? null;
  return { total, sections, playerCount, catalogCassettes };
}

function pockitGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function familyWifiUrl() {
  if (!isTape()) return null;
  return POCKIT_CATALOG?.family_directory?.family_wifi_url || null;
}

/** KVM-style dropdown — Wi-Fi QR hidden until opened (not inline on overview). */
function pockitWifiDropdownHtml() {
  const wifiUrl = familyWifiUrl();
  if (!wifiUrl) return "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiUrl)}`;
  return `
  <div class="comet-dropdown comet-dropdown--wifi" id="pockit-wifi-dropdown">
    <button type="button" class="comet-dropdown-trigger comet-dropdown-trigger--wifi" aria-haspopup="dialog" aria-expanded="false" title="Family Wi‑Fi — URL + QR">
      <span class="comet-dropdown-trigger-glyph" aria-hidden="true">${antIcon("WifiOutlined")}</span>
      <span class="comet-dropdown-trigger-label">Family Wi‑Fi</span>
      <span class="comet-dropdown-chevron" aria-hidden="true">${antIcon("DownOutlined")}</span>
    </button>
    <div class="comet-dropdown-panel comet-dropdown-panel--wifi comet-menu-cascader" role="dialog" aria-label="Family Wi-Fi" hidden>
      <div class="hub-wifi-dropdown-body">
        <img class="hub-wifi-qr" src="${qrSrc}" width="140" height="140" alt="QR code for family Wi-Fi URL" loading="lazy" />
        <div class="hub-wifi-copy">
          <strong>On family Wi‑Fi</strong>
          <p class="wifi-url"><a href="${escapeHtml(wifiUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(wifiUrl)}</a></p>
          <p class="wifi-hint">Scan or open on another device on the same network.</p>
        </div>
      </div>
    </div>
  </div>`;
}


function overviewFooterMeta() {
  const hosted = pockitTapeHostedIds();
  const filterQ = POCKIT_FILTER.trim();
  let visibleTotal = 0;
  if (POCKIT_CATALOG?.players) {
    visibleTotal = renderOverviewByPlayers(hosted, filterQ).visibleTotal;
  } else {
    visibleTotal = renderOverviewByHubSections(hosted, filterQ).visibleTotal;
  }
  const stats = overviewStats(hosted, filterQ);
  const activePlayer = POCKIT_PLAYER
    ? (POCKIT_CATALOG?.players || []).find((p) => p.id === POCKIT_PLAYER)
    : null;
  return { visibleTotal, filterQ, activePlayer, stats };
}

function footerScopeForCassette(cassette) {
  if (window.ParakeetVoicePad?.getState?.()?.conversation) return "voice";
  if (cassette?.type === "voice" || cassette?.id === "voice" || cassette?.id === "voice-cassette") return "voice";
  if (cassette?.type === "video" || cassette?.id === "video" || cassette?.id === "video-cassette") return "video";
  if (cassette?.type === "library" || cassette?.id === "library") return "library";
  if (!cassette || cassette.type === "overview" || cassette.id === "overview") return "overview";
  if (POCKIT_PLAYER && POCKIT_PLAYER !== "pockit") return `player:${POCKIT_PLAYER}`;
  return cassette.id || "overview";
}

const SHELL_FOOTER_COPYRIGHT = "© 2026 Learn Mappers LLC DBA AVERY GOODMAN";

function refreshIntentFooterAffordances() {
  const proto = window.NephewMacAppIntent?.getActiveProto?.();
  const scope = window.__pockitFooterScope;
  const tipEl = document.getElementById("pockit-intent-invariant");
  const labelEl = document.getElementById("shell-intent-pill-label");
  const displayName =
    scope === "voice" ? "Super Rick" : scope === "video" ? "Super Rick Video" : proto?.displayName;
  if (labelEl && displayName && (scope === "voice" || scope === "video")) {
    labelEl.textContent = "Intent";
  }
  if (tipEl && displayName) {
    tipEl.setAttribute(
      "data-comet-tip",
      cometTipAttr(`${displayName} intent\nIntention · success criteria · why guide`),
    );
  }
  refreshCometTooltips(document.getElementById("main-footer"));
}

function bindShellFooterInteractions(el, cassette) {
  const scope = footerScopeForCassette(cassette);
  window.__pockitFooterScope = scope;
  window.PadSurface?.bindChangelogLinks?.(el);
  window.PockitPlayerContextPills?.bind?.(el, scope);
  window.PockitPlayerContextPills?.bindFooterControls?.(el, scope);
  bindMacAppRailActions("#main-footer");
  const intentAppId = scope === "voice" ? "voice" : scope === "video" ? "video" : null;
  if (intentAppId && window.NephewMacAppIntent?.mount) {
    void window.NephewMacAppIntent.mount(intentAppId);
  }
  refreshIntentFooterAffordances();
  window.dispatchEvent(new CustomEvent("pockit-footer-scope-change", { detail: { scope } }));
}

function mainShellFooterInner(cassette, meta = {}) {
  const hubVer = pockitSurfaceVersion();
  const pockitLabel = pockitSurfaceLabel();
  const pillScope = footerScopeForCassette(cassette);
  const footerControls = window.PockitPlayerContextPills?.renderFooterControls?.(pillScope) || "";
  const statusRectangles = window.PockitPlayerContextPills?.render?.(pillScope) || "";
  const changelogTip = `${pockitLabel} v${hubVer}\nPockit changelog — tower-api + Voice + Intent tabs`;
  const intentTip = "App intent\nWhy · problem · what it does for you";
  const isVoice = pillScope === "voice";
  const pillsRow = isTape() && footerControls
    ? `<div class="shell-footer-pills" id="main-footer-pills" aria-label="Player actions">
        <div class="shell-footer-pills__inner">
          ${footerControls}
          ${isVoice ? `<span class="shell-voice-tagline" id="voice-footer-tagline">Holler + Kokoro · open-source premium · M5 edge + DGX</span><span class="shell-voice-status" id="voice-footer-status" aria-live="polite"></span>` : ""}
        </div>
      </div>`
    : "";
  const rectanglesRow = isTape() && statusRectangles
    ? `<div class="shell-footer-rectangles" id="main-footer-rectangles" aria-label="System status">
        ${statusRectangles}
      </div>`
    : "";
  const versionsRow = isTape()
    ? `<div class="shell-footer-versions shell-footer-versions--split comet-status-bar comet-status-bar--main" aria-label="Release versions">
        <span class="shell-footer-copy" id="shell-footer-copyright">${escapeHtml(SHELL_FOOTER_COPYRIGHT)}</span>
        <div class="shell-footer-versions__center shell-footer-versions__center--dual">
          <button type="button" id="pockit-version-invariant" class="pockit-version-invariant shell-version-btn" data-action="pad-changelog" data-changelog-open-tab="pockit" data-comet-tip="${cometTipAttr(changelogTip)}">
            <span class="shell-version-btn__dot" aria-hidden="true"></span>
            <span class="shell-version-btn__label">${escapeHtml(pockitLabel)} v${escapeHtml(String(hubVer))}</span>
          </button>
          <button type="button" id="pockit-intent-invariant" class="pockit-intent-invariant shell-version-btn shell-version-btn--intent" data-action="pad-changelog" data-changelog-open-tab="mac-app-intent" data-comet-tip="${cometTipAttr(intentTip)}">
            <span class="shell-version-btn__dot shell-version-btn__dot--intent" aria-hidden="true"></span>
            <span class="shell-version-btn__label" id="shell-intent-pill-label">Intent</span>
          </button>
        </div>
        <span class="shell-footer-versions__balance" aria-hidden="true"></span>
      </div>`
    : "";
  const healthRow = !isTape() && (cachedHealthPillsHtml || renderShellHealthPill("Family tapes", "pending"))
    ? `<div class="shell-footer-health" id="main-footer-health" aria-label="Family tape health">${cachedHealthPillsHtml || renderShellHealthPill("Family tapes", "pending")}</div>`
    : "";
  return `
    <div class="pockit-layout-row pockit-layout-row--footer" data-layout-row="footer-inner">
    <div class="shell-footer-stack" data-widget="shell-footer">
      ${pillsRow}
      ${rectanglesRow}
      ${healthRow}
      ${versionsRow}
    </div>
    </div>`;
}

function shellFooterKeepsChrome(cassette) {
  if (!cassette) return true;
  const chromeTypes = new Set(["overview", "library", "smoke-checklist", "voice", "video"]);
  return chromeTypes.has(cassette.type) || chromeTypes.has(cassette.id);
}

function refreshMainShellFooter(cassette, meta = {}) {
  const el = document.getElementById("main-footer");
  if (!el) return;
  const bindFooter = () => bindShellFooterInteractions(el, cassette);
  if (document.body.classList.contains("hero-mode")) {
    document.body.classList.remove("cassette-active");
    el.hidden = true;
    el.innerHTML = "";
    syncFooterVersionChrome();
    return;
  }
  if (cassette?.id === "suite-welcome" || cassette?.type === "suite-welcome") {
    document.body.classList.remove("cassette-active");
    el.hidden = false;
    el.innerHTML = mainShellFooterInner(cassette, meta);
    bindFooter();
    syncFooterVersionChrome();
    window.PockitSurface?.syncFloatedBadgeOffset?.();
    return;
  }
  const isOverview = !cassette || cassette.type === "overview" || cassette.id === "overview";
  document.body.classList.toggle(
    "cassette-active",
    isTape() && cassette && !isOverview && !shellFooterKeepsChrome(cassette),
  );
  if (isTape()) {
    const footerMeta = isOverview ? { ...overviewFooterMeta(), ...meta } : meta;
    el.hidden = false;
    el.innerHTML = mainShellFooterInner(cassette, footerMeta);
    bindFooter();
    syncFooterVersionChrome();
    window.PockitSurface?.syncFloatedBadgeOffset?.();
    return;
  }
  document.body.classList.remove("cassette-active");
  const footerMeta = isOverview ? { ...overviewFooterMeta(), ...meta } : meta;
  el.hidden = false;
  el.innerHTML = mainShellFooterInner(cassette, footerMeta);
  bindFooter();
  syncFooterVersionChrome();
  window.PockitSurface?.syncFloatedBadgeOffset?.();
}

function refreshPlayerRailDock() {
  const dock = document.querySelector(".player-rail-dock");
  if (!dock) return;
  let bar = dock.querySelector(".rail-dock-bar--console");
  const playerId = POCKIT_PLAYER && POCKIT_PLAYER !== "pockit" ? POCKIT_PLAYER : "";
  if (!playerId || !isTape()) {
    bar?.remove();
    return;
  }
  const player = catalogPlayerById(playerId);
  if (!player) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "rail-dock-bar rail-dock-bar--console";
    const accountBar = dock.querySelector(".rail-dock-bar--account");
    dock.insertBefore(bar, accountBar || null);
  }
  const hue = consoleElementHue(playerId, player);
  const sym = consoleElementSymbol(player.name || playerId);
  const label = pockitDisplayLabel(playerId);
  bar.innerHTML = `<div class="shell-player-console-badge" data-player-id="${escapeHtml(playerId)}" style="--player-accent: hsl(${hue} 65% 52%)">
      <span class="shell-player-console-badge__symbol" aria-hidden="true">${escapeHtml(sym)}</span>
      <span class="shell-player-console-badge__label">${escapeHtml(label)}</span>
    </div>`;
  refreshCometTooltips(bar);
}

function refreshCassetteRailDock() {
  window.PockitSurface?.syncVersionBadgePlacement?.();
  window.PockitSurface?.ensureInvariantVersionBadge?.();
}

function finishMainFrameRender(cassette, meta = {}) {
  const routeId = cassette?.id ? canonicalHashCassetteId(cassette.id) : null;
  const mountPending = Boolean(routeId && pendingIframeMountRouteId === routeId);
  if (meta.settled !== false && !mountPending && routeId) {
    lastSettledRouteId = routeId;
    persistPockitLastRoute(routeId);
    releaseSetCassetteInFlight(routeId);
  }
  if (isEncompassIframeConsole(cassette)) {
    queueMicrotask(async () => {
      const cat = findCatalogEntryByHubId(cassette.id);
      const manifestId = cat?.id || cassette.id || "ext-archive";
      await ensureEncompassManifest(manifestId);
      resetEncompassIframeRoute(cassette);
      renderPlayerRail();
      renderCassetteRail();
      refreshMainShellFooter(cassette, meta);
    });
  } else {
    ENCOMPASS_ACTIVE_CASSETTE = null;
    document.body.classList.remove("pockit-encompass-console");
  }
  syncPlayerChromeContext(cassette);
  window.PockitShellLayout?.syncToolbarMode?.(cassette);
  refreshMainShellFooter(cassette, meta);
  addCassetteTopSubMenu(cassette);
  hydrateRailToggles();
  syncChromeHiddenChip();
  refreshCassetteRailDock();
  window.PockitQuickBar?.refresh?.();
  window.PadSurface?.syncFloatedBadgeOffset?.();
  syncFooterVersionChrome();
  refreshCometTooltips(document.getElementById("main-content"));
  refreshCometTooltips(document.getElementById("player-rail-content"));
  refreshCometTooltips(document.getElementById("sidebar-content"));
  refreshCometTooltips(document.getElementById("main-footer"));
  const wiringHubIds = new Set(["wordpress-dashboard", "wordpress"]);
  const hubId = catalogueIdForHubCard(cassette?.id);
  if (
    !isTape() &&
    cassette?.id &&
    (wiringHubIds.has(cassette.id) || wiringHubIds.has(hubId))
  ) {
    queueMicrotask(() => {
      const content = document.getElementById("main-content");
      if (content && !document.getElementById("pockit-wiring-pills")) {
        const mount = document.createElement("div");
        mount.innerHTML = renderFrameworkWiringPillsMarkup();
        if (mount.firstElementChild) content.prepend(mount.firstElementChild);
      }
      refreshFrameworkWiringPills("wordpress");
    });
  }
  if (window.PockitViewport?.isMobileShell?.()) {
    window.PockitPhoneShell?.enforcePhoneChrome?.();
    requestAnimationFrame(() => window.PockitPhoneShell?.syncMobileCanvasHeight?.());
  }
}

function renderSmokeChecklist() {
  if (!POCKIT_CATALOG?.players) {
    return `<div class="pockit"><p class="pockit-empty-filter">Pockit catalog not loaded.</p></div>`;
  }
  const rows = [];
  for (const p of POCKIT_CATALOG.players) {
    if (!p.hosted_count) continue;
    const home = defaultHubCardIdForPlayer(p.id);
    rows.push(`<section class="smoke-player-block" data-player="${escapeHtml(p.id)}">
      <header class="smoke-player-head">
        <h2>${hubIcon(p)} ${escapeHtml(p.name)} <code class="smoke-id">${escapeHtml(p.id)}</code></h2>
        <p class="smoke-home">Home hub card: <code>${escapeHtml(home || "—")}</code>
          ${home ? `<button type="button" class="secondary smoke-open-home" data-action="open-player-home" data-player-id="${escapeHtml(p.id)}">Open home</button>` : ""}
          <button type="button" class="secondary smoke-filter-player" data-action="filter-player" data-player-id="${escapeHtml(p.id)}">Filter rail</button>
        </p>
      </header>
      <ul class="smoke-cassette-list">
        ${(p.hosted_cassettes || []).map((c) => {
          const hub = c.hub_card_id || c.id;
          return `<li><label class="smoke-row"><input type="checkbox" data-smoke-hub="${escapeHtml(hub)}" /> <span>${escapeHtml(c.name)}</span> <code>${escapeHtml(hub)}</code> <code class="smoke-path">${escapeHtml(c.path || "—")}</code>
            <button type="button" class="smoke-open" data-action="load" data-id="${escapeHtml(hub)}">Open</button></label></li>`;
        }).join("")}
      </ul>
    </section>`);
  }
  return `<div class="pockit smoke-checklist-page">
    <header class="pockit-hero pockit-hero--dash">
      <div class="pockit-hero-inner">
        <h1 class="pockit-title">Console + cartridge smoke checklist</h1>
        <p class="pockit-lede">Plan 0216 — one row per console (home + filter + shell). Status chips live in the footer.</p>
        <p class="pockit-lede smoke-shell-contract"><code>body</code> on tape doors: <code>tapes-ui hub-dashboard dual-rail-mode tape-body-mode</code> — never <code>deck-embed-mode</code>.</p>
      </div>
    </header>
    <div class="smoke-checklist-body">${rows.join("")}</div>
  </div>`;
}

function bindSmokeChecklistActions() {
  document.querySelectorAll("[data-action=open-player-home]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openPlayerHome(btn.getAttribute("data-player-id") || "");
    });
  });
  document.querySelectorAll("[data-action=filter-player]").forEach((btn) => {
    if (btn.closest("#player-rail-content")) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openPlayerHome(btn.getAttribute("data-player-id") || "");
    });
  });
  bindRailLoadActions("#main-content");
}

function renderFrameworkWiringPillsMarkup() {
  return `<div class="pockit-wiring-pills" id="pockit-wiring-pills" aria-live="polite"></div>`;
}

async function refreshFrameworkWiringPills(consoleId = "wordpress") {
  const el = document.getElementById("pockit-wiring-pills");
  if (!el) return;
  try {
    const r = await fetch(
      `/api/v1/framework/wiring?console=${encodeURIComponent(consoleId)}`,
      tapeFetchInit({ cache: "no-store" }),
    );
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const keys = ["manifest_ok", "door_ok", "catalogue_ok", "player_route_ok", "mirror_ok"];
    const pills = keys
      .filter((k) => j[k] !== null && j[k] !== undefined)
      .map((k) => {
        const label = k.replace(/_ok$/, "").replace(/_/g, " ");
        const ok = Boolean(j[k]);
        return `<span class="pockit-wiring-pill${ok ? " pockit-wiring-pill--ok" : " pockit-wiring-pill--warn"}">${escapeHtml(label)} ${ok ? "✓" : "○"}</span>`;
      })
      .join("");
    el.innerHTML = `<span class="pockit-wiring-label">Wiring · ${escapeHtml(consoleId)}</span>${pills}`;
  } catch {
    el.innerHTML = "";
  }
}

function renderOverview() {
  const hosted = pockitTapeHostedIds();
  const filterQ = POCKIT_FILTER.trim();
  let visibleTotal = 0;
  let sectionsHtml = "";
  let playerSectionCount = 0;
  if (POCKIT_CATALOG?.players) {
    const byPlayer = renderOverviewByPlayers(hosted, filterQ);
    sectionsHtml = byPlayer.html;
    visibleTotal = byPlayer.visibleTotal;
    playerSectionCount = byPlayer.playerSections;
  } else {
    const byHub = renderOverviewByHubSections(hosted, filterQ);
    sectionsHtml = byHub.html;
    visibleTotal = byHub.visibleTotal;
  }
  const stats = overviewStats(hosted, filterQ);
  setTimeout(() => {
    window.PadSurface?.load?.().then(() => {
      window.PadSurface?.fillPockitStat?.();
      window.PadSurface?.bindChangelogLinks?.(document.getElementById("main-content"));
      const footer = document.getElementById("main-footer");
      if (footer && !footer.hidden) {
        refreshMainShellFooter(findCassette(currentCassetteId()));
      }
    });
    if (!isTape()) refreshFrameworkWiringPills("wordpress");
  }, 0);
  const emptyFilter = (filterQ || POCKIT_PLAYER) && !visibleTotal
    ? `<p class="pockit-empty-filter">No cartridges match${filterQ ? ` “${escapeHtml(filterQ)}”` : ""}${POCKIT_PLAYER ? " for this console" : ""}. <button type="button" class="comet-btn comet-btn--ghost pockit-clear-filters" data-action="clear-pockit-filters">Clear filters</button></p>`
    : "";
  const activePlayer = POCKIT_PLAYER
    ? (POCKIT_CATALOG?.players || []).find((p) => p.id === POCKIT_PLAYER)
    : null;
  const heroTitle = activePlayer ? activePlayer.name : pockitHeroCopy().title;
  const heroLede = activePlayer
    ? `${activePlayer.niche || "Player console"} · ${visibleTotal} cassette${visibleTotal === 1 ? "" : "s"} visible`
    : isTape()
      ? `${visibleTotal} cartridge${visibleTotal === 1 ? "" : "s"} in catalog`
      : pockitHeroCopy().lede;
  const heroDashClass = isTape() ? " pockit-hero--dash" : "";
  const heroBlock = `
      <header class="pockit-hero${heroDashClass}" aria-label="Pockit">
        <div class="pockit-hero-glow" aria-hidden="true"></div>
        <div class="pockit-hero-inner">
          <div class="pockit-hero-copy">
            <p class="pockit-kicker"><span class="pockit-live-dot" aria-hidden="true"></span> ${escapeHtml(pockitHeroCopy().kicker)}</p>
            <h1 class="pockit-title pockit-dash-title">${escapeHtml(heroTitle)}</h1>
            <p class="pockit-lede">${escapeHtml(heroLede)}</p>
          </div>

        </div>
      </header>`;
  const emptyPocket = renderEmptyPocketBlock(visibleTotal);
  const sectionsBlock = visibleTotal
    ? `<div class="pockit-sections pockit-sections--${isTape() ? "tape-center" : "hub"}">${sectionsHtml}</div>`
    : "";
  return `
    <div class="pockit">
      ${heroBlock}
      ${pockitFilterBar()}
      ${isTape() ? "" : renderFrameworkWiringPillsMarkup()}
      ${emptyFilter}
      ${emptyPocket}
      ${sectionsBlock}
    </div>`;
}

// ─── Login (canonical /signin hero — shared family-signin-page.js) ───

function renderLogin() {
  capturePockitPendingDeepLink();
  const callback = `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
  window.location.replace(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
}

// ─── Auth status bar + profile modal (carried from v1.33) ──────────

let cachedAuthUser = null;

function authChromeLayout() {
  return window.PockitAuthChrome?.layout?.() || { placement: "rail", density: "full" };
}

function refreshAuthStatusChrome() {
  if (cachedAuthUser) renderAuthStatus(cachedAuthUser);
}

window.__pockitRefreshAuthChrome = refreshAuthStatusChrome;

function renderAuthStatus(me) {
  cachedAuthUser = me;
  const layout = authChromeLayout();
  const mount = window.PockitAuthChrome?.mountEl?.() || document.getElementById("auth-status");
  window.PockitAuthChrome?.clearInactiveMounts?.();
  if (!mount || layout.placement === "hidden") {
    document.getElementById("auth-status").innerHTML = "";
    document.getElementById("suite-bar-auth-mount")?.replaceChildren?.();
    return;
  }

  const saved = localStorage.getItem("nephew-hub-theme") || "light";
  const themeOptions = [
    { value: "dark", label: "Dark", icon: "MoonOutlined" },
    { value: "light", label: "Light", icon: "SunOutlined" },
    { value: "auto", label: "Auto", icon: "DesktopOutlined" },
  ];
  const inSuite = layout.placement === "suite";
  const density = layout.density || "full";
  const toolbarClass = inSuite
    ? `comet-status-toolbar--suite-bar comet-status-toolbar--density-${density === "full" ? "comfortable" : density}`
    : "comet-status-toolbar--full";
  const dropdownClass = inSuite ? "comet-dropdown--footer comet-dropdown--suite-bar" : "comet-dropdown--footer";
  const triggerClass = inSuite
    ? "comet-dropdown-trigger comet-dropdown-trigger--user comet-dropdown-trigger--suite-bar"
    : "comet-dropdown-trigger comet-dropdown-trigger--user";
  const themeExtraClass = inSuite
    ? "comet-segment--sidebar-foot comet-segment--suite-bar-theme"
    : "comet-segment--sidebar-foot";
  const themeFirst = inSuite;

  const accountBlock = `
      <div class="comet-status-toolbar__account">
      <div class="comet-dropdown ${dropdownClass}" id="user-menu-dropdown" data-value="">
        <button type="button" class="${triggerClass}" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
          <span class="comet-dropdown-trigger-glyph" aria-hidden="true">${antIcon("UserOutlined")}</span>
          <span class="comet-dropdown-trigger-label comet-user-email">${escapeHtml(me.email || "signed in")}</span>
          <span class="comet-dropdown-chevron" aria-hidden="true">${antIcon("DownOutlined")}</span>
        </button>
        <div class="comet-dropdown-panel comet-menu-cascader" role="menu" hidden>
          <button type="button" class="comet-menu-item" role="menuitem" data-user-action="profile">
            <span class="comet-menu-item-glyph" aria-hidden="true">${antIcon("UserOutlined")}</span>
            <span class="comet-menu-item-label">Profile</span>
          </button>
          <button type="button" class="comet-menu-item comet-menu-item--operator hidden" role="menuitem" data-user-action="add-web">
            <span class="comet-menu-item-glyph" aria-hidden="true">${antIcon("PlusOutlined")}</span>
            <span class="comet-menu-item-label">Add door</span>
          </button>
          <button type="button" class="comet-menu-item comet-menu-item--danger" role="menuitem" data-user-action="signout">
            <span class="comet-menu-item-glyph" aria-hidden="true">${antIcon("PoweroffOutlined")}</span>
            <span class="comet-menu-item-label">Sign out</span>
          </button>
        </div>
      </div>
      </div>`;
  const themeBlock = `
      <div class="comet-status-toolbar__theme">
      ${renderCometSegment({ id: "theme-segment", name: "Theme", value: saved, options: themeOptions, compact: true, extraClass: themeExtraClass })}
      </div>`;

  mount.innerHTML = `
    <div class="comet-status-toolbar ${toolbarClass}">
      ${themeFirst ? themeBlock : accountBlock}
      ${themeFirst ? accountBlock : themeBlock}
    </div>
  `;

  const userMenu = document.getElementById("user-menu-dropdown");
  if (userMenu && userMenu.dataset.bound !== "1") {
    userMenu.dataset.bound = "1";
    const trigger = userMenu.querySelector(".comet-dropdown-trigger");
    const panel = userMenu.querySelector(".comet-dropdown-panel");
    trigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !userMenu.classList.contains("is-open");
      closeCometDropdowns(open ? userMenu : null);
      userMenu.classList.toggle("is-open", open);
      if (panel) {
        panel.hidden = !open;
        if (open) {
          panel.classList.remove("comet-dropdown-panel--animate");
          void panel.offsetWidth;
          panel.classList.add("comet-dropdown-panel--animate");
        }
      }
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    panel?.querySelectorAll("[data-user-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeCometDropdowns();
        const action = btn.getAttribute("data-user-action");
        if (action === "profile") openProfileModal();
        else if (action === "add-web") openAddWebPageModal();
        else if (action === "signout") signOut();
      });
    });
  }

  bindCometSegment(document.getElementById("theme-segment"), (value) => {
    applyTheme(value);
  });

  fetchFamilyMe().then((user) => {
    const isOp = user && (user.is_operator || user.role === "admin" || user.source === "env");
    const addItem = document.querySelector(".comet-menu-item--operator");
    if (addItem && isOp) addItem.classList.remove("hidden");
  });
}

async function openAddWebPageModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <header><h2>Add door</h2><button class="modal-close" id="web-add-close" type="button">×</button></header>
      <div class="modal-body">
        <p class="hint-msg">Any URL — LAN router, portal, or family app. Appears under <strong>My doors</strong> after save. Use <a href="http://door-creator.localhost/" target="_blank" rel="noopener">Door Creator</a> for the full wizard.</p>
        <label><span>Name</span><input type="text" id="web-add-title" placeholder="GL.iNet Router" /></label>
        <label><span>URL</span><input type="url" id="web-add-url" placeholder="http://192.168.8.1 or https://…" /></label>
        <label><span>Glyph</span><input type="text" id="web-add-glyph" value="🚪" maxlength="4" /></label>
        <label><span>Opens as</span>
          <select id="web-add-surface">
            <option value="auto">Smart (recommended)</option>
            <option value="embed">Embed in Pockit</option>
            <option value="launcher">Launcher — open in browser</option>
          </select>
        </label>
        <div id="web-add-probe" class="hint-msg"></div>
        <div id="web-add-msg"></div>
        <div class="row" style="gap:8px;display:flex;flex-wrap:wrap;">
          <button class="ghost" id="web-add-test" type="button">Test URL</button>
          <button class="primary" id="web-add-save" type="button">Save door</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  cometModalOpen(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("web-add-close").addEventListener("click", () => overlay.remove());
  document.getElementById("web-add-test").addEventListener("click", async () => {
    const probeEl = document.getElementById("web-add-probe");
    const url = document.getElementById("web-add-url").value.trim();
    if (!url) { probeEl.textContent = "Enter a URL first."; return; }
    probeEl.textContent = "Probing…";
    try {
      const r = await fetch("/api/v1/operator-doors/probe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      probeEl.textContent = j.ok
        ? `${j.class || "?"} · ${j.suggested_surface_kind || "?"} · ${j.reachable ? "reachable" : j.error || "unreachable"}`
        : (j.error || "probe failed");
      if (j.suggested_surface_kind && document.getElementById("web-add-surface").value === "auto") {
        document.getElementById("web-add-surface").value =
          j.suggested_surface_kind === "launcher" ? "launcher" : "embed";
      }
    } catch (e) {
      probeEl.textContent = String(e.message || e);
    }
  });
  document.getElementById("web-add-save").addEventListener("click", async () => {
    const msg = document.getElementById("web-add-msg");
    const title = document.getElementById("web-add-title").value.trim();
    const url = document.getElementById("web-add-url").value.trim();
    const glyph = document.getElementById("web-add-glyph").value.trim() || "🚪";
    const surface = document.getElementById("web-add-surface").value;
    msg.innerHTML = "";
    if (!title || !url) {
      msg.innerHTML = `<p class="error">Name and URL required.</p>`;
      return;
    }
    const body = {
      name: title,
      url,
      glyph,
      embed: surface === "auto" ? "auto" : surface === "embed",
      surface_kind: surface === "auto" ? undefined : surface,
    };
    try {
      let r = await fetch("/api/v1/operator-doors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let j = await r.json();
      if (!r.ok && j.error && String(j.error).includes("jailynmarvin")) {
        r = await fetch("/api/v1/web-cassettes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, url, glyph }),
        });
        j = await r.json();
      }
      if (!r.ok) {
        msg.innerHTML = `<p class="error">${escapeHtml(j.error || "Save failed")}</p>`;
        return;
      }
      overlay.remove();
      await loadCards();
      renderSidebar();
      const doorId = j.door?.id || j.cassette?.id;
      if (doorId) setCassette(doorId, { pushHistory: true });
    } catch (e) {
      msg.innerHTML = `<p class="error">${escapeHtml(String(e.message || e))}</p>`;
    }
  });
}

async function fetchFamilyMe() {
  try { const r = await fetch("/api/v1/family/me", { credentials: "include" }); const j = await r.json(); return j.ok ? j.user : null; }
  catch { return null; }
}

async function openProfileModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "profile-modal";
  overlay.innerHTML = `<div class="modal"><header><h2>Profile</h2><button class="modal-close" id="profile-close">×</button></header><div class="modal-body" id="profile-body"><p class="loading">Loading…</p></div></div>`;
  document.body.appendChild(overlay);
  cometModalOpen(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("profile-close").addEventListener("click", () => overlay.remove());
  const user = await fetchFamilyMe();
  const body = document.getElementById("profile-body");
  if (!user) { body.innerHTML = `<p class="error">Could not load profile.</p>`; return; }
  const isEnv = user.source === "env";
  body.innerHTML = `
    <div class="profile-section">
      <label><span>Email</span><input type="email" value="${escapeHtml(user.email)}" disabled /></label>
      <label><span>Display name</span><input type="text" id="profile-display" value="${escapeHtml(user.display_name || "")}" ${isEnv ? "disabled" : ""} /></label>
      <label><span>Role</span><input type="text" value="${escapeHtml(user.role)}" disabled /></label>
      <label><span>Account source</span><input type="text" value="${isEnv ? "env (operator)" : "family-trust-users.json"}" disabled /></label>
      ${!isEnv ? `<button class="primary" id="profile-save">Save profile</button>` : `<p class="hint-msg">Operator account is managed via <code>~/.nephew/tower.env</code> on nephew-ct.</p>`}
    </div>
    ${!isEnv ? `<hr/><div class="profile-section"><h3>Change password</h3>
      <label><span>Old password</span><input type="password" id="profile-old-pw" /></label>
      <label><span>New password (≥8 chars)</span><input type="password" id="profile-new-pw" /></label>
      <label><span>Confirm new</span><input type="password" id="profile-new-pw2" /></label>
      <button class="primary" id="profile-change-pw">Change password</button>
      <div id="profile-msg"></div></div>` : ""}
  `;
  if (!isEnv) {
    document.getElementById("profile-save").addEventListener("click", async () => {
      const d = document.getElementById("profile-display").value;
      const r = await fetch("/api/v1/family/me", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: d }) });
      const j = await r.json();
      document.getElementById("profile-msg").innerHTML = j.ok ? `<p class="success">Saved.</p>` : `<p class="error">${j.error}</p>`;
    });
    document.getElementById("profile-change-pw").addEventListener("click", async () => {
      const old_password = document.getElementById("profile-old-pw").value;
      const new_password = document.getElementById("profile-new-pw").value;
      const c = document.getElementById("profile-new-pw2").value;
      const msg = document.getElementById("profile-msg"); msg.innerHTML = "";
      if (new_password !== c) { msg.innerHTML = `<p class="error">New passwords don't match.</p>`; return; }
      const r = await fetch("/api/v1/family/me/password", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ old_password, new_password }) });
      const j = await r.json();
      msg.innerHTML = j.ok ? `<p class="success">Password changed.</p>` : `<p class="error">${j.error}</p>`;
    });
  }
}

// ─── Dual-rail toggles (Players left · Cassettes right) ───────────

function syncRailDrawerHandle(handle, collapsed, labels) {
  if (!handle) return;
  handle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  handle.classList.toggle("is-collapsed", collapsed);
  const tip = collapsed ? labels.show : labels.hide;
  if (window.CometTooltip?.set) window.CometTooltip.set(handle, tip);
  else handle.setAttribute("data-comet-tip", tip);
  handle.setAttribute("aria-label", tip.split("\n")[0]);
  const chevron = handle.querySelector(".rail-drawer-handle__chevron");
  if (chevron) chevron.textContent = collapsed ? "▾" : "▴";
}

function initDualRailToggles() {
  healStuckPockitChrome();
  const playerRail = document.getElementById("player-rail");
  const cassetteRail = document.getElementById("sidebar");
  const playerHandle = document.getElementById("player-rail-handle");
  const cassetteHandle = document.getElementById("cassette-rail-handle");
  const playerLabels = {
    show: pockitTip("playerDrawerExpand") || "Expand players drawer\nSlide the left rail open",
    hide: pockitTip("playerDrawerCollapse") || "Collapse consoles drawer\nSlide the left rail closed",
  };
  const cassetteLabels = {
    show: pockitTip("cassetteDrawerExpand") || "Expand cassettes drawer\nSlide the right rail open",
    hide: pockitTip("cassetteDrawerCollapse") || "Collapse cartridges drawer\nSlide the right rail closed",
  };

  function setPlayerRailCollapsed(c, { persist = true } = {}) {
    if (!playerRail) return;
    playerRail.classList.toggle("collapsed", c);
    syncRailDrawerHandle(playerHandle, c, playerLabels);
    if (persist && window.PockitConfig) window.PockitConfig.setRailCollapsed("player", c);
    else localStorage.setItem("nephew-hub-player-rail-collapsed", c ? "1" : "0");
    syncRailChromeLayout();
    requestAnimationFrame(() => scheduleSidebarActivePill());
  }

  function setCassetteRailCollapsed(c, { persist = true } = {}) {
    if (!cassetteRail) return;
    cassetteRail.classList.toggle("collapsed", c);
    document.getElementById("app")?.classList.toggle("sidebar-is-collapsed", c);
    document.body.classList.toggle("pockit-cassette-rail-collapsed", c);
    syncRailDrawerHandle(cassetteHandle, c, cassetteLabels);
    window.PockitSurface?.syncVersionBadgePlacement?.();
    if (persist && window.PockitConfig) window.PockitConfig.setRailCollapsed("cassette", c);
    else localStorage.setItem("nephew-hub-cassette-rail-collapsed", c ? "1" : "0");
    requestAnimationFrame(() => scheduleSidebarActivePill());
  }

  playerHandle?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setPlayerRailCollapsed(!playerRail.classList.contains("collapsed"));
  });
  cassetteHandle?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setCassetteRailCollapsed(!cassetteRail.classList.contains("collapsed"));
  });

  document.getElementById("app")?.addEventListener("click", (e) => {
    if (window.innerWidth > 640) return;
    if (!cassetteRail || cassetteRail.classList.contains("collapsed")) return;
    if (e.target.closest("#sidebar")) return;
    if (e.target.closest("#cassette-rail-handle")) return;
    setCassetteRailCollapsed(true);
  });

  if (window.PockitConfig) {
    window.PockitConfig.registerRailControls({
      setPlayerRailCollapsed,
      setCassetteRailCollapsed,
      isPlayerRailCollapsed: () => playerRail?.classList.contains("collapsed") ?? false,
      isCassetteRailCollapsed: () => cassetteRail?.classList.contains("collapsed") ?? false,
    });
    window.__pockitRailControls = { setPlayerRailCollapsed, setCassetteRailCollapsed };
    // Clinic 0040 — both rails stuck collapsed on desktop breaks navigation.
    if ((window.innerWidth || 0) >= 1024
      && playerRail?.classList.contains("collapsed")
      && cassetteRail?.classList.contains("collapsed")) {
      setPlayerRailCollapsed(false);
      setCassetteRailCollapsed(false);
    }
    if (window.PockitViewport?.isSuiteParentEmbed?.()) {
      setPlayerRailCollapsed(false);
      setCassetteRailCollapsed(false);
    }
  } else {
    if (localStorage.getItem("nephew-hub-player-rail-collapsed") === "1") setPlayerRailCollapsed(true, { persist: false });
    else syncRailDrawerHandle(playerHandle, false, playerLabels);
    const cassetteStored =
      localStorage.getItem("nephew-hub-cassette-rail-collapsed") === "1" ||
      localStorage.getItem("nephew-hub-sidebar-collapsed") === "1";
    if (cassetteStored) setCassetteRailCollapsed(true, { persist: false });
    else syncRailDrawerHandle(cassetteHandle, false, cassetteLabels);
    if (window.PockitViewport?.isSuiteParentEmbed?.()) {
      setPlayerRailCollapsed(false, { persist: false });
      setCassetteRailCollapsed(false, { persist: false });
    }
  }
  syncRailChromeLayout();
}

// ─── Render entry ────────────────────────────────────────────────

function ensureCassetteSettingsDelegation() {
  if (document.documentElement.dataset.cassetteSettingsDelegation) return;
  document.documentElement.dataset.cassetteSettingsDelegation = "1";
  document.addEventListener("click", (e) => {
    const settingsBtn = e.target.closest("[data-action=cassette-settings]");
    if (settingsBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = settingsBtn.getAttribute("data-substrate-id");
      if (id) openCassetteSettings(id);
      return;
    }
    const pockitCfgBtn = e.target.closest("[data-action=open-pockit-config]");
    if (pockitCfgBtn) {
      e.preventDefault();
      e.stopPropagation();
      setCassette(`settings:${window.PockitConfig?.POCKIT_SETTINGS_ID || "pockit"}`, { pushHistory: true });
      return;
    }
    const settingsModalBtn = e.target.closest("[data-action=open-settings-modal]");
    if (settingsModalBtn) {
      e.preventDefault();
      e.stopPropagation();
      openSettingsModal("catalog");
      return;
    }
    const card = e.target.closest(".overview-card[data-action=load]");
    if (!card) return;
    if (e.target.closest("a.overview-newtab")) return;
    if (e.target.closest("a.overview-door-link")) return;
    if (e.target.closest("[data-action=pad-changelog]")) return;
    const id = card.getAttribute("data-id");
    if (!id) return;
    e.preventDefault();
    setCassette(id);
  });
  document.addEventListener("keydown", (e) => {
    const card = e.target.closest(".overview-card[data-action=load]");
    if (!card || e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("[data-action=cassette-settings]")) return;
    e.preventDefault();
    setCassette(card.getAttribute("data-id"));
  });
}

function showPockitShellError(err) {
  const app = document.getElementById("app");
  const content = document.getElementById("main-content");
  if (app) app.style.visibility = "visible";
  const msg = err?.stack || err?.message || String(err);
  if (content) {
    content.innerHTML = `<div class="pockit pockit-shell-error" style="padding:2rem;max-width:40rem;margin:2rem auto;">
      <h1>Pockit shell error</h1>
      <p>The shell hit a JavaScript error during load. Hard refresh after the fix is deployed.</p>
      <pre style="white-space:pre-wrap;font-size:12px;opacity:0.85;">${escapeHtml(msg)}</pre>
    </div>`;
  }
  console.error("[pockit] shell error", err);
}

async function render() {
  ensureCassetteSettingsDelegation();
  document.getElementById("main-content").innerHTML = `<div class="loading">Loading…</div>`;
  document.getElementById("auth-status").innerHTML = "";
  document.getElementById("suite-bar-auth-mount")?.replaceChildren?.();
  cachedAuthUser = null;
  const [me, version] = await Promise.all([
    resolveFamilySession(),
    fetchVersion(),
    window.PadSurface?.load?.().catch(() => null) || Promise.resolve(null),
  ]);
  cachedTowerApiVersion = version || "—";
  // Reveal only now that auth is resolved — the chosen view (hub or login hero)
  // renders synchronously below, so the shell never flashes to anonymous visitors.
  document.getElementById("app").style.visibility = "visible";
  if (me.authenticated) {
    document.body.classList.remove("hero-mode");
    const returnUrl = getReturnUrl();
    if (returnUrl) {
      const handoff = await familyAuthenticatedHref(returnUrl);
      window.location.replace(handoff);
      return;
    }
    if (isTapeOnlyMode()) {
      const bootId = bootCassetteId();
      const bootCard = findCassette(bootId);
      const dest = bootCard ? tapePlaybackSrc(bootCard) : null;
      if (dest) {
        window.location.replace(dest);
        return;
      }
    }
    renderSidebar();
    syncSuiteChrome(initialAuthenticatedCassetteId());
    renderAuthStatus(me);
    if (window.PockitViewport?.isMobileShell?.()) {
      await window.PockitPhoneShell?.ensureLayout?.();
    }
    const consoleDeepLink = consumeConsoleQueryDeepLink();
    try {
      if (consoleDeepLink) {
        openConsoleConsoleView(consoleDeepLink);
      } else {
        setCassette(initialAuthenticatedCassetteId(), { pushHistory: false });
      }
    } catch (err) {
      showPockitShellError(err);
      return;
    }
    window.PockitConfig?.apply();
    ensureFamilySsoWarm();
    window.PockitSurface?.startUpdateWatch?.();
    syncFooterVersionChrome();
    refreshCassetteRailDock();
    hydrateIcons(document.getElementById("app"));
  } else {
    window.PockitSurface?.stopUpdateWatch?.();
    window.PadSurface?.unmountFixedBadge?.();
    clearSuiteChrome();
    if (me.apiError) {
      document.body.classList.remove("hero-mode");
      document.getElementById("main-content").innerHTML = `
        <div class="login-container" style="max-width:28rem;margin:2rem auto;padding:1rem;">
          <h1>Auth API unreachable</h1>
          <p class="subtitle">Pockit cannot verify your session. Sign-in will not work until tower-api is running on this Mac.</p>
          <p class="hint-msg">Fix: <code>cd ~/Developer/nephew && bash scripts/ensure-tower-api-for-sso.sh</code></p>
          <p class="hint-msg">Then hard refresh this page.</p>
        </div>`;
      document.getElementById("app").style.visibility = "visible";
      return;
    }
    const returnUrl = getReturnUrl();
    if (returnUrl) {
      window.location.replace(`/signin?return=${encodeURIComponent(returnUrl)}`);
      return;
    }
    capturePockitPendingDeepLink();
    const callback = `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
    window.location.replace(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
    return;
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.addEventListener("hashchange", () => {
  if (hashSyncInFlight) {
    hashSyncInFlight = false;
    return;
  }
  const deepId = currentCassetteId();
  const routeId = deepId ? canonicalHashCassetteId(deepId) : "overview";
  if (routeId === lastSettledRouteId) {
    const settled = findCassette(deepId) || findCassette("overview");
    if (mainContentMatchesCassette(settled)) return;
  }
  setCassette(deepId || "overview", { pushHistory: false });
});

function normalizeSpaPathToHash() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const params = new URLSearchParams(window.location.search || "");
  const queryCassette = params.get("c") || params.get("cassette");
  if (
    (path === "/" || path === "/index.html") &&
    queryCassette &&
    /^[\w-]+$/.test(queryCassette) &&
    !isEmbedOnlyQueryValue(queryCassette)
  ) {
    params.delete("c");
    params.delete("cassette");
    scrubParentEmbedQueryParams(params);
    const q = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState({}, "", `/${q}#/c/${canonicalHashCassetteId(queryCassette)}`);
    return;
  }
  if (path === "/" || path === "/index.html") {
    try {
      const saved = localStorage.getItem("nephew-pockit-last-hash");
      const cur = window.location.hash || "";
      if ((!cur || cur === "#/overview") && saved && saved.startsWith("#/") && saved !== "#/overview") {
        window.history.replaceState({}, "", `/${window.location.search || ""}${saved}`);
      }
    } catch {
      /* ignore */
    }
    return;
  }
  const q = window.location.search || "";
  let hash = "";
  if (path === "/overview") hash = "#/overview";
  else if (path === "/welcome") hash = "#/welcome";
  else if (path === "/install") hash = "#/install";
  else if (path === "/library") hash = "#/library";
  else if (path === "/checklist") hash = "#/checklist";
  else {
    const settings = path.match(/^\/settings\/([\w-]+)$/);
    if (settings) hash = `#/settings/${settings[1]}`;
    const cassette = path.match(/^\/c\/([\w-]+)$/);
    if (cassette) hash = `#/c/${canonicalHashCassetteId(cassette[1])}`;
  }
  if (!hash) return;
  window.history.replaceState({}, "", `/${q}${hash}`);
}

document.addEventListener("pockit-intent-proto-ready", () => refreshIntentFooterAffordances());
document.addEventListener("nephew-mac-app-intent", () => refreshIntentFooterAffordances());

window.addEventListener("nephew-pockit-catalog-entitlements", async (ev) => {
  POCKIT_CATALOG_ENTITLEMENTS = ev.detail?.entitlements || (await loadCatalogEntitlements());
  if (POCKIT_CATALOG_ENTITLEMENTS?.mode !== "core" && !POCKIT_FLEET_CATALOG) {
    await hydrateOperatorManifest();
    return;
  }
  await refreshCatalogFromEntitlements();
});

document.addEventListener("DOMContentLoaded", async () => {
  normalizeSpaPathToHash();
  capturePockitPendingDeepLink();
  bindSpaDeepLinks();
  syncTapesUiChrome();
  initTheme();
  initDualRailToggles();
  initFamilyDoorLinks();
  ensureHubBackControls();
  await loadPockitCoreCatalog();
  rebuildTapeSidebarIndex();
  try {
    await render();
  } catch (err) {
    showPockitShellError(err);
  }
  hydrateIcons(document.getElementById("app"));
  hydrateOperatorManifest().catch((err) => {
    console.warn("[pockit] background catalog hydrate failed", err);
  });
});

window.setCassette = setCassette;
window.navigateFromConsolePicker = navigateFromConsolePicker;
window.currentCassetteId = currentCassetteId;
window.openPlayerHome = openPlayerHome;
window.selectMacApp = selectMacApp;
window.selectAccessoryDesk = selectAccessoryDesk;
window.openAccessoryDesk = openAccessoryDesk;
window.PockitQuickBarHooks = {
  openPlayerHome,
  selectMacApp,
  openConsoleModal,
  openSettingsModal,
  activeKey: quickBarActiveKey,
  getPlayer: () => POCKIT_PLAYER,
  getCatalog: () => POCKIT_CATALOG,
};
