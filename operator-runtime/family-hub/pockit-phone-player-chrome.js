/**
 * Plan 0274+ — Player-aware phone chrome (left / right / bottom rails per player scope).
 *
 * Each player or cassette scope can register labels and optional custom renderers.
 * Default renderers delegate to __pockitPhoneRailBridge (same HTML as desktop rails).
 */
(function () {
  "use strict";

  /** @type {Map<string, { labels?: { left?: string, right?: string, bottom?: string }, renderLeft?: Function, renderRight?: Function }>} */
  const providers = new Map();

  function currentScope() {
    return window.__pockitFooterScope || "overview";
  }

  function bridge() {
    return window.__pockitPhoneRailBridge || null;
  }

  function providerForScope(scope) {
    if (providers.has(scope)) return providers.get(scope);
    if (scope.startsWith("player:")) {
      const playerId = scope.slice(7);
      if (providers.has(`player:${playerId}`)) return providers.get(`player:${playerId}`);
    }
    return providers.get("*") || null;
  }

  function register(scope, provider) {
    if (!scope || !provider) return;
    providers.set(scope, provider);
  }

  function getLabels() {
    const scope = currentScope();
    const custom = providerForScope(scope);
    const base = bridge()?.getLabels?.() || {
      left: "Players",
      right: "Cassettes",
      bottom: "Controls",
      hasTapeRails: false,
    };
    return {
      left: custom?.labels?.left || base.left,
      right: custom?.labels?.right || base.right,
      bottom: custom?.labels?.bottom || base.bottom,
      hasTapeRails: base.hasTapeRails,
      scope,
    };
  }

  async function renderLeftHtml() {
    const scope = currentScope();
    const custom = providerForScope(scope);
    if (typeof custom?.renderLeft === "function") {
      return custom.renderLeft();
    }
    const b = bridge();
    if (!b?.getLeftHtml) return { html: "", voice: false };
    return b.getLeftHtml();
  }

  async function renderRightHtml() {
    const scope = currentScope();
    const custom = providerForScope(scope);
    if (typeof custom?.renderRight === "function") {
      return custom.renderRight();
    }
    const b = bridge();
    if (!b?.getRightHtml) return { html: "", voice: false };
    return b.getRightHtml();
  }

  function bindRailRoot(rootEl, { voice = false } = {}) {
    if (!rootEl) return;
    const sel = `#${rootEl.id}`;
    bridge()?.bindPanel?.(sel, { voice });
  }

  async function paintLeft(rootEl) {
    if (!rootEl) return;
    const { html, voice } = await renderLeftHtml();
    rootEl.innerHTML = `<div class="pockit-phone-rail pockit-phone-rail--left pockit-mobile-hud__rail pockit-mobile-hud__rail--grid">${html || '<p class="pockit-rail-empty">No player controls for this view.</p>'}</div>`;
    bindRailRoot(rootEl, { voice });
  }

  async function paintRight(rootEl) {
    if (!rootEl) return;
    const { html, voice } = await renderRightHtml();
    rootEl.innerHTML = `<div class="pockit-phone-rail pockit-phone-rail--right pockit-mobile-hud__rail pockit-mobile-hud__rail--grid">${html || '<p class="pockit-rail-empty">No stack controls for this view.</p>'}<pre class="rail-make-log hidden" aria-live="polite"></pre></div>`;
    bindRailRoot(rootEl, { voice });
  }

  function refreshVoiceHighlights() {
    if (!bridge()?.isTape?.()) return;
    const st = window.ParakeetVoicePad?.getState?.() || {};
    window.highlightVoiceRailSelections?.(st);
  }

  window.PockitPhonePlayerChrome = {
    register,
    getLabels,
    renderLeftHtml,
    renderRightHtml,
    paintLeft,
    paintRight,
    refreshVoiceHighlights,
    providerForScope,
  };

  register("voice", {
    labels: { left: "Controller", right: "Stack", bottom: "Session" },
  });
})();
