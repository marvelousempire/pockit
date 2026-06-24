/**
 * Pockit Accessory Desk — native center panel (install / door / Desktop .app per accessory).
 */
(function () {
  const API = window.PockitAccessoryDesk;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const el = document.getElementById("accessory-desk-status");
    if (el) el.textContent = msg || "";
  }

  function statusPill(summary) {
    if (!summary) return `<span class="accessory-desk-pill is-pending">LOADING</span>`;
    if (summary.missing_count === 0) {
      return `<span class="accessory-desk-pill is-ok">ALL ON DESKTOP</span>`;
    }
    return `<span class="accessory-desk-pill is-warn">${summary.missing_count} MISSING</span>`;
  }

  function rowActions(row) {
    const id = escapeHtml(row.id);
    return `
      <div class="accessory-desk-row__actions">
        <button type="button" class="comet-btn comet-btn--sm" data-desk-panel-action="install" data-app-id="${id}">Install</button>
        <button type="button" class="comet-btn comet-btn--sm comet-btn--ghost" data-desk-panel-action="launch" data-app-id="${id}">Open door</button>
        <button type="button" class="comet-btn comet-btn--sm comet-btn--ghost" data-desk-panel-action="open-app" data-app-id="${id}">Launch .app</button>
      </div>`;
  }

  function renderRows(rows) {
    if (!rows?.length) {
      return `<li class="accessory-desk-row accessory-desk-row--empty">No installable Desktop accessories in manifest.</li>`;
    }
    return rows
      .map((row) => {
        const ledClass = row.installed ? "is-ok" : "is-missing";
        const state = row.installed ? "On Desktop" : "Not installed";
        return `
        <li class="accessory-desk-row ${ledClass}" data-app-id="${escapeHtml(row.id)}">
          <div class="accessory-desk-row__main">
            <span class="accessory-desk-led" aria-hidden="true"></span>
            <div class="accessory-desk-row__copy">
              <strong>${escapeHtml(row.displayName)}</strong>
              <span class="accessory-desk-row__meta">${escapeHtml(row.macApp)} · ${state}</span>
            </div>
          </div>
          ${rowActions(row)}
        </li>`;
      })
      .join("");
  }

  function renderShell(summary) {
    const s = summary || {};
    return `
      <div id="accessory-desk-panel" class="accessory-desk">
        <header class="accessory-desk__hero">
          <h2 class="accessory-desk__title">Accessory Desk</h2>
          <p class="accessory-desk__lead">Install Family Office Mac Accessories on Desktop, open their doors, or launch the .app — from Pockit without Suite.</p>
          <p class="accessory-desk__meta">
            ${statusPill(s)}
            <span>${s.installed_count || 0} / ${s.total || 0} on Desktop</span>
            ${s.desktop ? `<span>${escapeHtml(s.desktop)}</span>` : ""}
          </p>
          <p id="accessory-desk-status" class="accessory-desk__status" aria-live="polite"></p>
          <div class="accessory-desk__actions">
            <button type="button" class="comet-btn comet-btn--primary" id="accessory-desk-install-missing">Install all missing</button>
            <button type="button" class="comet-btn comet-btn--ghost" id="accessory-desk-refresh">Refresh</button>
          </div>
        </header>
        <ul class="accessory-desk-list" id="accessory-desk-list">${renderRows(s.rows)}</ul>
      </div>`;
  }

  async function refresh() {
    if (!API?.fetchSummary) {
      setStatus("Accessory Desk API failed to load — hard refresh.");
      return null;
    }
    setStatus("Scanning Desktop inventory…");
    const summary = await API.fetchSummary();
    const root = document.getElementById("accessory-desk-panel");
    if (root) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderShell(summary);
      const fresh = tmp.firstElementChild;
      root.replaceWith(fresh);
      bind();
    }
    setStatus(
      summary.all_installed
        ? "All accessories on Desktop."
        : `${summary.missing_count} accessory(ies) not on Desktop yet.`,
    );
    return summary;
  }

  async function runAction(action, appId) {
    if (!API || !appId) return;
    const labels = { install: "Installing", launch: "Opening door for", "open-app": "Launching" };
    setStatus(`${labels[action] || "Working on"} ${appId}…`);
    let result;
    if (action === "install") result = await API.install(appId);
    else if (action === "launch") result = await API.launch(appId);
    else if (action === "open-app") result = await API.openApp(appId);
    if (result?.ok) {
      setStatus(`${appId}: done.`);
      await refresh();
    } else {
      setStatus(result?.error || `${appId}: failed — see tower log`);
    }
    return result;
  }

  function bind() {
    document.getElementById("accessory-desk-refresh")?.addEventListener("click", () => {
      refresh().catch((e) => setStatus(e.message || String(e)));
    });
    document.getElementById("accessory-desk-install-missing")?.addEventListener("click", () => {
      API?.installMissing?.().catch((e) => setStatus(e.message || String(e)));
    });
    document.querySelectorAll("[data-desk-panel-action]").forEach((btn) => {
      if (btn.dataset.deskPanelBound === "1") return;
      btn.dataset.deskPanelBound = "1";
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-desk-panel-action") || "";
        const appId = btn.getAttribute("data-app-id") || "";
        runAction(action, appId).catch((e) => setStatus(e.message || String(e)));
      });
    });
  }

  function render() {
    return renderShell({ rows: [], total: 0, installed_count: 0, missing_count: 0 });
  }

  window.PockitAccessoryDeskPanel = { render, bind, refresh, runAction };
})();