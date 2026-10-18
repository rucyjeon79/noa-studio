import { useEffect, useRef, useState } from "react";
import type { GenreGap } from "@/lib/gaps";
import type { ReleaseNote } from "@/lib/upgrades";
import type { FillEvent } from "@/lib/fill-errors";
import { cn } from "@/lib/utils";

export const FILL_STAGES = ["체크", "제목", "가사", "수노", "썸네일", "유튜브"] as const;

export type FillStep = {
  id: string;
  label: string;
  fields: string[];
};

export type FillSongView = {
  name: string;
  status: "wait" | "run" | "done";
  stage: number;
  step: number;
  steps: FillStep[];
  pct: number;
  n: string;
  genreId: string;
  waitSec?: number;
  detail?: string;
};

export type FillTrack = {
  prev: FillSongView | null;
  current: FillSongView | null;
  next: FillSongView | null;
};

type NoticeMode =
  | "hidden"
  | "filling"
  | "fill-ask"
  | "review"
  | "resume-ask"
  | "fill-done"
  | "upgrade-ask"
  | "upgrade-done";

export type ReviewItem = { id: string; label: string; action: string };

export function NoticePanel({
  mode,
  filling,
  current,
  done,
  total,
  errors,
  notes,
  filledCount,
  failedCount,
  limitWait,
  events,
  fillTrack,
  emptyCount,
  sloppyCount,
  partialCount,
  itemCount,
  previewLines,
  onConfirmFill,
  onDismissFill,
  onPause,
  onResume,
  onConfirmUpgrade,
  onDismissUpgrade,
  onAckUpgrade,
  onAckFill,
  onOpenSong,
  online,
  stalled,
  onRestart,
  fillScopeLabel,
  reviewItems,
  reviewNote,
  onReviewNote,
  onConfirmReview,
  reportDetail,
}: {
  mode: NoticeMode;
  gap?: GenreGap;
  filling: boolean;
  current: string;
  done: number;
  total: number;
  errors: string[];
  notes: ReleaseNote[];
  filledCount: number;
  failedCount: number;
  limitWait: number;
  remaining?: number;
  events?: FillEvent[];
  fillTrack: FillTrack | null;
  emptyCount?: number;
  sloppyCount?: number;
  partialCount: number;
  itemCount: number;
  previewLines?: string[];
  onConfirmFill: () => void;
  onDismissFill: () => void;
  onPause: () => void;
  onResume: () => void;
  onConfirmUpgrade: () => void;
  onDismissUpgrade: () => void;
  onAckUpgrade: () => void;
  onAckFill: () => void;
  onOpenSong: (song: FillSongView) => void;
  online: boolean;
  stalled: boolean;
  onRestart: () => void;
  fillScopeLabel?: string;
  reviewItems?: ReviewItem[];
  reviewNote?: string;
  onReviewNote?: (value: string) => void;
  onConfirmReview?: () => void;
  reportDetail?: string;
}) {
  void events;
  useEffect(() => {
    if (mode !== "filling") {
      document.documentElement.style.removeProperty("--fill-cover");
      return;
    }
    let ro: ResizeObserver | null = null;
    const write = () => {
      const el = document.getElementById("fill-notice");
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const cover = Math.max(160, Math.ceil(window.innerHeight - top + 8));
      document.documentElement.style.setProperty("--fill-cover", `${cover}px`);
    };
    const frame = window.requestAnimationFrame(write);
    const timer = window.setTimeout(() => {
      write();
      const el = document.getElementById("fill-notice");
      if (!el) return;
      ro = new ResizeObserver(write);
      ro.observe(el);
    }, 60);
    window.addEventListener("resize", write);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", write);
      ro?.disconnect();
      document.documentElement.style.removeProperty("--fill-cover");
    };
  }, [mode, fillTrack, limitWait, stalled, online, current]);
  if (mode === "hidden") return null;

  if (mode === "filling") {
    const currentSong = fillTrack?.current ?? null;
    const pct = Math.max(0, Math.min(100, currentSong?.pct ?? 0));
    const liveDetail = (currentSong?.detail || "").trim();
    const detail =
      limitWait > 0
        ? `한도 대기 ${limitWait}초`
        : currentSong?.waitSec && currentSong.waitSec > 0
          ? `한도 대기 ${currentSong.waitSec}초`
          : liveDetail || current || "생성 중";
    const wait = Math.max(limitWait, currentSong?.waitSec ?? 0);
    const quotaWait = online && wait > 0;
    const stall = !online
      ? {
          title: "진행이 멈췄습니다",
          body: "네트워크가 끊겼습니다.\n연결되면 같은 칸부터 이어서 합니다.",
        }
      : quotaWait
        ? null
        : stalled
          ? {
              title: "다시 시작할 수 있습니다",
              body: "멈춘 사유가 해소됐습니다.\n다시 시작을 누르면 같은 곡부터 이어서 생성합니다.",
            }
          : null;
    const canRestart = Boolean(stall) && online && wait <= 0;
    const now = Math.min(total || 0, currentSong?.status === "run" ? done + 1 : done);
    return (
      <div id="fill-notice" className="pointer-events-auto fixed inset-x-0 top-auto bottom-[var(--jukebox-cover,0px)] z-40 overflow-hidden border-t border-white/25 bg-black text-white">
        {stall || quotaWait ? null : <span aria-hidden className="notice-glow" />}
        {stall || quotaWait ? null : <span aria-hidden className="notice-sweep" />}
        <div className="relative px-4 pt-3 pb-3">
          <div className={stall ? "pointer-events-none opacity-25" : undefined}>
            <div className="flex items-center gap-2">
              <p className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tracking-tight text-white">
                Grok{" "}
                <span className={cn("text-mark", stall || quotaWait ? "" : "wake-word")}>
                  {stall || quotaWait ? "대기" : "작동 중"}
                </span>
              </p>
              <p className="shrink-0 text-xs text-mark">
                {now}/{total}
              </p>
            </div>
            <p className="mt-2 text-sm font-medium leading-snug text-white">{currentSong?.name || "곡 확인 중"}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-mark transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm leading-snug text-white">{detail}</p>
            {quotaWait ? (
              <p className="text-xs leading-relaxed text-white/70">
                그록 생성 한도입니다. {wait >= 60 ? `${Math.ceil(wait / 60)}분` : `${wait}초`} 후 같은 칸부터 이어서 씁니다.
              </p>
            ) : null}
          </div>
          {stall ? (
            <div className="absolute inset-x-3 top-3 bottom-[4.5rem] z-10 flex items-center justify-center px-3">
              <div className="w-full bg-black px-1 py-2 text-center">
                <p className="text-sm font-medium text-mark">{stall.title}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white">{stall.body}</p>
              </div>
            </div>
          ) : null}
          {stall ? (
            <button
              type="button"
              disabled={!canRestart}
              className="relative z-20 mt-3 h-[50px] w-full bg-mark px-4 text-[17px] font-semibold text-mark-fg disabled:bg-white/10 disabled:text-white/40"
              onClick={onRestart}
            >
              {canRestart ? "다시 시작" : !online ? "연결되면 다시 시작" : `한도 대기 ${wait}초`}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const closeAsk =
    mode === "fill-ask" || mode === "resume-ask" || mode === "review"
      ? onDismissFill
      : mode === "fill-done"
        ? onAckFill
        : mode === "upgrade-ask"
          ? onDismissUpgrade
          : undefined;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-fg/50"
        onClick={closeAsk}
      />
      <section
        className="relative z-10 mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl border border-mark/50 bg-bg px-5 py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-fg">
            Grok <span className="text-mark">대기</span>
          </p>
        </div>

        {mode === "resume-ask" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">멈춘 채우기를 이어서 적용할까요?</p>
            {limitWait > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                그록 생성 한도입니다. 한도가 돌아오면 같은 칸부터 이어서 씁니다. ({limitWait >= 60 ? `${Math.ceil(limitWait / 60)}분` : `${limitWait}초`})
              </p>
            ) : (
              <p className="mt-2 text-xs text-fg-muted">막힌 곡부터 이어서 이 앱에 적용합니다.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-border bg-surface text-sm text-fg"
                onClick={onDismissFill}
              >
                나중에
              </button>
              <button
                type="button"
                disabled={limitWait > 0}
                className="min-h-12 flex-1 rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onResume}
              >
                {limitWait > 0 ? `한도 대기 ${limitWait}초` : "이어서 적용"}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "fill-done" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">
              적용을 마쳤습니다. 채움 {filledCount} · 실패 {failedCount}.
            </p>
            {reportDetail ? (
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">{reportDetail}</p>
            ) : null}
            {errors.length ? (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                실패: {errors.slice(0, 4).join(" · ")}
                {errors.length > 4 ? ` 외 ${errors.length - 4}` : ""}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 min-h-12 w-full rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg"
              onClick={onAckFill}
            >
              확인
            </button>
          </div>
        ) : null}

        {mode === "review" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">최종 검수. 설정 기준으로 손볼 항목입니다.</p>
            {(reviewItems ?? []).length ? (
              <ul className="mt-2 space-y-1">
                {(reviewItems ?? []).map((item) => (
                  <li key={item.id} className="text-xs leading-relaxed text-fg-muted">
                    <span className="text-fg">{item.label}</span> · {item.action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                손볼 항목이 없습니다. 요구사항을 적으면 실행할 수 있고, 실행하면 그 요구를 진행합니다.
              </p>
            )}
            <label className="mt-3 block text-xs text-fg-subtle">
              사용자 요구사항
              <textarea
                value={reviewNote ?? ""}
                onChange={(event) => onReviewNote?.(event.target.value)}
                rows={3}
                placeholder="손볼 항목이 없어도 적으면 실행됩니다"
                className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-border bg-surface text-sm text-fg"
                onClick={onDismissFill}
              >
                다음에
              </button>
              <button
                type="button"
                disabled={!((reviewItems ?? []).length || (reviewNote ?? "").trim())}
                className="min-h-12 flex-1 rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg disabled:opacity-40"
                onClick={() => onConfirmReview?.()}
              >
                실행
              </button>
            </div>
          </div>
        ) : null}

        {mode === "fill-ask" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">
              {fillScopeLabel || "이 범위만 채웁니다."} 확정곡은 제외합니다. 공란 {emptyCount ?? 0}, 대충 {sloppyCount ?? 0}, 빈칸 {partialCount}, 항목 {itemCount}.
            </p>
            {(previewLines ?? []).length ? (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                {(previewLines ?? []).join(" · ")}
                {(emptyCount ?? 0) + (sloppyCount ?? 0) + partialCount + itemCount > (previewLines ?? []).length
                  ? ` 외 ${(emptyCount ?? 0) + (sloppyCount ?? 0) + partialCount + itemCount - (previewLines ?? []).length}`
                  : ""}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-fg-muted">잘 된 칸은 다시 쓰지 않습니다. 자동으로 잠그지 않습니다.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-border bg-surface text-sm text-fg"
                onClick={onDismissFill}
              >
                나중에
              </button>
              <button
                type="button"
                disabled={(emptyCount ?? 0) + (sloppyCount ?? 0) + partialCount + itemCount < 1}
                className="min-h-12 flex-1 touch-manipulation rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg disabled:opacity-40"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onConfirmFill();
                }}
              >
                채우기
              </button>
            </div>
          </div>
        ) : null}

        {mode === "upgrade-ask" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">개선된 내용이 있습니다. 업그레이드할까요?</p>
            <ul className="mt-2 space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="text-xs leading-relaxed text-fg-muted">
                  <span className="text-fg">{note.title}</span>
                  {note.body ? ` · ${note.body}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-border bg-surface text-sm text-fg"
                onClick={onDismissUpgrade}
              >
                나중에
              </button>
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg"
                onClick={onConfirmUpgrade}
              >
                업그레이드
              </button>
            </div>
          </div>
        ) : null}

        {mode === "upgrade-done" ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-fg">업그레이드를 적용했습니다.</p>
            <ul className="mt-2 space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="text-xs leading-relaxed text-fg-muted">
                  <span className="text-fg">{note.title}</span>
                  {note.body ? ` · ${note.body}` : ""}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 min-h-12 w-full rounded-xl border border-mark bg-mark text-sm font-medium text-mark-fg"
              onClick={onAckUpgrade}
            >
              확인
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SongUnit({ song, onOpen }: { song: FillSongView; onOpen: (song: FillSongView) => void }) {
  const steps = song.steps?.length ? song.steps : FILL_STAGES.map((label) => ({ id: label, label, fields: [label] }));
  const pct = song.status === "done" ? 100 : song.status === "wait" ? 0 : Math.max(0, Math.min(100, song.pct));
  const active = song.status === "run" ? steps[Math.min(song.step, steps.length - 1)]?.label : "";
  const quiet = song.status === "done" || song.status === "wait";
  return (
    <button
      type="button"
      onClick={() => onOpen(song)}
      className={cn(
        "w-full rounded-xl border px-3 py-2 text-left",
        song.status === "run" ? "border-mark bg-surface" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 text-xs leading-snug text-fg">
          {song.status === "done" ? "완료 · " : song.status === "wait" ? "대기 · " : "진행 · "}
          <span className="font-medium">{song.name}</span>
          {quiet && song.detail ? <span className="text-fg-muted"> · {song.detail}</span> : null}
        </p>
      </div>
      {quiet ? null : (
      <div className="relative mt-1.5 h-7 overflow-hidden rounded-md bg-bg">
        <div className="absolute inset-y-0 left-0 bg-mark/70" style={{ width: `${pct}%` }} />
        <div className="relative flex h-full items-center">
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn(
                "flex h-full flex-1 items-center justify-center truncate px-0.5 text-[10px]",
                step.label === active ? "font-semibold text-fg" : "text-fg-muted",
              )}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
      )}
    </button>
  );
}

export function HoldPause({ onPause }: { onPause: () => void }) {
  const [ratio, setRatio] = useState(0);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);

  function clearHold() {
    if (timer.current) window.clearTimeout(timer.current);
    if (frame.current) window.cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }

  function release() {
    if (done.current) return;
    clearHold();
    setRatio(0);
  }

  function press(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    done.current = false;
    clearHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, (now - start.current) / 3000);
      setRatio(next);
      if (next < 1) frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    timer.current = window.setTimeout(() => {
      done.current = true;
      clearHold();
      setRatio(0);
      onPause();
    }, 3000);
  }

  return (
    <button
      type="button"
      className="relative z-20 h-[50px] w-full touch-none overflow-hidden rounded-[14px] bg-surface-2 px-4 text-[17px] font-semibold tracking-tight text-fg select-none"
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="absolute inset-y-0 left-0 bg-mark/35" style={{ width: `${ratio * 100}%` }} />
      <span className="relative">{ratio > 0 ? "계속 누르는 중" : "3초간 눌러 정지"}</span>
    </button>
  );
}
