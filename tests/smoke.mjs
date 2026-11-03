#!/usr/bin/env node
/**
 * Smoke test: loads js/app.js in a minimal DOM shim and verifies the
 * card grid actually renders from data/cards.json, filters narrow the
 * grid, and search finds and empties results correctly.
 *
 * Usage: node tests/smoke.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_SRC = readFileSync(join(ROOT, "js", "app.js"), "utf8");
const DATA_PATH = join(ROOT, "data", "cards.json");

let failures = 0;
function ok(name, condition, detail = "") {
  if (condition) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ` - ${detail}` : ""}`); }
}

function makeEl() {
  return {
    dataset: {},
    textContent: "",
    innerHTML: "",
    value: "",
    classList: {
      _set: new Set(),
      toggle(cls, force) {
        if (force === undefined) {
          if (this._set.has(cls)) this._set.delete(cls);
          else this._set.add(cls);
        } else if (force) this._set.add(cls);
        else this._set.delete(cls);
      },
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
    },
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(type, fn) { (this._handlers ??= {})[type] = fn; },
    scrollIntoView() {},
    closest(sel) { return sel === ".chip" ? this.closestChip ?? null : null; },
    querySelectorAll() { return this.querySelectorAllResult ?? []; },
  };
}

async function runApp() {
  const els = {
    cards: makeEl(),
    "category-filters": makeEl(),
    search: makeEl(),
    "filter-status": makeEl(),
    "no-results": makeEl(),
    directory: makeEl(),
    guide: makeEl(),
  };

  const fakeDoc = {
    readyState: "complete",
    getElementById: (id) => els[id],
    createElement: () => ({
      _text: "",
      set textContent(v) { this._text = String(v); this._isHTML = false; },
      get innerHTML() { return this._text.replace(/&/g, "&amp;").replace(/</g, "&lt;"); },
    }),
    addEventListener() {},
  };

  new Function("document", "fetch", "console", APP_SRC)(
    fakeDoc,
    async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(readFileSync(DATA_PATH, "utf8")),
    }),
    console
  );

  await new Promise((resolve) => setTimeout(resolve, 50));
  return { els };
}

// --- Run 1: initial render -------------------------------------------------
const run1 = await runApp();
const gridHTML = run1.els.cards.innerHTML;

ok("cards rendered into grid", gridHTML.includes("<article"), `${gridHTML.length} chars`);
ok("all 22 cards rendered",
  (gridHTML.match(/<article /g) || []).length === 22,
  String((gridHTML.match(/<article /g) || []).length));
ok("category chips built", run1.els["category-filters"].innerHTML.includes("data-filter="));
ok("'All' chip starts active", run1.els["category-filters"].innerHTML.includes('<button class="chip is-active" data-filter="all"'));
ok("status shows total count", /22 of 22 listings shown \(All\)/.test(run1.els["filter-status"].textContent),
  run1.els["filter-status"].textContent);
ok("escapes html from data", !gridHTML.includes("onerror"));

// --- Run 2: category filter click -----------------------------------------
const run2 = await runApp();
const chipGrid = run2.els["category-filters"];
const fakeChip = Object.assign(makeEl(), { _isChip: true });
fakeChip.dataset.filter = "tool-library";
fakeChip.querySelectorAllResult = []; // no sibling chips to update in shim
const allChip = Object.assign(makeEl(), { _isChip: true });
// app.js iterates el.querySelectorAll(".chip") on the filters container;
// our shim returns the fake chip list we choose:
run2.els["category-filters"].querySelectorAllResult = [allChip, fakeChip];
const clickHandler = run2.els["category-filters"]._handlers?.click;

if (clickHandler) {
  allChip.closestChip = fakeChip; // container.closest is not used; only chip.closest is
  Object.defineProperty(fakeChip, "closest", { value: (sel) => (sel === ".chip" ? fakeChip : null) });
  clickHandler({ target: fakeChip });
  await new Promise((resolve) => setTimeout(resolve, 20));
  ok("tool-library chip filters to 3 cards",
    (run2.els.cards.innerHTML.match(/<article /g) || []).length === 3,
    String((run2.els.cards.innerHTML.match(/<article /g) || []).length));
  ok("status line reflects filter",
    /3 of 22 listings shown/.test(run2.els["filter-status"].textContent),
    run2.els["filter-status"].textContent);
} else {
  ok("chip click handler wired", false);
}

// --- Run 3: search ----------------------------------------------------------
const run3 = await runApp();
const inputHandler = run3.els.search._handlers?.input;
if (inputHandler) {
  run3.els.search.value = "repair cafe";
  inputHandler();
  await new Promise((resolve) => setTimeout(resolve, 20));
  ok("search 'repair cafe' finds 1 card",
    (run3.els.cards.innerHTML.match(/<article /g) || []).length === 1,
    String((run3.els.cards.innerHTML.match(/<article /g) || []).length));

  run3.els.search.value = "zzzz-no-match-zzzz";
  inputHandler();
  await new Promise((resolve) => setTimeout(resolve, 20));
  ok("no-results message shows on empty results",
    !run3.els["no-results"].classList._set.has("hidden"));
  run3.els.search.value = "library";
  inputHandler();
  await new Promise((resolve) => setTimeout(resolve, 20));
  ok("search 'library' finds several cards",
    (run3.els.cards.innerHTML.match(/<article /g) || []).length === 4,
    String((run3.els.cards.innerHTML.match(/<article /g) || []).length));
} else {
  ok("search input handler wired", false);
}

if (failures > 0) {
  console.error(`${failures} smoke check(s) FAILED`);
  process.exit(1);
}
console.log("Smoke test passed.");
