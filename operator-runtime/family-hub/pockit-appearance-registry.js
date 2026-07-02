/**
 * Pockit appearance registry — UI skins + color modes (extensible catalog).
 * Default skin: Presence (KVM Comet + AppleKit shell).
 */
(function (global) {
  const DEFAULT_SKIN_ID = "presence";

  /** @type {{ id: string, label: string, tagline: string, default?: boolean, status: "live"|"preview" }[]} */
  const SKINS = [
    {
      id: "presence",
      label: "Presence",
      tagline: "KVM Comet glass, blue-slate panels, cotton-ball motion — the Family Office default.",
      default: true,
      status: "live",
    },
    {
      id: "tahoe",
      label: "Tahoe",
      tagline: "visionOS-inspired glass, pill radii, heavier rail blur.",
      status: "live",
    },
    {
      id: "sequoia",
      label: "Sequoia",
      tagline: "macOS Sequoia — tighter shadows, bordered cards, subtle motion.",
      status: "live",
    },
  ];

  /** @type {{ id: string, label: string, tagline: string }[]} */
  const COLOR_MODES = [
    { id: "light", label: "Light", tagline: "Bright surfaces and high-contrast labels." },
    { id: "dark", label: "Dark", tagline: "Near-black canvas with softened accent glow." },
    { id: "auto", label: "Follow system", tagline: "Tracks macOS / iOS light or dark preference." },
  ];

  function skinById(id) {
    return SKINS.find((s) => s.id === id) || SKINS.find((s) => s.default) || SKINS[0];
  }

  function colorModeById(id) {
    return COLOR_MODES.find((m) => m.id === id) || COLOR_MODES[0];
  }

  function normalizeSkinId(id) {
    const raw = String(id || "").trim();
    return skinById(raw).id;
  }

  function normalizeColorMode(id) {
    const raw = String(id || "").trim();
    return colorModeById(raw).id;
  }

  global.PockitAppearanceRegistry = {
    DEFAULT_SKIN_ID,
    SKINS,
    COLOR_MODES,
    skinById,
    colorModeById,
    normalizeSkinId,
    normalizeColorMode,
  };
})(typeof window !== "undefined" ? window : globalThis);