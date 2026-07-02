/**
 * Voice roster UI — Settings-style speaker picker with preview.
 */
(function (global) {
  "use strict";

  let activePreviewBtn = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchCatalog() {
    try {
      const health = await fetch("/api/v1/voice/health", { credentials: "include", cache: "no-store" });
      if (health.ok) {
        const h = await health.json();
        if (h?.catalog?.voices?.length) return h.catalog;
      }
      const res = await fetch("/api/v1/voice/voices", { credentials: "include", cache: "no-store" });
      if (res.ok) return await res.json();
    } catch { /* offline */ }
    return { voices: [] };
  }

  function groupedVoices(catalog) {
    const visible = (catalog?.voices || []).filter((v) => v.tier !== "fallback" && !v.hidden);
    const groups = new Map();
    for (const v of visible) {
      const g = v.group || "Voices";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    }
    return groups;
  }

  function updateRailSpeakerLabel(id, catalog) {
    const labelEl = document.getElementById("voice-rail-speaker-label");
    if (!labelEl) return;
    const v = (catalog?.voices || []).find((x) => x.id === id);
    if (v?.label) labelEl.textContent = v.label;
    else if (id) labelEl.textContent = id;
  }

  function stopPreviewPlayback() {
    global.ParakeetVoicePad?.stopPlayback?.();
    if (activePreviewBtn) {
      activePreviewBtn.classList.remove("is-playing");
      activePreviewBtn.textContent = "▶";
      activePreviewBtn.disabled = false;
      activePreviewBtn = null;
    }
  }

  function closeModal() {
    stopPreviewPlayback();
    document.getElementById("pockit-voice-roster-modal")?.remove();
  }

  function engineLabel(v) {
    if (v.engine === "holler") return "Holler · M5";
    if (v.engine === "kokoro") return "Kokoro · DGX";
    if (v.engine === "nemo-riva") return "Riva · DGX";
    return v.engine ? String(v.engine) : "";
  }

  function renderVoiceRow(v, selectedId) {
    const selected = v.id === selectedId || v.tts_voice === selectedId;
    const status = engineLabel(v);
    return `<li class="voice-roster-row${selected ? " is-selected" : ""}" data-voice-id="${esc(v.id)}">
      <button type="button" class="voice-roster-row__pick" data-voice-pick="${esc(v.id)}" aria-pressed="${selected ? "true" : "false"}">
        <span class="voice-roster-row__glyph" aria-hidden="true">🎙</span>
        <span class="voice-roster-row__body">
          <span class="voice-roster-row__name">${esc(v.label || v.id)}</span>
          ${status ? `<span class="voice-roster-row__meta">${esc(status)}</span>` : ""}
        </span>
        ${selected ? `<span class="voice-roster-row__check" aria-hidden="true">✓</span>` : ""}
      </button>
      <button type="button" class="voice-roster-row__preview" data-voice-preview-id="${esc(v.id)}" aria-label="Preview ${esc(v.label || v.id)}">▶</button>
    </li>`;
  }

  async function openVoicePickerModal(opts = {}) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay pockit-voice-roster-modal";
    overlay.id = "pockit-voice-roster-modal";
    overlay.innerHTML = `
      <div class="modal voice-roster-panel" role="dialog" aria-modal="true" aria-labelledby="voice-roster-title">
        <header class="modal-header voice-roster-panel__header">
          <div>
            <p class="voice-roster-panel__kicker">${esc((window.VoiceAppDisplay || { alias: "Rick" }).alias)} · Speakers</p>
            <h2 id="voice-roster-title">Choose a voice</h2>
            <p class="voice-roster-panel__hint">Holler voices run on M5 · Kokoro roster on DGX — tap ▶ to preview, ■ to stop</p>
          </div>
          <div class="voice-roster-panel__header-actions">
            <button type="button" class="voice-roster-stop-all" id="voice-roster-stop-preview" hidden>Stop preview</button>
            <button type="button" class="modal-close voice-roster-panel__close" aria-label="Close">×</button>
          </div>
        </header>
        <div class="modal-body voice-roster-panel__body">
          <p class="voice-roster-panel__loading">Loading voices…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".voice-roster-panel__close")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    const stopAllBtn = overlay.querySelector("#voice-roster-stop-preview");
    stopAllBtn?.addEventListener("click", () => {
      stopPreviewPlayback();
      stopAllBtn.hidden = true;
    });

    const body = overlay.querySelector(".voice-roster-panel__body");
    const catalog = await fetchCatalog();
    const st = global.ParakeetVoicePad?.getState?.() || {};
    let savedVoice = "";
    try {
      const prefs = JSON.parse(localStorage.getItem("nephew-voice-pad-v2") || "{}");
      savedVoice = prefs.voice || "";
    } catch { /* ignore */ }
    const selectedId = opts.selectedId || st.voice || savedVoice || "";
    const groups = groupedVoices(catalog);

    if (!groups.size) {
      body.innerHTML = `<p class="voice-roster-panel__empty">No premium voices loaded yet. Start <code>make ensure-m5-voice</code> or deploy DGX voice, then refresh.</p>`;
      return;
    }

    let html = "";
    for (const [group, voices] of groups) {
      html += `<section class="voice-roster-group"><h3 class="voice-roster-group__title">${esc(group)}</h3><ul class="voice-roster-list">${voices.map((v) => renderVoiceRow(v, selectedId)).join("")}</ul></section>`;
    }
    body.innerHTML = html;

    body.querySelectorAll("[data-voice-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-voice-pick");
        global.ParakeetVoicePad?.dispatchControl?.({ voice: id });
        body.querySelectorAll(".voice-roster-row").forEach((row) => {
          const on = row.getAttribute("data-voice-id") === id;
          row.classList.toggle("is-selected", on);
          row.querySelector("[data-voice-pick]")?.setAttribute("aria-pressed", on ? "true" : "false");
        });
        opts.onSelect?.(id);
        updateRailSpeakerLabel(id, catalog);
      });
    });

    body.querySelectorAll("[data-voice-preview-id]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-voice-preview-id");
        const label = catalog.voices?.find((v) => v.id === id)?.label || id;

        if (btn.classList.contains("is-playing")) {
          stopPreviewPlayback();
          if (stopAllBtn) stopAllBtn.hidden = true;
          return;
        }

        if (activePreviewBtn && activePreviewBtn !== btn) {
          activePreviewBtn.classList.remove("is-playing");
          activePreviewBtn.textContent = "▶";
          activePreviewBtn.disabled = false;
        }

        activePreviewBtn = btn;
        btn.classList.add("is-playing");
        btn.textContent = "■";
        btn.setAttribute("aria-label", `Stop preview of ${label}`);
        if (stopAllBtn) stopAllBtn.hidden = false;

        global.ParakeetVoicePad?.dispatchControl?.({ voice: id });
        const result = await global.ParakeetVoicePad?.previewVoice?.(id);
        updateRailSpeakerLabel(id, catalog);

        if (activePreviewBtn === btn) {
          btn.classList.remove("is-playing");
          btn.textContent = "▶";
          btn.setAttribute("aria-label", `Preview ${label}`);
          activePreviewBtn = null;
          if (stopAllBtn && !result?.stopped) stopAllBtn.hidden = true;
        }
      });
    });
  }

  global.PockitVoiceVoicesUI = {
    openVoicePickerModal,
    fetchCatalog,
    stopPreviewPlayback,
  };
})(window);
