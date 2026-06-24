// Behavior test for bottom footer drawer handle.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "pockit-bottom-chrome.js"), "utf8");

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
  const chevron = { textContent: "▾" };
  const handle = {
    hidden: false,
    _attrs: {},
    classList: makeClassList(),
    setAttribute: (k, v) => { handle._attrs[k] = v; },
    getAttribute: (k) => handle._attrs[k] ?? null,
    querySelector: (sel) => (sel === ".rail-drawer-handle__chevron" ? chevron : null),
  };
  const footer = {
    hidden: false,
    offsetHeight: 48,
    dataset: {},
    getBoundingClientRect: () => ({ top: 900 }),
  };
  const bodyEl = { classList: makeClassList() };
  const document = {
    readyState,
    body: bodyEl,
    documentElement: { style: { setProperty() {}, removeProperty() {} } },
    getElementById: (id) => {
      if (id === "bottom-chrome-handle") return handle;
      if (id === "main-footer") return footer;
      return null;
    },
    addEventListener: (type, fn) => { if (type === "click") clickListener = fn; },
  };
  const window = { innerHeight: 1000, addEventListener() {}, requestAnimationFrame: (fn) => fn() };
  const sandbox = {
    window, document, console: { warn() {} },
    requestAnimationFrame: (fn) => fn(),
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
    },
    ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ display: "block" }),
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return {
    api: window.PockitBottomChrome,
    body: bodyEl,
    handle,
    chevron,
    storage,
    clickHandle: () => clickListener && clickListener({ target: { closest: (s) => (s === "#bottom-chrome-handle" ? handle : null) }, preventDefault() {} }),
  };
}

describe("PockitBottomChrome", () => {
  it("toggle flips class, chevron, and persistence", () => {
    const { api, body, chevron, storage } = loadModule();
    api.toggleBottomChrome();
    assert.equal(body.classList.contains("pockit-bottom-chrome-collapsed"), true);
    assert.equal(storage["nephew-pockit-bottom-chrome-collapsed"], "1");
    assert.equal(chevron.textContent, "▴");
    api.toggleBottomChrome();
    assert.equal(chevron.textContent, "▾");
  });
});
