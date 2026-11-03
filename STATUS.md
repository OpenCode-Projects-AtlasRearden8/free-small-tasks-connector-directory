# STATUS.md - The Small Tasks Connector

**Owner:** Asdale Dynamics, LLC
**Built:** 2026-11-03
**Next full recheck:** 2027-02-03

## What was built

A fully static, plain-English directory of **free ways to trade small tasks**:
community noticeboards (physical and online), library skill-swap nights,
neighbourhood tool libraries, and mutual-aid groups - plus a six-step
mini-guide, "How to Volunteer Your Skill."

Files:

```
index.html          the entire site (hero, directory, filters, mini-guide, footer)
css/styles.css      warm paper-style styling, accessible (skip link, aria-live)
js/app.js           fetches cards.json, renders cards, category chips, search
data/cards.json     22 listings across 5 categories, one JSON object each
tests/linktest.mjs  test suite: schema, policies, personal-data scan, link tests
tests/smoke.mjs     runtime smoke test of the app logic (render/filter/search)
README.md           how to run, test, and extend; credits Asdale Dynamics, LLC
LICENSE             MIT, Copyright (c) 2026 Asdale Dynamics, LLC
```

Directory promises implemented and enforced by tests:

- **No paid listings** - the link tester scans every card for paid-listing
  language; several cards carry `paid_ever: "partial"` plus a "check the notes"
  pill where free-tier edges exist (ads, optional upgrades, small dues).
- **No personal data** - the site collects nothing (no forms, no accounts, no
  analytics); the tester scans every text file for likely emails, phone
  numbers, street addresses, and ID formats.
- **Face dates** - every card shows a `verified_free_on` date and a
  `recheck_date`, rendered as human-friendly dates.

## How to run it

Static site; serve over HTTP because the card data is fetched client-side:

```bash
python3 -m http.server 8000        # from this folder
# or: npx serve .
# then open http://localhost:8000
```

No build step, no dependencies, no network calls beyond the card data itself.

## How to verify it

```bash
node tests/smoke.mjs                 # app logic: renders 22 cards, filters, search
node tests/linktest.mjs              # offline: schema + policy + file checks
node tests/linktest.mjs --links      # also HTTP-checks every card URL (network needed)
```

## Verification results (2026-11-03)

- `node tests/smoke.mjs` - **11/11 passed.** Confirms: 22 cards render,
  6 category chips (All + 5), the tool-library chip narrows to 3 cards with
  correct status line, search "repair cafe" finds 1 card, empty results show
  the no-results message, search "library" finds 4 cards, and data text is
  HTML-escaped.
- `node tests/linktest.mjs` - **436/436 checks passed** (schema: all required
  fields per card, dates valid and recheck > verified, URLs HTTPS and unique,
  no paid-listing language; policy: no personal data found; files: README /
  LICENSE / STATUS present, MIT copyright line exact,
  README credits Asdale Dynamics, LLC).
- `node tests/linktest.mjs --links` - all 22 card URLs reachable, including
  retry with a browser user agent for bot-blocking sites.
- Served with `python3 -m http.server`: index.html, data/cards.json,
  css/styles.css, js/app.js all return HTTP 200.
- `node --check js/app.js` - syntax clean.

## Known gaps

1. **Free-tier drift.** "Verified free" is a snapshot, not a guarantee.
   Owners change rules without notice; that is why every card carries a
   recheck date and the page says "always confirm on the site itself."
2. **One bot-blocked host.** `www.repaircafe.org` rejects all automated
   requests (520/403-style responses) even with a browser user agent. It is
   on the tester's explicit allowlist; the URL is correct for people.
3. **Location-dependent listings.** Cards like the library board and
   coffee-shop board link to finder pages or search shortcuts, not one
   specific venue - coverage depends on where you live.
4. **US-leaning.** Most listings are US-oriented; international readers may
   need local equivalents for time banks and tool libraries.
5. **Chrome-only dates in tests.** Date rendering was checked in Node and the
   shim, not in real browsers; visual testing used one browser at best.
6. **Accessibility reviewed, not audited.** Semantic HTML, skip link, and
   aria-live regions are in place, but no screen-reader audit was performed.

## Data maintenance

To add a listing: append a card to `data/cards.json` (schema documented in the
README), set `verified_free_on` to today and `recheck_date` to ~90 days out,
then run both test scripts. The tester rejects duplicates, bad dates,
non-HTTPS links, paid-listing language, and likely personal data.
