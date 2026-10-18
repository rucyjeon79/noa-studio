import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clapperboard, Download, Equal, EqualNot, Gem, GripVertical, Languages, ListMusic, ListX, LoaderCircle, Mail, Music, Pause, PictureInPicture2, Play, Repeat, Repeat1, RotateCcw, Shuffle, SkipBack, SkipForward, X, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTS, GENRES, actFromEp, padEp, type ActId, type GenreId } from "@/lib/catalog";
import { type ThumbCast, castFromLabel, defaultThumbCast, labelForCast } from "@/lib/characters";
import { emptyStudio, hasPageBody, isStudioComplete, lyricsAreThisSong, readActPreview, readCachedPackage, readCachedPlaylist, linkPremiumOn, rememberActPreview, watchDescReady, type StudioPackage } from "@/lib/package";
import { loadStudioPage, sendStudioMail } from "@/lib/pages";
import { langLabel, prefOutputLang, readCommon, readPref, useGenrePref, type OutputLang, type OutputShow } from "@/lib/user-prefs";
import { cn } from "@/lib/utils";
import { appScrollBy, followTarget, followTop, keepView } from "@/lib/app-scroll";
import { APP_EVENT } from "@/lib/app-memory";
import { GATE_EVENT, isAdminDevice } from "@/lib/gate";
import { translateText } from "@/lib/translate";
import { hasHangul, useLockedViewLang, useViewLang, viewLangChoices, viewText, writeViewLang } from "@/lib/view-lang";
import { CastBar, CastRadios } from "./thumb-cast";
import { youtubeArePublic, youtubeIsPublic } from "@/lib/youtube-public";
import { adoptQueue, alignBody, bodyClock, bodyFailed, bodySounding, keepOutputAlive, loadAct, loadSongList, masteredWavUrl, openBody, outputCorrected, pauseBody, quietStandby, readMusicPlayer, resumeBody, retitleTracks, seekBody, setBodyLoop, setMusicHooks, setPhoneCard, stageSongList, stopMusicPlayer, syncSongList } from "@/lib/music-player";
import { dialSpans, markFor, playBarColor, readLoudness, watchLoudness, watchMarks } from "@/lib/loudness";
import { pullSavedLevel } from "@/lib/level-file";
import { cleanDescriptionLyrics, descriptionSungOnly, descriptionWithoutLyrics, sungLyrics, visibleBreaks } from "@/lib/lyrics-clean";
import { fieldDraftOn, fieldDraftRev, fieldDrafts, watchFieldDrafts } from "@/lib/field-draft";
import { getOriginal } from "@/lib/originals";
import { DescriptionBody, PackageView, urlTone } from "./package-view";
import { SongFileBar } from "./song-file-bar";
import type { SongFileTarget } from "@/lib/song-files";

function useAdminDevice() {
  return useSyncExternalStore(
    (notify) => {
      const pull = () => notify();
      window.addEventListener(GATE_EVENT, pull);
      return () => window.removeEventListener(GATE_EVENT, pull);
    },
    () => isAdminDevice(),
    () => false,
  );
}

const downloadTitles = new Map<string, string>();
let savedWavHandle: FileSystemHandle | null = null;

function wavFileName(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "noa";
  const stem = cleaned.replace(/\.wav$/i, "").replace(/_NS$/i, "");
  return `${stem}_NS.wav`;
}

function rememberWavPlace(handle: FileSystemHandle) {
  savedWavHandle = handle;
  try {
    const open = indexedDB.open("noa-wav-save", 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("save")) open.result.createObjectStore("save");
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("save", "readwrite");
      tx.objectStore("save").put(handle, "last");
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    };
  } catch {
    /* the save picker id still remembers this device's folder */
  }
}

function loadWavPlace() {
  if (savedWavHandle || typeof indexedDB === "undefined") return;
  try {
    const open = indexedDB.open("noa-wav-save", 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("save")) open.result.createObjectStore("save");
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("save", "readonly");
      const req = tx.objectStore("save").get("last");
      req.onsuccess = () => {
        const handle = req.result as FileSystemHandle | undefined;
        if (handle && (handle.kind === "file" || handle.kind === "directory")) savedWavHandle = handle;
        db.close();
      };
      req.onerror = () => db.close();
    };
  } catch {
    /* the save picker id still remembers this device's folder */
  }
}

type WavPicker = (options?: {
  id?: string;
  suggestedName?: string;
  startIn?: FileSystemHandle | "music" | "downloads" | "documents";
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

function saveMasteredWav(id: string, url: string, name: string, onBusy: (busy: boolean) => void) {
  const picker = (window as Window & { showSaveFilePicker?: WavPicker }).showSaveFilePicker;
  const fallback = () => {
    onBusy(true);
    void masteredWavUrl(id, url).then((href) => {
      onBusy(false);
      if (!href) return;
      const link = document.createElement("a");
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };
  if (typeof picker !== "function") {
    fallback();
    return;
  }
  const options = {
    id: "noa-corrected-wav",
    suggestedName: name,
    types: [{ description: "WAV", accept: { "audio/wav": [".wav"] } }],
    ...(savedWavHandle ? { startIn: savedWavHandle } : {}),
  };
  void picker(options).then(async (handle) => {
    rememberWavPlace(handle);
    onBusy(true);
    try {
      const href = await masteredWavUrl(id, url);
      if (!href) return;
      const res = await fetch(href);
      if (!res.ok) return;
      const blob = await res.blob();
      if (!blob.size) return;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch {
      /* the corrected file is not replaced with the original */
    } finally {
      onBusy(false);
    }
  }, (err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
    if (!savedWavHandle) return;
    savedWavHandle = null;
    void picker({
      id: "noa-corrected-wav",
      suggestedName: name,
      types: [{ description: "WAV", accept: { "audio/wav": [".wav"] } }],
    }).then(async (handle) => {
      rememberWavPlace(handle);
      onBusy(true);
      try {
        const href = await masteredWavUrl(id, url);
        if (!href) return;
        const res = await fetch(href);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!blob.size) return;
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch {
        /* the corrected file is not replaced with the original */
      } finally {
        onBusy(false);
      }
    }, (again: unknown) => {
      if (again instanceof DOMException && again.name === "AbortError") return;
      fallback();
    });
  });
}

export function MasteredDownload({ id, url, title }: { id: string; url: string; title: string }) {
  void title;
  const admin = useAdminDevice();
  const [busy, setBusy] = useState(false);
  const [sunoTitle, setSunoTitle] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!admin || !url.trim()) return;
    loadWavPlace();
    const known = downloadTitles.get(url);
    if (known) setSunoTitle(known);
    let stop = false;
    void fetch(`/api/suno-audio?u=${encodeURIComponent(url)}&meta=1`)
      .then((res) => (res.ok ? res.json() as Promise<{ title?: string }> : null))
      .then((json) => {
        const got = String(json?.title || "").trim();
        if (!got || stop) return;
        downloadTitles.set(url, got);
        setSunoTitle(got);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [admin, url]);
  if (!admin || !url.trim()) return null;
  return (
    <button
      type="button"
      aria-label="보정 음원 받기"
      title={note || "보정 음원 받기"}
      disabled={busy}
      className="hear-dl"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        const known = (sunoTitle || downloadTitles.get(url) || "").trim();
        const save = (pageTitle: string) => {
          const name = pageTitle.trim();
          if (!name) {
            setNote("수노 곡 제목을 읽지 못했습니다.");
            return;
          }
          setNote("");
          downloadTitles.set(url, name);
          setSunoTitle(name);
          saveMasteredWav(id, url, wavFileName(name), setBusy);
        };
        if (known) {
          save(known);
          return;
        }
        setBusy(true);
        void fetch(`/api/suno-audio?u=${encodeURIComponent(url)}&meta=1`)
          .then((res) => (res.ok ? res.json() as Promise<{ title?: string }> : null))
          .then((json) => {
            setBusy(false);
            save(String(json?.title || ""));
          })
          .catch(() => {
            setBusy(false);
            setNote("수노 곡 제목을 읽지 못했습니다.");
          });
      }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <Download aria-hidden />}
    </button>
  );
}

export function setAppMini(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.appMini = "1";
  else delete document.documentElement.dataset.appMini;
  window.dispatchEvent(new Event("noa-mini"));
}

function useAppMini() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.appMini === "1");
    sync();
    window.addEventListener("noa-mini", sync);
    return () => window.removeEventListener("noa-mini", sync);
  }, []);
  return on;
}

export function ListSortRadio({
  on,
  dirty = false,
  onToggle,
  onSave,
}: {
  on: boolean;
  dirty?: boolean;
  onToggle: () => void;
  onSave?: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center">
      {on && onSave ? (
        <button
          type="button"
          disabled={!dirty}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dirty) onSave();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-2 text-[11px] font-semibold",
            dirty ? "border border-current bg-bg text-fg" : "text-current/45",
          )}
        >
          <KoText text="저장" />
        </button>
      ) : null}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label="목록 정렬"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="inline-flex size-9 shrink-0 items-center justify-center"
      >
        <span className={cn("inline-flex size-4 items-center justify-center rounded-full border-2", on ? "border-current" : "border-current/45")}>
          {on ? <span className="size-2 rounded-full bg-current" /> : null}
        </span>
      </button>
    </span>
  );
}

export function SortGrip({ onPointerDown }: { onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      aria-label="순서 이동"
      onPointerDown={onPointerDown}
      className="inline-flex size-10 shrink-0 cursor-grab items-center justify-center text-fg-subtle active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function sortRow(id: string) {
  if (!id || typeof document === "undefined") return null;
  const esc = window.CSS?.escape ? window.CSS.escape(id) : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return document.querySelector(`[data-sort-id="${esc}"]`) as HTMLElement | null;
}

function layoutTop(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const tr = getComputedStyle(node).transform;
  if (!tr || tr === "none") return rect.top;
  try {
    return rect.top - (new DOMMatrix(tr).m42 || 0);
  } catch {
    return rect.top;
  }
}

function showHold(row: HTMLElement | null) {
  if (!row) return;
  row.setAttribute("data-sort-hold", "1");
  row.style.position = "relative";
  row.style.zIndex = "30";
  row.style.boxShadow = "0 16px 34px rgba(0,0,0,.55), 0 0 0 2px rgba(255,255,255,.72)";
  row.style.transform = "scale(1.03)";
}

function hideHold(row: HTMLElement | null) {
  if (!row) return;
  row.getAnimations().forEach((anim) => anim.cancel());
  row.removeAttribute("data-sort-hold");
  row.style.position = "";
  row.style.zIndex = "";
  row.style.boxShadow = "";
  row.style.transform = "";
}

function crossedRow(list: HTMLElement, y: number, selfId: string) {
  const nodes = [...list.querySelectorAll("[data-sort-id]")] as HTMLElement[];
  const self = nodes.find((node) => node.getAttribute("data-sort-id") === selfId);
  if (!self) return "";
  const selfTop = layoutTop(self);
  let down = "";
  let up = "";
  for (const node of nodes) {
    const id = node.getAttribute("data-sort-id") || "";
    if (!id || id === selfId) continue;
    const top = layoutTop(node);
    const mid = top + node.offsetHeight / 2;
    if (top >= selfTop - 1) {
      if (y > mid) down = id;
    } else if (!up && y < mid) {
      up = id;
    }
  }
  return down || up;
}

export function useSortGesture(active: boolean, onMove: (from: string, to: string) => void) {
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const dragRef = useRef<{ id: string; pointer: number; list: HTMLElement | null } | null>(null);
  const lockRef = useRef(false);
  const yRef = useRef(0);
  useEffect(() => {
    if (!active) return;
    const swap = (y: number) => {
      const cur = dragRef.current;
      if (!cur || lockRef.current || !cur.list) return;
      const to = crossedRow(cur.list, y, cur.id);
      if (!to || to === cur.id) return;
      const before = new Map<string, number>();
      for (const node of [...cur.list.querySelectorAll("[data-sort-id]")] as HTMLElement[]) {
        const id = node.getAttribute("data-sort-id") || "";
        if (id) before.set(id, node.getBoundingClientRect().top);
      }
      lockRef.current = true;
      moveRef.current(cur.id, to);
      requestAnimationFrame(() => {
        for (const [id, top] of before) {
          const node = sortRow(id);
          if (!node) continue;
          const dy = top - node.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) continue;
          const held = id === cur.id;
          node.animate(
            [
              { transform: held ? `translateY(${dy}px) scale(1.03)` : `translateY(${dy}px)` },
              { transform: held ? "translateY(0px) scale(1.03)" : "translateY(0px)" },
            ],
            { duration: 170, easing: "ease-out" },
          );
        }
        showHold(sortRow(cur.id));
        lockRef.current = false;
      });
    };
    const nudge = (y: number) => {
      const scroller = document.getElementById("pc-scroll");
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const edge = 64;
      if (y < box.top + edge) appScrollBy(-16, "auto");
      else if (y > box.bottom - edge) appScrollBy(16, "auto");
    };
    const move = (event: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || event.pointerId !== cur.pointer) return;
      yRef.current = event.clientY;
      event.preventDefault();
      swap(event.clientY);
    };
    const end = (event: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || cur.pointer !== event.pointerId) return;
      hideHold(sortRow(cur.id));
      dragRef.current = null;
      lockRef.current = false;
    };
    const edge = window.setInterval(() => {
      const cur = dragRef.current;
      if (!cur) return;
      nudge(yRef.current);
      swap(yRef.current);
    }, 40);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.clearInterval(edge);
      const id = dragRef.current?.id || "";
      if (id) hideHold(sortRow(id));
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [active]);
  return (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active || !id) return;
    event.preventDefault();
    event.stopPropagation();
    const row = event.currentTarget.closest("[data-sort-id]") as HTMLElement | null;
    const list = (row?.closest("[data-song-list]") as HTMLElement | null) ?? row?.parentElement ?? null;
    dragRef.current = { id, pointer: event.pointerId, list };
    yRef.current = event.clientY;
    showHold(row);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the window listener still moves the row */
    }
  };
}

export function ActRow({
  acts,
  actN,
  onPick,
  unlocked = false,
  readyActs = [],
  bundleAct = 0,
  onToggleBundle,
  genreId = "",
  youtubeUrl = "",
  mvUrl = "",
  playlistConfirmed = false,
  sortOn = false,
  sortDirty = false,
  onToggleSort,
  onSaveSort,
}: {
  acts: typeof ACTS;
  actN: number;
  onPick: (n: ActId) => void;
  unlocked?: boolean;
  readyActs?: number[];
  bundleAct?: number;
  onToggleBundle?: (n: ActId) => void;
  genreId?: string;
  youtubeUrl?: string;
  mvUrl?: string;
  playlistConfirmed?: boolean;
  sortOn?: boolean;
  sortDirty?: boolean;
  onToggleSort?: () => void;
  onSaveSort?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const slot = `${genreId}:${actN}`;
  const [own, setOwn] = useState<{ slot: string; url: string; text: string } | null>(null);
  if (own && own.slot !== slot) setOwn(null);
  useEffect(() => {
    let stop = false;
    const apply = (url: string, text: string) => {
      if (stop) return;
      setOwn({ slot, url, text });
    };
    const unwatch = watchDescReady(() => {
      const next = readActPreview(genreId, actN);
      if (next) apply(next.url, next.text);
    });
    const cached = readActPreview(genreId, actN);
    if (cached?.text) apply("", cached.text);
    return () => {
      stop = true;
      unwatch();
    };
  }, [genreId, actN, slot]);
  const current = acts.find((item) => item.n === actN) ?? acts[0];
  const songsReady = readyActs.includes(actN);
  const ready = unlocked && songsReady;
  const open = ready && bundleAct === actN;
  const playlistKey = `playlist:${genreId}:${actN}`;
  const mine = own?.slot === slot ? own : null;
  const fileUrl = youtubeUrl.trim();
  const videoId = youtubeId(fileUrl);
  const [ytOpen, setYtOpen] = useState(false);
  useEffect(() => {
    if (!playlistConfirmed || !videoId) {
      setYtOpen(false);
      return;
    }
    let stop = false;
    let timer = 0;
    const look = () => {
      window.clearTimeout(timer);
      void askYoutubePublic(videoId).then((ok) => {
        if (stop) return;
        setYtOpen(ok);
        if (!ok) timer = window.setTimeout(look, PUBLIC_HOLD_MS + 2000);
      });
    };
    look();
    const onShow = () => {
      if (document.visibilityState === "visible") look();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [playlistConfirmed, videoId]);
  const lpOn = playlistConfirmed && ytOpen;
  const showDesc = !unlocked && (playlistConfirmed || songsReady) && readPref(genreId as GenreId).actOutput.ytDesc !== false;
  const joinedBelow = menuOpen || open || showDesc;
  if (!current) return null;
  return (
    <section id="act-picker" className="mt-5">
      <p className="flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase">
        ACT
        <span className="rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg">
          <KoText text="필수" />
        </span>
      </p>
      <div className={cn("act-bundle mt-2", (ready || showDesc) && "bookmark-card", open && "bookmark-card-on")}>
        <div
          className={cn(
            "relative flex min-h-[52px] w-full items-center",
            playlistConfirmed && ytOpen
              ? "bg-mark text-mark-fg"
              : playlistConfirmed
                ? "act-title-held"
                : "bg-surface text-fg",
            joinedBelow ? "rounded-t-2xl" : "rounded-2xl",
          )}
        >
          <span className={cn("act-lp", lpOn && "act-lp-on")} aria-hidden>
            <span className="act-lp-disc" />
            <svg className="act-lp-arm" viewBox="0 0 56 52">
              <path
                d={playlistConfirmed ? "M2 2 L22 27" : "M2 2 L13 32"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <circle cx="2.2" cy="2.2" r="2.2" fill="currentColor" />
              <circle cx={playlistConfirmed ? 22 : 13} cy={playlistConfirmed ? 27 : 32} r="1.6" fill="currentColor" />
            </svg>
          </span>
          <div className="flex min-h-[52px] min-w-0 flex-1 items-center pl-14">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label="ACT 선택"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex min-h-[52px] min-w-0 flex-1 items-center py-2 text-left text-sm font-medium"
            >
              <span className="truncate">
                Act.{current.n} · {current.from}–{current.to}
              </span>
            </button>
            {unlocked && onToggleSort ? <ListSortRadio on={sortOn} dirty={sortDirty} onToggle={onToggleSort} onSave={onSaveSort} /> : null}
            <button
              type="button"
              aria-label="ACT 목록"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex min-h-[52px] items-center pr-3 pl-0.5"
            >
              <ChevronDown className={cn("size-4 shrink-0", menuOpen && "rotate-180")} />
            </button>
          </div>
          {fileUrl || mvUrl ? (
            <span className="pr-3">
              <YoutubeLink url={fileUrl} mvUrl={mvUrl} subscribe={playlistConfirmed} />
            </span>
          ) : null}
        </div>
        {menuOpen ? (
          <div className="border-t border-border">
            {acts.map((item, index) => {
              const on = item.n === actN;
              const outerBottom = index === acts.length - 1 && !open;
              return (
                <button
                  key={item.n}
                  type="button"
                  onClick={() => {
                    onPick(item.n);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex min-h-[48px] w-full items-center px-4 text-left text-sm font-medium",
                    on ? "bg-mark/25 text-fg" : "bg-bg text-fg",
                    outerBottom && (ready ? "rounded-br-2xl rounded-bl-2xl" : "rounded-b-2xl"),
                  )}
                >
                  Act.{item.n} · {item.from}–{item.to}
                </button>
              );
            })}
          </div>
        ) : null}
        {fileUrl || mvUrl ? (
          <div className="bg-bg px-3 pt-2 text-fg">
            <PreviewStack
              song={fileUrl}
              mv={mvUrl}
              genreId={genreId}
              repeat
              playTitle={readCachedPlaylist(actN, genreId)?.youtubeTitle?.trim() || `Act.${actN}`}
              poster={readCachedPlaylist(actN, genreId)?.thumbUrl || ""}
              songPremium={linkPremiumOn(readCachedPlaylist(actN, genreId)?.ytPremium, genreId, String(actN), "song", "act")}
              mvPremium={linkPremiumOn(readCachedPlaylist(actN, genreId)?.mvPremium, genreId, String(actN), "mv", "act")}
              prompt={
                showDesc ? (
                  <DescPrompt foldKey={`desc:pl:${genreId}:${actN}`} label="설명란을 보려면 누르세요" anchorId="act-picker" followId={`act-desc-fold-${actN}`} />
                ) : ready && !open ? (
                  <FoldPrompt
                    label="결과창을 보려면 누르세요"
                    onOpen={() => {
                      queueFoldTop(`act-playlist-fold-${actN}`);
                      onToggleBundle?.(actN as ActId);
                    }}
                  />
                ) : null
              }
            />
          </div>
        ) : showDesc || (ready && !open) ? (
          <div className="bg-bg px-3 py-2 text-fg">
            {showDesc ? (
              <DescPrompt foldKey={`desc:pl:${genreId}:${actN}`} label="설명란을 보려면 누르세요" anchorId="act-picker" followId={`act-desc-fold-${actN}`} />
            ) : (
              <FoldPrompt
                label="결과창을 보려면 누르세요"
                onOpen={() => {
                  queueFoldTop(`act-playlist-fold-${actN}`);
                  onToggleBundle?.(actN as ActId);
                }}
              />
            )}
          </div>
        ) : null}
        {showDesc || ready ? (
          <div className="text-fg">
            {showDesc ? <PlaylistDescFold genreId={genreId} act={actN} show saved={mine?.text || ""} hidePrompt framed /> : null}
            {ready ? (
              <FoldPanel
                foldKey={playlistKey}
                domId={`act-playlist-fold-${actN}`}
                open={open}
                hidePrompt
                framed
                openLabel="결과창을 보려면 누르세요"
                closeLabel="결과 닫기"
                onOpen={() => onToggleBundle?.(actN as ActId)}
                onDismiss={() => onToggleBundle?.(actN as ActId)}
              >
                <div id="act-playlist-slot" className="min-w-0 px-1 pt-1" />
              </FoldPanel>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PlaylistDescFold({ genreId, act, show, saved = "", hidePrompt = false, framed = false }: { genreId: string; act: number; show: boolean; saved?: string; hidePrompt?: boolean; framed?: boolean }) {
  const key = `desc:pl:${genreId}:${act}`;
  const box = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState(descOpenKey);
  useEffect(() => watchDescOpen(setOpenKey), []);
  const open = show && openKey === key;
  const slot = `${genreId}:${act}`;
  const [text, setText] = useState(saved);
  const [textSlot, setTextSlot] = useState(slot);
  if (textSlot !== slot) {
    setTextSlot(slot);
    setText(saved);
  }
  useEffect(() => {
    setText(saved);
    if (!show || saved.trim()) return;
    let stop = false;
    void loadStudioPage({ data: { kind: "playlist", genreId, act } })
      .then((remote) => {
        if (stop || !remote || remote.kind !== "playlist" || !remote.pkg) return;
        const body = remote.pkg.youtubeDescription || "";
        if (!body.trim()) return;
        rememberActPreview(genreId, act, body, remote.pkg.youtubeUrl || "");
        setText(body);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [show, genreId, act, saved]);
  if (!show) return null;
  const shown = (text || saved || "").trim();
  return (
    <div ref={box} className="text-fg">
      <FoldPanel
        foldKey={key}
        domId={`act-desc-fold-${act}`}
        open={open}
        openLabel="설명란을 보려면 누르세요"
        closeLabel="설명 닫기"
        onOpen={() => chooseDesc(key, box.current)}
        onDismiss={() => chooseDesc(key, box.current)}
        hidePrompt={hidePrompt}
        framed={framed}
      >
        {shown ? (
          <MaybeTranslated text={shown} genreId={genreId}>
            {(body) => <DescriptionBody text={body} full mode="tracks" />}
          </MaybeTranslated>
        ) : null}
      </FoldPanel>
    </div>
  );
}

export function TitleOriginMark({
  title,
  original,
  source,
}: {
  confirmed?: boolean;
  title: string;
  original?: string;
  source?: "none" | "kept" | "converted";
}) {
  if (source === "none") return null;
  const name = title.trim();
  const base = (original || "").trim();
  if (!name || !base) return null;
  const box = "inline-flex max-w-full items-center gap-0.5 truncate rounded-[6px] border border-black/30 bg-black/20 px-1.5 text-[10px] font-normal leading-[14px]";
  if (name === base) {
    return (
      <span className={box}>
        <Equal className="size-2.5 shrink-0" aria-hidden />
        <KoText text="원곡과 동일" />
      </span>
    );
  }
  if (source === "converted") {
    return (
      <span className={box}>
        <EqualNot className="size-2.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{base}</span>
      </span>
    );
  }
  return null;
}

function songListVocal(genreId: string, n: string) {
  const pkg = readCachedPackage(n, genreId);
  if (pkg?.thumbCast) return labelForCast(pkg.thumbCast);
  return labelForCast(defaultThumbCast(genreId as GenreId));
}

function VocalInfoButton({ label }: { label: string }) {
  const box = "inline-flex max-w-full shrink-0 items-center truncate rounded-[6px] border border-black/30 bg-black/20 px-1.5 text-[10px] font-normal leading-[14px]";
  return (
    <button
      type="button"
      aria-label={`보컬정보 ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className={box}
    >
      <KoText text={label} />
    </button>
  );
}

function youtubeId(url: string) {
  const matched = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (matched) return matched[1];
  return url.match(/[?&]v=([\w-]{11})/)?.[1] ?? "";
}

export function youtubeOpenUrl(url: string, subscribe = false) {
  const id = youtubeId(url);
  if (!id) return url;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  return subscribe ? `${watch}&sub_confirmation=1` : watch;
}

export function YoutubeLink({ url, mvUrl = "", subscribe = false }: { url: string; mvUrl?: string; subscribe?: boolean }) {
  if (!url && !mvUrl) return null;
  const piece = "inline-flex h-8 items-center justify-center text-[11px] font-semibold text-white";
  return (
    <span className="ml-auto inline-flex shrink-0 overflow-hidden rounded-lg">
      <span className={`${piece} w-8 bg-[#ff0033]`} aria-hidden>
        <Youtube className="size-5" />
      </span>
      {url ? (
        <a
          href={youtubeOpenUrl(url, subscribe)}
          target="_blank"
          rel="noreferrer"
          aria-label={subscribe ? "Song, 유튜브에서 보고 채널 구독" : "Song"}
          onClick={(event) => event.stopPropagation()}
          className={`${piece} gap-1 bg-[#3a3a3c] px-2 shadow-[inset_1px_0_0_rgba(0,0,0,0.45)]`}
        >
          <Music className="size-3.5" />
          Song
        </a>
      ) : null}
      {mvUrl ? (
        <a
          href={youtubeOpenUrl(mvUrl)}
          target="_blank"
          rel="noreferrer"
          aria-label="MV"
          onClick={(event) => event.stopPropagation()}
          className={`${piece} gap-1 bg-[#3a3a3c] px-2 shadow-[inset_1px_0_0_rgba(0,0,0,0.45)]`}
        >
          <Clapperboard className="size-3.5" />
          MV
        </a>
      ) : null}
    </span>
  );
}

function PremiumMark() {
  return (
    <span className="premium-mark" aria-label="Premium">
      <Gem className="size-3 shrink-0" aria-hidden />
      <span>Premium</span>
    </span>
  );
}

export function PreviewStack({ song, mv, genreId, subscribe = false, prompt = null, songPremium = false, mvPremium = false, listSong = false, repeat = false, playTitle = "", poster = "" }: { song: string; mv: string; genreId: string; subscribe?: boolean; prompt?: ReactNode; songPremium?: boolean; mvPremium?: boolean; listSong?: boolean; repeat?: boolean; playTitle?: string; poster?: string }) {
  if (!song && !mv) return null;
  return (
    <div className="mt-2">
      {song ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <a
                href={youtubeOpenUrl(song, subscribe)}
                target="_blank"
                rel="noreferrer"
                aria-label={subscribe ? "Song, 유튜브에서 보고 채널 구독" : "Song"}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-fg"
              >
                <Youtube className="size-4 text-[#ff0033]" />
                Song
              </a>
              {songPremium ? <PremiumMark /> : null}
            </span>
            {prompt ? <span className="max-w-[58%] text-right leading-tight">{prompt}</span> : null}
          </div>
          <YoutubePreview url={song} genreId={genreId} listSong={listSong} repeat={repeat} playTitle={playTitle} poster={poster} />
        </div>
      ) : null}
      {song && mv ? <div className="my-2 h-px bg-white/25" aria-hidden /> : null}
      {mv ? (
        <div>
          <span className="mb-1 inline-flex items-center gap-1.5">
            <a
              href={youtubeOpenUrl(mv)}
              target="_blank"
              rel="noreferrer"
              aria-label="MV"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-fg"
            >
              <Youtube className="size-4 text-[#ff0033]" />
              MV
            </a>
            {mvPremium ? <PremiumMark /> : null}
          </span>
          <YoutubePreview url={mv} genreId={genreId} poster={poster} />
        </div>
      ) : null}
    </div>
  );
}

const publicCache = new Map<string, { open: boolean; at: number }>();
const publicWait = new Map<string, Promise<boolean>>();
const PUBLIC_HOLD_MS = 45000;
const OPEN_KEEP_MS = 6 * 60 * 60 * 1000;
const OPEN_STORE = "noa-yt-open";

function readKeptOpen(): Record<string, number> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = JSON.parse(sessionStorage.getItem(OPEN_STORE) || "{}") as Record<string, number>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function keptOpen(id: string) {
  const at = readKeptOpen()[id];
  return typeof at === "number" && Date.now() - at < OPEN_KEEP_MS;
}

function rememberOpen(id: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const kept = readKeptOpen();
    kept[id] = Date.now();
    sessionStorage.setItem(OPEN_STORE, JSON.stringify(kept));
  } catch {
    /* 기억은 다음 확인으로 대체 */
  }
}

function rememberedPublic(id: string) {
  const hit = publicCache.get(id);
  if (hit && (hit.open || Date.now() - hit.at < PUBLIC_HOLD_MS)) return hit.open;
  if (!keptOpen(id)) return null;
  publicCache.set(id, { open: true, at: Date.now() });
  return true;
}

function askYoutubePublic(id: string) {
  const known = rememberedPublic(id);
  if (known !== null) return Promise.resolve(known);
  let pending = publicWait.get(id);
  if (!pending) {
    pending = youtubeIsPublic({ data: { id } })
      .then((ok) => {
        const open = ok === true;
        publicCache.set(id, { open, at: Date.now() });
        if (open) rememberOpen(id);
        return open;
      })
      .catch(() => {
        publicCache.set(id, { open: false, at: Date.now() });
        return false;
      })
      .finally(() => {
        publicWait.delete(id);
      });
    publicWait.set(id, pending);
  }
  return pending;
}

export function askYoutubeOpen(url: string) {
  const id = youtubeId(String(url || ""));
  if (!id) return Promise.resolve(false);
  return askYoutubePublic(id);
}

export function knownYoutubeOpen(url: string) {
  const id = youtubeId(String(url || ""));
  if (!id) return false;
  return rememberedPublic(id);
}

export async function askYoutubeOpenMany(urls: string[]) {
  const ids = urls.map((url) => youtubeId(String(url || "")));
  const pending: string[] = [];
  for (const id of ids) {
    if (!id || rememberedPublic(id) !== null) continue;
    pending.push(id);
  }
  const unique = [...new Set(pending)];
  const chunks: string[][] = [];
  for (let at = 0; at < unique.length; at += 40) chunks.push(unique.slice(at, at + 40));
  const parts = await Promise.all(chunks.map((part) => youtubeArePublic({ data: { ids: part } }).catch(() => ({} as Record<string, boolean>))));
  for (const part of parts) {
    for (const [id, open] of Object.entries(part || {})) {
      const yes = open === true;
      publicCache.set(id, { open: yes, at: Date.now() });
      if (yes) rememberOpen(id);
    }
  }
  return ids.map((id) => Boolean(id && rememberedPublic(id)));
}

function GenreCompleteMark() {
  return (
    <span aria-label="완료" className="relative inline-flex size-[18px] shrink-0 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[#e8c547] shadow-[0_0_8px_rgba(232,197,71,0.9)]" />
      <span className="absolute inset-[2px] rounded-full bg-[#141414]" />
      <svg viewBox="0 0 16 16" className="relative size-[11px] text-[#e8c547]" aria-hidden>
        <path d="M3.2 8.1 6.3 11.1 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ComingSoonCard({ genreId, bare = false }: { genreId: string; bare?: boolean }) {
  const file = genreId || "kpop-original";
  return (
    <div className={cn("relative overflow-hidden bg-black", bare ? "rounded-none" : "mt-2 rounded-xl")}>
      <img src={`/coming/${file}.jpg`} alt="Coming Soon" className="aspect-video w-full object-cover" />
    </div>
  );
}

let playingToken = 0;
const playWatchers = new Set<(token: number) => void>();

function claimPlay(own: { current: number }) {
  playingToken += 1;
  own.current = playingToken;
  const token = playingToken;
  playWatchers.forEach((notify) => notify(token));
  return token;
}

function stopHeldPlay() {
  playingToken += 1;
  const token = playingToken;
  playWatchers.forEach((notify) => notify(token));
}

function watchPlay(onChange: (token: number) => void) {
  playWatchers.add(onChange);
  return () => {
    playWatchers.delete(onChange);
  };
}

type QueueState = { listId: string; queueKey: string; ids: string[]; urls: string[]; titles: string[]; index: number };
const strayKeys = new Set<string>();
const listedUrls = new Set<string>();

function rowKey(id: string, url: string) {
  return `${id}\n${url}`;
}

function sunoLink(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function isSunoRow(row: { id: string; url: string }) {
  return row.id.startsWith("suno:") || /suno\.com|suno\.ai/i.test(row.url);
}

function takeStray(keys: string[]) {
  strayKeys.clear();
  for (const key of keys) {
    if (key) strayKeys.add(key);
  }
}

function noteListSongs(list: HTMLElement) {
  listedUrls.clear();
  const nodes = [...list.querySelectorAll<HTMLElement>("[data-suno-url]")].filter((node) => (node.dataset.sunoUrl || "").trim());
  for (const node of nodes) listedUrls.add(sunoLink(node.dataset.sunoUrl || ""));
}

function applyStray(tracks: { id: string; url: string }[]) {
  strayKeys.clear();
  for (const row of tracks) {
    if (!isSunoRow(row)) continue;
    if (!listedUrls.has(sunoLink(row.url))) strayKeys.add(rowKey(row.id, row.url));
  }
}

function paintStray(list: HTMLElement | null, tracks: { id: string; url: string }[]) {
  if (!list) return;
  noteListSongs(list);
  applyStray(tracks);
}

function sunoTitleFits(listTitle: string, sunoTitle: string) {
  const own = listTitle.replace(/\s+/g, "").toLowerCase();
  const head = listTitle.split(/[-–|]/)[0]?.replace(/\s+/g, "").toLowerCase() || "";
  const got = sunoTitle.replace(/\s+/g, "").toLowerCase();
  return !(head.length >= 2 && !got.includes(head) && !own.includes(got));
}
let playQueue: QueueState | null = null;
let jukeboxHeld = false;
let oneShot = false;
let listEpoch = 0;
let repeatPlay: { title: string; url: string } | null = null;
let songLoop = false;
let songShuffle = false;
let shuffleOrder: number[] = [];
let playPaused = false;
let userHold = false;
let userPauseAt = 0;
let keepAliveUntil = 0;
let hiddenAt = 0;
let osPauseUntil = 0;
let cardPauseTimer = 0;
let pauseCommit = 0;
let pauseFromButton = false;
let videoLead = false;
let hiddenNudges = 0;
let pageLeft = false;
let hideTimer = 0;
const queueWatchers = new Set<() => void>();
const wantWatchers = new Set<(id: string) => void>();
let wakeHold: WakeLockSentinel | null = null;
let wakeWanted = false;

function emitQueue() {
  rememberQueue();
  queueWatchers.forEach((notify) => notify());
  syncMediaSession();
}

const QUEUE_STORE = "ep-series-studio:jukebox-queue";

function readSavedQueue(): QueueState | null {
  try {
    const raw = localStorage.getItem(QUEUE_STORE);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<QueueState> & { stray?: unknown };
    const ids = Array.isArray(data.ids) ? data.ids.map((id) => String(id || "")).filter(Boolean) : [];
    const urls = Array.isArray(data.urls) ? data.urls.map((url) => String(url || "")) : [];
    const titles = Array.isArray(data.titles) ? data.titles.map((title) => String(title || "")) : [];
    if (!ids.length || urls.length !== ids.length || titles.length !== ids.length) return null;
    const index = Number.isInteger(data.index) && Number(data.index) >= 0 && Number(data.index) < ids.length ? Number(data.index) : 0;
    takeStray(Array.isArray(data.stray) ? data.stray.map((key) => String(key || "")) : []);
    return { listId: String(data.listId || ""), queueKey: String(data.queueKey || ""), ids, urls, titles, index };
  } catch {
    return null;
  }
}

function rememberQueue() {
  try {
    if (!playQueue?.ids.length) return;
    localStorage.setItem(QUEUE_STORE, JSON.stringify({
      listId: playQueue.listId,
      queueKey: playQueue.queueKey,
      ids: playQueue.ids,
      urls: playQueue.urls,
      titles: playQueue.titles,
      index: playQueue.index,
      stray: [...strayKeys],
    }));
  } catch {
    /* this device did not keep the list */
  }
}

function queueRows(queue: QueueState) {
  return queue.ids.map((id, i) => ({ id, url: queue.urls[i] || "", title: queue.titles[i] || "" }));
}

function jukeboxLive() {
  return document.documentElement.dataset.appMini === "1" && !jukeboxHeld;
}

function clipKey(row: { id: string }) {
  return row.id;
}

function uniqueRows(rows: { id: string; url: string; title: string }[]) {
  const seen = new Set<string>();
  const out: { id: string; url: string; title: string }[] = [];
  for (const row of rows) {
    const key = clipKey(row);
    if (!row.id || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function stackQueue(rows: { id: string; url: string; title: string }[], index: number, key: string) {
  const turned = rows.slice(index).concat(rows.slice(0, index)).filter((row) => row.id);
  const block = uniqueRows(turned);
  if (!block.length) return null;
  if (jukeboxLive() && !playQueue?.ids.length) {
    const saved = readSavedQueue();
    if (saved?.ids.length) playQueue = saved;
  }
  if (!jukeboxLive() || !playQueue?.ids.length) return { tracks: block, at: 0, key };
  const freshIds = new Set(block.map((row) => row.id));
  const freshUrls = new Set(block.map((row) => row.url));
  const back = uniqueRows(queueRows(playQueue)).filter((row) => !freshIds.has(row.id) && !freshUrls.has(row.url));
  return { tracks: [...block, ...back], at: 0, key };
}

function watchPlayQueue(onChange: () => void) {
  queueWatchers.add(onChange);
  return () => {
    queueWatchers.delete(onChange);
  };
}

function watchWanted(onChange: (id: string) => void) {
  wantWatchers.add(onChange);
  return () => {
    wantWatchers.delete(onChange);
  };
}

async function holdScreen(on: boolean) {
  wakeWanted = on;
  if (!on) {
    const current = wakeHold;
    wakeHold = null;
    try {
      await current?.release();
    } catch {
      /* already released */
    }
    return;
  }
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    wakeHold = await navigator.wakeLock.request("screen");
    wakeHold.addEventListener("release", () => {
      wakeHold = null;
      if (wakeWanted && document.visibilityState === "visible") void holdScreen(true);
    });
  } catch {
    wakeHold = null;
  }
}

const realHidden = typeof Document === "undefined" ? undefined : Object.getOwnPropertyDescriptor(Document.prototype, "hidden")?.get;

function reallyHidden() {
  try {
    return realHidden ? Boolean(realHidden.call(document)) : document.hidden;
  } catch {
    return false;
  }
}

function pageInBack() {
  if (pageLeft || reallyHidden()) return true;
  try {
    return window.innerWidth < 2 || window.innerHeight < 2;
  } catch {
    return false;
  }
}

let liveHost: HTMLElement | null = null;
let liveRepeat = false;

function playerDock() {
  let dock = document.getElementById("play-dock");
  if (dock) return dock;
  dock = document.createElement("div");
  dock.id = "play-dock";
  dock.setAttribute("aria-hidden", "true");
  dock.style.cssText = "position:fixed;left:0;top:0;width:180px;height:102px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;background:#000;";
  document.body.appendChild(dock);
  return dock;
}

let dockBox = { left: 0, top: 0, width: 280, height: 158 };

function syncPlayDock() {
  const dock = playerDock();
  if (!livePlayer) {
    dock.style.opacity = "0";
    dock.style.pointerEvents = "none";
    placeOwner();
    return;
  }
  if (pageInBack() && !userHold && !playPaused && (playQueue || repeatPlay)) {
    placeOwner();
    return;
  }
  const host = liveHost;
  let over = false;
  if (!pageLeft && !reallyHidden() && host?.isConnected) {
    const rect = host.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < window.innerHeight) {
      dock.style.left = `${Math.round(rect.left)}px`;
      dock.style.top = `${Math.round(rect.top)}px`;
      dock.style.width = `${Math.round(rect.width)}px`;
      dock.style.height = `${Math.round(rect.height)}px`;
      dockBox = { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
      dock.style.opacity = "1";
      dock.style.pointerEvents = "auto";
      dock.style.zIndex = "30";
      over = true;
    }
  }
  if (!over) {
    const keep = pageInBack() && !userHold && !playPaused && (playQueue || repeatPlay);
    const width = keep ? Math.max(dockBox.width, 280) : 180;
    const height = keep ? Math.max(dockBox.height, 158) : 102;
    dock.style.left = keep ? `${dockBox.left}px` : "0px";
    dock.style.top = keep ? `${dockBox.top}px` : "0px";
    dock.style.width = `${width}px`;
    dock.style.height = `${height}px`;
    dock.style.opacity = keep ? "1" : "0";
    dock.style.pointerEvents = "none";
    dock.style.zIndex = keep ? "0" : "-1";
  }
  try {
    const frame = livePlayer.getIframe();
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.border = "0";
  } catch {
    /* iframe not ready */
  }
  placeOwner();
}

function placeOwner() {
  const video = document.getElementById("play-owner") as HTMLVideoElement | null;
  if (!video) return;
  if (!ownerId || ownerFailed) {
    video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;";
    return;
  }
  // The preview stays the picture. This element is the app player, not a second screen.
  if (pageInBack()) {
    video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;object-fit:cover;background:#000;";
    return;
  }
  video.style.cssText = "position:fixed;left:0;top:0;width:8px;height:8px;opacity:0.04;pointer-events:none;z-index:0;object-fit:cover;";
}

function onlyCardSound() {
  if (videoLead) return;
  try {
    if (jukeboxOn() && bodyFailed()) return;
    livePlayer?.mute();
    if (jukeboxOn()) livePlayer?.pauseVideo();
  } catch {
    /* the phone card is the only sound */
  }
  const owner = document.getElementById("play-owner") as HTMLMediaElement | null;
  if (owner) {
    ownerSwap = true;
    owner.muted = true;
    owner.volume = 0;
    try { owner.pause(); } catch { /* already quiet */ }
    ownerSwap = false;
  }
  const pip = document.getElementById("play-pip") as HTMLMediaElement | null;
  if (pip) {
    pip.muted = true;
    pip.volume = 0;
    try { pip.pause(); } catch { /* already quiet */ }
  }
  quietStandby();
}

function holdPicture(player?: YtHandle | null) {
  const target = player || livePlayer;
  if (!target) return;
  try {
    if (videoLead) {
      target.unMute();
      const state = target.getPlayerState?.();
      if (state !== 1 && state !== 3) target.playVideo();
      return;
    }
    if (!jukeboxOn() && oneShot) {
      if (playPaused || userHold) return;
      target.unMute();
      const state = target.getPlayerState?.();
      if (state !== 1 && state !== 3) target.playVideo();
      return;
    }
    if (jukeboxOn()) {
      if (bodyFailed()) {
        target.unMute();
        const state = target.getPlayerState?.();
        if (state !== 1 && state !== 3) target.playVideo();
        return;
      }
      target.mute();
      target.pauseVideo();
      return;
    }
    if (bodySounding()) {
      target.mute();
      target.pauseVideo();
      return;
    }
    if (playPaused || userHold) return;
    target.unMute();
    const state = target.getPlayerState?.();
    if (state !== 1 && state !== 3) target.playVideo();
  } catch {
    /* the picture keeps the sound until the app player is actually sounding */
  }
}

let pipVideo: HTMLVideoElement | null = null;
let pipCanvas: HTMLCanvasElement | null = null;
let pipDrawTimer = 0;

function songAudio() {
  return document.getElementById("music-player") as (HTMLAudioElement & { captureStream?: () => MediaStream }) | null;
}

function ensurePipVideo() {
  if (pipVideo?.isConnected) return pipVideo;
  const video = document.createElement("video");
  video.id = "play-pip";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.muted = true;
  video.volume = 0;
  video.disablePictureInPicture = true;
  const pip = video as HTMLVideoElement & { autoPictureInPicture?: boolean };
  pip.autoPictureInPicture = false;
  video.style.cssText = "position:fixed;left:-400px;top:0;width:320px;height:180px;opacity:1;pointer-events:none;z-index:0;";
  video.addEventListener("enterpictureinpicture", () => {
    video.muted = true;
    video.volume = 0;
    const audio = songAudio();
    if (audio) {
      audio.dataset.pip = "";
      audio.muted = false;
      audio.volume = 1;
    }
  });
  video.addEventListener("leavepictureinpicture", () => {
    video.muted = true;
    video.volume = 0;
    const audio = document.getElementById("music-player") as HTMLAudioElement | null;
    if (!audio) return;
    audio.dataset.pip = "";
    audio.muted = false;
    audio.defaultMuted = false;
    audio.volume = 1;
  });
  document.body.appendChild(video);
  pipVideo = video;
  return video;
}

function pipTitle() {
  const audio = songAudio();
  return audio?.title || (playQueue ? playQueue.titles[playQueue.index] : repeatPlay?.title) || "NOA STUDIO";
}

function drawIcon(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, on: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = on ? "#3ddc84" : "#ffffff";
  ctx.fillStyle = on ? "#3ddc84" : "#ffffff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "shuffle") {
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(18, 10);
    ctx.lineTo(28, 26);
    ctx.moveTo(4, 26);
    ctx.lineTo(18, 26);
    ctx.lineTo(28, 10);
    ctx.stroke();
  } else if (kind === "prev" || kind === "next") {
    const flip = kind === "next";
    ctx.translate(flip ? 32 : 0, 0);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillRect(4, 6, 4, 24);
    ctx.beginPath();
    ctx.moveTo(28, 6);
    ctx.lineTo(10, 18);
    ctx.lineTo(28, 30);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "play") {
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(28, 18);
    ctx.lineTo(8, 32);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "pause") {
    ctx.fillRect(8, 4, 6, 28);
    ctx.fillRect(20, 4, 6, 28);
  } else if (kind === "repeat" || kind === "repeat1") {
    ctx.beginPath();
    ctx.arc(16, 18, 11, 0.6, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24, 6);
    ctx.lineTo(30, 12);
    ctx.lineTo(20, 14);
    ctx.closePath();
    ctx.fill();
    if (kind === "repeat1") {
      ctx.font = "700 14px sans-serif";
      ctx.fillText("1", 12, 23);
    }
  }
  ctx.restore();
}

function drawPipFace() {
  const canvas = pipCanvas || document.createElement("canvas");
  pipCanvas = canvas;
  if (canvas.width !== 960) canvas.width = 960;
  if (canvas.height !== 540) canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 960, 540);
  const title = pipTitle();
  ctx.font = "600 44px sans-serif";
  ctx.fillStyle = "#ffffff";
  const width = ctx.measureText(title).width;
  const span = Math.max(width + 96, 420);
  const shift = (Date.now() / 28) % span;
  ctx.save();
  ctx.beginPath();
  ctx.rect(36, 70, 560, 80);
  ctx.clip();
  ctx.fillText(title, 36 - shift, 128);
  if (width > 520) ctx.fillText(title, 36 - shift + span, 128);
  ctx.restore();
  const queue = Boolean(playQueue);
  const icons = queue
    ? [
        ["shuffle", songShuffle],
        ["prev", false],
        [playPaused ? "play" : "pause", !playPaused],
        ["next", false],
        [songLoop ? "repeat1" : "repeat", songLoop],
      ]
    : [
        [playPaused ? "play" : "pause", !playPaused],
        ["repeat1", true],
      ];
  icons.forEach((item, index) => {
    drawIcon(ctx, String(item[0]), 620 + index * 64, 92, Boolean(item[1]));
  });
  const head = playHead();
  const end = Number(head.end || 0);
  const at = end > 0 ? Math.min(Number(head.at || 0), end) : 0;
  const pct = end > 0 ? at / end : 0;
  const clock = (sec: number) => {
    const n = Math.max(0, Math.floor(sec));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(clock(at), 36, 430);
  ctx.textAlign = "right";
  ctx.fillText(clock(end), 924, 430);
  ctx.textAlign = "left";
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(150, 408, 640, 16);
  ctx.fillStyle = "#2f7bff";
  ctx.fillRect(150, 408, 640 * pct, 16);
  if (!playPaused) {
    ctx.fillStyle = "#e8c547";
    ctx.fillRect(0, 0, 960, 6);
  }
  return canvas;
}

function startPipDraw() {
  if (pipDrawTimer) return;
  pipDrawTimer = window.setInterval(() => {
    if (!pipCanvas) return;
    drawPipFace();
  }, 80);
}

function releasePip() {
  const video = pipVideo;
  if (!video) return;
  if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {});
}

function stopPip() {
  window.clearInterval(pipDrawTimer);
  pipDrawTimer = 0;
  releasePip();
  try {
    pipVideo?.pause();
  } catch {
    /* already stopped */
  }
}

function armPip() {
  const pip = document.getElementById("play-pip") as (HTMLVideoElement & { autoPictureInPicture?: boolean }) | null;
  if (pip) {
    pip.autoPictureInPicture = false;
    pip.disablePictureInPicture = true;
    pip.muted = true;
    pip.volume = 0;
    try { pip.pause(); } catch { /* the silent picture stays down */ }
    if (document.pictureInPictureElement === pip) void document.exitPictureInPicture().catch(() => {});
  }
  if (!jukeboxOn() || typeof document === "undefined" || playPaused || userHold || (!playQueue && !repeatPlay)) {
    if (!jukeboxOn()) stopPip();
    return;
  }
  const audio = songAudio();
  if (!audio) return;
  audio.dataset.pip = "";
  audio.disableRemotePlayback = false;
  audio.muted = false;
  audio.defaultMuted = false;
  if (audio.paused && !audio.ended && !playPaused && !userHold) void audio.play().catch(() => {});
}

function leaveToBackground() {
  holdAudioFocus();
  hiddenAt = Date.now();
  osPauseUntil = hiddenAt + 900;
  keepAliveUntil = Date.now() + 4000;
  window.clearTimeout(pauseCommit);
  pauseCommit = 0;
  if (!pauseFromButton && (playPaused || userHold) && userPauseAt && Date.now() - userPauseAt < 800) {
    playPaused = false;
    userHold = false;
    pauseFromButton = false;
    if (!bodyFailed()) resumeBody();
  }
  pageLeft = true;
  document.documentElement.dataset.pageBack = "1";
  syncPlayDock();
  if (!jukeboxOn() && !sunoKeepsPlaying()) {
    if (bodySounding()) silencePicture();
    syncMediaSession();
    return;
  }
  if (userHold || playPaused || (!playQueue && !repeatPlay)) {
    syncMediaSession();
    return;
  }
  if (!videoLead && !bodyFailed()) hushPicture();
  onlyCardSound();
  holdThroughHide(livePlayer);
  armPip();
  keepOutputAlive();
  syncMediaSession();
  armBackgroundPlay();
}

function catchUpPreview() {
  if (jukeboxOn() && !bodyFailed()) return;
  if (pageInBack() || userHold || (!playQueue && !repeatPlay)) return;
  const id = playQueue?.ids[playQueue.index] || youtubeId(repeatPlay?.url || "");
  if (id) requestPlay(id);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!reallyHidden()) {
      pageLeft = false;
      hiddenAt = 0;
      keepAliveUntil = 0;
      delete document.documentElement.dataset.pageBack;
      hiddenNudges = 0;
      window.clearInterval(hideTimer);
      hideTimer = 0;
      if (playQueue && livePlayer) {
        let vid = liveId;
        try {
          vid = livePlayer.getVideoData?.()?.video_id || liveId;
        } catch {
          vid = liveId;
        }
        if (vid) {
          const card = document.querySelector<HTMLElement>(`[data-yt-queue="${CSS.escape(vid)}"]`);
          const host = card?.querySelector<HTMLElement>(".aspect-video");
          if (host) liveHost = host;
        }
      }
      syncPlayDock();
      releasePip();
      if (wakeWanted) void holdScreen(true);
      if (!userHold && (playQueue || repeatPlay)) {
        if (!videoLead && queueIsSuno()) {
          if (!bodyFailed()) resumeBody();
          hushPicture();
        } else if (!videoLead && bodySounding()) resumeBody();
        else if (!videoLead && !queueIsSuno()) resumePicture();
        if (!videoLead && !queueIsSuno()) catchUpPreview();
        syncMediaSession();
      }
      return;
    }
    leaveToBackground();
  }, true);
  document.addEventListener("resume", () => {
    pageLeft = false;
    delete document.documentElement.dataset.pageBack;
    syncPlayDock();
    if (userHold || (!playQueue && !repeatPlay)) return;
    if (videoLead) return;
    if (queueIsSuno()) {
      if (!bodyFailed()) resumeBody();
      hushPicture();
    } else if (!bodyFailed()) resumeBody();
    else {
      try {
        livePlayer?.playVideo();
      } catch {
        /* resume */
      }
    }
    catchUpPreview();
    syncMediaSession();
  });
  document.addEventListener("freeze", () => {
    leaveToBackground();
  });
}
let turnUntil = 0;
let lastWide = typeof window !== "undefined" && window.innerWidth > window.innerHeight;

function noteTurn() {
  turnUntil = Date.now() + 1600;
}

function inTurn() {
  return Date.now() < turnUntil;
}

function resumeAfterTurn() {
  if (userHold || playPaused || (!playQueue && !repeatPlay)) return;
  if (!jukeboxOn() && oneShot) {
    try {
      const state = livePlayer?.getPlayerState?.();
      if (state !== 1 && state !== 3) livePlayer?.playVideo();
    } catch {
      /* the picture resumes after the turn */
    }
    return;
  }
  if (!bodySounding() && !bodyFailed()) resumeBody();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    leaveToBackground();
  });
  window.addEventListener("noa-output-held", () => {
    keepAliveUntil = Date.now() + 2500;
    if (!(pageLeft || reallyHidden()) || userHold || playPaused) return;
    keepOutputAlive();
    armBackgroundPlay();
  });
  document.addEventListener("visibilitychange", () => {
    applyPhoneTheme();
    if (document.visibilityState === "hidden") syncMediaSession();
  });
  window.addEventListener("scroll", () => {
    if (livePlayer || ownerId) syncPlayDock();
  }, true);
  window.addEventListener("resize", () => {
    const wide = window.innerWidth > window.innerHeight;
    if (wide !== lastWide) {
      lastWide = wide;
      noteTurn();
      window.setTimeout(resumeAfterTurn, 350);
    }
    if (livePlayer) syncPlayDock();
  });
  window.addEventListener("orientationchange", () => {
    noteTurn();
    window.setTimeout(resumeAfterTurn, 350);
  });
}

function sessionLive() {
  if (typeof document === "undefined") return false;
  return Boolean(playQueue || repeatPlay);
}

function paintMediaPosition() {
  const session = navigator.mediaSession;
  if (!session?.setPositionState || (!jukeboxOn() && !sunoKeepsPlaying()) || (!playQueue && !repeatPlay)) return;
  const head = playHead();
  const duration = Number(head.end);
  const position = Number(head.at);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
  try {
    session.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(Math.max(0, position), duration),
    });
  } catch {
    /* the phone card ignores a bad position */
  }
}

function soundingNow() {
  return bodySounding();
}

function jukeboxOn() {
  return typeof document !== "undefined" && document.documentElement.dataset.appMini === "1";
}

function sunoKeepsPlaying() {
  return queueIsSuno() && !playPaused && !userHold && Boolean(playQueue || repeatPlay);
}

let cardGuard = 0;
let sessionMetaKey = "";
let phoneArtKey = "";
let phoneArtUrl = "";
let shownLevel = "#ffffff";

function holdAudioFocus() {
  if (pauseFromButton || (!playQueue && !repeatPlay)) return;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    /* this browser has no audio session */
  }
}

function phoneCard(on: boolean) {
  window.clearInterval(cardGuard);
  cardGuard = 0;
  setPhoneCard(on);
  for (const id of ["music-player", "music-player-next"]) {
    const el = document.getElementById(id) as HTMLAudioElement | null;
    if (el) el.disableRemotePlayback = false;
  }
  if (on || typeof navigator === "undefined" || !navigator.mediaSession) return;
  const wipe = () => {
    const session = navigator.mediaSession;
    if (!session || jukeboxOn() || sunoKeepsPlaying()) return;
    try {
      session.metadata = null;
      session.playbackState = "none";
    } catch {
      /* the phone card stays down */
    }
  };
  wipe();
  cardGuard = window.setInterval(wipe, 700);
}

function syncMediaSession() {
  const session = navigator.mediaSession;
  if (!session) return;
  const set = (name: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(name, fn);
    } catch {
      /* this action is not supported */
    }
  };
  const live = (jukeboxOn() || sunoKeepsPlaying()) && Boolean(playQueue || repeatPlay);
  if (live) onlyCardSound();
  phoneCard(live);
  const idNow = playQueue?.ids[playQueue.index] || "";
  const raw = playQueue ? listedTitle(playQueue.titles[playQueue.index] || "", idNow) : repeatPlay?.title || "플레이리스트";
  const title = raw || "NOA STUDIO";
  const cover = live ? coverOf(idNow) : "";
  try {
    if (!live) {
      if (sessionMetaKey !== "off") {
        session.metadata = null;
        session.playbackState = "none";
        sessionMetaKey = "off";
      }
    } else {
      const metaKey = `${idNow}\n${title}\n${cover}`;
      if (sessionMetaKey !== metaKey) {
        const card = { title, artist: "NOA STUDIO" };
        const picture = cover
          ? [{ src: cover, sizes: "512x512", type: (/\.png($|\?)/i.test(cover) ? "image/png" : /\.webp($|\?)/i.test(cover) ? "image/webp" : "image/jpeg") as "image/png" | "image/webp" | "image/jpeg" }]
          : [];
        try {
          session.metadata = new MediaMetadata({ ...card, artwork: picture });
        } catch {
          session.metadata = new MediaMetadata(card);
        }
        sessionMetaKey = metaKey;
        paintMediaPosition();
      }
      const want = playPaused ? "paused" : "playing";
      if (session.playbackState !== want) session.playbackState = want;
    }
  } catch {
    /* the phone card stays as the browser left it */
  }
  set("play", live ? () => {
    window.clearTimeout(cardPauseTimer);
    cardPauseTimer = 0;
    resumeOwner();
  } : null);
  set("pause", live ? () => {
    window.clearTimeout(cardPauseTimer);
    cardPauseTimer = 0;
    const now = Date.now();
    if (now < osPauseUntil) return;
    const hidden = pageLeft || reallyHidden() || document.visibilityState === "hidden";
    if (hidden) {
      if (hiddenAt && now - hiddenAt < 700) return;
      pauseOwner(true);
      return;
    }
    const tapped = now;
    cardPauseTimer = window.setTimeout(() => {
      cardPauseTimer = 0;
      if (Date.now() < osPauseUntil) return;
      if (hiddenAt && hiddenAt >= tapped - 80 && Date.now() - hiddenAt < 900) return;
      if (!playPaused) pauseOwner(true);
    }, 320);
  } : null);
  set("stop", null);
  set("nexttrack", live && playQueue ? () => stepQueue(1) : null);
  set("previoustrack", live && playQueue ? () => stepQueue(-1) : null);
  set("seekto", live ? (details) => {
    const at = details.seekTime;
    if (typeof at !== "number" || !Number.isFinite(at)) return;
    seekPlay(at);
    paintMediaPosition();
  } : null);
  set("seekbackward", null);
  set("seekforward", null);
  try {
    session.setActionHandler("enterpictureinpicture", null);
  } catch {
    /* the phone card is the player, not a silent picture */
  }
}

function beginQueue(origin: HTMLElement) {
  const own = origin.closest<HTMLElement>("[data-yt-queue]");
  const list = origin.closest<HTMLElement>("[data-song-list]");
  if (!list || !own) {
    if (playQueue) {
      playQueue = null;
      songLoop = false;
      playPaused = false;
      stopPlayQueue();
      emitQueue();
      void holdScreen(false);
    }
    return;
  }
  const nodes = [...list.querySelectorAll<HTMLElement>("[data-yt-queue]")];
  const index = nodes.indexOf(own);
  if (index < 0) return;
  const key = list.dataset.queueKey || list.id;
  const rows = nodes.map((node) => {
    const row = node.closest("[data-song-title]");
    const youtube = row?.getAttribute("data-yt-title")?.trim() || "";
    return {
      id: node.dataset.ytQueue || "",
      url: node.dataset.ytUrl || (node.dataset.ytQueue ? `https://youtu.be/${node.dataset.ytQueue}` : ""),
      title: youtube || row?.getAttribute("data-song-title") || "",
    };
  });
  const miniOn = document.documentElement.dataset.appMini === "1";
  if (!miniOn && jukeboxHeld) {
    const row = rows[index];
    if (!row?.id) return;
    oneShot = true;
    songLoop = false;
    songShuffle = false;
    shuffleOrder = [];
    playPaused = false;
    repeatPlay = null;
    userHold = false;
    hiddenNudges = 0;
    playQueue = { listId: list.id, queueKey: key, ids: [row.id], urls: [row.url], titles: [row.title], index: 0 };
    stopMusicPlayer();
    listEpoch += 1;
    paintStray(list, [row]);
    emitQueue();
    watchOneShot();
    void holdScreen(false);
    return;
  }
  oneShot = false;
  const stacked = stackQueue(rows, index, key);
  if (!stacked) return;
  const tracks = stacked.tracks;
  const at = stacked.at;
  playQueue = {
    listId: list.id,
    queueKey: stacked.key,
    ids: tracks.map((row) => row.id),
    urls: tracks.map((row) => row.url),
    titles: tracks.map((row) => row.title),
    index: at,
  };
  songLoop = false;
  if (songShuffle) mixShuffle(tracks.length, at);
  else shuffleOrder = [];
  playPaused = false;
  repeatPlay = null;
  userHold = false;
  hiddenNudges = 0;
  if (!miniOn) setAppMini(true);
  loadSongList(tracks, at);
  listEpoch += 1;
  if (!miniOn) setAppMini(true);
  paintStray(list, tracks);
  emitQueue();
  void holdScreen(false);
}

function beginRepeat(title: string, address = "") {
  const name = title || "플레이리스트";
  const miniOn = document.documentElement.dataset.appMini === "1";
  if (!miniOn && jukeboxHeld) {
    const id = youtubeId(address);
    if (!id) return;
    oneShot = true;
    playQueue = { listId: "act", queueKey: "act", ids: [id], urls: [address], titles: [name], index: 0 };
    repeatPlay = null;
    songLoop = false;
    playPaused = false;
    userHold = false;
    hiddenNudges = 0;
    stopMusicPlayer();
    listEpoch += 1;
    emitQueue();
    watchOneShot();
    void holdScreen(false);
    return;
  }
  oneShot = false;
  if (repeatPlay && repeatPlay.title === name && !playQueue) {
    if (address) repeatPlay = { title: name, url: address };
    return;
  }
  playQueue = null;
  repeatPlay = { title: name, url: address };
  const id = youtubeId(address);
  if (id) loadAct({ id, url: address, title: name });
  playPaused = false;
  userHold = false;
  hiddenNudges = 0;
  listEpoch += 1;
  if (!miniOn) setAppMini(true);
  emitQueue();
  void holdScreen(false);
}

type SunoRow = { id: string; url: string; title: string };
const sunoCovers = new Map<string, string>();

function coverOf(id: string) {
  const image = sunoCovers.get(id) || "";
  if (!/^https:\/\//i.test(image) || /ytimg|youtube|ggpht/i.test(image)) return "";
  return image;
}

function coverSrc(cover: string) {
  if (!cover) return "";
  return `/api/card-image?u=${encodeURIComponent(cover)}`;
}

function pauseJukeboxForVideo() {
  videoLead = true;
  if (playQueue || repeatPlay || bodySounding()) {
    playPaused = true;
    userHold = true;
    pauseBody();
    emitQueue();
  }
}

const sunoNames = new Map<string, string>();

function sunoRowTitle(node: HTMLElement) {
  const host = node.closest("[data-song-title]");
  return host?.getAttribute("data-song-title")?.trim() || "";
}

function listedTitle(title: string, id: string) {
  return sunoNames.get(id) || title.trim();
}

export function beginSuno(origin: HTMLElement) {
  const own = origin.closest<HTMLElement>("[data-suno-url]") || (origin.dataset.sunoUrl ? origin : null);
  const list = origin.closest<HTMLElement>("[data-song-list]");
  if (!list || !own) return;
  const nodes = [...list.querySelectorAll<HTMLElement>("[data-suno-url]")].filter((node) => (node.dataset.sunoUrl || "").trim());
  const index = nodes.indexOf(own);
  if (index < 0) return;
  const key = `${list.dataset.queueKey || list.id}:suno`;
  const rows: SunoRow[] = nodes.map((node) => {
    const url = (node.dataset.sunoUrl || "").trim();
    const songKey = (node.dataset.songKey || "").trim();
    const id = `suno:${songKey || url}`;
    return { id, url, title: sunoRowTitle(node) };
  });
  let tracks = rows;
  let at = index;
  const stacked = stackQueue(rows, index, key);
  if (stacked) {
    tracks = stacked.tracks;
    at = stacked.at;
  }
  videoLead = false;
  oneShot = false;
  jukeboxHeld = false;
  songLoop = false;
  if (songShuffle) mixShuffle(tracks.length, at);
  else shuffleOrder = [];
  playPaused = false;
  repeatPlay = null;
  userHold = false;
  hiddenNudges = 0;
  playQueue = {
    listId: list.id,
    queueKey: stacked?.key || key,
    ids: tracks.map((row) => row.id),
    urls: tracks.map((row) => row.url),
    titles: tracks.map((row) => row.title),
    index: at,
  };
  if (document.documentElement.dataset.appMini !== "1") setAppMini(true);
  paintStray(list, tracks);
  loadSongList(tracks.map((row) => ({ id: row.id, url: row.url, title: row.title })), at);
  listEpoch += 1;
  if (document.documentElement.dataset.appMini !== "1") setAppMini(true);
  hushPicture();
  emitQueue();
  void holdScreen(false);
  void fillSunoTitles(tracks);
}

async function fillSunoTitles(tracks: SunoRow[]) {
  const metas = await Promise.all(tracks.map(async (row) => {
    try {
      const res = await fetch(`/api/suno-audio?u=${encodeURIComponent(row.url)}&meta=1`);
      if (!res.ok) return { title: "", image: "" };
      const json = await res.json() as { title?: string; image?: string };
      return { title: String(json.title || "").trim(), image: String(json.image || "").trim() };
    } catch {
      return { title: "", image: "" };
    }
  }));
  if (!playQueue) return;
  const next = playQueue.titles.slice();
  const patch: Record<string, string> = {};
  let titleChanged = false;
  let imageChanged = false;
  tracks.forEach((row, i) => {
    const title = metas[i].title;
    const image = metas[i].image;
    if (image && /^https:\/\//i.test(image) && !/ytimg|youtube|ggpht/i.test(image) && sunoCovers.get(row.id) !== image) {
      sunoCovers.set(row.id, image);
      imageChanged = true;
    }
    if (!title) return;
    if (row.url) downloadTitles.set(row.url, title);
    if (!sunoTitleFits(row.title, title)) return;
    const at = playQueue?.ids.indexOf(row.id) ?? -1;
    if (at < 0 || !playQueue) return;
    if (sunoNames.get(row.id) === title && next[at] === title) return;
    sunoNames.set(row.id, title);
    if (row.url) downloadTitles.set(row.url, title);
    next[at] = title;
    patch[row.id] = title;
    titleChanged = true;
  });
  if (!titleChanged && !imageChanged) return;
  if (!playQueue) return;
  if (titleChanged) {
    playQueue = { ...playQueue, titles: next };
    retitleTracks(patch);
  }
  if (imageChanged) sessionMetaKey = "";
  emitQueue();
  if (imageChanged) syncMediaSession();
}

let oneListen = false;

function watchOneShot() {
  if (oneListen || typeof window === "undefined") return;
  oneListen = true;
  const check = () => {
    if (!oneShot || !playQueue || inTurn()) return;
    const id = playQueue.ids[playQueue.index] || "";
    if (!id) return;
    const card = document.querySelector<HTMLElement>(`[data-yt-queue="${CSS.escape(id)}"]`);
    if (!card || !card.isConnected) {
      stopPlayQueue();
      return;
    }
    const rect = card.getBoundingClientRect();
    if (rect.height < 4) return;
    if (rect.bottom < 8 || rect.top > window.innerHeight - 8) stopPlayQueue();
  };
  window.addEventListener("scroll", check, true);
}

function requestPlay(id: string) {
  if (!id || pageInBack()) return;
  wantWatchers.forEach((notify) => notify(id));
}

function queueIsSuno() {
  const id = playQueue?.ids[playQueue.index] || "";
  if (id.startsWith("suno:")) return true;
  return /suno\.com|suno\.ai/i.test(playQueue?.urls[playQueue.index] || "");
}

function songLine() {
  if (!playQueue) return null;
  const id = playQueue.ids[playQueue.index] || "";
  if (!id) return null;
  if (id.startsWith("suno:")) {
    const card = document.querySelector<HTMLElement>(`[data-suno-id="${CSS.escape(id)}"]`);
    return card?.closest<HTMLElement>("[data-song-title]") || card;
  }
  const card = document.querySelector<HTMLElement>(`[data-yt-queue="${CSS.escape(id)}"]`);
  const row = card?.closest<HTMLElement>("[data-song-title]");
  return row || card;
}

function followQueueSong() {
  listenSongReturn();
  const line = songLine();
  if (!line || pageInBack()) return;
  const notice = document.getElementById("play-notice");
  const bar = notice && notice.getBoundingClientRect().height > 8 ? notice.getBoundingClientRect().top : window.innerHeight;
  const gap = 8;
  const topLimit = 12;
  const rect = line.getBoundingClientRect();
  const overlap = rect.bottom - (bar - gap);
  if (overlap > 2) {
    appScrollBy(overlap, "auto");
    return;
  }
  if (rect.top < topLimit - 2) appScrollBy(rect.top - topLimit, "auto");
}

let songTimer = 0;
let songMoving = false;
let songListen = false;

function songOffScreen() {
  const line = songLine();
  if (!line) return false;
  const notice = document.getElementById("play-notice");
  const bar = notice && notice.getBoundingClientRect().height > 8 ? notice.getBoundingClientRect().top : window.innerHeight;
  const rect = line.getBoundingClientRect();
  return rect.bottom < 12 || rect.top > bar - 8;
}

function scheduleSongReturn() {
  if (songMoving || pageInBack() || !playQueue) return;
  window.clearTimeout(songTimer);
  songTimer = window.setTimeout(() => {
    if (!songOffScreen()) return;
    songMoving = true;
    followQueueSong();
    window.setTimeout(() => {
      songMoving = false;
    }, 500);
  }, 3000);
}

function listenSongReturn() {
  if (songListen || typeof window === "undefined") return;
  songListen = true;
  const bump = () => {
    if (!songMoving) scheduleSongReturn();
  };
  window.addEventListener("wheel", bump, { passive: true });
  window.addEventListener("touchmove", bump, { passive: true });
  window.addEventListener("pointerdown", bump, { passive: true });
  window.addEventListener("keydown", bump);
}

let advancing = false;
let pauseClose = 0;

function queueStillHere(id: string, repeat: boolean) {
  if (advancing) return true;
  if (repeat) return Boolean(repeatPlay);
  return isQueueHead(id);
}

function closeQueueIfIdle(id: string, repeat: boolean) {
  window.clearTimeout(pauseClose);
  pauseClose = window.setTimeout(() => {
    if (pageInBack() || queueIsSuno()) return;
    if (queueStillHere(id, repeat) && (livePlayer || ownerId || advancing)) return;
    if (!playQueue && !repeatPlay) return;
    if (repeat ? repeatPlay : isQueueHead(id)) stopPlayQueue();
  }, 80);
}

function picturePlaying() {
  try {
    const state = livePlayer?.getPlayerState?.();
    return state === 1 || state === 3;
  } catch {
    return false;
  }
}

function resumePicture() {
  if (userHold || playPaused || bodySounding()) return;
  if (!bodyFailed()) return;
  try {
    const state = livePlayer?.getPlayerState?.();
    if (state === 1 || state === 3) return;
    livePlayer?.unMute();
    livePlayer?.playVideo();
  } catch {
    /* the picture is the sound while this app has no audio file */
  }
}

function silencePicture() {
  try {
    livePlayer?.mute();
    livePlayer?.pauseVideo();
  } catch {
    /* the phone card belongs to this picture, so it has to stop */
  }
  const owner = document.getElementById("play-owner") as HTMLVideoElement | null;
  if (!owner || owner.paused) return;
  ownerSwap = true;
  owner.pause();
  owner.muted = true;
  ownerSwap = false;
}

function holdThroughHide(_player: YtHandle | null) {
  if (userHold || playPaused) return;
  if (!playQueue && !repeatPlay) return;
  if (!bodyFailed()) {
    silencePicture();
    keepOutputAlive();
    armPip();
  }
}

function armBackgroundPlay() {
  window.clearInterval(hideTimer);
  hideTimer = 0;
  if (userHold || playPaused || (!playQueue && !repeatPlay)) return;
  hideTimer = window.setInterval(() => {
    if (!pageInBack() || userHold || playPaused) {
      window.clearInterval(hideTimer);
      hideTimer = 0;
      return;
    }
    if (bodySounding()) return;
    if (bodyFailed()) return;
    keepOutputAlive();
  }, 2000);
}

function notePause(id: string, repeat: boolean) {
  if (userHold || playPaused) return;
  window.clearTimeout(pauseClose);
  if (pageInBack() || advancing) {
    if (pageInBack()) {
      pageLeft = true;
      holdThroughHide(livePlayer);
      armBackgroundPlay();
    }
    return;
  }
  if (ownerId && !ownerFailed) return;
  pauseClose = window.setTimeout(() => {
    if (advancing || pageInBack() || userHold || playPaused) return;
    syncPlayDock();
    try {
      const state = livePlayer?.getPlayerState();
      if (state === 1 || state === 3) return;
    } catch {
      /* player already gone */
    }
    if (repeat ? repeatPlay : isQueueHead(id)) holdPicture(livePlayer);
  }, 500);
}
function replayQueueHead() {
  if (!playQueue) return;
  const id = playQueue.ids[playQueue.index] || "";
  seekPlay(0);
  if (!bodyFailed() && bodyClock()) {
    resumeBody();
    return;
  }
  if (livePlayer && liveId === id) {
    try {
      livePlayer.seekTo(0, true);
      livePlayer.playVideo();
      return;
    } catch {
      /* reload this song */
    }
  }
  requestPlay(id);
}

function mixShuffle(total: number, keep: number) {
  const rest: number[] = [];
  for (let i = 0; i < total; i += 1) if (i !== keep) rest.push(i);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = rest[i];
    rest[i] = rest[j];
    rest[j] = swap;
  }
  shuffleOrder = [keep, ...rest];
}

function nextQueueIndex(dir: number) {
  if (!playQueue) return 0;
  const total = playQueue.ids.length;
  if (!songShuffle || shuffleOrder.length !== total) return (playQueue.index + dir + total) % total;
  let pos = shuffleOrder.indexOf(playQueue.index);
  if (pos < 0) pos = 0;
  return shuffleOrder[(pos + dir + total) % total];
}

function forgetQueue() {
  try {
    localStorage.removeItem(QUEUE_STORE);
  } catch {
    /* the device already dropped the list */
  }
}

function clearQueue() {
  forgetQueue();
  stopPlayQueue();
}

function dropQueueAt(index: number) {
  if (!playQueue) {
    clearQueue();
    return;
  }
  const total = playQueue.ids.length;
  if (index < 0 || index >= total) return;
  if (total <= 1) {
    clearQueue();
    return;
  }
  const was = playQueue.index;
  const ids = playQueue.ids.filter((_, i) => i !== index);
  const urls = playQueue.urls.filter((_, i) => i !== index);
  const titles = playQueue.titles.filter((_, i) => i !== index);
  let at = was;
  if (index < was) at = was - 1;
  else if (index === was) at = Math.min(index, ids.length - 1);
  playQueue = { ...playQueue, ids, urls, titles, index: at };
  if (songShuffle) mixShuffle(ids.length, at);
  else shuffleOrder = [];
  const jumped = syncSongList(queueRows(playQueue), at);
  emitQueue();
  if (jumped) {
    const id = ids[at] || "";
    if (id.startsWith("suno:")) hushPicture();
  }
}

function playQueueAt(index: number) {
  if (!playQueue || advancing) return;
  const total = playQueue.ids.length;
  if (index < 0 || index >= total || index === playQueue.index) return;
  advancing = true;
  playPaused = false;
  userHold = false;
  playQueue = { ...playQueue, index };
  if (songShuffle) mixShuffle(total, index);
  const id = playQueue.ids[index] || "";
  listEpoch += 1;
  videoLead = false;
  emitQueue();
  followQueueSong();
  if (id) startOwner(id);
  if (id.startsWith("suno:")) hushPicture();
  else requestPlay(id);
  window.setTimeout(() => {
    advancing = false;
  }, 400);
}

function stepQueue(dir: number) {
  if (!playQueue || advancing) return;
  const total = playQueue.ids.length;
  if (!total) return;
  advancing = true;
  playPaused = false;
  userHold = false;
  const index = nextQueueIndex(dir);
  playQueue = { ...playQueue, index };
  const nextId = playQueue.ids[index] || "";
  videoLead = false;
  if (nextId) startOwner(nextId);
  if (nextId.startsWith("suno:")) hushPicture();
  emitQueue();
  followQueueSong();
  if (!nextId.startsWith("suno:")) requestPlay(nextId);
  window.setTimeout(followQueueSong, 80);
  window.setTimeout(followQueueSong, 360);
  window.setTimeout(() => {
    advancing = false;
    followQueueSong();
  }, 900);
}

function advanceQueue() {
  if (!playQueue || advancing) return;
  if (oneShot) {
    stopPlayQueue();
    return;
  }
  if (songLoop) {
    replayQueueHead();
    return;
  }
  stepQueue(1);
}

function finishTrack() {
  if (videoLead || userHold || playPaused) return;
  const live = readMusicPlayer();
  if (repeatPlay && !playQueue) {
    if (bodySounding() || (pageInBack() && !bodyFailed())) {
      syncMediaSession();
      return;
    }
    const id = youtubeId(repeatPlay.url || "");
    if (livePlayer && id && liveId === id) {
      try {
        livePlayer.seekTo(0, true);
        livePlayer.unMute();
        livePlayer.playVideo();
      } catch {
        requestPlay(id);
      }
    } else if (id) requestPlay(id);
    syncMediaSession();
    return;
  }
  if (playQueue && live.track && playQueue.ids[playQueue.index] !== live.track.id) {
    const index = playQueue.ids.indexOf(live.track.id);
    if (index < 0) return;
    playQueue = { ...playQueue, index };
    emitQueue();
    if (!pageInBack()) {
      requestPlay(live.track.id);
      followQueueSong();
    }
    syncMediaSession();
    return;
  }
  if (advancing) return;
  advanceQueue();
}

function toggleSongLoop() {
  if (!playQueue) return;
  songLoop = !songLoop;
  setBodyLoop(songLoop);
  emitQueue();
}

function toggleShuffle() {
  if (!playQueue) return;
  songShuffle = !songShuffle;
  if (songShuffle) mixShuffle(playQueue.ids.length, playQueue.index);
  else shuffleOrder = [];
  emitQueue();
  if (bodySounding() || !livePlayer) return;
  let at = 0;
  try {
    at = Number(livePlayer.getCurrentTime() || 0);
  } catch {
    at = 0;
  }
  try {
    armPicture(livePlayer, at);
  } catch {
    /* the current song stays */
  }
}

function togglePlayPause() {
  if (!playQueue && !repeatPlay) return;
  if (playPaused) resumeOwner();
  else pauseOwner(true);
}

function pictureOwnsPlay() {
  if (videoLead) return true;
  try {
    const state = livePlayer?.getPlayerState?.();
    return state === 1 || state === 3;
  } catch {
    return false;
  }
}

function closeJukebox() {
  paintLevelColor("#0B0B0D");
  jukeboxHeld = true;
  setAppMini(false);
  if (!pictureOwnsPlay()) {
    stopPlayQueue();
    return;
  }
  oneShot = false;
  window.clearInterval(cardGuard);
  cardGuard = 0;
  playQueue = null;
  repeatPlay = null;
  songLoop = false;
  songShuffle = false;
  shuffleOrder = [];
  playPaused = false;
  userHold = false;
  pauseFromButton = false;
  window.clearInterval(hideTimer);
  hideTimer = 0;
  stopPip();
  stopMusicPlayer();
  emitQueue();
  void holdScreen(false);
  syncPlayDock();
  syncMediaSession();
}

export function stopPlayQueue() {
  oneShot = false;
  videoLead = false;
  window.clearInterval(cardGuard);
  cardGuard = 0;
  playQueue = null;
  repeatPlay = null;
  songLoop = false;
  songShuffle = false;
  shuffleOrder = [];
  playPaused = false;
  userHold = false;
  pageLeft = false;
  delete document.documentElement.dataset.pageBack;
  window.clearInterval(hideTimer);
  hideTimer = 0;
  stopPip();
  emitQueue();
  void holdScreen(false);
  playEnd.run = () => {};
  safeDrop();
  stopOwner();
  stopMusicPlayer();
  syncPlayDock();
  stopHeldPlay();
  syncMediaSession();
}

function isQueueHead(id: string) {
  return Boolean(playQueue && playQueue.ids[playQueue.index] === id);
}

type YtHandle = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (id: string | { videoId: string; startSeconds?: number }, start?: number) => void;
  loadPlaylist: (list: string[], index: number, start: number) => void;
  nextVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getIframe: () => HTMLIFrameElement;
  getVideoData: () => { video_id?: string };
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
};

let livePlayer: YtHandle | null = null;
let liveId = "";
let bootingId = "";
let wantedId = "";
let playerGen = 0;
let pictureKey = "";
const pictureWatchers = new Set<() => void>();

function watchPicture(onChange: () => void) {
  pictureWatchers.add(onChange);
  return () => {
    pictureWatchers.delete(onChange);
  };
}

function notePicture() {
  const next = livePlayer || bootingId ? (liveId || bootingId) : "";
  if (next === pictureKey) return;
  pictureKey = next;
  pictureWatchers.forEach((notify) => notify());
}
const playEnd = { run: () => {} };

let ownerId = "";
let ownerFailed = false;
let ownerSwap = false;
let ownerNudges = 0;
let ownerPlay: Promise<void> | null = null;
let ownerWatch = 0;

function kickOwner(audio: HTMLMediaElement) {
  if (userHold || ownerPlay || !audio.paused || audio.ended) return;
  ownerPlay = audio.play().then(
    () => {
      ownerPlay = null;
    },
    () => {
      ownerPlay = null;
      if (audio.error || !pageInBack()) markOwnerFailed();
    },
  );
}

function ownerAudio() {
  let el = document.getElementById("play-owner") as HTMLVideoElement | null;
  if (el && el.tagName !== "VIDEO") {
    el.remove();
    el = null;
  }
  if (el) return el;
  el = document.createElement("video");
  el.id = "play-owner";
  el.preload = "auto";
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  el.controls = false;
  el.disablePictureInPicture = true;
  el.style.cssText = "position:fixed;left:0;top:0;width:8px;height:8px;opacity:0.04;pointer-events:none;z-index:0;object-fit:cover;";
  el.addEventListener("playing", () => {
    ownerNudges = 0;
    if (ownerFailed || userHold) {
      ownerSwap = true;
      el?.pause();
      ownerSwap = false;
      return;
    }
    if (el) {
      el.muted = false;
      el.volume = 1;
    }
    playPaused = false;
    quietPicture();
    placeOwner();
    syncMediaSession();
  });
  el.addEventListener("loadedmetadata", () => syncMediaSession());
  el.addEventListener("pause", () => {
    if (ownerSwap || userHold || ownerFailed) return;
    if (!ownerId || (!playQueue && !repeatPlay)) return;
    if (el?.ended) return;
    if ((el?.duration || 0) > 0 && (el?.currentTime || 0) >= (el?.duration || 0) - 0.25) return;
    if (ownerNudges > 8) return;
    ownerNudges += 1;
    kickOwner(el);
  });
  el.addEventListener("ended", () => {
    if (ownerSwap || userHold || el?.loop) return;
    playEnd.run();
  });
  el.addEventListener("error", () => {
    if (ownerSwap || !ownerId || el?.dataset.yt !== ownerId) return;
    markOwnerFailed();
  });
  el.addEventListener("timeupdate", () => paintMediaPosition());
  document.body.appendChild(el);
  return el;
}

function quietPicture() {
  if (!soundingNow()) return;
  try {
    livePlayer?.mute();
    livePlayer?.pauseVideo();
  } catch {
    /* the picture stops only after the app player is actually sounding */
  }
}

function syncPicture() {
  quietPicture();
}

let ownerWant: { host: HTMLElement; id: string; repeat: boolean } | null = null;

function retireOwner() {
  ownerId = "";
  ownerFailed = false;
  ownerNudges = 0;
  ownerWant = null;
  window.clearTimeout(ownerWatch);
  const audio = document.getElementById("play-owner") as HTMLMediaElement | null;
  if (!audio) return;
  ownerSwap = true;
  try {
    audio.pause();
  } catch {
    /* already stopped */
  }
  audio.dataset.yt = "";
  audio.removeAttribute("src");
  try {
    audio.load();
  } catch {
    /* already cleared */
  }
  const box = audio.style;
  box.opacity = "0";
  box.zIndex = "-1";
  box.pointerEvents = "none";
  ownerSwap = false;
}

function markOwnerFailed() {
  if (ownerFailed) return;
  ownerFailed = true;
  holdPicture();
  syncMediaSession();
}

function armOwnerWatch(id: string) {
  void id;
}

function startOwner(id: string) {
  openBody(id, Boolean(repeatPlay) || songLoop);
  armPip();
}

setMusicHooks({
  sounding() {
    const id = playQueue?.ids[playQueue.index] || youtubeId(repeatPlay?.url || "");
    ownerId = id;
    ownerFailed = false;
    if (!String(id).startsWith("suno:")) {
      try {
        alignBody(Number(livePlayer?.getCurrentTime?.() || 0));
      } catch {
        alignBody(0);
      }
    } else videoLead = false;
    quietPicture();
    onlyCardSound();
    syncMediaSession();
    armPip();
  },
  failed() {
    markOwnerFailed();
    const id = playQueue?.ids[playQueue.index] || youtubeId(repeatPlay?.url || "");
    if (id && !id.startsWith("suno:") && !livePlayer) requestPlay(id);
  },
  ended() {
    finishTrack();
  },
  upcoming() {
    if (oneShot || !playQueue || songLoop || playPaused || userHold) return "";
    const index = nextQueueIndex(1);
    return playQueue.ids[index] || "";
  },
  tick() {
    paintMediaPosition();
  },
});

if (typeof document !== "undefined") {
  const stale = document.getElementById("play-owner") || document.getElementById("play-dock");
  if (stale) {
    document.getElementById("play-owner")?.remove();
    window.location.reload();
  }
}

function stopOwner() {
  ownerId = "";
  ownerFailed = false;
  ownerNudges = 0;
  const audio = document.getElementById("play-owner") as HTMLAudioElement | null;
  if (!audio) return;
  ownerSwap = true;
  audio.pause();
  audio.dataset.yt = "";
  audio.removeAttribute("src");
  try {
    audio.load();
  } catch {
    /* already cleared */
  }
  ownerSwap = false;
}

function playHead() {
  const body = bodyClock();
  if (body) return body;
  try {
    return { at: Number(livePlayer?.getCurrentTime?.() || 0), end: Number(livePlayer?.getDuration?.() || 0) };
  } catch {
    return { at: 0, end: 0 };
  }
}

function seekPlay(at: number) {
  if (!bodyFailed()) seekBody(at);
  if (bodySounding() || videoLead || queueIsSuno()) return;
  try {
    livePlayer?.seekTo(at, true);
  } catch {
    /* picture follows until the app player is sounding */
  }
}

function resumeOwner() {
  videoLead = false;
  playPaused = false;
  userHold = false;
  pauseFromButton = false;
  hiddenNudges = 0;
  ownerNudges = 0;
  hushPicture();
  armPip();
  if (!bodyFailed()) resumeBody();
  emitQueue();
}

function keepSong() {
  window.clearTimeout(pauseCommit);
  pauseCommit = 0;
  pauseFromButton = false;
  playPaused = false;
  userHold = false;
  if (!bodyFailed()) resumeBody();
  armPip();
  try {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
  } catch {
    /* the phone card stays with the song */
  }
  emitQueue();
}

function commitUserPause(fromButton: boolean) {
  window.clearTimeout(pauseCommit);
  pauseCommit = 0;
  pauseFromButton = fromButton;
  userPauseAt = Date.now();
  playPaused = true;
  userHold = true;
  window.clearInterval(hideTimer);
  hideTimer = 0;
  stopPip();
  pauseBody();
  try {
    livePlayer?.pauseVideo();
  } catch {
    /* pause the picture too */
  }
  emitQueue();
}

function songHasStarted() {
  return ["music-player", "music-player-next"].some((id) => {
    const node = document.getElementById(id) as HTMLAudioElement | null;
    return Boolean(node && node.getAttribute("src") && node.currentTime > 0.25 && !node.ended);
  });
}

function pauseOwner(direct = false) {
  if (direct) {
    commitUserPause(true);
    return;
  }
  if (pageLeft || reallyHidden() || queueIsSuno() && (pageLeft || reallyHidden())) {
    keepSong();
    keepOutputAlive();
    return;
  }
  if (!songHasStarted()) {
    keepSong();
    keepOutputAlive();
    return;
  }
  if (queueIsSuno()) {
    window.setTimeout(() => {
      if (playPaused && userHold) return;
      if (pageLeft || reallyHidden()) {
        keepSong();
        keepOutputAlive();
        return;
      }
      commitUserPause(false);
    }, 350);
    return;
  }
  commitUserPause(false);
}

function blankYtFrame(frame: HTMLIFrameElement) {
  try {
    const win = frame.contentWindow;
    if (win) {
      for (const func of ["mute", "pauseVideo", "stopVideo"]) {
        win.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
      }
    }
  } catch {
    /* the stop command still posts */
  }
  try {
    const src = frame.src || frame.getAttribute("src") || "";
    if (src && src !== "about:blank") frame.src = "about:blank";
  } catch {
    /* already detached */
  }
}

function ytGrave() {
  let bin = document.getElementById("yt-grave");
  if (bin) return bin;
  bin = document.createElement("div");
  bin.id = "yt-grave";
  bin.setAttribute("aria-hidden", "true");
  bin.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(bin);
  return bin;
}

function parkYtNode(node: HTMLElement) {
  const bin = ytGrave();
  if (!bin.contains(node)) bin.appendChild(node);
  const quiet = () => {
    if (node instanceof HTMLIFrameElement) blankYtFrame(node);
    node.querySelectorAll("iframe").forEach((frame) => {
      if (frame instanceof HTMLIFrameElement) blankYtFrame(frame);
    });
  };
  quiet();
  const obs = new MutationObserver(quiet);
  obs.observe(node, { childList: true, subtree: true });
  window.setTimeout(() => {
    quiet();
    obs.disconnect();
    node.remove();
  }, 4000);
}

function silenceStray(keep: HTMLIFrameElement | null) {
  document.querySelectorAll("iframe").forEach((node) => {
    if (!(node instanceof HTMLIFrameElement) || node === keep) return;
    const src = `${node.src || ""} ${node.getAttribute("src") || ""}`;
    const docked = Boolean(node.closest("#play-dock"));
    if (!docked && !/youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(src)) return;
    blankYtFrame(node);
    parkYtNode(node);
  });
}

function haltYtFrames() {
  document.querySelectorAll("iframe").forEach((node) => {
    if (!(node instanceof HTMLIFrameElement)) return;
    const src = `${node.src || ""} ${node.getAttribute("src") || ""}`;
    const docked = Boolean(node.closest("#play-dock"));
    const buried = Boolean(node.closest("#yt-grave"));
    if (!docked && !buried && !/youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(src)) return;
    blankYtFrame(node);
    parkYtNode(node);
  });
}

function safeDrop() {
  playerGen += 1;
  bootingId = "";
  wantedId = "";
  const player = livePlayer;
  livePlayer = null;
  liveId = "";
  try {
    player?.mute();
  } catch {
    /* the previous picture must go quiet before the next one */
  }
  try {
    player?.stopVideo();
  } catch {
    /* already stopped */
  }
  let frame: HTMLIFrameElement | null = null;
  try {
    frame = player?.getIframe?.() ?? null;
  } catch {
    frame = null;
  }
  if (frame) blankYtFrame(frame);
  const dock = document.getElementById("play-dock");
  if (dock) {
    for (const child of [...dock.children]) {
      if (child instanceof HTMLElement) parkYtNode(child);
    }
  }
  haltYtFrames();
  try {
    player?.destroy();
  } catch {
    /* destroy is optional once the frame is blank */
  }
  try {
    frame?.remove();
  } catch {
    /* iframe already gone */
  }
  notePicture();
}

let switchAt = 0;

function playWanted(player: YtHandle, id: string) {
  switchAt = Date.now();
  try {
    player.mute();
  } catch {
    /* cut the previous picture before the next one starts */
  }
  try {
    player.stopVideo();
  } catch {
    /* already quiet */
  }
  try {
    player.loadVideoById({ videoId: id, startSeconds: 0 });
  } catch {
    try {
      player.loadVideoById(id);
    } catch {
      /* a fresh player is created when this one cannot switch */
    }
  }
}

let pictureArm = 0;

function pictureOrder() {
  if (!playQueue || repeatPlay || playQueue.ids.length < 2) return null;
  if (songShuffle && shuffleOrder.length === playQueue.ids.length) {
    return {
      ids: shuffleOrder.map((i) => playQueue?.ids[i] || "").filter(Boolean),
      index: Math.max(0, shuffleOrder.indexOf(playQueue.index)),
    };
  }
  return { ids: playQueue.ids.filter(Boolean), index: playQueue.index };
}

function armPicture(_player: YtHandle, _start: number) {
  return false;
}

function showPlayer(host: HTMLElement, id: string, repeat: boolean) {
  liveHost = host;
  liveRepeat = repeat;
  if ((playPaused || userHold) && !videoLead && (liveId === id || (!liveId && (!bootingId || bootingId === id)))) {
    syncMediaSession();
    syncPlayDock();
    return;
  }
  if (livePlayer && liveId === id && !wantedId) {
    holdPicture(livePlayer);
    syncMediaSession();
    syncPlayDock();
    notePicture();
    return;
  }
  if (livePlayer) {
    const player = livePlayer;
    wantedId = "";
    bootingId = "";
    liveId = id;
    let swapped = false;
    try {
      playWanted(player, id);
      swapped = true;
    } catch {
      swapped = false;
    }
    if (swapped) {
      let keep: HTMLIFrameElement | null = null;
      try {
        keep = player.getIframe?.() ?? null;
      } catch {
        keep = null;
      }
      if (keep) silenceStray(keep);
      notePicture();
      syncPlayDock();
      syncMediaSession();
      return;
    }
  } else if (bootingId) {
    wantedId = id;
    bootingId = id;
    liveId = id;
    notePicture();
    syncPlayDock();
    return;
  }
  safeDrop();
  const token = playerGen;
  bootingId = id;
  notePicture();
  const dock = playerDock();
  const slot = document.createElement("div");
  slot.style.cssText = "width:100%;height:100%";
  dock.replaceChildren(slot);
  void loadYtApi().then(() => {
    const api = window as Window & { YT?: { Player: new (el: HTMLElement, opts: object) => YtHandle } };
    if (token !== playerGen || !slot.isConnected || !api.YT?.Player) return;
    const playId = wantedId || id;
    wantedId = "";
    liveId = playId;
    notePicture();
    livePlayer = new api.YT.Player(slot, {
      videoId: playId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
        ...(repeat ? { loop: 1, playlist: playId } : {}),
      },
      events: {
        onReady: (event: { target: YtHandle }) => {
          if (token !== playerGen) {
            try {
              event.target.mute();
              event.target.stopVideo();
              const frame = event.target.getIframe?.();
              if (frame) blankYtFrame(frame);
              event.target.destroy();
            } catch {
              /* a replaced picture must not start */
            }
            return;
          }
          const now = event.target.getVideoData?.()?.video_id || "";
          if (liveId && ((now && now !== liveId) || (!now && liveId !== playId))) {
            playWanted(event.target, liveId);
            return;
          }
          let frame: HTMLIFrameElement | null = null;
          try {
            frame = event.target.getIframe();
            frame.allow = "autoplay; encrypted-media";
            frame.style.width = "100%";
            frame.style.height = "100%";
            frame.style.border = "0";
          } catch {
            frame = null;
          }
          if (frame) silenceStray(frame);
          try {
            if (!repeat) armPicture(event.target, 0);
            holdPicture(event.target);
          } catch {
            /* the picture stays quiet */
          }
          syncPlayDock();
          syncMediaSession();
        },
        onStateChange: (event: { data: number; target: YtHandle }) => {
          if (token !== playerGen) {
            try {
              event.target.mute();
              event.target.stopVideo();
              const frame = event.target.getIframe?.();
              if (frame) blankYtFrame(frame);
            } catch {
              /* a replaced picture must not keep playing */
            }
            return;
          }
          const now = event.target.getVideoData?.()?.video_id || "";
          if (liveId && now && now !== liveId) {
            if (Date.now() - switchAt > 700) playWanted(event.target, liveId);
            else {
              try { event.target.mute(); } catch { /* stay quiet while the next picture loads */ }
            }
            return;
          }
          if (videoLead) {
            if (event.data === 1 || event.data === 3) {
              if (!now || now === liveId) {
                try { event.target.unMute(); } catch { /* the new picture takes the sound */ }
              }
              markYtPlaying();
              syncPlayDock();
              return;
            }
            if (event.data === 0) {
              if (Date.now() - switchAt < 1200) return;
              continueYtPreview();
              return;
            }
            return;
          }
          if (event.data === 1 || event.data === 3) {
            window.clearTimeout(pauseClose);
            if (!jukeboxOn() && oneShot) {
              playPaused = false;
              try { event.target.unMute(); } catch { /* the picture keeps its own sound */ }
              syncPlayDock();
              return;
            }
            if (pageInBack() && !bodyFailed()) {
              silencePicture();
              resumeBody();
              armPip();
              syncMediaSession();
              return;
            }
            holdPicture(event.target);
            syncMediaSession();
            return;
          }
          if (event.data === 0) {
            if (bodySounding() || userHold || playPaused) return;
            if (pageInBack() && !bodyFailed()) return;
            window.clearTimeout(pauseClose);
            finishTrack();
            return;
          }
          if (event.data === 2) {
            if (!jukeboxOn() && oneShot) {
              if (pageInBack() || reallyHidden() || inTurn()) {
                try { event.target.playVideo(); } catch { /* the picture stays up while the screen is off */ }
                return;
              }
              playPaused = true;
              return;
            }
            if (pageInBack()) {
              pageLeft = true;
              holdThroughHide(event.target);
              armBackgroundPlay();
              return;
            }
            if (ownerId && !ownerFailed) return;
            notePause(liveId, liveRepeat);
          }
        },
      },
    });
  });
}

function loadYtApi() {
  const host = window as Window & {
    YT?: { Player: new (el: HTMLElement, opts: object) => YtHandle };
    onYouTubeIframeAPIReady?: () => void;
  };
  if (host.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const prev = host.onYouTubeIframeAPIReady;
    host.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector("script[data-yt-api]")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.dataset.ytApi = "1";
      document.head.appendChild(script);
    }
    window.setTimeout(() => resolve(), 4000);
  });
}

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let installPrompt: InstallPrompt | null = null;

function installedApp() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    (window as Window & { __noaInstall?: InstallPrompt }).__noaInstall = installPrompt;
    window.dispatchEvent(new Event("noa-install"));
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    (window as Window & { __noaInstall?: InstallPrompt | null }).__noaInstall = null;
    window.dispatchEvent(new Event("noa-install"));
  });
}

function installEventNow() {
  return installPrompt || (window as Window & { __noaInstall?: InstallPrompt | null }).__noaInstall || null;
}

function deviceHasApp() {
  if (installedApp()) return Promise.resolve(true);
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  if (!nav.getInstalledRelatedApps) return Promise.resolve(false);
  return nav.getInstalledRelatedApps().then((apps) => apps.length > 0).catch(() => false);
}

function openInstallBrowser() {
  const target = `${window.location.origin}/?install=1`;
  const bare = target.replace(/^https?:\/\//, "");
  window.location.assign(`intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`);
}

function copyAddress(done: () => void) {
  const url = `${window.location.origin}/`;
  const finish = () => done();
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).then(finish).catch(() => {
      const input = document.createElement("textarea");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand("copy");
      } catch {
        /* the address stays on screen */
      }
      input.remove();
      finish();
    });
    return;
  }
  finish();
}

function InstallCue() {
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [inApp, setInApp] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => setInApp(installedApp());
    sync();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);
  function install() {
    const event = installEventNow();
    if (event) {
      void event.prompt().then(() => event.userChoice).then((choice) => {
        installPrompt = null;
        (window as Window & { __noaInstall?: InstallPrompt | null }).__noaInstall = null;
        if (choice.outcome === "accepted") setNote("installed");
      }).catch(() => {
        /* this browser did not open an install sheet */
      });
      return;
    }
    void deviceHasApp().then((yes) => {
      if (yes) {
        setNote("installed");
        return;
      }
      if (/Android/i.test(navigator.userAgent)) openInstallBrowser();
      window.setTimeout(() => {
        if (document.visibilityState === "visible") setNote("copy");
      }, 800);
    });
  }
  const address = typeof window !== "undefined" ? `${window.location.origin}/` : "";
  if (inApp !== false) return null;
  return (
    <>
      <button
        type="button"
        aria-label="앱 설치"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          install();
        }}
        className="relative z-10 inline-flex h-7 shrink-0 items-center rounded-full border border-mark px-2 text-[12px] font-medium text-mark"
      >
        설치
      </button>
      {note && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onPointerDown={(event) => event.stopPropagation()}>
              <div role="dialog" aria-label="앱 설치" className="flex w-max max-w-full flex-col gap-2 rounded-xl border border-white/15 bg-black px-4 py-3" onClick={(event) => event.stopPropagation()}>
                {note === "installed" ? (
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] leading-5 text-white">이미 설치되어 있습니다</p>
                    <button type="button" aria-label="닫기" onClick={() => setNote("")} className="inline-flex size-7 shrink-0 items-center justify-center text-white">×</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] leading-5 text-white">{address}</p>
                      <button
                        type="button"
                        onClick={() => copyAddress(() => setCopied(true))}
                        className="inline-flex h-7 shrink-0 items-center rounded-full border border-mark px-2 text-[12px] font-medium text-mark"
                      >
                        {copied ? "복사됨" : "복사"}
                      </button>
                      <button type="button" aria-label="닫기" onClick={() => setNote("")} className="inline-flex size-7 shrink-0 items-center justify-center text-white">×</button>
                    </div>
                    <p className="text-[12px] leading-5 text-white/80">주소창에 붙여 넣고 설치하세요</p>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function InstallAsk() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("install") !== "1") return;
    if (installedApp()) return;
    const sync = () => setOpen(Boolean(installEventNow()));
    sync();
    window.addEventListener("noa-install", sync);
    return () => window.removeEventListener("noa-install", sync);
  }, []);
  if (!open) return null;
  function yes() {
    const event = installEventNow();
    if (!event) return;
    void event.prompt().then(() => event.userChoice).then(() => {
      installPrompt = null;
      (window as Window & { __noaInstall?: InstallPrompt | null }).__noaInstall = null;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
      setOpen(false);
    }).catch(() => {
      /* the device did not open the install sheet */
    });
  }
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-5">
      <div role="dialog" aria-label="앱 설치" className="flex w-max max-w-full flex-col items-center gap-3 rounded-xl border border-white/15 bg-black px-4 py-4">
        <img src="/papa-logo.png" alt="" width={56} height={56} className="size-14 rounded-full" />
        <p className="text-center text-[13px] leading-5 text-white"><KoText text="NOA STUDIO를 설치 하시겠습니까?" /></p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={yes} className="inline-flex h-8 items-center rounded-full border border-mark px-3 text-[13px] font-medium leading-5 text-mark"><KoText text="설치" /></button>
          <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="inline-flex size-8 items-center justify-center text-white">×</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function loudArc(deg: number, r = 8) {
  const pt = (d: number) => {
    const rad = (d * Math.PI) / 180;
    return [12 + r * Math.sin(rad), 12 - r * Math.cos(rad)];
  };
  const [x, y] = pt(deg);
  const [x0, y0] = pt(0);
  const large = Math.abs(deg) > 180 ? 1 : 0;
  const sweep = deg < 0 ? 1 : 0;
  return `M ${x.toFixed(2)} ${y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x0.toFixed(2)} ${y0.toFixed(2)}`;
}

function levelColor(id: string) {
  return playBarColor(markFor(id));
}

function flatArt(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function frameArt(color: string, bmp: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  const pad = 48;
  const side = 256 - pad * 2;
  const scale = Math.max(side / bmp.width, side / bmp.height);
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, pad, side, side);
  ctx.clip();
  ctx.drawImage(bmp, pad + (side - w) / 2, pad + (side - h) / 2, w, h);
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function frameCover(key: string, color: string, cover: string) {
  try {
    const res = await fetch(`/api/card-image?u=${encodeURIComponent(cover)}`);
    if (!res.ok) return;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return;
    const bmp = await createImageBitmap(blob);
    const url = frameArt(color, bmp);
    bmp.close();
    if (!url || phoneArtKey !== key) return;
    phoneArtUrl = url;
    sessionMetaKey = "";
    syncMediaSession();
  } catch {
    /* a flat color still carries the bar color */
  }
}

function phoneArtwork(id: string, cover: string) {
  const color = levelColor(id);
  const key = `${color}\n${cover}`;
  if (phoneArtKey === key && phoneArtUrl) return phoneArtUrl;
  phoneArtKey = key;
  phoneArtUrl = flatArt(color);
  if (cover) void frameCover(key, color, cover);
  return phoneArtUrl;
}

function applyPhoneTheme() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const next = document.visibilityState === "hidden" && jukeboxOn() ? shownLevel : "#0B0B0D";
  if (meta.content !== next) meta.content = next;
}

function paintLevelColor(color: string) {
  if (typeof document === "undefined") return;
  shownLevel = color;
  document.documentElement.dataset.levelColor = color;
  applyPhoneTheme();
}

function PlayFill({ id, pct }: { id: string; pct: number }) {
  useSyncExternalStore(watchLoudness, readLoudness, () => null);
  const color = levelColor(id);
  useEffect(() => {
    paintLevelColor(color);
    syncMediaSession();
  }, [color, id]);
  return <div className="play-fill" style={{ width: `${pct}%`, background: color }} />;
}

function LoudnessDial({ id }: { id: string }) {
  const mark = useSyncExternalStore(watchLoudness, readLoudness, () => null);
  const mine = markFor(id) || (mark && mark.id === id ? mark : null);
  const spans = dialSpans(mine);
  const bits: string[] = [];
  if (spans.lift >= 0.45) bits.push(`마스터 +${spans.lift.toFixed(1)}`);
  if (spans.trim >= 0.45) bits.push(`LUFS ${mine && mine.gainDb < 0 ? "-" : "+"}${spans.trim.toFixed(1)}`);
  if (spans.peak >= 0.25) bits.push(`피크 -${spans.peak.toFixed(1)}`);
  const label = !mine?.ready ? "음량 측정" : mine.lufs == null ? "음량 보정 없음" : bits.length ? bits.join(", ") : "음량 -14";
  return (
    <svg viewBox="0 0 24 24" width={32} height={32} aria-label={label} className="pointer-events-none absolute inset-0 z-10 size-8">
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#3a3a3a" strokeWidth="2.2" />
      {spans.redDeg !== 0 ? <path d={loudArc(spans.redDeg, 10.6)} fill="none" stroke="#ff5a5a" strokeWidth="2.2" strokeLinecap="round" /> : null}
      {spans.blueDeg !== 0 ? <path d={loudArc(spans.blueDeg, 10.6)} fill="none" stroke="#2f7bff" strokeWidth="2.2" strokeLinecap="round" /> : null}
      {spans.peakDeg !== 0 ? <path d={loudArc(spans.peakDeg, 10.6)} fill="none" stroke="#f5c400" strokeWidth="2.2" strokeLinecap="round" /> : null}
    </svg>
  );
}

function FlowTitle({ name }: { name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const gap = useRef<HTMLSpanElement>(null);
  const clone = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const boxEl = box.current;
    const trackEl = track.current;
    const lineEl = line.current;
    const gapEl = gap.current;
    const cloneEl = clone.current;
    if (!boxEl || !trackEl || !lineEl || !gapEl || !cloneEl) return;
    let anim: Animation | null = null;
    const run = () => {
      anim?.cancel();
      trackEl.style.transform = "";
      const room = boxEl.clientWidth;
      const wide = lineEl.scrollWidth;
      if (room < 8 || wide < 1) return;
      if (wide <= room + 1) {
        gapEl.style.width = "0px";
        cloneEl.style.display = "none";
        return;
      }
      cloneEl.style.display = "";
      const gapPx = 36;
      gapEl.style.width = `${gapPx}px`;
      const distance = wide + gapPx;
      anim = trackEl.animate(
        [
          { transform: "translateX(0px)", offset: 0 },
          { transform: "translateX(0px)", offset: 0.4 },
          { transform: `translateX(-${distance}px)`, offset: 1 },
        ],
        { duration: 2200 + Math.round(distance * 42), iterations: Infinity, easing: "linear" },
      );
    };
    run();
    const watch = new ResizeObserver(run);
    watch.observe(boxEl);
    return () => {
      anim?.cancel();
      watch.disconnect();
    };
  }, [name]);
  return (
    <div ref={box} className="play-marquee">
      <div ref={track} className="play-marquee-track">
        <span ref={line} className="text-[13px] leading-5 text-white">{name}</span>
        <span ref={gap} aria-hidden className="play-marquee-gap" />
        <span ref={clone} aria-hidden className="text-[13px] leading-5 text-white">{name}</span>
      </div>
    </div>
  );
}

function playClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const rs = String(r).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${rs}`;
  return `${m}:${rs}`;
}

function listRows(list: HTMLElement) {
  return [...list.querySelectorAll<HTMLElement>("[data-yt-queue]")].map((node) => {
    const row = node.closest("[data-song-title]");
    const youtube = row?.getAttribute("data-yt-title")?.trim() || "";
    return {
      id: node.dataset.ytQueue || "",
      url: node.dataset.ytUrl || (node.dataset.ytQueue ? `https://youtu.be/${node.dataset.ytQueue}` : ""),
      title: youtube || row?.getAttribute("data-song-title") || "",
    };
  }).filter((row) => row.id);
}

function pictureNow() {
  try {
    const at = Number(livePlayer?.getCurrentTime?.() || 0);
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

function hushPicture() {
  markYtPaused();
  try {
    livePlayer?.mute();
    livePlayer?.pauseVideo();
  } catch {
    /* the picture yields when the jukebox takes the song */
  }
}

type YtMode = "off" | "one" | "seq" | "shuffle";
let ytMode: YtMode = "off";
let ytUserPause = false;
let ytListOn = false;
let ytBase: string[] = [];
let ytOrder: string[] = [];
let ytAt = 0;
let ytAdvancing = false;
const ytWatchers = new Set<() => void>();
let ytSnap = { mode: "off" as YtMode, paused: false, id: "" };

function publishYt() {
  const next = { mode: ytMode, paused: ytUserPause, id: liveId };
  if (ytSnap.mode === next.mode && ytSnap.paused === next.paused && ytSnap.id === next.id) return;
  ytSnap = next;
  ytWatchers.forEach((notify) => notify());
}

function subscribeYt(notify: () => void) {
  ytWatchers.add(notify);
  return () => {
    ytWatchers.delete(notify);
  };
}

function markYtPlaying() {
  if (!ytUserPause && ytSnap.paused === false && ytSnap.id === liveId && ytSnap.mode === ytMode) return;
  ytUserPause = false;
  publishYt();
}

function markYtPaused() {
  ytUserPause = true;
  publishYt();
}

function keepVideo() {
  videoLead = true;
  if (playQueue || repeatPlay || bodySounding()) {
    playPaused = true;
    userHold = true;
    pauseBody();
    emitQueue();
  }
}

function ytIdsFrom(origin: HTMLElement | null, id: string) {
  const list = origin?.closest<HTMLElement>("[data-song-list]");
  const queued = Boolean(origin?.closest("[data-yt-queue]"));
  if (!list || !queued) return id ? [id] : [];
  const ids = [...list.querySelectorAll<HTMLElement>("[data-yt-queue]")].map((node) => node.dataset.ytQueue || "").filter(Boolean);
  return ids.length ? ids : id ? [id] : [];
}

function shuffleRest(ids: string[]) {
  const rest = ids.slice();
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = rest[i];
    rest[i] = rest[j];
    rest[j] = swap;
  }
  return rest;
}

function rememberYtList(id: string, origin: HTMLElement | null) {
  const list = origin?.closest<HTMLElement>("[data-song-list]");
  ytListOn = Boolean(list && origin?.closest("[data-yt-queue]"));
  ytBase = ytIdsFrom(origin, id);
  if (ytMode === "shuffle" && ytListOn) {
    ytOrder = id ? [id, ...shuffleRest(ytBase.filter((item) => item !== id))] : shuffleRest(ytBase);
    ytAt = 0;
  } else {
    ytOrder = ytBase.slice();
    ytAt = Math.max(0, ytOrder.indexOf(id));
  }
  ytUserPause = false;
  publishYt();
}

function revealYt(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-yt-queue="${CSS.escape(id)}"]`);
  const line = card?.closest<HTMLElement>("[data-song-title]") || card;
  if (!line || pageInBack()) return;
  const rect = line.getBoundingClientRect();
  if (rect.bottom > window.innerHeight - 8) appScrollBy(rect.bottom - (window.innerHeight - 8), "auto");
  else if (rect.top < 12) appScrollBy(rect.top - 12, "auto");
}

function replayYt() {
  keepVideo();
  ytUserPause = false;
  publishYt();
  try {
    livePlayer?.seekTo(0, true);
    livePlayer?.unMute();
    livePlayer?.playVideo();
  } catch {
    /* the same picture starts again */
  }
}

function loadYtId(id: string) {
  if (!id) return;
  keepVideo();
  ytUserPause = false;
  publishYt();
  if (liveId === id && livePlayer) {
    try {
      livePlayer.unMute();
      livePlayer.playVideo();
    } catch {
      /* the same picture starts again */
    }
    revealYt(id);
    return;
  }
  requestPlay(id);
  revealYt(id);
}

function stepYt(dir: number) {
  if (ytAdvancing) return;
  if (!ytListOn || ytOrder.length < 2) {
    replayYt();
    return;
  }
  ytAdvancing = true;
  const total = ytOrder.length;
  ytAt = (ytAt + dir + total) % total;
  loadYtId(ytOrder[ytAt] || "");
  window.setTimeout(() => {
    ytAdvancing = false;
  }, 450);
}

function continueYtPreview() {
  if (ytUserPause || ytAdvancing) return;
  if (ytListOn && ytMode === "one") {
    replayYt();
    return;
  }
  if (ytListOn && (ytMode === "seq" || ytMode === "shuffle")) {
    if (ytOrder.length < 2) replayYt();
    else stepYt(1);
    return;
  }
  if (liveRepeat) {
    replayYt();
    return;
  }
  ytUserPause = true;
  publishYt();
}

function setYtMode(next: Exclude<YtMode, "off">) {
  const id = liveId || ytOrder[ytAt] || "";
  ytMode = ytMode === next ? "off" : next;
  if (id && ytBase.length) {
    if (ytMode === "shuffle") {
      ytOrder = [id, ...shuffleRest(ytBase.filter((item) => item !== id))];
      ytAt = 0;
    } else {
      ytOrder = ytBase.slice();
      ytAt = Math.max(0, ytOrder.indexOf(id));
    }
  }
  publishYt();
}

function toggleYtPreview() {
  keepVideo();
  let state = -1;
  try {
    state = livePlayer?.getPlayerState?.() ?? -1;
  } catch {
    state = -1;
  }
  if (ytUserPause || state === 0 || state === 2 || state === -1 || state === 5) {
    ytUserPause = false;
    publishYt();
    try {
      if (state === 0) livePlayer?.seekTo(0, true);
      livePlayer?.unMute();
      livePlayer?.playVideo();
    } catch {
      /* the picture stays until the player is ready */
    }
    return;
  }
  ytUserPause = true;
  publishYt();
  try {
    livePlayer?.pauseVideo();
  } catch {
    /* already quiet */
  }
}

function PreviewOps({ listSong, repeat }: { listSong: boolean; repeat: boolean }) {
  const snap = useSyncExternalStore(subscribeYt, () => ytSnap, () => ytSnap);
  const playing = !snap.paused;
  const press = (run: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    run();
  };
  return (
    <div className="yt-ops">
      <button type="button" aria-label="다시 재생" onClick={press(replayYt)} className="yt-op">
        <RotateCcw className="size-4" />
      </button>
      {listSong ? (
        <button type="button" aria-label="이전 곡" onClick={press(() => stepYt(-1))} className="yt-op">
          <SkipBack className="size-4" fill="currentColor" />
        </button>
      ) : null}
      <button type="button" aria-label={playing ? "일시정지" : "재생"} aria-pressed={playing} onClick={press(toggleYtPreview)} className={cn("yt-op", playing && "yt-on")}>
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </button>
      {listSong ? (
        <button type="button" aria-label="다음 곡" onClick={press(() => stepYt(1))} className="yt-op">
          <SkipForward className="size-4" fill="currentColor" />
        </button>
      ) : null}
      {listSong ? (
        <>
          <button type="button" aria-label="한 곡 반복" aria-pressed={snap.mode === "one"} onClick={press(() => setYtMode("one"))} className={cn("yt-op", snap.mode === "one" && "yt-on")}>
            <Repeat1 className="size-4" />
          </button>
          <button type="button" aria-label="순차 재생" aria-pressed={snap.mode === "seq"} onClick={press(() => setYtMode("seq"))} className={cn("yt-op", snap.mode === "seq" && "yt-on")}>
            <Repeat className="size-4" />
          </button>
          <button type="button" aria-label="셔플" aria-pressed={snap.mode === "shuffle"} onClick={press(() => setYtMode("shuffle"))} className={cn("yt-op", snap.mode === "shuffle" && "yt-on")}>
            <Shuffle className="size-4" />
          </button>
        </>
      ) : repeat ? (
        <span aria-label="한 곡 반복" className="yt-op yt-on">
          <Repeat1 className="size-4" />
        </span>
      ) : null}
    </div>
  );
}

function landAt(at: number) {
  if (!(at > 0.4)) return;
  const pull = () => {
    const clock = bodyClock();
    if (!clock || Math.abs(clock.at - at) > 1.2) seekBody(at);
  };
  window.setTimeout(pull, 200);
  window.setTimeout(pull, 700);
  window.setTimeout(pull, 1400);
}

function promoteOneShot() {
  if (!playQueue) return;
  const atSec = pictureNow();
  hushPicture();
  const at = playQueue.index;
  const id = playQueue.ids[at] || "";
  if (playQueue.queueKey === "act" || playQueue.listId === "act") {
    const title = playQueue.titles[at] || "플레이리스트";
    const url = playQueue.urls[at] || (id ? `https://youtu.be/${id}` : "");
    playQueue = null;
    repeatPlay = { title, url };
    songLoop = false;
    songShuffle = false;
    shuffleOrder = [];
    if (id) adoptQueue([{ id, url, title }], 0, true);
    landAt(atSec);
    emitQueue();
    return;
  }
  const cards = id ? [...document.querySelectorAll<HTMLElement>(`[data-yt-queue="${CSS.escape(id)}"]`)] : [];
  const card = cards.find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 4 && rect.bottom > 8 && rect.top < window.innerHeight - 8;
  }) || cards[0];
  const list = card?.closest<HTMLElement>("[data-song-list]");
  const rows = list ? listRows(list) : [];
  const index = rows.findIndex((row) => row.id === id);
  if (!list || index < 0 || rows.length < 2) {
    if (id) adoptQueue([{ id, url: playQueue.urls[at] || `https://youtu.be/${id}`, title: playQueue.titles[at] || "" }], 0, false);
    landAt(atSec);
    emitQueue();
    return;
  }
  playQueue = {
    listId: list.id,
    queueKey: list.dataset.queueKey || list.id,
    ids: rows.map((row) => row.id),
    urls: rows.map((row) => row.url),
    titles: rows.map((row) => row.title),
    index,
  };
  songLoop = false;
  songShuffle = false;
  shuffleOrder = [];
  adoptQueue(rows, index, false);
  paintStray(list, rows);
  landAt(atSec);
  emitQueue();
}

export function MiniCorner() {
  const mini = useAppMini();
  if (mini) return null;
  return (
    <button
      type="button"
      aria-label="작은 창"
      onClick={() => {
        jukeboxHeld = false;
        const shot = oneShot;
        oneShot = false;
        playPaused = false;
        if (shot) promoteOneShot();
        setAppMini(true);
        syncMediaSession();
      }}
      className="fixed z-[80] inline-flex h-8 items-center gap-1 pr-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
      style={{ top: "max(6px, env(safe-area-inset-top))", right: "max(2px, env(safe-area-inset-right))" }}
    >
      <span className="inline-flex h-5 items-center text-[11px] leading-none font-semibold tracking-wide" style={{ fontVariant: "small-caps" }}>jukebox</span>
      <PictureInPicture2 className="size-5" />
    </button>
  );
}

function MiniBox({ children, idle = false, paused = false }: { children: ReactNode; idle?: boolean; paused?: boolean }) {
  const playing = !idle && !paused;
  useEffect(() => {
    const root = document.documentElement;
    const write = () => {
      const node = document.getElementById("play-notice");
      const height = node ? Math.ceil(node.getBoundingClientRect().height) : 0;
      root.style.setProperty("--jukebox-cover", `${height > 8 ? height : 0}px`);
    };
    write();
    const node = document.getElementById("play-notice");
    const watch = node ? new ResizeObserver(write) : null;
    if (node && watch) watch.observe(node);
    window.addEventListener("resize", write);
    return () => {
      watch?.disconnect();
      window.removeEventListener("resize", write);
      root.style.setProperty("--jukebox-cover", "0px");
    };
  }, [playing, idle, paused]);
  if (typeof document === "undefined") return null;
  const box = (
    <div
      id="play-notice"
      role="status"
      className="mini-box mini-own"
      data-idle={idle ? "1" : undefined}
      data-paused={!idle && paused ? "1" : undefined}
    >
      {playing ? (
        <>
          <span aria-hidden className="notice-glow" />
          <span aria-hidden className="notice-sweep" />
        </>
      ) : null}
      {children}
    </div>
  );
  return createPortal(box, document.body);
}

function queueLineStyle(id: string, url: string, on: boolean) {
  if (strayKeys.has(rowKey(id, url))) return { color: "#ff4d4f", fontWeight: on ? 700 : 400 };
  const mark = markFor(id);
  const corrected = Boolean(mark?.ready && mark.lufs != null && mark.lufs >= -70);
  if (on && corrected) return { color: "#e8c547", fontWeight: 700 };
  if (on) return { color: "#ffffff", fontWeight: 700 };
  if (corrected) return { color: "#ffffff", fontWeight: 400 };
  return { color: "#9a9a9a", fontWeight: 400 };
}

export function PlayNotice() {
  const mini = useAppMini();
  const [, setTick] = useState(0);
  const [head, setHead] = useState({ at: 0, end: 0 });
  const [sheet, setSheet] = useState(false);
  const listDrag = useRef<{ y: number; top: number } | null>(null);
  useEffect(() => {
    if (playQueue?.ids.length) return;
    const saved = readSavedQueue();
    if (!saved?.ids.length) return;
    playQueue = saved;
    playPaused = true;
    userHold = true;
    jukeboxHeld = false;
    stageSongList(queueRows(saved), saved.index);
    const held = document.getElementById(saved.listId);
    if (held) paintStray(held, queueRows(saved));
    setAppMini(true);
    emitQueue();
    void fillSunoTitles(queueRows(saved));
  }, []);
  useEffect(() => watchPlayQueue(() => setTick((n) => n + 1)), []);
  useEffect(() => watchLoudness(() => setTick((n) => n + 1)), []);
  useEffect(() => watchMarks(() => setTick((n) => n + 1)), []);
  const queueIds = playQueue?.ids.join("\n") || "";
  useEffect(() => {
    if (!queueIds) return;
    for (const id of queueIds.split("\n")) {
      if (!id || markFor(id)?.ready) continue;
      void pullSavedLevel(id);
    }
  }, [queueIds]);
  useEffect(() => {
    const pull = () => {
      if (!playQueue && !repeatPlay) return;
      let at = 0;
      let end = 0;
      const head = playHead();
      at = head.at;
      end = head.end;
      if (!Number.isFinite(at) || at < 0) at = 0;
      if (!Number.isFinite(end) || end < 0) end = 0;
      const next = { at: Math.floor(at), end: Math.floor(end) };
      setHead((prev) => (prev.at === next.at && prev.end === next.end ? prev : next));
      paintMediaPosition();
      syncPicture();
      syncPlayDock();
    };
    pull();
    const timer = window.setInterval(pull, 400);
    return () => window.clearInterval(timer);
  }, []);
  if (!playQueue && !repeatPlay) {
    if (!mini) return null;
    return (
      <MiniBox idle>
        <div className="relative overflow-hidden">
          <div className="flex items-center gap-1.5 pr-3 pl-2 pt-2 pb-0">
            <img src="/jukebox-mark.png" alt="" width={24} height={24} className="mini-drag relative z-10 size-6 shrink-0 rounded-full object-cover" />
            <p className="play-marquee relative z-10 text-[13px] leading-5 text-white">재생 중인 곡이 없습니다</p>
            <div className="mini-ops relative z-10">
              <button type="button" aria-label="주크박스 닫기" onClick={() => { closeJukebox(); }} className="inline-flex size-6 shrink-0 items-center justify-center text-white">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="play-line">
            <span className="play-clock">0:00</span>
            <div className="play-track" />
            <span className="play-clock play-clock-end">0:00</span>
          </div>
        </div>
      </MiniBox>
    );
  }
  const name = playQueue ? listedTitle(playQueue.titles[playQueue.index] || "", playQueue.ids[playQueue.index] || "") : repeatPlay?.title || "플레이리스트";
  const trackId = playQueue?.ids[playQueue.index] || readMusicPlayer().track?.id || "";
  const cover = playQueue ? coverOf(playQueue.ids[playQueue.index] || "") : "";
  const press = (run: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    run();
  };
  const end = head.end;
  const at = end > 0 ? Math.min(head.at, end) : 0;
  const pct = end > 0 ? Math.min(100, Math.max(0, (at / end) * 100)) : 0;
  const rows = playQueue
    ? playQueue.titles.map((title, i) => ({ title: listedTitle(title || "", playQueue!.ids[i] || ""), i, on: i === playQueue!.index, id: playQueue!.ids[i] || "", url: playQueue!.urls[i] || "" }))
    : [{ title: repeatPlay?.title || "플레이리스트", i: 0, on: true, id: readMusicPlayer().track?.id || "", url: repeatPlay?.url || "" }];
  const playClass = playPaused || !outputCorrected() ? (playPaused ? "op-idle" : "shuffle-on") : "op-gold";
  if (mini) {
    return (
      <MiniBox paused={playPaused || !bodySounding()}>
        <div className="relative overflow-hidden">
          <div className="flex w-full min-w-0 items-center gap-1.5 pr-2 pl-2 pt-2">
            <span className="relative size-8 shrink-0">
              <img src={cover ? coverSrc(cover) : "/jukebox-mark.png"} alt="" width={24} height={24} key={cover || "mark"} className="mini-drag absolute inset-1 size-6 rounded-full object-cover" onError={(event) => {
                const img = event.currentTarget;
                if (img.dataset.fell === "raw") {
                  img.src = "/jukebox-mark.png";
                  return;
                }
                if (cover && img.dataset.fell !== "1") {
                  img.dataset.fell = "1";
                  img.src = cover;
                  return;
                }
                img.dataset.fell = "raw";
                img.src = "/jukebox-mark.png";
              }} />
              <LoudnessDial id={trackId} />
            </span>
            <FlowTitle name={name} />
            <InstallCue />
            <div className="mini-ops relative z-10 shrink-0">
            {playQueue ? (
              <>
                <button type="button" aria-label={songShuffle ? "셔플 끄기" : "셔플"} aria-pressed={songShuffle} onClick={press(toggleShuffle)} className={cn("inline-flex size-6 shrink-0 items-center justify-center", songShuffle ? "shuffle-on" : "text-white")}>
                  <Shuffle className="size-4" />
                </button>
                <button type="button" aria-label="이전 곡" onClick={press(() => stepQueue(-1))} className="inline-flex size-6 shrink-0 items-center justify-center text-white">
                  <SkipBack className="size-4" />
                </button>
                <button type="button" aria-label={playPaused ? "재생" : "일시정지"} aria-pressed={!playPaused} onClick={press(togglePlayPause)} className={cn("inline-flex size-6 shrink-0 items-center justify-center", playClass)}>
                  {playPaused ? <Play className="size-4" fill="currentColor" /> : <Pause className="size-4" fill="currentColor" />}
                </button>
                <button type="button" aria-label="다음 곡" onClick={press(() => stepQueue(1))} className="inline-flex size-6 shrink-0 items-center justify-center text-white">
                  <SkipForward className="size-4" />
                </button>
                <button type="button" aria-label={songLoop ? "반복 끄기" : "이 곡 반복"} aria-pressed={songLoop} onClick={press(toggleSongLoop)} className={cn("inline-flex size-6 shrink-0 items-center justify-center", songLoop ? "repeat-one" : "text-white")}>
                  {songLoop ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
                </button>
              </>
            ) : (
              <>
                <button type="button" aria-label={playPaused ? "재생" : "일시정지"} aria-pressed={!playPaused} onClick={press(togglePlayPause)} className={cn("inline-flex size-6 shrink-0 items-center justify-center", playClass)}>
                  {playPaused ? <Play className="size-4" fill="currentColor" /> : <Pause className="size-4" fill="currentColor" />}
                </button>
                <span aria-label="1곡 반복" className="repeat-one inline-flex size-6 shrink-0 items-center justify-center">
                  <Repeat1 className="size-4" />
                </span>
              </>
            )}
            <button type="button" aria-label="재생목록" aria-pressed={sheet} onClick={press(() => setSheet((open) => !open))} className={cn("inline-flex size-6 shrink-0 items-center justify-center", sheet ? "shuffle-on" : "text-white")}>
              <ListMusic className="size-4" />
            </button>
            <button type="button" aria-label="주크박스 닫기" onClick={press(() => { closeJukebox(); })} className="inline-flex size-6 shrink-0 items-center justify-center text-white">
              <X className="size-4" />
            </button>
            </div>
          </div>
          <div className="play-line">
          <span className="play-clock">{playClock(at)}</span>
          <div className="play-track">
            <PlayFill id={trackId} pct={pct} />
            <input
              type="range"
              min={0}
              max={end > 0 ? end : 0}
              step={1}
              value={at}
              disabled={end <= 0}
              aria-label="재생 위치"
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                seekPlay(next);
                setHead((prev) => ({ ...prev, at: Math.floor(next) }));
                paintMediaPosition();
              }}
              className="play-range"
            />
          </div>
          <span className="play-clock play-clock-end">{playClock(end)}</span>
        </div>
        </div>
        {sheet ? (
          <div className="border-t border-white/10">
            <div className="flex justify-end px-1.5 pt-1">
              <button type="button" aria-label="재생목록 비우기" onClick={press(() => { clearQueue(); setSheet(false); })} className="inline-flex size-6 items-center justify-center rounded-[3px] border border-white/45 text-white">
                <ListX className="size-3.5" />
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.i} className="flex items-start gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  aria-label="목록에서 빼기"
                  onClick={press(() => {
                    const last = !playQueue || playQueue.ids.length <= 1;
                    dropQueueAt(row.i);
                    if (last) setSheet(false);
                  })}
                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[3px] border border-white/55 text-white"
                >
                  <X className="size-3" />
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 py-0.5 text-left text-[13px] leading-5 break-words"
                  style={queueLineStyle(row.id, row.url, row.on)}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (playQueue && row.i !== playQueue.index) playQueueAt(row.i);
                    setSheet(false);
                  }}
                >
                  {row.title}
                </button>
              </div>
            ))}
            </div>
          </div>
        ) : null}
      </MiniBox>
    );
  }
  return null;

}

export function YoutubePreview({ url, genreId = "", bare = false, listSong = false, repeat = false, playTitle = "", poster = "" }: { url: string; genreId?: string; bare?: boolean; listSong?: boolean; repeat?: boolean; playTitle?: string; poster?: string }) {
  const id = youtubeId(url);
  void poster;
  const [thumbTry, setThumbTry] = useState(0);
  const picture = id ? `https://i.ytimg.com/vi/${id}/${["hqdefault", "mqdefault", "default"][Math.min(thumbTry, 2)]}.jpg` : "";
  const [play, setPlay] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<boolean | null>(null);
  const mine = useRef(0);
  const frame = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playRef = useRef(false);
  const descKey = useRef("");
  const boundDesc = useRef("");
  const pictureNow = useSyncExternalStore(watchPicture, () => pictureKey, () => "");
  const shown = play || (id !== "" && pictureNow === id);
  useEffect(() => watchPlay((token) => {
    if (token !== mine.current) {
      playRef.current = false;
      boundDesc.current = "";
      setPlay(false);
    }
  }), []);
  useEffect(() => watchWanted((next) => {
    if (!listSong || next !== id) return;
    claimPlay(mine);
    boundDesc.current = descKey.current;
    playRef.current = true;
    setPlay(true);
  }), [id, listSong]);
  const [descOpen, setDescOpen] = useState(false);
  useEffect(() => watchDescOpen((key) => {
    const desc = Boolean(key) && !key.startsWith("result:") && !key.startsWith("playlist:");
    descKey.current = desc ? key : "";
    if (playRef.current && desc && boundDesc.current && key !== boundDesc.current) {
      setDescOpen(false);
      return;
    }
    if (playRef.current && desc && !boundDesc.current) boundDesc.current = key;
    if (!desc) boundDesc.current = "";
    setDescOpen(desc && playRef.current && boundDesc.current === key);
  }), []);
  useEffect(() => {
    if (!play || descOpen) return;
    const el = frame.current;
    if (!el) return;
    let seen = false;
    let away = 0;
    const io = new IntersectionObserver((entries) => {
      const hit = entries[0];
      if (!hit) return;
      if (hit.isIntersecting) {
        seen = true;
        window.clearTimeout(away);
        if (repeat || isQueueHead(id)) syncPlayDock();
        return;
      }
      if (!seen || pageInBack()) return;
      window.clearTimeout(away);
      away = window.setTimeout(() => {
        if (pageInBack()) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 && rect.height < 1) return;
        if (rect.bottom > 0 && rect.top < window.innerHeight) return;
        if (videoLead && liveId === id) {
          syncPlayDock();
          return;
        }
        if (oneShot && isQueueHead(id)) {
          if (inTurn()) return;
          stopPlayQueue();
          setPlay(false);
          return;
        }
        if (repeat || isQueueHead(id) || pictureKey === id) {
          syncPlayDock();
          holdPicture(livePlayer);
          return;
        }
        setPlay(false);
      }, 400);
    }, { root: scrollBox(el), threshold: 0 });
    io.observe(el);
    return () => {
      window.clearTimeout(away);
      io.disconnect();
    };
  }, [play, descOpen, id]);
  useEffect(() => {
    if (!shown || !id) return;
    const host = hostRef.current;
    if (!host) return;
    playEnd.run = () => {
      finishTrack();
    };
    showPlayer(host, id, repeat);
    if (!repeat && isQueueHead(id)) followQueueSong();
    return () => {
      const hostNow = hostRef.current;
      const stillHere = liveHost === hostNow && (liveId === id || bootingId === id);
      if (!stillHere && !pageInBack()) {
        if (liveId === id || bootingId === id || (!liveId && !bootingId)) playEnd.run = () => {};
        closeQueueIfIdle(id, repeat);
      }
      syncPlayDock();
    };
  }, [shown, id, attempt, repeat, playTitle]);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    let timer = 0;
    const look = () => {
      window.clearTimeout(timer);
      void askYoutubePublic(id).then((ok) => {
        if (stop) return;
        setOpen(ok);
        if (!ok) timer = window.setTimeout(look, PUBLIC_HOLD_MS + 2000);
      });
    };
    setOpen(null);
    look();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [id]);
  if (!id) return null;
  if (open === false) return <ComingSoonCard genreId={genreId} bare={bare} />;
  if (open !== true) return <div className={cn("aspect-video w-full bg-black", bare ? "rounded-none" : "mt-2 rounded-xl")} />;
  const shell = bare ? "overflow-hidden bg-black" : "mt-2 overflow-hidden rounded-xl bg-black";
  return (
    <div ref={frame} data-yt-queue={listSong ? id : undefined} data-yt-url={listSong ? url : undefined} className={shell}>
      {shown ? (
        <>
          <div ref={hostRef} className="aspect-video w-full bg-black bg-cover bg-center" style={picture ? { backgroundImage: `url(${picture})` } : undefined} />
          <PreviewOps listSong={listSong} repeat={repeat} />
        </>
      ) : (
        <button
          type="button"
          aria-label="영상 바로 재생"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            pauseJukeboxForVideo();
            rememberYtList(id, event.currentTarget);
            claimPlay(mine);
            boundDesc.current = descKey.current;
            playRef.current = true;
            setDescOpen(Boolean(descKey.current));
            setPlay(true);
          }}
          className="relative block w-full"
        >
          {picture ? (
            <img
              src={picture}
              alt=""
              onError={() => setThumbTry((n) => n + 1)}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <span className="flex aspect-video w-full items-center justify-center bg-black text-sm text-white/80">재생</span>
          )}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="ml-0.5 size-7 fill-white" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

let descOpenKey = "";
const descWatchers = new Set<(key: string) => void>();
const descHold = { key: "", top: 0, on: false };
let foldTopId = "";

export function queueFoldTop(id: string) {
  foldTopId = id;
}
const closeHold: {
  on: boolean;
  key: string;
  domId: string;
  top: number;
  bottom: number;
  height: number;
  anchorTop: number;
  anchor: HTMLElement | null;
  scroller: HTMLElement | null;
} = {
  on: false,
  key: "",
  domId: "",
  top: 0,
  bottom: 0,
  height: 0,
  anchorTop: 0,
  anchor: null,
  scroller: null,
};

let foldCloseHold = 0;

export function holdFoldClose(ms = 1200) {
  foldCloseHold = Date.now() + ms;
}

function watchDescOpen(onChange: (key: string) => void) {
  descWatchers.add(onChange);
  onChange(descOpenKey);
  return () => {
    descWatchers.delete(onChange);
  };
}

function scrollBox(el: HTMLElement) {
  let node = el.parentElement;
  while (node) {
    const mode = getComputedStyle(node).overflowY;
    if ((mode === "auto" || mode === "scroll") && node.scrollHeight > node.clientHeight + 2) return node;
    node = node.parentElement;
  }
  return null;
}

function isPinned(el: HTMLElement) {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const pos = getComputedStyle(node).position;
    if (pos === "fixed" || pos === "sticky") return true;
    node = node.parentElement;
  }
  return false;
}

function findViewAnchor(fold: HTMLElement | null) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const probes = [height * 0.5, height * 0.35, height * 0.65, height * 0.22, height * 0.78];
  for (const y of probes) {
    if (y < 8 || y > height - 8) continue;
    const hit = document.elementFromPoint(Math.min(width - 8, Math.max(8, width / 2)), y);
    if (!(hit instanceof HTMLElement)) continue;
    if (hit === document.body || hit === document.documentElement) continue;
    if (isPinned(hit)) continue;
    if (fold && (hit === fold || fold.contains(hit))) continue;
    const row = hit.closest("[id^='ep-row-'], [id^='story-row-'], #act-picker, #story-pl-picker");
    const el = row instanceof HTMLElement ? row : hit;
    if (el === document.body || el === document.documentElement) continue;
    if (fold && (el === fold || el.contains(fold) || fold.contains(el))) continue;
    if (isPinned(el)) continue;
    return el;
  }
  return null;
}

function rememberClose(key: string, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const anchor = findViewAnchor(el);
  closeHold.on = true;
  closeHold.key = key;
  closeHold.domId = el.id || "";
  closeHold.top = rect.top;
  closeHold.bottom = rect.bottom;
  closeHold.height = rect.height;
  closeHold.anchor = anchor;
  closeHold.anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;
  closeHold.scroller = scrollBox(el);
}

function restoreClosedView() {
  if (!closeHold.on) return;
  const anchor = closeHold.anchor;
  const anchorTop = closeHold.anchorTop;
  const removed = closeHold.height;
  const bottom = closeHold.bottom;
  const top = closeHold.top;
  const scroller = closeHold.scroller;
  closeHold.on = false;
  closeHold.anchor = null;
  if (anchor?.isConnected) {
    const delta = anchor.getBoundingClientRect().top - anchorTop;
    if (Math.abs(delta) > 1) {
      appScrollBy(delta);
      return;
    }
    if (bottom > 12) return;
  }
  const shell = closeHold.domId ? document.getElementById(closeHold.domId) : null;
  const gap = removed - (shell ? shell.getBoundingClientRect().height : 0);
  if (gap < 1) return;
  const viewH = window.innerHeight;
  const adjust = bottom <= 12 ? gap : top >= viewH - 12 ? 0 : Math.min(gap, Math.max(0, -top));
  if (adjust < 1) return;
  if (scroller) scroller.scrollTop -= adjust;
  else appScrollBy(-adjust);
}

function chooseDesc(key: string, anchor: HTMLElement | null) {
  const closing = descOpenKey === key;
  const other = descOpenKey !== "" && descOpenKey !== key;
  if (closing && anchor) {
    rememberClose(key, anchor);
    descHold.on = false;
  } else {
    closeHold.on = false;
    closeHold.anchor = null;
    descHold.on = other && Boolean(anchor);
    descHold.key = key;
    descHold.top = anchor?.getBoundingClientRect().top ?? 0;
  }
  descOpenKey = closing ? "" : key;
  descWatchers.forEach((onChange) => onChange(descOpenKey));
}

export function resultFoldKey(genreId: string, n: string) {
  return `result:${genreId}:${padEp(n)}`;
}

export function foldIsOpen(key: string) {
  return descOpenKey === key;
}

export function openFold(key: string, anchor: HTMLElement | null) {
  if (!key || descOpenKey === key) return;
  chooseDesc(key, anchor);
}

export function closeFold(key: string, anchor: HTMLElement | null) {
  if (!key || descOpenKey !== key) return;
  chooseDesc(key, anchor);
}

export function dropFoldClose() {
  closeHold.on = false;
  closeHold.anchor = null;
}

export function clearResultFold() {
  if (!descOpenKey.startsWith("result:")) return;
  descHold.on = false;
  descOpenKey = "";
  descWatchers.forEach((onChange) => onChange(descOpenKey));
}

export function applyPendingFoldClose() {
  if (!closeHold.on) return;
  const el = closeHold.domId ? document.getElementById(closeHold.domId) : null;
  if (el && el.getBoundingClientRect().height > closeHold.height - 8) return;
  restoreClosedView();
}

function useFoldMotion(
  open: boolean,
  key: string,
  box: { current: HTMLDivElement | null },
  onLeave: (() => void) | null,
  allowLeave: boolean,
) {
  const leaveRef = useRef(onLeave);
  const allowRef = useRef(allowLeave);
  leaveRef.current = onLeave;
  allowRef.current = allowLeave;
  const [place] = useState<"follow" | "start" | "end">("follow");
  useLayoutEffect(() => {
    if (!open) return;
    const el = box.current;
    if (!el) return;
    if (foldTopId && el.id === foldTopId) {
      foldTopId = "";
      descHold.on = false;
      followTop(el);
      return;
    }
    if (!descHold.on || descHold.key !== key) return;
    descHold.on = false;
    if (!el) return;
    const delta = el.getBoundingClientRect().top - descHold.top;
    if (Math.abs(delta) < 1) return;
    const scroller = scrollBox(el);
    if (scroller) scroller.scrollTop += delta;
    else appScrollBy(delta);
  }, [open, key, box]);
  useLayoutEffect(() => {
    if (!open && closeHold.on && closeHold.key === key) restoreClosedView();
    return () => {
      if (closeHold.on && closeHold.key === key && !box.current?.isConnected) restoreClosedView();
    };
  }, [open, key, box]);
  useEffect(() => {
    if (!open || !allowLeave) return;
    let dead = false;
    let seen = false;
    let frame = 0;
    const check = () => {
      const el = box.current;
      if (!el || dead || !allowRef.current) return;
      const rect = el.getBoundingClientRect();
      if (Date.now() < foldCloseHold) return;
      if (rect.height < 8) return;
      const view = window.visualViewport;
      const top = view?.offsetTop ?? 0;
      const bottom = top + (view?.height ?? window.innerHeight);
      const visible = rect.bottom > top + 8 && rect.top < bottom - 8;
      if (visible) {
        seen = true;
        return;
      }
      if (!seen) return;
      dead = true;
      rememberClose(key, el);
      if (leaveRef.current) leaveRef.current();
      else if (foldIsOpen(key)) chooseDesc(key, el);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    const arm = window.setTimeout(onScroll, 500);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.visualViewport?.addEventListener("scroll", onScroll);
    window.visualViewport?.addEventListener("resize", onScroll);
    const el = box.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (dead || !allowRef.current) return;
              if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) return;
              onScroll();
            },
            { threshold: [0, 0.01] },
          )
        : null;
    if (el && io) io.observe(el);
    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(arm);
      io?.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onScroll);
    };
  }, [open, key, box, allowLeave]);
  return place;
}

function FoldClose({
  label,
  onClick,
  rootRef,
}: {
  place: "follow" | "start" | "end";
  label: string;
  onClick: (event: MouseEvent) => void;
  rootRef: { current: HTMLDivElement | null };
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const placeRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const place = () => {
      const root = rootRef.current;
      const btn = btnRef.current;
      if (!root || !btn || btn.dataset.hold === "1") return;
      const fold = root.getBoundingClientRect();
      const h = btn.offsetHeight || 32;
      const max = Math.max(0, fold.height - h);
      const view = window.visualViewport;
      const viewTop = view?.offsetTop ?? 0;
      const viewH = view?.height ?? window.innerHeight;
      const mid = viewTop + (viewH - h) / 2 - fold.top;
      const next = Math.round(Math.max(0, Math.min(max, mid)));
      const cards = [...root.querySelectorAll("section")]
        .map((el) => el.getBoundingClientRect())
        .filter((rect) => rect.height > 24 && rect.width > 40 && rect.bottom > fold.top && rect.top < fold.bottom);
      const width = btn.offsetWidth || 96;
      const hits = (y: number) => {
        const top = fold.top + y;
        const bottom = top + h;
        const left = fold.right - width - 4;
        const player = document.getElementById("play-notice")?.getBoundingClientRect();
        if (player && player.height > 8 && top < player.bottom - 4 && bottom > player.top + 4 && left < player.right - 4 && player.left < fold.right) return true;
        return cards.some((rect) => top < rect.bottom - 12 && bottom > rect.top + 12 && left < rect.right - 8);
      };
      let placed = next;
      if (cards.length && hits(placed)) {
        const sorted = [...cards].sort((a, b) => a.top - b.top);
        const spots = [0, max];
        for (let i = 0; i < sorted.length - 1; i += 1) {
          const gapTop = sorted[i].bottom - fold.top;
          const gapBottom = sorted[i + 1].top - fold.top;
          spots.push(gapTop + (gapBottom - gapTop) / 2 - h / 2);
        }
        const clear = spots
          .map((y) => Math.round(Math.max(0, Math.min(max, y))))
          .sort((a, b) => Math.abs(a - next) - Math.abs(b - next))
          .find((y) => !hits(y));
        if (clear != null) placed = clear;
      }
      const bar = root.querySelector(".save-row");
      if (bar) {
        const below = Math.round(bar.getBoundingClientRect().bottom - fold.top + 4);
        if (placed < below) placed = Math.min(max, below);
      }
      if (btn.style.top !== `${placed}px`) btn.style.top = `${placed}px`;
    };
    placeRef.current = place;
    place();
  });
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placeRef.current());
    };
    onScroll();
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.visualViewport?.addEventListener("scroll", onScroll);
    window.visualViewport?.addEventListener("resize", onScroll);
    const root = rootRef.current;
    const watch = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    if (root && watch) watch.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      watch?.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onScroll);
    };
  }, [label, rootRef]);
  return (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={() => {
        if (btnRef.current) btnRef.current.dataset.hold = "1";
      }}
      onPointerUp={() => {
        if (btnRef.current) btnRef.current.dataset.hold = "";
      }}
      onPointerCancel={() => {
        if (btnRef.current) btnRef.current.dataset.hold = "";
      }}
      onClick={onClick}
      className="absolute right-1 z-50 inline-flex h-11 max-w-[calc(100%-8px)] touch-manipulation items-center gap-1 rounded-full border border-white/30 bg-[#1c1c1e] px-3 text-xs font-medium leading-none text-white shadow-lg"
    >
      <ChevronDown className="size-3.5 shrink-0 rotate-180 text-mark" />
      <KoText text={label} />
    </button>
  );
}

export function FoldPanel({
  foldKey,
  open,
  pinned = false,
  openLabel,
  closeLabel,
  onOpen,
  onDismiss,
  children,
  domId,
  hidePrompt = false,
  framed = false,
}: {
  foldKey: string;
  open: boolean;
  pinned?: boolean;
  openLabel: string;
  closeLabel: string;
  onOpen: () => void;
  onDismiss: () => void;
  children: ReactNode;
  domId?: string;
  hidePrompt?: boolean;
  framed?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const place = useFoldMotion(open, foldKey, box, () => dismissRef.current(), !pinned);
  useEffect(() => {
    if (!open || foldIsOpen(foldKey)) return;
    openFold(foldKey, box.current);
  }, [open, foldKey]);
  if (!open && hidePrompt) return null;
  return (
    <div ref={box} id={domId} className={cn("relative min-w-0 [overflow-anchor:none]", open ? "mt-2" : "", framed && open && "border-t border-border bg-bg px-3 py-4")}>
      {open ? (
        <>
          <div ref={body} className="relative min-w-0 bg-bg">
            {children}
            <FoldClose
              rootRef={body}
              place={place}
              label={closeLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDismiss();
              }}
            />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpen();
          }}
          className="ml-auto flex w-fit items-center gap-1.5 text-xs font-medium text-fg"
        >
          <ChevronDown className="fold-bob size-4 shrink-0 text-mark" />
          <KoText text={openLabel} />
        </button>
      )}
    </div>
  );
}

export function FoldPrompt({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      className="ml-auto flex w-fit shrink-0 items-center gap-1.5 text-xs font-medium text-fg"
    >
      <ChevronDown className="fold-bob size-4 shrink-0 text-mark" />
      <KoText text={label} />
    </button>
  );
}

function DescPrompt({ foldKey, label, anchorId, followId }: { foldKey: string; label: string; anchorId: string; followId: string }) {
  const [openKey, setOpenKey] = useState(descOpenKey);
  useEffect(() => watchDescOpen(setOpenKey), []);
  if (openKey === foldKey) return null;
  return (
    <FoldPrompt
      label={label}
      onOpen={() => {
        queueFoldTop(followId);
        chooseDesc(foldKey, document.getElementById(anchorId));
      }}
    />
  );
}

function sungHead(text: string) {
  return sungLyrics(text).replace(/\s+/g, "").slice(0, 48);
}

function descriptionLyricInner(desc: string) {
  const source = visibleBreaks(desc);
  const mark = "━━━━━━━━━━━━━━━━━━━━";
  if (!source.includes(mark)) return "";
  const parts = source.split(mark);
  return parts.slice(1, -1).join("\n").replace(/^\s*가사\s*\n+/, "").trim();
}

function lockSongDesc(genreId: string, n: string, pkg: StudioPackage | null | undefined) {
  const id = padEp(n);
  if (!pkg || !id) return "";
  const desc = visibleBreaks(String(pkg.youtubeDescription || ""));
  const stored = descriptionSungOnly(desc);
  const pref = readPref(genreId as GenreId);
  if (pref.output?.ytDesc === false) return "";
  const lyricsOn = pref.lockDescLyrics !== false || pref.descLyrics;
  if (!lyricsOn) return descriptionWithoutLyrics(desc);
  const lyrics = String(pkg.lyricsBlock || "");
  const ownLyrics = lyrics.trim() && lyricsAreThisSong(genreId, id, lyrics) ? lyrics : "";
  const orig = getOriginal(id)?.lyrics || "";
  const sung = genreId === "kpop-original" && orig.trim() ? orig : ownLyrics || orig;
  const innerHead = sungHead(descriptionLyricInner(desc));
  const ownHead = sungHead(sung);
  if (sung && innerHead && ownHead && innerHead !== ownHead) return cleanDescriptionLyrics(desc, sung);
  if (innerHead && pref.descLyrics) return stored;
  if (sung && pref.lockDescLyrics !== false) return cleanDescriptionLyrics(descriptionWithoutLyrics(desc), sung);
  if (sung) return cleanDescriptionLyrics(desc, sung);
  return stored;
}

export function DescFold({ genreId, n, show, hidePrompt = false, framed = false }: { genreId: string; n: string; show: boolean; hidePrompt?: boolean; framed?: boolean }) {
  const key = `${genreId}:${padEp(n)}`;
  const box = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState(descOpenKey);
  useEffect(() => watchDescOpen(setOpenKey), []);
  const open = show && openKey === key;
  const [body, setBody] = useState(() => lockSongDesc(genreId, n, readCachedPackage(n, genreId)));
  const [bodyKey, setBodyKey] = useState(key);
  if (bodyKey !== key) {
    setBodyKey(key);
    setBody(lockSongDesc(genreId, n, readCachedPackage(n, genreId)));
  }
  useEffect(() => {
    const pull = () => setBody(lockSongDesc(genreId, n, readCachedPackage(n, genreId)));
    pull();
    window.addEventListener(APP_EVENT, pull);
    return () => window.removeEventListener(APP_EVENT, pull);
  }, [genreId, n]);
  useEffect(() => {
    if (!open) return;
    if (lockSongDesc(genreId, n, readCachedPackage(n, genreId)).trim()) return;
    let stop = false;
    void loadStudioPage({ data: { kind: "single", genreId, ep: padEp(n), act: actFromEp(n) } })
      .then((remote) => {
        if (stop || !remote || remote.kind !== "single" || !remote.pkg) return;
        if (lockSongDesc(genreId, n, readCachedPackage(n, genreId)).trim()) return;
        const next = lockSongDesc(genreId, n, remote.pkg);
        if (next) setBody(next);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [open, genreId, n]);
  if (!show) return null;
  const slot = padEp(n);
  const shown = body.trim() || lockSongDesc(genreId, n, readCachedPackage(n, genreId));
  return (
    <div ref={box}>
      <FoldPanel
        foldKey={key}
        domId={`desc-fold-${slot}`}
        open={open}
        openLabel="설명란을 보려면 누르세요"
        closeLabel="설명 닫기"
        onOpen={() => chooseDesc(key, box.current)}
        onDismiss={() => chooseDesc(key, box.current)}
        hidePrompt={hidePrompt}
        framed={framed}
      >
        {shown ? (
          <MaybeTranslated text={shown} genreId={genreId}>
            {(text) => <DescriptionBody text={text} full />}
          </MaybeTranslated>
        ) : null}
      </FoldPanel>
    </div>
  );
}

export function ResultFold({
  genreId,
  n,
  active,
  pinned = false,
  hidePrompt = false,
  framed = false,
  onOpen,
  onDismiss,
}: {
  genreId: string;
  n: string;
  active: boolean;
  pinned?: boolean;
  hidePrompt?: boolean;
  framed?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const key = resultFoldKey(genreId, n);
  const slot = padEp(n);
  return (
    <FoldPanel
      foldKey={key}
      domId={`result-fold-${slot}`}
      open={active}
      pinned={pinned}
      openLabel="결과창을 보려면 누르세요"
      closeLabel="결과 닫기"
      onOpen={onOpen}
      onDismiss={onDismiss}
      hidePrompt={hidePrompt}
      framed={framed}
    >
      <div id="song-result-slot" className="min-w-0 px-1" />
    </FoldPanel>
  );
}

export function HearFlag({
  url,
  on,
  children,
}: {
  url: string;
  on: boolean;
  children: (live: boolean) => ReactNode;
}) {
  const id = youtubeId(url);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!on || !id) {
      setLive(false);
      return;
    }
    let stop = false;
    let timer = 0;
    const look = () => {
      window.clearTimeout(timer);
      void askYoutubePublic(id).then((ok) => {
        if (stop) return;
        setLive(ok);
        if (!ok) timer = window.setTimeout(look, PUBLIC_HOLD_MS + 2000);
      });
    };
    look();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [on, id]);
  return children(live);
}

export function EpSongList({
  tracks,
  epN,
  workN,
  confirmedEps,
  readyEps = [],
  youtubeByEp,
  mvByEp = {},
  sunoByEp = {},
  genreId,
  unlocked = false,
  pinned = false,
  sorting = false,
  onSortMove,
  onPick,
  onDismiss,
}: {
  tracks: { n: string; title: string; original?: string; source?: "none" | "kept" | "converted" }[];
  epN: string;
  workN?: string;
  confirmedEps: string[];
  readyEps?: string[];
  youtubeByEp: Record<string, string>;
  mvByEp?: Record<string, string>;
  sunoByEp?: Record<string, string>;
  genreId: string;
  unlocked?: boolean;
  pinned?: boolean;
  sorting?: boolean;
  onSortMove?: (from: string, to: string) => void;
  onPick: (n: string) => void;
  onDismiss?: (n: string) => void;
}) {
  const work = padEp(workN || "");
  const listRule = readCommon().listRule || "";
  const gold = !listRule || listRule.includes("금색");
  const showYoutube = !listRule || listRule.includes("유튜브");
  const startSort = useSortGesture(sorting, onSortMove || (() => {}));
  return (
    <div id="ep-list" data-song-list="" data-queue-key={genreId} className="mt-2 flex flex-col gap-2">
      {tracks.map((item) => {
        const on = item.n === epN || padEp(item.n) === padEp(epN);
        const working = work !== "" && padEp(item.n) === work;
        const confirmed = confirmedEps.includes(padEp(item.n));
        const ready = !confirmed && readyEps.includes(padEp(item.n));
        const youtube = youtubeByEp[padEp(item.n)] ?? "";
        const mv = mvByEp[padEp(item.n)] ?? "";
        const suno = (sunoByEp[padEp(item.n)] ?? "").trim();
        const title = item.title.trim();
        const origin = genreId !== "kpop-original";
        const pills = [working ? "Grok 작동 중" : ""].filter(Boolean);
        const showSongDesc = (confirmed || Boolean(suno)) && readPref(genreId as GenreId).output.ytDesc !== false;
        const foldRow = !sorting && (((youtube || mv) && showYoutube) || showSongDesc || unlocked);
        const sortId = padEp(item.n);
        return (
          <Fragment key={item.n}>
          <HearFlag url={youtube} on={confirmed}>
          {(live) => (
          <div
            id={`ep-row-${sortId}`}
            data-sort-id={sorting ? sortId : undefined}
            data-song-title={title}
            data-yt-title={readCachedPackage(sortId, genreId)?.youtubeTitle?.trim() || title}
            className={cn(
              "bookmark-card flex flex-col text-left text-fg",
              confirmed && (live ? "bookmark-live" : "bookmark-held"),
              on ? "song-picked" : "",
              on && unlocked && !sorting ? "overflow-visible" : "",
            )}
          >
            <div
              className={cn(
                "flex min-h-[52px] items-center gap-2 px-3 py-1",
                foldRow ? "rounded-t-[14px]" : "rounded-[14px]",
                confirmed
                  ? ""
                  : working
                      ? "h-[64px] border border-mark"
                      : ready
                        ? "border border-fg/25 bg-fg/[0.06]"
                        : "",
              )}
            >
            {sorting ? <SortGrip onPointerDown={(event) => startSort(sortId, event)} /> : null}
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                if (sorting) return;
                onPick(item.n);
              }}
              className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
              aria-pressed={on || working}
            >
              <span className="shrink-0 font-mono text-xs tabular-nums opacity-80">EP.{item.n}</span>
              <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-px">
                <span className={cn("block truncate font-medium leading-[14px]", working ? "text-base" : "text-sm", confirmed && gold ? "text-mark" : "")}>
                  {title}
                </span>
                {origin && !sorting ? (
                  <span className="flex min-w-0 max-w-full items-center gap-1">
                    <TitleOriginMark confirmed={confirmed} title={title} original={item.original} source={item.source} />
                    {item.source && item.source !== "none" && title && (item.original || "").trim() ? (
                      <VocalInfoButton label={songListVocal(genreId, item.n)} />
                    ) : null}
                  </span>
                ) : null}
              </span>
            </button>
            {!sorting && suno ? (
              <span className="inline-flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="음원 듣기"
                data-song-key={`ep:${genreId}:${item.n}`}
                data-suno-url={suno}
                data-suno-id={`suno:ep:${genreId}:${item.n}`}
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
              <MasteredDownload id={`suno:ep:${genreId}:${item.n}`} url={suno} title={title} />
              </span>
            ) : null}
            {!sorting && pills.length ? (
              <span className="flex shrink-0 items-center gap-1">
                {pills.map((label) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex h-7 items-center rounded-[10px] px-2.5 text-[11px] font-semibold tracking-tight",
                      label === "Grok 작동 중"
                          ? "bg-bg text-mark wake-word"
                          : "bg-surface-2 text-fg",
                    )}
                  >
                    <KoText text={label} />
                  </span>
                ))}
              </span>
            ) : null}
            </div>
            {!sorting && showYoutube && (youtube || mv) ? (
              <div className="bg-bg px-3 pt-2 pb-2 text-fg">
                <PreviewStack
                  song={youtube}
                  mv={mv}
                  genreId={genreId}
                  listSong
                  poster={readCachedPackage(item.n, genreId)?.thumbUrl || ""}
                  subscribe={confirmed}
                  songPremium={linkPremiumOn(readCachedPackage(item.n, genreId)?.ytPremium, genreId, item.n, "song")}
                  mvPremium={linkPremiumOn(readCachedPackage(item.n, genreId)?.mvPremium, genreId, item.n, "mv")}
                  prompt={
                    unlocked && !on ? (
                      <FoldPrompt
                        label="결과창을 보려면 누르세요"
                        onOpen={() => {
                          queueFoldTop(`result-fold-${padEp(item.n)}`);
                          onPick(item.n);
                        }}
                      />
                    ) : !unlocked && showSongDesc ? (
                      <DescPrompt foldKey={`${genreId}:${padEp(item.n)}`} label="설명란을 보려면 누르세요" anchorId={`ep-row-${padEp(item.n)}`} followId={`desc-fold-${padEp(item.n)}`} />
                    ) : null
                  }
                />
              </div>
            ) : null}
            {!sorting && (showSongDesc || unlocked) ? (
              <div className="text-fg">
                {unlocked ? (
                  <ResultFold
                    genreId={genreId}
                    n={item.n}
                    active={on}
                    pinned={pinned}
                    hidePrompt
                    framed
                    onOpen={() => onPick(item.n)}
                    onDismiss={() => onDismiss?.(item.n)}
                  />
                ) : (
                  <DescFold genreId={genreId} n={item.n} show={showSongDesc} hidePrompt framed />
                )}
              </div>
            ) : null}
          </div>
          )}
          </HearFlag>
          </Fragment>
        );
      })}
    </div>
  );
}

export function YoutubeField({
  value,
  onChange,
  onSave,
  mvValue = "",
  onMvChange,
  onMvSave,
  songPremium = false,
  onSongPremium,
  mvPremium = false,
  onMvPremium,
  fileUrl = "",
  fileMv = "",
  fileKnown = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  mvValue?: string;
  onMvChange?: (value: string) => void;
  onMvSave?: (value: string) => void;
  songPremium?: boolean;
  onSongPremium?: (on: boolean) => void;
  mvPremium?: boolean;
  onMvPremium?: (on: boolean) => void;
  fileUrl?: string;
  fileMv?: string;
  fileKnown?: boolean;
}) {
  const [mvOn, setMvOn] = useState(Boolean(mvValue.trim()));
  useEffect(() => {
    if (mvValue.trim()) setMvOn(true);
  }, [mvValue]);
  const tone = urlTone(value, fileUrl, fileKnown);
  const mvTone = urlTone(mvValue, fileMv, fileKnown);
  return (
    <div className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-widest text-fg-subtle uppercase">유튜브 URL</span>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-fg">
          <input
            type="checkbox"
            checked={mvOn}
            onChange={(event) => setMvOn(event.target.checked)}
            className="size-4 accent-mark"
          />
          M/V
        </label>
      </span>
      <span className="mt-2 flex items-center gap-2">
      <input
        value={value}
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v="
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onSave(event.currentTarget.value)}
        className={cn("min-w-0 flex-1 rounded-xl border bg-surface px-4 py-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark", tone === "gold" && "border-[#e8c547]/55", tone === "red" && "border-red-500", tone === "white" && "border-white", !tone && "border-border")}
      />
      <label className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wide text-mark">
      <input
        type="checkbox"
        checked={songPremium}
        aria-label="유튜브 고음질"
        onChange={(event) => onSongPremium?.(event.target.checked)}
        className="size-5 shrink-0 accent-mark"
      />
      고음질
      </label>
      </span>
      {mvOn ? (
        <span className="mt-2 flex items-center gap-2">
        <input
          value={mvValue}
          inputMode="url"
          placeholder="MV https://www.youtube.com/watch?v="
          onChange={(event) => onMvChange?.(event.target.value)}
          onBlur={(event) => onMvSave?.(event.currentTarget.value)}
          className={cn("min-w-0 flex-1 rounded-xl border bg-surface px-4 py-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark", mvTone === "gold" && "border-[#e8c547]/55", mvTone === "red" && "border-red-500", mvTone === "white" && "border-white", !mvTone && "border-border")}
        />
        <label className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wide text-mark">
        <input
          type="checkbox"
          checked={mvPremium}
          aria-label="MV 고음질"
          onChange={(event) => onMvPremium?.(event.target.checked)}
          className="size-5 shrink-0 accent-mark"
        />
        고음질
        </label>
        </span>
      ) : null}
    </div>
  );
}

export function KoText({ text }: { text: string }) {
  const lang = useLockedViewLang();
  return <>{viewText(text, lang)}</>;
}

export function MailCompose() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const title = subject.trim().slice(0, 100);
    const text = body.trim().slice(0, 1000);
    const name = author.trim().slice(0, 80);
    if (!title || !text || !name) {
      setNote("제목, 내용, 작성자명을 적어 주세요.");
      return;
    }
    setSending(true);
    setNote("");
    try {
      const saved = await sendStudioMail({ data: { subject: title, body: text, author: name } });
      const row = saved as { ok?: boolean; error?: string; mailto?: string; result?: { ok?: boolean; error?: string; mailto?: string } };
      const ok = row?.ok === true || row?.result?.ok === true;
      const mailto = row?.mailto || row?.result?.mailto || "";
      if (ok) {
        setNote("보냈습니다.");
        setSubject("");
        setBody("");
        return;
      }
      if (mailto) {
        const link = document.createElement("a");
        link.href = mailto;
        link.rel = "noopener";
        link.click();
        setNote("메일 앱에서 보내기를 눌러 주세요.");
        return;
      }
      setNote("보내지 못했습니다. 다시 눌러 주세요.");
    } catch {
      setNote("보내지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <button type="button" aria-label="메일" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface" onClick={() => { setNote(""); setOpen(true); }}>
        <Mail className="size-6" />
      </button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center">
          <form className="mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md border border-white/15 bg-black px-4 py-4 text-white" onSubmit={send}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">메일</p>
              <button type="button" aria-label="닫기" className="inline-flex size-8 items-center justify-center" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <input value={subject} maxLength={100} placeholder="제목" onChange={(event) => setSubject(event.target.value.slice(0, 100))} className="mt-3 w-full border border-white/20 bg-black px-3 py-3 text-sm text-white" />
            <textarea value={body} maxLength={1000} rows={6} placeholder="내용" onChange={(event) => setBody(event.target.value.slice(0, 1000))} className="mt-2 w-full resize-y border border-white/20 bg-black px-3 py-3 text-sm text-white" />
            <input value={author} maxLength={80} placeholder="작성자명" onChange={(event) => setAuthor(event.target.value.slice(0, 80))} className="mt-2 w-full border border-white/20 bg-black px-3 py-3 text-sm text-white" />
            {note ? <p className="mt-2 text-xs text-white/80">{note}</p> : null}
            <button type="submit" disabled={sending} className="mt-3 h-11 w-full bg-mark text-sm font-semibold text-mark-fg disabled:opacity-50">
              {sending ? "보내는 중" : "발송"}
            </button>
          </form>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function ViewLangPick() {
  const lang = useViewLang();
  const choices = viewLangChoices();
  const current = choices.find((item) => item.id === lang) ?? choices[0];
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div ref={box} className="relative z-30 h-9 w-16">
      <div className="absolute top-0 right-0 w-full overflow-hidden rounded-xl border border-white bg-black/30 shadow-lg backdrop-blur-sm">
        <div className="flex h-9 items-center justify-end pr-0.5">
          <span className="text-base leading-none" aria-hidden>
            {current?.flag}
          </span>
          <button
            type="button"
            aria-label="언어 목록"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-8 items-center justify-center text-white"
          >
            <ChevronDown className={cn("size-4", open && "rotate-180")} />
          </button>
        </div>
        {open ? (
          <div className="border-t border-white/70 py-1">
            {choices.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  writeViewLang(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold text-white",
                  item.id === lang && "bg-white/15",
                )}
              >
                <span aria-hidden>{item.flag}</span>
                {item.code}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OrigSourceFields({
  ep,
  title,
  vocal,
  lyrics,
  genre = "",
  showTitle,
  showVocal,
  showLyrics,
  showGenre = false,
  genreLabel = "장르",
  onChange,
}: {
  ep: string;
  title: string;
  vocal: string;
  lyrics: string;
  genre?: string;
  showTitle: boolean;
  showVocal: boolean;
  showLyrics: boolean;
  showGenre?: boolean;
  genreLabel?: string;
  onChange: (next: { title: string; vocal: string; lyrics: string; genre?: string }) => void;
}) {
  const [open, setOpen] = useState("");
  const rows = [
    showTitle ? { id: "title", label: "제목", value: title } : null,
    showVocal ? { id: "vocal", label: "보컬", value: vocal } : null,
    showGenre ? { id: "genre", label: genreLabel, value: genre } : null,
    showLyrics ? { id: "lyrics", label: "가사", value: lyrics } : null,
  ].filter((row) => row !== null);
  if (!rows.length) return null;
  function toggle(id: string) {
    const section = document.getElementById(`orig-field-${id}`);
    setOpen((cur) => (cur === id ? "" : id));
    keepView(section);
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="px-1">
        <p className="font-mono text-xs tabular-nums text-fg-subtle">원곡</p>
        <h3 className="text-sm font-medium text-fg">{ep ? `EP.${ep} ${title}` : title || "사연곡"}</h3>
      </div>
      {rows.map((row) => {
        const shown = open === row.id;
        const peek = String(row.value ?? "").replace(/\s+/g, " ").trim();
        const snippet = peek ? (peek.length > 80 ? `${peek.slice(0, 80)}…` : peek) : "비어 있음";
        return (
          <section key={row.id} id={`orig-field-${row.id}`} className="scroll-mt-28 overflow-hidden rounded-xl border border-border bg-surface">
            <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left" onClick={() => toggle(row.id)}>
              <span className="min-w-0 flex-1 text-sm font-medium text-fg">{row.label}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-fg-muted", shown && "rotate-180")} />
            </button>
            {shown ? (
              row.id === "vocal" ? (
                <div className="border-t border-border px-4 py-3">
                  <CastRadios
                    value={castFromLabel(vocal)}
                    onChange={(next: ThumbCast) => onChange({ title, vocal: labelForCast(next), lyrics, genre })}
                  />
                </div>
              ) : row.id === "lyrics" ? (
                <textarea
                  value={lyrics}
                  rows={10}
                  onChange={(event) => onChange({ title, vocal, lyrics: event.target.value, genre })}
                  className="min-h-40 w-full resize-y border-t border-border bg-bg px-4 py-3 font-mono text-xs leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark"
                />
              ) : (
                <input
                  value={row.id === "genre" ? genre : title}
                  onChange={(event) =>
                    onChange(
                      row.id === "genre"
                        ? { title, vocal, lyrics, genre: event.target.value }
                        : { title: event.target.value, vocal, lyrics, genre },
                    )
                  }
                  className="w-full border-t border-border bg-bg px-4 py-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark"
                />
              )
            ) : (
              <p className="cursor-pointer border-t border-border px-4 py-3 text-sm leading-relaxed text-fg" onClick={() => toggle(row.id)}>
                {snippet}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function MaybeTranslated({
  text,
  genreId,
  children,
}: {
  text: string;
  genreId: string;
  children: (body: string) => ReactNode;
}) {
  const chosen = useViewLang();
  const lockedView = useLockedViewLang();
  useGenrePref(genreId as GenreId);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  useEffect(() => {
    setAlt("");
    setFail("");
  }, [chosen, text]);
  const genreLang = prefOutputLang(genreId as GenreId, readPref(genreId as GenreId).lang);
  const offer = lockedView !== "ko" && chosen !== genreLang && hasHangul(text);
  if (!offer) return <>{children(text)}</>;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${langLabel(chosen as OutputLang)}로 번역`}
        disabled={busy}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (alt) {
            setAlt("");
            setFail("");
            return;
          }
          setBusy(true);
          setFail("");
          void translateText({ data: { text, lang: chosen } })
            .then((result) => {
              if (result.ok) setAlt(result.text);
              else setFail(result.error);
            })
            .catch(() => setFail("번역하지 못했습니다."))
            .finally(() => setBusy(false));
        }}
        className="absolute top-1 right-1 z-10 inline-flex size-8 items-center justify-center rounded-lg border border-white/30 bg-surface text-fg"
      >
        <Languages className={cn("size-4", busy && "animate-pulse")} />
      </button>
      <div className="pt-10">
        {children(alt || text)}
        {fail ? <p className="px-1 text-xs text-mark">{fail}</p> : null}
      </div>
    </div>
  );
}

export function GenerateBar({
  busy,
  savedReady,
  sloppy = false,
  partial = false,
  label,
  onGenerate,
  error,
  hideStatus = false,
}: {
  busy: boolean;
  savedReady: boolean;
  sloppy?: boolean;
  partial?: boolean;
  label: string;
  onGenerate: () => void;
  error: string | null;
  hideStatus?: boolean;
}) {
  void error;
  void hideStatus;
  void sloppy;
  void partial;
  return (
    <>
      <Button
        type="button"
        size="lg"
        variant={savedReady ? "secondary" : "mark"}
        className="mt-5 w-full"
        disabled={busy || savedReady}
        onClick={onGenerate}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : null}
        {busy ? "생성 중" : savedReady ? "완성됨" : label}
      </Button>
    </>
  );
}

export function BusyBox({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-10 text-center">
      <LoaderCircle className="size-5 animate-spin text-fg-muted" />
      <p className="text-sm text-fg-muted">{text}</p>
    </div>
  );
}

function labelWidth(text: string, size: number) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = `600 ${size}px "Noto Sans KR", ui-sans-serif, system-ui, sans-serif`;
  return ctx.measureText(text).width;
}

function wrapsInTwo(text: string, width: number, size: number) {
  if (width <= 8) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.some((word) => labelWidth(word, size) > width + 1)) return false;
  let lines = 1;
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (labelWidth(next, size) <= width + 1) line = next;
    else {
      lines += 1;
      line = word;
    }
  }
  return lines <= 2;
}

function FitGenreLabel({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const lang = useLockedViewLang();
  const [size, setSize] = useState(13);
  const [lines, setLines] = useState<1 | 2>(1);
  useLayoutEffect(() => {
    const el = box.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const apply = (nextSize: number, nextLines: 1 | 2) => {
      setSize((cur) => (cur === nextSize ? cur : nextSize));
      setLines((cur) => (cur === nextLines ? cur : nextLines));
    };
    const measure = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      if (labelWidth(text, 13) <= width + 1) {
        apply(13, 1);
        return;
      }
      for (const next of [13, 12, 11]) {
        if (wrapsInTwo(text, width, next)) {
          apply(next, 2);
          return;
        }
      }
      apply(11, 2);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(parent);
    return () => watch.disconnect();
  }, [text, lang]);
  return (
    <span
      ref={box}
      className="block max-w-full min-w-0 overflow-hidden leading-tight"
      style={{
        fontSize: size,
        whiteSpace: lines === 1 ? "nowrap" : "normal",
        overflowWrap: lines === 1 ? "normal" : "break-word",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
      }}
    >
      <KoText text={text} />
    </span>
  );
}

const GENRE_GROUP_COUNTS = (["original", "collection", "distinct"] as const).map(
  (kind) => GENRES.filter((item) => item.kind === kind).length,
);

function sheetLimit() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const land = parseFloat(style.getPropertyValue("--phone-land-h")) || 411;
  const port = parseFloat(style.getPropertyValue("--phone-port-h")) || 891;
  if (root.dataset.frame === "wide") return Math.min(window.innerHeight, land);
  if (root.dataset.roomy === "1") return Math.min(window.innerHeight, port);
  return window.innerHeight;
}

function rowsFor(cols: number) {
  return GENRE_GROUP_COUNTS.reduce((sum, count) => sum + Math.ceil(count / cols), 0);
}

function cellTextWidth(cols: number, viewW: number) {
  const grid = viewW - 40 - (cols - 1) * 8;
  return grid / cols - 24 - 22;
}

function rowRoom(cols: number, height: number) {
  const rows = rowsFor(cols);
  const chrome = 58 + 16 + 24 + 3 * 28;
  const gaps = Math.max(0, rows - GENRE_GROUP_COUNTS.length) * 8;
  return (height - chrome - gaps) / Math.max(rows, 1);
}

function chooseGenreCols(viewW: number, height: number) {
  if (document.documentElement.dataset.frame === "wide") return 4;
  const labels = GENRES.map((item) => item.label);
  const namesFit = (cols: number) => {
    const width = cellTextWidth(cols, viewW);
    return labels.every((label) => labelWidth(label, 13) <= width + 1 || wrapsInTwo(label, width, 13));
  };
  const fitting = [2, 3, 4].filter((cols) => rowRoom(cols, height) >= 40 && namesFit(cols));
  if (fitting.length) return Math.min(...fitting);
  const named = [2, 3, 4].filter((cols) => namesFit(cols));
  if (named.length) return Math.min(...named);
  return 2;
}

function useGenreCols() {
  const [cols, setCols] = useState(() => (
    typeof document !== "undefined" && document.documentElement.dataset.frame === "wide" ? 4 : 2
  ));
  useLayoutEffect(() => {
    const fit = () => setCols(chooseGenreCols(window.innerWidth, sheetLimit()));
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("noa-frame", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("noa-frame", fit);
    };
  }, []);
  return cols;
}

export function GenreGroup({
  heading,
  items,
  selected,
  tones = {},
  live = {},
  onPick,
}: {
  heading: string;
  items: { id: string; label: string }[];
  selected: string;
  tones?: Record<string, "done" | "gold" | "line" | "empty">;
  live?: Record<string, boolean>;
  onPick: (id: GenreId) => void;
}) {
  const cols = useGenreCols();
  const rows = Math.max(1, Math.ceil(items.length / cols));
  return (
    <section className="genre-group mt-3 flex min-h-0 flex-col first:mt-0" style={{ flexGrow: rows, flexShrink: 1, flexBasis: 0 }}>
      <p className="shrink-0 px-1 text-xs font-medium tracking-widest text-fg-subtle uppercase"><KoText text={heading} /></p>
      <div
        className={cn("genre-grid mt-2 grid min-h-0 flex-1 gap-2", cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2")}
        style={{ gridTemplateRows: `repeat(${rows}, minmax(2.5rem, 1fr))` }}
      >
        {items.map((item) => {
          const on = item.id === selected;
          const tone = tones[item.id] || "empty";
          const complete = tone === "done" && live[item.id] === true;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id as GenreId)}
              className={cn(
                "flex h-full min-h-0 items-center gap-1.5 overflow-hidden rounded-[16px] border bg-surface px-3 text-left text-[13px] font-semibold leading-tight tracking-tight text-fg",
                tone === "done" && "border-[#e8c547] bg-[#e8c547]/16",
                tone === "gold" && "border-[#e8c547]",
                tone === "line" && "border-white/80",
                tone === "empty" && "border-[#3a3a3c]",
                on && "ring-1 ring-inset ring-white/35",
              )}
            >
              {complete ? <GenreCompleteMark /> : null}
              <span className="min-w-0 flex-1">
                <FitGenreLabel text={item.label} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ResultActions({
  busy,
  complete,
  confirmed,
  hasBody,
  saveDirty = false,
  onSave,
  onRegenAll,
  onConfirm,
  revise = false,
  error,
  lead,
  hint,
  domId,
  draftScope = "",
  onPatch,
}: {
  busy: boolean;
  complete: boolean;
  confirmed: boolean;
  hasBody: boolean;
  saveDirty?: boolean;
  onSave: () => void;
  onRegenAll: () => void;
  onConfirm: () => void;
  revise?: boolean;
  error: string | null;
  lead?: ReactNode;
  hint?: string | null;
  domId?: string;
  draftScope?: string;
  onPatch?: (id: string, text: string) => void | string;
}) {
  void error;
  const draftRev = useSyncExternalStore(watchFieldDrafts, fieldDraftRev, fieldDraftRev);
  void draftRev;
  const typed = draftScope ? fieldDraftOn(draftScope) : false;
  const canSave = Boolean(saveDirty || typed);
  return (
    <div className="mt-4">
      {lead ? <div className="mb-4">{lead}</div> : null}
      <div id={domId} className="scroll-mt-4">
        <div className="save-row grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="lg"
            variant={canSave ? "mark" : "secondary"}
            disabled={false}
            onClick={() => {
              const rows = draftScope && onPatch ? fieldDrafts(draftScope) : [];
              let blocked = "";
              for (const row of rows) {
                const reason = onPatch?.(row.id, row.text);
                if (reason && /다른 곡|너무 짧아|빈 결과|자물쇠|이 곡 결과가 아니라/.test(String(reason))) blocked = String(reason);
              }
              if (blocked) window.dispatchEvent(new CustomEvent("noa-user-notice", { detail: blocked }));
              onSave();
            }}
          >
            저장
          </Button>
          <Button type="button" size="lg" variant="secondary" disabled={busy} onClick={onRegenAll}>
            다시 생성
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          variant={confirmed ? "secondary" : "mark"}
          className="mt-2 w-full"
          title={revise ? undefined : "최고 관리자 기기만 확정할 수 있습니다."}
          disabled={busy || !revise || (!confirmed && !complete && !hasBody)}
          onClick={onConfirm}
        >
          {confirmed ? "확정됨" : "확정"}
        </Button>
      </div>
      {!confirmed && !complete && hint ? (
        <p className="mt-2 text-center text-xs text-fg-subtle">비어 있는 칸: {hint}</p>
      ) : null}
    </div>
  );
}

export function ResultPane({
  omitAnchor = false,
  busy,
  single,
  showLetter,
  showSuno,
  showDescLyrics,
  hideSource = false,
  output,
  source,
  order,
  thumbCast,
  savedCast,
  onCastChange,
  onCastSave,
  locks,
  busyBlock,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  focusId = null,
  focusPhase = null,
  markIds = [],
  onSave,
  saveDirty = false,
  onRegenAll,
  confirmed,
  revise = false,
  onConfirm,
  error,
  lead,
  confirmReady = false,
  sunoBase = "",
  draftScope = "",
  sunoUrl = "",
  audioAnalysis = "",
  audioLevel = "",
  onSunoUrl,
  onAnalysis,
  onLevel,
  fileFields,
  fileKnown = false,
  editKey = "",
  fileTarget,
}: {
  omitAnchor?: boolean;
  busy: boolean;
  single: StudioPackage | null;
  showLetter: boolean;
  showSuno: boolean;
  showDescLyrics: boolean;
  hideSource?: boolean;
  output?: OutputShow;
  source?: { title?: string; vocal?: string; lyrics?: string };
  order?: string;
  thumbCast: ThumbCast;
  savedCast: ThumbCast;
  onCastChange: (cast: ThumbCast) => void;
  onCastSave: () => void;
  locks: Record<string, boolean>;
  busyBlock: string | null;
  onToggleLock: (id: string) => void;
  onRegen: (id: string, note: string) => void;
  onPatch: (id: string, text: string) => void;
  onRegenImage: () => void;
  focusId?: string | null;
  focusPhase?: "audit" | "work" | null;
  markIds?: string[];
  onSave: () => void;
  saveDirty?: boolean;
  onRegenAll: () => void;
  confirmed: boolean;
  revise?: boolean;
  onConfirm: () => void;
  error: string | null;
  lead?: ReactNode;
  confirmReady?: boolean;
  sunoBase?: string;
  draftScope?: string;
  sunoUrl?: string;
  audioAnalysis?: string;
  audioLevel?: string;
  onSunoUrl?: (value: string) => void;
  onAnalysis?: (value: string) => void;
  onLevel?: (value: string) => void;
  fileFields?: Record<string, string>;
  fileKnown?: boolean;
  editKey?: string;
  fileTarget?: SongFileTarget;
}) {
  const pkg = single ?? emptyStudio();
  const complete = isStudioComplete(pkg, {
    suno: output ? output.suno : showSuno,
    letter: output ? output.letter : showLetter,
    source: !hideSource,
    output,
  });
  return (
    <div id={omitAnchor ? undefined : "studio-result"} className={omitAnchor ? "min-w-0" : "mt-8 min-w-0"}>
      {busy ? (
        <BusyBox text="단곡 패키지 작성 중" />
      ) : (
        <>
          {fileTarget ? <SongFileBar target={fileTarget} /> : null}
          <CastBar value={thumbCast} saved={savedCast} onChange={onCastChange} onSave={onCastSave} />
          <PackageView
            pkg={pkg}
            showLetter={showLetter}
            showSuno={showSuno}
            showDescLyrics={showDescLyrics}
            hideSource={hideSource}
            output={output}
            source={source}
            locks={locks}
            busyId={busyBlock}
            onToggleLock={onToggleLock}
            onRegen={onRegen}
            onPatch={onPatch}
            onRegenImage={onRegenImage}
            imageBusy={busyBlock === "thumb-img"}
            sealed={confirmed && !revise}
            focusId={focusId}
            focusPhase={focusPhase}
            markIds={markIds}
            order={order}
            sunoBase={sunoBase}
            draftScope={draftScope}
            sunoUrl={sunoUrl}
            audioAnalysis={audioAnalysis}
            audioLevel={audioLevel}
            onSunoUrl={onSunoUrl}
            onAnalysis={onAnalysis}
            onLevel={onLevel}
            fileFields={fileFields}
            fileKnown={fileKnown}
            editKey={editKey}
          />
          <ResultActions
            busy={busy}
            complete={complete || confirmReady}
            confirmed={confirmed}
            revise={revise}
            hasBody={hasPageBody(single)}
            saveDirty={saveDirty}
            onSave={onSave}
            onPatch={onPatch}
            draftScope={draftScope}
            onRegenAll={onRegenAll}
            onConfirm={onConfirm}
            error={error}
            lead={lead}
            domId="result-actions"
          />
        </>
      )}
    </div>
  );
}
