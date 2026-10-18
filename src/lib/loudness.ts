export const LOUDNESS_TARGET = -14;
export const PEAK_CEILING = -1;

export type LoudnessMark = {
  id: string;
  lufs: number | null;
  gainDb: number;
  peakCutDb: number;
  masterLiftDb?: number;
  ready: boolean;
};

const cache = new Map<string, LoudnessMark>();
const jobs = new Map<string, Promise<number | null>>();
const fileLocks = new Set<string>();
const liveLocks = new Set<string>();
const watchers = new Set<() => void>();
const markWatchers = new Set<() => void>();
let current: LoudnessMark | null = null;
let markRev = 0;

export function readLoudness() {
  return current;
}

export function watchLoudness(onChange: () => void) {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

export function readMarkRev() {
  return markRev;
}

export function watchMarks(onChange: () => void) {
  markWatchers.add(onChange);
  return () => {
    markWatchers.delete(onChange);
  };
}

function bumpMarks() {
  markRev += 1;
  markWatchers.forEach((notify) => notify());
}

function publish(mark: LoudnessMark | null) {
  current = mark;
  watchers.forEach((notify) => notify());
  bumpMarks();
}

type Coeff = { b0: number; b1: number; b2: number; a1: number; a2: number };
type Memory = { z1: number; z2: number };

function highShelf(fs: number): Coeff {
  const f0 = 1681.974450955533;
  const gain = 3.999843853973347;
  const q = 0.7071752369554196;
  const a = 10 ** (gain / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = a * (a + 1 + (a - 1) * cos + 2 * Math.sqrt(a) * alpha);
  const b1 = -2 * a * (a - 1 + (a + 1) * cos);
  const b2 = a * (a + 1 + (a - 1) * cos - 2 * Math.sqrt(a) * alpha);
  const a0 = a + 1 - (a - 1) * cos + 2 * Math.sqrt(a) * alpha;
  const a1 = 2 * (a - 1 - (a + 1) * cos);
  const a2 = a + 1 - (a - 1) * cos - 2 * Math.sqrt(a) * alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function highPass(fs: number): Coeff {
  const f0 = 38.13547087602444;
  const q = 0.5003270373238773;
  const w0 = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function step(x: number, c: Coeff, m: Memory) {
  const y = c.b0 * x + m.z1;
  m.z1 = c.b1 * x - c.a1 * y + m.z2;
  m.z2 = c.b2 * x - c.a2 * y;
  return y;
}

export function measureChannels(channels: Float32Array[], sampleRate: number) {
  const usable = channels.filter((ch) => ch.length > 0).slice(0, 2);
  if (!usable.length || sampleRate < 8000) return null;
  const length = usable.reduce((n, ch) => Math.min(n, ch.length), usable[0].length);
  const take = Math.min(length, Math.floor(sampleRate * 120));
  if (take < Math.floor(sampleRate * 0.4)) return null;
  const shelf = highShelf(sampleRate);
  const pass = highPass(sampleRate);
  const shelfMem = usable.map(() => ({ z1: 0, z2: 0 }));
  const passMem = usable.map(() => ({ z1: 0, z2: 0 }));
  const block = Math.round(sampleRate * 0.4);
  const hop = Math.max(1, Math.round(sampleRate * 0.1));
  const energies = new Float64Array(block);
  let sum = 0;
  let pos = 0;
  let seen = 0;
  const blocks: number[] = [];
  for (let i = 0; i < take; i += 1) {
    let power = 0;
    for (let c = 0; c < usable.length; c += 1) {
      const y = step(step(usable[c][i] || 0, shelf, shelfMem[c]), pass, passMem[c]);
      power += y * y;
    }
    sum -= energies[pos];
    energies[pos] = power;
    sum += power;
    pos = (pos + 1) % block;
    seen += 1;
    if (seen >= block && (seen - block) % hop === 0) blocks.push(sum / block);
  }
  if (!blocks.length) return null;
  const absEnergy = 10 ** ((-70 + 0.691) / 10);
  const gated = blocks.filter((energy) => energy > absEnergy && Number.isFinite(energy));
  if (!gated.length) return null;
  const mean = (list: number[]) => list.reduce((total, n) => total + n, 0) / list.length;
  const relative = -0.691 + 10 * Math.log10(mean(gated)) - 10;
  const relEnergy = 10 ** ((relative + 0.691) / 10);
  const kept = gated.filter((energy) => energy >= relEnergy);
  if (!kept.length) return null;
  const lufs = -0.691 + 10 * Math.log10(mean(kept));
  return Number.isFinite(lufs) ? lufs : null;
}

type LiveMeter = {
  rate: number;
  shelf: Memory[];
  pass: Memory[];
  peak: number;
  sum: number;
  pos: number;
  seen: number;
  energies: Float64Array;
  blocks: number[];
  block: number;
  hop: number;
};

const liveMeters = new Map<string, LiveMeter>();

export function feedLoudness(id: string, buffer: AudioBuffer) {
  if (!id || fileLocks.has(id) || liveLocks.has(id) || jobs.has(id) || buffer.length < 1) return;
  const rate = buffer.sampleRate;
  let meter = liveMeters.get(id);
  if (!meter || meter.rate !== rate) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const block = Math.round(rate * 0.4);
    meter = {
      rate,
      shelf: Array.from({ length: channels }, () => ({ z1: 0, z2: 0 })),
      pass: Array.from({ length: channels }, () => ({ z1: 0, z2: 0 })),
      peak: 0,
      sum: 0,
      pos: 0,
      seen: 0,
      energies: new Float64Array(block),
      blocks: [],
      block,
      hop: Math.max(1, Math.round(rate * 0.1)),
    };
    liveMeters.set(id, meter);
  }
  const shelf = highShelf(rate);
  const pass = highPass(rate);
  const channels = Math.min(buffer.numberOfChannels, meter.shelf.length);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i += 1) {
    let power = 0;
    for (let c = 0; c < channels; c += 1) {
      const sample = data[c][i] || 0;
      const abs = sample < 0 ? -sample : sample;
      if (abs > meter.peak) meter.peak = abs;
      const y = step(step(sample, shelf, meter.shelf[c]), pass, meter.pass[c]);
      power += y * y;
    }
    meter.sum -= meter.energies[meter.pos];
    meter.energies[meter.pos] = power;
    meter.sum += power;
    meter.pos = (meter.pos + 1) % meter.block;
    meter.seen += 1;
    if (meter.seen >= meter.block && (meter.seen - meter.block) % meter.hop === 0) meter.blocks.push(meter.sum / meter.block);
  }
  if (meter.seen < rate * 3 || meter.blocks.length < 4) return;
  const lufs = gatedLufs(meter.blocks);
  if (lufs == null) return;
  const peakDb = meter.peak < 1e-8 ? -60 : 20 * Math.log10(meter.peak);
  const mark = remember(id, lufs, peakDb);
  fireReady(id, mark.gainDb);
  if (meter.seen > rate * 20) liveLocks.add(id);
}

function gatedLufs(blocks: number[]) {
  if (!blocks.length) return null;
  const absEnergy = 10 ** ((-70 + 0.691) / 10);
  const gated = blocks.filter((energy) => energy > absEnergy && Number.isFinite(energy));
  if (!gated.length) return null;
  const mean = (list: number[]) => list.reduce((total, n) => total + n, 0) / list.length;
  const relative = -0.691 + 10 * Math.log10(mean(gated)) - 10;
  const relEnergy = 10 ** ((relative + 0.691) / 10);
  const kept = gated.filter((energy) => energy >= relEnergy);
  if (!kept.length) return null;
  const lufs = -0.691 + 10 * Math.log10(mean(kept));
  return Number.isFinite(lufs) ? lufs : null;
}

export function gainForLufs(lufs: number) {
  const raw = LOUDNESS_TARGET - lufs;
  if (!Number.isFinite(raw) || Math.abs(raw) < 0.05) return 0;
  return Math.max(-60, Math.min(60, raw));
}

export function measurePeakDb(channels: Float32Array[]) {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i += 1) {
      const sample = ch[i];
      const abs = sample < 0 ? -sample : sample;
      if (abs > peak) peak = abs;
    }
  }
  if (peak < 1e-8) return -60;
  return 20 * Math.log10(peak);
}

export function peakCutFor(peakDb: number, gainDb: number) {
  const over = peakDb + gainDb - PEAK_CEILING;
  if (!Number.isFinite(over) || over <= 0.02) return 0;
  return Math.min(60, Math.max(0, over));
}

export function linearGain(db: number) {
  return 10 ** (db / 20);
}

export type SavedLevel = { lufs: number; gainDb: number; peakCutDb: number };

const savedByUrl = new Map<string, SavedLevel>();
const urlWatchers = new Set<() => void>();

export function rememberUrlLevel(url: string, level: SavedLevel | null) {
  const key = String(url || "").trim();
  if (!key) return;
  if (!level || !Number.isFinite(level.gainDb)) savedByUrl.delete(key);
  else savedByUrl.set(key, level);
  urlWatchers.forEach((notify) => notify());
}

export function readUrlLevel(url: string) {
  return savedByUrl.get(String(url || "").trim()) || null;
}

export function watchUrlLevel(onChange: () => void) {
  urlWatchers.add(onChange);
  return () => {
    urlWatchers.delete(onChange);
  };
}

export function holdSavedLevel(id: string, level: SavedLevel, liftDb?: number) {
  if (!id || !Number.isFinite(level.gainDb)) return null;
  const prev = cache.get(id);
  const mark: LoudnessMark = {
    id,
    lufs: Number.isFinite(level.lufs) ? level.lufs : LOUDNESS_TARGET,
    gainDb: level.gainDb,
    peakCutDb: Number.isFinite(level.peakCutDb) ? level.peakCutDb : 0,
    masterLiftDb: Number.isFinite(liftDb) ? Math.max(0, liftDb as number) : (prev?.masterLiftDb ?? 0),
    ready: true,
  };
  cache.set(id, mark);
  fileLocks.add(id);
  if (current?.id === id) publish(mark);
  else bumpMarks();
  return mark;
}

function remember(id: string, lufs: number | null, peakDb: number | null = null, file = false, quiet = false, masterLiftDb?: number) {
  const gainDb = lufs == null ? 0 : gainForLufs(lufs);
  const peakCutDb = lufs == null || peakDb == null ? 0 : peakCutFor(peakDb, gainDb);
  const prev = cache.get(id);
  const lift = masterLiftDb == null ? (prev?.masterLiftDb ?? 0) : (Number.isFinite(masterLiftDb) ? Math.max(0, masterLiftDb) : 0);
  const mark: LoudnessMark = { id, lufs, gainDb, peakCutDb, masterLiftDb: lift, ready: lufs != null };
  if (lufs != null) cache.set(id, mark);
  else cache.delete(id);
  if (file && lufs != null) fileLocks.add(id);
  if (!quiet || current?.id === id) publish(mark);
  else bumpMarks();
  return mark;
}

export function markFor(id: string) {
  if (!id) return null;
  return cache.get(id) || (current?.id === id ? current : null);
}

export function outputDbOf(mark: LoudnessMark | null | undefined) {
  if (!mark?.ready || mark.lufs == null || !Number.isFinite(mark.gainDb)) return null;
  const cut = Number.isFinite(mark.peakCutDb) ? mark.peakCutDb : 0;
  return mark.gainDb - cut;
}

export const ARC_DEG_PER_DB = 60;
export const LEVEL_RED = "#ff5a5a";
export const LEVEL_BLUE = "#2f7bff";
export const LEVEL_YELLOW = "#f5c400";
const LEVEL_WHITE = "#ffffff";
const LEVEL_IDLE = "#3a3a3a";

export function dialSpans(mark: LoudnessMark | null | undefined) {
  const ready = Boolean(mark?.ready && mark.lufs != null);
  const lift = ready ? Math.max(0, mark?.masterLiftDb ?? 0) : 0;
  const trim = ready ? Math.abs(mark?.gainDb ?? 0) : 0;
  const peak = ready ? Math.max(0, mark?.peakCutDb ?? 0) : 0;
  const redDeg = lift >= 0.45 ? -Math.min(300, lift * ARC_DEG_PER_DB) : 0;
  const blueDeg = trim >= 0.45 ? Math.min(300, trim * ARC_DEG_PER_DB) : 0;
  const peakSpan = peak >= 0.25 ? Math.min(300, peak * ARC_DEG_PER_DB) : 0;
  const peakDeg = peakSpan <= 0 ? 0 : blueDeg === 0 ? peakSpan : Math.min(blueDeg, peakSpan);
  return { redDeg, blueDeg, peakDeg, lift, trim, peak };
}

export function playBarColor(mark: LoudnessMark | null | undefined) {
  if (!mark?.ready || mark.lufs == null) return LEVEL_IDLE;
  const parts: { color: string; value: number }[] = [];
  const lift = Math.max(0, mark.masterLiftDb ?? 0);
  const trim = Math.abs(mark.gainDb ?? 0);
  const peak = Math.max(0, mark.peakCutDb ?? 0);
  if (lift >= 0.45) parts.push({ color: LEVEL_RED, value: lift });
  if (trim >= 0.45) parts.push({ color: LEVEL_BLUE, value: trim });
  if (peak >= 0.25) parts.push({ color: LEVEL_YELLOW, value: peak });
  if (!parts.length) return LEVEL_WHITE;
  if (parts.length === 1) return parts[0].color;
  const mean = parts.reduce((sum, part) => sum + part.value, 0) / parts.length;
  const rank = (color: string) => (color === LEVEL_BLUE ? 0 : color === LEVEL_RED ? 1 : 2);
  let best = parts[0];
  let bestDist = Math.abs(parts[0].value - mean);
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i];
    const dist = Math.abs(part.value - mean);
    const closer = dist < bestDist - 0.001;
    const tied = Math.abs(dist - bestDist) <= 0.001;
    const prefer = part.value > best.value + 0.001 || (Math.abs(part.value - best.value) <= 0.001 && rank(part.color) < rank(best.color));
    if (closer || (tied && prefer)) {
      best = part;
      bestDist = dist;
    }
  }
  return best.color;
}

export function formatAudioLevel(level: SavedLevel) {
  const n = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
  return `lufs=${n(level.lufs)};gain=${n(level.gainDb)};peak=${n(Math.max(0, level.peakCutDb))}`;
}

export type AudioAnalysis = { lufs: number; peakDb: number; liftDb: number };

export function formatAudioAnalysis(analysis: AudioAnalysis) {
  const n = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
  return `lufs=${n(analysis.lufs)};peak=${n(analysis.peakDb)};lift=${n(Math.max(0, analysis.liftDb))}`;
}

export function parseAudioAnalysis(raw: unknown): AudioAnalysis | null {
  const text = String(raw ?? "");
  const lufs = Number(text.match(/lufs=(-?\d+(?:\.\d+)?)/)?.[1]);
  const peakDb = Number(text.match(/peak=(-?\d+(?:\.\d+)?)/)?.[1]);
  const liftDb = Number(text.match(/lift=(-?\d+(?:\.\d+)?)/)?.[1]);
  if (![lufs, peakDb, liftDb].every((value) => Number.isFinite(value))) return null;
  if (lufs < -70 || lufs > 5 || peakDb < -60 || peakDb > 12 || liftDb < 0 || liftDb > 40) return null;
  return { lufs, peakDb, liftDb };
}

export function analysisCaption(raw: unknown) {
  const analysis = parseAudioAnalysis(raw);
  if (!analysis) return "";
  const peak = `${analysis.peakDb > 0 ? "+" : ""}${analysis.peakDb.toFixed(1)} dB`;
  const lift = analysis.liftDb >= 0.05 ? `마스터 +${analysis.liftDb.toFixed(1)} dB` : "마스터 0.0 dB";
  return `원음 LUFS ${analysis.lufs.toFixed(1)}, 피크 ${peak}, ${lift}`;
}

export function parseAudioLevel(raw: unknown): SavedLevel | null {
  const text = String(raw ?? "");
  const lufs = Number(text.match(/lufs=(-?\d+(?:\.\d+)?)/)?.[1]);
  const gainDb = Number(text.match(/gain=(-?\d+(?:\.\d+)?)/)?.[1]);
  const peakCutDb = Number(text.match(/peak=(-?\d+(?:\.\d+)?)/)?.[1]);
  if (![lufs, gainDb, peakCutDb].every((value) => Number.isFinite(value))) return null;
  if (lufs < -70 || lufs > 5 || Math.abs(gainDb) > 60 || peakCutDb < 0 || peakCutDb > 60) return null;
  return { lufs, gainDb, peakCutDb };
}

export function audioLevelCaption(raw: unknown) {
  const level = parseAudioLevel(raw);
  if (!level) return "";
  const gain = Math.abs(level.gainDb) < 0.05 ? "0.0" : `${level.gainDb > 0 ? "+" : ""}${level.gainDb.toFixed(1)}`;
  const peak = level.peakCutDb >= 0.05 ? `피크 -${level.peakCutDb.toFixed(1)} dB` : "피크 0.0 dB";
  return `마스터 50 · LUFS ${level.lufs.toFixed(1)} → -14 (${gain} dB), ${peak}, Peak -1`;
}

export function cachedGainDb(id: string) {
  const known = cache.get(id);
  return known?.ready ? known.gainDb : null;
}

export function showLoudness(id: string) {
  if (!id) return;
  const known = cache.get(id);
  if (known) {
    publish(known);
    return;
  }
  if (current?.id !== id) publish({ id, lufs: null, gainDb: 0, peakCutDb: 0, ready: false });
}

export function prepareLoudness(id: string, src: string): Promise<number | null> {
  if (!id || !src || typeof fetch !== "function") return Promise.resolve(null);
  showLoudness(id);
  if (fileLocks.has(id)) {
    const known = cache.get(id);
    if (known) fireReady(id, known.gainDb);
    return Promise.resolve(known ? known.gainDb : null);
  }
  const pending = jobs.get(id);
  if (pending) return pending;
  const job = (async () => {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("audio");
      const bytes = await response.arrayBuffer();
      const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!Offline) return null;
      const ctx = new Offline(1, 1, 44100);
      const audio = await ctx.decodeAudioData(bytes.slice(0));
      const channels: Float32Array[] = [];
      const count = Math.min(2, audio.numberOfChannels);
      const take = Math.min(audio.length, Math.floor(audio.sampleRate * 120));
      for (let c = 0; c < count; c += 1) channels.push(audio.getChannelData(c).slice(0, take));
      const lufs = measureChannels(channels, audio.sampleRate);
      const peakDb = measurePeakDb(channels);
      if (lufs != null) {
        const mark = remember(id, lufs, peakDb, true);
        fireReady(id, mark.gainDb);
        return mark.gainDb;
      }
      return null;
    } catch {
      if (current?.id === id && !cache.get(id)) publish({ id, lufs: null, gainDb: 0, peakCutDb: 0, ready: false });
      return null;
    } finally {
      jobs.delete(id);
    }
  })();
  jobs.set(id, job);
  return job;
}

let readyFns = new Set<(id: string, gainDb: number) => void>();

function fireReady(id: string, gainDb: number) {
  readyFns.forEach((fn) => {
    try { fn(id, gainDb); } catch { /* one listener does not stop the others */ }
  });
}

export function onLoudnessReady(fn: (id: string, gainDb: number) => void) {
  readyFns.add(fn);
  return () => {
    readyFns.delete(fn);
  };
}

export const MASTER_INTENSITY = 50;

type MasteredPlay = { url: string; level: SavedLevel; analysis: string; measuredLufs: number; measuredPeak: number; masterLiftDb: number };
const masteredPlay = new Map<string, MasteredPlay>();

export function masteredAnalysis(id: string) {
  return masteredPlay.get(id)?.analysis || "";
}
const masterJobs = new Map<string, Promise<MasteredPlay | null>>();
let foregroundId = "";
let quietGen = 0;

export function focusMaster(id: string) {
  foregroundId = id || "";
  quietGen += 1;
}

export function releaseForeground(id: string) {
  if (!id || foregroundId === id) foregroundId = "";
}

function quietStale(ticket: number, id: string) {
  return ticket !== quietGen && id !== foregroundId;
}

function waitTurn(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function wavBlob(buffer: AudioBuffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const rate = buffer.sampleRate;
  const length = buffer.length;
  const bytes = 44 + length * channels * 2;
  const raw = new ArrayBuffer(bytes);
  const view = new DataView(raw);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * channels * 2, true);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, data[c][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([raw], { type: "audio/wav" });
}

async function masterBuffer(audio: AudioBuffer) {
  const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) return null;
  const t = MASTER_INTENSITY / 100;
  const ctx = new Offline(Math.min(2, audio.numberOfChannels), audio.length, audio.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = audio;
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 120;
  low.gain.value = 3 * t;
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 8000;
  high.gain.value = 2.4 * t;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 8;
  comp.ratio.value = 1 + 3 * t;
  comp.attack.value = 0.012;
  comp.release.value = 0.14;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  const drive = 1 + t;
  const wet = 0.35 * t;
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    const y = Math.tanh(x * drive) / Math.tanh(drive);
    curve[i] = x * (1 - wet) + y * wet;
  }
  shaper.curve = curve;
  shaper.oversample = "2x";
  src.connect(low);
  low.connect(high);
  high.connect(comp);
  comp.connect(shaper);
  shaper.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

async function renderTarget(audio: AudioBuffer, gainDb: number, ceilingDb: number) {
  const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) return null;
  const gain = linearGain(gainDb);
  const ceiling = linearGain(ceilingDb);
  if (!Number.isFinite(gain) || gain <= 0 || !Number.isFinite(ceiling) || ceiling <= 0) return null;
  const channels = Math.min(2, audio.numberOfChannels);
  const ctx = new Offline(channels, audio.length, audio.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = audio;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = x > ceiling ? ceiling : x < -ceiling ? -ceiling : x;
  }
  shaper.curve = curve;
  shaper.oversample = "none";
  src.connect(amp);
  amp.connect(shaper);
  shaper.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

export function prepareMastered(id: string, src: string, quiet = false): Promise<MasteredPlay | null> {
  if (!id || !src || typeof fetch !== "function") return Promise.resolve(null);
  const cached = masteredPlay.get(id);
  if (cached) {
    if (Number.isFinite(cached.measuredLufs)) remember(id, cached.measuredLufs, cached.measuredPeak, true, quiet, cached.masterLiftDb);
    return Promise.resolve(cached);
  }
  const pending = masterJobs.get(id);
  if (pending) return pending;
  const ticket = quietGen;
  const job = (async () => {
    try {
      if (quiet) {
        while (foregroundId && foregroundId !== id) {
          await waitTurn(40);
          if (quietStale(ticket, id)) return null;
        }
        if (quietStale(ticket, id)) return null;
      }
      const response = await fetch(src);
      if (quiet && quietStale(ticket, id)) return null;
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      if (quiet && quietStale(ticket, id)) return null;
      const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!Offline) return null;
      const probe = new Offline(1, 1, 44100);
      const decoded = await probe.decodeAudioData(bytes.slice(0));
      if (quiet && quietStale(ticket, id)) return null;
      const rawCount = Math.min(2, decoded.numberOfChannels);
      const rawChannels: Float32Array[] = [];
      for (let c = 0; c < rawCount; c += 1) rawChannels.push(decoded.getChannelData(c));
      const beforeLufs = measureChannels(rawChannels, decoded.sampleRate);
      if (quiet && quietStale(ticket, id)) return null;
      const mastered = await masterBuffer(decoded);
      if (quiet && quietStale(ticket, id)) return null;
      if (!mastered) return null;
      const count = Math.min(2, mastered.numberOfChannels);
      const channels: Float32Array[] = [];
      for (let c = 0; c < count; c += 1) channels.push(mastered.getChannelData(c));
      const lufs = measureChannels(channels, mastered.sampleRate);
      const peakDb = measurePeakDb(channels);
      if (lufs == null || peakDb == null) return null;
      const gainDb = gainForLufs(lufs);
      const peakCutDb = peakCutFor(peakDb, gainDb);
      const masterLiftDb = beforeLufs != null ? Math.max(0, lufs - beforeLufs) : 0;
      if (quiet && quietStale(ticket, id)) return null;
      const played = await renderTarget(mastered, gainDb, PEAK_CEILING);
      if (quiet && quietStale(ticket, id)) return null;
      if (!played) return null;
      const playedChannels: Float32Array[] = [];
      for (let c = 0; c < Math.min(2, played.numberOfChannels); c += 1) playedChannels.push(played.getChannelData(c));
      const outPeak = measurePeakDb(playedChannels);
      const level = {
        lufs,
        gainDb,
        peakCutDb,
      };
      if (outPeak != null && outPeak > PEAK_CEILING + 0.8) return null;
      if (!parseAudioLevel(formatAudioLevel(level))) return null;
      const analysis = beforeLufs != null
        ? formatAudioAnalysis({ lufs: beforeLufs, peakDb: measurePeakDb(rawChannels), liftDb: masterLiftDb })
        : "";
      const analysisText = parseAudioAnalysis(analysis) ? analysis : "";
      if (quiet && quietStale(ticket, id)) return null;
      const url = URL.createObjectURL(wavBlob(played));
      const prev = masteredPlay.get(id);
      if (prev?.url) URL.revokeObjectURL(prev.url);
      if (masteredPlay.size > 2) {
        const oldest = masteredPlay.keys().next().value;
        if (oldest && oldest !== id) {
          const row = masteredPlay.get(oldest);
          if (row?.url) URL.revokeObjectURL(row.url);
          masteredPlay.delete(oldest);
        }
      }
      const row = { url, level, analysis: analysisText, measuredLufs: lufs, measuredPeak: peakDb, masterLiftDb };
      masteredPlay.set(id, row);
      remember(id, lufs, peakDb, true, quiet && foregroundId !== id, masterLiftDb);
      fireReady(id, gainDb);
      return row;
    } catch {
      return null;
    } finally {
      masterJobs.delete(id);
    }
  })();
  masterJobs.set(id, job);
  return job;
}
