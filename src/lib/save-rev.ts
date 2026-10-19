import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { traceField } from "./field-trace";

const CONTENT_KEYS = new Set([
  "summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle",
  "youtubeDescription", "fanLetter", "communityPost", "tracklist", "youtubeUrl", "mvUrl",
  "sunoUrl", "audioLevel", "audioAnalysis", "thumbUrl", "sourceLyrics", "sourceVocal", "sourceGenre",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function omitUnsavedFields(pkg: Record<string, unknown>, savedKeys: readonly string[], allowAll: boolean) {
  if (allowAll) return pkg;
  const allow = new Set(savedKeys);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pkg)) {
    if (key === "fieldSavedAt") {
      if (!isRecord(value)) continue;
      const kept: Record<string, unknown> = {};
      for (const [stampKey, stamp] of Object.entries(value)) {
        if (allow.has(stampKey)) kept[stampKey] = stamp;
      }
      if (Object.keys(kept).length) next.fieldSavedAt = kept;
      continue;
    }
    if (CONTENT_KEYS.has(key) || key === "ytPremium" || key === "mvPremium") {
      if (!allow.has(key)) {
        traceField({
          field: key,
          value,
          source: "screen-excluded",
          reader: "omitUnsavedFields",
          note: "not-in-saved-keys",
        });
        continue;
      }
    }
    next[key] = value;
  }
  return next;
}

export function viewTitleForSave(diskTitle: unknown, incomingTitle: unknown, savedKeys: readonly string[], allowAll: boolean) {
  if (allowAll || savedKeys.includes("confirmedTitle")) return String(incomingTitle || diskTitle || "");
  return String(diskTitle || "");
}

export function bodyLinkValue(bodyValue: unknown, _heldValue: unknown, exact: boolean) {
  return exact ? String(bodyValue ?? "").trim() : String(bodyValue ?? "");
}

export function fileMayReplaceShown(shown: unknown, file: unknown, editedIds: readonly string[], draftKey: string) {
  if (editedIds.includes(draftKey)) return false;
  return String(shown ?? "") !== String(file ?? "");
}

export function isContentPath(path: string) {
  const norm = path.replace(/\\/g, "/");
  return ["/data/live/곡/", "/data/live/사용자설정/", "/data/live/원곡정보/", "/data/live/번역/"].some((part) => norm.includes(part));
}

export function planLiveWrite(current: unknown, incoming: Record<string, unknown>) {
  const cur = isRecord(current) ? current : {};
  const rev = readRev(cur);
  const expectRev = typeof incoming.baseRev === "number" && Number.isInteger(incoming.baseRev) && incoming.baseRev >= 0 ? incoming.baseRev : undefined;
  if (typeof expectRev === "number" && expectRev !== rev) {
    return { ok: false as const, error: "conflict", next: cur, changed: false };
  }
  const versioned = typeof expectRev === "number";
  const inc = { ...incoming };
  delete inc.baseRev;
  delete inc.rev;
  const curPkg = isRecord(cur.pkg) ? cur.pkg : null;
  const incPkg = isRecord(inc.pkg) ? inc.pkg : null;
  if (curPkg && incPkg) {
    const nextPkg: Record<string, unknown> = { ...curPkg };
    const curStamps = isRecord(curPkg.fieldSavedAt) ? curPkg.fieldSavedAt : {};
    const incStamps = isRecord(incPkg.fieldSavedAt) ? incPkg.fieldSavedAt : {};
    let changed = false;
    for (const [key, value] of Object.entries(incPkg)) {
      if (key === "fieldSavedAt" || key === "baseRev") continue;
      if (!versioned && CONTENT_KEYS.has(key)) {
        const disk = curPkg[key];
        const filled = typeof disk === "string" ? disk.trim().length > 0 : disk !== undefined && disk !== null && disk !== "";
        const prevAt = Date.parse(String(curStamps[key] || "")) || 0;
        const nextAt = Date.parse(String(incStamps[key] || "")) || 0;
        if (filled && !(nextAt > prevAt && nextAt > 0)) continue;
      }
      if (!versioned && !CONTENT_KEYS.has(key)) continue;
      if (JSON.stringify(nextPkg[key]) !== JSON.stringify(value)) changed = true;
      nextPkg[key] = value;
    }
    const next: Record<string, unknown> = { ...cur, pkg: nextPkg };
    if (versioned) {
      for (const [key, value] of Object.entries(inc)) {
        if (key === "pkg") continue;
        if (JSON.stringify(next[key]) !== JSON.stringify(value)) changed = true;
        next[key] = value;
      }
    } else if (typeof cur.confirmed === "boolean") next.confirmed = cur.confirmed;
    next.rev = changed ? rev + 1 : rev;
    return { ok: true as const, error: "", next, changed };
  }
  if (!versioned && Object.keys(cur).length > 0) {
    const next: Record<string, unknown> = { ...cur };
    let changed = false;
    for (const [key, value] of Object.entries(inc)) {
      const disk = cur[key];
      const filled = typeof disk === "string" ? disk.trim().length > 0 : disk !== undefined && disk !== null && disk !== "";
      if (filled) continue;
      if (JSON.stringify(next[key]) !== JSON.stringify(value)) changed = true;
      next[key] = value;
    }
    next.rev = changed ? rev + 1 : rev;
    return { ok: true as const, error: "", next, changed };
  }
  const next: Record<string, unknown> = { ...cur, ...inc, rev: rev + 1 };
  delete next.baseRev;
  return { ok: true as const, error: "", next, changed: true };
}

export function applyLiveWrite(path: string, incoming: Record<string, unknown>, conflictDir?: string) {
  let current: unknown = null;
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return { ok: false as const, error: "json", rev: 0 };
    }
  }
  const plan = planLiveWrite(current, incoming);
  const rev = readRev(current);
  if (!plan.ok) {
    rememberConflict(conflictDir ?? join(process.cwd(), "data", "save-conflicts"), path, typeof incoming.baseRev === "number" ? incoming.baseRev : -1, rev, incoming, current);
    return { ok: false as const, error: plan.error, rev, current };
  }
  if (!plan.changed) return { ok: true as const, error: "", rev };
  return commitJsonFile(path, plan.next, rev, conflictDir);
}

export function readRev(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  const rev = (row as { rev?: unknown }).rev;
  return typeof rev === "number" && Number.isInteger(rev) && rev >= 0 ? rev : 0;
}

export function commitJsonFile(
  path: string,
  next: Record<string, unknown>,
  expectRev?: number,
  conflictDir = join(process.cwd(), "data", "save-conflicts"),
): { ok: boolean; error: string; rev: number } {
  let current: unknown = null;
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return { ok: false, error: "json", rev: 0 };
    }
  }
  const rev = readRev(current);
  if (typeof expectRev === "number" && expectRev !== rev) {
    rememberConflict(conflictDir, path, expectRev, rev, next, current);
    return { ok: false, error: "conflict", rev };
  }
  const body = { ...next, rev: rev + 1 };
  const text = `${JSON.stringify(body)}\n`;
  const tmp = `${path}.${process.pid}.rev.tmp`;
  let fd: number | null = null;
  try {
    mkdirSync(dirname(path), { recursive: true });
    fd = openSync(tmp, "w");
    writeSync(fd, text);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tmp, path);
  } catch {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
    }
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* leave the original file */
    }
    return { ok: false, error: "write", rev };
  }
  try {
    const back = JSON.parse(readFileSync(path, "utf8"));
    if (readRev(back) !== rev + 1) return { ok: false, error: "read", rev: readRev(back) };
  } catch {
    return { ok: false, error: "read", rev };
  }
  return { ok: true, error: "", rev: rev + 1 };
}

function rememberConflict(dir: string, path: string, expectRev: number, diskRev: number, rejected: Record<string, unknown>, current: unknown) {
  try {
    mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}.json`;
    const text = `${JSON.stringify({ at: new Date().toISOString(), path, expectRev, diskRev, current, rejected })}\n`;
    const file = join(dir, name);
    const fd = openSync(file, "w");
    writeSync(fd, text);
    fsyncSync(fd);
    closeSync(fd);
  } catch {
    /* rejecting the live write matters more than the conflict copy */
  }
}