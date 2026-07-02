/**
 * Pockit Intention Badge — yellow promise ribbon on tiles (Plan 0298 / DOI Phase 3).
 * Uses DeclarationOfIntentAdapters + DeclarationOfIntentPanel when present.
 */
(function () {
  "use strict";

  var REGISTRY_URL = "/mac-app-intent-registry.json";
  var HUB_TO_APP = {
    voice: "voice",
    video: "video",
    "super-rick": "voice",
    "super-rick-video": "video",
  };

  var registryPromise = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fetchRegistry() {
    if (!registryPromise) {
      registryPromise = fetch(REGISTRY_URL, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .catch(function () {
          return { apps: {} };
        });
    }
    return registryPromise;
  }

  function resolveDeclarationSync(card, registryDoc) {
    var Adapters = window.DeclarationOfIntentAdapters;
    if (!Adapters) return null;
    if (card.declaration) return Adapters.resolveFromProto({ declaration: card.declaration, title: card.title });
    if (card.intention) return Adapters.fromPockitArtifact(card, { title: card.title, slug: card.id });
    var appId = HUB_TO_APP[card.id];
    if (appId && registryDoc && registryDoc.apps && registryDoc.apps[appId]) {
      var row = registryDoc.apps[appId];
      return Adapters.resolveFromProto(
        Object.assign({ appId: appId, displayName: row.displayName || card.title }, row),
      );
    }
    return null;
  }

  function renderPanelHtml(doi) {
    var Panel = window.DeclarationOfIntentPanel;
    if (Panel) return Panel.renderPanelHtml(doi, { articleClass: "pad-cl-intent-panel" });
    return "<p>Intent panel unavailable.</p>";
  }

  function openModal(doi, title) {
    if (!doi) return;
    var backdrop = document.createElement("div");
    backdrop.className = "intention-modal-backdrop fo-proto-modal-backdrop";
    backdrop.innerHTML =
      '<div class="fo-proto-modal intention-modal" role="dialog" aria-modal="true">' +
      '<h2 id="intention-modal-title">' +
      esc(title || doi.title || "Declaration of Intent") +
      "</h2>" +
      renderPanelHtml(doi) +
      '<button type="button" class="fo-proto-modal__close intention-modal__close">Close</button></div>';
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
    backdrop.querySelector(".intention-modal__close").addEventListener("click", function () {
      backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  function badgeHtml(cardId) {
    return (
      '<button type="button" class="intention-badge" data-intention-badge="' +
      esc(cardId) +
      '" title="Why this exists — Declaration of Intent" aria-label="Open Declaration of Intent">' +
      '<span class="intention-badge__glyph" aria-hidden="true">🎗</span>' +
      '<span class="intention-badge__label">Intent</span></button>'
    );
  }

  function badgeHtmlForHubCard(card) {
    if (!card || !card.id) return "";
    if (!card.declaration && !card.intention && !HUB_TO_APP[card.id]) return "";
    return badgeHtml(card.id);
  }

  function attachDelegates(root) {
    var el = root || document;
    el.querySelectorAll("[data-intention-badge]").forEach(function (btn) {
      if (btn.dataset.intentionBound === "1") return;
      btn.dataset.intentionBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute("data-intention-badge");
        openForCardId(id);
      });
    });
  }

  function openForCardId(cardId) {
    fetchRegistry().then(function (doc) {
      var card = null;
      try {
        if (window.hubCardById) card = window.hubCardById(cardId);
      } catch (_) {}
      if (!card) card = { id: cardId, title: cardId };
      var doi = resolveDeclarationSync(card, doc);
      if (!doi) return;
      openModal(doi, card.title || doi.title);
    });
  }

  window.PockitIntentionBadge = {
    badgeHtml: badgeHtml,
    badgeHtmlForHubCard: badgeHtmlForHubCard,
    attachDelegates: attachDelegates,
    openForCardId: openForCardId,
    openModal: openModal,
    resolveDeclarationSync: resolveDeclarationSync,
  };

  document.addEventListener("DOMContentLoaded", function () {
    attachDelegates(document);
  });
})();
