/**
 * Pockit Family Wealth Desk — net worth, allocation, cash flow (Plan 0472 Phase B).
 */
(function () {
  const API = "/api/v1/family-wealth/desk";
  let charts = [];

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function destroyCharts() {
    for (const c of charts) {
      try {
        c.destroy?.();
      } catch {
        /* ignore */
      }
    }
    charts = [];
  }

  function renderAllocationBars(allocation) {
    return (allocation || [])
      .map(
        (a) => `
      <div class="family-desk-alloc-row">
        <div class="family-desk-alloc-label"><span>${escapeHtml(a.label)}</span><span>${a.pct}%</span></div>
        <div class="family-desk-alloc-bar"><span style="width:${a.pct}%"></span></div>
        <div class="family-desk-alloc-value">${fmtMoney(a.value)}</div>
      </div>`,
      )
      .join("");
  }

  function renderEntityFilter(entities, active) {
    const opts = [
      `<option value="">All entities</option>`,
      ...(entities || []).map(
        (e) => `<option value="${escapeHtml(e.slug)}"${active === e.slug ? " selected" : ""}>${escapeHtml(e.display_name)}</option>`,
      ),
    ];
    return `<label class="family-desk-filter">Entity <select id="family-desk-entity-filter">${opts.join("")}</select></label>`;
  }

  function renderShell(data) {
    const nw = data?.net_worth?.current || 0;
    const outbox = data?.outbox_stats?.total || 0;
    return `
      <div id="family-desk" class="family-desk">
        <header class="family-desk__hero">
          <h2 class="family-desk__title">Family Wealth Desk</h2>
          <p class="family-desk__lead">Trust spine home — net worth, allocation, and cash flow across FOP entities. Bank Reader is the finance cartridge; SME drains the event outbox.</p>
          <p class="family-desk__meta">
            <span class="family-desk-pill is-ok">INT-0024</span>
            <span>Net worth <strong>${fmtMoney(nw)}</strong></span>
            <span>Outbox events <strong>${outbox}</strong></span>
            ${renderEntityFilter(data?.entities, "")}
          </p>
        </header>
        <div class="family-desk__grid">
          <section class="family-desk-card family-desk-card--wide">
            <h3>Net worth</h3>
            <div id="family-desk-networth-chart" class="family-desk-chart" aria-label="Net worth area chart"></div>
          </section>
          <section class="family-desk-card">
            <h3>Allocation</h3>
            <div class="family-desk-alloc-list">${renderAllocationBars(data?.allocation)}</div>
          </section>
          <section class="family-desk-card family-desk-card--wide">
            <h3>Cash flow (6 mo)</h3>
            <div id="family-desk-cashflow-chart" class="family-desk-chart family-desk-chart--short" aria-label="Cash flow histogram"></div>
          </section>
          <section class="family-desk-card">
            <h3>Entities</h3>
            <ul class="family-desk-entity-list">
              ${(data?.entities || [])
                .slice(0, 8)
                .map(
                  (e) =>
                    `<li><span>${escapeHtml(e.display_name)}</span><em>${escapeHtml(e.status || "")}</em></li>`,
                )
                .join("") || "<li>No entities mapped yet.</li>"}
            </ul>
            <a class="family-desk-link" href="http://bank-reader.localhost/" target="_blank" rel="noopener">Open Bank Reader →</a>
          </section>
        </div>
      </div>`;
  }

  function paintCharts(data) {
    destroyCharts();
    const FWC = window.FamilyWealthCharts;
    if (!FWC) return;
    const nwEl = document.getElementById("family-desk-networth-chart");
    if (nwEl && data?.net_worth?.series?.length) {
      const r = FWC.createAreaChart(nwEl, data.net_worth.series, { lineColor: "#10b981" });
      if (r?.destroy) charts.push(r);
    }
    const cfEl = document.getElementById("family-desk-cashflow-chart");
    if (cfEl && data?.cash_flow?.length) {
      const bars = data.cash_flow.map((m, i) => ({
        time: `2026-0${(i % 9) + 1}-15`,
        value: m.net,
      }));
      const r = FWC.createHistogramChart(cfEl, bars, { color: "#3b82f6" });
      if (r?.destroy) charts.push(r);
    }
  }

  async function refresh() {
    const res = await fetch(API, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const root = document.getElementById("family-desk");
    if (root) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderShell(data);
      const fresh = tmp.firstElementChild;
      root.replaceWith(fresh);
      bind();
      paintCharts(data);
    }
    return data;
  }

  function bind() {
    document.getElementById("family-desk-entity-filter")?.addEventListener("change", () => {
      refresh().catch(() => {});
    });
  }

  function render() {
    return renderShell({ entities: [], allocation: [], net_worth: { current: 0, series: [] }, cash_flow: [] });
  }

  window.PockitFamilyDesk = { render, bind, refresh, destroyCharts };
})();