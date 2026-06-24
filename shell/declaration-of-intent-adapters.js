/**
 * Adapters — legacy intent shapes → unified DeclarationOfIntent.
 * Spec: docs/standards/declaration-of-intent-model.md
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DeclarationOfIntentAdapters = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function stewardForEntity(entity, entityDisplay) {
    return {
      organization: "Trust Organization",
      body: "Board of Trustees",
      entity: entity || "NEPHEW",
      entityDisplay: entityDisplay || entity || "NEPHEW",
    };
  }

  function parseUdinString(s) {
    if (!s) return null;
    var m = String(s).match(/^(FEAT|IDEA)-(\d+)$/);
    if (!m) return null;
    return { kind: m[1], sequence: parseInt(m[2], 10) };
  }

  function parseLawVersion(v) {
    if (v && typeof v === "object" && v.major != null) return v;
    var parts = String(v || "1.0").split(".");
    return { major: parseInt(parts[0], 10) || 1, minor: parseInt(parts[1], 10) || 0 };
  }

  function mapWhyGuide(rows) {
    return (rows || []).map(function (row) {
      return {
        component: row.component,
        problem: row.problem,
        purpose: row.purpose,
        whyChosen: row.whyChosen,
        advantage: row.advantage,
        contribution: row.contribution,
      };
    });
  }

  /**
   * Prefer embedded `declaration`; else flatten mac-app registry / proto row.
   */
  function resolveFromProto(proto, opts) {
    opts = opts || {};
    if (!proto) return null;
    if (proto.declaration && proto.declaration.origin) {
      var d = JSON.parse(JSON.stringify(proto.declaration));
      if (!d.badgeVariant) {
        d.badgeVariant =
          opts.badgeVariant || (d.steward && d.steward.entity === "READYPLAY" ? "shield" : "promise");
      }
      if (!d.surfaceVersion && proto.appVersion) d.surfaceVersion = proto.appVersion;
      if (!d.masterDocumentTitle && proto.masterTitle) d.masterDocumentTitle = proto.masterTitle;
      return d;
    }

    var intent = proto.intent || {};
    var entity = proto.entity || opts.entity || "NEPHEW";
    var udin = parseUdinString(proto.udin) || opts.udin || { kind: "FEAT", sequence: 101 };

    return {
      steward: stewardForEntity(entity, proto.displayName),
      udin: udin,
      lawVersion: parseLawVersion(proto.lawVersion || opts.lawVersion),
      slug: opts.slug || proto.appId || "mac-app",
      title: proto.displayName || proto.appId || "App",
      tagline: proto.tagline || opts.tagline || "",
      declaredOn: opts.declaredOn || "—",
      masterDocumentTitle: proto.masterTitle || undefined,
      surfaceVersion: proto.appVersion || undefined,
      inAppPath: opts.inAppPath || "Footer Intent pill · changelog Intent tab",
      badgeVariant: opts.badgeVariant || (entity === "READYPLAY" ? "shield" : "promise"),
      ledgerId: opts.ledgerId || proto.ledgerId,
      ledgerHashtag: opts.ledgerHashtag || proto.ledgerHashtag,
      origin: {
        intention: intent.why || "",
        problem: intent.problem || "",
        before: intent.before || opts.before || "No formal declaration panel — intent lived only in engineering notes or scattered docs.",
        now: intent.accomplish || intent.does || "",
      },
      contract: {
        northStar: proto.northStar || intent.why || "",
        userPromise: proto.userPromise || intent.does || "",
        operatorPromise: opts.operatorPromise,
        principles: proto.principles || opts.principles || [],
        successCriteria: proto.successCriteria || [],
        nonGoals: proto.nonGoals || opts.nonGoals || [],
        dataCommitments: proto.privacyCommitments || opts.dataCommitments || [],
      },
      engineeringWhyGuide: mapWhyGuide(proto.whyGuide),
      keywords: proto.keywords || [],
      tags: opts.tags || proto.tags || [],
    };
  }

  /** @deprecated — use resolveFromProto */
  function fromMacAppProto(proto, opts) {
    return resolveFromProto(proto, opts);
  }

  /**
   * Pockit cassette `intention` block (intention.schema.json) or hub card with declaration.
   */
  function fromPockitArtifact(artifact, meta) {
    meta = meta || {};
    if (artifact && artifact.declaration) {
      return resolveFromProto({ declaration: artifact.declaration, displayName: artifact.title || artifact.name });
    }
    var intention = artifact.intention || artifact;
    if (!intention.why && !intention.problem) return null;
    return {
      steward: stewardForEntity(meta.entity || "POCKIT", meta.entityDisplay || artifact.title),
      udin: meta.udin || { kind: "FEAT", sequence: meta.sequence || 1 },
      lawVersion: parseLawVersion(meta.lawVersion),
      slug: meta.slug || artifact.id || "cassette",
      title: meta.title || artifact.title || artifact.name || "Cartridge",
      tagline: meta.tagline || intention.why || "",
      declaredOn: meta.declaredOn || "—",
      ledgerId: intention.intent_id,
      inAppPath: meta.inAppPath || "Tile promise badge",
      badgeVariant: "promise",
      origin: {
        intention: intention.why || "",
        problem: intention.problem || "",
        before: meta.before || "—",
        now: intention.accomplish || "",
      },
      contract: {
        northStar: intention.why || "",
        userPromise: intention.accomplish || intention.why || "",
        principles: meta.principles || [],
        successCriteria: meta.successCriteria || [],
        nonGoals: meta.nonGoals || [],
        dataCommitments: meta.dataCommitments || [],
      },
      tags: intention.tags || [],
      keywords: meta.keywords || [],
    };
  }

  /** @deprecated */
  function fromPockitIntention(intention, meta) {
    return fromPockitArtifact({ intention: intention }, meta);
  }

  return {
    stewardForEntity: stewardForEntity,
    parseUdinString: parseUdinString,
    parseLawVersion: parseLawVersion,
    resolveFromProto: resolveFromProto,
    fromMacAppProto: fromMacAppProto,
    fromPockitArtifact: fromPockitArtifact,
    fromPockitIntention: fromPockitIntention,
  };
});
