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

export type SaveStatus = "written" | "unchanged" | "conflict" | "error";

export type LiveWriteResult = {
  ok: boolean;
  status: SaveStatus;
  error: string;
  rev: number;
  savedKeys: string[];
  rejectedKeys: string[];
  current?: unknown;
};

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function noteSave(path: string, detail: Record<string, unknown>) {
  try {
    const dir = join(process.cwd(), "data", "save-log");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${Date.now()}-${process.pid}.json`);
    const text = `${JSON.stringify({ at: new Date().toISOString(), path, ...detail })}\n`;
    const fd = openSync(file, "w");
    writeSync(fd, text);
    closeSync(fd);
  } catch {
    /* a log failure must not fail the save */
  }
}

export function planLiveWrite(current: unknown, incoming: Record<string, unknown>) {
  const cur = isRecord(current) ? current : {};
  const rev = readRev(cur);
  const strict = incoming.strict === true;
  const rewrite = incoming.rewrite === true;
  const expectRev = typeof incoming.baseRev === "number" && Number.isInteger(incoming.baseRev) && incoming.baseRev >= 0 ? incoming.baseRev : undefined;
  if (typeof expectRev === "number" && expectRev !== rev) {
    return { ok: false as const, status: "conflict" as const, error: "conflict", next: cur, changed: false, savedKeys: [] as string[], rejectedKeys: [] as string[] };
  }
  if (strict && typeof expectRev !== "number" && !rewrite) {
    return { ok: false as const, status: "error" as const, error: "baseRev", next: cur, changed: false, savedKeys: [] as string[], rejectedKeys: [] as string[] };
  }
  const versioned = typeof expectRev === "number";
  const allowReplace = versioned || rewrite;
  const inc = { ...incoming };
  delete inc.baseRev;
  delete inc.rev;
  delete inc.strict;
  delete inc.rewrite;
  const curPkg = isRecord(cur.pkg) ? cur.pkg : null;
  const incPkg = isRecord(inc.pkg) ? inc.pkg : null;
  if (curPkg && incPkg) {
    const nextPkg: Record<string, unknown> = { ...curPkg };
    const curStamps = isRecord(curPkg.fieldSavedAt) ? curPkg.fieldSavedAt : {};
    const incStamps = isRecord(incPkg.fieldSavedAt) ? incPkg.fieldSavedAt : {};
    const savedKeys: string[] = [];
    const rejectedKeys: string[] = [];
    let changed = false;
    for (const [key, value] of Object.entries(incPkg)) {
      if (key === "fieldSavedAt" || key === "baseRev" || key === "savedKeys" || key === "strict" || key === "rewrite") continue;
      const same = sameValue(nextPkg[key], value);
      if (!allowReplace && CONTENT_KEYS.has(key)) {
        const disk = curPkg[key];
        const filled = typeof disk === "string" ? disk.trim().length > 0 : disk !== undefined && disk !== null && disk !== "";
        const prevAt = Date.parse(String(curStamps[key] || "")) || 0;
        const nextAt = Date.parse(String(incStamps[key] || "")) || 0;
        if (!same && filled && !(nextAt > prevAt && nextAt > 0)) {
          if (strict) rejectedKeys.push(key);
          continue;
        }
      }
      if (!allowReplace && !CONTENT_KEYS.has(key)) {
        if (strict && !same) rejectedKeys.push(key);
        continue;
      }
      if (!same) {
        changed = true;
        savedKeys.push(key);
      }
      nextPkg[key] = value;
    }
    const next: Record<string, unknown> = { ...cur, pkg: nextPkg };
    if (allowReplace) {
      for (const [key, value] of Object.entries(inc)) {
        if (key === "pkg" || key === "savedKeys") continue;
        if (!sameValue(next[key], value)) {
          changed = true;
          savedKeys.push(key);
        }
        next[key] = value;
      }
    } else if (typeof cur.confirmed === "boolean") next.confirmed = cur.confirmed;
    delete next.baseRev;
    delete next.strict;
    delete next.rewrite;
    if (!changed && rejectedKeys.length) {
      return { ok: false as const, status: "error" as const, error: "rejected", next: cur, changed: false, savedKeys, rejectedKeys };
    }
    if (!changed) {
      return { ok: true as const, status: "unchanged" as const, error: "", next: cur, changed: false, savedKeys, rejectedKeys };
    }
    next.rev = rev;
    return { ok: true as const, status: "written" as const, error: "", next, changed: true, savedKeys, rejectedKeys };
  }
  if (!allowReplace && Object.keys(cur).length > 0) {
    const next: Record<string, unknown> = { ...cur };
    const savedKeys: string[] = [];
    const rejectedKeys: string[] = [];
    let changed = false;
    for (const [key, value] of Object.entries(inc)) {
      if (key === "savedKeys") continue;
      const disk = cur[key];
      const filled = typeof disk === "string" ? disk.trim().length > 0 : disk !== undefined && disk !== null && disk !== "";
      if (filled && !sameValue(disk, value)) {
        if (strict) rejectedKeys.push(key);
        continue;
      }
      if (!sameValue(next[key], value)) {
        changed = true;
        savedKeys.push(key);
      }
      next[key] = value;
    }
    delete next.baseRev;
    delete next.strict;
    delete next.rewrite;
    if (!changed && rejectedKeys.length) {
      return { ok: false as const, status: "error" as const, error: "rejected", next: cur, changed: false, savedKeys, rejectedKeys };
    }
    if (!changed) return { ok: true as const, status: "unchanged" as const, error: "", next: cur, changed: false, savedKeys, rejectedKeys };
    next.rev = rev;
    return { ok: true as const, status: "written" as const, error: "", next, changed, savedKeys, rejectedKeys };
  }
  const next: Record<string, unknown> = { ...cur, ...inc };
  delete next.baseRev;
  delete next.strict;
  delete next.rewrite;
  delete next.rev;
  const savedKeys = Object.keys(inc).filter((key) => key !== "baseRev" && key !== "rev" && key !== "strict" && key !== "rewrite" && key !== "savedKeys");
  return { ok: true as const, status: "written" as const, error: "", next, changed: true, savedKeys, rejectedKeys: [] as string[] };
}

export function applyLiveWrite(path: string, incoming: Record<string, unknown>, conflictDir?: string): LiveWriteResult {
  let current: unknown = null;
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return { ok: false, status: "error", error: "json", rev: 0, savedKeys: [], rejectedKeys: [] };
    }
  }
  const plan = planLiveWrite(current, incoming);
  const rev = readRev(current);
  if (!plan.ok) {
    rememberConflict(conflictDir ?? join(process.cwd(), "data", "save-conflicts"), path, typeof incoming.baseRev === "number" ? incoming.baseRev : -1, rev, incoming, current);
    noteSave(path, { status: plan.status, error: plan.error, baseRev: incoming.baseRev ?? null, rev, savedKeys: plan.savedKeys, rejectedKeys: plan.rejectedKeys });
    return { ok: false, status: plan.status, error: plan.error, rev, savedKeys: plan.savedKeys, rejectedKeys: plan.rejectedKeys, current };
  }
  if (!plan.changed) {
    noteSave(path, { status: "unchanged", error: "", baseRev: incoming.baseRev ?? null, rev, savedKeys: [], rejectedKeys: plan.rejectedKeys });
    return { ok: true, status: "unchanged", error: "", rev, savedKeys: [], rejectedKeys: plan.rejectedKeys };
  }
  const committed = commitJsonFile(path, plan.next, rev, conflictDir);
  if (!committed.ok) {
    noteSave(path, { status: committed.error === "conflict" ? "conflict" : "error", error: committed.error, baseRev: incoming.baseRev ?? null, rev, savedKeys: plan.savedKeys, rejectedKeys: plan.rejectedKeys });
    return { ok: false, status: committed.error === "conflict" ? "conflict" : "error", error: committed.error, rev: committed.rev, savedKeys: [], rejectedKeys: plan.rejectedKeys, current };
  }
  let back: unknown = null;
  try {
    back = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { ok: false, status: "error", error: "read", rev: committed.rev, savedKeys: [], rejectedKeys: plan.rejectedKeys };
  }
  const backPkg = isRecord(back) && isRecord((back as { pkg?: unknown }).pkg) ? (back as { pkg: Record<string, unknown> }).pkg : null;
  const wantPkg = isRecord(plan.next.pkg) ? plan.next.pkg : null;
  const missed = plan.savedKeys.filter((key) => {
    if (!wantPkg || !backPkg || !(key in wantPkg)) return false;
    return !sameValue(backPkg[key], wantPkg[key]);
  });
  if (missed.length || readRev(back) !== rev + 1) {
    return { ok: false, status: "error", error: "read", rev: readRev(back), savedKeys: [], rejectedKeys: missed };
  }
  noteSave(path, { status: "written", error: "", baseRev: incoming.baseRev ?? null, rev: rev + 1, savedKeys: plan.savedKeys, rejectedKeys: plan.rejectedKeys });
  return { ok: true, status: "written", error: "", rev: rev + 1, savedKeys: plan.savedKeys, rejectedKeys: plan.rejectedKeys };
}

export function readRev(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  const rev = (row as { rev?: unknown }).rev;
  return typeof rev === "number" && Number.isInteger(rev) && rev >= 0 ? rev : 0;
}

function writeFault(err: unknown) {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code || "") : "";
  return code || "unknown";
}

function noteWriteFault(stage: string, err: unknown) {
  console.error("[noa-save] write", stage, writeFault(err));
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
  const body = { ...next };
  delete body.rev;
  delete body.baseRev;
  delete body.strict;
  delete body.rewrite;
  body.rev = rev + 1;
  const text = `${JSON.stringify(body)}\n`;
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  let fd: number | null = null;
  const fail = (stage: string, err: unknown) => {
    noteWriteFault(stage, err);
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
      fd = null;
    }
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* leave the original file */
    }
    return { ok: false as const, error: "write", rev };
  };
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch (err) {
    return fail("mkdirSync", err);
  }
  try {
    fd = openSync(tmp, "w");
  } catch (err) {
    return fail("openSync", err);
  }
  try {
    writeSync(fd, text);
  } catch (err) {
    return fail("writeSync", err);
  }
  try {
    fsyncSync(fd);
  } catch (err) {
    return fail("fsyncSync", err);
  }
  try {
    closeSync(fd);
    fd = null;
  } catch (err) {
    return fail("closeSync", err);
  }
  try {
    renameSync(tmp, path);
  } catch (err) {
    return fail("renameSync", err);
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