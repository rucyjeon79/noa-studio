import { formatAudioAnalysis, formatAudioLevel, holdSavedLevel, parseAudioAnalysis, parseAudioLevel, type AudioAnalysis, type SavedLevel } from "@/lib/loudness";
import { readResultFile, pinShownAudioFile } from "@/lib/pages";

export type TrackFile = {
  kind: "song" | "story" | "cover";
  genreId: string;
  ep: string;
  title: string;
  storyId: string;
};

export function songOfTrack(id: string): TrackFile | null {
  const ep = /^suno:ep:([^:]+):(\d{1,2})$/.exec(id);
  if (ep) {
    const n = ep[2].padStart(2, "0");
    if (!ep[1] || !n) return null;
    return { kind: "song", genreId: ep[1], ep: n, title: "", storyId: "" };
  }
  const story = /^suno:story:([^:]+):([^:]+):([^:]+)$/.exec(id);
  if (!story || !story[1]) return null;
  let title = "";
  let storyId = "";
  try {
    title = decodeURIComponent(story[2]);
    storyId = decodeURIComponent(story[3]);
  } catch {
    return null;
  }
  if (!title || !storyId) return null;
  return { kind: story[1] === "cover-reborn" ? "cover" : "story", genreId: story[1], ep: "", title, storyId };
}

function fieldsOf(saved: unknown) {
  if (!saved || typeof saved !== "object") return null;
  const row = saved as { fields?: Record<string, string>; result?: { fields?: Record<string, string> } };
  if (row.fields && typeof row.fields === "object") return row.fields;
  if (row.result?.fields && typeof row.result.fields === "object") return row.result.fields;
  return null;
}

function tellLevel(song: TrackFile, text: string, analysis = "") {
  if (typeof window === "undefined") return;
  if (!text && !analysis) return;
  window.dispatchEvent(new CustomEvent("noa-audio-level", { detail: { ...song, text, analysis } }));
}

export async function primePlayFile(id: string) {
  const song = songOfTrack(id);
  if (!song) return { sunoUrl: "", needLevel: true, needAnalysis: true };
  try {
    const saved = await readResultFile({ data: { kind: song.kind, genreId: song.genreId, ep: song.ep, act: 0, title: song.title } });
    const fields = fieldsOf(saved);
    const sunoUrl = String(fields?.sunoUrl || "").trim();
    const levelText = String(fields?.audioLevel || "").trim();
    const analysisText = String(fields?.audioAnalysis || "").trim();
    const level = parseAudioLevel(levelText);
    const analysis = parseAudioAnalysis(analysisText);
    if (level) holdSavedLevel(id, level, analysis?.liftDb);
    if (levelText || analysisText) tellLevel(song, levelText, analysisText);
    return { sunoUrl, needLevel: !level, needAnalysis: !analysis };
  } catch {
    return { sunoUrl: "", needLevel: true, needAnalysis: true };
  }
}

export async function pullSavedLevel(id: string) {
  const song = songOfTrack(id);
  if (!song) return null;
  try {
    const saved = await readResultFile({ data: { kind: song.kind, genreId: song.genreId, ep: song.ep, act: 0, title: song.title } });
    const fields = fieldsOf(saved);
    const level = parseAudioLevel(fields?.audioLevel);
    const analysis = parseAudioAnalysis(fields?.audioAnalysis);
    if (level) holdSavedLevel(id, level, analysis?.liftDb);
    if (level || analysis) tellLevel(song, String(fields?.audioLevel || ""), String(fields?.audioAnalysis || ""));
    return level;
  } catch {
    return null;
  }
}

async function pinEmptyPair(song: TrackFile, audioLevel: string, audioAnalysis: string) {
  if (!audioLevel && !audioAnalysis) return;
  const names = song.kind === "song" ? [""] : [...new Set([song.title, song.storyId].map((item) => item.trim()).filter(Boolean))];
  for (const title of names) {
    await pinShownAudioFile({
      data: {
        kind: song.kind,
        genreId: song.genreId,
        ep: song.ep,
        act: 0,
        title,
        audioLevel,
        audioAnalysis,
      },
    });
  }
}

export async function pushSavedLevel(id: string, level: SavedLevel, analysis: AudioAnalysis | null = null) {
  const song = songOfTrack(id);
  if (!song || !Number.isFinite(level.lufs) || !Number.isFinite(level.gainDb)) return;
  const audioLevel = formatAudioLevel(level);
  const audioAnalysis = analysis && parseAudioAnalysis(formatAudioAnalysis(analysis)) ? formatAudioAnalysis(analysis) : "";
  tellLevel(song, audioLevel, audioAnalysis);
  try {
    await pinEmptyPair(song, audioLevel, audioAnalysis);
  } catch {
    /* the next open reads the file again */
  }
}
