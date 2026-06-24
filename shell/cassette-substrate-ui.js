/** Plan 0169 — Full cartridge settings page (memory · RAG · API · MCP · manifest features). */
(function () {
  function prefsKey(id) { return `tower-cassette-settings-${id}`; }
  function loadPrefs(id) {
    try { return JSON.parse(localStorage.getItem(prefsKey(id)) || "{}"); } catch { return {}; }
  }
  function savePrefs(id, prefs) {
    localStorage.setItem(prefsKey(id), JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("nephew-cassette-settings", { detail: { cassetteId: id, prefs } }));
  }
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function prefValue(prefs, key, field) {
    if (prefs[key] !== undefined) return prefs[key];
    if (field && field.default !== undefined) return field.default;
    return field?.type === "boolean" ? false : "";
  }
  function renderSettingControl(key, field, prefs) {
    const val = prefValue(prefs, key, field);
    const desc = field.description ? `<small class="cs-field-desc">${esc(field.description)}</small>` : "";
    if (field.type === "boolean") {
      return `<label class="cs-field cs-field--toggle"><span class="cs-field-label">${esc(field.label || key)}</span>${desc}<input type="checkbox" class="cs-pref" data-pref-key="${esc(key)}" ${val ? "checked" : ""} /></label>`;
    }
    if (field.type === "select" && Array.isArray(field.options)) {
      const opts = field.options.map((o) => {
        const v = o.value ?? o;
        return `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(o.label ?? o)}</option>`;
      }).join("");
      return `<label class="cs-field"><span class="cs-field-label">${esc(field.label || key)}</span>${desc}<select class="cs-pref" data-pref-key="${esc(key)}">${opts}</select></label>`;
    }
    if (field.type === "number") {
      return `<label class="cs-field"><span class="cs-field-label">${esc(field.label || key)}</span>${desc}<input type="number" class="cs-pref" data-pref-key="${esc(key)}" value="${esc(val)}" ${field.min != null ? `min="${field.min}"` : ""} ${field.max != null ? `max="${field.max}"` : ""} /></label>`;
    }
    return `<label class="cs-field"><span class="cs-field-label">${esc(field.label || key)}</span>${desc}<input type="text" class="cs-pref" data-pref-key="${esc(key)}" value="${esc(val)}" /></label>`;
  }
  function renderCassetteSettingsFields(sub, prefs) {
    const fields = sub.cassette_settings || {};
    const keys = Object.keys(fields);
    if (!keys.length) return `<p class="cs-hint">No <code>settings</code> in cassette.json — add boolean, number, string, or select fields.</p>`;
    return keys.map((k) => renderSettingControl(k, fields[k], prefs)).join("");
  }
  function renderManifestFeatures(sub) {
    return (sub.features || []).map((f) => {
      if ((f.key === "routes" || f.key === "subroutes") && Array.isArray(f.value)) {
        const rows = f.value.map((r) => `<div class="cs-feature-row"><span>${esc(r.label || r.path)}</span><code class="cs-mono">${esc(r.path)}</code><button type="button" class="comet-btn comet-btn--ghost cs-open-route" data-route-path="${esc(r.path)}">Open</button></div>`).join("");
        return `<div class="cs-feature-group"><h4>${esc(f.label || f.key)}</h4>${rows}</div>`;
      }
      return `<div class="cs-feature-row"><span>${esc(f.label || f.key)}</span><span>${esc(typeof f.value === "object" ? JSON.stringify(f.value) : f.value)}</span></div>`;
    }).join("") || `<p class="cs-hint">No manifest rows.</p>`;
  }
  function renderSettingsPage(sub, prefs) {
    const memOn = prefValue(prefs, "memory_enabled", sub.settings?.memory_enabled);
    const ragOn = prefValue(prefs, "rag_enabled", sub.settings?.rag_enabled);
    const mcpOn = prefValue(prefs, "mcp_enabled", sub.settings?.mcp_enabled);
    return `<article class="cassette-settings-page"><header class="cs-hero">
      <button type="button" class="comet-btn comet-btn--ghost" id="cs-back">← Back</button>
      <div class="cs-hero-title"><span class="cs-glyph">${esc(sub.glyph)}</span><div><h1>${esc(sub.name)} settings</h1><p class="cs-hero-sub">${esc(sub.parent_console_name || "")} · ${esc(sub.id)}</p></div></div>
      <button type="button" class="comet-btn comet-btn--primary" id="cs-save-all">Save all</button></header>
      <div class="cs-sections">
        <section class="cs-section"><h2>📋 Cartridge features</h2><div class="cs-card"><h3>Editable settings</h3>${renderCassetteSettingsFields(sub, prefs)}</div><div class="cs-card"><h3>Manifest</h3>${renderManifestFeatures(sub)}</div></section>
        <section class="cs-section"><h2>🧠 Memory</h2><div class="cs-card">${renderSettingControl("memory_enabled", sub.settings?.memory_enabled, prefs)}
          <div class="cs-memory-tools" ${memOn ? "" : "hidden"}><div class="cs-inline"><input id="cs-memory-query" class="cs-input" placeholder="Search memory…" /><button type="button" id="cs-memory-search" class="comet-btn comet-btn--primary">Search</button></div>
          <div id="cs-memory-results" class="cs-results"></div><textarea id="cs-memory-note" class="cs-textarea" rows="3" placeholder="Save teaching…"></textarea>
          <button type="button" id="cs-memory-save" class="comet-btn comet-btn--ghost">Save note</button><span id="cs-memory-save-status"></span>
          <button type="button" id="cs-memory-catalog" class="comet-btn comet-btn--ghost">Browse meta-library</button><div id="cs-memory-catalog-list" class="cs-results"></div></div></div></section>
        <section class="cs-section"><h2>📚 RAG</h2><div class="cs-card">${renderSettingControl("rag_enabled", sub.settings?.rag_enabled, prefs)}
          <div class="cs-rag-tools" ${ragOn ? "" : "hidden"}><div class="cs-inline"><input id="cs-rag-query" class="cs-input" placeholder="Semantic search…" /><button type="button" id="cs-rag-search" class="comet-btn comet-btn--primary">Retrieve</button></div>
          <div id="cs-rag-results" class="cs-results"></div></div></div></section>
        <section class="cs-section"><h2>🔌 API</h2><div class="cs-card">${(sub.api?.routes||[]).map(r=>`<div class="cs-feature-row"><span>${esc(r.label||r.path)}</span><code>${esc(r.path)}</code><button type="button" class="cs-open-route comet-btn comet-btn--ghost" data-route-path="${esc(r.path)}">Open</button></div>`).join("")}
          ${sub.api?.fleet_probe?`<button type="button" id="cs-api-probe" class="comet-btn comet-btn--primary">Ping probe</button><pre id="cs-api-probe-result" class="cs-probe-result"></pre>`:""}</div></section>
        <section class="cs-section"><h2>🛰️ MCP</h2><div class="cs-card">${renderSettingControl("mcp_enabled", sub.settings?.mcp_enabled, prefs)}
          <div class="cs-mcp-tools" ${mcpOn ? "" : "hidden"}><p>Agent <code>${esc(sub.mcp?.agent_id)}</code></p><button type="button" id="cs-mcp-hermes" class="comet-btn comet-btn--ghost">Check Hermes</button><pre id="cs-mcp-status" class="cs-probe-result"></pre></div></div></section>
      </div></article>`;
  }
  function collectPrefs(root) {
    const prefs = {};
    root.querySelectorAll(".cs-pref").forEach((el) => {
      const key = el.getAttribute("data-pref-key");
      if (!key) return;
      prefs[key] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    });
    return prefs;
  }
  function renderHits(el, hits, empty) {
    if (!hits?.length) { el.innerHTML = `<p class="cs-hint">${esc(empty)}</p>`; return; }
    el.innerHTML = hits.slice(0, 12).map((h) => `<article class="cs-hit"><strong>${esc(h.title||h.path||"hit")}</strong><p class="cs-mono">${esc(h.path||"")}</p><p>${esc(String(h.snippet||h.text||"").slice(0,240))}</p></article>`).join("");
  }
  async function runRetrieve(query, sub, fetchInit) {
    const body = { query, top_k: 8 };
    if (sub.rag?.collections?.length) body.collections = sub.rag.collections;
    else if (sub.rag?.retrieve_domains?.length) body.domains = sub.rag.retrieve_domains;
    const r = await fetch("/api/v1/retrieve", { ...fetchInit, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `retrieve ${r.status}`);
    return j.hits || j.results || [];
  }
  function syncVisibility(root, sub, prefs) {
    root.querySelector(".cs-memory-tools")?.toggleAttribute("hidden", !prefValue(prefs, "memory_enabled", sub.settings?.memory_enabled));
    root.querySelector(".cs-rag-tools")?.toggleAttribute("hidden", !prefValue(prefs, "rag_enabled", sub.settings?.rag_enabled));
    root.querySelector(".cs-mcp-tools")?.toggleAttribute("hidden", !prefValue(prefs, "mcp_enabled", sub.settings?.mcp_enabled));
  }
  function bindSettingsPage(root, sub, fetchInit, hooks) {
    const save = () => { const p = collectPrefs(root); savePrefs(sub.id, p); syncVisibility(root, sub, p); };
    root.querySelector("#cs-back")?.addEventListener("click", () => hooks.onBack?.());
    root.querySelector("#cs-save-all")?.addEventListener("click", save);
    root.querySelectorAll(".cs-pref").forEach((el) => el.addEventListener("change", () => syncVisibility(root, sub, collectPrefs(root))));
    root.querySelectorAll(".cs-open-route").forEach((b) => b.addEventListener("click", () => hooks.onOpenRoute?.(b.getAttribute("data-route-path"), sub)));
    root.querySelector("#cs-rag-search")?.addEventListener("click", async () => {
      const q = root.querySelector("#cs-rag-query")?.value?.trim(); const out = root.querySelector("#cs-rag-results");
      if (!q || !out) return; out.textContent = "Retrieving…";
      try { renderHits(out, await runRetrieve(q, sub, fetchInit), "No hits."); } catch (e) { out.textContent = e.message; }
    });
    root.querySelector("#cs-memory-search")?.addEventListener("click", async () => {
      const q = root.querySelector("#cs-memory-query")?.value?.trim(); const out = root.querySelector("#cs-memory-results");
      if (!q || !out) return; out.textContent = "Searching…";
      const memSub = { ...sub, rag: { ...sub.rag, collections: ["nephew-memory", sub.memory?.collection].filter(Boolean) } };
      try { renderHits(out, await runRetrieve(q, memSub, fetchInit), "No memory hits."); } catch (e) { out.textContent = e.message; }
    });
    root.querySelector("#cs-memory-save")?.addEventListener("click", async () => {
      const note = root.querySelector("#cs-memory-note")?.value?.trim(); const st = root.querySelector("#cs-memory-save-status");
      if (!note) return; if (st) st.textContent = "Saving…";
      try {
        const r = await fetch("/api/v1/corpus/append", { ...fetchInit, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: "general", title: `${sub.name} note`, body: note, tags: [`cassette:${sub.id}`] }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
        if (st) st.textContent = j.path ? `Saved ${j.path}` : "Saved"; root.querySelector("#cs-memory-note").value = "";
      } catch (e) { if (st) st.textContent = e.message; }
    });
    root.querySelector("#cs-memory-catalog")?.addEventListener("click", async () => {
      const out = root.querySelector("#cs-memory-catalog-list"); if (!out) return;
      try {
        const j = await (await fetch("/api/v1/meta-library/catalog", fetchInit || {})).json();
        out.innerHTML = (j.shelves || []).map((s) => `<div><strong>${esc(s.label)}</strong><ul>${(s.entries||[]).slice(0,6).map(e=>`<li><code>${esc(e.path)}</code></li>`).join("")}</ul></div>`).join("");
      } catch (e) { out.textContent = e.message; }
    });
    root.querySelector("#cs-api-probe")?.addEventListener("click", async () => {
      const ep = sub.api?.fleet_probe?.endpoint; const out = root.querySelector("#cs-api-probe-result");
      if (!ep || !out) return; out.textContent = "Pinging…";
      try { const r = await fetch(ep, { ...fetchInit, credentials: "include" }); out.textContent = `${r.status}\n${(await r.text()).slice(0,1200)}`; } catch (e) { out.textContent = e.message; }
    });
    root.querySelector("#cs-mcp-hermes")?.addEventListener("click", async () => {
      const out = root.querySelector("#cs-mcp-status"); if (!out) return;
      try { const j = await (await fetch("/api/v1/spark/status", fetchInit || {})).json(); out.textContent = JSON.stringify(j, null, 2).slice(0, 2000); } catch (e) { out.textContent = e.message; }
    });
  }
  async function fetchSubstrate(cassetteId, fetchInit) {
    const r = await fetch(`/api/v1/cassettes/${encodeURIComponent(cassetteId)}/substrate`, fetchInit || { cache: "no-cache" });
    if (!r.ok) throw new Error(`substrate ${r.status}`);
    return r.json();
  }
  async function mountSettingsPage(cassetteId, fetchInit, hooks) {
    const sub = await fetchSubstrate(cassetteId, fetchInit);
    const prefs = loadPrefs(sub.id);
    return { sub, html: renderSettingsPage(sub, prefs), bind: (root) => bindSettingsPage(root, sub, fetchInit, hooks) };
  }
  window.CassetteSubstrateUi = { fetchSubstrate, loadPrefs, savePrefs, renderSettingsPage, bindSettingsPage, mountSettingsPage };
})();
