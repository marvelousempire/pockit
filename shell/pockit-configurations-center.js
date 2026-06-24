/**
 * Plan 0304 — Configurations Center pad (registry read + tower PATCH).
 */
(function () {
  const API_REGISTRY = "/api/v1/operator/config/registry";
  const API_CONFIG = "/api/v1/operator/config";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const el = document.getElementById("config-center-status");
    if (el) el.textContent = msg || "";
  }

  const DOMAINS = [
    { id: "all", label: "All" },
    { id: "voice", label: "Voice" },
    { id: "pockit", label: "Pockit" },
    { id: "nas", label: "NAS" },
    { id: "operator", label: "Operator" },
  ];

  let state = {
    registry: null,
    activeId: null,
    activeDomain: "all",
    configData: null,
    view: "pretty",
  };

  async function fetchRegistry() {
    const res = await fetch(API_REGISTRY, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
    return res.json();
  }

  async function fetchConfig(id) {
    const res = await fetch(`${API_CONFIG}/${encodeURIComponent(id)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`config HTTP ${res.status}`);
    return res.json();
  }

  async function patchConfig(id, body) {
    const res = await fetch(`${API_CONFIG}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `PATCH HTTP ${res.status}`);
    return payload;
  }

  function filteredEntries() {
    const entries = state.registry?.entries || [];
    if (state.activeDomain === "all") return entries;
    return entries.filter((e) => e.domain === state.activeDomain);
  }

  function renderEntryList() {
    return filteredEntries()
      .map(
        (e) => `<button type="button" class="config-center-entry ${state.activeId === e.id ? "is-active" : ""}" data-entry-id="${esc(e.id)}">
        <span class="config-center-entry__title">${esc(e.title)}</span>
        <span class="config-center-entry__meta">${esc(e.write_policy)} · ${esc(e.domain)}</span>
      </button>`,
      )
      .join("");
  }

  function renderInspector(entry) {
    if (!entry) {
      return `<p class="config-center-hint">Pick a configuration on the left.</p>`;
    }
    const json =
      state.configData != null
        ? JSON.stringify(state.configData, null, 2)
        : entry.path?.startsWith("localStorage:")
          ? "(client-only — open Settings → Layout)"
          : "Loading…";
    const helpLink = entry.help_article
      ? `<a class="comet-btn comet-btn--ghost" href="#/welcome" data-help-article="${esc(entry.help_article)}">Help: ${esc(entry.help_article)}</a>`
      : "";
    const makeBtn = entry.smoke_make
      ? `<button type="button" class="comet-btn comet-btn--ghost" data-make-run="${esc(entry.smoke_make)}">▶ make ${esc(entry.smoke_make)}</button>`
      : entry.regen_make
        ? `<button type="button" class="comet-btn comet-btn--ghost" data-make-run="${esc(entry.regen_make)}">▶ make ${esc(entry.regen_make)}</button>`
        : entry.install_make
          ? `<span class="config-center-hint">Install: make ${esc(entry.install_make)}</span>`
          : "";
    const housekeeper = entry.housekeeper_id
      ? `<p class="config-center-hint">Housekeeper: <strong>${esc(entry.housekeeper_id)}</strong>${entry.propagate_to?.length ? ` · propagate_to: ${entry.propagate_to.join(", ")}` : ""}</p>`
      : "";
    const canWrite = entry.write_policy === "tower-api";
    return `
      <header class="config-center-inspector__head">
        <h3>${esc(entry.title)}</h3>
        <p class="config-center-hint"><code>${esc(entry.path)}</code></p>
        ${housekeeper}
        <div class="config-center-inspector__actions">
          ${helpLink}
          ${makeBtn}
          ${canWrite ? `<button type="button" class="comet-btn comet-btn--primary" id="config-center-save">Save JSON</button>` : ""}
          ${entry.write_policy === "read-only" ? `<span class="config-center-pill">read-only</span>` : ""}
        </div>
      </header>
      <textarea class="config-center-json" id="config-center-editor" spellcheck="false" ${canWrite ? "" : "readonly"}>${esc(json)}</textarea>`;
  }

  function renderShell() {
    return `
      <div id="configurations-center" class="config-center">
        <header class="config-center__hero">
          <h2 class="config-center__title">Configurations Center</h2>
          <p class="config-center__lead">Registry-driven operator JSON — read live disk via tower-api; PATCH where write_policy allows.</p>
          <p id="config-center-status" class="config-center__status" aria-live="polite"></p>
        </header>
        <div class="config-center__grid">
          <nav class="config-center-domains" aria-label="Domains">
            ${DOMAINS.map(
              (d) =>
                `<button type="button" class="config-center-domain ${state.activeDomain === d.id ? "is-active" : ""}" data-domain="${esc(d.id)}">${esc(d.label)}</button>`,
            ).join("")}
          </nav>
          <aside class="config-center-list" id="config-center-list">${renderEntryList()}</aside>
          <main class="config-center-inspector" id="config-center-inspector">${renderInspector(null)}</main>
        </div>
      </div>`;
  }

  async function selectEntry(id) {
    state.activeId = id;
    state.configData = null;
    paint();
    const entry = (state.registry?.entries || []).find((e) => e.id === id);
    if (!entry || entry.path?.startsWith("localStorage:")) {
      paint();
      return;
    }
    setStatus(`Loading ${id}…`);
    try {
      const payload = await fetchConfig(id);
      state.configData = payload.data ?? payload;
      setStatus("");
    } catch (e) {
      setStatus(e.message || String(e));
    }
    paint();
  }

  function paint() {
    const root = document.getElementById("configurations-center");
    if (!root) return;
    const list = root.querySelector("#config-center-list");
    const inspector = root.querySelector("#config-center-inspector");
    if (list) list.innerHTML = renderEntryList();
    const entry = (state.registry?.entries || []).find((e) => e.id === state.activeId);
    if (inspector) inspector.innerHTML = renderInspector(entry);
    bindInspector();
    bindList(root);
  }

  function bindList(root) {
    root.querySelectorAll("[data-domain]").forEach((btn) => {
      btn.onclick = () => {
        state.activeDomain = btn.dataset.domain;
        paint();
      };
    });
    root.querySelectorAll("[data-entry-id]").forEach((btn) => {
      btn.onclick = () => selectEntry(btn.dataset.entryId);
    });
  }

  function bindInspector() {
    document.getElementById("config-center-save")?.addEventListener("click", async () => {
      const editor = document.getElementById("config-center-editor");
      if (!editor || !state.activeId) return;
      setStatus("Saving…");
      try {
        const body = JSON.parse(editor.value);
        await patchConfig(state.activeId, body);
        state.configData = body;
        setStatus("Saved.");
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    document.querySelectorAll("[data-make-run]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setStatus(`Run make ${btn.dataset.makeRun} from Help Command Center or terminal.`);
      });
    });
    document.querySelectorAll("[data-help-article]").forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const article = a.dataset.helpArticle;
        if (window.PockitHelpConsole?.openArticle) {
          window.PockitHelpConsole.openArticle("voice", article);
        } else {
          location.hash = "#/welcome";
        }
      });
    });
  }

  function bind() {
    const root = document.getElementById("configurations-center");
    if (!root) return;
    bindList(root);
    bindInspector();
  }

  async function refresh() {
    setStatus("Loading registry…");
    state.registry = await fetchRegistry();
    setStatus("");
    if (!state.activeId && state.registry.entries?.length) {
      await selectEntry(state.registry.entries[0].id);
    } else {
      paint();
    }
  }

  function render() {
    return renderShell();
  }

  window.PockitConfigurationsCenter = { render, bind, refresh };
})();
