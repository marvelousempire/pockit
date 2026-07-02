/**
 * Odysseus Encompass Pad — native chat center (Plan 0268).
 * API via same-origin /family-embed/odysseus/api/* — no iframe.
 */
(function () {
  const API = "/family-embed/odysseus";
  const STORAGE_KEY = "nephew-odysseus-pad-v1";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveState(partial) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadState(), ...partial })); }
    catch { /* ignore */ }
  }

  function render() {
    return `
    <div id="odysseus-pad" class="odysseus-pad pockit-center-canvas--native cotton-ball-settle">
      <header class="odysseus-pad__hero">
        <h2 class="odysseus-pad__title">Odysseus</h2>
        <p class="odysseus-pad__subtitle">Family chat · fleet RAG unchanged ·
          <a class="odysseus-pad__speakers" href="http://odysseus.localhost/" target="_blank" rel="noopener noreferrer">Open full app ↗</a>
        </p>
      </header>
      <div id="odysseus-log" class="odysseus-pad__log" aria-live="polite">
        <p class="odysseus-pad__empty">Ask Odysseus anything — replies stream here instantly.</p>
      </div>
      <form id="odysseus-compose" class="odysseus-pad__compose">
        <textarea id="odysseus-input" class="odysseus-pad__input" rows="2" placeholder="Message Odysseus…"></textarea>
        <div class="odysseus-pad__actions">
          <select id="odysseus-model" class="odysseus-pad__model" aria-label="Model">
            <option value="">Default model</option>
          </select>
          <button type="submit" id="odysseus-send" class="odysseus-pad__send">Send</button>
        </div>
      </form>
      <footer class="odysseus-pad__status" id="odysseus-status">Checking Odysseus…</footer>
    </div>`;
  }

  function appendBubble(role, text) {
    const log = document.getElementById("odysseus-log");
    if (!log) return null;
    const empty = log.querySelector(".odysseus-pad__empty");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = `odysseus-pad__msg odysseus-pad__msg--${role}`;
    row.innerHTML = `<span class="odysseus-pad__role">${role === "user" ? "You" : "Odysseus"}</span><div class="odysseus-pad__text"></div>`;
    row.querySelector(".odysseus-pad__text").textContent = text || "";
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row.querySelector(".odysseus-pad__text");
  }

  function setStatus(msg, isError) {
    const el = document.getElementById("odysseus-status");
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = isError ? "error" : "ok";
  }

  async function loadDefaultChat() {
    try {
      const r = await fetch(`${API}/api/default-chat`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const modelSel = document.getElementById("odysseus-model");
      const saved = loadState().model || "";
      const model = j.model || j.default_model || "";
      if (modelSel) {
        modelSel.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = model || "default";
        opt.textContent = model ? `Model: ${model}` : "Default model";
        modelSel.appendChild(opt);
        if (saved && saved !== model) {
          const custom = document.createElement("option");
          custom.value = saved;
          custom.textContent = saved;
          custom.selected = true;
          modelSel.appendChild(custom);
        }
      }
      setStatus(model ? `Ready · ${model}` : "Ready");
      return j;
    } catch (e) {
      setStatus(`Odysseus API unreachable (${e.message})`, true);
      return null;
    }
  }

  async function probeVersion() {
    try {
      const r = await fetch(`${API}/api/version`, { credentials: "include", cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      const ver = j.version || j.app_version || "";
      if (ver) setStatus(`Ready · v${ver}`);
    } catch { /* optional */ }
  }

  function parseSseChunk(text, onToken) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const token = j.content || j.delta || j.text || j.message || j.response || "";
        if (token) onToken(String(token));
      } catch {
        if (payload && payload !== "[DONE]") onToken(payload);
      }
    }
  }

  async function streamChat(message, model, sessionId) {
    const body = new URLSearchParams({
      message,
      model: model || "nephew:fast",
      session: sessionId || "new",
    });
    const r = await fetch(`${API}/api/chat_stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!r.ok) throw new Error(`Chat failed HTTP ${r.status}`);
    const reader = r.body?.getReader();
    if (!reader) {
      const text = await r.text();
      return text;
    }
    const decoder = new TextDecoder();
    let assistantEl = appendBubble("assistant", "");
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      parseSseChunk(chunk, (tok) => {
        acc += tok;
        if (assistantEl) assistantEl.textContent = acc;
        const log = document.getElementById("odysseus-log");
        if (log) log.scrollTop = log.scrollHeight;
      });
    }
    return acc;
  }

  function bind() {
    const root = document.getElementById("odysseus-pad");
    if (!root || root.dataset.odysseusBound === "1") return;
    root.dataset.odysseusBound = "1";

    const form = document.getElementById("odysseus-compose");
    const input = document.getElementById("odysseus-input");
    const modelSel = document.getElementById("odysseus-model");
    let sessionId = loadState().session || "new";
    let busy = false;

    loadDefaultChat().then(() => probeVersion());

    if (window.PromptLibraryBridge?.consumePendingPrompt) {
      window.PromptLibraryBridge.consumePendingPrompt({
        setInput: (text) => {
          if (input) input.value = text;
        },
        autoSendDefault: false,
        surface: "odysseus",
      });
    }

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (busy) return;
      const text = (input?.value || "").trim();
      if (!text) return;
      busy = true;
      appendBubble("user", text);
      if (input) input.value = "";
      setStatus("Streaming…");
      const model = modelSel?.value || "";
      if (model) saveState({ model });
      try {
        await streamChat(text, model, sessionId);
        sessionId = sessionId === "new" ? `pockit-${Date.now()}` : sessionId;
        saveState({ session: sessionId, model });
        setStatus("Ready");
      } catch (e) {
        appendBubble("assistant", `Error: ${e.message}`);
        setStatus(e.message, true);
      } finally {
        busy = false;
      }
    });

    input?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  window.OdysseusPad = { render, bind, API };
})();
