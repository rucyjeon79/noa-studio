import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

const LIVE = join(process.cwd(), "data/live");
const MAP_PATH = join(LIVE, "앱관리", "탐색연결.json");

let cache: { mtime: number; slots: Record<string, string> } = { mtime: -1, slots: {} };

function readMap() {
  try {
    const stamp = statSync(MAP_PATH).mtimeMs;
    if (stamp === cache.mtime) return cache.slots;
    const raw = JSON.parse(readFileSync(MAP_PATH, "utf8")) as { slots?: unknown };
    const slots: Record<string, string> = {};
    if (raw?.slots && typeof raw.slots === "object" && !Array.isArray(raw.slots)) {
      for (const [key, value] of Object.entries(raw.slots)) {
        if (typeof value === "string" && value.trim() && !value.includes("..")) slots[key] = value.trim().replace(/\\/g, "/");
      }
    }
    cache = { mtime: stamp, slots };
    return slots;
  } catch {
    cache = { mtime: -1, slots: {} };
    return {};
  }
}

function writeMap(slots: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, rel] of Object.entries(slots)) {
    if (!key || !rel || rel.includes("..")) continue;
    const abs = join(LIVE, rel);
    if (existsSync(abs) && statSync(abs).isFile()) next[key] = rel.replace(/\\/g, "/");
  }
  mkdirSync(dirname(MAP_PATH), { recursive: true });
  writeFileSync(MAP_PATH, JSON.stringify({ slots: next }));
  cache = { mtime: statSync(MAP_PATH).mtimeMs, slots: next };
}

export function relFromAbs(abs: string) {
  const root = realpathSync(LIVE).replace(/\\/g, "/");
  const norm = abs.replace(/\\/g, "/");
  if (norm === root) return "";
  return norm.startsWith(`${root}/`) ? norm.slice(root.length + 1) : "";
}

export function boundStoryAbs(genre: string, title: string) {
  const name = String(title || "").trim();
  if (!name) return "";
  return boundAbs(`story:${genre}:${name}`);
}

function boundAbs(slot: string) {
  const rel = readMap()[slot];
  if (!rel) return "";
  const abs = join(LIVE, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) return "";
  try {
    const root = realpathSync(LIVE);
    const real = realpathSync(abs);
    if (real !== root && !real.startsWith(root + sep)) return "";
    return real;
  } catch {
    return "";
  }
}

/** Explicit explorer binding wins. The canonical path is only the fallback when nothing was moved or copied. */
export function preferBound(canonAbs: string, slot: string) {
  const hit = boundAbs(slot);
  if (hit) return hit;
  return canonAbs;
}

function songSlot(rel: string) {
  const hit = /^곡\/([^/]+)\/ep\/([^/]+)\.json$/.exec(rel);
  return hit ? `song:${hit[1]}:${hit[2]}` : "";
}

function actSlot(rel: string) {
  const hit = /^곡\/([^/]+)\/act-(\d+)\.json$/.exec(rel);
  return hit ? `act:${hit[1]}:${hit[2]}` : "";
}

function canonRel(slot: string) {
  const song = /^song:([^:]+):([^:]+)$/.exec(slot);
  if (song) return `곡/${song[1]}/ep/${song[2]}.json`;
  const act = /^act:([^:]+):(\d+)$/.exec(slot);
  if (act) return `곡/${act[1]}/act-${act[2]}.json`;
  return "";
}

function readRow(rel: string) {
  try {
    return JSON.parse(readFileSync(join(LIVE, rel), "utf8")) as { genreId?: string; title?: string; ep?: string; act?: number; pkg?: unknown };
  } catch {
    return null;
  }
}

function storySlot(rel: string) {
  if (songSlot(rel) || actSlot(rel) || !rel.endsWith(".json")) return "";
  const row = readRow(rel);
  if (!row) return "";
  const genre = String(row.genreId || "");
  const cover = genre === "cover-reborn" || rel.startsWith("곡/cover-reborn/");
  const story = genre === "your-story" || rel.startsWith("곡/your-story/") || cover;
  if (!story) return "";
  const title = String(row.title || "").trim();
  if (!title) return "";
  return `story:${cover ? "cover-reborn" : "your-story"}:${title}`;
}

function fileExists(rel: string) {
  try {
    const abs = join(LIVE, rel);
    return existsSync(abs) && statSync(abs).isFile();
  } catch {
    return false;
  }
}

function pathSlots(rel: string) {
  const found = new Set<string>();
  const song = songSlot(rel);
  const act = actSlot(rel);
  if (song) found.add(song);
  if (act) found.add(act);
  if (fileExists(rel)) {
    const story = storySlot(rel);
    if (story) found.add(story);
  }
  return found;
}

export function ownersOf(rel: string) {
  const found = pathSlots(rel);
  for (const [slot, path] of Object.entries(readMap())) {
    if (path === rel) found.add(slot);
  }
  return [...found];
}

function sourceSlots(rel: string, map: Record<string, string>) {
  const found = pathSlots(rel);
  const song = songSlot(rel);
  const act = actSlot(rel);
  if (song) found.add(song);
  if (act) found.add(act);
  for (const [slot, path] of Object.entries(map)) {
    if (path === rel) found.add(slot);
  }
  return found;
}

export function capturePairs(fromRel: string, toRel: string) {
  const fromAbs = join(LIVE, fromRel);
  if (!fromRel || !existsSync(fromAbs)) return [] as { from: string; to: string }[];
  if (statSync(fromAbs).isFile()) return [{ from: fromRel, to: toRel }];
  const pairs: { from: string; to: string }[] = [];
  const walk = (dir: string, fromBase: string, toBase: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const abs = join(dir, name);
      const from = `${fromBase}/${name}`;
      const to = `${toBase}/${name}`;
      if (statSync(abs).isDirectory()) walk(abs, from, to);
      else if (name.endsWith(".json")) pairs.push({ from, to });
    }
  };
  walk(fromAbs, fromRel, toRel);
  return pairs;
}

export function noteMovedPairs(pairs: { from: string; to: string }[], opts?: { prior?: Record<string, string[]>; keepSource?: boolean }) {
  if (!pairs.length) return;
  const map = { ...readMap() };
  const prior = opts?.prior ?? {};
  const keepSource = opts?.keepSource === true;
  for (const pair of pairs) {
    const sources = sourceSlots(pair.from, map);
    const destOwners = new Set(prior[pair.to] ?? []);
    for (const [slot, path] of Object.entries(map)) {
      if (path === pair.to) destOwners.add(slot);
    }
    const overwriteOther = [...destOwners].some((slot) => !sources.has(slot));
    if (overwriteOther) {
      if (!keepSource) {
        for (const slot of sources) {
          if (map[slot] === pair.from) delete map[slot];
        }
      }
      continue;
    }
    const storyNow = storySlot(pair.to);
    if (storyNow) sources.add(storyNow);
    for (const slot of sources) {
      if (canonRel(slot) === pair.to) delete map[slot];
      else map[slot] = pair.to;
    }
  }
  writeMap(map);
}

export function noteRemoved(rel: string) {
  if (!rel) return;
  const map = { ...readMap() };
  let changed = false;
  for (const [slot, path] of Object.entries(map)) {
    if (path === rel || path.startsWith(`${rel}/`)) {
      delete map[slot];
      changed = true;
    }
  }
  if (changed) writeMap(map);
}

export function relocatedSongRows(genreId: string) {
  const rows = [];
  const prefix = `song:${genreId}:`;
  for (const [slot, rel] of Object.entries(readMap())) {
    if (!slot.startsWith(prefix)) continue;
    const row = readRow(rel);
    if (row) rows.push(row);
  }
  return rows;
}

export function relocatedActRows(genreId: string) {
  const rows = [];
  const prefix = `act:${genreId}:`;
  for (const [slot, rel] of Object.entries(readMap())) {
    if (!slot.startsWith(prefix)) continue;
    const row = readRow(rel);
    if (row) rows.push(row);
  }
  return rows;
}

export function relocatedStoryHits() {
  const hits: { abs: string; cover: boolean }[] = [];
  for (const [slot, rel] of Object.entries(readMap())) {
    if (!slot.startsWith("story:")) continue;
    const abs = boundAbs(slot);
    if (!abs) continue;
    hits.push({ abs, cover: slot.startsWith("story:cover-reborn:") });
  }
  return hits;
}
