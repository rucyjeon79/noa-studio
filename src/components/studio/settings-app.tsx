import { ChevronDown, Copy, Crown, Home, Key, Monitor, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { followTarget } from "@/lib/app-scroll";
import { GENRES, isStoryGenre, type GenreId } from "@/lib/catalog";
import { loadCommonPref, loadGenrePref, pullEncyclopedia, saveCommonPref, saveGenrePref } from "@/lib/pages";
import { Button } from "@/components/ui/button";
import { genreHasSuno } from "@/lib/suno-defaults";
import { CAST, CAST_ORDER } from "@/lib/characters";
import ogSite from "@/lib/og/site.json";
import { readGenreGuide } from "@/lib/genre-guides";
import {
  COMMON_LANGS,
  OUTPUT_LANGS,
  OUTPUT_ROWS,
  ACT_OUTPUT_ROWS,
  hasAnyCommon,
  hasCommon,
  hasStoredPref,
  nativeLang,
  normalizePref,
  prefSnap,
  readCommon,
  readPref,
  genreOnlyList,
  withGenreList,
  syncCurrentPrefs,
  useDesignRule,
  writeCommonField,
  writeCommonPatch,
  writeGenreSlot,
  writePref,
  type CommonKey,
  type CommonLang,
  type CommonPref,
  type GenrePref,
  type ThumbFocus,
  type TitleMode,
} from "@/lib/user-prefs";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "@/components/studio/gate-dialog";
import { ADMIN_DEVICE_LIMIT, GATE_EVENT, confirmAssignAdmin, deviceId, deviceKind, deviceLabel, isAdminDevice, isGateOpen, masterLocked, readAdminDevice, readAdminSlots, releaseAdminSlot, restoreAdminGate, setGateOpen } from "@/lib/gate";
import { ingestEncyclopedia } from "@/lib/package";
import { markMetaHydrated, readAppDump } from "@/lib/app-memory";
import { LiveFiles } from "@/components/studio/live-files";

const GROUPS: { heading: string; ids: GenreId[] }[] = [
  {
    heading: "오리지널",
    ids: ["kpop-original", "jpop-original", "pop-original", "thai-original"],
  },
  {
    heading: "컬렉션",
    ids: [
      "joseon-ballad",
      "panpop",
      "echoes-of-joseon",
      "latin-afrobeats-edm",
      "edm-kpop-club",
      "dreamy-deep-house",
      "fantasy-ambient-edm",
      "groovy-airy-pop",
      "narrative-piano-indie",
    ],
  },
  { heading: "Other Genre", ids: ["your-story", "cover-reborn"] },
];

type Tab = "common" | "genre";

const COMMON_GROUPS: { title: string; hint: string; rows: { key: CommonKey; n: string; title: string; hint: string; kind: "title" | "text" }[] }[] = [
  {
    title: "운영",
    hint: "잠금, 번호, 저장, 목록, 검사, 현행화. 다른 규칙보다 앞선다.",
    rows: [
      { key: "fixRule", n: "0", title: "수정 원칙", hint: "요청한 문제만 고친다. 다른 기능은 승인 없이 건드리지 않는다.", kind: "text" },
      { key: "lockRule", n: "00", title: "잠금 규칙", hint: "최고 관리자 기기는 2대까지. 그 외 기기는 심볼을 3초 눌러 그 방문만.", kind: "text" },
      { key: "matchRule", n: "00-1", title: "곡 번호 매치", hint: "EP 번호가 기준. 번호가 없는 곡만 제목으로 연결한다.", kind: "text" },
      { key: "saveRule", n: "00-7", title: "저장 규칙", hint: "곡, ACT, 사연, 원곡, 설정은 각각 지정한 폴더의 파일 하나에만 저장한다.", kind: "text" },
      { key: "placeRule", n: "00-8", title: "저장 위치", hint: "어느 폴더의 어느 파일에 무엇을 두는지.", kind: "text" },
      { key: "linkRule", n: "00-9", title: "연결 규칙", hint: "결과창은 그 파일을 먼저 읽고, 파일 없이 칸만 있으면 연결되지 않는다.", kind: "text" },
      { key: "playRule", n: "00-10", title: "재생 보정", hint: "마스터링 Intensity 50, LUFS -14, Peak -1. 분석값과 보정값을 곡 파일의 수노 주소 옆에 둔다.", kind: "text" },
      { key: "listRule", n: "00-5", title: "곡목록", hint: "확정은 금색. 원곡 열람·신곡, 사연 입력·목록은 잠금이 풀렸을 때만.", kind: "text" },
      { key: "healthRule", n: "00-6", title: "완결성 검사", hint: "첫 화면에서만 검사한다. 누르면 앱 전체를 읽고, 보고가 오면 그 문제만 고친다.", kind: "text" },
      { key: "liveRule", n: "00-2", title: "실시간 현행화", hint: "설정과 빌드 창은 바뀌는 즉시 지금 규칙을 읽는다.", kind: "text" },
      { key: "buildGuide", n: "00-2b", title: "빌드 안내", hint: "버전 버튼. 잠긴 화면 언어를 고르면 이 문장도 그 언어로 바뀐다.", kind: "text" },
    ],
  },
  {
    title: "자동 채우기",
    hint: "알림과 검열.",
    rows: [
      { key: "fillNotice", n: "00-3", title: "알림 · 자동 채우기", hint: "시작, 알림창, 정지, 작성, 재생목록.", kind: "text" },
      { key: "fillAudit", n: "01", title: "사전검열", hint: "확정 제목과 가사를 먼저. 한 곡을 끝낸 뒤 다음 곡.", kind: "text" },
      { key: "fieldAudit", n: "02", title: "항목 검열", hint: "설명 160자는 가사를 뺀 본문만.", kind: "text" },
    ],
  },
  {
    title: "제목",
    hint: "곡 제목과 유튜브 제목.",
    rows: [
      { key: "titleFormat", n: "03", title: "EP 제목 형식", hint: "100자. 사연곡과 재탄생 커버곡은 장르 페이지에서.", kind: "title" },
      { key: "youtubeSeo", n: "04", title: "유튜브 제목 SEO", hint: "100자. 넘치면 감성 한줄부터.", kind: "text" },
    ],
  },
  {
    title: "본문",
    hint: "출력 순서, 수노, 설명, 커뮤니티.",
    rows: [
      { key: "outputOrder", n: "06", title: "출력 순서", hint: "제목→가사→수노→Gemini→유튜브→설명→커뮤니티", kind: "text" },
      { key: "sunoLimit", n: "05", title: "수노 글자 한도", hint: "1000 초과 금지. 권장 700–900.", kind: "text" },
      { key: "descRules", n: "08", title: "설명란 글작성 규칙", hint: "전 장르 설명란 문체.", kind: "text" },
      { key: "communityRules", n: "09", title: "커뮤니티 글작성 규칙", hint: "전 장르 편지 문체.", kind: "text" },
    ],
  },
  {
    title: "썸네일",
    hint: "이미지 규칙.",
    rows: [
      { key: "thumbCastRule", n: "07", title: "기본 캐스트", hint: "노아·노엘 얼굴 고정. 곡마다 여자솔로·남자솔로·듀엣은 결과창.", kind: "text" },
      { key: "thumbImage", n: "10", title: "이미지 생성규칙", hint: "썸네일.", kind: "text" },
      { key: "thumbFont", n: "11", title: "글씨체", hint: "장르 분위기.", kind: "text" },
      { key: "thumbDecor", n: "12", title: "텍스트 꾸밈", hint: "썸네일.", kind: "text" },
      { key: "thumbLayout", n: "13", title: "텍스트 배치", hint: "인물 중심 / 텍스트 중심.", kind: "text" },
    ],
  },
  {
    title: "화면",
    hint: "메인 영상과 전체 디자인.",
    rows: [
      { key: "designRule", n: "00-7", title: "디자인", hint: "iOS처럼 정돈. 큰 화면은 양끝까지. 장르 창은 폰 크기로 아래에.", kind: "text" },
      { key: "splashRule", n: "00-4", title: "메인 화면 영상", hint: "세로는 장르 영상. 가로는 앱 미리보기 이미지만.", kind: "text" },
    ],
  },
];

function YesNo({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border">
      {([true, false] as const).map((item) => {
        const on = value === item;
        return (
          <button
            key={String(item)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item)}
            className={cn(
              "flex min-h-12 items-center justify-center text-sm",
              item === false && "border-l border-border",
              on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
              disabled ? "opacity-70" : "hover:bg-surface-2",
            )}
            aria-pressed={on}
          >
            {item ? "예" : "아니오"}
          </button>
        );
      })}
    </div>
  );
}

function preview(value: string, max = 80) {
  const one = String(value ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

export function SettingsApp() {
  useDesignRule();
  const [tab, setTab] = useState<Tab>("common");
  const [tick, setTick] = useState(0);
  const common = useMemo(() => readCommon(), [tick]);
  const [openKey, setOpenKey] = useState<CommonKey | "">("");
  const [draftCommon, setDraftCommon] = useState<CommonPref>(common);
  const [commonSaved, setCommonSaved] = useState("");
  const [rowError, setRowError] = useState("");

  const [genreId, setGenreId] = useState<GenreId | "">("");
  const [draft, setDraft] = useState<GenrePref | null>(null);
  const [genreSaved, setGenreSaved] = useState(false);
  const [genreError, setGenreError] = useState("");
  const [gateOpen, setGateUi] = useState(false);
  const settingsOpen = gateOpen || !masterLocked();
  const [passOpen, setPassOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [adminError, setAdminError] = useState("");
  const [dropId, setDropId] = useState("");
  const [dropKey, setDropKey] = useState("");
  const [dropError, setDropError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const genre = GENRES.find((g) => g.id === genreId);
  const storySettings = Boolean(genreId && isStoryGenre(genreId));
  const coverSettings = genreId === "cover-reborn";
  const genreLocked = false;
  const genreDirty = Boolean(draft && genreId && prefSnap(draft) !== prefSnap(readPref(genreId)));

  useEffect(() => {
    if (readAdminDevice()) setGateUi(isGateOpen());
    const onGate = () => setGateUi(isGateOpen());
    window.addEventListener(GATE_EVENT, onGate);
    pullEncyclopedia()
      .then((dump) => {
        if (dump) ingestEncyclopedia(dump);
        markMetaHydrated();
        restoreAdminGate();
        setGateUi(isGateOpen());
      })
      .catch(() => {
        markMetaHydrated();
      });
    return () => window.removeEventListener(GATE_EVENT, onGate);
  }, []);

  useEffect(() => {
    syncCurrentPrefs();
    setTick((n) => n + 1);
    void loadCommonPref()
      .then((remote) => {
        if (!remote || hasAnyCommon()) return;
        writeCommonPatch(remote);
        setTick((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDraftCommon(readCommon());
  }, [openKey, tick]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!genreDirty && !openKey) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [genreDirty, openKey]);

  function bump() {
    setTick((n) => n + 1);
  }

  function persistCommon() {
    const now = readCommon();
    const rev = typeof (now as { rev?: number }).rev === "number" ? (now as { rev?: number }).rev : 0;
    void saveCommonPref({ data: { pref: { ...now, baseRev: rev } } }).catch(() => {});
  }

  async function saveItem<K extends CommonKey>(key: K, value: CommonPref[K]) {
    if (String(value ?? "") === String(common[key] ?? "")) return;
    try {
      await writeCommonField(key, value);
      setOpenKey("");
      setRowError("");
      bump();
      setCommonSaved(key);
      window.setTimeout(() => setCommonSaved(""), 1200);
      window.requestAnimationFrame(() => {
        followTarget(document.getElementById(`settings-${key}`));
      });
    } catch (err) {
      setRowError(err instanceof Error && err.message ? err.message : "저장되지 않았습니다.");
    }
  }

  function pickGenre(id: GenreId | "") {
    if (genreDirty && !window.confirm("저장하지 않은 장르 설정이 있습니다. 버릴까요?")) return;
    setGenreId(id);
    setGenreSaved(false);
    if (!id) {
      setDraft(null);
      return;
    }
    const local = readPref(id);
    setDraft(local);
    void loadGenrePref({ data: { genreId: id } })
      .then((remote) => {
        if (!remote || hasStoredPref(id)) return;
        const next = normalizePref(id, remote);
        writePref(id, next);
        setDraft(readPref(id));
      })
      .catch(() => {});
  }

  async function saveGenre() {
    if (!genreId || !draft) return;
    writeGenreSlot(genreId, {
      lang: draft.lang,
      titleMode: genreId === "kpop-original" || isStoryGenre(genreId) ? "lock" : draft.titleMode,
      focus: draft.focus,
      reality: draft.reality,
      motion: draft.motion,
      extra: draft.extra,
      community: draft.output.letter,
      output:
        genreId === "kpop-original" || isStoryGenre(genreId)
          ? { ...draft.output, title: false }
          : draft.output,
      descLyrics: draft.descLyrics,
      lockDescLyrics: draft.lockDescLyrics,
      actPlaylist: draft.actPlaylist,
      actOutput: draft.actOutput,
      sunoBase: draft.sunoBase,
      vocalStyle: draft.vocalStyle,
      musicStyle: draft.musicStyle,
      rewriteRules: draft.rewriteRules,
      structure: draft.structure,
      moodLineRule: draft.moodLineRule,
      thumbGenreLine: draft.thumbGenreLine,
      forbidList: draft.forbidList,
      langRule: draft.langRule,
      titleModeRule: draft.titleModeRule,
      guideText:
        draft.guideText.trim() && draft.guideText.trim() !== readGenreGuide(genreId).trim()
          ? draft.guideText
          : "",
      titleFormat: isStoryGenre(genreId) ? draft.titleFormat : readPref(genreId).titleFormat,
      listRule: draft.listRule,
    });
    const saved = readPref(genreId);
    let baseRev = typeof (saved as { rev?: number }).rev === "number" ? (saved as { rev?: number }).rev : 0;
    try {
      const remote = await loadGenrePref({ data: { genreId } });
      if (remote && typeof remote.rev === "number") baseRev = remote.rev;
    } catch {
      /* 열어 둔 버전을 그대로 보낸다 */
    }
    try {
      const genreSaved = await saveGenrePref({
        data: {
          genreId,
          pref: {
            lang: saved.lang,
            titleFormat: saved.titleFormat,
            titleMode: saved.titleMode,
            focus: saved.focus,
            reality: saved.reality,
            motion: saved.motion,
            extra: saved.extra,
            community: saved.community,
            descLyrics: saved.descLyrics,
            lockDescLyrics: saved.lockDescLyrics,
            actPlaylist: saved.actPlaylist,
            actOutput: saved.actOutput,
            output: saved.output,
            sunoBase: saved.sunoBase,
            vocalStyle: saved.vocalStyle,
            musicStyle: saved.musicStyle,
            rewriteRules: saved.rewriteRules,
            structure: saved.structure,
            moodLineRule: saved.moodLineRule,
            thumbGenreLine: saved.thumbGenreLine,
            forbidList: saved.forbidList,
            langRule: saved.langRule,
            titleModeRule: saved.titleModeRule,
            guideText: saved.guideText,
            listRule: genreOnlyList(saved.listRule, readCommon().listRule),
            baseRev,
          },
        },
      });
      if (genreSaved && genreSaved.ok === false) throw new Error(genreSaved.error || "장르 설정을 덮지 않았습니다.");
    } catch (err) {
      setGenreError(err instanceof Error && err.message ? err.message : "저장되지 않았습니다.");
      followTarget(document.getElementById("genre-save"));
      return;
    }
    setGenreError("");
    setGenreSaved(false);
    setGenreId("");
    setDraft(null);
    window.requestAnimationFrame(() => {
      followTarget(document.getElementById("genre-settings-pick"));
    });
  }

  function commonValue(key: CommonKey) {
    return preview(common[key]);
  }

  return (
    <div className="min-h-[var(--app-h,100dvh)] bg-bg text-fg">
      <div className="app-col mx-auto w-full px-5 pb-24 pt-8 sm:pt-10">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/"
            aria-label="홈"
            className="inline-flex size-11 items-center justify-center rounded-md text-fg hover:bg-surface"
          >
            <Home className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-widest text-fg-subtle uppercase">사용자 설정값</p>
            <h1 className="font-display text-2xl font-medium tracking-tight text-fg">설정</h1>
          </div>
          {tab === "common" && settingsOpen ? (
            <button
              type="button"
              aria-label="비밀번호 변경"
              className="inline-flex size-11 items-center justify-center rounded-md text-fg hover:bg-surface"
              onClick={() => setPassOpen(true)}
            >
              <Key className="size-6" />
            </button>
          ) : null}
        </header>
        {!settingsOpen ? (
          <section className="overflow-hidden rounded-2xl bg-surface p-4">
            <p className="text-sm text-fg">열쇠가 잠겨 있습니다. 비밀번호와 보안키를 확인하면 설정이 열립니다.</p>
            <label className="mt-3 block text-xs text-fg-subtle">
              비밀번호
              <input
                type="password"
                value={adminPass}
                autoComplete="off"
                onChange={(event) => setAdminPass(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-3 text-base text-fg"
              />
            </label>
            <label className="mt-3 block text-xs text-fg-subtle">
              보안키
              <input
                type="password"
                value={adminKey}
                autoComplete="off"
                onChange={(event) => setAdminKey(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-3 text-base text-fg"
              />
            </label>
            {adminError ? <p className="mt-2 text-xs text-mark">{adminError}</p> : null}
            <Button
              type="button"
              variant="mark"
              size="lg"
              className="mt-4 w-full"
              onClick={() => {
                const message = confirmAssignAdmin(adminPass, adminKey);
                if (message) {
                  setAdminError(message);
                  return;
                }
                setGateOpen(true);
                setGateUi(true);
                setAdminError("");
                setAdminPass("");
                setAdminKey("");
                setTick((n) => n + 1);
              }}
            >
              설정 열기
            </Button>
          </section>
        ) : null}
        {settingsOpen ? (
          <>
        <div className="mb-8 grid grid-cols-2 gap-2">
          {(["common", "genre"] as const).map((id) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-xl border text-sm font-medium",
                  on ? "border-mark bg-mark text-mark-fg" : "border-border bg-surface text-fg hover:bg-surface-2",
                )}
              >
                {id === "common" ? "공통" : "장르"}
              </button>
            );
          })}
        </div>

        {tab === "common" ? (
          <div className="flex flex-col gap-8">
            <LiveFiles />
            <figure className="flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={`/og.jpg?v=${ogSite.imageRev}`}
                  alt="NOA STUDIO 링크 미리보기"
                  className="block w-full"
                />
                <button
                  type="button"
                  className="absolute bottom-[3.4%] right-[18%] inline-flex items-center gap-1 rounded-md bg-[#0c0a08]/92 px-2 py-1 text-[11px] font-semibold text-[#e8c547]"
                  onClick={() => {
                    const host = String(import.meta.env.VITE_PUBLIC_HOSTNAME || "").replace(/^https?:\/\//, "").trim();
                    const url = host ? `https://${host}` : window.location.origin;
                    const done = () => {
                      setLinkCopied(true);
                      window.setTimeout(() => setLinkCopied(false), 1200);
                    };
                    if (navigator.clipboard?.writeText) {
                      void navigator.clipboard.writeText(url).then(done).catch(() => {
                        const box = document.createElement("textarea");
                        box.value = url;
                        document.body.appendChild(box);
                        box.select();
                        document.execCommand("copy");
                        box.remove();
                        done();
                      });
                      return;
                    }
                    const box = document.createElement("textarea");
                    box.value = url;
                    document.body.appendChild(box);
                    box.select();
                    document.execCommand("copy");
                    box.remove();
                    done();
                  }}
                >
                  <Copy className="size-3" aria-hidden />
                  {linkCopied ? "복사됨" : "링크 복사"}
                </button>
              </div>
              <figcaption className="text-xs text-fg-subtle">
                이미지를 바꾸면 이 미리보기와 공유 링크에 반영되고, 오른쪽 아래 순번도 올라갑니다.
              </figcaption>
            </figure>
            <p className="text-sm text-fg-muted">전 장르 집 규칙. 줄을 눌러 고치고 그 줄만 저장합니다. 잠금은 메인 자물쇠만 합니다.</p>
            <section className="overflow-hidden rounded-2xl bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex min-h-28 flex-col items-center justify-center rounded-xl bg-bg px-3 py-4 text-center">
                  {deviceKind() === "phone" ? (
                    <Smartphone className="size-7 text-fg" aria-hidden />
                  ) : (
                    <Monitor className="size-7 text-fg" aria-hidden />
                  )}
                  <p className="mt-2 text-sm text-fg">{deviceLabel()}</p>
                </div>
                <div className="flex min-h-28 flex-col items-center justify-center rounded-xl bg-bg px-3 py-4 text-center">
                  {isAdminDevice() ? (
                    <>
                      <Crown className="size-6 text-mark" aria-hidden />
                      <p className="mt-2 text-sm font-medium text-fg">최고 관리자 입니다</p>
                    </>
                  ) : readAdminSlots().length < ADMIN_DEVICE_LIMIT ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-fg"
                      onClick={() => {
                        setAdminForm((open) => !open);
                        setAdminError("");
                      }}
                    >
                      <Crown className="size-4 text-mark" aria-hidden />
                      최고 관리자 지정
                    </button>
                  ) : (
                    <p className="text-sm text-fg-muted">최고 관리자 기기는 2대까지입니다</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-fg-subtle">등록 {readAdminSlots().length}/{ADMIN_DEVICE_LIMIT}</p>
              {readAdminSlots().length ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {readAdminSlots().map((row) => {
                    const mine = row.id === deviceId();
                    const open = dropId === row.id;
                    return (
                      <li key={row.id} className="rounded-xl bg-bg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm text-fg">
                            {row.label || "기기"}
                            {mine ? <span className="ml-1 text-xs text-fg-subtle">이 기기</span> : null}
                          </p>
                          <button
                            type="button"
                            aria-label="기기 삭제"
                            aria-expanded={open}
                            onClick={() => {
                              setDropId(open ? "" : row.id);
                              setDropKey("");
                              setDropError("");
                            }}
                            className="inline-flex size-8 shrink-0 items-center justify-center text-fg-muted"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        {open ? (
                          <div className="mt-2">
                            <label className="block text-xs text-fg-subtle">
                              보안키
                              <input
                                type="password"
                                value={dropKey}
                                autoComplete="off"
                                onChange={(event) => setDropKey(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
                              />
                            </label>
                            {dropError ? <p className="mt-2 text-xs text-mark">{dropError}</p> : null}
                            <Button
                              type="button"
                              variant="mark"
                              size="lg"
                              className="mt-3 w-full"
                              onClick={() => {
                                const message = releaseAdminSlot(row.id, dropKey);
                                if (message) {
                                  setDropError(message);
                                  return;
                                }
                                setDropId("");
                                setDropKey("");
                                setDropError("");
                                setTick((n) => n + 1);
                              }}
                            >
                              삭제
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {adminForm && !isAdminDevice() ? (
                <div className="mt-2 rounded-xl bg-bg px-3 py-4">
                  <label className="block text-xs text-fg-subtle">
                    비밀번호
                    <input
                      type="password"
                      value={adminPass}
                      autoComplete="off"
                      onChange={(event) => setAdminPass(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
                    />
                  </label>
                  <label className="mt-3 block text-xs text-fg-subtle">
                    보안키
                    <input
                      type="password"
                      value={adminKey}
                      autoComplete="off"
                      onChange={(event) => setAdminKey(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
                    />
                  </label>
                  {adminError ? <p className="mt-2 text-xs text-mark">{adminError}</p> : null}
                  <Button
                    type="button"
                    variant="mark"
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => {
                      const message = confirmAssignAdmin(adminPass, adminKey);
                      if (message) {
                        setAdminError(message);
                        return;
                      }
                      setAdminError("");
                      setAdminPass("");
                      setAdminKey("");
                      setAdminForm(false);
                      setGateOpen(true);
                      setGateUi(true);
                      setTick((n) => n + 1);
                    }}
                  >
                    저장
                  </Button>
                </div>
              ) : null}
            </section>
            <section className="bookmark-card overflow-hidden">
              <div className="px-4 py-3">
                <h2 className="text-sm font-medium text-fg">인물 고정</h2>
                <p className="mt-1 text-xs text-fg-subtle">노아와 노엘 얼굴은 전 장르 공통입니다. 곡의 솔로·듀엣은 결과창에서 고릅니다.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                {CAST_ORDER.map((id) => {
                  const person = CAST[id];
                  return (
                    <div key={person.id} className="flex items-center gap-3 rounded-2xl bg-bg px-3 py-2.5">
                      <img src={person.face} alt="" width={56} height={56} className="size-14 shrink-0 rounded-lg object-cover object-top" />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-fg">
                          {person.nameKo}
                          <span className="ml-1 text-sm text-fg-muted">{person.nameEn}</span>
                        </p>
                        <p className="text-xs text-fg-subtle">{person.role} · 얼굴 잠금</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {COMMON_GROUPS.map((group) => (
              <section key={group.title} className="flex flex-col gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-fg">{group.title}</h2>
                  <p className="mt-1 text-xs text-fg-subtle">{group.hint}</p>
                </div>
                {group.rows.map((row) => {
              const open = openKey === row.key;
              return (
                <section key={row.key} id={`settings-${row.key}`} className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenKey(open ? "" : row.key)}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs tabular-nums text-fg-subtle">{row.n}</p>
                      <h2 className="text-sm font-medium text-fg">{row.title}</h2>
                      <p className="mt-1 text-xs text-fg-subtle">{row.hint}</p>
                    </div>
                    <ChevronDown className={cn("mt-1 size-4 shrink-0 text-fg-muted", open && "rotate-180")} />
                  </button>
                  <div className="border-t border-border px-4 py-4">
                    {!open ? (
                      <p className="whitespace-pre-wrap text-sm text-fg">
                        {commonValue(row.key)}
                        {!hasCommon(row.key) ? (
                          <span className="ml-2 text-xs text-fg-subtle">저장 전 · 기본</span>
                        ) : null}
                        {commonSaved === row.key ? <span className="ml-2 text-xs text-mark">저장됨</span> : null}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <textarea
                          value={String(draftCommon[row.key] ?? "")}
                          onChange={(e) => {
                            const v = row.kind === "title" ? e.target.value.slice(0, 100) : e.target.value;
                            setDraftCommon({ ...draftCommon, [row.key]: v });
                          }}
                          rows={row.kind === "title" ? 3 : 8}
                          className="min-h-20 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                        />
                        {row.kind === "title" ? (
                          <span className="block text-right font-mono text-xs tabular-nums text-fg-subtle">
                            {String(draftCommon.titleFormat).length}/100
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="mark"
                          disabled={String(draftCommon[row.key] ?? "") === String(common[row.key] ?? "")}
                          onClick={() => saveItem(row.key, draftCommon[row.key] as never)}
                        >
                          저장
                        </Button>
                        {rowError && openKey === row.key ? <p className="text-sm text-fg">{rowError}</p> : null}
                      </div>
                    )}
                  </div>
                </section>
                );
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">장르 세계관. 고친 뒤 맨 아래 저장입니다. 항목 잠금은 없습니다.</p>
            <section id="genre-settings-pick">
              <p className="text-xs font-medium tracking-widest text-fg-subtle uppercase">장르</p>
              <div className="relative mt-2">
                <select
                  value={genreId}
                  onChange={(e) => pickGenre((e.target.value || "") as GenreId | "")}
                  className="min-h-12 w-full appearance-none rounded-xl border border-mark bg-surface px-4 py-3 pr-10 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                >
                  <option value="">장르 선택</option>
                  {GROUPS.map((group) => (
                    <optgroup key={group.heading} label={group.heading}>
                      {group.ids.map((id) => {
                        const item = GENRES.find((g) => g.id === id);
                        return item ? (
                          <option key={id} value={id}>
                            {item.label}
                          </option>
                        ) : null;
                      })}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted" />
              </div>
            </section>

            {genre && draft ? (
              <>
                <h2 className="font-display text-xl text-fg">{genre.label}</h2>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">장르 지침</h3>
                    <p className="mt-1 text-xs text-fg-subtle">비워 둔 채 저장하면 최신 지침이 자동으로 들어온다. 고쳐서 저장하면 그 글이 남는다. 둘 다 수정할 수 있다.</p>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.guideText.trim() ? draft.guideText : genreId ? readGenreGuide(genreId) : ""}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, guideText: e.target.value })}
                      rows={10}
                      className="min-h-40 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">출력</h3>
                    <p className="mt-1 text-xs text-fg-subtle">예와 아니오는 누를 수 있습니다. K-POP 원곡, 사연곡, 재탄생 커버곡 상단의 제목·보컬·가사도 미리보기가 있는 펼침 창이며, 펼치면 수정하고 저장할 수 있습니다.</p>
                  </div>
                  <div className="border-b border-border">
                    <p className="px-4 pt-3 text-sm text-fg">사용 언어</p>
                    <p className="px-4 pt-1 text-xs text-fg-subtle">규칙에 적힌 항목만 이 언어로 번역합니다.</p>
                    <div className="relative mt-2 border-t border-border">
                      <select
                        value={draft.lang}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, lang: e.target.value as CommonLang })}
                        className="min-h-12 w-full appearance-none bg-bg px-4 py-3 pr-10 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark"
                      >
                        {COMMON_LANGS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.id === "default"
                              ? `기본(${OUTPUT_LANGS.find((lang) => lang.id === (genreId ? nativeLang(genreId) : "ko"))?.label ?? "한국어"})`
                              : item.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted" />
                    </div>
                    <textarea
                      value={draft.langRule}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, langRule: e.target.value })}
                      rows={3}
                      className="min-h-20 w-full resize-y border-t border-border bg-bg px-4 py-3 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark"
                    />
                  </div>
                  {OUTPUT_ROWS.filter((row) => row.key !== "title" || (genreId !== "kpop-original" && !isStoryGenre(genreId))).map((row) => {
                    return (
                    <div key={row.key} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                      <span className="text-sm text-fg">{row.label}</span>
                      <div className="grid w-36 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-border">
                        {([true, false] as const).map((item) => {
                          const on = draft.output[row.key] === item;
                          return (
                            <button
                              key={String(item)}
                              type="button"
                              disabled={genreLocked}
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  output: { ...draft.output, [row.key]: item },
                                  community: row.key === "letter" ? item : draft.community,
                                })
                              }
                              className={cn(
                                "flex h-9 items-center justify-center text-xs",
                                item === false && "border-l border-border",
                                on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                                genreLocked ? "opacity-70" : "hover:bg-surface-2",
                              )}
                            >
                              {item ? "예" : "아니오"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );})}
                </section>

                {genreId === "kpop-original" || storySettings ? null : (
                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">확정 제목</h3>
                  </div>
                  <div className="grid grid-cols-2 overflow-hidden border-b border-border">
                    {(["lock", "rewrite"] as TitleMode[]).map((value) => {
                      const on = draft.titleMode === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={genreLocked}
                          onClick={() => setDraft({ ...draft, titleMode: value })}
                          className={cn(
                            "flex min-h-12 flex-col items-center justify-center px-3 py-2 text-center",
                            value === "rewrite" && "border-l border-border",
                            on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                            genreLocked ? "opacity-70" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="text-sm font-medium">{value === "lock" ? "고정" : "변환"}</span>
                          <span className="mt-0.5 text-[11px] leading-tight opacity-80">
                            {value === "lock" ? "결과창 상단 원곡 제목" : "장르 · 주사용 언어"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="border-b border-border px-4 py-3 text-xs text-fg-subtle">결과창의 제목은 확정 제목입니다. 제목 고정이어도 원곡 제목을 복사하지 않습니다. 확정 제목을 바꾸면 고정이든 변환이든 그 제목을 따릅니다.</p>
                  <textarea
                    value={draft.titleModeRule}
                    disabled={genreLocked}
                    onChange={(e) => setDraft({ ...draft, titleModeRule: e.target.value })}
                    rows={3}
                    className="min-h-20 w-full resize-y bg-bg px-4 py-3 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark"
                  />
                </section>
                )}

                {storySettings ? (
                  <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                    <div className="border-b border-border px-4 py-3">
                      <h3 className="text-sm font-medium text-fg">{coverSettings ? "커버곡 제목 형식" : "사연곡 제목 형식"}</h3>
                    </div>
                    <div className="px-4 py-4">
                      <textarea
                        value={draft.titleFormat}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, titleFormat: e.target.value.slice(0, 100) })}
                        rows={3}
                        className="min-h-20 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                      />
                    </div>
                  </section>
                ) : null}

                {storySettings ? (
                  <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                    <div className="border-b border-border px-4 py-3">
                      <h3 className="text-sm font-medium text-fg">{coverSettings ? "커버곡만의 규칙" : "사연곡만의 규칙"}</h3>
                      <p className="mt-1 text-xs text-fg-subtle">공통 규칙은 그대로 적용된다. {coverSettings ? "여기에는 재탄생 커버곡만 다른 문장만 둔다. 제목과 원곡 가수는 입력창 하나에 | 또는 - 로 적는다. 다음은 가사, 그 다음 보컬 버튼이다. 원곡 가수는 필수다. 설명란에는 원곡 가수와 저작권 문장을 넣는다." : "여기에는 사연곡만 다른 문장만 둔다."}</p>
                    </div>
                    <div className="px-4 py-4">
                      <textarea
                        value={genreOnlyList(draft.listRule, readCommon().listRule)}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, listRule: withGenreList(readCommon().listRule, e.target.value) })}
                        rows={12}
                        className="min-h-48 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                      />
                    </div>
                  </section>
                ) : null}

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-fg">설명란 가사</h3>
                      <p className="mt-1 text-xs text-fg-subtle">단곡에만 적용됩니다. ACT 결과 설명란의 가사 자리는 이 설정과 상관없이 트랙리스트가 들어갑니다.</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-sm text-fg">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#e8c547]"
                        checked={draft.lockDescLyrics !== false}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, lockDescLyrics: e.target.checked })}
                      />
                      앱잠금 시 출력
                    </label>
                  </div>
                  <div className="px-4 py-4">
                    <YesNo
                      value={draft.descLyrics}
                      disabled={genreLocked}
                      onChange={(v) => setDraft({ ...draft, descLyrics: v })}
                    />
                  </div>
                </section>

                {storySettings ? (
                  <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                    <div className="border-b border-border px-4 py-3">
                      <h3 className="text-sm font-medium text-fg">{coverSettings ? "커버곡 플레이리스트" : "사연곡 플레이리스트"}</h3>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {coverSettings
                          ? "재탄생 커버곡은 독립된 장르다. 공통 규칙을 따르고, 그 아래는 이 장르 규칙만 따른다. 10곡이 차도 플레이리스트를 자동으로 만들지 않습니다. 기본 플레이리스트 이름은 내가 아는 유명곡의 재탄생입니다. 열람에서 곡을 고르고 주제를 입력한 뒤에만 만듭니다. 설명란에는 원곡 가수와 저작권 문장을 넣습니다. 확정된 설명은 다시 쓰지 않습니다."
                          : "사연곡은 10곡이 차도 플레이리스트를 자동으로 만들지 않습니다. 열람에서 곡을 고르고 주제를 입력한 뒤에만 만듭니다. 설명란의 가사 자리에는 고른 곡명만 들어가고, 본문은 다른 플레이리스트와 같습니다."}
                      </p>
                    </div>
                    <div className="border-t border-border">
                      <p className="px-4 pt-3 text-sm text-fg">ACT 출력 항목</p>
                      <p className="px-4 pt-1 pb-2 text-xs text-fg-subtle">예인 칸만 이 장르 ACT 결과창에 나옵니다. 곡 출력과는 따로입니다.</p>
                      {ACT_OUTPUT_ROWS.map((row) => (
                        <div key={`story-${row.key}`} className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                          <span className="text-sm text-fg">{row.label}</span>
                          <div className="grid w-36 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-border">
                            {([true, false] as const).map((item) => {
                              const on = draft.actOutput[row.key] === item;
                              return (
                                <button
                                  key={String(item)}
                                  type="button"
                                  disabled={genreLocked}
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      actOutput: { ...draft.actOutput, [row.key]: item },
                                    })
                                  }
                                  className={cn(
                                    "flex h-9 items-center justify-center text-xs",
                                    item === false && "border-l border-border",
                                    on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                                    genreLocked ? "opacity-70" : "hover:bg-surface-2",
                                  )}
                                >
                                  {item ? "예" : "아니오"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">ACT 플레이리스트 자동 생성</h3>
                    <p className="mt-1 text-xs text-fg-subtle">
                      예이면 이 장르 ACT 10곡이 모두 확정될 때 결과창을 만듭니다. 아래 출력 항목에서 예로 둔 칸만 ACT 결과창에 나옵니다. 수록곡은 EP.번호와 그 장르·ACT에 저장된 제목입니다. 시간 표시는 붙이지 않습니다. 결과의 Act 번호는 지금 연 ACT와 같습니다. 수록곡을 직접 수정해 저장하면 그 글이 유지되고 곡 제목으로 다시 덮이지 않습니다. 설명란을 직접 수정해 저장하면 그 글 그대로 남고, 트랙리스트로 다시 조립하지 않습니다. 유튜브 주소를 넣고 확정하면 곡과 같이 미리보기, 바로 재생, 구독 바로가기를 보여 줍니다. 확정하면 결과창을 닫고 그 ACT 선택 위치로 이동합니다. 잠금이 풀리면 ACT 선택창에 결과창 보기가 나오고, 그 아래에서 펼칩니다. 메인 자물쇠가 잠기면 결과창 대신 설명란 펼침을 보여 줍니다. 곡 목록 맨 아래에는 두지 않습니다.
                    </p>
                  </div>
                  <div className="px-4 py-4">
                    <YesNo
                      value={draft.actPlaylist}
                      disabled={genreLocked}
                      onChange={(v) => setDraft({ ...draft, actPlaylist: v })}
                    />
                  </div>
                  <div className="border-t border-border">
                    <p className="px-4 pt-3 text-sm text-fg">ACT 출력 항목</p>
                    <p className="px-4 pt-1 pb-2 text-xs text-fg-subtle">예인 칸만 이 장르 ACT 결과창에 나옵니다. 곡 출력과는 따로입니다.</p>
                    {ACT_OUTPUT_ROWS.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                        <span className="text-sm text-fg">{row.label}</span>
                        <div className="grid w-36 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-border">
                          {([true, false] as const).map((item) => {
                            const on = draft.actOutput[row.key] === item;
                            return (
                              <button
                                key={String(item)}
                                type="button"
                                disabled={genreLocked}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    actOutput: { ...draft.actOutput, [row.key]: item },
                                  })
                                }
                                className={cn(
                                  "flex h-9 items-center justify-center text-xs",
                                  item === false && "border-l border-border",
                                  on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                                  genreLocked ? "opacity-70" : "hover:bg-surface-2",
                                )}
                              >
                                {item ? "예" : "아니오"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                )}

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">썸네일</h3>
                  </div>
                  <div className="flex flex-col gap-4 px-4 py-4">
                    <div>
                      <p className="text-sm text-fg-muted">중심</p>
                      <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-border">
                        {(["text", "character"] as ThumbFocus[]).map((value) => {
                          const on = draft.focus === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              disabled={genreLocked}
                              onClick={() => setDraft({ ...draft, focus: value })}
                              className={cn(
                                "flex min-h-12 items-center justify-center text-sm",
                                value === "character" && "border-l border-border",
                                on ? "bg-mark text-mark-fg" : "bg-surface text-fg",
                                genreLocked ? "opacity-70" : "hover:bg-surface-2",
                              )}
                            >
                              {value === "text" ? "텍스트" : "인물"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="flex items-center justify-between text-sm text-fg-muted">
                        실사 비중
                        <span className="font-mono text-xs tabular-nums text-fg">{draft.reality}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        disabled={genreLocked}
                        value={draft.reality}
                        onChange={(e) => setDraft({ ...draft, reality: Number(e.target.value) })}
                        className="mt-3 w-full accent-[var(--mark)] disabled:opacity-50"
                      />
                    </label>
                    <label className="block">
                      <span className="flex items-center justify-between text-sm text-fg-muted">
                        인물의 역동성
                        <span className="font-mono text-xs tabular-nums text-fg">{draft.motion}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        disabled={genreLocked}
                        value={draft.motion}
                        onChange={(e) => setDraft({ ...draft, motion: Number(e.target.value) })}
                        className="mt-3 w-full accent-[var(--mark)] disabled:opacity-50"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-fg-muted">추가사항</span>
                      <textarea
                        value={draft.extra}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, extra: e.target.value })}
                        rows={5}
                        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                      />
                    </label>
                  </div>
                </section>

                {genreId && genreHasSuno(genreId) ? (
                  <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                    <div className="border-b border-border px-4 py-3">
                      <h3 className="text-sm font-medium text-fg">수노 기본 프롬프트</h3>
                      <p className="mt-1 text-xs text-fg-subtle">영어. 1000자 이하.</p>
                    </div>
                    <div className="px-4 py-4">
                      <textarea
                        value={draft.sunoBase}
                        disabled={genreLocked}
                        onChange={(e) => setDraft({ ...draft, sunoBase: e.target.value.slice(0, 1000) })}
                        rows={8}
                        className="min-h-32 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                      />
                      <span className="mt-1 block text-right font-mono text-xs tabular-nums text-fg-subtle">
                        {draft.sunoBase.length}/1000
                      </span>
                    </div>
                  </section>
                ) : (
                  <p className="text-xs text-fg-subtle">이 장르는 수노 프롬프트를 쓰지 않습니다.</p>
                )}

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">개사 규칙</h3>
                    <p className="mt-1 text-xs text-fg-subtle">한영 비율, 훅, 금지 말.</p>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.rewriteRules}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, rewriteRules: e.target.value })}
                      rows={5}
                      className="min-h-28 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">곡 구조</h3>
                    <p className="mt-1 text-xs text-fg-subtle">섹션 순서.</p>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.structure}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, structure: e.target.value })}
                      rows={4}
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">감성 한줄</h3>
                    <p className="mt-1 text-xs text-fg-subtle">가사·분위기를 짧게. 언어 설정이 아님.</p>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.moodLineRule}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, moodLineRule: e.target.value })}
                      rows={3}
                      className="min-h-20 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">썸네일 장르표기 (보조줄)</h3>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.thumbGenreLine}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, thumbGenreLine: e.target.value })}
                      rows={2}
                      className="min-h-16 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">금지 목록</h3>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.forbidList}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, forbidList: e.target.value })}
                      rows={4}
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">보컬 스타일</h3>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.vocalStyle}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, vocalStyle: e.target.value })}
                      rows={4}
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface nest">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-medium text-fg">음악 스타일</h3>
                  </div>
                  <div className="px-4 py-4">
                    <textarea
                      value={draft.musicStyle}
                      disabled={genreLocked}
                      onChange={(e) => setDraft({ ...draft, musicStyle: e.target.value })}
                      rows={4}
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
                    />
                  </div>
                </section>

                <div id="genre-save" className="sticky-cta sticky bottom-0 z-10 -mx-5 border-t border-border bg-bg/95 px-5 py-3 backdrop-blur">
                  {genreError ? <p className="mb-2 text-sm text-fg">{genreError}</p> : null}
                  <Button
                    type="button"
                    variant="mark"
                    className="w-full"
                    disabled={genreLocked || !genreDirty}
                    onClick={saveGenre}
                  >
                    {genreSaved ? "저장됨" : "저장"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-fg-muted">장르를 고르면 슬롯이 열립니다.</p>
            )}
          </div>
        )}
          </>
        ) : null}
        <ChangePasswordDialog open={passOpen} onClose={() => setPassOpen(false)} />
      </div>
    </div>
  );
}