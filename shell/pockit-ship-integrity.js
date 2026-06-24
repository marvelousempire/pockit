/**
 * Pockit Ship Integrity — operator UI for check-ship-integrity gate + Spark SSH probe.
 */
(function () {
  const API = "/api/v1/ship-integrity";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const el = document.getElementById("ship-integrity-status");
    if (el) el.textContent = msg || "";
  }

  function renderRows(passes, issues) {
    const passRows = (passes || []).map(
      (p) => `<li class="ship-integrity-row ship-integrity-row--pass"><span class="ship-integrity-led" aria-hidden="true"></span><span>${escapeHtml(p)}</span></li>`,
    );
    const issueRows = (issues || []).map(
      (i) => `<li class="ship-integrity-row ship-integrity-row--fail"><span class="ship-integrity-led" aria-hidden="true"></span><span><strong>${escapeHtml(i.code)}</strong> — ${escapeHtml(i.message)}${i.fix ? `<em class="ship-integrity-fix">${escapeHtml(i.fix)}</em>` : ""}</span></li>`,
    );
    return [...passRows, ...issueRows].join("") || `<li class="ship-integrity-row">No results yet.</li>`;
  }

  function renderShell(report) {
    const summary = report?.summary || {};
    const ok = (report?.issues || []).length === 0;
    return `
      <div id="ship-integrity" class="ship-integrity">
        <header class="ship-integrity__hero">
          <h2 class="ship-integrity__title">Ship Integrity</h2>
          <p class="ship-integrity__lead">Catches operator pads that shipped but stayed invisible, missing tower-owned paths, broken runtime deps, and Spark tower-api drift (SSH → 127.0.0.1:8088).</p>
          <p class="ship-integrity__meta">
            <span class="ship-integrity-pill ${ok ? "is-ok" : "is-fail"}">${ok ? "GREEN" : "NEEDS FIX"}</span>
            <span>${summary.pass_count || 0} passed · ${summary.issue_count || 0} issues</span>
            ${summary.spark_host ? `<span>Spark: ${escapeHtml(summary.spark_host)} (${escapeHtml(summary.probe_mode || "")})</span>` : ""}
          </p>
          <p id="ship-integrity-status" class="ship-integrity__status" aria-live="polite"></p>
          <div class="ship-integrity__actions">
            <button type="button" class="comet-btn comet-btn--primary" id="ship-integrity-run">Run check</button>
            <code class="ship-integrity-cli">node scripts/check-ship-integrity.mjs --check --spark</code>
          </div>
        </header>
        <ul class="ship-integrity-list" id="ship-integrity-list">${renderRows(report?.passes, report?.issues)}</ul>
      </div>`;
  }

  async function runCheck() {
    setStatus("Running ship integrity (local + Spark SSH)…");
    const res = await fetch(`${API}?spark=1&local=1`, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const report = await res.json();
    const list = document.getElementById("ship-integrity-list");
    const root = document.getElementById("ship-integrity");
    if (root) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderShell(report);
      const fresh = tmp.firstElementChild;
      root.replaceWith(fresh);
      bind();
    } else if (list) {
      list.innerHTML = renderRows(report.passes, report.issues);
    }
    setStatus(report.ok ? "All checks passed." : `${report.issues?.length || 0} issue(s) — see list.`);
    return report;
  }

  function bind() {
    document.getElementById("ship-integrity-run")?.addEventListener("click", () => {
      runCheck().catch((e) => setStatus(e.message || String(e)));
    });
  }

  function render() {
    return renderShell({ passes: [], issues: [], summary: {} });
  }

  window.PockitShipIntegrity = { render, bind, runCheck };
})();
