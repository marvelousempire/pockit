(function (global) {
// Plan 0261 / 0292 — Pockit Accessory weave: left rail = Desktop accessories, right = cartridges + Projection.

const LAUNCHPAD_SHORTCUTS = (() => {
  const V = window.VoiceAppDisplay || { name: "Super Rick", alias: "Rick", glyph: "🗣️" };
  return [
  { id: "overview", title: "Overview", glyph: "📼", subtitle: "All cartridges grid", type: "overview" },
  { id: "library", title: "Library", glyph: "📚", subtitle: "Catalog", type: "library" },
  { id: "voice", title: V.name, glyph: V.glyph, subtitle: `${V.alias} — voice-first AI agent`, type: "load", _registryId: "voice" },
];
})();

/** Plan 0295 — Suite embed in Pockit center; Desktop install inventory + one-tap install. */
const ACCESSORY_DESK_ITEM = {
  id: "accessory-desk",
  title: "Accessory Desk",
  symbol: "Ad",
  hue: 248,
  subtitle: "Install · Door · Desktop .app",
  type: "accessory-desk",
  _macAppId: "accessory-desk",
};

function accessoryDeskRightItems() {
  return [
    {
      id: "desk-install-missing",
      title: "Install all missing",
      glyph: "⬇",
      subtitle: "Every .app not on Desktop yet",
      type: "accessory-desk-action",
      _deskAction: "install-missing",
    },
    {
      id: "desk-refresh",
      title: "Refresh status",
      glyph: "↻",
      subtitle: "Re-scan Desktop inventory",
      type: "accessory-desk-action",
      _deskAction: "refresh",
    },
  ];
}

function accessoryPerAppActions(app) {
  if (!app?.bundleDir || app.id === "pockit") return [];
  return [
    {
      id: `mac-install-${app.id}`,
      title: `Install ${app.displayName}`,
      glyph: "⬇",
      subtitle: app.bundleDir,
      type: "accessory-desk-action",
      _macAppId: app.id,
      _deskAction: "install",
    },
    {
      id: `mac-open-app-${app.id}`,
      title: `Launch ${app.bundleDir}`,
      glyph: "📲",
      subtitle: "Desktop .app",
      type: "accessory-desk-action",
      _macAppId: app.id,
      _deskAction: "open-app",
    },
  ];
}

function accessoryTileSubtitle(app) {
  if (app.accessory_category_label) return app.accessory_category_label;
  if (app.door) return app.door.replace(/^https?:\/\//, "");
  return app.surface_kind || "";
}

function macAppToLeftItem(app) {
  return {
    id: `mac-app-${app.id}`,
    title: app.displayName || app.id,
    symbol: app.symbol,
    hue: app.hue,
    subtitle: accessoryTileSubtitle(app),
    type: "mac-app",
    _macAppId: app.id,
    _accessoryCategory: app.accessory_category || null,
  };
}

function navToRightItem(app, navRow) {
  return {
    id: `mac-nav-${app.id}-${navRow.id}`,
    title: navRow.label,
    glyph: "·",
    subtitle: navRow.path || "",
    type: "mac-app-nav",
    _macAppId: app.id,
    _navPath: navRow.path || app.door,
  };
}

function openDoorItem(app) {
  return {
    id: `mac-open-${app.id}`,
    title: `Open ${app.displayName}`,
    glyph: "🖥",
    subtitle: "Projection",
    type: "mac-app-open",
    _macAppId: app.id,
    _door: app.door,
  };
}

function hostedCassettesForPlayer(catalog, playerId) {
  if (!playerId || !catalog?.players) return [];
  const player = catalog.players.find((p) => p.id === playerId);
  return player?.hosted_cassettes || [];
}

function cassetteToItem(c, toSidebarItem) {
  if (toSidebarItem) return toSidebarItem(c);
  return {
    id: c.hub_card_id || c.id,
    title: c.name || c.id,
    glyph: c.glyph || "📼",
    subtitle: c.sidebar_group || c.niche || "",
    type: "load",
    _registryId: c.id,
  };
}

function buildMacAppWeave(opts = {}) {
  const catalog = opts.catalog || { players: [], mac_apps: [] };
  const macApps = catalog.mac_apps || [];
  const activeMacAppId = opts.activeMacAppId || null;
  const activeCassetteId = opts.activeCassetteId || null;

  const accessoryMacApps = macApps.filter((a) => a.id !== "suite");
  const leftSections = [
    { section: "Pockit", items: [...LAUNCHPAD_SHORTCUTS] },
    {
      section: "Accessories",
      items: [ACCESSORY_DESK_ITEM, ...accessoryMacApps.map(macAppToLeftItem)],
    },
  ];

  let rightSections = [{ section: "Select an accessory", items: [] }];
  let emptyRightMessage = "Choose an Accessory on the left to see its cartridges and Projection.";

  if (activeMacAppId === "accessory-desk") {
    rightSections = [{ section: "Accessory Desk", items: accessoryDeskRightItems() }];
    emptyRightMessage = null;
  }

  const activeApp = activeMacAppId && activeMacAppId !== "accessory-desk"
    ? macApps.find((a) => a.id === activeMacAppId)
    : null;

  if (activeApp) {
    const rightItems = [openDoorItem(activeApp), ...accessoryPerAppActions(activeApp)];

    for (const navRow of activeApp.nav || []) {
      rightItems.push(navToRightItem(activeApp, navRow));
    }

    if (activeApp.player_id === "pockit" || activeApp.id === "pockit") {
      const pockitHosted = hostedCassettesForPlayer(catalog, "pockit");
      for (const c of pockitHosted) {
        const item = cassetteToItem(c, opts.toSidebarItem);
        if (item) rightItems.push(item);
      }
    } else if (activeApp.player_id) {
      const hosted = hostedCassettesForPlayer(catalog, activeApp.player_id);
      if (hosted.length) {
        for (const c of hosted) {
          const item = cassetteToItem(c, opts.toSidebarItem);
          if (item) rightItems.push(item);
        }
      }
    }

    if (activeApp.cassette_id && activeApp.player_id !== "pockit") {
      const linked = hostedCassettesForPlayer(catalog, activeApp.player_id).find(
        (c) => c.id === activeApp.cassette_id,
      ) || { id: activeApp.cassette_id, name: activeApp.displayName, hub_card_id: activeApp.cassette_id };
      const linkedItem = cassetteToItem(linked, opts.toSidebarItem);
      if (linkedItem && !rightItems.some((i) => i.id === linkedItem.id)) {
        rightItems.splice(1, 0, linkedItem);
      }
    }

    rightSections = [{ section: activeApp.displayName, items: rightItems }];
    emptyRightMessage = null;

    if (activeCassetteId && opts.findCatalogEntry) {
      const enriched = opts.findCatalogEntry(activeCassetteId);
      const elements = [];
      for (const sr of enriched?.subroutes || []) {
        elements.push({
          id: `${activeCassetteId}::${sr.path || sr.label}`,
          title: sr.label || sr.path || "Page",
          glyph: "·",
          subtitle: sr.path || "",
          type: "element",
          _subrouteParent: activeCassetteId,
          _subroutePath: sr.path || null,
        });
      }
      if (elements.length) {
        rightSections.push({
          section: `${activeApp.displayName} · Pages`,
          items: elements,
        });
      }
    }
  } else if (!activeMacAppId && (activeCassetteId === "overview" || activeCassetteId === "library")) {
    rightSections = [{ section: "Cartridges", items: [] }];
    emptyRightMessage = null;
  }

  return {
    leftSections,
    rightSections,
    emptyRightMessage,
    activeMacAppId,
    activeCassetteId,
    mode: "mac-app-weave",
  };
}

function manifestNavToItem(row, cassetteId, speakersDoor) {
  if (row.speakers_only) {
    const door = row.speakers_door || speakersDoor || "";
    return {
      id: `enc-${cassetteId}-${row.id}`,
      title: row.label,
      glyph: row.glyph || "↗",
      subtitle: "Projection",
      type: "encompass-nav",
      _encompassCassetteId: cassetteId,
      _speakersOnly: true,
      _speakersDoor: door,
    };
  }
  if (row.path) {
    return {
      id: `enc-${cassetteId}-${row.id}`,
      title: row.label,
      glyph: row.glyph || "·",
      subtitle: row.path,
      type: "encompass-nav",
      _encompassCassetteId: cassetteId,
      _encompassPath: row.path,
      _speakersOnly: false,
    };
  }
  return {
    id: `enc-${cassetteId}-${row.id}`,
    title: row.label,
    glyph: row.glyph || "·",
    subtitle: row.center_panel || row.label,
    type: "encompass-nav",
    _encompassCassetteId: cassetteId,
    _centerPanel: row.center_panel || row.id,
    _speakersOnly: false,
  };
}

function speakersProjectionItem(cid, door) {
  return {
    id: `enc-${cid}-speakers`,
    title: "Open full app",
    glyph: "🖥",
    subtitle: "Projection",
    type: "encompass-nav",
    _encompassCassetteId: cid,
    _speakersOnly: true,
    _speakersDoor: door,
  };
}

/** Plan 0268 — zone weave from signed encompass manifest. */
function buildCassetteWeaveFromManifest(manifest) {
  if (!manifest?.cassette_id) return null;
  const cid = manifest.cassette_id;
  const door = manifest.speakers_door || "";
  const leftItems = (manifest.left_nav || []).map((r) => manifestNavToItem(r, cid, door));
  const leftLabel = manifest.left_nav_label || manifest.cassette_id;

  let rightSections = [];
  if (manifest.nav_sections?.length) {
    for (const sec of manifest.nav_sections) {
      const items = (sec.items || []).map((r) => manifestNavToItem(r, cid, door));
      if (items.length) rightSections.push({ section: sec.label || sec.id, items });
    }
    if (rightSections.length) {
      rightSections[0].items.unshift(speakersProjectionItem(cid, door));
    }
  } else {
    const rightItems = (manifest.nav || []).map((r) => manifestNavToItem(r, cid, door));
    rightItems.unshift(speakersProjectionItem(cid, door));
    const rightLabel = manifest.nav_label || manifest.cassette_id;
    rightSections = [{ section: rightLabel, items: rightItems }];
  }

  const bottomItems = (manifest.bottom_nav || []).map((r) => manifestNavToItem(r, cid, door));
  const bottomLabel = manifest.bottom_nav_label || "Quick";

  return {
    leftSections: leftItems.length ? [{ section: leftLabel, items: leftItems }] : [],
    rightSections,
    bottomSections: bottomItems.length ? [{ section: bottomLabel, items: bottomItems }] : [],
    emptyRightMessage: null,
    mode: "encompass-weave",
  };
}

/** @deprecated Plan 0173 launchpad weave — use buildMacAppWeave when mac_apps present. */
function buildPockitWeave(opts = {}) {
  if ((opts.catalog?.mac_apps || []).length) {
    return buildMacAppWeave(opts);
  }
  return buildMacAppWeave({ ...opts, activeMacAppId: null });
}

global.PockitWeave = {
  LAUNCHPAD_SHORTCUTS,
  LAUNCHPAD_LEFT_ITEMS: LAUNCHPAD_SHORTCUTS,
  ACCESSORY_DESK_ITEM,
  buildMacAppWeave,
  buildCassetteWeaveFromManifest,
  buildPockitWeave,
};
})(window);
