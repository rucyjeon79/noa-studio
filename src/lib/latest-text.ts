/** 결과 칸의 최신 값. 더 늦은 시각의 글만 이전 글을 바꾼다. 빈 글은 최신 값이 아니다. */

export const LATEST_TEXT_KEYS = [
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
] as const;

export function readFieldStamps(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const raw = (body as { fieldSavedAt?: unknown }).fieldSavedAt;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string" || !Date.parse(value)) continue;
    out[key] = value;
  }
  return out;
}

export function stampChangedFields<T extends Record<string, unknown>>(
  prev: T | null | undefined,
  next: T,
  now = new Date().toISOString(),
  fresh = false,
): T {
  const prevStamps = readFieldStamps(prev);
  const nextStamps = readFieldStamps(next);
  const stamps = { ...prevStamps };
  const prior = (prev ?? {}) as Record<string, unknown>;
  let changed = false;
  for (const key of LATEST_TEXT_KEYS) {
    if (!(key in next) && !(key in prior)) continue;
    const prevText = String(prior[key] ?? "");
    const nextText = String(next[key] ?? "");
    const priorAt = Date.parse(prevStamps[key] || "") || 0;
    const incomingAt = Date.parse(nextStamps[key] || "") || 0;
    if (prevText === nextText) {
      if (incomingAt > priorAt && nextStamps[key]) stamps[key] = nextStamps[key];
      continue;
    }
    if (priorAt > 0 && incomingAt > 0 && incomingAt < priorAt && !fresh) continue;
    if (!fresh) {
      if (incomingAt > priorAt && nextStamps[key]) stamps[key] = nextStamps[key];
      continue;
    }
    let at = Date.parse(now) || Date.now();
    if (at <= priorAt) at = priorAt + 1;
    stamps[key] = new Date(at).toISOString();
    changed = true;
  }
  if (!changed && !Object.keys(stamps).length) return next;
  return { ...next, fieldSavedAt: stamps };
}

export function touchFieldStamp<T extends Record<string, unknown>>(body: T, key: string, now = Date.now()): T {
  const stamps = { ...readFieldStamps(body) };
  const priorAt = Date.parse(stamps[key] || "") || 0;
  const at = now > priorAt ? now : priorAt + 1;
  stamps[key] = new Date(at).toISOString();
  return { ...body, fieldSavedAt: stamps };
}

/** 이번 입력에 들어 있는 칸은 그 글이 최신이다. 파일에 있던 이전 글로 다시 덮지 않는다. */
export function mergeLatestBody(
  prev: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
  _blanks?: ReadonlySet<string>,
): Record<string, unknown> {
  if (!prev) return incoming;
  const out: Record<string, unknown> = { ...prev, ...incoming };
  const nextStamps = readFieldStamps(incoming);
  if (Object.keys(nextStamps).length) out.fieldSavedAt = { ...readFieldStamps(prev), ...nextStamps };
  return out;
}