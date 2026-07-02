/**
 * Pockit surface version + changelog — mirrors Control Tower VersionBadge.
 * Canonical version: newest ## [x.y.z] in changelogs/pockit.md (Plan 0208 / 0271).
 * runningVersion = HUB_CSS_VER (loaded bundle); pockit-surface.json is metadata + cache-bust target.
 */
const HubSurface = (() => {
  function surfaceDisplayName(s) {
    const name = (s?.display_name || surface?.display_name || "Pockit").trim();
    return name || "Pockit";
  }
  export const HUB_CSS_VER = "1.92.24";
  const INVARIANT_BADGE_ID = "pockit-version-invariant";
  let surface = null;
  let badgeEl = null;
  let modalEl = null;
  let runningVersion = null;
  let updateAvailableVersion = null;
  let cachedChangelogBySurface = Object.create(null);
  let cachedTowerVersion = null;
  let changelogRegistry = null;
  let activeChangelogTab = "pockit";
  const INTENT_TAB_ID = "mac-app-intent";
  let cachedChangelogMonolithic = Object.create(null);
  let cachedChangelogSource = Object.create(null);

  const CHANGELOG_ROOT_FALLBACKS = ["/CHANGELOG.md", "/api/v1/family/changelog"];
  const CHANGELOG_FALLBACKS = CHANGELOG_ROOT_FALLBACKS;

  const DEFAULT_SURFACES = {
    pockit: {
      label: "Pockit",
      kicker: "Nephew Pockit",
      paths: ["/changelogs/pockit.md", "/api/v1/surface-changelog/pockit", ...CHANGELOG_ROOT_FALLBACKS],
    },
    "tower-api": {
      label: "tower-api",
      kicker: "tower-api",
      paths: ["/changelogs/tower-api.md", "/api/v1/surface-changelog/tower-api", ...CHANGELOG_ROOT_FALLBACKS],
    },
    "cassette-voice": {
      label: "Super Rick",
      kicker: "Super Rick",
      scope: "voice",
      paths: ["/changelogs/cassettes/voice.md", "/api/v1/surface-changelog/cassette-voice", ...CHANGELOG_ROOT_FALLBACKS],
    },
  };
  let updateWatchTimer = null;
  let invariantWatchTimer = null;
  let updateNotifiedVersion = null;
  const UPDATE_POLL_MS = 3 * 60 * 1000;

  /** pockit.js sets window.currentCassetteId — never use bare `global` (ReferenceError in browser). */
  function currentCassetteId() {
    const root = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
    return typeof root.currentCassetteId === "function" ? root.currentCassetteId() : null;
  }

  function changelogRender() {
    const r = globalThis.PockitChangelogRender;
    if (!r?.renderChangelogMarkdown) {
      throw new Error("pockit-changelog-render.js must load before pockit-surface.js");
    }
    return r;
  }

  function escapeHtml(s) {
    return changelogRender().escapeHtml(s);
  }

  function renderChangelogMarkdown(md) {
    return changelogRender().renderChangelogMarkdown(md);
  }

  function parseLatestChangelogVersion(md) {
    return changelogRender().parseLatestChangelogVersion(md);
  }

  function looksLikeHtmlDocument(body) {
    const head = String(body || "").trimStart().slice(0, 200).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html");
  }

  /** Keep in sync with src/cassette-framework/changelog-version.js + src/update-check.js */
  function normalizeVersion(value) {
    return String(value ?? "").trim().replace(/^v/i, "");
  }

  function compareVersions(a, b) {
    const left = normalizeVersion(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
    const right = normalizeVersion(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
    const len = Math.max(left.length, right.length);
    for (let i = 0; i < len; i++) {
      const delta = (left[i] ?? 0) - (right[i] ?? 0);
      if (delta !== 0) return Math.sign(delta);
    }
    return 0;
  }

  function ensureChangelogStyles() {
    if (document.querySelector("link[data-pockit-changelog-css]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/pockit-changelog.css?v=${HUB_CSS_VER}`;
    link.setAttribute("data-pockit-changelog-css", "1");
    document.head.appendChild(link);
  }

  function displayVersion() {
    return runningVersion || surface?.version || "—";
  }

  function applyResolvedVersion(s, _version) {
    if (!s) return s;
    s.version = runningVersion || s.version;
    return s;
  }

  function badgeLabelHtml(s) {
    const ver = displayVersion();
    return `<span class="pad-version-badge__dot" aria-hidden="true"></span><span class="pad-version-badge__label">${escapeHtml(surfaceDisplayName(s))} v${escapeHtml(ver)}</span><span class="pad-version-badge__arrow" aria-hidden="true">↗</span>`;
  }

  function shouldShowInvariantBadge() {
    const tape =
      document.documentElement.getAttribute("data-tape") === "1" ||
      document.body.classList.contains("tapes-ui");
    const authed = !document.body.classList.contains("hero-mode");
    const app = document.getElementById("app");
    const appVisible = !app || app.style.visibility !== "hidden";
    return tape && authed && appVisible;
  }

  function versionBadgeDockHost() {
    return (
      document.querySelector(".shell-footer-versions__center")
      || document.querySelector(".shell-footer-versions")
    );
  }

  function syncFloatedBadgeOffset() {
    const el = document.getElementById(INVARIANT_BADGE_ID);
    if (!el?.classList.contains("pockit-version-invariant--floated")) {
      if (el) el.style.removeProperty("bottom");
      return;
    }
    const footer = document.getElementById("main-footer");
    const footerVisible = footer && !footer.hidden && footer.offsetHeight > 0;
    el.style.bottom = footerVisible ? `${footer.offsetHeight + 12}px` : "14px";
  }

  function syncVersionBadgePlacement() {
    const el = document.getElementById(INVARIANT_BADGE_ID);
    if (!el) return;
    const floated = shouldFloatVersionBadge();
    el.classList.toggle("pockit-version-invariant--floated", floated);
    const dockHost = versionBadgeDockHost();
    if (dockHost && !floated && el.parentElement !== dockHost) {
      dockHost.appendChild(el);
    }
    if (floated && el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    syncFloatedBadgeOffset();
  }

  function shouldFloatVersionBadge() {
    const footer = document.getElementById("main-footer");
    const footerHidden = !footer || footer.hidden || footer.offsetHeight === 0;
    const cinema = document.body.classList.contains("pockit-cinema-mode");
    const chromeHideFooter = document.body.classList.contains("pockit-chrome-hide-footer");
    return cinema || chromeHideFooter || footerHidden;
  }

  function ensureInvariantVersionBadge() {
    let el = document.getElementById(INVARIANT_BADGE_ID);
    const dockHost = versionBadgeDockHost();
    if (!el && dockHost) {
      el = document.createElement("button");
      el.type = "button";
      el.id = INVARIANT_BADGE_ID;
      el.className = "pockit-version-invariant shell-version-btn";
      el.setAttribute("data-action", "pad-changelog");
      el.innerHTML =
        '<span class="shell-version-btn__dot" aria-hidden="true"></span><span class="shell-version-btn__label">Pockit</span>';
      dockHost.appendChild(el);
    }
    if (!el) return;
    const show = shouldShowInvariantBadge();
    el.hidden = !show;
    el.classList.toggle("is-dock-hidden", !show);
    if (!show) return;
    syncVersionBadgePlacement();
    const ver = displayVersion();
    const name = surfaceDisplayName(surface);
    const label = el.querySelector(".shell-version-btn__label");
    if (label) label.textContent = ver && ver !== "—" ? `${name} v${ver}` : name;
    el.title = `${name} v${ver || "…"} — click for CHANGELOG`;
    bindChangelogLinks(document.body);
  }

  function hideInvariantVersionBadge() {
    const el = document.getElementById(INVARIANT_BADGE_ID);
    if (el) el.hidden = true;
  }

  function bindFloatedBadgeFooterWatch() {
    const footer = document.getElementById("main-footer");
    if (!footer || footer.dataset.floatedWatch === "1") return;
    footer.dataset.floatedWatch = "1";
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => syncFloatedBadgeOffset());
      ro.observe(footer);
    }
    if (typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(() => syncFloatedBadgeOffset());
      mo.observe(footer, { attributes: true, attributeFilter: ["hidden", "class"] });
    }
  }

  function startInvariantVersionWatch() {
    if (invariantWatchTimer != null) return;
    bindFloatedBadgeFooterWatch();
    const tick = () => {
      if (shouldShowInvariantBadge()) ensureInvariantVersionBadge();
    };
    tick();
    invariantWatchTimer = window.setInterval(tick, 2500);
  }

  function stopInvariantVersionWatch() {
    if (invariantWatchTimer != null) {
      window.clearInterval(invariantWatchTimer);
      invariantWatchTimer = null;
    }
    hideInvariantVersionBadge();
  }

  function unmountLegacyFixedBadge() {
    badgeEl?.remove();
    badgeEl = null;
  }

  function ensureVersionChrome() {
    /* Footer badge syncs on render; invariant badge is the fail-closed anchor. */
    unmountLegacyFixedBadge();
    ensureInvariantVersionBadge();
  }

  function notifyVersionChrome() {
    const ver = displayVersion();
    if (!ver || ver === "—") {
      ensureVersionChrome();
      return;
    }
    document.querySelectorAll("#pockit-version-invariant .shell-version-btn__label").forEach((el) => {
      el.textContent = `${surfaceDisplayName(surface)} v${ver}`;
    });
    document.querySelectorAll(".pockit-mobile-version-pill .shell-version-btn__label").forEach((el) => {
      el.textContent = ver && ver !== "—" ? `${surfaceDisplayName(surface)} v${ver}` : surfaceDisplayName(surface);
    });
    document.querySelectorAll(".pockit-mobile-version-pill").forEach((btn) => {
      const latest = updateAvailableVersion;
      const showUpdate = Boolean(latest);
      btn.classList.toggle("has-update", showUpdate);
      btn.title = showUpdate
        ? `${surfaceDisplayName(surface)} v${ver} — v${latest} available (tap for changelog · suite bar to update)`
        : `${surfaceDisplayName(surface)} v${ver} — click for CHANGELOG`;
    });
    document.querySelectorAll(".pad-version-inline").forEach((el) => {
      el.textContent = `${surfaceDisplayName(surface)} v${ver}`;
    });
    const modalVer = modalEl?.querySelector("#pad-changelog-version");
    if (modalVer) modalVer.textContent = `v${ver}`;
    syncUpdateBadge();
    document.dispatchEvent(
      new CustomEvent("pockit-version", { detail: { version: surface.version, runningVersion } }),
    );
    ensureVersionChrome();
  }

  function loadedBundleVersion() {
    return normalizeVersion(HUB_CSS_VER) || null;
  }

  function applyPockitUpdate(targetVersion) {
    const latest = normalizeVersion(targetVersion || updateAvailableVersion);
    if (!latest) return;
    const pill = document.querySelector(".suite-bar__update-badge");
    if (pill) {
      pill.disabled = true;
      pill.classList.add("is-applying");
      pill.querySelector(".suite-bar__update-label")?.replaceChildren(document.createTextNode("Updating…"));
    }
    try {
      sessionStorage.setItem("pockit-applied-update", latest);
    } catch {
      /* private mode */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("pockit", latest);
    window.location.assign(url.toString());
  }

  function syncUpdateBadge() {
    const latest = updateAvailableVersion;
    const show = Boolean(latest);
    document.body.classList.toggle("pockit-update-available", show);
    document.querySelectorAll("#pockit-version-invariant").forEach((btn) => {
      btn.classList.toggle("has-update", show);
      btn.title = show
        ? `${surfaceDisplayName(surface)} v${runningVersion || surface?.version || "—"} — v${latest} available (tap for changelog · suite bar to update)`
        : `${surfaceDisplayName(surface)} v${runningVersion || surface?.version || "—"} — click for CHANGELOG`;
    });
    const barHost = document.getElementById("suite-bar");
    let pill = barHost?.querySelector(".suite-bar__update-badge");
    if (!show) {
      pill?.remove();
      return;
    }
    if (!barHost) return;
    if (!pill) {
      pill = document.createElement("button");
      pill.type = "button";
      pill.className = "suite-bar__update-badge";
      pill.setAttribute("data-action", "pockit-apply-update");
      pill.setAttribute("aria-live", "polite");
      const bar = barHost.querySelector(".suite-bar");
      const welcomeBtn = bar?.querySelector("[data-suite-show-welcome]");
      if (bar && welcomeBtn) bar.insertBefore(pill, welcomeBtn);
      else if (bar) bar.appendChild(pill);
      else barHost.appendChild(pill);
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        applyPockitUpdate(updateAvailableVersion);
      });
    }
    pill.hidden = false;
    pill.title = `Pockit v${latest} is available — you are on v${runningVersion || surface?.version || "—"}. Click to load the update.`;
    pill.innerHTML = `<span class="suite-bar__update-dot" aria-hidden="true"></span><span class="suite-bar__update-label">Update v${escapeHtml(latest)}</span>`;
    bindChangelogLinks(barHost);
  }

  function maybeNotifyUpdateOnce(latest) {
    if (!latest || updateNotifiedVersion === latest) return;
    updateNotifiedVersion = latest;
    document.dispatchEvent(
      new CustomEvent("pockit-update-available", {
        detail: { latestVersion: latest, runningVersion },
      }),
    );
  }

  function applyUpdateAvailability(latest) {
    if (!latest || !runningVersion) {
      updateAvailableVersion = null;
      syncUpdateBadge();
      return;
    }
    if (compareVersions(latest, runningVersion) > 0) {
      updateAvailableVersion = latest;
      maybeNotifyUpdateOnce(latest);
    } else {
      updateAvailableVersion = null;
    }
    syncUpdateBadge();
  }

  async function pollForUpdate() {
    if (!surface || document.hidden) return;
    try {
      const latest = await resolveVersionFromChangelog(surface);
      if (latest) surface._changelogLatest = latest;
      applyUpdateAvailability(latest);
    } catch {
      /* offline or gateway restarting */
    }
  }

  function startUpdateWatch() {
    if (updateWatchTimer != null) return;
    pollForUpdate();
    updateWatchTimer = window.setInterval(pollForUpdate, UPDATE_POLL_MS);
    document.addEventListener("visibilitychange", onUpdateVisibility);
    startInvariantVersionWatch();
  }

  function stopUpdateWatch() {
    if (updateWatchTimer != null) {
      window.clearInterval(updateWatchTimer);
      updateWatchTimer = null;
    }
    document.removeEventListener("visibilitychange", onUpdateVisibility);
    stopInvariantVersionWatch();
  }

  function onUpdateVisibility() {
    if (!document.hidden) pollForUpdate();
  }

  function refreshBadge(s) {
    const ver = displayVersion();
    if (!badgeEl || !ver || ver === "—") return;
    badgeEl.title = `${surfaceDisplayName(s)} v${ver} — click for CHANGELOG`;
    badgeEl.innerHTML = badgeLabelHtml(s);
  }

  async function loadChangelogRegistry() {
    if (changelogRegistry) return changelogRegistry;
    try {
      const r = await fetch("/api/v1/surface-changelog/registry", { credentials: "include", cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        changelogRegistry = { ...DEFAULT_SURFACES };
        for (const [id, meta] of Object.entries(j.surfaces || {})) {
          changelogRegistry[id] = {
            ...DEFAULT_SURFACES[id],
            label: meta.display_name || id,
            kicker: meta.kicker || meta.display_name || id,
            scope: meta.scope || DEFAULT_SURFACES[id]?.scope,
            cassette_ids: meta.cassette_ids || DEFAULT_SURFACES[id]?.cassette_ids,
            paths: DEFAULT_SURFACES[id]?.paths || [
              meta.changelog_file ? `/${meta.changelog_file}` : null,
              `/api/v1/surface-changelog/${id}`,
            ].filter(Boolean),
          };
        }
        return changelogRegistry;
      }
    } catch {
      /* offline */
    }
    changelogRegistry = { ...DEFAULT_SURFACES };
    return changelogRegistry;
  }

  function changelogTabsForScope(scope, cassetteId) {
    const tabs = [
      { id: "pockit", label: "Pockit" },
      { id: "tower-api", label: "tower-api" },
    ];
    const reg = changelogRegistry || DEFAULT_SURFACES;
    const added = new Set(["pockit", "tower-api"]);
    for (const [id, meta] of Object.entries(reg)) {
      if (added.has(id)) continue;
      const cids = meta.cassette_ids || (meta.cassette_id ? [meta.cassette_id] : []);
      const matchScope = meta.scope && meta.scope === scope;
      const matchCassette = cassetteId && (cids.includes(cassetteId) || id === `cassette-${cassetteId}`);
      if (matchScope || matchCassette) {
        tabs.push({ id, label: meta.label || meta.display_name || id });
        added.add(id);
      }
    }
    if (scope === "voice" && !added.has("cassette-voice")) {
      tabs.push({ id: "cassette-voice", label: "Super Rick" });
    }
    if (scope === "video" && !added.has("cassette-video")) {
      tabs.push({ id: "cassette-video", label: "Super Rick Video" });
    }
    tabs.push({ id: INTENT_TAB_ID, label: intentTabLabel() });
    return tabs;
  }

  function intentTabLabel() {
    const appId = globalThis.NephewMacAppIntent?.resolveIntentAppId?.();
    if (appId === "voice") return "Super Rick intent";
    if (appId === "video") return "Super Rick Video intent";
    const proto = globalThis.NephewMacAppIntent?.getActiveProto?.();
    if (proto?.displayName && proto.appId !== "pockit") {
      return `${proto.displayName} intent`;
    }
    return "Intent";
  }

  function toggleKindLegend(show) {
    if (!modalEl) return;
    const legendHost = modalEl.querySelector("#pad-changelog-kind-legend");
    if (legendHost) legendHost.hidden = !show;
  }

  async function setIntentTab() {
    if (!modalEl) return;
    activeChangelogTab = INTENT_TAB_ID;
    modalEl.querySelectorAll("[data-changelog-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-changelog-tab") === INTENT_TAB_ID;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    toggleKindLegend(false);
    const kickerEl = modalEl.querySelector("#pad-changelog-kicker");
    const verEl = modalEl.querySelector("#pad-changelog-version");
    const bodyEl = modalEl.querySelector("#pad-changelog-body");
    const footerEl = modalEl.querySelector(".pad-changelog-footer");
    let proto = globalThis.NephewMacAppIntent?.getActiveProto?.();
    const appId =
      globalThis.NephewMacAppIntent?.resolveIntentAppId?.() ||
      proto?.appId ||
      globalThis.NephewMacAppIntent?.activeAppId ||
      globalThis.NephewMacAppIntent?.resolveAppId?.() ||
      "pockit";
    if ((!proto || proto.appId !== appId) && globalThis.NephewMacAppIntent?.mount) {
      await globalThis.NephewMacAppIntent.mount(appId);
      proto = globalThis.NephewMacAppIntent.getActiveProto?.();
    }
    const title = proto?.displayName || appId;
    if (kickerEl) kickerEl.textContent = title;
    if (verEl) verEl.textContent = proto?.appVersion ? `v${proto.appVersion}` : "—";
    if (bodyEl) {
      bodyEl.innerHTML =
        globalThis.NephewMacAppIntent?.renderIntentPanelHtml?.(proto) ||
        '<p class="pad-cl-error">Intent panel unavailable.</p>';
    }
    if (footerEl) {
      footerEl.innerHTML =
        '<span>Mac .app intent from <code>mac-app-intent-registry.json</code></span>';
    }
    modalEl.setAttribute("aria-label", `${title} intent`);
  }

  function renderChangelogTabsHtml(scope, cassetteId) {
    return changelogTabsForScope(scope, cassetteId)
      .map(
        (t, i) =>
          `<button type="button" class="pad-changelog-tab${activeChangelogTab === t.id ? " is-active" : ""}" role="tab" id="pad-changelog-tab-${escapeHtml(t.id)}" data-changelog-tab="${escapeHtml(t.id)}" aria-selected="${activeChangelogTab === t.id ? "true" : "false"}" aria-controls="pad-changelog-body">${escapeHtml(t.label)}</button>`,
      )
      .join("");
  }

  function bindChangelogTabHandlers() {
    if (!modalEl) return;
    modalEl.querySelectorAll("[data-changelog-tab]").forEach((btn) => {
      if (btn.dataset.changelogTabBound === "1") return;
      btn.dataset.changelogTabBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        setChangelogTab(btn.getAttribute("data-changelog-tab") || "pockit");
      });
    });
  }

  async function fetchSurfaceChangelogMarkdown(surfaceId) {
    if (cachedChangelogBySurface[surfaceId]) return cachedChangelogBySurface[surfaceId];
    const reg = await loadChangelogRegistry();
    const surf = reg[surfaceId] || DEFAULT_SURFACES[surfaceId];
    const paths = surf?.paths || [`/api/v1/surface-changelog/${surfaceId}`, ...CHANGELOG_ROOT_FALLBACKS];
    const seen = new Set();
    for (const mdPath of paths) {
      if (!mdPath || seen.has(mdPath)) continue;
      seen.add(mdPath);
      try {
        const r = await fetch(mdPath, { credentials: "include", cache: "no-store" });
        if (!r.ok) continue;
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) continue;
        const md = await r.text();
        if (!md.trim() || looksLikeHtmlDocument(md)) continue;
        if (md.trimStart().startsWith("{")) continue;
        const headerSource = (r.headers.get("x-changelog-source") || "").trim();
        const isRootFallback =
          CHANGELOG_ROOT_FALLBACKS.includes(mdPath) ||
          headerSource === "CHANGELOG.md" ||
          (!headerSource && mdPath.includes("family/changelog"));
        cachedChangelogBySurface[surfaceId] = md;
        cachedChangelogSource[surfaceId] = headerSource || mdPath.replace(/^\//, "");
        cachedChangelogMonolithic[surfaceId] = isRootFallback;
        return md;
      } catch {
        /* try next */
      }
    }
    throw new Error(`${surfaceId} changelog unavailable — hard refresh pockit.localhost`);
  }

  function monolithicChangelogNoteHtml(surfaceId) {
    const src = cachedChangelogSource[surfaceId] || "CHANGELOG.md";
    return `<p class="pad-cl-surface-note">Showing root fallback <code>${escapeHtml(src)}</code> — dedicated surface changelog was not reachable.</p>`;
  }

  function surfaceSourceNoteHtml(surfaceId) {
    const src = cachedChangelogSource[surfaceId];
    if (!src || cachedChangelogMonolithic[surfaceId]) return "";
    return `<p class="pad-cl-surface-note pad-cl-surface-note--source">Source: <code>${escapeHtml(src)}</code></p>`;
  }

  async function resolveSurfaceVersion(surfaceId) {
    try {
      const r = await fetch(`/api/v1/surface-changelog/${surfaceId}/version`, {
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
    const md = await fetchSurfaceChangelogMarkdown(surfaceId);
    return parseLatestChangelogVersion(md) || displayVersion();
  }

  async function resolveVersionFromChangelog(_surfaceCfg) {
    try {
      return parseLatestChangelogVersion(await fetchSurfaceChangelogMarkdown("pockit"));
    } catch {
      return null;
    }
  }

  async function load() {
    if (surface?._versionResolved) return surface;
    try {
      let r = await fetch("/pockit-surface.json", { cache: "no-store" });
      if (!r.ok) {
        r = await fetch("/pockit-surface.json", { cache: "no-store" });
      }
      if (!r.ok) throw new Error(`hub-surface.json HTTP ${r.status}`);
      const cfg = await r.json();
      runningVersion = loadedBundleVersion() || cfg.version || null;
      const changelogVer = await resolveVersionFromChangelog(cfg);
      surface = applyResolvedVersion(cfg, changelogVer || cfg.version);
      surface._changelogLatest = changelogVer || null;
      surface._versionResolved = true;
      applyUpdateAvailability(changelogVer || cfg.version);
      refreshBadge(surface);
      fillPockitStat();
      notifyVersionChrome();
      return surface;
    } catch {
      surface = {
        display_name: "Pockit",
        version: runningVersion || "—",
        _versionResolved: true,
      };
      ensureVersionChrome();
      return surface;
    }
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "pad-changelog-modal";
    modalEl.hidden = true;
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.innerHTML = `
      <div class="pad-changelog-backdrop" data-action="pad-changelog-close"></div>
      <div class="pad-changelog-panel">
        <header class="pad-changelog-header">
          <div class="pad-changelog-header-row">
            <div class="pad-changelog-header-title">
              <span class="pad-changelog-kicker" id="pad-changelog-kicker">Nephew Pockit</span>
              <span class="pad-changelog-version" id="pad-changelog-version">v—</span>
            </div>
            <button type="button" class="pad-changelog-close" data-action="pad-changelog-close" aria-label="Close">×</button>
          </div>
          <div id="pad-changelog-kind-legend" class="pad-changelog-kind-legend-host"></div>
        </header>
        <nav class="pad-changelog-tabs" role="tablist" aria-label="Changelog surface" id="pad-changelog-tabs"></nav>
        <div class="pad-changelog-body" id="pad-changelog-body" role="tabpanel"><p class="pad-cl-loading">Loading changelog…</p></div>
        <footer class="pad-changelog-footer">
          <span>Per-surface changelogs under <code>changelogs/</code></span>
          <a href="https://github.com/marvelousempire/nephew/tree/main/changelogs" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
        </footer>
      </div>`;
    modalEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=pad-changelog-close]")) closeChangelogModal();
    });
    document.body.appendChild(modalEl);
    const legendHost = modalEl.querySelector("#pad-changelog-kind-legend");
    if (legendHost && changelogRender().renderChangelogKindLegend) {
      legendHost.innerHTML = changelogRender().renderChangelogKindLegend();
    }
    return modalEl;
  }

  async function setChangelogTab(tabId) {
    if (!modalEl) return;
    if (tabId === INTENT_TAB_ID || tabId === "intent") {
      await setIntentTab();
      return;
    }
    toggleKindLegend(true);
    const surfaceId = tabId === "tower" ? "tower-api" : tabId;
    activeChangelogTab = surfaceId;
    modalEl.querySelectorAll("[data-changelog-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-changelog-tab") === surfaceId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const reg = await loadChangelogRegistry();
    const meta = reg[surfaceId] || DEFAULT_SURFACES[surfaceId] || { kicker: surfaceId, label: surfaceId };
    const kickerEl = modalEl.querySelector("#pad-changelog-kicker") || modalEl.querySelector(".pad-changelog-kicker");
    const verEl = modalEl.querySelector("#pad-changelog-version");
    const bodyEl = modalEl.querySelector("#pad-changelog-body");
    if (kickerEl) kickerEl.textContent = meta.kicker || meta.label || surfaceId;
    if (verEl) verEl.textContent = "v…";
    if (bodyEl) bodyEl.innerHTML = '<p class="pad-cl-loading">Loading changelog…</p>';
    try {
      const md = await fetchSurfaceChangelogMarkdown(surfaceId);
      const ver = parseLatestChangelogVersion(md) || "—";
      if (surfaceId === "tower-api") cachedTowerVersion = ver;
      if (verEl) verEl.textContent = `v${ver}`;
      const note = cachedChangelogMonolithic[surfaceId]
        ? monolithicChangelogNoteHtml(surfaceId)
        : surfaceSourceNoteHtml(surfaceId);
      if (bodyEl) bodyEl.innerHTML = note + renderChangelogMarkdown(md);
    } catch (err) {
      if (bodyEl) {
        bodyEl.innerHTML = `<p class="pad-cl-error">Couldn't load ${escapeHtml(surfaceId)} changelog: ${escapeHtml(err.message || err)}</p>`;
      }
    }
    const footerEl = modalEl.querySelector(".pad-changelog-footer");
    if (footerEl) {
      footerEl.innerHTML =
        '<span>Per-surface changelogs under <code>changelogs/</code></span>' +
        '<a href="https://github.com/marvelousempire/nephew/tree/main/changelogs" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>';
    }
    modalEl.setAttribute("aria-label", `${meta.label || surfaceId} CHANGELOG`);
  }

  async function openChangelogModal(opts = {}) {
    ensureChangelogStyles();
    await load();
    const modal = ensureModal();
    const bodyEl = modal.querySelector("#pad-changelog-body");
    const tabsEl = modal.querySelector("#pad-changelog-tabs");
    const scope = opts.scope || window.__pockitFooterScope || "overview";
    const cassetteId = opts.cassetteId ?? currentCassetteId();
    let tab = opts.tab || "pockit";
    if (tab === "tower" || tab === "tower-api") tab = "tower-api";
    if (tab === "intent") tab = INTENT_TAB_ID;
    activeChangelogTab = tab;
    await loadChangelogRegistry();
    if (tabsEl) {
      tabsEl.innerHTML = renderChangelogTabsHtml(scope, cassetteId);
      bindChangelogTabHandlers();
    }
    modal.hidden = false;
    modal.classList.remove("pad-changelog-closing");
    modal.classList.add("pad-changelog-open");
    if (bodyEl) bodyEl.innerHTML = '<p class="pad-cl-loading">Loading changelog…</p>';
    try {
      await setChangelogTab(tab);
    } catch (err) {
      if (bodyEl) {
        bodyEl.innerHTML = `<p class="pad-cl-error">Couldn't load changelog: ${escapeHtml(err.message || err)}</p>`;
      }
    }
  }

  function closeChangelogModal() {
    if (!modalEl) return;
    modalEl.classList.remove("pad-changelog-open");
    modalEl.classList.add("pad-changelog-closing");
    window.setTimeout(() => {
      modalEl.hidden = true;
      modalEl.classList.remove("pad-changelog-closing");
    }, 200);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeChangelogModal();
  });

  /** One delegated handler — footer innerHTML refresh must not drop per-node listeners. */
  let changelogClickDelegationBound = false;
  function ensureChangelogClickDelegation() {
    if (changelogClickDelegationBound) return;
    changelogClickDelegationBound = true;
    document.addEventListener("click", (e) => {
      const el = e.target.closest?.("[data-action=pad-changelog], [data-action=pockit-apply-update]");
      if (!el || el.disabled) return;
      const action = el.getAttribute("data-action");
      if (action === "pockit-apply-update") {
        e.preventDefault();
        applyPockitUpdate(updateAvailableVersion);
        return;
      }
      if (action !== "pad-changelog") return;
      e.preventDefault();
      void openChangelogModal({
        tab: el.getAttribute("data-changelog-open-tab") || "pockit",
        scope: window.__pockitFooterScope || "overview",
        cassetteId: currentCassetteId(),
      });
    });
  }
  ensureChangelogClickDelegation();

  document.addEventListener("pockit-intent-proto-ready", function () {
    if (modalEl && !modalEl.hidden && activeChangelogTab === INTENT_TAB_ID) {
      void setIntentTab();
    }
  });

  function mountFixedBadge() {
    ensureChangelogStyles();
    if (badgeEl) return;
    load()
      .then((s) => {
        if (badgeEl) return;
        badgeEl = document.createElement("button");
        badgeEl.type = "button";
        badgeEl.className = "pad-version-badge";
        badgeEl.title = `${surfaceDisplayName(s)} v${s.version} — click for CHANGELOG`;
        badgeEl.innerHTML = badgeLabelHtml(s);
        badgeEl.addEventListener("click", () => openChangelogModal());
        document.body.appendChild(badgeEl);
      })
      .catch(() => {});
  }

  function unmountFixedBadge() {
    unmountLegacyFixedBadge();
    hideInvariantVersionBadge();
  }

  function bindChangelogLinks(_root = document) {
    ensureChangelogClickDelegation();
  }

  function versionLine(towerApiVersion) {
    const hubVer = surface?.version || "—";
    const parts = [`${surfaceDisplayName()} v${hubVer}`];
    if (towerApiVersion != null) parts.push(`tower-api v${towerApiVersion}`);
    parts.push(
      '<button type="button" class="cl-link" data-action="pad-changelog" title="Pockit changelog">changelog</button>',
    );
    return parts.join(" · ");
  }

  function fillPockitStat() {
    const el = document.getElementById("pockit-surface-version");
    const ver = displayVersion();
    if (el && ver && ver !== "—") el.textContent = `${surfaceDisplayName()} v${ver}`;
  }

  return {
    load,
    get surface() {
      return surface;
    },
    get version() {
      return surface?.version || null;
    },
    get runningVersion() {
      return runningVersion;
    },
    get updateAvailableVersion() {
      return updateAvailableVersion;
    },
    startUpdateWatch,
    stopUpdateWatch,
    pollForUpdate,
    applyPockitUpdate,
    syncUpdateBadge,
    ensureVersionChrome,
    notifyVersionChrome,
    ensureInvariantVersionBadge,
    syncVersionBadgePlacement,
    syncFloatedBadgeOffset,
    hideInvariantVersionBadge,
    mountFixedBadge,
    unmountFixedBadge,
    openChangelogModal,
    openChangelog: openChangelogModal,
    closeChangelogModal,
    fetchChangelogMarkdown: fetchSurfaceChangelogMarkdown,
    fetchSurfaceChangelogMarkdown,
    bindChangelogLinks,
    versionLine,
    fillPockitStat,
    renderChangelogMarkdown,
    ensureChangelogStyles,
  };
})();

window.renderChangelogMarkdown = HubSurface.renderChangelogMarkdown;
window.HubSurface = HubSurface;
window.PadSurface = HubSurface;
window.PockitSurface = HubSurface;
