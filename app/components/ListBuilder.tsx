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
      <form onSubmit={addItem} className="flex w-full max-w-md items-center gap-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item — e.g. milk, 2x rice"
          aria-label="Add an item to your list"
          autoFocus
          autoComplete="off"
          enterKeyHint="enter"
          className="min-w-0 flex-1 border-b border-neutral-700 bg-transparent py-2 text-base text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => router.push("/results")}
          disabled={items.length === 0}
          className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
                  {item.product ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny remote store photos; no optimisation needed
                    <img
                      src={item.product.image}
                      alt=""
                      loading="lazy"
                      className="size-9 shrink-0 rounded-sm bg-white object-cover"
                    />
                  ) : (
                    <span aria-hidden className="size-9 shrink-0 rounded-sm border border-neutral-800" />
                  )}
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
