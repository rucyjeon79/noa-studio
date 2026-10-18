import { patchApp, readAppDump, saveMetaNow } from "./app-memory";
import { parseListOrder } from "./encyclopedia-types";

const ORDER_LOCAL = "noa-list-order";

export function readBrowserListOrder(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return parseListOrder(JSON.parse(window.localStorage.getItem(ORDER_LOCAL) || "{}"));
  } catch {
    return {};
  }
}

export function writeBrowserListOrder(order: Record<string, string[]> | undefined) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_LOCAL, JSON.stringify(parseListOrder(order)));
  } catch {
    /* storage blocked */
  }
}

export function readListOrder(key: string): string[] {
  if (!key) return [];
  return parseListOrder(readAppDump().meta.listOrder)[key] ?? [];
}

export function writeListOrder(key: string, ids: string[]) {
  if (!key) return;
  const clean = ids.map((id) => id.trim()).filter(Boolean);
  patchApp((d) => {
    d.meta.listOrder = { ...parseListOrder(d.meta.listOrder), [key]: clean };
  });
  writeBrowserListOrder(readAppDump().meta.listOrder);
  saveMetaNow();
}

export function applyFixedOrder<T>(items: T[], saved: string[], idOf: (item: T) => string, fresh: "keep" | "ep-desc" = "keep"): T[] {
  if (!saved.length) return items;
  const index = new Map(saved.map((id, i) => [id, i]));
  const freshItems = items.filter((item) => !index.has(idOf(item)));
  const kept = items
    .filter((item) => index.has(idOf(item)))
    .sort((a, b) => (index.get(idOf(a)) ?? 0) - (index.get(idOf(b)) ?? 0));
  const head = fresh === "ep-desc" ? [...freshItems].sort((a, b) => Number(idOf(b)) - Number(idOf(a))) : freshItems;
  return [...head, ...kept];
}

export function applyAliasOrder<T>(items: T[], saved: string[], keysOf: (item: T) => string[]): T[] {
  if (!saved.length) return items;
  const index = new Map(saved.map((id, i) => [id, i]));
  const rank = (item: T) => {
    let best = -1;
    for (const key of keysOf(item)) {
      const id = key.trim();
      if (!id) continue;
      const at = index.get(id);
      if (at === undefined) continue;
      if (best < 0 || at < best) best = at;
    }
    return best;
  };
  const freshItems = items.filter((item) => rank(item) < 0);
  const kept = items.filter((item) => rank(item) >= 0).sort((a, b) => rank(a) - rank(b));
  return [...freshItems, ...kept];
}

export function orderByIds<T>(items: T[], ids: string[], idOf: (item: T) => string): T[] {
  const map = new Map(items.map((item) => [idOf(item), item]));
  const used = new Set<string>();
  const out: T[] = [];
  for (const id of ids) {
    const hit = map.get(id);
    if (!hit || used.has(id)) continue;
    used.add(id);
    out.push(hit);
  }
  for (const item of items) {
    const id = idOf(item);
    if (used.has(id)) continue;
    used.add(id);
    out.push(item);
  }
  return out;
}

export function moveId(ids: string[], from: string, to: string): string[] {
  if (!from || from === to) return ids;
  const next = ids.slice();
  const a = next.indexOf(from);
  const b = next.indexOf(to);
  if (a < 0 || b < 0) return ids;
  next.splice(a, 1);
  next.splice(b, 0, from);
  return next;
}