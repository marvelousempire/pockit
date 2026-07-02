/**
 * Plan 0462/0463 — operator rollout admin (user / group / tenant console grants).
 */
(function (global) {
  const API_META = "/api/v1/family/rollout/meta";
  const API_USERS = "/api/v1/family/rollout/users";
  const Tree = () => global.PockitCatalogGrantTree;
  const Lib = () => global.PockitCatalogEntitlements;

  function esc(s) {
    return Tree()?.esc(s) || String(s ?? "");
  }

  function fleetCatalog() {
    return Tree()?.fleetCatalog() || global.POCKIT_FLEET_CATALOG || global.POCKIT_CATALOG;
  }

  function renderRolloutAdminPanel() {
    return `<section class="pc-rollout-admin" id="pc-rollout-admin" hidden aria-hidden="true">
      <h3 class="pockit-settings-pane__title">Rollout grants</h3>
      <p class="cs-hint">Assign catalog mode and consoles per user, group, or tenant. Server filters <code>/api/v1/framework/pockit-catalog</code> before the shell loads.</p>
      <nav class="pc-rollout-tabs" aria-label="Rollout target">
        <button type="button" class="pc-rollout-tab is-active" data-rollout-tab="users">Users</button>
        <button type="button" class="pc-rollout-tab" data-rollout-tab="groups">Groups</button>
        <button type="button" class="pc-rollout-tab" data-rollout-tab="tenants">Tenants</button>
      </nav>
      <div class="pc-rollout-panels">
        <div class="pc-rollout-panel" data-rollout-panel="users" id="pc-rollout-users-panel"></div>
        <div class="pc-rollout-panel" data-rollout-panel="groups" id="pc-rollout-groups-panel" hidden></div>
        <div class="pc-rollout-panel" data-rollout-panel="tenants" id="pc-rollout-tenants-panel" hidden></div>
      </div>
      <div class="cs-card pc-rollout-editor" id="pc-rollout-editor" hidden aria-hidden="true"></div>
      <p class="cs-hint" id="pc-rollout-status" aria-live="polite"></p>
    </section>`;
  }

  const state = {
    tab: "users",
    meta: null,
    editor: null,
  };

  async function fetchMeta() {
    const res = await fetch(API_META, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`meta HTTP ${res.status}`);
    return res.json();
  }

  async function fetchUsers() {
    const res = await fetch(API_USERS, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`users HTTP ${res.status}`);
    return res.json();
  }

  function renderUsersTable(users) {
    if (!users?.length) return `<p class="cs-hint">No family users yet.</p>`;
    return `<table class="pc-rollout-table">
      <thead><tr><th>User</th><th>Groups</th><th>Effective</th><th>Override</th><th></th></tr></thead>
      <tbody>${users
        .map(
          (u) => `<tr>
          <td>${esc(u.display_name || u.email)}</td>
          <td>${esc((u.groups || []).join(", "))}</td>
          <td><code>${esc(u.effective_mode)}</code></td>
          <td>${u.has_override ? "yes" : "—"}</td>
          <td><button type="button" class="comet-btn comet-btn--ghost pc-rollout-edit" data-target="user" data-id="${esc(u.id)}" data-label="${esc(u.display_name || u.email)}">Edit grants</button></td>
        </tr>`,
        )
        .join("")}</tbody>
    </table>`;
  }

  function renderGroupList(groups) {
    const rows = (groups || []).map(
      (g) => `<button type="button" class="pc-rollout-pick comet-btn comet-btn--ghost pc-rollout-edit" data-target="group" data-id="${esc(g.id)}" data-label="${esc(g.id)}">${esc(g.id)} <span class="pc-rollout-pick__mode">${esc(g.mode || "—")}</span></button>`,
    );
    return `<div class="pc-rollout-picks">${rows.join("")}</div>`;
  }

  function renderTenantList(tenants) {
    const rows = (tenants || []).map(
      (t) => `<button type="button" class="pc-rollout-pick comet-btn comet-btn--ghost pc-rollout-edit" data-target="tenant" data-id="${esc(t.id)}" data-label="${esc(t.id)}">${esc(t.id)} <span class="pc-rollout-pick__mode">${esc(t.mode || "—")}</span></button>`,
    );
    return `<p class="cs-hint">Tenant id for <code>?tenant=</code> on catalog API.</p><div class="pc-rollout-picks">${rows.join("")}</div>
      <div class="pc-rollout-new-tenant">
        <input type="text" class="pc-rollout-tenant-input" id="pc-rollout-new-tenant" placeholder="new-tenant-id" />
        <button type="button" class="comet-btn comet-btn--ghost pc-rollout-edit" data-target="tenant" data-id="" data-label="new tenant" id="pc-rollout-add-tenant">Add tenant</button>
      </div>`;
  }

  function renderEditorShell(target, id, label, entitlements, inheritOption) {
    const t = Tree();
    if (!t) return "";
    const mode = entitlements?.mode || (inheritOption ? "inherit" : "core");
    const catalog = fleetCatalog();
    const seeded = mode === "custom" ? t.seedCustomEntitlements(entitlements) : entitlements;
    const treeHidden = mode !== "custom";
    return `<header class="pc-rollout-editor__head">
        <h4>${esc(target)}: ${esc(label || id)}</h4>
        <button type="button" class="comet-btn comet-btn--ghost" id="pc-rollout-editor-close">Close</button>
      </header>
      <div class="cs-card pc-rollout-editor__modes" data-grant-mode-name="pc-rollout-mode-${esc(target)}">
        ${t.renderModeSelect(`pc-rollout-mode-${target}`, mode, inheritOption)}
      </div>
      <div class="cs-card pc-grant-tree-wrap pc-rollout-tree" id="pc-rollout-grant-tree" ${treeHidden ? "hidden aria-hidden=\"true\"" : ""}>
        ${t.renderPlayerTree(catalog, seeded, { classPrefix: "pc-rollout" })}
      </div>
      <div class="pc-rollout-editor__actions">
        <button type="button" class="comet-btn comet-btn--primary" id="pc-rollout-editor-save">Save grants</button>
      </div>`;
  }

  async function loadTargetEntitlements(target, id) {
    if (target === "user") {
      const res = await fetch(`/api/v1/family/users/${encodeURIComponent(id)}/pockit-catalog-entitlements`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return {
        mode: payload.override?.mode || "inherit",
        entitlements: payload.override || null,
        inherit: !payload.override,
      };
    }
    if (target === "group") {
      const res = await fetch(`/api/v1/family/groups/${encodeURIComponent(id)}/pockit-catalog-entitlements`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { mode: payload.data?.mode || "core", entitlements: payload.data, inherit: false };
    }
    const res = await fetch(`/api/v1/family/tenants/${encodeURIComponent(id)}/pockit-catalog-entitlements`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    return { mode: payload.data?.mode || "core", entitlements: payload.data, inherit: false };
  }

  function patchUrl(target, id) {
    if (target === "user") return `/api/v1/family/users/${encodeURIComponent(id)}/pockit-catalog-entitlements`;
    if (target === "group") return `/api/v1/family/groups/${encodeURIComponent(id)}/pockit-catalog-entitlements`;
    return `/api/v1/family/tenants/${encodeURIComponent(id)}/pockit-catalog-entitlements`;
  }

  async function saveGrants(root, statusEl) {
    const ed = state.editor;
    if (!ed) return;
    const t = Tree();
    const editorRoot = root.querySelector("#pc-rollout-editor");
    if (!t || !editorRoot) return;
    const modeName = `pc-rollout-mode-${ed.target}`;
    const mode = t.readMode(editorRoot, modeName);
    statusEl.textContent = "Saving…";
    let body;
    if (ed.target === "user" && mode === "inherit") {
      body = { _clear_override: true };
    } else if (mode === "core" || mode === "fleet") {
      body = { schema_version: 1, mode, players: {} };
    } else {
      const catalog = fleetCatalog();
      const base = ed.entitlements || t.seedCustomEntitlements(null);
      body = t.collectFromTree(editorRoot, base, catalog, { classPrefix: "pc-rollout", mode: "custom" });
    }
    const res = await fetch(patchUrl(ed.target, ed.id), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
    statusEl.textContent = "Saved.";
    if (Lib()?.loadEntitlements) {
      await Lib().loadEntitlements();
      global.dispatchEvent(new CustomEvent("nephew-pockit-catalog-entitlements"));
    }
    await refreshRolloutAdmin(root);
  }

  async function openEditor(root, target, id, label) {
    const editor = root.querySelector("#pc-rollout-editor");
    const status = root.querySelector("#pc-rollout-status");
    if (!editor) return;
    try {
      const loaded = await loadTargetEntitlements(target, id);
      state.editor = { target, id, label, entitlements: loaded.entitlements };
      editor.hidden = false;
      editor.setAttribute("aria-hidden", "false");
      editor.innerHTML = renderEditorShell(target, id, label, loaded.entitlements, target === "user");
      const t = Tree();
      t?.bindGrantTree(editor, {
        classPrefix: "pc-rollout",
        modeName: `pc-rollout-mode-${target}`,
        onModeChange: (mode) => {
          if (mode === "custom" && !state.editor.entitlements) {
            const tree = editor.querySelector("#pc-rollout-grant-tree");
            if (tree && t) {
              tree.innerHTML = t.renderPlayerTree(fleetCatalog(), t.seedCustomEntitlements(null), {
                classPrefix: "pc-rollout",
              });
              t.bindGrantTree(editor, { classPrefix: "pc-rollout", modeName: `pc-rollout-mode-${target}` });
            }
          }
        },
      });
      editor.querySelector("#pc-rollout-editor-close")?.addEventListener("click", () => {
        editor.hidden = true;
        editor.setAttribute("aria-hidden", "true");
        state.editor = null;
      });
      editor.querySelector("#pc-rollout-editor-save")?.addEventListener("click", () => {
        saveGrants(root, status).catch((e) => {
          status.textContent = e.message || String(e);
        });
      });
    } catch (e) {
      if (status) status.textContent = e.message || String(e);
    }
  }

  function bindTabs(root) {
    root.querySelectorAll("[data-rollout-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.tab = btn.dataset.rolloutTab;
        root.querySelectorAll(".pc-rollout-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
        root.querySelectorAll("[data-rollout-panel]").forEach((p) => {
          const on = p.dataset.rolloutPanel === state.tab;
          p.hidden = !on;
          p.setAttribute("aria-hidden", on ? "false" : "true");
        });
      });
    });
  }

  function bindEditButtons(root) {
    root.querySelectorAll(".pc-rollout-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        let target = btn.dataset.target;
        let id = btn.dataset.id;
        const label = btn.dataset.label;
        if (target === "tenant" && !id) {
          const input = root.querySelector("#pc-rollout-new-tenant");
          id = (input?.value || "").trim();
          if (!id) return;
        }
        openEditor(root, target, id, label || id);
      });
    });
  }

  async function refreshRolloutAdmin(root) {
    const panel = root?.querySelector("#pc-rollout-admin");
    if (!panel) return;
    const isOp = global.POCKIT_ENTITLEMENTS_META?.is_operator === true;
    panel.hidden = !isOp;
    panel.setAttribute("aria-hidden", isOp ? "false" : "true");
    if (!isOp) return;
    bindTabs(panel);
    try {
      const [metaPayload, usersPayload] = await Promise.all([fetchMeta(), fetchUsers()]);
      state.meta = metaPayload;
      const usersPanel = panel.querySelector("#pc-rollout-users-panel");
      const groupsPanel = panel.querySelector("#pc-rollout-groups-panel");
      const tenantsPanel = panel.querySelector("#pc-rollout-tenants-panel");
      if (usersPanel) usersPanel.innerHTML = renderUsersTable(usersPayload.users || []);
      if (groupsPanel) groupsPanel.innerHTML = renderGroupList(metaPayload.groups || []);
      if (tenantsPanel) tenantsPanel.innerHTML = renderTenantList(metaPayload.tenants || []);
      bindEditButtons(panel);
    } catch (e) {
      const status = panel.querySelector("#pc-rollout-status");
      if (status) status.textContent = e.message || String(e);
    }
  }

  global.PockitCatalogRolloutAdmin = {
    renderRolloutAdminPanel,
    refreshRolloutAdmin,
  };
})(window);