/** Knowledge player rails — scope help, brain health labels, info modals (Scope + Brain). */
(function (global) {
  const INFO_EYE_SVG =
    '<svg class="voice-rail-info-btn__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/></svg>';

  const SECTION_INFO = {
    Scope: {
      title: "Scope",
      kicker: "Scope · left rail",
      lead: "Choose which Brain A shelves Nephew retrieves from before answering.",
      bullets: [
        "All — rules, plans, Clinic, Historia, vault, cassettes, and agent context.",
        "Rules — skills library and operator law only.",
        "Plans — meta-library and committed plans.",
        "Clinic / Historia / Vault — focused slices for those corpora.",
      ],
    },
    "Brain health": {
      title: "Brain health",
      kicker: "Brain · right rail",
      lead: "Live probes from tower-api corpus inventory — green means that layer answered recently.",
      bullets: [
        "Qdrant — indexed point count across Brain A shelves.",
        "Embeddings — bge-m3 embed service reachable on Spark.",
        "Retrieve — POST /api/v1/retrieve path healthy.",
        "Stale shelves — collections needing reindex.",
      ],
    },
    "RAG fabric": {
      title: "RAG fabric",
      kicker: "Brain · right rail",
      lead: "Open the RAG Console — pipeline stages, ingest commands, chunking, embedding, indexing, retrieve, and rerank.",
      bullets: [
        "RAG Console — center panel with live shelf health and make targets.",
        "Ingest: vault-ingest-docs after Understandings edits.",
        "Index: index-corpus on Spark for Brain A federation.",
        "Agents: MCP nephew_corpus_retrieve + INT-0019 teach-Nephew loop.",
      ],
    },
    Deploy: {
      title: "Deploy",
      kicker: "Brain · right rail",
      lead: "Make targets that reindex or audit the family knowledge corpus.",
      bullets: ["Click ▶ to run make … on the tower.", "Watch output in the log panel below."],
    },
    Visual: {
      title: "Visual",
      kicker: "Brain · right rail",
      lead: "The sovereign Obsidian vault on NAS — same notes Brain A indexes as nephew-vault.",
      bullets: [
        "Visual-Home — wiki HUD with Dataview, Micro Slices, and live capture routing.",
        "Obsidian Vault cassette — Quartz publish door at ext-vault.localhost.",
        "Tap any source chip in chat to open the note in Obsidian when on Mac.",
        "Operators: make visual-obsidian on the Mac (not the browser).",
      ],
    },
    Links: {
      title: "Links",
      kicker: "Brain · right rail",
      lead: "Jump to related family surfaces and operator doors.",
      bullets: [
        "Super Rick — voice-first AI agent with grounded speech I/O.",
        "Control Tower — full corpus inventory grid.",
        "Open full app — knowledge.localhost Speakers door.",
      ],
    },
  };

  const ITEM_INFO = {
    "know-scope-all": {
      title: "All knowledge",
      lead: "Retrieve across every populated Brain A shelf before the model answers.",
      controls: "Scope: all domains. Sources chips show cited paths.",
    },
    "know-scope-rules": {
      title: "Rules & skills",
      lead: "Operator rules, skills, and AI binder law only.",
      controls: "Scope: rules domain.",
    },
    "know-scope-memory": {
      title: "Plans & meta-library",
      lead: "Committed plans, meta-library teachings, and session artifacts.",
      controls: "Scope: memory domain.",
    },
    "know-scope-historia": {
      title: "Historia",
      lead: "Sovereign Historia corpus on NAS.",
      controls: "Scope: historia domain.",
    },
    "know-scope-clinic": {
      title: "Clinic",
      lead: "Curated Clinic register cases and bulk case files.",
      controls: "Scope: clinic domain.",
    },
    "know-scope-vault": {
      title: "Sovereign vault",
      lead: "Obsidian / Visual vault notes indexed on Spark.",
      controls: "Scope: vault domain.",
    },
    "know-panel-rag-console": {
      title: "RAG Console",
      lead: "Full operator view: ingest → chunk → embed → index → retrieve → rerank. Teach Nephew via vault-ingest + index-corpus.",
      controls: "Center panel: rag-console. Understanding: 0002-rag-fabric-and-agent-learning.",
    },
    "know-panel-inventory": {
      title: "Inventory",
      lead: "Opens Advanced ops focused on fleet summary, sources, and collections.",
      controls: "Center panel: inventory. Scrolls to operator tables.",
    },
    "know-panel-probe": {
      title: "Honesty probe",
      lead: "Retrieve-only — no model answer. Verify a query hits indexed corpus.",
      controls: "Center panel: probe. Focuses the probe input.",
    },
    "know-link-visual-home": {
      title: "Visual-Home",
      lead: "Opens the sovereign Visual Obsidian vault home note (NAS mirror).",
      controls: "obsidian:// URI — requires Obsidian installed on this Mac.",
    },
    "know-link-ext-vault": {
      title: "Obsidian Vault cassette",
      lead: "Pockit embed for Quartz-published vault pages.",
      controls: "Loads #/c/ext-vault in the shell.",
    },
  };

  function sectionInfoButton(sectionName) {
    const info = SECTION_INFO[sectionName];
    if (!info) return "";
    return `<button type="button" class="voice-rail-info-btn voice-rail-info-btn--section" data-knowledge-info-section="${escapeAttr(sectionName)}" aria-label="About ${escapeAttr(sectionName)}">${INFO_EYE_SVG}</button>`;
  }

  function infoButtonHtml(itemId, ariaLabel) {
    if (!ITEM_INFO[itemId]) return "";
    return `<button type="button" class="voice-rail-info-btn" data-knowledge-info-item="${escapeAttr(itemId)}" aria-label="${escapeAttr(ariaLabel || "More info")}">${INFO_EYE_SVG}</button>`;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function leafExtrasHtml(item) {
    const info = ITEM_INFO[item.id] ? infoButtonHtml(item.id, `About ${item.title}`) : "";
    if (item.type === "knowledge-health") {
      const healthClass = item._healthPending ? "is-pending" : item._healthOk ? "is-ok" : "is-bad";
      return {
        led: `<span class="voice-rail-led voice-rail-led--${healthClass.replace("is-", "")}" aria-hidden="true"></span>`,
        status: `<span class="voice-rail-status" data-knowledge-status-id="${escapeAttr(item.id)}" data-default-subtitle="${escapeAttr(item.subtitle || "")}">${escapeAttr(item.subtitle || "")}</span>`,
        info,
      };
    }
    return { info };
  }

  function openInfoModal(payload) {
    const title = payload.title || "Knowledge rail";
    const body = `
      ${payload.kicker ? `<p class="voice-rail-info-kicker">${escapeAttr(payload.kicker)}</p>` : ""}
      ${payload.lead ? `<p>${escapeAttr(payload.lead)}</p>` : ""}
      ${payload.controls ? `<p><strong>Controls:</strong> ${escapeAttr(payload.controls)}</p>` : ""}
      ${(payload.bullets || []).length ? `<ul>${payload.bullets.map((b) => `<li>${escapeAttr(b)}</li>`).join("")}</ul>` : ""}`;
    if (global.PockitModal?.openHtml) {
      global.PockitModal.openHtml(title, body);
      return;
    }
    window.alert(`${title}\n\n${payload.lead || ""}`);
  }

  function bindInfoButtons(rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    root.querySelectorAll("[data-knowledge-info-section]").forEach((btn) => {
      if (btn.dataset.knowledgeInfoBound === "1") return;
      btn.dataset.knowledgeInfoBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.getAttribute("data-knowledge-info-section");
        openInfoModal(SECTION_INFO[name] || { title: name });
      });
    });
    root.querySelectorAll("[data-knowledge-info-item]").forEach((btn) => {
      if (btn.dataset.knowledgeInfoBound === "1") return;
      btn.dataset.knowledgeInfoBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute("data-knowledge-info-item");
        openInfoModal(ITEM_INFO[id] || { title: id });
      });
    });
  }

  function syncChrome(st = {}) {
    const scope = st.scope || "all";
    document.querySelectorAll("[data-knowledge-scope]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-knowledge-scope") === scope);
    });
    document.querySelectorAll("[data-knowledge-panel]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-knowledge-panel") === (st.panel || "chat"));
    });
  }

  global.KnowledgeRailInfo = {
    sectionInfoButton,
    infoButtonHtml,
    leafExtrasHtml,
    bindInfoButtons,
    syncChrome,
  };
})(window);
