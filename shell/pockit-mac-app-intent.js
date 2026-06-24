/**
 * Plan 0285 — Mac .app intent chrome in Pockit shell + tape doors.
 * Pockit weave updates dispatch `nephew-mac-app-intent` events.
 */
(function () {
  "use strict";

  function currentMacAppId() {
    try {
      var fromUrl = new URLSearchParams(location.search).get("mac_app");
      if (fromUrl && /^[\w-]+$/.test(fromUrl)) return fromUrl;
    } catch (_) {}
    try {
      var stored = localStorage.getItem("nephew-pockit-mac-app");
      if (stored && /^[\w-]+$/.test(stored)) return stored;
    } catch (_) {}
    return "pockit";
  }

  function syncIntent() {
    var id = currentMacAppId();
    if (window.NephewMacAppIntent && typeof window.NephewMacAppIntent.mount === "function") {
      window.NephewMacAppIntent.mount(id);
    }
  }

  window.addEventListener("storage", function (e) {
    if (e.key === "nephew-pockit-mac-app") syncIntent();
  });

  document.addEventListener("nephew-mac-app-intent", syncIntent);

  window.PockitMacAppIntentBridge = { sync: syncIntent };
})();
