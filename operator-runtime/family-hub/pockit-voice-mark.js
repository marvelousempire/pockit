/**
 * Parakeet rail icon tiles — colorful boxed glyphs (Voices row quality) for every voice rail row.
 * PockitVoiceMark = studio mic brand; PockitRailIcon = per-item tinted tiles.
 */
(function (global) {
  "use strict";

  const GLYPH = "🎙";

  const VOICE_ITEM_HUES = {
    "voice-ctl-route-auto": 204,
    "voice-ctl-route-m5": 152,
    "voice-ctl-route-dgx": 32,
    "voice-ctl-mode-chat": 278,
    "voice-ctl-mode-read": 220,
    "voice-ctl-mode-prime": 45,
    "voice-ctl-rag-hybrid": 168,
    "voice-ctl-rag-fast": 46,
    "voice-ctl-rag-grounded": 200,
    "voice-ctl-memory": 265,
    "voice-ctl-mcp": 192,
    "voice-ctl-talk": 340,
    "voice-ctl-stop": 0,
    "voice-ctl-clear": 215,
    "voice-del-speakers": 337,
    "voice-del-jarvis": 212,
    "voice-del-warm": 28,
    "voice-del-news": 210,
    "voice-link-knowledge": 200,
    "voice-link-console": 192,
    "voice-link-presence": 278,
    "voice-link-super-rick": 32,
    "voice-h-m5": 152,
    "voice-h-dgx": 32,
    "voice-h-spark": 38,
    "voice-h-rag": 200,
    "voice-h-stt": 204,
    "voice-h-tts": 337,
    "voice-h-swarmer": 278,
    "voice-h-doublepass": 215,
    "voice-h-barge": 340,
    "voice-h-turn": 168,
    "voice-h-brain": 152,
    "voice-h-higgs": 38,
  };

  const VOICE_ITEM_ICONS = {
    "voice-ctl-route-auto": "ReloadOutlined",
    "voice-ctl-route-m5": "ClusterOutlined",
    "voice-ctl-route-dgx": "CloudServerOutlined",
    "voice-ctl-mode-chat": "TeamOutlined",
    "voice-ctl-mode-read": "ReadOutlined",
    "voice-ctl-mode-prime": "ThunderboltOutlined",
    "voice-ctl-rag-hybrid": "ClusterOutlined",
    "voice-ctl-rag-fast": "ThunderboltOutlined",
    "voice-ctl-rag-grounded": "BookOutlined",
    "voice-ctl-memory": "BookOutlined",
    "voice-ctl-mcp": "ApiOutlined",
    "voice-del-jarvis": "ControlOutlined",
    "voice-del-warm": "UserOutlined",
    "voice-del-news": "ReadOutlined",
    "voice-ctl-talk": "ApiOutlined",
    "voice-ctl-stop": "PoweroffOutlined",
    "voice-ctl-clear": "BlockOutlined",
    "voice-link-knowledge": "BookOutlined",
    "voice-link-console": "ExportOutlined",
    "voice-link-presence": "BulbOutlined",
    "voice-link-super-rick": "DashboardOutlined",
    "voice-h-m5": "ClusterOutlined",
    "voice-h-dgx": "CloudServerOutlined",
    "voice-h-spark": "ThunderboltOutlined",
    "voice-h-rag": "BookOutlined",
    "voice-h-stt": "ApiOutlined",
    "voice-h-tts": "ThunderboltOutlined",
    "voice-h-swarmer": "BulbOutlined",
    "voice-h-doublepass": "AuditOutlined",
    "voice-h-barge": "AudioOutlined",
    "voice-h-turn": "CustomerServiceOutlined",
    "voice-h-brain": "ClusterOutlined",
    "voice-h-higgs": "ThunderboltOutlined",
  };

  function enrichVoiceItem(item) {
    const id = String(item?.id || "");
    return {
      ...item,
      icon: item?.icon || VOICE_ITEM_ICONS[id],
      glyph: item?.glyph || (id.startsWith("make-") ? "▶" : undefined),
    };
  }

  function tileClass(size, extra) {
    return [
      "pockit-rail-icon",
      "pockit-voice-mark",
      `pockit-rail-icon--${size}`,
      `pockit-voice-mark--${size}`,
      String(extra || "").trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function tileStyle(hue) {
    if (hue == null) return "";
    const n = Number(hue);
    return ` style="--rail-icon-hue:${n};--voice-mark-hue:${n}"`;
  }

  function hueForVoiceItem(item) {
    const id = String(item?.id || "");
    if (VOICE_ITEM_HUES[id] != null) return VOICE_ITEM_HUES[id];
    if (item?.hue != null && !Number.isNaN(Number(item.hue))) return Number(item.hue);
    if (id.startsWith("make-")) return 267;
    return 337;
  }

  function innerForItem(item) {
    if (!item) return "·";
    if (item.id === "voice-del-speakers" || (item._voiceAction === "speakers" && !item.icon)) {
      return GLYPH;
    }
    if (item.glyph && !item.icon) {
      return `<span class="pockit-rail-icon__glyph">${String(item.glyph)}</span>`;
    }
    if (typeof globalThis.AntIcons !== "undefined") {
      if (item.icon) return globalThis.AntIcons.render(item.icon, { size: "15px" });
      return globalThis.AntIcons.forItem(item);
    }
    if (item.glyph) return String(item.glyph);
    return String(item.title || "·").charAt(0);
  }

  function tileHtml(item, opts = {}) {
    const size = opts.size || "md";
    const enriched = enrichVoiceItem(item);
    const hue = opts.hue != null ? opts.hue : hueForVoiceItem(enriched);
    const extra = String(opts.className || "").trim();
    return `<span class="${tileClass(size, extra)}"${tileStyle(hue)} aria-hidden="true">${innerForItem(enriched)}</span>`;
  }

  function markHtml(opts = {}) {
    const size = opts.size || "md";
    const boxed = opts.boxed !== false;
    const extra = String(opts.className || "").trim();
    const cls = [
      "pockit-voice-mark",
      "pockit-rail-icon",
      `pockit-voice-mark--${size}`,
      `pockit-rail-icon--${size}`,
      boxed ? "" : "pockit-voice-mark--plain",
      extra,
    ]
      .filter(Boolean)
      .join(" ");
    const hue = opts.hue != null ? tileStyle(opts.hue) : "";
    return `<span class="${cls}"${hue} aria-hidden="true">${GLYPH}</span>`;
  }

  global.PockitVoiceMark = {
    GLYPH,
    markHtml,
  };

  global.PockitRailIcon = {
    GLYPH,
    tileHtml,
    markHtml,
    hueForVoiceItem,
    innerForItem,
  };
})(window);
