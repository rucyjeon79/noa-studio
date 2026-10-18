// @ts-nocheck
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { asThumbCast } from "./characters";
import { ACTS } from "./catalog";
import { canKeepPackage, hasPageBody, isStoryFixture, isStoryStoreId, isStubResultToken, keepStoryText, keepUserEdits, normalizePackage, packageFitsSong, shouldReplaceStudio, storyShownTitle } from "./package";
import { coverArtistOf, storyDiskName, storyFileStem } from "./story-filename";
import { mergeLatestBody, readFieldStamps, stampChangedFields } from "./latest-text";
import { blankMeta, emptyEncyclopedia } from "./encyclopedia-types";
import { boundStoryAbs, capturePairs, noteMovedPairs, noteRemoved, ownersOf, preferBound, relFromAbs, relocatedActRows, relocatedSongRows, relocatedStoryHits } from "./live-bind.server";

const ROOT = typeof globalThis.process?.cwd === "function" ? globalThis.process.cwd() : "";
const SEED = ROOT ? join(ROOT, "src/data/encyclopedia.json") : "";
const LIVE = ROOT ? join(ROOT, "data/live") : "";
const LEGACY = LIVE ? join(LIVE, "encyclopedia.json") : "";
function safePart(value) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return (cleaned || "item").slice(0, 80);
}
let diskDenied = false;
function isReadOnlyFs(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  const message = err instanceof Error ? err.message : String(err || "");
  if (code === "EROFS" || code === "EPERM" || code === "EACCES" || /read-only file system/i.test(message)) return true;
  if ((code === "ENOENT" || /ENOENT/.test(message)) && /mkdir|open|rename/i.test(message)) return true;
  return false;
}
function diskWriteDenied() {
  return diskDenied;
}
function writeJson(path, value) {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch (err) {
    if (isReadOnlyFs(err)) {
      diskDenied = true;
      return false;
    }
    throw err;
  }
  const text = `${JSON.stringify(value)}
`;
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, path);
    diskDenied = false;
    return true;
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
    }
    try {
      writeFileSync(path, text);
      diskDenied = false;
      return true;
    } catch (err2) {
      if (isReadOnlyFs(err) || isReadOnlyFs(err2)) {
        diskDenied = true;
        return false;
      }
      throw err;
    }
  }
}
function readJson(path) {
  try {
    if (!path || !existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function slim(pkg) {
  const thumb = pkg.thumbUrl ?? "";
  const keep = thumb.startsWith("http") || thumb.startsWith("/");
  return { ...pkg, thumbUrl: keep ? thumb : "" };
}
function songPath(genreId, ep) {
  const canon = join(LIVE, "\uACE1", safePart(genreId), "ep", `${safePart(ep)}.json`);
  return preferBound(canon, `song:${safePart(genreId)}:${safePart(ep)}`);
}
function legacySongPaths(genreId, ep) {
  const id = safePart(genreId);
  const file = `${safePart(ep)}.json`;
  return [join(LIVE, "genres", id, "ep", file), join(LIVE, "songs", id, file)];
}
function actPath(genreId, act) {
  const canon = join(LIVE, "\uACE1", safePart(genreId), `act-${act}.json`);
  return preferBound(canon, `act:${safePart(genreId)}:${act}`);
}
function legacyActPaths(genreId, act) {
  const id = safePart(genreId);
  return [join(LIVE, "genres", id, `act-${act}.json`), join(LIVE, "playlists", id, `${act}.json`)];
}
function prefCommonPath() {
  return join(LIVE, "\uC0AC\uC6A9\uC790\uC124\uC815", "\uACF5\uD1B5.json");
}
function prefGenrePath(genreId) {
  return join(LIVE, "\uC0AC\uC6A9\uC790\uC124\uC815", "\uC7A5\uB974", `${safePart(genreId)}.json`);
}
function originalPath(genreId, n) {
  return join(LIVE, "\uC6D0\uACE1\uC815\uBCF4", safePart(genreId), `${safePart(n)}.json`);
}
function storyHash(title) {
  return createHash("sha1").update(title.trim()).digest("hex").slice(0, 20);
}
function storyGenreId(genreId = "your-story") {
  return genreId === "cover-reborn" ? "cover-reborn" : "your-story";
}
const STORY_BIN = "기본";
function storyRootDir(genreId = "your-story") {
  return join(LIVE, "곡", storyGenreId(genreId));
}
function storySongDir(genreId = "your-story") {
  return join(storyRootDir(genreId), STORY_BIN);
}
function isPlaylistFileName(name) {
  return name.startsWith("플레이리스트");
}
function playlistDiskPath(title, genreId = "your-story") {
  const genre = storyGenreId(genreId);
  const id = title.trim().replace(/^playlist:/, "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "목록";
  const stem = storyFileStem(`플레이리스트 ${id}`) || "플레이리스트";
  return join(storyRootDir(genre), `${stem}.json`);
}
function storySongLabel(title, pkg) {
  const raw = title.trim().replace(/^cover:/, "");
  if (!raw || raw.startsWith("playlist:")) return "";
  const shown = storyShownTitle(raw, pkg ?? void 0);
  if (shown && !isStoryStoreId(shown)) return shown;
  if (!isStoryStoreId(raw)) return raw;
  return "";
}
function hashStoryPath(title, genreId = "your-story") {
  const folder = title.trim().startsWith("playlist:") ? storyRootDir(genreId) : storySongDir(genreId);
  return join(folder, `${storyHash(title)}.json`);
}
function legacyHashStoryPath(title, genreId = "your-story") {
  return join(storyRootDir(genreId), `${storyHash(title)}.json`);
}
function namedStoryPath(title, genreId = "your-story", vocal = "") {
  const name = title.trim();
  if (!name) return "";
  if (name.startsWith("playlist:")) return playlistDiskPath(name, genreId);
  const song = storySongLabel(name) || (!isStoryStoreId(name) ? name.replace(/^cover:/, "") : "");
  const folder = storyGenreId(genreId);
  const stem = storyDiskName(folder, song, folder === "cover-reborn" ? vocal : "");
  if (!stem) return "";
  return join(storySongDir(genreId), `${stem}.json`);
}
function storyPath(title, genreId = "your-story", vocal = "") {
  const name = title.trim();
  if (name.startsWith("playlist:")) return playlistDiskPath(name, genreId);
  return namedStoryPath(name, genreId, vocal);
}
function legacyStoryPaths(title, genreId = "your-story") {
  const name = title.trim();
  const hash = `${storyHash(name)}.json`;
  const encoded = `${encodeURIComponent(name).slice(0, 120)}.json`;
  const cover = genreId === "cover-reborn";
  const folder = cover ? "\uCEE4\uBC84" : "\uC0AC\uC5F0";
  const paths = [join(LIVE, folder, hash), join(LIVE, folder, encoded)];
  if (!cover) {
    paths.push(join(LIVE, "stories", encoded), join(LIVE, "stories", hash));
  }
  return paths;
}
function isHashStoryFile(path) {
  return /\/[0-9a-f]{20}\.json$/.test(path);
}
function storyLookupPaths(title, genreId = "your-story", vocal = "") {
  const name = title.trim();
  const genre = storyGenreId(genreId);
  const paths = [];
  const push = (path) => {
    if (path && !paths.includes(path)) paths.push(path);
  };
  const song = storySongLabel(name) || (!isStoryStoreId(name) && !name.startsWith("playlist:") ? name.replace(/^cover:/, "") : "");
  push(boundStoryAbs(genre, name));
  if (song && song !== name) push(boundStoryAbs(genre, song));
  if (name.startsWith("playlist:")) {
    push(playlistDiskPath(name, genre));
    push(hashStoryPath(name, genre));
    push(legacyHashStoryPath(name, genre));
  }
  if (genre === "cover-reborn" && vocal.trim()) push(namedStoryPath(song || name, genre, vocal));
  if (song) push(namedStoryPath(song, genre, ""));
  const scan = (dir, songsOnly) => {
    if (!dir || !existsSync(dir)) return;
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const file of names) {
      if (!file.endsWith(".json") || file.endsWith(".tmp") || /^act-\d+\.json$/.test(file)) continue;
      if (songsOnly && isPlaylistFileName(file)) continue;
      const full = join(dir, file);
      if (paths.includes(full) || isHashStoryFile(full)) continue;
      const row = readJson(full);
      if (!row) continue;
      const rowTitle = String(row.title || "").trim();
      const rowId = String(row.songId || row.pkg?.songId || "").trim();
      const stem = file.slice(0, -".json".length);
      const wantId = isStoryStoreId(name) ? name : "";
      if (wantId && (rowId === wantId || rowTitle === wantId)) push(full);else
      if (song && (rowTitle === song || stem === song || stem.startsWith(`${song} - `))) push(full);else
      if (name && (rowTitle === name || rowId === name || stem === name)) push(full);
    }
  };
  if (!name.startsWith("playlist:")) {
    scan(storySongDir(genre), true);
    scan(storyRootDir(genre), true);
  }
  if (name) push(hashStoryPath(name, genre));
  if (name && !name.startsWith("playlist:")) push(legacyHashStoryPath(name, genre));
  if (song && song !== name) {
    push(hashStoryPath(song, genre));
    push(legacyHashStoryPath(song, genre));
  }
  for (const old of legacyStoryPaths(name, genre)) push(old);
  return paths;
}
function fillJobPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uC790\uB3D9\uCC44\uC6B0\uAE30.json");
}
function metaPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uC0C1\uD0DC.json");
}
function confirmedPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uD655\uC815.json");
}
function linksPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uC8FC\uC18C.json");
}
function rowLockPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uC7A0\uAE08.json");
}
function lockSweepPath() {
  return join(LIVE, "\uC571\uAD00\uB9AC", "\uC7A0\uAE08\uD574\uC81C.json");
}
function forgetLegacySong(genreId, ep) {
  for (const path of legacySongPaths(genreId, ep)) {
    if (existsSync(path)) unlinkSync(path);
  }
}
function forgetLegacyAct(genreId, act) {
  for (const path of legacyActPaths(genreId, act)) {
    if (existsSync(path)) unlinkSync(path);
  }
}
function readSongRecord(genreId, ep) {
  return readJson(songPath(genreId, ep)) ?? legacySongPaths(genreId, ep).map((path) => readJson(path)).find(Boolean) ?? null;
}
function readSongUpdatedAt(genreId, ep) {
  const path = songPath(genreId, ep);
  if (!path || !existsSync(path)) return 0;
  return Math.round(statSync(path).mtimeMs) || 0;
}
function readActUpdatedAt(genreId, act) {
  const path = actPath(genreId, act);
  if (!path || !existsSync(path)) return 0;
  return Math.round(statSync(path).mtimeMs) || 0;
}
function readMetaUpdatedAt() {
  if (!LIVE) return 0;
  const path = metaPath();
  if (!path || !existsSync(path)) return 0;
  return Math.round(statSync(path).mtimeMs) || 0;
}
function readPrefUpdatedAt(genreId) {
  if (!LIVE || !genreId) return 0;
  const path = genreId === "__common" ? prefCommonPath() : prefGenrePath(genreId);
  const alt = join(LIVE, "prefs", `${safePart(genreId)}.json`);
  for (const file of [path, alt]) {
    if (!existsSync(file)) continue;
    return Math.round(statSync(file).mtimeMs) || 0;
  }
  return 0;
}
function readSongPage(genreId, ep) {
  const row = readSongRecord(genreId, ep);
  if (!row?.pkg) return null;
  return {
    genreId: row.genreId || genreId,
    ep: row.ep || ep,
    title: row.title || "",
    pkg: row.pkg
  };
}
function lyricHead(text) {
  return text.replace(/\s+/g, "").slice(0, 80);
}
function genreLyricHeads(genreId) {
  const dir = join(LIVE, "\uACE1", safePart(genreId), "ep");
  const heads = /* @__PURE__ */new Map();
  if (!dir || !existsSync(dir)) return heads;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const ep = name.replace(/\.json$/, "").padStart(2, "0");
    const row = readJson(join(dir, name));
    const head = lyricHead(String(row?.pkg?.lyricsBlock || ""));
    if (head.length >= 48) heads.set(ep, head);
  }
  return heads;
}
function lyricsMatchSibling(genreId, ep, lyrics) {
  const head = lyricHead(lyrics);
  if (head.length < 48) return false;
  const n = ep.padStart(2, "0");
  for (const [otherEp, otherHead] of genreLyricHeads(genreId)) {
    if (otherEp === n) continue;
    if (otherHead === head) return true;
  }
  return false;
}
function unescapeBreaks(text) {
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}
function repairActPackage(genreId, act, pkg) {
  const path = actPath(genreId, act);
  const prev = readJson(path) ?? {};
  if (prev.confirmed === true) return pkg;
  const next = { ...pkg };
  let changed = false;
  const track = unescapeBreaks(String(pkg.tracklist || ""));
  const desc = unescapeBreaks(String(pkg.youtubeDescription || ""));
  if (track !== String(pkg.tracklist || "")) {
    next.tracklist = track;
    changed = true;
  }
  if (desc !== String(pkg.youtubeDescription || "")) {
    next.youtubeDescription = desc;
    changed = true;
  }
  if (pkg.tracklistEdited !== true) {
    const lines = [];
    for (let n = (act - 1) * 10 + 1; n <= act * 10; n += 1) {
      const ep = String(n).padStart(2, "0");
      const confirmed = String(readSongRecord(genreId, ep)?.pkg?.confirmedTitle || "").trim();
      if (!confirmed) {
        lines.length = 0;
        break;
      }
      lines.push(`EP.${ep} ${confirmed}`);
    }
    if (lines.length === 10) {
      const rebuilt = lines.join("\n");
      if (rebuilt !== String(next.tracklist || "").trim()) {
        next.tracklist = rebuilt;
        changed = true;
      }
    }
  }
  if (!changed) return pkg;
  writeJson(path, { ...prev, genreId, act, pkg: next });
  return next;
}
function readActPage(genreId, act) {
  const row = readJson(actPath(genreId, act)) ?? legacyActPaths(genreId, act).map((path) => readJson(path)).find(Boolean) ?? null;
  if (!row?.pkg && row?.activated !== true) return null;
  const pkg = row?.pkg ? repairActPackage(genreId, act, row.pkg) : row?.pkg;
  return {
    genreId: row?.genreId || genreId,
    act: row?.act || act,
    title: row?.title || "",
    pkg,
    confirmed: row?.confirmed === true,
    activated: row?.activated === true
  };
}
function listGenreSongHeads(genreId) {
  const dir = join(LIVE, "\uACE1", safePart(genreId), "ep");
  const out = [];
  if (dir && existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || name.endsWith(".tmp")) continue;
      const row = readJson(join(dir, name));
      if (!row?.ep) continue;
      const pkg = row.pkg;
      const title = String(pkg?.confirmedTitle || row.title || "").trim();
      const filled = [pkg?.summary, pkg?.lyricsBlock, pkg?.sunoStyle, pkg?.geminiPrompt, pkg?.youtubeTitle, pkg?.youtubeDescription, pkg?.fanLetter, title].some((value) => String(value || "").trim());
      out.push({
        ep: row.ep,
        title,
        confirmed: row.confirmed === true,
        filled,
        youtubeUrl: String(pkg?.youtubeUrl || "").trim(),
        youtubeDescription: String(pkg?.youtubeDescription || "").trim()
      });
    }
  }
  for (const row of relocatedSongRows(genreId)) {
    const ep = String(row?.ep || "").trim();
    if (!ep) continue;
    const pkg = row.pkg;
    const title = String(pkg?.confirmedTitle || row.title || "").trim();
    const filled = [pkg?.summary, pkg?.lyricsBlock, pkg?.sunoStyle, pkg?.geminiPrompt, pkg?.youtubeTitle, pkg?.youtubeDescription, pkg?.fanLetter, title].some((value) => String(value || "").trim());
    const head = {
      ep,
      title,
      confirmed: row.confirmed === true,
      filled,
      youtubeUrl: String(pkg?.youtubeUrl || "").trim(),
      youtubeDescription: String(pkg?.youtubeDescription || "").trim()
    };
    const idx = out.findIndex((item) => item.ep === ep);
    if (idx >= 0) out[idx] = head;
    else out.push(head);
  }
  return out;
}
function listGenreActDescs(genreId) {
  if (genreId === "your-story" || genreId === "cover-reborn") return [];
  const out = [];
  for (const item of ACTS) {
    const act = item.n;
    const raw = readJson(actPath(genreId, act));
    let activated = raw?.activated === true;
    if (!activated && actSongsConfirmed(genreId, act)) {
      sealActFile(genreId, act, raw?.title || "", raw?.pkg ?? null);
      activated = true;
    }
    if (!activated) continue;
    const pkg = readJson(actPath(genreId, act))?.pkg ?? raw?.pkg;
    const confirmed = readJson(actPath(genreId, act))?.confirmed === true || raw?.confirmed === true;
    out.push({
      act,
      youtubeDescription: String(pkg?.youtubeDescription || "").trim(),
      youtubeUrl: String(pkg?.youtubeUrl || "").trim(),
      confirmed,
      activated: true
    });
  }
  return out;
}
function listActFileBodies(genreId) {
  const out = [];
  for (const item of ACTS) {
    const raw = readJson(actPath(genreId, item.n));
    const pkg = raw?.pkg;
    const parts = [pkg?.summary, pkg?.tracklist, pkg?.geminiPrompt, pkg?.youtubeTitle, pkg?.youtubeDescription].map(
      (value) => String(value || "")
    );
    const text = parts.reduce((sum, value) => sum + value.length, 0);
    const hasBody2 = parts.some((value) => value.trim());
    if (!hasBody2 && raw?.activated !== true) continue;
    out.push({
      act: item.n,
      hasBody: hasBody2,
      youtubeUrl: String(pkg?.youtubeUrl || "").trim(),
      text
    });
  }
  return out;
}
function actSongsConfirmed(genreId, act) {
  const start = (act - 1) * 10 + 1;
  const meta = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const flags = readConfirmedFlags();
  const songs = [];
  for (let n = start; n < start + 10; n += 1) {
    const ep = String(n).padStart(2, "0");
    const key = `${genreId}:ep:${ep}`;
    const row = readSongRecord(genreId, ep);
    const confirmed = row?.confirmed === true || flags[key] === true || meta?.confirmed?.[key] === true;
    if (!confirmed) return null;
    const pkg = row?.pkg;
    const title = String(pkg?.confirmedTitle || row?.title || "").trim();
    const blurb = String(pkg?.summary || "").split("\n").map((line) => line.trim()).find((line) => line.length > 0) || "";
    songs.push({ n: ep, title, blurb });
  }
  return songs;
}
function sealActFile(genreId, act, title, pkg) {
  const path = actPath(genreId, act);
  const prev = readJson(path);
  const prevUrl = String(prev?.pkg?.youtubeUrl || "").trim();
  const disk = { ...(prev?.pkg ?? {}) };
  const incoming = pkg ?? {};
  for (const key of ["summary", "confirmedTitle", "tracklist", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "communityPost", "youtubeUrl"]) {
    if (!String(disk[key] ?? "").trim() && String(incoming[key] ?? "").trim()) disk[key] = String(incoming[key]).trim();
  }
  if (prevUrl && !String(disk.youtubeUrl ?? "").trim()) disk.youtubeUrl = prevUrl;
  const hasPrev = ["summary", "tracklist", "geminiPrompt", "youtubeTitle", "youtubeDescription"].some((key) => String(disk[key] ?? "").trim());
  writeJson(path, {
    genreId,
    act,
    title: hasPrev ? prev?.title || title : title || prev?.title || "",
    pkg: disk,
    activated: true,
    ...(prev?.confirmed === true ? { confirmed: true } : {})
  });
  return readActPage(genreId, act);
}
function readStudioShell() {
  migrateLiveLayout();
  const metaFile = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const fillFile = readJson(fillJobPath()) ?? readJson(join(LIVE, "fill-job.json"));
  const rowLocks = { ...(metaFile?.rowLocks ?? {}), ...(readRowLockFile() ?? {}) };
  return {
    packages: readSongFiles(),
    playlists: readPlaylistFiles(),
    stories: readStoryFiles(),
    prefs: readPrefFiles(),
    originals: readOriginalFiles(),
    titles: {},
    fillJob: fillFile,
    meta: {
      ...blankMeta(),
      ...(metaFile ?? {}),
      rowLocks,
      youtube: metaFile?.youtube ?? {},
      confirmed: liveConfirmed()
    }
  };
}
function songFileRows() {
  const rows = [];
  const root = join(LIVE, "\uACE1");
  if (root && existsSync(root)) {
    for (const genre of readdirSync(root, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      rows.push(...readDirJson(join(root, genre.name, "ep")));
    }
  }
  rows.push(...readDirJson(join(LIVE, "songs")));
  const old = join(LIVE, "genres");
  if (old && existsSync(old)) {
    for (const genre of readdirSync(old, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      rows.push(...readDirJson(join(old, genre.name, "ep")));
    }
  }
  for (const row of relocatedSongRows("")) {
    if (row) rows.push(row);
  }
  return rows;
}
function readFileDump(path) {
  const parsed = readJson(path);
  if (!parsed) return null;
  return {
    packages: parsed.packages && typeof parsed.packages === "object" ? parsed.packages : {},
    playlists: parsed.playlists && typeof parsed.playlists === "object" ? parsed.playlists : {},
    stories: parsed.stories && typeof parsed.stories === "object" ? parsed.stories : {},
    prefs: parsed.prefs && typeof parsed.prefs === "object" ? parsed.prefs : {},
    originals: parsed.originals && typeof parsed.originals === "object" ? parsed.originals : {},
    titles: parsed.titles && typeof parsed.titles === "object" ? parsed.titles : {},
    fillJob: parsed.fillJob ?? null,
    meta: { ...blankMeta(), ...(parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {}) }
  };
}
function readDirJson(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) out.push(...readDirJson(path));else
    if (name.name.endsWith(".json") && !name.name.endsWith(".tmp")) {
      const parsed = readJson(path);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}
function readSongFiles() {
  const packages = {};
  for (const row of songFileRows()) {
    const item = row;
    if (!item.genreId || !item.ep || !item.pkg) continue;
    packages[`${item.genreId}:${item.ep}`] = {
      genreId: item.genreId,
      ep: item.ep,
      title: item.title || "",
      pkg: item.pkg,
      ...(item.confirmed === true ? { confirmed: true } : {})
    };
  }
  return packages;
}
function readPlaylistFiles() {
  const playlists = {};
  const take = (row) => {
    const item = row;
    if (!item.genreId || !item.pkg) return;
    const act = item.act ?? 1;
    playlists[`${item.genreId}:${act}`] = { genreId: item.genreId, act, title: item.title || "", pkg: item.pkg, ...(item.confirmed === true ? { confirmed: true } : {}) };
  };
  for (const row of readDirJson(join(LIVE, "playlists"))) take(row);
  for (const rootName of ["\uACE1", "genres"]) {
    const root = join(LIVE, rootName);
    if (!existsSync(root)) continue;
    for (const genre of readdirSync(root, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      for (const name of readdirSync(join(root, genre.name))) {
        if (!/^act-\d+\.json$/.test(name)) continue;
        take(readJson(join(root, genre.name, name)));
      }
    }
  }
  for (const row of relocatedActRows("")) take(row);
  return playlists;
}
function storySavedAt(title, genreId = "your-story") {
  let at = 0;
  for (const path of storyLookupPaths(title, genreId)) {
    try {
      at = Math.max(at, statSync(path).mtimeMs || 0);
    } catch {
    }
  }
  return at;
}
function storyRegisteredAt(title, stored, genreId = "your-story") {
  const kept = Number(stored) || 0;
  if (kept > 0) return kept;
  let born = 0;
  for (const path of storyLookupPaths(title, genreId)) {
    try {
      const birth = Number(statSync(path).birthtimeMs) || 0;
      if (birth > born) born = birth;
    } catch {
    }
  }
  return born;
}
function readStoryFiles() {
  const stories = {};
  const take = (row, cover) => {
    const item = row;
    if (!item.title) return;
    if (item.title.startsWith("playlist:") && Array.isArray(item.songs) && item.pkg) {
      stories[item.title] = {
        title: item.theme || item.title,
        pkg: { id: item.id || item.title.slice("playlist:".length), theme: item.theme || "", songs: item.songs, pkg: item.pkg }
      };
      return;
    }
    if (!item.pkg || typeof item.pkg !== "object") return;
    const pkgValues = Object.values(item.pkg);
    const pkgFilled = pkgValues.some((value) => typeof value === "string" ? value.trim().length > 0 : value != null && value !== "");
    if (!String(item.title || "").startsWith("playlist:") && !pkgFilled) return;
    const pkgSong = typeof item.pkg.songId === "string" ? item.pkg.songId.trim() : "";
    const songId = (typeof item.songId === "string" ? item.songId.trim() : "") || pkgSong;
    const display = item.title.replace(/^cover:/, "");
    if (isStoryFixture(songId || display, { ...item.pkg, songId })) return;
    const storeId = songId || display;
    const key = cover ? `cover:${storeId}` : storeId;
    const savedAt = storySavedAt(storeId, cover ? "cover-reborn" : "your-story");
    const registeredAt = storyRegisteredAt(storeId, item.registeredAt, cover ? "cover-reborn" : "your-story");
    const prev = stories[key];
    const prevSaved = prev?.savedAt || 0;
    const prevReg = prev?.registeredAt || 0;
    const pkg = songId ? { ...item.pkg, songId } : item.pkg;
    stories[key] = {
      title: display || storeId,
      pkg,
      ...(item.confirmed === true ? { confirmed: true } : {}),
      ...(Math.max(prevSaved, savedAt) ? { savedAt: Math.max(prevSaved, savedAt) } : {}),
      ...(Math.min(prevReg || registeredAt, registeredAt || prevReg) ? { registeredAt: Math.min(prevReg || registeredAt, registeredAt || prevReg) } : {})
    };
  };
  eachLooseStory(take);
  return stories;
}
function eachLooseStory(fn) {
  const dirs = [
  { dir: join(LIVE, "stories"), cover: false },
  { dir: join(LIVE, "\uC0AC\uC5F0"), cover: false },
  { dir: join(LIVE, "\uCEE4\uBC84"), cover: true },
  { dir: join(LIVE, "곡", "your-story"), cover: false },
  { dir: join(LIVE, "곡", "your-story", STORY_BIN), cover: false },
  { dir: join(LIVE, "곡", "cover-reborn"), cover: true },
  { dir: join(LIVE, "곡", "cover-reborn", STORY_BIN), cover: true }];

  for (const { dir, cover } of dirs) {
    if (!dir || !existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || name.endsWith(".tmp") || /^act-\d+\.json$/.test(name)) continue;
      const parsed = readJson(join(dir, name));
      if (parsed) fn(parsed, cover);
    }
  }
  for (const hit of relocatedStoryHits()) {
    const parsed = readJson(hit.abs);
    if (parsed) fn(parsed, hit.cover);
  }
}
function readPrefFiles() {
  const prefs = {};
  const take = (id, path) => {
    if (prefs[id]) return;
    const pref = readJson(path);
    if (pref) prefs[id] = pref;
  };
  take("__common", prefCommonPath());
  take("__common", join(LIVE, "prefs", "__common.json"));
  const genreDir = join(LIVE, "\uC0AC\uC6A9\uC790\uC124\uC815", "\uC7A5\uB974");
  if (existsSync(genreDir)) {
    for (const name of readdirSync(genreDir)) {
      if (!name.endsWith(".json")) continue;
      take(name.slice(0, -5), join(genreDir, name));
    }
  }
  const old = join(LIVE, "prefs");
  if (existsSync(old)) {
    for (const name of readdirSync(old)) {
      if (!name.endsWith(".json")) continue;
      take(name.slice(0, -5), join(old, name));
    }
  }
  return prefs;
}
function readOriginalDir(dir, originals) {
  if (!dir || !existsSync(dir)) return;
  for (const genre of readdirSync(dir, { withFileTypes: true })) {
    if (!genre.isDirectory()) continue;
    const songs = { ...(originals[genre.name] ?? {}) };
    for (const file of readdirSync(join(dir, genre.name))) {
      if (!file.endsWith(".json")) continue;
      const song = readJson(join(dir, genre.name, file));
      if (song?.n && !songs[song.n]) songs[song.n] = song;
    }
    if (Object.keys(songs).length) originals[genre.name] = songs;
  }
}
function readOriginalFiles() {
  const originals = {};
  readOriginalDir(join(LIVE, "\uC6D0\uACE1\uC815\uBCF4"), originals);
  readOriginalDir(join(LIVE, "originals"), originals);
  return originals;
}
function overlayPackages(base, extra, allowLower = false) {
  const packages = { ...base };
  for (const [key, row] of Object.entries(extra)) {
    const prev = packages[key]?.pkg;
    const next = row.pkg;
    if (prev && !shouldReplaceStudio(normalizePackage(prev), normalizePackage(next), allowLower && hasBody(next))) continue;
    packages[key] = row;
  }
  return packages;
}
function hasBody(pkg) {
  if (!pkg) return false;
  return Boolean(pkg.summary?.trim() || pkg.confirmedTitle?.trim() || pkg.lyricsBlock?.trim() || pkg.youtubeTitle?.trim());
}
function slotRewriteOpen(genreId, ep) {
  const n = String(ep || "").replace(/\D/g, "").padStart(2, "0");
  if (!genreId || n === "00") return false;
  const song = readSongRecord(genreId, ep) ?? readSongRecord(genreId, n);
  const key = `${genreId}:ep:${n}`;
  const flags = readConfirmedFlags();
  const rowFile = readRowLockFile();
  const confirmedOn = song?.confirmed === true || flags[key] === true;
  const lockOn = song?.rowLocked === true || rowFile?.[`${genreId}:${n}`] === true || rowFile?.[`${genreId}:${ep}`] === true;
  return !confirmedOn && !lockOn;
}
function moveLiveFile(from, to) {
  if (!from || !to || !existsSync(from) || existsSync(to)) return;
  try {
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
  } catch (err) {
    if (isReadOnlyFs(err)) return;
    throw err;
  }
}
function shiftStoryDir(from, genreId) {
  if (!LIVE) return;
  const songs = storySongDir(genreId);
  const lists = storyRootDir(genreId);
  try {
    mkdirSync(songs, { recursive: true });
    mkdirSync(lists, { recursive: true });
  } catch (err) {
    if (isReadOnlyFs(err)) return;
    throw err;
  }
  if (!from || !existsSync(from)) return;
  for (const name of readdirSync(from)) {
    if (!name.endsWith(".json") || name.endsWith(".tmp")) continue;
    const dest = isPlaylistFileName(name) ? lists : songs;
    moveLiveFile(join(from, name), join(dest, name));
  }
}
function forgetLegacyStory(canon, titles, genreId, song = "", songId = "", vocal = "") {
  if (!canon || !existsSync(canon)) return;
  const pkg = readJson(canon)?.pkg;
  const filled = Boolean(pkg && Object.values(pkg).some((value) => typeof value === "string" && value.trim().length > 0));
  if (!filled) return;
  const genre = storyGenreId(genreId);
  const olds = /* @__PURE__ */new Set();
  for (const title of titles) {
    const name = title.trim();
    if (!name) continue;
    olds.add(hashStoryPath(name, genre));
    olds.add(legacyHashStoryPath(name, genre));
    for (const old of legacyStoryPaths(name, genre)) olds.add(old);
  }
  for (const dir of [storySongDir(genre), storyRootDir(genre)]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file.endsWith(".tmp") || /^act-\d+\.json$/.test(file) || isPlaylistFileName(file)) continue;
      const full = join(dir, file);
      if (full === canon) continue;
      const row = readJson(full);
      if (!row?.pkg) continue;
      const rowId = String(row.songId || row.pkg.songId || "").trim();
      const rowTitle = String(row.title || "").trim();
      const rowArtist = coverArtistOf(String(row.pkg.sourceGenre || ""), String(row.pkg.sourceVocal || ""));
      if (songId && rowId && rowId !== songId) continue;
      if (songId && rowId === songId) {
        olds.add(full);
        continue;
      }
      if (!song || rowTitle !== song) continue;
      if (vocal && rowArtist && rowArtist !== vocal) continue;
      olds.add(full);
    }
  }
  for (const old of olds) {
    if (!old || old === canon || !existsSync(old)) continue;
    try {
      unlinkSync(old);
    } catch {
    }
  }
}
function migrateLiveLayout() {
  if (!LIVE) return;
  moveLiveFile(join(LIVE, "prefs", "__common.json"), prefCommonPath());
  const oldPrefs = join(LIVE, "prefs");
  if (existsSync(oldPrefs)) {
    for (const name of readdirSync(oldPrefs)) {
      if (!name.endsWith(".json")) continue;
      moveLiveFile(join(oldPrefs, name), join(LIVE, "\uC0AC\uC6A9\uC790\uC124\uC815", "\uC7A5\uB974", name));
    }
  }
  moveLiveFile(join(LIVE, "fill-job.json"), fillJobPath());
  moveLiveFile(join(LIVE, "meta.json"), metaPath());
  moveLiveFile(join(LIVE, "confirmed.json"), confirmedPath());
  moveLiveFile(join(LIVE, "links.json"), linksPath());
  moveLiveFile(join(LIVE, "row-locks.json"), rowLockPath());
  moveLiveFile(join(LIVE, "locks-cleared-once.json"), lockSweepPath());
  const oldOrig = join(LIVE, "originals");
  if (existsSync(oldOrig)) {
    for (const genre of readdirSync(oldOrig, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      for (const file of readdirSync(join(oldOrig, genre.name))) {
        if (file.endsWith(".json")) moveLiveFile(join(oldOrig, genre.name, file), join(LIVE, "\uC6D0\uACE1\uC815\uBCF4", genre.name, file));
      }
    }
  }
  const oldStories = join(LIVE, "stories");
  shiftStoryDir(oldStories, "your-story");
  shiftStoryDir(join(LIVE, "\uC0AC\uC5F0"), "your-story");
  shiftStoryDir(join(LIVE, "\uCEE4\uBC84"), "cover-reborn");
  const oldGenres = join(LIVE, "genres");
  if (existsSync(oldGenres)) {
    for (const genre of readdirSync(oldGenres, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      const epDir = join(oldGenres, genre.name, "ep");
      if (existsSync(epDir)) {
        for (const file of readdirSync(epDir)) {
          if (file.endsWith(".json")) moveLiveFile(join(epDir, file), join(LIVE, "\uACE1", genre.name, "ep", file));
        }
      }
      for (const name of readdirSync(join(oldGenres, genre.name))) {
        if (/^act-\d+\.json$/.test(name)) moveLiveFile(join(oldGenres, genre.name, name), join(LIVE, "\uACE1", genre.name, name));
      }
    }
  }
  const oldSongs = join(LIVE, "songs");
  if (existsSync(oldSongs)) {
    for (const genre of readdirSync(oldSongs, { withFileTypes: true })) {
      if (!genre.isDirectory() || genre.name.startsWith("_")) continue;
      for (const file of readdirSync(join(oldSongs, genre.name))) {
        if (file.endsWith(".json")) moveLiveFile(join(oldSongs, genre.name, file), join(LIVE, "\uACE1", genre.name, "ep", file));
      }
    }
  }
  const oldLists = join(LIVE, "playlists");
  if (existsSync(oldLists)) {
    for (const genre of readdirSync(oldLists, { withFileTypes: true })) {
      if (!genre.isDirectory()) continue;
      for (const file of readdirSync(join(oldLists, genre.name))) {
        const num = /^(\d+)\.json$/.exec(file);
        if (!num) continue;
        moveLiveFile(join(oldLists, genre.name, file), join(LIVE, "\uACE1", genre.name, `act-${Number(num[1])}.json`));
      }
    }
  }
  parkGenreSongs();
}
function parkGenreSongs() {
  if (!LIVE) return;
  for (const genre of ["your-story", "cover-reborn"]) {
    const root = storyRootDir(genre);
    const bin = storySongDir(genre);
    try {
      mkdirSync(bin, { recursive: true });
    } catch (err) {
      if (isReadOnlyFs(err)) return;
      throw err;
    }
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (!name.endsWith(".json") || name.endsWith(".tmp") || isPlaylistFileName(name)) continue;
      const from = join(root, name);
      let file = false;
      try {
        file = statSync(from).isFile();
      } catch {
        continue;
      }
      if (!file) continue;
      const row = readJson(from);
      if (String(row?.title || "").trim().startsWith("playlist:")) continue;
      moveLiveFile(from, join(bin, name));
    }
  }
}
function dropStoryFixtures(stories) {
  const out = {};
  for (const [key, value] of Object.entries(stories)) {
    const pkg = value?.pkg ?? null;
    if (isStoryFixture(key, pkg) || isStoryFixture(String(value?.title || ""), pkg)) continue;
    out[key] = value;
  }
  return out;
}
function readEncyclopedia() {
  migrateLiveLayout();
  const seed = readFileDump(SEED) ?? emptyEncyclopedia();
  const legacy = readFileDump(LEGACY);
  const packages = overlayPackages(
    overlayPackages(seed.packages, legacy?.packages ?? {}),
    readSongFiles(),
    true
  );
  const titles = { ...(legacy?.titles ?? seed.titles) };
  for (const row of Object.values(packages)) {
    const confirmed = String(row.pkg?.confirmedTitle || "").trim();
    const title = confirmed || row.title;
    if (!title) continue;
    titles[row.genreId] = { ...(titles[row.genreId] ?? {}), [row.ep]: title };
  }
  const metaFile = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const fillFile = readJson(fillJobPath()) ?? readJson(join(LIVE, "fill-job.json"));
  const metaLocks = {};
  for (const [key, value] of Object.entries(metaFile?.rowLocks ?? {})) {
    if (value === true || value === false) metaLocks[key] = value;
  }
  const fileLocks = readRowLockFile();
  const rowLocks = { ...metaLocks, ...(fileLocks ?? {}) };
  if (fileLocks === null && Object.keys(metaLocks).length > 0 && LIVE) {
    try {
      writeJson(rowLockPath(), metaLocks);
    } catch {
    }
  }
  const playlists = { ...(legacy?.playlists ?? seed.playlists), ...readPlaylistFiles() };
  const meta = applySongState({
    ...blankMeta(),
    ...(legacy?.meta ?? seed.meta),
    ...(metaFile ?? {}),
    rowLocks,
    youtube: { ...(metaFile?.youtube ?? {}), ...readSongLinks() },
    confirmed: liveConfirmed()
  });
  for (const [key, on] of Object.entries(meta.confirmed ?? {})) {
    if (on !== true) continue;
    const song = /^(.+):ep:(.+)$/.exec(key);
    if (song) {
      const row = packages[`${song[1]}:${song[2]}`];
      if (row) row.confirmed = true;
    }
    const act = /^(.+):act:(\d+)$/.exec(key);
    if (act) {
      const row = playlists[`${act[1]}:${act[2]}`];
      if (row) row.confirmed = true;
    }
  }
  return {
    packages,
    playlists,
    stories: dropStoryFixtures({ ...(legacy?.stories ?? seed.stories), ...readStoryFiles() }),
    prefs: { ...(legacy?.prefs ?? seed.prefs), ...readPrefFiles() },
    originals: { ...(legacy?.originals ?? seed.originals), ...readOriginalFiles() },
    titles,
    fillJob: fillFile === null ? legacy?.fillJob ?? seed.fillJob : fillFile,
    meta
  };
}
function keptSongState(prev) {
  const kept = {};
  if (prev?.confirmed === true) kept.confirmed = true;
  if (prev?.rowLocked === true || prev?.rowLocked === false) kept.rowLocked = prev.rowLocked;
  if (prev?.locks && typeof prev.locks === "object" && !Array.isArray(prev.locks)) kept.locks = prev.locks;
  return kept;
}
function freshSongState(genreId, ep, prev) {
  const fresh = readSongRecord(genreId, ep) ?? prev;
  const kept = keptSongState(fresh);
  const n = String(ep || "").replace(/\D/g, "").padStart(2, "0");
  void n;
  const disk = readRowLockFile();
  const unlocked = disk?.[`${genreId}:${n}`] === false || disk?.[`${genreId}:${ep}`] === false || fresh?.rowLocked === false;
  if (unlocked) {
    kept.rowLocked = false;
    kept.locks = {};
  }
  return kept;
}
function cleanLockMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true || value === false) out[key] = value;
  }
  return out;
}
function readSongStateFlags() {
  const rowLocks = {};
  const locks = {};
  const confirmed = {};
  for (const row of songFileRows()) {
    const item = row;
    if (!item.genreId || !item.ep) continue;
    if (item.rowLocked === true || item.rowLocked === false) rowLocks[`${item.genreId}:${item.ep}`] = item.rowLocked;
    const fieldLocks = cleanLockMap(item.locks);
    if (fieldLocks) locks[`single:${item.ep}:${item.genreId}`] = fieldLocks;
    if (item.confirmed === true || item.confirmed === false) confirmed[`${item.genreId}:ep:${item.ep}`] = item.confirmed;
  }
  return { rowLocks, locks, confirmed };
}
function applySongState(meta) {
  const song = readSongStateFlags();
  const legacy = readConfirmedFlags();
  for (const [key, value] of Object.entries(legacy)) {
    if (value !== true || song.confirmed[key] === true || song.confirmed[key] === false) continue;
    const match = /^(.+):ep:(.+)$/.exec(key);
    if (match && readSongRecord(match[1], match[2])) patchSongState(match[1], match[2], { confirmed: true });
    const actMatch = /^(.+):act:(\d+)$/.exec(key);
    if (actMatch) {
      const row = readJson(actPath(actMatch[1], Number(actMatch[2])));
      if (row?.pkg && row.confirmed !== true && row.confirmed !== false) patchActConfirmed(actMatch[1], Number(actMatch[2]), true);
    }
  }
  const confirmed = unionConfirmed(readSongConfirmFlags(), readActConfirmFlags(), readStoryConfirmFlags());
  const rowLocks = { ...(meta.rowLocks ?? {}), ...song.rowLocks };
  for (const [key, value] of Object.entries(meta.rowLocks ?? {})) {
    if (value === false) rowLocks[key] = false;
  }
  const locks = { ...(meta.locks ?? {}), ...song.locks };
  for (const [key, value] of Object.entries(rowLocks)) {
    if (value !== false) continue;
    const split = key.split(":");
    const genreId = split[0];
    const ep = split.slice(1).join(":");
    if (!genreId || !ep) continue;
    locks[`single:${ep}:${genreId}`] = {};
  }
  return {
    ...meta,
    locks,
    rowLocks,
    confirmed
  };
}
function patchSongState(genreId, ep, patch) {
  if (!LIVE || !genreId || !ep) return false;
  try {
    const path = songPath(genreId, ep);
    const prev = readSongRecord(genreId, ep);
    writeJson(path, {
      genreId,
      ep,
      title: prev?.title || "",
      ...(prev?.pkg ? { pkg: prev.pkg } : {}),
      ...keptSongState(prev),
      ...patch
    });
    forgetLegacySong(genreId, ep);
    return true;
  } catch {
    return false;
  }
}
function keepFilledText(_next, _prev, _keys, _skip) {}
function keepConfirmedText(_next, _prev, _keys) {}
function songIsConfirmed(_genreId, _ep, prev) {
  return prev?.confirmed === true;
}
function writeSong(genreId, ep, title, pkg, _force = false) {
  if (!LIVE) return false;
  const path = songPath(genreId, ep);
  const incomingStamps = readFieldStamps(pkg);
  const next = slim(pkg);
  const prev = readSongRecord(genreId, ep);
  const prevPkg = prev?.pkg ? normalizePackage({
    summary: prev.pkg.summary ?? "",
    confirmedTitle: prev.pkg.confirmedTitle ?? "",
    lyricsBlock: prev.pkg.lyricsBlock ?? "",
    sunoStyle: prev.pkg.sunoStyle ?? "",
    geminiPrompt: prev.pkg.geminiPrompt ?? "",
    youtubeTitle: prev.pkg.youtubeTitle ?? "",
    youtubeDescription: prev.pkg.youtubeDescription ?? "",
    fanLetter: prev.pkg.fanLetter ?? "",
    thumbUrl: prev.pkg.thumbUrl ?? "",
    thumbCast: asThumbCast(prev.pkg.thumbCast),
    youtubeUrl: String(prev.pkg.youtubeUrl || ""),
    mvUrl: String(prev.pkg.mvUrl || ""),
    sunoUrl: String(prev.pkg.sunoUrl || ""),
    audioLevel: String(prev.pkg.audioLevel || ""),
    audioAnalysis: String(prev.pkg.audioAnalysis || ""),
    ...(prev.pkg.ytPremium === true || prev.pkg.ytPremium === false ? { ytPremium: prev.pkg.ytPremium === true } : {}),
    ...(prev.pkg.mvPremium === true || prev.pkg.mvPremium === false ? { mvPremium: prev.pkg.mvPremium === true } : {}),
    userEdited: Array.isArray(prev.pkg.userEdited) ? prev.pkg.userEdited : void 0,
    fieldSavedAt: readFieldStamps(prev.pkg)
  }) : null;
  const nextPkg = normalizePackage(next);
  const sibling = lyricsMatchSibling(genreId, ep, String(nextPkg.lyricsBlock || ""));
  const prevHead = lyricHead(String(prevPkg?.lyricsBlock || ""));
  const nextHead = lyricHead(String(nextPkg.lyricsBlock || ""));
  const sameLyric = prevHead.length >= 48 && prevHead === nextHead;
  if (!_force && sibling && !sameLyric) {
    if (exactMarks(pkg).sunoExact || exactMarks(pkg).levelExact || exactMarks(pkg).analysisExact) sealShownExact(path, pkg, { genreId, ep });
    return false;
  }
  if (!_force && hasPageBody(nextPkg) && !canKeepPackage(genreId, ep, prevPkg, nextPkg) && !sameLyric) {
    if (exactMarks(pkg).sunoExact || exactMarks(pkg).levelExact || exactMarks(pkg).analysisExact) sealShownExact(path, pkg, { genreId, ep });
    return false;
  }
  const prevOk = Boolean(prevPkg && packageFitsSong(genreId, ep, prevPkg));
  const merged = _force ? nextPkg : prevPkg && prevOk ? keepUserEdits(prevPkg, nextPkg) : nextPkg;
  const keptYt = prev?.pkg?.ytPremium;
  const keptMv = prev?.pkg?.mvPremium;
  if (merged.ytPremium !== true && merged.ytPremium !== false && (keptYt === true || keptYt === false)) merged.ytPremium = keptYt;
  if (merged.mvPremium !== true && merged.mvPremium !== false && (keptMv === true || keptMv === false)) merged.mvPremium = keptMv;
  if (prevPkg && hasPageBody(prevPkg) && !hasPageBody(merged)) return false;
  const marks = exactMarks(pkg);
  applyExactLink(merged, marks);
  const nextStamps = { ...readFieldStamps(prevPkg), ...incomingStamps };
  const nowMs = Date.now();
  if (marks.sunoExact) {
    const prior = Date.parse(nextStamps.sunoUrl || "") || 0;
    nextStamps.sunoUrl = new Date(Math.max(nowMs, prior + 1)).toISOString();
  }
  if (marks.levelExact) {
    const prior = Date.parse(nextStamps.audioLevel || "") || 0;
    nextStamps.audioLevel = new Date(Math.max(nowMs, prior + 1)).toISOString();
  }
  if (marks.analysisExact) {
    const prior = Date.parse(nextStamps.audioAnalysis || "") || 0;
    nextStamps.audioAnalysis = new Date(Math.max(nowMs, prior + 1)).toISOString();
  }
  const guarded = mergeLatestBody(
    prevPkg ? { ...prevPkg, fieldSavedAt: readFieldStamps(prevPkg) } : null,
    { ...merged, sunoExact: marks.sunoExact, levelExact: marks.levelExact, analysisExact: marks.analysisExact, fieldSavedAt: nextStamps }
  );
  if (marks.sunoExact) guarded.sunoUrl = marks.sunoUrl.trim();
  if (marks.levelExact) guarded.audioLevel = marks.audioLevel.trim();
  if (marks.analysisExact) guarded.audioAnalysis = marks.audioAnalysis.trim();
  delete guarded.sunoExact;
  delete guarded.levelExact;
  delete guarded.analysisExact;
  if (songIsConfirmed(genreId, ep, prev) && prevPkg) {
    const watch = userSavedKeySet(pkg);
    const keptKeys = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter"].filter((key) => !watch.has(key));
    keepConfirmedText(guarded, prevPkg, keptKeys);
  }
  sealShownWrite(guarded, path, pkg);
  const wroteFile = writeJson(path, {
    genreId,
    ep,
    title: title || prev?.title || "",
    pkg: guarded,
    ...freshSongState(genreId, ep, prev)
  });
  forgetLegacySong(genreId, ep);
  if (!wroteFile) return false;
  if (_force) {
    const watch = userSavedKeySet(pkg);
    if (!watch.size) return true;
    const keys = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter"];
    const landed = (pkg2) => {
      if (!pkg2) return false;
      const check = keys.filter((key) => watch.has(key));
      return check.every((key) => String(pkg2?.[key] ?? "").trim() === String(guarded[key] ?? "").trim());
    };
    if (landed(readSongRecord(genreId, ep)?.pkg)) return true;
    if (!writeJson(path, { genreId, ep, title: title || prev?.title || "", pkg: guarded, ...freshSongState(genreId, ep, prev) })) return false;
    return landed(readSongRecord(genreId, ep)?.pkg);
  }
  return true;
}
function deleteEncSong(genreId, ep) {
  if (!LIVE || !genreId || !ep) return;
  for (const path of [songPath(genreId, ep), ...legacySongPaths(genreId, ep)]) {
    if (existsSync(path)) unlinkSync(path);
  }
}
function forceEncPackage(genreId, ep, title, pkg, fresh = false) {
  if (!LIVE) return null;
  const path = songPath(genreId, ep);
  const prev = readSongRecord(genreId, ep);
  let next = slim(pkg);
  const prevPkg = prev?.pkg;
  if (fresh) next = stampChangedFields(prevPkg ?? null, next, (/* @__PURE__ */new Date()).toISOString(), true);
  applyExactLink(next, exactMarks(pkg));
  const marks = exactMarks(pkg);
  const blankFields = pkg.blankFields;
  const blanks = new Set(Array.isArray(blankFields) ? blankFields.filter((key) => typeof key === "string") : []);
  const guarded = mergeLatestBody(
    prevPkg ? prevPkg : null,
    { ...next, sunoExact: marks.sunoExact, levelExact: marks.levelExact, analysisExact: marks.analysisExact },
    blanks
  );
  if (marks.sunoExact) guarded.sunoUrl = marks.sunoUrl.trim();
  if (marks.levelExact) guarded.audioLevel = marks.audioLevel.trim();
  if (marks.analysisExact) guarded.audioAnalysis = marks.audioAnalysis.trim();
  delete guarded.sunoExact;
  delete guarded.levelExact;
  delete guarded.analysisExact;
  if (songIsConfirmed(genreId, ep, prev)) keepConfirmedText(guarded, prevPkg, ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter"]);
  sealShownWrite(guarded, path, pkg);
  writeJson(path, { genreId, ep, title, pkg: guarded, ...freshSongState(genreId, ep, prev) });
  forgetLegacySong(genreId, ep);
  return guarded;
}
function putEncPackage(genreId, ep, title, pkg) {
  putEncMany([{ kind: "single", genreId, ep, title, pkg }]);
}
function putEncPlaylist(genreId, act, title, pkg) {
  putEncMany([{ kind: "playlist", genreId, act, title, pkg }]);
}
function putEncMany(rows) {
  const written = [];
  const kept = [];
  if (!rows.length || !LIVE) return { written, kept };
  for (const row of rows) {
    if (row.kind === "single" && row.ep) {
      const key = `${row.genreId}:${row.ep}`;
      const diskPrev = readSongRecord(row.genreId, row.ep);
      const prev = diskPrev?.pkg;
      const next = slim(row.pkg);
      const prevNorm = prev ? normalizePackage(prev) : null;
      const nextNorm = normalizePackage(next);
      const n = String(row.ep).replace(/\D/g, "").padStart(2, "0");
      const wantedSuno = String(nextNorm.sunoUrl || "").trim();
      if (prevNorm && hasPageBody(prevNorm) && !hasPageBody(nextNorm)) {
        if (!landSunoFile("song", row.genreId, n, wantedSuno)) continue;
        if (httpAddress(wantedSuno)) written.push(key);else
        kept.push(key);
        continue;
      }
      const open = Boolean(row.rewrite) || slotRewriteOpen(row.genreId, row.ep);
      const pinEmptyLink = () => {
        const disk = readSongRecord(row.genreId, n)?.pkg;
        const yt = String(nextNorm.youtubeUrl || "").trim();
        const mv = String(nextNorm.mvUrl || "").trim();
        if (yt && !String(disk?.youtubeUrl || "").trim()) putSongLink(row.genreId, n, yt, "youtubeUrl");
        if (mv && !String(disk?.mvUrl || "").trim()) putSongLink(row.genreId, n, mv, "mvUrl");
      };
      let wroteBody = false;
      const hasExact = exactMarks(row.pkg).sunoExact || exactMarks(row.pkg).levelExact || exactMarks(row.pkg).analysisExact;
      if (!row.rewrite && prevNorm && !shouldReplaceStudio(prevNorm, nextNorm, open)) {
        pinEmptyLink();
      } else if (writeSong(row.genreId, row.ep, row.title, next, Boolean(row.rewrite))) {
        wroteBody = true;
      } else if (prevNorm && hasPageBody(prevNorm)) {
        pinEmptyLink();
      }
      if (!landSunoFile("song", row.genreId, n, wantedSuno, hasExact) && !hasExact) continue;
      const sealed = hasExact ? sealShownExact(songPath(row.genreId, n), row.pkg, { genreId: row.genreId, ep: n }) : true;
      if (wroteBody || httpAddress(wantedSuno) || hasExact && sealed) written.push(key);else
      if (!row.rewrite && prevNorm && hasPageBody(prevNorm)) kept.push(key);
    } else if (row.kind === "playlist") {
      const act = row.act ?? 1;
      const prev = readJson(actPath(row.genreId, act));
      const pkg = slim(row.pkg);
      const prevPkg = prev?.pkg;
      const keptYt = prevPkg?.ytPremium;
      const keptMv = prevPkg?.mvPremium;
      if (pkg.ytPremium !== true && pkg.ytPremium !== false && (keptYt === true || keptYt === false)) pkg.ytPremium = keptYt;
      if (pkg.mvPremium !== true && pkg.mvPremium !== false && (keptMv === true || keptMv === false)) pkg.mvPremium = keptMv;
      if (prevPkg && !row.rewrite) {
        const next = pkg;
        for (const key of ACT_RESULT_KEYS) {
          if (!resultText(next, key) && resultText(prevPkg, key)) next[key] = resultText(prevPkg, key);
        }
      }
      keepSavedSuno(pkg, String(readJson(actPath(row.genreId, act))?.pkg?.sunoUrl || ""));
      keepSavedLevel(pkg, readPkgField(actPath(row.genreId, act), "audioLevel"));
      keepSavedAnalysis(pkg, readPkgField(actPath(row.genreId, act), "audioAnalysis"));
      const actMarks = exactMarks(row.pkg);
      applyExactLink(pkg, actMarks);
      const actBlanks = new Set(
        Array.isArray(row.pkg.blankFields) ? row.pkg.blankFields.filter((key) => typeof key === "string") : []
      );
      const guardedAct = mergeLatestBody(prevPkg ?? null, { ...pkg, sunoExact: actMarks.sunoExact, levelExact: actMarks.levelExact, analysisExact: actMarks.analysisExact }, actBlanks);
      if (actMarks.sunoExact) {
        const raw = actMarks.sunoUrl.trim();
        const url = raw ? httpAddress(raw) : "";
        if (!raw || url) guardedAct.sunoUrl = url;
      }
      if (actMarks.levelExact) {
        const raw = actMarks.audioLevel.trim();
        const level = raw ? cleanShownValue("audioLevel", raw) : "";
        if (!raw || level) guardedAct.audioLevel = level;
      }
      if (actMarks.analysisExact) {
        const raw = actMarks.audioAnalysis.trim();
        const analysis = raw ? cleanShownValue("audioAnalysis", raw) : "";
        if (!raw || analysis) guardedAct.audioAnalysis = analysis;
      }
      delete guardedAct.sunoExact;
      delete guardedAct.levelExact;
      delete guardedAct.analysisExact;
      sealShownWrite(guardedAct, actPath(row.genreId, act), row.pkg);
      const wantedSuno = String(guardedAct.sunoUrl || "").trim();
      const songsReady = Boolean(actSongsConfirmed(row.genreId, act));
      const wroteAct = writeJson(actPath(row.genreId, act), {
        genreId: row.genreId,
        act,
        title: row.title,
        pkg: guardedAct,
        ...(prev?.confirmed === true ? { confirmed: true } : {}),
        ...(prev?.activated === true || songsReady ? { activated: true } : {})
      });
      forgetLegacyAct(row.genreId, act);
      const actExact = exactMarks(row.pkg);
      const actHasExact = actExact.sunoExact || actExact.levelExact || actExact.analysisExact;
      if (!landSunoFile("act", row.genreId, act, wantedSuno, actHasExact) && !actHasExact) continue;
      const actSealed = actHasExact ? sealShownExact(actPath(row.genreId, act), row.pkg, { genreId: row.genreId, act }) : true;
      if (wroteAct || httpAddress(wantedSuno) || actHasExact && actSealed) written.push(`${row.genreId}:act:${act}`);else
      if (!row.rewrite) kept.push(`${row.genreId}:act:${act}`);
    }
  }
  return { written, kept };
}
function readStoryUpdatedAt(title, genreId = "your-story") {
  if (!LIVE || !title.trim()) return 0;
  return storySavedAt(title, genreId);
}
function deleteEncStory(title, genreId = "your-story") {
  const name = title.trim();
  if (!LIVE || !name) return;
  for (const path of storyLookupPaths(name, genreId)) {
    if (!existsSync(path)) continue;
    try {
      unlinkSync(path);
    } catch {
    }
  }
}
function putEncStory(title, pkg, genreId = "your-story") {
  const display = title.trim();
  const songId = String(pkg.songId || "").trim();
  const storeId = songId || display;
  if (!LIVE || !storeId) return false;
  if (isStoryFixture(storeId, { ...pkg, songId }) || isStoryFixture(display, { ...pkg, songId })) return false;
  const stamped = Number(pkg.registeredAt) || 0;
  const clean = { ...pkg };
  delete clean.registeredAt;
  if (songId) clean.songId = songId;
  const song = storySongLabel(display, clean) || storySongLabel(storeId, clean) || (!isStoryStoreId(display) && !display.startsWith("playlist:") ? display.replace(/^cover:/, "") : "");
  const vocal = storyGenreId(genreId) === "cover-reborn" ? coverArtistOf(String(clean.sourceGenre || ""), String(clean.sourceVocal || "")) : "";
  const path = storeId.startsWith("playlist:") ? storyPath(storeId, genreId) : namedStoryPath(song || display, genreId, vocal);
  if (!path) return false;
  if (storeId.startsWith("playlist:")) {
    const wrap = pkg;
    if (!Array.isArray(wrap.songs) || !wrap.pkg) return false;
    const exact2 = exactMarks(wrap.pkg);
    applyExactLink(wrap.pkg, exact2);
    delete wrap.pkg.sunoExact;
    delete wrap.pkg.levelExact;
    keepDiskLink(path, wrap.pkg, exact2);
    sealDiskMedia(wrap.pkg, path, wrap.pkg);
    sealPremiumFlags(wrap.pkg, path, wrap.pkg);
    writeJson(path, {
      title: storeId,
      id: typeof wrap.id === "string" ? wrap.id : storeId.slice("playlist:".length),
      theme: typeof wrap.theme === "string" ? wrap.theme : "",
      songs: wrap.songs.filter((item) => typeof item === "string"),
      pkg: wrap.pkg
    });
    if (exact2.sunoExact) {
      const wanted = exact2.sunoUrl.trim() ? httpAddress(exact2.sunoUrl) : "";
      if (exact2.sunoUrl.trim() && !wanted || readPkgField(path, "sunoUrl") !== wanted) {
        if (!assignPkgField(path, "sunoUrl", wanted, {})) return false;
      }
    } else {
      const listSuno = httpAddress(wrap.pkg.sunoUrl);
      if (listSuno && readPkgField(path, "sunoUrl") !== listSuno && !patchPkgStringField(path, "sunoUrl", listSuno)) return false;
      if (listSuno && readPkgField(path, "sunoUrl") !== listSuno) return false;
    }
    if (exact2.levelExact) {
      const wanted = exact2.audioLevel.trim() ? cleanShownValue("audioLevel", exact2.audioLevel) : "";
      if (exact2.audioLevel.trim() && !wanted || readPkgField(path, "audioLevel") !== wanted) {
        if (!assignPkgField(path, "audioLevel", wanted, {})) return false;
      }
    }
    forgetLegacyStory(path, [storeId], genreId);
    return existsSync(path);
  }
  const looked = [...new Set([display, storeId, song].map((item) => item.trim()).filter(Boolean))];
  const rows = [...new Set(looked.flatMap((item) => storyLookupPaths(item, genreId, vocal)))].map((item) => readJson(item)).filter((row) => Boolean(row?.pkg));
  let prev = rows[0] ?? null;
  for (const row of rows.slice(1)) {
    if (!prev?.pkg) {
      prev = row;
      continue;
    }
    prev = {
      ...prev,
      pkg: keepStoryText(prev.pkg, row.pkg),
      confirmed: prev.confirmed === true || row.confirmed === true,
      registeredAt: Number(prev.registeredAt) && Number(row.registeredAt) ? Math.min(Number(prev.registeredAt), Number(row.registeredAt)) : Number(prev.registeredAt) || Number(row.registeredAt) || void 0
    };
  }
  const prevAt = Number(prev?.registeredAt) || 0;
  const nextAt = stamped || 0;
  const registeredAt = prevAt && nextAt ? Math.min(prevAt, nextAt) : prevAt || nextAt || Date.now();
  const exact = exactMarks(clean);
  const kept = keepStoryText(prev?.pkg, clean);
  applyExactLink(kept, exact);
  keepDiskLink(path, kept, exact);
  sealDiskMedia(kept, path, clean);
  sealPremiumFlags(kept, path, clean);
  const wantedSuno = httpAddress(kept.sunoUrl);
  const shellTitle = song || (!isStoryStoreId(display) ? display : "") || storeId;
  if (!existsSync(path) && !writeJson(path, { title: shellTitle, ...(songId ? { songId } : {}), pkg: {} })) return false;
  writeJson(path, {
    title: shellTitle,
    ...(songId ? { songId } : {}),
    pkg: slim(kept),
    registeredAt,
    ...(prev?.confirmed === true ? { confirmed: true } : {})
  });
  if (exact.sunoExact) {
    const wanted = exact.sunoUrl.trim() ? httpAddress(exact.sunoUrl) : "";
    if (exact.sunoUrl.trim() && !wanted) return false;
    if (readPkgField(path, "sunoUrl") !== wanted && !assignPkgField(path, "sunoUrl", wanted, {})) return false;
    if (readPkgField(path, "sunoUrl") !== wanted) return false;
  } else if (wantedSuno && readPkgField(path, "sunoUrl") !== wantedSuno && !patchPkgStringField(path, "sunoUrl", wantedSuno)) return false;else
  if (wantedSuno && readPkgField(path, "sunoUrl") !== wantedSuno) return false;
  if (exact.levelExact) {
    const wanted = exact.audioLevel.trim() ? cleanShownValue("audioLevel", exact.audioLevel) : "";
    if (exact.audioLevel.trim() && !wanted) return false;
    if (readPkgField(path, "audioLevel") !== wanted && !assignPkgField(path, "audioLevel", wanted, {})) return false;
    if (readPkgField(path, "audioLevel") !== wanted) return false;
  }
  forgetLegacyStory(path, [display, storeId, song], genreId, song, songId, vocal);
  return existsSync(path);
}
function pinStorySuno(title, genreId = "your-story", url = "") {
  const clean = httpAddress(url);
  const name = title.trim();
  if (!LIVE || !clean || !name) return false;
  const files = storyLookupPaths(name, genreId).filter((path, index, list) => existsSync(path) && list.indexOf(path) === index);
  if (!files.length) return false;
  let ok = false;
  for (const path of files) {
    const current = readPkgField(path, "sunoUrl");
    if (current === clean) {
      ok = true;
      continue;
    }
    if (current) continue;
    if (patchPkgStringField(path, "sunoUrl", clean)) ok = true;else
    if (storeSunoUrl(path, clean, readJson(path), {})) ok = true;
  }
  return ok;
}
function readEncPref(genreId) {
  if (!LIVE || !genreId) return null;
  const next = genreId === "__common" ? prefCommonPath() : prefGenrePath(genreId);
  return readJson(next) ?? readJson(join(LIVE, "prefs", `${safePart(genreId)}.json`));
}
function putEncPref(genreId, pref) {
  if (!LIVE) return;
  const next = genreId === "__common" ? prefCommonPath() : prefGenrePath(genreId);
  writeJson(next, pref);
  const old = join(LIVE, "prefs", `${safePart(genreId)}.json`);
  if (existsSync(old)) unlinkSync(old);
}
function putEncOriginal(genreId, song) {
  if (!LIVE) return;
  writeJson(originalPath(genreId, song.n), song);
  const old = join(LIVE, "originals", safePart(genreId), `${safePart(song.n)}.json`);
  if (existsSync(old)) unlinkSync(old);
}
function putEncFillJob(job) {
  if (!LIVE) return;
  writeJson(fillJobPath(), job);
}
function readRowLockFile() {
  const path = existsSync(rowLockPath()) ? rowLockPath() : join(LIVE, "row-locks.json");
  if (!LIVE || !existsSync(path)) return null;
  const raw = readJson(path);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true || value === false) out[key] = value;
  }
  return out;
}
function writeRowLockFile(genreId, ep, on) {
  if (!LIVE || !genreId || !ep) return {};
  const key = `${genreId}:${ep}`;
  const next = readRowLockFile() ?? {};
  next[key] = on;
  writeJson(rowLockPath(), next);
  return next;
}
function readSongLinks() {
  const raw = readJson(linksPath()) ?? readJson(join(LIVE, "links.json"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
function jsonStringEnd(raw, from) {
  if (raw[from] !== '"') return -1;
  for (let i = from + 1; i < raw.length; i += 1) {
    if (raw[i] === "\\") {
      i += 1;
      continue;
    }
    if (raw[i] === '"') return i + 1;
  }
  return -1;
}
function keyStringSpan(raw, field) {
  const skip = nestedObjectSpan(raw, "fieldSavedAt");
  const token = `"${field}":`;
  let keyAt = -1;
  let from = 0;
  while (from < raw.length) {
    const at = raw.indexOf(token, from);
    if (at < 0) break;
    if (skip && at >= skip.start && at < skip.end) {
      from = skip.end;
      continue;
    }
    if (keyAt >= 0) return null;
    keyAt = at;
    from = at + token.length;
  }
  if (keyAt < 0) return null;
  let valueAt = keyAt + token.length;
  while (raw[valueAt] === " " || raw[valueAt] === "\n" || raw[valueAt] === "\r" || raw[valueAt] === "	") valueAt += 1;
  if (raw[valueAt] !== '"') return null;
  const valueEnd = jsonStringEnd(raw, valueAt);
  if (valueEnd < 0) return null;
  return { valueAt, valueEnd };
}
function nestedObjectSpan(raw, field) {
  const token = `"${field}":`;
  const at = raw.indexOf(token);
  if (at < 0) return null;
  let i = at + token.length;
  while (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "	") i += 1;
  if (raw[i] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let pos = i; pos < raw.length; pos += 1) {
    const ch = raw[pos];
    if (inString) {
      if (escaped) escaped = false;else
      if (ch === "\\") escaped = true;else
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;else
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start: at, end: pos + 1 };
    }
  }
  return null;
}
function patchPkgStringField(path, field, value) {
  if (!field || !existsSync(path)) return false;
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  let before;
  try {
    before = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!before.pkg || typeof before.pkg !== "object") return false;
  const clean = value.trim();
  let next = "";
  const hit = keyStringSpan(raw, field);
  if (hit) {
    next = raw.slice(0, hit.valueAt) + JSON.stringify(clean) + raw.slice(hit.valueEnd);
  } else if (Object.prototype.hasOwnProperty.call(before.pkg, field)) {
    return false;
  } else {
    const anchor = keyStringSpan(raw, "youtubeUrl");
    const piece = `,"${field}":${JSON.stringify(clean)}`;
    if (anchor) next = raw.slice(0, anchor.valueEnd) + piece + raw.slice(anchor.valueEnd);else
    {
      const mark = '"pkg":{';
      const pkgAt = raw.indexOf(mark);
      if (pkgAt < 0 || raw.indexOf(mark, pkgAt + mark.length) >= 0) return false;
      next = raw.slice(0, pkgAt + mark.length) + `"${field}":${JSON.stringify(clean)},` + raw.slice(pkgAt + mark.length);
    }
  }
  let after;
  try {
    after = JSON.parse(next);
  } catch {
    return false;
  }
  if (String(after?.pkg?.[field] ?? "").trim() !== clean) return false;
  const prevPkg = before.pkg;
  const nextPkg = after.pkg && typeof after.pkg === "object" ? after.pkg : {};
  const keys = /* @__PURE__ */new Set([...Object.keys(prevPkg), ...Object.keys(nextPkg)]);
  for (const key of keys) {
    if (key === field) continue;
    if (JSON.stringify(prevPkg[key]) !== JSON.stringify(nextPkg[key])) return false;
  }
  const { pkg: _beforePkg, ...beforeRest } = before;
  const { pkg: _afterPkg, ...afterRest } = after;
  if (JSON.stringify(beforeRest) !== JSON.stringify(afterRest)) return false;
  try {
    writeFileSync(path, next);
  } catch {
    return false;
  }
  return String(readJson(path)?.pkg?.[field] ?? "").trim() === clean;
}
function httpAddress(value) {
  const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const hit = text.match(/https?:\/\/[^\s<>"']+/i);
  const url = hit ? hit[0].replace(/[),.;]+$/g, "").slice(0, 500) : "";
  return /^https?:\/\//i.test(url) ? url : "";
}
function readPkgField(path, field) {
  return String(readJson(path)?.pkg?.[field] ?? "").trim();
}
function landSunoFile(kind, genreId, id, wanted, replace = false) {
  const url = httpAddress(wanted);
  if (!url) return true;
  const path = kind === "song" ? songPath(genreId, String(id)) : actPath(genreId, Number(id));
  const current = readPkgField(path, "sunoUrl");
  if (current === url) return true;
  if (!replace) return true;
  const ok = kind === "song" ? putSongLink(genreId, String(id), url, "sunoUrl") === true : putActLink(genreId, Number(id), url, "sunoUrl") === true;
  return ok && readPkgField(path, "sunoUrl") === url;
}
function pinEmptySunoFile(kind, genreId, id, wanted) {
  const url = httpAddress(wanted);
  if (!url) return false;
  const path = kind === "song" ? songPath(genreId, String(id)) : actPath(genreId, Number(id));
  const current = readPkgField(path, "sunoUrl");
  if (current === url) return true;
  if (current) return false;
  return landSunoFile(kind, genreId, id, url, true);
}
const SHOWN_KEYS = /* @__PURE__ */new Set([
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
"thumbUrl",
"sourceLyrics",
"sourceVocal",
"sourceGenre"]
);
function cleanShownValue(key, value) {
  const text = String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!text) return "";
  if (key === "sunoUrl" || key === "youtubeUrl" || key === "mvUrl" || key === "audioLevel" || key === "audioAnalysis") {
    return text.length > 2000 ? text.slice(0, 2000) : text;
  }
  return text.length > 1e5 ? text.slice(0, 1e5) : text;
}
function readShownFields(path) {
  const pkg = readJson(path)?.pkg;
  const fields = {};
  if (!pkg || typeof pkg !== "object") return fields;
  for (const key of SHOWN_KEYS) {
    if (typeof pkg[key] === "string") fields[key] = pkg[key];
  }
  return fields;
}
function assignPkgField(path, field, value, shell) {
  const prev = readJson(path) ?? {};
  const prevPkg = prev.pkg && typeof prev.pkg === "object" ? { ...prev.pkg } : {};
  if (String(prevPkg[field] ?? "") === value) return true;
  const nextPkg = { ...prevPkg, [field]: value };
  if (!writeJson(path, { ...shell, ...prev, pkg: nextPkg })) return false;
  const got = readJson(path);
  if (String(got?.pkg?.[field] ?? "") !== value) return false;
  const nowPkg = got?.pkg && typeof got.pkg === "object" ? got.pkg : {};
  for (const key of /* @__PURE__ */new Set([...Object.keys(prevPkg), ...Object.keys(nowPkg)])) {
    if (key === field) continue;
    if (JSON.stringify(prevPkg[key]) !== JSON.stringify(nowPkg[key])) return false;
  }
  for (const key of Object.keys(prev)) {
    if (key === "pkg") continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(got?.[key])) return false;
  }
  return true;
}
function shownFileExists(path) {
  return Boolean(path && existsSync(path));
}
function shownFileUpdatedAt(path) {
  try {
    if (!path || !existsSync(path)) return 0;
    return Math.round(statSync(path).mtimeMs) || 0;
  } catch {
    return 0;
  }
}
function writeShownFields(path, incoming, shell = {}, allowCreate = true, allowBlank = false) {
  diskDenied = false;
  const wanted = {};
  for (const [key, value] of Object.entries(incoming || {})) {
    if (!SHOWN_KEYS.has(key)) continue;
    const clean = cleanShownValue(key, value);
    if (!clean) {
      if (allowBlank && String(value ?? "").trim() === "") wanted[key] = "";
      continue;
    }
    if (existsSync(path)) {
      const prevText = readPkgField(path, key);
      if (prevText && prevText !== clean && isStubResultToken(clean) && prevText.length > clean.length) continue;
    }
    wanted[key] = clean;
  }
  const missing = [];
  if (!path) return { ok: false, fields: {}, missing: Object.keys(wanted), error: "path" };
  if (!Object.keys(wanted).length) return { ok: true, fields: readShownFields(path), missing, error: "" };
  if (!existsSync(path)) {
    if (!allowCreate) return { ok: false, fields: {}, missing: Object.keys(wanted), error: "path" };
    if (!writeJson(path, { ...shell, pkg: { ...wanted } })) {
      return { ok: false, fields: {}, missing: Object.keys(wanted), error: "write" };
    }
  } else if (!readJson(path)?.pkg || typeof readJson(path)?.pkg !== "object") {
    const prev = readJson(path) ?? {};
    if (!writeJson(path, { ...shell, ...prev, pkg: {} })) {
      return { ok: false, fields: readShownFields(path), missing: Object.keys(wanted), error: "write" };
    }
  }
  for (const [key, value] of Object.entries(wanted)) {
    if (readPkgField(path, key) === value) continue;
    if (patchPkgStringField(path, key, value)) continue;
    assignPkgField(path, key, value, shell);
    if (readPkgField(path, key) !== value) missing.push(key);
  }
  const fields = readShownFields(path);
  for (const [key, value] of Object.entries(wanted)) {
    if (fields[key] === value || cleanShownValue(key, fields[key]) === value) continue;
    if (!missing.includes(key)) missing.push(key);
  }
  if (missing.length === 0) stampShownFields(path, Object.keys(wanted).filter((key) => fields[key] === wanted[key] || cleanShownValue(key, fields[key]) === wanted[key]));
  return { ok: missing.length === 0, fields, missing, error: missing.length ? diskDenied ? "write" : "read" : "" };
}
function stampShownFields(path, keys) {
  if (!path || !keys.length || !existsSync(path)) return;
  const row = readJson(path);
  if (!row?.pkg || typeof row.pkg !== "object") return;
  const stamps = { ...readFieldStamps(row.pkg) };
  const now = (/* @__PURE__ */new Date()).toISOString();
  let changed = false;
  for (const key of keys) {
    if (!key) continue;
    stamps[key] = now;
    changed = true;
  }
  if (!changed) return;
  row.pkg.fieldSavedAt = stamps;
  writeJson(path, row);
}
function writeExactShown(path, patch, shell = {}) {
  if (!path) return { ok: false, sunoUrl: "", audioLevel: "", audioAnalysis: "", error: "path" };
  if (!existsSync(path)) {
    if (!writeJson(path, { ...shell, pkg: { audioAnalysis: "", audioLevel: "" } })) return { ok: false, sunoUrl: "", audioLevel: "", audioAnalysis: "", error: "write" };
  }
  const incoming = {};
  let fault = "";
  if (patch.sunoUrl !== void 0) incoming.sunoUrl = String(patch.sunoUrl || "").trim();
  if (patch.audioLevel !== void 0) incoming.audioLevel = String(patch.audioLevel || "").trim();
  if (patch.audioAnalysis !== void 0) incoming.audioAnalysis = String(patch.audioAnalysis || "").trim();
  if (!Object.keys(incoming).length) {
    return { ok: false, sunoUrl: readPkgField(path, "sunoUrl"), audioLevel: readPkgField(path, "audioLevel"), audioAnalysis: readPkgField(path, "audioAnalysis"), error: fault || "empty" };
  }
  const saved = writeShownFields(path, incoming, shell, true, true);
  return {
    ok: saved.ok && !fault,
    sunoUrl: String(saved.fields.sunoUrl || ""),
    audioLevel: String(saved.fields.audioLevel || ""),
    audioAnalysis: String(saved.fields.audioAnalysis || ""),
    error: !saved.ok ? saved.error || (saved.missing || []).join(",") || "read" : fault
  };
}
function existingStoryPath(title, genreId = "your-story", vocal = "") {
  const name = title.trim();
  if (!name || !LIVE) return "";
  const genre = genreId === "cover-reborn" ? "cover-reborn" : genreId || "your-story";
  return storyLookupPaths(name, genre, vocal).find((path) => existsSync(path)) || "";
}
function ensureEmptyShownFile(path, shell) {
  if (!path) return false;
  if (existsSync(path)) return true;
  return writeJson(path, { ...shell, pkg: {} });
}
function shownFilePath(kind, genreId, ep, act, title, vocal = "") {
  if (!LIVE) return "";
  if (kind === "song") return genreId && ep ? songPath(genreId, ep) : "";
  if (kind === "act") return genreId && act ? actPath(genreId, act) : "";
  const name = title.trim();
  if (!name) return "";
  const genre = kind === "cover" ? "cover-reborn" : genreId === "cover-reborn" ? "cover-reborn" : genreId || "your-story";
  const mapped = boundStoryAbs(genre, name);
  if (mapped) return mapped;
  const artist = kind === "cover" ? vocal.trim() : "";
  if (name.startsWith("playlist:")) {
    const named = playlistDiskPath(name, genre);
    const hashed = hashStoryPath(name, genre);
    const legacy = legacyHashStoryPath(name, genre);
    if (existsSync(named)) return named;
    if (existsSync(hashed)) return hashed;
    if (existsSync(legacy)) return legacy;
    return named;
  }
  const named = namedStoryPath(name, genre, artist);
  if (named && existsSync(named)) return named;
  if (named && artist) return named;
  const found = existingStoryPath(name, genre, artist);
  if (found && !isHashStoryFile(found)) return found;
  if (named && !isStoryStoreId(name)) return named;
  return found || "";
}
let lastSunoFault = "";
function storeSunoUrl(path, clean, prev, shell) {
  const url = String(clean || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!url) {
    if (String(clean || "").trim()) {
      lastSunoFault = "url";
      return false;
    }
    return true;
  }
  lastSunoFault = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (readPkgField(path, "sunoUrl") === url) return true;
      if (existsSync(path) && patchPkgStringField(path, "sunoUrl", url)) return true;
      if (existsSync(path) && !readPkgField(path, "sunoUrl") && pinEmptyJsonField(path, "sunoUrl", url)) return true;
      const base = (prev && typeof prev === "object" ? prev : readJson(path)) ?? {};
      const prevPkg = base.pkg && typeof base.pkg === "object" ? base.pkg : {};
      const pkg = { ...prevPkg, sunoUrl: url };
      if (!writeJson(path, { ...base, ...shell, pkg })) {
        lastSunoFault = "write";
        continue;
      }
      if (readPkgField(path, "sunoUrl") === url) return true;
      lastSunoFault = "read";
    } catch (err) {
      lastSunoFault = isReadOnlyFs(err) ? "write" : "throw";
    }
  }
  return readPkgField(path, "sunoUrl") === url;
}
function keepDiskLink(_path, _pkg, _exact) {}
function exactMarks(pkg) {
  const raw = pkg;
  return {
    sunoExact: raw.sunoExact === true,
    levelExact: raw.levelExact === true,
    analysisExact: raw.analysisExact === true,
    sunoUrl: String(raw.sunoUrl ?? ""),
    audioLevel: String(raw.audioLevel ?? ""),
    audioAnalysis: String(raw.audioAnalysis ?? "")
  };
}
function applyExactLink(merged, exact) {
  if (exact.sunoExact) merged.sunoUrl = exact.sunoUrl.trim();
  if (exact.levelExact) merged.audioLevel = exact.audioLevel.trim();
  if (exact.analysisExact) merged.audioAnalysis = exact.audioAnalysis.trim();
  return merged;
}
function sealShownExact(path, pkg, shell) {
  const exact = exactMarks(pkg);
  if (!exact.sunoExact && !exact.levelExact && !exact.analysisExact) return true;
  const patch = {};
  if (exact.sunoExact) patch.sunoUrl = exact.sunoUrl.trim();
  if (exact.levelExact) patch.audioLevel = exact.audioLevel.trim();
  if (exact.analysisExact) patch.audioAnalysis = exact.audioAnalysis.trim();
  return writeExactShown(path, patch, shell).ok;
}
function keepSavedSuno(merged, _disk) {
  return merged;
}
function keepSavedLevel(merged, _disk) {
  return merged;
}
function keepSavedAnalysis(merged, _disk) {
  return merged;
}
function applyUserSavedKeys(guarded, pkg) {
  if (!guarded || !pkg) return guarded;
  const keys = Array.isArray(pkg.savedKeys) ? pkg.savedKeys.filter((key) => typeof key === "string" && key) : [];
  if (!keys.length) return guarded;
  const blanks = new Set(Array.isArray(pkg.blankFields) ? pkg.blankFields.filter((key) => typeof key === "string") : []);
  const stamps = { ...readFieldStamps(guarded) };
  const now = Date.now();
  for (const key of keys) {
    if (!SHOWN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(pkg, key)) continue;
    const raw = String(pkg[key] ?? "");
    const clean = cleanShownValue(key, raw);
    if (clean) guarded[key] = clean;
    else if (!raw.trim() || blanks.has(key)) guarded[key] = "";
    else continue;
    const prior = Date.parse(stamps[key] || "") || 0;
    stamps[key] = new Date(Math.max(now, prior + 1)).toISOString();
  }
  if (Object.keys(stamps).length) guarded.fieldSavedAt = stamps;
  return guarded;
}
const RESULT_KEEP_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist", "sourceLyrics", "sourceVocal", "sourceGenre"];
function userSavedKeySet(pkg) {
  const raw = pkg?.savedKeys;
  return new Set(Array.isArray(raw) ? raw.filter((key) => typeof key === "string" && key) : []);
}
function keepUnsavedResultText(guarded, path, pkg) {
  if (!guarded) return guarded;
  const keys = userSavedKeySet(pkg);
  if (!keys.size || !path || !existsSync(path)) return guarded;
  const disk = readJson(path)?.pkg;
  if (!disk || typeof disk !== "object") return guarded;
  const stamps = { ...readFieldStamps(guarded) };
  const diskStamps = readFieldStamps(disk);
  for (const key of RESULT_KEEP_KEYS) {
    if (keys.has(key) || !(key in disk)) continue;
    guarded[key] = disk[key];
    if (diskStamps[key]) stamps[key] = diskStamps[key];
  }
  if (Object.keys(stamps).length) guarded.fieldSavedAt = stamps;
  return guarded;
}
function sealDiskMedia(guarded, _path, _pkg) {
  return guarded;
}
function sealPremiumFlags(guarded, path, pkg) {
  if (!guarded || !path || !existsSync(path)) return guarded;
  const keys = userSavedKeySet(pkg);
  const disk = readJson(path)?.pkg;
  if (!disk || typeof disk !== "object") return guarded;
  if (!keys.has("ytPremium")) {
    if (disk.ytPremium === true || disk.ytPremium === false) guarded.ytPremium = disk.ytPremium === true;
    else delete guarded.ytPremium;
  }
  if (!keys.has("mvPremium")) {
    if (disk.mvPremium === true || disk.mvPremium === false) guarded.mvPremium = disk.mvPremium === true;
    else delete guarded.mvPremium;
  }
  if (keys.has("ytPremium") && (pkg.ytPremium === true || pkg.ytPremium === false)) guarded.ytPremium = pkg.ytPremium === true;
  if (keys.has("mvPremium") && (pkg.mvPremium === true || pkg.mvPremium === false)) guarded.mvPremium = pkg.mvPremium === true;
  if (!keys.has("mvUrl") && !String(disk.mvUrl || "").trim() && !String(guarded.mvUrl || "").trim()) delete guarded.mvUrl;
  if (!keys.has("youtubeUrl") && !String(disk.youtubeUrl || "").trim() && !String(guarded.youtubeUrl || "").trim()) delete guarded.youtubeUrl;
  const thumb = String(disk.thumbUrl || "");
  if (!keys.has("thumbUrl") && /^https?:\/\//i.test(thumb) && !String(guarded.thumbUrl || "").trim()) guarded.thumbUrl = thumb;
  return guarded;
}
function sealShownWrite(guarded, path, pkg) {
  applyUserSavedKeys(guarded, pkg);
  keepUnsavedResultText(guarded, path, pkg);
  sealDiskMedia(guarded, path, pkg);
  sealPremiumFlags(guarded, path, pkg);
  return guarded;
}
function pinShownString(genreId, ep, field, value) {
  diskDenied = false;
  const clean = cleanShownValue(field, value);
  if (!clean) return { ok: false, value: "", error: "empty" };
  const path = songPath(genreId, ep);
  if (!path || !existsSync(path)) return { ok: false, value: "", error: "path" };
  if (!readJson(path)?.pkg) {
    const prev = readJson(path) ?? {};
    if (!writeJson(path, { ...prev, pkg: { audioAnalysis: "", audioLevel: "" } })) return { ok: false, value: "", error: "path" };
  }
  const have = cleanShownValue(field, readPkgField(path, field));
  if (have) return { ok: true, value: have, error: "kept" };
  if (readPkgField(path, field) === clean) return { ok: true, value: clean, error: "" };
  if (!patchPkgStringField(path, field, clean) && !assignPkgField(path, field, clean, { genreId, ep })) return { ok: false, value: readPkgField(path, field), error: diskDenied ? "write" : "read" };
  const back = readPkgField(path, field);
  if (back !== clean) return { ok: false, value: back, error: diskDenied ? "write" : "read" };
  return { ok: true, value: back, error: "" };
}
function pinAudioLevel(genreId, ep, value) {
  const saved = pinShownString(genreId, ep, "audioLevel", value);
  return { ok: saved.ok, audioLevel: saved.value, error: saved.error === "kept" ? "" : saved.error };
}
function pinAudioAnalysis(genreId, ep, value) {
  const saved = pinShownString(genreId, ep, "audioAnalysis", value);
  return { ok: saved.ok, audioAnalysis: saved.value, error: saved.error === "kept" ? "" : saved.error };
}
function pinShownAudio(kind, genreId, ep, act, title, audioLevel, audioAnalysis, vocal = "") {
  const levelClean = String(audioLevel || "").trim() ? cleanShownValue("audioLevel", audioLevel) : "";
  const analysisClean = String(audioAnalysis || "").trim() ? cleanShownValue("audioAnalysis", audioAnalysis) : "";
  if (String(audioLevel || "").trim() && !levelClean) return { ok: false, audioLevel: "", audioAnalysis: "", error: "level" };
  if (String(audioAnalysis || "").trim() && !analysisClean) return { ok: false, audioLevel: "", audioAnalysis: "", error: "analysis" };
  if (kind === "song") {
    const level = levelClean ? pinAudioLevel(genreId, ep, levelClean) : { ok: true, audioLevel: "", error: "" };
    const analysis = analysisClean ? pinAudioAnalysis(genreId, ep, analysisClean) : { ok: true, audioAnalysis: "", error: "" };
    return { ok: level.ok && analysis.ok, audioLevel: level.audioLevel || "", audioAnalysis: analysis.audioAnalysis || "", error: level.ok && analysis.ok ? "" : level.error || analysis.error };
  }
  const path = shownFilePath(kind === "cover" ? "cover" : kind === "act" ? "act" : "story", genreId, ep, act, title, vocal);
  if (!path || !existsSync(path)) return { ok: false, audioLevel: "", audioAnalysis: "", error: "path" };
  const haveLevel = cleanShownValue("audioLevel", readPkgField(path, "audioLevel"));
  const haveAnalysis = cleanShownValue("audioAnalysis", readPkgField(path, "audioAnalysis"));
  if (levelClean && !haveLevel && !patchPkgStringField(path, "audioLevel", levelClean)) return { ok: false, audioLevel: haveLevel, audioAnalysis: haveAnalysis, error: "write" };
  if (analysisClean && !haveAnalysis && !patchPkgStringField(path, "audioAnalysis", analysisClean)) return { ok: false, audioLevel: readPkgField(path, "audioLevel"), audioAnalysis: haveAnalysis, error: "write" };
  return { ok: true, audioLevel: readPkgField(path, "audioLevel"), audioAnalysis: readPkgField(path, "audioAnalysis"), error: "" };
}
function pinShownPremium(kind, genreId, ep, act, title, which, on, vocal = "") {
  const field = which === "mv" ? "mvPremium" : "ytPremium";
  const flag = on === true;
  const path = kind === "song"
    ? songPath(genreId, ep)
    : shownFilePath(kind === "cover" ? "cover" : kind === "act" ? "act" : "story", genreId, ep, act, title, vocal);
  if (!path || !existsSync(path)) return { ok: false, field, on: flag, error: "path" };
  const prev = readJson(path) ?? {};
  const prevPkg = prev.pkg && typeof prev.pkg === "object" ? { ...prev.pkg } : {};
  if (prevPkg[field] === flag) return { ok: true, field, on: flag, error: "" };
  const nextPkg = { ...prevPkg, [field]: flag };
  if (!writeJson(path, { ...prev, pkg: nextPkg })) return { ok: false, field, on: flag, error: "write" };
  const got = readJson(path);
  if (got?.pkg?.[field] !== flag) return { ok: false, field, on: got?.pkg?.[field] === true, error: "read" };
  const nowPkg = got?.pkg && typeof got.pkg === "object" ? got.pkg : {};
  for (const key of new Set([...Object.keys(prevPkg), ...Object.keys(nowPkg)])) {
    if (key === field) continue;
    if (JSON.stringify(prevPkg[key]) !== JSON.stringify(nowPkg[key])) return { ok: false, field, on: flag, error: "read" };
  }
  return { ok: true, field, on: flag, error: "" };
}
function pinEmptyJsonField(path, field, value) {
  const clean = value.trim();
  if (!clean || !field || !existsSync(path)) return false;
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  const token = [`"${field}":""`, `"${field}": ""`].find((item) => raw.split(item).length - 1 === 1);
  if (!token) return false;
  const next = raw.replace(token, `"${field}":${JSON.stringify(clean)}`);
  try {
    const before = JSON.parse(raw);
    const after = JSON.parse(next);
    if (String(after?.pkg?.[field] ?? "").trim() !== clean) return false;
    const prevPkg = before?.pkg && typeof before.pkg === "object" ? before.pkg : {};
    const nextPkg = after?.pkg && typeof after.pkg === "object" ? after.pkg : {};
    const keys = /* @__PURE__ */new Set([...Object.keys(prevPkg), ...Object.keys(nextPkg)]);
    for (const key of keys) {
      if (key === field) continue;
      if (JSON.stringify(prevPkg[key]) !== JSON.stringify(nextPkg[key])) return false;
    }
    const { pkg: _beforePkg, ...beforeRest } = before;
    const { pkg: _afterPkg, ...afterRest } = after;
    if (JSON.stringify(beforeRest) !== JSON.stringify(afterRest)) return false;
  } catch {
    return false;
  }
  try {
    writeFileSync(path, next);
  } catch {
    return false;
  }
  return String(readJson(path)?.pkg?.[field] ?? "").trim() === clean;
}
function putSongLink(genreId, ep, url, field = "youtubeUrl") {
  if (!LIVE || !genreId || !ep) {
    if (field === "sunoUrl") lastSunoFault = !LIVE ? "live" : "path";
    return false;
  }
  try {
    const path = songPath(genreId, ep);
    const prev = readSongRecord(genreId, ep);
    const clean = url.trim();
    if (field === "sunoUrl") return storeSunoUrl(path, clean, prev, { genreId, ep, title: prev?.title || String(prev?.pkg?.confirmedTitle || "") });
    const pkg = { ...(prev?.pkg ?? {}) };
    const current = String(pkg[field] || "").trim();
    if (!clean) {
      if (!current) return true;
      pkg[field] = "";
      const cleared = { ...(prev ?? {}), genreId, ep, title: prev?.title || String(pkg.confirmedTitle || ""), pkg };
      if (!writeJson(path, cleared)) return false;
      return String(readJson(path)?.pkg?.[field] || "").trim() === "";
    }
    if (current === clean) return true;
    if (!current && pinEmptyJsonField(path, field, clean)) {
      if (field === "youtubeUrl") mirrorYoutubeKey(`${genreId}:${ep}`, clean);
      return true;
    }
    pkg[field] = clean;
    const next = { ...(prev ?? {}), genreId, ep, title: prev?.title || String(pkg.confirmedTitle || ""), pkg };
    if (!writeJson(path, next)) return false;
    let saved = String(readJson(path)?.pkg?.[field] || "").trim();
    if (saved !== clean) {
      if (!writeJson(path, next)) return false;
      saved = String(readJson(path)?.pkg?.[field] || "").trim();
    }
    if (saved !== clean) return false;
    if (field === "youtubeUrl") mirrorYoutubeKey(`${genreId}:${ep}`, clean);
    return true;
  } catch (err) {
    if (field === "sunoUrl") lastSunoFault = isReadOnlyFs(err) ? "write" : "throw";
    return false;
  }
}
function putActLink(genreId, act, url, field = "youtubeUrl") {
  if (!LIVE || !genreId || !act) {
    if (field === "sunoUrl") lastSunoFault = !LIVE ? "live" : "path";
    return false;
  }
  try {
    const path = actPath(genreId, act);
    const prev = readJson(path);
    const clean = url.trim();
    if (field === "sunoUrl") return storeSunoUrl(path, clean, prev ?? null, { genreId, act, title: prev?.title || "" });
    const pkg = { ...(prev?.pkg ?? {}) };
    const current = String(pkg[field] || "").trim();
    if (!clean) {
      if (!current) return true;
      pkg[field] = "";
      const cleared = { ...(prev ?? {}), genreId, act, title: prev?.title || "", pkg };
      if (!writeJson(path, cleared)) return false;
      return String(readJson(path)?.pkg?.[field] || "").trim() === "";
    }
    if (current === clean) return true;
    if (!current && pinEmptyJsonField(path, field, clean)) {
      if (field === "youtubeUrl") mirrorYoutubeKey(`${genreId}:pl:${act}`, clean);
      return true;
    }
    pkg[field] = clean;
    const next = { ...(prev ?? {}), genreId, act, title: prev?.title || "", pkg };
    if (!writeJson(path, next)) return false;
    let saved = String(readJson(path)?.pkg?.[field] || "").trim();
    if (saved !== clean) {
      if (!writeJson(path, next)) return false;
      saved = String(readJson(path)?.pkg?.[field] || "").trim();
    }
    if (saved !== clean) return false;
    if (field === "youtubeUrl") mirrorYoutubeKey(`${genreId}:pl:${act}`, clean);
    return true;
  } catch (err) {
    if (field === "sunoUrl") lastSunoFault = isReadOnlyFs(err) ? "write" : "throw";
    return false;
  }
}
function mirrorYoutubeKey(_key, _url) {}
function usableDonorText(key, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(data:|blob:)/i.test(text)) return "";
  if (text.length > 2e4) return "";
  if ((key === "youtubeUrl" || key === "mvUrl" || key === "sunoUrl") && (!/^https?:\/\//i.test(text) || text.length > 500)) return "";
  return text;
}
function ensurePkgShell(path, shell) {
  const prev = readJson(path);
  if (prev?.pkg && typeof prev.pkg === "object") return prev;
  const next = {
    ...shell,
    ...(prev ?? {}),
    pkg: { ...(prev?.pkg && typeof prev.pkg === "object" ? prev.pkg : {}) }
  };
  if (!writeJson(path, next)) return null;
  return readJson(path);
}
function stampEmptyFields(path, filled, shell = {}) {
  const wanted = Object.entries(filled).map(([key, value]) => [key, usableDonorText(key, value)]).filter(([, value]) => value);
  if (!wanted.length) return [];
  const missing = [];
  for (const [key, value] of wanted) {
    const writeKey = () => {
      const prev = readJson(path) ?? {};
      const pkg = { ...(prev.pkg && typeof prev.pkg === "object" ? prev.pkg : {}) };
      if (String(pkg[key] ?? "").trim()) return true;
      pkg[key] = value;
      return writeJson(path, { ...shell, ...prev, pkg });
    };
    try {
      if (!writeKey()) writeKey();
    } catch {
    }
    const got = String(readJson(path)?.pkg?.[key] ?? "").trim();
    if (got === value || got) continue;
    missing.push(key);
  }
  return missing;
}
function writeOpenField(path, key, from, to) {
  const nextText = usableDonorText(key, to);
  if (!nextText) return false;
  const once = () => {
    const prev = readJson(path);
    if (!prev?.pkg || typeof prev.pkg !== "object") return false;
    const pkg = { ...prev.pkg };
    const current = String(pkg[key] ?? "").trim();
    if (current === nextText) return true;
    if (current !== from.trim()) return false;
    pkg[key] = nextText;
    if (!writeJson(path, { ...prev, pkg })) return false;
    return String(readJson(path)?.pkg?.[key] ?? "").trim() === nextText;
  };
  return once() || once();
}
const SONG_REPAIR_KEYS = /* @__PURE__ */new Set(["confirmedTitle", "geminiPrompt", "youtubeTitle"]);
const ACT_REPAIR_KEYS = /* @__PURE__ */new Set(["geminiPrompt"]);
const REPAIR_EDIT_ID = {
  confirmedTitle: "title",
  geminiPrompt: "thumb",
  youtubeTitle: "yt-title"
};
function stampOpenRepairs(rows) {
  const written = [];
  if (!LIVE) return { written };
  const flags = readConfirmedFlags();
  for (const row of rows) {
    if (row.kind === "single") {
      const ep = String(row.ep || "").replace(/\D/g, "").padStart(2, "0");
      if (!row.genreId || ep === "00" || !slotRewriteOpen(row.genreId, ep)) continue;
      if (flags[`${row.genreId}:ep:${ep}`] === true) continue;
      const path = songPath(row.genreId, ep);
      const prev = readJson(path);
      if (!prev?.pkg || prev.confirmed === true) continue;
      const edited = new Set(prev.pkg.userEdited || []);
      let saved = false;
      let failed = false;
      for (const field of row.fields || []) {
        if (!SONG_REPAIR_KEYS.has(field.key)) continue;
        const id = REPAIR_EDIT_ID[field.key];
        if (id && edited.has(id)) continue;
        const to = usableDonorText(field.key, field.to);
        if (!to || to === String(field.from || "").trim()) continue;
        if (writeOpenField(path, field.key, String(field.from || ""), to)) saved = true;else
        failed = true;
      }
      if (saved && !failed) written.push(`${row.genreId}:${ep}`);
    } else {
      const act = Number(row.act) || 0;
      if (!row.genreId || act < 1) continue;
      if (flags[`${row.genreId}:act:${act}`] === true || flags[`${row.genreId}:pl:${act}`] === true) continue;
      const path = actPath(row.genreId, act);
      const prev = readJson(path);
      if (!prev?.pkg || prev.confirmed === true) continue;
      let saved = false;
      let failed = false;
      for (const field of row.fields || []) {
        if (!ACT_REPAIR_KEYS.has(field.key)) continue;
        const to = usableDonorText(field.key, field.to);
        if (!to || to === String(field.from || "").trim()) continue;
        if (writeOpenField(path, field.key, String(field.from || ""), to)) saved = true;else
        failed = true;
      }
      if (saved && !failed) written.push(`${row.genreId}:act:${act}`);
    }
  }
  return { written };
}
const SONG_RESULT_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "youtubeUrl", "sunoUrl"];
const ACT_RESULT_KEYS = ["summary", "confirmedTitle", "tracklist", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "communityPost", "youtubeUrl", "sunoUrl"];
const RESULT_LABEL = {
  summary: "\uC694\uC57D",
  confirmedTitle: "\uC81C\uBAA9",
  lyricsBlock: "\uAC00\uC0AC",
  tracklist: "\uC218\uB85D\uACE1",
  sunoStyle: "\uC218\uB178",
  geminiPrompt: "\uC378\uB124\uC77C",
  youtubeTitle: "\uC720\uD29C\uBE0C \uC81C\uBAA9",
  youtubeDescription: "\uC124\uBA85\uB780",
  fanLetter: "\uCEE4\uBBA4\uB2C8\uD2F0",
  communityPost: "\uCEE4\uBBA4\uB2C8\uD2F0",
  youtubeUrl: "\uC720\uD29C\uBE0C \uC8FC\uC18C",
  sunoUrl: "\uC218\uB178 \uC8FC\uC18C"
};
function genreShowsField(genreId, field, act = false) {
  const pref = readEncPref(genreId);
  const output = act ? pref?.actOutput ?? pref?.output : pref?.output;
  if (!output || typeof output[field] !== "boolean") return true;
  return output[field] === true;
}
function fieldAllowed(genreId, key, act = false) {
  if (key === "summary") return genreShowsField(genreId, "summary", act);
  if (key === "geminiPrompt") return genreShowsField(genreId, "thumb", act);
  if (key === "fanLetter" || key === "communityPost") return genreShowsField(genreId, "letter", act);
  return true;
}
function resultText(pkg, key) {
  return String(pkg?.[key] ?? "").trim();
}
function hasResultBody(pkg, keys) {
  return keys.some((key) => key !== "youtubeUrl" && key !== "sunoUrl" && key !== "mvUrl" && resultText(pkg, key));
}
function readPkgFile(path) {
  const row = readJson(path);
  if (!row?.pkg || typeof row.pkg !== "object") return null;
  return row.pkg;
}
function shortLivePath(path) {
  const mark = `${LIVE}/`;
  return path.startsWith(mark) ? path.slice(mark.length) : path;
}
function liveGenreIds() {
  const ids = /* @__PURE__ */new Set();
  for (const base of ["\uACE1", "genres", "songs", "playlists"]) {
    const dir = join(LIVE, base);
    if (!dir || !existsSync(dir)) continue;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) ids.add(name.name);
    }
  }
  return [...ids];
}
function adoptMisplacedFields(extra) {
  const notes = [];
  if (!LIVE) return notes;
  const flags = readConfirmedFlags();
  const links = readSongLinks();
  const meta = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const youtube = { ...(meta?.youtube ?? {}), ...links };
  for (const [key, value] of Object.entries(extra?.youtube ?? {})) {
    const url = String(value || "").trim();
    if (url) youtube[key] = url;
  }
  const urlOwner = /* @__PURE__ */new Map();
  for (const genreId of liveGenreIds()) {
    for (const song of listGenreSongHeads(genreId)) {
      const url = song.youtubeUrl.trim();
      if (url && !urlOwner.has(url)) urlOwner.set(url, `${genreId}:${song.ep.padStart(2, "0")}`);
    }
    for (const act of listGenreActDescs(genreId)) {
      const url = act.youtubeUrl.trim();
      if (url && !urlOwner.has(url)) urlOwner.set(url, `${genreId}:pl:${act.act}`);
    }
  }
  const droppedPins = [];
  const claimOrSkip = (key, url) => {
    const owner = urlOwner.get(url);
    if (owner && owner !== key) {
      if (youtube[key] === url) droppedPins.push(key);
      delete youtube[key];
      return false;
    }
    if (!urlOwner.has(url)) urlOwner.set(url, key);
    return true;
  };
  for (const genreId of liveGenreIds()) {
    const eps = /* @__PURE__ */new Set();
    const epDir = join(LIVE, "\uACE1", safePart(genreId), "ep");
    if (existsSync(epDir)) {
      for (const name of readdirSync(epDir)) {
        const hit = name.match(/^(\d+)\.json$/);
        if (hit) eps.add(hit[1].padStart(2, "0"));
      }
    }
    for (const path of [join(LIVE, "genres", genreId, "ep"), join(LIVE, "songs", genreId)]) {
      if (!existsSync(path)) continue;
      for (const name of readdirSync(path)) {
        const hit = name.match(/^(\d+)\.json$/);
        if (hit) eps.add(hit[1].padStart(2, "0"));
      }
    }
    for (const row of extra?.songs ?? []) {
      if (row.genreId === genreId && row.ep) eps.add(row.ep.padStart(2, "0"));
    }
    for (const ep of eps) {
      const prev = readSongRecord(genreId, ep);
      const sealed = flags[`${genreId}:ep:${ep}`] === true || prev?.confirmed === true;
      const pkg = { ...(prev?.pkg ?? {}) };
      const donors = [];
      for (const path of legacySongPaths(genreId, ep)) {
        const donor = readPkgFile(path);
        if (donor) donors.push({ pkg: donor, from: shortLivePath(path) });
      }
      for (const row of extra?.songs ?? []) {
        if (row.genreId === genreId && row.ep.padStart(2, "0") === ep) donors.push({ pkg: row.pkg, from: row.from });
      }
      if (!prev?.pkg && !donors.some((donor) => hasResultBody(donor.pkg, SONG_RESULT_KEYS))) continue;
      let changed = false;
      const filled = [];
      for (const key of SONG_RESULT_KEYS) {
        if (sealed && key !== "youtubeUrl" && key !== "sunoUrl") continue;
        if (!fieldAllowed(genreId, key)) continue;
        if (resultText(pkg, key)) continue;
        if (key === "youtubeUrl") {
          const pinned = usableDonorText(
            "youtubeUrl",
            String(youtube[`${genreId}:${ep}`] || youtube[`${genreId}:${Number(ep)}`] || "")
          );
          if (pinned) {
            if (!claimOrSkip(`${genreId}:${ep}`, pinned)) continue;
            pkg.youtubeUrl = pinned;
            changed = true;
            filled.push("youtubeUrl");
            continue;
          }
        }
        if (key === "sunoUrl") continue;
        for (const donor of donors) {
          const value = usableDonorText(key, resultText(donor.pkg, key));
          if (!value) continue;
          if (key === "youtubeUrl" && !claimOrSkip(`${genreId}:${ep}`, value)) break;
          pkg[key] = value;
          changed = true;
          filled.push(key);
          break;
        }
      }
      if (!changed) continue;
      const songFile = songPath(genreId, ep);
      if (!existsSync(songFile)) {
        writeJson(songFile, {
          genreId,
          ep,
          title: prev?.title || resultText(pkg, "confirmedTitle"),
          pkg,
          ...keptSongState(prev)
        });
      }
      const patch = {};
      for (const key of filled) {
        if (key === "youtubeUrl" || key === "sunoUrl") continue;
        patch[key] = resultText(pkg, key);
      }
      const missing = stampEmptyFields(songFile, patch, {
        genreId,
        ep,
        title: prev?.title || resultText(pkg, "confirmedTitle"),
        ...keptSongState(prev)
      });
      if (filled.includes("youtubeUrl")) {
        const url = resultText(pkg, "youtubeUrl");
        if (!(url && putSongLink(genreId, ep, url))) missing.push("youtubeUrl");
      }
      if (filled.includes("sunoUrl")) {
        const url = resultText(pkg, "sunoUrl");
        if (!(url && pinEmptySunoFile("song", genreId, ep, url))) missing.push("sunoUrl");
      }
      for (const key of missing) notes.push(`\uACE1 ${genreId} EP.${ep} ${RESULT_LABEL[key] || key} \uC800\uC7A5 \uC2E4\uD328`);
      const savedUrl = String(readJson(songFile)?.pkg?.youtubeUrl || "").trim();
      if (savedUrl) mirrorYoutubeKey(`${genreId}:${ep}`, savedUrl);
    }
    const acts = /* @__PURE__ */new Set();
    for (let act = 1; act <= 4; act += 1) acts.add(act);
    for (const row of extra?.acts ?? []) if (row.genreId === genreId && row.act) acts.add(row.act);
    for (const act of acts) {
      const path = actPath(genreId, act);
      const prev = readJson(path);
      const sealed = flags[`${genreId}:act:${act}`] === true || flags[`${genreId}:pl:${act}`] === true || prev?.confirmed === true;
      const pkg = { ...(prev?.pkg ?? {}) };
      const donors = [];
      for (const legacy of legacyActPaths(genreId, act)) {
        const donor = readPkgFile(legacy);
        if (donor) donors.push({ pkg: donor, from: shortLivePath(legacy) });
      }
      for (const row of extra?.acts ?? []) {
        if (row.genreId === genreId && Number(row.act) === act) donors.push({ pkg: row.pkg, from: row.from });
      }
      if (!prev?.pkg && !donors.some((donor) => hasResultBody(donor.pkg, ACT_RESULT_KEYS))) continue;
      let changed = false;
      const filled = [];
      for (const key of ACT_RESULT_KEYS) {
        if (sealed && key !== "youtubeUrl" && key !== "sunoUrl") continue;
        if (!fieldAllowed(genreId, key, true)) continue;
        if (resultText(pkg, key)) continue;
        if (key === "youtubeUrl") {
          const pinned = usableDonorText(
            "youtubeUrl",
            String(youtube[`${genreId}:pl:${act}`] || youtube[`${genreId}:act:${act}`] || "")
          );
          if (pinned) {
            if (!claimOrSkip(`${genreId}:pl:${act}`, pinned)) continue;
            pkg.youtubeUrl = pinned;
            changed = true;
            filled.push("youtubeUrl");
            continue;
          }
        }
        if (key === "sunoUrl") continue;
        for (const donor of donors) {
          const raw = resultText(donor.pkg, key) || (key === "communityPost" ? resultText(donor.pkg, "fanLetter") : "");
          const value = usableDonorText(key, raw);
          if (!value) continue;
          if (key === "youtubeUrl" && !claimOrSkip(`${genreId}:pl:${act}`, value)) break;
          if (key === "geminiPrompt") {
            const named = value.match(/Act\.(\d+)/i);
            if (named && Number(named[1]) !== act) continue;
          }
          pkg[key] = value;
          changed = true;
          filled.push(key);
          break;
        }
      }
      if (!changed) continue;
      if (!existsSync(path)) {
        writeJson(path, {
          genreId,
          act,
          title: prev?.title || resultText(pkg, "confirmedTitle"),
          pkg
        });
      }
      const patch = {};
      for (const key of filled) {
        if (key === "youtubeUrl" || key === "sunoUrl") continue;
        patch[key] = resultText(pkg, key);
      }
      const missing = stampEmptyFields(path, patch, {
        genreId,
        act,
        title: prev?.title || resultText(pkg, "confirmedTitle")
      });
      if (filled.includes("youtubeUrl")) {
        const url = resultText(pkg, "youtubeUrl");
        if (!(url && putActLink(genreId, act, url))) missing.push("youtubeUrl");
      }
      if (filled.includes("sunoUrl")) {
        const url = resultText(pkg, "sunoUrl");
        if (!(url && pinEmptySunoFile("act", genreId, act, url))) missing.push("sunoUrl");
      }
      for (const key of missing) notes.push(`ACT ${genreId} Act.${act} ${RESULT_LABEL[key] || key} \uC800\uC7A5 \uC2E4\uD328`);
      const savedUrl = String(readJson(path)?.pkg?.youtubeUrl || "").trim();
      if (savedUrl) mirrorYoutubeKey(`${genreId}:pl:${act}`, savedUrl);
    }
  }
  if (droppedPins.length && meta) {
    const next = { ...(meta.youtube ?? {}) };
    for (const key of droppedPins) delete next[key];
    writeJson(metaPath(), { ...meta, youtube: next });
  }
  return notes;
}
function readSongConfirmFlags() {
  const out = {};
  for (const row of songFileRows()) {
    const item = row;
    if (!item.genreId || !item.ep) continue;
    if (item.confirmed !== true && item.confirmed !== false) continue;
    out[`${item.genreId}:ep:${item.ep}`] = item.confirmed;
  }
  return out;
}
function readConfirmedFlags() {
  const raw = readJson(confirmedPath()) ?? readJson(join(LIVE, "confirmed.json"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true || value === false) out[key] = value;
  }
  return out;
}
function putConfirmedFlag(key, on) {
  if (!LIVE || !key) return false;
  try {
    const storyMatch = /^(your-story|cover-reborn):story:(.+)$/.exec(key);
    if (storyMatch) {
      for (const path of storyLookupPaths(storyMatch[2], storyMatch[1])) {
        if (!existsSync(path)) continue;
        const prev = readJson(path);
        if (prev?.pkg) writeJson(path, { ...prev, confirmed: on });
      }
    }
    const match = /^(.+):ep:(.+)$/.exec(key);
    if (match) {
      if (on) patchSongState(match[1], match[2], { confirmed: true });else
      clearSongConfirmed(match[1], match[2]);
    }
    const actMatch = /^(.+):act:(\d+)$/.exec(key);
    if (actMatch && ACTS.some((item) => item.n === Number(actMatch[2]))) {
      patchActConfirmed(actMatch[1], Number(actMatch[2]), on);
    }
    return true;
  } catch {
    return false;
  }
}
function stripTopConfirmed(path) {
  if (!existsSync(path)) return false;
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  let before;
  try {
    before = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(before, "confirmed")) return true;
  const pkgSnap = JSON.stringify(before.pkg ?? null);
  const mark = '"confirmed":';
  let from = 0;
  while (from < raw.length) {
    const keyAt = raw.indexOf(mark, from);
    if (keyAt < 0) break;
    let start = keyAt;
    while (start > 0 && /\s/.test(raw[start - 1] || "")) start -= 1;
    if (raw[start - 1] === ",") start -= 1;
    let end = keyAt + mark.length;
    while (raw[end] === " ") end += 1;
    if (raw.startsWith("true", end)) end += 4;else
    if (raw.startsWith("false", end)) end += 5;else
    {
      from = keyAt + mark.length;
      continue;
    }
    const next = raw.slice(0, start) + raw.slice(end);
    try {
      const after = JSON.parse(next);
      if (JSON.stringify(after.pkg ?? null) !== pkgSnap || Object.prototype.hasOwnProperty.call(after, "confirmed")) {
        from = keyAt + mark.length;
        continue;
      }
      writeFileSync(path, next);
      const back = JSON.parse(readFileSync(path, "utf8"));
      return JSON.stringify(back.pkg ?? null) === pkgSnap && !Object.prototype.hasOwnProperty.call(back, "confirmed");
    } catch {
      from = keyAt + mark.length;
    }
  }
  return false;
}
function patchActConfirmed(genreId, act, on) {
  if (!genreId || !act) return false;
  const path = actPath(genreId, act);
  const prev = readJson(path);
  if (!prev?.pkg) return false;
  if (on) writeJson(path, { ...prev, confirmed: true });else
  stripTopConfirmed(path);
  return true;
}
function clearSongConfirmed(genreId, ep) {
  const n = String(ep || "").replace(/\D/g, "").padStart(2, "0");
  for (const id of [ep, n]) {
    const path = songPath(genreId, id);
    if (!existsSync(path)) continue;
    stripTopConfirmed(path);
    forgetLegacySong(genreId, id);
  }
}
function onlyConfirmed(map) {
  const out = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value === true) out[key] = true;
  }
  return out;
}
function unionConfirmed(...maps) {
  return onlyConfirmed(Object.assign({}, ...maps.map((map) => onlyConfirmed(map))));
}
function readActConfirmFlags() {
  const out = {};
  for (const genre of liveGenreIds()) {
    for (let act = 1; act <= 4; act += 1) {
      const row = readJson(actPath(genre, act));
      if (row?.confirmed === true) out[`${genre}:act:${act}`] = true;
    }
  }
  return out;
}
function readStoryConfirmFlags() {
  const out = {};
  eachLooseStory((row, cover) => {
    const item = row;
    if (!item.title || item.confirmed !== true || item.title.startsWith("playlist:")) return;
    out[`${cover ? "cover-reborn" : "your-story"}:story:${item.title}`] = true;
  });
  return out;
}
function liveConfirmed() {
  return unionConfirmed(readSongConfirmFlags(), readActConfirmFlags(), readStoryConfirmFlags());
}
function rememberConfirmed(base) {
  const confirmed = unionConfirmed(base, readConfirmedFlags(), readSongConfirmFlags(), readActConfirmFlags());
  const files = readConfirmedFlags();
  const songs = readSongConfirmFlags();
  const acts = readActConfirmFlags();
  for (const key of Object.keys(confirmed)) {
    const match = /^(.+):ep:(.+)$/.exec(key);
    const actMatch = /^(.+):act:(\d+)$/.exec(key);
    if (match) {
      if (files[key] === true && songs[key] === true) continue;
    } else if (actMatch) {
      if (files[key] === true && acts[key] === true) continue;
    } else if (files[key] === true) {
      continue;
    }
    putConfirmedFlag(key, true);
  }
  return confirmed;
}
function clearStoredSongLocks() {
  if (!LIVE || existsSync(lockSweepPath()) || existsSync(join(LIVE, "locks-cleared-once.json"))) return false;
  const meta = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json")) ?? blankMeta();
  writeJson(metaPath(), { ...blankMeta(), ...meta, locks: {}, rowLocks: {}, lockSweep: 1 });
  writeJson(rowLockPath(), {});
  return true;
}
function markStoredSongLocksCleared() {
  if (!LIVE) return;
  writeJson(lockSweepPath(), { at: Date.now() });
}
function putEncMeta(meta) {
  if (!LIVE) return;
  const prev = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const links = readSongLinks();
  const youtube = { ...(prev?.youtube ?? {}), ...(meta.youtube ?? {}), ...links };
  for (const [key, value] of Object.entries(meta?.youtube ?? {})) {
    if (String(key).includes(":hq:")) youtube[key] = value;
  }
  writeJson(metaPath(), {
    ...blankMeta(),
    ...(prev ?? {}),
    ...meta,
    locks: { ...(prev?.locks ?? {}), ...(meta.locks ?? {}) },
    rowLocks: { ...(prev?.rowLocks ?? {}), ...(meta.rowLocks ?? {}) },
    youtube,
    confirmed: unionConfirmed(prev?.confirmed, meta.confirmed, readConfirmedFlags()),
    listOrder: { ...(prev?.listOrder ?? {}), ...(meta.listOrder ?? {}) }
  });
}
function persistEncyclopedia(data) {
  if (!LIVE) return;
  for (const row of Object.values(data.packages ?? {})) {
    try {
      forceEncPackage(row.genreId, row.ep, row.title, row.pkg);
    } catch {
    }
  }
  for (const row of Object.values(data.playlists ?? {})) {
    try {
      const path = actPath(row.genreId, row.act);
      const prev2 = readJson(path);
      const nextPkg = { ...(row.pkg ?? {}) };
      const prevPkg = prev2?.pkg;
      if (prevPkg) {
        for (const key of [...ACT_RESULT_KEYS, "mvUrl"]) {
          if (!String(nextPkg[key] ?? "").trim() && String(prevPkg[key] ?? "").trim()) nextPkg[key] = String(prevPkg[key]);
        }
        if (nextPkg.sunoUrl == null && String(prevPkg.sunoUrl || "").trim()) nextPkg.sunoUrl = String(prevPkg.sunoUrl);
        keepSavedSuno(nextPkg, String(readJson(path)?.pkg?.sunoUrl || ""));
      }
      if (prev2?.confirmed === true || readConfirmedFlags()[`${row.genreId}:act:${row.act}`] === true) {
        keepConfirmedText(nextPkg, prevPkg, ["summary", "confirmedTitle", "tracklist", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "communityPost", "fanLetter"]);
      }
      writeJson(path, {
        ...prev2,
        ...row,
        pkg: nextPkg,
        ...(prev2?.confirmed === true ? { confirmed: true } : {})
      });
      forgetLegacyAct(row.genreId, row.act);
    } catch {
    }
  }
  for (const [key, row] of Object.entries(data.stories ?? {})) {
    const cover = key.startsWith("cover:") || key.startsWith("playlist:cover:");
    let name = cover && key.startsWith("playlist:") ? key : row.title || key;
    if (cover && !key.startsWith("playlist:")) name = name.replace(/^cover:/, "");
    putEncStory(name, row.pkg, cover ? "cover-reborn" : "your-story");
  }
  for (const [genreId, pref] of Object.entries(data.prefs ?? {})) putEncPref(genreId, pref);
  for (const [genreId, songs] of Object.entries(data.originals ?? {})) {
    for (const song of Object.values(songs ?? {})) putEncOriginal(genreId, song);
  }
  putEncFillJob(data.fillJob ?? null);
  const prev = readJson(metaPath()) ?? readJson(join(LIVE, "meta.json"));
  const meta = { ...blankMeta(), ...(data.meta ?? {}) };
  putEncMeta({
    ...meta,
    locks: prev?.locks ?? meta.locks ?? {},
    rowLocks: prev?.rowLocks ?? meta.rowLocks ?? {}
  });
}
function songFolderRoot() {
  return LIVE ? join(LIVE, "곡") : "";
}
function insideSongFolder(path) {
  const root = songFolderRoot();
  if (!root || !path) return false;
  const abs = path.replace(/\\/g, "/");
  const base = root.replace(/\\/g, "/");
  return abs === base || abs.startsWith(`${base}/`);
}
function listSongFolder(rel = "") {
  const root = songFolderRoot();
  if (!root) return { dir: "", dirs: [], files: [] };
  const clean = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (clean.split("/").some((part) => part === ".." || part === ".")) return { dir: "", dirs: [], files: [] };
  const dir = clean ? join(root, clean) : root;
  if (!insideSongFolder(dir) || !existsSync(dir)) return { dir: clean, dirs: [], files: [] };
  const dirs = [];
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const child = clean ? `${clean}/${name}` : name;
    try {
      if (statSync(full).isDirectory()) dirs.push(name);else
      if (name.endsWith(".json")) files.push({ name, path: child });
    } catch {
    }
  }
  dirs.sort((a, b) => a.localeCompare(b, "ko"));
  files.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { dir: clean, dirs, files };
}
function moveShownSong(kind, genreId, ep, act, title, artist, destRel) {
  const from = shownFilePath(kind === "playlist" ? "story" : kind, genreId, ep, act, title, artist);
  if (!from || !existsSync(from)) return { ok: false, error: "없는 곡 파일입니다." };
  const clean = String(destRel || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!LIVE || !clean || clean.split("/").some((part) => part === ".." || part === ".")) return { ok: false, error: "그 위치는 앱 밖입니다." };
  const picked = join(LIVE, clean);
  if (!existsSync(picked)) return { ok: false, error: "고른 위치 또는 파일이 없습니다." };
  const target = statSync(picked).isDirectory() ? join(picked, from.split("/").pop() || "") : picked;
  if (target === from) return { ok: true, path: from };
  if (existsSync(target) && statSync(target).isDirectory()) return { ok: false, error: "폴더 위에는 덮을 수 없습니다." };
  const fromRel = relFromAbs(from);
  const toRel = relFromAbs(target);
  if (!fromRel || !toRel) return { ok: false, error: "그 위치는 앱 밖입니다." };
  const prior = {};
  if (existsSync(target) && statSync(target).isFile()) prior[toRel] = ownersOf(toRel);
  const pairs = capturePairs(fromRel, toRel);
  try {
    if (existsSync(target) && statSync(from).isFile()) {
      copyFileSync(from, target);
      unlinkSync(from);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      if (existsSync(target)) rmSync(target, { recursive: false, force: false });
      renameSync(from, target);
    }
  } catch {
    return { ok: false, error: "파일을 옮기지 못했습니다." };
  }
  noteMovedPairs(pairs, { prior });
  return { ok: true, path: target };
}
function deleteShownSong(kind, genreId, ep, act, title, artist, password) {
  const meta = readJson(metaPath());
  const saved = String(meta?.gatePassword || "").trim() || "7999";
  if (String(password || "").trim() !== saved) return { ok: false, error: "비밀번호가 다릅니다." };
  const path = shownFilePath(kind === "playlist" ? "story" : kind, genreId, ep, act, title, artist);
  const rel = path ? relFromAbs(path) : "";
  if (!path || !rel || !existsSync(path)) return { ok: false, error: "없는 곡 파일입니다." };
  try {
    unlinkSync(path);
  } catch {
    return { ok: false, error: "파일을 지우지 못했습니다." };
  }
  noteRemoved(rel);
  return { ok: true, error: "" };
}
function shownFileRel(kind, genreId, ep, act, title, artist = "") {
  const abs = shownFilePath(kind === "playlist" ? "story" : kind, genreId, ep, act, title, artist);
  if (!abs || !existsSync(abs)) return "";
  try {
    return relFromAbs(abs);
  } catch {
    return "";
  }
}

export {
  actSongsConfirmed,
  adoptMisplacedFields,
  applySongState,
  blankMeta,
  clearStoredSongLocks,
  deleteEncSong,
  deleteEncStory,
  deleteShownSong,
  diskWriteDenied,
  ensureEmptyShownFile,
  forceEncPackage,
  lastSunoFault,
  listActFileBodies,
  listGenreActDescs,
  listGenreSongHeads,
  listSongFolder,
  liveConfirmed,
  lyricsMatchSibling,
  markStoredSongLocksCleared,
  moveShownSong,
  patchSongState,
  persistEncyclopedia,
  pinAudioAnalysis,
  pinAudioLevel,
  pinEmptySunoFile,
  pinShownAudio,
  pinShownPremium,
  pinStorySuno,
  putActLink,
  putConfirmedFlag,
  putEncFillJob,
  putEncMany,
  putEncMeta,
  putEncOriginal,
  putEncPackage,
  putEncPlaylist,
  putEncPref,
  putEncStory,
  putSongLink,
  readActConfirmFlags,
  readActPage,
  readActUpdatedAt,
  readConfirmedFlags,
  readEncPref,
  readEncyclopedia,
  readMetaUpdatedAt,
  readPrefUpdatedAt,
  readRowLockFile,
  readShownFields,
  readSongConfirmFlags,
  readSongLinks,
  readSongPage,
  readSongStateFlags,
  readSongUpdatedAt,
  readStoryConfirmFlags,
  readStoryUpdatedAt,
  readStudioShell,
  rememberConfirmed,
  sealActFile,
  shownFileExists,
  shownFilePath,
  shownFileRel,
  shownFileUpdatedAt,
  slotRewriteOpen,
  stampOpenRepairs,
  writeExactShown,
  writeRowLockFile,
  writeShownFields
};
export type { EncFillEvent, EncFillJob, EncMeta, EncPkg, EncPref, EncyclopediaDump } from "./encyclopedia-types";
