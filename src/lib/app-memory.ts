import seedDump from "@/data/encyclopedia.json";
import type { EncMeta } from "./encyclopedia-types";
import { parseListOrder } from "./encyclopedia-types";
import { serverOk } from "./server-plain";

export type { EncMeta };

export type AppDump = {
  packages: Record<string, { genreId: string; ep: string; title: string; pkg: unknown; updatedAt?: number; confirmed?: boolean }>;
  playlists: Record<string, { genreId: string; act: number; title: string; pkg: unknown; updatedAt?: number; confirmed?: boolean }>;
  stories: Record<string, { title: string; pkg: unknown; savedAt?: number; registeredAt?: number; confirmed?: boolean }>;
  prefs: Record<string, unknown>;
  originals: Record<string, Record<string, { n: string; title: string; vocal: string; lyrics: string }>>;
  titles: Record<string, Record<string, string>>;
  fillJob: {
    genreId: string;
    tasks: { kind: string; n?: string; title?: string; act?: number; genreId?: string }[];
    acceptedAt: number;
    total: number;
    limitUntil?: number;
    paused?: boolean;
    status?: string;
    current?: string;
    lastError?: string;
    filled?: number;
    events?: { label: string; state: string; reason?: string }[];
    userPaused?: boolean;
    busyUntil?: number;
  } | null;
  meta: EncMeta;
};

export const APP_EVENT = "noa-app";

export function blankMeta(): EncMeta {
  return {
    locks: {},
    rowLocks: {},
    confirmed: {},
    settingLocks: { common: {}, genre: {} },
    needRegen: [],
    slots: {},
    youtube: {},
    ui: {},
    releaseSeen: 0,
    gatePassword: "",
    securityKey: "7999",
    fillAskAgain: false,
    listOrder: {},
  };
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, T>) : {};
}

function fromSeed(raw: unknown): AppDump {
  const s = asRecord<unknown>(raw);
  const metaRaw = asRecord<unknown>(s.meta);
  return {
    packages: asRecord(s.packages),
    playlists: asRecord(s.playlists),
    stories: asRecord(s.stories),
    prefs: asRecord(s.prefs),
    originals: asRecord(s.originals),
    titles: asRecord(s.titles),
    fillJob:
      s.fillJob && typeof s.fillJob === "object"
        ? (s.fillJob as AppDump["fillJob"])
        : null,
    meta: {
      ...blankMeta(),
      locks: asRecord(metaRaw.locks),
      rowLocks: asRecord(metaRaw.rowLocks),
      confirmed: asRecord(metaRaw.confirmed),
      settingLocks: {
        common: asRecord((asRecord(metaRaw.settingLocks) as { common?: unknown }).common),
        genre: asRecord((asRecord(metaRaw.settingLocks) as { genre?: unknown }).genre),
      },
      needRegen: Array.isArray(metaRaw.needRegen)
        ? (metaRaw.needRegen as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      slots: asRecord(metaRaw.slots),
      youtube: asRecord(metaRaw.youtube),
      ui: asRecord(metaRaw.ui) as EncMeta["ui"],
      releaseSeen: typeof metaRaw.releaseSeen === "number" ? metaRaw.releaseSeen : 0,
      gatePassword: typeof metaRaw.gatePassword === "string" ? metaRaw.gatePassword : "",
      securityKey: "7999",
      fillAskAgain: metaRaw.fillAskAgain === true,
      gateOpen: typeof metaRaw.gateOpen === "boolean" ? metaRaw.gateOpen : undefined,
      listOrder: parseListOrder(metaRaw.listOrder),
    },
  };
}

let dump: AppDump = fromSeed(seedDump);
let dumpRev = 1;
let metaHydrated = false;
const seedPackageRefs = new Set(Object.values(dump.packages).map((row) => row.pkg));

export function isSeedPackage(pkg: unknown) {
  return seedPackageRefs.has(pkg);
}

export function appDumpRev() {
  return dumpRev;
}

export function readAppDump(): AppDump {
  return dump;
}

function ping() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_EVENT));
  window.dispatchEvent(new Event("noa-prefs"));
  window.dispatchEvent(new Event("noa-gate"));
}

export function replaceAppDump(next: Partial<AppDump>) {
  dumpRev += 1;
  dump = {
    packages: next.packages ?? dump.packages,
    playlists: next.playlists ?? dump.playlists,
    stories: next.stories ?? dump.stories,
    prefs: next.prefs ?? dump.prefs,
    originals: next.originals ?? dump.originals,
    titles: next.titles ?? dump.titles,
    fillJob: next.fillJob !== undefined ? next.fillJob : dump.fillJob,
    meta: { ...blankMeta(), ...dump.meta, ...(next.meta ?? {}) },
  };
  ping();
}

export function patchApp(mutator: (d: AppDump) => void, persist: "meta" | "pages" | false = "meta") {
  dumpRev += 1;
  mutator(dump);
  ping();
  if (persist) schedulePersist(persist);
}

type PageRow = {
  kind: "single" | "playlist" | "story";
  genreId?: string;
  ep?: string;
  act?: number;
  title?: string;
  body: unknown;
  rewrite?: boolean;
};

const pageQueue = new Map<string, PageRow>();
const heldLinks = new Map<string, { sunoUrl?: string; audioLevel?: string; audioAnalysis?: string; sunoSet?: boolean; levelSet?: boolean; analysisSet?: boolean }>();
let persistTimer: ReturnType<typeof setTimeout> | undefined;
let wantMeta = false;
let wantPages = false;

let persistChain: Promise<void> = Promise.resolve();

function queuePersist(): Promise<boolean> {
  const run = persistChain.then(() => flushPersist());
  persistChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function schedulePersist(kind: "meta" | "pages") {
  if (kind === "meta") wantMeta = true;
  if (kind === "pages") wantPages = true;
  if (typeof window === "undefined") return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void queuePersist();
  }, 250);
}

function pageSlot(row: PageRow) {
  if (row.kind === "single") return `single:${row.genreId}:${row.ep}`;
  if (row.kind === "playlist") return `playlist:${row.genreId}:${row.act}`;
  const body = row.body && typeof row.body === "object" ? (row.body as { songId?: string }) : {};
  const songId = (body.songId || "").trim();
  const id = songId || (row.title ?? "").trim();
  return `story:${row.genreId === "cover-reborn" ? "cover-reborn" : "your-story"}:${id}`;
}

export function holdPageLink(slot: string, patch: { sunoUrl?: string; audioLevel?: string; audioAnalysis?: string }) {
  const prev = heldLinks.get(slot) ?? {};
  const next = { ...prev };
  if ("sunoUrl" in patch) {
    next.sunoUrl = String(patch.sunoUrl ?? "").trim();
    next.sunoSet = true;
  }
  if ("audioLevel" in patch) {
    next.audioLevel = String(patch.audioLevel ?? "").trim();
    next.levelSet = true;
  }
  if ("audioAnalysis" in patch) {
    next.audioAnalysis = String(patch.audioAnalysis ?? "").trim();
    next.analysisSet = true;
  }
  if (!next.sunoSet && !next.levelSet && !next.analysisSet) heldLinks.delete(slot);
  else heldLinks.set(slot, next);
  patchQueuedExact(slot, patch);
}

function withHeldLink(slot: string, body: unknown) {
  const held = heldLinks.get(slot);
  if (!body || typeof body !== "object") return body;
  const next = { ...(body as Record<string, unknown>) };
  const sunoExact = next.sunoExact === true;
  const levelExact = next.levelExact === true;
  const analysisExact = next.analysisExact === true;
  if (sunoExact) {
    const suno = String(next.sunoUrl ?? "").trim();
    next.sunoUrl = suno;
    next.sunoExact = true;
    heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), sunoUrl: suno, sunoSet: true });
  } else if (held?.sunoSet) {
    next.sunoUrl = held.sunoUrl || "";
    next.sunoExact = true;
  } else if (held?.sunoUrl && !String(next.sunoUrl ?? "").trim()) {
    next.sunoUrl = held.sunoUrl;
  }
  if (levelExact) {
    const level = String(next.audioLevel ?? "").trim();
    next.audioLevel = level;
    next.levelExact = true;
    heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), audioLevel: level, levelSet: true });
  } else if (held?.levelSet) {
    next.audioLevel = held.audioLevel || "";
    next.levelExact = true;
  } else if (held?.audioLevel && !String(next.audioLevel ?? "").trim()) {
    next.audioLevel = held.audioLevel;
  }
  if (analysisExact) {
    const analysis = String(next.audioAnalysis ?? "").trim();
    next.audioAnalysis = analysis;
    next.analysisExact = true;
    heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), audioAnalysis: analysis, analysisSet: true });
  } else if (held?.analysisSet) {
    next.audioAnalysis = held.audioAnalysis || "";
    next.analysisExact = true;
  } else if (held?.audioAnalysis && !String(next.audioAnalysis ?? "").trim()) {
    next.audioAnalysis = held.audioAnalysis;
  }
  if (next.pkg && typeof next.pkg === "object") {
    const inner = { ...(next.pkg as Record<string, unknown>) };
    if (inner.sunoExact === true) {
      const suno = String(inner.sunoUrl ?? "").trim();
      inner.sunoUrl = suno;
      heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), sunoUrl: suno, sunoSet: true });
    }
    if (inner.levelExact === true) {
      const level = String(inner.audioLevel ?? "").trim();
      inner.audioLevel = level;
      heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), audioLevel: level, levelSet: true });
    }
    if (inner.analysisExact === true) {
      const analysis = String(inner.audioAnalysis ?? "").trim();
      inner.audioAnalysis = analysis;
      heldLinks.set(slot, { ...(heldLinks.get(slot) ?? {}), audioAnalysis: analysis, analysisSet: true });
    }
    const now = heldLinks.get(slot);
    if (inner.sunoExact !== true && now?.sunoSet) {
      inner.sunoUrl = now.sunoUrl || "";
      inner.sunoExact = true;
    }
    if (inner.levelExact !== true && now?.levelSet) {
      inner.audioLevel = now.audioLevel || "";
      inner.levelExact = true;
    }
    if (inner.analysisExact !== true && now?.analysisSet) {
      inner.audioAnalysis = now.audioAnalysis || "";
      inner.analysisExact = true;
    }
    next.pkg = inner;
  }
  return next;
}

export function enqueuePage(row: PageRow) {
  const slot = pageSlot(row);
  const body = withHeldLink(slot, row.body);
  const nextRow = body === row.body ? row : { ...row, body };
  const prev = pageQueue.get(slot);
  const prevBody = prev?.body && typeof prev.body === "object" ? { ...(prev.body as Record<string, unknown>) } : null;
  const nextBody = nextRow.body && typeof nextRow.body === "object" ? { ...(nextRow.body as Record<string, unknown>) } : null;
  if (prev && prevBody && nextBody) {
    const blanks = new Set(
      Array.isArray(nextBody.blankFields)
        ? nextBody.blankFields.filter((key): key is string => typeof key === "string")
        : [],
    );
    const merged = mergeLatestBody(prevBody, nextBody, blanks);
    if (Array.isArray(nextBody.savedKeys)) {
      const prevKeys = Array.isArray(prevBody.savedKeys) ? prevBody.savedKeys.filter((key): key is string => typeof key === "string" && key) : [];
      const nextKeys = nextBody.savedKeys.filter((key): key is string => typeof key === "string" && key);
      const keys = [...new Set([...prevKeys, ...nextKeys])];
      merged.savedKeys = keys;
      for (const key of nextKeys) {
        if (key in nextBody) merged[key] = nextBody[key];
      }
      for (const key of prevKeys) {
        if (nextKeys.includes(key)) continue;
        if (key in prevBody) merged[key] = prevBody[key];
      }
      if (Array.isArray(nextBody.blankFields)) merged.blankFields = nextBody.blankFields;
    } else {
      delete merged.savedKeys;
    }
    if (blanks.size) {
      const prevBlanks = Array.isArray(merged.blankFields)
        ? merged.blankFields.filter((key): key is string => typeof key === "string")
        : [];
      merged.blankFields = [...new Set([...prevBlanks, ...blanks])];
    }
    pageQueue.set(slot, {
      ...nextRow,
      title: String(merged.confirmedTitle || nextRow.title || prev.title || ""),
      body: withHeldLink(slot, merged),
      rewrite: prev.rewrite === true || nextRow.rewrite === true,
    });
    schedulePersist("pages");
    return;
  }
  pageQueue.set(slot, { ...nextRow, body: withHeldLink(slot, nextRow.body) });
  schedulePersist("pages");
}

/** 이미 대기 중인 저장이 곡 파일의 제목·설명을 이전 글로 덮지 않게, 그 칸만 최신 글로 바꾼다. */
export function patchQueuedBody(slot: string, patch: Record<string, string>, stamps?: Record<string, string>) {
  const row = pageQueue.get(slot);
  if (!row || !row.body || typeof row.body !== "object") return;
  const body = { ...(row.body as Record<string, unknown>) };
  const have = readFieldStamps(body);
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!value.trim() || String(body[key] ?? "") === value) continue;
    const queuedAt = Date.parse(have[key] || "") || 0;
    const patchAt = Date.parse(stamps?.[key] || "") || 0;
    if (!(patchAt > queuedAt)) continue;
    body[key] = value;
    if (patchAt > 0 && stamps?.[key]) {
      const nextStamps = { ...readFieldStamps(body), [key]: stamps[key] };
      body.fieldSavedAt = nextStamps;
    }
    changed = true;
  }
  if (!changed) return;
  const title = String(body.confirmedTitle || row.title || "");
  pageQueue.set(slot, { ...row, body, ...(title.trim() ? { title } : {}) });
}

function patchQueuedExact(slot: string, patch: { sunoUrl?: string; audioLevel?: string; audioAnalysis?: string }) {
  const row = pageQueue.get(slot);
  if (!row || !row.body || typeof row.body !== "object") return;
  const body = { ...(row.body as Record<string, unknown>) };
  if ("sunoUrl" in patch) {
    body.sunoUrl = String(patch.sunoUrl ?? "").trim();
    body.sunoExact = true;
  }
  if ("audioLevel" in patch) {
    body.audioLevel = String(patch.audioLevel ?? "").trim();
    body.levelExact = true;
  }
  if ("audioAnalysis" in patch) {
    body.audioAnalysis = String(patch.audioAnalysis ?? "").trim();
    body.analysisExact = true;
  }
  pageQueue.set(slot, { ...row, body, rewrite: true });
  schedulePersist("pages");
}

export function cancelQueuedPage(slot: string) {
  pageQueue.delete(slot);
}

export function markMetaHydrated() {
  metaHydrated = true;
  if (wantMeta) void queuePersist();
}

export function saveMetaNow() {
  wantMeta = true;
  if (typeof window === "undefined") return;
  clearTimeout(persistTimer);
  void queuePersist();
}

let persistFlight: Promise<boolean> | null = null;

export function flushAppPagesNow(): Promise<boolean> {
  wantPages = true;
  if (typeof window === "undefined") return Promise.resolve(false);
  clearTimeout(persistTimer);
  if (!persistFlight) {
    const job = queuePersist();
    persistFlight = job.finally(() => {
      persistFlight = null;
    });
  }
  return persistFlight.then((ok) => {
    if (!ok) return false;
    if (pageQueue.size > 0) return flushAppPagesNow();
    return true;
  });
}

async function flushPersist(): Promise<boolean> {
  let saveMeta = wantMeta;
  const pages = wantPages;
  wantMeta = false;
  wantPages = false;
  const queued = pages ? [...pageQueue.values()] : [];
  if (pages) pageQueue.clear();
  let pagesOk = true;
  try {
    const api = await import("./pages");
    if (queued.length) {
      const studio = queued.filter((row) => row.kind === "single" || row.kind === "playlist");
      if (studio.length) {
        const saved = await api.saveStudioPages({
          data: {
            pages: studio.map((row) => ({
              kind: row.kind as "single" | "playlist",
              genreId: row.genreId ?? "",
              ep: row.ep,
              act: row.act,
              title: row.title,
              body: row.body as never,
              rewrite: row.rewrite === true,
            })),
          },
        });
        if (!serverOk(saved)) throw new Error("save failed");
      }
      for (const row of queued.filter((item) => item.kind === "story")) {
        if (!row.title) continue;
        const saved = await api.saveStoryPage({ data: { title: row.title, body: row.body as never, genreId: row.genreId === "cover-reborn" ? "cover-reborn" : "your-story" } });
        if (!serverOk(saved)) throw new Error("save failed");
      }
    }
  } catch {
    pagesOk = false;
    for (const row of queued) {
      const slot = pageSlot(row);
      if (!pageQueue.has(slot)) pageQueue.set(slot, row);
    }
    if (queued.length) wantPages = true;
  }
  if (saveMeta && !metaHydrated) {
    wantMeta = true;
    saveMeta = false;
  }
  if (saveMeta) {
    try {
      const api = await import("./pages");
      await api.saveAppMeta({ data: dump.meta });
    } catch {
      wantMeta = true;
      pagesOk = false;
    }
  }
  if ((wantPages || wantMeta) && typeof window !== "undefined") {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void queuePersist();
    }, 2000);
  }
  return pagesOk;
}
