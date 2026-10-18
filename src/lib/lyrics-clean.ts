const DIV = "━━━━━━━━━━━━━━━━━━━━";

/** 파일에 글자로 저장된 \n 을 화면용 줄바꿈으로만 바꾼다. 저장본은 건드리지 않는다. */
export function visibleBreaks(text: string) {
  let next = String(text ?? "");
  for (let i = 0; i < 4; i++) {
    const done = next.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\/n/g, "\n");
    if (done === next) break;
    next = done;
  }
  return next.replace(/\r\n/g, "\n");
}

const BRACKET_ONLY = /^(\[[^\]\n]+\]\s*)+$/;
const PAREN_EN = /^\([^)]+\)$/;
const SECTION_TAG =
  /^(?:intro|outro|verse|pre-?chorus|post-?chorus|chorus|bridge|hook|refrain|interlude|break|ending|rap|spoken|drop|final(?:\s+chorus)?|piano\s+solo|dance\s+break|bass\s+drop|instrumental)(?:\s*\d+|\s*[ivx]+)?$/i;
const VOCAL_TAG = /^(?:female|male|duet)(?:\s+vocal)?$/i;

export function isSectionTag(inner: string) {
  return SECTION_TAG.test(inner.trim());
}

/** 섹션·보컬 표기가 아닌 연주/믹스 지시. [clean electric piano solo] 같은 줄. */
export function isProductionCommandLine(line: string) {
  const t = line.trim();
  if (!t) return false;
  const bracket = t.match(/^\[([^\]\n]+)\]$/);
  if (bracket) {
    const inner = bracket[1].trim();
    if (isSectionTag(inner) || VOCAL_TAG.test(inner)) return false;
    return /piano|guitar|drum|bass|synth|pad|reverb|solo|mix|arrangement|percussion|kick|strings|flute|808|sidechain|ad-?lib/i.test(inner);
  }
  if (/[\u3040-\u30ff\u4e00-\u9faf가-힣ก-๙]/.test(t)) return false;
  return (
    (/^\([^)]+\)$/.test(t) && /piano|guitar|drum|vocal|pad|reverb|solo|mix|bass|synth/i.test(t)) ||
    /^(?:clean|distorted|soft|electric|acoustic|melodic|sustained).{0,80}\b(?:piano|guitar|solo|pad|drum|bass)\b/i.test(t)
  );
}

export function stripProductionCommands(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !isProductionCommandLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSunoCommand(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (BRACKET_ONLY.test(t)) return true;
  if (PAREN_EN.test(t) && /[A-Za-z]/.test(t) && !/[가-힣]/.test(t)) return true;
  return false;
}

function stripInlineSuno(line: string): string {
  return line
    .replace(/\[(?:female|male|duet)\s*vocal[^\]]*\]/gi, "")
    .replace(/\[[^\]]*(?:piano|guitar|drum|pad|beat|whisper|harmon(?:y|ies)|arrangement|percussion|solo)[^\]]*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+$/g, "");
}

const LYRIC_LETTER = /[가-힣\u3040-\u30ff\u4e00-\u9fafก-๙]/;

function stripBracketTags(text: string): string {
  return text.replace(/\[[^\]\n]{0,80}\]/g, (tag) => {
    const inner = tag.slice(1, -1).trim();
    if (!inner || LYRIC_LETTER.test(inner)) return tag;
    return /[A-Za-z]/.test(inner) ? "" : tag;
  });
}

function stripDirectionParens(text: string): string {
  return text.replace(/\((?:[^()\n가-힣\u3040-\u30ff\u4e00-\u9fafก-๙]{0,220}\n){0,4}[^()\n가-힣\u3040-\u30ff\u4e00-\u9fafก-๙]{0,220}\)/g, (block) => {
    const inner = block.slice(1, -1);
    if (LYRIC_LETTER.test(inner) || !/[A-Za-z]/.test(inner)) return block;
    return "";
  });
}

/** 부른 가사만. 수노 명령·섹션태그·보컬/악기 지시 제거. 같은 줄에 붙거나 다음 줄로 이어진 영문 지시도 뺀다. */
export function sungLyrics(raw: string): string {
  const text = stripDirectionParens(stripBracketTags(visibleBreaks(raw).replace(/\r\n/g, "\n")));
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (isSunoCommand(line)) continue;
    const cleaned = stripInlineSuno(line).trim();
    if (isSunoCommand(cleaned)) continue;
    kept.push(cleaned);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripCommandLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isSunoCommand(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** 설명란에서 가사 구간(━━ 사이)을 뺀다. */
export function descriptionWithoutLyrics(desc: string): string {
  const source = visibleBreaks(desc).replace(/\r\n/g, "\n");
  if (!source.includes(DIV)) return stripCommandLines(source).trim();
  const parts = source.split(DIV);
  const head = stripCommandLines(parts[0] ?? "").trim();
  const tail = stripCommandLines(parts[parts.length - 1] ?? "").trim();
  return [head, tail].filter(Boolean).join("\n\n").trim();
}

/** 곡 파일과 대조할 때 설명란 본문만. ━━ 사이 가사칸·ACT 트랙리스트는 빼 둔다. */
export function descriptionBodyForMatch(desc: string): string {
  const source = visibleBreaks(String(desc || "")).replace(/\r\n/g, "\n").trim();
  const parts = source.split(/━{4,}/);
  const head = (parts[0] ?? "").trim();
  const tail = parts.length > 2 ? (parts[parts.length - 1] ?? "").trim() : "";
  const prose = (parts.length === 1 ? source : [head, tail].filter(Boolean).join("\n\n")).trim();
  return prose
    .split("\n")
    .filter((line) => {
      const text = line.trim();
      if (!text) return true;
      if (isTrackLine(text) || isLyricMarker(text)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isTrackLine(line: string) {
  const text = line.trim();
  return /^\d{1,2}:\d{2}\s+\S/.test(text) || /^EP\.\d+\b/i.test(text);
}

const LYRIC_MARKERS = ["가사", "歌詞", "Lyrics", "เนื้อเพลง"] as const;

function isLyricMarker(line: string) {
  return LYRIC_MARKERS.includes(line.trim() as (typeof LYRIC_MARKERS)[number]);
}

/** 설명란 구분선 다음 줄. 가사 본문의 주사용 언어를 따른다. */
export function lyricMarkerFromText(text: string) {
  const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const hangul = (text.match(/[가-힣]/g) || []).length;
  const thai = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (thai >= 8 && thai > hangul && thai > kana) return "เนื้อเพลง";
  if (kana >= 8 && kana >= hangul) return "歌詞";
  if (hangul >= 4) return "가사";
  if (latin >= 12) return "Lyrics";
  return "가사";
}

function isPlainTitle(line: string) {
  const text = line.trim();
  if (!text || isLyricMarker(text)) return false;
  if (text.length > 80) return false;
  if (/[\[\]━.!?,。]/.test(text)) return false;
  return true;
}

function looksLikeTracklist(inner: string) {
  const hadLyric = isLyricMarker(inner.trim().split("\n")[0] ?? "");
  if (hadLyric) return false;
  const rawLines = inner.split("\n").map((line) => line.trim()).filter(Boolean);
  return rawLines.length > 0 && rawLines.every((line) => isTrackLine(line) || isPlainTitle(line));
}

function showTrackLine(line: string) {
  return line.trim().replace(/^\d{1,2}:\d{2}\s+/, "");
}

function dropTrackLines(text: string) {
  return text
    .split("\n")
    .filter((line) => !isTrackLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 곡 설명란의 가사 구간에 트랙리스트를 넣는다. 설명란 가사 설정과 무관하게 항상 넣는다. */
export function descriptionWithTracklist(description: string, timed: string) {
  const lines = timed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(showTrackLine)
    .filter(Boolean);
  const source = description.replace(/\r\n/g, "\n");
  let head = "";
  let tail = "";
  if (source.includes(DIV)) {
    const parts = source.split(DIV);
    head = dropTrackLines(stripCommandLines(parts[0] ?? ""));
    tail = dropTrackLines(stripCommandLines(parts[parts.length - 1] ?? ""));
  } else {
    head = dropTrackLines(stripCommandLines(source));
  }
  if (!lines.length) return [head, tail].filter(Boolean).join("\n\n").trim();
  const block = `${DIV}\n${lines.join("\n")}\n${DIV}`;
  return [head, block, tail].filter(Boolean).join("\n\n").trim();
}
function lyricBlock(inner: string) {
  const body = inner.replace(/^\s*(?:가사|歌詞|Lyrics|เนื้อเพลง)\s*\n+/, "").trim();
  if (!body) return "";
  return `${DIV}\n${lyricMarkerFromText(body)}\n${body}\n${DIV}`;
}

export function cleanDescriptionLyrics(desc: string, lyrics = ""): string {
  const sung = lyrics.trim() ? sungLyrics(lyrics) : "";
  const source = visibleBreaks(desc).replace(/\r\n/g, "\n");
  if (source.includes(DIV)) {
    const parts = source.split(DIV);
    const head = stripCommandLines(parts[0] ?? "").trim();
    const tail = stripCommandLines(parts[parts.length - 1] ?? "").trim();
    const inner = sung || sungLyrics(parts.slice(1, -1).join("\n"));
    const block = lyricBlock(inner);
    return [head, block, tail].filter(Boolean).join("\n\n").trim();
  }
  const cleaned = stripCommandLines(source).trim();
  const block = lyricBlock(sung);
  if (!block) return cleaned;
  return [cleaned, block].filter(Boolean).join("\n\n").trim();
}

/** 설명란에 이미 들어 있는 가사 구간만 부른 가사로 정리한다. 트랙리스트와 본문은 그대로 둔다. */
export function descriptionSungOnly(desc: string): string {
  const source = visibleBreaks(desc).replace(/\r\n/g, "\n").trim();
  if (!source.includes(DIV)) return source;
  const parts = source.split(DIV);
  const head = (parts[0] ?? "").trim();
  const tail = parts.length > 2 ? (parts[parts.length - 1] ?? "").trim() : "";
  const inner = parts.slice(1, -1).join("\n");
  if (looksLikeTracklist(inner)) return source;
  const sung = sungLyrics(inner);
  const block = lyricBlock(sung);
  if (!block) return [head, tail].filter(Boolean).join("\n\n").trim();
  return [head, block, tail].filter(Boolean).join("\n\n").trim();
}

export const COVER_TITLE_CREDIT = "Cover by AInoa";

/** 커버곡 유튜브 제목. 가수 자리는 입력한 원곡 가수만. 다른 이름으로 바꾸지 않는다. */
export function coverYoutubeTitle(raw: string, songTitle: string, artist: string): string {
  const title = songTitle.trim();
  const name = artist.trim();
  let text = raw.replace(/\s+/g, " ").replace(/\s*Cover by AInoa\s*/gi, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/^(?:[\s|｜]|[-–—])+|(?:[\s|｜])+$/g, "").trim();
  let mood = "";
  if (title && name) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rest = new RegExp(`^${esc}\\s*[-–—|｜]?\\s*`).test(text)
      ? text.replace(new RegExp(`^${esc}\\s*[-–—|｜]?\\s*`), "").trim()
      : text;
    const parts = rest.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
    const first = parts[0] ?? "";
    mood = (first && first.length <= 24 ? parts.slice(1) : parts).join(" | ");
    text = [`${title} - ${name}`, mood].filter(Boolean).join(" | ");
  } else if (title && name === "" && text.startsWith(title)) {
    text = text.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|\\s*`), `${title} - `);
  }
  const suffix = ` | ${COVER_TITLE_CREDIT}`;
  const room = 100 - suffix.length;
  const body = text.length > room ? text.slice(0, room).replace(/[\s|]+$/g, "").trim() : text;
  return `${body}${suffix}`.trim();
}

export const COVER_RIGHTS_LINE = "본 영상은 커버곡이며, 모든 저작권은 원저작권자에게 있습니다.";

function stripCoverCredit(text: string) {
  return text
    .replace(/^원곡 가수:.*$/gm, "")
    .replaceAll(COVER_RIGHTS_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 커버곡 설명란 끝에 원곡 가수와 저작권 문장을 한 번씩 붙인다. 가사 구간 안은 건드리지 않는다. */
export function withCoverCredit(desc: string, artist: string): string {
  const name = artist.trim();
  const credit = [name ? `원곡 가수: ${name}` : "", COVER_RIGHTS_LINE].filter(Boolean).join("\n");
  const source = visibleBreaks(desc).replace(/\r\n/g, "\n").trim();
  if (!source) return credit;
  if (source.includes(DIV)) {
    const parts = source.split(DIV);
    if (parts.length >= 3) {
      const head = stripCoverCredit(parts[0] ?? "");
      const tail = stripCoverCredit(parts[parts.length - 1] ?? "");
      const mid = parts.slice(1, -1).join(DIV).trim();
      const nextTail = [tail, credit].filter(Boolean).join("\n\n");
      return [head, `${DIV}\n${mid}\n${DIV}`, nextTail].filter(Boolean).join("\n\n").trim();
    }
  }
  return [stripCoverCredit(source), credit].filter(Boolean).join("\n\n").trim();
}

/** 잠금 화면에서 펼친 설명. 결과창 설명란 파일은 바꾸지 않고, 가사가 없으면 그 곡 가사만 붙여 보여 준다. */
export function listenDescription(desc: string, lyrics: string): string {
  const sung = sungLyrics(lyrics);
  const source = visibleBreaks(desc).replace(/\r\n/g, "\n").trim();
  if (!sung) return descriptionSungOnly(source);
  if (source.includes(DIV)) {
    const parts = source.split(DIV);
    if (looksLikeTracklist(parts.slice(1, -1).join("\n"))) return descriptionSungOnly(source);
  }
  return cleanDescriptionLyrics(descriptionWithoutLyrics(source), sung);
}
