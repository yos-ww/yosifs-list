# Yosif's List: instructions for AI

A free website for **Doha, Qatar**. The user types a grocery list and sees which store gives the cheapest total, shown as one receipt per store side by side.

- Full vision: `docs/vision.md` (the original is the `.docx` in `docs/`)
- Build order and phases: `docs/roadmap.md`
- Next.js 16 rules: `AGENTS.md`. **Read the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API**, because they have changed from older versions.

## Current phase
**Phase 0: Setup.** Done: git repo, docs, Next.js 16 scaffold, black home page, GitHub repo `yos-ww/yosifs-list`. Waiting on: Vercel deploy (owner connects the repo in Vercel).
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
Next.js (App Router, TypeScript) + Tailwind · Supabase (Postgres, Auth) · Vercel · Python scrapers on GitHub Actions.

## How to work with the owner
The owner is a **beginner**, so:
- Work in **small steps**. After each one, run the site (`npm run dev`) and show the result: screenshots at desktop and phone widths.
- Explain changes in plain language, with no unexplained jargon.
- When the owner must do something by hand (create an account, paste a key), give exact click-by-click steps.
- Run `npm run build` and `npm run lint` before each commit. Commit after each working step with a clear message.
- **Never commit secrets.** The repo is **public**. Keys go in `.env.local` (git-ignored), Vercel env vars or GitHub Actions secrets.
- Finish one phase and get the owner's approval before starting the next.
