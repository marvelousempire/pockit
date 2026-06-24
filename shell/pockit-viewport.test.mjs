#!/usr/bin/env node
/**
 * Plan 0275 — viewport engine unit tests (registry presets P+L).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  resolveTier,
  matchDevicePreset,
  matchDevicePresetByTier,
  iosUaDevicePreset,
  orientationForViewport,
  layoutWidthForViewport,
  tierForWidth,
  DEFAULT_TIERS,
} from "../../../scripts/lib/pockit-viewport-engine.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const registry = JSON.parse(
  readFileSync(join(root, "data/pockit-device-viewports.json"), "utf8"),
);

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e.message}`);
  }
}

test("tierForWidth covers watch through tv", () => {
  assert.equal(tierForWidth(184), "watch");
  assert.equal(tierForWidth(375), "phoneCompact");
  assert.equal(tierForWidth(440), "phoneLarge");
  assert.equal(tierForWidth(744), "tabletCompact");
  assert.equal(tierForWidth(1280), "laptop");
  assert.equal(tierForWidth(2560), "desktop");
  assert.equal(tierForWidth(3840), "display");
  assert.equal(tierForWidth(5000), "tv");
});

test("layoutWidth uses shortest edge on coarse pointer", () => {
  assert.equal(layoutWidthForViewport(956, 440, { coarsePointer: true }), 440);
  assert.equal(layoutWidthForViewport(956, 440, { coarsePointer: false }), 956);
});

test("layoutWidth browser squeeze collapses iPad band and narrow windows", () => {
  assert.equal(layoutWidthForViewport(1133, 744, { browserResize: true }), 1133);
  assert.equal(layoutWidthForViewport(1376, 1032, { browserResize: true }), 1032);
  assert.equal(layoutWidthForViewport(1920, 700, { browserResize: true }), 700);
  assert.equal(layoutWidthForViewport(1920, 1080, { browserResize: true }), 1920);
  assert.equal(resolveTier(1376, 1032, { browserResize: true }), "tabletLarge");
  assert.equal(resolveTier(744, 1133, { browserResize: true }), "tabletCompact");
  assert.equal(resolveTier(390, 844, { browserResize: true }), "phoneCompact");
});

test("orientationForViewport", () => {
  assert.equal(orientationForViewport(375, 667), "portrait");
  assert.equal(orientationForViewport(667, 375), "landscape");
});

for (const p of registry.presets) {
  test(`preset ${p.id} resolves tier`, () => {
    const coarse = p.family === "phone" || p.family === "tablet";
    const tier =
      p.family === "watch"
        ? p.tier
        : resolveTier(p.width, p.height, { coarsePointer: coarse });
    if (p.family !== "watch") {
      assert.equal(tier, p.tier, `width=${p.width} height=${p.height}`);
    } else {
      assert.equal(p.tier, "watch");
    }
    const matched = matchDevicePreset(p.width, p.height, registry.presets);
    assert.ok(matched, "should match a preset");
    assert.equal(matched.id, p.id);
    assert.equal(orientationForViewport(p.width, p.height), p.orientation);
  });
}

test("DEFAULT_TIERS length", () => {
  assert.equal(DEFAULT_TIERS.length, 9);
});

test("Safari iPhone viewport matches a phone preset", () => {
  const matched = matchDevicePreset(402, 874, registry.presets);
  assert.ok(matched, "402×874 should match an iPhone preset");
  assert.equal(matched.family, "phone");
});

test("iPhone 16 Pro Max preset matches at anchor dimensions", () => {
  const matched = matchDevicePreset(440, 956, registry.presets);
  assert.ok(matched);
  assert.equal(matched.baseId, "iphone-16-pro-max");
});

test("tier fallback matches iPhone preset for phoneLarge tier", () => {
  const matched = matchDevicePresetByTier(402, 874, "phoneLarge", registry.presets);
  assert.ok(matched);
  assert.equal(matched.family, "phone");
});

if (failed) process.exit(1);
