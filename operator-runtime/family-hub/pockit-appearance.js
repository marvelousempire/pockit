/**
 * Pockit appearance — apply UI skin + color mode from operator config.
 */
(function (global) {
  const SKIN_LS_KEY = "nephew-pockit-skin";
  const reg = () => global.PockitAppearanceRegistry;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function effectiveColorMode(saved) {
    if (saved === "auto") {
      return global.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return saved === "dark" ? "dark" : "light";
  }

  function resolveSkin(cfg) {
    const id = cfg?.appearance?.skin || global.localStorage?.getItem(SKIN_LS_KEY);
    return reg()?.normalizeSkinId(id) || reg()?.DEFAULT_SKIN_ID || "presence";
  }

  function resolveColorMode(cfg) {
    const id = cfg?.theme?.mode || global.localStorage?.getItem("nephew-hub-theme") || "light";
    return reg()?.normalizeColorMode(id) || "light";
  }

  function applySkin(skinId) {
    const id = reg()?.normalizeSkinId(skinId) || "presence";
    document.documentElement.setAttribute("data-skin", id);
    try {
      global.localStorage.setItem(SKIN_LS_KEY, id);
    } catch {
      /* quota */
    }
    return id;
  }

  function applyColorMode(saved) {
    const pref = reg()?.normalizeColorMode(saved) || "light";
    document.documentElement.setAttribute("data-theme", effectiveColorMode(pref));
    try {
      global.localStorage.setItem("nephew-hub-theme", pref);
    } catch {
      /* quota */
    }
    if (typeof global.__pockitSyncThemeChrome === "function") {
      global.__pockitSyncThemeChrome(pref);
    }
    return pref;
  }

  function applyFromConfig(cfg) {
    const skin = applySkin(resolveSkin(cfg));
    const colorMode = applyColorMode(resolveColorMode(cfg));
    return { skin, colorMode };
  }

  function renderSkinCards(selectedId) {
    const skins = reg()?.SKINS || [];
    const selected = reg()?.normalizeSkinId(selectedId) || "presence";
    return `<div class="pockit-appearance-skins" role="radiogroup" aria-label="UI skin">
      ${skins
        .map((skin) => {
          const on = skin.id === selected;
          const badge = skin.default ? '<span class="pockit-appearance-card__badge">Default</span>' : "";
          const status =
            skin.status === "preview"
              ? '<span class="pockit-appearance-card__status">Preview</span>'
              : "";
          return `<button type="button" class="pockit-appearance-card${on ? " is-selected" : ""}"
            role="radio" aria-checked="${on ? "true" : "false"}"
            data-appearance-skin="${esc(skin.id)}">
            <span class="pockit-appearance-card__swatch pockit-appearance-card__swatch--${esc(skin.id)}" aria-hidden="true"></span>
            <span class="pockit-appearance-card__body">
              <span class="pockit-appearance-card__title">${esc(skin.label)} ${badge}${status}</span>
              <span class="pockit-appearance-card__tagline">${esc(skin.tagline)}</span>
            </span>
          </button>`;
        })
        .join("")}
      <input type="hidden" class="pc-pref" data-pc-key="appearance.skin" value="${esc(selected)}" />
    </div>`;
  }

  function renderColorModeSelect(selectedId) {
    const modes = reg()?.COLOR_MODES || [];
    const selected = reg()?.normalizeColorMode(selectedId) || "light";
    const opts = modes
      .map(
        (m) =>
          `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.label)}</option>`,
      )
      .join("");
    const active = reg()?.colorModeById(selected);
    const hint = active?.tagline
      ? `<small class="cs-field-desc">${esc(active.tagline)}</small>`
      : "";
    return `<label class="cs-field">
      <span class="cs-field-label">Color mode</span>
      ${hint}
      <select class="pc-pref" data-pc-key="theme.mode">${opts}</select>
    </label>`;
  }

  function renderAppearancePanel(cfg) {
    const skin = resolveSkin(cfg);
    const colorMode = resolveColorMode(cfg);
    return `<div class="pockit-settings-pane" data-settings-tab="appearance">
      <h3 class="pockit-settings-pane__title">UI skin</h3>
      <p class="cs-hint pockit-appearance-lede">Skins change radii, glass, and rail character. Color mode is independent — mix any skin with light, dark, or system.</p>
      <div class="cs-card pockit-appearance-card-wrap">
        ${renderSkinCards(skin)}
      </div>
      <h3 class="pockit-settings-pane__title">Color mode</h3>
      <div class="cs-card">
        ${renderColorModeSelect(colorMode)}
      </div>
      <p class="cs-hint pockit-appearance-footnote">More skins ship as cassettes — register rows in <code>pockit-appearance-registry.js</code>.</p>
    </div>`;
  }

  function bindAppearancePanel(root, { onPreview } = {}) {
    if (!root || root.dataset.appearanceBound === "1") return;
    root.dataset.appearanceBound = "1";

    const hidden = root.querySelector('.pc-pref[data-pc-key="appearance.skin"]');
    const colorSelect = root.querySelector('.pc-pref[data-pc-key="theme.mode"]');

    function preview(cfgPatch) {
      const cfg = global.PockitConfig?.get?.() || {};
      applyFromConfig({ ...cfg, ...cfgPatch });
      onPreview?.(cfgPatch);
    }

    root.querySelectorAll("[data-appearance-skin]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-appearance-skin") || "presence";
        root.querySelectorAll("[data-appearance-skin]").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-selected", on);
          b.setAttribute("aria-checked", on ? "true" : "false");
        });
        if (hidden) hidden.value = id;
        preview({ appearance: { skin: id } });
      });
    });

    colorSelect?.addEventListener("change", () => {
      preview({ theme: { mode: colorSelect.value } });
    });
  }

  function initAppearance() {
    const cfg = global.PockitConfig?.get?.();
    if (cfg) applyFromConfig(cfg);
    else {
      applySkin(global.localStorage?.getItem(SKIN_LS_KEY));
      applyColorMode(global.localStorage?.getItem("nephew-hub-theme") || "light");
    }
    const mq = global.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const cur = global.localStorage?.getItem("nephew-hub-theme") || "light";
      if (cur === "auto") applyColorMode("auto");
    };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  global.PockitAppearance = {
    SKIN_LS_KEY,
    effectiveColorMode,
    resolveSkin,
    resolveColorMode,
    applySkin,
    applyColorMode,
    applyFromConfig,
    renderAppearancePanel,
    bindAppearancePanel,
    initAppearance,
  };
})(typeof window !== "undefined" ? window : globalThis);