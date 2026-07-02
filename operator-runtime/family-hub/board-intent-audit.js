/**
 * Board Intent Audit — Trust Organization · Board of Trustees (DOI Phase 3).
 * Rolls up declaration-of-intent-registry.json + embedded declarations in mac-app-intent-registry.
 */
(function () {
  "use strict";

  var ROLLUP_URL = "/declaration-of-intent-registry.json";
  var MAC_REGISTRY_URL = "/mac-app-intent-registry.json";

  var state = { filter: "ALL", items: [] };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function udinLabel(d) {
    var Panel = window.DeclarationOfIntentPanel;
    if (Panel && Panel.udinLabel) return Panel.udinLabel(d);
    var u = d.udin || {};
    var seq = String(u.sequence || 0).padStart(5, "0");
    var lv = d.lawVersion || { major: 0, minor: 0 };
    return (u.kind || "FEAT") + "-" + seq + " · v" + lv.major + "." + lv.minor;
  }

  function collectItems(rollup, macReg) {
    var Adapters = window.DeclarationOfIntentAdapters;
    var items = [];
    var seen = {};

    (rollup.declarations || []).forEach(function (row) {
      var key = row.udin || row.slug;
      if (seen[key]) return;
      seen[key] = true;
      var doi = null;
      var legacyKey = row.legacy && row.legacy.registryKey;
      var appId = legacyKey && legacyKey.indexOf("apps.") === 0 ? legacyKey.slice(5) : null;
      if (appId && macReg.apps && macReg.apps[appId] && macReg.apps[appId].declaration) {
        doi = macReg.apps[appId].declaration;
      }
      items.push({
        rollup: row,
        declaration: doi,
        entity: row.entity || (doi && doi.steward && doi.steward.entity) || "—",
        title: row.title || (doi && doi.title) || row.slug,
        tagline: (doi && doi.tagline) || "",
        udin: row.udin || udinLabel(doi || {}),
        badgeVariant: (doi && doi.badgeVariant) || (row.entity === "READYPLAY" ? "shield" : "promise"),
      });
    });

    if (macReg.apps) {
      Object.keys(macReg.apps).forEach(function (appId) {
        var app = macReg.apps[appId];
        if (!app.declaration) return;
        var ud = app.declaration.udin;
        var udStr =
          ud && ud.kind
            ? ud.kind + "-" + String(ud.sequence).padStart(5, "0")
            : app.udin || appId;
        if (seen[udStr]) return;
        seen[udStr] = true;
        items.push({
          rollup: { slug: appId, entity: app.entity },
          declaration: app.declaration,
          entity: app.entity || (app.declaration.steward && app.declaration.steward.entity) || "NEPHEW",
          title: app.declaration.title || app.displayName || appId,
          tagline: app.declaration.tagline || app.tagline || "",
          udin: udStr,
          badgeVariant: app.declaration.badgeVariant || "promise",
        });
      });
    }

    if (Adapters && macReg.apps) {
      items.forEach(function (item) {
        if (item.declaration) return;
        var appId = item.rollup && item.rollup.legacy && item.rollup.legacy.registryKey;
        appId = appId ? appId.replace("apps.", "") : null;
        if (!appId || !macReg.apps[appId]) return;
        item.declaration = Adapters.resolveFromProto(
          Object.assign({ appId: appId }, macReg.apps[appId]),
        );
      });
    }

    return items.sort(function (a, b) {
      return String(a.udin).localeCompare(String(b.udin));
    });
  }

  function renderFilters(items) {
    var entities = ["ALL"];
    items.forEach(function (it) {
      if (entities.indexOf(it.entity) < 0) entities.push(it.entity);
    });
    var el = document.getElementById("board-audit-filters");
    el.hidden = false;
    el.innerHTML = entities
      .map(function (e) {
        return (
          '<button type="button" class="board-audit-filter' +
          (state.filter === e ? " is-active" : "") +
          '" data-filter="' +
          esc(e) +
          '">' +
          esc(e) +
          "</button>"
        );
      })
      .join("");
    el.querySelectorAll(".board-audit-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        renderGrid();
        renderFilters(state.items);
      });
    });
  }

  function renderGrid() {
    var grid = document.getElementById("board-audit-grid");
    var list = state.items.filter(function (it) {
      return state.filter === "ALL" || it.entity === state.filter;
    });
    grid.innerHTML = list
      .map(function (it, idx) {
        var chipClass =
          it.badgeVariant === "shield" ? "board-audit-chip--shield" : "board-audit-chip--promise";
        return (
          '<button type="button" class="board-audit-card" data-idx="' +
          idx +
          '">' +
          '<div class="board-audit-card__entity">' +
          esc(it.entity) +
          "</div>" +
          '<div class="board-audit-card__title">' +
          esc(it.title) +
          "</div>" +
          '<p class="board-audit-card__tagline">' +
          esc(it.tagline || "Tap for full declaration panel.") +
          "</p>" +
          '<div class="board-audit-card__chips">' +
          '<span class="board-audit-chip ' +
          chipClass +
          '">' +
          esc(it.udin) +
          "</span>" +
          (it.badgeVariant === "shield"
            ? '<span class="board-audit-chip">Shield</span>'
            : '<span class="board-audit-chip">Promise</span>') +
          "</div></button>"
        );
      })
      .join("");

    var filtered = state.items.filter(function (it) {
      return state.filter === "ALL" || it.entity === state.filter;
    });

    grid.querySelectorAll(".board-audit-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-idx"), 10);
        openPanel(filtered[i]);
      });
    });
  }

  function openPanel(item) {
    if (!item || !item.declaration) return;
    var Panel = window.DeclarationOfIntentPanel;
    var backdrop = document.getElementById("board-audit-backdrop");
    var panel = document.getElementById("board-audit-panel");
    panel.innerHTML =
      (Panel ? Panel.renderPanelHtml(item.declaration) : "<p>No panel.</p>") +
      '<button type="button" class="board-audit-panel__close">Done</button>';
    backdrop.hidden = false;
    panel.querySelector(".board-audit-panel__close").onclick = closePanel;
    backdrop.onclick = function (e) {
      if (e.target === backdrop) closePanel();
    };
  }

  function closePanel() {
    var backdrop = document.getElementById("board-audit-backdrop");
    backdrop.hidden = true;
  }

  function boot() {
    Promise.all([
      fetch(ROLLUP_URL, { cache: "no-store" }).then(function (r) {
        return r.json();
      }),
      fetch(MAC_REGISTRY_URL, { cache: "no-store" }).then(function (r) {
        return r.json();
      }),
    ])
      .then(function (pair) {
        state.items = collectItems(pair[0], pair[1]);
        var withDecl = state.items.filter(function (it) {
          return it.declaration;
        }).length;
        document.getElementById("board-audit-stats").textContent =
          withDecl +
          " of " +
          state.items.length +
          " registry rows carry embedded declarations · updated " +
          (pair[0].updatedOn || "—");
        document.getElementById("board-audit-raw").textContent = JSON.stringify(pair[0], null, 2);
        renderFilters(state.items);
        renderGrid();
      })
      .catch(function (err) {
        document.getElementById("board-audit-stats").textContent = "Failed to load registries: " + err.message;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
