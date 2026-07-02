/**
 * Plan 0269 — browser bridge for Pockit Dynamic Token resolver (vanilla shell).
 * Node canonical: src/cassette-framework/pockit-token-resolver.js
 */
(function () {
  function canonicalRef(rawId) {
    const id = String(rawId || "").trim();
    if (!id) return "";
    if (id.startsWith("mac-app-")) return id.slice("mac-app-".length);
    const macApps = window.POCKIT_CATALOG?.mac_apps || [];
    const mac = macApps.find((a) => a.id === id || a.player_id === id || a.door_slug === id);
    if (mac) return mac.id;
    return id;
  }

  function familyEmbedStemAllowed(stem) {
    const s = String(stem || "").trim().replace(/\.localhost$/i, "");
    if (!s) return false;
    const stems = window.POCKIT_CATALOG?.family_embed_stems;
    if (Array.isArray(stems) && stems.includes(s)) return true;
    const macApps = window.POCKIT_CATALOG?.mac_apps || [];
    return macApps.some((a) => a.door_slug === s || a.id === s);
  }

  function resolvePlaybackFields(card, catalogEntry) {
    if (!card || card.type === "overview" || card.type === "library") return card;
    if (card._play_shell || card._open_path) return card;

    const hubId = card.id;
    if (card._macAppId || String(hubId || "").startsWith("mac-app-")) {
      return { ...card, iframe: card.iframe !== false };
    }

    const surface = catalogEntry?.surface || catalogEntry?.settings?.surface || {};
    if (surface.pockit_pad || surface.type === "voice" || surface.type === "knowledge") {
      return { ...card, _pockit_pad: true, _pad_type: surface.type };
    }

    const surfacePath = surface.center_path;
    const libTape =
      typeof libraryTapeByCardId === "function" ? libraryTapeByCardId(hubId) : null;
    const rawPath =
      surfacePath ||
      libTape?.open_path ||
      catalogEntry?.path ||
      (typeof tapeOpenPath === "function" ? tapeOpenPath(card) : null) ||
      null;

    if (rawPath && rawPath !== "/") {
      let openPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      if (openPath.startsWith("/hello") && !openPath.endsWith("/")) openPath += "/";
      return { ...card, _open_path: openPath, _play_shell: null };
    }

    if (typeof isTape === "function" && isTape()) {
      return { ...card, _play_shell: `/play/${hubId}/`, iframe: card.iframe !== false };
    }
    return card;
  }

  window.PockitTokenBridge = {
    canonicalRef,
    familyEmbedStemAllowed,
    resolvePlaybackFields,
  };
})();
