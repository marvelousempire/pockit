/**
 * Plan 0262 — shared Bonjour discovery panel for Pockit, DustPan, CT, and cassettes.
 */
(function () {
  const REFRESH_MS = 30000;
  const API = "/api/v1/family/bonjour?probe=1&browse=1";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMacFamilyHost() {
    const h = location.hostname;
    return h.endsWith(".localhost") || h.endsWith(".local") || h === "localhost";
  }

  function openUrl(url) {
    if (!url) return;
    if (url.startsWith("http://") && url.includes(".local:")) {
      window.open(url.replace(/:\d+\//, "/"), "_blank", "noopener");
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  function renderList(root, data) {
    const doors = data.doors || [];
    const browse = data.browse?.services || [];
    const dgx = data.dgx || {};
    const liveCount = doors.filter((d) => d.probe?.localhost || d.probe?.mdns).length;
    const html = [];

    html.push(
      '<div class="nb-head">' +
        '<span class="nb-glyph" aria-hidden="true">📡</span>' +
        '<div style="flex:1;min-width:0">' +
        '<p class="nb-title">Nearby Nephew</p>' +
        `<div class="nb-sub">${esc(data.platform)} · gateway :${esc(data.gateway_port)} · ${esc(data.lan_ip || "LAN")}</div>` +
        '<div class="nb-stats">' +
        `<span class="nb-stat"><strong>${liveCount}</strong> live</span>` +
        `<span class="nb-stat"><strong>${browse.length}</strong> mDNS</span>` +
        `<span class="nb-stat"><strong>${doors.length}</strong> doors</span>` +
        "</div></div></div>",
    );

    if (browse.length) {
      html.push('<section class="nb-section"><h3>Discovered on LAN</h3><div class="nb-browse-grid">');
      for (const s of browse.slice(0, 10)) {
        html.push(
          `<div class="nb-browse-row">` +
            `<span class="nb-dot ok"></span>` +
            `<span>${esc(s.name)}</span>` +
            `<code>${esc(s.type)}</code>` +
            `</div>`,
        );
      }
      html.push("</div></section>");
    } else if (data.platform === "darwin") {
      html.push(
        '<section class="nb-section"><h3>Discovered on LAN</h3>' +
          '<p class="nb-sub" style="margin:0">No mDNS hits yet — run <code>make family-bonjour</code> on this Mac.</p></section>',
      );
    } else {
      html.push(
        '<section class="nb-section"><h3>Discovered on LAN</h3>' +
          '<p class="nb-sub" style="margin:0">mDNS browse runs on macOS — on DGX use door probes below and <code>ssh nephew-spark</code>.</p></section>',
      );
    }

    html.push('<section class="nb-section"><h3>Family doors</h3><ul class="nb-doors">');
    for (const d of doors.slice(0, 16)) {
      const url = d.probe?.prefer_url || d.localhost_url || d.mdns_url;
      const live = d.probe?.localhost || d.probe?.mdns;
      const kind = d.kind === "player" ? "Console" : "Cassette";
      html.push(
        `<li class="nb-door ${live ? "live" : ""}">` +
          `<button type="button" class="nb-open" data-url="${esc(url)}" title="${esc(url)}">` +
          `<span class="nb-dot ${live ? "ok" : "dim"}"></span>` +
          `<span class="nb-g">${esc(d.glyph)}</span>` +
          `<span class="nb-label-wrap">` +
          `<span class="nb-label">${esc(d.label || d.slug)}</span>` +
          `<span class="nb-kind">${esc(kind)}</span>` +
          `</span></button>` +
          `<span class="nb-host">${esc(d.mdns_host)}</span>` +
          `</li>`,
      );
    }
    html.push("</ul></section>");

    html.push('<section class="nb-section nb-dgx"><h3>DGX Spark</h3>');
    html.push(
      `<p class="nb-dgx-line"><strong>${esc(dgx.hostname || "nephew-spark")}</strong><br>${esc(dgx.comet_kvm || "Comet KVM")}</p>`,
    );
    html.push('<div class="nb-actions">');
    html.push(
      `<a class="nb-btn primary" href="http://dgx-spark-console.localhost/" target="_blank" rel="noopener">🖥 Console</a>`,
    );
    html.push(`<a class="nb-btn" href="http://spark-warden.localhost/" target="_blank" rel="noopener">🐧 Warden</a>`);
    html.push(`<a class="nb-btn" href="http://nephew-spark-spec.localhost/" target="_blank" rel="noopener">⚡ Spec</a>`);
    html.push("</div></section>");

    root.innerHTML = html.join("");
    root.querySelectorAll(".nb-open").forEach((btn) => {
      btn.addEventListener("click", () => openUrl(btn.getAttribute("data-url")));
    });

    const chip = document.getElementById("nephew-bonjour-chip");
    if (chip) {
      let badge = chip.querySelector(".nb-chip-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nb-chip-count";
        chip.appendChild(badge);
      }
      badge.textContent = String(liveCount || browse.length || doors.length);
      badge.hidden = !(liveCount || browse.length);
    }
  }

  async function refresh(root) {
    if (!root.dataset.loaded) {
      root.innerHTML = '<div class="nb-loading">Scanning nearby Nephew…</div>';
    }
    try {
      const r = await fetch(API, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      renderList(root, await r.json());
      root.dataset.loaded = "1";
    } catch (e) {
      const onSpark = /spark|dgx/i.test(location.hostname);
      const hint = onSpark
        ? "Run <code>make ensure-tower-api</code> on this host (Mac or DGX)."
        : "Run <code>make doors</code> on the family Mac.";
      root.innerHTML = `<div class="nb-err">Bonjour unavailable — ${esc(e.message)}.<br>${hint}</div>`;
    }
  }

  function mount(el, opts = {}) {
    if (!el) return null;
    el.classList.add("nephew-bonjour-panel");
    if (opts.compact) el.classList.add("nb-compact");
    refresh(el);
    const id = window.setInterval(() => refresh(el), opts.refreshMs || REFRESH_MS);
    return { refresh: () => refresh(el), destroy: () => window.clearInterval(id) };
  }

  function positionPopover(chip, pop) {
    if (!chip || !pop) return;
    const rect = chip.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(380, window.innerWidth - 24);
    pop.style.width = `${width}px`;
    let top = rect.bottom + gap;
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const estHeight = pop.offsetHeight || 320;
    if (top + estHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - gap - estHeight);
    }
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.right = "auto";
  }

  function setPopoverOpen(chip, pop, open) {
    pop.hidden = !open;
    chip.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    positionPopover(chip, pop);
    window.setTimeout(() => {
      function onDoc(ev) {
        if (pop.hidden) {
          document.removeEventListener("click", onDoc, true);
          return;
        }
        if (pop.contains(ev.target) || chip.contains(ev.target)) return;
        setPopoverOpen(chip, pop, false);
        document.removeEventListener("click", onDoc, true);
      }
      document.addEventListener("click", onDoc, true);
    }, 0);
  }

  function ensureChipLabel(chip) {
    if (!chip || chip.querySelector(".nb-chip-glyph")) return;
    chip.innerHTML = '<span class="nb-chip-glyph" aria-hidden="true">📡</span>';
  }

  async function prefetchChipBadge() {
    const chip = document.getElementById("nephew-bonjour-chip");
    if (!chip) return;
    try {
      const r = await fetch(API, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const doors = data.doors || [];
      const browse = data.browse?.services || [];
      const liveCount = doors.filter((d) => d.probe?.localhost || d.probe?.mdns).length;
      let badge = chip.querySelector(".nb-chip-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nb-chip-count";
        chip.appendChild(badge);
      }
      badge.textContent = String(liveCount || browse.length || doors.length);
      badge.hidden = !(liveCount || browse.length);
    } catch {
      /* offline — chip still usable */
    }
  }

  function mountChip() {
    const chip = document.getElementById("nephew-bonjour-chip");
    if (!chip || !isMacFamilyHost()) return;
    if (chip.dataset.bonjourBound === "1") return;
    chip.dataset.bonjourBound = "1";

    chip.hidden = false;
    ensureChipLabel(chip);
    chip.setAttribute("aria-haspopup", "dialog");
    chip.setAttribute("aria-expanded", "false");
    prefetchChipBadge();

    chip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      let pop = document.getElementById("nephew-bonjour-popover");
      if (!pop) {
        pop = document.createElement("div");
        pop.id = "nephew-bonjour-popover";
        pop.className = "nephew-bonjour-popover";
        pop.hidden = true;
        document.body.appendChild(pop);
        mount(pop, { compact: true });
      }
      setPopoverOpen(chip, pop, pop.hidden);
    });
  }

  window.NephewBonjour = { mount, mountChip, refresh, isMacFamilyHost, openUrl };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChip);
  } else {
    mountChip();
  }
})();
