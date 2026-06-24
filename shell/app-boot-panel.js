/** Boot panel LED controller — global AppBootPanel for static HTML pages. */
(function (global) {
  function mountBootPanel(opts) {
    const subtitle = document.getElementById(opts.subtitleElId || "boot-subtitle");
    const stepsRoot = document.getElementById(opts.stepsElId || "boot-steps");
    const titleEl = document.getElementById("boot-title");
    if (titleEl && opts.title) titleEl.textContent = opts.title;

    const byId = new Map();
    stepsRoot.innerHTML = "";
    for (const s of opts.steps) {
      const row = document.createElement("div");
      row.className = "boot-step";
      row.dataset.state = "pending";
      row.dataset.stepId = s.id;
      row.innerHTML =
        '<div class="boot-step__led" aria-hidden="true"></div>' +
        "<div><p class=\"boot-step__label\"></p><p class=\"boot-step__detail\"></p></div>";
      row.querySelector(".boot-step__label").textContent = s.label;
      stepsRoot.appendChild(row);
      byId.set(s.id, row);
    }

    function setStep(id, state, detail) {
      const row = byId.get(id);
      if (!row) return;
      row.dataset.state = state;
      const det = row.querySelector(".boot-step__detail");
      if (det) det.textContent = detail || "";
    }

    function setMessage(msg) {
      if (subtitle) subtitle.textContent = msg || "";
    }

    return { setStep, setMessage };
  }

  global.AppBootPanel = { mountBootPanel };
})(typeof window !== "undefined" ? window : globalThis);
