/**
 * Super Rick Video Pad — ops console + workspace embed (Plan 0431 slice 2).
 */
(function (global) {
  const STORAGE_KEY = "nephew-video-pad-v1";
  const WORKSPACE_URL = "http://127.0.0.1:8820/?pockit_hud=1";

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function savePrefs(partial) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPrefs(), ...partial })); }
    catch { /* ignore */ }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    return `
    <div id="video-pad" class="video-pad video-pad-center cotton-ball-settle">
      <header class="video-hero">
        <h2 class="video-title">Super Rick Video</h2>
        <p class="video-subtitle">Cinematic local generation · Mac drafts + DGX finals · <a href="#/c/voice">Voice</a></p>
        <span class="video-sovereign-badge">Wan / HunyuanVideo · ComfyUI · HLS + WebRTC preview</span>
      </header>

      <div id="video-handoff-banner" class="video-handoff-banner hidden" role="status"></div>

      <div class="video-workspace-wrap">
        <iframe id="video-workspace-embed" class="video-workspace-embed" title="Cinematic workspace"
          src="${esc(WORKSPACE_URL)}" loading="lazy"></iframe>
      </div>

      <div class="video-controls">
        <label class="video-label" for="video-prompt">Prompt</label>
        <textarea id="video-prompt" class="video-prompt" rows="3" placeholder="Describe the shot…"></textarea>
        <div class="video-control-row" role="group" aria-label="Route">
          <span class="video-control-label">Route</span>
          <button type="button" class="video-btn video-route-btn is-active" data-video-route="auto">Auto</button>
          <button type="button" class="video-btn video-route-btn" data-video-route="mac">Mac draft</button>
          <button type="button" class="video-btn video-route-btn" data-video-route="dgx">DGX final</button>
        </div>
        <div class="video-control-row" role="group" aria-label="Stream">
          <span class="video-control-label">Stream</span>
          <button type="button" class="video-btn video-stream-btn is-active" data-video-stream="hls">HLS</button>
          <button type="button" class="video-btn video-stream-btn" data-video-stream="webrtc">WebRTC</button>
        </div>
        <div class="video-action-row">
          <button type="button" id="video-render-btn" class="video-btn video-btn--primary">Render</button>
          <button type="button" id="video-status-refresh" class="video-btn">Refresh status</button>
          <a class="video-btn video-link-btn" href="http://video.localhost/super-rick" target="_blank" rel="noopener">COMP bridge</a>
        </div>
      </div>

      <pre id="video-job-log" class="video-job-log" aria-live="polite">Checking video stack…</pre>
      <div class="video-status" id="video-status">Idle</div>
    </div>`;
  }

  const padApi = { render, bind };

  async function towerPost(path, body) {
    const r = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function towerGet(path) {
    const r = await fetch(path, { credentials: "include" });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data };
  }

  function bind() {
    const root = document.getElementById("video-pad");
    if (!root || root.dataset.videoBound === "1") return;
    root.dataset.videoBound = "1";

    const prefs = loadPrefs();
    let videoRoute = prefs.route || "auto";
    let streamMode = prefs.stream || "hls";
    let activeJobId = prefs.jobId || "";

    const promptEl = document.getElementById("video-prompt");
    const statusEl = document.getElementById("video-status");
    const logEl = document.getElementById("video-job-log");
    const handoffBanner = document.getElementById("video-handoff-banner");
    const renderBtn = document.getElementById("video-render-btn");
    const refreshBtn = document.getElementById("video-status-refresh");

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
    }

    function setLog(obj) {
      if (logEl) logEl.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    }

    function highlightRoute() {
      root.querySelectorAll("[data-video-route]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-video-route") === videoRoute);
      });
      root.querySelectorAll("[data-video-stream]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-video-stream") === streamMode);
      });
    }

    root.querySelectorAll("[data-video-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        videoRoute = btn.getAttribute("data-video-route") || "auto";
        savePrefs({ route: videoRoute });
        highlightRoute();
        padApi.notifyState?.();
      });
    });

    root.querySelectorAll("[data-video-stream]").forEach((btn) => {
      btn.addEventListener("click", () => {
        streamMode = btn.getAttribute("data-video-stream") || "hls";
        savePrefs({ stream: streamMode });
        highlightRoute();
        padApi.notifyState?.();
      });
    });

    async function refreshJob(jobId) {
      if (!jobId) return;
      const { ok, data } = await towerGet(`/api/v1/video/jobs/${encodeURIComponent(jobId)}`);
      if (ok && data.job) setLog(data.job);
    }

    async function runRender(handoffPayload) {
      setStatus("Submitting render…");
      const body = handoffPayload || {
        prompt: promptEl?.value || "",
        route: videoRoute,
        stream_mode: streamMode,
        request_4k: false,
      };
      const { ok, data } = await towerPost("/api/v1/video/render", body);
      if (!ok) {
        setStatus(data.error || "Render failed");
        setLog(data);
        return;
      }
      activeJobId = data.job_id || "";
      savePrefs({ jobId: activeJobId });
      setStatus(`Queued · ${activeJobId}`);
      setLog(data);
      padApi.notifyState?.();
    }

    renderBtn?.addEventListener("click", () => runRender());

    refreshBtn?.addEventListener("click", async () => {
      const health = await towerGet("/api/v1/video/health");
      if (activeJobId) await refreshJob(activeJobId);
      else setLog(health.data);
      setStatus(health.data?.ok ? "Stack healthy" : "Stack degraded");
      padApi.notifyState?.();
    });

    const params = new URLSearchParams(location.hash.split("?")[1] || location.search.replace(/^\?/, ""));
    const handoffId = params.get("handoff") || params.get("job");
    if (handoffId) {
      activeJobId = handoffId;
      savePrefs({ jobId: handoffId });
      if (handoffBanner) {
        handoffBanner.classList.remove("hidden");
        handoffBanner.textContent = `Voice handoff loaded — job ${handoffId}`;
      }
      refreshJob(handoffId);
    }

    towerGet("/api/v1/video/super-rick/status").then(({ data }) => {
      setLog(data);
      setStatus(data?.pipeline?.comfyui?.ok ? "ComfyUI reachable" : "ComfyUI gate — start cassette or set COMFYUI_URL");
      padApi.notifyState?.();
    }).catch(() => setStatus("tower-api offline"));

    highlightRoute();

    padApi.getState = () => ({
      route: videoRoute,
      stream: streamMode,
      jobId: activeJobId,
      ready: true,
    });

    padApi.notifyState = () => {
      try { window.dispatchEvent(new CustomEvent("video-pad-state", { detail: padApi.getState() })); }
      catch { /* ignore */ }
    };
  }

  global.ParakeetVideoPad = padApi;
  global.VideoPad = padApi;
})(typeof window !== "undefined" ? window : globalThis);
