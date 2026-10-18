import { enqueuePage, flushAppPagesNow, cancelQueuedPage, isSeedPackage, patchApp, patchQueuedBody, readAppDump, appDumpRev, replaceAppDump, saveMetaNow, type AppDump } from "./app-memory";
import { EPS, padEp, type GenreId } from "./catalog";
import { asThumbCast, type ThumbCast } from "./characters";
import { SEED_ORIGINALS } from "./originals-seed";
import { matchByEpisode, prefOutputLang, langScope, readPref, keptAdmin, type OutputShow } from "./user-prefs";
import { gateWasTouched, isAdminDevice, adminSealDenied } from "./gate";
import { parseListOrder } from "./encyclopedia-types";
import { readBrowserListOrder, writeBrowserListOrder } from "./list-order";
import { serverError, serverOk } from "./server-plain";
import { readFieldStamps, mergeLatestBody, stampChangedFields, touchFieldStamp } from "./latest-text";

export type StudioPackage = {
  summary: string;
  confirmedTitle: string;
  lyricsBlock: string;
  sunoStyle: string;
  geminiPrompt: string;
  youtubeTitle: string;
  youtubeDescription: string;
  fanLetter: string;
  thumbUrl: string;
  thumbCast: ThumbCast;
  youtubeUrl?: string;
  /** 사용자가 결과창에 직접 넣는 수노 음원 주소. 생성은 이 값을 만들지 않는다. */
  sunoUrl?: string;
  mvUrl?: string;
  /** 사용자가 유튜브 주소 옆에서 켠 고음질. 생성은 이 값을 만들지 않는다. */
  ytPremium?: boolean;
  /** 사용자가 MV 주소 옆에서 켠 고음질. */
  mvPremium?: boolean;
  /** 사용자가 재생으로 잰 보정값. 재지 않은 곡은 비운다. */
  audioLevel?: string;
  /** 보정 전에 잰 원음. lufs, peak, lift. 재지 않은 곡은 비운다. */
  audioAnalysis?: string;
  /** 사용자가 직접 고친 칸. 그록 생성은 이 칸을 덮지 않는다. */
  userEdited?: string[];
  /** 칸마다 그 글이 생긴 시각. 더 이른 글은 이 값을 덮지 못한다. */
  fieldSavedAt?: Record<string, string>;
};

export type PlaylistPackage = {
  summary: string;
  confirmedTitle: string;
  tracklist: string;
  sunoStyle: string;
  geminiPrompt: string;
  youtubeTitle: string;
  youtubeDescription: string;
  communityPost: string;
  thumbUrl: string;
  thumbCast: ThumbCast;
  youtubeUrl?: string;
  sunoUrl?: string;
  mvUrl?: string;
  ytPremium?: boolean;
  mvPremium?: boolean;
  /** 사용자가 재생으로 잰 보정값. 재지 않은 곡은 비운다. */
  audioLevel?: string;
  /** 보정 전에 잰 원음. lufs, peak, lift. 재지 않은 곡은 비운다. */
  audioAnalysis?: string;
  /** 사용자가 수록곡을 직접 저장하면 곡 제목 동기화가 덮지 않는다. */
  tracklistEdited?: boolean;
  /** 사용자가 설명란을 직접 저장하면 트랙리스트로 다시 조립하지 않는다. */
  descEdited?: boolean;
  /** 칸마다 그 글이 생긴 시각. 더 이른 글은 이 값을 덮지 못한다. */
  fieldSavedAt?: Record<string, string>;
};

export type StoryPackage = {
  geminiPrompt: string;
  youtubeTitle: string;
  youtubeDescription: string;
  fanLetter: string;
  sunoStyle: string;
  thumbUrl: string;
  thumbCast: ThumbCast;
  /** 사연·커버 곡 파일에 있는 확정 제목. 결과창 제목과 같다. */
  confirmedTitle?: string;
  /** 사연·커버 곡 파일에 있는 가사. 결과창 가사와 같다. */
  lyricsBlock?: string;
  sourceLyrics?: string;
  sourceVocal?: string;
  sourceGenre?: string;
  youtubeUrl?: string;
  sunoUrl?: string;
  mvUrl?: string;
  /** 사용자가 재생으로 잰 보정값. 재지 않은 곡은 비운다. */
  audioLevel?: string;
  /** 보정 전에 잰 원음. lufs, peak, lift. 재지 않은 곡은 비운다. */
  audioAnalysis?: string;
  ytPremium?: boolean;
  mvPremium?: boolean;
  /** 같은 제목이어도 곡을 나누는 저장 키. 결과 글이 아니다. */
  songId?: string;
  /** 칸마다 그 글이 생긴 시각. 더 이른 글은 이 값을 덮지 못한다. */
  fieldSavedAt?: Record<string, string>;
};

export function emptyStudio(): StudioPackage {
  return {
    summary: "",
    confirmedTitle: "",
    lyricsBlock: "",
    sunoStyle: "",
    geminiPrompt: "",
    youtubeTitle: "",
    youtubeDescription: "",
    fanLetter: "",
    thumbUrl: "",
    thumbCast: "female",
    youtubeUrl: "",
    sunoUrl: "",
    mvUrl: "",
  };
}

export function emptyPlaylist(): PlaylistPackage {
  return {
    summary: "",
    confirmedTitle: "",
    tracklist: "",
    sunoStyle: "",
    geminiPrompt: "",
    youtubeTitle: "",
    youtubeDescription: "",
    communityPost: "",
    thumbUrl: "",
    thumbCast: "female",
    youtubeUrl: "",
    sunoUrl: "",
    mvUrl: "",
  };
}

export function emptyStory(): StoryPackage {
  return {
    geminiPrompt: "",
    youtubeTitle: "",
    youtubeDescription: "",
    fanLetter: "",
    sunoStyle: "",
    thumbUrl: "",
    thumbCast: "female",
    youtubeUrl: "",
    sunoUrl: "",
    mvUrl: "",
  };
}

export type ResultKind = "single" | "playlist" | "story";

export function replaceExactTitle(text: string, from: string, to: string) {
  const prev = from.trim();
  const next = to.trim();
  if (!prev || !next || prev === next || !text.includes(prev)) return text;
  return text.split(prev).join(next);
}

const STUDIO_TITLE_COPIES = ["summary", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter"] as const;

export function renameStudioTitleCopies(pkg: StudioPackage, from: string, to: string): StudioPackage {
  let changed = false;
  const next = { ...pkg };
  for (const key of STUDIO_TITLE_COPIES) {
    const raw = String(next[key] ?? "");
    const swapped = replaceExactTitle(raw, from, to);
    if (swapped === raw) continue;
    next[key] = swapped;
    changed = true;
  }
  return changed ? next : pkg;
}

export function patchStudio(pkg: StudioPackage, id: string, text: string): StudioPackage | null {
  const key = (
    {
      summary: "summary",
      title: "confirmedTitle",
      lyrics: "lyricsBlock",
      suno: "sunoStyle",
      thumb: "geminiPrompt",
      "yt-title": "youtubeTitle",
      "yt-desc": "youtubeDescription",
      letter: "fanLetter",
    } as const
  )[id];
  if (!key) return null;
  return { ...pkg, [key]: text };
}

export function patchPlaylistPkg(pkg: PlaylistPackage, id: string, text: string): PlaylistPackage | null {
  const key = (
    {
      summary: "summary",
      title: "confirmedTitle",
      tracks: "tracklist",
      suno: "sunoStyle",
      thumb: "geminiPrompt",
      "yt-title": "youtubeTitle",
      "yt-desc": "youtubeDescription",
      community: "communityPost",
    } as const
  )[id];
  if (!key) return null;
  return { ...pkg, [key]: text };
}

export function patchStory(pkg: StoryPackage, id: string, text: string): StoryPackage | null {
  const key = (
    {
      thumb: "geminiPrompt",
      "yt-title": "youtubeTitle",
      "yt-desc": "youtubeDescription",
      letter: "fanLetter",
      suno: "sunoStyle",
    } as const
  )[id];
  if (!key) return null;
  return { ...pkg, [key]: text };
}

export function resultSlot(genreId: string, epN: string, actN: number) {
  const n = padEp(epN);
  return n ? `single:${genreId}:${n}` : `playlist:${genreId}:${actN}`;
}

export function epInSlot(slot: string) {
  const parts = slot.split(":");
  if (parts[0] !== "single" || parts.length < 3) return "";
  return padEp(parts[parts.length - 1] ?? "");
}

export function packageStatedEp(pkg: StudioPackage | null | undefined) {
  if (!pkg) return "";
  const read = (text: string) => {
    const found = [...text.matchAll(/EP\.(\d{1,3})(?!\d)/gi)].map((hit) => padEp(hit[1] || ""));
    const unique = [...new Set(found.filter(Boolean))];
    return unique.length === 1 ? unique[0] : "";
  };
  for (const text of [pkg.youtubeTitle, pkg.summary, pkg.geminiPrompt, pkg.youtubeDescription]) {
    const ep = read(text || "");
    if (ep) return ep;
  }
  return "";
}

function readNeedRegen(): string[] {
  return readAppDump().meta.needRegen ?? [];
}

export function markNeedRegen(slot: string) {
  patchApp((d) => {
    d.meta.needRegen = Array.from(new Set([...(d.meta.needRegen ?? []), slot]));
  });
}

export function takeNeedRegen(slot: string) {
  const list = readNeedRegen();
  if (!list.includes(slot)) return false;
  patchApp((d) => {
    d.meta.needRegen = (d.meta.needRegen ?? []).filter((x) => x !== slot);
  });
  return true;
}

export function cacheKey(epN: string, genreId: string): string {
  return `ep-series-studio:pkg:${padEp(epN) || epN}:${genreId}`;
}

export function playlistCacheKey(act: number, genreId: string): string {
  return `ep-series-studio:pl:${act}:${genreId}`;
}

export function lockStoreKey(kind: ResultKind, id: string, genreId: string): string {
  return `${kind}:${id}:${genreId}`;
}

export function readLockMap(): Record<string, Record<string, boolean>> {
  return readAppDump().meta.locks ?? {};
}

export function readLocks(kind: ResultKind, id: string, genreId: string): Record<string, boolean> {
  return readLockMap()[lockStoreKey(kind, id, genreId)] ?? {};
}

export function readRowLocked(genreId: string, ep: string) {
  const n = padEp(ep);
  if (!n) return false;
  return readAppDump().meta.rowLocks?.[`${genreId}:${n}`] === true;
}

export function userUnlockedRow(genreId: string, ep: string) {
  const n = padEp(ep);
  if (!n) return false;
  return readAppDump().meta.rowLocks?.[`${genreId}:${n}`] === false;
}

export function writeRowLock(genreId: string, ep: string, on: boolean) {
  const n = padEp(ep);
  if (!n) return;
  patchApp((d) => {
    const next = { ...(d.meta.rowLocks ?? {}) };
    next[`${genreId}:${n}`] = on;
    d.meta.rowLocks = next;
  }, false);
  void import("./pages").then((api) =>
    api.saveSongState({ data: { genreId, ep: n, rowLocked: on } }),
  );
}

export function writeLocks(
  kind: ResultKind,
  id: string,
  genreId: string,
  locks: Record<string, boolean>,
) {
  patchApp((d) => {
    d.meta.locks = { ...(d.meta.locks ?? {}), [lockStoreKey(kind, id, genreId)]: locks };
  }, false);
  if (kind === "single") {
    const n = padEp(id);
    if (n) {
      void import("./pages").then((api) =>
        api.saveSongState({ data: { genreId, ep: n, locks } }),
      );
    }
  }
  saveMetaNow();
}

export function isLocked(locks: Record<string, boolean>, blockId: string): boolean {
  return locks[blockId] === true;
}

export const STUDIO_BLOCKS: { id: string; key: keyof StudioPackage }[] = [
  { id: "summary", key: "summary" },
  { id: "title", key: "confirmedTitle" },
  { id: "lyrics", key: "lyricsBlock" },
  { id: "suno", key: "sunoStyle" },
  { id: "thumb", key: "geminiPrompt" },
  { id: "yt-title", key: "youtubeTitle" },
  { id: "yt-desc", key: "youtubeDescription" },
  { id: "letter", key: "fanLetter" },
];

export const PLAYLIST_BLOCKS: { id: string; key: keyof PlaylistPackage }[] = [
  { id: "summary", key: "summary" },
  { id: "title", key: "confirmedTitle" },
  { id: "tracks", key: "tracklist" },
  { id: "suno", key: "sunoStyle" },
  { id: "thumb", key: "geminiPrompt" },
  { id: "yt-title", key: "youtubeTitle" },
  { id: "yt-desc", key: "youtubeDescription" },
  { id: "community", key: "communityPost" },
];

export const STORY_BLOCKS: { id: string; key: keyof StoryPackage }[] = [
  { id: "thumb", key: "geminiPrompt" },
  { id: "yt-title", key: "youtubeTitle" },
  { id: "yt-desc", key: "youtubeDescription" },
  { id: "letter", key: "fanLetter" },
  { id: "suno", key: "sunoStyle" },
];

function fieldText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isUserFrozen(locks: Record<string, boolean>, blockId: string, _text?: string) {
  return locks[blockId] === true;
}

export function unlockEmptyLocks<T extends object>(
  locks: Record<string, boolean>,
  _pkg: T,
  _blocks: { id: string; key: keyof T }[],
): Record<string, boolean> {
  return { ...locks };
}

export function takeLockedStudio(
  cur: StudioPackage,
  incoming: StudioPackage,
  locks: Record<string, boolean>,
): StudioPackage {
  const out = { ...incoming };
  for (const block of STUDIO_BLOCKS) {
    if (locks[block.id] === true) {
      (out[block.key] as string) = String(cur[block.key] ?? "");
    }
  }
  if (locks.thumb === true) out.thumbUrl = cur.thumbUrl;
  return out;
}

export function takeLockedPlaylist(
  cur: PlaylistPackage,
  incoming: PlaylistPackage,
  locks: Record<string, boolean>,
): PlaylistPackage {
  const out = { ...incoming };
  for (const block of PLAYLIST_BLOCKS) {
    if (locks[block.id] === true) {
      (out[block.key] as string) = String(cur[block.key] ?? "");
    }
  }
  if (locks.thumb === true) out.thumbUrl = cur.thumbUrl;
  return out;
}

export function takeLockedStory(
  cur: StoryPackage,
  incoming: StoryPackage,
  locks: Record<string, boolean>,
): StoryPackage {
  const out = { ...incoming };
  for (const block of STORY_BLOCKS) {
    if (locks[block.id] === true) {
      (out[block.key] as string) = String(cur[block.key] ?? "");
    }
  }
  if (locks.thumb === true) out.thumbUrl = cur.thumbUrl;
  return out;
}

function stripLeadingTitle(lyrics: string, title: string): string {
  const lines = lyrics.replace(/^\uFEFF/, "").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  if (i >= lines.length) return lyrics.trim();
  const first = lines[i].trim();
  if (first.startsWith("[")) return lyrics.trim();
  const compact = (s: string) => s.replace(/\s+/g, "");
  if (compact(first) === compact(title) || first === title) {
    return lines.slice(i + 1).join("\n").trim();
  }
  return lyrics.trim();
}

function hasText(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function hasPageBody(pkg: StudioPackage | null | undefined) {
  if (!pkg) return false;
  return (
    hasText(pkg.confirmedTitle) ||
    hasText(pkg.lyricsBlock) ||
    hasText(pkg.geminiPrompt) ||
    hasText(pkg.youtubeTitle) ||
    hasText(pkg.youtubeDescription) ||
    hasText(pkg.sunoStyle) ||
    hasText(pkg.fanLetter) ||
    hasText(pkg.summary)
  );
}

export function hasPlaylistBody(pkg: PlaylistPackage | null | undefined) {
  if (!pkg) return false;
  return (
    hasText(pkg.summary) ||
    hasText(pkg.tracklist) ||
    hasText(pkg.geminiPrompt) ||
    hasText(pkg.youtubeTitle) ||
    hasText(pkg.youtubeDescription) ||
    hasText(pkg.sunoStyle) ||
    hasText(pkg.communityPost)
  );
}

function pickText(a: string, b: string, preferB: boolean) {
  if (hasText(a) && hasText(b)) return preferB ? b : a;
  return hasText(a) ? a : b;
}

/** 결과창이 따로 들고 있는 이전 글. 곡 파일에 글이 있으면 그 글만 최신이다. 주소는 입력 중이므로 여기서 되돌리지 않는다. */
export const SAVED_PANE_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist"] as const;

const DRAFT_PANE_KEY: Record<string, (typeof SAVED_PANE_KEYS)[number]> = {
  summary: "summary",
  title: "confirmedTitle",
  lyrics: "lyricsBlock",
  tracks: "tracklist",
  suno: "sunoStyle",
  thumb: "geminiPrompt",
  "yt-title": "youtubeTitle",
  "yt-desc": "youtubeDescription",
  letter: "fanLetter",
  community: "communityPost",
};

const STUB_RESULT = new Set(["p", "설명란", "편지", "가사", "한줄", "썸네일", "커뮤니티", "요약", "제목", "수노"]);

export function isStubResultToken(value: string) {
  return STUB_RESULT.has(String(value || "").trim());
}

export function adoptSavedFileText<T extends Record<string, unknown>>(
  shown: T,
  file: Partial<T> | null | undefined,
  draftIds?: Iterable<string>,
): T {
  if (!file) return shown;
  const held = new Set<string>();
  if (draftIds) {
    for (const id of draftIds) {
      const key = DRAFT_PANE_KEY[id];
      if (key) held.add(key);
    }
  }
  let next: Record<string, unknown> | null = null;
  const shownStamps = readFieldStamps(shown);
  const fileStamps = readFieldStamps(file);
  for (const key of SAVED_PANE_KEYS) {
    if (held.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(file, key)) continue;
    if (String(shown[key] ?? "") === String(file[key] ?? "")) continue;
    if (!next) next = { ...shown, fieldSavedAt: { ...shownStamps } };
    next[key] = file[key];
    if (fileStamps[key]) {
      const stamps = { ...(readFieldStamps(next)) };
      stamps[key] = fileStamps[key];
      next.fieldSavedAt = stamps;
    }
  }
  return (next as T | null) ?? shown;
}

function editedFlag(xOn: boolean | undefined, yOn: boolean | undefined, xText: string, yText: string, preferB: boolean) {
  const fromB = hasText(xText) && hasText(yText) ? preferB : hasText(yText) && !hasText(xText);
  return fromB ? yOn === true : xOn === true;
}

function tracklistEditedFrom(x: PlaylistPackage, y: PlaylistPackage, preferB: boolean) {
  return editedFlag(x.tracklistEdited, y.tracklistEdited, x.tracklist, y.tracklist, preferB);
}

export function mergeFilledPlaylist(
  a: PlaylistPackage | null | undefined,
  b: PlaylistPackage | null | undefined,
  preferB = false,
): PlaylistPackage {
  const x = a ?? emptyPlaylist();
  const y = b ?? emptyPlaylist();
  return normalizePlaylist({
    summary: pickText(x.summary, y.summary, preferB),
    confirmedTitle: pickText(x.confirmedTitle, y.confirmedTitle, preferB),
    tracklist: pickText(x.tracklist, y.tracklist, preferB),
    sunoStyle: pickText(x.sunoStyle, y.sunoStyle, preferB),
    geminiPrompt: pickText(x.geminiPrompt, y.geminiPrompt, preferB),
    youtubeTitle: pickText(x.youtubeTitle, y.youtubeTitle, preferB),
    youtubeDescription: pickText(x.youtubeDescription, y.youtubeDescription, preferB),
    communityPost: pickText(x.communityPost, y.communityPost, preferB),
    thumbUrl: pickText(x.thumbUrl ?? "", y.thumbUrl ?? "", preferB),
    thumbCast: preferB ? y.thumbCast || x.thumbCast : x.thumbCast || y.thumbCast,
    youtubeUrl: pickText(x.youtubeUrl ?? "", y.youtubeUrl ?? "", preferB),
    sunoUrl: pickText(x.sunoUrl ?? "", y.sunoUrl ?? "", preferB),
    mvUrl: pickText(x.mvUrl ?? "", y.mvUrl ?? "", preferB),
    ytPremium: preferB ? (y.ytPremium ?? x.ytPremium) : (x.ytPremium ?? y.ytPremium),
    mvPremium: preferB ? (y.mvPremium ?? x.mvPremium) : (x.mvPremium ?? y.mvPremium),
    tracklistEdited: tracklistEditedFrom(x, y, preferB),
    descEdited: editedFlag(x.descEdited, y.descEdited, x.youtubeDescription, y.youtubeDescription, preferB),
  });
}

export function mergeFilledStudio(
  a: StudioPackage | null | undefined,
  b: StudioPackage | null | undefined,
  preferB = false,
): StudioPackage {
  const x = a ?? emptyStudio();
  const y = b ?? emptyStudio();
  const xBody = hasPageBody(x);
  const yBody = hasPageBody(y);
  if (yBody && !xBody) return normalizePackage(y);
  if (xBody && !yBody) return normalizePackage(x);
  return normalizePackage({
    summary: pickText(x.summary, y.summary, preferB),
    confirmedTitle: pickText(x.confirmedTitle, y.confirmedTitle, preferB),
    lyricsBlock: pickText(x.lyricsBlock, y.lyricsBlock, preferB),
    sunoStyle: pickText(x.sunoStyle, y.sunoStyle, preferB),
    geminiPrompt: pickText(x.geminiPrompt, y.geminiPrompt, preferB),
    youtubeTitle: pickText(x.youtubeTitle, y.youtubeTitle, preferB),
    youtubeDescription: pickText(x.youtubeDescription, y.youtubeDescription, preferB),
    fanLetter: pickText(x.fanLetter, y.fanLetter, preferB),
    thumbUrl: pickText(x.thumbUrl ?? "", y.thumbUrl ?? "", preferB),
    thumbCast: preferB ? y.thumbCast || x.thumbCast : x.thumbCast || y.thumbCast,
    youtubeUrl: pickText(x.youtubeUrl ?? "", y.youtubeUrl ?? "", preferB),
    sunoUrl: pickText(x.sunoUrl ?? "", y.sunoUrl ?? "", preferB),
    mvUrl: pickText(x.mvUrl ?? "", y.mvUrl ?? "", preferB),
    ytPremium: preferB ? (y.ytPremium ?? x.ytPremium) : (x.ytPremium ?? y.ytPremium),
    mvPremium: preferB ? (y.mvPremium ?? x.mvPremium) : (x.mvPremium ?? y.mvPremium),
  });
}

export function missingStudioLabels(
  pkg: StudioPackage | null | undefined,
  opts: { suno: boolean; letter: boolean; source?: boolean; lyrics?: boolean; output?: OutputShow },
) {
  if (!pkg) return ["결과"];
  const missing: string[] = [];
  if (opts.output) {
    if (opts.output.title && !hasText(pkg.confirmedTitle)) missing.push("확정 제목");
    if (opts.output.lyrics && !hasText(pkg.lyricsBlock)) missing.push("가사");
    if (opts.output.suno && !hasText(pkg.sunoStyle)) missing.push("수노");
    if (opts.output.thumb && !hasText(pkg.geminiPrompt)) missing.push("썸네일");
    if (opts.output.ytTitle && !hasText(pkg.youtubeTitle)) missing.push("유튜브 제목");
    if (opts.output.ytDesc && !hasText(pkg.youtubeDescription)) missing.push("영상 설명란");
    if (opts.output.letter && !hasText(pkg.fanLetter)) missing.push("커뮤니티 글");
    return missing;
  }
  const wantLyrics = opts.lyrics ?? opts.source !== false;
  if (opts.source !== false && !hasText(pkg.confirmedTitle)) missing.push("확정 제목");
  if (wantLyrics && !hasText(pkg.lyricsBlock)) missing.push("가사");
  if (!hasText(pkg.geminiPrompt)) missing.push("썸네일");
  if (!hasText(pkg.youtubeTitle)) missing.push("유튜브 제목");
  if (!hasText(pkg.youtubeDescription)) missing.push("영상 설명란");
  if (opts.suno && !hasText(pkg.sunoStyle)) missing.push("수노");
  if (opts.letter && !hasText(pkg.fanLetter)) missing.push("커뮤니티 글");
  return missing;
}

export function isStudioComplete(
  pkg: StudioPackage | null | undefined,
  opts: { suno: boolean; letter: boolean; source?: boolean; lyrics?: boolean; output?: OutputShow },
) {
  return missingStudioLabels(pkg, opts).length === 0;
}

export function missingPlaylistLabels(
  pkg: PlaylistPackage | null | undefined,
  opts: { community: boolean; output?: OutputShow },
) {
  if (!pkg) return ["결과"];
  const off = (key: keyof OutputShow) => opts.output?.[key] === false;
  const missing: string[] = [];
  if (!off("title") && !hasText(pkg.confirmedTitle)) missing.push("확정 제목");
  if (!off("lyrics") && !hasText(pkg.tracklist)) missing.push("수록곡");
  if (!off("suno") && !hasText(pkg.sunoStyle)) missing.push("수노");
  if (!off("thumb") && !hasText(pkg.geminiPrompt)) missing.push("썸네일");
  if (!off("ytTitle") && !hasText(pkg.youtubeTitle)) missing.push("유튜브 제목");
  if (!off("ytDesc") && !hasText(pkg.youtubeDescription)) missing.push("영상 설명란");
  if (opts.community && !off("letter") && !hasText(pkg.communityPost)) missing.push("커뮤니티 글");
  return missing;
}

export function isPlaylistComplete(
  pkg: PlaylistPackage | null | undefined,
  opts: { community: boolean; output?: OutputShow },
) {
  return missingPlaylistLabels(pkg, opts).length === 0;
}

export function isStoryComplete(
  pkg: StoryPackage | null | undefined,
  opts: { letter: boolean },
) {
  if (!pkg) return false;
  if (
    !hasText(pkg.geminiPrompt) ||
    !hasText(pkg.youtubeTitle) ||
    !hasText(pkg.youtubeDescription) ||
    !hasText(pkg.sunoStyle)
  ) {
    return false;
  }
  if (opts.letter && !hasText(pkg.fanLetter)) return false;
  return true;
}

export function mergeStudio(cur: StudioPackage, gen: StudioPackage): StudioPackage {
  return normalizePackage({
    summary: hasText(cur.summary) ? cur.summary : gen.summary,
    confirmedTitle: hasText(cur.confirmedTitle) ? cur.confirmedTitle : gen.confirmedTitle,
    lyricsBlock: hasText(cur.lyricsBlock) ? cur.lyricsBlock : gen.lyricsBlock,
    sunoStyle: hasText(cur.sunoStyle) ? cur.sunoStyle : gen.sunoStyle,
    geminiPrompt: hasText(cur.geminiPrompt) ? cur.geminiPrompt : gen.geminiPrompt,
    youtubeTitle: hasText(cur.youtubeTitle) ? cur.youtubeTitle : gen.youtubeTitle,
    youtubeDescription: hasText(cur.youtubeDescription) ? cur.youtubeDescription : gen.youtubeDescription,
    fanLetter: hasText(cur.fanLetter) ? cur.fanLetter : gen.fanLetter,
    thumbUrl: hasText(cur.thumbUrl) ? cur.thumbUrl : gen.thumbUrl,
    thumbCast: cur.thumbCast || gen.thumbCast,
    youtubeUrl: hasText(cur.youtubeUrl ?? "") ? (cur.youtubeUrl ?? "") : (gen.youtubeUrl ?? ""),
    sunoUrl: hasText(cur.sunoUrl ?? "") ? (cur.sunoUrl ?? "") : (gen.sunoUrl ?? ""),
    mvUrl: hasText(cur.mvUrl ?? "") ? (cur.mvUrl ?? "") : (gen.mvUrl ?? ""),
    ytPremium: cur.ytPremium ?? gen.ytPremium,
    mvPremium: cur.mvPremium ?? gen.mvPremium,
  });
}

export function mergePlaylist(cur: PlaylistPackage, gen: PlaylistPackage): PlaylistPackage {
  return normalizePlaylist({
    summary: hasText(cur.summary) ? cur.summary : gen.summary,
    confirmedTitle: hasText(cur.confirmedTitle) ? cur.confirmedTitle : gen.confirmedTitle,
    tracklist: hasText(cur.tracklist) ? cur.tracklist : gen.tracklist,
    sunoStyle: hasText(cur.sunoStyle) ? cur.sunoStyle : gen.sunoStyle,
    geminiPrompt: hasText(cur.geminiPrompt) ? cur.geminiPrompt : gen.geminiPrompt,
    youtubeTitle: hasText(cur.youtubeTitle) ? cur.youtubeTitle : gen.youtubeTitle,
    youtubeDescription: hasText(cur.youtubeDescription) ? cur.youtubeDescription : gen.youtubeDescription,
    communityPost: hasText(cur.communityPost) ? cur.communityPost : gen.communityPost,
    thumbUrl: hasText(cur.thumbUrl) ? cur.thumbUrl : gen.thumbUrl,
    thumbCast: cur.thumbCast || gen.thumbCast,
    youtubeUrl: hasText(cur.youtubeUrl ?? "") ? (cur.youtubeUrl ?? "") : (gen.youtubeUrl ?? ""),
    sunoUrl: hasText(cur.sunoUrl ?? "") ? (cur.sunoUrl ?? "") : (gen.sunoUrl ?? ""),
    mvUrl: hasText(cur.mvUrl ?? "") ? (cur.mvUrl ?? "") : (gen.mvUrl ?? ""),
    ytPremium: cur.ytPremium ?? gen.ytPremium,
    mvPremium: cur.mvPremium ?? gen.mvPremium,
    tracklistEdited: hasText(cur.tracklist) ? cur.tracklistEdited === true : false,
    descEdited: hasText(cur.youtubeDescription) ? cur.descEdited === true : false,
  });
}

export function mergeStory(cur: StoryPackage, gen: StoryPackage): StoryPackage {
  return normalizeStory({
    geminiPrompt: hasText(cur.geminiPrompt) ? cur.geminiPrompt : gen.geminiPrompt,
    youtubeTitle: hasText(cur.youtubeTitle) ? cur.youtubeTitle : gen.youtubeTitle,
    youtubeDescription: hasText(cur.youtubeDescription) ? cur.youtubeDescription : gen.youtubeDescription,
    fanLetter: hasText(cur.fanLetter) ? cur.fanLetter : gen.fanLetter,
    sunoStyle: hasText(cur.sunoStyle) ? cur.sunoStyle : gen.sunoStyle,
    thumbUrl: hasText(cur.thumbUrl) ? cur.thumbUrl : gen.thumbUrl,
    thumbCast: cur.thumbCast || gen.thumbCast,
    sourceLyrics: cur.sourceLyrics || gen.sourceLyrics || "",
    sourceVocal: cur.sourceVocal || gen.sourceVocal || "",
    sourceGenre: cur.sourceGenre || gen.sourceGenre || "",
    confirmedTitle: cur.confirmedTitle || gen.confirmedTitle || "",
    lyricsBlock: cur.lyricsBlock || gen.lyricsBlock || "",
    youtubeUrl: hasText(cur.youtubeUrl ?? "") ? (cur.youtubeUrl ?? "") : (gen.youtubeUrl ?? ""),
    sunoUrl: hasText(cur.sunoUrl ?? "") ? (cur.sunoUrl ?? "") : (gen.sunoUrl ?? ""),
    mvUrl: hasText(cur.mvUrl ?? "") ? (cur.mvUrl ?? "") : (gen.mvUrl ?? ""),
    ytPremium: cur.ytPremium ?? gen.ytPremium,
    mvPremium: cur.mvPremium ?? gen.mvPremium,
    songId: cur.songId || gen.songId || "",
  });
}

/** 새로 온 값이 비어 있으면 이미 저장된 글을 남긴다. 칸 이름만 있는 짧은 값은 긴 본문을 지우지 않는다. */
function filledStoryText(next: string | undefined, prev: string | undefined) {
  const incoming = (next ?? "").trim();
  const kept = (prev ?? "").trim();
  if (!incoming) return prev ?? "";
  if (kept && kept !== incoming && STUB_RESULT.has(incoming) && kept.length > incoming.length) return prev ?? "";
  return next ?? "";
}

/** 칸 이름만 있는 시험 값. 결과 글이 있는 사연은 시험 아이디여도 시험 곡이 아니다. */
export function isStoryFixture(
  key: string,
  pkg?: { songId?: string; geminiPrompt?: string; youtubeDescription?: string; fanLetter?: string; youtubeTitle?: string; summary?: string } | null,
) {
  const prompt = String(pkg?.geminiPrompt || "").trim();
  const desc = String(pkg?.youtubeDescription || "").trim();
  const letter = String(pkg?.fanLetter || "").trim();
  const title = String(pkg?.youtubeTitle || "").trim();
  const summary = String(pkg?.summary || "").trim();
  const real = [prompt, desc, letter, title, summary].some((text) => text.length > 8 && !STUB_RESULT.has(text));
  if (real) return false;
  const id = `${key || ""} ${pkg?.songId || ""}`;
  if (id.includes("s_test_")) return true;
  if (prompt === "p" && desc === "설명란" && letter === "편지") return true;
  if (title === "내 맘이 지나면 | 테스트" && summary === "한줄" && !prompt && !desc && !letter) return true;
  return false;
}

/** 새로 온 값이 비어 있으면 이미 저장된 글을 남긴다. 저장 버튼이 비운 수노 주소와 보정값은 그대로 비운다. */
export function keepStoryText(prev: Partial<StoryPackage> | null | undefined, next: Partial<StoryPackage>): StoryPackage {
  const older = prev ?? {};
  const exact = next as Partial<StoryPackage> & { sunoExact?: boolean; levelExact?: boolean; analysisExact?: boolean };
  const blanks = new Set<string>();
  if (exact.sunoExact === true) blanks.add("sunoUrl");
  if (exact.levelExact === true) blanks.add("audioLevel");
  if (exact.analysisExact === true) blanks.add("audioAnalysis");
  const merged = mergeLatestBody(
    older as Record<string, unknown>,
    { ...(next as Record<string, unknown>) },
    blanks,
  ) as Partial<StoryPackage> & { sunoExact?: boolean; levelExact?: boolean; analysisExact?: boolean };
  const sunoExact = exact.sunoExact === true;
  const levelExact = exact.levelExact === true;
  const analysisExact = exact.analysisExact === true;
  return normalizeStory({
    geminiPrompt: String(merged.geminiPrompt ?? ""),
    youtubeTitle: String(merged.youtubeTitle ?? ""),
    youtubeDescription: String(merged.youtubeDescription ?? ""),
    fanLetter: String(merged.fanLetter ?? ""),
    sunoStyle: String(merged.sunoStyle ?? ""),
    thumbUrl: String(merged.thumbUrl ?? ""),
    thumbCast: merged.thumbCast || older.thumbCast || "female",
    sourceLyrics: String(merged.sourceLyrics ?? ""),
    sourceVocal: String(merged.sourceVocal ?? ""),
    sourceGenre: String(merged.sourceGenre ?? ""),
    confirmedTitle: String(merged.confirmedTitle ?? ""),
    lyricsBlock: String(merged.lyricsBlock ?? ""),
    youtubeUrl: String(merged.youtubeUrl ?? ""),
    sunoUrl: sunoExact ? String(next.sunoUrl || "") : String(merged.sunoUrl ?? ""),
    mvUrl: String(merged.mvUrl ?? ""),
    audioLevel: levelExact ? cleanAudioLevel(next.audioLevel) : cleanAudioLevel(merged.audioLevel),
    audioAnalysis: analysisExact ? cleanAudioAnalysis(next.audioAnalysis) : cleanAudioAnalysis(merged.audioAnalysis),
    ytPremium: merged.ytPremium ?? older.ytPremium,
    mvPremium: merged.mvPremium ?? older.mvPremium,
    songId: (merged.songId || older.songId || "").trim(),
    fieldSavedAt: readFieldStamps(merged),
  });
}

function foldTitle(text: string) {
  return text
    .toLowerCase()
    .replace(/ep\.?\s*\d+/gi, "")
    .replace(/[^0-9a-z가-힣\u3040-\u30ff\u4e00-\u9faf\u0e00-\u0e7f]/g, "");
}

/** 제목과 감성 한줄이 같은 말인지. 조금 늘리거나 줄인 것도 같다. */
export function sameTitleText(a: string, b: string) {
  const x = foldTitle(a);
  const y = foldTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  if (short.length >= 4 && long.includes(short)) return true;
  const words = a
    .split(/[\s|,./·]+/)
    .map((w) => foldTitle(w))
    .filter((w) => w.length > 1);
  if (words.length < 2) return false;
  const hit = words.filter((w) => y.includes(w)).length;
  return hit / words.length >= 0.6;
}

/** 감성 한줄이 제목을 거의 그대로 베낀 경우만. 긴 문장 속의 짧은 겹침은 다른 문장이다. */
export function closeTitleText(a: string, b: string) {
  const x = foldTitle(a);
  const y = foldTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  return short.length >= 4 && long.includes(short) && long.length - short.length <= 4;
}

function dropTitleJunk(seg: string) {
  return /고정|원제 유지|번역.?금지|개명 금지|제목 형식|형식 토큰|100자|그대로 쓴다|작업 메모/.test(seg);
}

export function tidyYoutubeTitle(raw: string) {
  const seen = new Set<string>();
  const segs: string[] = [];
  for (const part of raw.split(/\s*\|\s*/)) {
    const seg = part.replace(/\s{2,}/g, " ").replace(/^[\/,\s]+|[\/,\s]+$/g, "").trim();
    if (!seg || dropTitleJunk(seg)) continue;
    const key = seg.toLowerCase();
    if (seen.has(key)) continue;
    if (segs.some((s) => sameTitleText(s, seg))) continue;
    seen.add(key);
    segs.push(seg);
  }
  return segs.join(" | ").slice(0, 100);
}

function cleanAudioLevel(value: unknown) {
  const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;gain=-?\d+(?:\.\d+)?;peak=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

function cleanAudioAnalysis(value: unknown) {
  const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;peak=-?\d+(?:\.\d+)?;lift=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

export function normalizePackage(pkg: StudioPackage): StudioPackage {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const lyrics = stripLeadingTitle(text(pkg.lyricsBlock), text(pkg.confirmedTitle));
  let suno = text(pkg.sunoStyle).trim();
  let yt = tidyYoutubeTitle(text(pkg.youtubeTitle).trim());
  if (yt.length > 100) yt = yt.slice(0, 100);
  return {
    summary: text(pkg.summary).trim(),
    confirmedTitle: text(pkg.confirmedTitle).trim(),
    lyricsBlock: lyrics,
    sunoStyle: suno,
    geminiPrompt: text(pkg.geminiPrompt).trim(),
    youtubeTitle: yt,
    youtubeDescription: text(pkg.youtubeDescription).trim(),
    fanLetter: text(pkg.fanLetter).trim(),
    thumbUrl: text(pkg.thumbUrl).trim(),
    thumbCast: asThumbCast(pkg.thumbCast),
    youtubeUrl: text(pkg.youtubeUrl).trim(),
    sunoUrl: text(pkg.sunoUrl).trim(),
    mvUrl: text(pkg.mvUrl).trim(),
    audioLevel: cleanAudioLevel(pkg.audioLevel),
    audioAnalysis: cleanAudioAnalysis(pkg.audioAnalysis),
    ...(pkg.ytPremium === true || pkg.ytPremium === false ? { ytPremium: pkg.ytPremium === true } : {}),
    ...(pkg.mvPremium === true || pkg.mvPremium === false ? { mvPremium: pkg.mvPremium === true } : {}),
    userEdited: cleanEdited(pkg.userEdited),
    ...(Object.keys(readFieldStamps(pkg)).length ? { fieldSavedAt: readFieldStamps(pkg) } : {}),
  };
}

function storedBreaks(text: string) {
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
}

export function normalizePlaylist(pkg: PlaylistPackage): PlaylistPackage {
  let yt = tidyYoutubeTitle(pkg.youtubeTitle.trim());
  if (yt.length > 100) yt = yt.slice(0, 100);
  let suno = String(pkg.sunoStyle ?? "").trim();
  return {
    summary: pkg.summary.trim(),
    confirmedTitle: String(pkg.confirmedTitle ?? "").trim(),
    tracklist: storedBreaks(pkg.tracklist).trim(),
    sunoStyle: suno,
    geminiPrompt: pkg.geminiPrompt.trim(),
    youtubeTitle: yt,
    youtubeDescription: storedBreaks(pkg.youtubeDescription).trim(),
    communityPost: pkg.communityPost.trim(),
    thumbUrl: pkg.thumbUrl?.trim() ?? "",
    thumbCast: asThumbCast(pkg.thumbCast),
    youtubeUrl: pkg.youtubeUrl?.trim() ?? "",
    sunoUrl: pkg.sunoUrl?.trim() ?? "",
    mvUrl: pkg.mvUrl?.trim() ?? "",
    audioLevel: cleanAudioLevel(pkg.audioLevel),
    audioAnalysis: cleanAudioAnalysis(pkg.audioAnalysis),
    ...(pkg.ytPremium === true || pkg.ytPremium === false ? { ytPremium: pkg.ytPremium === true } : {}),
    ...(pkg.mvPremium === true || pkg.mvPremium === false ? { mvPremium: pkg.mvPremium === true } : {}),
    tracklistEdited: pkg.tracklistEdited === true,
    descEdited: pkg.descEdited === true,
    ...(Object.keys(readFieldStamps(pkg)).length ? { fieldSavedAt: readFieldStamps(pkg) } : {}),
  };
}

type StoredPage<T> = { v: 1; updatedAt: number; pkg: T };

function unwrapStored<T>(raw: string, isPkg: (value: unknown) => T | null): { pkg: T; updatedAt: number } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && (parsed as StoredPage<T>).v === 1) {
      const stored = parsed as StoredPage<T>;
      const pkg = isPkg(stored.pkg);
      if (!pkg) return null;
      return { pkg, updatedAt: Number(stored.updatedAt) || 0 };
    }
    const pkg = isPkg(parsed);
    if (!pkg) return null;
    return { pkg, updatedAt: 0 };
  } catch {
    return null;
  }
}

export function studioScore(pkg: StudioPackage | null | undefined) {
  if (!pkg) return 0;
  const summary = pkg.summary.trim();
  const lyrics = pkg.lyricsBlock.trim();
  const sung = lyrics.replace(/\[[^\]]*]/g, " ").replace(/\s+/g, " ").trim();
  const lines = summary.split(/\n+/).map((s) => s.trim()).filter(Boolean).length;
  const sentences = summary.split(/[.。!?!\n]/).map((s) => s.trim()).filter((s) => s.length > 8).length;
  const sections = lyrics.match(/^\s*\[[^\]]+\]/gm)?.length ?? 0;
  let score = 0;
  if (sentences >= 3 && summary.length >= 80 && lines >= 2) score += 800;
  else if (summary.length >= 40 && !/의 장면/.test(summary)) score += 80;
  if (/의 장면/.test(summary)) score -= 500;
  if (sections >= 3 && sung.length >= 120) score += 500;
  else if (sung.length >= 80) score += 120;
  if (sung.length < 40) score -= 200;
  if (pkg.geminiPrompt.trim().length > 80) score += 60;
  if (pkg.sunoStyle.trim().length > 40) score += 40;
  if (pkg.youtubeTitle.trim()) score += 10;
  if (pkg.confirmedTitle.trim()) score += 10;
  return score;
}

export function keepFilledFields<T extends object>(prev: T, next: T): T {
  const out: Record<string, unknown> = { ...(next as Record<string, unknown>) };
  const prior = prev as Record<string, unknown>;
  for (const key of Object.keys(prior)) {
    const before = prior[key];
    const after = out[key];
    if (typeof before !== "string") continue;
    if (before.trim() && (typeof after !== "string" || !after.trim())) out[key] = before;
  }
  return out as T;
}

export function studioFillCount(pkg: { [key: string]: unknown } | null | undefined) {
  if (!pkg) return 0;
  const keys = [
    "summary",
    "confirmedTitle",
    "lyricsBlock",
    "tracklist",
    "sunoStyle",
    "geminiPrompt",
    "youtubeTitle",
    "youtubeDescription",
    "fanLetter",
    "communityPost",
  ];
  return keys.reduce((n, key) => n + (String(pkg[key] ?? "").trim() ? 1 : 0), 0);
}

/** 빈 결과로 이미 있는 곡을 지우지 않는다. 칸 수로 최신 값을 되돌리지 않는다. */
export function shouldReplaceStudio(
  prev?: StudioPackage | null,
  next?: StudioPackage | null,
  _allowLower = false,
): boolean {
  if (!next) return false;
  if (!prev) return true;
  if (hasPageBody(prev) && !hasPageBody(next)) return false;
  return true;
}

export function pickStoredStudio(
  saved: StudioPackage | null | undefined,
  other: StudioPackage | null | undefined,
): StudioPackage | null {
  if (saved && hasPageBody(saved)) return saved;
  if (other && hasPageBody(other)) return other;
  return saved ?? other ?? null;
}

/** 대충 쓴 초안과 완성본이 같이 있으면 완성본만 남긴다. 필드를 섞지 않는다. */
export function betterStudio(
  a: StudioPackage | null | undefined,
  b: StudioPackage | null | undefined,
): StudioPackage | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return studioScore(b) > studioScore(a) ? b : a;
}

function cleanEdited(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
  return ids.length ? ids : undefined;
}

export function keepUserEdits(prev: StudioPackage | null | undefined, next: StudioPackage): StudioPackage {
  const prevIds = cleanEdited(prev?.userEdited) ?? [];
  const explicit = Array.isArray(next.userEdited);
  const nextIds = explicit ? (cleanEdited(next.userEdited) ?? []) : [];
  const ids = explicit ? nextIds : [...new Set([...prevIds, ...nextIds])];
  return { ...next, userEdited: ids.length ? ids : undefined };
}

function compactText(text: string) {
  return text.replace(/\s+/g, "");
}

function sourceSong(ep: string) {
  const songs = readAppDump().originals?.["kpop-original"] ?? {};
  return songs[ep] ?? songs[String(Number(ep))] ?? null;
}

function borrowSlice(fieldId: string, body: string) {
  // 썸네일 앞부분은 곡마다 같은 공통 문장이다. 본문 전체가 같을 때만 다른 곡이다.
  if (fieldId === "title" || fieldId === "yt-title" || fieldId === "suno" || fieldId === "thumb") return body;
  return body.slice(0, 80);
}

function borrowMin(fieldId: string) {
  if (fieldId === "title" || fieldId === "yt-title") return 4;
  if (fieldId === "suno" || fieldId === "thumb") return 80;
  return 48;
}

type BorrowIndex = {
  rev: number;
  heads: Map<string, string[]>;
};

let borrowIndex: BorrowIndex | null = null;

function borrowHeads() {
  const rev = appDumpRev();
  if (borrowIndex?.rev === rev) return borrowIndex.heads;
  const heads = new Map<string, string[]>();
  const put = (fieldId: string, ep: string, body: string) => {
    if (!body) return;
    const head = borrowSlice(fieldId, body);
    const min = borrowMin(fieldId);
    if (head.length < min) return;
    const key = `${fieldId}:${head}`;
    const list = heads.get(key);
    if (list) list.push(ep);
    else heads.set(key, [ep]);
  };
  for (const row of Object.values(readAppDump().packages)) {
    const ep = padEp(row.ep);
    const pkg = row.pkg as Partial<StudioPackage> | undefined;
    if (!ep || !pkg) continue;
    for (const block of STUDIO_BLOCKS) {
      const raw = pkg[block.key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      put(block.id, ep, compactText(raw));
    }
  }
  borrowIndex = { rev, heads };
  return heads;
}

export function fieldBorrowed(genreId: string, epN: string, fieldId: string, text: string, sunoBase?: string): boolean {
  const mine = padEp(epN);
  const block = STUDIO_BLOCKS.find((item) => item.id === fieldId);
  if (!mine || !genreId || !block || !text.trim()) return false;
  const body = compactText(text);
  if (fieldId === "suno") {
    const norm = (value: string) => compactText(value.replace(/\\n/g, "\n"));
    const base = norm(String((sunoBase ?? readPref(genreId as GenreId).sunoBase) || ""));
    if (base.length >= 40 && norm(text) === base) return false;
  }
  const min = borrowMin(fieldId);
  if (body.length < min) return false;
  const mineSrc = sourceSong(mine);
  if ((fieldId === "title" || fieldId === "yt-title") && mineSrc?.title && compactText(mineSrc.title) === body) return false;
  if (fieldId === "lyrics" && mineSrc?.lyrics && compactText(mineSrc.lyrics).slice(0, 80) === body.slice(0, 80)) return false;
  const head = borrowSlice(fieldId, body);
  const hits = borrowHeads().get(`${fieldId}:${head}`);
  if (!hits) return false;
  for (const otherEp of hits) {
    if (!otherEp || otherEp === mine) continue;
    const src = sourceSong(otherEp);
    const owner = Boolean(
      ((fieldId === "title" || fieldId === "yt-title") && src?.title && compactText(src.title) === body)
      || (fieldId === "lyrics" && src?.lyrics && compactText(src.lyrics).slice(0, 80) === body.slice(0, 80))
      || Number(otherEp) < Number(mine),
    );
    if (owner) return true;
  }
  return false;
}

const BORROW_LABEL: Record<string, string> = {
  summary: "요약",
  title: "제목",
  lyrics: "가사",
  suno: "수노",
  thumb: "썸네일",
  "yt-title": "유튜브 제목",
  "yt-desc": "설명",
  letter: "커뮤니티",
};

export function clearBorrowedFields(genreId: string, epN: string, pkg: StudioPackage) {
  const n = padEp(epN);
  const locks = n ? readLocks("single", n, genreId) : {};
  const edited = new Set(pkg.userEdited ?? []);
  const next: StudioPackage = { ...pkg };
  const cleared: string[] = [];
  for (const block of STUDIO_BLOCKS) {
    if (locks[block.id] || edited.has(block.id)) continue;
    const text = String(pkg[block.key] ?? "");
    if (!fieldBorrowed(genreId, epN, block.id, text)) continue;
    (next[block.key] as string) = "";
    cleared.push(BORROW_LABEL[block.id] || block.id);
  }
  return {
    pkg: cleared.length ? normalizePackage(next) : pkg,
    cleared,
  };
}

function isStudioShape(parsed: unknown): StudioPackage | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<StudioPackage>;
  if (
    typeof value.summary !== "string" ||
    typeof value.confirmedTitle !== "string" ||
    typeof value.lyricsBlock !== "string" ||
    typeof value.geminiPrompt !== "string" ||
    typeof value.youtubeTitle !== "string" ||
    typeof value.youtubeDescription !== "string"
  ) {
    return null;
  }
  return normalizePackage({
    summary: value.summary,
    confirmedTitle: value.confirmedTitle,
    lyricsBlock: value.lyricsBlock,
    sunoStyle: typeof value.sunoStyle === "string" ? value.sunoStyle : "",
    geminiPrompt: value.geminiPrompt,
    youtubeTitle: value.youtubeTitle,
    youtubeDescription: value.youtubeDescription,
    fanLetter: typeof value.fanLetter === "string" ? value.fanLetter : "",
    thumbUrl: typeof value.thumbUrl === "string" ? value.thumbUrl : "",
    thumbCast: asThumbCast(value.thumbCast),
    youtubeUrl: typeof value.youtubeUrl === "string" ? value.youtubeUrl : "",
    sunoUrl: typeof value.sunoUrl === "string" ? value.sunoUrl : "",
    mvUrl: typeof value.mvUrl === "string" ? value.mvUrl : "",
    audioLevel: cleanAudioLevel(value.audioLevel),
    audioAnalysis: cleanAudioAnalysis(value.audioAnalysis),
    ...(value.ytPremium === true || value.ytPremium === false ? { ytPremium: value.ytPremium === true } : {}),
    ...(value.mvPremium === true || value.mvPremium === false ? { mvPremium: value.mvPremium === true } : {}),
    userEdited: cleanEdited(value.userEdited),
    fieldSavedAt: readFieldStamps(value),
  });
}

function isPlaylistShape(parsed: unknown): PlaylistPackage | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<PlaylistPackage>;
  if (
    typeof value.summary !== "string" ||
    typeof value.tracklist !== "string" ||
    typeof value.geminiPrompt !== "string" ||
    typeof value.youtubeTitle !== "string" ||
    typeof value.youtubeDescription !== "string"
  ) {
    return null;
  }
  return normalizePlaylist({
    summary: value.summary,
    confirmedTitle: typeof value.confirmedTitle === "string" ? value.confirmedTitle : "",
    tracklist: value.tracklist,
    sunoStyle: typeof value.sunoStyle === "string" ? value.sunoStyle : "",
    geminiPrompt: value.geminiPrompt,
    youtubeTitle: value.youtubeTitle,
    youtubeDescription: value.youtubeDescription,
    communityPost: typeof value.communityPost === "string" ? value.communityPost : "",
    thumbUrl: typeof value.thumbUrl === "string" ? value.thumbUrl : "",
    thumbCast: asThumbCast(value.thumbCast),
    youtubeUrl: typeof value.youtubeUrl === "string" ? value.youtubeUrl : "",
    sunoUrl: typeof value.sunoUrl === "string" ? value.sunoUrl : "",
    mvUrl: typeof value.mvUrl === "string" ? value.mvUrl : "",
    audioLevel: cleanAudioLevel(value.audioLevel),
    audioAnalysis: cleanAudioAnalysis(value.audioAnalysis),
    ...(value.ytPremium === true || value.ytPremium === false ? { ytPremium: value.ytPremium === true } : {}),
    ...(value.mvPremium === true || value.mvPremium === false ? { mvPremium: value.mvPremium === true } : {}),
    tracklistEdited: value.tracklistEdited === true,
    descEdited: value.descEdited === true,
    fieldSavedAt: readFieldStamps(value),
  });
}

const youtubePins = new Map<string, string>();

function normTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

let titleOwners: Map<string, string> | null = null;

function titleOwnerMap() {
  if (titleOwners) return titleOwners;
  const map = new Map<string, string>();
  const add = (title: string, n: string) => {
    const key = normTitle(title);
    const ep = padEp(n);
    if (key.length < 2 || !ep) return;
    map.set(key, ep);
  };
  for (const item of EPS) add(item.title, item.n);
  for (const item of SEED_ORIGINALS) add(item.title, item.n);
  titleOwners = map;
  return map;
}

export function packageOwnerEp(title: string) {
  const key = normTitle(title);
  if (key.length < 2) return "";
  return titleOwnerMap().get(key) ?? "";
}

function titleSlots(text: string) {
  return String(text || "")
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function foreignSongTitleIn(text: string, ep: string, confirmed = "") {
  const body = String(text || "");
  const mine = normTitle(confirmed);
  const n = padEp(ep);
  if (!body.trim()) return "";
  for (const [title, owner] of titleOwnerMap()) {
    if (title.length < 4 || owner === n) continue;
    if (mine && (mine === title || mine.includes(title) || title.includes(mine))) continue;
    if (titleSlots(body).some((slot) => slot.toLowerCase() === title)) return title;
  }
  return "";
}

function shiftSlotMeta(meta: AppDump["meta"], titles: AppDump["titles"], genreId: string, from: string, to: string) {
  if (!from || !to || from === to) return;
  const confirmed = { ...(meta.confirmed ?? {}) };
  const fromConfirm = `${genreId}:ep:${from}`;
  const toConfirm = `${genreId}:ep:${to}`;
  if (confirmed[fromConfirm] === true && confirmed[toConfirm] === undefined) confirmed[toConfirm] = true;
  delete confirmed[fromConfirm];
  meta.confirmed = confirmed;

  const locks = { ...(meta.locks ?? {}) };
  const fromLock = `single:${from}:${genreId}`;
  const toLock = `single:${to}:${genreId}`;
  if (locks[fromLock] && !locks[toLock]) locks[toLock] = locks[fromLock];
  delete locks[fromLock];
  meta.locks = locks;

  const rowLocks = { ...(meta.rowLocks ?? {}) };
  const fromRow = `${genreId}:${from}`;
  const toRow = `${genreId}:${to}`;
  if (rowLocks[fromRow] !== undefined && rowLocks[toRow] === undefined) rowLocks[toRow] = rowLocks[fromRow];
  delete rowLocks[fromRow];
  meta.rowLocks = rowLocks;

  const youtube = { ...(meta.youtube ?? {}) };
  if (youtube[fromRow] && !youtube[toRow]) {
    youtube[toRow] = youtube[fromRow];
    youtubePins.set(toRow, youtube[fromRow]);
  }
  delete youtube[fromRow];
  youtubePins.delete(fromRow);
  const fromMv = `${genreId}:mv:${from}`;
  const toMv = `${genreId}:mv:${to}`;
  if (youtube[fromMv] && !youtube[toMv]) youtube[toMv] = youtube[fromMv];
  delete youtube[fromMv];
  meta.youtube = youtube;

  const genreTitles = { ...(titles[genreId] ?? {}) };
  if (genreTitles[from] && !genreTitles[to]) genreTitles[to] = genreTitles[from];
  delete genreTitles[from];
  titles[genreId] = genreTitles;
}

export function rematchStoredPackages() {
  if (!matchByEpisode()) return 0;
  const dump = readAppDump();
  const packages: AppDump["packages"] = { ...dump.packages };
  const meta: AppDump["meta"] = {
    ...dump.meta,
    locks: { ...(dump.meta.locks ?? {}) },
    rowLocks: { ...(dump.meta.rowLocks ?? {}) },
    confirmed: { ...(dump.meta.confirmed ?? {}) },
    youtube: { ...(dump.meta.youtube ?? {}) },
  };
  const titles: AppDump["titles"] = {};
  for (const [genreId, map] of Object.entries(dump.titles ?? {})) titles[genreId] = { ...map };
  const originals: AppDump["originals"] = {};
  for (const [genreId, songs] of Object.entries(dump.originals ?? {})) originals[genreId] = { ...songs };

  const groups = new Map<string, { ep: string; pkg: StudioPackage; title: string; want: string }[]>();
  for (const row of Object.values(packages)) {
    const pkg = isStudioShape(row.pkg);
    const ep = padEp(row.ep);
    if (!pkg || !row.genreId || !ep) continue;
    const want = ep;
    const list = groups.get(row.genreId) ?? [];
    list.push({ ep, pkg, title: row.title, want });
    groups.set(row.genreId, list);
  }

  let moved = 0;
  for (const [genreId, list] of groups) {
    for (const item of list) delete packages[`${genreId}:${item.ep}`];
    const chosen = new Map<string, (typeof list)[number]>();
    for (const item of list) {
      const prev = chosen.get(item.want);
      if (!prev || studioScore(item.pkg) > studioScore(prev.pkg)) chosen.set(item.want, item);
    }
    for (const item of chosen.values()) {
      packages[`${genreId}:${item.want}`] = {
        genreId,
        ep: item.want,
        title: item.pkg.confirmedTitle.trim() || item.title,
        pkg: item.pkg,
      };
    }
    const movers = list
      .filter((item) => item.ep !== item.want)
      .sort((a, b) => studioScore(b.pkg) - studioScore(a.pkg));
    for (const item of movers) {
      moved += 1;
      shiftSlotMeta(meta, titles, genreId, item.ep, item.want);
    }
  }

  if (!moved) {
    const sameOriginals = JSON.stringify(originals) === JSON.stringify(dump.originals ?? {});
    if (sameOriginals) return 0;
  }
  replaceAppDump({ ...dump, packages, titles, originals, meta });
  return moved;
}

function alignSlotEp(pkg: StudioPackage, ep: string): StudioPackage {
  const n = padEp(ep);
  if (!n) return pkg;
  const fix = (value: string) => value.replace(/^(\s*)EP\.?\s*0*\d+/i, (_, space: string) => `${space}EP.${n}`);
  let youtubeTitle = pkg.youtubeTitle || "";
  let confirmedTitle = pkg.confirmedTitle || "";
  if (/^\s*EP\.?\s*\d+/i.test(youtubeTitle)) youtubeTitle = fix(youtubeTitle);
  if (/^\s*EP\.?\s*\d+/i.test(confirmedTitle)) confirmedTitle = fix(confirmedTitle);
  if (youtubeTitle === (pkg.youtubeTitle || "") && confirmedTitle === (pkg.confirmedTitle || "")) return pkg;
  return { ...pkg, youtubeTitle, confirmedTitle };
}

function mergeListOrder(remote?: Record<string, string[]>, local?: Record<string, string[]>) {
  const fromFile = parseListOrder(remote);
  const here = parseListOrder(local);
  const out: Record<string, string[]> = { ...fromFile };
  for (const [key, ids] of Object.entries(here)) {
    if (ids.length) out[key] = ids;
  }
  return out;
}

function fillListOrder(base?: Record<string, string[]>, extra?: Record<string, string[]>) {
  const out = { ...parseListOrder(base) };
  for (const [key, ids] of Object.entries(parseListOrder(extra))) {
    if (!out[key]?.length && ids.length) out[key] = ids;
  }
  return out;
}

export function ingestEncyclopedia(dump: {
  packages?: Record<string, { genreId: string; ep: string; pkg: unknown; title?: string }>;
  playlists?: Record<string, { genreId: string; act: number; pkg: unknown; title?: string }>;
  stories?: Record<string, { title: string; pkg: unknown; savedAt?: number }>;
  prefs?: Record<string, unknown>;
  originals?: Record<string, Record<string, { n: string; title: string; vocal: string; lyrics: string }>>;
  titles?: Record<string, Record<string, string>>;
  fillJob?: AppDump["fillJob"];
  meta?: Partial<import("./app-memory").EncMeta>;
}) {
  const cur = readAppDump();
  const packages: AppDump["packages"] = {};
  const take = (row: { genreId: string; ep: string; title?: string; pkg: unknown }, preferLocal = false) => {
    const raw = isStudioShape(row.pkg);
    if (!raw || !row.genreId) return;
    const ep = padEp(row.ep) || row.ep;
    const shaped =
      isConfirmed("single", row.genreId, ep) || readRowLocked(row.genreId, ep) ? raw : alignSlotEp(raw, ep);
    const key = `${row.genreId}:${ep}`;
    const prev = packages[key];
    const prevPkg = prev ? isStudioShape(prev.pkg) : null;
    const sealed = isConfirmed("single", row.genreId, ep) || readRowLocked(row.genreId, ep);
    const rowAt = Number((row as { updatedAt?: number }).updatedAt) || 0;
    const prevAt = Number((prev as { updatedAt?: number } | undefined)?.updatedAt) || 0;
    if (sealed) {
      if (preferLocal && prevPkg && hasPageBody(shaped)) {
        const merged = adoptSavedFileText(shaped, prevPkg);
        packages[key] = {
          genreId: row.genreId,
          ep,
          title: merged.confirmedTitle.trim() || row.title || prev?.title || "",
          pkg: merged,
          updatedAt: rowAt || prevAt || undefined,
        };
        return;
      }
      if (preferLocal && !(rowAt > prevAt && hasPageBody(shaped))) return;
      packages[key] = {
        genreId: row.genreId,
        ep,
        title: shaped.confirmedTitle.trim() || row.title || prev?.title || "",
        pkg: shaped,
        updatedAt: rowAt || prevAt || undefined,
      };
      return;
    }
    if (
      preferLocal &&
      hasPageBody(shaped) &&
      !sealed
    ) {
      if (prevPkg && !packageFitsSong(row.genreId, ep, shaped) && packageFitsSong(row.genreId, ep, prevPkg)) return;
      const merged = prevPkg ? adoptSavedFileText(shaped, prevPkg) : shaped;
      packages[key] = {
        genreId: row.genreId,
        ep,
        title: merged.confirmedTitle.trim() || row.title || prev?.title || "",
        pkg: merged,
        updatedAt: (row as { updatedAt?: number }).updatedAt,
      };
      return;
    }
    const best = betterStudio(prevPkg, shaped) ?? shaped;
    packages[key] = {
      genreId: row.genreId,
      ep,
      title: best.confirmedTitle.trim() || row.title || prev?.title || "",
      pkg: best,
    };
  };
  for (const row of Object.values(dump.packages ?? {})) take(row);
  const playlists: AppDump["playlists"] = {};
  const takePlaylist = (
    row: { genreId: string; act: number; title?: string; pkg: unknown },
    preferLocal = false,
  ) => {
    const shaped = isPlaylistShape(row.pkg);
    if (!shaped || !row.genreId || !row.act) return;
    const key = `${row.genreId}:${row.act}`;
    const prev = playlists[key];
    const prevPkg = prev ? isPlaylistShape(prev.pkg) : null;
    const merged = prevPkg
      ? preferLocal
        ? adoptSavedFileText(shaped, prevPkg)
        : mergeFilledPlaylist(prevPkg, shaped, false)
      : shaped;
    playlists[key] = {
      genreId: row.genreId,
      act: row.act,
      title: merged.youtubeTitle.trim() || row.title || prev?.title || "",
      pkg: merged,
    };
  };
  for (const row of Object.values(dump.playlists ?? {})) takePlaylist(row);
  const stories: AppDump["stories"] = {};
  for (const [key, value] of Object.entries(dump.stories ?? {})) {
    if (isStoryFixture(key, value?.pkg as { songId?: string })) continue;
    stories[key] = value;
  }
  const prefs: Record<string, unknown> = { ...(dump.prefs ?? {}) };
  for (const [key, value] of Object.entries(cur.prefs)) {
    if (!value || typeof value !== "object") continue;
    const remote = prefs[key];
    prefs[key] =
      remote && typeof remote === "object" ? { ...(remote as object), ...(value as object) } : value;
    const mergedPref = prefs[key] as { adminDevice?: unknown } | undefined;
    if (mergedPref && typeof mergedPref === "object" && "adminDevice" in mergedPref) {
      const remoteAdmin = remote && typeof remote === "object" ? (remote as { adminDevice?: unknown }).adminDevice : "";
      const localAdmin = (value as { adminDevice?: unknown }).adminDevice;
      mergedPref.adminDevice = keptAdmin(
        typeof remoteAdmin === "string" ? remoteAdmin : "",
        typeof localAdmin === "string" ? localAdmin : "",
      );
    }
  }
  const originals = { ...(dump.originals ?? {}) };
  for (const [gid, songs] of Object.entries(cur.originals)) {
    originals[gid] = { ...(originals[gid] ?? {}), ...songs };
  }
  const titles = { ...(dump.titles ?? {}) };
  const mergeMaps = (
    a?: Record<string, Record<string, boolean>>,
    b?: Record<string, Record<string, boolean>>,
  ) => {
    const out: Record<string, Record<string, boolean>> = { ...(a ?? {}) };
    for (const [key, map] of Object.entries(b ?? {})) {
      const localOn = Object.values(map ?? {}).some((value) => value === true);
      out[key] = localOn ? { ...(out[key] ?? {}), ...map } : {};
    }
    return out;
  };
  const remoteMeta = dump.meta;
  const remoteOrder = parseListOrder(remoteMeta?.listOrder);
  const browserOrder = readBrowserListOrder();
  let repairOrder = false;
  for (const [key, ids] of Object.entries(browserOrder)) {
    if (ids.length && !remoteOrder[key]?.length) repairOrder = true;
  }
  const listOrder = mergeListOrder(fillListOrder(remoteOrder, browserOrder), cur.meta.listOrder);
  const sweep = remoteMeta?.lockSweep ?? 0;
  let dropLocks = false;
  if (sweep >= 1 && typeof window !== "undefined") {
    try {
      dropLocks = localStorage.getItem("noa-lock-sweep") !== String(sweep);
      if (dropLocks) localStorage.setItem("noa-lock-sweep", String(sweep));
    } catch {
      dropLocks = true;
    }
  }
  replaceAppDump({
    packages,
    playlists,
    stories,
    prefs,
    originals,
    titles,
    fillJob: dump.fillJob !== undefined ? dump.fillJob : cur.fillJob,
    meta: {
      ...cur.meta,
      locks: dropLocks ? {} : mergeMaps(remoteMeta?.locks, cur.meta.locks),
      rowLocks: dropLocks ? {} : { ...(remoteMeta?.rowLocks ?? {}), ...(cur.meta.rowLocks ?? {}) },
      confirmed: { ...(remoteMeta?.confirmed ?? {}), ...(cur.meta.confirmed ?? {}) },
      settingLocks: {
        common: { ...(remoteMeta?.settingLocks?.common ?? {}), ...(cur.meta.settingLocks?.common ?? {}) },
        genre: { ...(remoteMeta?.settingLocks?.genre ?? {}), ...(cur.meta.settingLocks?.genre ?? {}) },
      },
      needRegen: cur.meta.needRegen?.length ? cur.meta.needRegen : (remoteMeta?.needRegen ?? []),
      slots: { ...(remoteMeta?.slots ?? {}), ...(cur.meta.slots ?? {}) },
      youtube: (() => {
        const remote = remoteMeta?.youtube ?? {};
        const merged = { ...remote, ...(cur.meta.youtube ?? {}) };
        const byUrl = new Map<string, string[]>();
        for (const [key, url] of Object.entries(merged)) {
          const value = String(url || "").trim();
          if (!value) {
            delete merged[key];
            continue;
          }
          const list = byUrl.get(value) ?? [];
          list.push(key);
          byUrl.set(value, list);
        }
        for (const [url, keys] of byUrl) {
          if (keys.length < 2) continue;
          const keeper = keys.find((key) => String(remote[key] || "").trim() === url) ?? keys[0];
          for (const key of keys) {
            if (key !== keeper) delete merged[key];
          }
        }
        return merged;
      })(),
      ui: { ...(remoteMeta?.ui ?? {}), ...(cur.meta.ui ?? {}) },
      releaseSeen: Math.max(cur.meta.releaseSeen ?? 0, remoteMeta?.releaseSeen ?? 0),
      gatePassword: cur.meta.gatePassword || remoteMeta?.gatePassword || "",
      securityKey: "7999",
      fillAskAgain: Boolean(cur.meta.fillAskAgain || remoteMeta?.fillAskAgain),
      gateOpen: gateWasTouched()
        ? cur.meta.gateOpen === true
        : typeof remoteMeta?.gateOpen === "boolean"
          ? remoteMeta.gateOpen
          : cur.meta.gateOpen === true,
      listOrder,
    },
  });
  if (typeof window !== "undefined") writeBrowserListOrder(readAppDump().meta.listOrder);
  if (repairOrder) saveMetaNow();
  rematchStoredPackages();
  applyReportedMismatches();
  let n = 0;
  for (const item of Object.values(readAppDump().packages)) {
    if (item.ep && item.genreId && isStudioShape(item.pkg) && hasPageBody(isStudioShape(item.pkg)!)) n += 1;
  }
  return n;
}

export function readCachedPackage(epN: string, genreId: string): StudioPackage | null {
  const hit = readAppDump().packages[`${genreId}:${padEp(epN)}`];
  return hit?.pkg ? isStudioShape(hit.pkg) : null;
}

export function forgetCachedPackage(epN: string, genreId: string) {
  const n = padEp(epN);
  if (!n) return;
  cancelQueuedPage(resultSlot(genreId, n, 1));
  patchApp((d) => {
    delete d.packages[`${genreId}:${n}`];
    const titles = d.titles[genreId];
    if (titles) delete titles[n];
  }, false);
  void import("./pages").then((api) => api.dropStoredSong({ data: { genreId, ep: n } })).catch(() => {});
}

export function placeSavedSong(genreId: string, epN: string) {
  const n = padEp(epN);
  if (!n || !genreId) return;
}

export function applyReportedMismatches() {
  placeSavedSong("kpop-original", "11");
  placeSavedSong("kpop-original", "18");
  placeSavedSong("joseon-ballad", "22");
}

export function readPackageStamp(epN: string, genreId: string): number {
  const hit = readAppDump().packages[`${genreId}:${padEp(epN)}`] as { updatedAt?: number } | undefined;
  return Number(hit?.updatedAt) || 0;
}

export function writeCachedPackage(epN: string, genreId: string, pkg: StudioPackage, rewrite = false, flush = true, force = false): boolean {
  const n = padEp(epN);
  if (!n) return false;
  const prev = readCachedPackage(n, genreId);
  const cloned = JSON.parse(JSON.stringify(pkg.thumbUrl?.startsWith("data:") ? { ...pkg, thumbUrl: "" } : pkg)) as StudioPackage & { sunoExact?: boolean; levelExact?: boolean; blankFields?: string[] };
  const acceptable = force || !hasPageBody(cloned) || canKeepPackage(genreId, n, prev, cloned);
  if (hasPageBody(cloned) && !acceptable) return false;
  const prevOk = Boolean(prev && packageFitsSong(genreId, n, prev));
  const edited = rewrite || (acceptable && prev && !prevOk) ? cloned : keepUserEdits(prevOk ? prev : null, cloned);
  const stamped = stampChangedFields(
    prev as unknown as Record<string, unknown> | null,
    edited as unknown as Record<string, unknown>,
    new Date().toISOString(),
    Boolean(rewrite),
  ) as StudioPackage & { sunoExact?: boolean; levelExact?: boolean; blankFields?: string[] };
  const merged = mergeLatestBody(
    prev as unknown as Record<string, unknown> | null,
    stamped as unknown as Record<string, unknown>,
  ) as StudioPackage & { sunoExact?: boolean; levelExact?: boolean; blankFields?: string[] };
  if (stamped.sunoExact === true) merged.sunoUrl = String(stamped.sunoUrl ?? "");
  if (stamped.levelExact === true) {
    const level = cleanAudioLevel(stamped.audioLevel);
    merged.audioLevel = level || (String(stamped.audioLevel ?? "").trim() ? merged.audioLevel : "");
  }
  if ((stamped as { analysisExact?: boolean }).analysisExact === true) {
    const analysis = cleanAudioAnalysis((stamped as { audioAnalysis?: string }).audioAnalysis);
    merged.audioAnalysis = analysis || (String((stamped as { audioAnalysis?: string }).audioAnalysis ?? "").trim() ? merged.audioAnalysis : "");
  }
  const savedList = Array.isArray((stamped as { savedKeys?: unknown }).savedKeys)
    ? (stamped as { savedKeys: unknown[] }).savedKeys.filter((key): key is string => typeof key === "string")
    : [];
  let carried = merged as unknown as Record<string, unknown>;
  for (const key of savedList) {
    if (!(key in (stamped as object))) continue;
    carried[key] = (stamped as unknown as Record<string, unknown>)[key];
    carried = touchFieldStamp(carried, key);
  }
  const mergedKept = carried as typeof merged;
  const queued = JSON.parse(JSON.stringify(mergedKept)) as StudioPackage & { sunoExact?: boolean; levelExact?: boolean; analysisExact?: boolean; blankFields?: string[]; savedKeys?: string[] };
  const copy = { ...mergedKept };
  delete (copy as { savedKeys?: string[] }).savedKeys;
  delete (copy as { sunoExact?: boolean }).sunoExact;
  delete (copy as { levelExact?: boolean }).levelExact;
  delete (copy as { analysisExact?: boolean }).analysisExact;
  delete (copy as { blankFields?: string[] }).blankFields;
  patchApp((d) => {
    d.packages[`${genreId}:${n}`] = { genreId, ep: n, title: copy.confirmedTitle, pkg: copy, updatedAt: Date.now() };
    if (copy.confirmedTitle.trim()) {
      d.titles[genreId] = { ...(d.titles[genreId] ?? {}), [n]: copy.confirmedTitle.trim() };
    }
  }, false);
  rememberTitle(genreId, n, copy.confirmedTitle);
  enqueuePage({ kind: "single", genreId, ep: n, title: copy.confirmedTitle, body: queued, rewrite: rewrite || queued.sunoExact === true || queued.levelExact === true || queued.analysisExact === true });
  if (flush) flushAppPagesNow();
  return true;
}

export function readCachedPlaylist(act: number, genreId: string): PlaylistPackage | null {
  const hit = readAppDump().playlists[`${genreId}:${act}`];
  return hit?.pkg ? isPlaylistShape(hit.pkg) : null;
}

export function readPlaylistStamp(act: number, genreId: string): number {
  const hit = readAppDump().playlists[`${genreId}:${act}`] as { updatedAt?: number } | undefined;
  return Number(hit?.updatedAt) || 0;
}

export function playlistYoutubeKey(genreId: string, act: number) {
  return `${genreId}:pl:${act}`;
}

export function rememberPlaylist(act: number, genreId: string, pkg: PlaylistPackage) {
  if (!genreId || !act || !isPlaylistShape(pkg)) return;
  const slim = pkg.thumbUrl?.startsWith("data:") ? { ...pkg, thumbUrl: "" } : pkg;
  patchApp((d) => {
    const key = `${genreId}:${act}`;
    const prev = d.playlists[key] as { updatedAt?: number } | undefined;
    d.playlists[key] = { genreId, act, title: slim.youtubeTitle, pkg: slim, updatedAt: prev?.updatedAt };
  }, false);
}

export function writeCachedPlaylist(act: number, genreId: string, pkg: PlaylistPackage, flush = true, rewrite = false): boolean {
  const prev = readCachedPlaylist(act, genreId);
  const cloned = (pkg.thumbUrl?.startsWith("data:") ? { ...pkg, thumbUrl: "" } : { ...pkg }) as unknown as Record<string, unknown>;
  const stamped = stampChangedFields(prev as unknown as Record<string, unknown> | null, cloned, new Date().toISOString(), Boolean(rewrite)) as Record<string, unknown>;
  const slim = mergeLatestBody(prev as unknown as Record<string, unknown> | null, stamped) as PlaylistPackage & { sunoExact?: boolean; levelExact?: boolean };
  if (stamped.sunoExact === true) slim.sunoUrl = String(stamped.sunoUrl ?? "");
  if (stamped.levelExact === true) {
    const level = cleanAudioLevel(stamped.audioLevel);
    slim.audioLevel = level || (String(stamped.audioLevel ?? "").trim() ? slim.audioLevel : "");
  }
  if ((stamped as { analysisExact?: boolean }).analysisExact === true) {
    const analysis = cleanAudioAnalysis((stamped as { audioAnalysis?: string }).audioAnalysis);
    slim.audioAnalysis = analysis || (String((stamped as { audioAnalysis?: string }).audioAnalysis ?? "").trim() ? slim.audioAnalysis : "");
  }
  const savedList = Array.isArray((stamped as { savedKeys?: unknown }).savedKeys)
    ? (stamped as { savedKeys: unknown[] }).savedKeys.filter((key): key is string => typeof key === "string")
    : [];
  let carried = slim as unknown as Record<string, unknown>;
  for (const key of savedList) {
    if (!(key in stamped)) continue;
    carried[key] = stamped[key];
    carried = touchFieldStamp(carried, key);
  }
  const slimKept = carried as typeof slim;
  const queued = JSON.parse(JSON.stringify(slimKept)) as PlaylistPackage & { sunoExact?: boolean; levelExact?: boolean; analysisExact?: boolean; blankFields?: string[]; savedKeys?: string[] };
  delete (slimKept as { savedKeys?: string[] }).savedKeys;
  delete (slimKept as { sunoExact?: boolean }).sunoExact;
  delete (slimKept as { levelExact?: boolean }).levelExact;
  delete (slimKept as { analysisExact?: boolean }).analysisExact;
  delete (slimKept as { blankFields?: string[] }).blankFields;
  patchApp((d) => {
    d.playlists[`${genreId}:${act}`] = { genreId, act, title: slimKept.youtubeTitle, pkg: slimKept, updatedAt: Date.now() };
  }, false);
  enqueuePage({ kind: "playlist", genreId, act, title: slimKept.youtubeTitle, body: queued, ...((rewrite || queued.sunoExact === true || queued.levelExact === true || queued.analysisExact === true) ? { rewrite: true } : {}) });
  if (flush) flushAppPagesNow();
  return true;
}

export function readTitleMap(): Record<string, Record<string, string>> {
  return readAppDump().titles ?? {};
}

export function titlesForGenre(genreId: string): Record<string, string> {
  return { ...(readTitleMap()[genreId] ?? {}) };
}

const songDescCache = new Map<string, string>();
const actPreviewCache = new Map<string, { text: string; url: string }>();

function actPreviewKey(genreId: string, act: number) {
  return `${genreId}:${act}`;
}

export function rememberActPreview(genreId: string, act: number, text: string, url: string) {
  if (!genreId || !act) return;
  const key = actPreviewKey(genreId, act);
  const next = { text: text.trim(), url: url.trim() };
  const prev = actPreviewCache.get(key);
  if (prev && prev.text === next.text && prev.url === next.url) return;
  actPreviewCache.set(key, next);
  pingDesc();
}

export function readActPreview(genreId: string, act: number) {
  return actPreviewCache.get(actPreviewKey(genreId, act)) || null;
}

const DESC_EVENT = "noa-desc-ready";

function pingDesc() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESC_EVENT));
}

export function watchDescReady(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DESC_EVENT, onChange);
  return () => window.removeEventListener(DESC_EVENT, onChange);
}

export function rememberSongDesc(genreId: string, ep: string, text: string) {
  const n = padEp(ep);
  const body = text.trim();
  if (!genreId || !n || !body) return;
  songDescCache.set(`${genreId}:${n}`, body);
  pingDesc();
}

/** 결과창 메모리만 곡 파일의 제목·설명으로 맞춘다. 곡 파일은 쓰지 않는다. */
export function pinShownSong(genreId: string, epN: string, pkg: StudioPackage) {
  const n = padEp(epN);
  if (!genreId || !n) return;
  patchApp((d) => {
    const key = `${genreId}:${n}`;
    const row = d.packages[key];
    const title = pkg.confirmedTitle.trim();
    if (!row) {
      d.packages[key] = { genreId, ep: n, title, pkg, updatedAt: Date.now() };
    } else {
      row.pkg = pkg;
      if (title) row.title = title;
    }
    if (title) d.titles[genreId] = { ...(d.titles[genreId] ?? {}), [n]: title };
  }, false);
  if (pkg.confirmedTitle.trim()) rememberTitle(genreId, n, pkg.confirmedTitle);
  if (pkg.youtubeDescription.trim()) rememberSongDesc(genreId, n, pkg.youtubeDescription);
  const patch: Record<string, string> = {};
  const songBag = pkg as unknown as Record<string, unknown>;
  for (const key of SAVED_PANE_KEYS) {
    const value = String(songBag[key] || "");
    if (value.trim()) patch[key] = value;
  }
  patchQueuedBody(`single:${genreId}:${n}`, patch, readFieldStamps(pkg));
}

export function pinShownPlaylist(genreId: string, act: number, pkg: PlaylistPackage) {
  if (!genreId || !act) return;
  rememberPlaylist(act, genreId, pkg);
  const patch: Record<string, string> = {};
  const listBag = pkg as unknown as Record<string, unknown>;
  for (const key of SAVED_PANE_KEYS) {
    const value = String(listBag[key] || "");
    if (value.trim()) patch[key] = value;
  }
  patchQueuedBody(`playlist:${genreId}:${act}`, patch, readFieldStamps(pkg));
}

export function readSongDesc(genreId: string, ep: string) {
  return songDescCache.get(`${genreId}:${padEp(ep)}`) || "";
}

export function rememberActDesc(genreId: string, act: number, text: string) {
  rememberActPreview(genreId, act, text, readActPreview(genreId, act)?.url || "");
}

export function readLinkPremium(genreId: string, id: string, kind: "song" | "mv", scope: "ep" | "act" = "ep") {
  const n = scope === "ep" ? padEp(id) : String(id);
  const key = scope === "ep" ? `${genreId}:hq:${kind}:${n}` : `${genreId}:pl:hq:${kind}:${n}`;
  return String(readAppDump().meta.youtube?.[key] || "") !== "0";
}

export function premiumChoice(flag: boolean | undefined, _genreId: string, _id: string, _kind: "song" | "mv", _scope: "ep" | "act" = "ep") {
  if (flag === false) return false;
  if (flag === true) return true;
  return undefined;
}

export function linkPremiumOn(flag: boolean | undefined, genreId: string, id: string, kind: "song" | "mv", scope: "ep" | "act" = "ep") {
  return premiumChoice(flag, genreId, id, kind, scope) !== false;
}

export function writeLinkPremium(_genreId: string, _id: string, _kind: "song" | "mv", _on: boolean, _scope: "ep" | "act" = "ep") {}

export function readSavedEps(genreId: string): string[] {
  const found = new Set(Object.keys(titlesForGenre(genreId)));
  for (const item of Object.values(readAppDump().packages)) {
    if (item.genreId === genreId && item.ep) found.add(item.ep);
  }
  return [...found];
}

export function readYoutubeMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of Object.values(readAppDump().packages)) {
    const n = padEp(row.ep);
    const pkg = isStudioShape(row.pkg);
    const url = pkg?.youtubeUrl?.trim();
    if (!row.genreId || !n || !url) continue;
    map[`${row.genreId}:${n}`] = url;
  }
  for (const row of Object.values(readAppDump().playlists)) {
    const act = Number(row.act);
    const pkg = isPlaylistShape(row.pkg);
    const url = pkg?.youtubeUrl?.trim();
    if (!row.genreId || !act || !url) continue;
    map[playlistYoutubeKey(row.genreId, act)] = url;
  }
  return map;
}

export function readYoutubeUrl(genreId: string, epN: string): string {
  const n = padEp(epN);
  if (!n) return "";
  return readYoutubeMap()[`${genreId}:${n}`] ?? "";
}

export function writeYoutubeUrl(genreId: string, epN: string, url: string) {
  const n = padEp(epN);
  if (!n) return;
  const key = `${genreId}:${n}`;
  const clean = url.trim();
  if (clean) youtubePins.set(key, clean);
  else youtubePins.delete(key);
  patchApp((d) => {
    const row = d.packages[key];
    const pkg = row ? isStudioShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, youtubeUrl: clean };
  });
}

export function readMvUrl(genreId: string, epN: string): string {
  const n = padEp(epN);
  if (!n) return "";
  const pkg = isStudioShape(readAppDump().packages[`${genreId}:${n}`]?.pkg);
  return pkg?.mvUrl?.trim() || "";
}

export function writeMvUrl(genreId: string, epN: string, url: string) {
  const n = padEp(epN);
  if (!n) return;
  const clean = url.trim();
  patchApp((d) => {
    const row = d.packages[`${genreId}:${n}`];
    const pkg = row ? isStudioShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, mvUrl: clean };
  });
}

export function readSunoUrl(genreId: string, epN: string): string {
  const n = padEp(epN);
  if (!n) return "";
  const pkg = isStudioShape(readAppDump().packages[`${genreId}:${n}`]?.pkg);
  return pkg?.sunoUrl?.trim() || "";
}

export function writeSunoUrl(genreId: string, epN: string, url: string, exact = false) {
  const n = padEp(epN);
  if (!n) return;
  const clean = url.trim();
  if (!clean && !exact) return;
  patchApp((d) => {
    const row = d.packages[`${genreId}:${n}`];
    const pkg = row ? isStudioShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, sunoUrl: clean };
  });
}

export function readPlaylistSunoUrl(genreId: string, act: number): string {
  return readCachedPlaylist(act, genreId)?.sunoUrl?.trim() || "";
}

export function writePlaylistSunoUrl(genreId: string, act: number, url: string, exact = false) {
  if (!genreId || !act) return;
  const clean = url.trim();
  if (!clean && !exact) return;
  patchApp((d) => {
    const row = d.playlists[`${genreId}:${act}`];
    const pkg = row ? isPlaylistShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, sunoUrl: clean };
  });
}

export function keepPlaylistFileUrl(genreId: string, act: number, fileUrl: string) {
  if (!genreId || !act) return;
  const key = playlistYoutubeKey(genreId, act);
  const clean = fileUrl.trim();
  if (clean) youtubePins.set(key, clean);
  else youtubePins.delete(key);
  patchApp((d) => {
    const row = d.playlists[`${genreId}:${act}`];
    const pkg = row ? isPlaylistShape(row.pkg) : null;
    if (row && pkg && clean && (pkg.youtubeUrl || "") !== clean) row.pkg = { ...pkg, youtubeUrl: clean };
  }, false);
}

export function readPlaylistYoutubeUrl(genreId: string, act: number): string {
  return readCachedPlaylist(act, genreId)?.youtubeUrl?.trim() || "";
}

export function writePlaylistYoutubeUrl(genreId: string, act: number, url: string) {
  if (!genreId || !act) return;
  const key = playlistYoutubeKey(genreId, act);
  const clean = url.trim();
  if (clean) youtubePins.set(key, clean);
  else youtubePins.delete(key);
  patchApp((d) => {
    const row = d.playlists[`${genreId}:${act}`];
    const pkg = row ? isPlaylistShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, youtubeUrl: clean };
  });
}

export function readPlaylistMvUrl(genreId: string, act: number): string {
  const pkg = readCachedPlaylist(act, genreId);
  return pkg?.mvUrl?.trim() || "";
}

export function writePlaylistMvUrl(genreId: string, act: number, url: string) {
  if (!genreId || !act) return;
  const clean = url.trim();
  patchApp((d) => {
    const row = d.playlists[`${genreId}:${act}`];
    const pkg = row ? isPlaylistShape(row.pkg) : null;
    if (row && pkg) row.pkg = { ...pkg, mvUrl: clean };
  });
}

export function rememberTitle(genreId: string, epN: string, title: string) {
  const n = padEp(epN);
  const t = title.trim();
  if (!n || !t) return;
  patchApp((d) => {
    d.titles[genreId] = { ...(d.titles[genreId] ?? {}), [n]: t };
  }, false);
}

export function titleOwnedByOtherEp(title: string, ep: string) {
  const owner = packageOwnerEp(title);
  const n = padEp(ep);
  return Boolean(owner && n && owner !== n);
}

function compactLyricHead(text: string) {
  return text.replace(/\s+/g, "").slice(0, 80);
}

/** 가사 앞부분이 같은 장르의 다른 EP 가사와 같으면, 제목만 바꾼 다른 곡이다. */
function lyricsCopiedFromOther(genreId: string, ep: string, lyrics: string) {
  const head = compactLyricHead(lyrics);
  if (head.length < 48) return false;
  const n = padEp(ep);
  for (const [key, row] of Object.entries(readAppDump().packages)) {
    if (!key.startsWith(`${genreId}:`)) continue;
    const otherEp = padEp(key.slice(genreId.length + 1));
    if (!otherEp || otherEp === n) continue;
    const other = isStudioShape(row.pkg);
    const otherHead = compactLyricHead(String(other?.lyricsBlock || ""));
    if (otherHead.length >= 48 && otherHead === head) return true;
  }
  return false;
}

/** 가사 앞부분이 같은 장르의 다른 곡과 같으면 이 곡 가사가 아니다. */
export function lyricsAreThisSong(genreId: string, ep: string, lyrics: string) {
  const text = String(lyrics || "").trim();
  if (!text) return false;
  return !lyricsCopiedFromOther(genreId, ep, text);
}

/** 칸이 더 차 있어도, 이 번호의 원곡이 아닌 결과는 이 곡의 결과가 아니다. */
export function packageFitsSong(genreId: string, ep: string, pkg: StudioPackage | null | undefined) {
  if (!pkg || !hasPageBody(pkg)) return false;
  const n = padEp(ep);
  const title = String(pkg.confirmedTitle || "").trim();
  const source = EPS.find((row) => row.n === n)?.title?.trim() ?? "";
  if (title && titleOwnedByOtherEp(title, n)) return false;
  if (lyricsCopiedFromOther(genreId, n, String(pkg.lyricsBlock || ""))) return false;
  const blob = [pkg.lyricsBlock, pkg.summary, pkg.youtubeTitle, pkg.youtubeDescription].join("\n");
  const mine = (title || source).toLowerCase();
  if (!mine) return true;
  for (const row of EPS) {
    if (row.n === n) continue;
    const other = row.title.trim();
    if (other.length < 4) continue;
    if (/^[A-Za-z0-9 :'&.!?()-]+$/.test(other) && other.length < 8) continue;
    if (source.includes(other) || other.includes(source) || title.includes(other) || other.includes(title)) continue;
    if (blob.toLowerCase().includes(other.toLowerCase()) && !blob.toLowerCase().includes(mine)) return false;
  }
  return true;
}

/** 곡 전체가 맞지 않아도, 가사 정체를 지키며 한 칸만 고친 결과는 저장한다. 다른 곡 가사 위에는 저장하지 않는다. */
export function canKeepPackage(
  genreId: string,
  ep: string,
  prev: StudioPackage | null | undefined,
  next: StudioPackage | null | undefined,
) {
  if (!next || !hasPageBody(next)) return false;
  const n = padEp(ep);
  const title = String(next.confirmedTitle || "").trim();
  const prevTitle = String(prev?.confirmedTitle || "").trim();
  const titleChanged = title !== prevTitle;
  const titleStolen = titleChanged && Boolean(title) && titleOwnedByOtherEp(title, n);
  if (titleStolen) return false;
  const nextHead = compactLyricHead(String(next.lyricsBlock || ""));
  const prevHead = compactLyricHead(String(prev?.lyricsBlock || ""));
  const headUnchanged = Boolean(prev && hasPageBody(prev) && prevHead === nextHead);
  if (!headUnchanged && lyricsCopiedFromOther(genreId, ep, String(next.lyricsBlock || ""))) return false;
  if (packageFitsSong(genreId, ep, next)) return true;
  if (headUnchanged) return true;
  if (nextHead.length >= 48 && !lyricsCopiedFromOther(genreId, ep, String(next.lyricsBlock || ""))) return true;
  return false;
}

export function keepBlockReason(
  genreId: string,
  ep: string,
  prev: StudioPackage | null | undefined,
  next: StudioPackage | null | undefined,
) {
  if (canKeepPackage(genreId, ep, prev, next)) return "";
  if (!next || !hasPageBody(next)) return "빈 결과는 저장하지 않습니다.";
  const n = padEp(ep);
  const title = String(next.confirmedTitle || "").trim();
  const prevTitle = String(prev?.confirmedTitle || "").trim();
  if (title !== prevTitle && title && titleOwnedByOtherEp(title, n)) return "다른 곡 제목은 저장하지 않습니다.";
  if (lyricsCopiedFromOther(genreId, ep, String(next.lyricsBlock || ""))) return "다른 곡 가사는 저장하지 않습니다.";
  const nextHead = compactLyricHead(String(next.lyricsBlock || ""));
  const prevHead = compactLyricHead(String(prev?.lyricsBlock || ""));
  if (prevHead.length >= 48 && nextHead.length < 48) return "가사가 너무 짧아 이 곡 위에 덮지 않습니다.";
  return "이 곡 결과가 아니라 저장하지 않습니다.";
}

function bareLyric(text: string) {
  return text.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
}

function spokenMismatch(lang: string, text: string) {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
  const thai = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (lang === "ja") return kana < 8 && hangul > 20;
  if (lang === "th") return thai < 8 && hangul > 20;
  if (lang === "en") return latin < 20 && hangul > 40;
  return false;
}

/** 칸이 많이 차 있어도, 규칙에 어긋난 이전 결과는 이 곡의 최신 결과가 아니다. */
export function resultMiss(genreId: string, ep: string, pkg: StudioPackage | null | undefined) {
  if (!pkg || !hasPageBody(pkg)) return true;
  if (!packageFitsSong(genreId, ep, pkg)) return true;
  const n = padEp(ep);
  const title = String(pkg.confirmedTitle || "").trim();
  const yt = String(pkg.youtubeTitle || "").trim();
  if (title && yt && !yt.includes(title)) return true;
  if (yt && yt.split("|").filter((part) => part.trim()).length < 5) return true;
  let pref: ReturnType<typeof readPref> | null = null;
  try {
    pref = readPref(genreId as GenreId);
  } catch {
    pref = null;
  }
  const source = EPS.find((row) => row.n === n)?.title?.trim() ?? "";
  const keptTitle = (pkg.userEdited || []).includes("title");
  const lang = pref ? prefOutputLang(genreId as GenreId, pref.lang) : "ko";
  if (!keptTitle && pref?.titleMode === "rewrite" && source && title === source && /[가-힣]/.test(source) && lang !== "ko") return true;
  if (genreId !== "kpop-original") {
    const src = SEED_ORIGINALS.find((row) => row.n === n)?.lyrics ?? "";
    const from = bareLyric(src);
    const made = bareLyric(String(pkg.lyricsBlock || ""));
    if (from.length > 40 && made.slice(0, 80) === from.slice(0, 80)) return true;
    const scope = langScope(pref?.langRule || "");
    const blob = `${!keptTitle && scope.has("title") ? title : ""}\n${scope.has("lyrics") ? pkg.lyricsBlock : ""}`;
    if ((scope.has("title") || scope.has("lyrics")) && spokenMismatch(lang, blob)) return true;
  }
  return false;
}

export function confirmedTrackTitle(genreId: string, n: string, original: string) {
  const known = knownConfirmedTitle(genreId, n);
  return known || original.trim();
}

export function knownConfirmedTitle(genreId: string, n: string) {
  const id = padEp(n) || n;
  const cached = readCachedPackage(id, genreId);
  const fromPkg = cached?.confirmedTitle?.trim() || "";
  if (fromPkg) return fromPkg;
  const remembered = (readAppDump().titles?.[genreId]?.[id] || "").trim();
  if (remembered) return remembered;
  const row = readAppDump().packages[`${genreId}:${id}`];
  return String((row?.pkg as { confirmedTitle?: string } | undefined)?.confirmedTitle || "").trim();
}

export function songTitleFor(genreId: string, n: string, original: string) {
  const id = padEp(n) || n;
  const saved = readAppDump().packages[`${genreId}:${id}`] ?? readAppDump().packages[`${genreId}:${n}`];
  const pkg = saved?.pkg as { confirmedTitle?: string } | undefined;
  const remembered = (readAppDump().titles?.[genreId]?.[id] || "").trim();
  const fromSong = pkg?.confirmedTitle?.trim() || remembered || saved?.title?.trim() || "";
  const base = original.trim();
  const mode = readPref(genreId as GenreId).titleMode === "rewrite" ? "rewrite" : "lock";
  if (mode !== "rewrite") {
    if (fromSong && !titleOwnedByOtherEp(fromSong, id)) {
      return { title: fromSong, source: fromSong === base ? "kept" as const : "converted" as const };
    }
    return { title: base, source: "kept" as const };
  }
  if (fromSong && !titleOwnedByOtherEp(fromSong, id)) {
    const lang = prefOutputLang(genreId as GenreId, readPref(genreId as GenreId).lang);
    const hangul = (fromSong.match(/[가-힣]/g) || []).length;
    const kana = (fromSong.match(/[\u3040-\u30ff]/g) || []).length;
    const thai = (fromSong.match(/[\u0E00-\u0E7F]/g) || []).length;
    const latin = (fromSong.match(/[A-Za-z]/g) || []).length;
    const stillSource = lang === "ja" ? hangul >= 2 && kana < 2 : lang === "th" ? hangul >= 2 && thai < 2 : lang === "en" ? hangul >= 2 && latin < 3 : false;
    if (stillSource) return { title: fromSong, source: fromSong === base ? "kept" as const : "converted" as const };
    return {
      title: fromSong,
      source: (fromSong === base ? "kept" : "converted") as "kept" | "converted",
    };
  }
  return { title: base, source: "none" as const };
}

export function overlayTitles(tracks: { n: string; title: string }[], genreId: string) {
  return tracks.map((item) => {
    const titled = songTitleFor(genreId, item.n, item.title);
    return { n: item.n, title: titled.title, source: titled.source, original: item.title };
  });
}

export function normalizeStory(pkg: StoryPackage): StoryPackage {
  let yt = pkg.youtubeTitle.trim();
  if (yt.length > 100) yt = yt.slice(0, 100);
  let suno = (pkg.sunoStyle ?? "").trim();
  return {
    geminiPrompt: pkg.geminiPrompt.trim(),
    youtubeTitle: yt,
    youtubeDescription: pkg.youtubeDescription.trim(),
    fanLetter: pkg.fanLetter.trim(),
    sunoStyle: suno,
    thumbUrl: pkg.thumbUrl?.trim() ?? "",
    thumbCast: asThumbCast(pkg.thumbCast),
    sourceLyrics: pkg.sourceLyrics?.trim() ?? "",
    sourceVocal: pkg.sourceVocal?.trim() ?? "",
    sourceGenre: pkg.sourceGenre?.trim() ?? "",
    confirmedTitle: pkg.confirmedTitle?.trim() ?? "",
    lyricsBlock: pkg.lyricsBlock?.trim() ?? "",
    youtubeUrl: pkg.youtubeUrl?.trim() ?? "",
    sunoUrl: pkg.sunoUrl?.trim() ?? "",
    mvUrl: pkg.mvUrl?.trim() ?? "",
    audioLevel: cleanAudioLevel(pkg.audioLevel),
    audioAnalysis: cleanAudioAnalysis(pkg.audioAnalysis),
    ...(pkg.ytPremium === true || pkg.ytPremium === false ? { ytPremium: pkg.ytPremium } : {}),
    ...(pkg.mvPremium === true || pkg.mvPremium === false ? { mvPremium: pkg.mvPremium } : {}),
    ...((pkg.songId || "").trim() ? { songId: (pkg.songId || "").trim() } : {}),
    ...(Object.keys(readFieldStamps(pkg)).length ? { fieldSavedAt: readFieldStamps(pkg) } : {}),
  };
}

function parseStory(raw: string | null): StoryPackage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoryPackage>;
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeStory({
      geminiPrompt: typeof parsed.geminiPrompt === "string" ? parsed.geminiPrompt : "",
      youtubeTitle: typeof parsed.youtubeTitle === "string" ? parsed.youtubeTitle : "",
      youtubeDescription: typeof parsed.youtubeDescription === "string" ? parsed.youtubeDescription : "",
      fanLetter: typeof parsed.fanLetter === "string" ? parsed.fanLetter : "",
      sunoStyle: typeof parsed.sunoStyle === "string" ? parsed.sunoStyle : "",
      thumbUrl: typeof parsed.thumbUrl === "string" ? parsed.thumbUrl : "",
      thumbCast: asThumbCast(parsed.thumbCast),
      sourceLyrics: typeof parsed.sourceLyrics === "string" ? parsed.sourceLyrics : "",
      sourceVocal: typeof parsed.sourceVocal === "string" ? parsed.sourceVocal : "",
      sourceGenre: typeof parsed.sourceGenre === "string" ? parsed.sourceGenre : "",
      confirmedTitle: typeof parsed.confirmedTitle === "string" ? parsed.confirmedTitle : "",
      lyricsBlock: typeof parsed.lyricsBlock === "string" ? parsed.lyricsBlock : "",
      youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
      sunoUrl: typeof parsed.sunoUrl === "string" ? parsed.sunoUrl : "",
      mvUrl: typeof parsed.mvUrl === "string" ? parsed.mvUrl : "",
      audioLevel: cleanAudioLevel(parsed.audioLevel),
      audioAnalysis: cleanAudioAnalysis(parsed.audioAnalysis),
      ...(parsed.ytPremium === true || parsed.ytPremium === false ? { ytPremium: parsed.ytPremium } : {}),
      ...(parsed.mvPremium === true || parsed.mvPremium === false ? { mvPremium: parsed.mvPremium } : {}),
      songId: typeof parsed.songId === "string" ? parsed.songId : "",
      fieldSavedAt: readFieldStamps(parsed),
    });
  } catch {
    return null;
  }
}

export function freshStoryId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function isStoryStoreId(value: string) {
  return /^s[0-9a-z]{10,}$/.test(value.trim());
}

export function storyShownTitle(title: string, pkg?: { youtubeTitle?: string; songId?: string } | null) {
  const raw = title.trim();
  const id = (pkg?.songId || "").trim();
  if (raw && !isStoryStoreId(raw) && raw !== id) return raw;
  let text = String(pkg?.youtubeTitle || "").replace(/\s*Cover by AInoa\s*/gi, " ").replace(/\s+/g, " ").trim();
  const head = text.split(/\s*[|｜]\s*/)[0]?.trim() || "";
  const dash = head.match(/^(.*?)\s+[-–—]\s+.+$/);
  const song = (dash?.[1] || head).trim();
  if (!song || isStoryStoreId(song) || song === id || song === raw) return raw && !isStoryStoreId(raw) ? raw : "";
  return song;
}

export function storyCacheKey(title: string | undefined, genreId = "your-story") {
  const name = (title || "").trim();
  if (genreId === "cover-reborn") {
    if (!name) return "cover:";
    return name.startsWith("cover:") ? name : `cover:${name}`;
  }
  return name || "사연";
}

export function readCachedStory(title?: string, genreId = "your-story"): StoryPackage | null {
  const stories = readAppDump().stories;
  if (title?.trim()) {
    const hit = stories[storyCacheKey(title, genreId)];
    return hit?.pkg ? parseStory(JSON.stringify(hit.pkg)) : null;
  }
  const first = Object.values(stories)[0];
  return first?.pkg ? parseStory(JSON.stringify(first.pkg)) : null;
}

export function writeCachedStory(pkg: StoryPackage, title?: string, opts?: { persist?: boolean; genreId?: string }) {
  const genreId = opts?.genreId === "cover-reborn" ? "cover-reborn" : "your-story";
  const songId = (pkg.songId || "").trim();
  const display = (title || "").trim();
  const key = storyCacheKey(songId || display, genreId);
  if (isStoryFixture(songId || display || key, pkg) || isStoryFixture(key, pkg)) return;
  const prevTitle = (readAppDump().stories[key]?.title || "").trim().replace(/^cover:/, "");
  const kept = !isStoryStoreId(display) && display ? display : !isStoryStoreId(prevTitle) && prevTitle ? prevTitle : display;
  const shown = kept || (genreId === "cover-reborn" ? key.slice("cover:".length) : key);
  if (key.startsWith("playlist:")) return;
  const persist = opts?.persist !== false;
  const prevStory = readCachedStory(songId || display || shown, genreId);
  const stamped = stampChangedFields(
    prevStory as unknown as Record<string, unknown> | null,
    pkg as unknown as Record<string, unknown>,
    new Date().toISOString(),
    true,
  );
  const merged = mergeLatestBody(prevStory as unknown as Record<string, unknown> | null, stamped) as StoryPackage & { savedKeys?: string[]; blankFields?: string[] };
  const queuedStory = JSON.parse(JSON.stringify(merged)) as StoryPackage & { savedKeys?: string[]; blankFields?: string[]; registeredAt?: number };
  delete merged.savedKeys;
  delete merged.blankFields;
  patchApp((d) => {
    const prev = d.stories[key];
    const registeredAt = Number(prev?.registeredAt) > 0 ? Number(prev?.registeredAt) : Date.now();
    const savedAt = persist ? Date.now() : Number(prev?.savedAt) || registeredAt;
    d.stories[key] = { title: shown, pkg: merged, registeredAt, ...(savedAt ? { savedAt } : {}) };
  }, false);
  if (persist) {
    const registeredAt = Number(readAppDump().stories[key]?.registeredAt) || 0;
    enqueuePage({ kind: "story", genreId, title: shown, body: registeredAt ? { ...queuedStory, registeredAt } : queuedStory });
    flushAppPagesNow();
  }
}

export type StorySong = {
  title: string;
  id: string;
  pkg: StoryPackage;
  registeredAt: number;
};

export function listStorySongs(genreId = "your-story"): StorySong[] {
  const cover = genreId === "cover-reborn";
  const listed = Object.entries(readAppDump().stories)
    .filter(([key]) => {
      if (key.startsWith("playlist:")) return false;
      return cover ? key.startsWith("cover:") : !key.startsWith("cover:");
    })
    .map(([key, row], index) => {
      const pkg = parseStory(JSON.stringify(row.pkg)) ?? emptyStory();
      const songId = (pkg.songId || "").trim();
      const bare = key.replace(/^cover:/, "");
      const display = (row.title?.trim() || "").replace(/^cover:/, "");
      const id = songId || display || bare;
      const title = storyShownTitle(display || bare, pkg) || display || bare;
      return {
        title,
        id,
        pkg,
        registeredAt: Number(row.registeredAt) || 0,
        index,
      };
    })
    .filter((row) => row.title && (row.pkg.youtubeTitle.trim() || row.pkg.confirmedTitle?.trim() || row.pkg.lyricsBlock?.trim() || row.pkg.geminiPrompt.trim() || row.pkg.youtubeDescription.trim() || row.pkg.sunoStyle.trim() || row.pkg.fanLetter.trim() || (row.pkg.sourceLyrics || "").trim() || (row.pkg.sourceVocal || "").trim() || (row.pkg.sourceGenre || "").trim() || (row.pkg.youtubeUrl || "").trim() || (row.pkg.mvUrl || "").trim() || (row.pkg.sunoUrl || "").trim() || (row.pkg.audioLevel || "").trim() || (row.pkg.audioAnalysis || "").trim() || (row.pkg.thumbUrl || "").trim()))
    .sort((a, b) => {
      const gap = (b.registeredAt || 0) - (a.registeredAt || 0);
      if (gap) return gap;
      return b.index - a.index;
    })
    .map(({ title, id, pkg, registeredAt }) => ({ title, id, pkg, registeredAt }));
  const seen = new Map<string, StorySong>();
  for (const row of listed) {
    const key = row.title.trim();
    const prev = seen.get(key);
    if (!prev || storyKeepWeight(row) > storyKeepWeight(prev)) seen.set(key, row);
  }
  return [...seen.values()];
}

function storyKeepWeight(row: StorySong) {
  const fileNamed = row.id.trim() === row.title.trim() ? 1_000_000 : 0;
  const body = [row.pkg.lyricsBlock, row.pkg.sunoUrl, row.pkg.youtubeUrl, row.pkg.summary].join("").trim().length;
  return fileNamed + body;
}

export type StoryPlaylistRecord = {
  id: string;
  theme: string;
  songs: string[];
  pkg: PlaylistPackage;
};

export function listStoryPlaylists(genreId = "your-story"): StoryPlaylistRecord[] {
  const cover = genreId === "cover-reborn";
  const mark = cover ? "playlist:cover:" : "playlist:";
  const out: StoryPlaylistRecord[] = [];
  for (const [key, row] of Object.entries(readAppDump().stories)) {
    if (!key.startsWith(mark)) continue;
    if (!cover && key.startsWith("playlist:cover:")) continue;
    const raw = row.pkg as Partial<StoryPlaylistRecord> | null;
    const pkg = raw && typeof raw === "object" ? isPlaylistShape(raw.pkg) : null;
    if (!raw || !pkg) continue;
    const songs = Array.isArray(raw.songs) ? raw.songs.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
    out.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : key.slice(mark.length),
      theme: typeof raw.theme === "string" && raw.theme.trim() ? raw.theme.trim() : row.title || "플레이리스트",
      songs,
      pkg,
    });
  }
  out.sort((a, b) => {
    const an = Number(a.id);
    const bn = Number(b.id);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

export function writeStoryPlaylist(row: StoryPlaylistRecord, genreId = "your-story") {
  const id = row.id.trim() || String(Date.now());
  const key = genreId === "cover-reborn" ? `playlist:cover:${id}` : `playlist:${id}`;
  const body = { id, theme: row.theme.trim(), songs: row.songs, pkg: row.pkg };
  patchApp((d) => {
    d.stories[key] = { title: body.theme, pkg: body };
  }, false);
  enqueuePage({ kind: "story", genreId, title: key, body });
  flushAppPagesNow();
}

export const PACKAGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "confirmedTitle",
    "lyricsBlock",
    "sunoStyle",
    "geminiPrompt",
    "youtubeTitle",
    "youtubeDescription",
    "fanLetter",
  ],
  properties: {
    summary: { type: "string" },
    confirmedTitle: { type: "string" },
    lyricsBlock: { type: "string" },
    sunoStyle: { type: "string" },
    geminiPrompt: { type: "string" },
    youtubeTitle: { type: "string" },
    youtubeDescription: { type: "string" },
    fanLetter: { type: "string" },
  },
} as const;

export const PLAYLIST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "confirmedTitle", "sunoStyle", "moodLine", "geminiPrompt", "youtubeDescription", "communityPost"],
  properties: {
    summary: { type: "string" },
    confirmedTitle: { type: "string" },
    sunoStyle: { type: "string" },
    moodLine: { type: "string" },
    geminiPrompt: { type: "string" },
    youtubeDescription: { type: "string" },
    communityPost: { type: "string" },
  },
} as const;

export const BLOCK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: { type: "string" } },
} as const;

export const GROK_THUMB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["prompt"],
  properties: { prompt: { type: "string" } },
} as const;

export const STORY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "moodLine",
    "inferredGenre",
    "geminiPrompt",
    "youtubeTitle",
    "youtubeDescription",
    "fanLetter",
    "sunoStyle",
  ],
  properties: {
    moodLine: { type: "string" },
    inferredGenre: { type: "string" },
    geminiPrompt: { type: "string" },
    youtubeTitle: { type: "string" },
    youtubeDescription: { type: "string" },
    fanLetter: { type: "string" },
    sunoStyle: { type: "string" },
  },
} as const;

export function readConfirmedMap(): Record<string, boolean> {
  return readAppDump().meta.confirmed ?? {};
}

function confirmKey(kind: ResultKind, genreId: string, id: string) {
  if (kind === "single") return `${genreId}:ep:${padEp(id)}`;
  if (kind === "story") return `${genreId}:story:${id}`;
  return `${genreId}:act:${id}`;
}

export function isConfirmed(kind: ResultKind, genreId: string, id: string) {
  const dump = readAppDump();
  const map = dump.meta.confirmed ?? {};
  if (kind === "single") {
    const n = padEp(id);
    if (!n) return false;
    return dump.packages[`${genreId}:${n}`]?.confirmed === true || map[`${genreId}:ep:${n}`] === true;
  }
  if (kind === "story") {
    return dump.stories[id]?.confirmed === true || dump.stories[`cover:${id}`]?.confirmed === true || map[`${genreId}:story:${id}`] === true;
  }
  return dump.playlists[`${genreId}:${id}`]?.confirmed === true || map[`${genreId}:act:${id}`] === true;
}

export function writeConfirmed(kind: ResultKind, genreId: string, id: string, on: boolean) {
  const live = isConfirmed(kind, genreId, id);
  if (!isAdminDevice() && (on || live)) {
    return Promise.resolve({ ok: false, error: adminSealDenied() });
  }
  const key = confirmKey(kind, genreId, id);
  patchApp((d) => {
    const mark = on ? true : undefined;
    if (kind === "single") {
      const row = d.packages[`${genreId}:${padEp(id)}`];
      if (row) row.confirmed = mark;
    } else if (kind === "story") {
      const row = d.stories[id] || d.stories[`cover:${id}`];
      if (row) row.confirmed = mark;
    } else {
      const row = d.playlists[`${genreId}:${id}`];
      if (row) row.confirmed = mark;
    }
    const confirmed = { ...(d.meta.confirmed ?? {}) };
    if (on) confirmed[key] = true;
    else delete confirmed[key];
    d.meta.confirmed = confirmed;
  });
  return import("./pages")
    .then((api) => api.saveConfirm({ data: { key, on } }))
    .then((saved) => ({
      ok: serverOk(saved),
      error: serverError(saved),
    }))
    .catch((err: unknown) => ({
      ok: false,
      error: err instanceof Error ? err.message : "request failed",
    }));
}

export function listConfirmedEps(genreId: string): string[] {
  const dump = readAppDump();
  const found = new Set<string>();
  const prefix = `${genreId}:`;
  for (const [key, row] of Object.entries(dump.packages)) {
    if (row.confirmed === true && key.startsWith(prefix) && row.ep) {
      const n = padEp(row.ep);
      if (n) found.add(n);
    }
  }
  const mark = `${genreId}:ep:`;
  for (const [key, on] of Object.entries(dump.meta.confirmed ?? {})) {
    if (on !== true || !key.startsWith(mark)) continue;
    const n = padEp(key.slice(mark.length));
    if (n) found.add(n);
  }
  return [...found];
}
