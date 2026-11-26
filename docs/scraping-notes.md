# Scraping notes

What each source's **robots.txt** and **terms of use** say about automated access, checked on **2026-11-26**. Re-check before building each scraper, because sites change these.

**Owner's decision (2026-11-26):** go ahead and scrape public prices for this free, non-commercial tool, and **stop immediately for any source that asks us to**.
**Fixed rules for every scraper:** public pages only (no logins); gentle pacing (at least 1 s between requests, weekly runs); respect robots.txt paths; **never get around a block** (Cloudflare/Akamai challenges, CAPTCHAs, 403s). A block is treated as a "no".

## Summary

| Source | robots.txt (for general bots) | Terms on scraping | Simple-script access today | Notes |
|---|---|---|---|---|
| **Lulu** (gcc.luluhypermarket.com/en-qa) | Allowed, except `/search/`, `/api/`, cart, account, login, compare. `Crawl-delay: 1` | **Unknown** (terms page returns 403 to scripts) | robots.txt OK; terms page 403 | Qatar sitemap: `/en-qa/sitemap.xml`. Don't use `/api/` or `/search/`. |
| **Al Meera** (almeera.online → almeera.com.qa) | No robots.txt (404), so no stated rules | **Unknown** (JavaScript-only site, terms not found) | Homepage loads (JS shell) | Data likely comes from a JSON API the app calls; check it in Phase 4. |
| **Carrefour** (carrefourqatar.com/mafqat) | Couldn't read (Akamai returns a blank page) | **Unknown** (site timed out / blank) | **Blocked** (Akamai bot protection) | Per our rules, can't be scraped by a simple script. Look for another source or ask permission. |
| **Talabat** (talabat.com/qatar) | Couldn't read (Cloudflare "you have been blocked") | **Unknown** (terms page 403) | **Blocked** (Cloudflare) | Lists Al Meera and other hypermarkets, but out of reach under our rules. |
| **Snoonu** (snoonu.com) | Allowed (`Allow: /`); blocks AI crawlers only | **Explicitly prohibited** without written permission | OK | §5.4(k): no "robot, spider, web crawler… to scrape, copy, or monitor"; §5.4(m): no "systematic retrieval of data". Qatar law (§23). |
| **Rafeeq** (gorafeeq.com) | Allowed except `/api/`, basket, checkout, login, profile; blocks AI crawlers | **Explicitly prohibited** | OK | §V.8(ii): no "page-scrape, robot, spider or other automatic device… to access, acquire, copy or monitor". Has large public grocery sitemaps (`/sitemaps/grocery/…`). |
| **Keeta** (keeta.com) | Allowed (`Allow: /`) | **Explicitly prohibited** on keeta.com | OK | But keeta.com's terms are a US documentation site (Wyoming law); no Qatar-specific terms found. |

## What this means for Phase 4
1. **Stores' own sites first**: Lulu and Al Meera. Their robots.txt allows (or doesn't restrict) general bots and their terms on scraping are unknown, so they're the least-objectionable sources. Re-read their terms from a normal browser before building.
2. **Carrefour**: blocked to scripts. Options: (a) ask Carrefour (Majid Al Futtaim) for permission or a data feed, (b) a delivery app that lists Carrefour, (c) crowdsourced prices.
3. **Delivery apps** (Snoonu, Rafeeq, Keeta): their terms explicitly forbid scraping without written permission. Snoonu and Rafeeq both say "unless … permission in writing", so **asking is a real option** for a free community tool.
4. Prices on delivery apps can differ from in-store prices. Label the source if we use them.

## Permission requests (to do)
A short, friendly email to each source: free, no ads, non-commercial, weekly gentle updates, links back to them, happy to stop on request. Track replies here.

| Source | Contact | Sent | Reply |
|---|---|---|---|
| Carrefour Qatar | carrefourqatar@mafcarrefour.com (help-center contact) | | |
| Snoonu | customer.support@snoonu.com (App Store listing) | | |
| Rafeeq | via gorafeeq.com | | |
| Lulu, Al Meera, Talabat, Keeta | to find | | |
