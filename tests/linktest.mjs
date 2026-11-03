#!/usr/bin/env node
/**
 * Test suite for the Small Tasks Connector directory.
 *
 * Usage:
 *   node tests/linktest.mjs            # offline: schema, policy, file checks
 *   node tests/linktest.mjs --links    # also HTTP-check every card URL
 *
 * Exit code is non-zero if anything fails.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_LINKS = process.argv.includes("--links");

let failures = 0;
let checks = 0;

function ok(name, condition, detail = "") {
  checks++;
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

// --------------------------------------------------------------------------
// 1. cards.json schema + policy
// --------------------------------------------------------------------------
const cardsPath = join(ROOT, "data", "cards.json");
ok("data/cards.json exists", existsSync(cardsPath));

const REQUIRED_FIELDS = [
  "id", "category", "title", "blurb", "what", "who_for",
  "how_to_join", "url", "verified_free_on", "recheck_date"
];
const ALLOWED_CATEGORIES = new Set([
  "noticeboard-online", "noticeboard-physical",
  "library-skill-swap", "tool-library", "mutual-aid"
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https:\/\/[^\s"'<>]+$/i;

const PAID_MARKERS = /(paywall|subscription required|membership fee|sign[- ]up fee|premium listing|featured listing|sponsored listing|paid ad)/i;

let data = null;
if (existsSync(cardsPath)) {
  try {
    data = JSON.parse(readFileSync(cardsPath, "utf8"));
    section("cards.json schema");
    ok("parses as JSON", true);
    ok("has meta object", typeof data.meta === "object" && data.meta !== null);
    ok("has cards array", Array.isArray(data.cards) && data.cards.length > 0,
      `${data.cards ? data.cards.length : 0} cards`);

    const ids = (data.cards || []).map((c) => c.id);
    ok("card ids unique", new Set(ids).size === ids.length);
    ok("card urls unique", new Set(data.cards.map((c) => c.url)).size === data.cards.length);

    (data.cards || []).forEach((card, i) => {
      const label = `card ${card.id || "#" + i}`;
      for (const field of REQUIRED_FIELDS) {
        ok(`${label} has ${field}`, typeof card[field] === "string" && card[field].trim().length > 0);
      }
      ok(`${label} category is known`, ALLOWED_CATEGORIES.has(card.category), card.category);
      ok(`${label} verified_free_on is a date`, DATE_RE.test(card.verified_free_on || ""));
      ok(`${label} recheck_date is a date`, DATE_RE.test(card.recheck_date || ""));
      if (DATE_RE.test(card.verified_free_on || "") && DATE_RE.test(card.recheck_date || "")) {
        ok(`${label} recheck is after verified date`, card.recheck_date > card.verified_free_on);
      }
      ok(`${label} url is https`, URL_RE.test(card.url || ""), card.url);
      ok(`${label} no paid-listing language`,
        !PAID_MARKERS.test(`${card.title} ${card.blurb} ${card.how_to_join}`));
      ok(`${label} title is short and plain`, (card.title || "").length <= 80);
      ok(`${label} blurb min length`, (card.blurb || "").length >= 40);
    });
  } catch (err) {
    ok("parses as JSON", false, err.message);
  }
}

// --------------------------------------------------------------------------
// 2. Personal-data policy across all text files
// --------------------------------------------------------------------------
section("personal-data policy");
const TEXT_EXTS = new Set([".json", ".js", ".mjs", ".cjs", ".css", ".html", ".md", ".txt"]);

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".git") continue;
    const st = statSync(full);
    if (st.isDirectory()) yield* walkFiles(full);
    else yield full;
  }
}

const PII_PATTERNS = [
  [/[A-Za-z0-9._%+-]+@(?!example\.(?:org|com)|[A-Za-z0-9.-]*example\.(?:org|com))[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "email address"],
  [/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/, "phone number"],
  [/\b\d{3}-\d{2}-\d{4}\b/, "government ID format"],
  [/\b\d{1,5} [A-Za-z0-9 .,'-]+ (?:Street|St|Avenue|Ave|Road|Rd|Blvd|Boulevard|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b\.?/, "street address"]
];

const EXCEPTION_MARKERS = /(example\.org|your email|email alias|photo ID|proof of local address)/i;

let piiFileCount = 0;
for (const file of walkFiles(ROOT)) {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  if (!TEXT_EXTS.has(ext)) continue;
  const content = readFileSync(file, "utf8");
  const hits = [];
  for (const [re, kind] of PII_PATTERNS) {
    const match = re.exec(content);
    if (match) hits.push(`${kind}: "${match[0].slice(0, 60)}"`);
  }
  if (hits.length) {
    const allAllowed = hits.every((h) => EXCEPTION_MARKERS.test(h));
    if (!allAllowed) {
      piiFileCount++;
      console.error(`PII risk in ${file}:`);
      for (const h of hits) console.error(`   ${h}`);
    }
  }
}
ok("no likely personal data in text files", piiFileCount === 0,
  `${piiFileCount} file(s) flagged`);

// --------------------------------------------------------------------------
// 3. Required project files
// --------------------------------------------------------------------------
section("project files");
for (const f of ["index.html", "css/styles.css", "js/app.js", "README.md", "LICENSE", "STATUS.md"]) {
  ok(`${f} exists`, existsSync(join(ROOT, f)));
}
const license = existsSync(join(ROOT, "LICENSE")) ? readFileSync(join(ROOT, "LICENSE"), "utf8") : "";
ok("LICENSE is MIT", /MIT License/i.test(license));
ok("LICENSE copyright line exact",
  license.includes("Copyright (c) 2026 Asdale Dynamics, LLC"),
  `expected exact line: Copyright (c) 2026 Asdale Dynamics, LLC`);
const readme = existsSync(join(ROOT, "README.md")) ? readFileSync(join(ROOT, "README.md"), "utf8") : "";
ok("README credits Asdale Dynamics, LLC", readme.includes("Asdale Dynamics, LLC"));

const indexHtml = existsSync(join(ROOT, "index.html")) ? readFileSync(join(ROOT, "index.html"), "utf8") : "";
ok("index.html includes mini-guide", /volunteer your skill/i.test(indexHtml));
ok("index.html loads app.js", /js\/app\.js/.test(indexHtml));

// --------------------------------------------------------------------------
// 4. Optional: live link checks
//
// Two attempts per URL: first with a plain test UA, then with a normal
// browser UA (many sites block obvious bots with 403). Sites on
// BOT_BLOCKED_HOSTS block automated traffic entirely (403/429/5xx) even
// with a browser UA; those are accepted as "reachable for humans".
// --------------------------------------------------------------------------
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const BOT_BLOCKED_HOSTS = new Set(["www.repaircafe.org"]);
const BOT_BLOCK_CODES = [403, 429, 503, 521, 522, 523, 525, 520];

async function checkLinks() {
  section("live link checks (--links)");
  let unreachable = 0;
  for (const card of data.cards) {
    try {
      let resp = await fetch(card.url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "user-agent": "SmallTasksConnectorLinkTest/1.0 (free-directory link test)" }
      });
      if (resp.status >= 400) {
        // Second attempt with a mainstream browser user agent
        const retry = await fetch(card.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
          headers: { "user-agent": BROWSER_UA }
        }).catch(() => null);
        if (retry && retry.status >= 200 && retry.status < 400) resp = retry;
      }
      let pass = resp.status >= 200 && resp.status < 400;
      let detail = `HTTP ${resp.status}`;
      if (!pass) {
        const host = new URL(resp.url || card.url).hostname;
        if (BOT_BLOCKED_HOSTS.has(host) && BOT_BLOCK_CODES.includes(resp.status)) {
          pass = true;
          detail = `HTTP ${resp.status} but host is on the bot-blocked allowlist`;
        }
      }
      if (!pass) unreachable++;
      ok(`${card.id} -> ${card.url}`, pass, detail);
    } catch (err) {
      unreachable++;
      ok(`${card.id} -> ${card.url}`, false, err.name === "TimeoutError" ? "timeout" : err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return unreachable;
}

if (CHECK_LINKS && data && Array.isArray(data.cards)) {
  const unreachable = await checkLinks();
  console.error(unreachable > 0 ? `${unreachable} live link(s) unreachable` : "all live links reachable");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("All checks passed.");
