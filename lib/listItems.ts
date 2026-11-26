import { rpc } from "./supabase";
import type { Match } from "./results";

/** One line on the user's grocery list. */
export type ListItem = {
  id: string;
  /** What the user typed, minus any quantity (e.g. "milk"). */
  query: string;
  qty: number;
  /** The product we show a photo and name for, or null if nothing matched (yet). */
  product: { id: string; name: string; size: string; image: string } | null;
  /**
   * Only for products picked from the dropdown: their aisle (e.g. "rice"). The results then
   * match that exact product, and offer other products of this kind as alternatives.
   */
  kind?: string;
};

const MAX_QTY = 99;

/**
 * Pull a quantity out of what the user typed, without AI:
 * "2x milk", "2 x milk", "2× milk" or "milk x2" → { qty: 2, query: "milk" }.
 * Anything else is quantity 1.
 */
export function parseEntry(raw: string): { query: string; qty: number } {
  const text = raw.trim().replace(/\s+/g, " ");
  const front = text.match(/^(\d{1,2})\s*[x×]\s+(.+)$/i);
  const back = text.match(/^(.+?)\s+[x×]\s*(\d{1,2})$/i);
  const [qtyStr, query] = front
    ? [front[1], front[2]]
    : back
      ? [back[2], back[1]]
      : ["1", text];
  const qty = Math.min(MAX_QTY, Math.max(1, parseInt(qtyStr, 10) || 1));
  return { query: query.trim(), qty };
}

/** One row of the search-as-you-type dropdown (the same product across stores, grouped). */
export type Suggestion = {
  name: string;
  size: string | null;
  image_url: string | null;
  min_price: number | string;
  max_price: number | string;
  store_count: number;
  /** The product's aisle, e.g. "rice" (used to find alternatives on the results page). */
  kind?: string | null;
};

export function suggestProducts(q: string, signal?: AbortSignal): Promise<Suggestion[]> {
  return rpc<Suggestion[]>("suggest_products", { q, max_results: 6 }, signal);
}

/** "Abu Kass Rice 5kg" + "5kg" → "Abu Kass Rice 5kg" (don't repeat a size that's already in the name). */
export function withSize(name: string, size?: string | null): string {
  if (!size || name.toLowerCase().includes(size.toLowerCase())) return name;
  return `${name} ${size}`;
}

/** Best product in the database for a query, for the photo + name on the list. */
export async function lookupProduct(query: string): Promise<ListItem["product"]> {
  const matches = await rpc<Match[]>("search_list", { queries: [query], per_store: 1 });
  const best = matches
    .filter((m) => m.image_url)
    .sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  return { id: String(best.product_id), name: best.name, size: best.size ?? "", image: best.image_url ?? "" };
}

export function newId(): string {
  // Not crypto.randomUUID(): that's unavailable over plain http (e.g. testing on a phone via LAN IP).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
