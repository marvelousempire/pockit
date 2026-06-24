/**
 * Pockit shell layout — zone registry + DOM helpers (Plan 0221).
 * Elementor analogue: Section (#main-frame) → Row → Column → Widget.
 * Registry mirror: data/pockit-shell-layout.json
 */
(function initPockitShellLayout(global) {
  const REGISTRY = {
    schema_version: 1,
    toolbar: {
      row: "toolbar",
      columns: {
        leading: "toolbar-leading",
        title: "toolbar-title",
        trailing: "toolbar-trailing",
      },
    },
  };

  function zone(id) {
    return document.querySelector(`[data-pockit-zone="${id}"]`);
  }

  function column(colId) {
    return document.querySelector(`[data-layout-col="${colId}"]`);
  }

  function widget(id) {
    return document.querySelector(`[data-widget="${id}"]`);
  }

  function stack(name) {
    return document.querySelector(`[data-widget-stack="${name}"]`);
  }

  function setWidgetHidden(id, hidden) {
    const el = widget(id);
    if (!el) return;
    el.classList.toggle("hidden", Boolean(hidden));
    const control = el.querySelector("button, a");
    if (control) control.classList.toggle("hidden", Boolean(hidden));
  }

  function syncToolbarMode(cassette) {
    const wrap = document.getElementById("main-breadcrumb-wrap");
    const onOverview = cassette?.type === "overview" || cassette?.id === "overview";
    wrap?.classList.toggle("main-breadcrumb-wrap--overview", onOverview);
    document.querySelector(".main-breadcrumb-title")?.classList.toggle("main-breadcrumb-title--overview", onOverview);
  }

  global.PockitShellLayout = {
    REGISTRY,
    zone,
    column,
    widget,
    stack,
    setWidgetHidden,
    syncToolbarMode,
  };
})(typeof window !== "undefined" ? window : globalThis);
