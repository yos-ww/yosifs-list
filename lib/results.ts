/**
 * Search results: one receipt per store.
 * The database (search_list) returns the best few matches per list item per store;
 * buildReceipts() turns those into receipts, applying any alternatives the user picked.
 */
import type { ListItem } from "./listItems";

export type Store = { id: string; name: string };

/** One row from the database's search_list() function. */
export type Match = {
  query_idx: number; // 1-based position of the list item
  store_id: string;
  product_id: number;
  name: string;
  size: string | null;
  category: string | null;
  price_qar: number | string; // numeric may arrive as a string
  image_url: string | null;
  source_url: string | null;
  score: number;
  rank: number; // 1 = best match at that store
};

export type PricedProduct = {
  id: string;
  name: string;
  size: string;
  image: string;
  /** Price for one, in QAR. */
  price: number;
  sourceUrl?: string;
};

export type ReceiptLine = {
  itemId: string;
  query: string;
  qty: number;
  /** The product this store would sell you, or null if "not found". */
  product: PricedProduct | null;
  /** price × qty, or null if not found. */
  lineTotal: number | null;
  /** Other options at this store (bigger size, similar product). */
  alternatives: PricedProduct[];
};

export type Receipt = {
  storeId: string;
  storeName: string;
  lines: ReceiptLine[];
  total: number;
  /** How many list items this store doesn't carry. */
  missing: number;
};

function toPriced(m: Match): PricedProduct {
  return {
    id: String(m.product_id),
    name: m.name,
    size: m.size ?? "",
    image: m.image_url ?? "",
    price: Number(m.price_qar),
    sourceUrl: m.source_url ?? undefined,
  };
}

/**
 * `choices` holds alternatives the user picked, keyed by `${storeId}:${itemId}` → product id.
 */
export function buildReceipts(
  items: ListItem[],
  stores: Store[],
  matches: Match[],
  choices: Record<string, string>,
): Receipt[] {
  // store → item position → matches (best first)
  const byStore = new Map<string, Map<number, Match[]>>();
  for (const m of matches) {
    const forStore = byStore.get(m.store_id) ?? new Map<number, Match[]>();
    const list = forStore.get(m.query_idx) ?? [];
    list.push(m);
    forStore.set(m.query_idx, list);
    byStore.set(m.store_id, forStore);
  }

  return stores.map((store) => {
    const lines: ReceiptLine[] = items.map((item, i) => {
      const options = (byStore.get(store.id)?.get(i + 1) ?? [])
        .sort((a, b) => a.rank - b.rank)
        .map(toPriced);
      const picked = choices[`${store.id}:${item.id}`];
      const product = options.find((o) => o.id === picked) ?? options[0] ?? null;
      return {
        itemId: item.id,
        query: item.query,
        qty: item.qty,
        product,
        lineTotal: product ? Math.round(product.price * item.qty * 100) / 100 : null,
        alternatives: options.filter((o) => o.id !== product?.id),
      };
    });
    const total = Math.round(lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0) * 100) / 100;
    const missing = lines.filter((l) => !l.product).length;
    return { storeId: store.id, storeName: store.name, lines, total, missing };
  });
}

/**
 * Cheapest first. A store that's missing items ranks after stores that have
 * everything, so a short receipt can't look "cheapest" just by leaving things out.
 */
export function sortReceipts(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) => a.missing - b.missing || a.total - b.total);
}

export function formatQar(n: number): string {
  return n.toFixed(2);
}
