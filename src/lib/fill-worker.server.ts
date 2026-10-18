import { getSql } from "./db";
import {
  persistEncyclopedia,
  putEncFillJob,
  forceEncPackage,
  slotRewriteOpen,
  putEncPlaylist,
  readEncyclopedia,
  type EncFillEvent,
  type EncFillJob,
  type EncPkg,
} from "./encyclopedia.server";
import { runGeneratePackage } from "./generate-package.server";
import {
  actFromEp,
  GENRES,
  getGenre,
  padEp,
  tracksForAct,
  type GenreId,
} from "./catalog";
import { defaultThumbCast, thumbCastFromVocal } from "./characters";
import { koreanFillError } from "./fill-errors";
import { applyPrefToStudio, auditStudioFields, byFillLead, fillRank, isCompletePackage, localFillPlaylist, patchStudioFields, requiredStudioFields, shouldAutoFill } from "./fill-local";
import { SEED_ORIGINALS } from "./originals-seed";
import {
  lockStoreKey,
  hasPageBody,
  normalizePackage,
  resultSlot,
  takeLockedStudio,
  type StudioPackage,
} from "./package";
import { COMMON_ID, lockPolicy, mergeStoredPref } from "./user-prefs";

function serverPref(dump: ReturnType<typeof readEncyclopedia>, gid: GenreId) {
  return mergeStoredPref(gid, dump.prefs[gid], dump.prefs[COMMON_ID]);
}

let running = false;
let stopRequested = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function asGenre(id: string | undefined): GenreId | null {
  if (!id) return null;
  return GENRES.some((g) => g.id === id) ? (id as GenreId) : null;
}

function asStudio(pkg: EncPkg | undefined): StudioPackage {
  return normalizePackage({
    summary: pkg?.summary ?? "",
    confirmedTitle: pkg?.confirmedTitle ?? "",
    lyricsBlock: pkg?.lyricsBlock ?? "",
    sunoStyle: pkg?.sunoStyle ?? "",
    geminiPrompt: pkg?.geminiPrompt ?? "",
    youtubeTitle: pkg?.youtubeTitle ?? "",
    youtubeDescription: pkg?.youtubeDescription ?? "",
    fanLetter: pkg?.fanLetter ?? "",
    thumbUrl: pkg?.thumbUrl ?? "",
    thumbCast: (pkg?.thumbCast as StudioPackage["thumbCast"]) || "female",
  });
}

async function writeJobSql(job: EncFillJob | null) {
  try {
    const sql = await getSql();
    const slot = "fill:queue";
    if (!job?.tasks?.length) {
      await sql`delete from studio_pages where slot = ${slot}`;
      return;
    }
    const payload = JSON.stringify(job);
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"fill"},
        ${job.genreId},
        ${""},
        ${0},
        ${"fill-queue"},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        body = excluded.body,
        genre_id = excluded.genre_id,
        updated_at = now()
    `;
  } catch {
    /* encyclopedia is enough */
  }
}

async function saveJob(job: EncFillJob | null) {
  putEncFillJob(job);
  await writeJobSql(job);
}

async function loadJob(): Promise<EncFillJob | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ body: unknown }>`
      select body from studio_pages where slot = ${"fill:queue"} limit 1
    `;
    const raw = rows[0]?.body;
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown> | null);
    if (parsed && typeof parsed.genreId === "string" && Array.isArray(parsed.tasks) && parsed.tasks.length) {
      const job: EncFillJob = {
        genreId: parsed.genreId,
        tasks: parsed.tasks as EncFillJob["tasks"],
        acceptedAt: typeof parsed.acceptedAt === "number" ? parsed.acceptedAt : Date.now(),
        total: typeof parsed.total === "number" ? parsed.total : parsed.tasks.length,
        limitUntil: typeof parsed.limitUntil === "number" ? parsed.limitUntil : 0,
        paused: Boolean(parsed.paused),
        status: typeof parsed.status === "string" ? parsed.status : "",
        current: typeof parsed.current === "string" ? parsed.current : "",
        lastError: typeof parsed.lastError === "string" ? parsed.lastError : "",
        filled: typeof parsed.filled === "number" ? parsed.filled : 0,
        events: Array.isArray(parsed.events) ? (parsed.events as EncFillEvent[]) : [],
        userPaused: Boolean(parsed.userPaused),
        busyUntil: typeof parsed.busyUntil === "number" ? parsed.busyUntil : 0,
      };
      putEncFillJob(job);
      return job;
    }
  } catch {
    /* file */
  }
  return readEncyclopedia().fillJob ?? null;
}

async function saveSingle(genreId: GenreId, ep: string, title: string, pkg: StudioPackage) {
  if (!hasPageBody(pkg) || !slotRewriteOpen(genreId, ep)) return false;
  let ok = false;
  try {
    const written = forceEncPackage(genreId, ep, title, pkg as EncPkg, true);
    ok = true;
    if (written) pkg = written as StudioPackage;
  } catch {
    /* file */
  }
  try {
    const sql = await getSql();
    const slot = resultSlot(genreId, ep, actFromEp(ep));
    const payload = JSON.stringify(pkg);
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"single"},
        ${genreId},
        ${ep},
        ${actFromEp(ep)},
        ${title},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        kind = excluded.kind,
        genre_id = excluded.genre_id,
        ep = excluded.ep,
        act = excluded.act,
        title = excluded.title,
        body = excluded.body,
        updated_at = now()
    `;
    ok = true;
  } catch {
    /* song file already has the fill */
  }
  return ok;
}

async function savePlaylist(genreId: GenreId, act: number, title: string, pkg: EncPkg) {
  putEncPlaylist(genreId, act, title, pkg);
  try {
    const sql = await getSql();
    const slot = resultSlot(genreId, "", act);
    const payload = JSON.stringify(pkg);
    await sql`
      insert into studio_pages (slot, kind, genre_id, ep, act, title, body, updated_at)
      values (
        ${slot},
        ${"playlist"},
        ${genreId},
        ${""},
        ${act},
        ${title},
        ${payload}::jsonb,
        now()
      )
      on conflict (slot) do update set
        kind = excluded.kind,
        genre_id = excluded.genre_id,
        ep = excluded.ep,
        act = excluded.act,
        title = excluded.title,
        body = excluded.body,
        updated_at = now()
    `;
  } catch {
    /* encyclopedia holds it */
  }
}

function pushEvent(job: EncFillJob, event: EncFillEvent) {
  job.events = [...(job.events ?? []).slice(-12), event];
}

function originalFor(ep: string) {
  const n = padEp(ep);
  const dump = readEncyclopedia();
  const own = dump.originals?.["kpop-original"]?.[n];
  if (own?.lyrics?.trim() || own?.title?.trim()) return own;
  return SEED_ORIGINALS.find((item) => item.n === n);
}

async function refreshPlaylist(gid: GenreId, act: number) {
  const dump = readEncyclopedia();
  const pref = serverPref(dump, gid);
  if (pref.actPlaylist === false || getGenre(gid).kind === "distinct") return;
  const tracks = tracksForAct(act);
  if (tracks.length < 10) return;
  const allConfirmed = tracks.every((item) => dump.meta?.confirmed?.[`${gid}:ep:${padEp(item.n)}`] === true);
  if (!allConfirmed) return;
  const existing = dump.playlists?.[`${gid}:${act}`]?.pkg;
  if (existing?.tracklist?.trim() || existing?.summary?.trim() || existing?.youtubeTitle?.trim()) return;
  const named = tracks.map((item) => {
    const n = padEp(item.n);
    const row = dump.packages[`${gid}:${n}`];
    return { n, title: row?.pkg?.confirmedTitle?.trim() || row?.title?.trim() || item.title };
  });
  const built = localFillPlaylist({
    act,
    genreId: gid,
    extraTracks: named,
    prefs: pref,
    thumbCast: defaultThumbCast(gid),
  });
  await savePlaylist(gid, act, built.youtubeTitle, built as EncPkg);
}

function sealServerSong(_gid: GenreId, _n: string) {
  return;
}

async function runOne(job: EncFillJob, task: EncFillJob["tasks"][number]): Promise<"ok" | "wait" | "retry" | "skip"> {
  if (task.kind !== "single" || !task.n) return "skip";
  const gid = asGenre(task.genreId) ?? asGenre(job.genreId);
  if (!gid) return "skip";
  const n = padEp(task.n);
  const dump = readEncyclopedia();
  if (dump.meta?.confirmed?.[`${gid}:ep:${n}`] === true) return "skip";
  const orig = originalFor(n);
  const existingRaw = asStudio(dump.packages[`${gid}:${n}`]?.pkg);
  const pref = serverPref(dump, gid);
  const genre = getGenre(gid);
  const title = orig?.title || task.title || "";
  const usedCast =
    genre.kind === "original" ? thumbCastFromVocal(orig?.vocal || "") : defaultThumbCast(gid);
  const locks = dump.meta?.locks?.[lockStoreKey("single", n, gid)] ?? {};
  const policy = lockPolicy(pref.lockRule);
  const gate = policy.skipLocked ? locks : {};
  let existing = existingRaw;
  const edited = new Set(existing.userEdited || []);
  if (!shouldAutoFill(gid, existing, orig, false, pref, policy.skipLocked ? locks : undefined, n)) return "skip";
  const audit = auditStudioFields(gid, existing, pref, n);
  const weak = byFillLead(
    audit.filter((field) => field.kind !== "ok" && !edited.has(field.id)),
  ).map((field) => field.id);
  if (!weak.length) {
    if (hasPageBody(existing)) sealServerSong(gid, n);
    return "skip";
  }
  job.current = `항목 확인 · ${genre.label} EP.${n} ${title}`;
  job.status = "running";
  job.lastError = "";
  pushEvent(job, { label: `${genre.label} EP.${n} ${title}`, state: "run", reason: "모델에 요청" });
  await saveJob(job);

  const raw = await runGeneratePackage({
    epN: n,
    genreId: gid,
    originalLyrics: orig?.lyrics || "",
    originalTitle: title,
    vocal: orig?.vocal || "",
    prefs: pref,
    thumbCast: usedCast,
    skipThumb: true,
  });
  if (stopRequested) return "wait";
  if (!raw.ok) {
    const reason = koreanFillError(raw.error);
    job.lastError = reason;
    if (raw.error.includes("한도") || raw.retryAfter) {
      const wait = Math.min(30 * 60, Math.max(60, raw.retryAfter ?? 180));
      job.limitUntil = Date.now() + wait * 1000;
      job.status = "waiting";
      job.current = `한도 대기 ${wait}초 · EP.${n}`;
      pushEvent(job, { label: `${genre.label} EP.${n}`, state: "wait", reason: `한도 · ${wait}초 후 같은 곡 재시도` });
      await saveJob(job);
      return "wait";
    }
    pushEvent(job, { label: `${genre.label} EP.${n}`, state: "wait", reason: `재시도 · ${reason}` });
    job.current = `재시도 · EP.${n} · ${reason}`;
    await saveJob(job);
    return "retry";
  }
  if (!isCompletePackage(raw.pkg)) {
    pushEvent(job, { label: `${genre.label} EP.${n}`, state: "wait", reason: "완성본 검사 실패 · 본 생성을 다시 합니다" });
    job.current = `재시도 · EP.${n} · 완성본 검사 실패`;
    await saveJob(job);
    return "retry";
  }
  const base = existing ?? raw.pkg;
  let next = patchStudioFields(base, raw.pkg, weak.length ? weak : []);
  if (!weak.length) next = base;
  next = takeLockedStudio(base, next, gate);
  next = applyPrefToStudio(
    next,
    pref,
    {
      epN: n,
      lockedTitle: "",
      genreLabel: pref.thumbGenreLine.trim() || genre.youtubeLabel,
      genreId: gid,
    },
    gate,
  );
  const wrote = await saveSingle(gid, n, next.confirmedTitle, next);
  await refreshPlaylist(gid, actFromEp(n));
  if (!wrote) {
    pushEvent(job, { label: `${genre.label} EP.${n}`, state: "wait", reason: "저장되지 않음" });
    job.current = `저장 안 됨 · EP.${n}`;
    await saveJob(job);
    return slotRewriteOpen(gid, n) ? "retry" : "skip";
  }
  const openWeak = auditStudioFields(gid, next, pref, n).filter((field) => field.kind !== "ok");
  if (!openWeak.length) sealServerSong(gid, n);
  if (openWeak.length) {
    pushEvent(job, { label: `${genre.label} EP.${n}`, state: "wait", reason: "부실한 항목이 남아 같은 곡을 다시 확인" });
    job.current = `항목 재확인 · EP.${n}`;
    await saveJob(job);
    return "retry";
  }
  job.filled = (job.filled ?? 0) + 1;
  pushEvent(job, { label: `${genre.label} EP.${n} ${next.confirmedTitle}`, state: "ok", reason: "저장됨" });
  job.current = `성공 · 저장됨 · ${genre.label} EP.${n} ${next.confirmedTitle}`;
  await saveJob(job);
  return "ok";
}

function taskLabel(task: EncFillJob["tasks"][number], job: EncFillJob, rank = 0) {
  const gid = asGenre(task.genreId) ?? asGenre(job.genreId);
  const verb = rank === 2 || rank === 4 || task.rank === 2 || task.rank === 4 ? "다시 생성하기" : "생성";
  const name = gid ? getGenre(gid).label : "";
  return `${verb} · ${name} EP.${padEp(task.n || "")} ${task.title || ""}`.replace(/\s+/g, " ").trim();
}

async function loop() {
  while (!stopRequested) {
    let job = await loadJob();
    if (!job?.tasks?.length) {
      await saveJob(null);
      return;
    }
    if (job.paused || job.userPaused) return;
    if (job.limitUntil && job.limitUntil > Date.now()) {
      job.status = "waiting";
      job.current = `한도 대기 ${Math.ceil((job.limitUntil - Date.now()) / 1000)}초`;
      await saveJob(job);
      return;
    }
    let skipped = 0;
    while (job.tasks.length && skipped < 40) {
      const task = job.tasks[0];
      if (task.kind === "playlist") {
        job.tasks = job.tasks.slice(1);
        skipped += 1;
        await saveJob(job);
        continue;
      }
      const gid = asGenre(task.genreId) ?? asGenre(job.genreId);
      const n = padEp(task.n || "");
      if (!gid || !n) {
        job.tasks = job.tasks.slice(1);
        skipped += 1;
        await saveJob(job);
        continue;
      }
      const dump = readEncyclopedia();
      const orig = originalFor(n);
      const existing = asStudio(dump.packages[`${gid}:${n}`]?.pkg);
      const confirmed = dump.meta?.confirmed?.[`${gid}:ep:${n}`] === true;
      const pref = serverPref(dump, gid);
      const locks = dump.meta?.locks?.[lockStoreKey("single", n, gid)] ?? {};
      const rank = fillRank(gid, existing, orig, confirmed, n, pref, lockPolicy(pref.lockRule).skipLocked ? locks : undefined);
      if (rank === 0) {
        if (hasPageBody(existing) && !confirmed && dump.meta?.rowLocks?.[`${gid}:${n}`] !== true) sealServerSong(gid, n);
        job.tasks = job.tasks.slice(1);
        skipped += 1;
        await saveJob(job);
        continue;
      }
      job.current = `${taskLabel(task, job, rank)} · 모델 응답 대기`;
      job.status = "running";
      job.busyUntil = 0;
      await saveJob(job);
      break;
    }
    if (!job.tasks.length) {
      await saveJob(null);
      return;
    }
    const task = job.tasks[0];
    const result = await runOne(job, task);
    const latest = (await loadJob()) ?? job;
    if (stopRequested || latest.userPaused) {
      latest.paused = true;
      latest.userPaused = true;
      latest.status = "paused";
      latest.busyUntil = 0;
      latest.current = "일시정지";
      await saveJob(latest);
      return;
    }
    if (result === "wait") {
      latest.busyUntil = 0;
      await saveJob(latest);
      return;
    }
    if (result === "ok" || result === "skip") {
      latest.tasks = latest.tasks.slice(1);
      if (!latest.tasks.length) {
        await saveJob(null);
        return;
      }
      const next = latest.tasks[0];
      latest.current = `${taskLabel(next, latest, next.rank || 1)} · 모델 응답 대기`;
      latest.status = "running";
      latest.busyUntil = 0;
      await saveJob(latest);
      continue;
    }
    latest.busyUntil = 0;
    await saveJob(latest);
  }
}

export async function requestFillPause() {
  stopRequested = true;
  const job = await loadJob();
  if (job?.tasks?.length) {
    job.paused = true;
    job.userPaused = true;
    job.status = "paused";
    job.busyUntil = 0;
    job.current = "일시정지";
    await saveJob(job);
  }
}

async function pump() {
  try {
    while (!stopRequested) {
      const job = await loadJob();
      if (!job?.tasks?.length) break;
      if (job.paused || job.userPaused) break;
      if (job.limitUntil && job.limitUntil > Date.now()) {
        const wait = Math.min(job.limitUntil - Date.now(), 60_000);
        job.status = "waiting";
        job.current = `한도 대기 ${Math.ceil((job.limitUntil - Date.now()) / 1000)}초`;
        await saveJob(job);
        await sleep(wait);
        continue;
      }
      await loop();
    }
  } finally {
    running = false;
  }
}

export async function ensureFillWorker(resume = false) {
  let job = await loadJob();
  if (!job?.tasks?.length) return { ok: true as const, running: false };
  if (running) {
    if (resume) stopRequested = false;
    return { ok: true as const, running: true };
  }
  if (job.userPaused && !resume) {
    job.paused = true;
    job.status = "paused";
    job.busyUntil = 0;
    await saveJob(job);
    return { ok: true as const, running: false };
  }
  if (resume) {
    job.paused = false;
    job.userPaused = false;
    job.status = "running";
    job.busyUntil = 0;
    await saveJob(job);
    stopRequested = false;
  }
  job = await loadJob();
  if (!job?.tasks?.length || job.paused || job.userPaused) return { ok: true as const, running: false };
  running = true;
  stopRequested = false;
  job.busyUntil = 0;
  job.status = "running";
  await saveJob(job);
  void pump();
  return { ok: true as const, running: true };
}
