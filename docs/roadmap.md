# Roadmap

Build order for Yosif's List. Each phase ends with something the owner can see and approve before the next one starts.

**Stack:** Next.js (TypeScript) + Tailwind · Supabase (Postgres + Auth) · Vercel hosting · Python scrapers on GitHub Actions. Free tiers only.

| # | Phase | Done when |
|---|-------|-----------|
| 0 | **Setup**: git, Next.js scaffold, public GitHub repo, Vercel deploy | A black page saying *Yosif's List* is live on a `*.vercel.app` URL ✅ [yosifs-list.vercel.app](https://yosifs-list.vercel.app/) |
| 1 | **List builder UI** (mock data): italic title, Enter adds an item with an animation, columns of 12, photo + name + ✕, `localStorage` autosave, optional `2x milk` quantities | The owner can build, remove and refresh a list on desktop and phone |
| 2 | **Results receipts UI** (mock data): one receipt per store, sorted cheapest first, cheapest highlighted, "not found" rows, alternatives arrow, swipe on phones, disclaimer footer | The full list-to-results journey works with fake data |
| 3 | **Database + search**: Supabase schema, `pg_trgm` fuzzy search, `/api/search`, seed data | "milk", "eggs" and "rice" return sensible matches from the DB |
| 4 | **Scrapers**, one store at a time (Carrefour, Lulu, Al Meera): recon in `docs/scraping-notes.md`, then `scrapers/<store>.py`, a weekly GitHub Action with one job per store, and a product-count health check | All three stores refresh weekly on their own |
| 5 | **Accounts + saved lists**: username/password (hidden made-up email in Supabase Auth), past lists, `last_login`, yearly inactive cleanup | Sign up, save, log out and in, and reload an old list all work |
| 6 | **"Fix this price"**: correction form, owner approval on `/admin`, rate limiting | A correction can be submitted, approved and shown |
| 7 | **Launch polish**: phone testing, loading/empty/error states, favicon, optional domain, "How it works" page | Ready to share |
| — | **Later**: more stores, AI product matching, AI scraper repair, smarter search, Arabic | Only if needed |

## Planned layout
```
app/page.tsx              list builder
app/results/page.tsx      receipts
app/api/search/route.ts   search endpoint
supabase/migrations/      SQL schema
scrapers/<store>.py       one scraper per store
scrapers/common.py        shared save-to-Supabase helper
.github/workflows/        scrape.yml, cleanup-inactive.yml
docs/                     vision, roadmap, scraping notes
```
