import {
  EPS,
  isEpNumber,
  mergeEpEntries,
  padEp,
  type EpEntry,
} from "./catalog";
import { patchApp, readAppDump } from "./app-memory";
import { SEED_ORIGINALS, type OriginalSong } from "./originals-seed";
import { readCachedPackage, readSavedEps, titlesForGenre } from "./package";
import { parseSource } from "./source-draft";

export type { OriginalSong };

function normalize(item: Partial<OriginalSong> | null | undefined): OriginalSong | null {
  const n = padEp(item?.n ?? "");
  if (!n) return null;
  return {
    n,
    title: typeof item?.title === "string" ? item.title.trim() : "",
    vocal: typeof item?.vocal === "string" ? item.vocal.trim() : "",
    lyrics: typeof item?.lyrics === "string" ? item.lyrics : "",
  };
}

function overlayOriginals(): OriginalSong[] {
  const songs = readAppDump().originals?.["kpop-original"] ?? {};
  const out: OriginalSong[] = [];
  for (const item of Object.values(songs)) {
    const n = normalize(item);
    if (n) out.push(n);
  }
  return out;
}

export function writeOriginals(items: OriginalSong[]) {
  const map: Record<string, OriginalSong> = {};
  for (const item of items) {
    const n = normalize(item);
    if (n) map[n.n] = n;
  }
  patchApp((d) => {
    d.originals["kpop-original"] = map;
  }, false);
  if (typeof window === "undefined") return;
  void import("./pages")
    .then(async (api) => {
      for (const song of Object.values(map)) {
        await api.saveOriginalSong({
          data: { genreId: "kpop-original", n: song.n, title: song.title, vocal: song.vocal, lyrics: song.lyrics },
        });
      }
    })
    .catch(() => {});
}

function putSong(map: Map<string, OriginalSong>, song: OriginalSong, replace: boolean) {
  const n = padEp(song.n);
  if (!n) return;
  const prev = map.get(n);
  if (!prev || replace) {
    map.set(n, {
      n,
      title: song.title.trim() || prev?.title || "",
      vocal: song.vocal.trim() || prev?.vocal || "",
      lyrics: song.lyrics || prev?.lyrics || "",
    });
    return;
  }
  map.set(n, {
    n,
    title: prev.title || song.title.trim(),
    vocal: prev.vocal || song.vocal.trim(),
    lyrics: prev.lyrics || song.lyrics,
  });
}

export function readOriginals(): OriginalSong[] {
  const map = new Map<string, OriginalSong>();
  for (const item of SEED_ORIGINALS) putSong(map, item, false);
  for (const item of overlayOriginals()) putSong(map, item, true);
  return [...map.values()].sort((a, b) => Number(a.n) - Number(b.n));
}

export function getOriginal(n: string): OriginalSong | null {
  const key = padEp(n);
  return readOriginals().find((item) => item.n === key) ?? null;
}

export function upsertOriginal(song: OriginalSong) {
  const n = padEp(song.n);
  if (!n) return;
  const next = overlayOriginals().filter((item) => item.n !== n);
  next.push({
    n,
    title: song.title.trim(),
    vocal: song.vocal.trim(),
    lyrics: song.lyrics,
  });
  next.sort((a, b) => Number(a.n) - Number(b.n));
  writeOriginals(next);
}

export function extrasAsEps(items: OriginalSong[]): EpEntry[] {
  return items.map((item) => ({ n: item.n, title: item.title || `EP.${item.n}` }));
}

export function libraryEps(extras: OriginalSong[]): EpEntry[] {
  return mergeEpEntries(EPS, extrasAsEps(extras));
}

export function collectOriginals(paste = ""): OriginalSong[] {
  const map = new Map<string, OriginalSong>();
  for (const item of SEED_ORIGINALS) putSong(map, item, false);
  for (const item of overlayOriginals()) putSong(map, item, true);

  const draft = parseSource(paste);
  const pasteN = padEp(draft.ep);
  if (isEpNumber(pasteN) && (draft.title || draft.lyrics || draft.vocal)) {
    putSong(
      map,
      {
        n: pasteN,
        title: draft.title,
        vocal: draft.vocal,
        lyrics: draft.lyrics,
      },
      Boolean(draft.lyrics || draft.vocal),
    );
  }

  const titles = titlesForGenre("kpop-original");
  for (const n of readSavedEps("kpop-original")) {
    if (map.has(n) && (map.get(n)?.title || map.get(n)?.lyrics)) continue;
    const pkg = readCachedPackage(n, "kpop-original");
    putSong(
      map,
      {
        n,
        title: titles[n] || pkg?.confirmedTitle || "",
        vocal: "",
        lyrics: "",
      },
      false,
    );
  }

  return [...map.values()].sort((a, b) => Number(a.n) - Number(b.n));
}
