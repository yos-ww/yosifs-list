# Yosif's List: instructions for AI

A free website for **Doha, Qatar**. The user types a grocery list and sees which store gives the cheapest total, shown as one receipt per store side by side.

- Full vision: `docs/vision.md` (the original is the `.docx` in `docs/`)
- Build order and phases: `docs/roadmap.md`
- Next.js 16 rules: `AGENTS.md`. **Read the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API**, because they have changed from older versions.

## Current phase
**Phase 2: Results receipts UI (mock data).** Built, waiting for the owner to review. Phase 1 (list builder) was approved.
Mock prices come from `lib/mockStores.ts`. The UI only depends on the types in `lib/results.ts`, so Phase 3 should return that same shape from the database. Phase 0 is almost done: the GitHub repo `yos-ww/yosifs-list` exists. Waiting on: the owner importing it into **Vercel** so each push to `main` auto-deploys.
Sample products with real photos are in `lib/mockProducts.ts` (from Open Food Facts) until Phase 3 adds the database.
_Update this line whenever a phase starts or finishes._

## Hard rules from the vision (don't break these)
- **Design:** minimal and black, with *Yosif's List* in a classy italic serif at the top. Products show real store photos, never icons.
- **No money:** no ads, subscriptions, affiliate links or tracking. Budget is about $10–20 a month at most, so use free tiers and **ask the owner before adding anything paid.**
- **Scope:** Doha only, English only (Arabic later). Stores: Carrefour, Lulu, Al Meera first.
- **Searches never scrape live.** They read saved prices from the database.
- **Scrapers are plain scripts, never AI.** One small scraper per store, gentle request rates, run on a schedule by GitHub Actions.
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
