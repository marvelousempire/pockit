/**
 * Knowledge Pad — sovereign RAG chat + collapsed operator ops (Plan 0287 Phase 1).
 * Supersedes Plan 0234 HUD-as-default; ops live under Advanced.
 */
(function () {
  const API = "/api/v1/corpus";
  const SAMPLE_QUERY = "family office rules plans";
  const STORAGE_KEY = "nephew-knowledge-pad-v1";
  const SESSION_KEY = "pockit-knowledge-session-id";
  const JOB_STORAGE_KEY = "nephew-knowledge-active-reindex-job";

  const SCOPE_OPTIONS = [
    {
      id: "all",
      label: "All family knowledge",
      domains: ["rules", "memory", "historia", "clinic", "vault", "agent-context", "cassettes", "general"],
    },
    { id: "rules", label: "Rules & skills", domains: ["rules"] },
    { id: "memory", label: "Plans & meta-library", domains: ["memory"] },
    { id: "historia", label: "Historia", domains: ["historia"] },
    { id: "clinic", label: "Clinic", domains: ["clinic"] },
    { id: "vault", label: "Sovereign vault", domains: ["vault"] },
  ];

  const SHELF_LABELS = {
    "nephew-rules": "Rules & skills",
    "nephew-memory": "Plans & meta-library",
    "nephew-historia": "Historia",
    "nephew-clinic": "Clinic register",
    "nephew-clinic-bulk": "Clinic full case file",
    "nephew-cassettes": "Cartridge surfaces",
    "nephew-product-cassettes": "Product cartridges",
    "nephew-vault": "Sovereign vault",
    "nephew-agent-context": "Agent context",
    "nephew-identity": "Soul & identity",
    "nephew-financial": "Financial",
    "nephew-legal": "Legal",
    "nephew-family": "Family",
    "nephew-general": "General",
  };

  const SOURCE_ROWS = [
    { id: "historia", label: "Historia", shelves: ["nephew-historia"], repos: ["historia"] },
    { id: "clinic", label: "Clinic (curated + bulk)", shelves: ["nephew-clinic", "nephew-clinic-bulk"], repos: ["clinic"] },
    { id: "nephew", label: "Nephew core", shelves: ["nephew-rules", "nephew-memory", "nephew-agent-context", "nephew-identity"], repos: ["nephew"] },
    { id: "bishop", label: "Bishop", shelves: ["nephew-rules", "nephew-memory"], repos: ["bishop"], peer: "bishop" },
    { id: "aisl", label: "AI Skills Library", shelves: ["nephew-rules", "nephew-memory"], repos: ["ai-skills-library"], peer: "aisl" },
    { id: "sme", label: "Search My Engine", shelves: ["nephew-cassettes", "nephew-product-cassettes"], repos: ["search-my-engine"] },
    { id: "bank-reader", label: "Bank reader", shelves: ["nephew-cassettes", "nephew-product-cassettes"], repos: ["bank-reader"] },
    { id: "fop", label: "Family Office Platform", shelves: ["nephew-cassettes", "nephew-product-cassettes"], repos: ["family-office-platform"] },
    { id: "vault", label: "Sovereign vault", shelves: ["nephew-vault"], repos: [] },
  ];

  const REINDEX_SCOPES = [
    ["memory-fabric", "Memory fabric whole"],
    ["full", "Brain A only"],
    ["rules", "Rules"],
    ["memory", "Memory"],
    ["historia", "Historia"],
    ["clinic", "Clinic curated"],
    ["clinic-bulk", "Clinic bulk"],
    ["cassettes", "Cartridges"],
    ["vault", "Vault"],
    ["fleet", "Brain B refresh"],
    ["forge", "Mirror forge"],
  ];

  let jobPollTimer = null;
  let lastInventory = null;
  let chatHistory = [];
  let busy = false;
  let activePanel = "chat";
  let stateChangeHook = null;

  function emitState() {
    stateChangeHook?.(getState());
  }

  function getState() {
    return { scope: selectedScope().id, panel: activePanel };
  }

  function setScope(scopeId) {
    const id = String(scopeId || "all");
    const sel = document.getElementById("knowledge-scope");
    if (sel && sel.value !== id) sel.value = id;
    savePrefs({ scope: id });
    emitState();
  }

  function setPanel(panelId) {
    activePanel = panelId || "chat";
    const root = document.getElementById("knowledge-hud");
    const ops = root?.querySelector(".knowledge-ops");
    if (activePanel === "rag-console") {
      window.KnowledgeRagConsole?.show?.(true);
      if (!lastInventory) refreshOps();
      else window.KnowledgeRagConsole?.updateFromInventory?.(lastInventory);
      emitState();
      return;
    }
    window.KnowledgeRagConsole?.show?.(false);
    if (activePanel === "chat") {
      if (ops?.open) ops.open = false;
    } else {
      if (ops && !ops.open) ops.open = true;
      if (activePanel === "probe") {
        if (!lastInventory) refreshOps().then(() => {
          document.getElementById("knowledge-probe-q")?.focus();
        });
        else document.getElementById("knowledge-probe-q")?.focus();
      } else if (activePanel === "inventory") {
        if (!lastInventory) refreshOps();
        ops?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
    }
    emitState();
  }

  function onStateChange(fn) {
    stateChangeHook = typeof fn === "function" ? fn : null;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function savePrefs(partial) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPrefs(), ...partial })); }
    catch { /* ignore */ }
  }

  function getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = `pockit-knowledge-${crypto.randomUUID?.() || Date.now().toString(36)}`;
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return `pockit-knowledge-ephemeral-${Date.now().toString(36)}`;
    }
  }

  function chatHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Voice-Agent": "pockit",
      "X-Voice-Rag": "grounded",
      "X-Voice-Grounded": "1",
      "X-Voice-Session": getSessionId(),
      "X-Voice-Memory": "1",
      "X-Voice-Mcp": "0",
    };
  }

  function selectedScope() {
    const sel = document.getElementById("knowledge-scope");
    const id = sel?.value || loadPrefs().scope || "all";
    return SCOPE_OPTIONS.find((o) => o.id === id) || SCOPE_OPTIONS[0];
  }

  function scopeOptionsHtml() {
    const saved = loadPrefs().scope || "all";
    return SCOPE_OPTIONS.map(
      (o) => `<option value="${esc(o.id)}"${o.id === saved ? " selected" : ""}>${esc(o.label)}</option>`,
    ).join("");
  }

  function render() {
    const actionBtns = REINDEX_SCOPES.map(
      ([scope, label]) => `<button type="button" class="knowledge-btn" data-reindex="${scope}">${esc(label)}</button>`,
    ).join("");

    return `
    <div id="knowledge-hud" class="knowledge-hud cotton-ball-settle">
      <header class="knowledge-hero">
        <h2 class="knowledge-title">Knowledge</h2>
        <p class="knowledge-subtitle">Ask the family brain · <a href="#/c/voice">Super Rick</a> · cited RAG on Spark</p>
        <span class="knowledge-sovereign-badge">Brain A · bge-m3 + reranker · sovereign hardware</span>
      </header>

      <div id="knowledge-shelf-strip" class="knowledge-shelf-strip">Loading brain inventory…</div>

      <section id="knowledge-job-banner" class="knowledge-job-banner hidden" aria-live="polite">
        <div class="knowledge-job-banner__head">
          <span id="knowledge-job-title" class="knowledge-job-banner__title">Reindex</span>
          <button type="button" id="knowledge-job-dismiss" class="knowledge-btn knowledge-btn--sm" hidden>Dismiss</button>
        </div>
        <div id="knowledge-job-progress-wrap" class="knowledge-job-progress hidden">
          <div class="knowledge-job-progress__track">
            <div id="knowledge-job-progress-bar" class="knowledge-job-progress__bar" style="width:0%"></div>
          </div>
          <span id="knowledge-job-progress-label" class="knowledge-job-progress__label"></span>
        </div>
        <pre id="knowledge-job-log-main" class="knowledge-job-log"></pre>
        <div class="knowledge-job-banner__actions">
          <button type="button" class="knowledge-btn knowledge-btn--primary" data-reindex="memory-fabric">Memory fabric whole</button>
          <button type="button" class="knowledge-btn" data-open-ops>Advanced scopes</button>
        </div>
      </section>

      <div id="knowledge-log" class="knowledge-log" aria-live="polite">
        <div id="knowledge-log-empty" class="knowledge-log-empty">
          <p class="knowledge-log-empty__title">What does the family know?</p>
          <p class="knowledge-log-empty__hint">Ask about rules, plans, Clinic cases, Historia, or vault notes — every answer cites indexed sources. <strong>Tap a source</strong> to drill into the shelf, excerpt, and Visual Obsidian layer.</p>
        </div>
      </div>

      <form id="knowledge-compose" class="knowledge-compose">
        <div class="knowledge-scope-row">
          <span class="knowledge-scope-label">Scope</span>
          <select id="knowledge-scope" class="knowledge-scope" aria-label="Knowledge scope">${scopeOptionsHtml()}</select>
        </div>
        <div class="knowledge-input-row">
          <textarea id="knowledge-input" class="knowledge-input" rows="2" placeholder="Ask the family brain…"></textarea>
          <button type="submit" id="knowledge-send" class="knowledge-send-btn">Ask</button>
        </div>
      </form>

      <footer id="knowledge-footer-status" class="knowledge-footer-status">Ready</footer>

      ${window.KnowledgeRagConsole?.renderShell?.() || ""}

      <details class="knowledge-ops">
        <summary>Advanced — inventory, reindex &amp; operator tools</summary>
        <div class="knowledge-ops-body">
          <div id="knowledge-summary" class="knowledge-panel">Loading inventory…</div>
          <div id="knowledge-sources" class="knowledge-panel"></div>
          <div id="knowledge-infra" class="knowledge-panel"></div>
          <div id="knowledge-voice" class="knowledge-panel"></div>
          <div id="knowledge-collections" class="knowledge-panel"></div>
          <div id="knowledge-forge" class="knowledge-panel"></div>
          <div id="knowledge-mcp" class="knowledge-panel knowledge-mcp"></div>
          <div class="knowledge-actions">${actionBtns}</div>
          <section class="knowledge-probe">
            <h3>Honesty probe</h3>
            <input id="knowledge-probe-q" type="text" placeholder="Retrieve-only — no model answer" class="knowledge-input" />
            <button type="button" id="knowledge-probe-btn" class="knowledge-btn knowledge-btn--primary">Probe corpus</button>
            <div id="knowledge-probe-result" class="knowledge-probe-result"></div>
          </section>
          <div id="knowledge-job-log" class="knowledge-job-log hidden"></div>
          <div id="knowledge-status" class="knowledge-status"></div>
        </div>
      </details>
    </div>`;
  }

  function setFooterStatus(msg, isError) {
    const el = document.getElementById("knowledge-footer-status");
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = isError ? "error" : "ok";
  }

  function clearLogEmpty() {
    document.getElementById("knowledge-log-empty")?.remove();
  }

  function appendUserBubble(text) {
    clearLogEmpty();
    const log = document.getElementById("knowledge-log");
    if (!log) return;
    const row = document.createElement("div");
    row.className = "knowledge-msg knowledge-msg--user";
    row.innerHTML = `<span class="knowledge-msg__role">You</span><div class="knowledge-msg__text">${esc(text)}</div>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function appendAssistantBubble() {
    clearLogEmpty();
    const log = document.getElementById("knowledge-log");
    if (!log) return null;
    const row = document.createElement("div");
    row.className = "knowledge-msg knowledge-msg--assistant";
    row.innerHTML = `
      <span class="knowledge-msg__role">Nephew</span>
      <div class="knowledge-msg__text"></div>
      <div class="knowledge-msg__sources hidden">
        <span class="knowledge-msg__sources-label">Sources</span>
        <ul class="knowledge-sources-list"></ul>
      </div>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return {
      textEl: row.querySelector(".knowledge-msg__text"),
      sourcesWrap: row.querySelector(".knowledge-msg__sources"),
      sourcesList: row.querySelector(".knowledge-sources-list"),
    };
  }

  function renderSourcesOnBubble(bubble, meta, hits, graphContext) {
    if (!bubble?.sourcesWrap || !bubble.sourcesList) return;
    bubble.sourcesWrap.classList.remove("hidden");
    const list = hits?.length ? hits : (meta?.top_paths || []).map((p) => ({ path: p }));
    if (!list.length) {
      bubble.sourcesList.innerHTML = '<li class="knowledge-sources-empty"><em>Not in indexed corpus</em></li>';
      return;
    }
    if (window.KnowledgeDrill?.renderSourceChips) {
      bubble.sourcesList.innerHTML = window.KnowledgeDrill.renderSourceChips(
        hits || list,
        graphContext || bubble._graphContext || [],
        SHELF_LABELS,
      );
      bubble._retrieveHits = hits || list;
      bubble._graphContext = graphContext || bubble._graphContext || [];
      return;
    }
    bubble.sourcesList.innerHTML = list.map((h) => {
      const p = h.path || h.source || h;
      return `<li><code>${esc(p)}</code></li>`;
    }).join("");
  }

  async function fetchRetrieve(query, scope) {
    const res = await fetch("/api/v1/retrieve", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: 8,
        domains: scope.domains,
        rerank: true,
        graph_expand: scope.domains.includes("vault") || scope.id === "all",
      }),
    });
    const data = await res.json();
    const hits = data.hits || [];
    return {
      hits,
      graphContext: data.graph_context || [],
      meta: {
        hits_count: hits.length,
        top_paths: hits.map((h) => h.path || h.source).filter(Boolean).slice(0, 8),
      },
    };
  }

  function buildChatMessages(userText, ragContext) {
    const messages = [];
    if (chatHistory.length) {
      for (const turn of chatHistory.slice(-6)) messages.push({ role: turn.role, content: turn.content });
    }
    if (ragContext) {
      messages.push({
        role: "system",
        content: "Reference only — answer from this indexed family corpus. If insufficient, say it is not in the indexed corpus.\n\n" + ragContext,
      });
    }
    messages.push({ role: "user", content: userText });
    return messages;
  }

  async function streamKnowledgeReply(userText, bubble) {
    const scope = selectedScope();
    setFooterStatus(`Retrieving · ${scope.label}…`);

    let retrieveMeta = { hits_count: 0, top_paths: [] };
    let ragContext = "";
    let graphContext = [];
    try {
      const { hits, meta, graphContext: gc } = await fetchRetrieve(userText, scope);
      retrieveMeta = meta;
      graphContext = gc || [];
      renderSourcesOnBubble(bubble, retrieveMeta, hits, graphContext);
      ragContext = hits.slice(0, 6).map((h) => `${h.path || h.source || ""}\n${h.content || h.text || ""}`).join("\n---\n");
    } catch (e) {
      setFooterStatus(`Retrieve failed: ${e.message}`, true);
    }

    setFooterStatus("Nephew is thinking…");
    const messages = buildChatMessages(userText, ragContext);

    const res = await fetch("/api/v1/chat/completions", {
      method: "POST",
      credentials: "include",
      signal: AbortSignal.timeout(120_000),
      headers: chatHeaders(),
      body: JSON.stringify({
        model: "nephew",
        messages,
        stream: true,
        max_tokens: 280,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText.slice(0, 140) || `Chat HTTP ${res.status}`);
    }

    const reader = res.body?.getReader?.();
    if (!reader) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "";
      if (data.retrieve_meta?.top_paths?.length) {
        renderSourcesOnBubble(bubble, data.retrieve_meta);
      }
      if (bubble?.textEl) bubble.textEl.textContent = reply;
      return reply;
    }

    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          if (j.retrieve_meta?.top_paths?.length) {
            renderSourcesOnBubble(bubble, j.retrieve_meta);
          }
          const delta = j.choices?.[0]?.delta?.content || "";
          if (!delta) continue;
          full += delta;
          if (bubble?.textEl) bubble.textEl.textContent = full;
          const log = document.getElementById("knowledge-log");
          if (log) log.scrollTop = log.scrollHeight;
        } catch { /* skip bad sse */ }
      }
    }
    return full.trim();
  }

  async function handleChatSubmit(text) {
    if (busy) return;
    const query = String(text || "").trim();
    if (!query) return;
    busy = true;
    const sendBtn = document.getElementById("knowledge-send");
    if (sendBtn) sendBtn.disabled = true;

    appendUserBubble(query);
    const bubble = appendAssistantBubble();
    if (bubble?.textEl) bubble.textEl.textContent = "…";

    try {
      const reply = await streamKnowledgeReply(query, bubble);
      if (!reply) throw new Error("Empty reply from Nephew");
      chatHistory.push({ role: "user", content: query });
      chatHistory.push({ role: "assistant", content: reply });
      if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
      savePrefs({ scope: selectedScope().id });
      setFooterStatus(`Grounded · ${selectedScope().label}`);
    } catch (e) {
      if (bubble?.textEl) bubble.textEl.textContent = `I couldn't reach the brain (${e.message}). Check tower-api on Spark.`;
      setFooterStatus(e.message, true);
    } finally {
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // ─── Operator ops (Plan 0234 — collapsed under Advanced) ───

  async function fetchInventory() {
    const res = await fetch(`${API}/inventory`, { credentials: "include" });
    return res.json();
  }

  function shelfLabel(name) {
    return SHELF_LABELS[name] || name;
  }

  function statusBadge(status, stale) {
    const s = stale ? "stale" : status;
    return `<span class="knowledge-badge knowledge-badge--${esc(s)}">${esc(s)}</span>`;
  }

  function collMap(inv) {
    const m = new Map();
    for (const c of inv.collections || []) m.set(c.name, c);
    return m;
  }

  function sumPoints(collections, names) {
    return names.reduce((s, n) => s + (collections.get(n)?.points || 0), 0);
  }

  function renderShelfStrip(inv) {
    const el = document.getElementById("knowledge-shelf-strip");
    if (!el) return;
    if (!inv?.ok) {
      el.textContent = "Brain inventory unavailable — tap Advanced for details";
      return;
    }
    if (window.KnowledgeDrill?.renderShelfStripChips) {
      const { html } = window.KnowledgeDrill.renderShelfStripChips(inv, SHELF_LABELS);
      el.innerHTML = `${html}<button type="button" class="knowledge-btn knowledge-btn--sm knowledge-shelf-reindex" data-reindex="memory-fabric">Memory fabric reindex</button>`;
      el.classList.add("knowledge-shelf-strip--interactive");
      return;
    }
    const staleCount = (inv.collections || []).filter((c) => c.stale || c.status === "stale").length;
    const summary = `${(inv.total_points ?? 0).toLocaleString()} indexed points · ${inv.collections_populated ?? 0}/${inv.collections_expected ?? 0} shelves · ${staleCount} stale`;
    el.innerHTML = `<span class="knowledge-shelf-strip__summary">${esc(summary)}</span>
      <button type="button" class="knowledge-btn knowledge-btn--sm knowledge-shelf-reindex" data-reindex="memory-fabric">Memory fabric reindex</button>`;
  }

  function renderSummary(inv) {
    const el = document.getElementById("knowledge-summary");
    if (!el) return;
    if (!inv.ok) {
      el.innerHTML = `<p class="knowledge-err">${esc(inv.error || "inventory failed")}</p>`;
      return;
    }
    const staleCount = (inv.collections || []).filter((c) => c.stale || c.status === "stale").length;
    el.innerHTML = `
      <h3>Fleet summary</h3>
      <ul class="knowledge-stats">
        <li><strong>${inv.total_points ?? 0}</strong> total points</li>
        <li><strong>${inv.collections_populated ?? 0}</strong> / ${inv.collections_expected ?? 0} collections populated</li>
        <li>Stale shelves: <strong>${staleCount}</strong></li>
        <li>Last full index: <code>${esc(inv.last_full_index_at || "never")}</code></li>
      </ul>`;
  }

  function renderSources(inv) {
    const el = document.getElementById("knowledge-sources");
    if (!el) return;
    const cmap = collMap(inv);
    const rows = SOURCE_ROWS.map((src) => {
      const pts = sumPoints(cmap, src.shelves);
      const statuses = src.shelves.map((s) => cmap.get(s)?.status || "missing");
      const worst = statuses.includes("missing") ? "missing" : statuses.includes("stale") ? "stale" : statuses.includes("empty") ? "empty" : "ok";
      const stale = src.shelves.some((s) => cmap.get(s)?.stale);
      return `<tr>
        <td>${esc(src.label)}</td>
        <td><code>${esc(src.shelves.join(", "))}</code></td>
        <td>${pts.toLocaleString()}</td>
        <td>${statusBadge(worst, stale)}</td>
        <td>${esc(src.repos.join(", ") || "NAS vault")}</td>
      </tr>`;
    }).join("");
    el.innerHTML = `
      <h3>Per-source federation</h3>
      <table class="knowledge-table"><thead><tr><th>Source</th><th>Shelves</th><th>Points</th><th>Status</th><th>Repos</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  async function renderVoice() {
    const el = document.getElementById("knowledge-voice");
    if (!el) return;
    let voice = { ok: false };
    try {
      const r = await fetch("/api/v1/voice/health", { credentials: "include" });
      voice = await r.json();
    } catch (e) {
      voice = { ok: false, error: e.message };
    }
    const w = voice.whisper?.ok ? "✓" : "✗";
    const f = voice.fish_speech?.ok ? "✓" : "✗";
    const m5 = voice.m5_edge?.ok ? "✓" : "✗";
    el.innerHTML = `
      <h3>Voice pipeline</h3>
      <ul class="knowledge-stats">
        <li>M5 edge: ${m5} · Whisper: ${w} · Kokoro: ${f}</li>
        <li><a href="#/c/voice">Open Super Rick</a></li>
      </ul>`;
  }

  function renderInfra(inv) {
    const el = document.getElementById("knowledge-infra");
    if (!el) return;
    const nas = inv.nas_migration || {};
    const infra = inv.infrastructure || {};
    el.innerHTML = `
      <h3>Infrastructure</h3>
      <ul class="knowledge-stats">
        <li>Embeddings: ${infra.embeddings_ok ? "✓ ok" : "✗ down"}</li>
        <li>Redis STM: ${infra.redis_ok ? "✓ :6379" : "⬜ not running"}</li>
        <li>NAS migration: phase ${nas.phase ?? "?"}</li>
        <li>Qdrant: <code>${esc(infra.qdrant_url || "127.0.0.1:6333")}</code></li>
      </ul>`;
  }

  function renderCollections(inv) {
    const el = document.getElementById("knowledge-collections");
    if (!el || !inv.collections) return;
    const rows = inv.collections.map((c) => `
      <tr class="knowledge-coll-row" data-collection="${esc(c.name)}">
        <td><code>${esc(c.name)}</code><br><span class="knowledge-hint">${esc(shelfLabel(c.name))}</span></td>
        <td>${(c.points || 0).toLocaleString()}</td>
        <td>${statusBadge(c.status, c.stale)}</td>
        <td>${esc(c.last_index_at || "—")}</td>
        <td class="knowledge-coll-actions">
          <button type="button" class="knowledge-btn knowledge-btn--sm" data-test-query="${esc(c.name)}">Test</button>
          <button type="button" class="knowledge-btn knowledge-btn--sm" data-expand="${esc(c.name)}">Samples</button>
        </td>
      </tr>
      <tr class="knowledge-drill hidden" id="drill-${esc(c.name)}"><td colspan="5"><div class="knowledge-drill-body">…</div></td></tr>`).join("");
    el.innerHTML = `
      <h3>Collections</h3>
      <table class="knowledge-table"><thead><tr><th>Shelf</th><th>Points</th><th>Status</th><th>Last index</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div id="knowledge-test-result" class="knowledge-test-result hidden"></div>`;
  }

  function renderForge(inv) {
    const el = document.getElementById("knowledge-forge");
    if (!el) return;
    const fm = inv.forge_mirror || {};
    const repos = fm.repos || [];
    const ok = repos.filter((r) => r.status === "ok").length;
    const rows = repos.slice(0, 40).map((r) => {
      const drift = r.github_sha && r.forge_sha && r.github_sha !== r.forge_sha;
      return `<tr>
        <td><code>${esc(r.repo)}</code></td>
        <td>${esc(r.status || "?")}</td>
        <td>${drift ? '<span class="knowledge-badge knowledge-badge--stale">SHA drift</span>' : "in sync"}</td>
        <td><code class="knowledge-sha">${esc((r.forge_sha || r.github_sha || "—").slice(0, 8))}</code></td>
      </tr>`;
    }).join("");
    const table = repos.length
      ? `<table class="knowledge-table"><thead><tr><th>Repo</th><th>Mirror</th><th>Drift</th><th>SHA</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="knowledge-hint">No manifest yet — run Reindex → Mirror forge.</p>`;
    el.innerHTML = `
      <h3>Gitea forge mirror</h3>
      <p>${ok} / ${fm.repo_count || repos.length} repos mirrored</p>
      ${table}
      <button type="button" class="knowledge-btn" data-reindex="forge">Mirror now</button>`;
  }

  function renderMcp() {
    const el = document.getElementById("knowledge-mcp");
    if (!el) return;
    el.innerHTML = `
      <h3>Agent parity (MCP)</h3>
      <p class="knowledge-hint">Agents: <code>nephew_session_load</code> + <code>nephew_corpus_retrieve</code> — same Brain A path as this pad.</p>`;
  }

  async function refreshOps() {
    try {
      const inv = await fetchInventory();
      lastInventory = inv;
      renderShelfStrip(inv);
      renderSummary(inv);
      renderSources(inv);
      renderInfra(inv);
      renderCollections(inv);
      renderForge(inv);
      renderMcp();
      await renderVoice();
      window.KnowledgeRagConsole?.updateFromInventory?.(inv);
    } catch (e) {
      const st = document.getElementById("knowledge-status");
      if (st) st.textContent = e.message;
      renderShelfStrip({ ok: false });
    }
  }

  function saveActiveJob(jobId, scope) {
    try {
      localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify({ id: jobId, scope, saved_at: Date.now() }));
    } catch { /* ignore */ }
  }

  function clearActiveJob() {
    try { localStorage.removeItem(JOB_STORAGE_KEY); } catch { /* ignore */ }
  }

  function loadActiveJob() {
    try {
      const raw = localStorage.getItem(JOB_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function scopeLabel(scope) {
    const row = REINDEX_SCOPES.find(([s]) => s === scope);
    return row ? row[1] : scope;
  }

  function formatJobStatus(job) {
    const prog = job.progress || {};
    const parts = [scopeLabel(job.scope || "reindex")];
    if (job.status) parts.push(job.status);
    if (prog.phase && prog.phase !== "running") parts.push(prog.phase);
    if (prog.collection && prog.file_end != null && prog.file_total) {
      parts.push(`${prog.collection}: ${prog.file_end}/${prog.file_total} files`);
    } else if (prog.percent != null) {
      parts.push(`${prog.percent}%`);
    }
    return parts.join(" · ");
  }

  function renderJobBanner(job) {
    const banner = document.getElementById("knowledge-job-banner");
    const title = document.getElementById("knowledge-job-title");
    const dismiss = document.getElementById("knowledge-job-dismiss");
    const progWrap = document.getElementById("knowledge-job-progress-wrap");
    const progBar = document.getElementById("knowledge-job-progress-bar");
    const progLabel = document.getElementById("knowledge-job-progress-label");
    const logMain = document.getElementById("knowledge-job-log-main");
    if (!banner) return;

    const running = job?.status === "running";
    const finished = job && !running;
    banner.classList.toggle("hidden", !job);
    banner.dataset.state = job?.status || "idle";
    if (title) title.textContent = job ? formatJobStatus(job) : "Reindex";
    if (dismiss) dismiss.hidden = !finished;

    const prog = job?.progress || {};
    const showProg = running && (prog.percent != null || prog.collection);
    if (progWrap) progWrap.classList.toggle("hidden", !showProg);
    if (showProg && progBar) {
      progBar.style.width = `${prog.percent ?? 0}%`;
    }
    if (progLabel) {
      if (prog.collection && prog.file_end != null && prog.file_total) {
        progLabel.textContent = `${prog.collection}: files ${prog.file_end} of ${prog.file_total}${prog.percent != null ? ` (${prog.percent}%)` : ""}`;
      } else if (prog.phase) {
        progLabel.textContent = `Phase: ${prog.phase}`;
      } else {
        progLabel.textContent = "";
      }
    }

    const lines = prog.log_lines?.length
      ? prog.log_lines
      : (job?.log_tail || "").split("\n").filter(Boolean).slice(-20);
    if (logMain) logMain.textContent = lines.join("\n") || (job ? `Job ${job.id}: ${job.status}` : "");

    const actions = banner.querySelector(".knowledge-job-banner__actions");
    if (actions) actions.hidden = running;
  }

  function showJobLog(text) {
    const el = document.getElementById("knowledge-job-log");
    if (el) {
      el.classList.remove("hidden");
      el.textContent = text;
    }
    const logMain = document.getElementById("knowledge-job-log-main");
    if (logMain && text) logMain.textContent = text;
  }

  function stopJobPoll() {
    if (jobPollTimer) {
      clearTimeout(jobPollTimer);
      jobPollTimer = null;
    }
  }

  async function pollJob(jobId) {
    stopJobPoll();
    try {
      const res = await fetch(`${API}/reindex/${jobId}`, { credentials: "include" });
      const data = await res.json();
      const job = data.job || {};
      saveActiveJob(jobId, job.scope);
      renderJobBanner(job);
      const tail = (job.progress?.log_lines || []).join("\n")
        || (job.log_tail || "").split("\n").slice(-20).join("\n");
      showJobLog(tail || `Job ${jobId}: ${job.status}`);
      const st = document.getElementById("knowledge-status");
      if (st) st.textContent = formatJobStatus(job);
      setFooterStatus(formatJobStatus(job), job.status === "error");
      if (job.status === "running") {
        jobPollTimer = setTimeout(() => pollJob(jobId), 3000);
      } else {
        clearActiveJob();
        await refreshOps();
      }
    } catch (e) {
      showJobLog(e.message);
      setFooterStatus(e.message, true);
    }
  }

  async function resumeActiveJob() {
    try {
      const res = await fetch(`${API}/reindex`, { credentials: "include" });
      const data = await res.json();
      if (data.job?.status === "running") {
        saveActiveJob(data.job.id, data.job.scope);
        renderJobBanner(data.job);
        pollJob(data.job.id);
        return;
      }
    } catch { /* tower-api may be down on Mac edge */ }

    const saved = loadActiveJob();
    if (saved?.id) pollJob(saved.id);
  }

  async function startReindex(scope) {
    const st = document.getElementById("knowledge-status");
    const ops = document.querySelector(".knowledge-ops");
    if (ops && !ops.open) ops.open = true;
    if (st) st.textContent = `Starting reindex: ${scope}…`;
    setFooterStatus(`Starting ${scopeLabel(scope)}…`);
    const res = await fetch(`${API}/reindex`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (res.status === 409 && data.job_id) {
        saveActiveJob(data.job_id, data.scope);
        if (st) st.textContent = `Already running: ${data.job_id} (${data.scope})`;
        pollJob(data.job_id);
        return;
      }
      const msg = data.error || (res.status === 401 ? "Sign in required" : "reindex failed");
      if (st) st.textContent = msg;
      setFooterStatus(msg, true);
      return;
    }
    saveActiveJob(data.job_id, scope);
    renderJobBanner({ id: data.job_id, scope, status: "running", progress: { phase: "starting" } });
    if (st) st.textContent = `Job ${data.job_id} running (${scope})`;
    pollJob(data.job_id);
  }

  async function loadSamples(collection) {
    const row = document.getElementById(`drill-${collection}`);
    if (!row) return;
    const body = row.querySelector(".knowledge-drill-body");
    if (!body) return;
    body.innerHTML = "Loading sample paths…";
    row.classList.remove("hidden");
    try {
      const res = await fetch("/api/v1/retrieve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: SAMPLE_QUERY, collections: [collection], top_k: 5 }),
      });
      const data = await res.json();
      const hits = data.hits || [];
      const gc = data.graph_context || [];
      if (!hits.length) {
        body.innerHTML = `<em>No sample paths — shelf empty or embedder down.</em>`;
        return;
      }
      if (window.KnowledgeDrill?.chipHtml) {
        body.innerHTML = `<div class="knowledge-chips">${hits.map((h, i) => window.KnowledgeDrill.chipHtml(h, i, { graphContext: gc })).join("")}</div>`;
        return;
      }
      body.innerHTML = `<ul class="knowledge-sample-list">${hits.map((p) => `<li><code>${esc(p.path)}</code></li>`).join("")}</ul>`;
    } catch (e) {
      body.innerHTML = `<span class="knowledge-err">${esc(e.message)}</span>`;
    }
  }

  async function runTestQuery(collection) {
    const out = document.getElementById("knowledge-test-result");
    if (!out) return;
    out.classList.remove("hidden");
    out.innerHTML = `Testing <code>${esc(collection)}</code>…`;
    const res = await fetch("/api/v1/retrieve", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: SAMPLE_QUERY, collections: [collection], top_k: 3 }),
    });
    const data = await res.json();
    const hits = data.hits || [];
    const gc = data.graph_context || [];
    if (!hits.length) {
      out.innerHTML = `<p class="knowledge-not-in-corpus">No hits for ${esc(collection)}</p>`;
      return;
    }
    out.innerHTML = window.KnowledgeDrill?.chipHtml
      ? `<div class="knowledge-chips">${hits.map((h, i) => window.KnowledgeDrill.chipHtml(h, i, { graphContext: gc })).join("")}</div>`
      : hits.map((h) => `<div class="knowledge-hit"><code>${esc(h.path || "?")}</code> <span class="knowledge-score">${h.score?.toFixed?.(3) ?? ""}</span></div>`).join("");
  }

  async function runProbe() {
    const q = document.getElementById("knowledge-probe-q");
    const out = document.getElementById("knowledge-probe-result");
    if (!q || !out) return;
    const query = q.value.trim();
    if (!query) return;
    out.innerHTML = "Searching…";
    const scope = selectedScope();
    const res = await fetch("/api/v1/retrieve", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: 8,
        domains: scope.domains,
        graph_expand: scope.domains.includes("vault") || scope.id === "all",
      }),
    });
    const data = await res.json();
    const hits = data.hits || [];
    const gc = data.graph_context || [];
    if (hits.length === 0) {
      out.innerHTML = `<p class="knowledge-not-in-corpus"><strong>Not in indexed corpus.</strong></p>`;
      return;
    }
    if (window.KnowledgeDrill?.chipHtml) {
      out.innerHTML = `<p class="knowledge-hint">Tap a path to see score, excerpt, and Visual / Obsidian links.</p><div class="knowledge-chips">${hits.map((h, i) => window.KnowledgeDrill.chipHtml(h, i, { graphContext: gc })).join("")}</div>`;
      return;
    }
    out.innerHTML = hits.map((h) => `
      <div class="knowledge-hit">
        <code>${esc(h.path || h.source || "?")}</code>
        <span class="knowledge-score">${typeof h.score === "number" ? h.score.toFixed(3) : ""}</span>
        <p>${esc((h.content || h.text || "").slice(0, 280))}</p>
      </div>`).join("");
  }

  function bind() {
    const root = document.getElementById("knowledge-hud");
    if (!root || root.dataset.knowledgeBound === "1") return;
    root.dataset.knowledgeBound = "1";

    const form = document.getElementById("knowledge-compose");
    const input = document.getElementById("knowledge-input");
    const scopeSel = document.getElementById("knowledge-scope");

    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = input?.value || "";
      if (input) input.value = "";
      handleChatSubmit(text);
    });

    input?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        form?.requestSubmit();
      }
    });

    scopeSel?.addEventListener("change", () => {
      savePrefs({ scope: scopeSel.value });
      emitState();
    });

    document.getElementById("knowledge-job-dismiss")?.addEventListener("click", () => {
      stopJobPoll();
      clearActiveJob();
      renderJobBanner(null);
      document.getElementById("knowledge-job-banner")?.classList.add("hidden");
    });

    root.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.getAttribute("data-open-ops")) {
        ev.preventDefault();
        const ops = root.querySelector(".knowledge-ops");
        if (ops) {
          ops.open = true;
          ops.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      const reindex = t.getAttribute("data-reindex");
      if (reindex) {
        ev.preventDefault();
        startReindex(reindex);
        return;
      }
      const testCol = t.getAttribute("data-test-query");
      if (testCol) {
        ev.preventDefault();
        runTestQuery(testCol);
        return;
      }
      const expand = t.getAttribute("data-expand");
      if (expand) {
        ev.preventDefault();
        const row = document.getElementById(`drill-${expand}`);
        if (row?.classList.contains("hidden")) loadSamples(expand);
        else row?.classList.add("hidden");
      }
    });

    document.getElementById("knowledge-probe-btn")?.addEventListener("click", runProbe);

    window.KnowledgeDrill?.bindRoot?.(root, {
      esc,
      shelfLabels: SHELF_LABELS,
      getInventory: () => lastInventory,
    });

    const opsDetails = root.querySelector(".knowledge-ops");
    opsDetails?.addEventListener("toggle", () => {
      if (opsDetails.open && !lastInventory) refreshOps();
    });

    window.KnowledgeRagConsole?.bind?.(root);

    refreshOps();
    resumeActiveJob();
  }

  window.KnowledgeHud = {
    render,
    bind,
    refresh: refreshOps,
    setScope,
    setPanel,
    getState,
    onStateChange,
  };
})();
