(function (global) {
  // Plan 0267 — Right cassette rail: Mac .app HCC commands + cassette section scrollspy.

  const MODE_KEY = "nephew-pockit-right-rail-mode";
  const MODES = {
    auto: "auto",
    nav: "nav",
    commands: "commands",
    sections: "sections",
    all: "all",
  };

  /** Human labels for voice Make targets — overrides catalog desc snippets. */
  const VOICE_MAKE_LABELS = {
    "voice-premium": "Full premium stack",
    "ensure-voice-ref": "Record operator voice",
    "ensure-voice": "M5 voice edge",
    "deploy-voice-premium-dgx": "Deploy DGX voice",
    "sync-voice-refs-dgx": "Sync ref to DGX",
    "ensure-spark-tts-weights-m5": "Spark-TTS weights",
    "install-spark-tts-m5": "Spark-TTS sidecar",
    "spark-tts-eval": "Spark-TTS eval",
    "voice-cassette": "Open voice console",
    "ensure-m5-voice": "M5 edge (full setup)",
    "voice-launchagent": "Voice LaunchAgent",
  };

  let operatorCatalog = null;
  let operatorRecipes = null;
  let scrollObserver = null;
  let activeSectionId = null;
  let onSectionChange = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getMode() {
    try {
      const v = localStorage.getItem(MODE_KEY);
      return MODES[v] ? v : MODES.auto;
    } catch {
      return MODES.auto;
    }
  }

  function setMode(mode) {
    if (!MODES[mode]) return;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch { /* ignore */ }
  }

  async function loadOperatorCatalog() {
    if (operatorCatalog) return operatorCatalog;
    try {
      const res = await fetch("/api/v1/operator/commands", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        operatorCatalog = data;
        return data;
      }
    } catch { /* tower offline */ }
    return null;
  }

  async function loadOperatorRecipes() {
    if (operatorRecipes) return operatorRecipes;
    try {
      const res = await fetch("/data/operator-button-recipes.json", { cache: "no-store" });
      if (res.ok) {
        operatorRecipes = await res.json();
        return operatorRecipes;
      }
    } catch { /* ignore */ }
    return { recipes: [] };
  }

  function catalogItemById(catalog, id) {
    if (!catalog?.sections) return null;
    for (const sec of catalog.sections) {
      for (const item of sec.items || []) {
        if (item.id === id) return item;
      }
    }
    return null;
  }

  function commandsFromTargetIds(catalog, targetIds) {
    const items = [];
    const seen = new Set();
    for (const id of targetIds || []) {
      if (seen.has(id)) continue;
      const item = catalogItemById(catalog, id);
      if (item) {
        seen.add(id);
        items.push(item);
      }
    }
    return items;
  }

  async function resolveMacAppCommands(macApp) {
    if (!macApp) return { make: [], quick: [] };
    const catalog = await loadOperatorCatalog();
    const recipes = await loadOperatorRecipes();
    const make = catalog ? commandsFromTargetIds(catalog, macApp.operator_targets || []) : [];
    const quickIds = macApp.quick_recipe_ids || [];
    const quick = (recipes.recipes || [])
      .filter((r) => quickIds.includes(r.id))
      .map((r) => ({
        id: r.id,
        kind: "recipe",
        label: r.pickLabel || r.id,
        desc: r.description || "",
        make: r.make,
        icon: r.icon || "⚡",
        run_policy: "allow",
      }));
    return { make, quick };
  }

  async function resolveCassetteCommands(catalogEntry) {
    const fallback = {
      voice: [
        "voice-premium", "ensure-voice-ref", "ensure-voice", "deploy-voice-premium-dgx",
        "sync-voice-refs-dgx", "ensure-spark-tts-weights-m5", "install-spark-tts-m5", "spark-tts-eval", "voice-cassette",
      ],
      "voice-cassette": [
        "voice-premium", "ensure-voice-ref", "ensure-voice", "deploy-voice-premium-dgx",
        "sync-voice-refs-dgx", "ensure-spark-tts-weights-m5", "install-spark-tts-m5", "spark-tts-eval", "voice-cassette",
      ],
    };
    const ids =
      catalogEntry?.operator_commands ||
      fallback[catalogEntry?.id] ||
      fallback[catalogEntry?.hub_card_id] ||
      [];
    if (!ids.length) return [];
    const catalog = await loadOperatorCatalog();
    return catalog ? commandsFromTargetIds(catalog, ids) : [];
  }

  function contentScrollRoot() {
    const main = document.getElementById("main-content");
    if (!main) return null;
    return main.querySelector(".pockit-center-canvas") || main;
  }

  function slugifySectionId(raw, used) {
    let base = String(raw || "section")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section";
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    return id;
  }

  function ensureSectionIds(container) {
    if (!container) return [];
    const used = new Set();
    const entries = [];

    container.querySelectorAll("section[id]").forEach((el) => {
      used.add(el.id);
      entries.push({
        id: el.id,
        label: el.getAttribute("data-toc-label") || el.querySelector("h1,h2,h3,summary")?.textContent?.trim() || el.id,
        el,
      });
    });

    container.querySelectorAll("section[data-section]:not([id])").forEach((el) => {
      const id = slugifySectionId(el.getAttribute("data-section"), used);
      el.id = id;
      if (!el.getAttribute("data-toc-label")) {
        const head = el.querySelector("h1,h2,h3,.overview-section-head,h2")?.textContent?.trim();
        if (head) el.setAttribute("data-toc-label", head.slice(0, 80));
      }
      entries.push({
        id,
        label: el.getAttribute("data-toc-label") || el.getAttribute("data-section") || id,
        el,
      });
    });

    container.querySelectorAll("[data-toc-section]").forEach((el) => {
      if (el.id) return;
      const id = slugifySectionId(el.getAttribute("data-toc-section"), used);
      el.id = id;
      entries.push({
        id,
        label: el.getAttribute("data-toc-label") || el.getAttribute("data-toc-section") || id,
        el,
      });
    });

    return entries.sort((a, b) => {
      if (!a.el || !b.el) return 0;
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  function discoverSections() {
    const root = contentScrollRoot();
    if (!root) return [];
    return ensureSectionIds(root);
  }

  function resolveEffectiveMode(ctx) {
    const stored = getMode();
    if (stored !== MODES.auto) return stored;
    if (ctx.isVoice && ctx.hasOperatorCommands) return MODES.commands;
    if (ctx.isVoice) return MODES.commands;
    const { macAppActive, sectionCount, nativeCassette, hasOperatorCommands } = ctx;
    if (sectionCount >= 2 && nativeCassette && hasOperatorCommands) return MODES.all;
    if (sectionCount >= 2 && nativeCassette) return MODES.sections;
    if (macAppActive) return MODES.all;
    if (sectionCount >= 2) return MODES.sections;
    return MODES.nav;
  }

  function railModeOptions(ctx) {
    const opts = [{ value: MODES.auto, label: "Auto rail", icon: "ThunderboltOutlined" }];
    if (ctx.macAppActive) {
      opts.push({ value: MODES.all, label: "All · nav + commands", icon: "AppstoreOutlined" });
      opts.push({ value: MODES.nav, label: "App menus", icon: "MenuOutlined" });
      opts.push({ value: MODES.commands, label: "Make + quick", icon: "CodeOutlined" });
    }
    if (ctx.sectionCount >= 1) {
      opts.push({ value: MODES.sections, label: "Page sections", icon: "UnorderedListOutlined" });
    }
    if (!ctx.macAppActive && ctx.sectionCount < 1) {
      opts.push({ value: MODES.nav, label: "Cassettes", icon: "ClusterOutlined" });
    }
    return opts;
  }

  function railModeLabel(mode, ctx) {
    if (mode === MODES.auto) {
      const eff = resolveEffectiveMode(ctx);
      if (eff === MODES.sections) return "On this page";
      if (eff === MODES.commands) return "Make commands";
      if (eff === MODES.all) return "App · all";
      return ctx.macAppActive ? "App menus" : "Cassettes";
    }
    const map = {
      nav: ctx.macAppActive ? "App menus" : "Cassettes",
      commands: "Make + quick",
      sections: "On this page",
      all: "App · all",
    };
    return map[mode] || "Right rail";
  }

  function commandLabel(cmd) {
    const id = cmd.id || cmd.make;
    if (VOICE_MAKE_LABELS[id]) return VOICE_MAKE_LABELS[id];
    return (
      cmd.pickLabel ||
      cmd.label ||
      (cmd.desc ? String(cmd.desc).split(/[.—]/)[0].slice(0, 56) : id)
    );
  }

  function commandToSidebarItem(cmd, prefix) {
    const id = cmd.id || cmd.make;
    const runnable = cmd.run_policy === "allow";
    const title = commandLabel(cmd);
    const subtitleHint = VOICE_MAKE_LABELS[id]
      ? (cmd.desc ? String(cmd.desc).slice(0, 72) : `make ${id}`)
      : (cmd.desc ? String(cmd.desc).slice(0, 72) : cmd.cmd || (cmd.make ? `make ${cmd.make}` : ""));
    return {
      id: `${prefix}-${id}`,
      title,
      icon: runnable ? "ThunderboltOutlined" : "ExportOutlined",
      glyph: cmd.icon || (runnable ? "▶" : "⌘"),
      subtitle: subtitleHint,
      type: runnable ? "make-run" : "make-copy",
      _makeTarget: id,
      _makeCmd: cmd.cmd || (cmd.make ? `make ${cmd.make}` : `make ${id}`),
    };
  }

  function sectionToSidebarItem(entry) {
    return {
      id: `section-${entry.id}`,
      title: entry.label,
      glyph: "§",
      subtitle: "",
      type: "section-jump",
      _sectionId: entry.id,
    };
  }

  function renderVoicePickerRailHtml() {
    const sectionBtn = global.VoiceRailInfo?.sectionInfoButton?.("Speakers") || "";
    return `<section class="sidebar-section sidebar-section--voice-picker sidebar-section--voice" data-section="voice-picker">
      <div class="sidebar-section-head-row">
        <h3><span class="sidebar-section-dot" aria-hidden="true"></span>Speakers</h3>
        ${sectionBtn}
      </div>
      <div class="voice-rail-speakers-row">
        <button type="button" class="voice-rail-speakers-btn sidebar-item-main--voice" data-action="voice-control" data-voice-action="speakers" aria-label="Choose and preview speaker voices">
          <span class="voice-rail-led voice-rail-led--ok" aria-hidden="true"></span>
          <span class="voice-rail-speakers-icon" aria-hidden="true">🎙</span>
          <span class="voice-rail-speakers-copy sidebar-label-stack">
            <span class="voice-rail-speakers-title sidebar-label">Voices</span>
            <span class="voice-rail-speakers-current voice-rail-status" id="voice-rail-speaker-label">Syncing…</span>
          </span>
          <span class="voice-rail-speakers-chevron" aria-hidden="true">›</span>
        </button>
        ${global.VoiceRailInfo?.infoButtonHtml?.("voice-del-speakers", "About Speakers") || ""}
      </div>
    </section>`;
  }

  async function buildVideoRightRailSections(st = {}, cassetteEnt = null) {
    let health = { ok: false };
    try {
      const r = await fetch("/api/v1/video/health", { credentials: "include" });
      health = await r.json();
    } catch { /* offline */ }
    const comfyOk = health?.pipeline?.comfyui?.ok === true;
    const sections = [{
      section: "Stack health",
      items: [
        healthTileItem("video-h-comfy", "ComfyUI", "ApiOutlined", comfyOk ? "Graph executor live" : "Open ComfyUI console (#/c/comfyui-console)", comfyOk, false),
        healthTileItem("video-h-pipe", "Video pipeline", "ThunderboltOutlined", health.ok ? "tower-api /video/*" : "Degraded", Boolean(health.ok), false),
        healthTileItem("video-h-webrtc", "WebRTC SFU", "ClusterOutlined", health?.pipeline?.stream?.webrtc_enabled ? "Signaling wired" : "HLS default", Boolean(health?.pipeline?.stream?.webrtc_enabled), false),
      ],
    }];

    const catalog = await loadOperatorCatalog();
    const makeItems = cassetteEnt ? await resolveCassetteCommands(cassetteEnt) : [];
    const deployIds = new Set(["video-seed", "install-video-app", "ensure-video-console", "video-console"]);
    const deploy = [];
    for (const c of makeItems) {
      if (deployIds.has(c.id)) deploy.push(commandToSidebarItem(c, "make"));
    }
    if (deploy.length) sections.push({ section: "Deploy", items: deploy });
    return sections;
  }

  function buildVideoLeftRailSections() {
    const routeItems = [
      { id: "video-ctl-route-auto", title: "Auto", icon: "ReloadOutlined", subtitle: "Mac draft + DGX final", type: "video-route", _videoRoute: "auto" },
      { id: "video-ctl-route-mac", title: "Mac draft", icon: "ClusterOutlined", subtitle: "Wan / CogVideoX / LTX", type: "video-route", _videoRoute: "mac" },
      { id: "video-ctl-route-dgx", title: "DGX final", icon: "CloudServerOutlined", subtitle: "HunyuanVideo on Spark", type: "video-route", _videoRoute: "dgx" },
    ];
    const modeItems = [
      { id: "video-ctl-mode-t2v", title: "t2v", icon: "FileTextOutlined", subtitle: "Text-to-video", type: "video-mode", _videoMode: "t2v" },
      { id: "video-ctl-mode-i2v", title: "i2v", icon: "PictureOutlined", subtitle: "Image-to-video", type: "video-mode", _videoMode: "i2v" },
    ];
    const streamItems = [
      { id: "video-ctl-stream-hls", title: "HLS", icon: "PlayCircleOutlined", subtitle: "~2–4s segments", type: "video-stream", _videoStream: "hls" },
      { id: "video-ctl-stream-webrtc", title: "WebRTC", icon: "ThunderboltOutlined", subtitle: "Low-latency SFU", type: "video-stream", _videoStream: "webrtc" },
    ];
    const linkItems = [
      { id: "video-link-workspace", title: "Workspace", icon: "ExportOutlined", subtitle: "127.0.0.1:8820", type: "load", url: "http://127.0.0.1:8820/" },
      { id: "video-link-console", title: "Video console", icon: "DashboardOutlined", subtitle: "video.localhost door", type: "video-action", _videoAction: "console" },
      { id: "video-link-super-rick", title: "COMP bridge", icon: "DashboardOutlined", subtitle: "/super-rick LED table", type: "video-action", _videoAction: "super-rick" },
      { id: "video-link-voice", title: "Voice pad", icon: "ApiOutlined", subtitle: "Send to Video source", type: "load", url: "#/c/voice" },
    ];
    return [
      { section: "Route", items: routeItems },
      { section: "Mode", items: modeItems },
      { section: "Stream", items: streamItems },
      { section: "Links", items: linkItems },
    ];
  }

  function healthTileItem(id, title, icon, subtitle, ok, pending = false) {
    return {
      id,
      title,
      icon,
      glyph: title.slice(0, 2),
      subtitle: pending ? "Checking stack…" : subtitle,
      type: "voice-health",
      _healthOk: pending ? null : Boolean(ok),
      _healthPending: pending,
    };
  }

  async function buildVoiceRightRailSections(health = {}, cassetteEnt = null) {
    const h = health || {};
    const probing = Boolean(h.healthProbePending);
    const m5Ok = Boolean(h.m5Healthy);
    const dgxOk = Boolean(h.dgxHealthy);
    const dgxDegraded = Boolean(h.dgxDegraded);
    const sttOk = Boolean(h.sttHealthy);
    const sparkOk = Boolean(h.sparkHealthy);
    const sparkNative = Boolean(h.sparkNative);
    const ragOk = Boolean(h.ragHealthy);
    const premiumOk = h.premiumAvailable !== false && (m5Ok || dgxOk || Boolean(h.premiumAvailable));
    const sections = [];

    sections.push({
      section: "Stack health",
      items: [
        healthTileItem("voice-h-m5", "M5 edge", "ClusterOutlined", m5Ok ? "Holler STT + TTS online" : "Offline — run ensure-m5-voice", m5Ok, probing),
        healthTileItem("voice-h-dgx", "DGX stack", "CloudServerOutlined", dgxOk ? (dgxDegraded ? "Reachable (slow)" : "Premium models reachable") : "Unreachable", dgxOk, probing),
        healthTileItem(
          "voice-h-spark",
          "Spark-TTS",
          "ThunderboltOutlined",
          sparkOk
            ? (sparkNative ? "Native 0.5B :8093" : "Emotion sidecar :8092")
            : "Offline — install-spark-tts-m5",
          sparkOk,
          probing,
        ),
        healthTileItem("voice-h-rag", "Grounded RAG", "BookOutlined", ragOk ? "Retrieve substrate live" : "Retrieve offline — check Qdrant", ragOk, probing),
        healthTileItem("voice-h-stt", "Whisper STT", "ApiOutlined", sttOk ? "Transcription ready" : "Warming up", sttOk, probing),
        healthTileItem("voice-h-tts", "Premium TTS", "ThunderboltOutlined", premiumOk ? "Covenant engines up" : "Text-only fallback", premiumOk, probing),
      ],
    });

    const catalog = await loadOperatorCatalog();
    const makeItems = cassetteEnt ? await resolveCassetteCommands(cassetteEnt) : [];
    const deployIds = new Set([
      "voice-premium",
      "deploy-voice-premium-dgx",
      "ensure-voice",
      "ensure-m5-voice",
      "install-spark-tts-m5",
      "voice-launchagent",
    ]);
    const quickIds = new Set([
      "ensure-voice-ref",
      "sync-voice-refs-dgx",
      "spark-tts-eval",
      "voice-cassette",
    ]);
    const deploy = [];
    const quick = [];
    for (const c of makeItems) {
      if (deployIds.has(c.id)) deploy.push(commandToSidebarItem(c, "make"));
      else if (quickIds.has(c.id)) quick.push(commandToSidebarItem(c, "make"));
      else deploy.push(commandToSidebarItem(c, "make"));
    }
    if (deploy.length) sections.push({ section: "Deploy", items: deploy });
    if (quick.length) sections.push({ section: "Quick ops", items: quick });
    if (!deploy.length && !quick.length && catalog) {
      sections.push({
        section: "Deploy",
        items: [{
          id: "voice-h-no-cmds",
          title: "No Make targets",
          glyph: "—",
          subtitle: "Operator catalog offline or empty",
          type: "voice-health",
          _healthOk: false,
        }],
      });
    }
    return sections;
  }

  function buildKnowledgeLeftRailSections() {
    const scopeItems = [
      { id: "know-scope-all", title: "All knowledge", icon: "GlobalOutlined", subtitle: "Every Brain A shelf", type: "knowledge-scope", _knowledgeScope: "all" },
      { id: "know-scope-rules", title: "Rules & skills", icon: "BookOutlined", subtitle: "Operator law + skills", type: "knowledge-scope", _knowledgeScope: "rules" },
      { id: "know-scope-memory", title: "Plans & meta-library", icon: "FileTextOutlined", subtitle: "Plans + teachings", type: "knowledge-scope", _knowledgeScope: "memory" },
      { id: "know-scope-historia", title: "Historia", icon: "ReadOutlined", subtitle: "NAS Historia corpus", type: "knowledge-scope", _knowledgeScope: "historia" },
      { id: "know-scope-clinic", title: "Clinic", icon: "MedicineBoxOutlined", subtitle: "Case register", type: "knowledge-scope", _knowledgeScope: "clinic" },
      { id: "know-scope-vault", title: "Sovereign vault", icon: "LockOutlined", subtitle: "Visual / Obsidian", type: "knowledge-scope", _knowledgeScope: "vault" },
    ];
    return [{ section: "Scope", items: scopeItems }];
  }

  function knowledgeHealthTile(id, title, icon, subtitle, ok, pending = false) {
    return {
      id,
      title,
      icon,
      glyph: title.slice(0, 2),
      subtitle: pending ? "Checking brain…" : subtitle,
      type: "knowledge-health",
      _healthOk: pending ? null : Boolean(ok),
      _healthPending: pending,
    };
  }

  async function buildKnowledgeRightRailSections(cassetteEnt = null) {
    let inv = { ok: false };
    try {
      const r = await fetch("/api/v1/corpus/inventory", { credentials: "include" });
      inv = await r.json();
    } catch { /* offline */ }
    const infra = inv.infrastructure || {};
    const staleCount = (inv.collections || []).filter((c) => c.stale || c.status === "stale").length;
    const sections = [];

    sections.push({
      section: "Brain health",
      items: [
        knowledgeHealthTile(
          "know-h-qdrant",
          "Qdrant",
          "DatabaseOutlined",
          inv.ok ? `${(inv.total_points ?? 0).toLocaleString()} points indexed` : "Inventory offline",
          inv.ok && (inv.total_points ?? 0) > 0,
          false,
        ),
        knowledgeHealthTile(
          "know-h-embed",
          "Embeddings",
          "ApiOutlined",
          infra.embeddings_ok ? "bge-m3 embed service live" : "Embeddings down",
          Boolean(infra.embeddings_ok),
          false,
        ),
        knowledgeHealthTile(
          "know-h-retrieve",
          "Retrieve API",
          "SearchOutlined",
          inv.ok ? "POST /api/v1/retrieve ready" : "tower-api unreachable",
          Boolean(inv.ok),
          false,
        ),
        knowledgeHealthTile(
          "know-h-stale",
          "Stale shelves",
          "WarningOutlined",
          staleCount ? `${staleCount} need reindex` : "All shelves fresh",
          staleCount === 0,
          false,
        ),
      ],
    });

    sections.push({
      section: "Panels",
      items: [
        { id: "know-panel-inventory", title: "Inventory", icon: "BarChartOutlined", subtitle: "Fleet summary + collections", type: "knowledge-panel", _knowledgePanel: "inventory" },
        { id: "know-panel-probe", title: "Honesty probe", icon: "SearchOutlined", subtitle: "Retrieve-only test", type: "knowledge-panel", _knowledgePanel: "probe" },
      ],
    });

    const makeItems = cassetteEnt ? await resolveCassetteCommands(cassetteEnt) : [];
    const deployIds = new Set(["index-corpus", "index-corpus-full", "memory-fabric-reindex", "corpus-status"]);
    const deploy = [];
    for (const c of makeItems) {
      if (deployIds.has(c.id)) deploy.push(commandToSidebarItem(c, "make"));
    }
    if (deploy.length) sections.push({ section: "Deploy", items: deploy });

    sections.push({
      section: "Visual",
      items: [
        {
          id: "know-link-visual-home",
          title: "Visual-Home",
          icon: "EyeOutlined",
          subtitle: "Sovereign Obsidian wiki entry",
          type: "load",
          url: "obsidian://open?vault=nephew-sovereign-vault&file=Visual-Home",
        },
        {
          id: "know-link-ext-vault",
          title: "Obsidian Vault",
          icon: "BookOutlined",
          subtitle: "Quartz publish · ext-vault cassette",
          type: "load",
          url: "#/c/ext-vault",
        },
      ],
    });

    sections.push({
      section: "Links",
      items: [
        { id: "know-link-voice", title: "Parakeet Voice", icon: "AudioOutlined", subtitle: "Grounded voice chat", type: "load", url: "#/c/voice" },
        { id: "know-link-ct", title: "CT inventory", icon: "AppstoreOutlined", subtitle: "Control Tower grid", type: "load", url: "http://ct.localhost/overview" },
        {
          id: "know-link-speakers",
          title: "Open full app",
          icon: "ExportOutlined",
          subtitle: "knowledge.localhost",
          type: "encompass-nav",
          _encompassCassetteId: "knowledge",
          _speakersOnly: true,
          _speakersDoor: "http://knowledge.localhost/",
        },
      ],
    });

    return sections;
  }

  function buildVoiceLeftRailSections() {
    const routeItems = [
      { id: "voice-ctl-route-auto", title: "Auto route", icon: "ReloadOutlined", subtitle: "Advisor picks best path", type: "voice-route", _voiceRoute: "auto" },
      { id: "voice-ctl-route-m5", title: "M5 edge", icon: "ClusterOutlined", subtitle: "Local STT + Holler on Mac", type: "voice-route", _voiceRoute: "m5" },
      { id: "voice-ctl-route-dgx", title: "DGX route", icon: "CloudServerOutlined", subtitle: "Premium models on Spark", type: "voice-route", _voiceRoute: "dgx" },
    ];
    const modeItems = [
      { id: "voice-ctl-mode-chat", title: "Chat", icon: "TeamOutlined", subtitle: "Talk with Nephew", type: "voice-mode", _voiceMode: "chat" },
      { id: "voice-ctl-mode-read", title: "Read aloud", icon: "ReadOutlined", subtitle: "TTS-only playback", type: "voice-mode", _voiceMode: "read" },
      { id: "voice-ctl-mode-prime", title: "Prime", icon: "ThunderboltOutlined", subtitle: "Deep RAG + largest models", type: "voice-action", _voiceAction: "prime" },
    ];
    const ragItems = [
      { id: "voice-ctl-rag-fast", title: "Fast RAG", icon: "ThunderboltOutlined", subtitle: "Skip corpus retrieve", type: "voice-rag", _voiceRag: "fast" },
      { id: "voice-ctl-rag-grounded", title: "Grounded RAG", icon: "BookOutlined", subtitle: "Retrieve before reply", type: "voice-rag", _voiceRag: "grounded" },
    ];
    const deliveryItems = [
      { id: "voice-del-speakers", title: "Speakers", icon: "UserOutlined", subtitle: "Preview & choose voice", type: "voice-action", _voiceAction: "speakers" },
      { id: "voice-del-jarvis", title: "Jarvis", icon: "ControlOutlined", subtitle: "Calm assistant delivery", type: "voice-voice", _voiceId: "jarvis" },
      { id: "voice-del-warm", title: "Warm host", icon: "UserOutlined", subtitle: "Friendly conversational tone", type: "voice-voice", _voiceId: "warm_host" },
      { id: "voice-del-news", title: "News anchor", icon: "ReadOutlined", subtitle: "Crisp broadcast delivery", type: "voice-voice", _voiceId: "news_anchor" },
    ];
    const linkItems = [
      { id: "voice-link-knowledge", title: "Knowledge", icon: "BookOutlined", subtitle: "Family RAG cassette", type: "load", url: "#/c/knowledge" },
      { id: "voice-link-console", title: "Voice console", icon: "ExportOutlined", subtitle: "voice.localhost ops door", type: "voice-action", _voiceAction: "console" },
      { id: "voice-link-presence", title: "The Presence", icon: "BulbOutlined", subtitle: "Cinematic orb in this pad", type: "voice-action", _voiceAction: "presence" },
      { id: "voice-link-super-rick", title: "Super Rick", icon: "DashboardOutlined", subtitle: "COMP bridge LED table", type: "voice-action", _voiceAction: "super-rick" },
    ];
    const actionItems = [
      { id: "voice-ctl-talk", title: "Talk", icon: "ApiOutlined", subtitle: "Start speaking", type: "voice-action", _voiceAction: "talk" },
      { id: "voice-ctl-stop", title: "Stop", icon: "PoweroffOutlined", subtitle: "Cancel playback", type: "voice-action", _voiceAction: "stop" },
      { id: "voice-ctl-clear", title: "Clear log", icon: "BlockOutlined", subtitle: "Empty conversation", type: "voice-action", _voiceAction: "clear" },
    ];
    return [
      { section: "Route", items: routeItems },
      { section: "Mode", items: modeItems },
      { section: "RAG", items: ragItems },
      { section: "Delivery", items: deliveryItems },
      { section: "Quick actions", items: actionItems },
      { section: "Links", items: linkItems },
    ];
  }

  function renderScrollspySectionHtml(entries, activeId) {
    if (!entries.length) return "";
    const items = entries
      .map(
        (e) =>
          `<li class="sidebar-item sidebar-item--section${activeId === e.id ? " active is-spy-active" : ""}" data-id="section-${esc(e.id)}" data-section-id="${esc(e.id)}">
        <button type="button" class="sidebar-item-main sidebar-item-main--section" data-action="section-jump" data-section-id="${esc(e.id)}" aria-current="${activeId === e.id ? "true" : "false"}">
          <span class="sidebar-glyph-wrap sidebar-glyph-wrap--tile"><span class="sidebar-glyph">§</span></span>
          <span class="sidebar-label">${esc(e.label)}</span>
        </button>
      </li>`,
      )
      .join("");
    return `<section class="sidebar-section sidebar-section--scrollspy" data-section="on-this-page">
      <h3><span class="sidebar-section-dot" aria-hidden="true"></span>On this page</h3>
      <ul class="sidebar-scrollspy-list">${items}</ul>
    </section>`;
  }

  function detachScrollspy() {
    scrollObserver?.disconnect();
    scrollObserver = null;
    activeSectionId = null;
  }

  function updateScrollspyHighlight(id) {
    activeSectionId = id;
    document.querySelectorAll("#sidebar-content .sidebar-item--section, #player-rail-content .sidebar-item--section").forEach((el) => {
      const on = el.getAttribute("data-section-id") === id;
      el.classList.toggle("is-spy-active", on);
      el.classList.toggle("active", on);
      const btn = el.querySelector("[data-action=section-jump]");
      if (btn) btn.setAttribute("aria-current", on ? "true" : "false");
    });
    onSectionChange?.(id);
  }

  function attachScrollspy(entries) {
    detachScrollspy();
    if (!entries.length) return;
    const root = contentScrollRoot();
    if (!root) return;

    scrollObserver = new IntersectionObserver(
      (obs) => {
        for (const entry of obs) {
          if (entry.isIntersecting) updateScrollspyHighlight(entry.target.id);
        }
      },
      { root: null, rootMargin: "-12% 0px -55% 0px", threshold: 0 },
    );

    for (const e of entries) {
      if (e.el) scrollObserver.observe(e.el);
    }
  }

  function bindSectionJump(rootSelector) {
    document.querySelectorAll(`${rootSelector} [data-action=section-jump]`).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-section-id");
        const el = id ? document.getElementById(id) : null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          updateScrollspyHighlight(id);
        }
        if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
      });
    });
  }

  async function runMakeTarget(target, logEl) {
    if (!target) return;
    if (logEl) {
      logEl.classList.remove("hidden");
      logEl.textContent = `→ make ${target}\n`;
    }
    try {
      const res = await fetch("/api/v1/operator/make-run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
          if (j.cmd) msg += ` (${j.cmd})`;
        } catch { /* ignore */ }
        if (logEl) logEl.textContent += msg + "\n";
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (line.startsWith("data: ") && logEl) {
            logEl.textContent += line.slice(6) + "\n";
            logEl.scrollTop = logEl.scrollHeight;
          }
        }
      }
    } catch (err) {
      if (logEl) logEl.textContent += String(err.message || err) + "\n";
    }
  }

  function bindMakeActions(rootSelector) {
    document.querySelectorAll(`${rootSelector} [data-action=make-run]`).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-make-target");
        const logEl = document.getElementById("rail-make-log");
        runMakeTarget(target, logEl);
        if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
      });
    });
    document.querySelectorAll(`${rootSelector} [data-action=make-copy]`).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const cmd = btn.getAttribute("data-make-cmd") || "";
        try {
          await navigator.clipboard.writeText(cmd);
        } catch {
          window.prompt("Copy command:", cmd);
        }
        if (window.isPhoneChromeEl?.(btn)) window.dismissPhoneChromeAfterAction?.();
      });
    });
  }

  function renderMakeLeaf(c) {
    const action = c.type === "make-run" ? "make-run" : "make-copy";
    return `<li class="sidebar-item sidebar-item--command" data-id="${esc(c.id)}">
      <button type="button" class="sidebar-item-main sidebar-item-main--command" data-action="${action}" data-make-target="${esc(c._makeTarget)}" data-make-cmd="${esc(c._makeCmd)}" data-comet-tip="${esc(c.subtitle || c.title)}">
        <span class="sidebar-glyph-wrap sidebar-glyph-wrap--tile"><span class="sidebar-glyph">${esc(c.glyph)}</span></span>
        <span class="sidebar-label">${esc(c.title)}</span>
      </button>
    </li>`;
  }

  function buildHelpLeftRailSections() {
    return global.PockitHelpConsole?.buildLeftRailSections?.() || [];
  }

  function buildHelpRightRailSections(state = {}) {
    return global.PockitHelpConsole?.buildRightRailSections?.(state) || [];
  }

  global.PockitRailContext = {
    MODES,
    getMode,
    setMode,
    resolveEffectiveMode,
    railModeOptions,
    railModeLabel,
    discoverSections,
    ensureSectionIds,
    attachScrollspy,
    detachScrollspy,
    bindSectionJump,
    bindMakeActions,
    renderScrollspySectionHtml,
    renderMakeLeaf,
    commandToSidebarItem,
    sectionToSidebarItem,
    buildVoiceLeftRailSections,
    buildVoiceRightRailSections,
    buildVideoLeftRailSections,
    buildVideoRightRailSections,
    buildKnowledgeLeftRailSections,
    buildKnowledgeRightRailSections,
    buildHelpLeftRailSections,
    buildHelpRightRailSections,
    renderVoicePickerRailHtml,
    resolveMacAppCommands,
    resolveCassetteCommands,
    runMakeTarget,
    updateScrollspyHighlight,
    setOnSectionChange(fn) {
      onSectionChange = fn;
    },
  };
})(window);
