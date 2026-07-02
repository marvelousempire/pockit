/** Compat shim — pockit-surface.js is canonical. */
if (window.HubSurface) {
  window.PadSurface = window.HubSurface;
  window.PockitSurface = window.HubSurface;
}
