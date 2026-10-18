import { Check, ChevronDown, Copy, Download, RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { KoText, holdFoldClose } from "@/components/studio/studio-chrome";
import { appScrollBy, keepView, pinWorkField } from "@/lib/app-scroll";
import { copyText } from "@/lib/clipboard";
import { SongFileBar } from "@/components/studio/song-file-bar";
import type { SongFileTarget } from "@/lib/song-files";
import { forgetFieldDraft, noteFieldDraft } from "@/lib/field-draft";
import { descriptionBodyForMatch, descriptionSungOnly, lyricMarkerFromText, visibleBreaks } from "@/lib/lyrics-clean";
import { analysisCaption, audioLevelCaption } from "@/lib/loudness";
import { isLocked, type PlaylistPackage, type StudioPackage, type StoryPackage } from "@/lib/package";
import { outputBlockIds, type OutputShow } from "@/lib/user-prefs";
import { cn } from "@/lib/utils";

export type BlockDef = {
  id: string;
  n: string;
  label: string;
  text: string;
  code: boolean;
  imageUrl?: string;
  fixed?: boolean;
  review?: boolean;
  descMode?: "lyrics" | "tracks";
  view?: string;
  fileText?: string;
  fileKnown?: boolean;
};

function sunoDiffers(text: string, base: string) {
  const norm = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
  const out = norm(text);
  if (!out) return false;
  return out !== norm(base);
}

function samePane(a: string, b: string) {
  const norm = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

function urlAddress(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const hit = text.match(/https?:\/\/[^\s<>"']+/i);
  return (hit ? hit[0].replace(/[),.;]+$/g, "") : text).trim();
}

export function shownThumb(fileKnown: boolean, fileFields?: Record<string, string>) {
  if (!fileKnown) return "";
  return String(fileFields?.thumbUrl || "");
}

export function urlTone(value: string, fileUrl: string, fileKnown: boolean) {
  const shown = urlAddress(value);
  if (!shown) return "";
  if (!fileKnown) return "white";
  const filed = urlAddress(fileUrl);
  if (!filed) return "white";
  return shown === filed ? "gold" : "red";
}

function fileTone(block: BlockDef) {
  if (block.fixed) return "";
  const rawShown = String(block.text || "");
  const rawFiled = String(block.fileText || "");
  const shown = (block.id === "yt-desc" ? descriptionBodyForMatch(rawShown) : rawShown).trim();
  if (!shown) return "";
  if (!block.fileKnown) return "white";
  const filed = (block.id === "yt-desc" ? descriptionBodyForMatch(rawFiled) : rawFiled).trim();
  if (!filed) return "white";
  return samePane(shown, filed) ? "gold" : "red";
}

function orderBlocks(blocks: BlockDef[], order?: string) {
  const rank = new Map(outputBlockIds(order).map((id, index) => [id, index]));
  const key = (id: string) => (id === "community" ? "letter" : id === "tracks" ? "lyrics" : id);
  const orig = blocks.filter((block) => block.id.startsWith("orig-"));
  const rest = blocks.filter((block) => !block.id.startsWith("orig-"));
  rest.sort((a, b) => (rank.get(key(a.id)) ?? 99) - (rank.get(key(b.id)) ?? 99));
  return [...orig, ...rest].map((block, index) => ({ ...block, n: String(index + 1).padStart(2, "0") }));
}

function levelClean(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;gain=-?\d+(?:\.\d+)?;peak=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

function analysisClean(raw: string) {
  const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^lufs=-?\d+(?:\.\d+)?;peak=-?\d+(?:\.\d+)?;lift=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}

function SunoUrlLine({ value, onChange, analysis = "", onAnalysis, savedAnalysis = "", level = "", onLevel, savedLevel = "", fileUrl = "", fileKnown = false, editKey = "" }: { value: string; onChange: (value: string) => void; analysis?: string; onAnalysis?: (value: string) => void; savedAnalysis?: string; level?: string; onLevel?: (value: string) => void; savedLevel?: string; fileUrl?: string; fileKnown?: boolean; editKey?: string }) {
  const [sunoLocal, setSunoLocal] = useState(value);
  const [analysisLocal, setAnalysisLocal] = useState(analysis);
  const [levelLocal, setLevelLocal] = useState(level);
  const sunoEdit = useRef(false);
  const analysisEdit = useRef(false);
  const levelEdit = useRef(false);
  const sunoFocus = useRef(false);
  const analysisFocus = useRef(false);
  const levelFocus = useRef(false);
  const editKeyRef = useRef(editKey);
  if (editKeyRef.current !== editKey) {
    editKeyRef.current = editKey;
    sunoEdit.current = false;
    analysisEdit.current = false;
    levelEdit.current = false;
    sunoFocus.current = false;
    analysisFocus.current = false;
    levelFocus.current = false;
  }
  if (!sunoFocus.current && !sunoEdit.current && sunoLocal !== value) setSunoLocal(value);
  useLayoutEffect(() => {
    if (analysisFocus.current || analysisEdit.current) return;
    if (analysisLocal !== analysis) setAnalysisLocal(analysis);
  }, [analysis, editKey, analysisLocal]);
  useLayoutEffect(() => {
    if (levelFocus.current || levelEdit.current) return;
    if (levelLocal !== level) setLevelLocal(level);
  }, [level, editKey, levelLocal]);
  const analysisNote = analysisCaption(analysisLocal);
  const caption = audioLevelCaption(levelLocal);
  const shownAnalysis = analysisClean(analysisLocal);
  const filedAnalysis = analysisClean(savedAnalysis);
  const analysisTone = !String(analysisLocal || "").trim() ? "" : !fileKnown || !filedAnalysis ? "white" : shownAnalysis === filedAnalysis ? "gold" : "red";
  const shownLevel = levelClean(levelLocal);
  const filedLevel = levelClean(savedLevel);
  const levelTone = !String(levelLocal || "").trim() ? "" : !fileKnown || !filedLevel ? "white" : shownLevel === filedLevel ? "gold" : "red";
  const tone = urlTone(sunoLocal, fileUrl, fileKnown);
  const box = "relative z-10 mt-2 w-full rounded-xl border bg-surface px-4 py-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark";
  const toneClass = (kind: string) => cn(kind === "gold" && "border-[#e8c547]/55", kind === "red" && "border-red-500", kind === "white" && "border-white", !kind && "border-border");
  return (
    <span className="relative z-10 block" data-link-pane="1">
      <span className="text-xs font-medium tracking-widest text-fg-subtle uppercase">SUNO URL</span>
      <input
        value={sunoLocal}
        type="text"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://suno.com/song/"
        data-suno-field="1"
        onFocus={() => {
          sunoFocus.current = true;
          sunoEdit.current = true;
        }}
        onBlur={(event) => {
          sunoFocus.current = false;
          window.dispatchEvent(new CustomEvent("noa-link-commit", { detail: { field: "suno", value: event.currentTarget.value } }));
        }}
        onChange={(event) => {
          sunoEdit.current = true;
          setSunoLocal(event.target.value);
          onChange(event.target.value);
        }}
        className={cn(box, toneClass(tone))}
      />
      <span className="mt-3 block text-xs font-medium tracking-widest text-fg-subtle uppercase">분석값</span>
      <input
        value={analysisLocal}
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-analysis-field="1"
        placeholder="lufs=-16.0;peak=-1.2;lift=1.5"
        onFocus={() => {
          analysisFocus.current = true;
          analysisEdit.current = true;
        }}
        onBlur={() => {
          analysisFocus.current = false;
        }}
        onChange={(event) => {
          analysisEdit.current = true;
          setAnalysisLocal(event.target.value);
          onAnalysis?.(event.target.value);
        }}
        className={cn(box, "font-mono text-xs", toneClass(analysisTone))}
      />
      {analysisNote ? <span className={cn("mt-2 block text-xs leading-relaxed", analysisTone === "gold" ? "text-[#e8c547]" : "text-fg-subtle")}>{analysisNote}</span> : null}
      <span className="mt-3 block text-xs font-medium tracking-widest text-fg-subtle uppercase">보정값</span>
      <input
        value={levelLocal}
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-level-field="1"
        placeholder="lufs=-14.0;gain=0.0;peak=0.0"
        onFocus={() => {
          levelFocus.current = true;
          levelEdit.current = true;
        }}
        onBlur={() => {
          levelFocus.current = false;
        }}
        onChange={(event) => {
          levelEdit.current = true;
          setLevelLocal(event.target.value);
          onLevel?.(event.target.value);
        }}
        className={cn(box, "font-mono text-xs", toneClass(levelTone))}
      />
      {caption ? <span className={cn("mt-2 block text-xs leading-relaxed", levelTone === "gold" ? "text-[#e8c547]" : "text-fg-subtle")}>{caption}</span> : null}
    </span>
  );
}

function withFile(block: BlockDef, file?: Record<string, string>, known = false): BlockDef {
  if (!known || !file) return block;
  const key = block.id === "title" ? "confirmedTitle"
    : block.id === "lyrics" ? "lyricsBlock"
    : block.id === "tracks" ? "tracklist"
    : block.id === "suno" ? "sunoStyle"
    : block.id === "thumb" ? "geminiPrompt"
    : block.id === "yt-title" ? "youtubeTitle"
    : block.id === "yt-desc" ? "youtubeDescription"
    : block.id === "letter" ? "fanLetter"
    : block.id === "community" ? "communityPost"
    : block.id === "summary" ? "summary"
    : "";
  if (!key) return block;
  return { ...block, fileKnown: true, fileText: String(file[key] ?? "") };
}

export function PackageView({
  pkg,
  showLetter,
  showSuno,
  showLyrics = true,
  showDescLyrics = true,
  hideSource = false,
  output,
  source,
  locks,
  busyId,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  imageBusy,
  sealed = false,
  focusId = null,
  focusPhase = null,
  markIds = [],
  order,
  sunoBase = "",
  draftScope = "",
  sunoUrl = "",
  audioAnalysis = "",
  audioLevel = "",
  onSunoUrl,
  onAnalysis,
  onLevel,
  fileFields,
  fileKnown = false,
  editKey = "",
  fileTarget,
}: {
  pkg: StudioPackage;
  showLetter: boolean;
  showSuno: boolean;
  showLyrics?: boolean;
  showDescLyrics?: boolean;
  hideSource?: boolean;
  output?: OutputShow;
  source?: { title?: string; vocal?: string; lyrics?: string };
  locks: Record<string, boolean>;
  busyId: string | null;
  onToggleLock: (id: string) => void;
  onRegen: (id: string, note: string) => void;
  onPatch: (id: string, text: string) => void | string;
  onRegenImage?: () => void;
  imageBusy?: boolean;
  sealed?: boolean;
  focusId?: string | null;
  focusPhase?: "audit" | "work" | null;
  markIds?: string[];
  order?: string;
  sunoBase?: string;
  draftScope?: string;
  sunoUrl?: string;
  audioAnalysis?: string;
  audioLevel?: string;
  onSunoUrl?: (value: string) => void;
  onAnalysis?: (value: string) => void;
  onLevel?: (value: string) => void;
  fileFields?: Record<string, string>;
  fileKnown?: boolean;
  editKey?: string;
  fileTarget?: SongFileTarget;
}) {
  const show: OutputShow = output ?? {
    origTitle: false,
    origVocal: false,
    origLyrics: false,
    summary: false,
    title: !hideSource,
    lyrics: showLyrics,
    suno: showSuno,
    thumb: true,
    ytTitle: true,
    ytDesc: true,
    letter: showLetter,
  };
  const blocks: BlockDef[] = [];
  if (show.origTitle) blocks.push({ id: "orig-title", n: "01", label: "원곡 제목", text: source?.title ?? "", code: true, fixed: true });
  if (show.origVocal) blocks.push({ id: "orig-vocal", n: "02", label: "원곡 보컬정보", text: source?.vocal ?? "", code: false, fixed: true });
  if (show.origLyrics) blocks.push({ id: "orig-lyrics", n: "03", label: "원곡 가사", text: source?.lyrics ?? "", code: true, fixed: true });
  if (show.title) blocks.push({ id: "title", n: "04", label: "확정 제목", text: pkg.confirmedTitle, code: true });
  if (show.lyrics) blocks.push({ id: "lyrics", n: "05", label: "가사", text: pkg.lyricsBlock, code: true });
  if (show.suno) blocks.push({ id: "suno", n: "06", label: "SUNO STYLE", text: pkg.sunoStyle, code: true, review: sunoDiffers(pkg.sunoStyle, sunoBase) });
  if (show.thumb) {
    blocks.push({
      id: "thumb",
      n: "07",
      label: "썸네일",
      text: pkg.geminiPrompt,
      code: true,
      imageUrl: shownThumb(fileKnown, fileFields),
    });
  }
  if (show.ytTitle) blocks.push({ id: "yt-title", n: "08", label: "YouTube title", text: pkg.youtubeTitle, code: true });
  if (show.ytDesc) {
    blocks.push({
      id: "yt-desc",
      n: "09",
      label: "영상 설명란",
      text: pkg.youtubeDescription,
      view: descriptionSungOnly(pkg.youtubeDescription),
      code: true,
    });
  }
  if (show.letter) blocks.push({ id: "letter", n: "10", label: "커뮤니티 글", text: pkg.fanLetter, code: true });
  const blocksView = (
    <ResultBlocks
      blocks={orderBlocks(blocks, order).map((block) => withFile(block, fileFields, fileKnown))}
      locks={locks}
      busyId={busyId}
      sealed={sealed}
      onToggleLock={onToggleLock}
      onRegen={onRegen}
      onPatch={onPatch}
      onRegenImage={onRegenImage}
      imageBusy={imageBusy}
      focusId={focusId}
      focusPhase={focusPhase}
      markIds={markIds}
      draftScope={draftScope}
    />
  );
  const shown = (
    <>
      {fileTarget ? <SongFileBar target={fileTarget} /> : null}
      {blocksView}
    </>
  );
  if (!onSunoUrl) return shown;
  return (
    <div className="flex flex-col gap-4">
      {shown}
      <SunoUrlLine value={sunoUrl} analysis={audioAnalysis} onAnalysis={onAnalysis} savedAnalysis={fileKnown ? String(fileFields?.audioAnalysis || "") : ""} level={audioLevel} onLevel={onLevel} savedLevel={fileKnown ? String(fileFields?.audioLevel || "") : ""} fileUrl={fileKnown ? String(fileFields?.sunoUrl || "") : ""} fileKnown={fileKnown} editKey={editKey} onChange={onSunoUrl} />
    </div>
  );
}

export function PlaylistView({
  pkg,
  showCommunity,
  showDescLyrics = true,
  output,
  locks,
  busyId,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  imageBusy,
  sealed = false,
  focusId = null,
  focusPhase = null,
  markIds = [],
  order,
  sunoBase = "",
  draftScope = "",
  previews = {},
  sunoUrl = "",
  audioAnalysis = "",
  audioLevel = "",
  onSunoUrl,
  onAnalysis,
  onLevel,
  fileFields,
  fileKnown = false,
  editKey = "",
  fileTarget,
}: {
  pkg: PlaylistPackage;
  showCommunity: boolean;
  showDescLyrics?: boolean;
  output?: OutputShow;
  locks: Record<string, boolean>;
  busyId: string | null;
  onToggleLock: (id: string) => void;
  onRegen: (id: string, note: string) => void;
  onPatch: (id: string, text: string) => void | string;
  onRegenImage?: () => void;
  imageBusy?: boolean;
  sealed?: boolean;
  focusId?: string | null;
  focusPhase?: "audit" | "work" | null;
  markIds?: string[];
  order?: string;
  sunoBase?: string;
  draftScope?: string;
  previews?: Record<string, string>;
  sunoUrl?: string;
  audioAnalysis?: string;
  audioLevel?: string;
  onSunoUrl?: (value: string) => void;
  onAnalysis?: (value: string) => void;
  onLevel?: (value: string) => void;
  fileFields?: Record<string, string>;
  fileKnown?: boolean;
  editKey?: string;
  fileTarget?: SongFileTarget;
}) {
  const blocks: BlockDef[] = [];
  const show: OutputShow = output ?? {
    origTitle: false,
    origVocal: false,
    origLyrics: false,
    summary: false,
    title: true,
    lyrics: true,
    suno: true,
    thumb: true,
    ytTitle: true,
    ytDesc: true,
    letter: showCommunity,
  };
  void showDescLyrics;
  if (show.title) blocks.push({ id: "title", n: "01", label: "확정 제목", text: pkg.confirmedTitle, code: true });
  if (show.lyrics) blocks.push({ id: "tracks", n: "02", label: "수록곡", text: pkg.tracklist, code: true });
  if (show.suno) blocks.push({ id: "suno", n: "03", label: "SUNO STYLE", text: pkg.sunoStyle, code: true, review: sunoDiffers(pkg.sunoStyle, sunoBase) });
  if (show.thumb) {
    blocks.push({
      id: "thumb",
      n: "04",
      label: "썸네일",
      text: pkg.geminiPrompt,
      code: true,
      imageUrl: shownThumb(fileKnown, fileFields),
    });
  }
  if (show.ytTitle) blocks.push({ id: "yt-title", n: "05", label: "YouTube title", text: pkg.youtubeTitle, code: true });
  if (show.ytDesc) blocks.push({ id: "yt-desc", n: "06", label: "영상 설명란", text: pkg.youtubeDescription, code: true, descMode: "tracks" });
  if (show.letter) blocks.push({ id: "community", n: "07", label: "커뮤니티 글", text: pkg.communityPost, code: true });
  void previews;
  const blocksView = (
    <ResultBlocks
      blocks={orderBlocks(blocks, order).map((block) => withFile(block, fileFields, fileKnown))}
      locks={locks}
      busyId={busyId}
      sealed={sealed}
      onToggleLock={onToggleLock}
      onRegen={onRegen}
      onPatch={onPatch}
      onRegenImage={onRegenImage}
      imageBusy={imageBusy}
      focusId={focusId}
      focusPhase={focusPhase}
      markIds={markIds}
      draftScope={draftScope}
    />
  );
  const shown = (
    <>
      {fileTarget ? <SongFileBar target={fileTarget} /> : null}
      {blocksView}
    </>
  );
  if (!onSunoUrl) return shown;
  return (
    <div className="flex flex-col gap-4">
      {shown}
      <SunoUrlLine value={sunoUrl} analysis={audioAnalysis} onAnalysis={onAnalysis} savedAnalysis={fileKnown ? String(fileFields?.audioAnalysis || "") : ""} level={audioLevel} onLevel={onLevel} savedLevel={fileKnown ? String(fileFields?.audioLevel || "") : ""} fileUrl={fileKnown ? String(fileFields?.sunoUrl || "") : ""} fileKnown={fileKnown} editKey={editKey} onChange={onSunoUrl} />
    </div>
  );
}

export function StoryView({
  pkg,
  showLetter = true,
  showDescLyrics = true,
  output,
  source,
  locks,
  busyId,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  imageBusy,
  sealed = false,
  focusId = null,
  focusPhase = null,
  markIds = [],
  order,
  sunoBase = "",
  sourceGenre,
  beforeThumb = null,
  playlistSlot = null,
  descText,
  songTitle = "",
  draftScope = "",
  sunoUrl = "",
  audioAnalysis = "",
  audioLevel = "",
  onSunoUrl,
  onAnalysis,
  onLevel,
  fileFields,
  fileKnown = false,
  editKey = "",
  fileTarget,
}: {
  pkg: StoryPackage;
  showLetter?: boolean;
  showDescLyrics?: boolean;
  output?: OutputShow;
  source?: { title?: string; vocal?: string; lyrics?: string };
  locks: Record<string, boolean>;
  busyId: string | null;
  onToggleLock: (id: string) => void;
  onRegen: (id: string, note: string) => void;
  onPatch: (id: string, text: string) => void | string;
  onRegenImage?: () => void;
  imageBusy?: boolean;
  sealed?: boolean;
  focusId?: string | null;
  focusPhase?: "audit" | "work" | null;
  markIds?: string[];
  order?: string;
  sunoBase?: string;
  sourceGenre?: string;
  beforeThumb?: ReactNode;
  playlistSlot?: ReactNode;
  descText?: string;
  songTitle?: string;
  draftScope?: string;
  sunoUrl?: string;
  audioAnalysis?: string;
  audioLevel?: string;
  onSunoUrl?: (value: string) => void;
  onAnalysis?: (value: string) => void;
  onLevel?: (value: string) => void;
  fileFields?: Record<string, string>;
  fileKnown?: boolean;
  editKey?: string;
  fileTarget?: SongFileTarget;
}) {
  const show: OutputShow = output ?? {
    origTitle: false,
    origVocal: false,
    origLyrics: false,
    summary: false,
    title: false,
    lyrics: false,
    suno: true,
    thumb: true,
    ytTitle: true,
    ytDesc: true,
    letter: showLetter,
  };
  const blocks: BlockDef[] = [];
  if (show.origTitle) blocks.push({ id: "orig-title", n: "01", label: "원곡 제목", text: source?.title ?? "", code: true, fixed: true });
  if (show.origVocal) blocks.push({ id: "orig-vocal", n: "02", label: "원곡 보컬정보", text: source?.vocal ?? "", code: false, fixed: true });
  if (sourceGenre !== undefined) {
    blocks.push({ id: "orig-genre", n: "03", label: "장르", text: sourceGenre, code: true, fixed: true });
  }
  if (show.origLyrics) blocks.push({ id: "orig-lyrics", n: "04", label: "원곡 가사", text: source?.lyrics ?? "", code: true, fixed: true });
  if (show.thumb) {
    blocks.push({
      id: "thumb", n: "01", label: "썸네일", text: pkg.geminiPrompt, code: true, imageUrl: shownThumb(fileKnown, fileFields),
    });
  }
  if (show.ytTitle) blocks.push({ id: "yt-title", n: "02", label: "YouTube title", text: pkg.youtubeTitle, code: true });
  if (show.ytDesc) {
    blocks.push({
      id: "yt-desc",
      n: "03",
      label: "영상 설명란",
      text: pkg.youtubeDescription,
      view: descText != null && descText !== pkg.youtubeDescription ? descText : undefined,
      code: true,
      descMode: "lyrics",
    });
  }
  if (show.suno) {
    blocks.push({
      id: "suno",
      n: "04",
      label: "SUNO STYLE",
      text: pkg.sunoStyle,
      code: true,
      review: sunoDiffers(pkg.sunoStyle, sunoBase),
    });
  }
  if (show.letter) {
    blocks.push({ id: "letter", n: "05", label: "커뮤니티 글", text: pkg.fanLetter, code: true });
  }
  const ordered = orderBlocks(blocks, order);
  const thumbAt = ordered.findIndex((block) => block.id === "thumb");
  const head = thumbAt < 0 ? ordered : ordered.slice(0, thumbAt);
  const tail = thumbAt < 0 ? [] : ordered.slice(thumbAt);
  const blockProps = {
    locks,
    busyId,
    sealed,
    onToggleLock,
    onRegen,
    onPatch,
    onRegenImage,
    imageBusy,
    focusId,
    focusPhase,
    markIds,
    draftScope,
    fileFields,
    fileKnown,
  };
  const body = (
    <div className="mt-4 flex flex-col gap-4">
      {fileTarget ? <SongFileBar target={fileTarget} /> : null}
      {head.length ? <ResultBlocks blocks={head} {...blockProps} /> : null}
      {playlistSlot}
      {beforeThumb}
      {tail.length ? <ResultBlocks blocks={tail} {...blockProps} /> : null}
    </div>
  );
  if (!onSunoUrl) return body;
  return (
    <div className="flex flex-col gap-4">
      {body}
      <SunoUrlLine value={sunoUrl} analysis={audioAnalysis} onAnalysis={onAnalysis} savedAnalysis={fileKnown ? String(fileFields?.audioAnalysis || "") : ""} level={audioLevel} onLevel={onLevel} savedLevel={fileKnown ? String(fileFields?.audioLevel || "") : ""} fileUrl={fileKnown ? String(fileFields?.sunoUrl || "") : ""} fileKnown={fileKnown} editKey={editKey} onChange={onSunoUrl} />
    </div>
  );
}

function WakeBorder() {
  return (
    <>
      <span aria-hidden className="wake-line" />
      <span aria-hidden className="wake-spark" />
    </>
  );
}

function ResultBlocks({
  blocks,
  locks,
  busyId,
  sealed = false,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  imageBusy,
  focusId = null,
  focusPhase = null,
  markIds = [],
  draftScope = "",
  fileFields,
  fileKnown = false,
}: {
  blocks: BlockDef[];
  locks: Record<string, boolean>;
  busyId: string | null;
  sealed?: boolean;
  onToggleLock: (id: string) => void;
  onRegen: (id: string, note: string) => void;
  onPatch: (id: string, text: string) => void | string;
  onRegenImage?: () => void;
  imageBusy?: boolean;
  focusId?: string | null;
  focusPhase?: "audit" | "work" | null;
  markIds?: string[];
  draftScope?: string;
  fileFields?: Record<string, string>;
  fileKnown?: boolean;
  editKey?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => (
        <PackageBlock
          key={block.id}
          block={withFile(block, fileFields, fileKnown && !block.fileKnown)}
          locked={isLocked(locks, block.id)}
          sealed={sealed}
          busy={busyId === block.id || (focusPhase === "work" && focusId === block.id)}
          focus={focusId === block.id ? focusPhase : null}
          marked={markIds.includes(block.id)}
          onToggleLock={() => onToggleLock(block.id)}
          onRegen={(note) => onRegen(block.id, note)}
          onPatch={(text) => onPatch(block.id, text)}
          onRegenImage={block.id === "thumb" ? onRegenImage : undefined}
          imageBusy={block.id === "thumb" ? imageBusy : false}
          draftScope={draftScope}
        />
      ))}
    </div>
  );
}

function isLyricHeading(line: string) {
  return /^(?:가사|歌詞|Lyrics|เนื้อเพลง)$/.test(line.trim());
}

function LyricsSheet({ text, fit = false }: { text: string; fit?: boolean }) {
  const blocks: { tag: string; lines: string[] }[] = [];
  let cur = { tag: "", lines: [] as string[] };
  for (const raw of visibleBreaks(text).replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const tag = line.match(/^\[([^\]\n]+)\]$/)?.[1] ?? "";
    if (tag) {
      if (cur.tag || cur.lines.some((item) => item.trim())) blocks.push(cur);
      cur = { tag, lines: [] };
      continue;
    }
    if (/^\([^)]+\)$/.test(line) && /[A-Za-z]/.test(line) && !/[가-힣]/.test(line)) continue;
    cur.lines.push(raw);
  }
  if (cur.tag || cur.lines.some((item) => item.trim())) blocks.push(cur);
  void fit;
  return (
    <div className="px-4 py-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-[#d7c4a3]">LYRICS</p>
        <p className="mt-1 text-[13px] font-medium text-fg">{lyricMarkerFromText(text)}</p>
        <div className="mt-3 space-y-4 border-l-2 border-[#d7c4a3]/70 pl-3">
          {blocks.map((block, index) => (
            <div key={index}>
              {block.tag ? <p className="text-[11px] font-semibold tracking-wide text-[#d7c4a3]">{block.tag}</p> : null}
              {block.lines.some((line) => line.trim()) ? (
                <p className="mt-1 text-[15px] leading-7 whitespace-pre-wrap text-fg">{block.lines.join("\n").trim()}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DescriptionBody({ text, full = false, fit = false, mode }: { text: string; full?: boolean; fit?: boolean; mode?: "lyrics" | "tracks" }) {
  const shown = visibleBreaks(text);
  const parts = shown.split(/━{4,}/);
  const head = (parts[0] ?? "").trim();
  const tail = parts.length > 2 ? (parts[parts.length - 1] ?? "").trim() : "";
  const rawInner = (parts.length > 2 ? parts.slice(1, -1).join("\n") : parts.slice(1).join("\n")).trim();
  const inner = rawInner.replace(/^\s*(?:가사|歌詞|Lyrics|เนื้อเพลง)\s*\n+/, "").trim();
  const rawLines = inner.split("\n").map((line) => line.trim()).filter(Boolean);
  const markedLyrics = isLyricHeading(rawInner);
  const tracklist = mode === "tracks" ? true : mode === "lyrics" || markedLyrics ? false : rawLines.length > 0 && rawLines.every((line) => {
    if (/^\d{1,2}:\d{2}\s+\S/.test(line) || /^EP\.\d+\b/i.test(line)) return true;
    if (isLyricHeading(line) || line.length > 80 || /[\[\]━.!?,。]/.test(line)) return false;
    return true;
  });
  const lines = rawLines.map((line) => line.replace(/^\d{1,2}:\d{2}\s+/, ""));
  const verses = tracklist ? lines : inner.split(/\n{2,}/).map((verse) => verse.trim()).filter(Boolean);
  void fit;
  return (
    <div className={cn(full ? "px-3 py-2" : "px-4 py-3")}>
      {head ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">{head}</p> : null}
      {verses.length ? (
        <div className="my-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-[#d7c4a3]">{tracklist ? "TRACKLIST" : "LYRICS"}</p>
          <p className="mt-1 text-[13px] font-medium text-fg">{tracklist ? <KoText text="트랙리스트" /> : lyricMarkerFromText(inner || head)}</p>
          <div className="mt-3 space-y-3 border-l-2 border-[#d7c4a3]/70 pl-3">
            {verses.map((verse, index) => (
              <p key={index} className="text-[15px] leading-7 whitespace-pre-wrap text-fg">
                {verse}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      {tail ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">{tail}</p> : null}
    </div>
  );
}

function PackageBlock({
  block,
  locked,
  sealed = false,
  busy,
  onToggleLock,
  onRegen,
  onPatch,
  onRegenImage,
  imageBusy,
  focus = null,
  marked = false,
  draftScope = "",
}: {
  block: BlockDef;
  locked: boolean;
  sealed?: boolean;
  busy: boolean;
  onToggleLock: () => void;
  onRegen: (note: string) => void;
  onPatch: (text: string) => void | string;
  onRegenImage?: () => void;
  imageBusy?: boolean;
  focus?: "audit" | "work" | null;
  marked?: boolean;
  draftScope?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedOn, setTypedOn] = useState(block.text);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const editingField = useRef(false);
  const propChanged = block.text !== typedOn;
  if (propChanged && !editingField.current) {
    setTypedOn(block.text);
    if (typed == null || typed === block.text) setTyped(null);
  }
  const shown = typed != null && typed !== block.text ? typed : block.text;
  const readText = block.text;
  const liveRef = useRef(shown);
  liveRef.current = shown;
  const [imgChrome, setImgChrome] = useState(false);
  const [editing, setEditing] = useState(false);
  const [opened, setOpened] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const open = opened;
  const dirty = shown !== block.text || unsaved;
  const pretty = block.id === "lyrics" || block.id === "orig-lyrics" || block.id === "yt-desc" || block.id === "tracks";
  const readOnly = Boolean(block.fixed);
  const sourceOnly = Boolean(block.fixed);
  useLayoutEffect(() => {
    if (!draftScope || readOnly) {
      if (draftScope) forgetFieldDraft(draftScope, block.id);
      return;
    }
    noteFieldDraft(draftScope, block.id, shown, block.text);
  }, [draftScope, readOnly, block.id, shown, block.text]);
  void locked;
  void onToggleLock;

  function onCopy(event?: { stopPropagation?: () => void }) {
    event?.stopPropagation?.();
    holdFoldClose(2500);
    const text = liveRef.current;
    const scroller = document.scrollingElement;
    const top = scroller?.scrollTop ?? 0;
    const left = scroller?.scrollLeft ?? 0;
    const restore = () => {
      if (!scroller) return;
      scroller.scrollTop = top;
      scroller.scrollLeft = left;
    };
    const finish = (ok: boolean) => {
      restore();
      window.getSelection()?.removeAllRanges();
      if (!ok) {
        window.dispatchEvent(new CustomEvent("noa-user-notice", { detail: "복사를 못 했습니다. 글자를 길게 눌러 다시 복사하세요." }));
        return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };
    const clip = navigator.clipboard;
    if (clip?.writeText) {
      void clip.writeText(text).then(
        () => finish(true),
        () => {
          void copyText(text).then((wrote) => finish(wrote));
        },
      );
      window.requestAnimationFrame(restore);
      return;
    }
    void copyText(text).then((wrote) => finish(wrote));
  }

  function saveDraft() {
    const reason = onPatch(shown);
    if (reason) {
      setUnsaved(true);
      window.dispatchEvent(new CustomEvent("noa-user-notice", { detail: String(reason) }));
      return;
    }
    setUnsaved(true);
    let done = false;
    const finish = (event: Event) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      const ok = Boolean((event as CustomEvent<{ ok?: boolean }>).detail?.ok);
      if (!ok) {
        window.dispatchEvent(new CustomEvent("noa-user-notice", { detail: "이 칸을 파일에 남기지 못했습니다." }));
        return;
      }
      setUnsaved(false);
      setEditing(false);
    };
    window.addEventListener("noa-cell-save", finish, { once: true });
    const timer = window.setTimeout(() => {
      window.removeEventListener("noa-cell-save", finish);
      if (done) return;
      done = true;
      window.dispatchEvent(new CustomEvent("noa-user-notice", { detail: "이 칸을 파일에 남기지 못했습니다." }));
    }, 20000);
  }

  function placeToggle(next: boolean | ((value: boolean) => boolean)) {
    const section = document.getElementById(`field-${block.id}`);
    setOpened(next);
    keepView(section);
  }

  const spinning = Boolean((busy || imageBusy) && focus !== "work" && focus !== "audit" && !marked);
  const running = Boolean(busy || imageBusy || focus === "work" || focus === "audit");
  const waking = running || marked;
  const workingNow = focus === "work" || focus === "audit" || spinning;
  const inWorkGroup = workingNow || marked;
  useEffect(() => {
    if (!inWorkGroup) return;
    const el = document.getElementById(`field-${block.id}`);
    if (!el) return;
    return pinWorkField(el);
  }, [inWorkGroup, block.id]);
  const regenBtn = !sourceOnly && !sealed ? (
    <Button type="button" variant="mark" size="sm" className="shrink-0" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onRegen(running ? "취소" : "");
    }}>
      {running ? "취소" : "재생성"}
    </Button>
  ) : null;
  useEffect(() => {
    if (focus === "work" || focus === "audit" || !spinning) return;
    const el = document.getElementById(`field-${block.id}`);
    if (!el) return;
    const fit = () => {
      const notice = document.getElementById("fill-notice") || document.getElementById("result-status");
      const bar = notice ? notice.getBoundingClientRect().top : window.innerHeight;
      const gap = 8;
      const room = Math.max(140, Math.floor(bar - gap - 8));
      el.setAttribute("data-fill-fit", "1");
      el.style.maxHeight = `${room}px`;
      el.style.overflow = "auto";
      const rect = el.getBoundingClientRect();
      if (rect.bottom > bar - gap) appScrollBy(rect.bottom - (bar - gap), "auto");
      else if (rect.top < 8) appScrollBy(rect.top - 8, "auto");
    };
    const frame = window.requestAnimationFrame(fit);
    return () => {
      window.cancelAnimationFrame(frame);
      el.style.maxHeight = "";
      el.style.overflow = "";
      el.removeAttribute("data-fill-fit");
    };
  }, [focus, spinning, block.id]);

  const tone = fileTone({ ...block, text: shown });
  return (
    <section
      id={`field-${block.id}`}
      className={cn(
        "scroll-mt-28 overflow-hidden rounded-xl bg-surface",
        waking && "wake-glow",
        !waking && tone === "gold" && "border border-[#e8c547]/55",
        !waking && tone === "red" && "border border-red-500",
        !waking && tone === "white" && "border border-white",
        !waking && !tone && (sourceOnly ? "border border-source" : "border border-border"),
      )}
    >
      {waking ? <WakeBorder /> : null}
      <div className={cn("nest relative z-10 flex min-h-0 flex-1 flex-col", focus && "overflow-hidden")}>
      <div className={cn("flex shrink-0 items-center gap-1 px-4 py-2.5", open && (sourceOnly ? "border-b border-source/40" : "border-b border-border"))}>
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center text-left",
            focus && "cursor-default",
          )}
          onClick={() => {
            if (focus) return;
            placeToggle((value) => !value);
          }}
        >
          <div className="min-w-0">
            <p className="font-mono text-xs tabular-nums text-fg-subtle">{block.n}</p>
            <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg">
              <span className="truncate">{block.label}</span>
              {block.id === "suno" || block.id === "yt-title" ? (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-subtle">{shown.trim().length}자</span>
              ) : null}
              {block.review ? (
                <span className="shrink-0 rounded-sm border border-mark px-1.5 py-0.5 text-[10px] font-semibold leading-none text-mark">
                  검토
                </span>
              ) : null}
              {focus === "audit" ? (
                <span className="ml-2 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent-fg">
                  검열
                </span>
              ) : null}
            </h3>
          </div>
        </button>
        {sourceOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCopy(event);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "복사됨" : "복사"}
          </Button>
        )}
        {!focus ? (
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 text-fg-muted"
            aria-label={open ? "접기" : "펼치기"}
            onClick={() => placeToggle((value) => !value)}
          >
            <ChevronDown className={cn("size-4", open && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {open && !sourceOnly ? (
        <div
          className="save-row relative z-30 flex flex-wrap items-center gap-1 border-b border-border px-4 py-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {regenBtn}
          {sealed ? null : (
          <Button
            type="button"
            variant={reqOpen ? "mark" : "secondary"}
            size="sm"
            aria-pressed={reqOpen}
            onClick={() => setReqOpen((v) => !v)}
          >
            요구사항
          </Button>
          )}
          {pretty && (block.id === "lyrics" || block.id === "yt-desc") && readText.trim() && !editing ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
              직접 수정
            </Button>
          ) : null}
          {pretty && (block.id === "lyrics" || block.id === "yt-desc") && editing ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
              {block.id === "yt-desc" ? "설명으로 보기" : "가사 표기로 보기"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={dirty ? "mark" : "secondary"}
            size="sm"
            className="ml-auto"
            onClick={saveDraft}
          >
            저장
          </Button>
        </div>
      ) : null}
      {open ? <>
      {reqOpen && !sealed ? (
        <div className="border-b border-border px-4 py-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="이 블록만. 예: 후렴 더 짧게"
            className="min-h-16 w-full resize-y rounded-md border border-mark/70 bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
          />
          <Button
            type="button"
            size="sm"
            variant="mark"
            className="mt-2"
            disabled={busy || !note.trim()}
            onClick={() => onRegen(note)}
          >
            {busy ? "적용 중" : "적용"}
          </Button>
        </div>
      ) : null}
      {block.imageUrl ? (
        <div
          className="relative cursor-pointer overflow-hidden"
          onClick={() => setImgChrome((v) => !v)}
        >
          <img
            src={block.imageUrl}
            alt=""
            className="h-auto w-full object-contain"
          />
          {imgChrome || imageBusy ? (
            <div
              className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void downloadUrl(block.imageUrl!, "noa-studio-thumb.png")}
              >
                <Download />
                다운로드
              </Button>
              {sealed ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="mark"
                  disabled={!onRegenImage}
                  onClick={() => onRegenImage?.()}
                >
                  {imageBusy ? null : <RefreshCw />}
                  {imageBusy ? "취소" : "재생성"}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {pretty && readText.trim() && (readOnly || !editing) ? (
        <div className={cn(focus && "flex min-h-0 flex-1 flex-col overflow-hidden")}>
          <div className={cn(focus && "min-h-0 flex-1 overflow-auto")}>
            {block.id === "yt-desc" ? (
              <DescriptionBody text={readText} fit={Boolean(focus)} mode={block.descMode} />
            ) : block.id === "tracks" ? (
              <DescriptionBody text={`━━━━━━━━━━━━━━━━━━━━\n${readText}\n━━━━━━━━━━━━━━━━━━━━`} fit={Boolean(focus)} mode="tracks" />
            ) : (
              <LyricsSheet text={readText} fit={Boolean(focus)} />
            )}
          </div>
          {readOnly || block.id === "lyrics" || block.id === "yt-desc" ? null : (
            <div className="shrink-0 px-4 pb-3">
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
                직접 수정
              </Button>
            </div>
          )}
        </div>
      ) : readOnly ? (
        block.code ? (
          <pre
            data-copy-live=""
            className={cn(
            "min-w-0 px-4 py-3 font-mono text-xs leading-relaxed break-words text-fg whitespace-pre-wrap",
            focus && "min-h-0 flex-1 overflow-auto",
          )}>
            {visibleBreaks(shown)}
          </pre>
        ) : (
          <p data-copy-live="" className="px-4 py-3 text-sm leading-normal text-fg-muted text-pretty">{visibleBreaks(shown)}</p>
        )
      ) : (
        <div className={cn(focus && "flex min-h-0 flex-1 flex-col overflow-hidden")}>
          <textarea
            data-copy-live=""
            ref={boxRef}
            value={shown}
            onFocus={() => {
              editingField.current = true;
            }}
            onBlur={() => {
              editingField.current = false;
            }}
            onChange={(e) => setTyped(e.target.value)}
            rows={focus ? Math.min(12, Math.max(4, shown.split("\n").length + 1)) : Math.max(4, shown.split("\n").length + 1)}
            className={cn(
              "min-h-24 w-full border-0 bg-bg px-4 py-3 text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mark",
              focus ? "min-h-0 flex-1 resize-none overflow-auto" : "resize-y",
              block.code ? "font-mono text-xs leading-relaxed" : "text-sm leading-normal",
            )}
          />
          {pretty && block.id !== "lyrics" && block.id !== "yt-desc" ? (
            <div className="save-row flex shrink-0 flex-wrap items-center gap-2 px-4 pb-3">
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
                {block.id === "tracks" ? "목록으로 보기" : block.id === "yt-desc" ? "설명으로 보기" : "가사 표기로 보기"}
              </Button>
              <Button type="button" size="sm" variant={dirty ? "mark" : "secondary"} onClick={saveDraft}>
                저장
              </Button>
            </div>
          ) : null}
        </div>
      )}
      </> : (
        <div className={cn("relative border-t", sourceOnly ? "border-source/40" : "border-border")}>
          {regenBtn ? <div className="absolute top-1/2 right-2 z-10 -translate-y-1/2">{regenBtn}</div> : null}
          <p
            data-copy-live=""
            className={cn("cursor-pointer truncate px-4 py-3 text-sm leading-relaxed text-fg", regenBtn && "pr-24")}
            onClick={() => placeToggle(true)}
          >
            {(() => {
              const line = shown.replace(/\s+/g, " ").trim();
              if (!line) return block.imageUrl ? "썸네일 이미지" : "비어 있음";
              return line.length > 80 ? `${line.slice(0, 80)}…` : line;
            })()}
          </p>
        </div>
      )}
      </div>
    </section>
  );
}
