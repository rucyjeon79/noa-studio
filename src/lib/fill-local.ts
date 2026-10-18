import {
  EPS,
  formatTimedTracklist,
  genreWantsSuno,
  getAct,
  getGenre,
  padEp,
  playlistTitlePrefix,
  type GenreId,
} from "./catalog";
import { geminiIdentityLine, idsForThumbCast, type ThumbCast } from "./characters";
import { sungLyrics, descriptionWithoutLyrics, descriptionWithTracklist, cleanDescriptionLyrics, isSectionTag, stripProductionCommands } from "./lyrics-clean";
import { normalizePackage, normalizePlaylist, isUserFrozen, hasPageBody, lyricsAreThisSong, STUDIO_BLOCKS, sameTitleText, closeTitleText, titleOwnedByOtherEp, foreignSongTitleIn, fieldBorrowed, type PlaylistPackage, type StudioPackage, tidyYoutubeTitle } from "./package";
import { readPref, readFieldAudit, defaultActOutput, defaultOutput, langScope, prefOutputLang, type GenrePref } from "./user-prefs";
import { getOriginal } from "./originals";

export function assignLockedTitle(pkg: StudioPackage, _pref: GenrePref, _originalTitle: string, _locks: Record<string, boolean> = {}): StudioPackage {
  return pkg;
}

export function localFillPlaylist(input: {
  act: number;
  genreId: GenreId;
  extraTracks?: { n: string; title: string; blurb?: string }[];
  prefs: GenrePref;
  thumbCast: ThumbCast;
}): PlaylistPackage {
  const act = getAct(input.act);
  const genre = getGenre(input.genreId);
  const p = input.prefs;
  const prefix = playlistTitlePrefix(act);
  const named = input.extraTracks ?? [];
  const tracks = formatTimedTracklist(act.n, named.map((item) => ({ n: item.n, title: item.title })));
  const blurbs = named.map((item) => item.blurb?.trim() || "").filter(Boolean).slice(0, 4);
  const mood = `${genre.youtubeLabel} Act.${act.n}`;
  const summary = blurbs.length ? `${prefix}\n\n${blurbs.join("\n")}` : `${prefix} · ${genre.label}`;
  const identity = geminiIdentityLine(idsForThumbCast(input.thumbCast));
  const gemini = [
    "Create a 16:9 photorealistic cinematic YouTube thumbnail, premium music album artwork, high-end, atmospheric, sophisticated.",
    `Playlist overlay: ${prefix}.`,
    `Mood: ${mood}. Genre: ${genre.youtubeLabel}. World of the Act, not one song. No tracklist on the image.`,
    genre.thumbnail,
    identity,
    `Photoreal ${p.reality}%. Character motion ${p.motion}/100.`,
    p.focus === "character" ? "CHARACTER-FIRST. Face uncovered." : "TEXT-FIRST. Title leads.",
    "No text over eyes, nose, mouth. No logos, watermarks, extra captions, artist names.",
    "Negative prompt: logos, watermarks, extra captions, anime, illustration, CGI faces.",
    "Aspect ratio: 16:9",
  ].join(" ");
  const youtubeTitle = `${prefix} | ${mood} | ${genre.youtubeLabel} | AI Artist Noa`.slice(0, 100);
  const out = p.output ?? defaultOutput(input.genreId);
  return normalizePlaylist({
    summary: out.summary === false ? "" : summary,
    confirmedTitle: out.title === false ? "" : prefix,
    tracklist: tracks,
    sunoStyle: out.suno === false ? "" : `cinematic ${genre.youtubeLabel}, playlist arc, emotional, high quality mix`,
    geminiPrompt: out.thumb === false ? "" : gemini,
    youtubeTitle: out.ytTitle === false ? "" : youtubeTitle,
    youtubeDescription: out.ytDesc === false ? "" : descriptionWithTracklist(summary, tracks),
    communityPost: p.community && out.letter !== false ? `${genre.fanLetter ?? "별무리"}, ${prefix}` : "",
    thumbUrl: "",
    thumbCast: input.thumbCast,
  });
}

export function localStoryPlaylist(input: {
  theme: string;
  songs: { title: string }[];
  prefs: GenrePref;
  thumbCast: ThumbCast;
  genreId?: string;
}): PlaylistPackage {
  const cover = input.genreId === "cover-reborn";
  const series = cover ? "재탄생, 유명곡 커버" : "당신의 이야기, 우리의 음악";
  const theme = input.theme.trim() || (cover ? "커버 플레이리스트" : "사연 플레이리스트");
  const p = input.prefs;
  const out = p.actOutput ?? defaultActOutput();
  const timed = input.songs.map((song) => song.title.trim()).filter(Boolean).join("\n");
  const summary = `${theme} · ${series}`;
  const identity = geminiIdentityLine(idsForThumbCast(input.thumbCast));
  const gemini = [
    "Create a 16:9 photorealistic cinematic YouTube thumbnail, premium music album artwork.",
    `Playlist theme: ${theme}.`,
    cover ? "Famous-song cover playlist. Not a personal story. No tracklist on the image." : "World of several personal stories, not one song. No tracklist on the image.",
    identity,
    `Photoreal ${p.reality}%. Character motion ${p.motion}/100.`,
    p.focus === "character" ? "CHARACTER-FIRST. Face uncovered." : "TEXT-FIRST. Title leads.",
    "No logos, watermarks, extra captions, artist names. Aspect ratio: 16:9",
  ].join(" ");
  const youtubeTitle = `${theme} | ${series} | AI Artist Noa`.slice(0, 100);
  return normalizePlaylist({
    summary: out.summary === false ? "" : summary,
    confirmedTitle: out.title === false ? "" : theme,
    tracklist: timed,
    sunoStyle: "",
    geminiPrompt: out.thumb === false ? "" : gemini,
    youtubeTitle: out.ytTitle === false ? "" : youtubeTitle,
    youtubeDescription: out.ytDesc === false ? "" : descriptionWithTracklist(summary, timed),
    communityPost: p.community && out.letter !== false ? `별무리, ${theme}` : "",
    thumbUrl: "",
    thumbCast: input.thumbCast,
  });
}

export function isSloppySummary(pkg: StudioPackage | null | undefined) {
  if (!pkg) return true;
  const rule = readFieldAudit();
  const summary = pkg.summary.trim();
  const title = pkg.confirmedTitle.trim();
  if (!summary) return true;
  if (!rule.summaryRuled) return false;
  if (rule.summaryBan && summary.includes(rule.summaryBan)) return true;
  if (rule.summaryTitleRepeat && title && (summary === title || sameTitleText(summary, title))) return true;
  if (summary.length < rule.summaryMin) return true;
  const lines = summary.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length < rule.summaryLines) return true;
  const sentences = summary.split(/[.。!?!\n]/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (sentences.length < rule.summarySentences) return true;
  return false;
}

function lyricsOnlyTitle(sung: string, title: string) {
  const a = sung.replace(/\s+/g, " ").trim();
  const b = title.replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  if (a === b || a === `${b} ${b}`) return true;
  const rest = a.split(b).join("").replace(/\s+/g, "").trim();
  return rest.length < 8;
}

export function isSloppyLyrics(pkg: StudioPackage | null | undefined) {
  if (!pkg) return true;
  const rule = readFieldAudit();
  const lyrics = stripProductionCommands(pkg.lyricsBlock);
  const title = pkg.confirmedTitle.trim();
  if (!lyrics) return true;
  const sung = lyrics.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]{0,80}\)/g, " ").replace(/\s+/g, " ").trim();
  if (!sung) return true;
  if (rule.lyricsTitleRepeat && title && lyricsOnlyTitle(sung, title)) return true;
  const tags = [...lyrics.matchAll(/\[[^\]\n]{1,48}\]/g)].filter((hit) => isSectionTag(hit[0].slice(1, -1))).length;
  const bodyLines = lyrics
    .split(/\n/)
    .map((line) => line.replace(/\[[^\]]*\]/g, "").replace(/\([^)]{0,80}\)/g, "").trim())
    .filter((line) => line.length > 1);
  const needLines = Math.max(1, rule.lyricsSections * Math.max(1, rule.lyricsLines));
  if (sung.length < rule.lyricsMin) return true;
  if (tags < rule.lyricsSections && bodyLines.length < needLines) return true;
  if (bodyLines.length < needLines) return true;
  return false;
}

export type FieldFix = "empty" | "rewrite" | "revise" | "ok";

export function fieldFix(pkg: StudioPackage | null | undefined, id: string): FieldFix {
  if (!pkg) return "empty";
  const rule = readFieldAudit();
  const text =
    id === "summary" ? pkg.summary
    : id === "title" ? pkg.confirmedTitle
    : id === "lyrics" ? pkg.lyricsBlock
    : id === "suno" ? pkg.sunoStyle
    : id === "thumb" ? pkg.geminiPrompt
    : id === "yt-title" ? pkg.youtubeTitle
    : id === "yt-desc" ? pkg.youtubeDescription
    : id === "letter" ? pkg.fanLetter
    : "";
  const body = text.trim();
  if (!body) return "empty";
  if (id === "lyrics") {
    if (!isSloppyLyrics(pkg)) return "ok";
    const sung = body.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]{0,80}\)/g, " ").replace(/\s+/g, " ").trim();
    const tags = [...body.matchAll(/\[[^\]\n]{1,48}\]/g)].filter((hit) => isSectionTag(hit[0].slice(1, -1))).length;
    return sung.length < rule.lyricsMin || tags < rule.lyricsSections ? "rewrite" : "revise";
  }
  if (id === "summary") {
    if (!isSloppySummary(pkg)) return "ok";
    const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return rule.summaryRuled && (body.length < rule.summaryMin || lines.length < rule.summaryLines) ? "rewrite" : "revise";
  }
  if (id === "yt-desc") {
    const prose = descriptionWithoutLyrics(body).trim();
    const paras = prose.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return prose.length < rule.descMin || paras.length < rule.descParas ? "rewrite" : "revise";
  }
  if (id === "letter") {
    const paras = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return body.length < rule.letterMin || paras.length < rule.letterParas ? "rewrite" : "revise";
  }
  if (id === "suno") return body.length < rule.sunoMin || body.length > rule.sunoMax ? "rewrite" : "revise";
  if (id === "thumb") return body.length < rule.thumbMin ? "rewrite" : "revise";
  return body.length < rule.titleMin ? "rewrite" : "revise";
}

export function isStubPackage(pkg: StudioPackage | null | undefined) {
  if (!pkg) return true;
  if (!pkg.confirmedTitle.trim() && !pkg.lyricsBlock.trim()) return true;
  return isSloppySummary(pkg) || isSloppyLyrics(pkg);
}

export function isCompletePackage(pkg: StudioPackage | null | undefined) {
  if (!pkg || isStubPackage(pkg)) return false;
  return Boolean(pkg.confirmedTitle.trim() && pkg.lyricsBlock.trim() && pkg.geminiPrompt.trim());
}

export function requiredStudioFields(genreId: GenreId, pref: GenrePref) {
  const out = pref.output ?? defaultOutput(genreId);
  const fields: { id: string; key: keyof StudioPackage }[] = [];
  if (out.summary) fields.push({ id: "summary", key: "summary" });
  if (out.title) fields.push({ id: "title", key: "confirmedTitle" });
  if (out.lyrics) fields.push({ id: "lyrics", key: "lyricsBlock" });
  if (out.suno) fields.push({ id: "suno", key: "sunoStyle" });
  if (out.thumb) fields.push({ id: "thumb", key: "geminiPrompt" });
  if (out.ytTitle) fields.push({ id: "yt-title", key: "youtubeTitle" });
  if (out.ytDesc) fields.push({ id: "yt-desc", key: "youtubeDescription" });
  if (out.letter) fields.push({ id: "letter", key: "fanLetter" });
  return fields;
}

const FILL_LEAD = ["title", "lyrics", "yt-title", "yt-desc", "letter", "community"];

export function byFillLead<T extends { id: string }>(fields: T[]): T[] {
  return fields
    .map((field, index) => ({ field, index, lead: FILL_LEAD.indexOf(field.id) }))
    .sort((a, b) => {
      const ar = a.lead < 0 ? FILL_LEAD.length : a.lead;
      const br = b.lead < 0 ? FILL_LEAD.length : b.lead;
      if (ar !== br) return ar - br;
      return a.index - b.index;
    })
    .map((row) => row.field);
}

function youtubeTitleProblems(
  text: string,
  pref: GenrePref,
  ctx: { ep: string; title: string; genre: string },
) {
  const format = (pref.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa").trim();
  const problems: string[] = [];
  const raw = text.trim();
  if (raw.length < 8 || raw.length > 100) problems.push("length");
  if (/확정 제목|감성 한줄|장르라벨|EP\.번호/.test(raw)) problems.push("token");
  const parts = raw.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
  const used = new Set<number>();
  const take = (pred: (part: string) => boolean) => {
    const index = parts.findIndex((part, i) => !used.has(i) && pred(part));
    if (index < 0) return "";
    used.add(index);
    return parts[index] ?? "";
  };
  if (format.includes("EP.번호")) {
    const want = String(Number(ctx.ep.replace(/\D/g, "") || "0"));
    const hit = take((part) => {
      const found = part.match(/^EP\.(\d+)$/i);
      if (!found) return false;
      return !want || want === "0" || String(Number(found[1])) === want;
    });
    if (!hit) problems.push("ep");
  }
  if (format.includes("확정 제목") && ctx.title.trim()) {
    if (!take((part) => part === ctx.title || sameTitleText(part, ctx.title))) problems.push("title");
  }
  if (format.includes("장르라벨") && ctx.genre.trim()) {
    const genre = ctx.genre.trim();
    if (!take((part) => part === genre || part.includes(genre) || sameTitleText(part, genre))) problems.push("genre");
  }
  if (/AI Artist Noa/i.test(format) && !take((part) => /AI Artist Noa/i.test(part))) problems.push("brand");
  if (format.includes("감성 한줄")) {
    const mood = parts.find((_, index) => !used.has(index)) ?? "";
    if (
      !mood ||
      closeTitleText(mood, ctx.title) ||
      closeTitleText(mood, ctx.genre) ||
      /^EP\.\d+$/i.test(mood) ||
      /AI Artist Noa/i.test(mood)
    ) {
      problems.push("mood");
    }
  }
  if (parts.some((part, index) => parts.slice(0, index).some((prev) => closeTitleText(prev, part)))) problems.push("repeat");
  return problems;
}

function titleStillSourceLang(text: string, lang: "ko" | "ja" | "en" | "th") {
  if (lang === "ko") return false;
  const hangul = (text.match(/[가-힣]/g) || []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const thai = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (lang === "ja") return hangul >= 2 && kana < 2;
  if (lang === "th") return hangul >= 2 && thai < 2;
  return hangul >= 2 && latin < 3;
}

function mentionsOtherEp(text: string, epN: string, ownTitle = "") {
  const mine = padEp(epN);
  const mineNum = String(Number(mine || "0"));
  const body = text || "";
  const own = ownTitle.trim().toLowerCase();
  if (!mine || !body.trim()) return false;
  const slots = body.split(/\s*\|\s*|\n+/).map((part) => part.trim()).filter(Boolean);
  for (const item of EPS) {
    if (item.n === mine) continue;
    const title = item.title.trim();
    if (title.length < 4) continue;
    const key = title.toLowerCase();
    if (own && (own === key || own.includes(key) || key.includes(own))) continue;
    if (slots.some((slot) => slot.toLowerCase() === key)) return true;
  }
  const found = body.match(/EP\.?\s*0*(\d+)/gi) || [];
  return found.some((token) => {
    const num = String(Number((token.match(/(\d+)/) || [])[1] || "0"));
    return num !== "0" && num !== mineNum;
  });
}

function forcedTitle(_genreId: GenreId | undefined, _epN: string | undefined, _pref: GenrePref) {
  return "";
}

function spokenLang(pref: GenrePref, genreId?: GenreId) {
  return prefOutputLang(genreId ?? "kpop-original", pref.lang);
}

function langTarget(fieldId: string, pref: GenrePref) {
  if (fieldId === "summary") return "summary";
  if (fieldId === "title") return "title";
  if (fieldId === "lyrics") return "lyrics";
  if (fieldId === "yt-title") return "ytTitle";
  if (fieldId === "yt-desc") return "desc";
  if (fieldId === "letter") return "letter";
  return "";
}

function inLangScope(fieldId: string, pref: GenrePref) {
  const target = langTarget(fieldId, pref);
  if (!target) return false;
  return langScope(pref.langRule || "").has(target);
}

function wrongSpokenLang(text: string, lang: "ko" | "ja" | "en" | "th") {
  if (lang === "ko") return false;
  const body = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/EP\.\d+/gi, " ")
    .replace(/AI Artist Noa/gi, " ");
  const hangul = (body.match(/[가-힣]/g) || []).length;
  const kana = (body.match(/[\u3040-\u30ff]/g) || []).length;
  const thai = (body.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latin = (body.match(/[A-Za-z]/g) || []).length;
  if (lang === "ja") return kana < 4 && hangul > 8;
  if (lang === "th") return thai < 4 && hangul > 8;
  return latin < 12 && hangul > 8;
}

function fieldKind(
  pkg: StudioPackage,
  field: { id: string; key: keyof StudioPackage },
  pref: GenrePref,
  genreId?: GenreId,
  epN?: string,
): "empty" | "sloppy" | "ok" {
  const rule = readFieldAudit(pref);
  const text = String(pkg[field.key] ?? "").trim();
  if (!text) return "empty";
  if (genreId && epN && fieldBorrowed(genreId, epN, field.id, text, pref.sunoBase)) return "sloppy";
  if (epN && field.id !== "title" && foreignSongTitleIn(text, epN, pkg.confirmedTitle)) return "sloppy";
  if (field.id === "thumb" && /USER SETTINGS LOCK/i.test(text)) return "sloppy";
  const lang = spokenLang(pref, genreId);
  const lockedTitle = field.id === "title" && (Boolean(forcedTitle(genreId, epN, pref)) || pref.titleMode === "lock");
  if (!lockedTitle && inLangScope(field.id, pref) && wrongSpokenLang(text, lang)) return "sloppy";
  if (field.id === "summary" && isSloppySummary(pkg)) return "sloppy";
  if (field.id === "lyrics" && isSloppyLyrics(pkg)) return "sloppy";
  if (field.id === "lyrics" && genreId && genreId !== "kpop-original" && epN) {
    const src = (getOriginal(epN)?.lyrics || "").trim();
    if (src) {
      const bare = (value: string) => value.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
      const made = bare(text);
      const from = bare(src);
      if (from.length > 40 && made.slice(0, 80) === from.slice(0, 80)) return "sloppy";
    }
  }
  if (field.id === "title") {
    if ((pkg.userEdited || []).includes("title")) {
      if (epN && titleOwnedByOtherEp(text, epN)) return "sloppy";
      return "ok";
    }
    if (epN && titleOwnedByOtherEp(text, epN)) return "sloppy";
    if (epN && mentionsOtherEp(text, epN, text)) return "sloppy";
    if (!lockedTitle && pref.titleMode === "rewrite" && titleStillSourceLang(text, lang)) return "sloppy";
    if (text.length < rule.titleMin || (rule.titleJunk && TITLE_JUNK.test(text))) return "sloppy";
    const locked = forcedTitle(genreId, epN, pref);
    if (locked && text !== locked) return "sloppy";
    if (!locked && inLangScope("title", pref) && wrongSpokenLang(text, lang)) return "sloppy";
    if (!locked && pref.titleMode === "rewrite" && epN) {
      const orig = getOriginal(epN)?.title?.trim() || "";
      const fold = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣\u3040-\u30ff\u4e00-\u9faf\u0e00-\u0e7f]/g, "");
      if (orig && fold(text) === fold(orig)) return "sloppy";
    }
  }
  if (field.id === "suno") {
    const base = String(pref.sunoBase || "").trim().replace(/\s+/g, " ");
    const flat = text.replace(/\s+/g, " ");
    if (text.length > rule.sunoMax && base && flat === base) return "ok";
    if (text.length < rule.sunoMin || text.length > rule.sunoMax) return "sloppy";
  }
  if (field.id === "thumb") {
    if (text.length < rule.thumbMin) return "sloppy";
    if (epN && mentionsOtherEp(text, epN, pkg.confirmedTitle)) return "sloppy";
  }
  if (field.id === "yt-title") {
    if (epN && mentionsOtherEp(text, epN, pkg.confirmedTitle)) return "sloppy";
    const genre = pref.thumbGenreLine.trim() || (genreId ? getGenre(genreId).youtubeLabel : "");
    if (youtubeTitleProblems(text, pref, { ep: epN || "", title: pkg.confirmedTitle, genre }).length) return "sloppy";
  }
  if (field.id === "yt-desc") {
    if (epN && mentionsOtherEp(text, epN, pkg.confirmedTitle)) return "sloppy";
    const sung = sungLyrics(pkg.lyricsBlock);
    let prose = descriptionWithoutLyrics(text);
    if (sung.length > 40) prose = prose.replace(sung, "");
    prose = prose.trim();
    const paras = prose.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (prose.length < rule.descMin || paras.length < rule.descParas) return "sloppy";
    if (rule.descEmoji && !/\p{Extended_Pictographic}/u.test(prose)) return "sloppy";
    if (pref.descLyrics && sung.length > 20) {
      const marked = /━{4,}\s*\n(?:가사|歌詞|Lyrics|เนื้อเพลง)\n/.test(text);
      const leaked = /\[[^\]]*(?:Verse|Chorus|Intro|Bridge|Outro|Female Vocal|Male Vocal|Duet)[^\]]*\]/i.test(text);
      if (!marked || leaked) return "sloppy";
    }
    if (!pref.descLyrics && /━{4,}/.test(text)) return "sloppy";
  }
  if (field.id === "letter") {
    if (epN && mentionsOtherEp(text, epN, pkg.confirmedTitle)) return "sloppy";
    const paras = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (text.length < rule.letterMin || paras.length < rule.letterParas) return "sloppy";
    if (rule.letterEmoji && !/\p{Extended_Pictographic}/u.test(text)) return "sloppy";
  }
  return "ok";
}

export function fillRank(
  genreId: GenreId,
  pkg: StudioPackage | null | undefined,
  _original?: { title?: string; lyrics?: string },
  confirmed?: boolean,
  epN?: string,
  pref?: GenrePref,
  locksOverride?: Record<string, boolean>,
) {
  const use = pref ?? readPref(genreId);
  if (confirmed && readFieldAudit(use).skipConfirmed) return 0;
  const fields = requiredStudioFields(genreId, use);
  void locksOverride;
  if (!pkg || !hasPageBody(pkg)) return 1;
  const kinds = fields.map((field) => fieldKind(pkg, field, use, genreId, epN));
  const empty = kinds.filter((kind) => kind === "empty").length;
  const sloppy = kinds.filter((kind) => kind === "sloppy").length;
  if (!fields.length || empty === fields.length) return 1;
  const lyrics = fields.some((field) => field.id === "lyrics")
    ? fieldKind(pkg, { id: "lyrics", key: "lyricsBlock" }, use, genreId, epN)
    : "ok";
  if (lyrics === "sloppy") return 2;
  if (empty > 0) return 3;
  if (sloppy > 0) return 4;
  return 0;
}

export function sealPassedSong(_genreId: GenreId, _epN: string, _pkg: StudioPackage | null | undefined) {
  return;
}

const FIELD_LABEL: Record<string, string> = {
  summary: "요약",
  title: "확정 제목",
  lyrics: "가사",
  suno: "SUNO",
  thumb: "썸네일",
  "yt-title": "유튜브",
  "yt-desc": "설명",
  letter: "커뮤니티",
};

export function auditStudioFields(genreId: GenreId, pkg: StudioPackage | null | undefined, pref?: GenrePref, epN?: string) {
  const use = pref ?? readPref(genreId);
  const fields = requiredStudioFields(genreId, use);
  return fields.map((field) => ({
    ...field,
    label: FIELD_LABEL[field.id] || field.id,
    kind: (pkg ? fieldKind(pkg, field, use, genreId, epN) : "empty") as "empty" | "sloppy" | "ok",
  }));
}

export function patchStudioFields(cur: StudioPackage, gen: StudioPackage, ids: string[]) {
  const next = { ...cur };
  const wanted = new Set(ids);
  for (const block of STUDIO_BLOCKS) {
    if (!wanted.has(block.id)) continue;
    const incoming = String(gen[block.key] ?? "").trim();
    if (incoming) (next[block.key] as string) = String(gen[block.key] ?? "");
  }
  return normalizePackage(next);
}

export function shouldAutoFill(
  genreId: GenreId,
  pkg: StudioPackage | null | undefined,
  original?: { title?: string; lyrics?: string },
  confirmed?: boolean,
  pref?: GenrePref,
  locksOverride?: Record<string, boolean>,
  epN?: string,
) {
  return fillRank(genreId, pkg, original, confirmed, epN, pref, locksOverride) !== 0;
}

const TITLE_JUNK = /고정|원제 유지|번역.?금지|개명 금지|제목 형식|형식 토큰|100자|그대로 쓴다|무엇을 잠갔|작업 메모/;

export function pickMoodLine(
  pkg: { summary?: string; geminiPrompt?: string; youtubeTitle?: string },
  title: string,
  ep: string,
  genre: string,
) {
  const skip = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length < 4) return "";
    if (TITLE_JUNK.test(t)) return "";
    if (foreignSongTitleIn(t, ep, title)) return "";
    if (t === title || sameTitleText(t, title) || t === `EP.${ep}` || t === `EP.${ep.replace(/^0/, "")}` || t === genre || t === "AI Artist Noa") {
      return "";
    }
    if (/^EP\.\d+/i.test(t) && t.includes(title)) return "";
    return t.split(/[.。!?\n]/)[0]?.trim().slice(0, 40) ?? "";
  };
  const chunks = (pkg.summary ?? "")
    .split(/[\n.。!?]/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const line = skip(chunk);
    if (line) return line;
  }
  const gemini = pkg.geminiPrompt ?? "";
  const quoted =
    gemini.match(/mood line\s+"([^"]{4,80})"/i)?.[1] ||
    gemini.match(/감성 한줄[^"]*"([^"]{4,80})"/)?.[1] ||
    gemini.match(/smaller "[^"]*"[\s\S]{0,40}?"([^"]{4,80})"/i)?.[1];
  const fromGemini = quoted ? skip(quoted) : "";
  if (fromGemini) return fromGemini;
  return "";
}

function moodFromYoutubeTitle(
  text: string,
  pref: GenrePref,
  ctx: { ep: string; title: string; genre: string },
) {
  const title = ctx.title.trim();
  if (!title || !text.includes(title)) return "";
  const format = (pref.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa").trim();
  const parts = text.trim().split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
  const used = new Set<number>();
  const take = (pred: (part: string) => boolean) => {
    const index = parts.findIndex((part, i) => !used.has(i) && pred(part));
    if (index < 0) return;
    used.add(index);
  };
  if (format.includes("EP.번호")) {
    const want = String(Number(ctx.ep.replace(/\D/g, "") || "0"));
    take((part) => {
      const found = part.match(/^EP\.(\d+)$/i);
      return Boolean(found) && (!want || want === "0" || String(Number(found?.[1])) === want);
    });
  }
  if (format.includes("확정 제목")) take((part) => part === title || sameTitleText(part, title));
  if (format.includes("장르라벨") && ctx.genre.trim()) {
    const genre = ctx.genre.trim();
    take((part) => part === genre || part.includes(genre) || sameTitleText(part, genre));
  }
  if (/AI Artist Noa/i.test(format)) take((part) => /AI Artist Noa/i.test(part));
  const mood = parts.find((_, index) => !used.has(index)) ?? "";
  if (!mood || mood === "이 곡의 장면" || mood === "この曲の場面" || mood === "a scene from this song" || mood === "ฉากของเพลงนี้") return "";
  if (closeTitleText(mood, title) || closeTitleText(mood, ctx.genre) || /^EP\.\d+$/i.test(mood) || /AI Artist Noa/i.test(mood)) return "";
  return mood;
}

function buildYoutubeTitle(format: string, parts: { ep: string; title: string; mood: string; genre: string }) {
  let mood = pickMoodLine({ summary: parts.mood }, parts.title, parts.ep, parts.genre) || parts.mood.trim();
  if (TITLE_JUNK.test(mood) || closeTitleText(mood, parts.title) || closeTitleText(mood, parts.genre)) mood = "";
  const fill = (moodLine: string) =>
    tidyYoutubeTitle(
      format
        .replace(/EP\.번호/g, `EP.${parts.ep}`)
        .replace(/확정 제목/g, parts.title)
        .replace(/감성 한줄/g, moodLine)
        .replace(/장르라벨/g, parts.genre),
    );
  let out = fill(mood);
  while (out.length > 100 && mood.length > 4) {
    mood = mood.slice(0, -1).trim();
    out = fill(mood);
  }
  if (out.length > 100) out = fill("");
  return out.length > 100 ? fill("").slice(0, 100) : out;
}

function descLyricSource(pkg: StudioPackage, ctx: { genreId?: string; epN: string }) {
  const gid = ctx.genreId || "";
  const ep = padEp(ctx.epN);
  const block = String(pkg.lyricsBlock || "");
  if (gid === "kpop-original" && ep) {
    const orig = getOriginal(ep)?.lyrics || "";
    if (orig.trim()) return orig;
  }
  if (block.trim() && (!gid || !ep || lyricsAreThisSong(gid, ep, block))) return block;
  return "";
}

export function applyPrefToStudio(
  pkg: StudioPackage,
  pref: GenrePref,
  ctx: { epN: string; lockedTitle?: string; genreLabel: string; moodOverride?: string; genreId?: GenreId },
  locks: Record<string, boolean> = {},
) {
  const next = { ...pkg };
  const edited = new Set(pkg.userEdited || []);
  const frozen = (id: string, text: string) => isUserFrozen(locks, id, text) || edited.has(id);
  const genreLine = pref.thumbGenreLine.trim() || ctx.genreLabel;
  const forced = ctx.lockedTitle?.trim() || "";
  if (forced) next.confirmedTitle = forced;
  const show = (key: "summary" | "title" | "lyrics" | "suno" | "thumb" | "ytTitle" | "ytDesc" | "letter", fallback = true) =>
    pref.output ? pref.output[key] !== false : fallback;
  if (show("ytDesc") && !frozen("yt-desc", next.youtubeDescription)) {
    if (foreignSongTitleIn(next.youtubeDescription, ctx.epN, next.confirmedTitle)) next.youtubeDescription = "";
    else if (pref.descLyrics) {
      const sung = descLyricSource(next, ctx);
      next.youtubeDescription = sung ? cleanDescriptionLyrics(next.youtubeDescription, sung) : descriptionWithoutLyrics(next.youtubeDescription);
    } else next.youtubeDescription = descriptionWithoutLyrics(next.youtubeDescription);
  }
  if (show("ytTitle") && !frozen("yt-title", next.youtubeTitle)) {
    const broken = youtubeTitleProblems(next.youtubeTitle, pref, {
      ep: ctx.epN,
      title: next.confirmedTitle,
      genre: genreLine,
    });
    const foreign = Boolean(ctx.epN && mentionsOtherEp(next.youtubeTitle, ctx.epN, next.confirmedTitle));
    if (broken.length || foreign) {
      const parts = next.youtubeTitle.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
      const third = parts[2] && parts[2] !== "이 곡의 장면" && !/^EP\.\d+$/i.test(parts[2]) && !/AI Artist Noa/i.test(parts[2]) ? parts[2] : "";
      const kept = moodFromYoutubeTitle(next.youtubeTitle, pref, {
        ep: ctx.epN,
        title: next.confirmedTitle,
        genre: genreLine,
      });
      const mood =
        ctx.moodOverride?.trim() ||
        kept ||
        third ||
        pickMoodLine({ summary: next.summary, geminiPrompt: next.geminiPrompt }, next.confirmedTitle, ctx.epN, genreLine);
      const spoken = prefOutputLang(ctx.genreId ?? "kpop-original", pref.lang);
      const moodFallback = spoken === "ja" ? "この曲の場面" : spoken === "en" ? "a scene from this song" : spoken === "th" ? "ฉากของเพลงนี้" : "이 곡의 장면";
      if (mood) {
        next.youtubeTitle = buildYoutubeTitle(pref.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa", {
          ep: ctx.epN,
          title: next.confirmedTitle,
          mood,
          genre: genreLine,
        });
      } else if (!next.youtubeTitle.trim()) {
        next.youtubeTitle = buildYoutubeTitle(pref.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa", {
          ep: ctx.epN,
          title: next.confirmedTitle,
          mood: moodFallback,
          genre: genreLine,
        });
      }
    }
  }
  if (show("suno", ctx.genreId ? genreWantsSuno(ctx.genreId) : true) && !frozen("suno", next.sunoStyle)) next.sunoStyle = mergeSuno(pref, next.sunoStyle);
  if (show("thumb") && !frozen("thumb", next.geminiPrompt)) next.geminiPrompt = enforceGemini(next.geminiPrompt, pref, genreLine, next.confirmedTitle);
  if (show("lyrics") && !frozen("lyrics", next.lyricsBlock) && foreignSongTitleIn(next.lyricsBlock, ctx.epN, next.confirmedTitle)) next.lyricsBlock = "";
  return next;
}

function mergeSuno(pref: GenrePref, style: string) {
  const base = pref.sunoBase.trim();
  const raw = style.trim();
  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  if (raw.length > 1000 || (base && raw.length >= 1000 && !same(raw, base))) return base || raw;
  let out = raw;
  const add = (piece: string) => {
    if (!piece) return;
    const mark = piece.slice(0, 24).toLowerCase();
    if (mark && out.toLowerCase().includes(mark)) return;
    const next = out ? `${out} ${piece}`.trim() : piece;
    if (next.length <= 1000) out = next;
  };
  if (base && !out.toLowerCase().includes(base.slice(0, 32).toLowerCase())) add(base);
  const vocal = pref.vocalStyle.trim();
  const music = pref.musicStyle.trim();
  add(vocal ? `Vocal: ${vocal}.` : "");
  add(music ? `Music: ${music}.` : "");
  return out.length > 1000 ? base || out : out;
}

function enforceGemini(prompt: string, pref: GenrePref, genreLine: string, songTitle = "") {
  void pref;
  void genreLine;
  let text = prompt.replace(/[^\S\n]*USER SETTINGS LOCK\s*(?:\([^)]*\))?\s*:?[^\n]*/gi, " ").trim();
  const song = songTitle.trim();
  if (!song || !text) return text;
  const lock = `Exact on-image song title, the largest text, these characters only, do not translate, do not replace with the genre: "${song}".`;
  text = text.replace(/Exact on-image song title, the largest text, these characters only, do not translate, do not replace with the genre: "[^"]*"\.?\s*/g, "");
  text = text.replace(/Song title overlay:\s*.+?(?=\s+Mood:|\s+Genre:)/g, () => `Song title overlay: ${song}.`);
  text = text.replace(/The largest on-image song title must be exactly "[^"]*"\./g, () => `The largest on-image song title must be exactly "${song}".`);
  text = text.replace(/dead-center largest the confirmed song title "[^"]*"/g, () => `dead-center largest the confirmed song title "${song}"`);
  if (!text.includes(song)) text = `Song title overlay: ${song}. ${text}`;
  if (/Mood:\s*[^.]{1,80}의 장면\./.test(text) && !text.includes(`Mood: ${song}`)) {
    text = text.replace(/Mood:\s*[^.]{1,80}의 장면\./, `Mood: ${song}.`);
  }
  return `${lock} ${text}`.replace(/\s{2,}/g, " ").trim();
}

export function forceThumbTitleText(prompt: string, songTitle: string) {
  return enforceGemini(prompt, { thumbGenreLine: "" } as GenrePref, "", songTitle);
}

function alignEpPrefix(title: string, epN: string) {
  const mine = String(Number(padEp(epN) || "0"));
  if (!mine || mine === "0") return title;
  if (!/^EP\.\d+/i.test(title)) return title;
  const found = title.match(/^EP\.(\d+)/i);
  if (!found || String(Number(found[1])) === mine) return title;
  return title.replace(/^EP\.\d+/i, `EP.${mine}`);
}

export function openFieldNotes(genreId: GenreId, epN: string, pkg: StudioPackage) {
  const pref = readPref(genreId);
  const genreLine = pref.thumbGenreLine.trim() || getGenre(genreId).youtubeLabel;
  return auditStudioFields(genreId, pkg, pref, epN).flatMap((field) => {
    if (field.kind === "ok") return [];
    const text = String(pkg[field.key] ?? "").trim();
    const title = pkg.confirmedTitle.trim();
    let cause = "규칙에 맞지 않다";
    if (!text) cause = "빈 칸. 원문이 없어 검사에서 짓지 않는다";
    else if (field.id !== "title" && foreignSongTitleIn(text, epN, title)) cause = "칸 전체가 다른 곡 제목이다";
    else if (field.id === "thumb") {
      if (/USER SETTINGS LOCK/i.test(text)) cause = "썸네일에 잠금 문구가 있다";
      else if (title && !thumbHasTitle(text, title)) cause = "썸네일이 확정 제목을 안 따른다";
      else if (mentionsOtherEp(text, epN, title)) cause = "썸네일에 다른 곡 번호가 있다";
      else cause = "썸네일이 길이 규칙보다 짧다";
    } else if (field.id === "yt-title") {
      const problems = youtubeTitleProblems(text, pref, { ep: epN, title, genre: genreLine });
      if (problems.includes("title")) cause = "유튜브 제목이 확정 제목과 다르다";
      else if (problems.includes("ep")) cause = "유튜브 제목의 EP 번호가 칸과 다르다";
      else if (problems.includes("mood")) cause = "유튜브 제목에 감성 한줄이 없다. 있는 문장으로 만들지 못해 짓지 않는다";
      else cause = "유튜브 제목이 형식에 맞지 않다";
    } else if (field.id === "lyrics") cause = "가사가 부실하거나 원문 그대로다. 검사에서 지어내지 않는다";
    else if (field.id === "title") cause = "제목이 다른 곡이거나 규칙에 맞지 않다";
    else if (field.id === "suno") cause = "수노가 길이 규칙을 벗어났다";
    else if (field.id === "yt-desc") cause = "설명란이 문단·이모지·길이 규칙에 부족하다";
    else if (field.id === "letter") cause = "커뮤니티가 문단·이모지·길이 규칙에 부족하다";
    else if (field.id === "summary") cause = "요약이 부실하다";
    return [{ label: field.label, kind: field.kind, cause }];
  });
}

function thumbHasTitle(raw: string, songTitle: string) {
  const title = songTitle.trim();
  if (!title || !raw) return false;
  if (raw.includes(title)) return true;
  const head = title.split(/\s*\|\s*/)[0]?.trim() || "";
  return head.length >= 4 && head !== title && raw.includes(head);
}

function pinThumbTitleOnly(prompt: string, songTitle: string) {
  const title = songTitle.trim();
  let text = prompt.replace(/[^\S\n]*USER SETTINGS LOCK\s*(?:\([^)]*\))?\s*:?[^\n]*/gi, " ").replace(/[ \t]{2,}/g, " ").trim();
  if (!title) return text;
  if (!thumbHasTitle(text, title)) {
    if (/Song title overlay:/i.test(text)) {
      text = text.replace(/Song title overlay:\s*.+?(?=\s+Mood:|\s+Genre:|$)/i, `Song title overlay: ${title}.`);
    } else if (/Playlist overlay:/i.test(text)) {
      text = text.replace(/Playlist overlay:\s*.+?(?=\s+Mood:|\s+Genre:|$)/i, `Playlist overlay: ${title}.`);
    } else {
      text = `Song title overlay: ${title}. ${text}`;
    }
  }
  return text.replace(/ {2,}/g, " ").trim();
}

function fixYoutubeSlots(text: string, epN: string, songTitle: string, format: string) {
  const raw = text.trim();
  const parts = raw.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
  const slots = format.split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return raw;
  let changed = false;
  if (format.includes("EP.번호") && /^EP\.\d+$/i.test(parts[0] || "")) {
    const mine = String(Number(padEp(epN) || "0"));
    const found = parts[0].match(/^EP\.(\d+)/i);
    if (found && mine && mine !== "0" && String(Number(found[1])) !== mine) {
      parts[0] = `EP.${mine}`;
      changed = true;
    }
  }
  const title = songTitle.trim();
  const aligned = parts.length === slots.length;
  if (aligned && title && !parts.some((part) => part === title || sameTitleText(part, title))) {
    const index = slots.findIndex((slot) => slot.includes("확정 제목"));
    if (index >= 0 && parts[index] && !/^EP\.\d+$/i.test(parts[index]) && !/AI Artist Noa/i.test(parts[index])) {
      parts[index] = title;
      changed = true;
    }
  }
  if (!changed) return raw;
  const next = parts.join(" | ");
  if (next.length <= 100) return next;
  if (format.includes("EP.번호") && /^EP\.\d+$/i.test(parts[0] || "")) {
    const kept = raw.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
    const mine = String(Number(padEp(epN) || "0"));
    const found = kept[0]?.match(/^EP\.(\d+)/i);
    if (found && mine && mine !== "0" && String(Number(found[1])) !== mine) {
      kept[0] = `EP.${mine}`;
      const epOnly = kept.join(" | ");
      if (epOnly.length <= 100) return epOnly;
    }
  }
  return raw;
}

export function repairOpenStudio(genreId: GenreId, epN: string, pkg: StudioPackage) {
  const pref = readPref(genreId);
  const edited = new Set(pkg.userEdited || []);
  const next = { ...pkg };
  const wrote: { field: string; cause: string }[] = [];
  if (!edited.has("title")) {
    const title = next.confirmedTitle.trim();
    const fixed = alignEpPrefix(title, epN);
    if (fixed !== title && !titleOwnedByOtherEp(fixed, epN)) {
      next.confirmedTitle = fixed;
      wrote.push({ field: "확정 제목", cause: "제목 앞 EP 번호가 저장 칸과 달랐다" });
    }
  }
  const title = next.confirmedTitle.trim();
  if (!edited.has("thumb") && next.geminiPrompt.trim() && title && pref.output?.thumb !== false) {
    const raw = next.geminiPrompt.trim();
    const locked = /USER SETTINGS LOCK/i.test(raw);
    const missingTitle = !thumbHasTitle(raw, title);
    if (locked || missingTitle) {
      const fixed = pinThumbTitleOnly(raw, title);
      if (fixed && fixed !== raw && thumbHasTitle(fixed, title) && !/USER SETTINGS LOCK/i.test(fixed)) {
        next.geminiPrompt = fixed;
        wrote.push({ field: "썸네일", cause: "확정 제목을 안 따르거나 잠금 문구가 있었다" });
      }
    }
  }
  if (!edited.has("yt-title") && next.youtubeTitle.trim() && title && pref.output?.ytTitle !== false) {
    const format = pref.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa";
    const fixed = fixYoutubeSlots(next.youtubeTitle, epN, title, format);
    if (fixed !== next.youtubeTitle.trim()) {
      next.youtubeTitle = fixed;
      wrote.push({ field: "유튜브 제목", cause: "앞 EP 번호나 확정 제목 칸만 달랐다" });
    }
  }
  return { next, wrote };
}

export function repairOpenPlaylistThumb(pkg: { confirmedTitle?: string; geminiPrompt?: string }) {
  const title = String(pkg.confirmedTitle || "").trim();
  const raw = String(pkg.geminiPrompt || "").trim();
  if (!title || !raw) return "";
  if (!/USER SETTINGS LOCK/i.test(raw) && thumbHasTitle(raw, title)) return "";
  const fixed = pinThumbTitleOnly(raw, title);
  if (!fixed || fixed === raw || !thumbHasTitle(fixed, title) || /USER SETTINGS LOCK/i.test(fixed)) return "";
  return fixed;
}
