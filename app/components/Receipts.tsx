"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHydrated, useListItems } from "@/lib/listStore";
import { mockReceipts } from "@/lib/mockStores";
import { formatQar, sortReceipts, type Receipt, type ReceiptLine } from "@/lib/results";
import ProductThumb from "./ProductThumb";

export default function Receipts() {
  const items = useListItems();
  const hydrated = useHydrated();
  /** Alternatives the user picked, keyed by `${storeId}:${itemId}`. */
  const [choices, setChoices] = useState<Record<string, string>>({});
  /** Which item's alternatives menu is open, as `${storeId}:${itemId}`. */
  const [open, setOpen] = useState<string | null>(null);
  const [fixNote, setFixNote] = useState(false);

  const receipts = useMemo(() => sortReceipts(mockReceipts(items, choices)), [items, choices]);

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

  const [cheapest, ...rest] = receipts;
  const priciest = rest.at(-1);

  return (
    <div className="flex w-full flex-col items-center">
      {priciest && (
        <p className="mb-8 max-w-xl text-center text-sm text-neutral-400">
          <span className="text-neutral-100">{cheapest.storeName}</span> is cheapest at{" "}
          <span className="font-mono text-neutral-100">QAR {formatQar(cheapest.total)}</span>
          {priciest.total > cheapest.total && cheapest.missing <= priciest.missing && (
            <>
              {" "}
              — QAR {formatQar(priciest.total - cheapest.total)} less than {priciest.storeName}
            </>
          )}
          .
        </p>
      )}

      {/* Phones: swipe between receipts. Desktop: side by side. */}
      <div className="no-scrollbar -mx-4 flex w-screen snap-x snap-mandatory gap-4 overflow-x-auto px-[7.5vw] pb-2 pt-4 sm:mx-0 sm:w-full sm:flex-wrap sm:items-start sm:justify-center sm:gap-6 sm:overflow-visible sm:px-0">
        {receipts.map((r, i) => (
          <ReceiptCard
            key={r.storeId}
            receipt={r}
            isCheapest={i === 0 && receipts.length > 1}
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
          onClick={() => setFixNote((v) => !v)}
          className="text-neutral-300 underline underline-offset-4 hover:text-white"
        >
          Tap to fix it.
        </button>
      </p>
      {fixNote && (
        <p className="mt-2 text-xs text-neutral-600">Price corrections are coming soon. Thanks for helping!</p>
      )}
    </div>
  );
}

function ReceiptCard({
  receipt,
  isCheapest,
  open,
  onToggle,
  onChoose,
}: {
  receipt: Receipt;
  isCheapest: boolean;
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
  menuKey,
  open,
  onToggle,
  onChoose,
}: {
  line: ReceiptLine;
  menuKey: string;
  open: string | null;
  onToggle: (key: string) => void;
  onChoose: (itemId: string, productId: string) => void;
}) {
  const isOpen = open === menuKey;
  const label = line.product
    ? `${line.product.name}${line.product.size ? ` ${line.product.size}` : ""}`
    : line.query;

  return (
    <li data-alt-root className="group relative">
      <div className="flex items-center gap-1.5 py-1 text-[13px]">
        <span
          title={label}
          className={`min-w-0 flex-1 truncate ${line.product ? "text-neutral-300" : "text-neutral-600"}`}
        >
          {line.qty > 1 && <span className="mr-1 text-neutral-500">{line.qty}×</span>}
          {label}
        </span>
        {line.alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => onToggle(menuKey)}
            aria-expanded={isOpen}
            aria-label={`Alternatives for ${line.query}`}
            className={`shrink-0 px-1 text-xs text-neutral-500 transition hover:text-neutral-100 focus-visible:opacity-100 ${
              isOpen ? "rotate-180 opacity-100" : "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
            }`}
          >
            ⌄
          </button>
        )}
        <span
          className={`shrink-0 text-right font-mono tabular-nums ${
            line.product ? "text-neutral-200" : "text-[11px] text-neutral-600"
          }`}
        >
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
              <span className="min-w-0 flex-1 truncate text-neutral-300">
                {alt.name}
                {alt.size && <span className="ml-1 text-neutral-500">{alt.size}</span>}
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
