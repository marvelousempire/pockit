/**
 * Plan 0275 — Device Lab (Settings → Devices): preset picker + viewport frame.
 */
(function () {
  "use strict";

  let selectedPresetId = null;
  let matrixResults = null;
  let searchQuery = "";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mountEl(root) {
    return root?.closest?.("#pockit-settings-modal-content") || root;
  }

  function repaint(root) {
    const mount = mountEl(root);
    if (!mount) return;
    const scrollHost = mount.closest(".pockit-settings-modal__content");
    const scrollTop = scrollHost?.scrollTop || 0;
    mount.innerHTML = renderPanelHtml();
    bindPanel(mount);
    if (scrollHost) scrollHost.scrollTop = scrollTop;
  }

  function statusLineHtml() {
    const vp = window.PockitViewport;
    if (!vp) return "";
    const { width, height } = vp.viewportSize?.() || { width: 0, height: 0 };
    const lab = vp.getLabOverride?.() ? "on" : "off";
    const device =
      vp.deviceLabel && vp.deviceId !== "generic"
        ? `${vp.deviceLabel} · ${vp.deviceId}`
        : vp.deviceId || "generic";
    return `<p class="pockit-device-lab__status" role="status"><strong>${esc(vp.tier)}</strong> · ${esc(vp.orientation)} · ${esc(device)} · ${width}×${height} · lab ${lab}</p>`;
  }

  function presetsGroupedByBase(presets) {
    const map = new Map();
    for (const p of presets || []) {
      const baseId = p.baseId || p.id;
      if (!map.has(baseId)) {
        map.set(baseId, { baseId, label: p.label, portrait: null, landscape: null });
      }
      const group = map.get(baseId);
      if (p.orientation === "portrait") group.portrait = p;
      else group.landscape = p;
    }
    return [...map.values()];
  }

  function matchesSearch(device) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${device.label} ${device.baseId}`.toLowerCase().includes(q);
  }

  function renderDeviceRow(device) {
    const portrait = device.portrait;
    const landscape = device.landscape;
    const defaultId = portrait?.id || landscape?.id || "";
    const sizePreset = portrait || landscape;
    const portraitActive = portrait && selectedPresetId === portrait.id ? " is-active" : "";
    const landscapeActive = landscape && selectedPresetId === landscape.id ? " is-active" : "";
    const rowActive =
      (portrait && selectedPresetId === portrait.id)
      || (landscape && selectedPresetId === landscape.id)
        ? " pockit-device-lab__row--active"
        : "";
    return `<li class="pockit-device-lab__row${rowActive}" data-device-base="${esc(device.baseId)}">
      <button type="button" class="pockit-device-lab__row-main" data-device-preset="${esc(defaultId)}" ${defaultId ? "" : "disabled"}>
        <span class="pockit-device-lab__row-label">${esc(device.label)}</span>
        <span class="pockit-device-lab__row-size">${sizePreset ? esc(`${sizePreset.width}×${sizePreset.height}`) : ""}</span>
      </button>
      <div class="pockit-device-lab__segment" role="group" aria-label="${esc(device.label)} orientation">
        ${portrait ? `<button type="button" class="pockit-device-lab__segment-btn${portraitActive}" data-device-preset="${esc(portrait.id)}" aria-label="Portrait" title="Portrait ${portrait.width}×${portrait.height}">P</button>` : ""}
        ${landscape ? `<button type="button" class="pockit-device-lab__segment-btn${landscapeActive}" data-device-preset="${esc(landscape.id)}" aria-label="Landscape" title="Landscape ${landscape.width}×${landscape.height}">L</button>` : ""}
      </div>
    </li>`;
  }

  function renderPresetGroups() {
    const reg = window.PockitViewportRegistry;
    if (!reg?.presets?.length) {
      return "<p class=\"pockit-device-lab__hint\">Loading device presets…</p>";
    }
    const q = searchQuery.trim().toLowerCase();
    const sections = reg.presetsByFamily().map((group) => {
      const devices = presetsGroupedByBase(group.presets).filter(matchesSearch);
      if (!devices.length) return "";
      const rows = devices.map(renderDeviceRow).join("");
      return `<section class="pockit-device-lab__section">
        <h4 class="pockit-device-lab__section-label">${esc(group.label)}</h4>
        <ul class="pockit-device-lab__group">${rows}</ul>
      </section>`;
    }).filter(Boolean);
    if (!sections.length) {
      return `<p class="pockit-device-lab__hint">No devices match “${esc(q)}”.</p>`;
    }
    return sections.join("");
  }

  function matrixReportHtml() {
    if (!matrixResults) return "";
    const rows = matrixResults.map((r) => {
      const ok = r.pass ? "pass" : "fail";
      return `<li class="pockit-device-lab__matrix-row pockit-device-lab__matrix-row--${ok}"><code>${esc(r.id)}</code> → ${esc(r.tier)} ${r.pass ? "✓" : "✗ " + esc(r.note || "")}</li>`;
    }).join("");
    const pass = matrixResults.filter((r) => r.pass).length;
    return `<div class="pockit-device-lab__matrix">
      <p class="pockit-device-lab__matrix-summary">${pass}/${matrixResults.length} presets resolve tier</p>
      <ul class="pockit-device-lab__matrix-list">${rows}</ul>
    </div>`;
  }

  function renderPanelHtml() {
    return `<div class="pockit-settings-pane pockit-settings-pane--devices">
      <div class="pockit-device-lab">
        <div class="pockit-device-lab__head">
          <p class="pockit-device-lab__lede">Pick a device and orientation, then Apply — like Safari Responsive Design Mode. Resets when you close Settings.</p>
          ${statusLineHtml()}
          <label class="pockit-device-lab__search">
            <span class="pockit-device-lab__search-icon" aria-hidden="true">⌕</span>
            <input type="search" class="pockit-device-lab__search-input" data-device-lab-search placeholder="Search TV, iMac, iPhone…" value="${esc(searchQuery)}" autocomplete="off" spellcheck="false" />
          </label>
          <div class="pockit-device-lab__toolbar">
            <button type="button" class="comet-btn comet-btn--primary" data-device-lab-action="apply" ${selectedPresetId ? "" : "disabled"}>Apply</button>
            <button type="button" class="comet-btn" data-device-lab-action="reset">Reset</button>
            <button type="button" class="comet-btn comet-btn--ghost" data-device-lab-action="matrix">Run matrix</button>
          </div>
        </div>
        ${matrixReportHtml()}
        <div class="pockit-device-lab__catalog">${renderPresetGroups()}</div>
      </div>
    </div>`;
  }

  function syncSelectionUi(root) {
    root.querySelectorAll("[data-device-preset]").forEach((btn) => {
      const id = btn.getAttribute("data-device-preset");
      btn.classList.toggle("is-active", id && id === selectedPresetId);
    });
    root.querySelectorAll(".pockit-device-lab__row").forEach((row) => {
      const hasActive = row.querySelector("[data-device-preset].is-active");
      row.classList.toggle("pockit-device-lab__row--active", Boolean(hasActive));
    });
    const applyBtn = root.querySelector("[data-device-lab-action=apply]");
    if (applyBtn) applyBtn.disabled = !selectedPresetId;
  }

  function runMatrix() {
    const reg = window.PockitViewportRegistry;
    if (!reg?.presets?.length) return;
    matrixResults = reg.presets.map((p) => {
      const coarse = p.family === "phone" || p.family === "tablet";
      const resolved = reg.resolveTier(p.width, p.height, { coarsePointer: coarse });
      const pass = p.family === "watch" ? p.tier === "watch" : resolved === p.tier;
      return {
        id: p.id,
        tier: resolved,
        pass,
        note: pass ? "" : `expected ${p.tier}`,
      };
    });
  }

  function bindPanel(root) {
    if (!root) return;

    root.querySelectorAll("[data-device-preset]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-device-preset");
        if (!id) return;
        selectedPresetId = id;
        syncSelectionUi(root);
      });
    });

    const search = root.querySelector("[data-device-lab-search]");
    if (search) {
      search.addEventListener("input", () => {
        searchQuery = search.value || "";
        repaint(root);
        const next = root.querySelector("[data-device-lab-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }

    root.querySelectorAll("[data-device-lab-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-device-lab-action");
        if (action === "apply" && selectedPresetId) {
          const preset = window.PockitViewportRegistry?.getPresetById(selectedPresetId);
          if (preset) {
            window.PockitViewport?.applyLabOverride?.({
              width: preset.width,
              height: preset.height,
              deviceId: preset.id,
              tier: preset.tier,
            });
          }
        }
        if (action === "reset") {
          selectedPresetId = null;
          matrixResults = null;
          searchQuery = "";
          window.PockitViewport?.clearLabOverride?.();
        }
        if (action === "matrix") runMatrix();
        repaint(root);
      });
    });

    syncSelectionUi(root);
  }

  function init() {
    window.PockitDeviceLab = {
      renderPanelHtml,
      bindPanel,
      runMatrix,
    };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
