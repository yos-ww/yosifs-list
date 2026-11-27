"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  lookupProduct,
  newId,
  parseEntry,
  suggestProducts,
  withSize,
  type ListItem,
  type Suggestion,
} from "@/lib/listItems";
import { setListItems, updateListItem, useListItems } from "@/lib/listStore";
import { formatQar } from "@/lib/results";
import ProductThumb from "./ProductThumb";

/** After this many items, a new column starts to the right (desktop). */
const ITEMS_PER_COLUMN = 12;
/** Wait this long after the last keystroke before asking the database for suggestions. */
const SUGGEST_DELAY_MS = 180;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function priceRange(s: Suggestion): string {
  const lo = Number(s.min_price);
  const hi = Number(s.max_price);
  return lo === hi ? `QAR ${formatQar(lo)}` : `QAR ${formatQar(lo)}–${formatQar(hi)}`;
}

export default function ListBuilder() {
  const items = useListItems();
  const [text, setText] = useState("");
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  /** Latest suggestions, remembered with the text they were for. */
  const [suggest, setSuggest] = useState<{ q: string; rows: Suggestion[] } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Highlighted suggestion for arrow keys (-1 = none). */
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The search box + dropdown together; taps inside it don't close the dropdown. */
  const comboRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close the dropdown when the user taps/clicks anywhere outside it. (Closing on the input's
  // blur instead broke phones: touching the list blurs the input before a tap or scroll lands.)
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!comboRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Keep the arrow-key highlighted suggestion visible in the scrollable list.
  useEffect(() => {
    if (active >= 0) document.getElementById(`suggestion-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const typed = parseEntry(text).query;

  // Ask the database for suggestions shortly after the user stops typing.
  useEffect(() => {
    if (typed.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      suggestProducts(typed, ctrl.signal)
        .then((rows) => setSuggest({ q: typed, rows }))
        .catch(() => {}); // offline or cancelled: just no suggestions
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [typed]);

  const visible = menuOpen && typed.length >= 2 && suggest?.q === typed ? suggest.rows : [];

  /** Add to the list (or bump the quantity if it's already there). */
  function addToList(query: string, qty: number, product: ListItem["product"], kind?: string) {
    setText("");
    setMenuOpen(false);
    setActive(-1);
    inputRef.current?.focus();

    const existing = items.find((i) => i.query.toLowerCase() === query.toLowerCase());
    if (existing) {
      setListItems(
        items.map((i) => (i.id === existing.id ? { ...i, qty: Math.min(99, i.qty + qty) } : i)),
      );
      return;
    }
    const item: ListItem = { id: newId(), query, qty, product, ...(kind ? { kind } : {}) };
    setListItems([...items, item]);
    if (!product) {
      // Typed without picking: show it right away, fill in a photo once the database answers.
      lookupProduct(query)
        .then((found) => found && updateListItem(item.id, { product: found }))
        .catch(() => {}); // offline or no match: the item keeps its plain square
    }
  }

  /** Picked from the dropdown: the list gets that exact product, and results compare it across stores. */
  function pick(s: Suggestion) {
    const { qty } = parseEntry(text);
    // Remember the aisle (e.g. "rice") so the results can offer other rices as alternatives.
    const kind = s.kind && s.kind !== "all" ? s.kind : undefined;
    addToList(s.name, qty, { id: s.name, name: s.name, size: s.size ?? "", image: s.image_url ?? "" }, kind);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (active >= 0 && visible[active]) return pick(visible[active]);
    const { query, qty } = parseEntry(text);
    if (query) addToList(query, qty, null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && visible.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % visible.length);
    } else if (e.key === "ArrowUp" && visible.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? visible.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setMenuOpen(false);
      setActive(-1);
    }
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
      <div ref={comboRef} className="relative w-full max-w-2xl">
        {/* Wide rounded "card" search box with a soft glow, like Claude's / ChatGPT's message box. */}
        <form
          onSubmit={onSubmit}
          className="flex w-full items-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-900/80 py-2 pl-5 pr-2 shadow-[0_0_40px_rgba(255,255,255,0.05)] transition-colors focus-within:border-neutral-600"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMenuOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setMenuOpen(true)}
            // Keyboard users tabbing to another control: close. (Taps outside are handled above.)
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && !comboRef.current?.contains(next)) setMenuOpen(false);
            }}
            placeholder="Add an item — e.g. milk, 2x rice"
            aria-label="Add an item to your list"
            role="combobox"
            aria-expanded={visible.length > 0}
            aria-controls="suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
            autoFocus
            autoComplete="off"
            enterKeyHint="enter"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            // Keep focus (and the phone keyboard) in the input after tapping Add.
            onPointerDown={(e) => e.preventDefault()}
            disabled={!text.trim()}
            className="shrink-0 rounded-full bg-neutral-400 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-300 disabled:cursor-default disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            Add
          </button>
        </form>

        {visible.length > 0 && (
          <div className="animate-item-in absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
            <ul
              id="suggestions"
              role="listbox"
              aria-label="Product suggestions"
              // Scrolls inside itself so 12 suggestions never run off the screen (dvh = room above the phone keyboard).
              className="max-h-[50dvh] overflow-y-auto overscroll-contain py-1.5"
            >
              {visible.map((s, i) => (
                <li key={s.name} id={`suggestion-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    tabIndex={-1}
                    // Keep focus in the input so the menu doesn't close before the tap registers.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                      i === active ? "bg-neutral-800" : ""
                    }`}
                  >
                    <ProductThumb src={s.image_url ?? undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-100">{withSize(s.name, s.size)}</span>
                      <span className="block text-xs text-neutral-500">
                        <span className="font-mono">{priceRange(s)}</span> · {s.store_count} store
                        {s.store_count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
              Or tap <span className="text-neutral-300">Add</span> to search for “{typed}” in general
            </p>
          </div>
        )}
      </div>

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
                    {item.product ? withSize(item.product.name, item.product.size) : item.query}
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
        <>
          {/* Separate from Add so it's clear this searches the whole list. Stays in view on long lists. */}
          <div className="sticky bottom-4 z-10 mt-10">
            <button
              type="button"
              onClick={() => router.push("/results")}
              className="rounded-full border border-neutral-700 bg-neutral-900/90 px-7 py-3 text-sm font-medium text-neutral-100 shadow-[0_0_40px_rgba(255,255,255,0.06)] backdrop-blur transition-colors hover:border-neutral-500 hover:bg-neutral-800"
            >
              Compare prices
              <span className="ml-2 text-neutral-500">
                {items.length} item{items.length === 1 ? "" : "s"} →
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setListItems([])}
            className="mt-6 text-xs text-neutral-600 transition-colors hover:text-neutral-300"
          >
            Clear list
          </button>
        </>
      )}
    </div>
  );
}
