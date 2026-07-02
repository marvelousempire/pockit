/**
 * Mac .app intent chrome — footer Intent tab + registry (Plan 0285).
 * Intent lives in the version/changelog modal (full Pockit shell) or proto footer pill.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "nephew-pockit-mac-app";
  var REGISTRY_URL = "/mac-app-intent-registry.json";
  var INTENT_TAB_ID = "mac-app-intent";

  var registryCache = null;
  var activeAppId = null;
  var activeProto = null;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kwLabel(pair) {
    if (!pair) return "";
    var s = (pair.subject || "").trim();
    var a = (pair.action || "").trim();
    return s && a ? s + " · " + a : s || a;
  }

  function readAppIdFromUrl() {
    try {
      var id = new URLSearchParams(location.search).get("mac_app");
      if (id && /^[\w-]+$/.test(id)) return id;
    } catch (_) {}
    return null;
  }

  function readStoredAppId() {
    try {
      var id = localStorage.getItem(STORAGE_KEY);
      if (id && /^[\w-]+$/.test(id)) return id;
    } catch (_) {}
    return null;
  }

  function persistAppId(appId) {
    try {
      localStorage.setItem(STORAGE_KEY, appId);
    } catch (_) {}
  }

  function closeModal() {
    var open = document.querySelector(".fo-proto-modal-backdrop");
    if (open) open.remove();
  }

  function openModal(title, bodyHtml) {
    closeModal();
    var backdrop = document.createElement("div");
    backdrop.className = "fo-proto-modal-backdrop";
    backdrop.innerHTML =
      '<div class="fo-proto-modal" role="dialog" aria-modal="true" aria-labelledby="fo-proto-modal-title">' +
      '<h2 id="fo-proto-modal-title">' +
      esc(title) +
      "</h2>" +
      bodyHtml +
      '<button type="button" class="fo-proto-modal__close">Close</button></div>';
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector(".fo-proto-modal__close").addEventListener("click", closeModal);
    document.body.appendChild(backdrop);
  }

  function renderIntentTextSection(title, text) {
    if (!text) return "";
    return (
      "<section><h3 class=\"pad-cl-intent-h3\">" +
      esc(title) +
      "</h3><p>" +
      esc(text) +
      "</p></section>"
    );
  }

  function renderIntentListSection(title, items) {
    if (!items || !items.length) return "";
    return (
      "<section><h3 class=\"pad-cl-intent-h3\">" +
      esc(title) +
      "</h3><ul class=\"pad-cl-intent-list\">" +
      items
        .map(function (item) {
          return "<li>" + esc(item) + "</li>";
        })
        .join("") +
      "</ul></section>"
    );
  }

  function renderIntentPanelHtml(proto) {
    proto = proto || activeProto;
    if (!proto) {
      return '<p class="pad-cl-loading">Loading app intent…</p>';
    }
    var Adapters = window.DeclarationOfIntentAdapters;
    var Panel = window.DeclarationOfIntentPanel;
    if (Adapters && Panel) {
      var doi = Adapters.resolveFromProto(proto);
      return Panel.renderPanelHtml(doi, { articleClass: "pad-cl-intent-panel" });
    }
    return renderIntentPanelHtmlLegacy(proto);
  }

  function renderIntentPanelHtmlLegacy(proto) {
    var intent = proto.intent || {};
    var kws = (proto.keywords || []).slice(0, 2);
    var kwHtml = kws
      .map(function (k) {
        return '<span class="fo-proto-kw">' + esc(kwLabel(k)) + "</span>";
      })
      .join("");
    var guide = proto.whyGuide || [];
    var guideHtml = guide.length
      ? "<section><h3 class=\"pad-cl-intent-h3\">The why guide</h3>" +
        '<div class="pad-cl-intent-table-wrap"><table class="pad-cl-intent-table">' +
        "<thead><tr>" +
        "<th>Component</th><th>Problem</th><th>Purpose</th><th>Why chosen</th><th>Advantage</th><th>Human-like</th>" +
        "</tr></thead><tbody>" +
        guide
          .map(function (row) {
            return (
              "<tr><td>" +
              esc(row.component || "—") +
              "</td><td>" +
              esc(row.problem || "—") +
              "</td><td>" +
              esc(row.purpose || "—") +
              "</td><td>" +
              esc(row.whyChosen || "—") +
              "</td><td>" +
              esc(row.advantage || "—") +
              "</td><td>" +
              esc(row.contribution || "—") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div></section>"
      : "";
    var masterTitle = proto.masterTitle
      ? '<h2 class="pad-cl-intent-master-title">' + esc(proto.masterTitle) + "</h2>"
      : "";
    var udinLine =
      proto.udin || proto.lawVersion
        ? '<p class="pad-cl-intent-udin">' +
          esc(proto.udin || "") +
          (proto.lawVersion ? " · v" + esc(proto.lawVersion) : "") +
          (proto.entity ? " · " + esc(proto.entity) : "") +
          "</p>"
        : "";
    var taglineLine = proto.tagline
      ? '<p class="pad-cl-intent-tagline">' + esc(proto.tagline) + "</p>"
      : "";
    return (
      '<article class="pad-cl-intent-panel">' +
      masterTitle +
      udinLine +
      taglineLine +
      '<p class="pad-cl-intent-sub">Declaration of intent · Super Rick format</p>' +
      (kwHtml ? '<div class="fo-proto-kw-row pad-cl-intent-kw-row">' + kwHtml + "</div>" : "") +
      renderIntentTextSection("Intention", intent.why) +
      renderIntentTextSection("The problem", intent.problem) +
      renderIntentTextSection("Before this existed", intent.before) +
      renderIntentTextSection("What it does for you", intent.does) +
      renderIntentTextSection("North star", proto.northStar) +
      renderIntentTextSection("User promise", proto.userPromise) +
      renderIntentListSection("Principles", proto.principles) +
      renderIntentListSection("Success criteria", proto.successCriteria) +
      renderIntentListSection("Not trying to", proto.nonGoals) +
      renderIntentListSection("Data commitments", proto.privacyCommitments) +
      guideHtml +
      (proto.appVersion
        ? '<p class="pad-cl-intent-meta">App v' +
          esc(proto.appVersion) +
          " · stack Nephew " +
          esc(proto.monorepoVersion || "—") +
          "</p>"
        : "") +
      "</article>"
    );
  }

  function intentModal(proto) {
    openModal((proto.displayName || "App") + " — intent", renderIntentPanelHtml(proto));
  }

  /** Full Pockit shell already has #main-footer + Plan 0273 accordion modal — do not overlay fo-proto-footer. */
  function isFullPockitShell() {
    var app = document.getElementById("app");
    if (app && app.classList.contains("cassette-player")) return true;
    if (document.documentElement.getAttribute("data-tape") === "1" && document.getElementById("main-footer")) {
      return true;
    }
    return false;
  }

  function openPockitChangelogModal(tab) {
    var ps = window.PadSurface || window.PockitSurface || window.HubSurface;
    if (ps && typeof ps.openChangelogModal === "function") {
      void ps.openChangelogModal({ tab: tab || INTENT_TAB_ID });
      return true;
    }
    return false;
  }

  function changelogModal(proto) {
    var rows = (proto.changelog || [])
      .map(function (row) {
        return (
          "<li><strong>v" +
          esc(row.version || "?") +
          "</strong> · " +
          esc(row.date || "") +
          "<br>" +
          esc(row.summary || "") +
          "</li>"
        );
      })
      .join("");
    openModal(
      proto.displayName + " changelog",
      '<p class="fo-proto-modal__sub">App v' +
        esc(proto.appVersion || "?") +
        " · stack Nephew " +
        esc(proto.monorepoVersion || "?") +
        "</p>" +
        '<section><ul class="changelog">' +
        (rows || "<li>No entries yet.</li>") +
        "</ul></section>"
    );
  }

  function refreshIntentFooterAffordances() {
    var labelEl = document.getElementById("shell-intent-pill-label");
    if (labelEl && activeProto) {
      labelEl.textContent = "Intent";
    }
    var tipEl = document.getElementById("pockit-intent-invariant");
    if (tipEl && activeProto) {
      tipEl.setAttribute(
        "data-comet-tip",
        (activeProto.displayName || "App") + " intent\nWhy · problem · what it does",
      );
    }
    window.dispatchEvent(new CustomEvent("pockit-intent-proto-ready", { detail: { proto: activeProto } }));
  }

  function buildChromeDom(proto) {
    var root = document.getElementById("fo-proto-root");
    if (root) root.remove();

    activeProto = proto;
    var shieldOnly = isFullPockitShell();
    document.body.classList.toggle("fo-proto-shield-only", shieldOnly);

    var footerHtml = shieldOnly
      ? ""
      : '<footer class="fo-proto-footer" id="fo-proto-footer">' +
        '<span class="fo-proto-footer__name">' +
        esc(proto.displayName) +
        "</span>" +
        '<button type="button" class="fo-proto-footer__ver" id="fo-proto-changelog-btn" title="App changelog">v' +
        esc(proto.appVersion || "?") +
        "</button>" +
        '<span class="fo-proto-footer__sep">·</span>' +
        '<button type="button" class="fo-proto-footer__intent" id="fo-proto-intent-btn" title="Why this app exists">Intent</button>' +
        '<span class="fo-proto-footer__sep">·</span>' +
        '<span class="fo-proto-footer__stack">Nephew ' +
        esc(proto.monorepoVersion || "?") +
        "</span>" +
        "</footer>";

    root = document.createElement("div");
    root.id = "fo-proto-root";
    root.setAttribute("data-app-id", proto.appId || "");
    root.setAttribute("data-shield-only", shieldOnly ? "1" : "0");
    root.innerHTML = footerHtml;
    document.body.appendChild(root);

    refreshIntentFooterAffordances();

    var changelogBtn = document.getElementById("fo-proto-changelog-btn");
    if (changelogBtn) {
      changelogBtn.addEventListener("click", function () {
        if (!openPockitChangelogModal("pockit")) changelogModal(proto);
      });
    }
    var intentBtn = document.getElementById("fo-proto-intent-btn");
    if (intentBtn) {
      intentBtn.addEventListener("click", function () {
        if (!openPockitChangelogModal(INTENT_TAB_ID)) intentModal(proto);
      });
    }
  }

  function protoFromRegistry(doc, appId, monorepoVersion) {
    var row = doc && doc.apps && doc.apps[appId];
    if (!row) return null;
    return {
      appId: appId,
      displayName: row.displayName || appId,
      appVersion: row.appVersion || "1.0.0",
      monorepoVersion: monorepoVersion || "—",
      entity: row.entity || "",
      udin: row.udin || "",
      lawVersion: row.lawVersion || "",
      tagline: row.tagline || "",
      masterTitle: row.masterTitle || "",
      intent: row.intent || {},
      northStar: row.northStar || "",
      userPromise: row.userPromise || "",
      principles: row.principles || [],
      successCriteria: row.successCriteria || [],
      nonGoals: row.nonGoals || [],
      privacyCommitments: row.privacyCommitments || [],
      whyGuide: row.whyGuide || [],
      ledgerId: row.ledgerId || "",
      ledgerHashtag: row.ledgerHashtag || "",
      tags: row.tags || [],
      keywords: row.keywords || [],
      changelog: row.changelog || [],
      declaration: row.declaration || null,
    };
  }

  function resolveIntentAppId() {
    try {
      if (window.__pockitFooterScope === "voice") return "voice";
      if (window.__pockitFooterScope === "video") return "video";
    } catch (_) {}
    return activeAppId || resolveInitialAppId();
  }

  function fetchRegistry() {
    if (registryCache) return Promise.resolve(registryCache);
    return fetch(REGISTRY_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("registry " + r.status);
        return r.json();
      })
      .then(function (doc) {
        registryCache = doc;
        return doc;
      });
  }

  function mount(appId) {
    if (!appId || !/^[\w-]+$/.test(appId)) appId = "pockit";
    activeAppId = appId;
    persistAppId(appId);

    var inline = (function () {
      try {
        var el = document.getElementById("fo-app-proto");
        if (!el) return null;
        var parsed = JSON.parse(el.textContent || "{}");
        if (!parsed.displayName && !parsed.intent) return null;
        parsed.appId = parsed.appId || appId;
        return parsed;
      } catch (_) {
        return null;
      }
    })();

    if (inline) {
      document.body.classList.add("fo-proto-active");
      buildChromeDom(inline);
      return Promise.resolve(inline);
    }

    return fetchRegistry()
      .then(function (doc) {
        var monover = "—";
        try {
          if (window.POCKIT_SURFACE && window.POCKIT_SURFACE.version) {
            monover = window.POCKIT_SURFACE.version;
          }
        } catch (_) {}
        var proto = protoFromRegistry(doc, appId, monover);
        if (!proto) return null;
        document.body.classList.add("fo-proto-active");
        buildChromeDom(proto);
        return proto;
      })
      .catch(function () {
        return null;
      });
  }

  function resolveInitialAppId() {
    if (window.__NEPHEW_MAC_APP_ID && /^[\w-]+$/.test(window.__NEPHEW_MAC_APP_ID)) {
      return window.__NEPHEW_MAC_APP_ID;
    }
    return readAppIdFromUrl() || readStoredAppId() || "pockit";
  }

  function stripMacAppQuery() {
    try {
      if (!location.search.includes("mac_app=")) return;
      var u = new URL(location.href);
      u.searchParams.delete("mac_app");
      var next = u.pathname + u.search + u.hash;
      history.replaceState(null, "", next);
    } catch (_) {}
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  document.addEventListener("nephew-mac-app-intent", function (e) {
    var id = e.detail && e.detail.appId;
    if (id) mount(id);
  });

  window.NephewMacAppIntent = {
    mount: mount,
    resolveAppId: resolveInitialAppId,
    resolveIntentAppId: resolveIntentAppId,
    INTENT_TAB_ID: INTENT_TAB_ID,
    renderIntentPanelHtml: renderIntentPanelHtml,
    getActiveProto: function () {
      return activeProto;
    },
    get activeAppId() {
      return activeAppId;
    },
  };

  function boot() {
    var appId = resolveInitialAppId();
    stripMacAppQuery();
    mount(appId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
