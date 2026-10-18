import { patchApp, readAppDump } from "./app-memory";
import { ACTS, EPS, GENRES, genreWantsSuno, getGenre, padEp, tracksForAct } from "./catalog";
import { fillRank, openFieldNotes, repairOpenPlaylistThumb, repairOpenStudio } from "./fill-local";
import { readFillQueue } from "./fill-queue";
import { SECURITY_KEY } from "./gate";
import { readGenreGuide, readSunoBase } from "./genre-guides";
import { readOriginals } from "./originals";
import { alignResultFiles, listFilledEps, pullEncyclopedia, saveConfirm, saveOpenRepairs, saveSongLinks } from "./pages";
import {
  hasPageBody,
  hasPlaylistBody,
  ingestEncyclopedia,
  isConfirmed,
  keepPlaylistFileUrl,
  readCachedPackage,
  readCachedPlaylist,
  readRowLocked,
} from "./package";
import { readCommon, readPref, effectiveGuide, readFieldAudit } from "./user-prefs";
import { defaultSunoBase } from "./suno-defaults";

export type HealthIssue = { code: string; title: string; detail: string; fix: string };

export type HealthReport = {
  issues: HealthIssue[];
  counts: { confirmed: number; locked: number; empty: number; rough: number; partial: number };
  paste: string;
};

function dropStalePlaylistPins(filePlaylist: Map<string, { hasBody: boolean; url: string; text: number }>) {
  const dump = readAppDump();
  const meta = dump.meta.youtube ?? {};
  const byUrl = new Map<string, string[]>();
  const consider = (key: string, url: string) => {
    const value = url.trim();
    if (!value) return;
    const list = byUrl.get(value) ?? [];
    if (!list.includes(key)) list.push(key);
    byUrl.set(value, list);
  };
  for (const [key, row] of filePlaylist) consider(key, row.url);
  for (const [key, url] of Object.entries(meta)) {
    if (!key.includes(":pl:")) continue;
    consider(key, String(url || ""));
  }
  const drop: string[] = [];
  for (const [url, keys] of byUrl) {
    if (keys.length < 2) continue;
    const ranked = keys
      .map((key) => ({ key, text: filePlaylist.get(key)?.text ?? 0, fileUrl: filePlaylist.get(key)?.url ?? "" }))
      .sort((a, b) => b.text - a.text);
    const keeper = ranked.find((row) => row.fileUrl === url) ?? ranked[0];
    for (const row of ranked) {
      if (row.key === keeper.key) continue;
      if (String(meta[row.key] || "").trim() === url && row.fileUrl !== url) drop.push(row.key);
    }
  }
  if (!drop.length) return;
  patchApp((d) => {
    const next = { ...(d.meta.youtube ?? {}) };
    for (const key of drop) delete next[key];
    d.meta.youtube = next;
  }, "meta");
}

function songBodyLength(pkg: { lyricsBlock?: string; summary?: string; sunoStyle?: string; geminiPrompt?: string; youtubeDescription?: string; youtubeTitle?: string; confirmedTitle?: string } | null | undefined) {
  if (!pkg) return 0;
  return [pkg.lyricsBlock, pkg.summary, pkg.sunoStyle, pkg.geminiPrompt, pkg.youtubeDescription, pkg.youtubeTitle, pkg.confirmedTitle]
    .reduce((sum, value) => sum + String(value || "").length, 0);
}

function dropStaleSongPins(
  fileSong: Map<string, { filled: boolean; youtubeUrl: string }>,
  filePackages: Map<string, { lyricsBlock?: string; summary?: string; sunoStyle?: string; geminiPrompt?: string; youtubeDescription?: string; youtubeTitle?: string; confirmedTitle?: string } | null | undefined>,
) {
  const meta = readAppDump().meta.youtube ?? {};
  const byUrl = new Map<string, string[]>();
  const consider = (key: string, url: string) => {
    const parts = key.split(":");
    if (parts.length !== 2 || parts[1] === "pl" || parts[1] === "mv") return;
    const value = url.trim();
    if (!value) return;
    const list = byUrl.get(value) ?? [];
    if (!list.includes(key)) list.push(key);
    byUrl.set(value, list);
  };
  for (const [key, url] of Object.entries(meta)) consider(key, String(url || ""));
  for (const [key, song] of fileSong) consider(key, song.youtubeUrl);
  const drop: string[] = [];
  for (const [url, keys] of byUrl) {
    if (keys.length < 2) continue;
    const ranked = keys
      .map((key) => ({
        key,
        fileUrl: fileSong.get(key)?.youtubeUrl.trim() || "",
        text: songBodyLength(filePackages.get(key)),
      }))
      .sort((a, b) => b.text - a.text);
    const keeper = ranked.find((row) => row.fileUrl === url) ?? ranked[0];
    for (const row of ranked) {
      if (row.key === keeper.key || row.fileUrl === url) continue;
      drop.push(row.key);
    }
  }
  if (!drop.length) return;
  patchApp((d) => {
    const next = { ...(d.meta.youtube ?? {}) };
    for (const key of drop) delete next[key];
    d.meta.youtube = next;
  }, "meta");
}

function otherEpNumbers(text: string, ep: string) {
  const mine = String(Number(String(ep).replace(/\D/g, "") || "0"));
  const found = text.match(/EP\.?\s*0*(\d+)/gi) || [];
  const bad = new Set<string>();
  for (const token of found) {
    const num = String(Number((token.match(/(\d+)/) || [])[1] || "0"));
    if (num !== "0" && num !== mine) bad.add(num);
  }
  return [...bad];
}
function tick() {
  return new Promise((resolve) => window.setTimeout(resolve, 16));
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), ms);
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

function healthPaste(
  issues: HealthIssue[],
  counts: HealthReport["counts"],
) {
  const head = [
    "NOA-HEALTH",
    "이 글은 NOA STUDIO 완결성 검사 결과다. 확정이 아닌 칸 중 바로 고칠 수 있는 것만 저장했다. 빈 칸과 가사처럼 원문이 필요한 칸은 짓지 않았다.",
    `확정=${counts.confirmed} 잠금만=${counts.locked} 빈칸=${counts.empty} 대충=${counts.rough} 일부=${counts.partial}`,
    `문제=${issues.length}`,
    "아래 번호만 고치고 다른 곡, 잠금, 확정은 건드리지 마.",
    "",
  ];
  if (!issues.length) return [...head, "문제 없음"].join("\n");
  const body = issues.map((issue, index) =>
    [`[${index + 1}] ${issue.code}`, issue.detail, `조치=${issue.fix}`].join("\n"),
  );
  return [...head, ...body].join("\n\n");
}

function youtubeWithoutDuplicate(
  filePackages: Map<string, { youtubeUrl?: string } | null | undefined>,
  youtube: Record<string, string>,
) {
  const owner = new Map<string, string>();
  for (const [key, pkg] of filePackages) {
    const url = String(pkg?.youtubeUrl || "").trim();
    if (url && !owner.has(url)) owner.set(url, key);
  }
  const next = { ...youtube };
  for (const [key, url] of Object.entries(next)) {
    const value = String(url || "").trim();
    const who = owner.get(value);
    if (who && who !== key) delete next[key];
  }
  return next;
}

export async function runHealthCheck(onStep: (label: string, pct: number) => void): Promise<HealthReport> {
  const issues: HealthIssue[] = [];
  const counts = { confirmed: 0, locked: 0, empty: 0, rough: 0, partial: 0 };
  const genres = GENRES.filter((genre) => genre.kind !== "distinct");
  const fileSong = new Map<string, { filled: boolean; youtubeUrl: string }>();
  const fileAct = new Map<string, { url: string; text: number }>();
  const filePlaylist = new Map<string, { hasBody: boolean; url: string; text: number }>();

  onStep("앱 내용을 읽는 중", 1);
  await tick();
  const filePackages = new Map<string, ReturnType<typeof readCachedPackage>>();
  const filePlaylists = new Map<string, ReturnType<typeof readCachedPlaylist>>();
  const screenSongs: { genreId: string; ep: string; pkg: Record<string, unknown>; from: string }[] = [];
  const screenActs: { genreId: string; act: number; pkg: Record<string, unknown>; from: string }[] = [];
  try {
    const pulled = await pullEncyclopedia();
    const dump = pulled as typeof pulled & {
      filePackages?: NonNullable<typeof pulled>["packages"];
      filePlaylists?: NonNullable<typeof pulled>["playlists"];
    };
    if (dump) {
      const songSnap = dump.filePackages ?? dump.packages ?? {};
      const actSnap = dump.filePlaylists ?? dump.playlists ?? {};
      for (const [key, row] of Object.entries(songSnap)) {
        if (row?.pkg) filePackages.set(key, row.pkg as NonNullable<ReturnType<typeof readCachedPackage>>);
      }
      for (const [key, row] of Object.entries(actSnap)) {
        if (row?.pkg) filePlaylists.set(key, row.pkg as NonNullable<ReturnType<typeof readCachedPlaylist>>);
      }
      const before = readAppDump();
      const songKeys = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "youtubeUrl", "sunoUrl"];
      const actKeys = ["summary", "confirmedTitle", "tracklist", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "communityPost", "youtubeUrl", "sunoUrl"];
      const thin = (pkg: unknown, keys: string[]) => {
        if (!pkg || typeof pkg !== "object") return null;
        const src = pkg as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of keys) {
          const value = String(src[key] ?? "").trim();
          if (!value || value.startsWith("data:")) continue;
          out[key] = value;
        }
        return Object.keys(out).length ? out : null;
      };
      for (const row of Object.values(before.packages ?? {})) {
        const pkg = thin(row.pkg, songKeys);
        if (!pkg || !row.genreId || !row.ep) continue;
        screenSongs.push({ genreId: row.genreId, ep: padEp(row.ep), pkg, from: `화면 single:${row.genreId}:${padEp(row.ep)}` });
      }
      for (const row of Object.values(before.playlists ?? {})) {
        const pkg = thin(row.pkg, actKeys);
        if (!pkg || !row.genreId || !row.act) continue;
        screenActs.push({ genreId: row.genreId, act: row.act, pkg, from: `화면 playlist:${row.genreId}:${row.act}` });
      }
      ingestEncyclopedia(dump);
    }
  } catch {
    /* the file lists below still run */
  }
  onStep("사용자 설정을 읽는 중", 2);
  await tick();
  readCommon();
  onStep("결과 경로를 확인하는 중", 4);
  await tick();
  try {
    const aligned = await withDeadline(
      alignResultFiles({ data: { songs: screenSongs, acts: screenActs, youtube: youtubeWithoutDuplicate(filePackages, readAppDump().meta.youtube ?? {}) } }),
      20000,
    );
    if (!aligned) {
      issues.push({
        code: "result-path-wait",
        title: "결과 경로",
        detail: "경로 확인이 시간 안에 끝나지 않아 그 단계만 건너뛰고 다음 검사를 이어 갔다.",
        fix: "한 단계가 응답이 없어도 검사 전체를 그 자리에서 멈추지 마.",
      });
    } else {
      let moved = aligned.moved ?? [];
      if (moved.some((line) => line.includes("저장 실패"))) {
        const again = await withDeadline(
          alignResultFiles({ data: { songs: screenSongs, acts: screenActs, youtube: youtubeWithoutDuplicate(filePackages, readAppDump().meta.youtube ?? {}) } }),
          20000,
        );
        moved = again?.moved ?? moved;
      }
      if (moved.length) {
        issues.push({
          code: "result-path",
          title: "결과 경로",
          detail: `${moved.length}건\n${moved.slice(0, 8).join("\n")}`,
          fix: "비어 있던 칸만 다른 경로에서 찾아 지정 파일에 넣었다. 지정 파일에 이미 있는 값은 덮지 마.",
        });
      }
    }
  } catch {
    /* the file check below still runs */
  }
  await tick();
  const packs = await Promise.all(genres.map((genre) => listFilledEps({ data: { genreId: genre.id } }).catch(() => null)));
  genres.forEach((genre, index) => {
    const pack = packs[index];
    for (const song of pack?.songs ?? []) {
      fileSong.set(`${genre.id}:${padEp(song.ep)}`, { filled: song.filled === true, youtubeUrl: song.youtubeUrl || "" });
    }
    for (const act of pack?.acts ?? []) {
      fileAct.set(`${genre.id}:pl:${act.act}`, {
        url: act.youtubeUrl || "",
        text: (act.youtubeDescription || "").length,
      });
    }
    for (const act of pack?.actFiles ?? []) {
      filePlaylist.set(`${genre.id}:pl:${act.act}`, {
        hasBody: act.hasBody === true,
        url: act.youtubeUrl || "",
        text: act.text || 0,
      });
    }
  });
    for (const [key, owned] of fileAct) {
      const [genreId, , actRaw] = key.split(":");
      const act = Number(actRaw);
      if (!genreId || !act) continue;
      keepPlaylistFileUrl(genreId, act, owned.url);
    }
  dropStalePlaylistPins(filePlaylist);
  dropStaleSongPins(fileSong, filePackages);
  const dump = readAppDump();
  const lyricSeen = new Map<string, string>();
  const pinSongs: { genreId: string; ep: string; url: string }[] = [];
  const pinActs: { genreId: string; act: string; url: string }[] = [];
  const fixedLines: string[] = [];
  const leftGroups = new Map<string, { count: number; sample: string[] }>();
  const pendingSongs: {
    genreId: string;
    ep: string;
    title: string;
    pkg: NonNullable<ReturnType<typeof readCachedPackage>>;
    lines: string[];
    fields: { key: string; from: string; to: string }[];
  }[] = [];
  const pendingActs: {
    genreId: string;
    act: number;
    title: string;
    pkg: NonNullable<ReturnType<typeof readCachedPlaylist>>;
    lines: string[];
    fields: { key: string; from: string; to: string }[];
  }[] = [];
  const noteLeft = (cause: string, slot: string) => {
    if (cause.startsWith("빈 칸.")) return;
    const row = leftGroups.get(cause) ?? { count: 0, sample: [] };
    row.count += 1;
    if (row.sample.length < 6) row.sample.push(slot);
    leftGroups.set(cause, row);
  };

  onStep("저장 위치를 확인하는 중", 8);
  await tick();
  for (let index = 0; index < genres.length; index += 1) {
    const genre = genres[index];
    for (const item of EPS) {
      const n = padEp(item.n);
      const pkg = readCachedPackage(n, genre.id);
      const file = fileSong.get(`${genre.id}:${n}`);
      const body = hasPageBody(pkg) || file?.filled === true;
      if (isConfirmed("single", genre.id, n)) {
        counts.confirmed += 1;
        if (!body) {
          issues.push({
            code: `confirmed-empty ${genre.id} EP.${n}`,
            title: `${genre.label} EP.${n}`,
            detail: `genre=${genre.id} slot=EP.${n} confirmed=true body=empty`,
            fix: "확정 표시만 있고 결과가 없다. 문제로만 남긴다. 결과를 지어내지 마. 확정은 지우지 마.",
          });
        }
      }
      if (readRowLocked(genre.id, n)) {
        if (body && !isConfirmed("single", genre.id, n)) counts.locked += 1;
        if (!body) {
          issues.push({
            code: `lock-empty ${genre.id} EP.${n}`,
            title: `${genre.label} EP.${n}`,
            detail: `genre=${genre.id} slot=EP.${n} rowLock=true body=empty`,
            fix: "잠금만 있고 결과가 없다. 문제로만 남긴다. 잠금을 지우지 마. 내용을 만들지 마.",
          });
        }
      }
      const fileUrl = (file?.youtubeUrl || "").trim();
      const metaUrl = (dump.meta.youtube?.[`${genre.id}:${n}`] || "").trim();
      const youtube = fileUrl || metaUrl;
      if (fileUrl && metaUrl && fileUrl !== metaUrl) {
        issues.push({
          code: `source ${genre.id} EP.${n}`,
          title: `${genre.label} EP.${n}`,
          detail: `genre=${genre.id} slot=EP.${n} file=${fileUrl} meta=${metaUrl}`,
          fix: "화면 주소가 곡 파일과 다르다. 곡 파일 주소를 기준으로 맞춘다. 파일은 비우지 마.",
        });
      }
      if (youtube && !body) {
        issues.push({
          code: `youtube-empty ${genre.id} EP.${n}`,
          title: `${genre.label} EP.${n}`,
          detail: `genre=${genre.id} slot=EP.${n} youtube=${youtube} body=empty`,
          fix: "결과 없는 칸의 유튜브 주소다. 주소를 지우지 말고 그 곡 결과가 생기면 그 칸에만 붙인다.",
        });
      }
      if (!fileUrl && metaUrl && body) pinSongs.push({ genreId: genre.id, ep: n, url: metaUrl });
      if (!body) {
        counts.empty += 1;
        continue;
      }
      if (!hasPageBody(pkg) || !pkg) continue;
      const confirmedSong = isConfirmed("single", genre.id, n);
      const fromFile = filePackages.get(`${genre.id}:${n}`);
      let shown = fromFile && hasPageBody(fromFile) ? fromFile : pkg;
      if (!confirmedSong) {
        if (!readRowLocked(genre.id, n)) {
          const repaired = repairOpenStudio(genre.id, n, shown);
          if (repaired.wrote.length) {
            const fields = (
              [
                ["confirmedTitle", shown.confirmedTitle, repaired.next.confirmedTitle],
                ["geminiPrompt", shown.geminiPrompt, repaired.next.geminiPrompt],
                ["youtubeTitle", shown.youtubeTitle, repaired.next.youtubeTitle],
              ] as const
            )
              .filter(([, from, to]) => (from || "").trim() !== (to || "").trim() && (to || "").trim())
              .map(([key, from, to]) => ({ key, from: from || "", to: to || "" }));
            if (fields.length) {
              pendingSongs.push({
                genreId: genre.id,
                ep: n,
                title: repaired.next.confirmedTitle,
                pkg: repaired.next,
                lines: repaired.wrote.map((row) => `${genre.id} EP.${n} ${row.field}: ${row.cause}`),
                fields,
              });
              shown = repaired.next;
            }
          }
        }
        for (const row of openFieldNotes(genre.id, n, shown)) noteLeft(row.cause, `${genre.id} EP.${n} ${row.label}`);
      }
      const titled = `${shown.confirmedTitle || ""}\n${shown.youtubeTitle || ""}`;
      const foreign = otherEpNumbers(titled, n);
      if (foreign.length) {
        issues.push({
          code: `ep-mismatch ${genre.id} EP.${n}`,
          title: `${genre.label} EP.${n}`,
          detail: `slot=EP.${n} found=${foreign.map((value) => `EP.${value}`).join(",")}`,
          fix: "제목이나 유튜브 제목에 다른 EP 번호가 있다. 칸을 옮기거나 비우지 마. 저장 칸의 EP 번호를 따른다.",
        });
      }
      const lyric = (shown.lyricsBlock || "").replace(/\s+/g, "");
      const lyricMin = readFieldAudit(readPref(genre.id)).lyricsMin;
      if (lyric.length >= lyricMin) {
        const mark = `${genre.id}:${lyric.slice(0, 240)}`;
        const slot = `${genre.label} EP.${n}`;
        const prev = lyricSeen.get(mark);
        if (prev) {
          issues.push({
            code: `same-song ${genre.id} EP.${n}`,
            title: `${genre.label} EP.${n}`,
            detail: `${slot} = ${prev}`,
            fix: "같은 장르의 두 칸에 같은 가사가 있다. 최고 관리자가 직접 저장한 글은 비우지 마. 자동으로 들어온 다른 곡 가사만 이 페이지에서 지운다. 가져온 곳과 확정곡은 덮지 마.",
          });
        } else lyricSeen.set(mark, slot);
      }
      const rank = fillRank(genre.id, shown, undefined, confirmedSong, n);
      if (rank === 1) counts.empty += 1;
      else if (rank === 2) counts.rough += 1;
      else if (rank === 3 || rank === 4) counts.partial += 1;
    }
    onStep(`저장 위치 · ${genre.label}`, 8 + Math.round(((index + 1) / genres.length) * 42));
    await tick();
  }
  const fileUrls: Record<string, string> = {};
  for (const [key, song] of fileSong) {
    const fileUrl = song.youtubeUrl.trim();
    const metaUrl = (dump.meta.youtube?.[key] || "").trim();
    if (fileUrl && fileUrl !== metaUrl) fileUrls[key] = fileUrl;
  }
  if (Object.keys(fileUrls).length) {
    patchApp((d) => {
      d.meta.youtube = { ...(d.meta.youtube ?? {}), ...fileUrls };
    }, false);
  }

  onStep("원곡을 확인하는 중", 56);
  await tick();
  const originals = new Map(readOriginals().map((song) => [padEp(song.n), song]));
  for (const item of EPS) {
    const song = originals.get(padEp(item.n));
    const missing = [
      !song?.title ? "제목" : "",
      !song?.vocal ? "보컬" : "",
      !song?.lyrics?.trim() ? "가사" : "",
    ].filter(Boolean);
    if (missing.length) {
      issues.push({
        code: `original-empty EP.${padEp(item.n)}`,
        title: `원곡 EP.${padEp(item.n)}`,
        detail: `slot=EP.${padEp(item.n)} missing=${missing.join(",")}`,
        fix: "원곡 시드의 제목·보컬·가사를 그 EP에만 다시 넣는다. 다른 EP는 건드리지 마.",
      });
    }
  }

  onStep("설정을 확인하는 중", 68);
  await tick();
  const common = readCommon();
  if (!common.lockRule.trim() || !common.matchRule.trim() || !common.healthRule.trim()) {
    issues.push({
      code: "common-empty",
      title: "공통 설정",
      detail: "lockRule or matchRule or healthRule is empty",
      fix: "공통 운영 규칙의 기본문을 비어 있는 칸에만 채운다. 사용자가 적은 문장은 지우지 마.",
    });
  }
  if (dump.meta.securityKey && dump.meta.securityKey !== SECURITY_KEY) {
    issues.push({
      code: "security-key",
      title: "보안키",
      detail: `securityKey=${dump.meta.securityKey}`,
      fix: "보안키를 7999로 다시 기록한다. 사용자가 바꾼 비밀번호는 바꾸지 마.",
    });
  }
  for (const genre of GENRES) {
    const pref = readPref(genre.id);
    const guide =
      effectiveGuide(genre.id, pref).trim() ||
      readGenreGuide(genre.id).trim() ||
      getGenre(genre.id).rewrite.trim() ||
      getGenre(genre.id).identity.trim();
    if (!guide) {
      issues.push({
        code: `guide-empty ${genre.id}`,
        title: genre.label,
        detail: `genre=${genre.id} guideText=empty`,
        fix: "그 장르 지침 기본문만 채운다. 다른 장르 설정은 바꾸지 마.",
      });
    }
    const suno = pref.sunoBase.trim() || defaultSunoBase(genre.id) || readSunoBase(genre.id);
    if (genreWantsSuno(genre.id) && !suno) {
      issues.push({
        code: `suno-empty ${genre.id}`,
        title: genre.label,
        detail: `genre=${genre.id} sunoBase=empty`,
        fix: "그 장르 수노 기본 프롬프트만 채운다. 곡 결과는 바꾸지 마.",
      });
    }
  }

  onStep("재생목록과 겹치는 작업을 확인하는 중", 84);
  await tick();
  for (const genre of GENRES.filter((item) => item.kind === "collection")) {
    if (readPref(genre.id).actPlaylist === false) continue;
    for (const act of ACTS) {
      const tracks = tracksForAct(act.n);
      const ready = tracks.filter((track) => isConfirmed("single", genre.id, track.n)).length;
      const listed =
        hasPlaylistBody(readCachedPlaylist(act.n, genre.id)) ||
        filePlaylist.get(`${genre.id}:pl:${act.n}`)?.hasBody === true;
      if (tracks.length >= 10 && ready === tracks.length && !listed) {
        issues.push({
          code: `playlist-missing ${genre.id} ACT.${act.n}`,
          title: `${genre.label} ACT.${act.n}`,
          detail: `genre=${genre.id} act=${act.n} confirmed=${ready}/${tracks.length} playlist=missing`,
          fix: "그 ACT 10곡이 모두 확정이다. 그 ACT 재생목록만 만든다. 개별 곡은 다시 쓰지 마.",
        });
      }
      if (isConfirmed("playlist", genre.id, String(act.n))) continue;
      if (readPref(genre.id).actOutput?.thumb === false) continue;
      const playlist = filePlaylists.get(`${genre.id}:${act.n}`) ?? readCachedPlaylist(act.n, genre.id);
      if (!playlist) continue;
      const thumb = repairOpenPlaylistThumb(playlist);
      if (!thumb || thumb === (playlist.geminiPrompt || "").trim()) continue;
      pendingActs.push({
        genreId: genre.id,
        act: act.n,
        title: playlist.youtubeTitle,
        pkg: { ...playlist, geminiPrompt: thumb },
        lines: [`${genre.id} ACT.${act.n} 썸네일: 확정 제목을 안 따르거나 잠금 문구가 있었다`],
        fields: [{ key: "geminiPrompt", from: playlist.geminiPrompt || "", to: thumb }],
      });
    }
  }
  const job = readFillQueue();
  for (const [key, owned] of fileAct) {
    const fileUrl = owned.url.trim();
    const metaUrl = (dump.meta.youtube?.[key] || "").trim();
    if (fileUrl || !metaUrl) continue;
    const [genreId, , actRaw] = key.split(":");
    if (genreId && actRaw) pinActs.push({ genreId, act: actRaw, url: metaUrl });
  }
  const pinnedPack = await saveSongLinks({
    data: {
      rows: [
        ...pinSongs.map((row) => ({ genreId: row.genreId, ep: row.ep, url: row.url })),
        ...pinActs.map((row) => ({ genreId: row.genreId, act: Number(row.act), url: row.url })),
      ],
    },
  }).catch(() => null);
  const pinnedOk = new Set(pinnedPack?.saved ?? []);
  pinSongs.forEach((row) => {
    if (pinnedOk.has(`${row.genreId}:${row.ep}`)) return;
    const genre = genres.find((item) => item.id === row.genreId);
    issues.push({
      code: `source-pin ${row.genreId} EP.${row.ep}`,
      title: `${genre?.label || row.genreId} EP.${row.ep}`,
      detail: `genre=${row.genreId} slot=EP.${row.ep} file=없음 meta=${row.url}`,
      fix: "유튜브 주소가 곡 파일이 아니라 주소 목록에만 있다. 곡 파일에 주소를 둔다. 본문은 비우지 마.",
    });
  });
  pinActs.forEach((row) => {
    if (pinnedOk.has(`${row.genreId}:pl:${row.act}`)) return;
    issues.push({
      code: `source-pin ${row.genreId} ACT.${row.act}`,
      title: `ACT.${row.act}`,
      detail: `genre=${row.genreId} act=${row.act} file=없음 meta=${row.url}`,
      fix: "유튜브 주소가 ACT 파일이 아니라 주소 목록에만 있다. ACT 파일에 주소를 둔다. 본문은 비우지 마.",
    });
  });
  if (job?.status === "running" && job.tasks.length && !job.paused && !job.userPaused) {
    issues.push({
      code: "server-fill",
      title: "서버 자동 채우기",
      detail: `tasks=${job.tasks.length} paused=${Boolean(job.paused)} userPaused=${Boolean(job.userPaused)}`,
      fix: "서버 자동 채우기를 멈춘다. 화면 채우기와 동시에 쓰지 마. 곡 결과는 지우지 마.",
    });
  }

  if (pendingSongs.length || pendingActs.length) {
    const saved = await saveOpenRepairs({
      data: {
        rows: [
          ...pendingSongs.map((row) => ({
            kind: "single" as const,
            genreId: row.genreId,
            ep: row.ep,
            fields: row.fields,
          })),
          ...pendingActs.map((row) => ({
            kind: "playlist" as const,
            genreId: row.genreId,
            act: row.act,
            fields: row.fields,
          })),
        ],
      },
    }).catch(() => null);
    const written = new Set(saved?.written ?? []);
    for (const row of pendingSongs) {
      if (!written.has(`${row.genreId}:${row.ep}`)) {
        noteLeft("파일은 이전 글을 유지해서 고친 글은 저장하지 않았다", `${row.genreId} EP.${row.ep}`);
        continue;
      }
      patchApp((d) => {
        d.packages[`${row.genreId}:${row.ep}`] = {
          genreId: row.genreId,
          ep: row.ep,
          title: row.title,
          pkg: row.pkg,
          updatedAt: Date.now(),
        };
      }, false);
      fixedLines.push(...row.lines);
    }
    for (const row of pendingActs) {
      if (!written.has(`${row.genreId}:act:${row.act}`)) {
        noteLeft("파일은 이전 글을 유지해서 고친 글은 저장하지 않았다", `${row.genreId} ACT.${row.act}`);
        continue;
      }
      patchApp((d) => {
        d.playlists[`${row.genreId}:${row.act}`] = {
          genreId: row.genreId,
          act: row.act,
          title: row.title,
          pkg: row.pkg,
          updatedAt: Date.now(),
        };
      }, false);
      fixedLines.push(...row.lines);
    }
  }
  if (fixedLines.length) {
    issues.push({
      code: "quality-fixed",
      title: "검사 중 고친 칸",
      detail: `${fixedLines.length}건\n${fixedLines.slice(0, 12).join("\n")}`,
      fix: "검사에서 바로 맞출 수 있던 칸만 저장했다. 다시 덮지 마. 확정은 건드리지 마.",
    });
  }
  if (leftGroups.size) {
    const lines = [...leftGroups.entries()].map(([cause, row]) => `${row.count}건 ${cause}: ${row.sample.join(", ")}`);
    issues.push({
      code: "quality",
      title: "대충·어긋남·빈칸",
      detail: `확정 제외\n${lines.join("\n")}`,
      fix: "원인은 각 줄 그대로다. 원문이 필요한 빈 칸과 가사는 지어내지 마. 확정과 직접 고친 칸은 덮지 마.",
    });
  }

  onStep("연결, 호출, 충돌, 오류를 확인하는 중", 92);
  await tick();
  const extra = inspectLinks(dump, job, fileAct);
  issues.unshift(...extra);
  const calls = await inspectCalls(onStep);
  issues.unshift(...calls);

  onStep("검사를 마쳤습니다", 100);
  await tick();
  return { issues, counts, paste: healthPaste(issues, counts) };
}

function storyPlaylistLive(dump: ReturnType<typeof readAppDump>, genreId: string, id: string) {
  const stories = dump.stories ?? {};
  let sawPlaylist = false;
  for (const [key, row] of Object.entries(stories)) {
    const cover = key.startsWith("playlist:cover:");
    const plain = key.startsWith("playlist:") && !cover;
    if (!cover && !plain) continue;
    sawPlaylist = true;
    if (cover && genreId !== "cover-reborn") continue;
    if (plain && genreId !== "your-story") continue;
    if (key === (cover ? `playlist:cover:${id}` : `playlist:${id}`) || key.endsWith(`:${id}`)) return true;
    const raw = row?.pkg as { id?: string } | undefined;
    if (raw && typeof raw === "object" && raw.id === id) return true;
  }
  return sawPlaylist ? false : null;
}

function inspectLinks(
  dump: ReturnType<typeof readAppDump>,
  job: ReturnType<typeof readFillQueue>,
  fileAct: Map<string, { url: string; text: number }>,
): HealthIssue[] {
  const found: HealthIssue[] = [];
  const genreIds = new Set(GENRES.map((genre) => genre.id));
  const epIds = new Set(EPS.map((item) => padEp(item.n)));
  const broken: string[] = [];
  const dropConfirm: string[] = [];
  const conflicts: string[] = [];
  const errors: string[] = [];
  const youtubeSeen = new Map<string, string[]>();

  for (const [key, row] of Object.entries(dump.packages)) {
    try {
      const [gid, rawEp] = key.split(":");
      const ep = padEp(rawEp || "");
      if (!genreIds.has(gid as (typeof GENRES)[number]["id"]) || !epIds.has(ep)) {
        broken.push(`package ${key}`);
        continue;
      }
      if (row.genreId !== gid || padEp(row.ep) !== ep) {
        conflicts.push(`package ${key} row=${row.genreId}:${padEp(row.ep)}`);
      }
      const text = packageText(row.pkg);
      if (text.length > 20 && !readCachedPackage(ep, gid)) {
        errors.push(`package ${key} 내용은 있는데 읽히지 않음`);
      }
    } catch (error) {
      errors.push(`package ${key} ${errorText(error)}`);
    }
  }

  for (const [key, row] of Object.entries(dump.playlists)) {
    try {
      const [gid, act] = key.split(":");
      if (!genreIds.has(gid as (typeof GENRES)[number]["id"]) || !ACTS.some((item) => String(item.n) === act)) {
        broken.push(`playlist ${key}`);
        continue;
      }
      if (row.genreId !== gid || String(row.act) !== act) {
        conflicts.push(`playlist ${key} row=${row.genreId}:${row.act}`);
      }
    } catch (error) {
      errors.push(`playlist ${key} ${errorText(error)}`);
    }
  }

  for (const [key, url] of Object.entries(dump.meta.youtube ?? {})) {
    if (key.includes(":hq:")) continue;
    const value = String(url || "").trim();
    if (!value) continue;
    const parts = key.split(":");
    const genreOk = genreIds.has(parts[0] as (typeof GENRES)[number]["id"]);
    let targetOk = false;
    if (parts[1] === "pl" && parts[2] === "mv") targetOk = ACTS.some((item) => item.n === Number(parts[3]));
    else if (parts[1] === "pl") targetOk = ACTS.some((item) => item.n === Number(parts[2]));
    else if (parts[1] === "mv") targetOk = epIds.has(padEp(parts[2] || ""));
    else targetOk = epIds.has(padEp(parts[1] || ""));
    if (!genreOk || !targetOk) broken.push(`youtube ${key}`);
    if (!/^https?:\/\//i.test(value)) broken.push(`youtube ${key} 주소 형식 아님`);
    const list = youtubeSeen.get(value) ?? [];
    list.push(key);
    youtubeSeen.set(value, list);
  }
  const actSeen = new Map<string, { key: string; text: number }[]>();
  for (const [key, owned] of fileAct) {
    const value = owned.url.trim();
    if (!value) continue;
    const list = actSeen.get(value) ?? [];
    list.push({ key, text: owned.text });
    actSeen.set(value, list);
  }
  for (const rows of actSeen.values()) {
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => b.text - a.text);
    conflicts.push(`youtube 같은 주소 ${ranked.map((row) => row.key).slice(0, 4).join(", ")}`);
  }
  for (const [url, keys] of youtubeSeen) {
    if (keys.length < 2) continue;
    conflicts.push(`youtube 같은 주소 ${keys.slice(0, 4).join(", ")}`);
    void url;
  }

  for (const key of Object.keys(dump.meta.confirmed ?? {})) {
    if (dump.meta.confirmed?.[key] !== true) continue;
    const cut = key.indexOf(":");
    const gid = cut < 0 ? key : key.slice(0, cut);
    const rest = cut < 0 ? "" : key.slice(cut + 1);
    const cut2 = rest.indexOf(":");
    const kind = cut2 < 0 ? rest : rest.slice(0, cut2);
    const id = cut2 < 0 ? "" : rest.slice(cut2 + 1);
    if (!genreIds.has(gid as (typeof GENRES)[number]["id"])) {
      broken.push(`confirmed ${key}`);
      continue;
    }
    if (kind === "story") continue;
    if (kind === "ep" && !epIds.has(padEp(id || ""))) broken.push(`confirmed ${key}`);
    if (kind === "act" && !ACTS.some((item) => String(item.n) === id)) {
      if (gid === "your-story" || gid === "cover-reborn") {
        const live = storyPlaylistLive(dump, gid, id);
        if (live === true || live === null) continue;
        dropConfirm.push(key);
        continue;
      }
      broken.push(`confirmed ${key}`);
    }
    if (kind !== "ep" && kind !== "act") conflicts.push(`confirmed ${key}`);
  }

  if (dropConfirm.length) {
    patchApp((d) => {
      const confirmed = { ...(d.meta.confirmed ?? {}) };
      for (const key of dropConfirm) delete confirmed[key];
      d.meta.confirmed = confirmed;
    }, false);
    for (const key of dropConfirm) {
      void saveConfirm({ data: { key, on: false } });
    }
  }

  for (const key of Object.keys(dump.meta.rowLocks ?? {})) {
    if (dump.meta.rowLocks?.[key] !== true) continue;
    const [gid, rawEp] = key.split(":");
    if (!genreIds.has(gid as (typeof GENRES)[number]["id"]) || !epIds.has(padEp(rawEp || ""))) {
      broken.push(`lock ${key}`);
    }
  }

  if (job?.lastError?.trim()) errors.push(`fill ${job.lastError.trim()}`);
  for (const event of job?.events ?? []) {
    if (event.state === "fail" || event.state === "error") {
      errors.push(`fill ${event.label || "작업"} ${event.reason || event.state}`);
    }
  }
  for (const task of job?.tasks ?? []) {
    const gid = task.genreId || job?.genreId || "";
    if (gid && !genreIds.has(gid as (typeof GENRES)[number]["id"])) broken.push(`fill-task ${gid}`);
    if (task.kind === "single" && task.n && !epIds.has(padEp(task.n))) broken.push(`fill-task EP.${task.n}`);
  }

  pushGroup(
    found,
    "link-broken",
    "끊긴 연결",
    broken,
    "없는 장르·EP를 가리키는 연결만 그 키에서 끊는다. 곡 내용, 확정, 잠금은 다른 칸으로 옮기지 마.",
  );
  pushGroup(
    found,
    "conflict",
    "충돌",
    conflicts,
    "키와 내용이 다른 항목만 맞춘다. 더 긴 결과 하나만 남기고 나머지는 비우지 말고 그록에게 번호로 알린다.",
  );
  pushGroup(
    found,
    "read-error",
    "오류",
    errors,
    "읽히지 않는 그 칸만 고친다. 다른 곡은 다시 쓰지 마.",
  );
  return found;
}

function pushGroup(found: HealthIssue[], code: string, title: string, lines: string[], fix: string) {
  const unique = [...new Set(lines)];
  if (!unique.length) return;
  found.push({
    code,
    title,
    detail: `${unique.length}건\n${unique.slice(0, 8).join("\n")}`,
    fix,
  });
}

function packageText(pkg: unknown) {
  if (!pkg || typeof pkg !== "object") return "";
  const value = pkg as Record<string, unknown>;
  return [value.summary, value.confirmedTitle, value.lyricsBlock, value.youtubeTitle]
    .filter((item): item is string => typeof item === "string")
    .join("");
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "read failed";
}

async function inspectCalls(onStep: (label: string, pct: number) => void): Promise<HealthIssue[]> {
  const found: HealthIssue[] = [];
  const loads: [string, () => Promise<unknown>][] = [
    ["pages", () => import("./pages")],
    ["generate-package", () => import("./generate-package")],
    ["story-app", () => import("../components/studio/story-app")],
  ];
  for (const [name, load] of loads) {
    try {
      await load();
    } catch (error) {
      found.push({
        code: `call-fail ${name}`,
        title: "호출을 불러오지 못함",
        detail: `${name} ${errorText(error)}`,
        fix: "그 파일 연결만 고친다. 곡 결과는 바꾸지 마.",
      });
    }
  }
  onStep("서버 호출을 확인하는 중", 96);
  try {
    const api = await import("./pages");
    await Promise.race([
      api.loadCommonPref(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("8초 안에 응답 없음")), 8000)),
    ]);
  } catch (error) {
    found.push({
      code: "call-fail server",
      title: "서버 호출 실패",
      detail: `loadCommonPref ${errorText(error)}`,
      fix: "공통 설정을 읽는 서버 호출만 고친다. 곡 결과는 바꾸지 마.",
    });
  }
  return found;
}
