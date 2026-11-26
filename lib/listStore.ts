"use client";

import { useSyncExternalStore } from "react";
import type { ListItem } from "./listItems";

/**
 * The current grocery list, saved in the browser (localStorage) so a refresh
 * never loses it. Also stays in sync between open tabs.
 */
const KEY = "yosifs-list:items:v1";
const EMPTY: ListItem[] = [];

let cache: ListItem[] | null = null;
const listeners = new Set<() => void>();

function isItem(x: unknown): x is ListItem {
  const i = x as ListItem;
  return !!i && typeof i.id === "string" && typeof i.query === "string" && typeof i.qty === "number";
}

function read(): ListItem[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter(isItem) : EMPTY;
  } catch {
    cache = EMPTY; // private mode, blocked storage or corrupt data: start empty
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setListItems(next: ListItem[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the list still works until the page is closed.
  }
  listeners.forEach((l) => l());
}

export function useListItems(): ListItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const noopSubscribe = () => () => {};

/** False during server rendering, true once the browser has loaded the saved list. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
