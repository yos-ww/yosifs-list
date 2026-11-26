# Yosif's List: instructions for AI

A free website for **Doha, Qatar**. The user types a grocery list and sees which store gives the cheapest total, shown as one receipt per store side by side.

- Full vision: `docs/vision.md` (the original is the `.docx` in `docs/`)
- Build order and phases: `docs/roadmap.md`
- Next.js 16 rules: `AGENTS.md`. **Read the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API**, because they have changed from older versions.

## Current phase
**Phase 3 (database) is live, and Phase 4 (scrapers) has started.** The site reads real prices from Supabase. The Rafeeq scraper (`scrapers/rafeeq.py`, GitHub Action "Scrape prices", run by hand) has loaded a 30-per-chain sample for 7 chains.
Open questions: the refresh plan for ~175k grocery products, and better matching for vague queries like "milk".
- **Database changes:** add or edit SQL in `supabase/migrations/` and push. The "Update database" Action re-runs **every** file in order with psql, so every migration must be safe to re-run (`if not exists`, `create or replace`, `drop policy if exists`). Never ask the owner to paste SQL.
- **Secrets (GitHub Actions):** `SUPABASE_SECRET_KEY` (scraper writes), `SUPABASE_DB_URL` (migrations). The publishable key and URL are public and live in `lib/supabase.ts`.
- The browser talks to Supabase directly (`lib/supabase.ts`). Search is the `search_list(queries[], per_store)` database function; `lib/results.ts` builds the receipts. Live site: **https://yosifs-list.vercel.app/**. Vercel auto-deploys every push to `main` of `yos-ww/yosifs-list`.
Sample products with real photos are in `lib/mockProducts.ts` (from Open Food Facts) until Phase 3 adds the database.
_Update this line whenever a phase starts or finishes._

## Hard rules from the vision (don't break these)
- **Design:** minimal and black, with *Yosif's List* in a classy italic serif at the top. Products show real store photos, never icons.
- **No money:** no ads, subscriptions, affiliate links or tracking. Budget is about $10–20 a month at most, so use free tiers and **ask the owner before adding anything paid.** The owner's GitHub/LinkedIn logos (top right, `lib/site.ts`) are wanted and are not an ad. Keep them logos only, with no "by Yosif" text.
- **Scope:** Doha only, English only (Arabic later). Stores: Carrefour, Lulu, Al Meera first.
- **Searches never scrape live.** They read saved prices from the database.
- **Scrapers are plain scripts, never AI.** One small scraper per store, gentle request rates, run on a schedule by GitHub Actions.
- **Scraping boundaries (owner's decision; see `docs/scraping-notes.md`):** public pages only, no logins, respect robots.txt paths, at least 1 s between requests, and **never get around a block** (Cloudflare/Akamai challenges, CAPTCHAs, 403s). If a source asks us to stop, stop and remove its data.
- **No AI features in v1.** AI matching and smarter search are "later, if needed".
- **Accounts:** username and password only, no email. The only tracking is `last_login`. Accounts inactive for 1 year are deleted.

## Stack
Next.js 16 (App Router, TypeScript) + Tailwind 4 · Supabase (Postgres, Auth) · **Vercel** hosting (the owner chose it over Netlify) · Python scrapers on GitHub Actions.

## How to work with the owner
The owner is a **beginner**, so:
- Work in **small steps**. After each one, run the site (`npm run dev`) and show the result: screenshots at desktop and phone widths.
- Explain changes in plain language, with no unexplained jargon.
- When the owner must do something by hand (create an account, paste a key), give exact click-by-click steps.
- Run `npm run build` and `npm run lint` before each commit. Commit after each working step with a clear message.
- **Never commit secrets.** The repo is **public**. Keys go in `.env.local` (git-ignored), Vercel env vars or GitHub Actions secrets.
- Finish one phase and get the owner's approval before starting the next.
