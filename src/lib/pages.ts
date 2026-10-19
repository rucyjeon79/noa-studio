import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { GENRES, actFromEp, isEpNumber, padEp } from "./catalog";
import type { EncMeta, EncPkg, EncPref } from "./encyclopedia-types";
import { parseListOrder } from "./encyclopedia-types";
import {
  hasPageBody,
  hasPlaylistBody,
  normalizePackage,
  normalizePlaylist,
  normalizeStory,
  packageFitsSong,
  resultSlot,
  epInSlot,
  shouldReplaceStudio,
  betterStudio,
  studioScore,
  adoptSavedFileText,
  isStoryFixture,
  type PlaylistPackage,
  type StoryPackage,
  type StudioPackage,
} from "./package";
import { mergeLatestBody, readFieldStamps } from "./latest-text";
import { quietDiskFault } from "./fill-errors";
import { coverArtistOf } from "./story-filename";

const enc = createServerOnlyFn(async () => {
  return import("./encyclopedia.server");
});
const db = createServerOnlyFn(async () => {
  const mod = await import("./db");
  return mod.getSql();
});

type PageKind = "single" | "playlist";

type PageRow = {
  slot: string;
  kind: string;
  genre_id: string;
  ep: string;
  act: number;
  title: string;
  body: unknown;
  updated_at: string;
};

function asPref(body: Record<string, unknown>): EncPref {
  const num = (key: string, fallback: number) =>
    typeof body[key] === "number" ? (body[key] as number) : fallback;
  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const bool = (key: string) => Boolean(body[key]);
  return {
    lang: str("lang"),
    titleFormat: str("titleFormat"),
    titleMode: str("titleMode"),
    langRule: str("langRule"),
    titleModeRule: str("titleModeRule"),
    focus: str("focus"),
    reality: num("reality", 100),
    motion: num("motion", 0),
    extra: str("extra"),
    community: bool("community"),
    descLyrics: bool("descLyrics"),
    lockDescLyrics: body.lockDescLyrics === false ? false : true,
    actPlaylist: body.actPlaylist === false ? false : true,
    sunoBase: str("sunoBase"),
    vocalStyle: str("vocalStyle"),
    musicStyle: str("musicStyle"),
    descRules: str("descRules"),
    communityRules: str("communityRules"),
    thumbImage: str("thumbImage"),
    thumbFont: str("thumbFont"),
    thumbDecor: str("thumbDecor"),
    thumbLayout: str("thumbLayout"),
    youtubeSeo: str("youtubeSeo"),
    sunoLimit: str("sunoLimit"),
    outputOrder: str("outputOrder"),
    thumbCastRule: str("thumbCastRule"),
    rewriteRules: str("rewriteRules"),
    structure: str("structure"),
    moodLineRule: str("moodLineRule"),
    thumbGenreLine: str("thumbGenreLine"),
    forbidList: str("forbidList"),
    guideText: str("guideText"),
    adminDevice: str("adminDevice"),
    fixRule: str("fixRule"),
    fillAudit: str("fillAudit"),
    fieldAudit: str("fieldAudit"),
    lockRule: str("lockRule"),
    matchRule: str("matchRule"),
    liveRule: str("liveRule"),
    fillNotice: str("fillNotice"),
    splashRule: str("splashRule"),
    buildGuide: str("buildGuide"),
    designRule: str("designRule"),
    listRule: str("listRule"),
    healthRule: str("healthRule"),
    saveRule: str("saveRule"),
    placeRule: str("placeRule"),
    linkRule: str("linkRule"),
    output:
      body.output && typeof body.output === "object" && !Array.isArray(body.output)
        ? (body.output as Record<string, boolean>)
        : undefined,
    actOutput:
      body.actOutput && typeof body.actOutput === "object" && !Array.isArray(body.actOutput)
        ? (body.actOutput as Record<string, boolean>)
        : undefined,
  };
}

function asMeta(body: Record<string, unknown>): EncMeta {
  const rec = (value: unknown): Record<string, never> extends never ? Record<string, boolean> : Record<string, boolean> =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, boolean>) : {};
  const recAny = (value: unknown): Record<string, { ep: string; act: number }> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, { ep: string; act: number }>)
      : {};
  const recLocks = (value: unknown): Record<string, Record<string, boolean>> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Record<string, boolean>>)
      : {};
  return {
    locks: recLocks(body.locks),
    rowLocks: rec(body.rowLocks),
    confirmed: rec(body.confirmed),
    settingLocks: {
      common: rec((body.settingLocks as { common?: unknown } | undefined)?.common),
      genre: rec((body.settingLocks as { genre?: unknown } | undefined)?.genre),
    },
    needRegen: Array.isArray(body.needRegen)
      ? body.needRegen.filter((x): x is string => typeof x === "string")
      : [],
    slots: recAny(body.slots),
    youtube:
      body.youtube && typeof body.youtube === "object" && !Array.isArray(body.youtube)
        ? (body.youtube as Record<string, string>)
        : {},
    ui: (body.ui && typeof body.ui === "object" ? body.ui : {}) as EncMeta["ui"],
    releaseSeen: typeof body.releaseSeen === "number" ? body.releaseSeen : 0,
    gatePassword: typeof body.gatePassword === "string" ? body.gatePassword : "",
    securityKey: "7999",
    fillAskAgain: body.fillAskAgain === true,
    gateOpen: typeof body.gateOpen === "boolean" ? body.gateOpen : undefined,
    listOrder: parseListOrder(body.listOrder),
  };
}

function isGenre(id: string) {
  return GENRES.some((g) => g.id === id);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function premiumOf(raw: Record<string, unknown> | null | undefined) {
  const flags: { ytPremium?: boolean; mvPremium?: boolean } = {};
  if (!raw) return flags;
  if (raw.ytPremium === true || raw.ytPremium === false) flags.ytPremium = raw.ytPremium === true;
  if (raw.mvPremium === true || raw.mvPremium === false) flags.mvPremium = raw.mvPremium === true;
  return flags;
}

function asSingle(body: unknown): StudioPackage | null {
  const parsed = asObject(body);
  if (!parsed) return null;
  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.confirmedTitle !== "string" ||
    typeof parsed.lyricsBlock !== "string" ||
    typeof parsed.geminiPrompt !== "string" ||
    typeof parsed.youtubeTitle !== "string" ||
    typeof parsed.youtubeDescription !== "string"
  ) {
    return null;
  }
  return normalizePackage({
    summary: parsed.summary,
    confirmedTitle: parsed.confirmedTitle,
    lyricsBlock: parsed.lyricsBlock,
    sunoStyle: typeof parsed.sunoStyle === "string" ? parsed.sunoStyle : "",
    geminiPrompt: parsed.geminiPrompt,
    youtubeTitle: parsed.youtubeTitle,
    youtubeDescription: parsed.youtubeDescription,
    fanLetter: typeof parsed.fanLetter === "string" ? parsed.fanLetter : "",
    thumbUrl: typeof parsed.thumbUrl === "string" ? parsed.thumbUrl : "",
    thumbCast: parsed.thumbCast === "male" || parsed.thumbCast === "duet" ? parsed.thumbCast : "female",
    youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
    mvUrl: typeof parsed.mvUrl === "string" ? parsed.mvUrl : "",
    sunoUrl: typeof parsed.sunoUrl === "string" ? parsed.sunoUrl : "",
    audioLevel: typeof parsed.audioLevel === "string" ? parsed.audioLevel : "",
    audioAnalysis: typeof parsed.audioAnalysis === "string" ? parsed.audioAnalysis : "",
    ...premiumOf(parsed),
    userEdited: Array.isArray(parsed.userEdited)
      ? parsed.userEdited.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined,
    fieldSavedAt: readFieldStamps(parsed),
  });
}

function asPlaylist(body: unknown): PlaylistPackage | null {
  const parsed = asObject(body);
  if (!parsed) return null;
  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.tracklist !== "string" ||
    typeof parsed.geminiPrompt !== "string" ||
    typeof parsed.youtubeTitle !== "string" ||
    typeof parsed.youtubeDescription !== "string"
  ) {
    return null;
  }
  return normalizePlaylist({
    summary: parsed.summary,
    confirmedTitle: typeof parsed.confirmedTitle === "string" ? parsed.confirmedTitle : "",
    tracklist: parsed.tracklist,
    sunoStyle: typeof parsed.sunoStyle === "string" ? parsed.sunoStyle : "",
    geminiPrompt: parsed.geminiPrompt,
    youtubeTitle: parsed.youtubeTitle,
    youtubeDescription: parsed.youtubeDescription,
    communityPost: typeof parsed.communityPost === "string" ? parsed.communityPost : "",
    thumbUrl: typeof parsed.thumbUrl === "string" ? parsed.thumbUrl : "",
    thumbCast: parsed.thumbCast === "male" || parsed.thumbCast === "duet" ? parsed.thumbCast : "female",
    youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
    mvUrl: typeof parsed.mvUrl === "string" ? parsed.mvUrl : "",
    sunoUrl: typeof parsed.sunoUrl === "string" ? parsed.sunoUrl : "",
    audioLevel: typeof parsed.audioLevel === "string" ? parsed.audioLevel : "",
    audioAnalysis: typeof parsed.audioAnalysis === "string" ? parsed.audioAnalysis : "",
    ...premiumOf(parsed),
    tracklistEdited: parsed.tracklistEdited === true,
    descEdited: parsed.descEdited === true,
    fieldSavedAt: readFieldStamps(parsed),
  });
}

export const ensureActReady = createServerFn({ method: "POST" })
  .validator((input: { genreId: string; act?: number }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    const act = Number(input.act ?? 1);
    return { genreId: input.genreId, act: Number.isInteger(act) && act >= 1 ? act : 1 };
  })
  .handler(async ({ data }) => {
    const store = await enc();
    const songs = store.actSongsConfirmed(data.genreId, data.act);
    if (!songs) return { activated: false as const };
    const existing = store.readActPage(data.genreId, data.act);
    const existingPkg = existing?.pkg as import("./package").PlaylistPackage | undefined;
    if (existingPkg && hasPlaylistBody(existingPkg)) {
      if (existing?.activated !== true) store.sealActFile(data.genreId, data.act, existing?.title || "", existingPkg);
      return {
        activated: true as const,
        youtubeDescription: String(existingPkg.youtubeDescription || ""),
        youtubeUrl: String(existingPkg.youtubeUrl || ""),
      };
    }
    const { localFillPlaylist } = await import("./fill-local");
    const { mergeStoredPref, COMMON_ID } = await import("./user-prefs");
    const { getGenre } = await import("./catalog");
    const { defaultThumbCast } = await import("./characters");
    const { emptyPlaylist } = await import("./package");
    const genreId = data.genreId as import("./catalog").GenreId;
    if (getGenre(genreId).kind === "distinct") return { activated: false as const };
    const livePrefs = store.readEncyclopedia().prefs;
    const pref = mergeStoredPref(genreId, livePrefs[genreId], livePrefs[COMMON_ID]);
    if (pref.actPlaylist === false) return { activated: false as const };
    let pkg = null as ReturnType<typeof localFillPlaylist> | null;
    try {
      pkg = localFillPlaylist({
        act: data.act,
        genreId,
        extraTracks: songs,
        prefs: pref,
        thumbCast: defaultThumbCast(genreId),
      });
    } catch {
      pkg = emptyPlaylist();
    }
    const saved = store.sealActFile(genreId, data.act, pkg?.youtubeTitle || "", pkg);
    return {
      activated: saved?.activated === true,
      youtubeDescription: String(saved?.pkg?.youtubeDescription || ""),
      youtubeUrl: String(saved?.pkg?.youtubeUrl || ""),
    };
  });

export const listFilledEps = createServerFn({ method: "POST" })
  .validator((input: { genreId: string }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    return { genreId: input.genreId };
  })
  .handler(async ({ data }) => {
    const store = await enc();
    const found = new Map<string, { ep: string; title: string; confirmed: boolean; filled: boolean; youtubeUrl: string; youtubeDescription: string }>();
    for (const row of store.listGenreSongHeads(data.genreId)) {
      const ep = padEp(row.ep);
      if (!isEpNumber(ep)) continue;
      found.set(ep, {
        ep,
        title: row.title,
        confirmed: row.confirmed,
        filled: row.filled,
        youtubeUrl: row.youtubeUrl,
        youtubeDescription: row.youtubeDescription,
      });
    }
    if (!found.size) {
      try {
        const sql = await db();
        const rows = await sql<{ ep: string; title: string }>`
          select ep, title from studio_pages
          where genre_id = ${data.genreId} and kind = 'single' and ep <> ''
        `;
        for (const row of rows) {
          const ep = padEp(row.ep);
          if (isEpNumber(ep)) found.set(ep, { ep, title: row.title, confirmed: false, filled: true, youtubeUrl: "", youtubeDescription: "" });
        }
      } catch {
        /* file list is enough */
      }
    }
    return { songs: [...found.values()], acts: store.listGenreActDescs(data.genreId), actFiles: store.listActFileBodies(data.genreId) };
  });

export const alignResultFiles = createServerFn({ method: "POST" })
  .validator((input?: {
    songs?: { genreId: string; ep: string; pkg: Record<string, unknown>; from: string }[];
    acts?: { genreId: string; act: number; pkg: Record<string, unknown>; from: string }[];
    youtube?: Record<string, string>;
  } | null) => ({
    songs: Array.isArray(input?.songs) ? input.songs : [],
    acts: Array.isArray(input?.acts) ? input.acts : [],
    youtube: input?.youtube && typeof input.youtube === "object" ? input.youtube : {},
  }))
  .handler(async ({ data }) => {
  const store = await enc();
  const songs: { genreId: string; ep: string; pkg: Record<string, unknown>; from: string }[] = [...(data?.songs ?? [])];
  const acts: { genreId: string; act: number; pkg: Record<string, unknown>; from: string }[] = [...(data?.acts ?? [])];
  try {
    const sql = await db();
    const rows = await sql<PageRow>`
      select slot, kind, genre_id, ep, act, title, body from studio_pages
      where kind in ('single', 'playlist')
    `;
    for (const row of rows) {
      const raw = asObject(row.body);
      const nested = raw ? asObject(raw.pkg) : null;
      const body = nested ?? raw;
      if (!body || !row.genre_id) continue;
      if (row.kind === "single" && row.ep) songs.push({ genreId: row.genre_id, ep: padEp(row.ep), pkg: body, from: `저장칸 ${row.slot}` });
      if (row.kind === "playlist") acts.push({ genreId: row.genre_id, act: Number(row.act) || 1, pkg: body, from: `저장칸 ${row.slot}` });
    }
  } catch {
    /* the files are still checked */
  }
  return { moved: store.adoptMisplacedFields({ songs, acts, youtube: data?.youtube }) };
  });

export const listGenreActs = createServerFn({ method: "POST" })
  .validator((input: { genreId: string }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    return { genreId: input.genreId };
  })
  .handler(async ({ data }) => {
    return (await enc()).listGenreActDescs(data.genreId);
  });

const PANE_TEXT_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist"] as const;

async function dropStalePaneFields(
  slot: string,
  before: Partial<Record<(typeof PANE_TEXT_KEYS)[number], string>>,
  after: Partial<Record<(typeof PANE_TEXT_KEYS)[number], string>>,
) {
  const keys = PANE_TEXT_KEYS.filter((key) => {
    const saved = String(after[key] ?? "").trim();
    return Boolean(saved) && String(before[key] ?? "") !== String(after[key] ?? "");
  });
  if (!keys.length) return;
  try {
    const sql = await db();
    for (const key of keys) {
      const value = String(after[key] ?? "");
      await sql`
        update studio_pages
        set body = jsonb_set(coalesce(body, '{}'::jsonb), ${`{${key}}`}::text[], to_jsonb(${value}::text), true)
        where slot = ${slot}
      `;
    }
    const title = String(after.confirmedTitle || "").trim();
    if (title && keys.includes("confirmedTitle")) {
      await sql`update studio_pages set title = ${title} where slot = ${slot}`;
    }
  } catch {
    /* the song file already holds the latest title and description */
  }
}

export const loadStudioPage = createServerFn({ method: "POST" })
  .validator((input: { kind: PageKind; genreId: string; ep?: string; act?: number }) => {
    if (input.kind !== "single" && input.kind !== "playlist") throw new Error("invalid kind");
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    const ep = padEp(input.ep ?? "");
    const act = Number(input.act ?? 1);
    return {
      kind: input.kind,
      genreId: input.genreId,
      ep,
      act: Number.isInteger(act) && act >= 1 ? act : 1,
    };
  })
  .handler(async ({ data }) => {
    const store = await enc();
    if (data.kind === "single") {
      const fileHit = store.readSongPage(data.genreId, data.ep);
      const filePkg = fileHit ? asSingle(fileHit.pkg) : null;
      const fileAt = store.readSongUpdatedAt(data.genreId, data.ep);
      let sqlPkg: StudioPackage | null = null;
      let sqlRaw: Record<string, unknown> | null = null;
      let sqlAt = 0;
      try {
        const sql = await db();
        const slot = resultSlot(data.genreId, data.ep, data.act);
        const rows = await sql<PageRow>`
          select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
          from studio_pages where slot = ${slot} limit 1
        `;
        sqlRaw = rows[0] ? asObject(rows[0].body) : null;
        sqlPkg = sqlRaw ? asSingle(sqlRaw) : null;
        sqlAt = rows[0] ? Date.parse(rows[0].updated_at) || 0 : 0;
      } catch {
        sqlPkg = null;
      }
      const copied = (pkg: StudioPackage | null) =>
        Boolean(pkg && store.lyricsMatchSibling(data.genreId, data.ep, String(pkg.lyricsBlock || "")));
      const fileFits = Boolean(filePkg && packageFitsSong(data.genreId, data.ep, filePkg) && !copied(filePkg));
      const sqlFits = Boolean(sqlPkg && packageFitsSong(data.genreId, data.ep, sqlPkg) && !copied(sqlPkg));
      const fileBody = filePkg && hasPageBody(filePkg) ? filePkg : null;
      const shown = fileBody ?? (sqlPkg && sqlFits ? sqlPkg : filePkg);
      const chosenAt = fileBody ? fileAt : sqlAt;
      if (fileBody && sqlPkg && fileAt >= sqlAt) void dropStalePaneFields(resultSlot(data.genreId, data.ep, data.act), sqlPkg, fileBody);
      if (shown && hasPageBody(shown)) {
        return {
          kind: "single" as const,
          pkg: shown,
          updatedAt: chosenAt,
          title: shown.confirmedTitle,
        };
      }
      return null;
    }
    const fileHit = store.readActPage(data.genreId, data.act);
    const filePkg = fileHit?.pkg ? asPlaylist(fileHit.pkg) : null;
    const fileAt = filePkg ? store.readActUpdatedAt(data.genreId, data.act) || 0 : 0;
    let row: PageRow | undefined;
    let sqlAt = 0;
    try {
      const sql = await db();
      const slot = resultSlot(data.genreId, "", data.act);
      const rows = await sql<PageRow>`
        select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
        from studio_pages where slot = ${slot} limit 1
      `;
      row = rows[0];
      sqlAt = row ? Date.parse(row.updated_at) || 0 : 0;
    } catch {
      row = undefined;
    }
    const sqlRaw = row ? asObject(row.body) : null;
    const sqlPkg = sqlRaw ? asPlaylist(sqlRaw) : null;
    const fileBody = filePkg && hasPlaylistBody(filePkg) ? filePkg : null;
    const shown = fileBody ?? sqlPkg;
    const updatedAt = fileBody ? fileAt : sqlAt;
    if (fileBody && sqlPkg && fileAt >= sqlAt) void dropStalePaneFields(resultSlot(data.genreId, "", data.act), sqlPkg, fileBody);
    if (!shown) return null;
    return { kind: "playlist" as const, pkg: shown, updatedAt, title: fileHit?.title || shown.youtubeTitle };
  });

function fileWins<T extends object>(filePkg: T, sqlPkg: T | null, alive: (pkg: T | null) => boolean): T {
  if (!alive(filePkg)) return filePkg;
  const next: Record<string, unknown> = { ...(filePkg as Record<string, unknown>) };
  if (sqlPkg) {
    const alt = sqlPkg as Record<string, unknown>;
    for (const key of ["youtubeUrl", "mvUrl"]) {
      const cur = String(next[key] ?? "").trim();
      const incoming = String(alt[key] ?? "").trim();
      if (!cur && /^https?:\/\//i.test(incoming)) next[key] = incoming;
    }
  }
  return next as T;
}

const FIELD_STAMP_KEYS = new Set([
  "summary",
  "confirmedTitle",
  "lyricsBlock",
  "sunoStyle",
  "geminiPrompt",
  "youtubeTitle",
  "youtubeDescription",
  "fanLetter",
  "communityPost",
  "tracklist",
  "youtubeUrl",
  "mvUrl",
  "sunoUrl",
  "audioLevel",
  "audioAnalysis",
  "sourceLyrics",
  "sourceVocal",
  "sourceGenre",
]);

function stampBox(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw) return null;
  if (raw.fieldSavedAt && typeof raw.fieldSavedAt === "object" && !Array.isArray(raw.fieldSavedAt)) return raw;
  const nested = raw.pkg && typeof raw.pkg === "object" && !Array.isArray(raw.pkg) ? (raw.pkg as Record<string, unknown>) : null;
  if (nested?.fieldSavedAt && typeof nested.fieldSavedAt === "object" && !Array.isArray(nested.fieldSavedAt)) return nested;
  return raw;
}

function overlayStamps<T extends object>(filePkg: T, rawSql: Record<string, unknown> | null, fileAt: number): T {
  const raw = stampBox(rawSql);
  if (!raw) return filePkg;
  const stamps = raw.fieldSavedAt;
  if (!stamps || typeof stamps !== "object" || Array.isArray(stamps)) return filePkg;
  const next: Record<string, unknown> = { ...(filePkg as Record<string, unknown>) };
  const fileStamps = readFieldStamps(filePkg);
  const kept = { ...fileStamps };
  let changed = false;
  for (const [key, iso] of Object.entries(stamps as Record<string, unknown>)) {
    if (!FIELD_STAMP_KEYS.has(key) || key === "sunoUrl" || key === "audioLevel") continue;
    const at = Date.parse(String(iso || "")) || 0;
    const fileFieldAt = Date.parse(fileStamps[key] || "") || 0;
    if (!at || typeof raw[key] !== "string") continue;
    const incoming = String(raw[key] ?? "");
    if (!incoming.trim()) continue;
    const fileText = String(next[key] ?? "").trim();
    if (fileText && !(fileFieldAt > 0 && at > fileFieldAt)) continue;
    if (!fileText && at <= fileAt) continue;
    if (String(next[key] ?? "") === incoming) {
      if (String(iso) && at > fileFieldAt) kept[key] = String(iso);
      continue;
    }
    next[key] = incoming;
    kept[key] = String(iso);
    changed = true;
  }
  if (!changed) return filePkg;
  next.fieldSavedAt = kept;
  return next as T;
}

function paneSaveTarget(kind: "song" | "act" | "story" | "cover", genreId: string, ep: string, act: number, title: string) {
  if (kind === "song") {
    return { slot: ep ? resultSlot(genreId, ep, actFromEp(ep)) : "", kind: "single", genreId, ep, act: actFromEp(ep) || 1, title };
  }
  if (kind === "act") {
    return { slot: act ? resultSlot(genreId, "", act) : "", kind: "playlist", genreId, ep: "", act, title };
  }
  const name = title.trim();
  const genre = kind === "cover" ? "cover-reborn" : storyGenreId(genreId);
  return { slot: name ? storySlot(name, genre) : "", kind: "story", genreId: genre, ep: "", act: 0, title: name };
}

async function readStoredBody(slot: string) {
  if (!slot) return null;
  const sql = await db();
  const rows = await sql<{ body: unknown }>`select body from studio_pages where slot = ${slot} limit 1`;
  return asObject(rows[0]?.body);
}

function shownFromStored(raw: Record<string, unknown> | null) {
  const src = stampBox(raw) ?? raw;
  const fields: Record<string, string> = {};
  if (!src) return fields;
  for (const key of FIELD_STAMP_KEYS) {
    if (typeof src[key] === "string") fields[key] = src[key];
  }
  return fields;
}

async function rememberFields(
  target: { slot: string; kind: string; genreId: string; ep: string; act: number; title: string },
  fields: Record<string, unknown>,
) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!FIELD_STAMP_KEYS.has(key)) continue;
    const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!text) continue;
    clean[key] = text.length > 100000 ? text.slice(0, 100000) : text;
  }
  const keys = Object.keys(clean);
  if (!target.slot || !keys.length) return false;
  try {
    const sql = await db();
    const found = await sql<{ slot: string }>`
      select slot from studio_pages
      where slot = ${target.slot}
         or (${target.kind} = 'single' and kind = 'single' and genre_id = ${target.genreId} and ep = ${target.ep} and ${target.ep} <> '')
         or (${target.kind} = 'playlist' and kind = 'playlist' and genre_id = ${target.genreId} and act = ${target.act} and ${target.ep} = '' and ${target.act} > 0)
      limit 1
    `;
    if (!found.length) {
      if (target.kind === "story") return false;
      await sql`
        insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
        values (
          ${target.slot},
          ${target.kind},
          ${target.genreId},
          ${target.ep},
          ${target.act},
          ${target.title},
          '{}'::jsonb,
          now()
        )
        on conflict (slot) do nothing
      `;
    }
    const now = new Date().toISOString();
    for (const key of keys) {
      const value = clean[key];
      await sql`
        update studio_pages
        set body = jsonb_set(
          jsonb_set(coalesce(body, '{}'::jsonb), ${`{${key}}`}::text[], to_jsonb(${value}::text), true),
          '{fieldSavedAt}',
          coalesce(body->'fieldSavedAt', '{}'::jsonb) || jsonb_build_object(${key}::text, to_jsonb(${now}::text)),
          true
        )
        where slot = ${target.slot}
           or (${target.kind} = 'single' and kind = 'single' and genre_id = ${target.genreId} and ep = ${target.ep} and ${target.ep} <> '')
           or (${target.kind} = 'playlist' and kind = 'playlist' and genre_id = ${target.genreId} and act = ${target.act} and ${target.ep} = '' and ${target.act} > 0)
      `;
    }
    return true;
  } catch {
    return false;
  }
}

function slimPageBody<T extends { thumbUrl?: string }>(body: T): T {
  const thumb = body.thumbUrl ?? "";
  if (thumb.startsWith("data:")) return { ...body, thumbUrl: "" };
  return body;
}

function cleanSunoAddress(raw: unknown) {
  const text = String(raw ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const hit = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!hit) return "";
  return hit[0].replace(/[),.;]+$/g, "").slice(0, 500);
}

async function upsertStoredPage(row: {
  kind: string;
  genreId: string;
  ep: string;
  act: number;
  title: string;
  body: unknown;
  rewrite?: boolean;
}) {
  const sql = await db();
  const slot =
    row.kind === "single" ? resultSlot(row.genreId, row.ep, row.act) : resultSlot(row.genreId, "", row.act);
  if (row.kind === "single") {
    const prevRows = await sql<{ body: unknown }>`select body from studio_pages where slot = ${slot} limit 1`;
    const prevRaw = asObject(prevRows[0]?.body);
    const prev = asSingle(prevRaw);
    const next = asSingle(row.body);
    if (prev && next && hasPageBody(prev) && !hasPageBody(next)) return false;
    const prevFlags = premiumOf(prevRaw);
    const nextFlags = premiumOf(asObject(row.body));
    const bodyObj: Record<string, unknown> = { ...(asObject(row.body) ?? {}), ...(next ?? {}), ...prevFlags, ...nextFlags };
    const rawIncoming = asObject(row.body) ?? {};
    const blanks = new Set(
      Array.isArray(rawIncoming.blankFields)
        ? rawIncoming.blankFields.filter((key): key is string => typeof key === "string")
        : [],
    );
    if (rawIncoming.sunoExact === true) blanks.add("sunoUrl");
    if (rawIncoming.levelExact === true) blanks.add("audioLevel");
    if (rawIncoming.analysisExact === true) blanks.add("audioAnalysis");
    const guarded = mergeLatestBody(prevRaw, { ...bodyObj, sunoExact: rawIncoming.sunoExact === true, levelExact: rawIncoming.levelExact === true, analysisExact: rawIncoming.analysisExact === true }, blanks);
    delete guarded.sunoExact;
    delete guarded.levelExact;
    delete guarded.analysisExact;
    const payload = JSON.stringify(guarded);
    await writeStoredPage(sql, slot, row, payload);
    return true;
  }
  const prevRows = await sql<{ body: unknown }>`select body from studio_pages where slot = ${slot} limit 1`;
  const prevRaw = asObject(prevRows[0]?.body);
  const incoming = asObject(row.body) ?? {};
  const exactSuno = incoming.sunoExact === true;
  const exactLevel = incoming.levelExact === true;
  const exactAnalysis = incoming.analysisExact === true;
  const blanks = new Set(
    Array.isArray(incoming.blankFields)
      ? incoming.blankFields.filter((key): key is string => typeof key === "string")
      : [],
  );
  if (exactSuno) blanks.add("sunoUrl");
  if (exactLevel) blanks.add("audioLevel");
  if (exactAnalysis) blanks.add("audioAnalysis");
  const guarded = mergeLatestBody(prevRaw, {
    ...incoming,
    ...premiumOf(prevRaw),
    ...premiumOf(incoming),
  }, blanks);
  delete guarded.sunoExact;
  delete guarded.levelExact;
  delete guarded.analysisExact;
  const payload = JSON.stringify(guarded);
  await writeStoredPage(sql, slot, row, payload);
  return true;
}

async function writeStoredPage(
  sql: Awaited<ReturnType<typeof db>>,
  slot: string,
  row: { kind: string; genreId: string; ep: string; act: number; title: string },
  payload: string,
) {
  await sql`
    insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
    values (
      ${slot},
      ${row.kind},
      ${row.genreId},
      ${row.kind === "single" ? row.ep : ""},
      ${row.act},
      ${row.title},
      ${payload}::jsonb,
      now()
    )
    on conflict (slot) do update set
      kind = excluded.kind,
      genre_id = excluded.genre_id,
      ep = excluded.ep,
      act = excluded.act,
      title = excluded.title,
      body = excluded.body,
      updated_at = now()
  `;
}

export const saveStudioPage = createServerFn({ method: "POST" })
  .validator((input: {
    kind: PageKind;
    genreId: string;
    ep?: string;
    act?: number;
    title?: string;
    body: StudioPackage | PlaylistPackage;
    rewrite?: boolean;
  }) => {
    if (input.kind !== "single" && input.kind !== "playlist") throw new Error("invalid kind");
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    return {
      kind: input.kind,
      genreId: input.genreId,
      ep: padEp(input.ep ?? ""),
      act: Number(input.act ?? 1) || 1,
      title: (input.title ?? "").trim(),
      body: input.body,
      rewrite: input.rewrite === true,
    };
  })
  .handler(async ({ data }) => {
    const stored = slimPageBody(data.body);
    const title =
      data.title ||
      (data.kind === "single"
        ? (stored as StudioPackage).confirmedTitle
        : (stored as PlaylistPackage).youtubeTitle);
    let wroteBody = false;
    try {
      const file = (await enc()).putEncMany([
        data.kind === "single"
          ? {
              kind: "single" as const,
              genreId: data.genreId,
              ep: data.ep,
              title,
              pkg: stored as EncPkg,
              rewrite: data.rewrite,
            }
          : {
              kind: "playlist" as const,
              genreId: data.genreId,
              act: data.act,
              title,
              pkg: stored as EncPkg,
              rewrite: data.rewrite,
            },
      ]);
      wroteBody = file.written.length > 0;
      const rejected = Array.isArray(file.rejected) ? file.rejected.length > 0 : false;
      const unchanged = Array.isArray(file.unchanged) ? file.unchanged.length > 0 : false;
      const rev = typeof file.rev === "number" ? file.rev : 0;
      const savedKeys = Array.isArray(file.savedKeys) ? file.savedKeys : [];
      const rejectedKeys = Array.isArray(file.rejectedKeys) ? file.rejectedKeys : [];
      const fileError = typeof file.error === "string" ? file.error : "";
      const fileStatus = typeof file.status === "string" ? file.status : "";
      const filePath = typeof file.path === "string" ? file.path : "";
      let dbError = "";
      if (wroteBody) {
        try {
          await upsertStoredPage({
            kind: data.kind,
            genreId: data.genreId,
            ep: data.kind === "single" ? data.ep : "",
            act: data.act,
            title,
            body: stored,
            rewrite: data.rewrite,
          });
        } catch {
          dbError = "db";
        }
      }
      if (wroteBody) return { ok: true as const, status: (fileStatus || "written") as "written", rev, savedKeys, rejectedKeys, path: filePath, error: fileError || dbError || "" };
      if (unchanged && !rejected) return { ok: true as const, status: (fileStatus || "unchanged") as "unchanged", rev, savedKeys, rejectedKeys, path: filePath, error: fileError };
      const conflict = file.status === "conflict";
      return { ok: false as const, status: (fileStatus || (conflict ? "conflict" : "error")) as "conflict" | "error", error: fileError || (conflict ? "conflict" : rejected ? "rejected" : "kept"), rev, savedKeys, rejectedKeys, path: filePath };
    } catch (err) {
      const thrown = err instanceof Error ? err.message : "throw";
      console.error("[noa-save]", thrown);
      return { ok: false as const, status: "error" as const, error: "write", thrown, rev: 0, savedKeys: [] as string[], rejectedKeys: [] as string[], path: "" };
    }
  });

export const saveStudioPages = createServerFn({ method: "POST" })
  .validator((input: {
    pages: {
      kind: PageKind;
      genreId: string;
      ep?: string;
      act?: number;
      title?: string;
      body: StudioPackage | PlaylistPackage;
      rewrite?: boolean;
    }[];
  }) => {
    const pages = (input.pages ?? []).filter((row) => isGenre(row.genreId) && (row.kind === "single" || row.kind === "playlist"));
    return { pages };
  })
  .handler(async ({ data }) => {
    const rows = data.pages.map((row) => {
      const stored = slimPageBody(row.body);
      const title =
        row.title?.trim() ||
        (row.kind === "single"
          ? (stored as StudioPackage).confirmedTitle
          : (stored as PlaylistPackage).youtubeTitle);
      return {
        kind: row.kind,
        genreId: row.genreId,
        ep: padEp(row.ep ?? ""),
        act: Number(row.act ?? 1) || 1,
        title,
        pkg: stored as EncPkg,
        body: stored,
        rewrite: row.rewrite === true || (stored as { sunoExact?: boolean }).sunoExact === true || (stored as { levelExact?: boolean }).levelExact === true || (stored as { analysisExact?: boolean }).analysisExact === true,
      };
    });
    let stored = 0;
    const written: string[] = [];
    const kept: string[] = [];
    const rejected: string[] = [];
    let sawConflict = false;
    const missed: string[] = [];
    const suno: Record<string, string> = {};
    const sqlLeft: Promise<unknown>[] = [];
    let dbError = "";
    const rejectedKeys: string[] = [];
    let fileError = "";
    let fileRev = 0;
    let filePath = "";
    let thrown = "";
    for (const row of rows) {
      let wrote = false;
      let wroteBody = false;
      const wantedSuno = cleanSunoAddress((row.pkg as { sunoUrl?: unknown }).sunoUrl);
      if (wantedSuno) (row.pkg as { sunoUrl?: string }).sunoUrl = wantedSuno;
      try {
        const store = await enc();
        const keys = store.putEncMany([
          {
            kind: row.kind,
            genreId: row.genreId,
            ep: row.ep,
            act: row.act,
            title: row.title,
            pkg: row.pkg,
            rewrite: row.rewrite,
          },
        ]);
        written.push(...keys.written);
        kept.push(...keys.kept);
        if (Array.isArray(keys.rejected)) rejected.push(...keys.rejected);
        if (Array.isArray(keys.rejectedKeys)) rejectedKeys.push(...keys.rejectedKeys.filter((key) => typeof key === "string" && key));
        if (typeof keys.error === "string" && keys.error) fileError = keys.error;
        if (typeof keys.rev === "number") fileRev = keys.rev;
        if (typeof keys.path === "string" && keys.path) filePath = keys.path;
        if (keys.status === "conflict") sawConflict = true;
        wroteBody = keys.written.length > 0;
        const rowRejected = Array.isArray(keys.rejected) && keys.rejected.length > 0;
        const unchanged = Array.isArray(keys.unchanged) && keys.unchanged.length > 0;
        wrote = wroteBody || (unchanged && !rowRejected);
        if (!wrote) missed.push(row.kind === "single" ? `${row.genreId}:${row.ep}` : `${row.genreId}:act:${row.act}`);
        if (wantedSuno) {
          const key = row.kind === "single" ? `${row.genreId}:${row.ep}` : `${row.genreId}:act:${row.act}`;
          const page = row.kind === "single" ? store.readSongPage(row.genreId, row.ep) : store.readActPage(row.genreId, row.act);
          const got = String(page?.pkg?.sunoUrl || "").trim();
          if (got === wantedSuno) suno[key] = got;
        }
      } catch (err) {
        thrown = err instanceof Error ? err.message : "throw";
        console.error("[noa-save]", thrown);
        missed.push(row.kind === "single" ? `${row.genreId}:${row.ep}` : `${row.genreId}:act:${row.act}`);
      }
      if (wroteBody) {
        sqlLeft.push(upsertStoredPage({
          kind: row.kind,
          genreId: row.genreId,
          ep: row.kind === "single" ? row.ep : "",
          act: row.act,
          title: row.title,
          body: row.body,
          rewrite: row.rewrite,
        }).then((row) => row, () => {
          dbError = "db";
          return false;
        }));
      }
      if (wrote) stored += 1;
    }
    try {
      await Promise.all(sqlLeft);
    } catch {
      dbError = "db";
    }
    if (!rows.length) return { ok: true as const, status: "unchanged" as const, n: 0, written: [] as string[], kept: [] as string[], rejected: [] as string[], suno, error: "", rev: 0, rejectedKeys: [] as string[], path: "", thrown: "" };
    const diag = { error: fileError, rev: fileRev, rejectedKeys, path: filePath, thrown };
    return missed.length === 0
      ? { ok: true as const, status: written.length ? "written" as const : "unchanged" as const, n: stored, written, kept, rejected, suno, ...diag, ...(dbError ? { db: "error" as const } : {}) }
      : { ok: false as const, status: sawConflict && written.length === 0 ? "conflict" as const : "error" as const, n: stored, missed, written, kept, rejected, suno, ...diag, ...(dbError ? { db: "error" as const } : {}) };
  });

export const saveOpenRepairs = createServerFn({ method: "POST" })
  .validator((input: {
    rows?: {
      kind?: string;
      genreId?: string;
      ep?: string;
      act?: number;
      fields?: { key?: string; from?: string; to?: string }[];
    }[];
  }) => {
    const rows = (input?.rows ?? [])
      .filter((row) => row && isGenre(String(row.genreId || "")) && (row.kind === "single" || row.kind === "playlist"))
      .map((row) => ({
        kind: row.kind as "single" | "playlist",
        genreId: String(row.genreId),
        ep: row.ep ? padEp(row.ep) : "",
        act: Number(row.act ?? 0) || 0,
        fields: (row.fields ?? [])
          .filter((field) => field && typeof field.key === "string")
          .map((field) => ({
            key: String(field.key),
            from: String(field.from ?? ""),
            to: String(field.to ?? ""),
          })),
      }));
    return { rows };
  })
  .handler(async ({ data }) => {
    const store = await enc();
    return store.stampOpenRepairs(data.rows);
  });

function storyGenreId(id?: string) {
  return id === "cover-reborn" ? "cover-reborn" : "your-story";
}

function storySlot(title: string, genreId?: string) {
  return `story:${storyGenreId(genreId)}:${title.trim()}`;
}

function storySongIdOf(body: unknown) {
  const obj = asObject(body);
  if (!obj) return "";
  if (typeof obj.songId === "string" && obj.songId.trim()) return obj.songId.trim();
  const nested = asObject(obj.pkg);
  return nested && typeof nested.songId === "string" ? nested.songId.trim() : "";
}

function storyWorthFile(raw: Record<string, unknown> | null) {
  if (!raw) return false;
  if (Array.isArray(raw.songs) && raw.pkg && typeof raw.pkg === "object") return true;
  const pkg = asStoryBody(raw);
  if (!pkg) return false;
  return storyTextSize(pkg as unknown as Record<string, unknown>) > 0
    || Boolean((pkg.youtubeUrl || "").trim() || (pkg.sunoUrl || "").trim() || (pkg.mvUrl || "").trim() || (pkg.audioLevel || "").trim() || (pkg.audioAnalysis || "").trim() || (pkg.thumbUrl || "").trim());
}

function isRoundTripProbe(value: string) {
  return /^s(?:round|probe|prob)/.test(value.trim());
}

async function landStoredStory(
  store: {
    shownFilePath: (kind: "story" | "cover", genreId: string, ep: string, act: number, title: string) => string;
    shownFileExists: (path: string) => boolean;
    putEncStory: (title: string, pkg: EncPkg, genreId?: string) => unknown;
  },
  kind: "story" | "cover",
  genreId: string,
  title: string,
  raw: Record<string, unknown> | null,
) {
  const name = title.trim();
  if (!name || !storyWorthFile(raw)) return false;
  if (isRoundTripProbe(name) || isRoundTripProbe(storySongIdOf(raw))) return false;
  const genre = kind === "cover" ? "cover-reborn" : storyGenreId(genreId);
  const names = [...new Set([storySongIdOf(raw), name].filter(Boolean))];
  for (const item of names) {
    const path = store.shownFilePath(kind, genre, "", 0, item);
    if (path && store.shownFileExists(path)) return true;
  }
  const body = { ...(raw as Record<string, unknown>) };
  delete body.sunoExact;
  delete body.levelExact;
  try {
    store.putEncStory(name, body as EncPkg, genre);
  } catch {
    return false;
  }
  for (const item of names) {
    const path = store.shownFilePath(kind, genre, "", 0, item);
    if (path && store.shownFileExists(path)) return true;
  }
  return false;
}

export async function landAllStoredStories() {
  const sql = await db();
  const rows = await sql<PageRow>`
    select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
    from studio_pages
    where kind = ${"story"} or slot like ${"story:%"}
  `;
  const store = await enc();
  let wrote = 0;
  let had = 0;
  const titles: string[] = [];
  for (const row of rows) {
    const title = (row.title || "").trim();
    const raw = asObject(row.body);
    if (!title || !raw) continue;
    const cover = row.genre_id === "cover-reborn" || title.startsWith("playlist:cover:");
    const kind = cover ? "cover" : "story";
    const genre = cover ? "cover-reborn" : storyGenreId(row.genre_id);
    const names = [...new Set([storySongIdOf(raw), title].filter(Boolean))];
    const existed = names.some((item) => {
      const path = store.shownFilePath(kind, genre, "", 0, item);
      return Boolean(path && store.shownFileExists(path));
    });
    const ok = await landStoredStory(store, kind, genre, title, raw);
    if (!ok) continue;
    if (existed) had += 1;
    else wrote += 1;
    titles.push(title);
  }
  const counts = await sql<{ kind: string; n: number }>`select kind, count(*)::int as n from studio_pages group by kind`;
  return { counts, stories: rows.length, wrote, had, titles };
}

function storyTextSize(pkg: Record<string, unknown> | null | undefined) {
  if (!pkg) return 0;
  return ["geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "sunoStyle", "sourceLyrics", "sourceVocal", "sourceGenre", "confirmedTitle", "lyricsBlock"].reduce(
    (sum, key) => sum + String(pkg[key] || "").trim().length,
    0,
  );
}

function asStoryBody(body: unknown): StoryPackage | null {
  const parsed = asObject(body);
  if (!parsed) return null;
  const nested = asObject(parsed.pkg);
  const src = nested && (typeof nested.geminiPrompt === "string" || typeof nested.sourceLyrics === "string" || typeof nested.youtubeTitle === "string" || typeof nested.confirmedTitle === "string" || typeof nested.lyricsBlock === "string" || typeof nested.sunoUrl === "string") ? nested : parsed;
  return normalizeStory({
    geminiPrompt: typeof src.geminiPrompt === "string" ? src.geminiPrompt : "",
    youtubeTitle: typeof src.youtubeTitle === "string" ? src.youtubeTitle : "",
    youtubeDescription: typeof src.youtubeDescription === "string" ? src.youtubeDescription : "",
    fanLetter: typeof src.fanLetter === "string" ? src.fanLetter : "",
    sunoStyle: typeof src.sunoStyle === "string" ? src.sunoStyle : "",
    thumbUrl: typeof src.thumbUrl === "string" ? src.thumbUrl : "",
    thumbCast: src.thumbCast === "male" || src.thumbCast === "duet" ? src.thumbCast : "female",
    sourceLyrics: typeof src.sourceLyrics === "string" ? src.sourceLyrics : "",
    sourceVocal: typeof src.sourceVocal === "string" ? src.sourceVocal : "",
    sourceGenre: typeof src.sourceGenre === "string" ? src.sourceGenre : "",
    confirmedTitle: typeof src.confirmedTitle === "string" ? src.confirmedTitle : "",
    lyricsBlock: typeof src.lyricsBlock === "string" ? src.lyricsBlock : "",
    youtubeUrl: typeof src.youtubeUrl === "string" ? src.youtubeUrl : "",
    sunoUrl: typeof src.sunoUrl === "string" ? src.sunoUrl : "",
    mvUrl: typeof src.mvUrl === "string" ? src.mvUrl : "",
    audioLevel: typeof src.audioLevel === "string" ? src.audioLevel : "",
    audioAnalysis: typeof src.audioAnalysis === "string" ? src.audioAnalysis : "",
    ...(src.ytPremium === true || src.ytPremium === false ? { ytPremium: src.ytPremium === true } : {}),
    ...(src.mvPremium === true || src.mvPremium === false ? { mvPremium: src.mvPremium === true } : {}),
    songId: typeof src.songId === "string" ? src.songId : "",
  });
}

export const loadStoryPage = createServerFn({ method: "GET" })
  .validator((input: { title: string; genreId?: string }) => ({ title: input.title.trim(), genreId: storyGenreId(input.genreId) }))
  .handler(async ({ data }) => {
    if (!data.title) return null;
    const sql = await db();
    const slot = storySlot(data.title, data.genreId);
    const rows = await sql<PageRow>`
      select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
      from studio_pages where slot = ${slot} limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const pkg = asStoryBody(row.body);
    if (!pkg) return null;
    return { pkg, updatedAt: Date.parse(row.updated_at) || Date.now(), title: row.title };
  });

export const saveStoryPage = createServerFn({ method: "POST" })
  .validator((input: { title: string; body: StoryPackage & { registeredAt?: number; sunoExact?: boolean; levelExact?: boolean }; previousTitle?: string; genreId?: string }) => ({
    title: input.title.trim(),
    body: input.body,
    previousTitle: String(input.previousTitle || "").trim(),
    genreId: storyGenreId(input.genreId),
  }))
  .handler(async ({ data }) => {
    if (!data.title) return { ok: false as const };
    if (data.title.startsWith("playlist:")) {
      const stored = data.body;
      let fileOk = false;
      try {
        const store = await enc();
        fileOk = store.putEncStory(data.title, stored as EncPkg, data.genreId, true) === true;
      } catch {
        fileOk = false;
      }
      if (fileOk) {
        try {
          const sql = await db();
          const payload = JSON.stringify(stored);
          await sql`
            insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
            values (
              ${storySlot(data.title, data.genreId)},
              ${"story"},
              ${data.genreId},
              ${""},
              ${0},
              ${data.title},
              ${payload}::jsonb,
              now()
            )
            on conflict (slot) do update set
              kind = excluded.kind,
              title = excluded.title,
              body = excluded.body,
              updated_at = now()
          `;
        } catch {
          /* the story file already has the text */
        }
      }
      return { ok: fileOk };
    }
    const storedRaw = slimPageBody(data.body);
    const sunoExact = (data.body as { sunoExact?: boolean }).sunoExact === true;
    const levelExact = (data.body as { levelExact?: boolean }).levelExact === true;
    const analysisExact = (data.body as { analysisExact?: boolean }).analysisExact === true;
    const songId = storySongIdOf(storedRaw);
    const display = data.title.trim();
    const storeId = songId || display;
    const slot = storySlot(storeId, data.genreId);
    let stored = storedRaw;
    if (sunoExact || levelExact || analysisExact) {
      stored = {
        ...stored,
        ...(sunoExact ? { sunoUrl: String((data.body as { sunoUrl?: string }).sunoUrl || ""), sunoExact: true } : {}),
        ...(levelExact ? { audioLevel: String((data.body as { audioLevel?: string }).audioLevel || ""), levelExact: true } : {}),
        ...(analysisExact ? { audioAnalysis: String((data.body as { audioAnalysis?: string }).audioAnalysis || ""), analysisExact: true } : {}),
      } as typeof stored;
    }
    let fileOk = false;
    try {
      const store = await enc();
      fileOk = store.putEncStory(display, stored as EncPkg, data.genreId, true) === true;
      if (fileOk && data.previousTitle && data.previousTitle !== storeId) store.deleteEncStory(data.previousTitle, data.genreId);
    } catch {
      fileOk = false;
    }
    if (!fileOk) {
      try {
        const store = await enc();
        const probe = stored as { songId?: string; geminiPrompt?: string; youtubeDescription?: string; fanLetter?: string; youtubeTitle?: string; summary?: string };
        if (!isStoryFixture(storeId, probe) && !isStoryFixture(display, probe)) {
          const kind = data.genreId === "cover-reborn" ? "cover" : "story";
          const artist = kind === "cover"
            ? coverArtistOf(String((stored as { sourceGenre?: string }).sourceGenre || ""), String((stored as { sourceVocal?: string }).sourceVocal || ""))
            : "";
          const path = store.shownFilePath(kind, data.genreId, "", 0, display, artist);
          const raw = stored as Record<string, unknown>;
          const fields: Record<string, string> = {};
          for (const key of ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist", "youtubeUrl", "mvUrl", "sunoUrl", "audioLevel", "audioAnalysis", "sourceLyrics", "sourceVocal", "sourceGenre"]) {
            if (typeof raw[key] === "string") fields[key] = raw[key];
          }
          if (path && !store.shownFileExists(path)) store.ensureEmptyShownFile(path, { title: display, ...(songId ? { songId } : {}) });
          const wrote = store.writeShownFields(path, fields, { title: display, ...(songId ? { songId } : {}) }, true, false);
          fileOk = Boolean(wrote.ok && path && store.shownFileExists(path));
        }
      } catch {
        fileOk = false;
      }
    }
    if (fileOk) {
      const payload = JSON.stringify(stored);
      void db()
        .then(async (sql) => {
          await sql`
            insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
            values (
              ${slot},
              ${"story"},
              ${data.genreId},
              ${""},
              ${0},
              ${display},
              ${payload}::jsonb,
              now()
            )
            on conflict (slot) do update set
              kind = excluded.kind,
              title = excluded.title,
              body = excluded.body,
              updated_at = now()
          `;
          if (data.previousTitle && data.previousTitle !== storeId) {
            await sql`delete from studio_pages where slot = ${storySlot(data.previousTitle, data.genreId)}`;
          }
        })
        .catch(() => {
          /* the story file already has the text */
        });
    }
    return fileOk ? { ok: true as const, slot } : { ok: false as const, slot };
  });

function prefSlot(genreId: string) {
  return `pref:${genreId}`;
}

const COMMON_SLOT = "pref:__common";

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("slow")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const loadCommonPref = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const file = (await enc()).readEncPref("__common");
    if (file) return file;
  } catch {
    /* the database copy is only a fallback when the file is missing */
  }
  try {
    const sql = await within(db(), 3000);
    const rows = await within(
      sql<PageRow>`select body from studio_pages where slot = ${COMMON_SLOT} limit 1`,
      3000,
    );
    return rows[0] ? asObject(rows[0].body) : null;
  } catch {
    return null;
  }
});

export const saveCommonPref = createServerFn({ method: "POST" })
  .validator((input: { pref: Record<string, unknown> }) => input)
  .handler(async ({ data }) => {
    const sql = await db();
    let admin = typeof data.pref.adminDevice === "string" ? data.pref.adminDevice.trim() : "";
    let prevAdmin = "";
    try {
      const prevRows = await sql<{ body: unknown }>`select body from studio_pages where slot = ${COMMON_SLOT} limit 1`;
      const prev = asObject(prevRows[0]?.body);
      prevAdmin = typeof prev?.adminDevice === "string" ? prev.adminDevice.trim() : "";
      if (!prevAdmin) {
        const file = (await enc()).readEncPref("__common");
        prevAdmin = typeof file?.adminDevice === "string" ? file.adminDevice.trim() : "";
      }
    } catch {
      prevAdmin = "";
    }
    const { keptAdmin } = await import("./user-prefs");
    admin = keptAdmin(prevAdmin, admin);
    const baseRev = typeof data.pref.baseRev === "number" ? data.pref.baseRev : typeof data.pref.rev === "number" ? data.pref.rev : 0;
    const stored = { ...(admin ? { ...data.pref, adminDevice: admin } : { ...data.pref, adminDevice: "" }), baseRev };
    delete stored.rev;
    try {
      const wrote = (await enc()).putEncPref("__common", stored);
      if (wrote === false) return { ok: false as const, error: "다른 저장이 먼저 반영되어 설정을 덮지 않았습니다.", rev: baseRev };
    } catch {
      return { ok: false as const, error: "설정을 파일에 쓰지 못했습니다.", rev: baseRev };
    }
    const savedRev = Number((await enc()).readEncPref("__common")?.rev) || baseRev + 1;
    const payload = JSON.stringify({ ...stored, rev: savedRev });
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${COMMON_SLOT},
        ${"pref"},
        ${"__common"},
        ${""},
        ${0},
        ${"common-pref"},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        kind = excluded.kind,
        body = excluded.body,
        updated_at = now()
    `;
    return { ok: true as const, rev: savedRev };
  });

export const loadGenrePref = createServerFn({ method: "GET" })
  .validator((input: { genreId: string }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    return { genreId: input.genreId };
  })
  .handler(async ({ data }) => {
    let parsed: Record<string, unknown> | null = null;
    try {
      const file = (await enc()).readEncPref(data.genreId);
      parsed = file && typeof file === "object" ? file as Record<string, unknown> : null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      const sql = await db();
      const slot = prefSlot(data.genreId);
      const rows = await sql<PageRow>`
        select body from studio_pages where slot = ${slot} limit 1
      `;
      const row = rows[0];
      parsed = row ? asObject(row.body) : null;
    }
    if (!parsed) return null;
    return {
      lang: typeof parsed.lang === "string" ? parsed.lang : "",
      titleFormat: typeof parsed.titleFormat === "string" ? parsed.titleFormat : "",
      titleMode: typeof parsed.titleMode === "string" ? parsed.titleMode : "",
      langRule: typeof parsed.langRule === "string" ? parsed.langRule : "",
      titleModeRule: typeof parsed.titleModeRule === "string" ? parsed.titleModeRule : "",
      focus: typeof parsed.focus === "string" ? parsed.focus : "",
      reality: typeof parsed.reality === "number" ? parsed.reality : -1,
      motion: typeof parsed.motion === "number" ? parsed.motion : -1,
      extra: typeof parsed.extra === "string" ? parsed.extra : "",
      community: typeof parsed.community === "boolean" ? parsed.community : undefined,
      descLyrics: typeof parsed.descLyrics === "boolean" ? parsed.descLyrics : undefined,
      lockDescLyrics: typeof parsed.lockDescLyrics === "boolean" ? parsed.lockDescLyrics : undefined,
      actPlaylist: typeof parsed.actPlaylist === "boolean" ? parsed.actPlaylist : undefined,
      output:
        parsed.output && typeof parsed.output === "object" && !Array.isArray(parsed.output)
          ? (parsed.output as Record<string, boolean>)
          : undefined,
      actOutput:
        parsed.actOutput && typeof parsed.actOutput === "object" && !Array.isArray(parsed.actOutput)
          ? (parsed.actOutput as Record<string, boolean>)
          : undefined,
      sunoBase: typeof parsed.sunoBase === "string" ? parsed.sunoBase : "",
      vocalStyle: typeof parsed.vocalStyle === "string" ? parsed.vocalStyle : "",
      musicStyle: typeof parsed.musicStyle === "string" ? parsed.musicStyle : "",
      rewriteRules: typeof parsed.rewriteRules === "string" ? parsed.rewriteRules : "",
      structure: typeof parsed.structure === "string" ? parsed.structure : "",
      moodLineRule: typeof parsed.moodLineRule === "string" ? parsed.moodLineRule : "",
      thumbGenreLine: typeof parsed.thumbGenreLine === "string" ? parsed.thumbGenreLine : "",
      forbidList: typeof parsed.forbidList === "string" ? parsed.forbidList : "",
      guideText: typeof parsed.guideText === "string" ? parsed.guideText : "",
      listRule: typeof parsed.listRule === "string" ? parsed.listRule : "",
      rev: typeof parsed.rev === "number" ? parsed.rev : 0,
    };
  });

export const saveGenrePref = createServerFn({ method: "POST" })
  .validator((input: {
    genreId: string;
    pref: {
      lang: string;
      titleFormat: string;
      titleMode: string;
      langRule?: string;
      titleModeRule?: string;
      focus: string;
      reality: number;
      motion: number;
      extra: string;
      community: boolean;
      descLyrics: boolean;
      lockDescLyrics?: boolean;
      actPlaylist?: boolean;
      output?: Record<string, boolean>;
      actOutput?: Record<string, boolean>;
      sunoBase?: string;
      vocalStyle?: string;
      musicStyle?: string;
      rewriteRules?: string;
      structure?: string;
      moodLineRule?: string;
      thumbGenreLine?: string;
      forbidList?: string;
      guideText?: string;
      listRule?: string;
      baseRev?: number;
      rev?: number;
    };
  }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    return { genreId: input.genreId, pref: input.pref };
  })
  .handler(async ({ data }) => {
    const baseRev = typeof (data.pref as { baseRev?: unknown }).baseRev === "number"
      ? (data.pref as { baseRev: number }).baseRev
      : typeof (data.pref as { rev?: unknown }).rev === "number"
        ? (data.pref as { rev: number }).rev
        : 0;
    const stored = { ...data.pref, baseRev } as Record<string, unknown>;
    delete stored.rev;
    let wrote = false;
    try {
      wrote = (await enc()).putEncPref(data.genreId, stored) !== false;
    } catch {
      wrote = false;
    }
    if (!wrote) return { ok: false as const, error: "다른 저장이 먼저 반영되어 장르 설정을 덮지 않았습니다.", slot: prefSlot(data.genreId), rev: baseRev };
    const savedRev = Number((await enc()).readEncPref(data.genreId)?.rev) || baseRev + 1;
    const sql = await db();
    const slot = prefSlot(data.genreId);
    const payload = JSON.stringify({ ...stored, rev: savedRev });
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"pref"},
        ${data.genreId},
        ${""},
        ${0},
        ${"user-pref"},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        kind = excluded.kind,
        body = excluded.body,
        updated_at = now()
    `;
    return { ok: true as const, slot, rev: savedRev };
  });

export const saveOriginalSong = createServerFn({ method: "POST" })
  .validator((input: {
    genreId: string;
    n: string;
    title: string;
    vocal: string;
    lyrics: string;
  }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    const n = padEp(input.n);
    if (!isEpNumber(n)) throw new Error("invalid ep");
    return {
      genreId: input.genreId,
      n,
      title: input.title.trim(),
      vocal: input.vocal.trim(),
      lyrics: input.lyrics,
    };
  })
  .handler(async ({ data }) => {
    const sql = await db();
    const slot = `original:${data.genreId}:${data.n}`;
    const payload = JSON.stringify({ n: data.n, title: data.title, vocal: data.vocal, lyrics: data.lyrics });
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"original"},
        ${data.genreId},
        ${data.n},
        ${0},
        ${data.title},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        kind = excluded.kind,
        title = excluded.title,
        body = excluded.body,
        updated_at = now()
    `;
    try {
      (await enc()).putEncOriginal(data.genreId, {
        n: data.n,
        title: data.title,
        vocal: data.vocal,
        lyrics: data.lyrics,
      });
    } catch {
      /* sql already stored */
    }
    return { ok: true as const, slot };
  });

async function pruneStudioDebris() {
  const sql = await db();
  const store = await enc();
  const rows = await sql<PageRow>`
    select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
    from studio_pages
  `;
  const groups = new Map<
    string,
    { slot: string; genreId: string; ep: string; title: string; pkg: StudioPackage; score: number; updated: number }[]
  >();
  for (const row of rows) {
    if (row.kind !== "single") continue;
    const ep = epInSlot(row.slot) || padEp(row.ep);
    if (!ep || !row.genre_id) continue;
    const pkg = asSingle(row.body);
    if (!pkg) {
      await sql`delete from studio_pages where slot = ${row.slot}`;
      continue;
    }
    const key = `${row.genre_id}:${ep}`;
    const list = groups.get(key) ?? [];
    list.push({
      slot: row.slot,
      genreId: row.genre_id,
      ep,
      title: row.title,
      pkg,
      score: studioScore(pkg),
      updated: Date.parse(row.updated_at) || 0,
    });
    groups.set(key, list);
  }
  let removed = 0;
  let rewritten = 0;
  for (const list of groups.values()) {
    list.sort((a, b) => b.score - a.score || b.updated - a.updated);
    const best = list[0];
    if (!best) continue;
    const canonical = resultSlot(best.genreId, best.ep, actFromEp(best.ep));
    if (list.length === 1 && list[0].slot === canonical) continue;
    const current = list.find((item) => item.slot === canonical);
    if (!current || current.score < best.score || (current.score === best.score && current.updated < best.updated)) {
      const payload = JSON.stringify(best.pkg);
      const act = actFromEp(best.ep);
      const title = best.pkg.confirmedTitle.trim() || best.title;
      await sql`
        insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
        values (
          ${canonical},
          ${"single"},
          ${best.genreId},
          ${best.ep},
          ${act},
          ${title},
          ${payload}::jsonb,
          now()
        )
        on conflict (slot) do update set
          kind = excluded.kind,
          genre_id = excluded.genre_id,
          ep = excluded.ep,
          act = excluded.act,
          title = excluded.title,
          body = excluded.body,
          updated_at = now()
      `;
      rewritten += 1;
    }
    store.forceEncPackage(best.genreId, best.ep, best.pkg.confirmedTitle.trim() || best.title, best.pkg);
    for (const item of list) {
      if (item.slot === canonical) continue;
      await sql`delete from studio_pages where slot = ${item.slot}`;
      removed += 1;
    }
  }
  const live = store.readEncyclopedia();
  if (!live.fillJob?.tasks?.length) {
    const gone = await sql<{ slot: string }>`delete from studio_pages where kind = ${"fill"} returning slot`;
    removed += gone.length;
  }
  return { songs: groups.size, removed, rewritten };
}

async function repairReportedMismatches(_dump: {
  packages: Record<string, { genreId: string; ep: string; title?: string; pkg: unknown }>;
  meta?: { rowLocks?: Record<string, boolean>; confirmed?: Record<string, boolean> };
}) {
  void _dump;
}

export const pullEncyclopedia = createServerFn({ method: "GET" }).handler(async () => {
  const store = await enc();
  const dump = store.readStudioShell();
  const filePackages = { ...dump.packages };
  const filePlaylists = { ...dump.playlists };
  const httpLink = (value: unknown) => {
    const text = String(value ?? "").trim();
    return /^https?:\/\//i.test(text) ? text : "";
  };
  try {
    const sql = await within(db(), 4000);
    const rows = await within(
      sql<PageRow>`
      select slot, kind, genre_id, ep, act, title, body, updated_at::text as updated_at
      from studio_pages where kind in ('pref', 'meta', 'single', 'playlist', 'story')
    `,
      8000,
    );
    for (const row of rows) {
      const body = asObject(row.body);
      if (!body) continue;
      if (row.kind === "story" || row.kind === "single" || row.kind === "playlist") continue;
      if (row.kind === "story") {
        const title = row.title?.trim();
        if (!title) continue;
        const cover = row.genre_id === "cover-reborn" || title.startsWith("playlist:cover:");
        if (title.startsWith("playlist:")) {
          const shown = title;
          const cacheKey = title;
          const genreId = cover ? "cover-reborn" : storyGenreId(row.genre_id);
          const fileAt = store.readStoryUpdatedAt(shown, genreId);
          if (!fileAt) {
            try {
              store.putEncStory(shown, body as EncPkg, genreId);
            } catch {
              /* the file is still missing until the next save */
            }
          }
          const wrap = body as { id?: string; theme?: string; songs?: unknown; pkg?: unknown };
          if (Array.isArray(wrap.songs) && wrap.pkg && typeof wrap.pkg === "object") {
            const filePkgWrap = dump.stories[cacheKey]?.pkg as { pkg?: Record<string, unknown> } | undefined;
            const fileSuno = httpLink(filePkgWrap?.pkg?.sunoUrl);
            if (fileAt && dump.stories[cacheKey]) continue;
            const shownPkg = fileSuno ? { ...(wrap.pkg as object), sunoUrl: fileSuno } : wrap.pkg;
            dump.stories[cacheKey] = { title: (typeof wrap.theme === "string" && wrap.theme) || title, pkg: { ...wrap, pkg: shownPkg } as EncPkg };
          }
          continue;
        }
        const songId = storySongIdOf(body);
        const genreKey = cover ? "cover-reborn" : storyGenreId(row.genre_id);
        const prefix = `story:${genreKey}:`;
        const slotId = row.slot.startsWith(prefix) ? row.slot.slice(prefix.length) : "";
        const storeId = songId || slotId || title;
        const display = title;
        const cacheKey = cover ? `cover:${storeId}` : storeId;
        const genreId = genreKey;
        const fileAt = store.readStoryUpdatedAt(storeId, genreId);
        const sqlAt = Date.parse(row.updated_at) || 0;
        if (!fileAt) {
          try {
            const fileSong = songId || (storeId !== display ? storeId : "");
            const fileBody = fileSong && typeof body === "object" && body ? { ...(body as object), songId: fileSong } : body;
            store.putEncStory(display, fileBody as EncPkg, genreId);
          } catch {
            /* the file is still missing until the next save */
          }
        }
        const pkg = asStoryBody(body);
        if (!pkg) continue;
        const savedAt = Math.max(sqlAt, fileAt) || 0;
        const registeredAt = Number(dump.stories[cacheKey]?.registeredAt) || Number((body as { registeredAt?: number }).registeredAt) || 0;
        const filePkg = dump.stories[cacheKey]?.pkg as Record<string, unknown> | undefined;
        const fileSuno = httpLink(filePkg?.sunoUrl);
        if (filePkg && fileAt) {
          dump.stories[cacheKey] = {
            title: display,
            pkg: overlayStamps(filePkg, body, fileAt) as EncPkg,
            ...(registeredAt ? { registeredAt } : {}),
            savedAt: fileAt,
          };
          continue;
        }
        const shown = overlayStamps(fileSuno ? { ...pkg, sunoUrl: fileSuno } : pkg, body, fileAt);
        if (!filePkg || sqlAt >= fileAt) {
          dump.stories[cacheKey] = {
            title: display,
            pkg: shown,
            ...(registeredAt ? { registeredAt } : {}),
            ...(savedAt ? { savedAt } : {}),
          };
        } else if (savedAt || registeredAt) {
          dump.stories[cacheKey] = {
            ...dump.stories[cacheKey],
            ...(registeredAt ? { registeredAt } : {}),
            savedAt: fileAt || savedAt,
          };
        }
        continue;
      }
      if (row.kind === "single") {
        const ep = padEp(row.ep);
        if (!row.genre_id || !ep) continue;
        const pkg = asSingle(body);
        const key = `${row.genre_id}:${ep}`;
        const fileAt = store.readSongUpdatedAt(row.genre_id, ep);
        const sqlAt = Date.parse(row.updated_at) || 0;
        const rawSong = filePackages[key]?.pkg as Record<string, unknown> | undefined;
        const fileBody = asSingle(rawSong);
        if (!(pkg && hasPageBody(pkg)) && !(fileBody && hasPageBody(fileBody))) continue;
        const fileSuno = httpLink(fileBody?.sunoUrl);
        const base = fileBody && hasPageBody(fileBody)
          ? fileWins(fileBody, pkg && hasPageBody(pkg) ? pkg : null, hasPageBody)
          : fileSuno && pkg ? { ...pkg, sunoUrl: fileSuno } : pkg;
        if (!base) continue;
        const shown = overlayStamps(base, body, fileAt);
        const at = Math.max(sqlAt, fileAt) || 0;
        if (!dump.packages[key] || (fileBody && hasPageBody(fileBody)) || sqlAt >= fileAt) {
          dump.packages[key] = { genreId: row.genre_id, ep, title: shown.confirmedTitle || row.title || "", pkg: shown, updatedAt: at };
        } else {
          dump.packages[key] = { ...dump.packages[key], updatedAt: fileAt || at };
        }
        continue;
      }
      if (row.kind === "playlist") {
        const act = Number(row.act) || 1;
        if (!row.genre_id) continue;
        const pkg = asPlaylist(body);
        const key = `${row.genre_id}:${act}`;
        const fileAt = store.readActUpdatedAt(row.genre_id, act);
        const sqlAt = Date.parse(row.updated_at) || 0;
        const rawAct = filePlaylists[key]?.pkg as Record<string, unknown> | undefined;
        const fileBody = asPlaylist(rawAct);
        if (!(pkg && hasPlaylistBody(pkg)) && !(fileBody && hasPlaylistBody(fileBody))) continue;
        const fileSuno = httpLink(fileBody?.sunoUrl);
        const base = fileBody && hasPlaylistBody(fileBody)
          ? fileWins(fileBody, pkg && hasPlaylistBody(pkg) ? pkg : null, hasPlaylistBody)
          : fileSuno && pkg ? { ...pkg, sunoUrl: fileSuno } : pkg;
        if (!base) continue;
        const shown = overlayStamps(base, body, fileAt);
        const at = Math.max(sqlAt, fileAt) || 0;
        if (!dump.playlists[key] || (fileBody && hasPlaylistBody(fileBody)) || sqlAt >= fileAt) {
          dump.playlists[key] = { genreId: row.genre_id, act, title: shown.youtubeTitle || row.title || "", pkg: shown, updatedAt: at };
        } else {
          dump.playlists[key] = { ...dump.playlists[key], updatedAt: fileAt || at };
        }
        continue;
      }
      if (row.kind === "pref" && row.genre_id) {
        const fileAt = store.readPrefUpdatedAt(row.genre_id);
        const sqlAt = Date.parse(row.updated_at) || 0;
        const filePref = (dump.prefs[row.genre_id] ?? {}) as Record<string, unknown>;
        const newer = sqlAt >= fileAt ? body : filePref;
        const older = sqlAt >= fileAt ? filePref : body;
        const merged: Record<string, unknown> = { ...older };
        for (const [key, value] of Object.entries(newer)) {
          if (value === undefined || value === null) continue;
          merged[key] = value;
        }
        const newerAdmin = typeof newer.adminDevice === "string" ? newer.adminDevice.trim() : "";
        const olderAdmin = typeof older.adminDevice === "string" ? older.adminDevice.trim() : "";
        const { keptAdmin } = await import("./user-prefs");
        merged.adminDevice = keptAdmin(olderAdmin, newerAdmin);
        dump.prefs[row.genre_id] = merged;
      } else if (row.kind === "meta" && dump.meta) {
        const sqlMeta = asMeta(body);
        const confirmed = { ...(dump.meta.confirmed ?? {}) };
        for (const [key, value] of Object.entries(sqlMeta.confirmed ?? {})) {
          if (value === true) confirmed[key] = true;
        }
        const youtube = { ...(sqlMeta.youtube ?? {}) };
        for (const [key, value] of Object.entries(dump.meta.youtube ?? {})) {
          if (value.trim()) youtube[key] = value;
        }
        const fileOrder = parseListOrder(dump.meta.listOrder);
        const sqlOrder = parseListOrder(sqlMeta.listOrder);
        const fileAt = store.readMetaUpdatedAt();
        const sqlAt = Date.parse(row.updated_at) || 0;
        const newerOrder = sqlAt >= fileAt ? sqlOrder : fileOrder;
        const olderOrder = sqlAt >= fileAt ? fileOrder : sqlOrder;
        dump.meta = {
          ...dump.meta,
          locks: { ...(sqlMeta.locks ?? {}), ...(dump.meta.locks ?? {}) },
          rowLocks: { ...(sqlMeta.rowLocks ?? {}), ...(dump.meta.rowLocks ?? {}) },
          confirmed,
          youtube,
          gatePassword: dump.meta.gatePassword?.trim() || sqlMeta.gatePassword || "",
          gateOpen: typeof dump.meta.gateOpen === "boolean" ? dump.meta.gateOpen : sqlMeta.gateOpen,
          releaseSeen: Math.max(dump.meta.releaseSeen || 0, sqlMeta.releaseSeen || 0),
          listOrder: { ...olderOrder, ...newerOrder },
        };
      }
    }
  } catch {
    /* the files already hold settings and confirmed marks */
  }
  return { ...dump, filePackages, filePlaylists };
});

export const setRowLock = createServerFn({ method: "POST" })
  .validator((input: { genreId: string; ep: string; on: boolean }) => {
    const ep = padEp(input.ep);
    if (!input.genreId || !ep) throw new Error("invalid lock");
    return { genreId: input.genreId, ep, on: input.on === true };
  })
  .handler(async ({ data }) => {
    const store = await enc();
    store.patchSongState(data.genreId, data.ep, { rowLocked: data.on });
    const rowLocks = store.writeRowLockFile(data.genreId, data.ep, data.on) ?? {};
    return { ok: true as const, rowLocks };
  });

export const saveSongState = createServerFn({ method: "POST" })
  .validator((input: { genreId: string; ep: string; rowLocked?: boolean; locks?: Record<string, boolean> }) => {
    const locks: Record<string, boolean> = {};
    if (input.locks && typeof input.locks === "object") {
      for (const [key, value] of Object.entries(input.locks)) {
        if (value === true || value === false) locks[key] = value;
      }
    }
    return {
      genreId: String(input.genreId || ""),
      ep: padEp(String(input.ep || "")),
      rowLocked: input.rowLocked === true ? true : input.rowLocked === false ? false : undefined,
      locks: input.locks ? locks : undefined,
    };
  })
  .handler(async ({ data }) => {
    if (!data.genreId || !data.ep) return { ok: false as const, error: "empty" };
    const store = await enc();
    const patch: { rowLocked?: boolean; locks?: Record<string, boolean> } = {};
    if (data.rowLocked === true || data.rowLocked === false) patch.rowLocked = data.rowLocked;
    if (data.locks) patch.locks = data.locks;
    const ok = store.patchSongState(data.genreId, data.ep, patch);
    if (data.rowLocked === true || data.rowLocked === false) store.writeRowLockFile(data.genreId, data.ep, data.rowLocked);
    return { ok };
  });

const META_SLOT = "meta:studio";

export const saveConfirm = createServerFn({ method: "POST" })
  .validator((input: { key: string; on: boolean }) => ({
    key: String(input.key || ""),
    on: input.on === true,
  }))
  .handler(async ({ data }) => {
    if (!data.key) return { ok: false as const, error: "empty key" };
    let fileOk = false;
    try {
      fileOk = (await enc()).putConfirmedFlag(data.key, data.on) === true;
    } catch {
      fileOk = false;
    }
    let sqlOk = false;
    let sqlError = "";
    try {
      const sql = await db();
      const epMatch = /^(.+):ep:(.+)$/.exec(data.key);
      if (epMatch) {
        const genreId = epMatch[1];
        const ep = padEp(epMatch[2]);
        if (genreId && ep) {
          const slot = resultSlot(genreId, ep, actFromEp(ep));
          if (data.on) {
            await sql`
              update studio_pages
              set body = jsonb_set(coalesce(body, '{}'::jsonb), '{pageConfirmed}', to_jsonb(true), true)
              where slot = ${slot}
                 or (kind = 'single' and genre_id = ${genreId} and ep = ${ep})
            `;
          } else {
            await sql`
              update studio_pages
              set body = coalesce(body, '{}'::jsonb) - 'pageConfirmed'
              where slot = ${slot}
                 or (kind = 'single' and genre_id = ${genreId} and ep = ${ep})
            `;
          }
        }
      }
      await stampMetaFlag(sql, "confirmed", data.key, data.on);
      sqlOk = true;
    } catch (err) {
      sqlError = err instanceof Error ? err.message : "sql";
    }
    if (fileOk || sqlOk) return { ok: true as const };
    return { ok: false as const, error: sqlError || "file" };
  });

async function stampMetaFlag(
  sql: Awaited<ReturnType<typeof db>>,
  group: "confirmed" | "youtube",
  key: string,
  value: boolean | string | null,
) {
  const seed =
    value === null
      ? JSON.stringify({ [group]: {} })
      : JSON.stringify({ [group]: { [key]: value } });
  if (group === "confirmed") {
    const on = value === true;
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${META_SLOT},
        ${"meta"},
        ${"__studio"},
        ${""},
        ${0},
        ${"app-meta"},
        ${seed}::jsonb,
        now()
      )
      on conflict (slot) do update set
        body = jsonb_set(
          coalesce(studio_pages.body, '{}'::jsonb),
          '{confirmed}',
          case
            when ${on} then coalesce(studio_pages.body->'confirmed', '{}'::jsonb) || jsonb_build_object(${key}::text, to_jsonb(true))
            else coalesce(studio_pages.body->'confirmed', '{}'::jsonb) - ${key}::text
          end,
          true
        ),
        updated_at = now()
    `;
    return;
  }
  if (value === null || value === "") {
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${META_SLOT},
        ${"meta"},
        ${"__studio"},
        ${""},
        ${0},
        ${"app-meta"},
        ${seed}::jsonb,
        now()
      )
      on conflict (slot) do update set
        body = jsonb_set(
          coalesce(studio_pages.body, '{}'::jsonb),
          '{youtube}',
          coalesce(studio_pages.body->'youtube', '{}'::jsonb) - ${key},
          true
        ),
        updated_at = now()
    `;
    return;
  }
  const url = String(value);
  await sql`
    insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
    values (
      ${META_SLOT},
      ${"meta"},
      ${"__studio"},
      ${""},
      ${0},
      ${"app-meta"},
      ${seed}::jsonb,
      now()
    )
    on conflict (slot) do update set
      body = jsonb_set(
        coalesce(studio_pages.body, '{}'::jsonb),
        '{youtube}',
        coalesce(studio_pages.body->'youtube', '{}'::jsonb) || jsonb_build_object(${key}::text, to_jsonb(${url}::text)),
        true
      ),
      updated_at = now()
  `;
}

export const readResultFile = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; genreId?: string; ep?: string; act?: number; title?: string; vocal?: string }) => ({
    kind: (input.kind === "act" || input.kind === "story" || input.kind === "cover" ? input.kind : "song") as "song" | "act" | "story" | "cover",
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    vocal: String(input.vocal || "").trim(),
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    const path = store.shownFilePath(data.kind, data.genreId, data.ep, data.act, data.title, data.vocal);
    const fileAt = path ? store.shownFileUpdatedAt(path) : 0;
    const onDisk = Boolean(path && store.shownFileExists(path));
    if ((data.kind === "story" || data.kind === "cover") && !onDisk) {
      try {
        const target = paneSaveTarget(data.kind, data.genreId, data.ep, data.act, data.title);
        const raw = target.slot ? await readStoredBody(target.slot) : null;
        await landStoredStory(store, data.kind, data.genreId, data.title, raw);
      } catch {
        /* the song file is still missing */
      }
      const landedPath = store.shownFilePath(data.kind, data.genreId, data.ep, data.act, data.title, data.vocal);
      const landed = Boolean(landedPath && store.shownFileExists(landedPath));
      if (!landed) return { ok: false as const, fields: {} as Record<string, string>, missing: [] as string[], error: "path", file: false as const };
      return { ok: true as const, fields: { ...store.readShownFields(landedPath) }, missing: [] as string[], error: "", file: true as const };
    }
    const fields: Record<string, string> = onDisk ? { ...store.readShownFields(path) } : {};
    if (onDisk) return { ok: true as const, fields, missing: [] as string[], error: "", file: true as const, rev: store.readShownRev(path) };
    try {
      const target = paneSaveTarget(data.kind, data.genreId, data.ep, data.act, data.title);
      const raw = target.slot ? await readStoredBody(target.slot) : null;
      const base = onDisk ? fields : shownFromStored(raw);
      const over = overlayStamps(base, raw, onDisk ? fileAt : 0);
      if (onDisk) {
        for (const key of ["sunoUrl", "audioLevel", "youtubeUrl", "mvUrl"] as const) {
          if (typeof fields[key] === "string") over[key] = fields[key];
          else delete over[key];
        }
      }
      const kept = Object.values(over).some((value) => String(value || "").trim());
      if (onDisk || kept) return { ok: true as const, fields: over, missing: [] as string[], error: "" };
    } catch {
      if (onDisk) return { ok: true as const, fields, missing: [] as string[], error: "" };
    }
    if (onDisk) return { ok: true as const, fields, missing: [] as string[], error: "" };
    return { ok: false as const, fields, missing: [] as string[], error: "path" };
  });

export const saveResultFields = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; genreId?: string; ep?: string; act?: number; title?: string; vocal?: string; fields?: Record<string, unknown>; blank?: boolean; rev?: number }) => ({
    kind: (input.kind === "act" || input.kind === "story" || input.kind === "cover" ? input.kind : "song") as "song" | "act" | "story" | "cover",
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    vocal: String(input.vocal || "").trim(),
    fields: input.fields && typeof input.fields === "object" ? input.fields : {},
    blank: input.blank === true,
    rev: typeof input.rev === "number" && Number.isInteger(input.rev) && input.rev >= 0 ? input.rev : undefined,
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    const artist = data.kind === "cover"
      ? coverArtistOf(String(data.fields.sourceGenre || ""), data.vocal || String(data.fields.sourceVocal || ""))
      : data.vocal;
    const path = store.shownFilePath(data.kind, data.genreId, data.ep, data.act, data.title, artist);
    if (!path) return { ok: false as const, fields: {} as Record<string, string>, missing: [] as string[], error: "path" };
    const shell = data.kind === "song"
      ? { genreId: data.genreId, ep: data.ep, title: data.title }
      : data.kind === "act"
        ? { genreId: data.genreId, act: data.act, title: data.title }
        : { title: data.title, ...(data.kind === "cover" ? { genreId: "cover-reborn" } : {}) };
    if ((data.kind === "story" || data.kind === "cover") && !store.shownFileExists(path)) {
      if (!store.ensureEmptyShownFile(path, shell)) return { ok: false as const, fields: {} as Record<string, string>, missing: [] as string[], error: "write" };
    }
    const saved = store.writeShownFields(path, data.fields, shell, true, data.blank, data.rev);
    return { ok: saved.ok, fields: saved.fields, missing: saved.missing, error: quietDiskFault(saved.error), rev: Number(saved.rev) || 0 };
  });

export const saveAudioLevel = createServerFn({ method: "POST" })
  .validator((input: { genreId?: string; ep?: string; audioLevel?: string; audioAnalysis?: string; rev?: number }) => ({
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    audioLevel: String(input.audioLevel || "").trim(),
    audioAnalysis: String(input.audioAnalysis || "").trim(),
    rev: typeof input.rev === "number" && Number.isInteger(input.rev) && input.rev >= 0 ? input.rev : undefined,
  }))
  .handler(async ({ data }) => {
    if (!data.genreId || !data.ep) return { ok: false as const, audioLevel: "", audioAnalysis: "", error: "empty" };
    const store = await enc();
    const saved = data.audioLevel ? store.pinAudioLevel(data.genreId, data.ep, data.audioLevel, data.rev) : { ok: true as const, audioLevel: "", error: "" };
    const analysis = data.audioAnalysis ? store.pinAudioAnalysis(data.genreId, data.ep, data.audioAnalysis, data.rev) : { ok: true as const, audioAnalysis: "", error: "" };
    const ok = saved.ok && analysis.ok;
    return { ok, audioLevel: saved.audioLevel, audioAnalysis: analysis.audioAnalysis, error: quietDiskFault(ok ? "" : saved.error || analysis.error) };
  });

export const pinShownAudioFile = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; genreId?: string; ep?: string; act?: number; title?: string; vocal?: string; audioLevel?: string; audioAnalysis?: string }) => ({
    kind: (input.kind === "act" || input.kind === "story" || input.kind === "cover" ? input.kind : "song") as "song" | "act" | "story" | "cover",
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    vocal: String(input.vocal || "").trim(),
    audioLevel: String(input.audioLevel || "").trim(),
    audioAnalysis: String(input.audioAnalysis || "").trim(),
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    return store.pinShownAudio(data.kind, data.genreId, data.ep, data.act, data.title, data.audioLevel, data.audioAnalysis, data.vocal);
  });

export const pinShownPremiumFile = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; genreId?: string; ep?: string; act?: number; title?: string; vocal?: string; which?: string; on?: boolean }) => ({
    kind: (input.kind === "act" || input.kind === "story" || input.kind === "cover" ? input.kind : "song") as "song" | "act" | "story" | "cover",
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    vocal: String(input.vocal || "").trim(),
    which: input.which === "mv" ? "mv" as const : "song" as const,
    on: input.on === true,
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    return store.pinShownPremium(data.kind, data.genreId, data.ep, data.act, data.title, data.which, data.on, data.vocal);
  });

export const saveExactLink = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; genreId?: string; ep?: string; act?: number; title?: string; sunoSet?: boolean; sunoUrl?: string; levelSet?: boolean; audioLevel?: string; analysisSet?: boolean; audioAnalysis?: string; rev?: number }) => ({
    kind: (input.kind === "act" || input.kind === "story" || input.kind === "cover" ? input.kind : "song") as "song" | "act" | "story" | "cover",
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    sunoSet: input.sunoSet === true,
    sunoUrl: String(input.sunoUrl ?? ""),
    levelSet: input.levelSet === true,
    audioLevel: String(input.audioLevel ?? ""),
    analysisSet: input.analysisSet === true,
    audioAnalysis: String(input.audioAnalysis ?? ""),
    rev: typeof input.rev === "number" && Number.isInteger(input.rev) && input.rev >= 0 ? input.rev : undefined,
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    const path = store.shownFilePath(data.kind, data.genreId, data.ep, data.act, data.title);
    if (!path) return { ok: false as const, sunoUrl: "", audioLevel: "", audioAnalysis: "", error: "path" };
    const shell = data.kind === "song"
      ? { genreId: data.genreId, ep: data.ep, title: data.title }
      : data.kind === "act"
        ? { genreId: data.genreId, act: data.act, title: data.title }
        : { title: data.title, ...(data.kind === "cover" ? { genreId: "cover-reborn" } : { genreId: data.genreId || "your-story" }) };
    const patch: { sunoUrl?: string; audioLevel?: string; audioAnalysis?: string } = {};
    if (data.sunoSet) patch.sunoUrl = data.sunoUrl;
    if (data.levelSet) patch.audioLevel = data.audioLevel;
    if (data.analysisSet) patch.audioAnalysis = data.audioAnalysis;
    const saved = store.writeExactShown(path, patch, shell, data.rev);
    const fileFields = store.readShownFields(path);
    const backSuno = data.sunoSet ? String(fileFields.sunoUrl || "") : saved.sunoUrl;
    const backLevel = data.levelSet ? String(fileFields.audioLevel || "") : saved.audioLevel;
    const backAnalysis = data.analysisSet ? String(fileFields.audioAnalysis || "") : saved.audioAnalysis;
    const wantSuno = data.sunoSet ? String(patch.sunoUrl || "").trim() : "";
    const wantLevel = data.levelSet ? String(patch.audioLevel || "").trim() : "";
    const wantAnalysis = data.analysisSet ? String(patch.audioAnalysis || "").trim() : "";
    const sunoOk = !data.sunoSet || backSuno === wantSuno;
    const levelOk = !data.levelSet || backLevel === wantLevel;
    const analysisOk = !data.analysisSet || backAnalysis === wantAnalysis;
    return {
      ok: Boolean(sunoOk && levelOk && analysisOk),
      sunoUrl: backSuno,
      audioLevel: backLevel,
      audioAnalysis: backAnalysis,
      error: sunoOk && levelOk && analysisOk ? "" : quietDiskFault(saved.error || "read"),
    };
  });

const MAIL_TO = "rucyjeon79@kakao.com";

export const sendStudioMail = createServerFn({ method: "POST" })
  .validator((input: { subject?: string; body?: string; author?: string }) => ({
    subject: String(input.subject || "").trim().slice(0, 100),
    body: String(input.body || "").trim().slice(0, 1000),
    author: String(input.author || "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    if (!data.subject || !data.body || !data.author) return { ok: false as const, error: "empty" };
    const message = `${data.body}\n\n작성자: ${data.author}`;
    const mailto = `mailto:${MAIL_TO}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(message)}`;
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${MAIL_TO}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.author,
          subject: data.subject,
          message,
          _captcha: "false",
          _template: "box",
        }),
      });
      const json = await res.json().catch(() => ({} as { success?: string | boolean; message?: string }));
      const success = json.success === true || json.success === "true";
      if (res.ok && success) return { ok: true as const, error: "" };
      return { ok: false as const, error: "send", mailto };
    } catch {
      return { ok: false as const, error: "send", mailto };
    }
  });

export const saveSongLink = createServerFn({ method: "POST" })
  .validator((input: { genreId: string; ep?: string; act?: number; url: string; field?: string; rev?: number }) => ({
    genreId: String(input.genreId || ""),
    ep: padEp(input.ep || ""),
    act: Number(input.act) || 0,
    url: String(input.url ?? "").trim(),
    field: input.field === "mv" ? "mv" : input.field === "suno" ? "suno" : "youtube",
    rev: typeof input.rev === "number" && Number.isInteger(input.rev) && input.rev >= 0 ? input.rev : undefined,
  }))
  .handler(async ({ data }) => {
    if (!data.genreId || (!data.ep && !data.act)) return { ok: false as const, url: "", error: "empty" };
    let clean = data.url.trim();
    if (data.field === "suno") {
      clean = clean.trim();
      if (!clean && data.url.trim()) return { ok: false as const, url: "", error: "url" };
    }
    const bodyKey = data.field === "mv" ? "mvUrl" : data.field === "suno" ? "sunoUrl" : "youtubeUrl";
    const metaKey = data.field === "mv" ? `${data.genreId}:mv:${data.ep}` : `${data.genreId}:${data.ep}`;
    let fileOk = false;
    let fault = "file";
    const store = await enc();
    try {
      fileOk = data.act && !data.ep
        ? store.putActLink(data.genreId, data.act, clean, bodyKey, data.rev) === true
        : store.putSongLink(data.genreId, data.ep, clean, bodyKey, data.rev) === true;
      if (!fileOk && data.field === "suno") fault = store.lastSunoFault || "file";
    } catch (err) {
      fileOk = false;
      fault = quietDiskFault(err instanceof Error ? err.message : "throw");
    }
    if (!fileOk) {
      fault = quietDiskFault(fault);
      const safe = /^(write|file|read|throw|request|path|empty|url|level|suno|live|conflict)$/i.test(fault) ? fault : "write";
      return { ok: false as const, url: "", error: safe };
    }
    const revPath = data.act && !data.ep
      ? store.shownFilePath("act", data.genreId, "", data.act, "")
      : store.shownFilePath("song", data.genreId, data.ep, 0, "");
    return { ok: true as const, url: clean, rev: store.readShownRev(revPath) };
  });

export const saveSongLinks = createServerFn({ method: "POST" })
  .validator((input: { rows?: { genreId: string; ep?: string; act?: number; url: string }[] }) => ({
    rows: (Array.isArray(input.rows) ? input.rows : []).slice(0, 400).map((row) => ({
      genreId: String(row.genreId || ""),
      ep: padEp(row.ep || ""),
      act: Number(row.act) || 0,
      url: String(row.url || "").trim(),
    })),
  }))
  .handler(async ({ data }) => {
    const store = await enc();
    const saved: string[] = [];
    for (const row of data.rows) {
      if (!row.genreId || !row.url || (!row.ep && !row.act)) continue;
      const ok = row.act && !row.ep
        ? store.putActLink(row.genreId, row.act, row.url) === true
        : store.putSongLink(row.genreId, row.ep, row.url) === true;
      if (ok) saved.push(row.act && !row.ep ? `${row.genreId}:pl:${row.act}` : `${row.genreId}:${row.ep}`);
    }
    return { ok: true as const, saved };
  });

export const saveAppMeta = createServerFn({ method: "POST" })
  .validator((input: EncMeta) => ({
    locks: input.locks ?? {},
    rowLocks: input.rowLocks ?? {},
    confirmed: input.confirmed ?? {},
    settingLocks: {
      common: input.settingLocks?.common ?? {},
      genre: input.settingLocks?.genre ?? {},
    },
    needRegen: Array.isArray(input.needRegen) ? input.needRegen : [],
    slots: input.slots ?? {},
    youtube: input.youtube ?? {},
    ui: input.ui ?? {},
    releaseSeen: typeof input.releaseSeen === "number" ? input.releaseSeen : 0,
    gatePassword: typeof input.gatePassword === "string" ? input.gatePassword : "",
    securityKey: "7999",
    fillAskAgain: input.fillAskAgain === true,
    gateOpen: typeof input.gateOpen === "boolean" ? input.gateOpen : undefined,
    listOrder: parseListOrder(input.listOrder),
  }))
  .handler(async ({ data }) => {
    let prev: EncMeta | undefined;
    try {
      prev = (await enc()).readStudioShell().meta;
    } catch {
      prev = undefined;
    }
    try {
      const sql = await db();
      const rows = await sql<{ body: unknown }>`select body from studio_pages where slot = ${META_SLOT} limit 1`;
      const raw = asObject(rows[0]?.body);
      if (raw) {
        const sqlMeta = asMeta(raw);
        const fileOrder = parseListOrder(prev?.listOrder);
        const sqlOrder = parseListOrder(sqlMeta.listOrder);
        prev = {
          ...(prev ?? sqlMeta),
          ...sqlMeta,
          locks: { ...(prev?.locks ?? {}), ...sqlMeta.locks },
          rowLocks: { ...(prev?.rowLocks ?? {}), ...(sqlMeta.rowLocks ?? {}) },
          confirmed: { ...(prev?.confirmed ?? {}), ...sqlMeta.confirmed },
          youtube: { ...(prev?.youtube ?? {}), ...(sqlMeta.youtube ?? {}) },
          settingLocks: {
            common: { ...(prev?.settingLocks?.common ?? {}), ...(sqlMeta.settingLocks?.common ?? {}) },
            genre: { ...(prev?.settingLocks?.genre ?? {}), ...(sqlMeta.settingLocks?.genre ?? {}) },
          },
          listOrder: { ...fileOrder, ...sqlOrder },
        };
      }
    } catch {
      /* file meta is enough */
    }
    const locks =
      Object.keys(data.locks).length > 0 ? { ...(prev?.locks ?? {}), ...data.locks } : (prev?.locks ?? {});
    const rowLocks =
      Object.keys(data.rowLocks ?? {}).length > 0
        ? { ...(prev?.rowLocks ?? {}), ...(data.rowLocks ?? {}) }
        : (prev?.rowLocks ?? {});
    const confirmed = {
      ...Object.fromEntries(Object.entries(prev?.confirmed ?? {}).filter((entry) => entry[1] === true)),
      ...Object.fromEntries(Object.entries(data.confirmed).filter((entry) => entry[1] === true)),
    };
    const merged = {
      ...data,
      locks,
      rowLocks,
      confirmed,
      youtube: { ...(prev?.youtube ?? {}), ...(data.youtube ?? {}) },
      gatePassword: data.gatePassword.trim() || prev?.gatePassword || "",
      gateOpen: typeof data.gateOpen === "boolean" ? data.gateOpen : prev?.gateOpen,
      listOrder: { ...parseListOrder(prev?.listOrder), ...parseListOrder(data.listOrder) },
    };
    try {
      (await enc()).putEncMeta(merged);
    } catch {
      /* read-only disk */
    }
    try {
      const sql = await db();
      const payload = JSON.stringify(merged);
      await sql`
        insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
        values (
          ${META_SLOT},
          ${"meta"},
          ${"__studio"},
          ${""},
          ${0},
          ${"app-meta"},
          ${payload}::jsonb,
          now()
        )
        on conflict (slot) do update set
          kind = excluded.kind,
          body = excluded.body,
          updated_at = now()
      `;
    } catch {
      /* the flag file or the previous row still holds it */
    }
    return { ok: true as const };
  });

export const dropStoredSong = createServerFn({ method: "POST" })
  .validator((input: { genreId: string; ep: string }) => {
    if (!isGenre(input.genreId)) throw new Error("invalid genre");
    const ep = padEp(input.ep);
    if (!ep) throw new Error("invalid ep");
    return { genreId: input.genreId, ep };
  })
  .handler(async ({ data }) => {
    const slot = resultSlot(data.genreId, data.ep, actFromEp(data.ep));
    const sql = await db();
    await sql`delete from studio_pages where slot = ${slot}`;
    try {
      (await enc()).deleteEncSong(data.genreId, data.ep);
    } catch {
      /* sql row is already gone */
    }
    return { ok: true as const };
  });

export const saveFillJob = createServerFn({ method: "POST" })
  .validator(
    (input: {
      genreId?: string;
      tasks?: { kind: "single" | "playlist"; n?: string; title?: string; act?: number; genreId?: string }[];
      acceptedAt?: number;
      total?: number;
      limitUntil?: number;
      paused?: boolean;
      status?: string;
      current?: string;
      lastError?: string;
      filled?: number;
      events?: { label: string; state: string; reason?: string }[];
      userPaused?: boolean;
      busyUntil?: number;
    } | null) => input,
  )
  .handler(async ({ data }) => {
    const sql = await db();
    const slot = "fill:queue";
    if (!data?.genreId || !data.tasks?.length) {
      await sql`delete from studio_pages where slot = ${slot}`;
      try {
        (await enc()).putEncFillJob(null);
      } catch {
        /* ignore */
      }
      return { ok: true as const };
    }
    const payload = JSON.stringify(data);
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"fill"},
        ${data.genreId},
        ${""},
        ${0},
        ${"fill-queue"},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        body = excluded.body,
        genre_id = excluded.genre_id,
        updated_at = now()
    `;
    try {
      (await enc()).putEncFillJob({
        genreId: data.genreId,
        tasks: data.tasks.map((task) => ({
          kind: task.kind,
          n: task.n,
          title: task.title,
          act: task.act,
          genreId: task.genreId,
        })),
        acceptedAt: data.acceptedAt ?? Date.now(),
        total: data.total ?? data.tasks.length,
        limitUntil: data.limitUntil,
        paused: data.paused,
        status: data.status,
        current: data.current,
        lastError: data.lastError,
        filled: data.filled,
        events: data.events,
        userPaused: data.userPaused,
        busyUntil: data.busyUntil,
      });
    } catch {
      /* sql already stored */
    }
    return { ok: true as const };
  });

export const loadFillJob = createServerFn({ method: "GET" }).handler(async () => {
  const asJob = (parsed: Record<string, unknown>) => {
    if (typeof parsed.genreId !== "string" || !Array.isArray(parsed.tasks)) return null;
    return {
      genreId: parsed.genreId,
      tasks: parsed.tasks as { kind: "single" | "playlist"; n?: string; title?: string; act?: number; genreId?: string }[],
      acceptedAt: typeof parsed.acceptedAt === "number" ? parsed.acceptedAt : 0,
      total: typeof parsed.total === "number" ? parsed.total : 0,
      limitUntil: typeof parsed.limitUntil === "number" ? parsed.limitUntil : 0,
      paused: Boolean(parsed.paused),
      status: typeof parsed.status === "string" ? parsed.status : "",
      current: typeof parsed.current === "string" ? parsed.current : "",
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : "",
      filled: typeof parsed.filled === "number" ? parsed.filled : 0,
      events: Array.isArray(parsed.events)
        ? (parsed.events as { label: string; state: string; reason?: string }[])
        : [],
      userPaused: Boolean(parsed.userPaused),
      busyUntil: typeof parsed.busyUntil === "number" ? parsed.busyUntil : 0,
    };
  };
  try {
    const sql = await db();
    const rows = await sql<PageRow>`
      select body from studio_pages where slot = ${"fill:queue"} limit 1
    `;
    const row = rows[0];
    if (row) {
      const parsed = asObject(row.body);
      const job = parsed ? asJob(parsed) : null;
      if (job?.tasks.length) {
        return job;
      }
    }
  } catch {
    /* file */
  }
  const file = (await enc()).readEncyclopedia().fillJob;
  if (!file?.genreId) return null;
  const job = asJob(file as unknown as Record<string, unknown>);
  return job;
});

export const startFillWorker = createServerFn({ method: "POST" })
  .validator((input?: { resume?: boolean } | null) => ({ resume: Boolean(input?.resume) }))
  .handler(async ({ data }) => {
    const { ensureFillWorker } = await import("./fill-worker.server");
    return ensureFillWorker(data.resume);
  });

export const pauseFillWorker = createServerFn({ method: "POST" }).handler(async () => {
  const { requestFillPause } = await import("./fill-worker.server");
  await requestFillPause();
  return { ok: true as const };
});
