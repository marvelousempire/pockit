/**
 * Pockit Help Guide — full console with topics left rail, related right rail, footer pills.
 * Route: suite-welcome / #/welcome (same as legacy Setup guide).
 */
(function (global) {
  const DATA_URL = "/pockit-help-topics.json";
  const STORAGE_KEY = "nephew-pockit-help-v1";

  let catalog = { sections: [] };
  let activeSectionId = null;
  let activeArticleId = null;
  let searchQuery = "";
  let stateHook = null;

  const LIGHTBULB_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.5V17h8v-2.5A7 7 0 0 0 12 2z"/></svg>';

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emitState() {
    stateHook?.(getState());
    global.dispatchEvent(new CustomEvent("pockit-help-state", { detail: getState() }));
  }

  function getState() {
    return {
      sectionId: activeSectionId,
      articleId: activeArticleId,
      searchQuery,
    };
  }

  function loadSavedSelection() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.sectionId) activeSectionId = saved.sectionId;
      if (saved?.articleId) activeArticleId = saved.articleId;
    } catch { /* ignore */ }
  }

  function persistSelection() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sectionId: activeSectionId, articleId: activeArticleId }),
      );
    } catch { /* ignore */ }
  }

  function allArticles() {
    const out = [];
    for (const sec of catalog.sections || []) {
      for (const art of sec.articles || []) {
        out.push({ ...art, sectionId: sec.id, sectionTitle: sec.title, sectionIcon: sec.icon });
      }
    }
    return out;
  }

  function findArticle(sectionId, articleId) {
    const sec = (catalog.sections || []).find((s) => s.id === sectionId);
    if (!sec) return null;
    const art = (sec.articles || []).find((a) => a.id === articleId);
    if (!art) return null;
    return { ...art, sectionId: sec.id, sectionTitle: sec.title, sectionIcon: sec.icon };
  }

  function defaultSelection() {
    const first = catalog.sections?.[0];
    if (!first) return;
    activeSectionId = first.id;
    activeArticleId = first.articles?.[0]?.id || null;
  }

  function ensureSelection() {
    if (activeSectionId && activeArticleId && findArticle(activeSectionId, activeArticleId)) return;
    defaultSelection();
  }

  async function fetchCatalog() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`help topics HTTP ${res.status}`);
    catalog = await res.json();
    loadSavedSelection();
    ensureSelection();
  }

  function filteredArticles() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allArticles().filter((a) => {
      const hay = `${a.title} ${a.lede} ${a.body} ${a.sectionTitle}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderLinkBtn(link) {
    if (!link) return "";
    const label = esc(link.label || "Open");
    if (link.url) {
      return `<a class="pockit-help-console__link-btn" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    if (link.href) {
      return `<a class="pockit-help-console__link-btn" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    if (link.make) {
      return `<button type="button" class="pockit-help-console__link-btn" data-help-make="${esc(link.make)}">${label}</button>`;
    }
    if (link.action === "overview") {
      return `<button type="button" class="pockit-help-console__link-btn" data-help-nav="overview">${label}</button>`;
    }
    if (link.action === "load" && link.loadId) {
      return `<button type="button" class="pockit-help-console__link-btn" data-help-load="${esc(link.loadId)}">${label}</button>`;
    }
    if (link.section && link.article) {
      return `<button type="button" class="pockit-help-console__link-btn" data-help-section="${esc(link.section)}" data-help-article="${esc(link.article)}">${label}</button>`;
    }
    if (link.section) {
      return `<button type="button" class="pockit-help-console__link-btn" data-help-section="${esc(link.section)}">${label}</button>`;
    }
    return "";
  }

  function renderArticlePanel(article) {
    if (!article) {
      return `<div class="pockit-help-console__empty">
        <div class="pockit-help-console__empty-icon" aria-hidden="true">💡</div>
        <p>Pick a topic in the left rail to read how Pockit works.</p>
      </div>`;
    }
    const steps = (article.steps || []).length
      ? `<ol class="pockit-help-console__steps">${article.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
      : "";
    const links = (article.links || []).length
      ? `<div class="pockit-help-console__inline-links">${article.links.map(renderLinkBtn).join("")}</div>`
      : "";
    const bodyHtml = esc(article.body || "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return `
      <article class="pockit-help-console__article" data-section="${esc(article.sectionId)}" data-article="${esc(article.id)}">
        <p class="pockit-help-console__kicker">${esc(article.sectionIcon || "")} ${esc(article.sectionTitle || "")}</p>
        <h2 class="pockit-help-console__article-title">${esc(article.title)}</h2>
        <p class="pockit-help-console__article-lede">${esc(article.lede || "")}</p>
        <div class="pockit-help-console__article-body">${bodyHtml}</div>
        ${steps}
        ${links}
      </article>`;
  }

  function renderSearchResults() {
    const hits = filteredArticles();
    if (!hits.length) {
      return `<div class="pockit-help-console__empty"><p>No topics match "${esc(searchQuery)}".</p></div>`;
    }
    return hits
      .map((a) => {
        const art = findArticle(a.sectionId, a.id);
        return renderArticlePanel(art);
      })
      .join('<hr class="pockit-help-console__divider" style="border:none;border-top:1px solid var(--border);margin:0 32px">');
  }

  function renderShell() {
    const article = findArticle(activeSectionId, activeArticleId);
    const center = searchQuery.trim() ? renderSearchResults() : renderArticlePanel(article);
    return `
      <div id="pockit-help-console" class="pockit-help-console">
        <header class="pockit-help-console__hero">
          <div class="pockit-help-console__hero-mesh" aria-hidden="true"></div>
          <p class="pockit-help-console__kicker">Family Office · Pockit</p>
          <h1 class="pockit-help-console__title">${esc(catalog.title || "Help Guide")}</h1>
          <p class="pockit-help-console__tagline">${esc(catalog.tagline || "How to use Pockit.")}</p>
          <div class="pockit-help-console__search-row">
            <input type="search" class="pockit-help-console__search" id="pockit-help-search"
              placeholder="Search help topics…" value="${esc(searchQuery)}" aria-label="Search help topics" />
          </div>
        </header>
        <div class="pockit-help-console__body">${center}</div>
      </div>`;
  }

  function setSelection(sectionId, articleId, { persist = true } = {}) {
    activeSectionId = sectionId;
    activeArticleId = articleId;
    searchQuery = "";
    if (persist) persistSelection();
    emitState();
    repaintCenter();
    global.highlightHelpRailSelections?.(getState());
  }

  function repaintCenter() {
    const host = document.querySelector("#pockit-help-console");
    if (!host) return;
    const body = host.querySelector(".pockit-help-console__body");
    if (!body) return;
    const article = findArticle(activeSectionId, activeArticleId);
    body.innerHTML = searchQuery.trim() ? renderSearchResults() : renderArticlePanel(article);
    bindCenterActions(body);
  }

  function runNavAction(spec) {
    if (!spec) return;
    if (spec.type === "overview") {
      global.setCassette?.("overview");
      return;
    }
    if (spec.type === "load" && spec.id) {
      global.setCassette?.(spec.id);
      return;
    }
    if (spec.type === "section" && spec.id) {
      const sec = (catalog.sections || []).find((s) => s.id === spec.id);
      if (sec?.articles?.[0]) setSelection(sec.id, sec.articles[0].id);
      return;
    }
    if (spec.type === "article" && spec.sectionId && spec.articleId) {
      setSelection(spec.sectionId, spec.articleId);
    }
  }

  function bindCenterActions(root) {
    if (!root) return;
    root.querySelectorAll("[data-help-nav]").forEach((btn) => {
      if (btn.dataset.helpBound === "1") return;
      btn.dataset.helpBound = "1";
      btn.addEventListener("click", () => runNavAction({ type: btn.getAttribute("data-help-nav") }));
    });
    root.querySelectorAll("[data-help-load]").forEach((btn) => {
      if (btn.dataset.helpBound === "1") return;
      btn.dataset.helpBound = "1";
      btn.addEventListener("click", () => runNavAction({ type: "load", id: btn.getAttribute("data-help-load") }));
    });
    root.querySelectorAll("[data-help-section]").forEach((btn) => {
      if (btn.dataset.helpBound === "1") return;
      btn.dataset.helpBound = "1";
      btn.addEventListener("click", () => {
        const sectionId = btn.getAttribute("data-help-section");
        const articleId = btn.getAttribute("data-help-article");
        if (articleId) {
          runNavAction({ type: "article", sectionId, articleId });
          return;
        }
        runNavAction({ type: "section", id: sectionId });
      });
    });
    root.querySelectorAll("[data-help-make]").forEach((btn) => {
      if (btn.dataset.helpBound === "1") return;
      btn.dataset.helpBound = "1";
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-help-make");
        global.PockitRailContext?.runMakeTarget?.(target, { source: "help-console" });
      });
    });
  }

  function bindShell(root) {
    if (!root) return;
    const search = root.querySelector("#pockit-help-search");
    if (search && search.dataset.helpBound !== "1") {
      search.dataset.helpBound = "1";
      search.addEventListener("input", () => {
        searchQuery = search.value || "";
        repaintCenter();
      });
    }
    bindCenterActions(root);
  }

  function buildLeftRailSections() {
    const sections = [];
    for (const sec of catalog.sections || []) {
      const items = (sec.articles || []).map((art) => ({
        id: `help-art-${sec.id}-${art.id}`,
        title: art.title,
        icon: "FileTextOutlined",
        glyph: (sec.icon || sec.title || "?").slice(0, 2),
        subtitle: sec.title,
        type: "help-article",
        _helpSectionId: sec.id,
        _helpArticleId: art.id,
      }));
      if (items.length) sections.push({ section: `${sec.icon || ""} ${sec.title}`.trim(), items });
    }
    return sections;
  }

  function buildRightRailSections(state = {}) {
    const article = findArticle(state.articleId ? state.sectionId : activeSectionId, state.articleId || activeArticleId);
    const sections = [];

    if (article?.links?.length) {
      sections.push({
        section: "Related",
        items: article.links.map((link, i) => ({
          id: `help-link-${i}`,
          title: link.label || "Open",
          icon: link.url || link.href ? "ExportOutlined" : link.make ? "PlayCircleOutlined" : "LinkOutlined",
          glyph: "→",
          subtitle: link.make ? `make ${link.make}` : link.url || link.action || "",
          type: "help-link",
          _helpLink: link,
        })),
      });
    }

    const related = allArticles()
      .filter((a) => a.sectionId === (article?.sectionId || activeSectionId) && a.id !== (article?.id || activeArticleId))
      .slice(0, 4)
      .map((a) => ({
        id: `help-rel-${a.sectionId}-${a.id}`,
        title: a.title,
        icon: "BookOutlined",
        glyph: "§",
        subtitle: a.sectionTitle,
        type: "help-article",
        _helpSectionId: a.sectionId,
        _helpArticleId: a.id,
      }));

    if (related.length) {
      sections.push({ section: "Same section", items: related });
    }

    sections.push({
      section: "Jump to",
      items: [
        { id: "help-jump-overview", title: "Pockit overview", icon: "AppstoreOutlined", glyph: "Po", subtitle: "All players grid", type: "help-nav", _helpNav: "overview" },
        { id: "help-jump-console", title: "Operator console", icon: "ControlOutlined", glyph: "HCC", subtitle: "console.localhost", type: "help-link", _helpLink: { label: "Open", url: "http://console.localhost/" } },
        { id: "help-jump-voice", title: "Super Rick", icon: "AudioOutlined", glyph: "Ri", subtitle: "Rick — voice-first talk mode", type: "help-nav", _helpNav: "load", _helpLoadId: "voice" },
        { id: "help-jump-knowledge", title: "Knowledge pad", icon: "ReadOutlined", glyph: "Kn", subtitle: "Brain A chat", type: "help-nav", _helpNav: "load", _helpLoadId: "knowledge" },
        { id: "help-jump-visual", title: "Visual Obsidian", icon: "BookOutlined", glyph: "Vi", subtitle: "NAS vault + LiveSync", type: "help-article", _helpSectionId: "visual-obsidian", _helpArticleId: "visual-obsidian-open" },
        { id: "help-jump-mobile", title: "Mobile & responsive", icon: "MobileOutlined", glyph: "Mo", subtitle: "Phone shell · PWA · tiers", type: "help-article", _helpSectionId: "mobile-responsive", _helpArticleId: "mobile-overview" },
      ],
    });

    return sections;
  }

  function onStateChange(fn) {
    stateHook = fn;
  }

  async function init() {
    if (!catalog.sections?.length) await fetchCatalog();
  }

  async function render() {
    await init();
    return renderShell();
  }

  global.PockitHelpConsole = {
    LIGHTBULB_SVG,
    fetchCatalog,
    init,
    render,
    renderShell,
    bindShell,
    getState,
    setSelection,
    onStateChange,
    buildLeftRailSections,
    buildRightRailSections,
    runNavAction,
    isHelpRoute(id) {
      return id === "suite-welcome" || id === "pockit-help";
    },
  };

  if (global.PockitPlayerContextPills?.registerFooterControls) {
    global.PockitPlayerContextPills.registerFooterControls("suite-welcome", () => [
      {
        id: "help-footer-overview",
        label: "Overview",
        group: "navigate",
        state: "ok",
        tip: "Overview\nReturn to the home grid",
        action: () => global.setCassette?.("overview"),
      },
      {
        id: "help-footer-console",
        label: "HCC",
        group: "navigate",
        state: "ok",
        tip: "Help Command Center\nOperator buttons at console.localhost",
        action: () => window.open("http://console.localhost/", "_blank", "noopener"),
      },
      {
        id: "help-footer-doors",
        label: "Doors",
        group: "operate",
        state: "ok",
        tip: "Wake doors\nmake doors",
        action: () => global.PockitRailContext?.runMakeTarget?.("doors", { source: "help-footer" }),
      },
    ]);
  }
})(window);
