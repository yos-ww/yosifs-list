# Scraping notes

What each source's **robots.txt** and **terms of use** say about automated access, checked on **2026-11-26**. Re-check before building each scraper, because sites change these.

**Owner's decision (2026-11-26):** go ahead and scrape public prices for this free, non-commercial tool, **including the delivery apps whose terms forbid it** (the owner accepts the terms-of-use risk). **Stop immediately for any source that asks us to.**
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

## Access check, 2026-11-26 (plain requests from the owner's Mac in Doha)
- **Lulu's own site is fully blocked too.** Its homepage, sitemap and terms all return Cloudflare's "Sorry, you have been blocked" (403). Only robots.txt loaded. That means **all three chains' own sites (Carrefour, Lulu, Talabat) block scripts.** Off-limits under our rules.
- **Al Meera's own site** (almeera.com.qa) is a JavaScript app; its data comes from an API we haven't looked at yet.
- **Rafeeq is the best source found so far:**
  - Public grocery page (`/en/home/grocery`) lists **Al Meera** (`al-meera-21327`), **Carrefour** (`carrefour-30689`), **Lulu Hypermarket** (`lulu-hypermarket-25809`), **Spar** (`spar-19881`), Ansar Gallery, City Hypermarket and more. Chains have several branch IDs (e.g. `lulu-hypermarket-24037` in the sitemap).
  - 23 public grocery sitemaps (`/sitemaps/grocery/sitemap_N.xml.gz`, ~25 MB each) list URLs as `/grocery/<store>/<category>/<subcategory>/<product>-<sku>`. Seen: Lulu ~4,400 URLs (sitemap_23), Monoprix ~80,000 (sitemap_18).
  - **Each product page has schema.org `Product` JSON-LD** with name, image, `offers.price` (QAR), availability and SKU. That's clean, structured data, so no layout scraping is needed.
  - Store pages load products through `/api/`, which robots.txt disallows, so **don't use the API**. Use sitemap → product pages only.
  - Cost: ~1 request per product. At 1 req/s, ~4,000 products ≈ 70 min per store per week, which fits GitHub Actions' 6-hour job limit.
- **Snoonu** has public product sitemaps (`/marketplace-products-N.xml`, 50,000 URLs each). Still to check: which stores they belong to, and whether product pages include prices.
- **Caveat:** prices on delivery apps can be higher than shelf prices. Show "Prices from Rafeeq" style labels, and compare against a few real receipts.

## What this means for Phase 4
1. **Main source: Rafeeq** (sitemap → product page JSON-LD) for Al Meera, Carrefour and Lulu, all from one scraper with one job per store.
2. **Check next:** Al Meera's own app API, and whether Snoonu's product pages include prices and which stores they cover. These are backups and cross-checks.
3. Rafeeq's and Snoonu's terms forbid scraping; the owner has accepted that risk. Asking them for written permission is still a good idea, since both say "unless … permission in writing".
4. Prices on delivery apps can differ from in-store prices. Label the source.

## Permission requests (to do)
A short, friendly email to each source: free, no ads, non-commercial, weekly gentle updates, links back to them, happy to stop on request. Track replies here.

| Source | Contact | Sent | Reply |
|---|---|---|---|
| Carrefour Qatar | carrefourqatar@mafcarrefour.com (help-center contact) | | |
| Snoonu | customer.support@snoonu.com (App Store listing) | | |
| Rafeeq | via gorafeeq.com | | |
| Lulu, Al Meera, Talabat, Keeta | to find | | |
