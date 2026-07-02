/**
 * Knowledge RAG Console — pipeline, ingest, chunking, rerank, agent learning (Plan 0457).
 * Center panel when Brain rail selects "RAG Console".
 */
(function () {
  const PIPELINE = [
    { id: "author", label: "Author", detail: "Edit git — Nephew/Understandings/, docs/, meta-library" },
    { id: "ingest", label: "Ingest", detail: "vault-ingest-docs · sync Understandings → Obsidian NAS" },
    { id: "chunk", label: "Chunk", detail: "H2 + sliding window (~800 tok, 200 overlap)" },
    { id: "embed", label: "Embed", detail: "bge-m3 dense 1024-d · :9200" },
    { id: "index", label: "Index", detail: "Qdrant nephew-* + nephew-vault · :6333" },
    { id: "retrieve", label: "Retrieve", detail: "POST /api/v1/retrieve · MCP nephew_corpus_retrieve" },
    { id: "rerank", label: "Rerank", detail: "bge-reranker-v2-m3 · :9201" },
  ];

  const INGEST_COMMANDS = [
    { id: "vault-ingest-docs", label: "Vault ingest docs", desc: "Sync + graph + incremental vault index" },
    { id: "vault-sync-understandings", label: "Sync Understandings", desc: "Repo → 03-Wiki/Understandings/" },
    { id: "index-corpus", label: "Index Brain A", desc: "Federation walk → nephew-* shelves" },
    { id: "index-corpus-full", label: "Index full", desc: "Brain A + vault" },
    { id: "corpus-status", label: "Corpus status", desc: "Shelf fill summary" },
    { id: "vault-index-dry", label: "Vault index dry", desc: "Dry-run vault indexer" },
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPipeline() {
    return `<ol class="rag-console-pipeline">${PIPELINE.map(
      (s, i) => `<li class="rag-console-pipeline__step" data-step="${esc(s.id)}">
        <span class="rag-console-pipeline__n">${i + 1}</span>
        <strong>${esc(s.label)}</strong>
        <span class="rag-console-pipeline__detail">${esc(s.detail)}</span>
      </li>`,
    ).join("")}</ol>`;
  }

  function renderIngestGrid() {
    return `<div class="rag-console-ingest">${INGEST_COMMANDS.map(
      (c) => `<button type="button" class="rag-console-ingest__btn knowledge-btn" data-rag-make="${esc(c.id)}" title="${esc(c.desc)}">
        <span class="rag-console-ingest__label">${esc(c.label)}</span>
        <span class="rag-console-ingest__desc">${esc(c.desc)}</span>
      </button>`,
    ).join("")}</div>`;
  }

  function renderShell() {
    return `
    <div id="knowledge-rag-console" class="knowledge-rag-console" hidden>
      <header class="rag-console-hero">
        <h2 class="rag-console-title">RAG Console</h2>
        <p class="rag-console-lead">Ingest · chunk · embed · index · retrieve · rerank — sovereign family knowledge on Spark.</p>
      </header>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Pipeline</h3>
        ${renderPipeline()}
      </section>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Brain health</h3>
        <div id="rag-console-health" class="rag-console-health">Loading…</div>
      </section>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Ingest &amp; index</h3>
        <p class="rag-console-hint">After editing <code>Nephew/Understandings/</code> — run vault ingest, then Brain A index on Spark.</p>
        ${renderIngestGrid()}
        <div id="rag-console-job-log" class="knowledge-job-log hidden"></div>
      </section>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Teach Nephew (INT-0019)</h3>
        <ul class="rag-console-list">
          <li>Write Understanding in git → <code>make vault-ingest-docs</code> → <code>make index-corpus</code></li>
          <li>Agents load via MCP retrieve, agent pastes, <code>node bin/nephew study</code></li>
          <li>Wiki mirror: <code>03-Wiki/Understandings/Obsidian/0002-rag-fabric-and-agent-learning</code></li>
        </ul>
      </section>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Agent pickup</h3>
        <table class="knowledge-table rag-console-table">
          <thead><tr><th>Surface</th><th>Load path</th></tr></thead>
          <tbody>
            <tr><td>Cursor / Claude</td><td><code>.cursor/rules/</code> · attach <code>fleet-operator-playbook.md</code></td></tr>
            <tr><td>MCP</td><td><code>nephew_corpus_retrieve</code> domains rules, memory, vault</td></tr>
            <tr><td>Hermes</td><td><code>nephew-soul.md</code> · <code>nephew study</code></td></tr>
            <tr><td>Pockit</td><td>This console · Knowledge chat · Honesty probe</td></tr>
          </tbody>
        </table>
      </section>

      <section class="rag-console-section">
        <h3 class="rag-console-section__title">Collections</h3>
        <div id="rag-console-collections" class="rag-console-collections">—</div>
      </section>
    </div>`;
  }

  function renderHealth(inv) {
    const el = document.getElementById("rag-console-health");
    if (!el) return;
    if (!inv?.ok) {
      el.innerHTML = `<p class="knowledge-err">${esc(inv?.error || "tower-api inventory unreachable")}</p>`;
      return;
    }
    const infra = inv.infrastructure || {};
    const stale = (inv.collections || []).filter((c) => c.stale || c.status === "stale").length;
    el.innerHTML = `
      <ul class="rag-console-health-grid">
        <li><span>Qdrant</span><strong>${(inv.total_points ?? 0).toLocaleString()} pts</strong></li>
        <li><span>Embeddings</span><strong>${infra.embeddings_ok ? "✓ bge-m3" : "✗ down"}</strong></li>
        <li><span>Reranker</span><strong>${infra.reranker_ok !== false ? "✓ :9201" : "⬜"}</strong></li>
        <li><span>Shelves</span><strong>${inv.collections_populated ?? 0}/${inv.collections_expected ?? 0}</strong></li>
        <li><span>Stale</span><strong class="${stale ? "rag-console-warn" : ""}">${stale}</strong></li>
        <li><span>Last index</span><strong><code>${esc((inv.last_full_index_at || "never").slice(0, 19))}</code></strong></li>
      </ul>`;
  }

  function renderCollections(inv) {
    const el = document.getElementById("rag-console-collections");
    if (!el || !inv?.collections) return;
    const rows = inv.collections.slice(0, 16).map((c) => `
      <tr>
        <td><code>${esc(c.name)}</code></td>
        <td>${(c.points || 0).toLocaleString()}</td>
        <td><span class="knowledge-badge knowledge-badge--${esc(c.stale ? "stale" : c.status || "ok")}">${esc(c.status || "ok")}</span></td>
      </tr>`).join("");
    el.innerHTML = `<table class="knowledge-table"><thead><tr><th>Shelf</th><th>Points</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function show(visible) {
    const consoleEl = document.getElementById("knowledge-rag-console");
    const chatBlock = document.querySelector(".knowledge-hud .knowledge-hero, .knowledge-hud .knowledge-shelf-strip, .knowledge-hud .knowledge-log, .knowledge-hud .knowledge-compose, .knowledge-hud .knowledge-footer-status");
    if (!consoleEl) return;
    consoleEl.hidden = !visible;
    const hideSelectors = [".knowledge-hero", ".knowledge-shelf-strip", ".knowledge-log", ".knowledge-compose", ".knowledge-footer-status"];
    hideSelectors.forEach((sel) => {
      document.querySelectorAll(`.knowledge-hud ${sel}`).forEach((n) => {
        n.hidden = visible;
      });
    });
    document.querySelector(".knowledge-hud .knowledge-ops")?.toggleAttribute("hidden", visible);
  }

  function updateFromInventory(inv) {
    renderHealth(inv);
    renderCollections(inv);
  }

  function bind(root, hooks = {}) {
    if (!root || root.dataset.ragConsoleBound === "1") return;
    root.dataset.ragConsoleBound = "1";
    root.addEventListener("click", (ev) => {
      const t = ev.target?.closest?.("[data-rag-make]");
      if (!t) return;
      ev.preventDefault();
      const makeId = t.getAttribute("data-rag-make");
      if (makeId && window.PockitRailContext?.runMakeTarget) {
        window.PockitRailContext.runMakeTarget(makeId, { source: "rag-console" });
      } else if (hooks.onMake) {
        hooks.onMake(makeId);
      }
    });
  }

  window.KnowledgeRagConsole = {
    renderShell,
    show,
    updateFromInventory,
    bind,
    PIPELINE,
    INGEST_COMMANDS,
  };
})();