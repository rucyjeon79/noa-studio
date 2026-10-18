import { focusMaster, formatAudioLevel, linearGain, markFor, masteredAnalysis, onLoudnessReady, outputDbOf, parseAudioAnalysis, prepareMastered, releaseForeground } from "@/lib/loudness";
import { primePlayFile, pullSavedLevel, pushSavedLevel, songOfTrack } from "@/lib/level-file";

export type MusicTrack = { id: string; url: string; title: string };

type Mode = "off" | "list" | "act";

type PlayerState = {
  mode: Mode;
  tracks: MusicTrack[];
  index: number;
  loopOne: boolean;
  paused: boolean;
};

type Hooks = {
  sounding: () => void;
  failed: () => void;
  ended: () => void;
  upcoming?: () => string;
  tick?: () => void;
};

const off: PlayerState = { mode: "off", tracks: [], index: 0, loopOne: false, paused: false };
let state: PlayerState = { ...off };
let video: HTMLAudioElement | null = null;
let standby: HTMLAudioElement | null = null;
let standbyId = "";
let failedId = "";
let aligned = false;
let placeWatch = false;
let handoff = false;
let switching = false;
let hooks: Hooks = { sounding: () => {}, failed: () => {}, ended: () => {} };
const watchers = new Set<() => void>();

function emit() {
  watchers.forEach((fn) => fn());
}

export function watchMusicPlayer(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

export function setMusicHooks(next: Hooks) {
  hooks = next;
}

export function readMusicPlayer() {
  const track = state.mode === "off" ? null : state.tracks[state.index] ?? null;
  return { ...state, track, sounding: bodySounding(), failed: Boolean(track && failedId === track.id) };
}

export function musicTracks() {
  return state.tracks;
}

export function setPhoneCard(_on: boolean) {
  if (!video) return;
  video.muted = false;
  video.defaultMuted = false;
  video.disableRemotePlayback = false;
}

function place(on: boolean) {
  if (typeof document === "undefined") return;
  document.body.style.paddingTop = "";
  if (!video) return;
  video.hidden = false;
  video.style.cssText = !on
    ? "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;"
    : "position:fixed;left:0;top:0;width:2px;height:2px;opacity:1;pointer-events:none;z-index:0;";
}

function bareAudio(id: string) {
  let el = document.getElementById(id) as HTMLAudioElement | null;
  if (el && (el.tagName !== "AUDIO" || el.dataset.direct !== "1" || el.dataset.native !== "1")) {
    try { el.pause(); } catch { /* drop the muted route */ }
    el.remove();
    el = null;
  }
  if (el) return el;
  el = document.createElement("audio");
  el.id = id;
  el.dataset.direct = "1";
  el.dataset.native = "1";
  el.preload = "auto";
  el.autoplay = false;
  el.controls = false;
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  el.disableRemotePlayback = false;
  el.setAttribute("playsinline", "");
  el.setAttribute("aria-label", "뮤직 플레이어");
  el.style.cssText = "position:fixed;left:0;bottom:0;width:8px;height:8px;opacity:0;pointer-events:none;z-index:0;";
  document.body.appendChild(el);
  return el;
}

function clipSrc(id: string) {
  const track = state.tracks.find((item) => item.id === id);
  const url = track?.url || "";
  if (/suno\.com|suno\.ai/i.test(url) || id.startsWith("suno:")) {
    return `/api/suno-audio?u=${encodeURIComponent(url || id.slice(5))}&e=2`;
  }
  return `/api/yt-audio?v=${encodeURIComponent(id)}`;
}

export function masteredClipSrc(id: string, pageUrl: string) {
  const url = String(pageUrl || "").trim();
  if (/suno\.com|suno\.ai/i.test(url) || id.startsWith("suno:")) {
    return `/api/suno-audio?u=${encodeURIComponent(url || id.replace(/^suno:/, ""))}&e=2`;
  }
  return `/api/yt-audio?v=${encodeURIComponent(id)}`;
}

export function masteredWavUrl(id: string, pageUrl: string) {
  if (!id || !pageUrl) return Promise.resolve("");
  return prepareMastered(id, masteredClipSrc(id, pageUrl)).then((ready) => ready?.url || "");
}

let audioCtx: AudioContext | null = null;
const gains = new WeakMap<HTMLAudioElement, GainNode>();
let playGen = 0;
let heardAt = 0;
let stealGen = 0;

function outputDb(id: string) {
  return outputDbOf(markFor(id));
}

function hushOthers(keep: HTMLAudioElement | null) {
  for (const id of ["music-player", "music-player-next"]) {
    const node = document.getElementById(id);
    if (!node || node === keep || node.tagName !== "AUDIO") continue;
    const el = node as HTMLAudioElement;
    const gain = gains.get(el);
    const ctx = audioCtx;
    if (gain && ctx) gain.gain.setValueAtTime(0, ctx.currentTime);
    el.volume = 0;
    try { el.pause(); } catch { /* the other song stops before this one starts */ }
  }
}

const meters = new WeakMap<HTMLAudioElement, { tap: ScriptProcessorNode; silent: GainNode }>();

function parkMeter(el: HTMLAudioElement | null, parked: boolean) {
  if (!el) return;
  const meter = meters.get(el);
  if (!meter) return;
  try {
    meter.tap.disconnect();
    if (!parked) meter.tap.connect(meter.silent);
  } catch {
    /* the meter returns when the page is visible */
  }
}

export function holdOutput() {
  if (state.paused || state.mode === "off") return;
  markPlayback();
  const el = video;
  if (!el || el.ended || !el.paused) return;
  const gen = ++stealGen;
  void el.play().then(() => {
    if (state.paused || el !== video || gen !== stealGen) {
      if (state.paused) {
        try { el.pause(); } catch { /* a real pause wins over a stolen resume */ }
      }
    }
  }, () => {});
}

function setTrackGain(el: HTMLAudioElement, id: string) {
  if (el.dataset.mastered === id) {
    el.volume = 1;
    return true;
  }
  const db = outputDb(id);
  if (db == null) {
    el.volume = 1;
    return false;
  }
  el.volume = Math.min(1, Math.max(0, linearGain(db)));
  return true;
}

function levelThen(el: HTMLAudioElement, id: string, run: () => void) {
  const gen = ++playGen;
  if (el.dataset.mastered === id && el.getAttribute("src")) {
    el.volume = 1;
    run();
    return;
  }
  focusMaster(id);
  void (async () => {
    const file = await primePlayFile(id);
    if (gen !== playGen) return;
    if (file.sunoUrl) {
      const track = state.tracks.find((item) => item.id === id);
      if (track) track.url = file.sunoUrl;
    }
    const ready = await prepareMastered(id, clipSrc(id));
    if (gen !== playGen) return;
    if (state.paused && !el.dataset.holdPlay) {
      releaseForeground(id);
      return;
    }
    if (el.dataset.yt !== id) {
      releaseForeground(id);
      return;
    }
    if (!ready?.url) {
      releaseForeground(id);
      failedId = id;
      hooks.failed();
      emit();
      return;
    }
    el.dataset.mastered = id;
    el.src = ready.url;
    el.volume = 1;
    delete el.dataset.holdPlay;
    if ((file.needLevel || file.needAnalysis) && ready.level) {
      void pushSavedLevel(id, ready.level, parseAudioAnalysis(ready.analysis));
    }
    run();
  })();
}

function playWhenLevel(el: HTMLAudioElement, id: string) {
  hushOthers(el);
  if (el.dataset.mastered !== id) el.dataset.holdPlay = "1";
  levelThen(el, id, () => {
    if (el.dataset.yt !== id) return;
    if (state.paused && !el.dataset.holdPlay) return;
    delete el.dataset.holdPlay;
    state = { ...state, paused: false };
    setTrackGain(el, id);
    startPlay(el);
  });
}

onLoudnessReady((id) => {
  if (video?.dataset.yt === id && !state.paused) setTrackGain(video, id);
  const mark = markFor(id);
  if (!mark?.ready || mark.lufs == null || mark.lufs < -70) return;
  const level = { lufs: mark.lufs, gainDb: mark.gainDb, peakCutDb: mark.peakCutDb };
  const text = formatAudioLevel(level);
  const analysis = parseAudioAnalysis(masteredAnalysis(id));
  const song = songOfTrack(id);
  const url = state.tracks.find((track) => track.id === id)?.url || "";
  if ((text || analysis) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("noa-audio-level", { detail: { ...(song || {}), id, text, analysis: analysis ? masteredAnalysis(id) : "", url } }));
  }
  void pushSavedLevel(id, level, analysis);
});

function parkStandby() {
  quietStandby();
  if (!standby || standby === video) return;
  standby.autoplay = false;
  standby.volume = 0;
  if (standby.getAttribute("src")) {
    try { standby.pause(); } catch { /* the song being measured must stay silent */ }
    standby.removeAttribute("src");
    standby.dataset.mastered = "";
    try { standby.load(); } catch { /* drop any buffered sound */ }
  }
}

let warmGen = 0;
let warmToken = "";

function queueToken() {
  const id = state.tracks[state.index]?.id || "";
  return `${state.mode}:${id}:${state.tracks.map((track) => track.id).join("|")}`;
}

function stopWarm() {
  warmGen += 1;
  warmToken = "";
}

function currentIsPlayingMastered() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (!el || !id || state.paused || state.mode === "off") return false;
  if (el.dataset.yt !== id || el.dataset.mastered !== id) return false;
  if (el.paused || el.ended) return false;
  return el.currentTime > 0 || el.readyState >= 2;
}

function startSilentWarm() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (!currentIsPlayingMastered()) return;
  releaseForeground(id);
  const token = queueToken();
  if (!token || warmToken === token) return;
  warmToken = token;
  const gen = ++warmGen;
  void warmSilently(gen, token);
}

function silenceExceptCurrent() {
  parkStandby();
  if (typeof document === "undefined") return;
  const nodes = document.querySelectorAll("audio");
  for (const node of nodes) {
    if (node === video) continue;
    const el = node as HTMLAudioElement;
    el.autoplay = false;
    el.volume = 0;
    try { el.pause(); } catch { /* a song being measured stays silent */ }
    if (el.getAttribute("src")) {
      el.removeAttribute("src");
      el.dataset.mastered = "";
      try { el.load(); } catch { /* drop any buffered sound */ }
    }
  }
}

async function warmSilently(gen: number, token: string) {
  const tracks = state.tracks.slice();
  const current = state.tracks[state.index]?.id || "";
  for (const track of tracks) {
    if (gen !== warmGen || queueToken() !== token) return;
    if (!currentIsPlayingMastered()) return;
    if (video && video.dataset.yt && video.dataset.yt !== current) return;
    if (!track.id || track.id === current || !track.id.startsWith("suno:")) continue;
    silenceExceptCurrent();
    let saved = null;
    try {
      saved = await primePlayFile(track.id);
    } catch {
      saved = null;
    }
    if (gen !== warmGen || queueToken() !== token || !currentIsPlayingMastered()) return;
    if (saved && !saved.needLevel && !saved.needAnalysis) continue;
    const ready = await prepareMastered(track.id, clipSrc(track.id), true);
    silenceExceptCurrent();
    if (gen !== warmGen || queueToken() !== token || !currentIsPlayingMastered()) return;
    if (ready?.level) await pushSavedLevel(track.id, ready.level, parseAudioAnalysis(ready.analysis));
    silenceExceptCurrent();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 60));
  }
}

function primeUpcoming() {
  parkStandby();
  startSilentWarm();
}

export function outputIsRunning() {
  return !audioCtx || audioCtx.state === "running";
}

export function quietStandby() {
  if (!standby || standby === video) return;
  standby.volume = 0;
  const parked = gains.get(standby);
  if (parked && audioCtx) parked.gain.setValueAtTime(0, audioCtx.currentTime);
  try { standby.pause(); } catch { /* the next song stays quiet until it is the card */ }
}

export function keepOutputAlive() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (el && id && !state.paused && state.mode !== "off" && !el.ended && el.dataset.yt === id && el.paused) {
    const at = Number(el.currentTime);
    if (heardAt > 1 && at < 0.35) {
      try { el.currentTime = heardAt; } catch { /* keep the place the element still has */ }
    }
  }
  holdOutput();
}

function markPlayback() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = state.mode === "off" ? "auto" : "playback";
  } catch {
    /* this browser has no audio session */
  }
}

function openSound(el: HTMLAudioElement) {
  el.muted = false;
  el.defaultMuted = false;
  el.disableRemotePlayback = false;
  markPlayback();
}

function beginPrepared(id: string) {
  handoff = true;
  if (video?.dataset.yt !== id) heardAt = 0;
  if (standby && standbyId === id && standby.dataset.mastered === id && standby.getAttribute("src")) {
    const prev = video;
    const started = standby;
    started.loop = false;
    started.dataset.yt = id;
    hushOthers(started);
    openSound(started);
    const finish = () => {
      if (started.dataset.yt !== id || state.paused) return;
      setTrackGain(started, id);
      void started.play().then(() => {
        const index = state.tracks.findIndex((track) => track.id === id);
        if (index >= 0) state = { ...state, index, paused: false, loopOne: false };
        failedId = "";
        aligned = false;
        video = started;
        standby = prev && prev !== started ? prev : null;
        standbyId = "";
        if (prev && prev !== started) {
          prev.volume = 0;
          try { prev.pause(); } catch { /* the finished song is already quiet */ }
        }
        primeUpcoming();
        hooks.ended();
        emit();
      }, () => {
        handoff = false;
      });
    };
    levelThen(started, id, finish);
    return;
  }
  const index = state.tracks.findIndex((track) => track.id === id);
  if (index >= 0) state = { ...state, index, paused: false, loopOne: false };
  failedId = "";
  aligned = false;
  openTrack(id, false);
  hooks.ended();
}

function ensureVideo() {
  if (typeof document === "undefined") return null;
  if (!standby?.isConnected) standby = bareAudio("music-player-next");
  if (video?.isConnected) return video;
  const el = bareAudio("music-player");
  if (el.dataset.wired !== "1") {
    el.dataset.wired = "1";
    el.addEventListener("playing", () => {
      if (el !== video || state.paused || failedId) return;
      openSound(el);
      el.dataset.pulls = "0";
      place(true);
      primeUpcoming();
      const fire = () => {
        if (el !== video || state.paused || failedId || el.currentTime <= 0) return;
        el.removeEventListener("timeupdate", fire);
        hooks.sounding();
        emit();
      };
      if (el.currentTime > 0) fire();
      else el.addEventListener("timeupdate", fire);
    });
    el.addEventListener("error", () => {
      if (el !== video || !el.dataset.yt || el.dataset.yt !== state.tracks[state.index]?.id) return;
      failedId = el.dataset.yt;
      place(false);
      hooks.failed();
      emit();
    });
    el.addEventListener("ended", () => {
      if (el === video) noteTrackEnd(el, true);
    });
    el.addEventListener("pause", () => {
      if (el !== video || state.paused) return;
      const hidden = document.visibilityState === "hidden" || document.documentElement.dataset.pageBack === "1";
      if (hidden && state.mode !== "off" && !el.ended) {
        const end = Number(el.duration);
        const at = Number(el.currentTime);
        if (!(end > 1 && at >= end - 0.5)) {
          holdIfStolen(el);
          return;
        }
      }
      if (resumeIfStolen(el)) return;
      noteTrackEnd(el, false);
    });
    el.addEventListener("timeupdate", () => {
      if (el !== video) return;
      const at = Number(el.currentTime);
      if (at > 0.2) heardAt = at;
      hooks.tick?.();
      if (document.visibilityState === "hidden" || document.documentElement.dataset.pageBack === "1") return;
      primeUpcoming();
    });
  }
  const next = standby;
  if (next && next.dataset.wired !== "1") {
    next.dataset.wired = "1";
    next.addEventListener("playing", () => {
      if (next !== video || state.paused || failedId) return;
      openSound(next);
      next.dataset.pulls = "0";
      place(true);
      primeUpcoming();
      hooks.sounding();
      emit();
    });
    next.addEventListener("error", () => {
      if (next !== video || next.dataset.yt !== state.tracks[state.index]?.id) return;
      failedId = next.dataset.yt || failedId;
      hooks.failed();
      emit();
    });
    next.addEventListener("ended", () => {
      if (next === video) noteTrackEnd(next, true);
    });
    next.addEventListener("pause", () => {
      if (next !== video || state.paused) return;
      const hidden = document.visibilityState === "hidden" || document.documentElement.dataset.pageBack === "1";
      if (hidden && state.mode !== "off" && !next.ended) {
        const end = Number(next.duration);
        const at = Number(next.currentTime);
        if (!(end > 1 && at >= end - 0.5)) {
          holdIfStolen(next);
          return;
        }
      }
      if (resumeIfStolen(next)) return;
      noteTrackEnd(next, false);
    });
    next.addEventListener("timeupdate", () => {
      if (next !== video) return;
      const at = Number(next.currentTime);
      if (at > 0.2) heardAt = at;
      hooks.tick?.();
      if (document.visibilityState === "hidden") return;
      primeUpcoming();
    });
  }
  video = el;
  if (!placeWatch) {
    placeWatch = true;
    document.addEventListener("visibilitychange", () => {
      if (state.mode !== "off") place(true);
      if (document.visibilityState === "hidden") keepOutputAlive();
      else parkMeter(video, false);
      const node = video;
      if (!node || document.visibilityState === "hidden" || state.paused || state.mode === "off") return;
      noteTrackEnd(node, node.ended);
    });
    const holdHidden = () => {
      if (!state.paused && state.mode !== "off") keepOutputAlive();
    };
    document.addEventListener("freeze", holdHidden);
    window.addEventListener("pagehide", holdHidden);
  }
  return el;
}

let resumeTimer = 0;

function holdIfStolen(node: HTMLAudioElement) {
  if (node !== video || state.paused || state.mode === "off" || node.ended) return;
  const end = Number(node.duration);
  const at = Number(node.currentTime);
  if (end > 1 && at >= end - 0.5) return;
  if (heardAt > 1 && at < 0.35) {
    try { node.currentTime = heardAt; } catch { /* keep the place the element still has */ }
  }
  holdOutput();
}

function resumeIfStolen(node: HTMLAudioElement) {
  if (node !== video || state.mode === "off" || node.ended || state.paused) return false;
  const end = Number(node.duration);
  const at = Number(node.currentTime);
  if (end > 1 && at >= end - 0.5) return false;
  if (heardAt > 1 && at < 0.35) {
    try { node.currentTime = heardAt; } catch { /* keep the place the element still has */ }
  }
  holdOutput();
  try {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
  } catch {
    /* the phone card follows this song */
  }
  if (resumeTimer) return true;
  resumeTimer = window.setTimeout(() => {
    resumeTimer = 0;
    if (node !== video || state.paused || state.mode === "off" || node.ended || !node.paused) return;
    holdOutput();
  }, 400);
  return true;
}

function startPlay(el: HTMLAudioElement) {
  openSound(el);
  const attempt = () => {
    if (state.paused) return;
    openSound(el);
    void el.play().catch(() => {
      if (state.paused) return;
      const kick = () => {
        if (state.paused) return;
        openSound(el);
        void el.play().catch(() => {});
      };
      el.addEventListener("canplay", kick, { once: true });
      window.setTimeout(kick, 500);
    });
  };
  attempt();
}

function playNextOnSame(node: HTMLAudioElement, id: string) {
  heardAt = 0;
  const index = state.tracks.findIndex((track) => track.id === id);
  if (index < 0) {
    beginPrepared(id);
    return;
  }
  state = { ...state, index, paused: false, loopOne: false };
  failedId = "";
  aligned = false;
  switching = true;
  node.loop = false;
  const primed = standby && standbyId === id ? standby.getAttribute("src") || "" : "";
  node.dataset.yt = id;
  node.title = state.tracks[index]?.title || "NOA STUDIO";
  openSound(node);
  if (primed && standby?.dataset.mastered === id) {
    node.dataset.mastered = id;
    node.src = primed;
  } else {
    node.dataset.mastered = "";
    node.removeAttribute("src");
  }
  hushOthers(node);
  playWhenLevel(node, id);
  hooks.ended();
  primeUpcoming();
  node.addEventListener("playing", () => {
    switching = false;
  }, { once: true });
  window.setTimeout(() => {
    switching = false;
  }, 1200);
}

function noteTrackEnd(node: HTMLAudioElement, ended: boolean) {
  if (node !== video || switching || handoff || state.paused || state.mode === "off") return;
  if (node.dataset.yt !== state.tracks[state.index]?.id) return;
  const end = Number(node.duration);
  const at = Number(node.currentTime);
  const atEnd = end > 1 && at >= end - 0.25;
  const finished = ended || node.ended || (node.paused && atEnd);
  if (!finished) {
    primeUpcoming();
    return;
  }
  if (node.loop || state.loopOne || state.mode === "act") {
    if (!(ended || node.ended || atEnd)) return;
    handoff = true;
    heardAt = 0;
    try {
      node.currentTime = 0;
    } catch {
      /* the element restarts when it can seek */
    }
    startPlay(node);
    hooks.ended();
    window.setTimeout(() => {
      handoff = false;
    }, 800);
    return;
  }
  const nextId = hooks.upcoming?.() || "";
  handoff = true;
  if (!nextId) {
    hooks.ended();
    window.setTimeout(() => {
      handoff = false;
    }, 800);
    return;
  }
  if (document.visibilityState === "hidden" || document.documentElement.dataset.pageBack === "1") playNextOnSame(node, nextId);
  else beginPrepared(nextId);
  window.setTimeout(() => {
    handoff = false;
  }, 800);
}

function openTrack(id: string, loop: boolean) {
  const el = ensureVideo();
  if (!el || !id) return;
  const hidden = typeof document !== "undefined" && (document.visibilityState === "hidden" || document.documentElement.dataset.pageBack === "1");
  const same = el.dataset.yt === id && Boolean(el.getAttribute("src")) && failedId !== id;
  if (!same) {
    stopWarm();
    focusMaster(id);
  }
  if (el.dataset.yt !== id) heardAt = 0;
  switching = true;
  el.loop = loop;
  if (el.dataset.yt === id && el.getAttribute("src") && failedId !== id) {
    if (!hidden && (loop || el.ended) && el.currentTime > 0.4) {
      try {
        el.currentTime = 0;
      } catch {
        /* replay from the start once the element allows it */
      }
      heardAt = 0;
    }
    if (el.paused && !state.paused) playWhenLevel(el, id);
    switching = false;
    primeUpcoming();
    return;
  }
  if (hidden && el.dataset.yt === id && el.getAttribute("src")) {
    if (el.paused && !state.paused) playWhenLevel(el, id);
    switching = false;
    return;
  }
  failedId = "";
  aligned = false;
  if (el.dataset.mastered !== id) el.dataset.mastered = "";
  el.dataset.yt = id;
  el.title = state.tracks.find((track) => track.id === id)?.title || "NOA STUDIO";
  if (el.dataset.mastered !== id) el.removeAttribute("src");
  place(true);
  primeUpcoming();
  playWhenLevel(el, id);
  el.addEventListener("playing", () => {
    switching = false;
  }, { once: true });
  window.setTimeout(() => {
    switching = false;
  }, 1200);
}

export function syncSongList(tracks: MusicTrack[], index: number) {
  const next = tracks.filter((track) => track.id);
  const at = next.length ? Math.min(Math.max(0, index), next.length - 1) : 0;
  const id = next[at]?.id || "";
  const playingId = video?.dataset.yt || "";
  state = { mode: next.length ? "list" : "off", tracks: next, index: at, loopOne: false, paused: state.paused };
  if (!id) {
    emit();
    return false;
  }
  if (playingId === id && video?.getAttribute("src")) {
    primeUpcoming();
    emit();
    return false;
  }
  openTrack(id, false);
  emit();
  return true;
}

export function stageSongList(tracks: MusicTrack[], index: number) {
  const next = tracks.filter((track) => track.id);
  const at = next.length ? Math.min(Math.max(0, index), next.length - 1) : 0;
  state = { mode: next.length ? "list" : "off", tracks: next, index: at, loopOne: false, paused: true };
  emit();
}

export function loadSongList(tracks: MusicTrack[], index: number) {
  const next = tracks.slice();
  const at = next.length ? Math.min(Math.max(0, index), next.length - 1) : 0;
  const same = state.mode === "list" && state.tracks.length === next.length && state.tracks.every((track, i) => track.id === next[i]?.id) && state.index === at;
  state = { mode: "list", tracks: next, index: at, loopOne: same ? state.loopOne : false, paused: false };
  const id = next[at]?.id || "";
  if (id) openTrack(id, state.loopOne);
  emit();
}

export function adoptQueue(tracks: MusicTrack[], index: number, act = false) {
  const next = tracks.filter((track) => track.id);
  const at = next.length ? Math.min(Math.max(0, index), next.length - 1) : 0;
  const id = next[at]?.id || "";
  const el = video;
  const loaded = Boolean(id && el && el.dataset.yt === id && el.getAttribute("src"));
  state = {
    mode: act ? "act" : "list",
    tracks: next,
    index: at,
    loopOne: act,
    paused: loaded ? state.paused : false,
  };
  if (!id) {
    emit();
    return;
  }
  if (loaded && el) {
    el.loop = act;
    primeUpcoming();
    emit();
    return;
  }
  openTrack(id, act);
  emit();
}

export function loadAct(track: MusicTrack) {
  if (!track.id) return;
  if (state.mode === "act" && state.tracks[0]?.id === track.id) return;
  state = { mode: "act", tracks: [track], index: 0, loopOne: true, paused: false };
  openTrack(track.id, true);
  emit();
}

export function retitleTracks(patch: Record<string, string>) {
  let changed = false;
  const tracks = state.tracks.map((track) => {
    const title = patch[track.id];
    if (!title || title === track.title) return track;
    changed = true;
    return { ...track, title };
  });
  if (!changed) return;
  state = { ...state, tracks };
  const current = tracks[state.index];
  if (video && current && video.dataset.yt === current.id) video.title = current.title;
  emit();
}

export function openBody(id: string, loop: boolean) {
  if (!id) return;
  const index = state.tracks.findIndex((track) => track.id === id);
  if (index >= 0) state = { ...state, index, paused: false, loopOne: state.mode === "act" ? true : loop };
  else if (id.startsWith("suno:")) state = { mode: loop ? "act" : "list", tracks: [{ id, url: id.slice(5), title: "" }], index: 0, loopOne: loop, paused: false };
  else state = { mode: loop ? "act" : "list", tracks: [{ id, url: `https://youtu.be/${id}`, title: "" }], index: 0, loopOne: loop, paused: false };
  openTrack(id, state.mode === "act" || state.loopOne);
  emit();
}

export function alignBody(at: number) {
  const el = video;
  if (!el || aligned || failedId) return;
  if (!(at > 1) || el.currentTime > 1) {
    aligned = true;
    return;
  }
  try {
    el.currentTime = at;
  } catch {
    return;
  }
  aligned = true;
}

export function outputCorrected() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (!el || !id || !bodySounding()) return false;
  return el.dataset.mastered === id && Math.abs(el.volume - 1) < 0.03;
}

export function bodySounding() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (!el || !id || failedId === id || el.dataset.yt !== id) return false;
  return !el.paused && !el.ended && el.readyState >= 2 && el.currentTime > 0;
}

export function bodyFailed() {
  const id = state.tracks[state.index]?.id || "";
  return Boolean(id && failedId === id);
}

export function bodyClock() {
  const el = video;
  const id = state.tracks[state.index]?.id || "";
  if (!el || !id || el.dataset.yt !== id || failedId === id) return null;
  const end = Number(el.duration);
  const at = Number(el.currentTime);
  if (!Number.isFinite(end) || end <= 0 || !Number.isFinite(at) || at < 0) return null;
  return { at, end };
}

export function seekBody(at: number) {
  const el = video;
  if (!el || failedId) return false;
  try {
    el.currentTime = at;
    return true;
  } catch {
    return false;
  }
}

export function pauseBody() {
  if (state.mode === "off") return;
  stealGen += 1;
  state = { ...state, paused: true };
  video?.pause();
  emit();
}

export function resumeBody() {
  if (state.mode === "off") return;
  state = { ...state, paused: false };
  const id = state.tracks[state.index]?.id || "";
  const el = video || ensureVideo();
  if (el && id && failedId !== id) {
    if (!el.getAttribute("src") || el.dataset.yt !== id) {
      openTrack(id, state.loopOne || state.mode === "act");
      emit();
      return;
    }
    openSound(el);
    if (!el.paused && !el.ended) {
      setTrackGain(el, id);
      emit();
      return;
    }
    const spot = Number(el.currentTime);
    if (heardAt > 1 && spot < 0.35) {
      try { el.currentTime = heardAt; } catch { /* keep the place the element still has */ }
    }
    playWhenLevel(el, id);
  } else markPlayback();
  emit();
}

export function setBodyLoop(on: boolean) {
  if (state.mode !== "list") return;
  state = { ...state, loopOne: on };
  if (video) video.loop = on;
  emit();
}

export function stopMusicPlayer() {
  state = { ...off };
  failedId = "";
  aligned = false;
  if (video) {
    video.pause();
    video.dataset.yt = "";
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* already clear */
    }
  }
  place(false);
  markPlayback();
  emit();
}

if (typeof document !== "undefined") {
  for (const id of ["music-player", "music-player-next"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    try {
      (el as HTMLMediaElement).pause();
    } catch {
      /* already stopped */
    }
    el.remove();
  }
  video = null;
  standby = null;
}
