import { ChevronDown, ListPlus, LoaderCircle, Music } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { localStoryPlaylist } from "@/lib/fill-local";
import { koreanFillError, noticeLead, noticeShown, quietDiskFault } from "@/lib/fill-errors";
import { generateBlock, generateStory, generateStoryBlock, renderThumb } from "@/lib/generate-package";
import { GATE_EVENT, adminSealDenied, isAdminDevice, isGateOpen, masterLocked } from "@/lib/gate";
import { APP_EVENT, flushAppPagesNow, holdPageLink, patchApp, readAppDump, saveMetaNow } from "@/lib/app-memory";
import { applyAliasOrder, moveId, readListOrder, writeListOrder } from "@/lib/list-order";
import { clearFillFit, followTop, placeFillField, showWorkGroup } from "@/lib/app-scroll";
import { loadGenrePref, readResultFile, saveResultFields, saveStoryPage, pinShownPremiumFile } from "@/lib/pages";
import {
  emptyStory,
  freshStoryId,
  hasPlaylistBody,
  isConfirmed,
  isLocked,
  isStoryStoreId,
  listStoryPlaylists,
  listStorySongs,
  patchPlaylistPkg,
  patchStory,
  readCachedStory,
  readLocks,
  storyCacheKey,
  takeLockedStory,
  writeCachedStory,
  writeConfirmed,
  writeLocks,
  writeStoryPlaylist,
  type PlaylistPackage,
  type StoryPackage,
} from "@/lib/package";
import { defaultThumbCast, type ThumbCast, THUMB_CASTS, castFromLabel, labelForCast } from "@/lib/characters";
import { listenDescription, descriptionWithoutLyrics, COVER_TITLE_CREDIT } from "@/lib/lyrics-clean";
import { forgetFieldDraft, fieldDrafts } from "@/lib/field-draft";
import { hasStoredPref, normalizePref, outputBlockIds, PREF_EVENT, readCommon, readFieldAudit, useGenrePref, writePref, type GenrePref, type OutputShow } from "@/lib/user-prefs";
import { DescriptionBody, PlaylistView, StoryView } from "./package-view";
import { SongFileBar } from "./song-file-bar";
import { coverArtistOf } from "@/lib/story-filename";
import { serverOk, serverPlain } from "@/lib/server-plain";
import { FoldPanel, FoldPrompt, HearFlag, KoText, ListSortRadio, MasteredDownload, MaybeTranslated, OrigSourceFields, PreviewStack, ResultActions, SortGrip, YoutubeField, YoutubeLink, beginSuno, closeFold, queueFoldTop, useSortGesture } from "./studio-chrome";
import { CastBar, CastDialog, CastRadios } from "./thumb-cast";
import { cn } from "@/lib/utils";

const STORY_PANE_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist", "youtubeUrl", "mvUrl", "sunoUrl", "audioAnalysis", "audioLevel", "sourceLyrics", "sourceVocal", "sourceGenre"];

function storyAnalysis(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;peak=-?\d+(?:\.\d+)?;lift=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

function storyLevel(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;gain=-?\d+(?:\.\d+)?;peak=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

function paneInput(domId: string, field: "suno" | "level" | "analysis") {
  if (typeof document === "undefined") return null;
  const read = (node: Element | null | undefined) => (node && "value" in node ? String((node as HTMLInputElement).value || "") : null);
  const root = document.getElementById(domId);
  const scoped = read(root?.querySelector(`input[data-${field}-field]`));
  if (scoped !== null) return scoped;
  const open = [...document.querySelectorAll(`input[data-${field}-field]`)].find((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  return read(open);
}

function storyAddress(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const hit = text.match(/https?:\/\/[^\s<>"']+/i);
  return hit ? hit[0].replace(/[),.;]+$/g, "").slice(0, 500) : "";
}

const STORY_STUB = new Set(["p", "설명란", "편지", "가사", "한줄", "썸네일", "커뮤니티", "요약", "제목", "수노"]);

function storyPaneValue(key: string, value: unknown) {
  const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (key === "sunoUrl" || key === "youtubeUrl" || key === "mvUrl") return storyAddress(text);
  if (key === "audioAnalysis") return storyAnalysis(text);
  if (key === "audioLevel") return storyLevel(text);
  if (key === "youtubeTitle") return text.slice(0, 100);
  return text.length > 100000 ? text.slice(0, 100000) : text;
}

function storyPaneGap(shown: Record<string, unknown>, disk: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const key of STORY_PANE_KEYS) {
    const next = storyPaneValue(key, shown[key]);
    const prev = storyPaneValue(key, disk[key]);
    if (!next) {
      if ((key === "sunoUrl" || key === "audioLevel" || key === "audioAnalysis") && Object.prototype.hasOwnProperty.call(shown, key) && prev) out[key] = "";
      continue;
    }
    if (prev && next !== prev && STORY_STUB.has(next) && prev.length > next.length) continue;
    if (next === prev) continue;
    out[key] = next;
  }
  return out;
}

function storyUrlPins(shown: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const key of ["youtubeUrl", "mvUrl", "sunoUrl"]) {
    const url = storyAddress(String(shown[key] ?? ""));
    if (url) out[key] = url;
  }
  return out;
}

function plainStory(saved: unknown): { ok?: boolean; file?: boolean; fields?: Record<string, string>; error?: string; missing?: string[]; sunoUrl?: string; audioLevel?: string } | null {
  return serverPlain(saved);
}

async function stickStoryFile(kind: "story" | "cover", genreId: string, fileTitle: string, shown: Record<string, unknown>, aliases: string[] = []) {
  const rawTitle = fileTitle.trim();
  const songName = rawTitle.startsWith("playlist:")
    ? rawTitle
    : [...aliases, rawTitle].map((item) => String(item || "").trim()).find((item) => item && !item.startsWith("playlist:") && !isStoryStoreId(item)) || rawTitle;
  const vocal = kind === "cover" ? storyPaneValue("sourceVocal", shown.sourceVocal) : "";
  const query = { kind, genreId, ep: "", act: 0, title: songName, vocal };
  const pane: Record<string, string> = {};
  for (const key of STORY_PANE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(shown, key)) continue;
    const next = storyPaneValue(key, shown[key]);
    if (next) pane[key] = next;
  }
  let fault = "";
  const writeOnce = async (fields: Record<string, string>) => {
    if (!Object.keys(fields).length) return;
    try {
      const saved = plainStory(await saveResultFields({ data: { ...query, fields, blank: Object.values(fields).some((value) => !String(value ?? "").trim()) } }));
      if (saved?.ok === false && saved.error) fault = fault || quietDiskFault(String(saved.error));
    } catch (err) {
      fault = quietDiskFault(err instanceof Error ? err.message.trim() : "request");
    }
  };
  const readBack = async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const again = plainStory(await readResultFile({ data: query }));
        if (again && again.ok !== false && again.file !== false && again.fields && typeof again.fields === "object") return again.fields;
        fault = fault || quietDiskFault(String(again?.error || "read"));
      } catch (err) {
        fault = fault || quietDiskFault(err instanceof Error ? err.message.trim() : "request");
      }
    }
    return null;
  };
  await writeOnce(pane);
  let back = await readBack();
  if (!back) {
    await writeOnce(pane);
    back = await readBack();
  }
  if (!back) return { ok: false as const, back: null, left: pane, error: fault || "read" };
  let left = storyPaneGap(shown, back);
  if (storyAddress(String(back.sunoUrl || "")) === storyAddress(String(shown.sunoUrl ?? ""))) delete left.sunoUrl;
  if (storyLevel(String(back.audioLevel || "")) === storyLevel(String(shown.audioLevel ?? ""))) delete left.audioLevel;
  if (storyAnalysis(String(back.audioAnalysis || "")) === storyAnalysis(String(shown.audioAnalysis ?? ""))) delete left.audioAnalysis;
  if (Object.keys(left).length) {
    await writeOnce(left);
    const again = await readBack();
    if (again) back = again;
    left = storyPaneGap(shown, back);
    if (storyAddress(String(back.sunoUrl || "")) === storyAddress(String(shown.sunoUrl ?? ""))) delete left.sunoUrl;
    if (storyLevel(String(back.audioLevel || "")) === storyLevel(String(shown.audioLevel ?? ""))) delete left.audioLevel;
  if (storyAnalysis(String(back.audioAnalysis || "")) === storyAnalysis(String(shown.audioAnalysis ?? ""))) delete left.audioAnalysis;
  }
  if (Object.keys(left).length) return { ok: false as const, back, left, error: fault || Object.keys(left).join(",") || "file" };
  return { ok: true as const, back, left, error: "" };
}

const landedStoryFiles = new Set<string>();

/** 화면에만 있는 사연곡·커버곡을 글 그대로 곡 파일로 옮긴다. 이미 있는 파일은 덮지 않는다. */
export async function landOpenStoryFiles() {
  for (const genreId of ["your-story", "cover-reborn"] as const) {
    const kind = genreId === "cover-reborn" ? "cover" : "story";
    const jobs: { title: string; body: unknown }[] = [];
    for (const row of listStorySongs(genreId)) {
      const title = (row.title || row.id || "").trim();
      if (!title) continue;
      const songId = (row.pkg.songId || row.id || "").trim();
      jobs.push({
        title,
        body: { ...row.pkg, ...(songId ? { songId } : {}), ...(row.registeredAt ? { registeredAt: row.registeredAt } : {}) },
      });
    }
    for (const row of listStoryPlaylists(genreId)) {
      const title = genreId === "cover-reborn" ? `playlist:cover:${row.id}` : `playlist:${row.id}`;
      jobs.push({ title, body: { id: row.id, theme: row.theme, songs: row.songs, pkg: row.pkg } });
    }
    const cover = genreId === "cover-reborn";
    for (const [key, row] of Object.entries(readAppDump().stories)) {
      if (key.startsWith("playlist:")) continue;
      if (cover ? !key.startsWith("cover:") : key.startsWith("cover:")) continue;
      const pkg = row?.pkg && typeof row.pkg === "object" ? (row.pkg as Record<string, unknown>) : null;
      const title = String(row?.title || "").trim();
      if (!pkg || !title) continue;
      const has = ["youtubeTitle", "geminiPrompt", "youtubeDescription", "fanLetter", "sunoStyle", "sourceLyrics", "sourceVocal", "youtubeUrl", "mvUrl", "sunoUrl", "audioLevel", "audioAnalysis", "thumbUrl"].some(
        (field) => String(pkg[field] || "").trim(),
      );
      if (!has || jobs.some((job) => job.title === title)) continue;
      jobs.push({
        title,
        body: { ...pkg, ...(row.registeredAt ? { registeredAt: row.registeredAt } : {}) },
      });
    }
    for (const job of jobs) {
      const key = `${genreId}:${job.title}`;
      if (landedStoryFiles.has(key)) continue;
      landedStoryFiles.add(key);
      try {
        const names = [job.title];
        const songId = typeof (job.body as { songId?: string }).songId === "string" ? (job.body as { songId: string }).songId.trim() : "";
        if (songId && songId !== job.title) names.push(songId);
        let hasFile = false;
        for (const title of names) {
          const res = plainStory(await readResultFile({ data: { kind, genreId, ep: "", act: 0, title } }));
          if (res?.file === true || (res?.ok !== false && res?.fields && Object.keys(res.fields).length > 0)) {
            hasFile = true;
            break;
          }
        }
        if (hasFile) continue;
        const again = plainStory(await readResultFile({ data: { kind, genreId, ep: "", act: 0, title: names[0] || job.title } }));
        if (again?.file === true || (again?.ok !== false && again?.fields && Object.keys(again.fields).length > 0)) continue;
        let saved: { ok?: boolean } | null = null;
        try {
          saved = await saveStoryPage({ data: { title: job.title, body: job.body as never, genreId } });
        } catch {
          saved = null;
        }
        if (!serverOk(saved)) {
          const stuck = await stickStoryFile(kind, genreId, job.title, job.body as Record<string, unknown>, []);
          if (!stuck.ok) landedStoryFiles.delete(key);
        }
      } catch {
        landedStoryFiles.delete(key);
      }
    }
  }
}

const STORY_PLAYLIST_LIST = "오늘의 사연이 음악이 됩니다";

function storyOrderKeys(row: { id: string; title: string; pkg: { songId?: string; youtubeTitle?: string } }) {
  return [row.id, row.pkg.songId || "", row.title, row.pkg.youtubeTitle || ""];
}

function storyInPlaylist(names: string[], id: string, title: string, youtubeTitle: string) {
  const yt = youtubeTitle.trim();
  return names.some((name) => {
    if (name === id) return true;
    if (id !== title) return false;
    return name === title || (yt !== "" && name === yt);
  });
}

function storyPremiumSig(pkg: StoryPackage) {
  return `${pkg.ytPremium === false ? "0" : "1"}\u0001${pkg.mvPremium === false ? "0" : "1"}`;
}

function StoryPlaylistField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-sm font-medium text-fg">플레이리스트</p>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-bg px-4 py-3 text-sm text-fg [color-scheme:dark]"
      >
          {options.map((item) => (
            <option key={item.id || "basic"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
    </section>
  );
}

function StoryOriginFields({
  title,
  vocal,
  lyrics,
  genre,
  genreLabel = "장르",
  onSave,
  onLive,
}: {
  title: string;
  vocal: string;
  lyrics: string;
  genre: string;
  genreLabel?: string;
  onSave: (next: { title: string; vocal: string; lyrics: string; genre: string }) => void;
  onLive?: (next: { title: string; vocal: string; lyrics: string; genre: string }, dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState({ title, vocal, lyrics, genre });
  const baseRef = useRef({ title, vocal, lyrics, genre });
  let shown = draft;
  if (baseRef.current.title !== title || baseRef.current.vocal !== vocal || baseRef.current.lyrics !== lyrics || baseRef.current.genre !== genre) {
    const prev = baseRef.current;
    baseRef.current = { title, vocal, lyrics, genre };
    if (draft.title === prev.title && draft.vocal === prev.vocal && draft.lyrics === prev.lyrics && draft.genre === prev.genre) {
      shown = { title, vocal, lyrics, genre };
      setDraft(shown);
    }
  }
  const dirty = shown.title !== title || shown.vocal !== vocal || shown.lyrics !== lyrics || shown.genre !== genre;
  useEffect(() => {
    onLive?.(shown, dirty);
  }, [shown.title, shown.vocal, shown.lyrics, shown.genre, dirty]);
  return (
    <div className="flex flex-col gap-4">
      <OrigSourceFields
        ep=""
        title={shown.title}
        vocal={shown.vocal}
        lyrics={shown.lyrics}
        genre={shown.genre}
        genreLabel={genreLabel}
        showTitle
        showVocal
        showLyrics
        showGenre
        onChange={(next) => setDraft((cur) => ({ ...cur, ...next, genre: next.genre ?? cur.genre }))}
      />
      <Button type="button" size="lg" variant={dirty ? "mark" : "secondary"} className="w-full" onClick={() => onSave(shown)}>
        원곡 저장
      </Button>
    </div>
  );
}

function coverListName(title: string, artist: string) {
  const song = title.trim();
  const name = artist.trim();
  if (!name || song.endsWith(` - ${name}`)) return song;
  return `${song} - ${name}`;
}

function readCoverLine(raw: string) {
  const text = raw.trim();
  const bar = text.indexOf("|") >= 0 ? text.indexOf("|") : text.indexOf("｜");
  if (bar >= 0) {
    return { title: text.slice(0, bar).trim(), artist: text.slice(bar + 1).trim() };
  }
  const dash = text.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (dash?.[1] && dash[2]) return { title: dash[1].trim(), artist: dash[2].trim() };
  return { title: text, artist: "" };
}

export function StoryHome({ genreId = "your-story" }: { genreId?: "your-story" | "cover-reborn" } = {}) {
  const cover = genreId === "cover-reborn";
  const inputName = cover ? "커버곡 입력" : "사연곡 입력";
  const genreField = cover ? "원곡 가수" : "장르";
  const songName = cover ? "커버곡" : "사연곡";
  const playlistListName = cover ? "내가 아는 유명곡의 재탄생" : STORY_PLAYLIST_LIST;
  const lockSpace = cover ? "cover" : "story";
  function storySongLabel(token: string) {
    const hit = songs.find((row) => row.id === token || row.pkg.songId === token || row.title === token);
    if (hit?.title && !isStoryStoreId(hit.title)) return hit.title;
    if (isStoryStoreId(token)) return "";
    return token;
  }
  function storeStory(pkg: StoryPackage, title?: string, opts?: { persist?: boolean }) {
    writeCachedStory(pkg, title, { ...opts, genreId });
  }
  const [storyTitle, setStoryTitle] = useState("");
  const [coverLine, setCoverLine] = useState("");
  const [storyLyrics, setStoryLyrics] = useState("");
  const [storyGenre, setStoryGenre] = useState("");
  const [storyVocal, setStoryVocal] = useState<ThumbCast>("female");
  const [pkg, setPkg] = useState<StoryPackage | null>(null);
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const regenJob = useRef(0);
  const regenAbort = useRef<AbortController | null>(null);
  const genAbort = useRef<AbortController | null>(null);
  const storyTextHold = useRef<Record<string, boolean>>({});
  function regenStill(job: number) {
    return job === regenJob.current;
  }
  function stopStoryWork() {
    storyFillStop.current = true;
    genAbort.current?.abort();
    genAbort.current = null;
    regenJob.current += 1;
    regenAbort.current?.abort();
    regenAbort.current = null;
    setBusy(false);
    setBusyBlock(null);
    setFillFocus(null);
    setWorkIds([]);
    setFillingStory(false);
    setFillLabel("");
    setFillPct(0);
    setWorkName("");
    setError("생성을 취소했습니다.");
  }
  function cancelRegen() {
    stopStoryWork();
  }
  function armRegen(blockId: string) {
    regenJob.current += 1;
    const job = regenJob.current;
    const ac = new AbortController();
    regenAbort.current = ac;
    setBusyBlock(blockId);
    setError(null);
    return { job, signal: ac.signal };
  }
  const [error, setError] = useState<string | null>(null);
  const [castOpen, setCastOpen] = useState(false);
  const [thumbCast, setThumbCast] = useState<ThumbCast>(defaultThumbCast(genreId));
  const [castPick, setCastPick] = useState<{ title: string; cast: ThumbCast } | null>(null);
  const [musicGenre, setMusicGenre] = useState("");
  const genreTouch = useRef(false);
  const genreTitle = useRef("");

  const draft = useMemo(
    () => ({
      ep: "",
      title: storyTitle,
      genre: storyGenre,
      vocal: THUMB_CASTS.find((item) => item.id === storyVocal)?.label ?? "여자솔로",
      lyrics: storyLyrics,
    }),
    [storyTitle, storyGenre, storyVocal, storyLyrics],
  );
  const storyId = draft.title.trim() || "story";
  const pref = useGenrePref(genreId);
  const kpopPref = useGenrePref("kpop-original");
  const storyListOutput = {
    ...kpopPref.output,
    origTitle: false,
    origVocal: false,
    origLyrics: false,
  };
  const [menu, setMenu] = useState<"input" | "list">("list");
  const [unlocked, setUnlocked] = useState(false);
  const [adminHere, setAdminHere] = useState(false);
  const [tick, setTick] = useState(0);
  const [openTitle, setOpenTitle] = useState("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [plMenu, setPlMenu] = useState(false);
  const [openPl, setOpenPl] = useState("");
  const [fileMap, setFileMap] = useState<Record<string, Record<string, string>>>({});
  const [heardLevel, setHeardLevel] = useState<Record<string, string>>({});
  const [heardAnalysis, setHeardAnalysis] = useState<Record<string, string>>({});
  const [sortOn, setSortOn] = useState(false);
  const [sortDraft, setSortDraft] = useState<{ key: string; ids: string[] } | null>(null);
  const [plResult, setPlResult] = useState(false);
  const [plDesc, setPlDesc] = useState(false);
  const [confirmTick, setConfirmTick] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<{ id: string; label: string; action: string; fix: "empty" | "rewrite" | "revise" | "request" }[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [fillingStory, setFillingStory] = useState(false);
  const storyFillStop = useRef(false);
  const [fillLabel, setFillLabel] = useState("");
  const [fillPct, setFillPct] = useState(0);
  const [workName, setWorkName] = useState("");
  const [fillFocus, setFillFocus] = useState<{ id: string; phase: "audit" | "work" } | null>(null);
  const [workIds, setWorkIds] = useState<string[]>([]);

  const songs = useMemo(() => listStorySongs(genreId), [tick, pkg, confirmTick]);
  useEffect(() => {
    const onSync = () => setTick((n) => n + 1);
    window.addEventListener("noa-explorer-sync", onSync);
    return () => window.removeEventListener("noa-explorer-sync", onSync);
  }, []);
  const openTitleRef = useRef(openTitle);
  const openPlRef = useRef(openPl);
  openTitleRef.current = openTitle;
  openPlRef.current = openPl;
  useEffect(() => {
    let stop = false;
    const kind = genreId === "cover-reborn" ? "cover" : "story";
    const tasks: { key: string; titles: string[] }[] = [];
    if (openPl) tasks.push({ key: `pl:${openPl}`, titles: [genreId === "cover-reborn" ? `playlist:cover:${openPl}` : `playlist:${openPl}`] });
    if (openTitle) {
      const row = songs.find((item) => (item.id || item.title) === openTitle);
      const titles = [...new Set([row?.pkg.songId, row?.title, openTitle].map((item) => String(item || "").trim()).filter(Boolean))];
      tasks.push({ key: `song:${openTitle}`, titles });
    }
    for (const task of tasks) {
      void (async () => {
        let fields: Record<string, string> | null = null;
        for (const title of task.titles) {
          try {
            const res = await readResultFile({ data: { kind, genreId, ep: "", act: 0, title } });
            if (stop) return;
            const plain = plainStory(res);
            if (plain?.ok === false || !plain?.fields || typeof plain.fields !== "object") continue;
            const next = plain.fields;
            if (!fields) {
              fields = { ...next };
              continue;
            }
            for (const [key, value] of Object.entries(next)) {
              const text = String(value ?? "");
              if (!String(fields[key] ?? "").trim() && text.trim()) fields[key] = text;
            }
          } catch {
            /* the next title may be the file */
          }
        }
        if (stop) return;
        if (!fields) return;
        setFileMap((prev) => ({ ...prev, [task.key]: fields || {} }));
      })();
    }
    return () => {
      stop = true;
    };
  }, [openPl, openTitle, genreId, songs]);
  useEffect(() => {
    const onLevel = (event: Event) => {
      const detail = (event as CustomEvent<{ storyId?: string; title?: string; text?: string; analysis?: string; url?: string }>).detail || {};
      const text = storyLevel(String(detail.text || ""));
      const analysis = storyAnalysis(String(detail.analysis || ""));
      if (!text && !analysis) return;
      const storyId = String(detail.storyId || "");
      const title = String(detail.title || "");
      if (text) {
        setHeardLevel((prev) => {
          const next = { ...prev };
          if (storyId) next[`song:${storyId}`] = text;
          if (title) next[`song:${title}`] = text;
          const openId = openTitleRef.current;
          if (openId && (openId === storyId || openId === title)) next[`song:${openId}`] = text;
          return next;
        });
      }
      if (analysis) {
        setHeardAnalysis((prev) => {
          const next = { ...prev };
          if (storyId) next[`song:${storyId}`] = analysis;
          if (title) next[`song:${title}`] = analysis;
          const openId = openTitleRef.current;
          if (openId && (openId === storyId || openId === title)) next[`song:${openId}`] = analysis;
          return next;
        });
      }
    };
    window.addEventListener("noa-audio-level", onLevel);
    return () => window.removeEventListener("noa-audio-level", onLevel);
  }, []);
  useEffect(() => {
    const entries = Object.entries(readAppDump().stories).filter(([key]) => {
      if (key.startsWith("playlist:")) return false;
      return cover ? key.startsWith("cover:") : !key.startsWith("cover:");
    });
    if (!entries.some(([, row]) => !(Number(row.registeredAt) > 0))) return;
    const ordered = listStorySongs(genreId);
    const known = entries.map(([, row]) => Number(row.registeredAt) || 0).filter((n) => n > 0);
    let floor = (known.length ? Math.min(...known) : Date.now()) - 1;
    const stamps = new Map<string, number>();
    for (const row of ordered) {
      if (!row) continue;
      const have = Number(readAppDump().stories[storyCacheKey(row.id, genreId)]?.registeredAt) || 0;
      if (have > 0) continue;
      stamps.set(row.id, floor);
      floor -= 1;
    }
    if (!stamps.size) return;
    patchApp((d) => {
      for (const [id, at] of stamps) {
        const row = d.stories[storyCacheKey(id, genreId)];
        if (!row || Number(row.registeredAt) > 0) continue;
        row.registeredAt = at;
      }
    }, false);
    setTick((n) => n + 1);
  }, [songs]);
  const storySaveMark = useRef<Record<string, string>>({});
  const originHold = useRef<Record<string, { title: string; vocal: string; lyrics: string; genre: string } | null>>({});
  const listHold = useRef<Record<string, string>>({});
  function noteOrigin(id: string, next: { title: string; vocal: string; lyrics: string; genre: string }, dirty: boolean) {
    const prev = originHold.current[id];
    const now = dirty ? next : null;
    const same = (prev == null) === (now == null) && (!now || !prev || (prev.title === now.title && prev.vocal === now.vocal && prev.lyrics === now.lyrics && prev.genre === now.genre));
    originHold.current[id] = now;
    if (!same) setTick((n) => n + 1);
  }
  const [linkDraft, setLinkDraft] = useState<Record<string, { youtubeUrl?: string; mvUrl?: string; sunoUrl?: string; audioAnalysis?: string; audioLevel?: string; ytPremium?: boolean; mvPremium?: boolean }>>({});
  const levelOwn = useRef<Record<string, true>>({});
  const analysisOwn = useRef<Record<string, true>>({});
  function savedLevel(key: string, pkgLevel: string, fileLevel: string, _sunoUrl = "") {
    const heard = heardLevel[key] || "";
    if (levelOwn.current[key]) return pkgLevel || "";
    return fileLevel || heard || pkgLevel || "";
  }
  function savedAnalysis(key: string, pkgAnalysis: string, fileAnalysis: string) {
    const heard = heardAnalysis[key] || "";
    if (analysisOwn.current[key]) return pkgAnalysis || "";
    return fileAnalysis || heard || pkgAnalysis || "";
  }
  function setLink(key: string, patch: { youtubeUrl?: string; mvUrl?: string; sunoUrl?: string; audioAnalysis?: string; audioLevel?: string; ytPremium?: boolean; mvPremium?: boolean }) {
    setLinkDraft((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }));
  }
  function clearLink(key: string) {
    setLinkDraft((cur) => {
      if (!cur[key]) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  }
  function linkView(key: string, saved: { youtubeUrl?: string; mvUrl?: string; sunoUrl?: string; audioAnalysis?: string; audioLevel?: string }, savedYt: boolean, savedMv: boolean) {
    const draft = linkDraft[key] || {};
    const youtubeUrl = draft.youtubeUrl ?? saved.youtubeUrl ?? "";
    const mvUrl = draft.mvUrl ?? saved.mvUrl ?? "";
    const sunoUrl = draft.sunoUrl ?? saved.sunoUrl ?? "";
    const audioAnalysis = draft.audioAnalysis ?? saved.audioAnalysis ?? "";
    const audioLevel = draft.audioLevel ?? saved.audioLevel ?? "";
    const ytPremium = draft.ytPremium ?? savedYt;
    const mvPremium = draft.mvPremium ?? savedMv;
    const dirty = youtubeUrl !== (saved.youtubeUrl ?? "") || mvUrl !== (saved.mvUrl ?? "") || sunoUrl !== (saved.sunoUrl ?? "") || audioAnalysis !== (saved.audioAnalysis ?? "") || audioLevel !== (saved.audioLevel ?? "") || ytPremium !== savedYt || mvPremium !== savedMv;
    return { youtubeUrl, mvUrl, sunoUrl, audioAnalysis, audioLevel, ytPremium, mvPremium, dirty };
  }
  const premiumHold = useRef<Record<string, { yt?: boolean; mv?: boolean }>>({});
  function storyPremiumKey(title: string, key: "ytPremium" | "mvPremium") {
    return `${genreId}:hq:${key === "ytPremium" ? "song" : "mv"}:${title.trim()}`;
  }
  function storyPremiumOn(title: string, pkg: StoryPackage, key: "ytPremium" | "mvPremium") {
    const bit = key === "ytPremium" ? "yt" : "mv";
    const held = premiumHold.current[title]?.[bit];
    if (held === true || held === false) return held;
    if (pkg[key] === false) return false;
    if (pkg[key] === true) return true;
    const stored = String(readAppDump().meta.youtube?.[storyPremiumKey(title, key)] || "");
    if (stored === "0") return false;
    if (stored === "1") return true;
    return true;
  }
  function pinStoryPremium(title: string, key: "ytPremium" | "mvPremium", on: boolean) {
    const metaKey = storyPremiumKey(title, key);
    patchApp((d) => {
      d.meta.youtube = { ...(d.meta.youtube ?? {}), [metaKey]: on ? "1" : "0" };
    });
    saveMetaNow();
  }
  function storyFileBody(pkg: StoryPackage): StoryPackage {
    const thumb = pkg.thumbUrl || "";
    if (thumb.startsWith("data:")) return { ...pkg, thumbUrl: "" };
    return pkg;
  }
  function withStoryPremium(title: string, pkg: StoryPackage): StoryPackage {
    return {
      ...pkg,
      ytPremium: storyPremiumOn(title, pkg, "ytPremium"),
      mvPremium: storyPremiumOn(title, pkg, "mvPremium"),
    };
  }
  const playlists = useMemo(() => listStoryPlaylists(genreId), [tick, confirmTick]);
  const shownSongs = useMemo(() => {
    const unassigned = songs
      .filter((row) => !playlists.some((pl) => storyInPlaylist(pl.songs, row.id, row.title, row.pkg.youtubeTitle)))
      .sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
    if (picking || !openPl) return applyAliasOrder(unassigned, readListOrder(`story:${genreId}:default`), storyOrderKeys);
    const pl = playlists.find((row) => row.id === openPl);
    if (!pl) return unassigned;
    const used = new Set<string>();
    const ordered: typeof songs = [];
    for (const name of pl.songs) {
      const hit = songs.find((row) => !used.has(row.id) && storyInPlaylist([name], row.id, row.title, row.pkg.youtubeTitle));
      if (!hit) continue;
      used.add(hit.id);
      ordered.push(hit);
    }
    return ordered;
  }, [songs, playlists, openPl, picking, genreId, tick]);
  const sortKey = openPl && !picking ? `story:${genreId}:pl:${openPl}` : `story:${genreId}:default`;
  const sortView = useMemo(() => {
    if (!sortOn || !sortDraft || sortDraft.key !== sortKey) return shownSongs;
    return applyAliasOrder(shownSongs, sortDraft.ids, storyOrderKeys);
  }, [shownSongs, sortOn, sortDraft, sortKey]);
  const sortDirty = Boolean(sortOn && sortDraft && sortDraft.key === sortKey && sortDraft.ids.join("|") !== shownSongs.map((row) => row.id).join("|"));
  const sortOrderRef = useRef<string[]>([]);
  sortOrderRef.current = sortView.map((row) => row.id);
  const startSort = useSortGesture(sortOn, (from, to) => {
    const ids = moveId(sortOrderRef.current, from, to);
    sortOrderRef.current = ids;
    setSortDraft({ key: sortKey, ids });
  });
  useEffect(() => {
    setSortDraft(null);
  }, [sortKey]);
  useEffect(() => {
    if (unlocked && !openPl && !picking) return;
    setSortOn(false);
    setSortDraft(null);
  }, [unlocked, openPl, picking]);
  const sortAllowed = unlocked && !openPl && !picking;
  function toggleStorySort() {
    if (!sortAllowed) return;
    setSortOn((on) => {
      const next = !on;
      if (next) {
        setPicking(false);
        setSortDraft({ key: sortKey, ids: shownSongs.map((row) => row.id) });
      }
      return next;
    });
  }
  function saveStorySort() {
    if (openPl || picking) return;
    const ids = sortView.map((row) => row.id);
    writeListOrder(`story:${genreId}:default`, ids);
    setSortDraft({ key: `story:${genreId}:default`, ids });
    setTick((n) => n + 1);
  }

  useEffect(() => {
    setUnlocked(isGateOpen());
    setAdminHere(isAdminDevice());
    const onGate = () => {
      setUnlocked(isGateOpen());
      setAdminHere(isAdminDevice());
    };
    const onApp = () => setTick((n) => n + 1);
    window.addEventListener(GATE_EVENT, onGate);
    window.addEventListener(APP_EVENT, onApp);
    window.addEventListener(PREF_EVENT, onApp);
    return () => {
      window.removeEventListener(GATE_EVENT, onGate);
      window.removeEventListener(APP_EVENT, onApp);
      window.removeEventListener(PREF_EVENT, onApp);
    };
  }, []);

  useEffect(() => {
    if (!unlocked) setMenu("list");
  }, [unlocked]);

  useEffect(() => {
    setPlDesc(false);
  }, [openPl]);

  useEffect(() => {
    void loadGenrePref({ data: { genreId: genreId } })
      .then((remote) => {
        if (!remote) return;
        writePref(genreId, normalizePref(genreId, remote), false);
      })
      .catch(() => {
        /* local */
      });
  }, []);

  useEffect(() => {
    const title = draft.title.trim();
    if (genreTitle.current !== title) {
      genreTitle.current = title;
      genreTouch.current = false;
    }
    if (genreTouch.current) return;
    setMusicGenre(draft.genre.trim());
  }, [draft.title, draft.genre]);

  function activeGenre() {
    const typed = musicGenre.trim();
    if (typed) return typed;
    if (genreTouch.current) return "";
    return draft.genre.trim();
  }

  function shownVocal() {
    const typed = draft.vocal.trim();
    if (typed) return typed;
    const picked = THUMB_CASTS.find((item) => item.id === thumbCast)?.label ?? "";
    if (!pkg?.sourceVocal?.trim() || thumbCast !== pkg.thumbCast) return picked;
    return pkg.sourceVocal.trim();
  }

  function thumbPrompt(prompt: string) {
    const genre = activeGenre();
    const base = prompt.trim();
    if (!genre) return base;
    const lock = `On-image genre line must be exactly "${genre}". Do not invent a different genre name.`;
    if (base.includes(lock)) return base;
    return `${lock}\n${base}`;
  }

  function followAfterClose(rowId: string, foldId: string) {
    const jump = (tries: number) => {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(rowId);
        const fold = document.getElementById(foldId);
        const open = Boolean(fold && fold.getBoundingClientRect().height > 80);
        if (el && (!open || tries === 0)) {
          followTop(el);
          return;
        }
        if (tries > 0) window.setTimeout(() => jump(tries - 1), 60);
      });
    };
    window.setTimeout(() => jump(12), 40);
  }

  function foldDomId(title: string) {
    return `story-fold-${encodeURIComponent(title)}`;
  }

  function foldKeyFor(title: string) {
    return unlocked ? `story:${title}` : `story-desc:${title}`;
  }

  function openStoryResult(title: string) {
    queueFoldTop(foldDomId(title));
    setOpenTitle(title);
  }

  function closeStoryResult(title: string) {
    closeFold(foldKeyFor(title), document.getElementById(foldDomId(title)));
    setOpenTitle("");
  }

  function storyWorkFields() {
    const flags: Record<string, keyof OutputShow> = {
      summary: "summary",
      title: "title",
      lyrics: "lyrics",
      suno: "suno",
      thumb: "thumb",
      "yt-title": "ytTitle",
      "yt-desc": "ytDesc",
      letter: "letter",
    };
    const ids: string[] = [];
    for (const id of outputBlockIds(kpopPref.outputOrder)) {
      const flag = flags[id];
      if (!flag || storyListOutput[flag] === false) continue;
      ids.push(id);
    }
    return ids.length ? ids : ["suno"];
  }

  function followStoryGroup(ids: string[]) {
    const go = (attempt = 0) => {
      const nodes = ids.map((id) => document.getElementById(`field-${id}`)).filter((node): node is HTMLElement => Boolean(node));
      if (!nodes.length || nodes.length < ids.length) {
        if (attempt < 20) window.setTimeout(() => go(attempt + 1), 80);
        return;
      }
      showWorkGroup(nodes);
    };
    window.setTimeout(() => go(0), 40);
  }

  function followActions(id: string) {
    const go = (attempt = 0) => {
      const el = document.getElementById(id);
      if (!el) {
        if (attempt < 12) window.setTimeout(() => go(attempt + 1), 90);
        return;
      }
      placeFillField(el);
      if (attempt < 4) window.setTimeout(() => go(attempt + 1), 220);
    };
    window.setTimeout(() => go(0), 60);
  }

  function followStoryField(blockId: string) {
    const go = (attempt = 0) => {
      const el = document.getElementById(`field-${blockId}`);
      if (!el) {
        if (attempt < 20) window.setTimeout(() => go(attempt + 1), 80);
        return;
      }
      placeFillField(el);
    };
    window.setTimeout(() => go(0), 40);
  }

  async function onGenerate() {
    if (busy || !draft.title.trim() || !draft.lyrics.trim()) return;
    if (cover && !draft.genre.trim()) {
      setError("원곡 가수를 입력하세요.");
      return;
    }
    const title = draft.title.trim();
    setError(null);
    const songId = freshStoryId();
    const shell: StoryPackage = {
      ...emptyStory(),
      songId,
      sourceLyrics: draft.lyrics.trim(),
      sourceVocal: shownVocal(),
      sourceGenre: activeGenre(),
      thumbCast,
    };
    storeStory(shell, title);
    setPkg(shell);
    setTick((n) => n + 1);
    setMenu("list");
    setOpenPl("");
    setOpenTitle(songId);
    setBusy(true);
    const ids = storyWorkFields();
    setWorkIds(ids);
    setFillFocus(ids[0] ? { id: ids[0], phase: "work" } : null);
    followStoryGroup(ids);
    const filed = await saveStoryPage({ data: { genreId, title, body: shell } }).catch(() => null);
    if (!filed?.ok) setError("곡 파일을 저장하지 못했습니다. 목록에는 남겨 둡니다.");
    const ac = new AbortController();
    genAbort.current = ac;
    try {
      const result = await generateStory({
        data: {
          title,
          lyrics: draft.lyrics.trim(),
          genre: activeGenre(),
          genreId,
          vocal: draft.vocal.trim(),
          prefs: pref,
          thumbCast,
          skipThumb: true,
        },
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!result.ok) {
        setError(koreanFillError(result.error));
        return;
      }
      const merged: StoryPackage = {
        ...result.pkg,
        songId,
        sourceLyrics: draft.lyrics.trim(),
        sourceVocal: shownVocal(),
        sourceGenre: activeGenre(),
        thumbCast,
        youtubeUrl: shell.youtubeUrl || "",
        sunoUrl: shell.sunoUrl || "",
        mvUrl: shell.mvUrl || "",
        ytPremium: shell.ytPremium,
        mvPremium: shell.mvPremium,
      };
      setPkg(merged);
      storeStory(merged, title);
      setTick((n) => n + 1);
      followActions(`story-actions-${encodeURIComponent(songId)}`);
      const saved = await saveStoryPage({ data: { genreId, title, body: merged } });
      if (!serverOk(saved)) setError("저장하지 못했습니다.");
    } catch {
      if (ac.signal.aborted) return;
      setError("만들지 못했습니다.");
    } finally {
      if (genAbort.current === ac) genAbort.current = null;
      setBusy(false);
      setFillFocus(null);
      setWorkIds([]);
    }
  }

  function keepDraft(next: StoryPackage) {
    const cur = pkg?.songId ? pkg : emptyStory();
    const pageLocks = { ...readLocks("story", cur.songId || storyId, lockSpace), ...locks };
    const carry = next as StoryPackage & { savedKeys?: string[]; blankFields?: string[] };
    const savedKeys = Array.isArray(carry.savedKeys) ? carry.savedKeys.filter((key) => typeof key === "string") : null;
    const blankFields = Array.isArray(carry.blankFields) ? carry.blankFields.filter((key) => typeof key === "string") : null;
    next = takeLockedStory(cur, next, pageLocks);
    next = {
      ...next,
      songId: cur.songId || next.songId,
      sourceLyrics: draft.lyrics.trim() || next.sourceLyrics || cur.sourceLyrics || "",
      sourceVocal: shownVocal(),
      sourceGenre: activeGenre(),
      thumbCast,
      youtubeUrl: cur.youtubeUrl || next.youtubeUrl || "",
      sunoUrl: cur.sunoUrl || next.sunoUrl || "",
      mvUrl: cur.mvUrl || next.mvUrl || "",
      ytPremium: cur.ytPremium ?? next.ytPremium,
      mvPremium: cur.mvPremium ?? next.mvPremium,
    };
    const screen = { ...next } as StoryPackage & { savedKeys?: string[]; blankFields?: string[] };
    delete screen.savedKeys;
    delete screen.blankFields;
    setPkg(screen);
    if (!next.songId) return;
    const body = { ...screen, ...(savedKeys ? { savedKeys } : {}), ...(blankFields ? { blankFields } : {}) } as StoryPackage;
    storeStory(body, draft.title);
    if (draft.title.trim() && (next.youtubeTitle.trim() || next.geminiPrompt.trim() || next.youtubeDescription.trim())) {
      void saveStoryPage({ data: { genreId, title: draft.title.trim(), body } }).catch(() => {
        /* local page still filled */
      });
    }
  }

  function toggleLock(id: string) {
    if (masterLocked()) {
      setError("메인 자물쇠가 잠겨 있어 잠그거나 풀 수 없습니다.");
      return;
    }
    const text = pkg
      ? String(
          (
            {
              thumb: pkg.geminiPrompt,
              "yt-title": pkg.youtubeTitle,
              "yt-desc": pkg.youtubeDescription,
              letter: pkg.fanLetter,
              suno: pkg.sunoStyle,
            } as Record<string, string>
          )[id] ?? "",
        )
      : "";
    const next = { ...locks, [id]: !isLocked(locks, id) };
    setLocks(next);
    writeLocks("story", storyId, lockSpace, next);
  }

  async function onRegen(blockId: string, note: string) {
    if (note === "취소" || busyBlock === blockId || ((busy || fillingStory) && workIds.includes(blockId))) {
      stopStoryWork();
      return;
    }
    if (!pkg) {
      setError("이 결과 칸을 열지 못했습니다. 곡을 다시 연 뒤 재생성을 누르세요.");
      return;
    }
    if (busy || busyBlock) {
      setError("다른 칸을 쓰는 중입니다. 그 칸에서 취소를 누르세요.");
      return;
    }
    if (isLocked(locks, blockId)) {
      if (!isAdminDevice()) {
        setError("확정된 결과는 최고관리자만 고칩니다.");
        return;
      }
      const next = { ...locks, [blockId]: false };
      setLocks(next);
      writeLocks("story", storyId, lockSpace, next);
    }
    const run = armRegen(blockId);
    beginBlockWork(blockId, draft.title.trim() || songName);
    try {
      const result = await generateStoryBlock({
        data: {
          blockId,
          note,
          title: draft.title.trim(),
          lyrics: draft.lyrics.trim(),
          genre: activeGenre(),
          genreId,
          story: pkg,
          prefs: pref,
        },
        signal: run.signal,
      });
      if (!regenStill(run.job)) return;
      if (!result.ok) {
        setError(koreanFillError(result.error));
        return;
      }
      forgetFieldDraft(`story:${genreId}:${storyId}`, blockId);
      keepDraft(result.pkg);
    } catch (err) {
      if (!regenStill(run.job)) return;
      setError(koreanFillError(err instanceof Error ? err.message : ""));
    } finally {
      if (regenStill(run.job)) {
        regenAbort.current = null;
        setBusyBlock(null);
      }
    }
  }

  function onPatch(id: string, text: string) {
    if (isLocked(locks, id)) {
      const nextLocks = { ...locks, [id]: false };
      setLocks(nextLocks);
      writeLocks("story", storyId, lockSpace, nextLocks);
    }
    const fieldKey = ({ thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", suno: "sunoStyle" } as Record<string, string>)[id];
    if (!fieldKey) return "이 칸을 저장하지 못했습니다.";
    const next = patchStory(pkg ?? emptyStory(), id, text);
    if (!next) return "이 칸을 저장하지 못했습니다.";
    const marked = {
      ...next,
      savedKeys: [fieldKey],
      ...(String(text || "").trim() ? {} : { blankFields: [fieldKey] }),
    } as StoryPackage;
    keepDraft(marked);
    const title = draft.title.trim();
    const kind = cover ? "cover" : "story";
    const vocal = cover ? shownVocal() : "";
    void (async () => {
      try {
        await saveResultFields({ data: { kind, genreId, ep: "", act: 0, title, vocal, fields: { [fieldKey]: text }, blank: !String(text || "").trim() } });
      } catch {
        /* the file read below decides */
      }
      let read: { ok?: boolean; fields?: Record<string, string> } | null = null;
      try {
        read = plainStory(await readResultFile({ data: { kind, genreId, ep: "", act: 0, title, vocal } }));
      } catch {
        read = null;
      }
      const got = String(read?.fields?.[fieldKey] ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
      const want = String(text ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
      const matched = Boolean(read && read.ok !== false && read.fields && got === want);
      window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: matched } }));
      if (!matched) setError("이 칸을 파일에 남기지 못했습니다.");
    })();
  }

  async function applyThumb(prompt: string) {
    if (busyBlock === "thumb-img") {
      cancelRegen();
      return;
    }
    if (isLocked(locks, "thumb")) return;
    if (busyBlock) return;
    if (!prompt.trim()) {
      setError("제미나이 프롬프트가 없습니다.");
      return;
    }
    const run = armRegen("thumb-img");
    beginBlockWork("thumb-img", draft.title.trim() || songName);
    try {
      const result = await renderThumb({
        data: { prompt: thumbPrompt(prompt), story: true, thumbCast },
        signal: run.signal,
      });
      if (!regenStill(run.job)) return;
      if (!result.ok) {
        setError(koreanFillError(result.error));
        return;
      }
      keepDraft({ ...(pkg ?? emptyStory()), geminiPrompt: prompt, thumbUrl: result.url, thumbCast });
    } catch {
      if (!regenStill(run.job)) return;
      setError("썸네일을 만들지 못했습니다.");
    } finally {
      if (regenStill(run.job)) {
        regenAbort.current = null;
        setBusyBlock(null);
      }
    }
  }

  async function onRegenImage() {
    if (busyBlock === "thumb-img") {
      cancelRegen();
      return;
    }
    if (!pkg || busy || busyBlock) return;
    await applyThumb(pkg.geminiPrompt);
  }

  const canRun = Boolean(draft.title.trim() && draft.lyrics.trim() && (!cover || draft.genre.trim()));

  function storyHasResult(row: StoryPackage) {
    return Boolean(
      row.geminiPrompt.trim() ||
      row.youtubeTitle.trim() ||
      row.youtubeDescription.trim() ||
      row.fanLetter.trim() ||
      row.sunoStyle.trim() ||
      (row.sourceLyrics || "").trim()
    );
  }

  function togglePick(title: string) {
    setPicked((cur) => (cur.includes(title) ? cur.filter((item) => item !== title) : [...cur, title]));
  }

  function makePlaylist() {
    const chosen = picked
      .map((id) => songs.find((row) => row.id === id))
      .filter((row): row is (typeof songs)[number] => Boolean(row));
    if (!chosen.length || !theme.trim()) return;
    const id = `${Date.now()}`;
    const ids = chosen.map((row) => row.id);
    const labels = chosen.map((row) => row.title);
    writeStoryPlaylist({
      id,
      theme: theme.trim(),
      songs: ids,
      pkg: localStoryPlaylist({
        theme: theme.trim(),
        songs: labels.map((title) => ({ title })),
        prefs: pref,
        thumbCast,
        genreId,
      }),
    }, genreId);
    setPicking(false);
    setPicked([]);
    setTheme("");
    setOpenPl(id);
    setPlResult(false);
    setPlMenu(false);
    setOpenTitle("");
    setTick((n) => n + 1);
  }

  function storyPlaylistRow(id: string) {
    return listStoryPlaylists(genreId).find((row) => row.id === id) ?? null;
  }

  function saveStoryPlaylistPkg(id: string, pkg: PlaylistPackage, byUser = false) {
    const row = storyPlaylistRow(id);
    if (!row) return false;
    if (!byUser && isConfirmed("playlist", genreId, id) && !isAdminDevice()) return false;
    writeStoryPlaylist({ ...row, pkg }, genreId);
    setTick((n) => n + 1);
    return true;
  }

  async function regenStoryPlaylist(id: string, blockId: string, note: string) {
    if (note === "취소" || busyBlock === blockId) {
      stopStoryWork();
      return;
    }
    const row = storyPlaylistRow(id);
    if (!row) return;
    if (isConfirmed("playlist", genreId, id) && !isAdminDevice()) {
      setError("확정된 결과는 최고관리자만 고칩니다.");
      return;
    }
    if (busy || busyBlock) return;
    const run = armRegen(blockId);
    beginBlockWork(blockId, row.theme || "플레이리스트");
    setError(null);
    setFillFocus({ id: blockId, phase: "work" });
    followStoryField(blockId);
    try {
      const result = await generateBlock({
        data: {
          kind: "playlist",
          act: 1,
          genreId: genreId,
          blockId,
          note,
          storyPlaylist: true,
          theme: row.theme,
          extraTracks: row.songs,
          playlist: row.pkg,
          prefs: pref,
          skipThumb: true,
        },
        signal: run.signal,
      });
      if (!regenStill(run.job)) return;
      if (!result?.ok || result.kind !== "playlist") {
        setError(koreanFillError(result?.error || "이 칸을 쓰지 못했습니다. 있던 글은 그대로 둡니다."));
        return;
      }
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
      )[blockId];
      const wrote = key ? String(result.pkg?.[key] || "").trim() : "";
      if (!key || !wrote) {
        setError("이 칸을 쓰지 못했습니다. 있던 글은 그대로 둡니다.");
        return;
      }
      const next = patchPlaylistPkg(row.pkg, blockId, result.pkg[key]);
      if (!next) return;
      if (blockId === "tracks") next.tracklistEdited = true;
      if (blockId === "yt-desc") next.descEdited = true;
      saveStoryPlaylistPkg(id, next);
    } catch (err) {
      if (!regenStill(run.job)) return;
      setError(koreanFillError(err instanceof Error ? err.message : ""));
    } finally {
      if (regenStill(run.job)) {
        regenAbort.current = null;
        setBusyBlock(null);
        setFillFocus(null);
        setFillLabel("");
      }
    }
  }

  function assignStoryPlaylist(id: string, display: string, youtubeTitle: string, targetId: string) {
    const current = playlists.find((pl) => storyInPlaylist(pl.songs, id, display, youtubeTitle))?.id || "";
    if (current === targetId) return true;
    if (targetId && !playlists.some((pl) => pl.id === targetId)) return false;
    if (!isAdminDevice() && ((current && isConfirmed("playlist", genreId, current)) || (targetId && isConfirmed("playlist", genreId, targetId)))) {
      setError(adminSealDenied());
      return false;
    }
    for (const pl of playlists) {
      const kept = pl.songs.filter((name) => !storyInPlaylist([name], id, display, youtubeTitle));
      const next = pl.id === targetId && !kept.includes(id) ? [id, ...kept] : kept;
      const track = next.map((token) => storySongLabel(token)).filter(Boolean).join("\n");
      const confirmed = isConfirmed("playlist", genreId, pl.id);
      if (next.join("\n") === pl.songs.join("\n") && (confirmed || track === (pl.pkg.tracklist || ""))) continue;
      writeStoryPlaylist({
        ...pl,
        songs: next,
        pkg: confirmed ? pl.pkg : { ...pl.pkg, tracklist: track },
      }, genreId);
    }
    setOpenPl(targetId);
    setPlMenu(false);
    setPlResult(false);
    setOpenTitle(id);
    queueFoldTop(`story-fold-${encodeURIComponent(id)}`);
    setTick((n) => n + 1);
    return true;
  }

  async function confirmStory(id: string, row: StoryPackage) {
    if (masterLocked()) {
      setError("메인 자물쇠가 잠겨 있어 확정할 수 없습니다.");
      return;
    }
    const display = songs.find((item) => item.id === id)?.title || id;
    const on = isConfirmed("story", genreId, id);
    if (!isAdminDevice()) {
      setError(adminSealDenied());
      return;
    }
    if (!on && !storyHasResult(row)) {
      setError("결과가 없어 확정할 수 없습니다.");
      return;
    }
    if (!on) {
      const saved = await saveStoryPage({ data: { genreId, title: display, body: row } });
      if (!serverOk(saved)) {
        setError("곡 파일을 남기지 못했습니다. 확정하지 않았습니다.");
        return;
      }
      storeStory(row, display, { persist: false });
    }
    const pending = writeConfirmed("story", genreId, id, !on);
    setConfirmTick((n) => n + 1);
    if (!on) {
      closeStoryResult(id);
      followAfterClose(`story-row-${encodeURIComponent(id)}`, foldDomId(id));
    }
    const flag = await pending;
    if (!flag.ok) {
      setError(on ? "확정 해제를 남기지 못했습니다." : "곡은 저장했습니다. 확정 표시를 남기지 못했습니다.");
    }
  }

  const storyFillFields: { id: string; key: keyof StoryPackage; label: string; flag: keyof OutputShow }[] = [
    { id: "thumb", key: "geminiPrompt", label: "썸네일", flag: "thumb" },
    { id: "yt-title", key: "youtubeTitle", label: "유튜브 제목", flag: "ytTitle" },
    { id: "yt-desc", key: "youtubeDescription", label: "설명", flag: "ytDesc" },
    { id: "letter", key: "fanLetter", label: "커뮤니티", flag: "letter" },
    { id: "suno", key: "sunoStyle", label: "SUNO", flag: "suno" },
  ];

  function fillTarget() {
    if (menu === "list" && openTitle) {
      const row = songs.find((item) => item.id === openTitle);
      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        pkg: row.pkg,
        lyrics: row.pkg.sourceLyrics || "",
        genre: row.pkg.sourceGenre || "",
        cast: row.pkg.thumbCast || defaultThumbCast(genreId),
        locks: readLocks("story", row.id, lockSpace),
        output: kpopPref.output,
        where: "list" as const,
      };
    }
    const title = draft.title.trim();
    if (menu === "input" && title) {
      const cur = pkg?.songId ? pkg : emptyStory();
      return {
        id: cur.songId || "",
        title,
        pkg: cur,
        lyrics: draft.lyrics.trim() || cur.sourceLyrics || "",
        genre: activeGenre(),
        cast: thumbCast,
        locks,
        output: kpopPref.output,
        where: "input" as const,
      };
    }
    return null;
  }

  function storyKind(field: (typeof storyFillFields)[number], row: StoryPackage, genre: string, songTitle = "") {
    const text = String(row[field.key] ?? "").trim();
    if (!text) return "empty" as const;
    const rule = readFieldAudit(pref);
    if (field.id === "thumb") {
      if (text.length < rule.thumbMin || /USER SETTINGS LOCK/i.test(text)) return "rewrite" as const;
      if (genre && !text.includes(genre)) return "revise" as const;
      return "ok" as const;
    }
    if (field.id === "yt-title") {
      if (text.length < rule.ytMin || text.length > rule.ytMax) return "rewrite" as const;
      if (/EP\s*\.?\s*\d|AI Artist Noa|확정 제목|장르라벨/i.test(text)) return "rewrite" as const;
      if (cover && !text.endsWith(COVER_TITLE_CREDIT)) return "revise" as const;
      if (cover && songTitle && genre && text.startsWith(`${songTitle} | ${genre}`)) return "revise" as const;
      const slots = (pref.titleFormat || "").split("|").map((part) => part.trim()).filter(Boolean).length;
      const parts = text.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
      if (slots > 1 && parts.length < slots) return "revise" as const;
      return "ok" as const;
    }
    if (field.id === "yt-desc") {
      const prose = descriptionWithoutLyrics(text).trim();
      const paras = prose.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      if (prose.length < rule.descMin || paras.length < rule.descParas) return "rewrite" as const;
      if (rule.descEmoji && !/\p{Extended_Pictographic}/u.test(prose)) return "revise" as const;
      if (pref.descLyrics) {
        if (!/━{4,}/.test(text) || /\[[^\]]*(?:Verse|Chorus|Intro|Bridge|Outro)[^\]]*\]/i.test(text)) return "revise" as const;
      } else if (/━{4,}/.test(text)) return "revise" as const;
      return "ok" as const;
    }
    if (field.id === "letter") {
      const paras = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      if (text.length < rule.letterMin || paras.length < rule.letterParas) return "rewrite" as const;
      if (rule.letterEmoji && !/\p{Extended_Pictographic}/u.test(text)) return "revise" as const;
      return "ok" as const;
    }
    if (field.id === "suno") {
      if (text.length < rule.sunoMin || text.length > rule.sunoMax) return "rewrite" as const;
      return "ok" as const;
    }
    return "ok" as const;
  }

  function storyWork(target: NonNullable<ReturnType<typeof fillTarget>>, note: string) {
    const ask = note.trim();
    const rank = new Map(outputBlockIds(kpopPref.outputOrder || pref.outputOrder).map((id, index) => [id, index]));
    const fields = [...storyFillFields].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
    const out: { id: string; label: string; action: string; fix: "empty" | "rewrite" | "revise" | "request" }[] = [];
    for (const field of fields) {
      if (target.output[field.flag] === false) continue;
      if (field.flag === "letter" && pref.community === false) continue;
      if (isLocked(target.locks, field.id)) continue;
      const kind = storyKind(field, target.pkg, target.genre, target.title);
      if (kind === "empty") out.push({ id: field.id, label: field.label, action: "생성", fix: "empty" });
      else if (kind === "rewrite") out.push({ id: field.id, label: field.label, action: "재생성", fix: "rewrite" });
      else if (kind === "revise") out.push({ id: field.id, label: field.label, action: "보완", fix: "revise" });
      else if (ask) out.push({ id: field.id, label: field.label, action: "요구", fix: "request" });
    }
    return out;
  }

  function startStoryFill() {
    if (masterLocked() || fillingStory || busy || busyBlock) return;
    const target = fillTarget();
    if (!target) {
      setError("채울 곡을 목록에서 열거나, 입력에 제목을 적어 주세요.");
      return;
    }
    if (isConfirmed("story", genreId, target.title)) {
      setError(`확정된 ${songName}은 채우지 않습니다.`);
      return;
    }
    if (!target.lyrics.trim() && !target.pkg.geminiPrompt.trim() && !target.pkg.youtubeTitle.trim() && !target.pkg.youtubeDescription.trim()) {
      setError("가사나 생성된 결과가 없습니다.");
      return;
    }
    setReviewNote("");
    setReviewItems(storyWork(target, ""));
    setError(null);
    setReviewOpen(true);
  }

  function withStorySource(base: StoryPackage, next: StoryPackage, where: "list" | "input"): StoryPackage {
    if (where === "input") {
      return {
        ...next,
        songId: base.songId || next.songId,
        sourceLyrics: draft.lyrics.trim() || next.sourceLyrics || base.sourceLyrics || "",
        sourceVocal: shownVocal(),
        sourceGenre: activeGenre(),
        thumbCast,
        youtubeUrl: base.youtubeUrl || next.youtubeUrl || "",
        sunoUrl: base.sunoUrl || next.sunoUrl || "",
        mvUrl: base.mvUrl || next.mvUrl || "",
        ytPremium: base.ytPremium ?? next.ytPremium,
        mvPremium: base.mvPremium ?? next.mvPremium,
      };
    }
    return {
      ...next,
      songId: base.songId || next.songId,
      sourceLyrics: base.sourceLyrics || "",
      sourceVocal: base.sourceVocal || "",
      sourceGenre: base.sourceGenre || "",
      thumbCast: base.thumbCast,
      thumbUrl: next.thumbUrl || base.thumbUrl || "",
      youtubeUrl: base.youtubeUrl || next.youtubeUrl || "",
      sunoUrl: base.sunoUrl || next.sunoUrl || "",
      mvUrl: base.mvUrl || next.mvUrl || "",
      ytPremium: base.ytPremium ?? next.ytPremium,
      mvPremium: base.mvPremium ?? next.mvPremium,
    };
  }

  async function saveListedStory(id: string, next: StoryPackage) {
    const row = songs.find((item) => item.id === id);
    const cachedTitle = readAppDump().stories[storyCacheKey(id, genreId)]?.title?.trim() || "";
    const display = row?.title || (cachedTitle && cachedTitle !== id ? cachedTitle : "") || id;
    const songId = (next.songId || row?.pkg.songId || "").trim();
    const stored: StoryPackage = songId ? { ...next, songId } : next;
    storeStory(stored, display);
    if (openTitle === id) setPkg(stored);
    setTick((n) => n + 1);
    let saved: { ok?: boolean } | null = null;
    try {
      saved = await saveStoryPage({ data: { genreId, title: display, body: storyFileBody(stored) } });
    } catch {
      saved = null;
    }
    if (serverOk(saved)) return true;
    const kind = genreId === "cover-reborn" ? "cover" : "story";
    const stuck = await stickStoryFile(kind, genreId, display, stored as unknown as Record<string, unknown>, []);
    return stuck.ok;
  }

  async function paintStoryThumb(title: string, row: StoryPackage, prompt: string): Promise<StoryPackage> {
    const genre = (row.sourceGenre || "").trim();
    const lock = genre ? `On-image genre line must be exactly "${genre}". Do not invent a different genre name.` : "";
    const locked = lock && !prompt.includes(lock) ? `${lock}\n${prompt}` : prompt;
    const image = await renderThumb({
      data: { prompt: locked, story: true, thumbCast: row.thumbCast || defaultThumbCast(genreId) },
    });
    if (!image?.ok || !image.url) return row;
    return { ...row, geminiPrompt: prompt, thumbUrl: image.url };
  }

  async function runStoryFill() {
    if (fillingStory) return;
    const found = fillTarget();
    if (!found || masterLocked()) {
      setReviewOpen(false);
      return;
    }
    let target = found;
    if (target.where === "input") {
      const songId = target.pkg.songId || freshStoryId();
      const shell: StoryPackage = {
        ...(target.pkg.songId ? target.pkg : emptyStory()),
        songId,
        sourceLyrics: draft.lyrics.trim(),
        sourceVocal: shownVocal(),
        sourceGenre: activeGenre(),
        thumbCast,
      };
      target = { ...target, id: songId, pkg: shell, lyrics: shell.sourceLyrics || "", genre: shell.sourceGenre || "", cast: thumbCast };
    }
    if (isConfirmed("story", genreId, target.id)) {
      setReviewOpen(false);
      setError(`확정된 ${songName}은 채우지 않습니다.`);
      return;
    }
    const work = storyWork(target, reviewNote);
    if (!work.length) return;
    if (target.where === "input") {
      storeStory(target.pkg, target.title);
      setPkg(target.pkg);
      setTick((n) => n + 1);
      setMenu("list");
    }
    setReviewOpen(false);
    storyFillStop.current = false;
    if (openTitle !== target.id) openStoryResult(target.id);
    setFillingStory(true);
    setError(null);
    setWorkIds([]);
    setFillPct(work.length ? Math.max(6, Math.round(30 / work.length)) : 0);
    let cur = target.pkg;
    const ask = reviewNote.trim();
    const missed: string[] = [];
    try {
      for (let index = 0; index < work.length; index += 1) {
        const item = work[index];
        if (storyFillStop.current) break;
        if (isConfirmed("story", genreId, target.id)) break;
        const field = storyFillFields.find((row) => row.id === item.id);
        if (!field || isLocked(readLocks("story", target.id, lockSpace), field.id)) continue;
        const before = String(cur[field.key] ?? "").trim();
        if (item.fix === "empty" && before) continue;
        setFillFocus({ id: field.id, phase: "work" });
        setWorkIds([field.id]);
        setFillLabel(`${field.label} ${item.action}`);
        setFillPct(Math.round(((index + 0.35) / work.length) * 100));
        followStoryField(field.id);
        const ac = new AbortController();
        genAbort.current = ac;
        const base =
          item.fix === "request"
            ? "이 칸은 기준을 통과했다. 사용자 요구사항이 이 칸에 해당하면 그 부분만 고친다. 해당하지 않으면 현재 글을 그대로 유지한다. 다른 칸은 유지."
            : item.fix === "empty"
              ? "이 칸만 비어 있다. 다른 칸은 유지하고 이 칸만 처음부터 완성본을 작성."
              : item.fix === "rewrite"
                ? "이 항목은 규칙에 맞지 않다. 현재값은 버리고 처음부터 다시 작성. 다른 항목은 유지."
                : "이 항목은 이미 만들어져 있으나 부실하거나 규칙에 덜 맞다. 현재 글을 버리지 말고 부족한 부분만 보완해서 완성한다. 잘 된 문장과 구조는 유지. 다른 항목은 유지.";
        const result = await generateStoryBlock({
          data: {
            blockId: field.id,
            note: ask ? `${base}\n사용자 요구사항: ${ask}` : base,
            title: target.title,
            lyrics: target.lyrics,
            genre: target.genre,
            genreId,
            story: cur,
            prefs: pref,
          },
          signal: ac.signal,
        });
        if (ac.signal.aborted || storyFillStop.current) break;
        if (!result?.ok) {
          missed.push(field.label);
          continue;
        }
        const incoming = String(result.pkg?.[field.key] ?? "").trim();
        if (!incoming || (item.fix === "request" && incoming === before)) continue;
        if (incoming === before && item.fix !== "request") {
          missed.push(field.label);
          continue;
        }
        let next = withStorySource(cur, { ...cur, [field.key]: result.pkg[field.key] }, target.where);
        if (field.id === "thumb" && incoming !== before) {
          try {
            next = await paintStoryThumb(target.title, next, incoming);
          } catch {
            /* prompt stays */
          }
        }
        const saved = await saveListedStory(target.id, next);
        if (!saved) {
          setError("저장하지 못했습니다.");
          break;
        }
        cur = next;
      }
      if (!storyFillStop.current) followActions(`story-actions-${encodeURIComponent(target.id)}`);
      if (missed.length) setError(`${missed.join(", ")}은 그대로 둡니다.`);
    } catch {
      setError("채우지 못했습니다. 있던 글은 그대로 둡니다.");
    } finally {
      setFillingStory(false);
      setFillLabel("");
      setFillPct(0);
      setFillFocus(null);
      setWorkIds([]);
      clearFillFit();
    }
  }

  async function regenListedStory(id: string) {
    if (busy || busyBlock || fillingStory) {
      setError("지금 다른 작업을 끝내고 다시 생성을 누르세요.");
      return;
    }
    if (isConfirmed("story", genreId, id) && !isAdminDevice()) {
      setError("확정된 결과는 최고관리자만 다시 만듭니다.");
      return;
    }
    const row = songs.find((item) => item.id === id);
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      const result = await generateStory({
        data: {
          title: row.title,
          lyrics: row.pkg.sourceLyrics || "",
          genre: row.pkg.sourceGenre || "",
          genreId,
          vocal: row.pkg.sourceVocal || "",
          prefs: pref,
          thumbCast: row.pkg.thumbCast,
          skipThumb: true,
        },
      });
      if (!result.ok) {
        setError(koreanFillError(result.error));
        return;
      }
      const next = withStorySource(row.pkg, {
        ...result.pkg,
        songId: row.pkg.songId,
        sourceLyrics: row.pkg.sourceLyrics,
        sourceVocal: row.pkg.sourceVocal,
        sourceGenre: row.pkg.sourceGenre,
        youtubeUrl: row.pkg.youtubeUrl,
        sunoUrl: row.pkg.sunoUrl,
        mvUrl: row.pkg.mvUrl,
        ytPremium: row.pkg.ytPremium,
        mvPremium: row.pkg.mvPremium,
        thumbCast: row.pkg.thumbCast,
      }, "list");
      const saved = await saveListedStory(id, next);
      if (!saved) setError("저장하지 못했습니다.");
    } catch {
      setError("만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function regenListBlock(id: string, blockId: string, note: string) {
    if (note === "취소" || busyBlock === blockId || ((busy || fillingStory) && workIds.includes(blockId))) {
      stopStoryWork();
      return;
    }
    if (masterLocked() || fillingStory) {
      setError("지금 다른 작업을 끝내고 다시 생성을 누르세요.");
      return;
    }
    if (isConfirmed("story", genreId, id) && !isAdminDevice()) {
      setError("확정된 결과는 최고관리자만 고칩니다.");
      return;
    }
    const row = songs.find((item) => item.id === id);
    if (!row) return;
    if (isLocked(readLocks("story", id, lockSpace), blockId)) {
      setError("잠긴 칸은 다시 쓰지 않습니다.");
      return;
    }
    if (busyBlock === blockId) {
      cancelRegen();
      return;
    }
    if (busy || busyBlock || fillingStory || masterLocked()) {
      setError("지금 다른 작업을 끝내고 다시 생성을 누르세요.");
      return;
    }
    const field = storyFillFields.find((item) => item.id === blockId);
    if (!field) return;
    const run = armRegen(blockId);
    beginBlockWork(blockId, cover ? coverListName(row.title, row.pkg.sourceGenre || "") : row.title);
    setError(null);
    setFillFocus({ id: blockId, phase: "work" });
    followStoryField(blockId);
    try {
      const result = await generateStoryBlock({
        data: {
          blockId,
          note: note.trim() || "이 칸만 다시 쓴다. 다른 칸은 유지.",
          title: row.title,
          lyrics: row.pkg.sourceLyrics || "",
          genre: row.pkg.sourceGenre || "",
          genreId,
          story: row.pkg,
          prefs: pref,
        },
        signal: run.signal,
      });
      if (!regenStill(run.job)) return;
      if (!result?.ok) {
        setError(koreanFillError(result?.error || "이 칸을 쓰지 못했습니다. 있던 글은 그대로 둡니다."));
        return;
      }
      const incoming = String(result.pkg?.[field.key] ?? "").trim();
      if (!incoming) {
        setError("이 칸을 쓰지 못했습니다. 있던 글은 그대로 둡니다.");
        return;
      }
      const next = withStorySource(row.pkg, { ...row.pkg, [field.key]: result.pkg[field.key] }, "list");
      const saved = await saveListedStory(id, next);
      if (!saved) setError("저장하지 못했습니다.");
    } catch (err) {
      if (!regenStill(run.job)) return;
      setError(koreanFillError(err instanceof Error ? err.message : ""));
    } finally {
      if (regenStill(run.job)) {
        regenAbort.current = null;
        setBusyBlock(null);
        setFillFocus(null);
        setFillLabel("");
      }
    }
  }

  async function regenListImage(id: string) {
    if (masterLocked() || fillingStory) return;
    if (isConfirmed("story", genreId, id) && !isAdminDevice()) return;
    const row = songs.find((item) => item.id === id);
    if (!row) return;
    if (isLocked(readLocks("story", id, lockSpace), "thumb")) return;
    if (busyBlock === "thumb-img") {
      cancelRegen();
      return;
    }
    if (busy || busyBlock || !row.pkg.geminiPrompt.trim()) {
      if (!row.pkg.geminiPrompt.trim()) setError("제미나이 프롬프트가 없습니다.");
      return;
    }
    const run = armRegen("thumb-img");
    beginBlockWork("thumb-img", cover ? coverListName(row.title, row.pkg.sourceGenre || "") : row.title);
    setError(null);
    try {
      const next = await paintStoryThumb(row.title, row.pkg, row.pkg.geminiPrompt);
      if (!regenStill(run.job)) return;
      if (next.thumbUrl === row.pkg.thumbUrl) {
        setError("썸네일을 만들지 못했습니다.");
        return;
      }
      const saved = await saveListedStory(id, next);
      if (!saved) setError("저장하지 못했습니다.");
    } catch {
      if (!regenStill(run.job)) return;
      setError("썸네일을 만들지 못했습니다.");
    } finally {
      if (regenStill(run.job)) {
        regenAbort.current = null;
        setBusyBlock(null);
      }
    }
  }

  function saveStoryUrl(id: string, key: "youtubeUrl" | "mvUrl" | "sunoUrl" | "ytPremium" | "mvPremium", value: string | boolean) {
    const row = songs.find((item) => item.id === id);
    if (!row) return;
    if (key === "ytPremium" || key === "mvPremium") {
      const bit = key === "ytPremium" ? "yt" : "mv";
      premiumHold.current[id] = { ...premiumHold.current[id], [bit]: value === true };
      pinStoryPremium(id, key, value === true);
      const kind = genreId === "cover-reborn" ? "cover" : "story";
      void pinShownPremiumFile({ data: { kind, genreId, ep: "", act: 0, title: row.title, vocal: cover ? shownVocal() : "", which: key === "mvPremium" ? "mv" : "song", on: value === true } }).then((saved) => {
        const plain = plainStory(saved);
        if (!plain || plain.ok === false) setError("고음질 체크를 저장하지 못했습니다.");
      }).catch(() => setError("고음질 체크를 저장하지 못했습니다."));
    }
    const cur = readCachedStory(id, genreId) ?? row.pkg;
    const next = withStoryPremium(id, { ...cur, [key]: value, songId: cur.songId || row.pkg.songId });
    storeStory(next, row.title);
    if (openTitle === id) setPkg(next);
    setTick((n) => n + 1);
    void (async () => {
      let pageOk = false;
      try {
        const saved = await saveStoryPage({ data: { genreId, title: row.title, body: storyFileBody(next) } });
        pageOk = serverOk(saved);
      } catch {
        pageOk = false;
      }
      if (!pageOk) {
        const kind = genreId === "cover-reborn" ? "cover" : "story";
        try {
          const stuck = await stickStoryFile(kind, genreId, row.title, next, []);
          pageOk = stuck.ok;
        } catch {
          pageOk = false;
        }
      }
      if (pageOk) {
        if (key === "ytPremium" || key === "mvPremium") storySaveMark.current[id] = storyPremiumSig(next);
        return;
      }
      if (key === "ytPremium" || key === "mvPremium") setError("고음질 체크를 저장하지 못했습니다.");
      else setError("저장하지 못했습니다.");
    })();
  }

  function saveStoryCast(id: string, cast: ThumbCast) {
    const row = songs.find((item) => item.id === id);
    const cur = row?.pkg ?? readCachedStory(id, genreId);
    if (!row || !cur || cur.thumbCast === cast) return;
    const next: StoryPackage = { ...cur, thumbCast: cast, songId: cur.songId || row.pkg.songId };
    storeStory(next, row.title);
    if (openTitle === id) setPkg(next);
    setThumbCast(cast);
    setCastPick(null);
    setTick((n) => n + 1);
    void saveStoryPage({ data: { genreId, title: row.title, body: next } }).catch(() => {
      setError("저장하지 못했습니다.");
    });
  }

  function saveStoryOrigin(id: string, next: { title: string; vocal: string; lyrics: string; genre: string }) {
    const name = next.title.trim();
    if (!name) {
      setError("제목이 없습니다.");
      return false;
    }
    const row = songs.find((item) => item.id === id);
    if (!row) return false;
    const base = readCachedStory(row.pkg.songId || id, genreId) ?? readCachedStory(id, genreId) ?? readCachedStory(row.title, genreId) ?? row.pkg;
    const pkg: StoryPackage = {
      ...base,
      sourceLyrics: next.lyrics,
      sourceVocal: next.vocal,
      sourceGenre: next.genre.trim(),
      thumbCast: castFromLabel(next.vocal),
      songId: base.songId || row.pkg.songId,
    };
    if (row.pkg.songId) {
      storeStory(pkg, name);
      if (openTitle === id) setPkg(pkg);
      setTick((n) => n + 1);
      void saveStoryPage({ data: { genreId, title: name, body: pkg } }).catch(() => {
        setError("원곡 정보를 저장하지 못했습니다.");
      });
      return true;
    }
    if (name !== id) {
      const was = isConfirmed("story", genreId, id);
      patchApp((d) => {
        const prev = d.stories[storyCacheKey(id, genreId)];
        delete d.stories[storyCacheKey(id, genreId)];
        d.stories[storyCacheKey(name, genreId)] = {
          title: name,
          pkg,
          registeredAt: Number(prev?.registeredAt) || Date.now(),
          savedAt: Date.now(),
        };
      }, false);
      if (was) {
        void writeConfirmed("story", genreId, id, false);
        void writeConfirmed("story", genreId, name, true);
      }
      if (openTitle === id) setOpenTitle(name);
    }
    storeStory(pkg, name);
    if (openTitle === id || openTitle === name) setPkg(pkg);
    setTick((n) => n + 1);
    void saveStoryPage({ data: { genreId, title: name, body: pkg, previousTitle: name === id ? "" : id } }).catch(() => {
      setError("원곡 정보를 저장하지 못했습니다.");
    });
    return true;
  }

  function patchList(songKey: string, fieldId: string, text: string) {
    if (masterLocked()) return "메인 자물쇠가 잠겨 있어 저장하지 않습니다.";
    const row = songs.find((item) => item.id === songKey);
    if (!row) return "이 칸을 저장하지 못했습니다.";
    const held = readLocks("story", songKey, lockSpace);
    if (isLocked(held, fieldId)) writeLocks("story", songKey, lockSpace, { ...held, [fieldId]: false });
    const cached = readCachedStory(row.pkg.songId || songKey, genreId) ?? readCachedStory(row.title, genreId) ?? row.pkg;
    const next = patchStory(cached, fieldId, text);
    if (!next) return "그 칸은 여기서 고치지 않습니다.";
    const stored: StoryPackage = row.pkg.songId ? { ...next, songId: row.pkg.songId } : next;
    const linkKey = `song:${songKey}`;
    const sunoTouched = Object.prototype.hasOwnProperty.call(linkDraft[linkKey] || {}, "sunoUrl");
    const analysisTouched = Object.prototype.hasOwnProperty.call(linkDraft[linkKey] || {}, "audioAnalysis");
    const levelTouched = Object.prototype.hasOwnProperty.call(linkDraft[linkKey] || {}, "audioLevel");
    const typedSuno = paneInput(`story-fold-${encodeURIComponent(songKey)}`, "suno");
    const typedAnalysis = paneInput(`story-fold-${encodeURIComponent(songKey)}`, "analysis");
    const typedLevel = paneInput(`story-fold-${encodeURIComponent(songKey)}`, "level");
    const sunoSet = sunoTouched;
    const analysisOk = analysisTouched && (typedAnalysis === null || !typedAnalysis.trim() || Boolean(storyAnalysis(typedAnalysis)));
    const levelOk = levelTouched && (typedLevel === null || !typedLevel.trim() || Boolean(storyLevel(typedLevel)));
    const sunoUrl = sunoSet ? storyAddress(typedSuno ?? linkDraft[linkKey]?.sunoUrl ?? "") : stored.sunoUrl || "";
    const audioAnalysis = analysisOk ? storyAnalysis((typedAnalysis ?? linkDraft[linkKey]?.audioAnalysis) || "") : stored.audioAnalysis || "";
    const audioLevel = levelOk ? storyLevel((typedLevel ?? linkDraft[linkKey]?.audioLevel) || "") : stored.audioLevel || "";
    const filed = { ...stored, sunoUrl, audioAnalysis, audioLevel, ...(sunoSet ? { sunoExact: true as const } : {}), ...(analysisOk ? { analysisExact: true as const } : {}), ...(levelOk ? { levelExact: true as const } : {}) };
    const slotId = (stored.songId || row.title || songKey).trim();
    const holdGenre = genreId === "cover-reborn" ? "cover-reborn" : "your-story";
    const hold: { sunoUrl?: string; audioAnalysis?: string; audioLevel?: string } = {};
    if (sunoSet) hold.sunoUrl = sunoUrl;
    if (analysisOk) hold.audioAnalysis = audioAnalysis;
    if (levelOk) hold.audioLevel = audioLevel;
    if (hold.sunoUrl !== undefined || hold.audioAnalysis !== undefined || hold.audioLevel !== undefined) holdPageLink(`story:${holdGenre}:${slotId}`, hold);
    storeStory(filed, row.title);
    if (openTitle === songKey) setPkg(filed);
    const holdKey = `story:${genreId}:${songKey}`;
    storyTextHold.current[holdKey] = true;
    setTick((n) => n + 1);
    void Promise.all([
      flushAppPagesNow(),
      saveStoryPage({ data: { genreId, title: row.title, body: filed } }).then((saved) => serverOk(saved)).catch(() => false),
    ]).then(([queued, wrote]) => {
      if (!queued || !wrote) {
        setError("이 칸을 파일에 남기지 못했습니다.");
        return;
      }
      storyTextHold.current[holdKey] = false;
      setTick((n) => n + 1);
    });
  }

  function pinPlaylistHold(plId: string) {
    const draft = linkDraft[`pl:${plId}`] || {};
    const sunoTouched = Object.prototype.hasOwnProperty.call(draft, "sunoUrl");
    const analysisTouched = Object.prototype.hasOwnProperty.call(draft, "audioAnalysis");
    const levelTouched = Object.prototype.hasOwnProperty.call(draft, "audioLevel");
    const typedSuno = paneInput(`story-pl-fold-${plId}`, "suno");
    const typedAnalysis = paneInput(`story-pl-fold-${plId}`, "analysis");
    const typedLevel = paneInput(`story-pl-fold-${plId}`, "level");
    const hold: { sunoUrl?: string; audioAnalysis?: string; audioLevel?: string } = {};
    if (typedSuno !== null) hold.sunoUrl = storyAddress(typedSuno);
    else if (sunoTouched) hold.sunoUrl = storyAddress(draft.sunoUrl ?? "");
    if (typedAnalysis !== null && (!typedAnalysis.trim() || storyAnalysis(typedAnalysis))) hold.audioAnalysis = storyAnalysis(typedAnalysis);
    else if (analysisTouched && (typedAnalysis === null || !typedAnalysis.trim() || storyAnalysis(typedAnalysis))) hold.audioAnalysis = storyAnalysis((typedAnalysis ?? draft.audioAnalysis) || "");
    if (typedLevel !== null && (!typedLevel.trim() || storyLevel(typedLevel))) hold.audioLevel = storyLevel(typedLevel);
    else if (levelTouched && (typedLevel === null || !typedLevel.trim() || storyLevel(typedLevel))) hold.audioLevel = storyLevel((typedLevel ?? draft.audioLevel) || "");
    if (hold.sunoUrl === undefined && hold.audioAnalysis === undefined && hold.audioLevel === undefined) return;
    const name = genreId === "cover-reborn" ? `playlist:cover:${plId}` : `playlist:${plId}`;
    const holdGenre = genreId === "cover-reborn" ? "cover-reborn" : "your-story";
    holdPageLink(`story:${holdGenre}:${name}`, hold);
  }

  function toggleListLock(songKey: string, fieldId: string) {
    if (masterLocked()) {
      setError("메인 자물쇠가 잠겨 있어 잠그거나 풀 수 없습니다.");
      return;
    }
    if (isConfirmed("story", genreId, songKey) && !isAdminDevice()) return;
    const cur = readLocks("story", songKey, lockSpace);
    writeLocks("story", songKey, lockSpace, { ...cur, [fieldId]: !isLocked(cur, fieldId) });
    setTick((n) => n + 1);
  }

  const plTheme = openPl ? playlists.find((row) => row.id === openPl)?.theme || "" : "";
  const storyNote = error || (fillingStory ? fillLabel || "채우는 중" : busy || busyBlock ? (busyBlock === "thumb-img" ? "썸네일 생성 중" : plTheme && !openTitle ? `${plTheme} 생성 중` : "생성 중") : "대기");
  const storyBar = Boolean(unlocked && (Boolean(error) || fillingStory || busy || busyBlock || (menu === "list" && (openTitle || (openPl && plResult)))));
  function blockWorkLabel(blockId: string) {
    if (blockId === "thumb-img") return "썸네일 생성";
    const story = storyFillFields.find((field) => field.id === blockId);
    if (story) return `${story.label} 재생성`;
    const named: Record<string, string> = {
      summary: "요약",
      title: "제목",
      tracks: "수록곡",
      suno: "수노",
      thumb: "썸네일",
      "yt-title": "유튜브 제목",
      "yt-desc": "설명",
      community: "커뮤니티",
      letter: "커뮤니티",
    };
    return `${named[blockId] || "칸"} 재생성`;
  }
  function beginBlockWork(blockId: string, name: string) {
    setWorkName(name);
    setFillLabel(blockWorkLabel(blockId));
    if (!fillingStory) setFillPct(46);
  }
  function noticeSongName() {
    const row = songs.find((item) => item.id === openTitle);
    const raw = row?.title?.trim() || draft.title.trim();
    if (!raw || raw === openTitle) return songName;
    return cover ? coverListName(raw, row?.pkg.sourceGenre || draft.genre.trim() || "") : raw;
  }
  const listRule = readCommon().listRule || "";
  const goldTitle = !listRule || listRule.includes("금색");
  const showYoutube = !listRule || listRule.includes("유튜브");
  function storyFieldsReady(title: string) {
    const rowLocks = readLocks("story", title, lockSpace);
    const fields = storyFillFields.filter((field) => kpopPref.output[field.flag] !== false);
    return fields.length > 0 && fields.every((field) => isLocked(rowLocks, field.id));
  }
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("noa-story-bar", { detail: storyBar }));
    return () => {
      window.dispatchEvent(new CustomEvent("noa-story-bar", { detail: false }));
    };
  }, [storyBar]);
  useEffect(() => {
    const onNotice = (event: Event) => {
      const text = String((event as CustomEvent<string>).detail || "").trim();
      if (text) setError(text);
    };
    window.addEventListener("noa-user-notice", onNotice);
    return () => window.removeEventListener("noa-user-notice", onNotice);
  }, []);

  return (
    <div className={unlocked && storyBar ? "pb-16" : undefined}>
      {unlocked ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMenu("list")}
            className={cn(
              "flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold",
              menu === "list" ? "bg-mark text-mark-fg" : "bg-surface text-fg",
            )}
          >
            열람
          </button>
          <button
            type="button"
            onClick={() => setMenu("input")}
            className={cn(
              "flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold",
              menu === "input" ? "bg-mark text-mark-fg" : "bg-surface text-fg",
            )}
          >
            {inputName}
          </button>
        </div>
      ) : null}

      {unlocked && menu === "input" ? (
        <>
          {cover ? (
            <label className="mt-5 block">
              <span className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase">
                제목 | 원곡 가수
                <span className="rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg">
                  필수
                </span>
              </span>
              <input
                value={coverLine}
                placeholder="제목 - 원곡 가수"
                onChange={(event) => {
                  const raw = event.target.value;
                  const parts = readCoverLine(raw);
                  setCoverLine(raw);
                  setStoryTitle(parts.title);
                  setStoryGenre(parts.artist);
                  setError(null);
                }}
                className="mt-2 w-full rounded-xl border border-mark/70 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
              />
            </label>
          ) : (
            <label className="mt-5 block">
              <span className="flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase">
                제목
                <span className="rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg">
                  필수
                </span>
              </span>
              <input
                value={storyTitle}
                onChange={(event) => {
                  setStoryTitle(event.target.value);
                  setError(null);
                }}
                className="mt-2 w-full rounded-xl border border-mark/70 bg-surface px-3 py-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
              />
            </label>
          )}
          <label className="mt-4 block">
            <span className="flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase">
              가사
              <span className="rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg">
                필수
              </span>
            </span>
            <textarea
              value={storyLyrics}
              onChange={(event) => setStoryLyrics(event.target.value)}
              rows={10}
              className="mt-2 min-h-52 w-full resize-y rounded-xl border border-mark/70 bg-surface px-3 py-2.5 font-mono text-sm leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
            />
          </label>
          {cover ? null : (
            <label className="mt-4 block">
              <span className="flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase">
                {genreField}
              </span>
              <input
                value={storyGenre}
                onChange={(event) => setStoryGenre(event.target.value)}
                className="mt-2 w-full rounded-xl border border-mark/70 bg-surface px-3 py-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
              />
            </label>
          )}
          <div className="mt-4">
            <span className="text-xs font-medium tracking-widest text-fg-subtle uppercase">보컬정보</span>
            <div className="mt-2">
              <CastRadios
                value={storyVocal}
                onChange={(next) => {
                  setStoryVocal(next);
                  setThumbCast(next);
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            variant="mark"
            className="mt-5 w-full"
            disabled={busy || !canRun}
            onClick={() => {
              if (!canRun || busy) return;
              void onGenerate();
            }}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            {busy ? "생성 중" : `생성 · ${songName}`}
          </Button>
        </>
      ) : (
        <div className="mt-5">
          {unlocked ? (
            <div className="overflow-hidden rounded-2xl border border-white/80 bg-surface">
              <button
                type="button"
                onClick={() => {
                  setPicking((value) => {
                    const next = !value;
                    if (next) {
                      setSortOn(false);
                      setOpenPl("");
                      setPlResult(false);
                      setOpenTitle("");
                      setPicked([]);
                    }
                    return next;
                  });
                  setPlMenu(false);
                }}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-center px-4 text-center text-sm font-medium",
                  picking ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                )}
              >
                플레이리스트 생성
              </button>
              {picking ? (
                <div className="border-t border-white/20 px-4 py-3">
                  <label className="block">
                    <span className="text-xs font-medium tracking-widest text-fg-subtle uppercase">주제</span>
                    <input
                      value={theme}
                      onChange={(event) => setTheme(event.target.value)}
                      placeholder="이 플레이리스트의 주제"
                      className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </label>
                  <Button
                    type="button"
                    size="lg"
                    variant="mark"
                    className="mt-3 w-full"
                    disabled={!picked.length || !theme.trim()}
                    onClick={makePlaylist}
                  >
                    선택한 곡으로 만들기
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <section id="story-pl-picker" className="mt-5">
            {(() => {
              const made = Boolean(openPl && playlists.some((row) => row.id === openPl));
              const plHead = made ? playlists.find((row) => row.id === openPl) : undefined;
              const plHeadOn = Boolean(plHead && isConfirmed("playlist", genreId, plHead.id));
              const plUrl = plHead?.pkg.youtubeUrl?.trim() || "";
              const plMv = plHead?.pkg.mvUrl?.trim() || "";
              return (
                <HearFlag url={plUrl} on={plHeadOn}>
                  {(live) => (
                    <div className={cn("overflow-hidden rounded-2xl border bg-surface text-fg", made ? "border-border" : "border-mark")}>
                      <div
                        className={cn(
                          "relative flex min-h-[52px] w-full items-center",
                          plHeadOn && live ? "bg-mark text-mark-fg" : plHeadOn ? "act-title-held" : "bg-surface text-fg",
                          plMenu ? "rounded-t-2xl" : "rounded-2xl",
                        )}
                      >
                        {made ? (
                          <span className={cn("act-lp", plHeadOn && live && "act-lp-on")} aria-hidden>
                            <span className="act-lp-disc" />
                            <svg className="act-lp-arm" viewBox="0 0 56 52">
                              <path d={plHeadOn ? "M2 2 L22 27" : "M2 2 L13 32"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                              <circle cx="2.2" cy="2.2" r="2.2" fill="currentColor" />
                              <circle cx={plHeadOn ? 22 : 13} cy={plHeadOn ? 27 : 32} r="1.6" fill="currentColor" />
                            </svg>
                          </span>
                        ) : (
                          <span className="act-lp text-mark" aria-hidden>
                            <svg viewBox="0 0 56 52" className="size-full">
                              <rect x="16" y="14" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
                              <rect x="19" y="17" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
                              <rect x="22" y="20" width="22" height="16" rx="2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M26 28h10M26 31.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </span>
                        )}
                        <div className="flex min-h-[52px] min-w-0 flex-1 items-center pl-14">
                          <button
                            type="button"
                            aria-expanded={plMenu}
                            onClick={() => {
                              if (!playlists.length) return;
                              setPlMenu((value) => !value);
                            }}
                            className="flex min-h-[52px] min-w-0 flex-1 items-center py-2 text-left text-sm font-medium"
                          >
                            <span className="min-w-0 truncate">
                              <KoText text={plHead?.theme || playlistListName} />
                            </span>
                          </button>
                          {sortAllowed ? <ListSortRadio on={sortOn} dirty={sortDirty} onToggle={toggleStorySort} onSave={saveStorySort} /> : null}
                          {playlists.length ? (
                            <button
                              type="button"
                              aria-label="플레이리스트 목록"
                              onClick={() => setPlMenu((value) => !value)}
                              className="flex min-h-[52px] items-center pr-3 pl-0.5"
                            >
                              <ChevronDown className={cn("size-4 shrink-0", plMenu && "rotate-180")} />
                            </button>
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}
                        </div>
                        {plUrl || plMv ? (
                          <span className="pr-3">
                            <YoutubeLink url={plUrl} mvUrl={plMv} subscribe={plHeadOn} />
                          </span>
                        ) : null}
                      </div>
                      {plMenu && playlists.length ? (
                        <div className="border-t border-border">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenPl("");
                              setPlResult(false);
                              setPlMenu(false);
                              setOpenTitle("");
                            }}
                            className={cn(
                              "flex min-h-[48px] w-full items-center px-4 text-left text-sm font-medium",
                              !openPl ? "bg-mark/25 text-fg" : "bg-bg text-fg",
                            )}
                          >
                            <KoText text={playlistListName} />
                          </button>
                          {playlists.map((row) => {
                            const on = openPl === row.id;
                            return (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => {
                                  setOpenPl(row.id);
                                  setPlResult(false);
                                  setPlMenu(false);
                                  setOpenTitle("");
                                }}
                                className={cn(
                                  "flex min-h-[48px] w-full items-center px-4 text-left text-sm font-medium",
                                  on ? "bg-mark/25 text-fg" : "bg-bg text-fg",
                                )}
                              >
                                {row.theme}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {plUrl || plMv ? (
                        <div className="bg-bg px-3 pt-2 pb-2 text-fg">
                          <PreviewStack
                            song={plUrl}
                            mv={plMv}
                            genreId={genreId}
                            repeat
                            playTitle={plHead?.pkg.youtubeTitle?.trim() || plHead?.theme || "플레이리스트"}
                            poster={plHead?.pkg.thumbUrl || ""}
                            subscribe={plHeadOn}
                            songPremium={plHead?.pkg.ytPremium !== false}
                            mvPremium={plHead?.pkg.mvPremium !== false}
                            prompt={
                              unlocked && openPl && !plResult ? (
                                <FoldPrompt
                                  label="결과창을 보려면 누르세요"
                                  onOpen={() => {
                                    queueFoldTop(`story-pl-fold-${openPl}`);
                                    setPlResult(true);
                                  }}
                                />
                              ) : !unlocked && plHeadOn && plHead && pref.actOutput.ytDesc !== false && !plDesc ? (
                                <FoldPrompt
                                  label="설명란을 보려면 누르세요"
                                  onOpen={() => {
                                    queueFoldTop(`story-pl-desc-${plHead.id}`);
                                    setPlDesc(true);
                                  }}
                                />
                              ) : null
                            }
                          />
                        </div>
                      ) : unlocked && openPl && !plResult ? (
                        <div className="flex justify-end border-t border-border bg-bg px-3 py-2">
                          <FoldPrompt
                            label="결과창을 보려면 누르세요"
                            onOpen={() => {
                              queueFoldTop(`story-pl-fold-${openPl}`);
                              setPlResult(true);
                            }}
                          />
                        </div>
                      ) : !unlocked && plHeadOn && plHead && pref.actOutput.ytDesc !== false && !plDesc ? (
                        <div className="flex justify-end border-t border-border bg-bg px-3 py-2">
                          <FoldPrompt
                            label="설명란을 보려면 누르세요"
                            onOpen={() => {
                              queueFoldTop(`story-pl-desc-${plHead.id}`);
                              setPlDesc(true);
                            }}
                          />
                        </div>
                      ) : null}
              {unlocked && openPl && plResult ? (
                <FoldPanel
                  foldKey={`story-pl:${openPl}`}
                  domId={`story-pl-fold-${openPl}`}
                  open
                  openLabel="결과창을 보려면 누르세요"
                  closeLabel="결과 닫기"
                  onOpen={() => setPlResult(true)}
                  onDismiss={() => {
                    closeFold(`story-pl:${openPl}`, document.getElementById(`story-pl-fold-${openPl}`));
                    setPlResult(false);
                  }}
                  hidePrompt
                  framed
                >
                  {(() => {
                    const plRow = playlists.find((row) => row.id === openPl);
                    const plPkg = plRow?.pkg ?? {
                      summary: "",
                      confirmedTitle: "",
                      tracklist: "",
                      sunoStyle: "",
                      geminiPrompt: "",
                      youtubeTitle: "",
                      youtubeDescription: "",
                      communityPost: "",
                      thumbUrl: "",
                      thumbCast,
                    };
                    const plConfirmed = isConfirmed("playlist", genreId, openPl);
                    return (
                      <>
                        <SongFileBar
                          target={{
                            kind: "playlist",
                            genreId,
                            title: `playlist:${cover ? `cover:${openPl}` : openPl}`,
                            artist: "",
                          }}
                        />
                        <CastBar
                          value={castPick?.title === `pl:${openPl}` ? castPick.cast : plPkg.thumbCast || defaultThumbCast(genreId)}
                          saved={plPkg.thumbCast || defaultThumbCast(genreId)}
                          onChange={(cast) => setCastPick({ title: `pl:${openPl}`, cast })}
                          onSave={() => {
                            if (!plRow) return;
                            const cast = castPick?.title === `pl:${openPl}` ? castPick.cast : plPkg.thumbCast || defaultThumbCast(genreId);
                            if (!saveStoryPlaylistPkg(openPl, { ...plPkg, thumbCast: cast }, true)) {
                              setError("인물을 저장하지 못했습니다.");
                              return;
                            }
                            setCastPick(null);
                          }}
                        />
                        <PlaylistView
                          pkg={plPkg}
                          showCommunity={pref.community}
                          showDescLyrics={pref.descLyrics}
                          output={pref.actOutput}
                          locks={{}}
                          busyId={busyBlock}
                          sealed={plConfirmed && !adminHere}
                          focusId={busyBlock}
                          focusPhase={busyBlock ? "work" : null}
                          onToggleLock={() => {}}
                          onRegen={(blockId, note) => {
                            void regenStoryPlaylist(openPl, blockId, note);
                          }}
                          onPatch={(blockId, text) => {
                            const fresh = storyPlaylistRow(openPl);
                            if (!fresh) return "이 칸을 저장하지 못했습니다.";
                            const next = patchPlaylistPkg(fresh.pkg, blockId, text);
                            if (!next) return "그 칸은 여기서 고치지 않습니다.";
                            if (blockId === "tracks") next.tracklistEdited = true;
                            if (blockId === "yt-desc") next.descEdited = true;
                            const fieldKey = ({ summary: "summary", title: "confirmedTitle", lyrics: "lyricsBlock", tracks: "tracklist", suno: "sunoStyle", thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", community: "communityPost" } as Record<string, string>)[blockId];
                            if (!fieldKey) return "이 칸을 저장하지 못했습니다.";
                            const marked = { ...next, savedKeys: [fieldKey], ...(String(text || "").trim() ? {} : { blankFields: [fieldKey] }) };
                            pinPlaylistHold(openPl);
                            if (!saveStoryPlaylistPkg(openPl, marked, true)) return "이 칸을 저장하지 못했습니다.";
                            const holdKey = `pl:${genreId}:${openPl}`;
                            storyTextHold.current[holdKey] = true;
                            setTick((n) => n + 1);
                            const fileTitle = genreId === "cover-reborn" ? `playlist:cover:${openPl}` : `playlist:${openPl}`;
                            const kind = genreId === "cover-reborn" ? "cover" : "story";
                            void (async () => {
                              try {
                                await saveResultFields({ data: { kind, genreId, ep: "", act: 0, title: fileTitle, vocal: "", fields: { [fieldKey]: text }, blank: !String(text || "").trim() } });
                              } catch {
                                /* the file read below decides */
                              }
                              let read: { ok?: boolean; fields?: Record<string, string> } | null = null;
                              try {
                                read = plainStory(await readResultFile({ data: { kind, genreId, ep: "", act: 0, title: fileTitle, vocal: "" } }));
                              } catch {
                                read = null;
                              }
                              const got = String(read?.fields?.[fieldKey] ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
                              const want = String(text ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
                              const matched = Boolean(read && read.ok !== false && read.fields && got === want);
                              window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: matched } }));
                              if (!matched) {
                                setError("이 칸을 파일에 남기지 못했습니다.");
                                return;
                              }
                              if (read.fields) setFileMap((prev) => ({ ...prev, [`pl:${openPl}`]: read.fields || {} }));
                              storyTextHold.current[holdKey] = false;
                              setTick((n) => n + 1);
                            })();
                          }}
                          order={pref.outputOrder}
                          sunoBase={pref.sunoBase}
                          draftScope={`pl:${genreId}:${openPl}`}
                          sunoUrl={linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).sunoUrl}
                          audioAnalysis={linkView(`pl:${openPl}`, { ...plPkg, audioAnalysis: savedAnalysis(`pl:${openPl}`, plPkg.audioAnalysis || "", fileMap[`pl:${openPl}`]?.audioAnalysis || "") }, plPkg.ytPremium !== false, plPkg.mvPremium !== false).audioAnalysis}
                          audioLevel={linkView(`pl:${openPl}`, { ...plPkg, audioLevel: savedLevel(`pl:${openPl}`, plPkg.audioLevel || "", fileMap[`pl:${openPl}`]?.audioLevel || "", plPkg.sunoUrl || "") }, plPkg.ytPremium !== false, plPkg.mvPremium !== false).audioLevel}
                          fileFields={fileMap[`pl:${openPl}`]}
                          fileKnown={Boolean(fileMap[`pl:${openPl}`])}
                          editKey={`pl:${openPl}`}
                          onSunoUrl={(value) => setLink(`pl:${openPl}`, { sunoUrl: value })}
                          onAnalysis={(value) => {
                            analysisOwn.current[`pl:${openPl}`] = true;
                            setLink(`pl:${openPl}`, { audioAnalysis: value });
                          }}
                          onLevel={(value) => {
                            levelOwn.current[`pl:${openPl}`] = true;
                            setLink(`pl:${openPl}`, { audioLevel: value });
                          }}
                        />
                        <ResultActions
                          busy={false}
                          complete={hasPlaylistBody(plPkg)}
                          confirmed={plConfirmed}
                          revise={adminHere}
                          hasBody={hasPlaylistBody(plPkg)}
                          saveDirty={storyTextHold.current[`pl:${genreId}:${openPl}`] === true || linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).dirty || (castPick?.title === `pl:${openPl}` && castPick.cast !== (plPkg.thumbCast || defaultThumbCast(genreId))) || (() => {
                            const view = linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false);
                            const disk = fileMap[`pl:${openPl}`];
                            if (disk) return Object.keys(storyPaneGap({ ...plPkg, ...view }, disk)).length > 0;
                            return Boolean(storyAddress(view.sunoUrl) || storyAddress(view.youtubeUrl) || storyAddress(view.mvUrl));
                          })()}
                          draftScope={`pl:${genreId}:${openPl}`}
                          onPatch={(blockId, text) => {
                            const fresh = storyPlaylistRow(openPl);
                            if (!fresh) return "이 칸을 저장하지 못했습니다.";
                            const next = patchPlaylistPkg(fresh.pkg, blockId, text);
                            if (!next) return "그 칸은 여기서 고치지 않습니다.";
                            if (blockId === "tracks") next.tracklistEdited = true;
                            if (blockId === "yt-desc") next.descEdited = true;
                            const fieldKey = ({ summary: "summary", title: "confirmedTitle", lyrics: "lyricsBlock", tracks: "tracklist", suno: "sunoStyle", thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", community: "communityPost" } as Record<string, string>)[blockId];
                            if (!fieldKey) return "이 칸을 저장하지 못했습니다.";
                            const marked = { ...next, savedKeys: [fieldKey], ...(String(text || "").trim() ? {} : { blankFields: [fieldKey] }) };
                            pinPlaylistHold(openPl);
                            if (!saveStoryPlaylistPkg(openPl, marked, true)) return "이 칸을 저장하지 못했습니다.";
                            const holdKey = `pl:${genreId}:${openPl}`;
                            storyTextHold.current[holdKey] = true;
                            setTick((n) => n + 1);
                            const fileTitle = genreId === "cover-reborn" ? `playlist:cover:${openPl}` : `playlist:${openPl}`;
                            const kind = genreId === "cover-reborn" ? "cover" : "story";
                            void (async () => {
                              try {
                                await saveResultFields({ data: { kind, genreId, ep: "", act: 0, title: fileTitle, vocal: "", fields: { [fieldKey]: text }, blank: !String(text || "").trim() } });
                              } catch {
                                /* the file read below decides */
                              }
                              let read: { ok?: boolean; fields?: Record<string, string> } | null = null;
                              try {
                                read = plainStory(await readResultFile({ data: { kind, genreId, ep: "", act: 0, title: fileTitle, vocal: "" } }));
                              } catch {
                                read = null;
                              }
                              const got = String(read?.fields?.[fieldKey] ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
                              const want = String(text ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
                              const matched = Boolean(read && read.ok !== false && read.fields && got === want);
                              window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: matched } }));
                              if (!matched) {
                                setError("이 칸을 파일에 남기지 못했습니다.");
                                return;
                              }
                              if (read.fields) setFileMap((prev) => ({ ...prev, [`pl:${openPl}`]: read.fields || {} }));
                              storyTextHold.current[holdKey] = false;
                              setTick((n) => n + 1);
                            })();
                          }}
                          onSave={() => {
                            const fresh = storyPlaylistRow(openPl);
                            if (!fresh) return;
                            const view = linkView(`pl:${openPl}`, { ...fresh.pkg, audioAnalysis: savedAnalysis(`pl:${openPl}`, fresh.pkg.audioAnalysis || "", fileMap[`pl:${openPl}`]?.audioAnalysis || ""), audioLevel: savedLevel(`pl:${openPl}`, fresh.pkg.audioLevel || "", fileMap[`pl:${openPl}`]?.audioLevel || "", fresh.pkg.sunoUrl || "") }, fresh.pkg.ytPremium !== false, fresh.pkg.mvPremium !== false);
                            const plDraft = linkDraft[`pl:${openPl}`] || {};
                            const sunoTouched = Object.prototype.hasOwnProperty.call(plDraft, "sunoUrl");
                            const analysisTouched = Object.prototype.hasOwnProperty.call(plDraft, "audioAnalysis");
                            const levelTouched = Object.prototype.hasOwnProperty.call(plDraft, "audioLevel");
                            const typedSuno = paneInput(`story-pl-fold-${openPl}`, "suno");
                            const typedAnalysis = paneInput(`story-pl-fold-${openPl}`, "analysis");
                            const typedLevel = paneInput(`story-pl-fold-${openPl}`, "level");
                            const screenSuno = typedSuno !== null;
                            const screenAnalysis = typedAnalysis !== null;
                            const screenLevel = typedLevel !== null;
                            const sunoUrl = screenSuno ? storyAddress(typedSuno) : view.sunoUrl;
                            const analysisBad = screenAnalysis && Boolean(typedAnalysis.trim()) && !storyAnalysis(typedAnalysis);
                            const levelBad = screenLevel && Boolean(typedLevel.trim()) && !storyLevel(typedLevel);
                            if (analysisBad) setError("분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
                            else if (levelBad) setError("보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
                            const audioAnalysis = screenAnalysis && !analysisBad ? storyAnalysis(typedAnalysis) : storyAnalysis(view.audioAnalysis);
                            const audioLevel = screenLevel && !levelBad ? storyLevel(typedLevel) : storyLevel(view.audioLevel);
                            const sunoSend = screenSuno || sunoTouched;
                            const analysisSend = (screenAnalysis || analysisTouched) && !analysisBad;
                            const levelSend = (screenLevel || levelTouched) && !levelBad;
                            const pickedCast = castPick?.title === `pl:${openPl}` ? castPick.cast : fresh.pkg.thumbCast;
                            const savedKeys: string[] = [];
                            const blankFields: string[] = [];
                            for (const row of fieldDrafts(`pl:${genreId}:${openPl}`)) {
                              const key = ({ summary: "summary", title: "confirmedTitle", lyrics: "lyricsBlock", tracks: "tracklist", suno: "sunoStyle", thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", community: "communityPost" } as Record<string, string>)[row.id];
                              if (!key) continue;
                              savedKeys.push(key);
                              if (!String(row.text || "").trim()) blankFields.push(key);
                            }
                            if (sunoSend) {
                              savedKeys.push("sunoUrl");
                              if (!sunoUrl) blankFields.push("sunoUrl");
                            }
                            if (analysisSend) {
                              savedKeys.push("audioAnalysis");
                              if (!audioAnalysis) blankFields.push("audioAnalysis");
                            }
                            if (levelSend) {
                              savedKeys.push("audioLevel");
                              if (!audioLevel) blankFields.push("audioLevel");
                            }
                            const savedPkg = {
                              ...fresh.pkg,
                              youtubeUrl: view.youtubeUrl,
                              mvUrl: view.mvUrl,
                              sunoUrl,
                              audioAnalysis,
                              audioLevel,
                              ytPremium: view.ytPremium,
                              mvPremium: view.mvPremium,
                              thumbCast: pickedCast || fresh.pkg.thumbCast,
                              savedKeys,
                              ...(blankFields.length ? { blankFields } : {}),
                              ...(sunoSend ? { sunoExact: true as const } : {}),
                              ...(analysisSend ? { analysisExact: true as const } : {}),
                              ...(levelSend ? { levelExact: true as const } : {}),
                            };
                            pinPlaylistHold(openPl);
                            if (!saveStoryPlaylistPkg(openPl, savedPkg, true)) {
                              setError("저장하지 못했습니다.");
                              return;
                            }
                            const fileTitle = genreId === "cover-reborn" ? `playlist:cover:${openPl}` : `playlist:${openPl}`;
                            const kind = genreId === "cover-reborn" ? "cover" : "story";
                            const shown = {
                              summary: fresh.pkg.summary,
                              confirmedTitle: fresh.pkg.confirmedTitle,
                              tracklist: fresh.pkg.tracklist,
                              sunoStyle: fresh.pkg.sunoStyle,
                              geminiPrompt: fresh.pkg.geminiPrompt,
                              youtubeTitle: fresh.pkg.youtubeTitle,
                              youtubeDescription: fresh.pkg.youtubeDescription,
                              communityPost: fresh.pkg.communityPost,
                              youtubeUrl: view.youtubeUrl,
                              mvUrl: view.mvUrl,
                              ...(sunoSend ? { sunoUrl } : {}),
                              ...(analysisSend ? { audioAnalysis } : {}),
                              ...(levelSend ? { audioLevel } : {}),
                            };
                            void (async () => {
                              await flushAppPagesNow().catch(() => false);
                              try {
                                const stuck = await stickStoryFile(kind, genreId, fileTitle, shown);
                                if (stuck.back) setFileMap((prev) => ({ ...prev, [`pl:${openPl}`]: stuck.back || {} }));
                                if (!stuck.ok) {
                                  const lead = noticeLead(stuck.error || "");
                                  const leftKeys = Object.keys(stuck.left || {});
                                  setError(leftKeys.length === 1 && leftKeys[0] === "sunoUrl"
                                    ? `${lead}수노 주소가 파일에 남지 않았습니다.`
                                    : leftKeys.length === 1 && leftKeys[0] === "audioAnalysis"
                                      ? `${lead}분석값이 파일에 남지 않았습니다.`
                                    : leftKeys.length === 1 && leftKeys[0] === "audioLevel"
                                      ? `${lead}보정값이 파일에 남지 않았습니다.`
                                      : `${lead}저장하지 못했습니다.`);
                                  return;
                                }
                                if (castPick?.title === `pl:${openPl}`) setCastPick(null);
                                clearLink(`pl:${openPl}`);
                                setError("");
                              } catch (err) {
                                setError(`${noticeLead(err instanceof Error ? err.message.trim() : "request")}저장하지 못했습니다.`);
                              }
                            })();
                          }}
                          onRegenAll={() => {
                            if (!plRow) return;
                            if (plConfirmed && !isAdminDevice()) {
                              setError("확정된 결과는 최고관리자만 다시 만듭니다.");
                              return;
                            }
                            const fresh = localStoryPlaylist({
                              theme: plRow.theme,
                              songs: plRow.songs.map((token) => ({ title: storySongLabel(token) || token })),
                              prefs: pref,
                              thumbCast: plPkg.thumbCast || thumbCast,
                              genreId,
                            });
                            saveStoryPlaylistPkg(openPl, {
                              ...fresh,
                              youtubeUrl: plPkg.youtubeUrl,
                              sunoUrl: plPkg.sunoUrl,
                              mvUrl: plPkg.mvUrl,
                              ytPremium: plPkg.ytPremium,
                              mvPremium: plPkg.mvPremium,
                              tracklist: plPkg.tracklistEdited ? plPkg.tracklist : fresh.tracklist,
                              youtubeDescription: plPkg.descEdited ? plPkg.youtubeDescription : fresh.youtubeDescription,
                              tracklistEdited: plPkg.tracklistEdited,
                              descEdited: plPkg.descEdited,
                            });
                          }}
                          onConfirm={() => {
                            const turningOn = !plConfirmed;
                            const id = openPl;
                            if (!isAdminDevice()) {
                              setError(adminSealDenied());
                              return;
                            }
                            const pending = writeConfirmed("playlist", genreId, id, turningOn);
                            setConfirmTick((n) => n + 1);
                            if (turningOn) {
                              closeFold(`story-pl:${id}`, document.getElementById(`story-pl-fold-${id}`));
                              setPlResult(false);
                              followAfterClose("story-song-list", `story-pl-fold-${id}`);
                            }
                            void pending.then((flag) => {
                              if (!flag.ok) setError(turningOn ? "확정 표시를 남기지 못했습니다." : "확정 해제를 남기지 못했습니다.");
                            });
                          }}
                          error={null}
                          lead={
                            <YoutubeField
                              value={linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).youtubeUrl}
                              onChange={(value) => setLink(`pl:${openPl}`, { youtubeUrl: value })}
                              onSave={() => {}}
                              mvValue={linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).mvUrl}
                              onMvChange={(value) => setLink(`pl:${openPl}`, { mvUrl: value })}
                              onMvSave={() => {}}
                              songPremium={linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).ytPremium}
                              onSongPremium={(next) => {
                                setLink(`pl:${openPl}`, { ytPremium: next });
                                saveStoryPlaylistPkg(openPl, { ...plPkg, ytPremium: next }, true);
                              }}
                              mvPremium={linkView(`pl:${openPl}`, plPkg, plPkg.ytPremium !== false, plPkg.mvPremium !== false).mvPremium}
                              onMvPremium={(next) => {
                                setLink(`pl:${openPl}`, { mvPremium: next });
                                saveStoryPlaylistPkg(openPl, { ...plPkg, mvPremium: next }, true);
                              }}
                              fileUrl={fileMap[`pl:${openPl}`]?.youtubeUrl || ""}
                              fileMv={fileMap[`pl:${openPl}`]?.mvUrl || ""}
                              fileKnown={Boolean(fileMap[`pl:${openPl}`])}
                            />
                          }
                        />
                      </>
                    );
                  })()}
                </FoldPanel>
              ) : null}
              {!unlocked && plDesc && plHeadOn && plHead && pref.actOutput.ytDesc !== false ? (
                <FoldPanel
                  foldKey={`story-pl-desc:${plHead.id}`}
                  domId={`story-pl-desc-${plHead.id}`}
                  open
                  openLabel="설명란을 보려면 누르세요"
                  closeLabel="설명 닫기"
                  onOpen={() => setPlDesc(true)}
                  onDismiss={() => {
                    closeFold(`story-pl-desc:${plHead.id}`, document.getElementById(`story-pl-desc-${plHead.id}`));
                    setPlDesc(false);
                  }}
                  hidePrompt
                  framed
                >
                  <MaybeTranslated text={(plHead.pkg.youtubeDescription || "").trim() || "설명란이 비어 있습니다."} genreId={genreId}>
                    {(body) => <DescriptionBody text={body} full mode="tracks" />}
                  </MaybeTranslated>
                </FoldPanel>
              ) : null}
                    </div>
                  )}
                </HearFlag>
              );
            })()}
          </section>

          <div id="story-song-list" data-song-list="" data-queue-key={genreId} className="mt-5 flex flex-col gap-2">
            {sortView.length ? (
              sortView.map((row) => {
                const id = row.id || row.title;
                const confirmed = isConfirmed("story", genreId, id);
                const on = openTitle === id;
                const title = row.title;
                const listTitle = cover ? coverListName(title, row.pkg.sourceGenre || "") : title;
                const youtube = row.pkg.youtubeUrl?.trim() || "";
                const mv = row.pkg.mvUrl?.trim() || "";
                const working = !confirmed && openTitle === id && (fillingStory || busy);
                const ready = !confirmed && !working && storyFieldsReady(id);
                const showSongDesc = (confirmed || Boolean((row.pkg.sunoUrl || "").trim())) && kpopPref.output.ytDesc !== false;
                const hasPreview = !picking && !sortOn && showYoutube && Boolean(youtube || mv);
                const showFold = !picking && !sortOn && Boolean(unlocked || showSongDesc);
                const showBarePrompt = showFold && !hasPreview && !on;
                const foldRow = !sortOn && (hasPreview || on || showBarePrompt);
                return (
                  <HearFlag key={id} url={youtube} on={confirmed}>
                    {(live) => (
                      <div
                        id={`story-row-${encodeURIComponent(id)}`}
                        data-sort-id={sortOn ? id : undefined}
                        data-song-title={listTitle}
                        data-yt-title={row.pkg.youtubeTitle?.trim() || title}
                        className={cn(
                          "bookmark-card flex flex-col text-left text-fg",
                          confirmed && (live ? "bookmark-live" : "bookmark-held"),
                          on ? "song-picked" : "",
                          on && unlocked ? "overflow-visible" : "",
                        )}
                      >
                        <div
                          className={cn(
                            "flex min-h-[52px] items-center gap-2 py-1 pr-3 pl-5",
                            foldRow ? "rounded-t-[14px]" : "rounded-[14px]",
                            confirmed
                              ? ""
                              : ready
                                  ? "border border-fg/25 bg-fg/[0.06]"
                                  : "",
                          )}
                        >
                          {sortOn ? <SortGrip onPointerDown={(event) => startSort(id, event)} /> : null}
                          {picking && unlocked ? (
                            <button
                              type="button"
                              aria-pressed={picked.includes(id)}
                              onClick={() => togglePick(id)}
                              className={cn(
                                "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                                picked.includes(id) ? "border-mark bg-mark text-mark-fg" : "border-current",
                              )}
                            >
                              {picked.includes(id) ? picked.indexOf(id) + 1 : ""}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => {
                              if (sortOn) return;
                              if (picking) {
                                togglePick(id);
                                return;
                              }
                              if (!unlocked && !confirmed && !(row.pkg.sunoUrl || "").trim()) return;
                              if (on) closeStoryResult(id);
                              else openStoryResult(id);
                            }}
                            className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
                            aria-pressed={on}
                          >
                            <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-px">
                              <span
                                className={cn(
                                  "block truncate text-sm font-medium leading-[14px]",
                                  confirmed && goldTitle ? "text-mark" : "",
                                )}
                              >
                                {listTitle}
                              </span>
                            </span>
                          </button>
                          {!sortOn && !picking && (row.pkg.sunoUrl || "").trim() ? (
                            <span className="inline-flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              aria-label="음원 듣기"
                              data-song-key={`story:${genreId}:${encodeURIComponent(row.pkg.songId || row.title || id)}:${encodeURIComponent(id)}`}
                              data-suno-url={(row.pkg.sunoUrl || "").trim()}
                              data-suno-id={`suno:story:${genreId}:${encodeURIComponent(title || id)}:${encodeURIComponent(row.pkg.songId || id)}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                beginSuno(event.currentTarget);
                              }}
                              className="hear-btn"
                            >
                              <span><KoText text="음원" /></span>
                              <Music />
                            </button>
                            <MasteredDownload id={`suno:story:${genreId}:${encodeURIComponent(title || id)}:${encodeURIComponent(row.pkg.songId || id)}`} url={(row.pkg.sunoUrl || "").trim()} title={listTitle} />
                            </span>
                          ) : null}
                        </div>
                        {showBarePrompt ? (
                          <div className="flex justify-end bg-bg px-3 py-2 text-fg">
                            <FoldPrompt
                              label={unlocked ? "결과창을 보려면 누르세요" : "설명란을 보려면 누르세요"}
                              onOpen={() => openStoryResult(id)}
                            />
                          </div>
                        ) : null}
                        {hasPreview ? (
                          <div className="bg-bg px-3 pt-2 pb-2 text-fg">
                            <PreviewStack
                              song={youtube}
                              mv={mv}
                              genreId={genreId}
                              listSong
                              poster={row.pkg.thumbUrl || ""}
                              subscribe={confirmed}
                              songPremium={storyPremiumOn(id, row.pkg, "ytPremium")}
                              mvPremium={storyPremiumOn(id, row.pkg, "mvPremium")}
                              prompt={
                                !on && (unlocked || showSongDesc) ? (
                                  <FoldPrompt
                                    label={unlocked ? "결과창을 보려면 누르세요" : "설명란을 보려면 누르세요"}
                                    onOpen={() => openStoryResult(id)}
                                  />
                                ) : null
                              }
                            />
                          </div>
                        ) : null}
                        {showFold ? (
                          <div className="text-fg">
                            <FoldPanel
                              foldKey={unlocked ? `story:${id}` : `story-desc:${id}`}
                              domId={`story-fold-${encodeURIComponent(id)}`}
                              open={on}
                              openLabel={unlocked ? "결과창을 보려면 누르세요" : "설명란을 보려면 누르세요"}
                              closeLabel={unlocked ? "결과 닫기" : "설명 닫기"}
                              onOpen={() => openStoryResult(id)}
                              onDismiss={() => closeStoryResult(id)}
                              hidePrompt
                              framed
                            >
                              {unlocked ? (
                                <>
                                  <SongFileBar
                                    target={{
                                      kind: cover ? "cover" : "story",
                                      genreId,
                                      title,
                                      artist: cover ? coverArtistOf(row.pkg.sourceGenre || "", row.pkg.sourceVocal || "") : "",
                                    }}
                                  />
                                  <StoryOriginFields
                                    key={id}
                                    title={title}
                                    vocal={row.pkg.sourceVocal || labelForCast(row.pkg.thumbCast)}
                                    lyrics={row.pkg.sourceLyrics || ""}
                                    genre={row.pkg.sourceGenre || ""}
                                    genreLabel={genreField}
                                    onLive={(next, dirty) => noteOrigin(id, next, dirty)}
                                    onSave={(next) => saveStoryOrigin(id, next)}
                                  />
                                  <StoryView
                                    pkg={row.pkg}
                                    songTitle={title}
                                    showLetter={kpopPref.output.letter}
                                    showDescLyrics={kpopPref.descLyrics}
                                    output={storyListOutput}
                                    descText={listenDescription(row.pkg.youtubeDescription, row.pkg.sourceLyrics || "")}
                                    locks={readLocks("story", id, lockSpace)}
                                    busyId={id === openTitle ? busyBlock : null}
                                    focusId={id === openTitle ? fillFocus?.id || (busyBlock && busyBlock !== "thumb-img" ? busyBlock : null) : null}
                                    focusPhase={id === openTitle && (fillFocus || (busyBlock && busyBlock !== "thumb-img")) ? fillFocus?.phase ?? "work" : null}
                                    markIds={id === openTitle ? workIds : []}
                                    imageBusy={id === openTitle && busyBlock === "thumb-img"}
                                    sealed={confirmed && !adminHere}
                                    onToggleLock={(fieldId) => toggleListLock(id, fieldId)}
                                    onRegen={(blockId, note) => {
                                      void regenListBlock(id, blockId, note);
                                    }}
                                    onPatch={(fieldId, text) => patchList(id, fieldId, text)}
                                    onRegenImage={() => {
                                      void regenListImage(id);
                                    }}
                                    order={kpopPref.outputOrder}
                                    sunoBase={kpopPref.sunoBase}
                                    draftScope={`story:${genreId}:${id}`}
                                    sunoUrl={linkView(`song:${id}`, row.pkg, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).sunoUrl}
                                    audioAnalysis={linkView(`song:${id}`, { ...row.pkg, audioAnalysis: savedAnalysis(`song:${id}`, row.pkg.audioAnalysis || "", fileMap[`song:${id}`]?.audioAnalysis || "") }, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).audioAnalysis}
                                    audioLevel={linkView(`song:${id}`, { ...row.pkg, audioLevel: savedLevel(`song:${id}`, row.pkg.audioLevel || "", fileMap[`song:${id}`]?.audioLevel || "", row.pkg.sunoUrl || "") }, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).audioLevel}
                                    fileFields={fileMap[`song:${id}`]}
                                    fileKnown={Boolean(fileMap[`song:${id}`])}
                                    editKey={`song:${id}`}
                                    onSunoUrl={(value) => setLink(`song:${id}`, { sunoUrl: value })}
                                    onAnalysis={(value) => {
                                      analysisOwn.current[`song:${id}`] = true;
                                      setLink(`song:${id}`, { audioAnalysis: value });
                                    }}
                                    onLevel={(value) => {
                                      levelOwn.current[`song:${id}`] = true;
                                      setLink(`song:${id}`, { audioLevel: value });
                                    }}
                                    playlistSlot={
                                      <StoryPlaylistField
                                        value={listHold.current[id] ?? (playlists.find((pl) => storyInPlaylist(pl.songs, id, title, row.pkg.youtubeTitle))?.id || "")}
                                        options={[
                                          { id: "", label: playlistListName },
                                          ...playlists.map((pl) => ({ id: pl.id, label: pl.theme })),
                                        ]}
                                        onChange={(nextId) => {
                                          const current = playlists.find((pl) => storyInPlaylist(pl.songs, id, title, row.pkg.youtubeTitle))?.id || "";
                                          if (nextId === current) delete listHold.current[id];
                                          else listHold.current[id] = nextId;
                                          setTick((n) => n + 1);
                                        }}
                                      />
                                    }
                                    beforeThumb={
                                      <CastBar
                                        className="mb-0"
                                        value={
                                          castPick?.title === id
                                            ? castPick.cast
                                            : row.pkg.thumbCast || defaultThumbCast(genreId)
                                        }
                                        saved={row.pkg.thumbCast || defaultThumbCast(genreId)}
                                        onChange={(cast) => setCastPick({ title: id, cast })}
                                        onSave={() => {
                                          const cast =
                                            castPick?.title === id
                                              ? castPick.cast
                                              : row.pkg.thumbCast || defaultThumbCast(genreId);
                                          saveStoryCast(id, cast);
                                        }}
                                      />
                                    }
                                  />
                                  <ResultActions
                                    busy={false}
                                    complete={storyHasResult(row.pkg)}
                                    confirmed={confirmed}
                                    revise={adminHere}
                                    hasBody={storyHasResult(row.pkg)}
                                    onSave={() => {
                                      const origin = originHold.current[id];
                                      if (origin && !saveStoryOrigin(id, origin)) return;
                                      delete originHold.current[id];
                                      if (id in listHold.current) {
                                        const picked = listHold.current[id];
                                        if (!assignStoryPlaylist(id, title, row.pkg.youtubeTitle, picked)) return;
                                        delete listHold.current[id];
                                      }
                                      if (castPick?.title === id) {
                                        const cast = castPick.cast;
                                        if (cast !== (row.pkg.thumbCast || defaultThumbCast(genreId))) saveStoryCast(id, cast);
                                      }
                                      const savedYt = storyPremiumOn(id, row.pkg, "ytPremium");
                                      const savedMv = storyPremiumOn(id, row.pkg, "mvPremium");
                                      const analysisBase = savedAnalysis(`song:${id}`, row.pkg.audioAnalysis || "", fileMap[`song:${id}`]?.audioAnalysis || "");
                                      const levelBase = savedLevel(`song:${id}`, row.pkg.audioLevel || "", fileMap[`song:${id}`]?.audioLevel || "", row.pkg.sunoUrl || "");
                                      const view = linkView(`song:${id}`, { ...row.pkg, audioAnalysis: analysisBase, audioLevel: levelBase }, savedYt, savedMv);
                                      const songDraft = linkDraft[`song:${id}`] || {};
                                      const sunoTouched = Object.prototype.hasOwnProperty.call(songDraft, "sunoUrl");
                                      const analysisTouched = Object.prototype.hasOwnProperty.call(songDraft, "audioAnalysis");
                                      const levelTouched = Object.prototype.hasOwnProperty.call(songDraft, "audioLevel");
                                      const typedSuno = paneInput(`story-fold-${encodeURIComponent(id)}`, "suno");
                                      const typedAnalysis = paneInput(`story-fold-${encodeURIComponent(id)}`, "analysis");
                                      const typedLevel = paneInput(`story-fold-${encodeURIComponent(id)}`, "level");
                                      const screenSuno = typedSuno !== null;
                                      const screenAnalysis = typedAnalysis !== null;
                                      const screenLevel = typedLevel !== null;
                                      const analysisBad = screenAnalysis && Boolean(typedAnalysis.trim()) && !storyAnalysis(typedAnalysis);
                                      const levelBad = screenLevel && Boolean(typedLevel.trim()) && !storyLevel(typedLevel);
                                      if (analysisBad) setError("분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
                                      else if (levelBad) setError("보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
                                      const sunoUrl = screenSuno ? storyAddress(typedSuno) : view.sunoUrl;
                                      const audioAnalysis = screenAnalysis && !analysisBad ? storyAnalysis(typedAnalysis) : storyAnalysis(view.audioAnalysis);
                                      const audioLevel = screenLevel && !levelBad ? storyLevel(typedLevel) : storyLevel(view.audioLevel);
                                      const sunoSend = screenSuno || sunoTouched;
                                      const analysisSend = (screenAnalysis || analysisTouched) && !analysisBad;
                                      const levelSend = (screenLevel || levelTouched) && !levelBad;
                                      const savedName = (origin?.title || title).trim() || title;
                                      const cur = withStoryPremium(id, readCachedStory(row.pkg.songId || savedName, genreId) ?? readCachedStory(savedName, genreId) ?? readCachedStory(id, genreId) ?? row.pkg);
                                      const next = {
                                        ...cur,
                                        youtubeUrl: view.youtubeUrl,
                                        mvUrl: view.mvUrl,
                                        ...(sunoSend ? { sunoUrl } : {}),
                                        ...(analysisSend ? { audioAnalysis } : {}),
                                        ...(levelSend ? { audioLevel } : {}),
                                        ytPremium: view.ytPremium,
                                        mvPremium: view.mvPremium,
                                      };
                                      pinStoryPremium(id, "ytPremium", next.ytPremium === true);
                                      pinStoryPremium(id, "mvPremium", next.mvPremium === true);
                                      const stored = row.pkg.songId ? { ...next, songId: row.pkg.songId } : next;
                                      const fileTitle = row.pkg.songId ? title : savedName;
                                      const storeId = row.pkg.songId || fileTitle;
                                      const holdGenre = genreId === "cover-reborn" ? "cover-reborn" : "your-story";
                                      const linkHold: { sunoUrl?: string; audioAnalysis?: string; audioLevel?: string } = {};
                                      if (sunoSend) linkHold.sunoUrl = sunoUrl;
                                      if (analysisSend) linkHold.audioAnalysis = audioAnalysis;
                                      if (levelSend) linkHold.audioLevel = audioLevel;
                                      if (linkHold.sunoUrl !== undefined || linkHold.audioAnalysis !== undefined || linkHold.audioLevel !== undefined) holdPageLink(`story:${holdGenre}:${storeId}`, linkHold);
                                      storeStory(stored, fileTitle, { persist: false });
                                      const kind = genreId === "cover-reborn" ? "cover" : "story";
                                      void (async () => {
                                        try {
                                          const shown = { ...stored, youtubeUrl: view.youtubeUrl, mvUrl: view.mvUrl, ...(sunoSend ? { sunoUrl } : {}), ...(analysisSend ? { audioAnalysis } : {}), ...(levelSend ? { audioLevel } : {}) };
                                          const stuck = await stickStoryFile(kind, genreId, storeId, shown, [fileTitle, savedName, id]);
                                          if (stuck.back) setFileMap((prev) => ({ ...prev, [`song:${id}`]: stuck.back || {} }));
                                          if (!stuck.ok) {
                                            const lead = noticeLead(stuck.error || "");
                                            const leftKeys = Object.keys(stuck.left || {});
                                            setError(leftKeys.length === 1 && leftKeys[0] === "sunoUrl"
                                              ? `${lead}수노 주소가 파일에 남지 않았습니다.`
                                              : leftKeys.length === 1 && leftKeys[0] === "audioAnalysis"
                                                ? `${lead}분석값이 파일에 남지 않았습니다.`
                                              : leftKeys.length === 1 && leftKeys[0] === "audioLevel"
                                                ? `${lead}보정값이 파일에 남지 않았습니다.`
                                                : `${lead}저장하지 못했습니다.`);
                                            return;
                                          }
                                          void saveStoryPage({ data: { genreId, title: fileTitle, body: { ...storyFileBody(stored), ...(sunoSend ? { sunoUrl, sunoExact: true as const } : {}), ...(analysisSend ? { audioAnalysis, analysisExact: true as const } : {}), ...(levelSend ? { audioLevel, levelExact: true as const } : {}) }, previousTitle: fileTitle === id ? "" : id } }).catch(() => {
                                            /* 곡 파일을 다시 읽어 같으면 저장이다 */
                                          });
                                          storySaveMark.current[id] = storyPremiumSig(stored);
                                          clearLink(`song:${id}`);
                                          setTick((n) => n + 1);
                                          setError("");
                                        } catch (err) {
                                          setError(`${noticeLead(err instanceof Error ? err.message.trim() : "request")}저장하지 못했습니다.`);
                                        }
                                      })();
                                    }}
                                    saveDirty={(() => {
                                      const cur = withStoryPremium(id, row.pkg);
                                      const sig = storyPremiumSig(cur);
                                      if (!(id in storySaveMark.current)) storySaveMark.current[id] = sig;
                                      const savedYt = storyPremiumOn(id, row.pkg, "ytPremium");
                                      const savedMv = storyPremiumOn(id, row.pkg, "mvPremium");
                                      const view = linkView(`song:${id}`, row.pkg, savedYt, savedMv);
                                      const disk = fileMap[`song:${id}`];
                                      const gap = disk
                                        ? Object.keys(storyPaneGap({ ...row.pkg, youtubeUrl: view.youtubeUrl, mvUrl: view.mvUrl, sunoUrl: view.sunoUrl }, disk)).length > 0
                                        : Boolean(storyAddress(view.sunoUrl) || storyAddress(view.youtubeUrl) || storyAddress(view.mvUrl));
                                      return Boolean(originHold.current[id]) || id in listHold.current || (castPick?.title === id && castPick.cast !== (row.pkg.thumbCast || defaultThumbCast(genreId))) || storySaveMark.current[id] !== sig || storyTextHold.current[`story:${genreId}:${id}`] === true || view.dirty || gap;
                                    })()}
                                    draftScope={`story:${genreId}:${id}`}
                                    onPatch={(fieldId, text) => patchList(id, fieldId, text)}
                                    onRegenAll={() => { void regenListedStory(id); }}
                                    onConfirm={() => confirmStory(id, row.pkg)}
                                    error={null}
                                    domId={`story-actions-${encodeURIComponent(id)}`}
                                    lead={
                                      <YoutubeField
                                        value={linkView(`song:${id}`, row.pkg, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).youtubeUrl}
                                        onChange={(value) => setLink(`song:${id}`, { youtubeUrl: value })}
                                        onSave={() => {}}
                                        mvValue={linkView(`song:${id}`, row.pkg, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).mvUrl}
                                        onMvChange={(value) => setLink(`song:${id}`, { mvUrl: value })}
                                        onMvSave={() => {}}
                                        songPremium={linkView(`song:${id}`, row.pkg, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).ytPremium}
                                        onSongPremium={(next) => saveStoryUrl(id, "ytPremium", next)}
                                        mvPremium={linkView(`song:${id}`, row.pkg, storyPremiumOn(id, row.pkg, "ytPremium"), storyPremiumOn(id, row.pkg, "mvPremium")).mvPremium}
                                        onMvPremium={(next) => saveStoryUrl(id, "mvPremium", next)}
                                        fileUrl={fileMap[`song:${id}`]?.youtubeUrl || ""}
                                        fileMv={fileMap[`song:${id}`]?.mvUrl || ""}
                                        fileKnown={Boolean(fileMap[`song:${id}`])}
                                      />
                                    }
                                  />
                                </>
                              ) : (
                                <MaybeTranslated text={listenDescription(row.pkg.youtubeDescription, row.pkg.sourceLyrics || "") || "설명란이 비어 있습니다."} genreId={genreId}>
                                  {(body) => <DescriptionBody text={body} full mode="lyrics" />}
                                </MaybeTranslated>
                              )}
                            </FoldPanel>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </HearFlag>
                );
              })
            ) : (
              <p className="rounded-xl bg-surface px-4 py-6 text-sm text-fg-muted">
                <KoText text={cover ? "저장한 커버곡이 없습니다. 커버곡 입력에서 만든 곡이 여기에 모입니다." : "저장한 사연곡이 없습니다. 사연곡 입력에서 만든 곡이 여기에 모입니다."} />
              </p>
            )}
          </div>
        </div>
      )}
      {storyBar ? (
        <div
          id="result-status"
          role="status"
          className="fixed inset-x-0 bottom-[var(--jukebox-cover,0px)] z-40 overflow-hidden border-t border-white/25 bg-black text-white"
        >
          {busy || busyBlock || fillingStory ? <span aria-hidden className="notice-glow" /> : null}
          {busy || busyBlock || fillingStory ? <span aria-hidden className="notice-sweep" /> : null}
          {busy || busyBlock || fillingStory ? (
            <div className="px-4 py-3">
              <p className="text-[15px] font-semibold tracking-tight text-white">
                Grok <span className="text-mark wake-word">작동 중</span>
              </p>
              <p className="mt-2 text-sm font-medium text-white">{workName || noticeSongName()}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-mark transition-[width] duration-300" style={{ width: `${fillingStory ? fillPct : busyBlock ? 46 : 22}%` }} />
              </div>
              <p className="mt-2 text-sm leading-snug text-white">{fillLabel || (busyBlock ? blockWorkLabel(busyBlock) : "채우는 중")}</p>
            </div>
          ) : (
            <p className="truncate px-4 py-2 text-left text-[13px] leading-5 text-white" title={noticeShown(storyNote)}>
              Grok 알림 - {noticeShown(storyNote)}
            </p>
          )}
        </div>
      ) : null}
      {unlocked && !masterLocked() && !reviewOpen && !fillingStory && menu === "list" && openTitle ? (
        <button
          type="button"
          aria-label="이 곡 검사하고 채우기"
          disabled={busy || Boolean(busyBlock)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startStoryFill();
          }}
          className={cn(
            "fixed right-4 z-40 inline-flex size-11 touch-manipulation items-center justify-center rounded-full border border-mark/45 bg-mark/25 text-mark shadow-lg backdrop-blur-md disabled:opacity-50 bottom-[calc(var(--notice-lift,0px)+var(--jukebox-cover,0px)+4.75rem+env(safe-area-inset-bottom))]",
          )}
          data-float="1"
        >
          <ListPlus className="size-5" />
        </button>
      ) : null}
      {reviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-fg/50"
            onClick={() => setReviewOpen(false)}
          />
          <section
            className="relative z-10 mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl border border-mark/50 bg-bg px-5 py-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-fg">
              Grok <span className="text-mark">대기</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fg">이 {songName}만 검사합니다. 공란은 생성하고, 대충 썼거나 규칙에 어긋난 칸은 재생성하거나 보완합니다.</p>
            {reviewItems.length ? (
              <ul className="mt-2 space-y-1">
                {reviewItems.map((item) => (
                  <li key={item.id} className="text-xs leading-relaxed text-fg-muted">
                    <span className="text-fg">{item.label}</span> · {item.action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">손볼 칸이 없습니다. 요구사항을 적으면 채워진 칸도 검사합니다.</p>
            )}
            <label className="mt-3 block text-xs text-fg-subtle">
              사용자 요구사항
              <textarea
                value={reviewNote}
                onChange={(event) => {
                  const value = event.target.value;
                  setReviewNote(value);
                  const target = fillTarget();
                  if (target) setReviewItems(storyWork(target, value));
                }}
                rows={3}
                placeholder="채워진 칸도 이 요구가 있으면 검사 후 고칩니다"
                className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>
            <p className="mt-2 text-xs text-fg-muted">확정된 곡, 잠긴 칸, 원곡 제목·보컬·{genreField}·가사는 바꾸지 않습니다.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-border bg-surface text-sm text-fg"
                onClick={() => setReviewOpen(false)}
              >
                {reviewItems.length ? "다음에" : "닫기"}
              </button>
              {reviewItems.length ? (
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg"
                  onClick={() => {
                    void runStoryFill();
                  }}
                >
                  실행
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      <CastDialog
        open={castOpen}
        value={thumbCast}
        onChange={setThumbCast}
        onConfirm={() => {
          setCastOpen(false);
          void onGenerate();
        }}
        onCancel={() => setCastOpen(false)}
      />
    </div>
  );
}
