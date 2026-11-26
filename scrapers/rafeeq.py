#!/usr/bin/env python3
"""
Rafeeq grocery price scraper (plain script, no AI). See docs/scraping-notes.md.

How it works:
  1. `index`  — read Rafeeq's public grocery sitemaps and list product pages for the big chains.
  2. `scrape` — visit each product page (1 per second) and read the structured product data
                (schema.org JSON-LD: name, photo, price in QAR, in stock) that the page publishes.
  3. `upload` — save the results to Supabase (needs SUPABASE_URL and SUPABASE_SECRET_KEY).

Rules we keep (owner's decision): public pages only, no logins, no /api/ (robots.txt),
>= 1 s between requests, and if we're blocked (403 / challenge page) we STOP — never get around it.

Usage:
  python3 scrapers/rafeeq.py index
  python3 scrapers/rafeeq.py scrape --limit 30            # 30 products per chain (a quick sample)
  python3 scrapers/rafeeq.py scrape                       # everything
  python3 scrapers/rafeeq.py upload
Only uses the Python standard library.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://www.gorafeeq.com"
SITEMAP_INDEX = f"{BASE}/sitemap.xml"
USER_AGENT = "grocery-price-compare/0.1 (free non-commercial price comparison; weekly, 1 req/s)"
DELAY_SECONDS = 1.0
DATA_DIR = Path(__file__).parent / "data"
INDEX_FILE = DATA_DIR / "rafeeq_index.json"
PRODUCTS_FILE = DATA_DIR / "rafeeq_products.jsonl"

# Our store id → (display name, Rafeeq store-slug prefix). A store slug looks like "lulu-hypermarket-24037".
CHAINS = {
    "almeera": ("Al Meera", "al-meera"),
    "carrefour": ("Carrefour", "carrefour"),
    "lulu": ("Lulu", "lulu-hypermarket"),
    "spar": ("Spar", "spar"),
    "monoprix": ("Monoprix", "monoprix"),
    # Not on Rafeeq (checked 2026-11-26), kept so they're picked up if they join:
    "safari": ("Safari", "safari"),
    "familyfood": ("Family Food Centre", "family-food-centre"),
    # Owner chose not to include Ansar Gallery and City Hypermarket for now.
}

# Top-level Rafeeq categories we skip: not groceries (home goods, beauty, toys, electronics…).
NON_GROCERY = {
    "home essentials", "household essentials", "personal care", "stationary games", "health beauty",
    "electronics", "beauty women s care", "hair care", "hygiene personal care", "kitchen utensils",
    "pharmacy", "men care", "games toys", "body care", "flowers and gifts", "pet care", "disposables",
}

# Everyday staples get scraped first, in this order (matched against the aisle name).
STAPLES = [
    "milk", "laban", "egg", "bread", "bakery", "rice", "dairy", "yogurt", "cheese", "butter",
    "fruit", "vegetable", "chicken", "poultry", "meat", "fish", "seafood", "oil", "ghee",
    "sugar", "flour", "water", "juice", "tea", "coffee", "pasta", "noodle", "canned", "tomato",
    "cereal", "breakfast", "honey", "date",
]


def staple_rank(category: str) -> int:
    c = category.lower()
    return next((i for i, word in enumerate(STAPLES) if word in c), len(STAPLES))


PRODUCT_URL_RE = re.compile(
    r"<loc>(https://www\.gorafeeq\.com/en/home/grocery/([a-z0-9-]+)/([a-z0-9-]+)/([a-z0-9-]+)/([a-z0-9-]+?)-(\d+))</loc>"
)
LD_JSON_RE = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
SIZE_RE = re.compile(
    r"(\d+(?:[.,]\d+)?\s?(?:kg|kgs|g|gm|gms|gram|grams|ml|l|ltr|litre|liter|lt|pcs|pc|pieces)\b"
    r"(?:\s?\(?\s?\d+\s?[xX]\s?\d+\s?\)?)?)",
    re.I,
)


class Blocked(Exception):
    """The site refused us. Per our rules we stop instead of working around it."""


def fetch(url: str, retries: int = 2) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                body = resp.read()
            if b"Attention Required! | Cloudflare" in body[:3000] or b"you have been blocked" in body[:5000]:
                raise Blocked(f"challenge page at {url}")
            return body
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise Blocked(f"HTTP {e.code} at {url}") from e
            if e.code == 404:
                raise
            if attempt == retries:
                raise
            wait = 30 if e.code == 429 else 10 * (attempt + 1)
            print(f"  HTTP {e.code}, waiting {wait}s…", file=sys.stderr)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == retries:
                raise
            print(f"  network error ({e}), retrying…", file=sys.stderr)
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


def maybe_gunzip(body: bytes) -> str:
    try:
        body = gzip.decompress(body)
    except OSError:
        pass  # served as plain XML despite the .gz name
    return body.decode("utf-8", "replace")


def chain_for_slug(store_slug: str) -> str | None:
    for chain_id, (_, prefix) in CHAINS.items():
        if re.fullmatch(rf"{re.escape(prefix)}-\d+", store_slug):
            return chain_id
    return None


def humanize(slug: str) -> str:
    return re.sub(r"-\d+$", "", slug).replace("-", " ").strip()


# ── 1. index ────────────────────────────────────────────────────────────────
def cmd_index(_args) -> None:
    index_xml = maybe_gunzip(fetch(SITEMAP_INDEX))
    sitemaps = re.findall(r"<loc>([^<]*/sitemaps/grocery/[^<]+)</loc>", index_xml)
    print(f"{len(sitemaps)} grocery sitemaps", file=sys.stderr)

    # chain → store slug → {sku: product info}
    found: dict[str, dict[str, dict[str, dict]]] = defaultdict(lambda: defaultdict(dict))
    near_misses: dict[str, int] = defaultdict(int)
    for i, sm in enumerate(sitemaps, 1):
        time.sleep(DELAY_SECONDS)
        xml = maybe_gunzip(fetch(sm))
        n = 0
        for m in PRODUCT_URL_RE.finditer(xml):
            url, store_slug, cat, sub, _name, sku = m.groups()
            chain = chain_for_slug(store_slug)
            if chain:
                found[chain][store_slug].setdefault(sku, {"url": url, "category": f"{humanize(cat)} / {humanize(sub)}"})
                n += 1
            elif any(p in store_slug for _, p in CHAINS.values()):
                near_misses[store_slug] += 1
        print(f"  [{i}/{len(sitemaps)}] {sm.rsplit('/', 1)[-1]}: {n} chain product URLs", file=sys.stderr)

    DATA_DIR.mkdir(exist_ok=True)
    INDEX_FILE.write_text(json.dumps(found, indent=1))
    print("\nProducts per chain branch (scrape uses the biggest branch per chain):")
    for chain, branches in sorted(found.items()):
        for slug, prods in sorted(branches.items(), key=lambda kv: -len(kv[1])):
            print(f"  {chain:<11} {slug:<32} {len(prods):>6}")
    missing = [c for c in CHAINS if c not in found]
    if missing:
        print(f"  not on Rafeeq: {', '.join(missing)}")
    if near_misses:
        print("\nOther store slugs that look like chains (check by hand):")
        for slug, n in sorted(near_misses.items(), key=lambda kv: -kv[1])[:15]:
            print(f"  {slug:<40} {n:>6}")


# ── 2. scrape ───────────────────────────────────────────────────────────────
def parse_product(html: str) -> dict | None:
    for block in LD_JSON_RE.findall(html):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("@type") == "Product":
                return item
    return None


def pick_items(products: dict, args) -> list:
    """Which of a chain's products to visit this run."""
    groceries = [
        (sku, info) for sku, info in products.items()
        if info["category"].split(" / ")[0] not in NON_GROCERY
    ]
    if args.limit:
        # Spread a small sample across aisles instead of taking 30 cheeses.
        by_aisle: dict[str, list] = defaultdict(list)
        for sku, info in groceries:
            by_aisle[info["category"]].append((sku, info))
        aisles = list(by_aisle.values())
        items: list = []
        while len(items) < args.limit and any(aisles):
            for aisle in aisles:
                if aisle and len(items) < args.limit:
                    items.append(aisle.pop(0))
        return items
    # Staples first, then everything else; stable order so slices stay roughly the same week to week.
    groceries.sort(key=lambda si: (staple_rank(si[1]["category"]), si[0]))
    if args.slice:
        k, n = (int(x) for x in args.slice.split("/"))
        groceries = groceries[k * len(groceries) // n : (k + 1) * len(groceries) // n]
    return groceries


def cmd_scrape(args) -> None:
    if not INDEX_FILE.exists():
        sys.exit("Run `index` first.")
    index = json.loads(INDEX_FILE.read_text())
    chains = [c for c in (args.chains.split(",") if args.chains else list(index)) if c in CHAINS]
    now = datetime.now(timezone.utc).isoformat()
    deadline = time.monotonic() + args.max_minutes * 60 if args.max_minutes else None

    # Build each chain's to-do list, then visit them round-robin so a time limit cuts all chains evenly.
    queues = []
    for chain in chains:
        branches = index.get(chain)
        if not branches:
            print(f"{chain}: not in index, skipping", file=sys.stderr)
            continue
        slug, products = max(branches.items(), key=lambda kv: len(kv[1]))
        items = pick_items(products, args)
        print(f"{chain}: {len(items)} products from {slug}", file=sys.stderr)
        queues.append([(chain, sku, info) for sku, info in items])
    todo = [q[i] for i in range(max((len(q) for q in queues), default=0)) for q in queues if i < len(q)]
    print(f"{len(todo)} product pages to visit", file=sys.stderr)

    DATA_DIR.mkdir(exist_ok=True)
    ok = skipped = 0
    with PRODUCTS_FILE.open("a" if args.append else "w") as out:
        for n, (chain, sku, info) in enumerate(todo, 1):
            if deadline and time.monotonic() > deadline:
                print(f"Time limit reached after {n - 1} pages; saving what we have.", file=sys.stderr)
                break
            if n % 250 == 0:
                print(f"  {n}/{len(todo)} ({ok} saved)", file=sys.stderr)
            time.sleep(DELAY_SECONDS)
            row = scrape_product(chain, sku, info, now)
            if row is None:
                skipped += 1
                continue
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            out.flush()  # keep what we have if the run stops early
            ok += 1
    print(f"Saved {ok} products ({skipped} skipped) to {PRODUCTS_FILE}", file=sys.stderr)


def scrape_product(chain: str, sku: str, info: dict, now: str) -> dict | None:
    """Visit one product page and turn its JSON-LD into a database row (None if unusable)."""
    try:
        html = fetch(info["url"]).decode("utf-8", "replace")
    except urllib.error.HTTPError:
        return None
    p = parse_product(html)
    if not p:
        return None
    offer = p.get("offers") or {}
    if isinstance(offer, list):
        offer = offer[0] if offer else {}
    try:
        price = float(offer.get("price"))
    except (TypeError, ValueError):
        return None
    if offer.get("priceCurrency", "QAR") != "QAR" or price <= 0:
        return None
    name = " ".join(str(p.get("name", "")).split())
    image = p.get("image")
    if isinstance(image, list):
        image = image[0] if image else None
    size = SIZE_RE.search(name)
    return {
        "store_id": chain,
        "source": "rafeeq",
        "source_sku": sku,
        "name": name,
        "size": size.group(1) if size else None,
        "category": info["category"],
        "price_qar": round(price, 2),
        "in_stock": "InStock" in str(offer.get("availability", "InStock")),
        "image_url": image,
        "source_url": info["url"],
        "scraped_at": now,
    }


# ── 3. upload ───────────────────────────────────────────────────────────────
def supabase_request(path: str, rows: list, key: str, url: str, on_conflict: str) -> None:
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    if key.startswith("eyJ"):  # legacy JWT-style keys also go in Authorization; new sb_secret_ keys don't
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}?on_conflict={on_conflict}",
        data=json.dumps(rows).encode(),
        method="POST",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase refused the upload to {path} (HTTP {e.code}): {e.read().decode('utf-8', 'replace')[:500]}")


def cmd_upload(_args) -> None:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.")
    rows = [json.loads(line) for line in PRODUCTS_FILE.read_text().splitlines() if line.strip()]
    store_ids = sorted({r["store_id"] for r in rows})
    supabase_request(
        "stores", [{"id": s, "name": CHAINS[s][0]} for s in store_ids], key, url, "id"
    )
    for i in range(0, len(rows), 500):
        supabase_request("products", rows[i : i + 500], key, url, "store_id,source,source_sku")
        print(f"  uploaded {min(i + 500, len(rows))}/{len(rows)}", file=sys.stderr)
    print(f"Uploaded {len(rows)} products for {', '.join(store_ids)}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("index")
    s = sub.add_parser("scrape")
    s.add_argument("--limit", type=int, default=0, help="max products per chain (0 = all)")
    s.add_argument("--chains", default="", help="comma-separated chain ids (default: all found)")
    s.add_argument("--append", action="store_true", help="add to the existing output file instead of replacing it")
    s.add_argument("--slice", default="", help="K/N: only the K-th of N slices (staples are in the first slices)")
    s.add_argument("--max-minutes", type=float, default=0, help="stop visiting pages after this long (0 = no limit)")
    sub.add_parser("upload")
    args = ap.parse_args()
    try:
        {"index": cmd_index, "scrape": cmd_scrape, "upload": cmd_upload}[args.cmd](args)
    except Blocked as e:
        sys.exit(f"STOPPED: Rafeeq refused the request ({e}). Per our rules we don't work around blocks.")


if __name__ == "__main__":
    main()
