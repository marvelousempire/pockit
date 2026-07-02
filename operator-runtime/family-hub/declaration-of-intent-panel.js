/**
 * Declaration of Intent — unified panel renderer (Phase 2).
 * Same section order as READYPLAY ProductIntentSheet + Super Rick Intent tab.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DeclarationOfIntentPanel = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function udinLabel(d) {
    var u = d.udin || {};
    var seq = String(u.sequence || 0).padStart(5, "0");
    var lv = d.lawVersion || { major: 0, minor: 0 };
    return (u.kind || "FEAT") + "-" + seq + " · v" + lv.major + "." + lv.minor;
  }

  function section(title, bodyHtml, extraClass) {
    if (!bodyHtml) return "";
    return (
      '<section class="doi-panel__section' +
      (extraClass ? " doi-panel__section--" + extraClass : "") +
      '"><h3 class="pad-cl-intent-h3 doi-panel__h3">' +
      esc(title) +
      "</h3>" +
      bodyHtml +
      "</section>"
    );
  }

  function paragraph(text) {
    if (!text) return "";
    return "<p>" + esc(text) + "</p>";
  }

  function bulletList(items) {
    if (!items || !items.length) return "";
    return (
      '<ul class="doi-panel__list pad-cl-intent-list">' +
      items
        .map(function (item) {
          return "<li>" + esc(item) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderWhyGuide(rows) {
    if (!rows || !rows.length) return "";
    return (
      '<div class="doi-panel__table-wrap pad-cl-intent-table-wrap"><table class="doi-panel__table pad-cl-intent-table">' +
      "<thead><tr>" +
      "<th>Component</th><th>Problem</th><th>Purpose</th><th>Why chosen</th><th>Advantage</th><th>Win</th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          return (
            "<tr><td>" +
            esc(r.component || "—") +
            "</td><td>" +
            esc(r.problem || "—") +
            "</td><td>" +
            esc(r.purpose || "—") +
            "</td><td>" +
            esc(r.whyChosen || "—") +
            "</td><td>" +
            esc(r.advantage || "—") +
            "</td><td>" +
            esc(r.contribution || "—") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function kwLabel(pair) {
    if (!pair) return "";
    if (typeof pair === "string") return pair;
    var s = (pair.subject || "").trim();
    var a = (pair.action || "").trim();
    return s && a ? s + " · " + a : s || a;
  }

  /**
   * @param {object} d — DeclarationOfIntent
   * @param {object} [opts]
   * @returns {string} HTML fragment
   */
  function renderPanelHtml(d, opts) {
    opts = opts || {};
    if (!d) return '<p class="doi-panel__loading">No declaration loaded.</p>';

    var steward = d.steward || {};
    var origin = d.origin || {};
    var contract = d.contract || {};
    var promise =
      contract.userPromise || contract.operatorPromise || "";
    var badge = d.badgeVariant === "shield" ? "🛡" : "🎗";
    var chips =
      '<span class="doi-panel__chip">' +
      esc(udinLabel(d)) +
      "</span>" +
      (d.ledgerId
        ? '<span class="doi-panel__chip" title="Intent Ledger (OR-046)">' +
          esc(d.ledgerId) +
          (d.ledgerHashtag ? " " + esc(d.ledgerHashtag) : "") +
          "</span>"
        : "") +
      (d.surfaceVersion ? '<span class="doi-panel__chip">app ' + esc(d.surfaceVersion) + "</span>" : "");

    var kws = (d.keywords || []).map(kwLabel).filter(Boolean);
    var tags = d.tags || [];
    var discovery = kws.concat(tags);
    var discoveryHtml = discovery.length
      ? '<div class="doi-panel__kw-row">' +
        discovery
          .map(function (t) {
            return '<span class="doi-panel__kw">' + esc(t) + "</span>";
          })
          .join("") +
        "</div>"
      : "";

    return (
      '<article class="doi-panel' +
      (opts.articleClass ? " " + esc(opts.articleClass) : "") +
      '">' +
      '<header class="doi-panel__head">' +
      '<div class="doi-panel__head-row">' +
      '<span class="doi-panel__badge-icon" aria-hidden="true">' +
      badge +
      "</span>" +
      "<div>" +
      (d.masterDocumentTitle
        ? '<p class="doi-panel__master">' + esc(d.masterDocumentTitle) + "</p>"
        : "") +
      "<h2 class=\"doi-panel__title\">" +
      esc(d.title) +
      "</h2>" +
      '<p class="doi-panel__tagline">' +
      esc(d.tagline) +
      "</p>" +
      "</div></div>" +
      '<div class="doi-panel__chips">' +
      chips +
      "</div>" +
      '<p class="doi-panel__steward">' +
      esc(steward.organization || "Trust Organization") +
      " · " +
      esc(steward.body || "Board of Trustees") +
      " · " +
      esc(steward.entityDisplay || steward.entity || "") +
      "</p>" +
      "</header>" +
      '<div class="doi-panel__body">' +
      section("The problem we faced", paragraph(origin.problem), "problem") +
      section("Before this existed", paragraph(origin.before), "before") +
      section("What we have now", paragraph(origin.now), "now") +
      (origin.intention ? section("Intention", paragraph(origin.intention), "intention") : "") +
      section("North star", paragraph(contract.northStar), "north") +
      section("Promise", paragraph(promise), "promise") +
      section("Principles", bulletList(contract.principles)) +
      section("Success looks like", bulletList(contract.successCriteria)) +
      section("Not trying to", bulletList(contract.nonGoals)) +
      section("Data commitments", bulletList(contract.dataCommitments)) +
      (d.engineeringWhyGuide && d.engineeringWhyGuide.length
        ? section("The why guide", renderWhyGuide(d.engineeringWhyGuide))
        : "") +
      (discoveryHtml ? section("Discovery", discoveryHtml) : "") +
      "</div>" +
      '<footer class="doi-panel__meta">' +
      "Declared " +
      esc(d.declaredOn || "—") +
      ". Intent law is versioned separately from the app." +
      (d.ledgerId
        ? " Intent Ledger " + esc(d.ledgerId) + (d.ledgerHashtag ? " " + esc(d.ledgerHashtag) : "") + "."
        : "") +
      (d.inAppPath ? " " + esc(d.inAppPath) : "") +
      "</footer>" +
      "</article>"
    );
  }

  return {
    esc: esc,
    udinLabel: udinLabel,
    renderPanelHtml: renderPanelHtml,
  };
});
