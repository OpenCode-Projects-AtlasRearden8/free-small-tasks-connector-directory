# The Small Tasks Connector

A free, plain-English directory of ways to trade small tasks without money:
community noticeboards (physical and online), library skill-swap nights,
neighbourhood tool libraries, and mutual-aid groups — plus a six-step
mini-guide on how to volunteer your skill.

Built by **Asdale Dynamics, LLC** in the same friendly spirit as
[Dylan Asdale's](https://dylanasdale.github.io) book *The Massive AI Manual*:
clear, warm, step by step, never condescending.

## What's inside

- `index.html` — the whole site (no build step, no framework)
- `css/styles.css` — styles (paper-like, warm, low-clutter)
- `js/app.js` — loads the data, renders cards, powers filters and search
- `data/cards.json` — every listing as a JSON card
- `tests/linktest.mjs` — test suite: schema checks, policy checks, link tests
- `STATUS.md` — what was built, how to verify it, known gaps

## How to run it

Everything is static, but the card data is fetched with `fetch()`, so serve
the folder over HTTP rather than opening the file directly:

```bash
# From this folder, pick whichever you have:
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## How to test it

```bash
node tests/linktest.mjs          # offline checks (schema, policy, files)
node tests/linktest.mjs --links  # also fetch every card URL live
```

The suite verifies: every card has all required fields, dates are valid
(verified-free date before recheck date), categories are known, URLs are
HTTPS and unique, no paid-listing language appears, no likely personal data
appears in any text file, and required files exist. Exit code 0 = all good.

## Card format

Each card in `data/cards.json` carries the fields the site shows:

```json
{
  "id": "card-001",
  "category": "noticeboard-online",
  "title": "Front Porch Forum",
  "blurb": "Plain-English description of the thing",
  "what": "Short label for what it is",
  "who_for": "Who benefits most",
  "how_to_join": "Join steps in under three sentences",
  "url": "https://example.org",
  "verified_free_on": "2026-11-03",
  "recheck_date": "2027-02-03",
  "notes": "Small print, plainly said",
  "paid_ever": "partial"
}
```

`paid_ever: "partial"` marks listings where the core use is free but paid
edges exist (ads, optional upgrades, small chapter dues). The card then shows
a "check the notes" pill instead of a clean "verified free" pill.

## Promises

- **No paid listings.** Nothing here is paid for, sponsored, or featured for money.
- **No personal data.** The site collects nothing: no accounts, no forms,
  no tracking. The automated test suite checks all text files for likely
  personal data (emails, phone numbers, street addresses, ID formats).
- **Face dates.** Every listing shows a `verified_free_on` date and a
  `recheck_date`. Owners change rules without warning; always confirm on the
  listing's own site.

## License

[MIT](LICENSE) — Copyright (c) 2026 Asdale Dynamics, LLC
