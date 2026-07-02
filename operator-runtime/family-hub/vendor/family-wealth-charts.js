/**
 * Browser bridge — requires global LightweightCharts from vendored standalone build.
 * Served as family-wealth-charts.js on Pockit + Bank Reader (no CDN).
 */
(function () {
  const LC = typeof window !== "undefined" ? window.LightweightCharts : null;

  function isDark() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function chartOptions(width, height) {
    const dark = isDark();
    return {
      width: width || 640,
      height: height || 280,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: dark ? "#94a3b8" : "#475569",
      },
      grid: {
        vertLines: { color: dark ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.15)" },
        horzLines: { color: dark ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.15)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    };
  }

  function missing() {
    return { ok: false, reason: "LightweightCharts vendor not loaded" };
  }

  function createOhlcChart(container, candles, opts) {
    if (!LC || !container) return missing();
    const chart = LC.createChart(container, chartOptions(opts?.width, opts?.height));
    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    if (Array.isArray(candles) && candles.length) series.setData(candles);
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const w = container.clientWidth || opts?.width || 640;
          chart.applyOptions({ width: w });
        })
      : null;
    ro?.observe(container);
    return {
      ok: true,
      chart,
      series,
      destroy() {
        ro?.disconnect();
        chart.remove();
      },
    };
  }

  function createAreaChart(container, points, opts) {
    if (!LC || !container) return missing();
    const chart = LC.createChart(container, chartOptions(opts?.width, opts?.height));
    const series = chart.addAreaSeries({
      lineColor: opts?.lineColor || "#3b82f6",
      topColor: opts?.topColor || "rgba(59, 130, 246, 0.35)",
      bottomColor: opts?.bottomColor || "rgba(59, 130, 246, 0.02)",
      lineWidth: 2,
    });
    if (Array.isArray(points) && points.length) series.setData(points);
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const w = container.clientWidth || opts?.width || 640;
          chart.applyOptions({ width: w });
        })
      : null;
    ro?.observe(container);
    return {
      ok: true,
      chart,
      series,
      destroy() {
        ro?.disconnect();
        chart.remove();
      },
    };
  }

  function createHistogramChart(container, bars, opts) {
    if (!LC || !container) return missing();
    const chart = LC.createChart(container, chartOptions(opts?.width, opts?.height || 200));
    const series = chart.addHistogramSeries({
      color: opts?.color || "#8b5cf6",
      priceFormat: { type: "volume" },
    });
    const data = (bars || []).map((b, i) => ({
      time: b.time || `2026-0${(i % 9) + 1}-01`,
      value: b.value ?? b.amount ?? 0,
      color: (b.value ?? b.amount ?? 0) >= 0 ? "#10b981" : "#ef4444",
    }));
    if (data.length) series.setData(data);
    return { ok: true, chart, series, destroy: () => chart.remove() };
  }

  window.FamilyWealthCharts = {
    CHART_ENGINE: { markets: "lightweight-charts", status: "ready" },
    createOhlcChart,
    createAreaChart,
    createHistogramChart,
  };
})();