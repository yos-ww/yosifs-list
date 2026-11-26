"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { withSize } from "@/lib/listItems";
import { useHydrated, useListItems } from "@/lib/listStore";
import {
  buildReceipts,
  cheapestComplete,
  cheapestPerItem,
  formatQar,
  sortReceipts,
  type Match,
  type Receipt,
  type ReceiptLine,
  type Store,
} from "@/lib/results";
import { rpc, select } from "@/lib/supabase";
import ProductThumb from "./ProductThumb";
import ReportDialog from "./ReportDialog";

type Loaded = { key: string; stores: Store[]; matches: Match[] };

export default function Receipts() {
  const items = useListItems();
  const hydrated = useHydrated();
  /** Alternatives the user picked, keyed by `${storeId}:${itemId}`. */
  const [choices, setChoices] = useState<Record<string, string>>({});
  /** Which item's alternatives menu is open, as `${storeId}:${itemId}`. */
  const [open, setOpen] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Only search again when the items themselves change (not when a quantity changes).
  const queriesKey = JSON.stringify(items.map((i) => [i.query, i.kind ?? null]));

  useEffect(() => {
    if (!hydrated) return;
    const parsed = JSON.parse(queriesKey) as [string, string | null][];
    if (parsed.length === 0) return;
    const queries = parsed.map(([q]) => q);
    const kinds = parsed.map(([, k]) => k);
    const ctrl = new AbortController();
    Promise.all([
      select<Store>("stores", "id,name", ctrl.signal),
      rpc<Match[]>("search_list", { queries, per_store: 5, kinds }, ctrl.signal),
    ])
      .then(([stores, matches]) => setData({ key: queriesKey, stores, matches }))
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(queriesKey);
      });
    return () => ctrl.abort();
  }, [hydrated, queriesKey, attempt]);

  const receipts = useMemo(() => {
    if (!data || data.key !== queriesKey) return null;
    // Leave out stores that matched nothing on this list.
    const withMatches = new Set(data.matches.map((m) => m.store_id));
    const stores = data.stores.filter((s) => withMatches.has(s.id));
    return sortReceipts(buildReceipts(items, stores, data.matches, choices));
  }, [data, queriesKey, items, choices]);

  // Close the alternatives menu on Escape or a click outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-alt-root]")) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hydrated) return null; // wait for the saved list to load from the browser

  if (items.length === 0) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-neutral-500">Your list is empty.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-neutral-300 underline-offset-4 hover:underline">
          ← Add some items
        </Link>
      </div>
    );
  }

  if (!receipts) {
    if (failed === queriesKey) {
      return (
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-500">Couldn&apos;t load prices right now.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(null);
              setAttempt((a) => a + 1);
            }}
            className="mt-4 text-sm text-neutral-300 underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return <p className="mt-6 animate-pulse text-sm text-neutral-500">Comparing prices…</p>;
  }

  if (receipts.length === 0) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-neutral-500">No stores matched anything on your list yet.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-neutral-300 underline-offset-4 hover:underline">
          ← Try different words
        </Link>
      </div>
    );
  }

  const multi = receipts.length > 1;
  // Only a store that found EVERY item can be "cheapest"; totals with gaps aren't comparable.
  const winner = cheapestComplete(receipts);
  const priciestComplete = receipts
    .filter((r) => r.missing === 0 && r !== winner)
    .reduce<Receipt | null>((m, r) => (!m || r.total > m.total ? r : m), null);
  const bestPerItem = cheapestPerItem(receipts);
  const isBest = (line: ReceiptLine) => {
    const b = bestPerItem.get(line.itemId);
    return multi && !!b && b.count > 1 && line.lineTotal === b.min;
  };

  return (
    <div className="flex w-full flex-col items-center">
      {multi && (
        <div className="mb-8 max-w-xl text-center text-sm text-neutral-400">
          {winner ? (
            <p>
              <span className="text-neutral-100">{winner.storeName}</span> is cheapest at{" "}
              <span className="font-mono text-neutral-100">QAR {formatQar(winner.total)}</span>
              {priciestComplete && priciestComplete.total > winner.total && (
                <>
                  {" "}
                  — QAR {formatQar(priciestComplete.total - winner.total)} less than{" "}
                  {priciestComplete.storeName}
                </>
              )}
              .
            </p>
          ) : (
            <p>No store has everything on your list yet, so the totals cover different items.</p>
          )}
          <p className="mt-1.5 text-xs text-neutral-600">
            <span className="text-neutral-300">•</span> marks the cheapest price for each item.
          </p>
        </div>
      )}

      {/* Big, hard-to-miss accuracy warning that asks people to report problems. */}
      <div
        role="note"
        className="mb-8 w-full max-w-2xl rounded-2xl border border-amber-400/40 bg-amber-400/[0.07] px-5 py-4 text-left"
      >
        <p className="text-sm font-semibold text-amber-200">⚠ Prices may be out of date</p>
        <p className="mt-1 text-sm text-amber-100/75">
          Some items may not be in stock. Spot a mistake? Please report it.
        </p>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="mt-3 rounded-full bg-amber-300 px-5 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-200"
        >
          Report a problem
        </button>
      </div>

      {/* Phones: swipe between receipts. Desktop: side by side. */}
      <div className="no-scrollbar -mx-4 flex w-screen snap-x snap-mandatory gap-4 overflow-x-auto px-[7.5vw] pb-2 pt-4 sm:mx-0 sm:w-full sm:flex-wrap sm:items-start sm:justify-center sm:gap-6 sm:overflow-visible sm:px-0">
        {receipts.map((r) => (
          <ReceiptCard
            key={r.storeId}
            receipt={r}
            isCheapest={r === winner}
            isBest={isBest}
            open={open}
            onToggle={(key) => setOpen((cur) => (cur === key ? null : key))}
            onChoose={(itemId, productId) => {
              setChoices((c) => ({ ...c, [`${r.storeId}:${itemId}`]: productId }));
              setOpen(null);
            }}
          />
        ))}
      </div>
      {receipts.length > 1 && (
        <p className="mt-3 text-xs text-neutral-600 sm:hidden">Swipe to compare stores →</p>
      )}

      <p className="mt-12 max-w-md text-center text-xs text-neutral-500">
        Prices may differ slightly in store. Spot something off?{" "}
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="text-neutral-300 underline underline-offset-4 hover:text-white"
        >
          Tap to report it.
        </button>
      </p>

      {reportOpen && <ReportDialog receipts={receipts} onClose={closeReport} />}    </div>
  );
}

function ReceiptCard({
  receipt,
  isCheapest,
  isBest,
  open,
  onToggle,
  onChoose,
}: {
  receipt: Receipt;
  isCheapest: boolean;
  isBest: (line: ReceiptLine) => boolean;
  open: string | null;
  onToggle: (key: string) => void;
  onChoose: (itemId: string, productId: string) => void;
}) {
  return (
    <section
      aria-label={`${receipt.storeName} receipt`}
      className={`relative w-[85vw] max-w-80 shrink-0 snap-center rounded-2xl border px-5 pb-4 pt-6 sm:w-72 ${
        isCheapest
          ? "border-neutral-600 bg-neutral-900/80 shadow-[0_0_40px_rgba(255,255,255,0.06)]"
          : "border-neutral-800 bg-neutral-950"
      }`}
    >
      {isCheapest && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-400 px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-950">
          Cheapest
        </span>
      )}
      <h2 className="text-center font-mono text-sm uppercase tracking-[0.25em] text-neutral-100">
        {receipt.storeName}
      </h2>
      <Divider />

      <ul className="flex flex-col">
        {receipt.lines.map((line) => (
          <Line
            key={line.itemId}
            line={line}
            best={isBest(line)}
            menuKey={`${receipt.storeId}:${line.itemId}`}
            open={open}
            onToggle={onToggle}
            onChoose={onChoose}
          />
        ))}
      </ul>

      <Divider />
      <div className="flex items-baseline justify-between font-mono text-sm font-semibold text-neutral-100">
        <span>Total</span>
        <span className="tabular-nums">QAR {formatQar(receipt.total)}</span>
      </div>
      {/* Always takes up a line so totals stay lined up across receipts. */}
      <p className="mt-1 h-4 text-right text-[11px] text-neutral-500">
        {receipt.missing > 0 &&
          `${receipt.missing} item${receipt.missing === 1 ? "" : "s"} not found`}
      </p>
    </section>
  );
}

function Line({
  line,
  best,
  menuKey,
  open,
  onToggle,
  onChoose,
}: {
  line: ReceiptLine;
  best: boolean;
  menuKey: string;
  open: string | null;
  onToggle: (key: string) => void;
  onChoose: (itemId: string, productId: string) => void;
}) {
  const isOpen = open === menuKey;
  const label = line.product ? withSize(line.product.name, line.product.size) : line.query;

  return (
    <li data-alt-root className="group relative">
      {/* Every row is the same height (room for 2 lines of name) so totals line up across receipts. */}
      <div className="flex h-11 items-center gap-1.5 text-[13px]">
        <span
          title={label}
          className={`line-clamp-2 min-w-0 flex-1 leading-[1.3] ${line.product ? "text-neutral-300" : "text-neutral-600"}`}
        >
          {line.qty > 1 && <span className="mr-1 text-neutral-500">{line.qty}×</span>}
          {label}
        </span>
        {line.alternatives.length > 0 && (
          // Always visible so people know they can pick another option.
          <button
            type="button"
            onClick={() => onToggle(menuKey)}
            aria-expanded={isOpen}
            aria-label={`See ${line.alternatives.length} other option${line.alternatives.length === 1 ? "" : "s"} for ${line.query}`}
            title="See other options"
            className={`flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] transition-colors ${
              isOpen
                ? "border-neutral-500 text-neutral-100"
                : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-200"
            }`}
          >
            {line.alternatives.length} more
            <span aria-hidden className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </button>
        )}
        <span
          className={`shrink-0 text-right font-mono tabular-nums ${
            !line.product
              ? "text-[11px] text-neutral-600"
              : best
                ? "font-semibold text-white"
                : "text-neutral-400"
          }`}
          title={best ? "Cheapest price for this item" : undefined}
        >
          {best && <span className="mr-1 text-neutral-300">•</span>}
          {line.lineTotal !== null ? formatQar(line.lineTotal) : "not found"}
        </span>
      </div>

      {isOpen && (
        // Phones: opens inline. Desktop: floats over the receipt so totals don't move.
        <div className="animate-item-in z-20 mb-2 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.8)] sm:absolute sm:-left-2 sm:-right-2 sm:top-full">
          <p className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
            {line.product ? "Alternatives" : "Similar items"}
          </p>
          {line.alternatives.map((alt) => (
            <button
              key={alt.id}
              type="button"
              onClick={() => onChoose(line.itemId, alt.id)}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-neutral-800"
            >
              <ProductThumb src={alt.image} className="size-7" />
              <span className="min-w-0 flex-1 leading-snug text-neutral-300">
                {withSize(alt.name, alt.size)}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-neutral-400">{formatQar(alt.price)}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function Divider() {
  return <div aria-hidden className="my-3 border-t border-dashed border-neutral-700" />;
}
