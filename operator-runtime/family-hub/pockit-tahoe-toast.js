/**
 * Pockit Tahoe toast — macOS glass notification stack (Plan 0287).
 * window.PockitToast.show({ title, body, icon?, duration?, action? })
 */
(function () {
  "use strict";

  var DEFAULT_ICON_URL = "/icons/pockit-icon-192.png";

  var stackEl = null;
  var seq = 0;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStack() {
    if (stackEl) return stackEl;
    stackEl = document.createElement("div");
    stackEl.className = "pockit-toast-stack";
    stackEl.setAttribute("aria-live", "polite");
    stackEl.setAttribute("aria-relevant", "additions");
    document.body.appendChild(stackEl);
    return stackEl;
  }

  function dismiss(toastEl) {
    if (!toastEl || toastEl.dataset.dismissed === "1") return;
    toastEl.dataset.dismissed = "1";
    toastEl.classList.add("is-leaving");
    window.setTimeout(function () {
      toastEl.remove();
    }, 280);
  }

  function show(opts) {
    opts = opts || {};
    var title = opts.title != null ? String(opts.title) : "Pockit";
    var body = opts.body != null ? String(opts.body) : "";
    var duration = typeof opts.duration === "number" ? opts.duration : 6500;
    var id = "pockit-toast-" + ++seq;

    var iconHtml = "";
    if (opts.iconUrl) {
      iconHtml = '<img src="' + esc(opts.iconUrl) + '" alt="" />';
    } else if (opts.iconSvg) {
      iconHtml = opts.iconSvg;
    } else if (opts.iconUrl !== false) {
      iconHtml = '<img src="' + esc(DEFAULT_ICON_URL) + '" alt="" />';
    }

    var toast = document.createElement("div");
    toast.className = "pockit-toast";
    toast.id = id;
    toast.setAttribute("role", "status");
    toast.innerHTML =
      '<div class="pockit-toast__icon">' +
      iconHtml +
      "</div>" +
      '<div class="pockit-toast__text">' +
      '<div class="pockit-toast__title">' +
      esc(title) +
      "</div>" +
      (body ? '<div class="pockit-toast__body">' + esc(body) + "</div>" : "") +
      "</div>" +
      '<button type="button" class="pockit-toast__close" aria-label="Dismiss">×</button>';

    toast.querySelector(".pockit-toast__close").addEventListener("click", function () {
      dismiss(toast);
    });

    if (typeof opts.action === "function") {
      toast.style.cursor = "pointer";
      toast.addEventListener("click", function (e) {
        if (e.target.closest(".pockit-toast__close")) return;
        opts.action();
        dismiss(toast);
      });
    }

    ensureStack().appendChild(toast);

    if (duration > 0) {
      window.setTimeout(function () {
        dismiss(toast);
      }, duration);
    }

    return id;
  }

  function wirePockitEvents() {
    document.addEventListener("pockit-update-available", function (e) {
      var d = (e && e.detail) || {};
      var latest = d.latestVersion;
      var running = d.runningVersion;
      if (!latest) return;
      show({
        title: "Update available",
        body:
          "Pockit v" +
          latest +
          " is ready" +
          (running ? " — you're on v" + running + "." : ".") +
          " Tap to load it.",
        duration: 9000,
        action: function () {
          var ps = window.PadSurface || window.PockitSurface || window.HubSurface;
          if (ps && typeof ps.applyPockitUpdate === "function") {
            ps.applyPockitUpdate(latest);
          } else {
            window.location.reload();
          }
        },
      });
    });
  }

  window.PockitToast = {
    show: show,
    dismiss: function (id) {
      var el = id ? document.getElementById(id) : null;
      if (el) dismiss(el);
    },
    info: function (title, body, opts) {
      return show(Object.assign({}, opts || {}, { title: title, body: body }));
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wirePockitEvents);
  } else {
    wirePockitEvents();
  }
})();
