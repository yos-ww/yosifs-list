"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { findProduct, newId, parseEntry, type ListItem } from "@/lib/listItems";
import { setListItems, useListItems } from "@/lib/listStore";

/** After this many items, a new column starts to the right (desktop). */
const ITEMS_PER_COLUMN = 12;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Tiny square product photo. Missing or broken photos show a plain empty square, never an icon. */
function ProductThumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span aria-hidden className="size-9 shrink-0 rounded-sm border border-neutral-800" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote store photos; no optimisation needed
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-9 shrink-0 rounded-sm bg-white object-cover"
    />
  );
}

export default function ListBuilder() {
  const items = useListItems();
  const [text, setText] = useState("");
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addItem(e: FormEvent) {
    e.preventDefault();
    const { query, qty } = parseEntry(text);
    if (!query) return;
    setText("");

    // Typing the same thing again bumps the quantity instead of adding a duplicate.
    const existing = items.find((i) => i.query.toLowerCase() === query.toLowerCase());
    if (existing) {
      setListItems(
        items.map((i) => (i.id === existing.id ? { ...i, qty: Math.min(99, i.qty + qty) } : i)),
      );
      return;
    }
    const item: ListItem = { id: newId(), query, qty, product: findProduct(query) };
    setListItems([...items, item]);
  }

  function removeItem(id: string) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setListItems(items.filter((i) => i.id !== id));
      return;
    }
    // Play the exit animation first; the item is removed when it ends.
    setRemoving((prev) => new Set(prev).add(id));
  }

  function finishRemove(id: string) {
    if (!removing.has(id)) return;
    setListItems(items.filter((i) => i.id !== id));
    setRemoving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    inputRef.current?.focus();
  }

  const columns = chunk(items, ITEMS_PER_COLUMN);

  return (
    <div className="flex w-full flex-col items-center">
      {/* Wide rounded "card" search box with a soft glow, like Claude's / ChatGPT's message box. */}
      <form
        onSubmit={addItem}
        className="flex w-full max-w-2xl items-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-900/80 py-2 pl-5 pr-2 shadow-[0_0_40px_rgba(255,255,255,0.05)] transition-colors focus-within:border-neutral-600"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item — e.g. milk, 2x rice"
          aria-label="Add an item to your list"
          autoFocus
          autoComplete="off"
          enterKeyHint="enter"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => router.push("/results")}
          disabled={items.length === 0}
          className="shrink-0 rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:hover:opacity-100"
        >
          Search
        </button>
      </form>

      {items.length > 0 && (
        <div className="mt-8 flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-10">
          {columns.map((col, c) => (
            <ul key={c} className="flex w-full flex-col gap-1 sm:w-64">
              {col.map((item) => (
                <li
                  key={item.id}
                  onAnimationEnd={() => finishRemove(item.id)}
                  className={`group flex items-center gap-3 rounded-md px-1 py-1 ${
                    removing.has(item.id) ? "animate-item-out" : "animate-item-in"
                  }`}
                >
                  <ProductThumb src={item.product?.image} />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                    {item.qty > 1 && <span className="mr-1.5 text-neutral-500">{item.qty}×</span>}
                    {item.product ? item.product.name : item.query}
                    {item.product?.size && (
                      <span className="ml-1.5 text-neutral-500">{item.product.size}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.product?.name ?? item.query}`}
                    className="shrink-0 px-1 text-xs text-neutral-600 transition-colors hover:text-neutral-200"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setListItems([])}
          className="mt-8 text-xs text-neutral-600 transition-colors hover:text-neutral-300"
        >
          Clear list
        </button>
      )}
    </div>
  );
}
