import { patchApp, readAppDump } from "./app-memory";
import type { GenreId } from "./catalog";

export type FillTask = {
  kind: "single" | "playlist";
  genreId?: GenreId;
  n?: string;
  title?: string;
  act?: number;
  rank?: 1 | 2 | 3 | 4;
};

export type FillQueue = {
  genreId: GenreId;
  tasks: FillTask[];
  acceptedAt: number;
  total: number;
  limitUntil?: number;
  paused?: boolean;
  status?: string;
  current?: string;
  lastError?: string;
  filled?: number;
  events?: { label: string; state: string; reason?: string }[];
  userPaused?: boolean;
  busyUntil?: number;
};

const IDS: GenreId[] = [
  "kpop-original",
  "jpop-original",
  "pop-original",
  "thai-original",
  "joseon-ballad",
  "panpop",
  "echoes-of-joseon",
  "latin-afrobeats-edm",
  "edm-kpop-club",
  "dreamy-deep-house",
  "fantasy-ambient-edm",
  "groovy-airy-pop",
  "narrative-piano-indie",
  "your-story",
  "cover-reborn",
];

function isGenre(id: string): id is GenreId {
  return IDS.includes(id as GenreId);
}

export function readFillQueue(): FillQueue | null {
  const parsed = readAppDump().fillJob;
  if (!parsed || !isGenre(parsed.genreId) || !Array.isArray(parsed.tasks) || !parsed.tasks.length) return null;
  return {
    genreId: parsed.genreId,
    tasks: parsed.tasks as FillTask[],
    acceptedAt: parsed.acceptedAt,
    total: parsed.total,
    limitUntil: parsed.limitUntil,
    paused: parsed.paused,
    status: parsed.status,
    current: parsed.current,
    lastError: parsed.lastError,
    filled: parsed.filled,
    events: parsed.events,
    userPaused: parsed.userPaused,
    busyUntil: parsed.busyUntil,
  };
}

export function writeFillQueue(job: FillQueue | null) {
  patchApp((d) => {
    d.fillJob =
      job && job.tasks.length
        ? {
            genreId: job.genreId,
            tasks: job.tasks,
            acceptedAt: job.acceptedAt,
            total: job.total,
            limitUntil: job.limitUntil,
            paused: job.paused,
            status: job.status,
            current: job.current,
            lastError: job.lastError,
            filled: job.filled,
            events: job.events,
            userPaused: job.userPaused,
            busyUntil: job.busyUntil,
          }
        : null;
  }, false);
  if (typeof window === "undefined") return;
  void import("./pages")
    .then((api) =>
      api.saveFillJob({
        data:
          job && job.tasks.length
            ? {
                genreId: job.genreId,
                tasks: job.tasks,
                acceptedAt: job.acceptedAt,
                total: job.total,
                limitUntil: job.limitUntil,
                paused: job.paused,
                status: job.status,
                current: job.current,
                lastError: job.lastError,
                filled: job.filled,
                events: job.events,
                userPaused: job.userPaused,
                busyUntil: job.busyUntil,
              }
            : null,
      }),
    )
    .catch(() => {});
}

export function popFillTask(): FillQueue | null {
  const job = readFillQueue();
  if (!job) return null;
  job.tasks = job.tasks.slice(1);
  writeFillQueue(job.tasks.length ? job : null);
  return job.tasks.length ? job : null;
}
