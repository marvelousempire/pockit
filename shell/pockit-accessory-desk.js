(function (global) {
  /** Plan 0301 — Pockit Accessory Desk API (tower-api first; Suite fallback). */
  const TOWER = "/api/v1/mac-accessories";
  const SUITE_ORIGIN = "http://suite.localhost";

  function show(msg, opts) {
    const fn = global.PockitTahoeToast?.show || global.alert;
    fn(msg, opts);
  }

  async function towerFetch(path, body) {
    const res = await fetch(`${TOWER}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `tower ${res.status}`);
      err.payload = data;
      throw err;
    }
    return data;
  }

  async function suiteFetch(path, body) {
    const res = await fetch(`${SUITE_ORIGIN}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "omit",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `suite ${res.status}`);
      err.payload = data;
      throw err;
    }
    return data;
  }

  async function withFallback(towerPath, towerBody, suitePath, suiteBody) {
    try {
      return await towerFetch(towerPath, towerBody);
    } catch (towerErr) {
      if (towerErr.payload?.error === "mac_only" || towerErr.payload?.error === "not_found") {
        throw towerErr;
      }
      return suiteFetch(suitePath, suiteBody);
    }
  }

  async function fetchSummary() {
    return withFallback("/summary", null, "/api/accessory-summary", null);
  }

  async function install(appId) {
    return withFallback("/install", { appId }, "/api/install-mac", { appId });
  }

  async function launch(appId) {
    return withFallback("/launch", { appId }, "/api/launch", { appId });
  }

  async function openApp(appId) {
    return withFallback("/open-app", { appId }, "/api/open-app", { appId });
  }

  async function installMissing() {
    const overlay = document.getElementById("overlay");
    try {
      show("Installing missing Desktop accessories…", { duration: 4000 });
      const result = await withFallback("/install-missing", {}, "/api/install-missing", {});
      if (result.ok) {
        show(result.message || `Installed ${(result.installed || []).length} app(s) on Desktop`, { duration: 5000 });
      } else {
        show(result.message || "Some installs need attention — see Accessory Desk", { duration: 6000 });
      }
      await global.PockitAccessoryDeskPanel?.refresh?.();
      return result;
    } catch (e) {
      show("Accessory API offline — ensure tower-api on this Mac, then retry", { duration: 6000 });
      throw e;
    } finally {
      overlay?.classList?.remove?.("is-visible");
    }
  }

  global.PockitAccessoryDesk = {
    fetchSummary,
    install,
    launch,
    openApp,
    installMissing,
    TOWER,
    SUITE_ORIGIN,
  };
})(window);