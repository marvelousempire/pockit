/**
 * Plan 0461 — Settings → Catalog tab (vanilla / fleet / custom toggles).
 */
(function (global) {
  const Lib = () => global.PockitCatalogEntitlements;
  const Tree = () => global.PockitCatalogGrantTree;

  function esc(s) {
    return Tree()?.esc(s) || String(s ?? "");
  }

  function fleetCatalog() {
    return Tree()?.fleetCatalog() || global.POCKIT_FLEET_CATALOG || global.POCKIT_CATALOG;
  }

  function renderModeRadios(mode) {
    const modes = [
      { id: "core", label: "Vanilla Pockit", hint: "Empty pocket + default Mac accessories only" },
      { id: "fleet", label: "Full fleet", hint: "Every console and cartridge in your manifest" },
      { id: "custom", label: "Custom", hint: "Turn consoles and cartridges on or off below" },
    ];
    return modes
      .map(
        (m) => `<label class="cs-field cs-field--radio">
        <input type="radio" name="pc-catalog-mode" class="pc-catalog-mode" value="${m.id}" ${mode === m.id ? "checked" : ""} />
        <span class="cs-field-label">${esc(m.label)}</span>
        <small class="cs-field-desc">${esc(m.hint)}</small>
      </label>`,
      )
      .join("");
  }

  function renderPlayerTree(catalog, entitlements) {
    return Tree()?.renderPlayerTree(catalog, entitlements, { classPrefix: "pc-catalog" })
      || `<p class="cs-hint">Grant tree failed to load.</p>`;
  }

  function renderCatalogTabPanel(entitlements) {
    const ent = Lib()?.normalizeCatalogEntitlements(entitlements) || { mode: "fleet" };
    const catalog = fleetCatalog();
    const treeHidden = ent.mode !== "custom" ? ' hidden aria-hidden="true"' : "";
    const rolloutPanel = global.PockitCatalogRolloutAdmin?.renderRolloutAdminPanel?.() || "";
    return `<div class="pockit-settings-pane" data-settings-tab="catalog">
      <h3 class="pockit-settings-pane__title">Catalog mode</h3>
      <div class="cs-card pc-catalog-mode-card">
        ${renderModeRadios(ent.mode)}
        <p class="cs-hint">Vanilla = SaaS first-run. Full fleet = your operator manifest. Custom = rollout subset. Signed-in users also resolve via server rollout.</p>
      </div>
      <h3 class="pockit-settings-pane__title pc-catalog-tree-title"${treeHidden}>Consoles &amp; cartridges</h3>
      <div class="cs-card pc-catalog-tree-card"${treeHidden} id="pc-catalog-tree">
        ${renderPlayerTree(catalog, ent)}
      </div>
      ${rolloutPanel}
      <p class="cs-hint" id="pc-catalog-save-hint">Save applies immediately — overview and rails refresh.</p>
    </div>`;
  }

  function readModeFromRoot(root) {
    const checked = root.querySelector(".pc-catalog-mode:checked");
    return checked?.value || "fleet";
  }

  function collectEntitlementsFromRoot(root, baseEntitlements) {
    const lib = Lib();
    const t = Tree();
    if (!lib || !t) return baseEntitlements;
    const mode = readModeFromRoot(root);
    return t.collectFromTree(root, baseEntitlements, fleetCatalog(), { classPrefix: "pc-catalog", mode });
  }

  function bindCatalogTab(root) {
    const syncTreeVisibility = () => {
      const mode = readModeFromRoot(root);
      const show = mode === "custom";
      root.querySelectorAll(".pc-catalog-tree-title, .pc-catalog-tree-card").forEach((el) => {
        el.hidden = !show;
        el.setAttribute("aria-hidden", show ? "false" : "true");
      });
    };
    root.querySelectorAll(".pc-catalog-mode").forEach((radio) => {
      radio.addEventListener("change", syncTreeVisibility);
    });
    Tree()?.bindGrantTree(root, { classPrefix: "pc-catalog", skipModeSync: true });
    syncTreeVisibility();
  }

  async function hydrateCatalogTab(root) {
    const lib = Lib();
    if (!lib) return;
    const ent = await lib.loadEntitlements();
    const panel = root.querySelector('[data-settings-tab="catalog"]');
    if (!panel) return;
    const parent = panel.parentElement;
    const replacement = document.createElement("div");
    replacement.innerHTML = renderCatalogTabPanel(ent);
    const newPanel = replacement.firstElementChild;
    panel.replaceWith(newPanel);
    bindCatalogTab(parent);
    parent.dataset.catalogEntJson = JSON.stringify(ent);
    if (global.PockitCatalogRolloutAdmin?.refreshRolloutAdmin) {
      global.PockitCatalogRolloutAdmin.refreshRolloutAdmin(parent).catch(() => {});
    }
  }

  global.PockitCatalogSettings = {
    renderCatalogTabPanel,
    hydrateCatalogTab,
    collectEntitlementsFromRoot,
    bindCatalogTab,
  };
})(window);