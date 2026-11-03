(() => {
  "use strict";

  const CATEGORY_LABELS = {
    "noticeboard-online": "Noticeboard (online)",
    "noticeboard-physical": "Noticeboard (physical)",
    "library-skill-swap": "Library / skill-swap",
    "tool-library": "Tool library",
    "mutual-aid": "Mutual aid"
  };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const state = { category: "all", query: "" };

  const els = {
    grid: document.getElementById("cards"),
    chips: document.getElementById("category-filters"),
    search: document.getElementById("search"),
    status: document.getElementById("filter-status"),
    noResults: document.getElementById("no-results")
  };

  let cards = [];

  function esc(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function dateLabel(iso) {
    if (!DATE_RE.test(iso || "")) return "unknown";
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  function freePill(card) {
    if (card.paid_ever === "partial") {
      return '<span class="free-pill partial" title="Core use is free, but see notes for paid edges">Free tier &middot; check notes</span>';
    }
    return '<span class="free-pill free" title="Verified free to join and use">Verified free &#10003;</span>';
  }

  function cardHTML(card) {
    return `
      <article class="card" data-id="${esc(card.id)}">
        <div class="card-top">
          <span class="card-category">${esc(CATEGORY_LABELS[card.category] || card.category)}</span>
          ${freePill(card)}
        </div>
        <h3><a href="${esc(card.url)}" target="_blank" rel="noopener noreferrer">${esc(card.title)}</a></h3>
        <p class="blurb">${esc(card.blurb)}</p>
        <dl>
          <div><dt>What</dt><dd>${esc(card.what)}</dd></div>
          <div><dt>Who for</dt><dd>${esc(card.who_for)}</dd></div>
          <div><dt>How to join</dt><dd>${esc(card.how_to_join)}</dd></div>
          <div><dt>Verified free on</dt><dd><time datetime="${esc(card.verified_free_on)}">${esc(dateLabel(card.verified_free_on))}</time></dd></div>
          <div><dt>Recheck</dt><dd><time datetime="${esc(card.recheck_date)}">${esc(dateLabel(card.recheck_date))}</time></dd></div>
        </dl>
        <p class="notes">Note: ${esc(card.notes)}</p>
      </article>`;
  }

  function buildChips() {
    const counts = { all: cards.length };
    for (const card of cards) {
      counts[card.category] = (counts[card.category] || 0) + 1;
    }
    const chips = [`<button class="chip is-active" data-filter="all" aria-pressed="true">All (${counts.all})</button>`];
    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
      if (!counts[key]) continue;
      chips.push(
        `<button class="chip" data-filter="${esc(key)}" aria-pressed="false">${esc(label)} (${counts[key]})</button>`
      );
    }
    els.chips.innerHTML = chips.join("");
  }

  function apply() {
    const q = state.query.trim().toLowerCase();
    const visible = cards.filter((card) => {
      const catOK = state.category === "all" || card.category === state.category;
      if (!catOK) return false;
      if (!q) return true;
      const hay = [card.title, card.blurb, card.what, card.who_for, card.how_to_join, card.notes]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });

    els.grid.innerHTML = visible.map(cardHTML).join("");
    els.noResults.classList.toggle("hidden", visible.length > 0);

    const currentChip = state.category === "all"
      ? "All"
      : (CATEGORY_LABELS[state.category] || state.category);
    els.status.textContent = `${visible.length} of ${cards.length} listings shown (${currentChip})`;
  }

  function wire() {
    els.chips.addEventListener("click", (evt) => {
      const btn = evt.target.closest(".chip");
      if (!btn) return;
      state.category = btn.dataset.filter || "all";
      for (const chip of els.chips.querySelectorAll(".chip")) {
        const active = chip === btn;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      }
      apply();
      document.getElementById("directory").scrollIntoView({ block: "start" });
    });

    els.search.addEventListener("input", () => {
      state.query = els.search.value;
      apply();
    });
  }

  function validate(data) {
    const problems = [];
    if (!data || !Array.isArray(data.cards)) {
      return ["cards.json must contain a cards array"];
    }
    const REQUIRED = ["id", "category", "title", "blurb", "what", "who_for", "how_to_join", "url"];
    data.cards.forEach((card, i) => {
      for (const field of REQUIRED) {
        if (!card[field] || typeof card[field] !== "string") {
          problems.push(`card #${i + 1} (${card.title || "untitled"}): missing "${field}"`);
        }
      }
      if (!DATE_RE.test(card.verified_free_on || "")) problems.push(`card ${card.id}: bad verified_free_on`);
      if (!DATE_RE.test(card.recheck_date || "")) problems.push(`card ${card.id}: bad recheck_date`);
      if (card.verified_free_on && card.recheck_date && card.recheck_date <= card.verified_free_on) {
        problems.push(`card ${card.id}: recheck_date should be after verified_free_on`);
      }
    });
    const ids = data.cards.map((c) => c.id);
    if (new Set(ids).size !== ids.length) problems.push("duplicate card ids");
    return problems;
  }

  async function init() {
    let data;
    try {
      const resp = await fetch("data/cards.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } catch (err) {
      els.status.textContent = `Could not load data/cards.json (${err.message}). Serve the site over HTTP; see README.`;
      els.noResults.classList.remove("hidden");
      console.error(err);
      return;
    }

    const problems = validate(data);
    if (problems.length) {
      console.warn("Card data problems:", problems);
      els.status.textContent = "Data warnings found - open the browser console for details.";
    }

    cards = data.cards;
    buildChips();
    apply();
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
