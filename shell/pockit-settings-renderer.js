/**
 * Plan 0304 Phase 3 — shared Settings renderer (modal + full page).
 */
(function (global) {
  const VOICE_PREF_KEY = "nephew-voice-settings";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadVoicePrefs() {
    try {
      const raw = localStorage.getItem(VOICE_PREF_KEY);
      return raw ? JSON.parse(raw) : { default_route: "auto" };
    } catch {
      return { default_route: "auto" };
    }
  }

  function saveVoicePrefs(prefs) {
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(prefs));
  }

  async function fetchVoiceConfig() {
    const res = await fetch("/api/v1/operator/config/voice-config", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload.data || payload;
  }

  async function applyPockitSettings(delta) {
    const results = { local: [], remote: [], errors: [] };
    if (delta.shell && global.PockitConfig) {
      const cfg = global.PockitConfig.get();
      Object.assign(cfg, delta.shell);
      global.PockitConfig.apply(cfg);
      results.local.push("pockit-shell");
    }
    if (delta.voice_prefs) {
      saveVoicePrefs({ ...loadVoicePrefs(), ...delta.voice_prefs });
      results.local.push("voice-prefs");
    }
    if (delta.voice_config) {
      try {
        const res = await fetch("/api/v1/operator/config/voice-config", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delta.voice_config),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
        results.remote.push("voice-config");
      } catch (e) {
        results.errors.push(e.message || String(e));
      }
    }
    if (delta.boot_accessories) {
      try {
        const res = await fetch("/api/v1/operator/config/pockit-boot-accessories", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delta.boot_accessories),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
        results.remote.push("pockit-boot-accessories");
      } catch (e) {
        results.errors.push(e.message || String(e));
      }
    }
    return results;
  }

  const EXTENDED_TABS = [
    { id: "voice", label: "Voice", icon: "AudioOutlined", registry_domain: "voice" },
    { id: "accessories", label: "Accessories", icon: "AppstoreOutlined", registry_domain: "pockit" },
    {
      id: "configurations",
      label: "Configurations",
      icon: "SettingOutlined",
      deep_link: "#/c/configurations",
    },
  ];

  function extendedTabIds() {
    return EXTENDED_TABS.map((t) => t.id);
  }

  function mergeSettingsTabs(baseTabs) {
    const base = baseTabs || [];
    const insertBefore = base.findIndex((t) => t.id === "system");
    const idx = insertBefore >= 0 ? insertBefore : base.length;
    const merged = [...base];
    merged.splice(idx, 0, ...EXTENDED_TABS);
    return merged;
  }

  function renderVoiceTabPanel() {
    const prefs = loadVoicePrefs();
    return `<div class="pockit-settings-pane" data-settings-tab="voice">
      <h3 class="pockit-settings-pane__title">Voice defaults</h3>
      <div class="cs-card">
        <label class="cs-field"><span class="cs-field-label">Default route</span>
          <select class="pc-voice-pref" data-voice-key="default_route">
            <option value="auto" ${prefs.default_route === "auto" ? "selected" : ""}>Auto</option>
            <option value="m5" ${prefs.default_route === "m5" ? "selected" : ""}>M5 edge</option>
            <option value="dgx" ${prefs.default_route === "dgx" ? "selected" : ""}>DGX</option>
          </select>
        </label>
        <p class="cs-hint">Pad session picks up route on reload. Full engine roster: Configurations Center.</p>
        <a class="comet-btn comet-btn--ghost" href="#/c/configurations">Open Configurations Center</a>
        <a class="comet-btn comet-btn--ghost" href="#/c/voice">Open Voice pad</a>
      </div>
      <h3 class="pockit-settings-pane__title">Live voice-config.json</h3>
      <div class="cs-card">
        <p class="cs-hint" id="pc-voice-config-status">Loading…</p>
        <label class="cs-field"><span class="cs-field-label">default_voice</span>
          <input type="text" class="pc-voice-config-field" data-vc-key="default_voice" />
        </label>
      </div>
    </div>`;
  }

  function renderAccessoriesTabPanel() {
    return `<div class="pockit-settings-pane" data-settings-tab="accessories">
      <h3 class="pockit-settings-pane__title">Boot accessories</h3>
      <div class="cs-card" id="pc-boot-accessories-card">
        <p class="cs-hint">Loading pockit-boot-accessories.json…</p>
      </div>
      <p class="cs-hint">Changes apply on next Pockit.app boot when saved via tower-api.</p>
    </div>`;
  }

  function renderConfigurationsTabPanel() {
    return `<div class="pockit-settings-pane" data-settings-tab="configurations">
      <h3 class="pockit-settings-pane__title">Configurations Center</h3>
      <div class="cs-card">
        <p class="cs-hint">All operator JSON — registry index, schemas, read/write policy.</p>
        <a class="comet-btn comet-btn--primary" href="#/c/configurations">Open Configurations Center</a>
      </div>
    </div>`;
  }

  function renderExtendedTabPanel(tabId) {
    if (tabId === "voice") return renderVoiceTabPanel();
    if (tabId === "accessories") return renderAccessoriesTabPanel();
    if (tabId === "configurations") return renderConfigurationsTabPanel();
    return null;
  }

  async function hydrateVoiceTab(root) {
    const status = root.querySelector("#pc-voice-config-status");
    const cfg = await fetchVoiceConfig();
    if (!cfg) {
      if (status) status.textContent = "Sign in as operator to load voice-config.";
      return;
    }
    if (status) status.textContent = `schema_version ${cfg.schema_version} · default_voice ${cfg.default_voice}`;
    const input = root.querySelector('[data-vc-key="default_voice"]');
    if (input) input.value = cfg.default_voice || "";
    root.dataset.voiceConfigJson = JSON.stringify(cfg);
  }

  async function hydrateAccessoriesTab(root) {
    const card = root.querySelector("#pc-boot-accessories-card");
    if (!card) return;
    try {
      const res = await fetch("/api/v1/operator/config/pockit-boot-accessories", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const data = payload.data || payload;
      card.innerHTML = (data.on_pockit_boot || [])
        .map(
          (row) =>
            `<label class="cs-field"><span class="cs-field-label">${esc(row.accessory_id)}</span>
            <input type="checkbox" class="pc-boot-acc" data-acc-id="${esc(row.accessory_id)}" ${row.ensure_desktop ? "checked" : ""} />
            ensure_desktop · ${esc(row.open_door || "")}</label>`,
        )
        .join("");
      card.dataset.bootJson = JSON.stringify(data);
    } catch (e) {
      card.innerHTML = `<p class="cs-hint">${esc(e.message)}</p>`;
    }
  }

  function bindExtendedTabActions(content, tabId) {
    if (tabId === "voice") {
      hydrateVoiceTab(content);
      return;
    }
    if (tabId === "accessories") {
      hydrateAccessoriesTab(content);
    }
  }

  async function collectExtendedSettings(root) {
    const delta = {};
    const voicePanel = root.querySelector('[data-settings-tab="voice"]');
    if (voicePanel) {
      const routeSel = voicePanel.querySelector('[data-voice-key="default_route"]');
      if (routeSel) {
        delta.voice_prefs = { default_route: routeSel.value };
      }
      const vcField = voicePanel.querySelector('[data-vc-key="default_voice"]');
      const baseJson = voicePanel.dataset.voiceConfigJson;
      if (vcField && baseJson) {
        try {
          const cfg = JSON.parse(baseJson);
          cfg.default_voice = vcField.value.trim() || cfg.default_voice;
          delta.voice_config = cfg;
        } catch {
          /* ignore */
        }
      }
    }
    const accPanel = root.querySelector('[data-settings-tab="accessories"]');
    if (accPanel?.dataset.bootJson) {
      try {
        const data = JSON.parse(accPanel.dataset.bootJson);
        accPanel.querySelectorAll(".pc-boot-acc").forEach((cb) => {
          const row = (data.on_pockit_boot || []).find((r) => r.accessory_id === cb.dataset.accId);
          if (row) row.ensure_desktop = cb.checked;
        });
        delta.boot_accessories = data;
      } catch {
        /* ignore */
      }
    }
    return delta;
  }

  global.PockitSettingsRenderer = {
    VOICE_PREF_KEY,
    EXTENDED_TABS,
    extendedTabIds,
    mergeSettingsTabs,
    renderExtendedTabPanel,
    bindExtendedTabActions,
    collectExtendedSettings,
    applyPockitSettings,
    loadVoicePrefs,
    saveVoicePrefs,
  };
})(window);
