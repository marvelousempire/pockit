/**
 * Pockit Quick Desk — native center panel (Plan 0445).
 * Tap-chips for recurring actions:
 *   forge  → paste a repo → POST /api/v1/admin/cassettes/factory { from_url, target }
 *   prompt → fire a saved prompt at the AI (prompt-library run → /api/v1/chat/completions)
 *   door   → open http://<id>.localhost/
 *   run    → copy a command to the clipboard
 *
 * Chip defaults: /quick-desk-chips.json (static). Operator chips overlay via
 * localStorage 'pockit.quickDesk.userChips.v1'.
 */
(function () {
  const CHIPS_URL = "/quick-desk-chips.json";
  const USER_KEY = "pockit.quickDesk.userChips.v1";
  const FACTORY_API = "/api/v1/admin/cassettes/factory";
  const PROMPT_API = "/api/v1/prompt-library";
  const CHAT_API = "/api/v1/chat/completions";

  const FALLBACK = {
    sections: [
      { id: "forge", title: "Forge a repo", hint: "Paste a GitHub repo above, then tap a target" },
      { id: "prompts", title: "My prompts", hint: "One tap fires a saved prompt at the AI" },
      { id: "doors", title: "Doors & runs", hint: "Open a door or copy a command" },
    ],
    chips: [
      { id: "forge-console", section: "forge", label: "Make Console", kind: "forge", target: "console", primary: true, hue: 200 },
      { id: "forge-cartridge", section: "forge", label: "Make Cartridge", kind: "forge", target: "cartridge", hue: 45 },
      { id: "forge-accessory", section: "forge", label: "Make Accessory", kind: "forge", target: "accessory", hue: 337 },
    ],
  };

  let config = null; // { sections, chips }
  let busy = false;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const el = document.getElementById("quick-desk-status");
    if (el) el.textContent = msg || "";
  }

  function outEl() {
    return document.getElementById("quick-desk-output");
  }

  function loadUserChips() {
    try {
      const raw = JSON.parse(localStorage.getItem(USER_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((c) => c && c.id && c.kind) : [];
    } catch {
      return [];
    }
  }

  function saveUserChips(chips) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(chips));
    } catch {
      /* private mode — chip won't persist */
    }
  }

  async function fetchConfig() {
    try {
      const res = await fetch(CHIPS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`chips HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.chips)) return data;
    } catch {
      /* fall back to inline defaults */
    }
    return FALLBACK;
  }

  function allChips() {
    const base = (config?.chips || FALLBACK.chips).map((c) => ({ ...c, user: false }));
    const user = loadUserChips().map((c) => ({ ...c, user: true }));
    return [...base, ...user];
  }

  function sections() {
    return config?.sections || FALLBACK.sections;
  }

  function chipHtml(chip) {
    const hue = Number(chip.hue) || 212;
    const cls = `qd-chip qd-chip--${escapeHtml(chip.kind)}${chip.primary ? " qd-chip--primary" : ""}`;
    const tip = chip.hint ? escapeHtml(chip.hint) : escapeHtml(chip.label);
    const remove = chip.user
      ? `<span class="qd-chip__remove" data-qd-remove="${escapeHtml(chip.id)}" aria-hidden="true" title="Remove chip">×</span>`
      : "";
    return `
      <button type="button" class="${cls}" style="--qd-hue:${hue}"
        data-qd-chip="${escapeHtml(chip.id)}"
        data-comet-tip="${escapeHtml(chip.label)}&#10;${tip}"
        aria-label="${escapeHtml(chip.label)}">
        <span class="qd-chip__label">${escapeHtml(chip.label)}</span>
        ${remove}
      </button>`;
  }

  function addChipHtml(sectionId) {
    if (sectionId === "prompts") {
      return `<button type="button" class="qd-chip qd-chip--add" data-qd-add="prompt">+ New prompt chip</button>`;
    }
    if (sectionId === "doors") {
      return `<button type="button" class="qd-chip qd-chip--add" data-qd-add="door">+ New door chip</button>`;
    }
    return "";
  }

  function sectionHtml(section) {
    const chips = allChips().filter((c) => c.section === section.id);
    return `
      <section class="qd-section" data-qd-section="${escapeHtml(section.id)}">
        <div class="qd-section__head">
          <h3 class="qd-section__title">${escapeHtml(section.title)}</h3>
          ${section.hint ? `<p class="qd-section__hint">${escapeHtml(section.hint)}</p>` : ""}
        </div>
        <div class="qd-chip-row">
          ${chips.map(chipHtml).join("")}
          ${addChipHtml(section.id)}
        </div>
      </section>`;
  }

  function renderShell() {
    const secs = sections().map(sectionHtml).join("");
    return `
      <div id="quick-desk-panel" class="quick-desk">
        <header class="quick-desk__hero">
          <h2 class="quick-desk__title">Quick Desk</h2>
          <p class="quick-desk__lead">Paste a repo and forge it in one tap, fire your saved prompts at the AI, or jump to a door.</p>
          <div class="quick-desk__paste">
            <input id="quick-desk-repo" class="quick-desk__input" type="url" inputmode="url" autocomplete="off" spellcheck="false"
              placeholder="https://github.com/owner/repo" aria-label="Repository URL to forge" />
          </div>
          <p id="quick-desk-status" class="quick-desk__status" aria-live="polite"></p>
        </header>
        ${secs}
        <section class="quick-desk-output" aria-label="Result">
          <div class="quick-desk-output__head">
            <h3>Result</h3>
            <button type="button" class="comet-btn comet-btn--sm comet-btn--ghost" id="quick-desk-clear">Clear</button>
          </div>
          <pre id="quick-desk-output" class="quick-desk-output__body"></pre>
        </section>
      </div>`;
  }

  function repoUrl() {
    return (document.getElementById("quick-desk-repo")?.value || "").trim();
  }

  function renderSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) return "";
    return steps
      .map((s) => `[${s.status}] ${s.name}${s.detail ? ` — ${s.detail}` : ""}`)
      .join("\n");
  }

  async function runForge(chip) {
    const url = repoUrl();
    if (!url) {
      setStatus("Paste a repo URL first.");
      document.getElementById("quick-desk-repo")?.focus();
      return;
    }
    const out = outEl();
    setStatus(`Forging ${url} → ${chip.target}… (this can take a minute)`);
    if (out) out.textContent = `Forging ${url}\nTarget: ${chip.target}\n…\n`;
    try {
      const res = await fetch(FACTORY_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_url: url, target: chip.target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        if (out) {
          out.textContent =
            `Forge failed: ${data.error || `HTTP ${res.status}`}\n\n` +
            `${renderSteps(data.steps)}\n${data.stderr || ""}`;
        }
        setStatus(`Forge failed — ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      const lines = [
        `✓ Forged ${url} → ${chip.target}`,
        data.door ? `Door: ${data.door}` : "",
        data.spec?.tapeId ? `Cartridge: ${data.spec.tapeId}` : "",
        data.appInstalled ? "Desktop .app installed" : "",
        "",
        renderSteps(data.steps),
      ].filter(Boolean);
      if (out) out.textContent = lines.join("\n");
      setStatus(`Done — ${chip.target} ready. Refresh Pockit to see the new tile.`);
    } catch (e) {
      setStatus(`Forge error: ${e.message || e}`);
      if (out) out.textContent = `Forge error: ${e.message || e}`;
    }
  }

  async function streamChat(promptText, { model, maxTokens } = {}) {
    const out = outEl();
    if (out) out.textContent = "";
    const res = await fetch(CHAT_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Voice-Agent": "pockit" },
      body: JSON.stringify({
        model: model || "nephew:awq-f4-kv",
        messages: [{ role: "user", content: promptText }],
        max_tokens: maxTokens || 12000,
        stream: true,
        temperature: 0.35,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(err.slice(0, 200) || `chat HTTP ${res.status}`);
    }
    const reader = res.body?.getReader?.();
    if (!reader) {
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content || "";
      if (out) out.textContent = text;
      return text;
    }
    const dec = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content || "";
          if (!delta) continue;
          full += delta;
          if (out) {
            out.textContent = full;
            out.scrollTop = out.scrollHeight;
          }
        } catch {
          /* skip keepalive */
        }
      }
    }
    return full;
  }

  async function runPrompt(chip) {
    let body = chip.text || "";
    setStatus(`Running "${chip.label}"…`);
    try {
      if (!body && chip.prompt_id) {
        const runRes = await fetch(
          `${PROMPT_API}/${encodeURIComponent(chip.prompt_id)}/run`,
          { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } },
        );
        if (!runRes.ok) throw new Error(`run HTTP ${runRes.status}`);
        const dispatch = await runRes.json();
        body = dispatch.body || "";
        await streamChat(body, { model: dispatch.model_hint, maxTokens: dispatch.max_tokens });
      } else if (body) {
        await streamChat(body);
      } else {
        setStatus("Chip has no prompt text or prompt_id.");
        return;
      }
      setStatus(`Done — "${chip.label}".`);
    } catch (e) {
      setStatus(`Error: ${e.message || e}`);
    }
  }

  function runDoor(chip) {
    const id = chip.door || chip.id;
    if (!id) return;
    const url = /^https?:\/\//.test(id) ? id : `http://${id}.localhost/`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(`Opened ${url}`);
  }

  async function runChipCommand(chip) {
    const cmd = chip.command || "";
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setStatus(`Copied: ${cmd} — run it in your terminal.`);
    } catch {
      setStatus(`Run: ${cmd}`);
    }
    const out = outEl();
    if (out) out.textContent = `$ ${cmd}\n(copied to clipboard — run in your terminal)`;
  }

  function chipById(id) {
    return allChips().find((c) => c.id === id) || null;
  }

  function activateChip(id) {
    if (busy) return;
    const chip = chipById(id);
    if (!chip) return;
    busy = true;
    const done = () => {
      busy = false;
    };
    if (chip.kind === "forge") runForge(chip).finally(done);
    else if (chip.kind === "prompt") runPrompt(chip).finally(done);
    else if (chip.kind === "door") {
      runDoor(chip);
      done();
    } else if (chip.kind === "run") {
      runChipCommand(chip).finally(done);
    } else done();
  }

  function addUserChip(kind) {
    const chips = loadUserChips();
    if (kind === "prompt") {
      const label = window.prompt("Chip label (e.g. Daily standup)");
      if (!label) return;
      const text = window.prompt("Prompt to send to the AI when tapped");
      if (!text) return;
      chips.push({ id: `user-${Date.now()}`, section: "prompts", label, kind: "prompt", text, hue: 262 });
    } else if (kind === "door") {
      const label = window.prompt("Chip label (e.g. Historia)");
      if (!label) return;
      const door = window.prompt("Door id (opens http://<id>.localhost/) or full URL");
      if (!door) return;
      chips.push({ id: `user-${Date.now()}`, section: "doors", label, kind: "door", door, hue: 150 });
    } else return;
    saveUserChips(chips);
    refresh();
  }

  function removeUserChip(id) {
    saveUserChips(loadUserChips().filter((c) => c.id !== id));
    refresh();
  }

  function bind() {
    const root = document.getElementById("quick-desk-panel");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("click", (e) => {
      const remove = e.target.closest("[data-qd-remove]");
      if (remove) {
        e.preventDefault();
        e.stopPropagation();
        removeUserChip(remove.getAttribute("data-qd-remove"));
        return;
      }
      const add = e.target.closest("[data-qd-add]");
      if (add) {
        addUserChip(add.getAttribute("data-qd-add"));
        return;
      }
      const chip = e.target.closest("[data-qd-chip]");
      if (chip) {
        activateChip(chip.getAttribute("data-qd-chip"));
      }
    });

    document.getElementById("quick-desk-clear")?.addEventListener("click", () => {
      const out = outEl();
      if (out) out.textContent = "";
      setStatus("");
    });
  }

  async function refresh() {
    if (!config) config = await fetchConfig();
    const root = document.getElementById("quick-desk-panel");
    if (root) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderShell();
      const fresh = tmp.firstElementChild;
      root.replaceWith(fresh);
      bind();
    }
    return config;
  }

  function render() {
    // Synchronous first paint with whatever config we have (fallback if not yet fetched);
    // refresh() upgrades it once /quick-desk-chips.json resolves.
    return renderShell();
  }

  window.PockitQuickDeskPanel = { render, bind, refresh };
})();
