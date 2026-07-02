/**
 * Voice System Advisor — detect host hardware, stack health, and recommend route.
 */
(function (global) {
  "use strict";

  let cached = null;
  let cachedAt = 0;
  const TTL_MS = 30_000;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchJson(url, opts = {}) {
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "include", ...opts });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function uaHostHint() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const isMac = /Mac/i.test(platform) || /Macintosh/i.test(ua);
    const isIOS = /iPhone|iPad/i.test(ua);
    if (isIOS) return { kind: "ios", label: "iPhone / iPad", isLocalEdge: false };
    if (!isMac) return { kind: "remote", label: "Remote browser", isLocalEdge: false };
    if (/Apple Mac/i.test(ua) && /Mac OS X/i.test(ua)) {
      return { kind: "mac-unknown", label: "This Mac", isLocalEdge: true };
    }
    return { kind: "mac-unknown", label: "This Mac", isLocalEdge: true };
  }

  async function probe(force = false) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < TTL_MS) return cached;

    const host = uaHostHint();
    const [hw, health] = await Promise.all([
      fetchJson("http://127.0.0.1:9876/m5-hardware.json"),
      fetchJson("/api/v1/voice/health"),
    ]);

    const m5Healthy = Boolean(health?.m5_edge?.ok);
    const dgxHealthy = Boolean(health?.fish_speech?.ok);
    const sttHealthy = m5Healthy || Boolean(health?.whisper?.ok);
    const premiumAvailable = m5Healthy || dgxHealthy;

    let hostKind = host.kind;
    let hostLabel = host.label;
    let hostDetail = "";

    if (hw?.detected) {
      hostLabel = hw.detected;
      hostKind = /M5/i.test(hw.detected) ? "m5-mac" : "mac-edge";
      hostDetail = hw.summary || hw.chip || "";
    } else if (host.isLocalEdge && !m5Healthy) {
      hostKind = "mac-no-edge";
      hostLabel = "This Mac (no M5 edge)";
      hostDetail = "M5 voice edge services are not running locally — routing leans on DGX when reachable.";
    } else if (!host.isLocalEdge) {
      hostDetail = "You are not on the family M5 edge machine. Local Holler STT/TTS is unavailable here; DGX Spark carries voice work.";
    }

    cached = {
      hostKind,
      hostLabel,
      hostDetail,
      hw,
      health,
      m5Healthy,
      dgxHealthy,
      sttHealthy,
      premiumAvailable,
      isLocalEdge: host.isLocalEdge,
      probedAt: now,
    };
    cachedAt = now;
    return cached;
  }

  function recommendRoute(ctx, task = "conversation") {
    const c = ctx || cached || {};
    const taskNote = task === "prime" ? "Prime mode prefers DGX for deep RAG and largest models."
      : task === "read" ? "Read-aloud favors the lowest-latency TTS path."
      : "Conversation favors fast turn-around with premium speech when available.";

    if (c.m5Healthy && (c.hostKind === "m5-mac" || c.isLocalEdge)) {
      return {
        route: "m5",
        confidence: "high",
        headline: "M5 edge — best for this machine",
        reasonHtml: `<p><strong>${esc(c.hostLabel)}</strong> has Holler STT + TTS online. ${esc(taskNote)}</p>
          <p>Local edge keeps mic → reply loops on-device for Grok-class latency.</p>`,
      };
    }
    if (c.dgxHealthy) {
      const why = c.isLocalEdge
        ? "M5 edge is offline or warming — Spark premium stack is healthy."
        : `You opened Voice from <strong>${esc(c.hostLabel)}</strong> — only DGX is reachable from here.`;
      return {
        route: "dgx",
        confidence: c.m5Healthy ? "medium" : "high",
        headline: "DGX Spark — premium stack",
        reasonHtml: `<p>${why}</p><p>${esc(taskNote)} Full Kokoro / Spark-TTS roster when covenant engines are up.</p>`,
      };
    }
    if (c.sttHealthy) {
      return {
        route: "dgx",
        confidence: "low",
        headline: "Partial stack — DGX STT only",
        reasonHtml: `<p>Whisper STT is up but premium TTS may be text-only until Holler or Kokoro returns.</p>`,
      };
    }
    return {
      route: "browser",
      confidence: "low",
      headline: "Browser fallback",
      reasonHtml: `<p>Family voice stack is unreachable from <strong>${esc(c.hostLabel)}</strong>. Browser speech APIs are the only path until <code>make ensure-m5-voice</code> or DGX deploy completes.</p>`,
    };
  }

  async function buildAdvisorReport(opts = {}) {
    const ctx = await probe(opts.force);
    const st = global.ParakeetVoicePad?.getState?.() || {};
    const task = opts.task || (st.prime ? "prime" : st.mode === "read" ? "read" : "conversation");
    const rec = recommendRoute(ctx, task);
    const activeRoute = st.route || "auto";
    let effectiveRoute = activeRoute;
    if (activeRoute === "auto") effectiveRoute = rec.route;

    return {
      ...ctx,
      task,
      recommendation: rec,
      activeRoute,
      effectiveRoute,
      statusLine: buildStatusLine(ctx, st, rec, effectiveRoute),
    };
  }

  function buildStatusLine(ctx, st, rec, effectiveRoute) {
    const parts = [];
    parts.push(ctx.hostLabel);
    if (effectiveRoute === "m5") parts.push("M5 edge");
    else if (effectiveRoute === "dgx") parts.push("DGX");
    else if (effectiveRoute === "browser") parts.push("Browser");
    else parts.push("Auto");
    if (st.textOnly || ctx.premiumAvailable === false) parts.push("text-only");
    else if (ctx.m5Healthy && effectiveRoute === "m5") parts.push("Holler ready");
    else if (ctx.dgxHealthy) parts.push("Premium TTS");
    return parts.join(" · ");
  }

  async function applyAutoRouteIfNeeded() {
    const st = global.ParakeetVoicePad?.getState?.() || {};
    if (st.route && st.route !== "auto") return null;
    const report = await buildAdvisorReport();
    const route = report.recommendation.route;
    if (route === "browser") return report;
    global.ParakeetVoicePad?.dispatchControl?.({ route });
    return report;
  }

  global.VoiceSystemAdvisor = {
    probe,
    recommendRoute,
    buildAdvisorReport,
    applyAutoRouteIfNeeded,
  };
})(window);
