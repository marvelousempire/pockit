/**
 * Plan 0461 — browser mirror of src/cassette-framework/pockit-catalog-entitlements.js
 */
(function (global) {
  const CATALOG_MODES = ["core", "fleet", "custom"];
  const DEFAULT_CATALOG_ENTITLEMENTS = { schema_version: 1, mode: "fleet", players: {} };
  const STORAGE_KEY = "nephew-pockit-catalog-entitlements";

  function normalizeCatalogEntitlements(entitlements) {
    const base = { ...DEFAULT_CATALOG_ENTITLEMENTS, ...(entitlements || {}) };
    if (!CATALOG_MODES.includes(base.mode)) base.mode = "fleet";
    base.players = base.players && typeof base.players === "object" ? base.players : {};
    return base;
  }

  function cassetteEnabled(playerEnt, cassetteId) {
    const map = playerEnt?.cassettes;
    if (!map || typeof map !== "object") return true;
    const row = map[cassetteId];
    if (row && row.enabled === false) return false;
    return true;
  }

  function playerEnabled(entitlements, playerId) {
    const row = entitlements.players?.[playerId];
    if (row && row.enabled === false) return false;
    return true;
  }

  function seedEntitlementsFromCatalog(catalog, existing) {
    const ent = normalizeCatalogEntitlements(existing);
    const players = { ...ent.players };
    for (const p of catalog?.players || []) {
      const prev = players[p.id] || {};
      const cassettes = { ...(prev.cassettes || {}) };
      for (const c of p.hosted_cassettes || []) {
        if (!cassettes[c.id]) cassettes[c.id] = { enabled: true };
      }
      players[p.id] = { enabled: prev.enabled !== false, cassettes };
    }
    if ((catalog?.unassigned_cassettes || []).length) {
      const prev = players._unassigned || {};
      const cassettes = { ...(prev.cassettes || {}) };
      for (const c of catalog.unassigned_cassettes) {
        if (!cassettes[c.id]) cassettes[c.id] = { enabled: true };
      }
      players._unassigned = { enabled: prev.enabled !== false, cassettes };
    }
    return { ...ent, players };
  }

  function filterCatalogByEntitlements(catalog, entitlements) {
    const ent = normalizeCatalogEntitlements(entitlements);
    if (ent.mode === "core") return null;
    if (!catalog) return catalog;
    if (ent.mode === "fleet") return catalog;

    const players = (catalog.players || [])
      .filter((p) => playerEnabled(ent, p.id))
      .map((p) => {
        const pe = ent.players[p.id];
        const hosted = (p.hosted_cassettes || []).filter((c) => cassetteEnabled(pe, c.id));
        return { ...p, hosted_cassettes: hosted, hosted_count: hosted.length };
      })
      .filter((p) => (p.hosted_cassettes || []).length > 0 || ent.players[p.id]?.enabled !== false);

    let unassigned = catalog.unassigned_cassettes || [];
    const unEnt = ent.players._unassigned;
    if (unEnt?.cassettes) {
      unassigned = unassigned.filter((c) => cassetteEnabled(unEnt, c.id));
    } else if (unEnt?.enabled === false) {
      unassigned = [];
    }

    return {
      ...catalog,
      players,
      player_count: players.length,
      unassigned_cassettes: unassigned,
      cassette_count:
        players.reduce((n, p) => n + (p.hosted_cassettes?.length || 0), 0) + unassigned.length,
    };
  }

  function loadFromStorage() {
    try {
      return normalizeCatalogEntitlements(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      return normalizeCatalogEntitlements({});
    }
  }

  function saveToStorage(entitlements) {
    const ent = normalizeCatalogEntitlements(entitlements);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ent));
    global.dispatchEvent(new CustomEvent("nephew-pockit-catalog-entitlements", { detail: { entitlements: ent } }));
    return ent;
  }

  function stashMeta(payload) {
    if (payload && typeof payload === "object") {
      global.POCKIT_ENTITLEMENTS_META = {
        resolved_from: payload.resolved_from,
        tenant: payload.tenant,
        is_operator: payload.is_operator,
        can_request_full_catalog: payload.can_request_full_catalog,
      };
    }
  }

  async function loadEntitlements() {
    try {
      const res = await fetch("/api/v1/family/me/pockit-catalog-entitlements", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const payload = await res.json();
        stashMeta(payload);
        const data = payload.data || payload;
        if (data?.mode) return saveToStorage(data);
      }
    } catch {
      /* signed-out or tower-api offline */
    }
    try {
      const res = await fetch("/api/v1/operator/config/pockit-catalog-entitlements", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const payload = await res.json();
        const data = payload.data || payload;
        if (data?.mode) {
          global.POCKIT_ENTITLEMENTS_META = { resolved_from: "operator_preview", is_operator: true, can_request_full_catalog: true };
          return saveToStorage(data);
        }
      }
    } catch {
      /* tower-api offline — local cache */
    }
    return loadFromStorage();
  }

  async function saveEntitlements(entitlements) {
    const ent = saveToStorage(entitlements);
    try {
      const res = await fetch("/api/v1/operator/config/pockit-catalog-entitlements", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ent),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      return { entitlements: ent, warning: e.message || String(e) };
    }
    return { entitlements: ent };
  }

  global.PockitCatalogEntitlements = {
    CATALOG_MODES,
    DEFAULT_CATALOG_ENTITLEMENTS,
    STORAGE_KEY,
    normalizeCatalogEntitlements,
    seedEntitlementsFromCatalog,
    filterCatalogByEntitlements,
    loadFromStorage,
    saveToStorage,
    loadEntitlements,
    saveEntitlements,
  };
})(window);