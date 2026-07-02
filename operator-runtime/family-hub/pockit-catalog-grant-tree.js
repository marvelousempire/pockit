/**
 * Plan 0463 — shared console/cartridge grant tree (Settings + Rollout admin).
 */
(function (global) {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeEnt(entitlements) {
    return global.PockitCatalogEntitlements?.normalizeCatalogEntitlements(entitlements)
      || { schema_version: 1, mode: "custom", players: {} };
  }

  function renderPlayerTree(catalog, entitlements, opts = {}) {
    const prefix = opts.classPrefix || "pc-catalog";
    const ent = normalizeEnt(entitlements);
    if (!catalog?.players?.length && !(catalog?.unassigned_cassettes || []).length) {
      return `<p class="cs-hint">Fleet catalog not loaded — open Pockit once, then retry.</p>`;
    }
    const sections = [];
    for (const p of catalog.players || []) {
      const pe = ent.players[p.id] || { enabled: true, cassettes: {} };
      const cassettes = (p.hosted_cassettes || [])
        .map((c) => {
          const on = pe.cassettes?.[c.id]?.enabled !== false;
          return `<label class="cs-field cs-field--toggle ${prefix}-cassette">
            <input type="checkbox" class="${prefix}-cassette-cb" data-player-id="${esc(p.id)}" data-cassette-id="${esc(c.id)}" ${on ? "checked" : ""} />
            <span class="cs-field-label">${esc(c.name || c.id)}</span>
          </label>`;
        })
        .join("");
      sections.push(`<details class="${prefix}-console" open>
        <summary class="${prefix}-console__head">
          <label class="cs-field cs-field--toggle ${prefix}-console-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="${prefix}-player-cb" data-player-id="${esc(p.id)}" ${pe.enabled !== false ? "checked" : ""} />
            <span class="cs-field-label">${esc(p.name || p.id)}</span>
            <span class="${prefix}-console__count">${(p.hosted_cassettes || []).length} cartridges</span>
          </label>
        </summary>
        <div class="${prefix}-console__cassettes">${cassettes || '<p class="cs-hint">No cartridges</p>'}</div>
      </details>`);
    }
    if ((catalog.unassigned_cassettes || []).length) {
      const pe = ent.players._unassigned || { enabled: true, cassettes: {} };
      const cassettes = catalog.unassigned_cassettes
        .map((c) => {
          const on = pe.cassettes?.[c.id]?.enabled !== false;
          return `<label class="cs-field cs-field--toggle ${prefix}-cassette">
            <input type="checkbox" class="${prefix}-cassette-cb" data-player-id="_unassigned" data-cassette-id="${esc(c.id)}" ${on ? "checked" : ""} />
            <span class="cs-field-label">${esc(c.name || c.id)}</span>
          </label>`;
        })
        .join("");
      sections.push(`<details class="${prefix}-console" open>
        <summary class="${prefix}-console__head">
          <label class="cs-field cs-field--toggle ${prefix}-console-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="${prefix}-player-cb" data-player-id="_unassigned" ${pe.enabled !== false ? "checked" : ""} />
            <span class="cs-field-label">Other (unassigned)</span>
          </label>
        </summary>
        <div class="${prefix}-console__cassettes">${cassettes}</div>
      </details>`);
    }
    return sections.join("");
  }

  function renderModeSelect(name, mode, inheritOption) {
    const modes = inheritOption
      ? [{ id: "inherit", label: "inherit (group/tenant)" }, { id: "core", label: "core" }, { id: "fleet", label: "fleet" }, { id: "custom", label: "custom" }]
      : [{ id: "core", label: "core" }, { id: "fleet", label: "fleet" }, { id: "custom", label: "custom" }];
    return modes
      .map(
        (m) => `<label class="cs-field cs-field--radio">
          <input type="radio" name="${esc(name)}" class="pc-grant-mode" value="${m.id}" ${mode === m.id ? "checked" : ""} />
          <span class="cs-field-label">${esc(m.label)}</span>
        </label>`,
      )
      .join("");
  }

  function readMode(root, name) {
    const checked = root.querySelector(`input.pc-grant-mode[name="${name}"]:checked`);
    return checked?.value || "core";
  }

  function collectFromTree(root, baseEntitlements, catalog, opts = {}) {
    const prefix = opts.classPrefix || "pc-catalog";
    const lib = global.PockitCatalogEntitlements;
    let ent = normalizeEnt(baseEntitlements);
    const mode = opts.mode || ent.mode || "custom";
    ent.mode = mode;
    if (mode !== "custom" || !catalog) return ent;
    if (lib?.seedEntitlementsFromCatalog) {
      ent = lib.seedEntitlementsFromCatalog(catalog, ent);
    }
    root.querySelectorAll(`.${prefix}-player-cb`).forEach((cb) => {
      const pid = cb.dataset.playerId;
      if (!ent.players[pid]) ent.players[pid] = { enabled: true, cassettes: {} };
      ent.players[pid].enabled = cb.checked;
    });
    root.querySelectorAll(`.${prefix}-cassette-cb`).forEach((cb) => {
      const pid = cb.dataset.playerId;
      const cid = cb.dataset.cassetteId;
      if (!ent.players[pid]) ent.players[pid] = { enabled: true, cassettes: {} };
      if (!ent.players[pid].cassettes) ent.players[pid].cassettes = {};
      ent.players[pid].cassettes[cid] = { enabled: cb.checked };
    });
    return ent;
  }

  function bindGrantTree(root, opts = {}) {
    const prefix = opts.classPrefix || "pc-catalog";
    const onModeChange = opts.onModeChange;
    const modeName = opts.modeName || "pc-grant-mode";
    if (!opts.skipModeSync) {
      const syncTree = () => {
        const mode = readMode(root, modeName);
        const show = mode === "custom";
        root.querySelectorAll(".pc-grant-tree-wrap").forEach((el) => {
          el.hidden = !show;
          el.setAttribute("aria-hidden", show ? "false" : "true");
        });
        if (onModeChange) onModeChange(mode);
      };
      root.querySelectorAll(`input.pc-grant-mode[name="${modeName}"]`).forEach((radio) => {
        radio.addEventListener("change", syncTree);
      });
      syncTree();
    }
    root.querySelectorAll(`.${prefix}-player-cb`).forEach((cb) => {
      cb.addEventListener("change", () => {
        const pid = cb.dataset.playerId;
        root.querySelectorAll(`.${prefix}-cassette-cb[data-player-id="${pid}"]`).forEach((child) => {
          child.checked = cb.checked;
          child.disabled = !cb.checked;
        });
      });
    });
  }

  function fleetCatalog() {
    return global.POCKIT_FLEET_CATALOG || global.POCKIT_CATALOG;
  }

  function seedCustomEntitlements(existing) {
    const lib = global.PockitCatalogEntitlements;
    const catalog = fleetCatalog();
    const base = normalizeEnt(existing || { mode: "custom", players: {} });
    base.mode = "custom";
    if (catalog && lib?.seedEntitlementsFromCatalog) {
      return lib.seedEntitlementsFromCatalog(catalog, base);
    }
    return base;
  }

  global.PockitCatalogGrantTree = {
    esc,
    renderPlayerTree,
    renderModeSelect,
    readMode,
    collectFromTree,
    bindGrantTree,
    fleetCatalog,
    seedCustomEntitlements,
    normalizeEnt,
  };
})(window);