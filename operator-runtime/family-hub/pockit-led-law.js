/** Pockit LED Law — canonical 5-state status legend for all surfaces. */
(function (global) {
  const LAW = {
    red: {
      id: "red",
      label: "Not installed",
      short: "Missing",
      detail: "Artifact or service package is not present on this host or in the repo.",
    },
    orange: {
      id: "orange",
      label: "Installed · not wired",
      short: "Unwired",
      detail: "Shipped on disk but not connected to the live pipeline or route.",
    },
    yellow: {
      id: "yellow",
      label: "Wired · not started",
      short: "Stopped",
      detail: "Connected in code; dependency is down or the process has not been started.",
    },
    blue: {
      id: "blue",
      label: "Ready to start",
      short: "Ready",
      detail: "Wired and healthy — operator can start or enable with one action.",
    },
    green: {
      id: "green",
      label: "Started · active",
      short: "Active",
      detail: "Live probe passed; running in the production path right now.",
    },
  };

  const ORDER = ["red", "orange", "yellow", "blue", "green"];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tipText() {
    return ORDER.map((k) => `${LAW[k].label} — ${LAW[k].detail}`).join("\n");
  }

  /**
   * @param {{ compact?: boolean, title?: string, className?: string }} [opts]
   */
  function renderLegend(opts = {}) {
    const title = opts.title ?? "LED law";
    const cls = opts.className ?? "pockit-led-law";
    const compact = opts.compact === true;
    const tip = tipText();
    const items = ORDER.map((k) => {
      const item = LAW[k];
      const short = compact ? item.short : item.label;
      return `<span class="${cls}__item"><span class="${cls}__dot ${cls}__dot--${k}" aria-hidden="true"></span><span class="${cls}__label">${esc(short)}</span></span>`;
    }).join("");
    return `<div class="${cls}" role="doc-glossary" aria-label="Pockit LED status law" data-comet-tip="${esc(tip)}">
      <span class="${cls}__title">${esc(title)}</span>
      ${items}
    </div>`;
  }

  function renderLedDot(state, { title, className } = {}) {
    const k = LAW[state] ? state : "yellow";
    const cls = className || "pockit-led-law__dot";
    const tip = title || LAW[k].label;
    return `<span class="${cls} ${cls}--${k}" role="img" aria-label="${esc(tip)}" title="${esc(tip)}"></span>`;
  }

  function mapLegacyPillState(state) {
    const s = String(state || "").toLowerCase();
    if (s === "ok" || s === "active" && false) return "green";
    if (s === "ok") return "green";
    if (s === "active") return "blue";
    if (s === "warn" || s === "degraded") return "orange";
    if (s === "bad" || s === "offline" || s === "fail") return "red";
    if (s === "pending" || s === "running") return "yellow";
    return "yellow";
  }

  global.PockitLedLaw = {
    LAW,
    ORDER,
    tipText,
    renderLegend,
    renderLedDot,
    mapLegacyPillState,
  };
})(typeof window !== "undefined" ? window : globalThis);
