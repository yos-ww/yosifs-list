import { mockProducts, type MockProduct } from "./mockProducts";

/** One line on the user's grocery list. */
export type ListItem = {
  id: string;
  /** What the user typed, minus any quantity (e.g. "milk"). */
  query: string;
  qty: number;
  /** The product we show a photo and name for, or null if nothing matched. */
  product: Pick<MockProduct, "id" | "name" | "size" | "image"> | null;
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

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)); // crude plural → singular
}

/**
 * Find the best sample product for a query (stand-in for real search in Phase 3).
 * Scores each product by how many query words appear in its name or category.
 */
export function findProduct(query: string): ListItem["product"] {
  const q = words(query);
  if (q.length === 0) return null;
  let best: MockProduct | null = null;
  let bestScore = 0;
  for (const p of mockProducts) {
    const name = new Set(words(p.name));
    const cat = new Set(words(p.category));
    let score = 0;
    for (const w of q) {
      if (name.has(w)) score += 1;
      else if (cat.has(w)) score += 0.75;
    }
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (!best) return null;
  return { id: best.id, name: best.name, size: best.size, image: best.image };
}

export function newId(): string {
  // Not crypto.randomUUID(): that's unavailable over plain http (e.g. testing on a phone via LAN IP).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
