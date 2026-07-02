/** Video player rails — status LEDs, live labels, and info modals (Controller + Stack). */
(function (global) {
  const INFO_EYE_SVG =
    '<svg class="video-rail-info-btn__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/></svg>';

  const SECTION_INFO = {
    Route: {
      title: "Route",
      kicker: "Controller · left rail",
      lead: "Choose where draft vs final render runs.",
      bullets: [
        "Auto — Mac draft when healthy; DGX for finals.",
        "Mac edge — Wan 2.2 / CogVideoX-5B / LTX fast previews.",
        "DGX — HunyuanVideo 1080p/4K finals on Spark.",
      ],
    },
    Mode: {
      title: "Mode",
      kicker: "Controller · left rail",
      lead: "Generation mode for this session.",
      bullets: [
        "t2v — text-to-video from prompt.",
        "i2v — image-to-video with reference stills.",
        "ref board — multiple reference anchors.",
      ],
    },
    Stream: {
      title: "Stream",
      kicker: "Controller · left rail",
      lead: "Live preview while DGX renders.",
      bullets: [
        "HLS — Safari/iOS friendly progressive manifest.",
        "WebRTC — low-latency preview via DGX SFU (:8822).",
      ],
    },
    Links: {
      title: "Links",
      kicker: "Controller · left rail",
      lead: "Related surfaces and handoffs.",
      bullets: [
        "Cinematic workspace — http://127.0.0.1:8820/",
        "Super Rick Voice — Send to Video handoff chip.",
        "ComfyUI door — advanced node graphs.",
        "http://video.localhost/super-rick — COMP bridge.",
      ],
    },
    "Stack health": {
      title: "Stack health",
      kicker: "Stack · right rail",
      lead: "Live probes from tower-api /api/v1/video/*.",
      bullets: [
        "Mac draft — Wan/CogVideoX/LTX path.",
        "DGX final — HunyuanVideo on Spark.",
        "ComfyUI — graph executor reachable.",
        "Stream relay — HLS/WebRTC sidecar.",
      ],
    },
    Deploy: {
      title: "Deploy",
      kicker: "Stack · right rail",
      lead: "make video-seed, plant-seed, daily-model-upgrade.",
      bullets: ["Click ▶ to run make targets via tower-api when wired."],
    },
  };

  function sectionInfo(name) {
    return SECTION_INFO[name] || { title: name, lead: "", bullets: [] };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function infoButtonHtml(infoKey, label) {
    return `<button type="button" class="video-rail-info-btn" data-video-info-id="${esc(infoKey)}" aria-label="${esc(label || "About")}">${INFO_EYE_SVG}</button>`;
  }

  function sectionInfoButton(sectionName) {
    if (!SECTION_INFO[sectionName]) return "";
    return infoButtonHtml(`section:${sectionName}`, `About ${sectionName}`);
  }

  function bindInfoButtons(rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root || root.dataset.videoInfoBound === "1") return;
    root.dataset.videoInfoBound = "1";
    root.querySelectorAll("[data-video-info-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-video-info-id") || "";
        const name = key.startsWith("section:") ? key.slice(8) : key;
        const sec = SECTION_INFO[name] || { title: name, lead: "", bullets: [] };
        window.PockitToast?.show?.(`${sec.title}: ${sec.lead}`, { variant: "info" });
      });
    });
  }

  global.VideoRailInfo = {
    INFO_EYE_SVG,
    sectionInfo,
    SECTION_INFO,
    sectionInfoButton,
    infoButtonHtml,
    bindInfoButtons,
  };
})(typeof window !== "undefined" ? window : globalThis);
