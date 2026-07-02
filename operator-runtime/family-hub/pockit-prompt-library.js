/**
 * Pockit Prompt Library — categorized operator prompts with Play / Copy / Report.
 * Surfaces: Pockit, Cursor (clipboard), Hello, Odysseus, Control Tower, Automata.
 */
(function () {
  const STORAGE_PENDING = "nephew.promptLibrary.pending";
  const API = "/api/v1/prompt-library";

  let catalog = { categories: [], prompts: [] };
  let activeCategory = "all";
  let runningId = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const el = document.getElementById("prompt-library-status");
    if (el) el.textContent = msg || "";
  }

  async function fetchCatalog() {
    const res = await fetch(API, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
    catalog = await res.json();
  }

  function filteredPrompts() {
    const all = catalog.prompts || [];
    if (activeCategory === "all") return all;
    return all.filter((p) => p.category_id === activeCategory);
  }

  function renderCategoryTabs() {
    const cats = catalog.categories || [];
    const tabs = [
      `<button type="button" class="prompt-lib-tab ${activeCategory === "all" ? "is-active" : ""}" data-cat="all">All</button>`,
      ...cats.map(
        (c) => `<button type="button" class="prompt-lib-tab ${activeCategory === c.id ? "is-active" : ""}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.title)}</button>`,
      ),
    ];
    return `<div class="prompt-lib-tabs" role="tablist">${tabs.join("")}</div>`;
  }

  function renderCard(p) {
    const tags = (p.tags || p.category_tags || [])
      .map((t) => `<span class="prompt-lib-tag">#${escapeHtml(t.replace(/^#/, ""))}</span>`)
      .join("");
    return `
      <article class="prompt-lib-card" data-id="${escapeHtml(p.id)}">
        <header class="prompt-lib-card__head">
          <h3 class="prompt-lib-card__title">${escapeHtml(p.title)}</h3>
          <p class="prompt-lib-card__subtitle">${escapeHtml(p.subtitle || "")}</p>
          <div class="prompt-lib-card__tags">${tags}</div>
        </header>
        <footer class="prompt-lib-card__actions">
          <button type="button" class="comet-btn comet-btn--primary prompt-lib-play" data-id="${escapeHtml(p.id)}" aria-label="Play prompt">
            ▶ Play
          </button>
          <button type="button" class="comet-btn prompt-lib-copy" data-id="${escapeHtml(p.id)}">Copy</button>
          <button type="button" class="comet-btn prompt-lib-open-hello" data-id="${escapeHtml(p.id)}">Hello</button>
          <button type="button" class="comet-btn prompt-lib-open-odysseus" data-id="${escapeHtml(p.id)}">Odysseus</button>
          <button type="button" class="comet-btn prompt-lib-open-automata" data-id="${escapeHtml(p.id)}">Automata</button>
          <button type="button" class="comet-btn prompt-lib-report" data-id="${escapeHtml(p.id)}">Report</button>
        </footer>
      </article>`;
  }

  function renderShell() {
    const loading = !(catalog.prompts || []).length;
    const cards = loading
      ? `<p class="prompt-lib-empty">Loading prompts…</p>`
      : (filteredPrompts().map(renderCard).join("") || `<p class="prompt-lib-empty">No prompts in this category yet.</p>`);
    return `
      <div id="prompt-library" class="prompt-library">
        <header class="prompt-library__hero">
          <h2 class="prompt-library__title">Prompt Library</h2>
          <p class="prompt-library__lead">Operator prompts that run the same way in Pockit, Cursor, Hello, Odysseus, and Control Tower.</p>
          <p id="prompt-library-status" class="prompt-library__status" aria-live="polite"></p>
        </header>
        ${renderCategoryTabs()}
        <div class="prompt-lib-grid">${cards}</div>
        <section class="prompt-library-output" aria-label="Prompt output">
          <div class="prompt-library-output__head">
            <h3>Output</h3>
            <button type="button" class="comet-btn prompt-lib-clear-out">Clear</button>
          </div>
          <pre id="prompt-library-output" class="prompt-library-output__body"></pre>
        </section>
      </div>`;
  }

  async function copyPrompt(id) {
    const res = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) throw new Error(`prompt HTTP ${res.status}`);
    const data = await res.json();
    await navigator.clipboard.writeText(data.body || "");
    try {
      sessionStorage.setItem(STORAGE_PENDING, JSON.stringify({ id, title: data.prompt?.title, body: data.body, at: Date.now() }));
    } catch { /* ignore */ }
    setStatus(`Copied "${data.prompt?.title || id}" — paste in Cursor or any Nephew surface.`);
  }

  async function showReport(id) {
    const res = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) throw new Error(`prompt HTTP ${res.status}`);
    const data = await res.json();
    const out = document.getElementById("prompt-library-output");
    if (out) out.textContent = data.report || "(No prebuilt report yet — press Play to generate.)";
    setStatus(data.report ? `Loaded living report for "${data.prompt?.title}".` : "No report file yet.");
  }

  async function streamChat(promptText, { model, max_tokens } = {}) {
    const out = document.getElementById("prompt-library-output");
    if (out) out.textContent = "";
    const res = await fetch("/api/v1/chat/completions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Voice-Agent": "pockit" },
      body: JSON.stringify({
        model: model || "nephew:awq-f4-kv",
        messages: [{ role: "user", content: promptText }],
        max_tokens: max_tokens || 12000,
        stream: true,
        temperature: 0.35,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(err.slice(0, 200) || `chat HTTP ${res.status}`);
    }
    const reader = res.body?.getReader?.();
    if (!reader) {
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content || "";
      if (out) out.textContent = text;
      return text;
    }
    const dec = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content || "";
          if (!delta) continue;
          full += delta;
          if (out) {
            out.textContent = full;
            out.scrollTop = out.scrollHeight;
          }
        } catch { /* skip */ }
      }
    }
    return full;
  }

  async function openInSurface(id, surface) {
    await copyPrompt(id);
    const urls = {
      hello: "http://hello.localhost/",
      odysseus: `${window.location.origin}${window.location.pathname}#/c/odysseus`,
      automata: `${window.location.origin.replace(/:\d+$/, "")}/automata/prompts?promptId=${encodeURIComponent(id)}`,
    };
    const url = urls[surface];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(`Opened in ${surface} — prompt loaded from Pockit.`);
  }

  async function playPrompt(id) {
    if (runningId) return;
    runningId = id;
    setStatus("Running prompt…");
    try {
      const runRes = await fetch(`${API}/${encodeURIComponent(id)}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!runRes.ok) throw new Error(`run HTTP ${runRes.status}`);
      const dispatch = await runRes.json();
      try {
        sessionStorage.setItem(STORAGE_PENDING, JSON.stringify({
          id,
          title: dispatch.title,
          body: dispatch.body,
          at: Date.now(),
        }));
      } catch { /* ignore */ }
      await copyPrompt(id).catch(() => {});
      setStatus(`Playing "${dispatch.title}" — streaming in Pockit (also copied for Cursor).`);
      await streamChat(dispatch.body, { model: dispatch.model_hint, max_tokens: dispatch.max_tokens });
      setStatus(`Done — "${dispatch.title}". Output ready · copied for Cursor / Hello / Odysseus.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      runningId = null;
    }
  }

  async function bind() {
    const root = document.getElementById("prompt-library");
    if (!root) return;
    if (!(catalog.prompts || []).length) {
      try {
        await fetchCatalog();
        const mount = root.parentElement;
        if (mount) {
          mount.innerHTML = renderShell();
          bind();
          return;
        }
      } catch (e) {
        setStatus(e.message);
      }
    }
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.querySelectorAll(".prompt-lib-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.getAttribute("data-cat") || "all";
        const mount = root.parentElement;
        if (mount) {
          mount.innerHTML = renderShell();
          bind();
        }
      });
    });

    root.querySelectorAll(".prompt-lib-play").forEach((btn) => {
      btn.addEventListener("click", () => playPrompt(btn.getAttribute("data-id")));
    });
    root.querySelectorAll(".prompt-lib-copy").forEach((btn) => {
      btn.addEventListener("click", () => copyPrompt(btn.getAttribute("data-id")).catch((e) => setStatus(e.message)));
    });
    root.querySelectorAll(".prompt-lib-open-hello").forEach((btn) => {
      btn.addEventListener("click", () => openInSurface(btn.getAttribute("data-id"), "hello").catch((e) => setStatus(e.message)));
    });
    root.querySelectorAll(".prompt-lib-open-odysseus").forEach((btn) => {
      btn.addEventListener("click", () => openInSurface(btn.getAttribute("data-id"), "odysseus").catch((e) => setStatus(e.message)));
    });
    root.querySelectorAll(".prompt-lib-open-automata").forEach((btn) => {
      btn.addEventListener("click", () => openInSurface(btn.getAttribute("data-id"), "automata").catch((e) => setStatus(e.message)));
    });
    root.querySelectorAll(".prompt-lib-report").forEach((btn) => {
      btn.addEventListener("click", () => showReport(btn.getAttribute("data-id")).catch((e) => setStatus(e.message)));
    });
    root.querySelector(".prompt-lib-clear-out")?.addEventListener("click", () => {
      const out = document.getElementById("prompt-library-output");
      if (out) out.textContent = "";
      setStatus("");
    });
  }

  function render() {
    return renderShell();
  }

  window.PromptLibrary = { render, bind, playPrompt, copyPrompt, showReport, STORAGE_PENDING };
})();
