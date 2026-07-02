/**
 * Browser bundle — generated; do not edit by hand.
 * Run: node scripts/build-pockit-changelog-render.mjs
 */
(function (g) {
/**
 * Pockit changelog markdown → accordion HTML (Plan 0273 / 0288).
 * Canonical renderer — sync browser bundle via scripts/build-pockit-changelog-render.mjs
 */

/** @type {Record<string, { label: string, icon: string }>} */
const CHANGELOG_KINDS = {
  added: { label: "Added", icon: "plus" },
  changed: { label: "Changed", icon: "pencil" },
  fixed: { label: "Fixed", icon: "wrench" },
  bug: { label: "Bug", icon: "bug" },
  security: { label: "Security", icon: "shield" },
  removed: { label: "Removed", icon: "trash" },
  deferred: { label: "Deferred", icon: "clock" },
  "in-progress": { label: "In progress", icon: "hourglass" },
  issue: { label: "Issue", icon: "alert" },
  shipped: { label: "Shipped", icon: "check" },
  "root-cause": { label: "Root cause", icon: "search" },
};

const KIND_ICONS = {
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  pencil:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5zM10 4l2 2"/></svg>',
  wrench:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11.2 2.8a3.2 3.2 0 00-4.3 4.3L2 12v2h2l4.9-4.9a3.2 3.2 0 004.3-4.3z"/></svg>',
  bug: '<svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="8" cy="9" rx="4" ry="3" fill="currentColor"/><path fill="currentColor" d="M8 2v2M5 3l1 1M11 3l-1 1M3 8H1M15 8h-2M4 12l-1 1M13 12l1 1"/></svg>',
  shield:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1l6 2v5c0 3.5-2.5 5.5-6 7-3.5-1.5-6-3.5-6-7V3l6-2z"/></svg>',
  trash:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 2h4l1 1h3v2H2V3h3l1-1zM3 6h10l-1 8H4L3 6z"/></svg>',
  clock:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path fill="currentColor" d="M8 4.5V8l2.5 1.5"/></svg>',
  hourglass:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8v2L8 8l4 4v2H4v-2l4-4-4-4V2z"/></svg>',
  alert:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1L1 14h14L8 1zm0 4v4M8 11v1"/></svg>',
  check:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3 8l3 3 7-7"/></svg>',
  search:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path fill="currentColor" d="M10 10l4 4"/></svg>',
};

const RELEASE_KINDS =
  "Added|Changed|Fixed|Security|Removed|Deferred|In progress|Bug|Issue|Shipped|Root cause";

const CLINIC_HEADINGS = [
  { re: /^🔴\s*Issue\s*[—–-]\s*(.+)$/i, kind: "issue" },
  { re: /^🟢\s*Shipped\s*[—–-]\s*(.+)$/i, kind: "shipped" },
  { re: /^🔴\s*Root cause\s*[—–-]\s*(.+)$/i, kind: "root-cause" },
  { re: /^🟢\s*Fix\s*[—–-]\s*(.+)$/i, kind: "fixed" },
  { re: /^🔴\s*Issue$/i, kind: "issue", title: "" },
  { re: /^🟢\s*Shipped$/i, kind: "shipped", title: "" },
  { re: /^🔴\s*Root cause$/i, kind: "root-cause", title: "" },
  { re: /^🟢\s*Fix$/i, kind: "fixed", title: "" },
];

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {string} s */
function inlineMd(s) {
  return String(s)
    .split(/(`[^`]+`)/g)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      let chunk = escapeHtml(part);
      chunk = chunk.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      chunk = chunk.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );
      return chunk;
    })
    .join("");
}

/** @param {string} ts */
function formatChangelogTimestamp(ts) {
  const raw = String(ts || "").trim();
  if (!raw) return raw;
  // Never invent seconds. Strip author placeholder :00 when no real sub-minute precision.
  return raw.replace(/\bat\s+(\d{1,2}):(\d{2}):00\s+(AM|PM)\b/i, "at $1:$2 $3");
}

/** Entry title must state the operator expectation or problem (not the shipped fix). */
function isExpectationTitle(title) {
  const t = String(title || "").trim();
  if (!t) return false;
  if (/^expect\b/i.test(t)) return true;
  if (/^problem:/i.test(t)) return true;
  if (/\b(should|must)\b/i.test(t)) return true;
  if (/\?\s*$/.test(t)) return true;
  return false;
}

/** Kind badge legend for changelog modal header (RL-POCKIT-CHANGELOG-001). */
function renderChangelogKindLegend() {
  const order = [
    "added",
    "changed",
    "fixed",
    "bug",
    "security",
    "removed",
    "deferred",
    "in-progress",
    "issue",
    "shipped",
    "root-cause",
  ];
  const parts = order.map((key) => renderKindBadge(key, { compact: true }));
  return `<div class="pad-changelog-kind-legend" role="note" aria-label="Changelog kind legend"><span class="pad-changelog-kind-legend-label">Kinds</span>${parts.join("")}</div>`;
}

function parseChangelogVersionTail(rest) {
  const m = rest.match(/^[—–-]\s*(.+?)\s*·\s*\*([^*]+)\*\s*$/);
  if (m) return { ts: formatChangelogTimestamp(m[1].trim()), title: m[2].trim() };
  const plain = rest.replace(/^[—–-\s]+/, "").trim();
  return { ts: formatChangelogTimestamp(plain), title: "" };
}

/** Spreadsheet-style letter for line index: 1→a, 26→z, 27→aa */
function lineIdLetter(index) {
  let n = Math.max(1, Number(index) || 1);
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** @param {string} version semver from ## [version] */
function formatLineId(version, index) {
  const v = String(version || "").trim();
  return `${v}.${lineIdLetter(index)}`;
}

const LINE_ID_RE = /^(\d+\.\d+\.\d+)\.([a-z]+)$/i;

function parseExplicitLineId(text) {
  const m = String(text || "").trim().match(LINE_ID_RE);
  if (!m) return null;
  return { version: m[1], letter: m[2].toLowerCase(), full: `${m[1]}.${m[2].toLowerCase()}` };
}

/** @param {string} kind */
function renderKindBadge(kind, opts = {}) {
  const key = String(kind || "").toLowerCase().replace(/\s+/g, "-");
  const meta = CHANGELOG_KINDS[key] || { label: key.replace(/-/g, " "), icon: "plus" };
  const icon = KIND_ICONS[meta.icon] || KIND_ICONS.plus;
  const compact = opts.compact ? " pad-cl-kind--compact" : "";
  return `<span class="pad-cl-kind pad-cl-kind--${escapeHtml(key)}${compact}"><span class="pad-cl-kind-icon">${icon}</span><span class="pad-cl-kind-label">${escapeHtml(meta.label)}</span></span>`;
}

function parseReleaseHeading(body) {
  for (const clinic of CLINIC_HEADINGS) {
    const cm = body.match(clinic.re);
    if (cm) {
      let title = cm[1] !== undefined ? cm[1].trim() : clinic.title || "";
      let verChip = "";
      const verM = title.match(/\((v\d[\d.]*)\)\s*$/);
      if (verM) {
        verChip = verM[1];
        title = title.replace(/\s*\(v\d[\d.]*\)\s*$/, "").trim();
      }
      return { kind: clinic.kind, title, verChip, extraKinds: [] };
    }
  }

  const bare = body.match(new RegExp(`^(${RELEASE_KINDS})$`, "i"));
  if (bare) {
    const kind = bare[1].toLowerCase().replace(/\s+/g, "-");
    return { kind: kind === "bug" ? "fixed" : kind, title: "", verChip: "", extraKinds: kind === "bug" ? ["bug"] : [] };
  }

  const m = body.match(new RegExp(`^(${RELEASE_KINDS})\\s*[—–-]\\s*(.+)$`, "i"));
  if (!m) return null;

  let kind = m[1].toLowerCase().replace(/\s+/g, "-");
  const extraKinds = [];
  if (kind === "bug") {
    kind = "fixed";
    extraKinds.push("bug");
  }

  let title = m[2].trim();
  let verChip = "";
  const verM = title.match(/\((v\d[\d.]*)\)\s*$/);
  if (verM) {
    verChip = verM[1];
    title = title.replace(/\s*\(v\d[\d.]*\)\s*$/, "").trim();
  }
  return { kind, title, verChip, extraKinds };
}

function renderReleaseHead(release) {
  const parts = [
    '<section class="pad-cl-release">',
    '<header class="pad-cl-release-head">',
    renderKindBadge(release.kind),
  ];
  for (const ek of release.extraKinds || []) {
    if (ek !== release.kind) parts.push(renderKindBadge(ek));
  }
  if (release.title) {
    parts.push(`<span class="pad-cl-release-title">${inlineMd(release.title)}</span>`);
  }
  if (release.verChip) {
    parts.push('<span class="pad-cl-ver-group">');
    parts.push(`<span class="pad-cl-ver pad-cl-ver--chip">${escapeHtml(release.verChip)}</span>`);
    parts.push("</span>");
  }
  parts.push("</header>");
  return parts.join("\n");
}

/**
 * @param {string} line list item body (no bullet)
 * @param {{ version?: string, index?: number, sectionKind?: string }} ctx
 */
function renderListItem(line, ctx = {}) {
  const raw = String(line || "").trim();
  const tagKinds = [];
  let body = raw.replace(/\s*\[(bug|security|added|changed|fixed|removed)\]\s*$/gi, (_m, k) => {
    tagKinds.push(String(k).toLowerCase());
    return "";
  });

  let entryId = "";
  let title = "";
  let detail = body;

  const idTitle = body.match(/^\*\*(\d+\.\d+\.\d+\.[a-z]+)\*\*\s*(.+)$/i);
  if (idTitle) {
    const parsed = parseExplicitLineId(idTitle[1]);
    if (parsed) entryId = parsed.full;
    body = idTitle[2];
  }

  const boldSplit = body.match(/^\*\*([^*]+)\*\*\s*[—–-]\s*(.*)$/);
  if (boldSplit) {
    if (!entryId) {
      const parsed = parseExplicitLineId(boldSplit[1].trim());
      if (parsed) {
        entryId = parsed.full;
        const rest = boldSplit[2].trim();
        const titleSplit = rest.match(/^(.+?)\s*[—–-]\s*(.*)$/);
        if (titleSplit) {
          title = titleSplit[1].trim();
          detail = titleSplit[2].trim();
        } else {
          title = rest;
          detail = "";
        }
      } else {
        title = boldSplit[1].trim();
        detail = boldSplit[2].trim();
      }
    } else {
      const rest = boldSplit[2].trim();
      const titleSplit = rest.match(/^(.+?)\s*[—–-]\s*(.*)$/);
      if (titleSplit) {
        title = titleSplit[1].trim();
        detail = titleSplit[2].trim();
      } else {
        title = boldSplit[1].trim();
        detail = boldSplit[2].trim();
      }
    }
  } else if (!entryId) {
    detail = body;
  }

  if (entryId && !title && body) {
    const dash = body.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    if (dash) {
      title = dash[1].trim();
      detail = dash[2].trim();
    } else {
      detail = body;
    }
  }

  if (!entryId && ctx.version && ctx.index != null) {
    entryId = formatLineId(ctx.version, ctx.index);
  }

  const badges = [];
  for (const tk of tagKinds) {
    if (tk !== ctx.sectionKind && !badges.includes(tk)) badges.push(tk);
  }

  const parts = ['<li class="pad-cl-entry">'];
  if (entryId) parts.push(`<span class="pad-cl-entry-id">${escapeHtml(entryId)}</span>`);
  if (badges.length) {
    parts.push('<span class="pad-cl-entry-badges">');
    for (const b of badges) parts.push(renderKindBadge(b, { compact: true }));
    parts.push("</span>");
  }
  if (title) parts.push(`<strong class="pad-cl-entry-title">${inlineMd(title)}</strong>`);
  if (detail) parts.push(`<span class="pad-cl-entry-body">${inlineMd(detail)}</span>`);
  if (!title && !detail && body) parts.push(`<span class="pad-cl-entry-body">${inlineMd(body)}</span>`);
  parts.push("</li>");
  return parts.join("");
}

/** @param {string} md */
function renderChangelogMarkdown(md) {
  const lines = String(md || "").split("\n");
  const out = [];
  let inCode = false;
  let inList = false;
  let inVersion = false;
  let inRelease = false;
  let versionCount = 0;
  let openedAccordionStack = false;
  let currentVersion = "";
  let versionLineIndex = 0;
  let currentSectionKind = "";
  let inVersionContent = false;
  const codeBuf = [];

  function flushList() {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  }
  function closeRelease() {
    if (inRelease) {
      out.push("</section>");
      inRelease = false;
      currentSectionKind = "";
    }
  }
  function closeVersionContent() {
    if (inVersionContent) {
      out.push("</div></div></details>");
      inVersionContent = false;
      inVersion = false;
    }
  }
  function closeVersion() {
    closeRelease();
    flushList();
    closeVersionContent();
  }
  function flushCode() {
    if (inCode) {
      out.push(`<pre class="pad-cl-pre"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
      codeBuf.length = 0;
      inCode = false;
    }
  }

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      flushList();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const versionMatch = trimmed.match(/^##\s+\[([^\]]+)\](.*)$/);
    if (versionMatch) {
      flushList();
      closeVersion();
      if (!openedAccordionStack) {
        out.push('<div class="pad-cl-accordion-stack">');
        openedAccordionStack = true;
      }
      inVersion = true;
      inVersionContent = true;
      currentVersion = versionMatch[1];
      versionLineIndex = 0;
      const { ts, title } = parseChangelogVersionTail(versionMatch[2].trim());
      const openAttr = versionCount === 0 ? " open" : "";
      versionCount += 1;
      out.push(`<details class="pad-cl-accordion"${openAttr}>`);
      out.push('<summary class="pad-cl-accordion-summary">');
      out.push(`<span class="pad-cl-ver">v${escapeHtml(currentVersion)}</span>`);
      out.push('<div class="pad-cl-accordion-summary-content">');
      if (ts) out.push(`<time class="pad-cl-ts" datetime="${escapeHtml(ts)}">${escapeHtml(ts)}</time>`);
      if (title) out.push(`<span class="pad-cl-accordion-title">${escapeHtml(title)}</span>`);
      out.push("</div>");
      out.push('<span class="pad-cl-accordion-chevron" aria-hidden="true"></span>');
      out.push("</summary>");
      out.push('<div class="pad-cl-accordion-body">');
      out.push('<div class="pad-cl-version-content">');
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const release = parseReleaseHeading(trimmed.slice(4));
      if (release) {
        flushList();
        closeRelease();
        inRelease = true;
        currentSectionKind = release.kind;
        out.push(renderReleaseHead(release));
        continue;
      }
      flushList();
      out.push(`<h3 class="pad-cl-h3">${inlineMd(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      closeVersion();
      out.push(`<h2 class="pad-cl-h2">${inlineMd(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) continue;

    if (trimmed.startsWith("> ")) {
      flushList();
      const quoteBody = trimmed.slice(2);
      const isLook = /what to look for/i.test(quoteBody);
      if (isLook) {
        out.push('<blockquote class="pad-cl-quote pad-cl-quote--look">');
        out.push('<span class="pad-cl-look-label">What to look for</span>');
        out.push(inlineMd(quoteBody.replace(/^\*\*What to look for:\*\*\s*/i, "")));
        out.push("</blockquote>");
      } else {
        out.push(`<blockquote class="pad-cl-quote">${inlineMd(quoteBody)}</blockquote>`);
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        out.push('<ul class="pad-cl-ul">');
        inList = true;
      }
      versionLineIndex += 1;
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      out.push(
        renderListItem(itemText, {
          version: currentVersion,
          index: versionLineIndex,
          sectionKind: currentSectionKind,
        }),
      );
      continue;
    }

    if (trimmed === "---") {
      flushList();
      out.push('<hr class="pad-cl-hr" />');
      continue;
    }

    flushList();
    out.push(`<p class="pad-cl-p">${inlineMd(trimmed)}</p>`);
  }
  flushList();
  flushCode();
  closeVersion();
  if (openedAccordionStack) out.push("</div>");
  return out.join("\n");
}



function parseLatestChangelogVersion(md) {
  const text = String(md || "");
  const lines = text.split("\n");
  for (const line of lines) {
    const m = line.trim().match(/^##\s+\[([^\]]+)\]/);
    if (m) return m[1].trim();
  }
  return null;
}

  g.PockitChangelogRender = {
    CHANGELOG_KINDS,
    escapeHtml,
    inlineMd,
    formatChangelogTimestamp,
    isExpectationTitle,
    parseChangelogVersionTail,
    lineIdLetter,
    formatLineId,
    parseReleaseHeading,
    renderKindBadge,
    renderChangelogKindLegend,
    renderReleaseHead,
    renderListItem,
    renderChangelogMarkdown,
    parseLatestChangelogVersion,
  };
})(globalThis);
