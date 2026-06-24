#!/usr/bin/env node
/** Fail if product IP files exist in shell/ */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = join(ROOT, "shell");

const FORBIDDEN_FILES = [
  "voice-pad.js",
  "voice-pad.css",
  "video-pad.js",
  "video-pad.css",
  "odysseus-pad.js",
  "odysseus-pad.css",
  "knowledge-hud.js",
  "knowledge-hud.css",
  "voice-rail-info.js",
  "video-rail-info.js",
];

const FORBIDDEN_SURFACE_IDS = new Set([
  "ext-archive",
  "web-odysseus",
  "knowledge",
  "archive-search-engine",
  "search-my-engine",
  "voice",
  "video",
]);

if (!existsSync(SHELL)) {
  console.error("✗ shell/ missing — run: make pockit-saas-export (from nephew)");
  process.exit(1);
}

const files = readdirSync(SHELL);
let fail = false;
for (const f of FORBIDDEN_FILES) {
  if (files.includes(f)) {
    console.error("✗ product IP in shell/:", f);
    fail = true;
  }
}

const catalogPath = join(SHELL, "pockit-catalog.json");
if (existsSync(catalogPath)) {
  const cat = JSON.parse(readFileSync(catalogPath, "utf8"));
  if (cat.product !== "pockit-saas-demo") {
    console.error("✗ shell catalog is not demo product:", cat.product);
    fail = true;
  }
  for (const p of cat.players || []) {
    if (!String(p.id).startsWith("demo")) {
      console.error("✗ non-demo player in shell catalog:", p.id);
      fail = true;
    }
  }
}

const helpPath = join(SHELL, "pockit-help-topics.json");
if (existsSync(helpPath)) {
  const help = JSON.parse(readFileSync(helpPath, "utf8"));
  if (help.product !== "pockit-saas-demo") {
    console.error("✗ shell help topics is fleet corpus — expected pockit-saas-demo");
    fail = true;
  }
}

const surfacesDir = join(SHELL, "cassette-surfaces");
if (existsSync(surfacesDir)) {
  for (const name of readdirSync(surfacesDir)) {
    const id = name.replace(/\.(json|routes\.json)$/, "").replace(/\.routes$/, "");
    if (FORBIDDEN_SURFACE_IDS.has(id)) {
      console.error("✗ fleet surface in shell/cassette-surfaces:", name);
      fail = true;
    }
  }
}

const indexPath = join(SHELL, "index.html");
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  for (const f of FORBIDDEN_FILES.filter((x) => x.endsWith(".css"))) {
    if (html.includes(f)) {
      console.error("✗ index.html references product CSS:", f);
      fail = true;
    }
  }
}

if (!files.includes("pockit.js")) {
  console.error("✗ shell/pockit.js missing");
  fail = true;
}

if (fail) process.exit(1);
console.log("✓ pockit SaaS boundary check OK");