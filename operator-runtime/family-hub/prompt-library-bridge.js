/**
 * Cross-surface prompt library bridge — consume nephew.promptLibrary.pending
 * on Hello, Odysseus, Control Tower family-hub pads.
 */
(function (global) {
  const STORAGE_PENDING = "nephew.promptLibrary.pending";
  const MAX_AGE_MS = 10 * 60 * 1000;

  function readPending() {
    try {
      const raw = sessionStorage.getItem(STORAGE_PENDING);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data?.body || !data?.at) return null;
      if (Date.now() - Number(data.at) > MAX_AGE_MS) {
        sessionStorage.removeItem(STORAGE_PENDING);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(STORAGE_PENDING);
    } catch { /* ignore */ }
  }

  function showToast(message) {
    let el = document.getElementById("prompt-library-bridge-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "prompt-library-bridge-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:9999;padding:0.6rem 1rem;border-radius:0.5rem;background:#1a1a2e;color:#eee;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.35);max-width:90vw;";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 5000);
  }

  /**
   * @param {object} opts
   * @param {(text: string) => void} [opts.setInput]
   * @param {() => void | Promise<void>} [opts.autoSend]
   * @param {string} [opts.surface]
   * @param {boolean} [opts.autoSendDefault]
   */
  function consumePendingPrompt(opts = {}) {
    const pending = readPending();
    if (!pending) return null;
    const title = pending.title || pending.id || "Prompt Library";
    const body = String(pending.body || "").trim();
    if (!body) return null;

    if (typeof opts.setInput === "function") {
      opts.setInput(body);
    }
    showToast(`Loaded prompt from Pockit: ${title}`);
    clearPending();

    const shouldSend = opts.autoSendDefault !== false && typeof opts.autoSend === "function";
    if (shouldSend) {
      Promise.resolve(opts.autoSend()).catch(() => {});
    }
    return pending;
  }

  function setPending(payload) {
    try {
      sessionStorage.setItem(STORAGE_PENDING, JSON.stringify({
        ...payload,
        at: Date.now(),
      }));
    } catch { /* ignore */ }
  }

  global.PromptLibraryBridge = {
    STORAGE_PENDING,
    MAX_AGE_MS,
    readPending,
    clearPending,
    consumePendingPrompt,
    setPending,
    showToast,
  };
})(typeof window !== "undefined" ? window : globalThis);
