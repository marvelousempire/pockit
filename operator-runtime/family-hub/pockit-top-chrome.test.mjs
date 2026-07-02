// Behavior test for Phase 7 top-chrome handle. Loads the browser IIFE under a
// vm DOM/localStorage stub and asserts the collapse class, persistence, restore.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "pockit-top-chrome.js"), "utf8");

function makeClassList() {
  const set = new Set();
  return {
    _set: set,
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c); else set.delete(c);
      return on;
    },
  };
}

function loadModule({ storage = {}, readyState = "complete" } = {}) {
  let clickListener = null;
  const chevron = { textContent: "▴" };
  const handle = {
    _attrs: {},
    classList: makeClassList(),
    setAttribute: (k, v) => { handle._attrs[k] = v; },
    getAttribute: (k) => handle._attrs[k] ?? null,
    querySelector: (sel) => (sel === ".rail-drawer-handle__chevron" ? chevron : null),
  };
  const bodyEl = { classList: makeClassList() };
  const document = {
    readyState,
    body: bodyEl,
    getElementById: (id) => (id === "top-chrome-handle" ? handle : null),
    addEventListener: (type, fn) => { if (type === "click") clickListener = fn; },
  };
  const window = {};
  const sandbox = {
    window, document, console: { warn() {} },
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return {
    api: window.PockitTopChrome,
    body: bodyEl,
    handle,
    chevron,
    storage,
    clickHandle: () => clickListener && clickListener({ target: { closest: (s) => (s === "#top-chrome-handle" ? handle : null) }, preventDefault() {} }),
  };
}

describe("PockitTopChrome", () => {
  it("exposes the API", () => {
    const { api } = loadModule();
    assert.equal(typeof api.toggleTopChrome, "function");
    assert.equal(typeof api.isTopChromeCollapsed, "function");
  });

  it("toggle flips the body class, persists, and updates the handle aria", () => {
    const { api, body, handle, storage, chevron } = loadModule();
    assert.equal(api.isTopChromeCollapsed(), false);
    api.toggleTopChrome();
    assert.equal(body.classList.contains("pockit-top-chrome-collapsed"), true);
    assert.equal(storage["nephew-pockit-top-chrome-collapsed"], "1");
    assert.equal(handle.getAttribute("aria-expanded"), "false");
    assert.equal(handle.classList.contains("is-collapsed"), true);
    assert.equal(chevron.textContent, "▾");
    api.toggleTopChrome();
    assert.equal(body.classList.contains("pockit-top-chrome-collapsed"), false);
    assert.equal(storage["nephew-pockit-top-chrome-collapsed"], "0");
    assert.equal(handle.getAttribute("aria-expanded"), "true");
    assert.equal(chevron.textContent, "▴");
  });

  it("force value is honored and idempotent", () => {
    const { api, body } = loadModule();
    api.toggleTopChrome(true);
    api.toggleTopChrome(true);
    assert.equal(body.classList.contains("pockit-top-chrome-collapsed"), true);
  });

  it("restores persisted collapsed state on init", () => {
    const { body } = loadModule({ storage: { "nephew-pockit-top-chrome-collapsed": "1" } });
    assert.equal(body.classList.contains("pockit-top-chrome-collapsed"), true);
  });

  it("clicking the handle toggles", () => {
    const { body, clickHandle } = loadModule();
    clickHandle();
    assert.equal(body.classList.contains("pockit-top-chrome-collapsed"), true);
  });
});
