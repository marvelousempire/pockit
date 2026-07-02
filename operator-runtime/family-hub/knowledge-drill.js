/**
 * Knowledge drill-down — tap sources/shelves to see indexed path, score, excerpt,
 * wikilink neighbors, and Visual / Obsidian open actions (Plan 0291 Phase 3).
 */
(function (global) {
  const VISUAL_VAULT = "nephew-sovereign-vault";
  const VISUAL_HOME = "Visual-Home";
  const NAS_PREFIX = "/Volumes/historia/nephew-sovereign-vault/";

  const SHELF_BLURBS = {
    "nephew-rules": "Operator rules, skills, and AI binder law from git repos.",
    "nephew-memory": "Plans, meta-library teachings, and session checkpoints.",
    "nephew-historia": "Sovereign Historia corpus on NAS.",
    "nephew-clinic": "Curated Clinic case register.",
    "nephew-clinic-bulk": "Full Clinic case files (bulk shelf).",
    "nephew-cassettes": "Cassette surfaces and embed apps.",
    "nephew-product-cassettes": "Product cassette manifests.",
    "nephew-vault": "Visual sovereign vault — Obsidian notes on NAS, indexed for Brain A.",
    "nephew-agent-context": "Agent context bundles per cassette.",
    "nephew-identity": "Soul, identity, and operator-facing prompts.",
    "nephew-financial": "Financial domain slices.",
    "nephew-legal": "Legal domain slices.",
    "nephew-family": "Family domain slices.",
    "nephew-general": "General corpus catch-all.",
  };

  let overlayEl = null;
  let escFn = (s) => String(s);

  function setEscaper(fn) {
    escFn = typeof fn === "function" ? fn : escFn;
  }

  function esc(s) {
    return escFn(s);
  }

  function normalizeVaultRel(path) {
    let p = String(path || "").replace(/\\/g, "/").trim();
    if (p.startsWith(NAS_PREFIX)) p = p.slice(NAS_PREFIX.length);
    if (p.startsWith("nephew-sovereign-vault/")) p = p.slice("nephew-sovereign-vault/".length);
    return p.replace(/^\/+/, "");
  }

  function isVaultPath(path) {
    const rel = normalizeVaultRel(path);
    if (!rel) return false;
    if (rel.endsWith(".md")) return true;
    return /^(0[0-9]-|NEPHEW|Visual-Home)/.test(rel);
  }

  function obsidianUri(relPath) {
    const rel = normalizeVaultRel(relPath).replace(/\.md$/, "");
    if (!rel) return `obsidian://open?vault=${encodeURIComponent(VISUAL_VAULT)}&file=${encodeURIComponent(VISUAL_HOME)}`;
    return `obsidian://open?vault=${encodeURIComponent(VISUAL_VAULT)}&file=${encodeURIComponent(rel)}`;
  }

  function extVaultDoorUrl(relPath) {
    const rel = normalizeVaultRel(relPath).replace(/\.md$/, "");
    const slug = rel ? rel.split("/").map(encodeURIComponent).join("/") : "";
    return slug ? `http://ext-vault.localhost/${slug}` : "http://ext-vault.localhost/";
  }

  function shortPath(path) {
    const p = String(path || "?");
    if (p.length <= 52) return p;
    return "…" + p.slice(-49);
  }

  function shelfLabel(name, labels) {
    return (labels && labels[name]) || name;
  }

  function neighborsForHit(hit, graphContext) {
    if (!Array.isArray(graphContext) || !graphContext.length) return [];
    const key = normalizeVaultRel(hit.vault_rel || hit.path || "");
    return graphContext.filter((n) => normalizeVaultRel(n.from) === key);
  }

  function actionRow(hit) {
    const path = hit.path || hit.source || "";
    const vaultish = hit.collection === "nephew-vault" || isVaultPath(path);
    if (!vaultish) {
      return `<p class="knowledge-drill-hint">Git or repo path — open the repo or use Advanced → Collections to probe this shelf.</p>`;
    }
    const obs = obsidianUri(hit.vault_rel || path);
    return `
      <div class="knowledge-drill-actions">
        <a class="knowledge-btn knowledge-btn--primary" href="${esc(obs)}" target="_blank" rel="noopener">Open in Obsidian</a>
        <a class="knowledge-btn" href="${esc(extVaultDoorUrl(hit.vault_rel || path))}" target="_blank" rel="noopener">Published door</a>
        <a class="knowledge-btn" href="#/c/ext-vault">Obsidian Vault cassette</a>
        <a class="knowledge-btn" href="${esc(obsidianUri(VISUAL_HOME))}" target="_blank" rel="noopener">Visual-Home</a>
      </div>
      <p class="knowledge-drill-hint">Visual sovereign vault on NAS · agents run <code>make visual-obsidian</code> · Brain A indexes <code>nephew-vault</code> for MCP parity.</p>`;
  }

  function renderNeighborList(neighbors) {
    if (!neighbors.length) return "";
    const items = neighbors.map((n) => `
      <li>
        <button type="button" class="knowledge-source-chip knowledge-source-chip--neighbor" data-drill-payload="${esc(encodePayload({ hit: { path: n.path, vault_rel: n.path, collection: "nephew-vault", content: n.excerpt, score: null }, graphContext: [] }))}">
          ${esc(n.title || shortPath(n.path))}
        </button>
        <span class="knowledge-drill-neighbor-from">from wikilink</span>
      </li>`).join("");
    return `
      <section class="knowledge-drill-section">
        <h4>Wikilink neighbors</h4>
        <ul class="knowledge-drill-neighbors">${items}</ul>
      </section>`;
  }

  function openPanel(hit, opts = {}) {
    if (!hit) return;
    ensureOverlay();
    const labels = opts.shelfLabels || {};
    const graphContext = opts.graphContext || [];
    const collection = hit.collection || "";
    const score = typeof hit.score === "number" ? hit.score.toFixed(3) : "—";
    const excerpt = (hit.content || hit.text || hit.excerpt || "").trim();
    const path = hit.path || hit.source || "?";
    const neighbors = neighborsForHit(hit, graphContext);

    overlayEl.querySelector(".knowledge-drill-sheet").innerHTML = `
      <header class="knowledge-drill-header">
        <h3 class="knowledge-drill-title">${esc(shelfLabel(collection, labels) || "Indexed source")}</h3>
        <button type="button" class="knowledge-drill-close" aria-label="Close">×</button>
      </header>
      <div class="knowledge-drill-body">
        <dl class="knowledge-drill-meta">
          <dt>Path</dt><dd><code class="knowledge-drill-path">${esc(path)}</code></dd>
          <dt>Shelf</dt><dd><code>${esc(collection || "—")}</code></dd>
          <dt>Score</dt><dd>${esc(score)}${hit.reranked ? " <span class=\"knowledge-drill-tag\">reranked</span>" : ""}${hit.domain_boosted ? " <span class=\"knowledge-drill-tag\">boosted</span>" : ""}</dd>
          ${hit.repo ? `<dt>Repo</dt><dd><code>${esc(hit.repo)}</code></dd>` : ""}
        </dl>
        ${excerpt ? `<section class="knowledge-drill-section"><h4>Excerpt</h4><p class="knowledge-drill-excerpt">${esc(excerpt.slice(0, 1200))}${excerpt.length > 1200 ? "…" : ""}</p></section>` : ""}
        ${renderNeighborList(neighbors)}
        <section class="knowledge-drill-section">
          <h4>Open in Visual layer</h4>
          ${actionRow(hit)}
        </section>
        <section class="knowledge-drill-section knowledge-drill-section--muted">
          <h4>What is happening</h4>
          <p>${esc(SHELF_BLURBS[collection] || "This chunk was embedded with bge-m3, stored in Qdrant, and surfaced by POST /api/v1/retrieve — the same path agents use via nephew_corpus_retrieve.")}</p>
        </section>
      </div>`;

    overlayEl.classList.add("knowledge-drill-open");
    overlayEl.dataset.graphContext = graphContext.length ? JSON.stringify(graphContext) : "";
    document.body.classList.add("knowledge-drill-active");
  }

  function openShelfPanel(collection, inv, labels) {
    if (!collection || !inv?.collections) return;
    const c = inv.collections.find((x) => x.name === collection);
    if (!c) return;
    ensureOverlay();
    overlayEl.querySelector(".knowledge-drill-sheet").innerHTML = `
      <header class="knowledge-drill-header">
        <h3 class="knowledge-drill-title">${esc(shelfLabel(collection, labels))}</h3>
        <button type="button" class="knowledge-drill-close" aria-label="Close">×</button>
      </header>
      <div class="knowledge-drill-body">
        <dl class="knowledge-drill-meta">
          <dt>Collection</dt><dd><code>${esc(collection)}</code></dd>
          <dt>Points</dt><dd>${(c.points || 0).toLocaleString()}</dd>
          <dt>Status</dt><dd>${esc(c.stale ? "stale" : c.status || "?")}</dd>
          <dt>Last index</dt><dd><code>${esc(c.last_index_at || "never")}</code></dd>
        </dl>
        <p class="knowledge-drill-blurb">${esc(SHELF_BLURBS[collection] || "")}</p>
        ${collection === "nephew-vault" ? `
          <section class="knowledge-drill-section">
            <h4>Visual / Obsidian</h4>
            ${actionRow({ collection: "nephew-vault", path: "Visual-Home.md" })}
          </section>` : ""}
        <button type="button" class="knowledge-btn knowledge-btn--primary" data-drill-shelf-samples="${esc(collection)}">Load sample paths</button>
        <div id="knowledge-drill-shelf-samples" class="knowledge-drill-samples"></div>
      </div>`;
    overlayEl.classList.add("knowledge-drill-open");
    document.body.classList.add("knowledge-drill-active");
  }

  function closePanel() {
    overlayEl?.classList.remove("knowledge-drill-open");
    document.body.classList.remove("knowledge-drill-active");
  }

  function ensureOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.id = "knowledge-drill-overlay";
    overlayEl.className = "knowledge-drill-overlay";
    overlayEl.innerHTML = '<div class="knowledge-drill-sheet" role="dialog" aria-modal="true"></div>';
    overlayEl.addEventListener("click", (ev) => {
      if (ev.target === overlayEl) closePanel();
    });
    overlayEl.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.classList.contains("knowledge-drill-close")) {
        ev.preventDefault();
        closePanel();
      }
      const samplesCol = t.getAttribute("data-drill-shelf-samples");
      if (samplesCol) {
        ev.preventDefault();
        loadShelfSamples(samplesCol);
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && overlayEl?.classList.contains("knowledge-drill-open")) closePanel();
    });
    document.body.appendChild(overlayEl);
  }

  function parseGraphContext() {
    try {
      const raw = overlayEl?.dataset?.graphContext;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function loadShelfSamples(collection) {
    const out = document.getElementById("knowledge-drill-shelf-samples");
    if (!out) return;
    out.textContent = "Loading…";
    try {
      const res = await fetch("/api/v1/retrieve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "family office plans rules", collections: [collection], top_k: 6 }),
      });
      const data = await res.json();
      const hits = data.hits || [];
      if (!hits.length) {
        out.innerHTML = "<em>No sample paths — shelf empty or embedder down.</em>";
        return;
      }
      out.innerHTML = hits.map((h, i) => chipHtml(h, i, { graphContext: data.graph_context })).join("");
    } catch (e) {
      out.innerHTML = `<span class="knowledge-err">${esc(e.message)}</span>`;
    }
  }

  function encodePayload(obj) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    } catch {
      return "";
    }
  }

  function decodePayload(raw) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }

  function chipHtml(hit, index, opts = {}) {
    const path = hit.path || hit.source || "?";
    const payload = encodePayload({ hit, graphContext: opts.graphContext || [] });
    if (!payload) return `<code>${esc(shortPath(path))}</code>`;
    return `<button type="button" class="knowledge-source-chip" data-drill-payload="${esc(payload)}" title="${esc(path)}">${esc(shortPath(path))}</button>`;
  }

  function renderSourceChips(hits, graphContext, labels) {
    if (!hits?.length) {
      return '<li class="knowledge-sources-empty"><em>Not in indexed corpus</em></li>';
    }
    return hits.map((h, i) => {
      const chip = chipHtml(h, i, { graphContext });
      const col = h.collection ? `<span class="knowledge-chip-shelf">${esc(shelfLabel(h.collection, labels))}</span>` : "";
      return `<li class="knowledge-source-item">${chip}${col}</li>`;
    }).join("");
  }

  function renderShelfStripChips(inv, labels) {
    if (!inv?.ok || !inv.collections?.length) {
      return { html: "Brain inventory unavailable", clickable: false };
    }
    const populated = inv.collections.filter((c) => (c.points || 0) > 0);
    const staleCount = inv.collections.filter((c) => c.stale || c.status === "stale").length;
    const summary = `${(inv.total_points ?? 0).toLocaleString()} points · ${populated.length} shelves · ${staleCount} stale`;
    const chips = populated.slice(0, 8).map((c) =>
      `<button type="button" class="knowledge-shelf-chip" data-shelf-drill="${esc(c.name)}" title="${esc(SHELF_BLURBS[c.name] || c.name)}">${esc(shelfLabel(c.name, labels))} <span class="knowledge-shelf-chip__n">${(c.points || 0).toLocaleString()}</span></button>`,
    ).join("");
    return {
      html: `<span class="knowledge-shelf-summary">${esc(summary)}</span><div class="knowledge-shelf-chips">${chips}</div>`,
      clickable: true,
    };
  }

  function bindRoot(root, opts = {}) {
    if (!root || root.dataset.knowledgeDrillBound === "1") return;
    root.dataset.knowledgeDrillBound = "1";
    setEscaper(opts.esc);

    root.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      const shelf = t.closest("[data-shelf-drill]")?.getAttribute("data-shelf-drill")
        || t.getAttribute("data-shelf-drill");
      if (shelf) {
        ev.preventDefault();
        openShelfPanel(shelf, opts.getInventory?.(), opts.shelfLabels);
        return;
      }

      const payloadRaw = t.closest("[data-drill-payload]")?.getAttribute("data-drill-payload")
        || t.getAttribute("data-drill-payload");
      if (payloadRaw) {
        ev.preventDefault();
        const parsed = decodePayload(payloadRaw);
        if (parsed?.hit) {
          openPanel(parsed.hit, {
            graphContext: parsed.graphContext?.length ? parsed.graphContext : parseGraphContext(),
            shelfLabels: opts.shelfLabels,
          });
        }
      }
    });
  }

  global.KnowledgeDrill = {
    bindRoot,
    openPanel,
    openShelfPanel,
    closePanel,
    renderSourceChips,
    renderShelfStripChips,
    chipHtml,
    obsidianUri,
    isVaultPath,
    setEscaper,
  };
})(window);
