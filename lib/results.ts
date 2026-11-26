/**
 * The shape of search results: one receipt per store.
 * Phase 2 fills these from mock data (lib/mockStores.ts); Phase 3 will fill
 * them from the database, keeping the same shape so the UI doesn't change.
 */

export type PricedProduct = {
  id: string;
  name: string;
  size: string;
  image: string;
  /** Price for one, in QAR. */
  price: number;
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
