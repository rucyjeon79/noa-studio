import { ACTS, EPS, GENRES, getGenre, padEp, type GenreId } from "./catalog";
import { auditStudioFields, fillRank } from "./fill-local";
import { readOriginals } from "./originals";
import { hasPageBody, hasPlaylistBody, isConfirmed, readCachedPackage, readCachedPlaylist, readRowLocked } from "./package";

export type EmptyEp = { n: string; title: string };

export type GenreGap = {
  genreId: GenreId;
  label: string;
  kind: "original" | "collection" | "distinct";
  filledEps: EmptyEp[];
  emptyEps: EmptyEp[];
  emptyActs: number[];
  totalEps: number;
  totalActs: number;
};

export function scanGenreGap(genreId: GenreId, titles: { n: string; title: string }[]): GenreGap {
  const genre = getGenre(genreId);
  if (genre.kind === "distinct") {
    return {
      genreId,
      label: genre.label,
      kind: "distinct",
      filledEps: [],
      emptyEps: [],
      emptyActs: [],
      totalEps: 0,
      totalActs: 0,
    };
  }
  const catalog = titles.length ? titles : EPS;
  const filledEps: EmptyEp[] = [];
  const emptyEps: EmptyEp[] = [];
  for (const item of catalog) {
    const pkg = readCachedPackage(item.n, genreId);
    const row = { n: item.n, title: item.title };
    if (hasPageBody(pkg)) filledEps.push(row);
    else emptyEps.push(row);
  }
  const emptyActs: number[] = [];
  const totalActs = genre.kind === "collection" ? ACTS.length : 0;
  if (genre.kind === "collection") {
    for (const act of ACTS) {
      if (!hasPlaylistBody(readCachedPlaylist(act.n, genreId))) emptyActs.push(act.n);
    }
  }
  return {
    genreId,
    label: genre.label,
    kind: genre.kind,
    filledEps,
    emptyEps,
    emptyActs,
    totalEps: catalog.length,
    totalActs,
  };
}

export function scanAppGaps(titles: { n: string; title: string }[]) {
  const genres = GENRES.filter((g) => g.kind !== "distinct").map((g) => scanGenreGap(g.id, titles));
  const filled = genres.reduce((n, g) => n + g.filledEps.length, 0);
  const empty = genres.reduce((n, g) => n + g.emptyEps.length, 0);
  const emptyBundles = genres.reduce((n, g) => n + g.emptyActs.length, 0);
  const total = genres.reduce((n, g) => n + g.totalEps, 0);
  return { genres, filled, empty, emptyBundles, total };
}

export function collectFillQueue(preferGenre?: GenreId): {
  genreId: GenreId;
  n: string;
  title: string;
  label: string;
  rank: 1 | 2 | 3 | 4;
}[] {
  const origByN = new Map(readOriginals().map((item) => [padEp(item.n), item]));
  const genreOrder = [
    ...(preferGenre ? GENRES.filter((genre) => genre.id === preferGenre) : []),
    ...GENRES.filter((genre) => genre.id !== preferGenre),
  ];
  const rows: { genreId: GenreId; n: string; title: string; label: string; rank: 1 | 2 | 3 | 4 }[] = [];
  for (const genre of genreOrder) {
    if (genre.kind === "distinct") continue;
    for (const ep of EPS) {
      const orig = origByN.get(ep.n);
      const pkg = readCachedPackage(ep.n, genre.id);
      const confirmed = isConfirmed("single", genre.id, ep.n);
      if (readRowLocked(genre.id, ep.n)) continue;
      const rank = fillRank(genre.id, pkg, orig, confirmed, ep.n);
      if (rank === 0) continue;
      rows.push({
        genreId: genre.id,
        n: ep.n,
        title: orig?.title || ep.title,
        label: genre.label,
        rank,
      });
    }
  }
  return rows;
}

export function collectLevelQueue(
  genreId: GenreId,
  level: "low" | "mid",
  actEps?: string[],
): {
  genreId: GenreId;
  n: string;
  title: string;
  label: string;
  rank: 1 | 2 | 3 | 4;
}[] {
  const genre = getGenre(genreId);
  if (genre.kind === "distinct") return [];
  const allow = level === "mid" && actEps?.length ? new Set(actEps.map((n) => padEp(n))) : null;
  const origByN = new Map(readOriginals().map((item) => [padEp(item.n), item]));
  const rows: { genreId: GenreId; n: string; title: string; label: string; rank: 1 | 2 | 3 | 4 }[] = [];
  for (const ep of EPS) {
    if (allow && !allow.has(ep.n)) continue;
    const orig = origByN.get(ep.n);
    const pkg = readCachedPackage(ep.n, genre.id);
    const confirmed = isConfirmed("single", genre.id, ep.n);
    if (confirmed) continue;
    const rank = fillRank(genre.id, pkg, orig, false, ep.n, undefined, {});
    if (level === "low") {
      const fields = auditStudioFields(genre.id, pkg, undefined, ep.n);
      const hasEmpty = !hasPageBody(pkg) || fields.some((field) => field.kind === "empty");
      if (!hasEmpty) continue;
    } else {
      const fields = auditStudioFields(genre.id, pkg, undefined, ep.n);
      if (!fields.some((field) => field.kind === "sloppy")) continue;
    }
    if (rank === 0) continue;
    rows.push({
      genreId: genre.id,
      n: ep.n,
      title: orig?.title || ep.title,
      label: genre.label,
      rank,
    });
  }
  return rows;
}

export const FILL_RANK_LABEL = {
  1: "공란",
  2: "대충",
  3: "빈칸",
  4: "항목",
} as const;

export function summarizeFillQueue(rows = collectFillQueue()) {
  return {
    empty: rows.filter((row) => row.rank === 1).length,
    rough: rows.filter((row) => row.rank === 2).length,
    partial: rows.filter((row) => row.rank === 3).length,
    item: rows.filter((row) => row.rank === 4).length,
    preview: rows.slice(0, 4).map((row) => `${FILL_RANK_LABEL[row.rank]} · ${row.label} EP.${row.n} ${row.title}`),
    total: rows.length,
  };
}

export function collectEmptySingles() {
  return collectFillQueue();
}

export function gapLine(gap: GenreGap) {
  if (gap.kind === "distinct") {
    return gap.genreId === "cover-reborn"
      ? "재탄생 커버곡은 EP 번호가 없습니다. 제목과 가사로 한 곡씩 채웁니다."
      : "사연곡은 EP 번호가 없습니다. 제목과 가사로 한 곡씩 채웁니다.";
  }
  const bits = [`EP ${gap.filledEps.length}/${gap.totalEps} 채워짐`];
  if (gap.emptyEps.length) bits.push(`빈 단곡 ${gap.emptyEps.length}`);
  return bits.join(" · ");
}
