# Yosif's List — Project Vision

> Markdown copy of `docs/Yosif's List — Project Vision.docx` (Nov 26, 2026), kept so AI tools can read it easily. If the two differ, the owner decides which is right.

## Overview
Yosif's List is a free website where you type in your grocery list and instantly see which store in Doha gives you the cheapest total.

- **Scope:** Doha, Qatar only, in English for now. Arabic comes later if it works out.
- **Stores:** the major chains. Start with Carrefour, Lulu and Al Meera; Monoprix, Safari, Spar and Family Food Centre can come later.
- **Money:** none. A free passion project with no ads, subscriptions or affiliate links (a small budget, around $10–20 a month, may go to upkeep if needed).

## Design
The look is minimal and black, with *Yosif's List* in classy italics at the top.

## Building the list
- The user types an item and presses Enter. It pops in underneath the search bar with a clean, smooth animation.
- Each new item stacks below the last, forming one column.
- After 10–15 items, a new column starts to the right.
- Each item shows a tiny square photo of the real product on its left (taken from the store listings, never icons) with its name beside it (a carrot picture next to "Carrot 500 g"), plus a small, subtle ✕ to remove it. If AI search is added, typing "2× milk" or "2 L milk" sets the quantity right there, before searching.
- The list saves automatically, so refreshing never loses it. Users can also log in with just a username and password (no email) to see their saved lists from earlier weeks. A forgotten password means making a new account. Accounts with no login for 1 year are deleted automatically; the only thing tracked is a "last login" date. Tapping one loads it into the search page to adjust and search again.
- The user presses Search when the list is done.

## Results: one receipt per store
Each store is one column, shown side by side so the totals line up across the bottom:

```
      CARREFOUR
---------------------
Milk 1L         6.50
Eggs (30)      18.00
Bread           4.75
Rice 5kg       32.00
---------------------
Total          61.25
```

- Store name at the top, items on the left, prices on the right, total on the last row.
- Stores are ordered left to right from cheapest total to most expensive, and the cheapest is highlighted. There can be any number of store columns, not just three.
- If a store doesn't carry an item, that row says "not found" and the total notes it.
- A small arrow beside each item shows alternatives, such as a bigger size or a similar product. On desktop it appears on hover; on phones it's a tap.
- On phones, the user swipes between store columns.

## Disclaimer and corrections
At the bottom of the results: "Prices may differ slightly in store. Spot something off? Tap to fix it."

## Data
Prices come from three sources, in this order: official store APIs where they exist, scraping as the main source, and crowdsourced corrections as the backstop.

1. **Official APIs.** Used if a chain offers one. Few do, so this is a bonus.
2. **Scraping (main source).** A plain script, not an AI, collects prices from each store's own website or app, and from delivery apps whose websites list store prices: Talabat, Snoonu, Keeta and Rafeeq.
   - Runs on a schedule (for example weekly) using a free timer like GitHub Actions.
   - Reads each category page, or the hidden data feed the site loads prices from, and saves name, size and price to the database.
   - Each store has its own small scraper, so one breaking doesn't take down the rest.
   - Requests stay gentle, since scraping is often against a site's terms.
3. **Crowdsourcing.** A "fix this price" option in the results lets users correct a wrong price. Details to be decided.

**Caching.** Searches never scrape live. They read the saved prices from the database, so results appear instantly.

## AI help (later, if needed)
AI is not part of the first version. Keep these ideas in mind and add them only if needed. AI never does the scraping itself.

- **Matching products across stores.** "Almarai Milk 1L" at Carrefour and "Full Fat Milk Almarai 1 Litre" at Lulu have to be recognised as the same product.
  - Simple rules pull out brand, size and unit.
  - Free embeddings find likely matches.
  - A cheap LLM checks only the unclear pairs, and the answer is saved so it's never asked twice.
  - Users can report a wrong match.
- **Fixing broken scrapers.** When a site changes its layout, AI reads a sample page and updates the scraper. It costs pennies, and only when something breaks.
- **Smarter search.** Users type loosely, like "milk" or "almarai laban", and the search still finds the right product without exact wording. This is the most likely first use.
