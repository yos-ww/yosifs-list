/**
 * Fake store prices so the results page can be built before real data exists.
 * Prices are made up but stable: the same product always gets the same price
 * at the same store. Replaced by the database in Phase 3.
 */
import type { ListItem } from "./listItems";
import { rankProducts } from "./listItems";
import { mockProducts, type MockProduct } from "./mockProducts";
import type { PricedProduct, Receipt, ReceiptLine } from "./results";

type MockStore = { id: string; name: string; priceLevel: number };

export const mockStores: MockStore[] = [
  { id: "carrefour", name: "Carrefour", priceLevel: 1.0 },
  { id: "lulu", name: "Lulu", priceLevel: 0.96 },
  { id: "almeera", name: "Al Meera", priceLevel: 1.05 },
];

/** Rough real-world price range per category, in QAR. */
const PRICE_RANGES: Record<string, [number, number]> = {
  milks: [6, 9],
  breads: [4, 8],
  rices: [25, 45],
  cheeses: [8, 20],
  yogurts: [2, 5],
  "fruit-juices": [5, 12],
  butters: [15, 30],
  waters: [1, 3],
  pastas: [3, 7],
  "chips-and-fries": [3, 6],
  "breakfast-cereals": [12, 25],
  coffees: [15, 40],
  teas: [10, 25],
  "olive-oils": [20, 45],
  sugars: [6, 10],
  flours: [4, 12],
  hummus: [6, 10],
  labneh: [8, 14],
  "tomato-pastes": [2, 5],
  honeys: [25, 60],
  biscuits: [1, 6],
  sodas: [1.5, 3],
};

/** A repeatable number between 0 and 1 for a given string (FNV-1a hash). */
function stable01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** About 1 in 8 products is missing from each store. */
function carries(store: MockStore, p: MockProduct): boolean {
  return stable01(`carry:${store.id}:${p.id}`) >= 0.12;
}

function priceAt(store: MockStore, p: MockProduct): number {
  const [lo, hi] = PRICE_RANGES[p.category] ?? [5, 15];
  const base = lo + stable01(`base:${p.id}`) * (hi - lo);
  const noise = 0.92 + stable01(`noise:${store.id}:${p.id}`) * 0.16; // ±8%
  return Math.max(0.5, Math.round(base * store.priceLevel * noise * 4) / 4); // nearest 0.25 QAR
}

function priced(store: MockStore, p: MockProduct): PricedProduct {
  return { id: p.id, name: p.name, size: p.size, image: p.image, price: priceAt(store, p) };
}

const MAX_ALTERNATIVES = 3;

/**
 * Build one receipt per store for the list.
 * `choices` holds products the user picked from the alternatives,
 * keyed by `${storeId}:${itemId}`.
 */
export function mockReceipts(items: ListItem[], choices: Record<string, string>): Receipt[] {
  return mockStores.map((store) => {
    const shelf = mockProducts.filter((p) => carries(store, p));

    const lines: ReceiptLine[] = items.map((item) => {
      const ranked = rankProducts(item.query, shelf);
      const picked = choices[`${store.id}:${item.id}`];
      // Prefer: the user's pick → the exact product shown on the list → the store's best match.
      const chosen =
        shelf.find((p) => p.id === picked) ??
        shelf.find((p) => p.id === item.product?.id) ??
        ranked[0] ??
        null;
      const product = chosen ? priced(store, chosen) : null;
      return {
        itemId: item.id,
        query: item.query,
        qty: item.qty,
        product,
        lineTotal: product ? Math.round(product.price * item.qty * 100) / 100 : null,
        // Alternatives are the same kind of product (other milks for milk, not "Milk Bread").
        alternatives: ranked
          .filter((p) => p.id !== chosen?.id && (!chosen || p.category === chosen.category))
          .slice(0, MAX_ALTERNATIVES)
          .map((p) => priced(store, p)),
      };
    });

    const total = Math.round(lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0) * 100) / 100;
    const missing = lines.filter((l) => !l.product).length;
    return { storeId: store.id, storeName: store.name, lines, total, missing };
  });
}
