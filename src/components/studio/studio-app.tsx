// @ts-nocheck
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ChevronDown, ClipboardCheck, ListPlus, Lock, LockOpen, Music, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActRow, PlayNotice, MiniCorner, InstallAsk, applyPendingFoldClose, BusyBox, clearResultFold, closeFold, DescFold, dropFoldClose, EpSongList, foldIsOpen, GenerateBar, GenreGroup, KoText, MailCompose, openFold, OrigSourceFields, queueFoldTop, ResultActions, ResultFold, ResultPane, resultFoldKey, ViewLangPick, YoutubeField, askYoutubeOpenMany, knownYoutubeOpen } from "@/components/studio/studio-chrome";
import { NoticePanel } from "@/components/studio/gap-status";
import { PackageView, PlaylistView } from "@/components/studio/package-view";
import { SongFileBar } from "@/components/studio/song-file-bar";
import { PickerSheet } from "@/components/studio/picker-sheet";
import { CastBar, CastDialog, CastRadios } from "@/components/studio/thumb-cast";
import { UnlockDialog } from "@/components/studio/gate-dialog";
import { StoryHome } from "@/components/studio/story-app";
import { GATE_EVENT, adminSealDenied, ensureSecurityKey, isAdminDevice, isGateOpen, masterLocked, readAdminDevice, restoreAdminGate } from "@/lib/gate";
import { appScrollBy, appScrollTo, followTarget, followTop, placeFillField, showWorkGroup } from "@/lib/app-scroll";
import { defaultThumbCast, thumbCastFromVocal, THUMB_CASTS } from "@/lib/characters";
import { DEFAULT_GENRE, EPS, GENRES, actFromEp, actTrackLine, actsForEntries, alignActCopy, asTimedTracklist, getAct, getEp, getGenre, genreWantsSuno, isEpNumber, padEp, tracksForAct, readGenreSlot, writeGenreSlot } from "@/lib/catalog";
import { applyFixedOrder, moveId, readListOrder, writeListOrder } from "@/lib/list-order";
import { PREF_EVENT, applyDumpPrefs, hasStoredPref, lockPolicy, normalizePref, readCommon, readPref, syncCurrentPrefs, useDesignRule, useGenrePref, writePref } from "@/lib/user-prefs";
import { traceField } from "@/lib/field-trace";
import { appDumpRev, cancelQueuedPage, flushAppPagesNow, holdPageLink, markMetaHydrated, patchApp, patchQueuedBody, readAppDump, readSaveDiag, saveMetaNow } from "@/lib/app-memory";
import { collectOriginals, extrasAsEps, getOriginal, readOriginals, upsertOriginal } from "@/lib/originals";
import { SEED_ORIGINALS } from "@/lib/originals-seed";
import { formatSource } from "@/lib/source-draft";
import { applyPrefToStudio, auditStudioFields, byFillLead, fieldFix, fillRank, localFillPlaylist, patchStudioFields, requiredStudioFields } from "@/lib/fill-local";
import { PLAYLIST_BLOCKS, STUDIO_BLOCKS, SAVED_PANE_KEYS, adoptSavedFileText, betterStudio, clearBorrowedFields, emptyPlaylist, emptyStudio, foreignSongTitleIn, hasPageBody, hasPlaylistBody, ingestEncyclopedia, isConfirmed, isLocked, isPlaylistComplete, isStudioComplete, listConfirmedEps, listStorySongs, mergeFilledPlaylist, mergePlaylist, mergeStudio, missingPlaylistLabels, missingStudioLabels, overlayTitles, packageFitsSong, canKeepPackage, keepBlockReason, patchPlaylistPkg, patchStudio, pinShownPlaylist, pinShownSong, placeSavedSong, readCachedPackage, readCachedPlaylist, linkPremiumOn, premiumChoice, writeLinkPremium, readLocks, readPackageStamp, readPlaylistStamp, readPlaylistYoutubeUrl, readMvUrl, readPlaylistMvUrl, readSunoUrl, readPlaylistSunoUrl, readRowLocked, readSavedEps, readYoutubeMap, readYoutubeUrl, rememberActPreview, rememberPlaylist, rememberSongDesc, rememberTitle, rematchStoredPackages, renameStudioTitleCopies, replaceExactTitle, resultMiss, songTitleFor, studioFillCount, takeLockedPlaylist, takeLockedStudio, titleOwnedByOtherEp, unlockEmptyLocks, watchDescReady, writeCachedPackage, writeCachedPlaylist, writeConfirmed, writeLocks, writePlaylistYoutubeUrl, writePlaylistMvUrl, writePlaylistSunoUrl, writeRowLock, writeYoutubeUrl, writeMvUrl, writeSunoUrl, confirmedTrackTitle, knownConfirmedTitle } from "@/lib/package";
import { collectEmptySingles, collectFillQueue, collectLevelQueue, scanGenreGap, summarizeFillQueue } from "@/lib/gaps";
import { readFillQueue, writeFillQueue } from "@/lib/fill-queue";
import { clearFillNotify, registerFillSw } from "@/lib/fill-notify";
import { fieldDrafts, forgetFieldDraft } from "@/lib/field-draft";
import { dropFillWake, holdFillWake } from "@/lib/fill-wake";
import { APP_RELEASE, markReleaseSeen, pendingRelease, seenRelease } from "@/lib/upgrades";
import { useLockedViewLang, viewText } from "@/lib/view-lang";
import { applyPublishedBuild, formatBuildLabel, readLiveBuild, THIS_BUILD } from "@/lib/live-build";
import { generateBlock, generatePackage, generatePlaylist, renderThumb } from "@/lib/generate-package";
import { koreanFillError, noticeLead, noticeShown, quietDiskFault } from "@/lib/fill-errors";
import { runHealthCheck } from "@/lib/health-check";
import { ensureActReady, listFilledEps, listGenreActs, loadGenrePref, loadStudioPage, pauseFillWorker, pullEncyclopedia, readResultFile, saveAudioLevel, saveExactLink, saveFillJob, saveOriginalSong, saveResultFields, saveSongLink, pinShownPremiumFile } from "@/lib/pages";
import { copyText } from "@/lib/clipboard";
import { serverPlain } from "@/lib/server-plain";
import { descriptionBodyForMatch, descriptionWithTracklist, stripProductionCommands } from "@/lib/lyrics-clean";


var SPLASH_FILE = {
	"kpop-original": "kpop-original-g2",
	"jpop-original": "jpop-original-g2",
	"pop-original": "pop-original-g2",
	"thai-original": "thai-original-g2",
	"joseon-ballad": "joseon-g2",
	panpop: "panpop-g2",
	"echoes-of-joseon": "rain-g2",
	"latin-afrobeats-edm": "latin-g2",
	"edm-kpop-club": "hall-g2",
	"dreamy-deep-house": "dream-g2",
	"fantasy-ambient-edm": "fantasy-g2",
	"groovy-airy-pop": "bridge-g2",
	"narrative-piano-indie": "room-g2",
	"your-story": "your-story-g2",
	"cover-reborn": "cover-reborn-g2"
};
var SPLASH_REV = "style3";
var MAIN_VIDEOS = GENRES.flatMap((genre) => {
	const file = SPLASH_FILE[genre.id] || genre.id;
	return ["-a", "-b", "-c"].map((suffix, index) => ({
		id: `${genre.id}:${index + 1}`,
		label: genre.label,
		src: `/splash/${file}${suffix}.mp4?v=${SPLASH_REV}`,
		poster: `/splash/${file}${suffix}.jpg?v=${SPLASH_REV}`
	}));
});
var HEALTH_HOLD = "noa-health-hold";
var HEALTH_REPORT = "noa-health-report";
function healthHeld() {
	try {
		return sessionStorage.getItem(HEALTH_HOLD) === "1";
	} catch {
		return false;
	}
}
function holdHealth(open) {
	try {
		if (open) sessionStorage.setItem(HEALTH_HOLD, "1");
		else {
			sessionStorage.removeItem(HEALTH_HOLD);
			sessionStorage.removeItem(HEALTH_REPORT);
		}
	} catch {}
}
function readHealthReport() {
	try {
		const raw = sessionStorage.getItem(HEALTH_REPORT);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed?.counts || !Array.isArray(parsed.issues) || typeof parsed.paste !== "string") return null;
		return parsed;
	} catch {
		return null;
	}
}
function writeHealthReport(report) {
	try {
		sessionStorage.setItem(HEALTH_REPORT, JSON.stringify(report));
	} catch {}
}
var splashClip = null;
var splashStarted = false;
var healthShown = false;
function recentMark(key, ms) {
	try {
		const at = Number(sessionStorage.getItem(key) || 0);
		if (at && Date.now() - at < ms) return true;
		sessionStorage.setItem(key, String(Date.now()));
	} catch {}
	return false;
}
var SPLASH_KEY = "noa-splash-src-g2";
function lockedClip() {
	if (splashClip) return splashClip;
	try {
		const saved = sessionStorage.getItem(SPLASH_KEY);
		const found = MAIN_VIDEOS.find((item) => item.src === saved);
		if (found) {
			splashClip = found;
			return found;
		}
	} catch {}
	const pick = MAIN_VIDEOS[Math.floor(Math.random() * MAIN_VIDEOS.length)];
	splashClip = pick;
	try {
		sessionStorage.setItem(SPLASH_KEY, pick.src);
	} catch {}
	return pick;
}
function stopSplashVideo(v) {
	v.loop = false;
	v.pause();
}
function stopSplash() {
	document.querySelectorAll(".splash-fill video").forEach((node) => {
		stopSplashVideo(node);
	});
}
function fitSplash(video) {
	if (!video.videoWidth || !video.videoHeight) return;
	const videoRatio = video.videoWidth / video.videoHeight;
	const frameRatio = window.innerWidth / Math.max(window.innerHeight, 1);
	video.style.objectFit = frameRatio > videoRatio + 0.04 ? "contain" : "cover";
	video.style.objectPosition = "center center";
}
function MainSplash({ clip, active }) {
	const ref = useRef(null);
	const [wide, setWide] = useState(false);
	useLayoutEffect(() => {
		const sync = () => setWide(document.documentElement.dataset.frame === "wide");
		sync();
		window.addEventListener("noa-frame", sync);
		return () => window.removeEventListener("noa-frame", sync);
	}, []);
	useEffect(() => {
		const v = ref.current;
		if (!v) return;
		v.loop = false;
		v.muted = true;
		const once = !(readCommon().splashRule || "").trim() || (readCommon().splashRule || "").includes("반복금지");
		const fit = () => fitSplash(v);
		v.addEventListener("loadedmetadata", fit);
		window.addEventListener("resize", fit);
		if (wide || !active) {
			stopSplashVideo(v);
			return () => {
				v.removeEventListener("loadedmetadata", fit);
				window.removeEventListener("resize", fit);
			};
		}
		if (once && (splashStarted || recentMark("noa-splash-at", 2e4))) {
			fit();
			return () => {
				v.removeEventListener("loadedmetadata", fit);
				window.removeEventListener("resize", fit);
			};
		}
		if (!once) v.loop = true;
		splashStarted = true;
		v.play().catch(() => {});
		return () => {
			v.loop = false;
			v.removeEventListener("loadedmetadata", fit);
			window.removeEventListener("resize", fit);
		};
	}, [active, clip.src, wide]);
	if (wide) {
		return /* @__PURE__ */ jsx("div", {
			className: "splash-fill",
			"aria-hidden": true,
			hidden: !active,
			children: /* @__PURE__ */ jsx("img", {
				src: "/og.jpg",
				alt: "",
				className: "splash-still",
				draggable: false
			})
		});
	}
	return /* @__PURE__ */ jsx("div", {
		className: "splash-fill",
		"aria-hidden": true,
		hidden: !active,
		children: /* @__PURE__ */ jsx("video", {
			ref,
			src: clip.src,
			poster: clip.poster,
			muted: true,
			playsInline: true,
			preload: "metadata",
			loop: false,
			onEnded: (event) => {
				event.currentTarget.loop = false;
				event.currentTarget.pause();
			}
		})
	});
}
var PLACE_KEY = "noa-place-v2";
function readHeldPlace() {
	try {
		sessionStorage.removeItem("noa-place");
		const raw = sessionStorage.getItem(PLACE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed.picked !== true || !parsed.genreId || !GENRES.some((genre) => genre.id === parsed.genreId)) return null;
		return {
			genreId: parsed.genreId,
			mode: parsed.mode === "single" ? "single" : "playlist",
			ep: padEp(parsed.ep || ""),
			act: Number(parsed.act) >= 1 ? Number(parsed.act) : 1,
			kpopMode: parsed.kpopMode === "compose" ? "compose" : "browse",
			picked: true
		};
	} catch {
		return null;
	}
}
function writeHeldPlace(place) {
	try {
		sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
	} catch {}
}
function clearHeldPlace() {
	try {
		sessionStorage.removeItem(PLACE_KEY);
		sessionStorage.removeItem("noa-place");
	} catch {}
}
const genreHeadWait = new Map();
function warmGenreHead(genreId) {
	let pending = genreHeadWait.get(genreId);
	if (!pending) {
		pending = Promise.all([
			listFilledEps({ data: { genreId } }).catch(() => null),
			listGenreActs({ data: { genreId } }).catch(() => [])
		]);
		genreHeadWait.set(genreId, pending);
	}
	return pending;
}
function readLockShown() {
	if (typeof window === "undefined") return {};
	try {
		const raw = sessionStorage.getItem("noa-lock-shown");
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}
function rememberOpen(ep, y) {
	if (typeof window === "undefined") return;
	try {
		if (ep) sessionStorage.setItem("noa-open-ep", ep);
		else sessionStorage.removeItem("noa-open-ep");
		if (typeof y === "number") sessionStorage.setItem("noa-scroll", String(Math.max(0, Math.round(y))));
	} catch {}
}
var lockCache = new Map(Object.entries(readLockShown()).map(([key, on]) => [key, on === true]));
function lockKey(genreId, ep) {
	return `${genreId}:${padEp(ep)}`;
}
function shownLocked(genreId, ep) {
	const cached = lockCache.get(lockKey(genreId, ep));
	if (cached === false) return false;
	if (cached === true) return true;
	return readRowLocked(genreId, ep);
}
function VersionSheet({ onClose, buildLabel }) {
	const lang = useLockedViewLang();
	const say = (text) => viewText(text, lang);
	const grokLine = "🤖 이 앱은 Grok이 만들었고 Grok과 연결되어 있습니다. 위에 보이는 버전은 Grok 빌드 버전입니다.";
	const soundLine = "🔊 음악 프리미엄은 고품질 프리미엄 사운드입니다. 음원은 마스터링 Intensity 50으로 다듬은 뒤 LUFS -14와 Peak -1에 고정해 재생합니다. 상단 버전 오른쪽 아이콘이 그 표시입니다.";
	const guide = String(readCommon().buildGuide || "").trim();
	let shown = guide.includes("Grok과 연결") ? guide : `${guide}\n\n${grokLine}`.trim();
	if (!shown.includes("고품질 프리미엄 사운드")) shown = `${shown}\n\n${soundLine}`.trim();
	const blocks = (shown || grokLine).split(/\n+/).map((line) => line.trim()).filter(Boolean);
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center",
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("section", {
			className: "max-h-[calc(var(--app-h,100dvh)*0.82)] w-full max-w-md overflow-y-auto rounded-t-[20px] bg-surface px-5 py-4 sm:rounded-2xl",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsxs("p", {
					className: "text-[13px] font-semibold text-fg-subtle",
					children: ["NOA STUDIO · ", buildLabel]
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-1 text-[22px] font-semibold tracking-tight text-fg",
					children: say("이 앱")
				}),
				...blocks.map((line, index) => /* @__PURE__ */ jsx("p", {
					className: "mt-3 text-[14px] leading-relaxed text-fg",
					children: say(line)
				}, `build-${index}`)),
				/* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "secondary",
					size: "lg",
					className: "mt-4 w-full",
					onClick: onClose,
					children: say("닫기")
				})
			]
		})
	});
}
function failNote(message, detail) {
	const raw = String(detail ?? "").replace(/\s+/g, " ").trim();
	if (!raw) return message;
	const extra = koreanFillError(raw);
	return extra && extra !== message ? `${message} (${extra})` : message;
}
function sunoAddress(raw) {
	const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
	const hit = text.match(/https?:\/\/[^\s<>"']+/i);
	if (!hit) return "";
	return hit[0].replace(/[),.;]+$/g, "").slice(0, 500);
}
const PANE_KEYS = ["summary", "confirmedTitle", "lyricsBlock", "sunoStyle", "geminiPrompt", "youtubeTitle", "youtubeDescription", "fanLetter", "communityPost", "tracklist", "youtubeUrl", "mvUrl", "sunoUrl", "audioAnalysis", "audioLevel"];
const DRAFT_PANE_KEY = { summary: "summary", title: "confirmedTitle", lyrics: "lyricsBlock", tracks: "tracklist", suno: "sunoStyle", thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", community: "communityPost" };
function analysisText(raw) {
	const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
	return /^lufs=-?\d+(?:\.\d+)?;peak=-?\d+(?:\.\d+)?;lift=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}
function levelText(raw) {
	const text = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
	return /^lufs=-?\d+(?:\.\d+)?;gain=-?\d+(?:\.\d+)?;peak=\d+(?:\.\d+)?$/.test(text) ? text.slice(0, 80) : "";
}
function paneGap(shown, disk, blanks) {
	const out = {};
	const file = disk || {};
	for (const key of PANE_KEYS) {
		let next = String(shown?.[key] ?? "").trim();
		let prev = String(file[key] ?? "").trim();
		if (key === "youtubeDescription") {
			const body = (value) => descriptionBodyForMatch(value).replace(/\s+/g, " ").trim();
			if (body(next) === body(prev)) continue;
		}
		if (!next) {
			if (blanks && blanks.has(key) && prev !== next) out[key] = "";
			continue;
		}
		if (next === prev) continue;
		out[key] = next;
	}
	return out;
}
function urlPins(shown) {
	const out = {};
	for (const key of ["youtubeUrl", "mvUrl", "sunoUrl"]) {
		const url = sunoAddress(shown?.[key]);
		if (url) out[key] = url;
	}
	return out;
}
function linkSaved(saved) {
	const body = serverPlain(saved) || plainServer(saved);
	const rev = body && typeof body.rev === "number" ? body.rev : undefined;
	if (body?.ok === true) return { ok: true, url: String(body.url || ""), error: "", rev };
	const error = body && typeof body.error === "string" ? body.error : "file";
	return { ok: false, url: "", error, rev };
}
function plainServer(saved) {
	return serverPlain(saved);
}
function parkPhoneSuno() {
	if (typeof window === "undefined") return;
}
function readEpTitle(raw) {
	const text = String(raw || "").trim();
	const hit = text.match(/^(?:ep|이피)?\s*[.\-]?\s*(\d{1,3})\b\s*[,|:/\\\-–—]?\s*(.*)$/i);
	if (!hit) return { ep: "", title: text };
	return { ep: hit[1], title: hit[2].trim() };
}

export function StudioApp() {
	useDesignRule();
	const [actN, setActN] = useState(1);
	const [epN, setEpN] = useState("");
	const [genreId, setGenreId] = useState(DEFAULT_GENRE);
	const [genrePicked, setGenrePicked] = useState(false);
	const [storyLift, setStoryLift] = useState(false);
	const [booted, setBooted] = useState(false);
	const [mainVideo, setMainVideo] = useState(null);
	const [splitOn, setSplitOn] = useState(false);
	useEffect(() => {
		const sync = () => setSplitOn(document.documentElement.dataset.split === "1");
		sync();
		window.addEventListener("noa-frame", sync);
		return () => window.removeEventListener("noa-frame", sync);
	}, []);
	useEffect(() => {
		if (genrePicked) stopSplash();
		document.documentElement.dataset.genre = genrePicked ? "1" : "0";
	}, [genrePicked]);
	useEffect(() => {
		setMainVideo(lockedClip());
	}, []);
	useLayoutEffect(() => {
		const place = readHeldPlace();
		let open = "";
		try {
			open = sessionStorage.getItem("noa-open-ep") || "";
		} catch {}
		if (!place && !open) {
			genrePickedRef.current = false;
			clearHeldPlace();
		} else if (place) {
			genrePickedRef.current = true;
			setGenreId(place.genreId);
			setGenrePicked(true);
			setActN(place.act);
			setKind(place.mode);
			setKpopMode(place.kpopMode);
		}
		if (open) setEpN(open);
		else if (place) setEpN(place.ep);
		setBooted(true);
		try {
			history.scrollRestoration = "manual";
		} catch {}
	}, []);
	const [genreOpen, setGenreOpen] = useState(false);
	const [genreLive, setGenreLive] = useState<Record<string, boolean>>({});
	const [versionOpen, setVersionOpen] = useState(false);
	const [buildLabel, setBuildLabel] = useState(() => formatBuildLabel(THIS_BUILD));
	const [liveTick, setLiveTick] = useState(0);
	useEffect(() => {
		const on = () => setLiveTick((n) => n + 1);
		window.addEventListener(PREF_EVENT, on);
		return () => window.removeEventListener(PREF_EVENT, on);
	}, []);
	const [pkg, setPkg] = useState(null);
	const [pkgOwner, setPkgOwner] = useState("");
	const [playlist, setPlaylist] = useState(null);
	const [kind, setKind] = useState("playlist");
	const [locks, setLocks] = useState({});
	const [busy, setBusy] = useState(false);
	const [busyBlock, setBusyBlock] = useState(null);
	const regenJob = useRef(0);
	const regenAbort = useRef(null);
	function regenStill(job) {
		return job === regenJob.current;
	}
	function cancelRegen() {
		regenJob.current += 1;
		const ac = regenAbort.current;
		regenAbort.current = null;
		if (ac) ac.abort();
		setBusyBlock(null);
		say("생성을 취소했습니다.");
	}
	function armRegen(blockId) {
		regenJob.current += 1;
		const job = regenJob.current;
		const ac = new AbortController();
		regenAbort.current = ac;
		setBusyBlock(blockId);
		setError(null);
		return { job, signal: ac.signal };
	}
	const [error, setError] = useState(null);
	const noteRef = useRef("");
	function say(text) {
		const line = String(text || "").trim();
		if (!line) {
			if (!noteRef.current) return;
			noteRef.current = "";
			setError(null);
			return;
		}
		if (noteRef.current === line) return;
		noteRef.current = line;
		setError(line);
	}
	const [gateOpen, setGateUi] = useState(false);
	const [gateAsk, setGateAsk] = useState(false);
	const [lockReveal, setLockReveal] = useState(false);
	const [adminHere, setAdminHere] = useState(false);
	useEffect(() => {
		try {
			if (adminHere) sessionStorage.setItem("noa-field-trace", "1");
			else sessionStorage.removeItem("noa-field-trace");
		} catch {
			/* the trace stays off when the browser blocks storage */
		}
	}, [adminHere]);
	const holdTimer = useRef(0);
	const logoHeld = useRef(false);
	const holdPointer = useRef(null);
	const [ready, setReady] = useState(false);
	const [encyclopediaReady, setEncyclopediaReady] = useState(false);
	const [explorerRev, setExplorerRev] = useState(0);
	const showLock = gateOpen || lockReveal;
	const [extras, setExtras] = useState(() => SEED_ORIGINALS);
	const [kpopHead, setKpopHead] = useState("");
	const [kpopLyrics, setKpopLyrics] = useState("");
	const [kpopVocal, setKpopVocal] = useState("female");
	const [kpopMode, setKpopMode] = useState("browse");
	const [bundleOpen, setBundleOpen] = useState(false);
	const [fileActs, setFileActs] = useState([]);
	const [fileActGenre, setFileActGenre] = useState("");
	const [actChosen, setActChosen] = useState(false);
	const [resultHost, setResultHost] = useState(null);
	const [playlistHost, setPlaylistHost] = useState(null);
	const [origDraft, setOrigDraft] = useState({
		title: "",
		vocal: "",
		lyrics: ""
	});
	const [savedSnap, setSavedSnap] = useState("");
	const pkgRef = useRef(null);
	const playlistRef = useRef(null);
	const playlistActRef = useRef(1);
	const pendingGenMode = useRef("fill");
	const origTimer = useRef(0);
	const hydrateSeq = useRef(0);
	const [castOpen, setCastOpen] = useState(false);
	const [thumbCast, setThumbCast] = useState(defaultThumbCast(DEFAULT_GENRE));
	const [regenTick, setRegenTick] = useState(0);
	const [savedEps, setSavedEps] = useState([]);
	const [confirmTick, setConfirmTick] = useState(0);
	const [sortOn, setSortOn] = useState(false);
	const [sortDraft, setSortDraft] = useState(null);
	const [sortSavedTick, setSortSavedTick] = useState(0);
	const sortOrderRef = useRef([]);
	const [ytTick, setYtTick] = useState(0);
	const [unconfirmEp, setUnconfirmEp] = useState("");
	const [ytDraft, setYtDraft] = useState("");
	const [mvDraft, setMvDraft] = useState("");
	const [sunoDraft, setSunoDraft] = useState("");
	const [levelDraft, setLevelDraft] = useState("");
	const [analysisDraft, setAnalysisDraft] = useState("");
	const levelHold = useRef(false);
	const analysisHold = useRef(false);
	const sunoPin = useRef("");
	const levelPin = useRef({ page: "", text: "", on: false });
	const analysisPin = useRef({ page: "", text: "", on: false });
	const [ytPremium, setYtPremium] = useState(true);
	const [mvPremium, setMvPremium] = useState(true);
	const linkSync = useRef(false);
	const linkHydrated = useRef({ page: "", yt: "", mv: "", suno: "", ytPremium: true, mvPremium: true });
	const ytPremiumHold = useRef(true);
	const mvPremiumHold = useRef(true);
	const premiumLock = useRef({ page: "", song: null, mv: null });
	const ytLive = useRef("");
	const mvLive = useRef("");
	const sunoLive = useRef("");
	const fileFields = useRef({ page: "", fields: {} });
	const paneRev = useRef(0);
	const heardLevel = useRef({ page: "", text: "" });
	const heardAnalysis = useRef({ page: "", text: "" });
	const heardBySong = useRef({});
	const fileLoadGen = useRef(0);
	const [fileRev, setFileRev] = useState(0);
	const [lockTick, setLockTick] = useState(0);
	const [fillAsk, setFillAsk] = useState(false);
	const [fillSkip, setFillSkip] = useState(false);
	const [fillAudit, setFillAudit] = useState({
		empty: 0,
		rough: 0,
		partial: 0,
		item: 0,
		preview: []
	});
	const [fillReport, setFillReport] = useState(null);
	const [upgradeAsk, setUpgradeAsk] = useState(false);
	const [upgradeDone, setUpgradeDone] = useState(false);
	const [upgradeNotes, setUpgradeNotes] = useState([]);
	const [filling, setFilling] = useState(false);
	useEffect(() => {
		if (!booted || genrePicked || filling) return;
		let stop = false;
		const pull = () => {
			void readLiveBuild()
				.then((remote) => {
					if (stop) return;
					const id = String(remote?.id || "").trim();
					if (!id) return;
					setBuildLabel(formatBuildLabel(id));
					if (id === THIS_BUILD) return;
					try {
						if (sessionStorage.getItem("noa-build-dismiss") === id) return;
					} catch {}
					setBuildOffer(id);
				})
				.catch(() => {});
		};
		pull();
		const onShow = () => {
			if (document.visibilityState === "visible") pull();
		};
		document.addEventListener("visibilitychange", onShow);
		return () => {
			stop = true;
			document.removeEventListener("visibilitychange", onShow);
		};
	}, [booted, genrePicked, filling]);
	const [fillPaused, setFillPaused] = useState(false);
	const [limitUntil, setLimitUntil] = useState(0);
	const [limitWait, setLimitWait] = useState(0);
	const [fillDone, setFillDone] = useState(0);
	const [fillTotal, setFillTotal] = useState(0);
	const [fillCurrent, setFillCurrent] = useState("");
	const [fillErrors, setFillErrors] = useState([]);
	const [fillEvents, setFillEvents] = useState([]);
	const [fillTrack, setFillTrack] = useState(null);
	const [fillWorkN, setFillWorkN] = useState("");
	const [fillFocus, setFillFocus] = useState(null);
	const [fillMarks, setFillMarks] = useState([]);
	const [fillPeek, setFillPeek] = useState(false);
	const [unconfirmOpen, setUnconfirmOpen] = useState(false);
	const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
	const [fillStall, setFillStall] = useState(false);
	const [healthOpen, setHealthOpen] = useState(false);
	const [reviewOpen, setReviewOpen] = useState(false);
	const [reviewItems, setReviewItems] = useState([]);
	const [reviewNote, setReviewNote] = useState("");
	const [fillScopeLabel, setFillScopeLabel] = useState("");
	const [reportDetail, setReportDetail] = useState("");
	const fillStop = useRef(false);
	const saveMark = useRef({ key: "", sig: "" });
	const saveSigRef = useRef("");
	const saveAck = useRef(false);
	const castTouch = useRef("");
	const fillResumeRef = useRef(false);
	const fillPausedRef = useRef(false);
	const fillingRef = useRef(false);
	const [buildOffer, setBuildOffer] = useState("");
	const fillClientRef = useRef(false);
	const fillGenRef = useRef(0);
	const fillCurrentRef = useRef("");
	const fillEventsRef = useRef([]);
	const fillGenreRef = useRef(DEFAULT_GENRE);
	const fillScopeRef = useRef("genre");
	const fillModeRef = useRef("empty");
	const fillRowsRef = useRef([]);
	const reviewIdsRef = useRef(new Set());
	const fillNoteRef = useRef("");
	const fillRequestOnlyRef = useRef(false);
	const fillPeekRef = useRef(false);
	const followHoldRef = useRef(false);
	const pinResultUntil = useRef(0);
	const manualEp = useRef("");
	const unlockAt = useRef(0);
	const stickEp = useRef("");
	const ignorePickUntil = useRef(0);
	const pkgEp = useRef("");
	const followIdleRef = useRef(0);
	const fillWorkRef = useRef(null);
	const fillFocusRef = useRef(null);
	const fillMarksRef = useRef([]);
	const fillSkipFields = useRef(/* @__PURE__ */ new Map());
	const fillTries = useRef(/* @__PURE__ */ new Map());
	const resumeFollowRef = useRef(() => {});
	const epNRef = useRef(epN);
	epNRef.current = epN;
	const genreIdRef = useRef(genreId);
	const pageKeyRef = useRef("");
	const genrePickedRef = useRef(genrePicked);
	genreIdRef.current = genreId;
	genrePickedRef.current = genrePicked;
	fillCurrentRef.current = fillCurrent;
	fillEventsRef.current = fillEvents;
	pkgRef.current = pkg;
	const pkgOwnerRef = useRef(pkgOwner);
	pkgOwnerRef.current = pkgOwner;
	playlistRef.current = playlist;
	const locksLive = useRef(locks);
	locksLive.current = locks;
	const genre = getGenre(genreId);
	const act = getAct(actN);
	const isSingle = Boolean(epN);
	useLayoutEffect(() => {
		const slot = isSingle ? document.getElementById("song-result-slot") : null;
		setResultHost((cur) => cur === slot ? cur : slot);
		const findAct = () => !isSingle && bundleOpen ? document.getElementById("act-playlist-slot") : null;
		const playlist = findAct();
		setPlaylistHost((cur) => cur === playlist ? cur : playlist);
		if (!isSingle && bundleOpen && !playlist) {
			const frame = window.requestAnimationFrame(() => {
				const again = findAct();
				setPlaylistHost((cur) => cur === again ? cur : again);
			});
			return () => window.cancelAnimationFrame(frame);
		}
	}, [isSingle, epN, actN, genreId, kpopMode, bundleOpen, booted, gateOpen]);
	useLayoutEffect(() => {
		applyPendingFoldClose();
	});
	const isDistinct = genre.kind === "distinct";
	const isKpop = genreId === "kpop-original";
	const originalGenres = GENRES.filter((g) => g.kind === "original");
	const collectionGenres = GENRES.filter((g) => g.kind === "collection");
	const distinctGenres = GENRES.filter((g) => g.kind === "distinct");
	const kpopDraft = useMemo(() => {
		const head = readEpTitle(kpopHead);
		return {
			ep: head.ep,
			title: head.title,
			genre: "",
			vocal: THUMB_CASTS.find((item) => item.id === kpopVocal)?.label ?? "여자솔로",
			lyrics: kpopLyrics
		};
	}, [kpopHead, kpopLyrics, kpopVocal]);
	const extraEps = useMemo(() => extrasAsEps(extras), [extras]);
	const library = useMemo(() => {
		const map = new Map(EPS.map((e) => [e.n, e]));
		for (const item of extraEps) map.set(item.n, item);
		return [...map.values()].sort((a, b) => Number(a.n) - Number(b.n));
	}, [extraEps]);
	const kpopActs = useMemo(() => actsForEntries(library), [library]);
	const kpopTracks = useMemo(() => tracksForAct(actN, extraEps), [actN, extraEps]);
	const storedOrig = epN ? extras.find((item) => item.n === epN) ?? {
		n: epN,
		title: library.find((item) => item.n === epN)?.title ?? "",
		vocal: "",
		lyrics: ""
	} : void 0;
	const origDirty = Boolean(isKpop && kpopMode === "browse" && epN && storedOrig && (storedOrig.title !== origDraft.title || storedOrig.vocal !== origDraft.vocal || storedOrig.lyrics !== origDraft.lyrics));
	const composeEp = padEp(kpopDraft.ep);
	const composeStored = composeEp ? extras.find((item) => padEp(item.n) === composeEp) : undefined;
	const composeBaseVocal = THUMB_CASTS.find((item) => item.id === "female")?.label ?? "여자솔로";
	const composeChanged = composeStored ? composeStored.title !== kpopDraft.title || composeStored.vocal !== kpopDraft.vocal || composeStored.lyrics !== kpopDraft.lyrics : Boolean(kpopDraft.title.trim() || kpopDraft.lyrics.trim() || (kpopDraft.vocal && kpopDraft.vocal !== composeBaseVocal));
	const composeDirty = Boolean(isKpop && kpopMode === "compose" && composeChanged);
	const visibleActs = useMemo(() => actsForEntries(library), [library]);
	const genreTones = useMemo(() => {
		const songs = library.map((item) => padEp(item.n)).filter(Boolean);
		const acts = visibleActs.map((item) => String(item.n));
		const dump = readAppDump();
		const originals = dump.originals?.["kpop-original"] ?? {};
		const compact = (value) => String(value || "").replace(/\s+/g, "");
		const filledSong = (pkg, n) => {
			if (!pkg) return false;
			const orig = originals[n] || originals[String(Number(n))] || {};
			const title = String(pkg.confirmedTitle || "").trim();
			const lyrics = String(pkg.lyricsBlock || "").trim();
			const titleOwn = Boolean(title) && compact(title) !== compact(orig.title);
			const lyricsOwn = Boolean(lyrics) && compact(lyrics) !== compact(orig.lyrics);
			return titleOwn || lyricsOwn || [pkg.summary, pkg.sunoStyle, pkg.geminiPrompt, pkg.youtubeTitle, pkg.youtubeDescription, pkg.fanLetter, pkg.youtubeUrl].some((value) => String(value || "").trim());
		};
		const tones = {};
		for (const item of GENRES) {
			if (item.id === "your-story" || item.id === "cover-reborn") {
				const stories = listStorySongs(item.id);
				let confirmed = 0;
				for (const row of stories) {
					if (isConfirmed("story", item.id, row.id) || (row.title !== row.id && isConfirmed("story", item.id, row.title))) confirmed += 1;
				}
				tones[item.id] = stories.length > 0 && confirmed === stories.length ? "done" : confirmed > 0 ? "gold" : stories.length > 0 ? "line" : "empty";
				continue;
			}
			if (!songs.length) {
				tones[item.id] = "empty";
				continue;
			}
			const confirmed = new Set(listConfirmedEps(item.id));
			let confirmedCount = 0;
			let filled = false;
			for (const n of songs) {
				if (confirmed.has(n)) confirmedCount += 1;
				const pkg = dump.packages?.[`${item.id}:${n}`]?.pkg;
				if (!filled && filledSong(pkg, n)) filled = true;
			}
			const songsDone = confirmedCount === songs.length;
			const actsDone = acts.length > 0 && acts.every((n) => isConfirmed("playlist", item.id, n));
			tones[item.id] = songsDone && actsDone ? "done" : confirmedCount > 0 ? "gold" : filled ? "line" : "empty";
		}
		return tones;
	}, [confirmTick, encyclopediaReady, library, visibleActs, savedSnap]);
	const genreLiveJobs = useMemo(() => {
		const songs = library.map((item) => padEp(item.n)).filter(Boolean);
		const acts = visibleActs.map((item) => String(item.n));
		const jobs: { id: string; urls: string[] }[] = [];
		for (const item of GENRES) {
			if (genreTones[item.id] !== "done") continue;
			const urls: string[] = [];
			if (item.id === "your-story" || item.id === "cover-reborn") {
				for (const row of listStorySongs(item.id)) {
					urls.push(String(row.pkg.youtubeUrl || "").trim());
					const mv = String(row.pkg.mvUrl || "").trim();
					if (mv) urls.push(mv);
				}
			} else {
				for (const n of songs) {
					urls.push(readYoutubeUrl(item.id, n));
					const mv = readMvUrl(item.id, n);
					if (mv) urls.push(mv);
				}
				for (const n of acts) {
					urls.push(readPlaylistYoutubeUrl(item.id, Number(n)));
					const mv = readPlaylistMvUrl(item.id, Number(n));
					if (mv) urls.push(mv);
				}
			}
			jobs.push({ id: item.id, urls });
		}
		return jobs;
	}, [genreTones, library, visibleActs]);
	useEffect(() => {
		let stop = false;
		let timer = 0;
		if (!genreLiveJobs.length) {
			setGenreLive({});
			return;
		}
		const run = async () => {
			const next: Record<string, boolean> = {};
			const ready: { id: string; urls: string[] }[] = [];
			let again = false;
			for (const job of genreLiveJobs) {
				const need = [...new Set(job.urls.map((url) => url.trim()))];
				if (!need.length || need.some((url) => !url)) {
					next[job.id] = false;
					again = true;
					continue;
				}
				if (need.every((url) => knownYoutubeOpen(url) === true)) next[job.id] = true;
				else ready.push({ id: job.id, urls: need });
			}
			if (!ready.length) {
				if (!stop) setGenreLive(next);
				if (again && !stop) timer = window.setTimeout(() => void run(), 47000);
				return;
			}
			if (!stop) setGenreLive(next);
			await askYoutubeOpenMany(ready.flatMap((job) => job.urls));
			if (stop) return;
			for (const job of ready) {
				next[job.id] = job.urls.every((url) => knownYoutubeOpen(url) === true);
				if (!next[job.id]) again = true;
			}
			setGenreLive({ ...next });
			if (again) timer = window.setTimeout(() => void run(), 47000);
		};
		void run();
		return () => {
			stop = true;
			window.clearTimeout(timer);
		};
	}, [genreLiveJobs]);
	const rawTracks = useMemo(() => tracksForAct(actN, extraEps), [actN, extraEps]);
	const titleStamp = Object.values(readAppDump().packages).filter((row) => row.genreId === genreId).map((row) => `${row.ep}:${row.pkg?.confirmedTitle || row.title}`).join("|");
	const rememberedStamp = Object.entries(readAppDump().titles?.[genreId] ?? {}).map(([n, t]) => `${n}:${t}`).join("|");
	const actTracks = useMemo(() => overlayTitles(rawTracks, genreId), [
		rawTracks,
		genreId,
		savedSnap,
		titleStamp,
		rememberedStamp
	]);
	const sortKey = `act:${genreId}:${actN}`;
	const sortBase = useMemo(() => {
		const base = isKpop ? kpopTracks.map((item) => ({ n: item.n, title: item.title })) : actTracks;
		return applyFixedOrder(base, readListOrder(sortKey), (item) => padEp(item.n), "ep-desc");
	}, [isKpop, kpopTracks, actTracks, sortKey, sortSavedTick]);
	const sortView = useMemo(() => {
		if (!sortOn || !sortDraft || sortDraft.key !== sortKey) return sortBase;
		return applyFixedOrder(sortBase, sortDraft.ids, (item) => padEp(item.n), "ep-desc");
	}, [sortOn, sortDraft, sortKey, sortBase]);
	const sortDirty = Boolean(sortOn && sortDraft && sortDraft.key === sortKey && sortDraft.ids.join("|") !== sortBase.map((item) => padEp(item.n)).join("|"));
	sortOrderRef.current = sortView.map((item) => padEp(item.n));
	useEffect(() => {
		setSortDraft(null);
	}, [sortKey]);
	useEffect(() => {
		if (gateOpen) return;
		setSortOn(false);
		setSortDraft(null);
	}, [gateOpen]);
	function toggleListSort() {
		setSortOn((on) => {
			const next = !on;
			if (next) setSortDraft({ key: sortKey, ids: sortBase.map((item) => padEp(item.n)) });
			return next;
		});
	}
	function moveListSort(from, to) {
		const ids = moveId(sortOrderRef.current, from, to);
		sortOrderRef.current = ids;
		setSortDraft({ key: sortKey, ids });
	}
	function saveListSort() {
		const ids = sortView.map((item) => padEp(item.n));
		writeListOrder(sortKey, ids);
		setSortDraft({ key: sortKey, ids });
		setSortSavedTick((n) => n + 1);
	}
	const ep = epN ? library.find((e) => e.n === epN) ?? {
		n: epN,
		title: kpopDraft.title || getEp(epN).title
	} : null;
	const lockId = isSingle ? epN : String(actN);
	const pref = useGenrePref(genreId);
	const genreGap = useMemo(() => scanGenreGap(genreId, library), [
		genreId,
		library,
		savedSnap,
		savedEps,
		pkg,
		playlist
	]);
	const wantGap = Boolean(genrePicked && (filling || fillReport || upgradeDone || upgradeAsk || reviewOpen || fillAsk));
	const allEmpty = useMemo(() => wantGap ? collectEmptySingles() : [], [
		wantGap,
		savedSnap,
		savedEps,
		extras,
		pkg,
		playlist
	]);
	const noticeGap = useMemo(() => ({
		...genreGap,
		label: "모든 장르",
		emptyEps: (allEmpty ?? []).map((item) => ({
			n: item.n,
			title: `${item.label} ${item.title}`
		}))
	}), [genreGap, allEmpty]);
	const noticeMode = !genrePicked || !gateOpen ? "hidden" : filling ? "filling" : fillReport ? "fill-done" : upgradeDone ? "upgrade-done" : upgradeAsk ? "upgrade-ask" : reviewOpen ? "review" : fillAsk ? "fill-ask" : "hidden";
	useEffect(() => {
		const onStoryBar = (event) => setStoryLift(Boolean(event.detail));
		window.addEventListener("noa-story-bar", onStoryBar);
		return () => window.removeEventListener("noa-story-bar", onStoryBar);
	}, []);
	useEffect(() => {
		if (isDistinct) return;
		const onNotice = (event) => {
			const text = String(event.detail || "").trim();
			if (text) setError(text);
		};
		window.addEventListener("noa-user-notice", onNotice);
		return () => window.removeEventListener("noa-user-notice", onNotice);
	}, [isDistinct]);
	useEffect(() => {
		const ids = ["result-status", "fill-notice"];
		const root = document.documentElement;
		const dodgeFloats = () => {
			for (const btn of document.querySelectorAll("[data-float]")) {
				btn.dataset.dodge = "0";
				btn.style.transform = "";
			}
		};
		const apply = () => {
			let height = 0;
			for (const id of ids) {
				const node = document.getElementById(id);
				if (!node) continue;
				const rect = node.getBoundingClientRect();
				if (rect.height < 8 || rect.width < 8) continue;
				height += rect.height;
			}
			root.style.setProperty("--work-top", "0px");
			delete root.dataset.work;
			root.style.setProperty("--notice-lift", `${Math.ceil(height)}px`);
			if (root.dataset.frame === "wide" && root.dataset.genre === "1") {
				const split = root.dataset.split === "1";
				const rail = document.querySelector(split ? ".studio-main" : ".studio-head");
				const edge = rail instanceof HTMLElement ? rail.getBoundingClientRect() : null;
				const x = edge && edge.width > 40 && edge.left < 80 ? Math.round(edge.right) : Math.round(12.25 * 16);
				root.style.setProperty("--rail-x", `${x}px`);
			} else root.style.removeProperty("--rail-x");
			dodgeFloats();
		};
		const resize = new ResizeObserver(apply);
		const attach = () => {
			resize.disconnect();
			for (const id of ids) {
				const node = document.getElementById(id);
				if (node) resize.observe(node);
			}
			apply();
		};
		attach();
		const watch = new MutationObserver(attach);
		watch.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("resize", apply);
		window.addEventListener("scroll", dodgeFloats, true);
		window.addEventListener("noa-float", apply);
		return () => {
			watch.disconnect();
			resize.disconnect();
			window.removeEventListener("resize", apply);
			window.removeEventListener("scroll", dodgeFloats, true);
			window.removeEventListener("noa-float", apply);
			root.style.removeProperty("--notice-lift");
			root.style.removeProperty("--work-top");
			root.style.removeProperty("--rail-x");
			delete root.dataset.work;
		};
	}, []);
	useEffect(() => {
		ensureSecurityKey();
		setAdminHere(isAdminDevice());
		if (readAdminDevice()) setGateUi(isGateOpen());
		const onGate = () => {
			const open = isGateOpen();
			setAdminHere(isAdminDevice());
			if (!open) {
				const id = padEp(epNRef.current || "");
				if (id) {
					closeFold(resultFoldKey(genreIdRef.current, id), document.getElementById(`result-fold-${id}`));
					manualEp.current = "";
					stickEp.current = "";
					rememberOpen("");
					setEpN("");
				} else clearResultFold();
				setBundleOpen(false);
				setKpopMode("browse");
			}
			setGateUi(open);
		};
		window.addEventListener(GATE_EVENT, onGate);
		return () => window.removeEventListener(GATE_EVENT, onGate);
	}, []);
	useEffect(() => {
		if (!booted) return;
		if (masterLocked()) {
			if (epN) {
				closeFold(resultFoldKey(genreId, epN), document.getElementById(`result-fold-${padEp(epN)}`));
				manualEp.current = "";
				stickEp.current = "";
				rememberOpen("");
				setEpN("");
			} else clearResultFold();
			setBundleOpen(false);
			setKpopMode("browse");
			return;
		}
		if (!epN || !genrePicked) {
			clearResultFold();
			return;
		}
		const id = padEp(epN);
		const key = resultFoldKey(genreId, id);
		if (!foldIsOpen(key)) openFold(key, document.getElementById(`result-fold-${id}`));
	}, [epN, genreId, gateOpen, booted, genrePicked]);
	useEffect(() => {
		loadGenrePref({ data: { genreId } }).then((remote) => {
			if (!remote || hasStoredPref(genreId)) return;
			writePref(genreId, normalizePref(genreId, remote));
		}).catch(() => {});
	}, [genreId]);
	const songNow = padEp(epN);
	function sourceFor(gid, n) {
		const id = padEp(n);
		if (gid === "kpop-original" && id && id === padEp(epN)) {
			const draft = kpopMode === "compose" ? kpopDraft : origDraft;
			if (draft.title.trim() || draft.lyrics.trim()) return {
				title: draft.title.trim(),
				vocal: draft.vocal,
				lyrics: draft.lyrics
			};
		}
		const orig = readOriginals().find((item) => item.n === id);
		const catalog = id && isEpNumber(id) ? getEp(id).title.trim() : "";
		return {
			title: orig?.title?.trim() || catalog,
			vocal: orig?.vocal || "",
			lyrics: orig?.lyrics || ""
		};
	}
	const shownSource = sourceFor(genreId, epN);
	const cachedSong = songNow ? readCachedPackage(songNow, genreId) : null;
	const liveSong = songNow && pkgOwner === songNow && pkg ? pkg : null;
	function titleFits(body, id, gid = genreId) {
		if (!body) return false;
		const stamped = String(body.youtubeTitle || "").trim().match(/^EP\.(\d{2})\b/);
		if (stamped && padEp(stamped[1]) !== padEp(id)) return false;
		const title = String(body.confirmedTitle || "").trim();
		if (!title) return true;
		const sourceTitle = sourceFor(gid, id).title.trim();
		if (sourceTitle && title === sourceTitle) return true;
		return !titleOwnedByOtherEp(title, id);
	}
	function ownBody(body, id, gid = genreId) {
		return body && titleFits(body, id, gid) ? body : null;
	}
	function claimEp(body, id, gid = genreId) {
		let next = body;
		const yt = String(next?.youtubeTitle || "");
		const stamped = yt.trim().match(/^EP\.(\d{2})\b/);
		if (stamped && padEp(stamped[1]) !== padEp(id)) next = { ...next, youtubeTitle: yt.replace(/^EP\.\d{2}/, `EP.${padEp(id)}`) };
		const title = String(next?.confirmedTitle || "").trim();
		const sourceTitle = sourceFor(gid, id).title.trim();
		if (title && titleOwnedByOtherEp(title, id) && sourceTitle && !(next.userEdited || []).includes("title")) next = { ...next, confirmedTitle: sourceTitle };
		return next;
	}
	function songDirty(body, id) {
		if (!body) return false;
		if (resultMiss(genreId, id, body)) return true;
		const title = String(body.confirmedTitle || sourceFor(genreId, id).title || "").trim();
		if (foreignSongTitleIn(body.lyricsBlock || "", id, title)) return true;
		if (foreignSongTitleIn(body.youtubeDescription || "", id, title)) return true;
		if (/USER SETTINGS LOCK/i.test(body.geminiPrompt || "")) return true;
		if (title && body.youtubeTitle && !String(body.youtubeTitle).includes(title)) return true;
		const suno = String(body.sunoStyle || "").trim();
		const base = String(pref.sunoBase || "").trim();
		if (suno.length > 1000) return true;
		if (base && suno.length >= 1000 && suno.replace(/\s+/g, " ") !== base.replace(/\s+/g, " ")) return true;
		return false;
	}
	const rawSong = songNow
		? isConfirmed("single", genreId, songNow)
			? liveSong ?? cachedSong
			: cachedSong && songDirty(liveSong, songNow) && !songDirty(cachedSong, songNow)
				? cachedSong
				: liveSong ?? cachedSong
		: null;
	function fitShown(body, id) {
		if (!body) return body;
		if (isConfirmed("single", genreId, id)) return body;
		let next = body;
		const cached = readCachedPackage(id, genreId);
		const keep = canKeepPackage(genreId, id, cached, next);
		if (!packageFitsSong(genreId, id, next) && !keep) {
			const touched = isAdminDevice() && ((next.userEdited || []).length > 0 || (cached && String(cached.lyricsBlock || "") === String(next.lyricsBlock || "") && String(cached.confirmedTitle || "") === String(next.confirmedTitle || "")));
			if (!touched) {
			const altOk = cached && cached !== body && (packageFitsSong(genreId, id, cached) || canKeepPackage(genreId, id, null, cached));
			next = altOk ? cached : emptyStudio();
			}
		}
		return applyPrefToStudio(next, pref, {
			epN: id,
			lockedTitle: "",
			genreLabel: pref.thumbGenreLine.trim() || genre.youtubeLabel,
			genreId
		}, {});
	}
	const songPkg = rawSong && songNow ? fitShown(rawSong, songNow) : null;
	const cachedPlaylist = !isSingle ? readCachedPlaylist(actN, genreId) : null;
	const loadedPlaylist = !isSingle && playlistActRef.current === actN ? playlist : null;
	const shownPlaylist = !isSingle
		? loadedPlaylist && hasPlaylistBody(loadedPlaylist)
			? loadedPlaylist
			: cachedPlaylist && hasPlaylistBody(cachedPlaylist)
				? cachedPlaylist
				: loadedPlaylist ?? cachedPlaylist
		: null;
	playlistRef.current = isSingle ? playlist : shownPlaylist;
	const pageOpts = {
		suno: genreWantsSuno(genre.id),
		letter: pref.community,
		source: genre.kind !== "original",
		output: pref.output
	};
	const playlistOpts = { community: pref.actOutput.letter, output: pref.actOutput };
	const livePlaylist = isSingle ? null : screenPlaylist(shownPlaylist);
	const pageComplete = isSingle ? isStudioComplete(songPkg, pageOpts) : isPlaylistComplete(livePlaylist, playlistOpts);
	const urlReady = Boolean(ytDraft.trim());
	const hasResult = isSingle ? hasPageBody(songPkg) : hasPlaylistBody(livePlaylist);
	const canConfirm = pageComplete || urlReady || hasResult;
	const playlistGap = isSingle || pageComplete ? "" : missingPlaylistLabels(livePlaylist, playlistOpts).join(", ");
	const openOriginal = extras.find((item) => padEp(item.n) === padEp(epN));
	const pageKey = `${genreId}:${isSingle ? padEp(epN) || "ep" : `act${actN}`}`;
	pageKeyRef.current = pageKey;
	const premiumScope = isSingle ? "ep" : "act";
	const premiumId = isSingle ? padEp(epN) || "" : String(actN);
	const songPremiumOn = linkPremiumOn(isSingle ? songPkg?.ytPremium : shownPlaylist?.ytPremium, genreId, premiumId, "song", premiumScope);
	const mvPremiumOn = linkPremiumOn(isSingle ? songPkg?.mvPremium : shownPlaylist?.mvPremium, genreId, premiumId, "mv", premiumScope);
	ytPremiumHold.current = ytPremium;
	mvPremiumHold.current = mvPremium;
	const pageSig = isSingle ? [rawSong?.confirmedTitle, rawSong?.lyricsBlock, rawSong?.sunoStyle, rawSong?.geminiPrompt, rawSong?.youtubeTitle, rawSong?.youtubeDescription, rawSong?.fanLetter, rawSong?.summary, ytDraft, mvDraft, sunoDraft, ytPremium ? "1" : "0", mvPremium ? "1" : "0"].join("\u0001") : [shownPlaylist?.confirmedTitle, shownPlaylist?.tracklist, shownPlaylist?.sunoStyle, shownPlaylist?.geminiPrompt, shownPlaylist?.youtubeTitle, shownPlaylist?.youtubeDescription, shownPlaylist?.communityPost, ytDraft, mvDraft, sunoDraft, ytPremium ? "1" : "0", mvPremium ? "1" : "0"].join("\u0001");
	saveSigRef.current = pageSig;
	if (saveMark.current.key !== pageKey || linkSync.current) {
		saveMark.current = { key: pageKey, sig: pageSig };
		linkSync.current = false;
		saveAck.current = false;
	} else if (saveAck.current) {
		saveAck.current = false;
		saveMark.current = { key: pageKey, sig: pageSig };
	}
	const linkPage = `${genreId}:${epN || String(actN)}:${epN ? "ep" : "act"}`;
	const heldLink = linkHydrated.current;
	const linkDirty = heldLink.page === linkPage && (ytDraft !== heldLink.yt || mvDraft !== heldLink.mv || sunoDraft !== heldLink.suno || Boolean(ytPremium) !== Boolean(heldLink.ytPremium) || Boolean(mvPremium) !== Boolean(heldLink.mvPremium));
	const savedCast = isSingle ? (rawSong?.thumbCast ?? defaultThumbCast(genreId)) : ((shownPlaylist ?? playlist)?.thumbCast ?? defaultThumbCast(genreId));
	const castDirty = castTouch.current === pageKey && thumbCast !== savedCast;
	void fileRev;
	const snapReady = fileFields.current.page === pageKey;
	const savedLevelText = snapReady ? String(fileFields.current.fields.audioLevel || "") : "";
	const savedAnalysisText = snapReady ? String(fileFields.current.fields.audioAnalysis || "") : "";
	const liveLevelText = heardLevel.current.page === pageKey ? levelText(heardLevel.current.text) : "";
	const liveAnalysisText = heardAnalysis.current.page === pageKey ? analysisText(heardAnalysis.current.text) : "";
	const audioLevelText = levelHold.current ? levelDraft : levelPin.current.on && levelPin.current.page === pageKey ? levelPin.current.text : savedLevelText || liveLevelText;
	const audioAnalysisText = analysisHold.current ? analysisDraft : analysisPin.current.on && analysisPin.current.page === pageKey ? analysisPin.current.text : savedAnalysisText || liveAnalysisText;
	const paneSong = rawSong;
	const paneList = shownPlaylist;
	const fileSunoUrl = snapReady ? String(fileFields.current.fields.sunoUrl || "") : "";
	const fileYtUrl = snapReady ? String(fileFields.current.fields.youtubeUrl || "") : "";
	const sunoDirty = sunoDraft !== heldLink.suno;
	const sunoShown = sunoPin.current === pageKey || !snapReady || sunoDirty ? sunoDraft : String(fileSunoUrl || "");
	const ytShown = String(ytLive.current || "") !== String(heldLink.yt || "") ? ytDraft : String(fileYtUrl || "");
	const shownBody = isSingle ? paneSong || songPkg || rawSong || {} : paneList || shownPlaylist || {};
	const shownPane = {
		summary: shownBody.summary,
		confirmedTitle: shownBody.confirmedTitle,
		lyricsBlock: shownBody.lyricsBlock,
		sunoStyle: shownBody.sunoStyle,
		geminiPrompt: shownBody.geminiPrompt,
		youtubeTitle: shownBody.youtubeTitle,
		youtubeDescription: shownBody.youtubeDescription,
		fanLetter: shownBody.fanLetter,
		communityPost: shownBody.communityPost,
		tracklist: shownBody.tracklist,
		youtubeUrl: ytShown,
		mvUrl: mvDraft,
		sunoUrl: sunoShown,
		audioAnalysis: audioAnalysisText,
		audioLevel: audioLevelText,
	};
	const fileGap = snapReady && Object.keys(paneGap(shownPane, fileFields.current.fields)).length > 0;
	const addressOpen = !snapReady && Boolean(sunoAddress(sunoDraft) || sunoAddress(ytDraft) || sunoAddress(mvDraft));
	const levelDirty = (levelHold.current || (levelPin.current.on && levelPin.current.page === pageKey)) && String(audioLevelText || "") !== (snapReady ? String(fileFields.current.fields.audioLevel || "") : "");
	const analysisDirty = (analysisHold.current || (analysisPin.current.on && analysisPin.current.page === pageKey)) && String(audioAnalysisText || "") !== (snapReady ? String(fileFields.current.fields.audioAnalysis || "") : "");
	const saveDirty = pageSig !== saveMark.current.sig || linkDirty || levelDirty || analysisDirty || origDirty || castDirty || fileGap || addressOpen;
	function editedHolds(local, remote) {
		if (!local || !remote) return false;
		const keys = {
			summary: "summary",
			title: "confirmedTitle",
			lyrics: "lyricsBlock",
			suno: "sunoStyle",
			thumb: "geminiPrompt",
			"yt-title": "youtubeTitle",
			"yt-desc": "youtubeDescription",
			letter: "fanLetter"
		};
		for (const id of local.userEdited || []) {
			if (id === "title" || id === "yt-title" || id === "yt-desc") continue;
			const key = keys[id];
			if (!key) continue;
			const mine = String(local[key] || "");
			if (mine.trim() && mine !== String(remote[key] || "")) return true;
		}
		return false;
	}
	function takeSavedPane(local, shown, scope) {
		if (!local || !shown) return local;
		const drafts = fieldDrafts(scope).map((row) => row.id);
		return adoptSavedFileText(local, shown, drafts);
	}
	function keepTyping(base, local, scope) {
		if (!base || !local) return base;
		const map = { summary: "summary", title: "confirmedTitle", lyrics: "lyricsBlock", tracks: "tracklist", suno: "sunoStyle", thumb: "geminiPrompt", "yt-title": "youtubeTitle", "yt-desc": "youtubeDescription", letter: "fanLetter", community: "communityPost" };
		let next = null;
		for (const id of fieldDrafts(scope).map((row) => row.id)) {
			const key = map[id];
			if (!key || String(base[key] ?? "") === String(local[key] ?? "")) continue;
			if (!next) next = { ...base };
			next[key] = local[key];
		}
		return next ?? base;
	}
	useEffect(() => {
		return;
	}, [genreId, epN, songNow, rawSong?.confirmedTitle, rawSong?.lyricsBlock, rawSong?.sunoStyle, rawSong?.youtubeTitle, rawSong?.geminiPrompt, rawSong?.youtubeDescription, pref.titleMode, shownSource.title]);
	const openRank = isSingle ? fillRank(genreId, songPkg, openOriginal, isConfirmed("single", genreId, epN), epN) : 0;
	const savedReady = openRank === 0 && pageComplete;
	const pageSloppy = openRank === 2 || openRank === 4;
	const pagePartial = openRank === 3;
	const confirmedEps = useMemo(() => listConfirmedEps(genreId), [
		genreId,
		confirmTick,
		encyclopediaReady
	]);
	const readyActs = useMemo(() => {
		if (pref.actPlaylist === false) return [];
		const sealedHere = fileActGenre === genreId;
		return visibleActs.filter((item) => {
			const tracks = tracksForAct(item.n, extraEps);
			const tenReady = tracks.length >= 10 && tracks.every((row) => confirmedEps.includes(padEp(row.n)));
			if (tenReady) return true;
			return sealedHere && fileActs.includes(item.n);
		}).map((item) => item.n);
	}, [visibleActs, extraEps, confirmedEps, pref.actPlaylist, fileActs, fileActGenre, genreId]);
	const youtubeByEp = useMemo(() => {
		const out = {};
		const packages = readAppDump().packages;
		for (const [key, url] of Object.entries(readYoutubeMap())) {
			if (!key.startsWith(`${genreId}:`) || !url.trim()) continue;
			const ep = key.slice(genreId.length + 1);
			if (!/^\d{1,2}$/.test(ep)) continue;
			const row = packages[key] ?? packages[`${genreId}:${padEp(ep)}`];
			const savedTitle = (row?.pkg)?.confirmedTitle || row?.title || "";
			if (titleOwnedByOtherEp(savedTitle, ep)) continue;
			out[padEp(ep) || ep] = url.trim();
		}
		return out;
	}, [
		genreId,
		ytTick,
		encyclopediaReady
	]);
	const mvByEp = useMemo(() => {
		const out = {};
		const packages = readAppDump().packages;
		for (const [key, row] of Object.entries(packages)) {
			if (!key.startsWith(`${genreId}:`)) continue;
			const ep = key.slice(genreId.length + 1);
			if (!/^\d{1,2}$/.test(ep)) continue;
			const url = String(row?.pkg?.mvUrl || "").trim();
			if (url) out[padEp(ep) || ep] = url;
		}
		return out;
	}, [genreId, ytTick, encyclopediaReady]);
	const sunoByEp = useMemo(() => {
		const out = {};
		const packages = readAppDump().packages;
		for (const [key, row] of Object.entries(packages)) {
			if (!key.startsWith(`${genreId}:`)) continue;
			const ep = key.slice(genreId.length + 1);
			if (!/^\d{1,2}$/.test(ep)) continue;
			const url = String(row?.pkg?.sunoUrl || "").trim();
			if (url) out[padEp(ep) || ep] = url;
		}
		return out;
	}, [genreId, ytTick, encyclopediaReady]);
	useEffect(() => {
		const url = epN ? readYoutubeUrl(genreId, epN) : readPlaylistYoutubeUrl(genreId, actN);
		const mv = epN ? readMvUrl(genreId, epN) : readPlaylistMvUrl(genreId, actN);
		const suno = epN ? readSunoUrl(genreId, epN) : readPlaylistSunoUrl(genreId, actN);
		const scope = epN ? "ep" : "act";
		const linkId = epN || String(actN);
		const page = `${genreId}:${linkId}:${scope}`;
		const moved = linkHydrated.current.page !== page;
		if (moved) {
			linkSync.current = true;
			const remembered = levelText(heardBySong.current[`${genreId}:${padEp(epN) || ""}`] || "");
			if (remembered && padEp(epN)) {
				const shownPage = `${genreId}:${padEp(epN)}`;
				levelHold.current = true;
				levelPin.current = { page: shownPage, text: remembered, on: true };
				heardLevel.current = { page: shownPage, text: remembered };
				setLevelDraft(remembered);
			} else {
				levelHold.current = false;
				levelPin.current = { page: "", text: "", on: false };
				setLevelDraft("");
			}
			sunoPin.current = "";
		}
		const adopt = (live, key, incoming, apply) => {
			const prev = linkHydrated.current[key];
			if (moved || live.current === prev) {
				if (live.current !== incoming) apply(incoming);
				live.current = incoming;
				linkHydrated.current[key] = incoming;
				return;
			}
			if (live.current === incoming) linkHydrated.current[key] = incoming;
		};
		adopt(ytLive, "yt", url, setYtDraft);
		adopt(mvLive, "mv", mv, setMvDraft);
		if (moved && sunoPin.current !== pageKey) adopt(sunoLive, "suno", suno, setSunoDraft);
		const linkBody = epN ? readCachedPackage(epN, genreId) : readCachedPlaylist(actN, genreId);
		const songChoice = premiumChoice(linkBody?.ytPremium, genreId, linkId, "song", scope);
		const mvChoice = premiumChoice(linkBody?.mvPremium, genreId, linkId, "mv", scope);
		const songOn = songChoice !== false;
		const mvOn = mvChoice !== false;
		const lockPage = `${genreId}:${linkId}:${scope}`;
		if (premiumLock.current.page === lockPage && premiumLock.current.song === songOn) premiumLock.current.song = null;
		if (premiumLock.current.page === lockPage && premiumLock.current.mv === mvOn) premiumLock.current.mv = null;
		const songShown = premiumLock.current.page === lockPage && (premiumLock.current.song === true || premiumLock.current.song === false) ? premiumLock.current.song : songOn;
		const mvShown = premiumLock.current.page === lockPage && (premiumLock.current.mv === true || premiumLock.current.mv === false) ? premiumLock.current.mv : mvOn;
		if (moved || ytPremiumHold.current === linkHydrated.current.ytPremium) {
			if (ytPremiumHold.current !== songShown) setYtPremium(songShown);
			linkHydrated.current.ytPremium = songShown;
		} else if (ytPremiumHold.current === songShown) linkHydrated.current.ytPremium = songShown;
		if (moved || mvPremiumHold.current === linkHydrated.current.mvPremium) {
			if (mvPremiumHold.current !== mvShown) setMvPremium(mvShown);
			linkHydrated.current.mvPremium = mvShown;
		} else if (mvPremiumHold.current === mvShown) linkHydrated.current.mvPremium = mvShown;
		linkHydrated.current.page = page;
	}, [genreId, epN, actN, ytTick, encyclopediaReady]);
	useEffect(() => {
		if (!genreId || !encyclopediaReady) return;
		const id = padEp(epN);
		const page = pageKey;
		const gen = ++fileLoadGen.current;
		const stamp = id ? readPackageStamp(id, genreId) : readPlaylistStamp(actN, genreId);
		let stop = false;
		void readResultFile({ data: { kind: id ? "song" : "act", genreId, ep: id, act: actN, title: "" } }).then((res) => {
			if (stop || gen !== fileLoadGen.current) return;
			const plain = plainServer(res);
			if (!plain || plain.ok === false || !plain.fields || typeof plain.fields !== "object") return;
			const fields = plain.fields;
			fileFields.current = { page, fields };
			paneRev.current = Number(plain.rev) || 0;
			const cached = id ? readCachedPackage(id, genreId) : readCachedPlaylist(actN, genreId);
			if (cached) {
				for (const key of ["lyricsBlock", "confirmedTitle", "sunoUrl", "youtubeUrl"]) {
					if (String(cached[key] ?? "") === String(fields[key] ?? "")) continue;
					traceField({
						songId: id ? `${genreId}:${id}` : `${genreId}:act:${actN}`,
						field: key,
						value: fields[key],
						source: "song-file",
						reader: "readResultFile",
						component: "StudioApp",
						rev: Number(plain.rev) || 0,
						note: "memory-differs",
					});
					traceField({
						songId: id ? `${genreId}:${id}` : `${genreId}:act:${actN}`,
						field: key,
						value: cached[key],
						source: "app-memory",
						reader: "readCachedPackage",
						component: "StudioApp",
						rev: Number(plain.rev) || 0,
						note: "shown-until-adopt",
					});
				}
			}
			const filedYt = String(fields.youtubeUrl || "");
			const filedMv = String(fields.mvUrl || "");
			const linksIdle = String(ytLive.current || "") === String(linkHydrated.current.yt || "") && String(mvLive.current || "") === String(linkHydrated.current.mv || "");
			if (linksIdle && id) {
				const raw = readCachedPackage(id, genreId);
				if (raw && (String(raw.youtubeUrl || "") !== filedYt || String(raw.mvUrl || "") !== filedMv)) {
					pinShownSong(genreId, id, { ...raw, youtubeUrl: filedYt, mvUrl: filedMv });
					setYtTick((tick) => tick + 1);
				}
			} else if (linksIdle && actN) {
				const raw = readCachedPlaylist(actN, genreId);
				if (raw && (String(raw.youtubeUrl || "") !== filedYt || String(raw.mvUrl || "") !== filedMv)) {
					pinShownPlaylist(genreId, actN, { ...raw, youtubeUrl: filedYt, mvUrl: filedMv });
					setYtTick((tick) => tick + 1);
				}
			}
			const moved = id ? readPackageStamp(id, genreId) !== stamp : readPlaylistStamp(actN, genreId) !== stamp;
			if (!moved) {
				const gid = genreId;
				if (id) {
					const raw = pkgOwnerRef.current === id && pkgRef.current && hasPageBody(pkgRef.current) ? pkgRef.current : readCachedPackage(id, gid);
					if (raw && hasPageBody(raw)) {
						const drafts = fieldDrafts(`${gid}:${id}`).map((row) => row.id);
						const adopted = adoptSavedFileText(raw, fields, drafts);
						if (adopted !== raw) {
							pinShownSong(gid, id, adopted);
							if (padEp(epNRef.current) === id) {
								pkgEp.current = id;
								pkgOwnerRef.current = id;
								pkgRef.current = adopted;
								setPkgOwner(id);
								setPkg(adopted);
							}
						}
					}
				} else if (actN) {
					const raw = playlistRef.current && hasPlaylistBody(playlistRef.current) ? playlistRef.current : readCachedPlaylist(actN, gid);
					if (raw && hasPlaylistBody(raw)) {
						const drafts = fieldDrafts(`${gid}:act${actN}`).map((row) => row.id);
						const adopted = adoptSavedFileText(raw, fields, drafts);
						if (adopted !== raw) {
							pinShownPlaylist(gid, actN, adopted);
							if (!padEp(epNRef.current)) {
								playlistRef.current = adopted;
								setPlaylist(adopted);
							}
						}
					}
				}
				const takeLink = (live, key, incoming, apply) => {
					const next = String(incoming || "");
					if (key === "suno" && sunoPin.current === page) return;
					const held = String(linkHydrated.current[key] || "");
					const current = String(live.current || "");
					if (current !== held) return;
					if (key === "suno" && typeof document !== "undefined") {
						const screen = document.querySelector("#studio-result input[data-suno-field]");
						const screenValue = screen && "value" in screen ? String(screen.value || "") : null;
						if (screenValue !== null && screenValue !== next && screenValue !== held) return;
					}
					if (current === next) {
						linkHydrated.current[key] = current;
						return;
					}
					live.current = next;
					linkHydrated.current[key] = next;
					apply(next);
				};
				takeLink(sunoLive, "suno", fields.sunoUrl, setSunoDraft);
				takeLink(ytLive, "yt", fields.youtubeUrl, setYtDraft);
				takeLink(mvLive, "mv", fields.mvUrl, setMvDraft);
			}
			setFileRev((n) => n + 1);
		}).catch(() => {});
		return () => {
			stop = true;
		};
	}, [genreId, epN, actN, encyclopediaReady, pageKey]);
	useEffect(() => {
		const onSync = () => setExplorerRev((n) => n + 1);
		window.addEventListener("noa-explorer-sync", onSync);
		return () => window.removeEventListener("noa-explorer-sync", onSync);
	}, []);
	useEffect(() => {
		const onCommit = (event) => {
			const detail = event.detail || {};
			const field = String(detail.field || "");
			const value = String(detail.value ?? "");
			if (field === "suno") saveSuno(value);
			else if (field === "youtube") saveYoutube(value);
			else if (field === "mv") saveMv(value);
		};
		window.addEventListener("noa-link-commit", onCommit);
		return () => window.removeEventListener("noa-link-commit", onCommit);
	});
	useEffect(() => {
		if (!explorerRev || !genreId || !encyclopediaReady) return;
		const id = padEp(epN);
		const page = pageKey;
		const gen = ++fileLoadGen.current;
		let stop = false;
		void readResultFile({ data: { kind: id ? "song" : "act", genreId, ep: id, act: actN, title: "" } }).then((res) => {
			if (stop || gen !== fileLoadGen.current) return;
			const plain = plainServer(res);
			if (!plain || plain.file !== true || !plain.fields || typeof plain.fields !== "object") return;
			const fields = plain.fields;
			fileFields.current = { page, fields };
			paneRev.current = Number(plain.rev) || 0;
			setFileRev((n) => n + 1);
			const take = (raw) => {
				if (!raw) return raw;
				const next = { ...raw };
				let changed = false;
				const scope = id ? `${genreId}:${id}` : `${genreId}:act${actN}`;
				const busy = new Set(fieldDrafts(scope).map((row) => DRAFT_PANE_KEY[row.id]).filter(Boolean));
				const writing = typeof document !== "undefined" && document.activeElement instanceof HTMLTextAreaElement && document.activeElement.closest("#studio-result");
				for (const key of [...SAVED_PANE_KEYS, "youtubeUrl", "mvUrl"]) {
					if (busy.has(key) || writing) continue;
					if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
					if (String(next[key] ?? "") === String(fields[key] ?? "")) continue;
					next[key] = fields[key];
					changed = true;
				}
				return changed ? next : raw;
			};
			if (id) {
				const raw = pkgOwnerRef.current === id && pkgRef.current && hasPageBody(pkgRef.current) ? pkgRef.current : readCachedPackage(id, genreId);
				const next = take(raw);
				if (next && next !== raw) {
					pinShownSong(genreId, id, next);
					if (String(next.youtubeUrl || "") !== String(raw.youtubeUrl || "") || String(next.mvUrl || "") !== String(raw.mvUrl || "")) setYtTick((tick) => tick + 1);
					if (padEp(epNRef.current) === id) {
						pkgEp.current = id;
						pkgOwnerRef.current = id;
						pkgRef.current = next;
						setPkgOwner(id);
						setPkg(next);
					}
				}
			} else if (actN) {
				const raw = playlistRef.current && hasPlaylistBody(playlistRef.current) ? playlistRef.current : readCachedPlaylist(actN, genreId);
				const next = take(raw);
				if (next && next !== raw) {
					pinShownPlaylist(genreId, actN, next);
					if (String(next.youtubeUrl || "") !== String(raw.youtubeUrl || "") || String(next.mvUrl || "") !== String(raw.mvUrl || "")) setYtTick((tick) => tick + 1);
					if (!padEp(epNRef.current)) {
						playlistRef.current = next;
						setPlaylist(next);
					}
				}
			}
			const linkSame = (live, key) => String(live.current || "") === String(linkHydrated.current[key] || "");
			if (linkSame(sunoLive, "suno") && sunoPin.current !== page && Object.prototype.hasOwnProperty.call(fields, "sunoUrl")) setSunoDraft(String(fields.sunoUrl || ""));
			if (linkSame(ytLive, "yt") && Object.prototype.hasOwnProperty.call(fields, "youtubeUrl")) setYtDraft(String(fields.youtubeUrl || ""));
			if (linkSame(mvLive, "mv") && Object.prototype.hasOwnProperty.call(fields, "mvUrl")) setMvDraft(String(fields.mvUrl || ""));
		}).catch(() => {});
		return () => {
			stop = true;
		};
	}, [explorerRev]);
	useEffect(() => {
		const onLevel = (event) => {
			const detail = event.detail || {};
			const fromId = /^suno:ep:([^:]+):(\d{1,2})$/.exec(String(detail.id || ""));
			const genre = String(detail.genreId || fromId?.[1] || "");
			const id = padEp(detail.ep || fromId?.[2] || "");
			const text = String(detail.text || "").trim();
			const analysis = String(detail.analysis || "").trim();
			if (text && genre && id) heardBySong.current[`${genre}:${id}`] = text;
			const openId = padEp(epNRef.current || "");
			const sameSong = Boolean(genre && id && genre === genreIdRef.current && id === openId);
			if (!sameSong || (!text && !analysis)) return;
			const page = pageKeyRef.current;
			const filedLevel = fileFields.current.page === page ? String(fileFields.current.fields.audioLevel || "").trim() : "";
			const filedAnalysis = fileFields.current.page === page ? String(fileFields.current.fields.audioAnalysis || "").trim() : "";
			const typing = typeof document !== "undefined" && document.activeElement instanceof HTMLInputElement && document.activeElement.matches("input[data-level-field]");
			const typingAnalysis = typeof document !== "undefined" && document.activeElement instanceof HTMLInputElement && document.activeElement.matches("input[data-analysis-field]");
			if (text && !filedLevel && !typing) {
				heardLevel.current = { page, text };
				levelHold.current = true;
				levelPin.current = { page, text, on: true };
				setLevelDraft(text);
			}
			if (analysis && !filedAnalysis && !typingAnalysis) {
				heardAnalysis.current = { page, text: analysis };
				analysisHold.current = true;
				analysisPin.current = { page, text: analysis, on: true };
				setAnalysisDraft(analysis);
			}
			setFileRev((n) => n + 1);
		};
		window.addEventListener("noa-audio-level", onLevel);
		return () => window.removeEventListener("noa-audio-level", onLevel);
	}, []);
	const readyHold = useRef([]);
	const readyEps = useMemo(() => {
		const fields = requiredStudioFields(genreId, readPref(genreId));
		const ids = /* @__PURE__ */ new Set([...EPS.map((ep) => padEp(ep.n)), ...extras.map((item) => padEp(item.n))]);
		const ready = [];
		for (const n of ids) {
			if (!n || confirmedEps.includes(n)) continue;
			const locks = readLocks("single", n, genreId);
			if (fields.length > 0 && fields.every((field) => locks[field.id] === true) || readRowLocked(genreId, n)) ready.push(n);
		}
		readyHold.current = ready;
		return ready;
	}, [
		genreId,
		confirmTick,
		lockTick,
		extras,
		confirmedEps,
		encyclopediaReady
	]);
	const [heldReady, setHeldReady] = useState({});
	const lockShown = useRef(readLockShown());
	const [rowRev, setRowRev] = useState(0);
	const lockedIds = useMemo(() => {
		return readyEps.filter((id) => lockCache.get(lockKey(genreId, id)) !== false);
	}, [
		readyEps,
		rowRev,
		genreId
	]);
	useEffect(() => {
		setHeldReady((prev) => {
			if (!readyEps.length && Object.values(prev).some(Boolean)) return prev;
			const next = { ...prev };
			let changed = !readyEps.length;
			for (const id of readyEps) {
				if (next[id] === false) continue;
				if (next[id] !== true) changed = true;
				next[id] = true;
			}
			return changed ? next : prev;
		});
	}, [readyEps]);
	const pageConfirmed = isSingle ? isConfirmed("single", genreId, epN) : Boolean(!epN && isConfirmed("playlist", genreId, String(actN)));
	useEffect(() => {
		try {
			setExtras(collectOriginals());
		} catch {}
		setReady(true);
		let settled = false;
		const timer = window.setTimeout(() => {
			if (settled) return;
			setAdminHere(isAdminDevice());
			setEncyclopediaReady(true);
		}, 6000);
		pullEncyclopedia().then((dump) => {
			settled = true;
			window.clearTimeout(timer);
			if (dump) {
				ingestEncyclopedia(dump);
				parkPhoneSuno();
				if (dump.prefs) applyDumpPrefs(dump.prefs);
				writeFillQueue(null);
			}
			void rematchStoredPackages();
			syncCurrentPrefs();
			markMetaHydrated();
			setAdminHere(isAdminDevice());
			restoreAdminGate();
			setGateUi(isGateOpen());
			if (!isGateOpen()) setKpopMode("browse");
			window.dispatchEvent(new Event(GATE_EVENT));
			if (!genrePickedRef.current) {
				setGenrePicked(false);
				clearHeldPlace();
				patchApp((d) => {
					d.meta.ui = {
						...d.meta.ui,
						genrePicked: false
					};
				});
			}
			setSavedEps(readSavedEps(genreId));
			setEncyclopediaReady(true);
		}).catch(() => {
			settled = true;
			window.clearTimeout(timer);
			markMetaHydrated();
			rematchStoredPackages();
			syncCurrentPrefs();
			setAdminHere(isAdminDevice());
			restoreAdminGate();
			setGateUi(isGateOpen());
			setEncyclopediaReady(true);
		});
		return () => {
			settled = true;
			window.clearTimeout(timer);
		};
	}, []);
	useEffect(() => {
		if (!encyclopediaReady) return;
		for (const genre of GENRES) warmGenreHead(genre.id);
	}, [encyclopediaReady]);
	useEffect(() => {
		if (!ready || !encyclopediaReady) return;
		registerFillSw();
		pauseFillWorker();
		setFillAsk(false);
		const rel = pendingRelease();
		if (rel) {
			setUpgradeNotes(rel.notes);
			setUpgradeAsk(true);
		} else setUpgradeAsk(false);
	}, [ready, encyclopediaReady]);
	useEffect(() => {
		if (!ready) return;
		function onOpen() {
			clearFillNotify();
		}
		function onMessage(event) {
			if (event.data && event.data.type === "noa-fill-open") onOpen();
		}
		window.addEventListener("noa-fill-open", onOpen);
		navigator.serviceWorker?.addEventListener("message", onMessage);
		return () => {
			window.removeEventListener("noa-fill-open", onOpen);
			navigator.serviceWorker?.removeEventListener("message", onMessage);
		};
	}, [ready]);
	useEffect(() => {
		const up = () => setOnline(navigator.onLine);
		window.addEventListener("online", up);
		window.addEventListener("offline", up);
		return () => {
			window.removeEventListener("online", up);
			window.removeEventListener("offline", up);
		};
	}, []);
	useEffect(() => {
		if (filling && !fillPaused && !fillStall && limitWait <= 0 && fillErrors.length === 0 && online) holdFillWake();
		else dropFillWake();
		return () => dropFillWake();
	}, [
		filling,
		fillPaused,
		limitWait,
		fillErrors,
		online
	]);
	useEffect(() => {
		if (!limitUntil) {
			setLimitWait(0);
			return;
		}
		const tick = () => {
			const left = Math.max(0, Math.ceil((limitUntil - Date.now()) / 1e3));
			setLimitWait(left);
			setFillTrack((cur) => cur?.current ? {
				...cur,
				current: {
					...cur.current,
					waitSec: left > 0 ? left : 0
				}
			} : cur);
			if (left <= 0) {
				setLimitUntil(0);
				const job = readFillQueue();
				if (job?.limitUntil) persistQueue({
					...job,
					limitUntil: 0
				});
			}
		};
		tick();
		const id = window.setInterval(tick, 1e3);
		return () => window.clearInterval(id);
	}, [limitUntil]);
	useEffect(() => {
		if (!ready || !encyclopediaReady || !booted) return;
		if (!genrePicked) {
			clearHeldPlace();
			try {
				patchApp((d) => {
					d.meta.ui = {
						...d.meta.ui,
						genrePicked: false
					};
				});
			} catch {}
			return;
		}
		try {
			writeHeldPlace({
				genreId,
				mode: kind === "single" ? "single" : "playlist",
				ep: epN,
				act: actN,
				kpopMode,
				picked: true
			});
			writeGenreSlot(genreId, epN, actN);
			patchApp((d) => {
				d.meta.ui = {
					genreId,
					mode: kind,
					kpopMode,
					genrePicked,
					ep: epN,
					act: actN
				};
			});
		} catch {}
		if (fillingRef.current) {
			const n = padEp(epN);
			if (n) {
				const cached = readCachedPackage(n, genreId);
				pkgEp.current = n;
				setPkgOwner(n);
				setPkg(cached);
				dropFieldLocks("single", n);
				if (genre.kind === "original") fillOrig(n);
			} else {
				playlistActRef.current = actN;
				setPlaylist(readCachedPlaylist(actN, genreId));
				setLocks(unlockEmptyLocks(readLocks("playlist", String(actN), genreId), readCachedPlaylist(actN, genreId) ?? emptyPlaylist(), PLAYLIST_BLOCKS));
			}
			return;
		}
		const n = padEp(epN);
		if (n) {
			const cached = readCachedPackage(n, genreId);
			const keptSong = cached ?? (pkgEp.current === n && hasPageBody(pkgRef.current) ? pkgRef.current : null);
			const orig = extras.find((item) => item.n === n);
			pkgEp.current = n;
			setPkgOwner(n);
			setPkg(keptSong);
			setThumbCast(keptSong?.thumbCast ?? (genre.kind === "original" && orig?.vocal ? thumbCastFromVocal(orig.vocal) : defaultThumbCast(genreId)));
			dropFieldLocks("single", n);
			setSavedSnap(keptSong && isStudioComplete(keptSong, {
				suno: genreWantsSuno(genre.id),
				letter: pref.community,
				source: genre.kind !== "original"
			}) ? snapOf(keptSong) : "");
			if (genre.kind === "original") fillOrig(n);
			if (!fillClientRef.current) hydratePage("single", n);
		} else {
			const cached = readCachedPlaylist(actN, genreId);
			playlistActRef.current = actN;
			setPlaylist(cached);
			setThumbCast(cached?.thumbCast ?? defaultThumbCast(genreId));
			setLocks(unlockEmptyLocks(readLocks("playlist", String(actN), genreId), cached ?? emptyPlaylist(), PLAYLIST_BLOCKS));
			setSavedSnap(cached ? snapOf(cached) : "");
			hydratePage("playlist");
		}
	}, [
		ready,
		encyclopediaReady,
		booted,
		epN,
		genreId,
		actN
	]);
	useEffect(() => {
		if (epN || !bundleOpen || !genrePicked || !booted) return;
		if (shownPlaylist && hasPlaylistBody(shownPlaylist)) return;
		say("");
		hydratePage("playlist");
	}, [bundleOpen, actN, genreId, booted, genrePicked, epN]);
	useEffect(() => {
		if (epN) return;
		return watchDescReady(() => {
			if (ytLive.current && ytLive.current !== linkHydrated.current.yt) return;
			const url = readPlaylistYoutubeUrl(genreId, actN);
			if (!url || url === ytLive.current) return;
			ytLive.current = url;
			linkHydrated.current.yt = url;
			setYtDraft(url);
			const mv = readPlaylistMvUrl(genreId, actN);
			if (mv && mv !== mvLive.current && !(mvLive.current && mvLive.current !== linkHydrated.current.mv)) {
				mvLive.current = mv;
				linkHydrated.current.mv = mv;
				setMvDraft(mv);
			}
		});
	}, [genreId, actN, epN]);
	useEffect(() => {
		if (!ready) return;
		if (explorerRev) genreHeadWait.delete(genreId);
		const local = readSavedEps(genreId);
		setSavedEps(local);
		let stop = false;
		const takeActs = (asked: string, acts: { act: number; youtubeDescription?: string; youtubeUrl?: string }[]) => {
			if (stop || asked !== genreId) return;
			for (const act of acts) rememberActPreview(genreId, act.act, act.youtubeDescription || "", act.youtubeUrl || "");
			setYtTick((tick) => tick + 1);
		};
		const applyHeads = (pack, acts) => {
			if (stop) return;
			takeActs(genreId, acts ?? []);
			const live = (acts ?? []).filter((act) => act.activated === true).map((act) => act.act);
			setFileActGenre(genreId);
			setFileActs(live);
			const rows = pack?.songs ?? [];
			const next = new Set(local);
			let confirmChanged = false;
			let urlChanged = false;
			patchApp((d) => {
				const confirmed = { ...(d.meta.confirmed ?? {}) };
				const youtube = { ...(d.meta.youtube ?? {}) };
				for (const row of rows) {
					next.add(row.ep);
					if (row.title) rememberTitle(genreId, row.ep, row.title);
					if (row.youtubeDescription) rememberSongDesc(genreId, row.ep, row.youtubeDescription);
					if (row.confirmed) {
						const key = `${genreId}:ep:${padEp(row.ep)}`;
						if (confirmed[key] !== true) {
							confirmed[key] = true;
							confirmChanged = true;
						}
					}
					if (row.youtubeUrl) {
						const key = `${genreId}:${padEp(row.ep)}`;
						if (youtube[key] !== row.youtubeUrl) {
							youtube[key] = row.youtubeUrl;
							urlChanged = true;
						}
					}
				}
				for (const act of pack?.acts ?? []) {
					if (!act.confirmed) continue;
					const key = `${genreId}:act:${act.act}`;
					if (confirmed[key] !== true) {
						confirmed[key] = true;
						confirmChanged = true;
					}
				}
				d.meta.confirmed = confirmed;
				d.meta.youtube = youtube;
			}, false);
			for (const act of pack?.acts ?? []) rememberActPreview(genreId, act.act, act.youtubeDescription || "", act.youtubeUrl || "");
			setSavedEps([...next]);
			if (!padEp(epNRef.current)) {
				const lines = actSongLines(genreId, actN);
				const cur = playlistRef.current;
				if (lines && cur && hasPlaylistBody(cur) && cur.tracklistEdited !== true && !isConfirmed("playlist", genreId, String(actN)) && lines.trim() !== String(cur.tracklist || "").trim()) {
					keepPlaylist({ ...cur, tracklist: lines }, true, actN, genreId, true);
				}
			}
			if (confirmChanged) setConfirmTick((tick) => tick + 1);
			if (urlChanged) setYtTick((tick) => tick + 1);
		};
		warmGenreHead(genreId).then(([pack, acts]) => applyHeads(pack, acts));
		Promise.all([
			listFilledEps({ data: { genreId } }).catch(() => null),
			listGenreActs({ data: { genreId } }).catch(() => [])
		]).then(([pack, acts]) => {
			if (pack) genreHeadWait.set(genreId, Promise.resolve([pack, acts]));
			applyHeads(pack, acts);
		});
		return () => {
			stop = true;
		};
	}, [ready, genreId, explorerRev]);
	function guardLeave(next) {
		next();
	}
	function pickAct(n) {
		fillScopeRef.current = "act";
		setActChosen(true);
		say("");
		guardLeave(() => {
			setActN(n);
			setEpN("");
			setBundleOpen(false);
		});
	}
	function fillOrig(n, list = extras) {
		const id = padEp(n);
		const file = getOriginal(id);
		const extra = list.find((item) => padEp(item.n) === id);
		const cat = library.find((item) => padEp(item.n) === id);
		const o = Boolean(extra && file && extra.title.trim() === file.title.trim()) ? extra : file;
		setOrigDraft({
			title: o?.title || extra?.title || cat?.title || "",
			vocal: o?.vocal || (!file ? extra?.vocal : "") || "",
			lyrics: o?.lyrics || (!file ? extra?.lyrics : "") || ""
		});
	}
	useEffect(() => {
		if (!isKpop || !epN) return;
		if (origDraft.title || origDraft.vocal || origDraft.lyrics) return;
		const id = padEp(epN);
		const o = extras.find((item) => padEp(item.n) === id) ?? getOriginal(id);
		if (!o || !o.title && !o.vocal && !o.lyrics) return;
		setOrigDraft({
			title: o.title,
			vocal: o.vocal,
			lyrics: o.lyrics
		});
	}, [
		isKpop,
		epN,
		extras
	]);
	function pickEp(n) {
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 결과창을 열 수 없습니다.");
			return;
		}
		if (Date.now() < ignorePickUntil.current) return;
		if (Date.now() - unlockAt.current < 800) return;
		const id = padEp(n) || n;
		if (!id) return;
		if (padEp(epN) === id) {
			dismissResult(id);
			return;
		}
		if (isKpop && kpopMode === "browse") fillOrig(id);
		openSongResult(id);
	}
	function pickKpopMode(mode) {
		if (mode === kpopMode) return;
		guardLeave(() => {
			setKpopMode(mode);
			if (mode === "browse") {
				const list = collectOriginals(formatSource(kpopDraft));
				setExtras(list);
				const withBody = list.filter((item) => item.lyrics.trim() || item.vocal.trim());
				const chosen = epN && withBody.find((item) => item.n === epN) || epN && list.find((item) => item.n === epN) || withBody.find((item) => actFromEp(item.n) === actN) || withBody[0];
				if (chosen) {
					setEpN(chosen.n);
					setActN(actFromEp(chosen.n));
					fillOrig(chosen.n, list);
				}
			}
		});
	}
	function saveOriginal() {
		const n = padEp(epN);
		followPressed("");
		if (!n) {
			setError("곡이 선택되지 않아 원곡을 저장하지 못했습니다.");
			return;
		}
		persistOriginal({
			n,
			title: origDraft.title,
			vocal: origDraft.vocal,
			lyrics: origDraft.lyrics
		}, true);
		setExtras(readOriginals());
	}
	function saveCompose() {
		const n = padEp(kpopDraft.ep);
		followPressed("");
		if (!n) {
			setError("EP 번호가 없어 원곡을 저장하지 못했습니다.");
			return;
		}
		persistOriginal({
			n,
			title: kpopDraft.title,
			vocal: kpopDraft.vocal,
			lyrics: kpopDraft.lyrics
		}, true);
		setExtras(readOriginals());
	}
	function pickGenre(id) {
		setGenreOpen(false);
		if (genrePicked && id === genreId) return;
		warmGenreHead(id);
		guardLeave(() => {
			stopSplash();
			if (genrePicked) writeGenreSlot(genreId, epN, actN);
			const slot = readGenreSlot(id);
			setGenreId(id);
			setGenrePicked(true);
			genrePickedRef.current = true;
			if (id === "kpop-original") setKpopMode("browse");
			setBundleOpen(false);
			setActChosen(false);
			setEpN("");
			fillScopeRef.current = "genre";
			if (slot) setActN(slot.act);
			writeHeldPlace({
				genreId: id,
				mode: kind === "single" ? "single" : "playlist",
				ep: "",
				act: slot?.act ?? actN,
				kpopMode: id === "kpop-original" ? "browse" : kpopMode,
				picked: true
			});
		});
	}
	function goHome() {
		if (!genrePickedRef.current && !padEp(epN)) return;
		setGenreOpen(false);
		setBundleOpen(false);
		setActChosen(false);
		setEpN("");
		setGenrePicked(false);
		genrePickedRef.current = false;
		clearHeldPlace();
		try {
			patchApp((d) => {
				d.meta.ui = {
					...d.meta.ui,
					genrePicked: false,
					ep: ""
				};
			});
		} catch {}
	}
	function persistOriginal(song, immediate = false) {
		upsertOriginal(song);
		const run = () => saveOriginalSong({ data: {
			genreId,
			n: song.n,
			title: song.title,
			vocal: song.vocal,
			lyrics: song.lyrics
		} }).catch(() => {});
		if (immediate) {
			run();
			return;
		}
		window.clearTimeout(origTimer.current);
		origTimer.current = window.setTimeout(() => void run(), 450);
	}
	function persistQueue(job) {
		writeFillQueue(job);
		return saveFillJob({ data: job ?? {
			genreId: "joseon-ballad",
			tasks: [],
			acceptedAt: 0,
			total: 0,
			limitUntil: 0
		} }).catch(() => {});
	}
	function auditFillTargets() {
		const audit = summarizeFillQueue();
		setFillAudit(audit);
		return audit.total;
	}
	function followTask(task, gid) {
		const use = task.genreId ?? gid;
		if (task.kind === "single" && task.n) fillWorkRef.current = {
			n: task.n,
			genreId: use
		};
		if (fillPeekRef.current || followHoldRef.current || Date.now() < pinResultUntil.current) return;
		if (use !== genreId) setGenreId(use);
		if (task.kind === "single" && task.n) {
			const n = padEp(task.n) || task.n;
			if (isConfirmed("single", use, n)) return;
			manualEp.current = "";
			stickEp.current = "";
			setKind("single");
			setActN(actFromEp(n));
			setEpN(n);
		} else if (task.act) {
			setKind("playlist");
			setEpN("");
			setActN(task.act);
		}
	}
	function followPressed(blockId) {
		const go = (attempt = 0) => {
			const el = document.getElementById(blockId ? `field-${blockId}` : "studio-result");
			if (!el) {
				if (attempt < 8) window.setTimeout(() => go(attempt + 1), 80);
				return;
			}
			followTarget(el);
		};
		window.setTimeout(() => go(0), 40);
	}
	function scrollToField(blockId, attempt = 0) {
		if (followHoldRef.current || fillPeekRef.current) return;
		if (Date.now() < pinResultUntil.current) return;
		window.setTimeout(() => {
			if (followHoldRef.current || fillPeekRef.current) return;
			const marks = fillMarksRef.current;
			if (marks.length > 1) {
				const nodes = marks.map((id) => document.getElementById(`field-${id}`)).filter((node) => node instanceof HTMLElement);
				if (nodes.length > 1) {
					showWorkGroup(nodes);
					return;
				}
				if (attempt < 8) scrollToField(blockId, attempt + 1);
				return;
			}
			const el = document.getElementById(`field-${blockId}`);
			if (!el) {
				if (attempt < 8) scrollToField(blockId, attempt + 1);
				return;
			}
			placeFillField(el);
		}, attempt === 0 ? 420 : 280);
	}
	function fillSteps(gid) {
		const ids = new Set(requiredStudioFields(gid, readPref(gid)).map((field) => field.id));
		return [{
			id: "check",
			label: "체크",
			fields: []
		}, ...[
			{
				id: "title",
				label: "제목",
				fields: ["title"]
			},
			{
				id: "lyrics",
				label: "가사",
				fields: ["lyrics"]
			},
			{
				id: "suno",
				label: "수노",
				fields: ["suno"]
			},
			{
				id: "thumb",
				label: "썸네일",
				fields: ["thumb"]
			},
			{
				id: "yt",
				label: "유튜브",
				fields: ["yt-title", "yt-desc"]
			}
		].filter((step) => step.fields.some((field) => ids.has(field)))];
	}
	function markFillField(id, phase, label, ep, kind) {
		fillFocusRef.current = {
			id,
			phase
		};
		setFillFocus({
			id,
			phase
		});
		const text = phase === "audit" ? `검열 중 · ${label} · EP.${ep}` : kind === "empty" ? `${label} 작성 중 · EP.${ep}` : kind === "request" ? `${label} 요구 반영 중 · EP.${ep}` : kind === "revise" ? `${label} 보완 중 · EP.${ep}` : `${label} 재생성 중 · EP.${ep}`;
		setFillCurrent(text);
		const idn = padEp(ep);
		if (idn && !followHoldRef.current && !fillPeekRef.current && padEp(epNRef.current) !== idn) {
			manualEp.current = "";
			stickEp.current = "";
			setKind("single");
			setActN(actFromEp(idn));
			setEpN(idn);
		}
		setFillTrack((cur) => {
			if (!cur?.current) return cur;
			const steps = cur.current.steps?.length ? cur.current.steps : fillSteps(cur.current.genreId);
			const step = Math.max(0, steps.findIndex((item) => item.fields.includes(id)));
			const pct = Math.round((step + (phase === "audit" ? .35 : .8)) / Math.max(1, steps.length) * 100);
			return {
				...cur,
				current: {
					...cur.current,
					steps,
					step,
					stage: step,
					pct,
					detail: text,
					waitSec: 0
				}
			};
		});
		scrollToField(id);
	}
	resumeFollowRef.current = () => {
		const work = fillWorkRef.current;
		if (!work || !fillingRef.current) return;
		followHoldRef.current = false;
		fillPeekRef.current = false;
		setFillPeek(false);
		followTask({
			kind: "single",
			n: work.n,
			genreId: work.genreId
		}, work.genreId);
		const focus = fillFocusRef.current;
		if (focus) scrollToField(focus.id);
	};
	useEffect(() => {
		if (!filling) {
			followHoldRef.current = false;
			fillMarksRef.current = [];
			setFillMarks([]);
			window.clearTimeout(followIdleRef.current);
			document.querySelectorAll("[data-fill-fit]").forEach((node) => {
				if (!(node instanceof HTMLElement)) return;
				node.style.maxHeight = "";
				node.style.overflow = "";
				node.removeAttribute("data-fill-fit");
			});
			return;
		}
		const arm = () => {
			if (!fillingRef.current) return;
			followHoldRef.current = true;
			window.clearTimeout(followIdleRef.current);
			followIdleRef.current = window.setTimeout(() => {
				if (!fillingRef.current || fillStop.current) return;
				resumeFollowRef.current();
			}, 3e3);
		};
		window.addEventListener("pointerdown", arm, { passive: true });
		window.addEventListener("wheel", arm, { passive: true });
		window.addEventListener("touchmove", arm, { passive: true });
		window.addEventListener("keydown", arm);
		return () => {
			window.removeEventListener("pointerdown", arm);
			window.removeEventListener("wheel", arm);
			window.removeEventListener("touchmove", arm);
			window.removeEventListener("keydown", arm);
			window.clearTimeout(followIdleRef.current);
		};
	}, [filling]);
	useEffect(() => {
		if (!filling || !fillFocus?.id) return;
		scrollToField(fillFocus.id);
	}, [filling, fillFocus?.id, fillFocus?.phase]);
	const fillingWas = useRef(false);
	useEffect(() => {
		if (fillingWas.current && !filling) {
			window.setTimeout(() => {
				const el = document.getElementById("result-actions");
				if (el) placeFillField(el);
			}, 120);
		}
		fillingWas.current = filling;
	}, [filling]);
	function openFillSong(song) {
		const n = padEp(song.n);
		const gid = song.genreId;
		const peek = song.status !== "run";
		fillPeekRef.current = peek;
		setFillPeek(peek);
		followHoldRef.current = true;
		window.clearTimeout(followIdleRef.current);
		followIdleRef.current = window.setTimeout(() => {
			if (!fillingRef.current || fillStop.current) return;
			resumeFollowRef.current();
		}, 3e3);
		if (gid !== genreId) setGenreId(gid);
		setKind("single");
		setActN(actFromEp(n));
		setEpN(n);
		writeGenreSlot(gid, n, actFromEp(n));
		window.setTimeout(() => {
			const id = peek ? "studio-result" : `ep-row-${n}`;
			followTarget(document.getElementById(id));
		}, 160);
	}
	function pushFill(event) {
		setFillEvents((cur) => [...cur.slice(-12), event]);
	}
	function namedActTracks(gid, act) {
		return tracksForAct(act, extrasAsEps(extras)).map((item) => ({
			n: item.n,
			title: confirmedTrackTitle(gid, item.n, item.title)
		}));
	}
	function actSongLines(gid, act) {
		const tracks = tracksForAct(act, extrasAsEps(extras));
		if (tracks.length < 10) return "";
		if (tracks.some((item) => !isConfirmed("single", gid, item.n))) return "";
		const lines = [];
		for (const item of tracks) {
			const title = knownConfirmedTitle(gid, item.n);
			if (!title) return "";
			lines.push(actTrackLine(item.n, title));
		}
		return lines.filter(Boolean).join("\n");
	}
	function withActTracks(gid, act, body) {
		if (!body) return body;
		const pageLocks = readLocks("playlist", String(act), gid);
		const lines = actSongLines(gid, act);
		const prefNow = readPref(gid);
		let next = body;
		let changed = false;
		if (lines && body.tracklistEdited !== true && pageLocks.tracks !== true && lines.trim() !== String(body.tracklist || "").trim()) {
			const keepDesc = body.descEdited === true || pageLocks["yt-desc"] === true || prefNow.output?.ytDesc === false;
			next = {
				...body,
				tracklist: lines,
				youtubeDescription: keepDesc ? body.youtubeDescription : descriptionWithTracklist(body.youtubeDescription || "", lines)
			};
			changed = true;
		}
		const patched = { ...next };
		const fields = [
			["summary", "summary"],
			["confirmedTitle", "title"],
			["youtubeTitle", "yt-title"],
			["youtubeDescription", "yt-desc"],
			["communityPost", "community"],
			["geminiPrompt", "thumb"]
		];
		for (const [key, lockId] of fields) {
			if (pageLocks[lockId] === true) continue;
			if (key === "youtubeDescription" && patched.descEdited === true) continue;
			const raw = patched[key];
			if (typeof raw !== "string" || !raw.trim()) continue;
			const stamped = alignActCopy(raw, act);
			if (stamped !== raw) {
				patched[key] = stamped;
				changed = true;
			}
		}
		return changed ? patched : body;
	}
	function screenPlaylist(body) {
		return body ?? null;
	}
	function refreshActPlaylist(gid, act) {
		if (getGenre(gid).kind === "distinct") return;
		if (readPref(gid).actPlaylist === false) return;
		const extraTracks = extrasAsEps(extras);
		const tracks = tracksForAct(act, extraTracks);
		if (tracks.length < 10) return;
		if (tracks.some((item) => !isConfirmed("single", gid, item.n))) return;
		void ensureActReady({ data: { genreId: gid, act } }).then((saved) => {
			if (!saved?.activated) return;
			if (genreIdRef.current !== gid) return;
			setFileActGenre(gid);
			setFileActs((cur) => cur.includes(act) ? cur : [...cur, act]);
			rememberActPreview(gid, act, saved.youtubeDescription || "", saved.youtubeUrl || "");
		}).catch(() => {});
	}
	function dropConfirm(kind, gid, id) {
		if (!isConfirmed(kind, gid, id)) return;
		writeConfirmed(kind, gid, id, false);
		setConfirmTick((n) => n + 1);
	}
	function keepSingle(n, next, show = true, gid = genreId, applyPref = true, allowConfirmed = false, rewrite = false, direct = false) {
		const id = padEp(n) || n;
		const sealed = isConfirmed("single", gid, id);
		if (!allowConfirmed && sealed) return rewrite ? false : true;
		const p = readPref(gid);
		const cur = gid === genreId && padEp(n) === padEp(epNRef.current) && padEp(pkgOwnerRef.current) === padEp(n) && pkgRef.current ? pkgRef.current : readCachedPackage(n, gid) ?? emptyStudio();
		const curFits = packageFitsSong(gid, id, cur);
		const pageLocks = curFits ? readLocks("single", id, gid) : {};
		const gate = lockPolicy().skipLocked ? pageLocks : {};
		next = takeLockedStudio(curFits ? cur : next, next, gate);
		if (applyPref && !sealed) {
			next = applyPrefToStudio(next, p, {
				epN: padEp(n) || n,
				lockedTitle: "",
				genreLabel: p.thumbGenreLine.trim() || getGenre(gid).youtubeLabel,
				genreId: gid
			}, gate);
			next = takeLockedStudio(curFits ? cur : next, next, gate);
		}
		if (!sealed) next = claimEp(next, id, gid);
		if (typeof next.ytPremium !== "boolean" && typeof cur.ytPremium === "boolean") next = { ...next, ytPremium: cur.ytPremium };
		if (typeof next.mvPremium !== "boolean" && typeof cur.mvPremium === "boolean") next = { ...next, mvPremium: cur.mvPremium };
		const saving = new Set(Array.isArray(next.savedKeys) ? next.savedKeys : []);
		if (!saving.has("youtubeUrl") && !next.youtubeUrl?.trim() && cur.youtubeUrl?.trim()) next = { ...next, youtubeUrl: cur.youtubeUrl };
		if (!saving.has("mvUrl") && !next.mvUrl?.trim() && cur.mvUrl?.trim()) next = { ...next, mvUrl: cur.mvUrl };
		if (!saving.has("sunoUrl") && next.sunoExact !== true && !next.sunoUrl?.trim() && cur.sunoUrl?.trim()) next = { ...next, sunoUrl: cur.sunoUrl };
		if (!saving.has("audioLevel") && next.levelExact !== true && !levelText(next.audioLevel) && levelText(cur.audioLevel)) next = { ...next, audioLevel: cur.audioLevel };
		if (!saving.has("audioAnalysis") && next.analysisExact !== true && !analysisText(next.audioAnalysis) && analysisText(cur.audioAnalysis)) next = { ...next, audioAnalysis: cur.audioAnalysis };
		const prevFit = readCachedPackage(n, gid);
		const adminDirect = Boolean(direct);
		const adminWrite = Boolean(adminDirect || (allowConfirmed && rewrite && sealed && isAdminDevice()));
		if (!adminDirect && hasPageBody(next) && !canKeepPackage(gid, id, prevFit, next)) {
			if (!adminWrite) return false;
		}
		const ok = writeCachedPackage(n, gid, next, Boolean(rewrite), true, adminWrite);
		if (!ok) return false;
		const stored = readCachedPackage(n, gid) ?? next;
		if (show || padEp(n) === padEp(epNRef.current)) {
			pkgEp.current = id;
			pkgOwnerRef.current = id;
			pkgRef.current = stored;
			setPkgOwner(id);
			setPkg(stored);
		}
		if (!ok) setError("이 페이지를 기기에 못 남겼습니다. 빌드 페이지로는 올립니다.");
		if (show) writeGenreSlot(gid, n, actFromEp(n));
		if (!hasPageBody(next)) {
			if (show || padEp(n) === padEp(epNRef.current)) setSavedSnap("");
			return ok;
		}
		if (show || padEp(n) === padEp(epNRef.current)) setSavedSnap(snapOf(next));
		if (gid === genreId) setSavedEps((cur) => cur.includes(n) ? cur : [...cur, n]);
		void flushAppPagesNow();
		refreshActPlaylist(gid, actFromEp(n));
		return ok;
	}
	useEffect(() => {
		if (!booted || !encyclopediaReady || !genrePicked || getGenre(genreId).kind === "distinct") return;
		for (const item of visibleActs) refreshActPlaylist(genreId, item.n);
	}, [confirmTick, genreId, booted, genrePicked, encyclopediaReady, visibleActs, extras, pref.actPlaylist]);
	function keepPlaylist(next, show = true, act = actN, gid = genreId, rewrite = false, assemble = true) {
		const p = readPref(gid);
		const cur = playlistRef.current && gid === genreId && act === actN ? playlistRef.current : readCachedPlaylist(act, gid) ?? emptyPlaylist();
		const pageLocks = {
			...readLocks("playlist", String(act), gid),
			...gid === genreId && act === actN ? locksLive.current : {}
		};
		next = takeLockedPlaylist(cur, next, pageLocks);
		const saving = new Set(Array.isArray(next.savedKeys) ? next.savedKeys : []);
		if (!saving.has("youtubeUrl") && !next.youtubeUrl?.trim() && cur.youtubeUrl?.trim()) next = { ...next, youtubeUrl: cur.youtubeUrl };
		if (!saving.has("mvUrl") && !next.mvUrl?.trim() && cur.mvUrl?.trim()) next = { ...next, mvUrl: cur.mvUrl };
		if (!saving.has("sunoUrl") && next.sunoExact !== true && !next.sunoUrl?.trim() && cur.sunoUrl?.trim()) next = { ...next, sunoUrl: cur.sunoUrl };
		if (!saving.has("audioLevel") && next.levelExact !== true && !levelText(next.audioLevel) && levelText(cur.audioLevel)) next = { ...next, audioLevel: cur.audioLevel };
		if (!saving.has("audioAnalysis") && next.analysisExact !== true && !analysisText(next.audioAnalysis) && analysisText(cur.audioAnalysis)) next = { ...next, audioAnalysis: cur.audioAnalysis };
		if (typeof next.ytPremium !== "boolean" && typeof cur.ytPremium === "boolean") next = { ...next, ytPremium: cur.ytPremium };
		if (typeof next.mvPremium !== "boolean" && typeof cur.mvPremium === "boolean") next = { ...next, mvPremium: cur.mvPremium };
		const confirmedList = isConfirmed("playlist", gid, String(act));
		if (assemble && !confirmedList) {
		if (!p.community && !isLocked(pageLocks, "community")) next = {
			...next,
			communityPost: ""
		};
		const out = p.actOutput ?? p.output;
		const ownedTracks = next.tracklistEdited === true;
		const songLines = !ownedTracks && !isLocked(pageLocks, "tracks") ? actSongLines(gid, act) : "";
		if (songLines) next = { ...next, tracklist: songLines };
		const timed = ownedTracks ? String(next.tracklist || "").replace(/\r\n/g, "\n").trim() : asTimedTracklist(next.tracklist || "");
		if (timed || ownedTracks) next = { ...next, tracklist: timed };
		if (out?.summary === false && !isLocked(pageLocks, "summary")) next = { ...next, summary: "" };
		if (out?.title === false && !isLocked(pageLocks, "title")) next = { ...next, confirmedTitle: "" };
		if (out?.suno === false && !isLocked(pageLocks, "suno")) next = { ...next, sunoStyle: "" };
		if (out?.thumb === false && !isLocked(pageLocks, "thumb")) next = { ...next, geminiPrompt: "" };
		if (out?.ytTitle === false && !isLocked(pageLocks, "yt-title")) next = { ...next, youtubeTitle: "" };
		if (out?.ytDesc === false && !isLocked(pageLocks, "yt-desc") && next.descEdited !== true) next = { ...next, youtubeDescription: "" };
		else if (!isLocked(pageLocks, "yt-desc") && next.descEdited !== true) next = {
			...next,
			youtubeDescription: descriptionWithTracklist(next.youtubeDescription || "", timed)
		};
		if (out?.letter === false && !isLocked(pageLocks, "community")) next = { ...next, communityPost: "" };
		}
		next = takeLockedPlaylist(cur, next, pageLocks);
		if (show && act === actN && gid === genreId) setLocks((prev) => ({
			...pageLocks,
			...prev
		}));
		const ok = writeCachedPlaylist(act, gid, next, true, Boolean(rewrite));
		rememberActPreview(gid, act, next.youtubeDescription || "", next.youtubeUrl || "");
		const screen = { ...next };
		delete screen.savedKeys;
		delete screen.blankFields;
		if (show && act === actN && gid === genreId) {
			playlistActRef.current = act;
			playlistRef.current = screen;
			setPlaylist(screen);
		}
		if (!ok) setError("이 페이지를 기기에 못 남겼습니다. 빌드 페이지로는 올립니다.");
		if (show) writeGenreSlot(gid, "", act);
		if (!hasPlaylistBody(next)) {
			if (show && act === actN) setSavedSnap("");
			return ok;
		}
		if (show && act === actN && gid === genreId) setSavedSnap(snapOf(next));
		void flushAppPagesNow();
		return ok;
	}
	async function generateSongPage(gid, n, mode, cast) {
		const id = padEp(n) || n;
		const orig = sourceFor(gid, id);
		const p = readPref(gid);
		const usedCast = getGenre(gid).kind === "original" ? thumbCastFromVocal(orig?.vocal || "") : cast || defaultThumbCast(gid);
		dropConfirm("single", gid, id);
		try {
			const result = await generatePackage({ data: {
				epN: id,
				genreId: gid,
				originalLyrics: orig?.lyrics || "",
				originalTitle: orig?.title || "",
				vocal: orig?.vocal || "",
				prefs: p,
				thumbCast: usedCast,
				skipThumb: true
			} });
			if (!result?.ok) return {
				ok: false,
				error: String(result?.error || "만들지 못했습니다."),
				retryAfter: result?.retryAfter
			};
			const cur = ownBody(readCachedPackage(id, gid), id, gid) ?? emptyStudio();
			const weakIds = auditStudioFields(gid, hasPageBody(cur) ? cur : null, void 0, id).filter((field) => field.kind !== "ok").map((field) => field.id);
			keepSingle(id, mode === "replace" ? result.pkg : mode === "weak" ? weakIds.length ? patchStudioFields(cur, result.pkg, weakIds) : cur : mergeStudio(cur, result.pkg), false, gid, true, false, true);
			await flushAppPagesNow();
			return result;
		} catch (err) {
			return {
				ok: false,
				error: (err instanceof Error ? err.message.trim() : "") || "연결이 끊겼거나 시간이 초과되었습니다"
			};
		}
	}
	async function repairNextField(gid, n) {
		const id = padEp(n) || n;
		const orig = sourceFor(gid, id);
		let cur = ownBody(readCachedPackage(id, gid), id, gid) ?? emptyStudio();
		const audit = auditStudioFields(gid, hasPageBody(cur) ? cur : null, void 0, id);
		const mode = fillModeRef.current;
		const skip = fillSkipFields.current.get(`${gid}:${id}`);
		const matches = (field, pkgNow) => {
			if (!field || skip?.has(field.id)) return false;
			if (mode === "review") return reviewIdsRef.current.has(field.id);
			if (field.kind === "ok") return false;
			if (mode === "empty") return field.kind === "empty";
			if (mode === "rough") return field.kind === "sloppy";
			return true;
		};
		const weak = byFillLead(audit.filter((field) => matches(field, cur)));
		if (!weak.length) {
			setFillFocus(null);
			return {
				ok: true,
				done: true,
				field: "",
				action: ""
			};
		}
		const field = weak[0];
		if (field.id === "lyrics") {
			const raw = String(cur.lyricsBlock || "");
			const peeled = stripProductionCommands(raw);
			if (peeled && peeled !== raw.trim()) {
				cur = { ...cur, lyricsBlock: peeled };
				keepSingle(id, cur, false, gid, true, false, true);
				await flushAppPagesNow();
			}
		}
		const requestOnly = fillRequestOnlyRef.current;
		const fix = requestOnly ? "request" : mode === "rough" ? "rewrite" : field.kind === "empty" ? "empty" : fieldFix(cur, field.id);
		markFillField(field.id, "work", field.label, id, fix === "request" ? "request" : fix === "empty" ? "empty" : fix === "revise" ? "revise" : "rewrite");
		const prefs = readPref(gid);
		const spoken = field.id === "summary" || field.id === "title" || field.id === "lyrics" || field.id === "yt-title" || field.id === "yt-desc" || field.id === "letter";
		const ruleBit = spoken ? `\n언어 규칙: ${prefs.langRule || "주사용 언어로 쓴다."}${field.id === "title" ? `\n제목 규칙: ${prefs.titleModeRule || ""}` : ""} 규칙과 다른 글은 실패다.` : "";
		const base = fix === "request" ? "이 칸은 기준을 통과했다. 사용자 요구사항이 이 칸에 해당하면 그 부분만 고친다. 해당하지 않으면 현재 글을 그대로 유지한다. 다른 칸은 유지." : fix === "empty" ? "이 항목만 비어 있다. 다른 항목은 유지하고 이 칸만 처음부터 완성본을 작성." : fix === "rewrite" ? "이 항목은 규칙에 맞지 않다. 현재값은 버리고 처음부터 다시 작성. 다른 항목은 유지." : "이 항목은 이미 만들어져 있으나 부실하다. 현재 글을 버리지 말고 부족한 부분만 보완해서 완성한다. 잘 된 문장과 구조는 유지. 다른 항목은 유지.";
		const ask = fillNoteRef.current.trim();
		const note = `${ask ? `${base}\n사용자 요구사항: ${ask}` : base}${ruleBit}`;
		const result = await generateBlock({ data: {
			kind: "single",
			epN: id,
			genreId: gid,
			blockId: field.id,
			note,
			originalLyrics: orig?.lyrics || "",
			originalTitle: orig?.title || "",
			vocal: orig?.vocal || "",
			prefs,
			single: cur,
			skipThumb: true
		} }).catch((err) => ({
			ok: false,
			error: (err instanceof Error ? err.message.trim() : "") || "연결이 끊겼거나 시간이 초과되었습니다"
		}));
		if (!result?.ok || result.kind !== "single") {
			const err = String(result && "error" in result ? result.error : "항목을 만들지 못했습니다.");
			return {
				ok: false,
				done: false,
				field: field.label,
				action: fix,
				error: err,
				retryAfter: result && "retryAfter" in result ? result.retryAfter : void 0
			};
		}
		const patched = patchStudioFields(cur, result.pkg, [field.id]);
		const blockKey = STUDIO_BLOCKS.find((block) => block.id === field.id)?.key;
		const before = blockKey ? String(cur[blockKey] ?? "").trim() : "";
		const wrote = blockKey ? String(result.pkg?.[blockKey] ?? "").trim() : "";
		const tryKey = `${gid}:${id}:${field.id}`;
		const usedTry = () => {
			const n = (fillTries.current.get(tryKey) || 0) + 1;
			fillTries.current.set(tryKey, n);
			return n;
		};
		const againLater = () => ({
			ok: true,
			retry: true,
			done: false,
			field: field.label,
			action: fix
		});
		const giveUp = () => {
			const set = fillSkipFields.current.get(`${gid}:${id}`) ?? new Set();
			set.add(field.id);
			fillSkipFields.current.set(`${gid}:${id}`, set);
			fillTries.current.delete(tryKey);
			const left = auditStudioFields(gid, cur, void 0, id).some((item) => {
				if (set.has(item.id)) return false;
				if (mode === "empty") return item.kind === "empty";
				if (mode === "rough") return item.kind === "sloppy";
				if (mode === "review") return reviewIdsRef.current.has(item.id);
				return item.kind !== "ok";
			});
			return {
				ok: true,
				skipped: true,
				done: !left,
				field: field.label,
				action: fix
			};
		};
		const key = `${gid}:${id}`;
		const set = fillSkipFields.current.get(key) ?? new Set();
		const finish = (pkgNow) => {
			fillTries.current.delete(tryKey);
			set.add(field.id);
			fillSkipFields.current.set(key, set);
			const left = auditStudioFields(gid, pkgNow, void 0, id).some((item) => {
				if (set.has(item.id)) return false;
				if (mode === "empty") return item.kind === "empty";
				if (mode === "rough") return item.kind === "sloppy";
				if (mode === "review") return reviewIdsRef.current.has(item.id) && !set.has(item.id);
				return item.kind !== "ok";
			});
			return {
				ok: true,
				done: !left,
				field: field.label,
				action: fix
			};
		};
		if (!wrote || wrote === before || (field.id === "title" && titleOwnedByOtherEp(wrote, id))) {
			if (fix === "request") return finish(cur);
			if (usedTry() < 2) return againLater();
			return giveUp();
		}
		keepSingle(id, patched, false, gid, true, false, true);
		const saving = `${field.label} 저장 중 · EP.${id}`;
		setFillCurrent(saving);
		setFillTrack((cur) => cur?.current ? { ...cur, current: { ...cur.current, detail: saving, waitSec: 0 } } : cur);
		await flushAppPagesNow();
		const nextPkg = readCachedPackage(id, gid) ?? patched;
		const saved = blockKey ? String(nextPkg?.[blockKey] ?? "").trim() : wrote;
		if (!saved || saved === before) {
			if (fix === "request") return finish(cur);
			if (usedTry() < 2) return againLater();
			return giveUp();
		}
		const again = auditStudioFields(gid, nextPkg, void 0, id).find((item) => item.id === field.id);
		const settled = mode === "empty" ? again?.kind !== "empty" : mode === "rough" ? again?.kind !== "sloppy" : mode === "review" ? true : again?.kind === "ok";
		if (!settled) {
			if (usedTry() < 2) return againLater();
			return giveUp();
		}
		return finish(nextPkg);
	}
	async function fillEmptyPages() {
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 자동 채우기를 할 수 없습니다.");
			setFilling(false);
			fillingRef.current = false;
			return;
		}
		fillStop.current = true;
		const gen = fillGenRef.current + 1;
		fillGenRef.current = gen;
		fillClientRef.current = false;
		fillingRef.current = false;
		fillSkipFields.current = /* @__PURE__ */ new Map();
		fillTries.current = /* @__PURE__ */ new Map();
		await new Promise((r) => window.setTimeout(r, 40));
		if (fillGenRef.current !== gen) return;
		fillPausedRef.current = false;
		fillStop.current = false;
		fillResumeRef.current = false;
		try {
			sessionStorage.setItem("noa-fill-live", "1");
		} catch {}
		pauseFillWorker();
		persistQueue(null);
		const rows = fillRowsRef.current.slice();
		if (!rows.length) {
			fillingRef.current = false;
			fillClientRef.current = false;
			try {
				sessionStorage.removeItem("noa-fill-live");
			} catch {}
			setFillAsk(false);
			setFilling(false);
			setFillPaused(false);
			return;
		}
		fillingRef.current = true;
		fillClientRef.current = true;
		fillGenreRef.current = rows[0].genreId;
		setFillAsk(false);
		setFillPaused(false);
		setLimitUntil(0);
		setFilling(true);
		setBusy(false);
		setCastOpen(false);
		setFillErrors([]);
		setFillEvents([]);
		setFillDone(0);
		setFillTotal(rows.length);
		setFillCurrent(`항목 확인 · ${rows[0].label} EP.${rows[0].n} ${rows[0].title}`);
		setFillStall(false);
		async function waitForRestart() {
			fillResumeRef.current = false;
			setFillStall(true);
			dropFillWake();
			while (!fillStop.current && !fillResumeRef.current && fillGenRef.current === gen) await new Promise((r) => window.setTimeout(r, 250));
			setFillStall(false);
			setFillErrors([]);
			setLimitUntil(0);
			setLimitWait(0);
			setFillTrack((cur) => cur?.current ? {
				...cur,
				current: {
					...cur.current,
					waitSec: 0
				}
			} : cur);
			if (fillStop.current || fillGenRef.current !== gen) return false;
			if (navigator.onLine !== false) holdFillWake();
			return true;
		}
		const ownTitle = (row, title) => {
			const picked = title?.trim() || "";
			if (picked && !titleOwnedByOtherEp(picked, row.n)) return picked;
			const cached = readCachedPackage(row.n, row.genreId)?.confirmedTitle?.trim() || "";
			if (cached && !titleOwnedByOtherEp(cached, row.n)) return cached;
			return row.title;
		};
		const songName = (row, title) => `${row.label} EP.${row.n} ${ownTitle(row, title)}`;
		const unit = (row, status, stage, pct, title) => {
			const steps = fillSteps(row.genreId);
			return {
				name: songName(row, title),
				status,
				stage,
				step: status === "done" ? steps.length : stage,
				steps,
				pct,
				n: row.n,
				genreId: row.genreId,
				detail: ""
			};
		};
		const actWord = (fix) => fix === "empty" ? "생성" : fix === "rewrite" ? "재생성" : fix === "revise" ? "보완" : fix === "request" ? "요구" : "";
		const noteAct = (list, label, fix) => {
			const word = actWord(fix);
			if (!label || !word) return;
			const line = `${label} ${word}`;
			if (!list.includes(line)) list.push(line);
		};
		const doneLine = (target, acts) => {
			const pkg = readCachedPackage(target.n, target.genreId);
			const work = acts.length ? acts.join(", ") : "항목 확인";
			const pageSaved = hasPageBody(pkg) ? "저장됨" : "저장 안 됨";
			const ask = fillNoteRef.current.trim();
			const lead = fillRequestOnlyRef.current && ask ? `요구사항 · ${ask} · ` : "";
			if (fillModeRef.current !== "review") return `${work} · ${pageSaved}`;
			const checks = [...reviewIdsRef.current].map((id) => {
				const block = STUDIO_BLOCKS.find((item) => item.id === id);
				const text = block ? String(pkg?.[block.key] ?? "").trim() : "";
				return `${id} ${text ? "저장됨" : "저장 안 됨"}`;
			});
			return `${lead}${work} · 페이지 ${pageSaved}${checks.length ? ` · ${checks.join(", ")}` : ""}`;
		};
		let filled = 0;
		let failed = 0;
		let limitStreak = 0;
		let lastDone = null;
		const reports = [];
		const publish = () => {
			if (fillGenRef.current !== gen) return;
			fillingRef.current = false;
			fillClientRef.current = false;
			try {
				sessionStorage.removeItem("noa-fill-live");
			} catch {}
			setFilling(false);
			setFillPaused(false);
			setFillWorkN("");
			setFillFocus(null);
			setFillPeek(false);
			fillPeekRef.current = false;
			setFillReport({ filled, failed });
			setReportDetail(reports.join("\n"));
			setFillErrors([]);
			setFillCurrent("");
			setFillTrack(null);
			setFillStall(false);
			clearFillNotify();
		};
		for (let i = 0; i < rows.length; i++) {
			if (fillGenRef.current !== gen) return;
			if (fillStop.current || fillPausedRef.current) {
				fillingRef.current = false;
				fillClientRef.current = false;
				setFilling(false);
				setFillTrack(null);
				setFillStall(false);
				setFillWorkN("");
				setFillFocus(null);
				setFillPeek(false);
				fillPeekRef.current = false;
				if (auditFillTargets() > 0) {
					setFillAsk(true);
					setFillSkip(false);
				}
				setFillCurrent("");
				return;
			}
			const row = rows[i];
			placeSavedSong(row.genreId, row.n);
			const live = readCachedPackage(row.n, row.genreId);
			let page = live;
			const edited = new Set(live?.userEdited || []);
			if (!edited.has("title") && page?.confirmedTitle && titleOwnedByOtherEp(page.confirmedTitle, row.n)) page = { ...page, confirmedTitle: "" };
			const lyricHead = (page?.lyricsBlock || "").replace(/\s+/g, "").slice(0, 80);
			const sealedRow = isConfirmed("single", row.genreId, row.n);
			if (!sealedRow && !edited.has("lyrics") && lyricHead.length >= 40 && EPS.some((item) => {
				if (padEp(item.n) === padEp(row.n)) return false;
				const other = (getOriginal(item.n)?.lyrics || "").replace(/\s+/g, "");
				return other.length >= 40 && (other.includes(lyricHead) || lyricHead.includes(other.slice(0, 80)));
			})) page = { ...page, lyricsBlock: "" };
			if (page && page !== live && !sealedRow) keepSingle(row.n, page, false, row.genreId, false, true, true);
			const borrowed = sealedRow ? { pkg: page || live || emptyStudio(), cleared: [] } : clearBorrowedFields(row.genreId, row.n, page || live || emptyStudio());
			if (borrowed.cleared.length) {
				page = borrowed.pkg;
				keepSingle(row.n, page, false, row.genreId, false, true, true);
				say(`연결: EP.${row.n} ${borrowed.cleared.join(", ")}은 다른 곡 결과라 이 페이지에서만 지움`);
			}
			const orig = readOriginals().find((item) => padEp(item.n) === padEp(row.n));
			const modeNow = fillModeRef.current;
			const fieldsNow = auditStudioFields(row.genreId, live, void 0, row.n);
			const confirmedNow = isConfirmed("single", row.genreId, row.n);
			const needs = confirmedNow ? false : modeNow === "review" ? reviewIdsRef.current.size > 0 : modeNow === "rough" ? fieldsNow.some((field) => field.kind === "sloppy") : !hasPageBody(live) || fieldsNow.some((field) => field.kind === "empty");
			if (!needs) {
				setFillDone(i + 1);
				reports.push(`${songName(row, row.title)} · 건너뜀 · 이미 기준을 넘음`);
				continue;
			}
			const label = `항목 확인 · ${row.label} EP.${row.n} ${row.title}`;
			setFillCurrent(label);
			setFillDone(i);
			setFillErrors([]);
			setFillWorkN(row.n);
			const acts = [];
			const running = unit(row, "run", 0, 8);
			running.detail = label;
			setFillTrack({
				prev: null,
				current: running,
				next: null
			});
			followTask({
				kind: "single",
				n: row.n,
				genreId: row.genreId
			}, row.genreId);
			const usedCast = getGenre(row.genreId).kind === "original" ? thumbCastFromVocal(orig?.vocal || "") : defaultThumbCast(row.genreId);
			setThumbCast(usedCast);
			pushFill({
				label: `${row.label} EP.${row.n} ${row.title}`,
				state: "run",
				reason: "항목별 확인"
			});
			await new Promise((r) => window.setTimeout(r, 320));
			const pulse = window.setInterval(() => {
				setFillTrack((cur) => {
					if (!cur?.current || cur.current.status !== "run") return cur;
					const elapsed = (cur.current.elapsed || 0) + 1;
					const base = String(cur.current.detail || "").replace(/ · \d+초$/, "");
					const detail = `${base} · ${elapsed}초`;
					return {
						...cur,
						current: {
							...cur.current,
							elapsed,
							pct: Math.min(92, (cur.current.pct || 8) + 1),
							detail
						}
					};
				});
			}, 1e3);
			let ok = false;
			let passes = 0;
			let songFail = "";
			let halted = false;
			try {
				while (!ok && passes < 40 && fillGenRef.current === gen && !fillStop.current && !fillPausedRef.current) {
					setFillErrors([]);
					let liveNow = readCachedPackage(row.n, row.genreId) ?? emptyStudio();
					const prefsNow = readPref(row.genreId);
					const rankNow = fillRank(row.genreId, liveNow, orig, false, row.n);
					let result;
					if (passes === 0 && fillModeRef.current === "empty" && rankNow === 1) {
						const weakNow = byFillLead(auditStudioFields(row.genreId, liveNow, void 0, row.n).filter((field) => field.kind !== "ok"));
						const ids = weakNow.map((field) => field.id);
						fillMarksRef.current = ids.length > 1 ? ids : [];
						setFillMarks(fillMarksRef.current);
						const first = weakNow[0];
						if (first) {
							noteAct(acts, first.label, first.kind === "empty" ? "empty" : fieldFix(liveNow, first.id));
							markFillField(first.id, "work", first.label, row.n, first.kind === "empty" ? "empty" : "sloppy");
						}
						const whole = `곡 전체 작성 중 · ${row.label} EP.${row.n} ${ownTitle(row, row.title)}`;
						setFillCurrent(whole);
						setFillTrack((cur) => cur?.current ? { ...cur, current: { ...cur.current, detail: whole, pct: Math.max(cur.current.pct || 0, 12), waitSec: 0 } } : cur);
						const packed = await generateSongPage(row.genreId, row.n, "weak", usedCast);
						if (fillGenRef.current !== gen) return;
						const savedPage = readCachedPackage(row.n, row.genreId);
						if (packed.ok && hasPageBody(savedPage)) result = {
							ok: true,
							done: true,
							field: ""
						};
						else if (!packed.ok) result = {
							ok: false,
							done: false,
							field: "",
							error: packed.error,
							retryAfter: packed.retryAfter
						};
						else result = {
							ok: false,
							done: false,
							field: "",
							error: "페이지가 비어 있습니다"
						};
						fillMarksRef.current = [];
						setFillMarks([]);
					} else {
						const nextField = byFillLead(auditStudioFields(row.genreId, liveNow, void 0, row.n).filter((field) => field.kind !== "ok"))[0];
						if (nextField && !fillRequestOnlyRef.current) noteAct(acts, nextField.label, nextField.kind === "empty" ? "empty" : fieldFix(liveNow, nextField.id));
						try {
							result = await repairNextField(row.genreId, row.n);
						} catch (err) {
							result = {
								ok: false,
								done: false,
								field: "",
								error: (err instanceof Error ? err.message.trim() : "") || "연결이 끊겼거나 시간이 초과되었습니다"
							};
						}
						if (fillRequestOnlyRef.current && result?.field) noteAct(acts, result.field, "request");
					}
					if (fillGenRef.current !== gen) return;
					if (result?.retry || (result?.skipped && !result.done)) {
						passes += 1;
						continue;
					}
					if (result?.skipped && result.done) {
						passes += 1;
						songFail = "규칙에 맞게 바뀌지 않은 칸은 넘겼습니다";
						break;
					}
					if (result.ok && !result.done) {
						passes += 1;
						continue;
					}
					passes += 1;
					if (result.ok && result.done) {
						ok = true;
						filled += 1;
						limitStreak = 0;
						setFillErrors([]);
						const doneTitle = readCachedPackage(row.n, row.genreId)?.confirmedTitle?.trim() || row.title;
						lastDone = unit(row, "done", 6, 100, doneTitle);
						lastDone.detail = doneLine(row, acts);
						reports.push(`${songName(row, doneTitle)} · ${lastDone.detail}`);
						pushFill({
							label: songName(row, doneTitle),
							state: "ok",
							reason: "저장됨"
						});
						setFillCurrent(`성공 · ${songName(row, doneTitle)}`);
						setFillTrack((cur) => cur?.current ? {
							...cur,
							current: {
								...lastDone,
								status: "done",
								step: lastDone.steps.length,
								pct: 100
							}
						} : cur);
						await new Promise((r) => window.setTimeout(r, 280));
						break;
					}
					const reason = koreanFillError(!result.ok ? result.error : "만들지 못했습니다.");
					if (!result.ok && (result.error.includes("한도") || Boolean(result.retryAfter))) {
						songFail = "그록 생성 한도. 이후 곡은 호출하지 않음";
						halted = true;
						setFillErrors([]);
						dropFillWake();
						setFillCurrent(`그록 생성 한도. 같은 곡을 다시 호출하지 않고 멈춤 · EP.${row.n}`);
						pushFill({
							label: `${row.label} EP.${row.n}`,
							state: "wait",
							reason: "한도. 반복 호출을 멈춤"
						});
						fillStop.current = true;
						break;
					}
					limitStreak = 0;
					songFail = reason;
					setFillErrors([]);
					pushFill({
						label: `${row.label} EP.${row.n}`,
						state: "wait",
						reason
					});
					setFillCurrent(`멈춤 · EP.${row.n} · ${reason}`);
					break;
				}
			} finally {
				window.clearInterval(pulse);
			}
			if (!ok && fillGenRef.current === gen && !fillPausedRef.current) {
				failed += 1;
				const why = songFail || (passes >= 40 ? "항목을 다 채우지 못했습니다" : "기준을 못 채워 저장하지 않음");
				reports.push(`${songName(row, row.title)} · 실패 · ${why}`);
				pushFill({
					label: `${row.label} EP.${row.n}`,
					state: "wait",
					reason: why
				});
				setFillCurrent(`실패 · ${row.label} EP.${row.n} ${row.title}`);
			}
			setFillDone(i + 1);
			setSavedEps(readSavedEps(row.genreId));
			if (halted) {
				for (let j = i + 1; j < rows.length; j++) {
					failed += 1;
					reports.push(`${songName(rows[j], rows[j].title)} · 실패 · 한도로 처리하지 못함`);
				}
				publish();
				return;
			}
		}
		publish();
	}
	async function hydratePage(_kind, _n = "") {
		return;
	}
	function toggleLock(id) {
		if (masterLocked()) {
			setError("메인 자물쇠가 잠겨 있어 잠그거나 풀 수 없습니다.");
			return;
		}
		if (pageConfirmed && !isAdminDevice()) {
			setError("확정된 결과는 최고관리자만 고칩니다.");
			return;
		}
		isSingle ? String(pkg ? {
			summary: pkg.summary,
			title: pkg.confirmedTitle,
			lyrics: pkg.lyricsBlock,
			suno: pkg.sunoStyle,
			thumb: pkg.geminiPrompt,
			"yt-title": pkg.youtubeTitle,
			"yt-desc": pkg.youtubeDescription,
			letter: pkg.fanLetter
		}[id] ?? "" : "") : String(playlist ? {
			summary: playlist.summary,
			tracks: playlist.tracklist,
			thumb: playlist.geminiPrompt,
			"yt-title": playlist.youtubeTitle,
			"yt-desc": playlist.youtubeDescription,
			community: playlist.communityPost
		}[id] ?? "" : "");
		const next = {
			...locks,
			[id]: !isLocked(locks, id)
		};
		setLocks(next);
		writeLocks(isSingle ? "single" : "playlist", lockId, genreId, next);
	}
	async function onGenerate(cast = thumbCast, mode = "fill") {
		if (busy) return;
		if (pageConfirmed && !isAdminDevice()) {
			setError("확정된 결과는 최고관리자만 다시 만듭니다.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			if (isKpop && (isSingle || kpopMode === "compose")) {
				if (kpopMode === "browse") {
					const n = padEp(epN);
					if (!isEpNumber(n) || !origDraft.title.trim()) {
						setError("열람에서 EP를 고르고 제목을 확인하세요.");
						return;
					}
					persistOriginal({
						n,
						title: origDraft.title.trim(),
						vocal: origDraft.vocal,
						lyrics: origDraft.lyrics
					});
					setExtras(readOriginals());
					const usedCast = genre.kind === "original" ? thumbCastFromVocal(origDraft.vocal) : cast;
					setThumbCast(usedCast);
					const result = await generatePackage({ data: {
						epN: n,
						genreId,
						originalLyrics: origDraft.lyrics,
						originalTitle: origDraft.title.trim(),
						vocal: origDraft.vocal,
						prefs: pref,
						thumbCast: usedCast,
						skipThumb: true
					} });
					if (!result.ok) {
						setError(koreanFillError(result.error));
						return;
					}
					setKind("single");
					keepSingle(n, mode === "fill" ? mergeStudio(ownBody(readCachedPackage(n, genreId), n) ?? emptyStudio(), result.pkg) : result.pkg, true, genreId, true, pageConfirmed, pageConfirmed);
					await flushAppPagesNow();
				} else {
					const n = padEp(kpopDraft.ep || epN);
					if (!isEpNumber(n) || !kpopDraft.title.trim()) {
						setError("EP 번호와 제목을 입력하세요.");
						return;
					}
					persistOriginal({
						n,
						title: kpopDraft.title.trim(),
						vocal: kpopDraft.vocal,
						lyrics: kpopDraft.lyrics
					});
					setExtras(readOriginals());
					setActN(actFromEp(n));
					setEpN(n);
					const usedCast = genre.kind === "original" ? thumbCastFromVocal(kpopDraft.vocal) : cast;
					setThumbCast(usedCast);
					const result = await generatePackage({ data: {
						epN: n,
						genreId,
						originalLyrics: kpopDraft.lyrics,
						originalTitle: kpopDraft.title.trim(),
						vocal: kpopDraft.vocal,
						prefs: pref,
						thumbCast: usedCast,
						skipThumb: true
					} });
					if (!result.ok) {
						setError(koreanFillError(result.error));
						return;
					}
					setKind("single");
					keepSingle(n, mode === "fill" ? mergeStudio(ownBody(readCachedPackage(n, genreId), n) ?? emptyStudio(), result.pkg) : result.pkg, true, genreId, true, pageConfirmed, pageConfirmed);
					await flushAppPagesNow();
				}
			} else if (isSingle) {
				const n = padEp(epN) || epN;
				const orig = sourceFor(genreId, n);
				const usedCast = genre.kind === "original" ? thumbCastFromVocal(orig?.vocal || origDraft.vocal) : cast;
				setThumbCast(usedCast);
				const result = await generatePackage({ data: {
					epN: n,
					genreId,
					originalLyrics: orig?.lyrics || "",
					originalTitle: orig?.title || "",
					vocal: orig?.vocal || origDraft.vocal || "",
					prefs: pref,
					thumbCast: usedCast,
					skipThumb: true
				} });
				if (!result.ok) {
					setError(koreanFillError(result.error));
					return;
				}
				setKind("single");
				keepSingle(n, mode === "fill" ? mergeStudio(ownBody(readCachedPackage(n, genreId), n) ?? emptyStudio(), result.pkg) : result.pkg, true, genreId, true, pageConfirmed, pageConfirmed);
				await flushAppPagesNow();
			} else {
				const result = await generatePlaylist({ data: {
					act: actN,
					genreId,
					extraTracks: namedActTracks(genreId, actN),
					prefs: pref,
					thumbCast: cast,
					skipThumb: true
				} });
				if (!result.ok) {
					setError(koreanFillError(result.error));
					return;
				}
				setKind("playlist");
				keepPlaylist(mode === "fill" ? mergePlaylist(playlistRef.current ?? emptyPlaylist(), result.pkg) : result.pkg, true, actN, genreId, true);
				void flushAppPagesNow();
			}
		} catch {
			setError("만들지 못했습니다.");
		} finally {
			setBusy(false);
		}
	}
	function requestGenerate(mode = "fill") {
		if (busy || fillingRef.current) {
			setError("지금 다른 작업 중이라 만들지 않습니다.");
			return;
		}
		pendingGenMode.current = mode;
		followPressed("");
		onGenerate(thumbCast, mode);
	}
	function saveThumbCast() {
		if (epN && pkg) keepSingle(padEp(epN) || epN, {
			...pkg,
			thumbCast
		}, true, genreId, false, true, true, true);
		else if (!epN && playlist) keepPlaylist({
			...playlist,
			thumbCast
		});
	}
	function confirmCast() {
		setCastOpen(false);
		onGenerate(thumbCast, pendingGenMode.current);
	}
	useEffect(() => {
		if (!ready || !regenTick) return;
		onGenerate();
	}, [regenTick]);
	async function onRegen(blockId, note) {
		if (note === "취소" || busyBlock === blockId) {
			cancelRegen();
			if (fillingRef.current || filling) {
				fillStop.current = true;
				fillResumeRef.current = false;
				fillPausedRef.current = false;
				fillingRef.current = false;
				fillClientRef.current = false;
				setFillPaused(false);
				setFilling(false);
				setBusy(false);
				setFillCurrent("");
				setFillTrack(null);
				setFillStall(false);
				setFillWorkN("");
				setFillFocus(null);
				setFillPeek(false);
				fillPeekRef.current = false;
				try {
					sessionStorage.removeItem("noa-fill-live");
				} catch {}
				persistQueue(null);
			}
			return;
		}
		if (busyBlock) {
			setError("다른 칸을 쓰는 중입니다. 그 칸에서 취소를 누르세요.");
			return;
		}
		followPressed(blockId);
		if (pageConfirmed && !isAdminDevice()) {
			setError("확정된 결과는 최고관리자만 고칩니다.");
			return;
		}
		const playlistNow = !isSingle ? shownPlaylist || playlist : null;
		if (!isSingle && !playlistNow) {
			onGenerate(thumbCast, "replace");
			return;
		}
		if (isLocked(locks, blockId)) {
			const nextLocks = { ...locks, [blockId]: false };
			setLocks(nextLocks);
			writeLocks(isSingle ? "single" : "playlist", isSingle ? padEp(epN) || epN : String(actN), genreId, nextLocks);
		}
		if (!isSingle) {
			const run = armRegen(blockId);
			try {
				const result = await generateBlock({ data: {
					kind: "playlist",
					act: actN,
					genreId,
					blockId,
					note,
					extraTracks: namedActTracks(genreId, actN),
					prefs: pref,
					playlist: playlistNow,
					skipThumb: true
				}, signal: run.signal });
				if (!regenStill(run.job)) return;
				if (!result?.ok || result.kind !== "playlist") {
					const err = koreanFillError(String(result?.error || ""));
					setError(err.includes("시간") ? "시간이 초과되었습니다. 있던 글은 그대로 둡니다." : err);
					return;
				}
				const plKey = PLAYLIST_BLOCKS.find((block) => block.id === blockId)?.key;
				const plWrote = plKey ? String(result.pkg?.[plKey] || "").trim() : "";
				if (!plWrote) {
					setError("이 칸이 비어 저장하지 않았습니다. 있던 글은 그대로 둡니다.");
					return;
				}
				forgetFieldDraft(pageKey, blockId);
				const kept = keepPlaylist(result.pkg);
				if (!kept) return;
				say(`생성: ACT.${actN} 항목을 이 페이지에 반영`);
			} catch (err) {
				if (!regenStill(run.job)) return;
				setError(koreanFillError(err instanceof Error ? err.message : ""));
			} finally {
				if (regenStill(run.job)) {
					regenAbort.current = null;
					setBusyBlock(null);
				}
			}
			return;
		}
		const songId = padEp(epN) || epN;
		const run = armRegen(blockId);
		const resolveFitting = async () => {
			const own = (body) => body && hasPageBody(body) ? body : null;
			const liveOwned = padEp(pkgOwnerRef.current) === songId || padEp(pkgEp.current) === songId;
			const live = liveOwned ? own(pkgRef.current) : null;
			if (live) return live;
			const cached = own(readCachedPackage(songId, genreId));
			if (cached) return cached;
			try {
				const file = plainServer(await readResultFile({ data: { kind: "song", genreId, ep: songId, act: actFromEp(songId), title: "" } }));
				const fields = file && file.fields;
				if (fields) {
					const body = own({ ...emptyStudio(), ...fields });
					if (body) return body;
				}
			} catch {}
			return null;
		};
		const base = await resolveFitting();
		if (!regenStill(run.job)) return;
		const prefsNow = readPref(genreId);
		if (!base && blockId !== "lyrics" && blockId !== "title") {
			setError("이 곡 결과가 없습니다. 확정 제목과 가사를 먼저 채운 뒤 이 칸을 다시 쓰세요.");
			regenAbort.current = null;
			setBusyBlock(null);
			return;
		}
		const seed = base ?? emptyStudio();
		try {
			const result = await generateBlock({ data: {
				kind: "single",
				epN: songId,
				genreId,
				blockId,
				note,
				originalLyrics: sourceFor(genreId, epN).lyrics,
				originalTitle: sourceFor(genreId, epN).title,
				vocal: sourceFor(genreId, epN).vocal,
				prefs: pref,
				single: seed,
				skipThumb: true
			}, signal: run.signal });
			if (!regenStill(run.job)) return;
			if (!result?.ok || result.kind !== "single" || !result.pkg) {
				const err = koreanFillError(String(result?.error || ""));
				setError(err.includes("시간") ? "시간이 초과되었습니다. 있던 글은 그대로 둡니다." : err);
				return;
			}
			const patched = patchStudioFields(seed, result.pkg, [blockId]);
			if (blockId === "lyrics" && prefsNow.descLyrics && String(result.pkg.youtubeDescription || "").trim()) {
				patched.youtubeDescription = result.pkg.youtubeDescription;
			}
			const key = STUDIO_BLOCKS.find((block) => block.id === blockId)?.key;
			const wrote = key ? String(patched[key] || "").trim() : "";
			const before = key ? String(seed[key] || "").trim() : "";
			if (!wrote) {
				setError("이 칸이 비어 저장하지 않았습니다. 있던 글은 그대로 둡니다.");
				return;
			}
			forgetFieldDraft(pageKey, blockId);
			const moodSlot = (text) => {
				const parts = String(text || "").split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
				return parts.length >= 3 ? parts[2] : "";
			};
			if (blockId === "yt-title" && moodSlot(wrote) && moodSlot(wrote) === moodSlot(before)) {
				setError("감성 한줄이 바뀌지 않아 저장하지 않았습니다. 있던 글은 그대로 둡니다.");
				return;
			}
			const edited = (seed.userEdited || []).filter((item) => item !== blockId);
			const next = { ...patched, userEdited: edited };
			const held = readLocks("single", songId, genreId);
			if (held[blockId]) writeLocks("single", songId, genreId, { ...held, [blockId]: false });
			const reason = keepBlockReason(genreId, songId, base, next);
			if (reason) {
				setError(reason);
				return;
			}
			const saved = keepSingle(songId, next, true, genreId, false, true, true, true);
			if (!saved) {
				const why = keepBlockReason(genreId, songId, base, next);
				if (why) setError(why);
				return;
			}
			if (wrote === before) setError("다시 썼지만 글이 그대로입니다. 있던 글은 그대로 둡니다.");
			else say(`생성: EP.${songId} 항목을 이 페이지에 반영`);
		} catch (err) {
			if (!regenStill(run.job)) return;
			setError(koreanFillError(err instanceof Error ? err.message : ""));
		} finally {
			if (regenStill(run.job)) {
				regenAbort.current = null;
				setBusyBlock(null);
			}
		}
	}
	function renamePlaylistCopies(gid, ep, from, to) {
		const prev = from.trim();
		const nextTitle = to.trim();
		if (!prev || !nextTitle || prev === nextTitle) return false;
		const act = actFromEp(ep);
		if (!act) return false;
		if (isConfirmed("playlist", gid, String(act))) return false;
		const cur = readCachedPlaylist(act, gid);
		if (!cur) return false;
		const locks = readLocks("playlist", String(act), gid);
		const fields = [
			["summary", "summary"],
			["confirmedTitle", "title"],
			["sunoStyle", "suno"],
			["geminiPrompt", "thumb"],
			["youtubeTitle", "yt-title"],
			["youtubeDescription", "yt-desc"],
			["communityPost", "community"],
			["tracklist", "tracks"],
		];
		const next = { ...cur };
		let changed = false;
		for (const [key, lockId] of fields) {
			if (locks[lockId] === true) continue;
			if (key === "tracklist" && cur.tracklistEdited === true) continue;
			if (key === "youtubeDescription" && cur.descEdited === true) continue;
			const raw = String(next[key] || "");
			const swapped = replaceExactTitle(raw, prev, nextTitle);
			if (swapped === raw) continue;
			next[key] = swapped;
			changed = true;
		}
		if (!changed) return false;
		const viewing = gid === genreId && act === actN && !padEp(epNRef.current);
		keepPlaylist(next, viewing, act, gid, true);
		return true;
	}
	function dropFieldLocks(kind, id) {
		const cur = readLocks(kind, id, genreId);
		if (Object.values(cur).some((flag) => flag === true)) writeLocks(kind, id, genreId, {});
		setLocks({});
	}
	function onPatch(id, text) {
		followPressed(id);
		if (isLocked(locks, id)) {
			const nextLocks = { ...locks, [id]: false };
			locksLive.current = nextLocks;
			setLocks(nextLocks);
			writeLocks(epN ? "single" : "playlist", epN ? padEp(epN) || epN : String(actN), genreId, nextLocks);
		}
		if (epN) {
			const live = pkgRef.current ?? emptyStudio();
			const cached = readCachedPackage(epN, genreId);
			const liveOk = packageFitsSong(genreId, epN, live);
			const cachedOk = Boolean(cached && packageFitsSong(genreId, epN, cached));
			const base = liveOk ? live : cachedOk && cached ? cached : live;
			const prevTitle = id === "title" ? String(base.confirmedTitle || "") : "";
			const next = patchStudio(base, id, text);
			if (!next) return "이 칸을 저장하지 못했습니다.";
			const titled = id === "title" && !pageConfirmed ? renameStudioTitleCopies(next, prevTitle, text) : next;
			const edited = [...new Set([...(titled.userEdited || []), id])];
			const fieldKey = DRAFT_PANE_KEY[id];
			if (!fieldKey) return "이 칸을 저장하지 못했습니다.";
			const blankFields = !String(text || "").trim() ? [fieldKey] : undefined;
			const savedKeys = [fieldKey];
			if (id === "title") {
				for (const key of Object.values(DRAFT_PANE_KEY)) {
					if (savedKeys.includes(key)) continue;
					if (String(titled[key] ?? "") !== String(base[key] ?? "")) savedKeys.push(key);
				}
			}
			pinScreenHold();
			const intent = exactLinkPatch();
			try {
				keepSingle(padEp(epN) || epN, { ...titled, userEdited: edited, ...intent.patch, ...(blankFields ? { blankFields } : {}), savedKeys, baseRev: paneRev.current }, true, genreId, false, true, true, true);
			} catch {
				/* 화면 메모리가 끊겨도 파일 저장은 이어서 한다 */
			}
			const idNow = padEp(epN) || epN;
			const cellFields = {};
			for (const key of savedKeys) cellFields[key] = String(titled[key] ?? "");
			void (async () => {
				try { await flushAppPagesNow(); } catch { /* 칸 저장이 마지막이다 */ }
				try {
					const saved = plainServer(await saveResultFields({ data: { kind: "song", genreId, ep: idNow, act: actN, title: "", fields: cellFields, blank: savedKeys.some((key) => !String(cellFields[key] ?? "").trim()), rev: paneRev.current } }));
					if (saved && saved.ok === false && saved.error !== "conflict") {
						window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: false } }));
						say("이 칸을 파일에 남기지 못했습니다.");
						return;
					}
					if (typeof saved?.rev === "number") paneRev.current = saved.rev;
				} catch {
					/* the file read below decides */
				}
				cancelQueuedPage(`single:${genreId}:${idNow}`);
				const read = await readPaneFile({ kind: "song", genreId, ep: idNow, act: actN, title: "" });
				if (read.ok) {
					fileFields.current = { page: pageKey, fields: read.fields };
					paneRev.current = Number(read.rev) || paneRev.current;
					fileLoadGen.current += 1;
					setFileRev((n) => n + 1);
				}
				const got = String(read.fields?.[fieldKey] ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
				const want = String(cellFields[fieldKey] ?? text ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
				const matched = Boolean(read.ok && fieldKey && got === want);
				window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: matched } }));
				if (!matched) {
					say("이 칸을 파일에 남기지 못했습니다.");
					return;
				}
				saveAck.current = true;
				say("저장: 최신 값만 남겼습니다.");
			})();
			if (id === "title" && !pageConfirmed) {
				const listChanged = renamePlaylistCopies(genreId, epN, prevTitle, text);
				if (titled !== next || listChanged) say("제목: 다른 결과의 같은 제목을 바꿈");
			}
			return;
		}
		const next = patchPlaylistPkg(playlistRef.current ?? emptyPlaylist(), id, text);
		if (!next) return "이 칸을 저장하지 못했습니다.";
		let saved = next;
		if (id === "tracks") saved = { ...next, tracklistEdited: true };
		if (id === "yt-desc") saved = { ...next, descEdited: true };
		const listKey = DRAFT_PANE_KEY[id];
		if (listKey && !String(text || "").trim()) saved = { ...saved, blankFields: [listKey] };
		if (listKey) saved = { ...saved, savedKeys: [listKey] };
		pinScreenHold();
		const intent = exactLinkPatch();
		try {
			keepPlaylist({ ...saved, ...intent.patch, baseRev: paneRev.current }, true, actN, genreId, true, false);
		} catch {
			/* 화면 메모리가 끊겨도 파일 저장은 이어서 한다 */
		}
		const listFields = {};
		if (listKey) listFields[listKey] = String(saved[listKey] ?? text ?? "");
		void (async () => {
			try { await flushAppPagesNow(); } catch { /* 칸 저장이 마지막이다 */ }
			try {
				if (listKey) {
					const saved = plainServer(await saveResultFields({ data: { kind: "act", genreId, ep: "", act: actN, title: "", fields: listFields, blank: !String(text || "").trim(), rev: paneRev.current } }));
					if (saved && saved.ok === false && saved.error !== "conflict") {
						window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: false } }));
						say("이 칸을 파일에 남기지 못했습니다.");
						return;
					}
					if (typeof saved?.rev === "number") paneRev.current = saved.rev;
				}
			} catch {
				/* the file read below decides */
			}
			cancelQueuedPage(`playlist:${genreId}:${actN}`);
			const read = await readPaneFile({ kind: "act", genreId, ep: "", act: actN, title: "" });
			if (read.ok) {
				fileFields.current = { page: pageKey, fields: read.fields };
				paneRev.current = Number(read.rev) || paneRev.current;
				fileLoadGen.current += 1;
				setFileRev((n) => n + 1);
			}
			const got = String(read.fields?.[listKey] ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
			const want = String(listFields[listKey] ?? text ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
			const matched = Boolean(read.ok && listKey && got === want);
			window.dispatchEvent(new CustomEvent("noa-cell-save", { detail: { ok: matched } }));
			if (!matched) {
				say("이 칸을 파일에 남기지 못했습니다.");
				return;
			}
			saveAck.current = true;
			say("저장: 최신 값만 남겼습니다.");
		})();
	}
	function visibleSingle() {
		const id = padEp(epN);
		if (!id) return null;
		if (padEp(pkgEp.current) === id && pkgRef.current && hasPageBody(pkgRef.current)) return pkgRef.current;
		const cached = readCachedPackage(id, genreId);
		if (cached && hasPageBody(cached)) return cached;
		if (pkgOwner === id && pkg) return pkg;
		return pkgEp.current === id ? pkg : null;
	}
	function openField(selector) {
		if (typeof document === "undefined") return null;
		const nodes = [...document.querySelectorAll(selector)].filter((node) => {
			const rect = node.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		});
		const focused = nodes.find((node) => node === document.activeElement);
		const filled = nodes.find((node) => "value" in node && String(node.value || "").trim());
		return focused || filled || nodes[0] || null;
	}
	function visibleSuno() {
		const input = openField("input[data-suno-field]");
		if (input && "value" in input) return { onScreen: true, url: String(input.value || "").trim() };
		return { onScreen: false, url: String(sunoDraft || "").trim() };
	}
	function visibleAnalysis() {
		const input = openField("input[data-analysis-field]");
		if (input && "value" in input) return { onScreen: true, text: String(input.value || "").trim() };
		return { onScreen: false, text: "" };
	}
	function visibleLevel() {
		const input = openField("input[data-level-field]");
		if (input && "value" in input) return { onScreen: true, text: String(input.value || "").trim() };
		return { onScreen: false, text: "" };
	}
	function sunoTouched() {
		return sunoPin.current === pageKey || sunoDraft !== linkHydrated.current.suno || sunoAddress(sunoLive.current) !== sunoAddress(linkHydrated.current.suno);
	}
	function analysisTouched() {
		return analysisHold.current === true || (analysisPin.current.on && analysisPin.current.page === pageKey);
	}
	function levelTouched() {
		return levelHold.current === true || (levelPin.current.on && levelPin.current.page === pageKey);
	}
	function typeSuno(value) {
		sunoPin.current = pageKey;
		sunoLive.current = value;
		setSunoDraft(value);
	}
	function typeAnalysis(value) {
		analysisHold.current = true;
		analysisPin.current = { page: pageKey, text: value, on: true };
		setAnalysisDraft(value);
	}
	function typeLevel(value) {
		levelHold.current = true;
		levelPin.current = { page: pageKey, text: value, on: true };
		setLevelDraft(value);
	}
	function exactLinkPatch() {
		const seen = visibleSuno();
		const analysis = visibleAnalysis();
		const level = visibleLevel();
		const patch: { sunoUrl?: string; sunoExact?: true; audioAnalysis?: string; analysisExact?: true; audioLevel?: string; levelExact?: true; blankFields?: string[] } = {};
		const screenUrl = seen.onScreen ? String(seen.url || "").trim() : "";
		const draftUrl = String(sunoLive.current || "").trim() || String(sunoDraft || "").trim();
		if (seen.onScreen) {
			patch.sunoUrl = screenUrl;
			patch.sunoExact = true;
		} else if (draftUrl) {
			patch.sunoUrl = draftUrl;
			patch.sunoExact = true;
		}
		const levelEdited = levelHold.current || (levelPin.current.on && levelPin.current.page === pageKey);
		const screenRaw = level.onScreen ? String(level.text || "").trim() : "";
		const remembered = String(levelDraft || "").trim() || (levelPin.current.page === pageKey ? String(levelPin.current.text || "").trim() : "") || (heardLevel.current.page === pageKey ? String(heardLevel.current.text || "").trim() : "") || String(audioLevelText || "").trim();
		if (level.onScreen || levelEdited) {
			patch.audioLevel = screenRaw;
			patch.levelExact = true;
		} else if (remembered) {
			patch.audioLevel = remembered;
			patch.levelExact = true;
		}
		const analysisEdited = analysisHold.current || (analysisPin.current.on && analysisPin.current.page === pageKey);
		const analysisRaw = analysis.onScreen ? String(analysis.text || "").trim() : "";
		const analysisRemembered = String(analysisDraft || "").trim() || (analysisPin.current.page === pageKey ? String(analysisPin.current.text || "").trim() : "") || (heardAnalysis.current.page === pageKey ? String(heardAnalysis.current.text || "").trim() : "") || String(audioAnalysisText || "").trim();
		if (analysis.onScreen || analysisEdited) {
			patch.audioAnalysis = analysisRaw;
			patch.analysisExact = true;
		} else if (analysisRemembered) {
			patch.audioAnalysis = analysisRemembered;
			patch.analysisExact = true;
		}
		return { patch, bad: false, raw: screenRaw, analysisBad: false, analysisRaw };
	}
	function pinScreenHold() {
		const intent = exactLinkPatch();
		const id = isSingle ? padEp(epN) : "";
		const slot = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
		const patch = {};
		if (intent.patch.sunoExact) {
			patch.sunoUrl = intent.patch.sunoUrl || "";
			patch.sunoExact = true;
		}
		if (intent.patch.levelExact) {
			patch.audioLevel = intent.patch.audioLevel || "";
			patch.levelExact = true;
		}
		if (intent.patch.analysisExact) {
			patch.audioAnalysis = intent.patch.audioAnalysis || "";
			patch.analysisExact = true;
		}
		if (patch.sunoUrl !== undefined || patch.audioLevel !== undefined || patch.audioAnalysis !== undefined) holdPageLink(slot, patch);
	}
	function typedSuno() {
		const seen = visibleSuno();
		if (seen.onScreen) {
			const dirty = sunoDraft !== linkHydrated.current.suno || sunoAddress(sunoLive.current) !== sunoAddress(linkHydrated.current.suno);
			if (seen.url || dirty) sunoLive.current = seen.url;
			return seen.url;
		}
		const fromScreen = () => {
			if (typeof document === "undefined") return "";
			const roots = [...document.querySelectorAll("#studio-result")];
			const inputs = [];
			for (const root of roots) inputs.push(...root.querySelectorAll("input[data-suno-field]"));
			if (!inputs.length) inputs.push(...document.querySelectorAll("input[data-suno-field]"));
			let found = "";
			for (const input of inputs) {
				const url = sunoAddress("value" in input ? input.value : "");
				if (url) found = url;
			}
			return found;
		};
		const url = fromScreen() || sunoAddress(sunoDraft);
		if (!url) return "";
		sunoLive.current = url;
		return url;
	}
	function openAnalysis(body) {
		const live = heardAnalysis.current.page === pageKey ? String(heardAnalysis.current.text || "") : "";
		const filed = fileFields.current.page === pageKey ? String(fileFields.current.fields.audioAnalysis || "") : "";
		return live || filed || String(body?.audioAnalysis || "");
	}
	function openLevel(body) {
		const live = heardLevel.current.page === pageKey ? String(heardLevel.current.text || "") : "";
		const filed = fileFields.current.page === pageKey ? String(fileFields.current.fields.audioLevel || "") : "";
		return live || filed || String(body?.audioLevel || "");
	}
	function paneNow() {
		const id = isSingle ? padEp(epN) : "";
		const body = id ? visibleSingle() || songPkg || rawSong || {} : playlistRef.current || shownPlaylist || {};
		const shown = {
			summary: body.summary,
			confirmedTitle: body.confirmedTitle,
			lyricsBlock: body.lyricsBlock,
			sunoStyle: body.sunoStyle,
			geminiPrompt: body.geminiPrompt,
			youtubeTitle: body.youtubeTitle,
			youtubeDescription: body.youtubeDescription,
			fanLetter: body.fanLetter,
			communityPost: body.communityPost,
			tracklist: body.tracklist,
			youtubeUrl: ytLive.current,
			mvUrl: mvLive.current,
			sunoUrl: typedSuno(),
			audioAnalysis: openAnalysis(body),
			audioLevel: openLevel(body),
		};
		for (const row of fieldDrafts(pageKey)) {
			const key = DRAFT_PANE_KEY[row.id];
			if (key) shown[key] = row.text;
		}
		return shown;
	}
	function noteLink(saved) {
		const body = linkSaved(saved);
		if (typeof body.rev === "number") paneRev.current = body.rev;
		return body;
	}
	async function readPaneFile(query) {
		try {
			const plain = plainServer(await readResultFile({ data: query }));
			if (plain && plain.ok !== false && plain.fields && typeof plain.fields === "object") return { ok: true, fields: plain.fields, error: "", rev: Number(plain.rev) || 0 };
			return { ok: false, fields: null, error: String(plain?.error || "read") };
		} catch (err) {
			return { ok: false, fields: null, error: quietDiskFault(err instanceof Error ? err.message.trim() : "request") };
		}
	}
	async function stickPane(shot) {
		const id = isSingle ? padEp(epN) : "";
		const kind = id ? "song" : "act";
		const page = pageKey;
		const seen = shot?.suno || visibleSuno();
		const seenLevel = shot?.level || visibleLevel();
		const seenAnalysis = shot?.analysis || visibleAnalysis();
		const levelOn = Boolean(seenLevel.onScreen);
		const analysisOn = Boolean(seenAnalysis.onScreen);
		const query = { kind, genreId, ep: id, act: actN, title: "" };
		let linkFault = "";
		let linkLeft = {};
		if (seen.onScreen || levelOn || analysisOn) {
			let exact = null;
			const askExact = () => saveExactLink({ data: {
				kind,
				genreId,
				ep: id,
				act: actN,
				title: "",
				sunoSet: seen.onScreen,
				sunoUrl: seen.url,
				levelSet: levelOn,
				audioLevel: levelOn ? String(seenLevel.text || "").trim() : "",
				analysisSet: analysisOn,
				audioAnalysis: analysisOn ? String(seenAnalysis.text || "").trim() : "",
				rev: paneRev.current,
			} });
			try {
				exact = plainServer(await askExact());
			} catch (err) {
				try {
					exact = plainServer(await askExact());
				} catch (err2) {
					const failed = err2 instanceof Error ? err2 : err;
					linkFault = quietDiskFault(failed instanceof Error ? failed.message.trim() : "request");
					linkLeft = { ...(seen.onScreen ? { sunoUrl: seen.url } : {}), ...(levelOn ? { audioLevel: String(seenLevel.text || "").trim() } : {}), ...(analysisOn ? { audioAnalysis: String(seenAnalysis.text || "").trim() } : {}) };
				}
			}
			const wantUrl = seen.onScreen ? seen.url : null;
			const wantLevel = levelOn ? String(seenLevel.text || "").trim() : null;
			const wantAnalysis = analysisOn ? String(seenAnalysis.text || "").trim() : null;
			const gotUrl = String(exact?.sunoUrl || "").trim();
			const gotLevel = String(exact?.audioLevel || "").trim();
			const gotAnalysis = String(exact?.audioAnalysis || "").trim();
			if (!linkFault && (!exact || exact.ok === false || (wantUrl !== null && gotUrl !== wantUrl) || (wantLevel !== null && gotLevel !== wantLevel) || (wantAnalysis !== null && gotAnalysis !== wantAnalysis))) {
				linkFault = quietDiskFault(String(exact?.error || "file"));
				linkLeft = {
					...(wantUrl !== null && gotUrl !== wantUrl ? { sunoUrl: wantUrl } : {}),
					...(wantLevel !== null && gotLevel !== wantLevel ? { audioLevel: wantLevel || seenLevel.text } : {}),
					...(wantAnalysis !== null && gotAnalysis !== wantAnalysis ? { audioAnalysis: wantAnalysis || seenAnalysis.text } : {}),
				};
			}
			if (!linkFault) {
			const read = await readPaneFile(query);
			if (read.ok) {
				fileFields.current = { page, fields: read.fields };
				paneRev.current = Number(read.rev) || paneRev.current;
				fileLoadGen.current += 1;
				setFileRev((n) => n + 1);
			}
			const slot = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
			const hold = {};
			if (seen.onScreen) hold.sunoUrl = seen.url;
			if (levelOn) hold.audioLevel = wantLevel || "";
			if (analysisOn) hold.audioAnalysis = wantAnalysis || "";
			holdPageLink(slot, hold);
			if (seen.onScreen) {
				sunoLive.current = seen.url;
				setSunoDraft(seen.url);
				linkHydrated.current = { ...linkHydrated.current, suno: seen.url };
				sunoPin.current = "";
			}
			if (levelOn) {
				heardLevel.current = { page, text: wantLevel || "" };
				levelHold.current = false;
				levelPin.current = { page, text: wantLevel || "", on: true };
				setLevelDraft("");
			}
			if (analysisOn) {
				heardAnalysis.current = { page, text: wantAnalysis || "" };
				analysisHold.current = false;
				analysisPin.current = { page, text: wantAnalysis || "", on: true };
				setAnalysisDraft("");
			}
			patchApp((d) => {
				const row = id ? d.packages[`${genreId}:${id}`] : d.playlists[`${genreId}:${actN}`];
				if (!row?.pkg) return;
				const next = { ...row.pkg };
				if (seen.onScreen) next.sunoUrl = seen.url;
				if (levelOn) next.audioLevel = wantLevel || "";
				if (analysisOn) next.audioAnalysis = wantAnalysis || "";
				row.pkg = next;
			}, false);
			}
			const slotHeld = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
			const hold = {};
			if (seen.onScreen) hold.sunoUrl = seen.url;
			if (levelOn) hold.audioLevel = wantLevel || "";
			if (analysisOn) hold.audioAnalysis = wantAnalysis || "";
			holdPageLink(slotHeld, hold);
		}
		const shown = shot?.shown ? { ...shot.shown } : paneNow();
		if (seen.onScreen) shown.sunoUrl = seen.url;
		if (levelOn) shown.audioLevel = levelText(seenLevel.text);
		if (analysisOn) shown.audioAnalysis = analysisText(seenAnalysis.text);
		let fault = "";
		const first = await readPaneFile(query);
		if (!first.ok) fault = quietDiskFault(first.error);
		const blanks = shot?.blanks || new Set();
		if (!shot?.blanks) {
			for (const row of fieldDrafts(pageKey)) {
				const key = DRAFT_PANE_KEY[row.id];
				if (key && !String(row.text || "").trim()) blanks.add(key);
			}
		}
		if (seen.onScreen && !seen.url && sunoPin.current === pageKey) blanks.add("sunoUrl");
		if (levelOn && !levelText(seenLevel.text)) blanks.add("audioLevel");
		if (analysisOn && !analysisText(seenAnalysis.text)) blanks.add("audioAnalysis");
		const gaps = first.ok ? paneGap(shown, first.fields, blanks) : urlPins(shown);
		if (first.ok && !Object.keys(gaps).length) {
			fileFields.current = { page, fields: first.fields };
			fileLoadGen.current += 1;
			setFileRev((n) => n + 1);
			if (levelBad) return { ok: false, wrote: false, error: "보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다.", left: { audioLevel: seenLevel.text } };
			if (analysisBad) return { ok: false, wrote: false, error: "분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다.", left: { audioAnalysis: seenAnalysis.text } };
			return { ok: true, wrote: false, error: "", left: {} };
		}
		const urlGaps = {};
		const textGaps = {};
		for (const [key, value] of Object.entries(gaps)) {
			if (key === "youtubeUrl" || key === "mvUrl" || key === "sunoUrl" || key === "audioLevel" || key === "audioAnalysis") urlGaps[key] = value;
			else textGaps[key] = value;
		}
		const writeGaps = async (fields) => {
			if (!Object.keys(fields).length) return;
			try {
				const saved = plainServer(await saveResultFields({ data: { ...query, title: String(shown.confirmedTitle || ""), fields, blank: Object.values(fields).some((value) => !String(value ?? "").trim()), rev: paneRev.current } }));
				if (saved?.error === "conflict") {
					fault = "다른 저장이 먼저 들어가서 이번 입력은 덮지 않았습니다. 입력은 화면에 그대로 있습니다.";
					return;
				}
				if (typeof saved?.rev === "number") paneRev.current = saved.rev;
				if (saved && saved.ok === false && saved.error) fault = fault || quietDiskFault(String(saved.error || (saved.missing || []).join(",")));
			} catch (err) {
				fault = quietDiskFault(err instanceof Error ? err.message.trim() : "request");
			}
		};
		await writeGaps(urlGaps);
		if (fault.startsWith("다른 저장이")) return { ok: false, wrote: false, error: fault, left: gaps };
		if (urlGaps.sunoUrl) {
			const mid = await readPaneFile(query);
			if (!mid.ok || sunoAddress(mid.fields?.sunoUrl) !== urlGaps.sunoUrl) {
				try {
					const linked = noteLink(await saveSongLink({ data: { genreId, ep: id, act: id ? 0 : actN, url: urlGaps.sunoUrl, field: "suno", rev: paneRev.current } }));
					if (!linked.ok) fault = fault || quietDiskFault(linked.error || "suno");
				} catch (err) {
					fault = fault || quietDiskFault(err instanceof Error ? err.message.trim() : "request");
				}
			}
		}
		await writeGaps(textGaps);
		if (fault.startsWith("다른 저장이")) return { ok: false, wrote: false, error: fault, left: gaps };
		const wantSuno = sunoAddress(urlGaps.sunoUrl || "");
		let back = null;
		for (let attempt = 0; attempt < 2 && !back; attempt += 1) {
			const read = await readPaneFile(query);
			if (read.ok) back = read.fields;
			else fault = fault || quietDiskFault(read.error || "read");
		}
		if (wantSuno && (!back || sunoAddress(back.sunoUrl) !== wantSuno)) {
			try {
				const linked = noteLink(await saveSongLink({ data: { genreId, ep: id, act: id ? 0 : actN, url: wantSuno, field: "suno", rev: paneRev.current } }));
				if (!linked.ok) fault = fault || quietDiskFault(linked.error || "suno");
			} catch (err) {
				fault = fault || quietDiskFault(err instanceof Error ? err.message.trim() : "request");
			}
			const again = await readPaneFile(query);
			if (again.ok) back = again.fields;
		}
		if (!back) return { ok: false, wrote: false, error: fault || linkFault || "read", left: { ...linkLeft, ...gaps } };
		fileFields.current = { page, fields: back };
		fileLoadGen.current += 1;
		setFileRev((n) => n + 1);
		const left = { ...linkLeft, ...paneGap(shown, back, blanks) };
		if (sunoAddress(back.sunoUrl) === sunoAddress(shown.sunoUrl || "")) delete left.sunoUrl;
		if (levelText(back.audioLevel) === levelText(shown.audioLevel || "")) delete left.audioLevel;
		if (analysisText(back.audioAnalysis) === analysisText(shown.audioAnalysis || "")) delete left.audioAnalysis;
		const pinned = sunoAddress(back.sunoUrl);
		const slot = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
		if (pinned || (seen.onScreen && !seen.url) || analysisText(back.audioAnalysis)) patchQueuedBody(slot, { ...(pinned ? { sunoUrl: pinned } : {}), ...(levelText(back.audioLevel) ? { audioLevel: levelText(back.audioLevel) } : {}), ...(analysisText(back.audioAnalysis) ? { audioAnalysis: analysisText(back.audioAnalysis) } : {}) });
		if (!Object.keys(left).length) {
			if (pinned) {
				patchApp((d) => {
					const row = id ? d.packages[`${genreId}:${id}`] : d.playlists[`${genreId}:${actN}`];
					if (row?.pkg && sunoAddress(row.pkg.sunoUrl) !== pinned) row.pkg = { ...row.pkg, sunoUrl: pinned };
				}, false);
			}
			if (levelBad) return { ok: false, wrote: Object.keys(gaps).length > 0, error: "보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다.", left: { audioLevel: seenLevel.text } };
			if (analysisBad) return { ok: false, wrote: Object.keys(gaps).length > 0, error: "분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다.", left: { audioAnalysis: seenAnalysis.text } };
			return { ok: true, wrote: Object.keys(gaps).length > 0, error: "", left: {} };
		}
		return { ok: false, wrote: true, error: levelBad && !Object.keys(left).some((key) => key !== "audioLevel") ? "보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다." : analysisBad && !Object.keys(left).some((key) => key !== "audioAnalysis") ? "분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 막지 않았습니다." : fault || linkFault || Object.keys(left).join(","), left };
	}
	function noteStick(stuck, flushOk) {
		void flushOk;
		if (!stuck || stuck.ok || stuck.wrote) {
			saveMark.current = { key: saveMark.current.key, sig: saveSigRef.current };
			return true;
		}
		setError(stuck.error && /[가-힣]/.test(stuck.error) ? stuck.error : "저장하지 못했습니다.");
		return false;
	}
	async function pinTypedSuno(url) {
		const clean = sunoAddress(url);
		if (!clean) return true;
		const id = isSingle ? padEp(epN) : "";
		const query = { kind: id ? "song" : "act", genreId, ep: id, act: actN, title: "" };
		let matched = false;
		let fields = null;
		let seenRev = 0;
		for (let attempt = 0; attempt < 2 && !matched; attempt += 1) {
			try {
				await saveSongLink({ data: { genreId, ep: id, act: id ? 0 : actN, url: clean, field: "suno", rev: paneRev.current } });
			} catch {
				/* the file read below decides whether the address landed */
			}
			const read = await readPaneFile(query);
			matched = Boolean(read.ok && sunoAddress(read.fields?.sunoUrl) === clean);
			if (matched) {
				fields = read.fields;
				seenRev = Number(read.rev) || 0;
			}
		}
		if (!matched || !fields) return false;
		fileFields.current = { page: pageKey, fields };
		paneRev.current = seenRev;
		fileLoadGen.current += 1;
		setFileRev((n) => n + 1);
		const slot = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
		holdPageLink(slot, { sunoUrl: clean });
		patchQueuedBody(slot, { sunoUrl: clean });
		patchApp((d) => {
			const row = id ? d.packages[`${genreId}:${id}`] : d.playlists[`${genreId}:${actN}`];
			if (row?.pkg && sunoAddress(row.pkg.sunoUrl) !== clean) row.pkg = { ...row.pkg, sunoUrl: clean };
		}, false);
		sunoLive.current = clean;
		setSunoDraft(clean);
		linkHydrated.current = { ...linkHydrated.current, suno: clean };
		return true;
	}
	async function pinShownLevel(level) {
		const clean = levelText(level);
		if (!clean) return true;
		const id = isSingle ? padEp(epN) : "";
		const page = pageKey;
		const slot = id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`;
		const query = { kind: id ? "song" : "act", genreId, ep: id, act: actN, title: "" };
		try {
			if (id) await saveAudioLevel({ data: { genreId, ep: id, audioLevel: clean, rev: paneRev.current } });
			else await saveResultFields({ data: { ...query, fields: { audioLevel: clean }, rev: paneRev.current } });
		} catch {
			return false;
		}
		const read = await readPaneFile(query);
		if (!read.ok || levelText(read.fields?.audioLevel) !== clean) return false;
		fileFields.current = { page, fields: read.fields };
		paneRev.current = Number(read.rev) || paneRev.current;
		fileLoadGen.current += 1;
		setFileRev((n) => n + 1);
		holdPageLink(slot, { audioLevel: clean });
		patchQueuedBody(slot, { audioLevel: clean });
		patchApp((d) => {
			const row = id ? d.packages[`${genreId}:${id}`] : d.playlists[`${genreId}:${actN}`];
			if (row?.pkg && levelText(row.pkg.audioLevel) !== clean) row.pkg = { ...row.pkg, audioLevel: clean };
		}, false);
		heardLevel.current = { page, text: clean };
		return true;
	}
	async function writeShownLinks(sunoUrl, audioLevel, audioAnalysis = "") {
		const id = isSingle ? padEp(epN) : "";
		const query = { kind: id ? "song" : "act", genreId, ep: id, act: actN, title: "" };
		try {
			if (sunoUrl) {
				const saved = noteLink(await saveSongLink({ data: { genreId, ep: id, act: id ? 0 : actN, url: sunoUrl, field: "suno", rev: paneRev.current } }));
				if (!saved.ok) return { ok: false, which: "suno" };
			}
			if (audioLevel || audioAnalysis) {
				const saved = plainServer(id
					? await saveAudioLevel({ data: { genreId, ep: id, audioLevel, audioAnalysis, rev: paneRev.current } })
					: await saveResultFields({ data: { kind: "act", genreId, ep: "", act: actN, title: "", fields: { ...(audioLevel ? { audioLevel } : {}), ...(audioAnalysis ? { audioAnalysis } : {}) }, rev: paneRev.current } }));
				if (!saved || saved.ok === false) return { ok: false, which: audioLevel ? "level" : "analysis" };
			}
		} catch {
			return { ok: false, which: sunoUrl ? "suno" : audioLevel ? "level" : "analysis" };
		}
		const read = await readPaneFile(query);
		if (!read.ok) return { ok: false, which: "read" };
		if (sunoUrl && String(read.fields?.sunoUrl || "").trim() !== String(sunoUrl || "").trim()) return { ok: false, which: "suno" };
		if (audioLevel && String(read.fields?.audioLevel || "").trim() !== String(audioLevel || "").trim()) return { ok: false, which: "level" };
		if (audioAnalysis && String(read.fields?.audioAnalysis || "").trim() !== String(audioAnalysis || "").trim()) return { ok: false, which: "analysis" };
		fileFields.current = { page: pageKey, fields: read.fields };
		paneRev.current = Number(read.rev) || paneRev.current;
		fileLoadGen.current += 1;
		setFileRev((n) => n + 1);
		return { ok: true, which: "" };
	}
	async function saveVisible() {
		const saveStarted = Date.now();
		const screenSaveText = (value) => String(value || "").replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, "").replace(/\s+/g, " ").trim();
		const showSaveFault = () => {
			const diag = readSaveDiag();
			if (!diag || diag.at < saveStarted || diag.ok !== false) return;
			const code = screenSaveText(diag.error || diag.status);
			const fields = diag.rejectedKeys.map((key) => screenSaveText(key)).filter(Boolean).join(", ");
			const thrown = screenSaveText(diag.thrown);
			const line = [code ? `저장 실패 ${code}` : "", fields, thrown ? `요청 예외: ${thrown}` : ""].filter(Boolean).join(" · ");
			if (line) setError(line);
			console.info("[noa-save]", diag);
		};
		fileLoadGen.current += 1;
		followPressed("");
		say("저장: 최신 값만 남기는 중");
		const rememberLinks = () => {
			const idNow = isSingle ? padEp(epN) : "";
			linkHydrated.current = {
				page: `${genreId}:${idNow || String(actN)}:${idNow ? "ep" : "act"}`,
				yt: ytLive.current,
				mv: mvLive.current,
				suno: sunoLive.current,
				ytPremium,
				mvPremium,
			};
			castTouch.current = "";
		};
		try {
			const intent = exactLinkPatch();
			const typedUrl = typedSuno();
			const sunoForFile = intent.patch.sunoExact ? String(intent.patch.sunoUrl || "").trim() : "";
			const levelForFile = intent.patch.levelExact ? String(intent.patch.audioLevel || "").trim() : "";
			const analysisForFile = intent.patch.analysisExact ? String(intent.patch.audioAnalysis || "").trim() : "";
			const finishLinks = async () => {
				if (!sunoForFile && !levelForFile && !analysisForFile) return true;
				const landed = await writeShownLinks(sunoForFile, levelForFile, analysisForFile);
				if (landed.ok) return true;
				setError(landed.which === "level"
					? "보정값이 파일에 남지 않았습니다. 다른 칸은 막지 않습니다."
					: "수노 주소가 파일에 남지 않았습니다. 다른 칸은 막지 않습니다.");
				return false;
			};
			if (origDirty) {
				const n = padEp(epN);
				if (n) {
					persistOriginal({
						n,
						title: origDraft.title,
						vocal: origDraft.vocal,
						lyrics: origDraft.lyrics
					}, true);
					setExtras(readOriginals());
				}
			}
			const id = isSingle ? padEp(epN) : "";
			const releaseQueue = () => cancelQueuedPage(id ? `single:${genreId}:${id}` : `playlist:${genreId}:${actN}`);
			const seenLink = intent.patch.sunoExact ? { onScreen: true, url: String(intent.patch.sunoUrl || "") } : { onScreen: false, url: "" };
			const seenLevel = intent.bad ? { onScreen: true, text: intent.raw } : intent.patch.levelExact ? { onScreen: true, text: String(intent.patch.audioLevel || "") } : { onScreen: false, text: "" };
			const seenAnalysis = intent.analysisBad ? { onScreen: true, text: intent.analysisRaw } : intent.patch.analysisExact ? { onScreen: true, text: String(intent.patch.audioAnalysis || "") } : { onScreen: false, text: "" };
			const levelBad = intent.bad;
			const analysisBad = intent.analysisBad;
			if (levelBad) setError("보정값은 lufs=숫자;gain=숫자;peak=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
			else if (analysisBad) setError("분석값은 lufs=숫자;peak=숫자;lift=숫자 만 저장됩니다. 다른 칸은 저장합니다.");
			pinScreenHold();
			const blanks = new Set();
			const shownShot = paneNow();
			for (const row of fieldDrafts(pageKey)) {
				const key = DRAFT_PANE_KEY[row.id];
				if (!key) continue;
				shownShot[key] = row.text;
				if (!String(row.text || "").trim()) blanks.add(key);
			}
			if (seenLink.onScreen) shownShot.sunoUrl = seenLink.url;
			if (seenLevel.onScreen) shownShot.audioLevel = String(seenLevel.text || "").trim();
			if (seenAnalysis.onScreen) shownShot.audioAnalysis = String(seenAnalysis.text || "").trim();
			const savedKeys = [];
			for (const row of fieldDrafts(pageKey)) {
				const key = DRAFT_PANE_KEY[row.id];
				if (key) savedKeys.push(key);
			}
			if (seenLink.onScreen) {
				savedKeys.push("sunoUrl");
				if (!seenLink.url) blanks.add("sunoUrl");
			}
			if (seenLevel.onScreen) {
				savedKeys.push("audioLevel");
				if (!String(seenLevel.text || "").trim()) blanks.add("audioLevel");
			}
			if (seenAnalysis.onScreen) {
				savedKeys.push("audioAnalysis");
				if (!String(seenAnalysis.text || "").trim()) blanks.add("audioAnalysis");
			}
			for (const key of ["youtubeUrl", "mvUrl", "ytPremium", "mvPremium"]) {
				if (!savedKeys.includes(key)) savedKeys.push(key);
			}
			const linkExact = { ...intent.patch, savedKeys, baseRev: paneRev.current };
			if (blanks.size) linkExact.blankFields = [...blanks];
			const shot = { suno: seenLink, level: seenLevel, analysis: seenAnalysis, shown: shownShot, blanks };
			if (id) {
				const memory = visibleSingle();
				let body = memory;
				if (body) {
					body = { ...body };
					for (const row of fieldDrafts(pageKey)) {
						const key = DRAFT_PANE_KEY[row.id];
						if (key) body[key] = row.text;
					}
				}
				if (!body || !hasPageBody(body)) {
					const youtubeUrl = ytLive.current.trim();
					const mvUrl = mvLive.current.trim();
					const sunoUrl = seenLink.onScreen ? seenLink.url : typedUrl;
					if (!youtubeUrl && !mvUrl && !sunoUrl && !seenLink.onScreen && !seenLevel.onScreen && !seenAnalysis.onScreen) {
						if (origDirty) {
							castTouch.current = "";
							say("저장: 원곡을 남겼습니다.");
							return true;
						}
						setError("저장할 결과가 없습니다.");
						return false;
					}
					writeYoutubeUrl(genreId, id, ytLive.current);
					writeMvUrl(genreId, id, mvLive.current);
					writeSunoUrl(genreId, id, sunoLive.current);
					writeLinkPremium(genreId, id, "song", ytPremium, "ep");
					writeLinkPremium(genreId, id, "mv", mvPremium, "ep");
					saveMetaNow();
					await flushAppPagesNow().catch(() => false);
					const stuck = await stickPane(shot);
					if (!noteStick(stuck, true)) {
						showSaveFault();
						return false;
					}
					releaseQueue();
					if (!(await finishLinks())) return false;
					rememberLinks();
					say("저장: 주소를 남겼습니다.");
					showSaveFault();
					return true;
				}
				let keptSong = false;
				try {
					keptSong = Boolean(keepSingle(id, { ...body, youtubeUrl: ytLive.current, mvUrl: mvLive.current, ...linkExact, ytPremium, mvPremium, ...(castDirty ? { thumbCast } : {}) }, true, genreId, false, true, true, true));
				} catch {
					keptSong = false;
				}
				if (!keptSong) {
					const stuck = await stickPane(shot);
					if (!noteStick(stuck, true)) {
						showSaveFault();
						return false;
					}
					releaseQueue();
					if (!(await finishLinks())) return false;
					rememberLinks();
					say("저장: 파일에 남겼습니다.");
					showSaveFault();
					return true;
				}
				writeLinkPremium(genreId, id, "song", ytPremium, "ep");
				writeLinkPremium(genreId, id, "mv", mvPremium, "ep");
				const ok = await Promise.race([
					flushAppPagesNow(),
					new Promise((resolve) => window.setTimeout(() => resolve(false), 20000))
				]);
				saveMetaNow();
				const stuck = await stickPane(shot);
				if (!noteStick(stuck, Boolean(ok))) {
					showSaveFault();
					return false;
				}
				releaseQueue();
				if (!(await finishLinks())) return false;
				rememberLinks();
				say(ok ? "저장: 최신 값만 남겼습니다." : "저장: 파일에 남겼습니다.");
				showSaveFault();
				return true;
			}
			if (playlistRef.current && hasPlaylistBody(playlistRef.current) || playlist && hasPlaylistBody(playlist)) {
				const memory = playlistRef.current && hasPlaylistBody(playlistRef.current) ? playlistRef.current : playlist;
				let sheet = memory;
				if (sheet) {
					sheet = { ...sheet };
					for (const row of fieldDrafts(pageKey)) {
						const key = DRAFT_PANE_KEY[row.id];
						if (key) sheet[key] = row.text;
					}
				}
				try {
					keepPlaylist({ ...sheet, youtubeUrl: ytLive.current, mvUrl: mvLive.current, ...linkExact, ytPremium, mvPremium, ...(castDirty ? { thumbCast } : {}) }, true, actN, genreId, true);
				} catch {
					/* 화면 메모리가 끊겨도 아래 칸 저장은 한다 */
				}
				writeLinkPremium(genreId, String(actN), "song", ytPremium, "act");
				writeLinkPremium(genreId, String(actN), "mv", mvPremium, "act");
				const ok = await Promise.race([
					flushAppPagesNow(),
					new Promise((resolve) => window.setTimeout(() => resolve(false), 20000))
				]);
				saveMetaNow();
				const stuck = await stickPane(shot);
				if (!noteStick(stuck, Boolean(ok))) {
					showSaveFault();
					return false;
				}
				releaseQueue();
				if (!(await finishLinks())) return false;
				rememberLinks();
				say(ok ? "저장: 최신 값만 남겼습니다." : "저장: 파일에 남겼습니다.");
				showSaveFault();
				return true;
			}
			if (ytLive.current.trim() || mvLive.current.trim() || sunoLive.current.trim()) {
				writePlaylistYoutubeUrl(genreId, actN, ytLive.current);
				writePlaylistMvUrl(genreId, actN, mvLive.current);
				writePlaylistSunoUrl(genreId, actN, sunoLive.current);
				writeLinkPremium(genreId, String(actN), "song", ytPremium, "act");
				writeLinkPremium(genreId, String(actN), "mv", mvPremium, "act");
				saveMetaNow();
				await flushAppPagesNow().catch(() => false);
				const stuck = await stickPane(shot);
				if (!noteStick(stuck, true)) {
					showSaveFault();
					return false;
				}
					releaseQueue();
					if (!(await finishLinks())) return false;
				rememberLinks();
				say("저장: 주소를 남겼습니다.");
				showSaveFault();
				return true;
			}
			setError("저장할 결과가 없습니다.");
			return false;
		} catch (err) {
			const thrown = String(err instanceof Error ? err.message : "throw").replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, "").replace(/\s+/g, " ").trim();
			console.info("[noa-save]", { thrown: err instanceof Error ? err.message : err });
			setError(thrown ? `요청 예외: ${thrown}` : "저장하지 못했습니다.");
			return false;
		}
	}
	function followOpenedAct(act) {
		const id = `act-playlist-fold-${act}`;
		queueFoldTop(id);
		const jump = (tries) => {
			window.requestAnimationFrame(() => {
				const el = document.getElementById(id);
				if (el && el.getBoundingClientRect().height > 40) {
					followTarget(el);
					return;
				}
				if (tries > 0) window.setTimeout(() => jump(tries - 1), 80);
			});
		};
		jump(24);
	}
	function followListRow(rowId, foldId) {
		const jump = (tries) => {
			window.requestAnimationFrame(() => {
				const el = document.getElementById(rowId);
				const fold = foldId ? document.getElementById(foldId) : null;
				const open = Boolean(fold && fold.getBoundingClientRect().height > 80);
				if (el && !open) {
					followTop(el);
					return;
				}
				if (tries > 0) window.setTimeout(() => jump(tries - 1), 60);
			});
		};
		jump(12);
	}
	async function confirmPage() {
		followPressed("");
		if (!isAdminDevice()) {
			setError(adminSealDenied());
			return;
		}
		setError(pageConfirmed ? "확정 해제 확인" : "확정 중");
		try {
		const id = isSingle ? padEp(epN) : "";
		const url = ytLive.current;
		const mv = mvLive.current;
		const filedSuno = id ? readSunoUrl(genreId, id) : readPlaylistSunoUrl(genreId, actN);
		const suno = sunoAddress(sunoLive.current) || filedSuno;
		const body = id ? visibleSingle() : null;
		const rawAct = !id ? shownPlaylist ?? playlistRef.current ?? readCachedPlaylist(actN, genreId) ?? playlist : null;
		let actBody = !id ? screenPlaylist(rawAct) : null;
		if (busy) {
			setError("다른 작업이 끝나야 저장하고 확정할 수 있습니다.");
			return;
		}
		if (id) {
			writeYoutubeUrl(genreId, id, url);
			writeMvUrl(genreId, id, mv);
			writeSunoUrl(genreId, id, suno);
			setYtDraft(url);
			setMvDraft(mv);
			setSunoDraft(suno);
			saveSongLink({ data: {
				genreId,
				ep: id,
				url,
				rev: paneRev.current
			} }).then((saved) => {
				if (!noteLink(saved).ok && url.trim()) setError(failNote("유튜브 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
			});
			saveSongLink({ data: { genreId, ep: id, url: suno, field: "suno", rev: paneRev.current } }).then((saved) => {
				if (!noteLink(saved).ok && suno.trim()) setError(failNote("수노 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
			});
		} else if (actBody) {
			writePlaylistYoutubeUrl(genreId, actN, url);
			writePlaylistMvUrl(genreId, actN, mv);
			writePlaylistSunoUrl(genreId, actN, suno);
			setYtDraft(url);
			setMvDraft(mv);
			setSunoDraft(suno);
			saveSongLink({ data: { genreId, act: actN, url, rev: paneRev.current } }).then((saved) => {
				if (!noteLink(saved).ok && url.trim()) setError(failNote("유튜브 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
			});
			if (mv.trim()) {
				saveSongLink({ data: { genreId, act: actN, url: mv, field: "mv", rev: paneRev.current } }).then((saved) => {
					if (!noteLink(saved).ok) setError(failNote("MV 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
				});
			}
			saveSongLink({ data: { genreId, act: actN, url: suno, field: "suno", rev: paneRev.current } }).then((saved) => {
				if (!noteLink(saved).ok && suno.trim()) setError(failNote("수노 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
			});
		}
		if (pageConfirmed) {
			setUnconfirmEp(id);
			setUnconfirmOpen(true);
			return;
		}
		const urlReady = Boolean(url.trim());
		const singleReady = Boolean(id && (hasPageBody(body) || urlReady));
		const playlistReady = Boolean(!id && (hasPlaylistBody(actBody) || urlReady));
		if (!singleReady && !playlistReady) {
			setError("결과가 없어 확정할 수 없습니다.");
			return;
		}
		if (singleReady && id) {
			const useBody = body ?? emptyStudio();
			if (hasPageBody(useBody) || url.trim()) keepSingle(id, { ...useBody, youtubeUrl: url, mvUrl: mv, sunoUrl: suno, ytPremium, mvPremium, savedKeys: ["youtubeUrl", "mvUrl", "sunoUrl", "ytPremium", "mvPremium"], baseRev: paneRev.current }, true, genreId, false, true, true);
			await flushAppPagesNow();
			const saved = await writeConfirmed("single", genreId, id, true);
			if (!saved.ok) {
				patchApp((d) => {
					d.meta.confirmed = {
						...d.meta.confirmed ?? {},
						[`${genreId}:ep:${id}`]: false
					};
				});
				setConfirmTick((n) => n + 1);
				setError(failNote("확정을 서버에 남기지 못했습니다.", saved.error));
				return;
			}
			setConfirmTick((n) => n + 1);
			say(`확정: EP.${id}을 확정했습니다.`);
			saveMetaNow();
			ignorePickUntil.current = Date.now() + 900;
			shieldList();
			manualEp.current = "";
			stickEp.current = "";
			const actReady = readPref(genreId).actPlaylist !== false && tracksForAct(actFromEp(id), extrasAsEps(extras)).length >= 10 && tracksForAct(actFromEp(id), extrasAsEps(extras)).every((row) => isConfirmed("single", genreId, row.n));
			const act = actFromEp(id);
			window.setTimeout(() => {
				if (actReady) {
					clearResultFold();
					dropFoldClose();
					setActN(act);
					setEpN("");
					setBundleOpen(true);
					followOpenedAct(act);
					return;
				}
				closeFold(resultFoldKey(genreId, id), document.getElementById(`result-fold-${id}`));
				setActN(act);
				setEpN("");
				setBundleOpen(false);
				followListRow(`ep-row-${id}`, `result-fold-${id}`);
			}, 280);
			return;
		}
		if (!id && (actBody || urlReady)) {
			const sheet = actBody ?? emptyPlaylist();
			keepPlaylist({ ...sheet, youtubeUrl: url, mvUrl: mv, sunoUrl: suno, ytPremium, mvPremium, savedKeys: ["youtubeUrl", "mvUrl", "sunoUrl", "ytPremium", "mvPremium"], baseRev: paneRev.current }, true, actN, genreId, true);
			await flushAppPagesNow();
			const saved = await writeConfirmed("playlist", genreId, String(actN), true);
			if (!saved.ok) {
				patchApp((d) => {
					d.meta.confirmed = {
						...d.meta.confirmed ?? {},
						[`${genreId}:act:${actN}`]: false
					};
				});
				setConfirmTick((n) => n + 1);
				setError(failNote("확정을 서버에 남기지 못했습니다.", saved.error));
				return;
			}
			setConfirmTick((n) => n + 1);
			say(`확정: ACT.${actN}을 확정했습니다.`);
			saveMetaNow();
			ignorePickUntil.current = Date.now() + 900;
			window.setTimeout(() => {
				setEpN("");
				setBundleOpen(false);
				followListRow("act-picker", `act-playlist-fold-${actN}`);
			}, 280);
		}
		} catch (err) {
			setError(err instanceof Error && err.message ? koreanFillError(err.message) : "확정하지 못했습니다.");
		}
	}
	function shieldList() {
		const list = document.getElementById("ep-list");
		if (!list) return;
		list.style.pointerEvents = "none";
		window.setTimeout(() => {
			list.style.pointerEvents = "";
		}, 700);
	}
	function dismissResult(n) {
		const id = padEp(n || epNRef.current || "");
		if (id) closeFold(resultFoldKey(genreId, id), document.getElementById(`result-fold-${id}`));
		else clearResultFold();
		manualEp.current = "";
		stickEp.current = "";
		rememberOpen("");
		setBundleOpen(false);
		setEpN("");
	}
	function openSongResult(n) {
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 결과창을 열 수 없습니다.");
			return;
		}
		const id = padEp(n) || n;
		openFold(resultFoldKey(genreId, id), document.getElementById(`result-fold-${id}`));
		hydrateSeq.current += 1;
		manualEp.current = id;
		pkgEp.current = id;
		stickEp.current = id;
		rememberOpen(id);
		setBundleOpen(false);
		setEpN(id);
		setPkgOwner(id);
		const cached = readCachedPackage(id, genreId);
		setPkg(cached ?? emptyStudio());
		dropFieldLocks("single", id);
		setYtDraft(readYoutubeUrl(genreId, id));
		if (isKpop) fillOrig(id);
		window.setTimeout(() => {
			if (stickEp.current === id) stickEp.current = "";
		}, 900);
	}
	function unconfirmPage() {
		if (!isAdminDevice()) {
			setError(adminSealDenied());
			setUnconfirmOpen(false);
			return;
		}
		const n = unconfirmEp || (isSingle && epN ? padEp(epN) || epN : "");
		if (n) {
			writeConfirmed("single", genreId, n, false);
			writeLocks("single", n, genreId, {});
			writeRowLock(genreId, n, false);
			if (padEp(epN) === n) setLocks({});
		} else if (!epN) {
			writeConfirmed("playlist", genreId, String(actN), false);
			writeLocks("playlist", String(actN), genreId, {});
			setLocks({});
		}
		setConfirmTick((n) => n + 1);
		setLockTick((n) => n + 1);
		setUnconfirmEp("");
		setUnconfirmOpen(false);
		if (n) openSongResult(n);
	}
	function unlockSong(n) {
		if (Date.now() < ignorePickUntil.current) return;
		if (Date.now() - unlockAt.current < 800) return;
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 잠긴 곡을 풀 수 없습니다.");
			return;
		}
		const id = padEp(n) || n;
		if (confirmedEps.includes(id)) {
			setUnconfirmEp(id);
			setUnconfirmOpen(true);
			return;
		}
		unlockAt.current = Date.now();
		lockCache.set(lockKey(genreId, id), false);
		readyHold.current = readyHold.current.filter((item) => item !== id);
		writeLocks("single", id, genreId, {});
		writeRowLock(genreId, id, false);
		setHeldReady((prev) => ({
			...prev,
			[id]: false
		}));
		setRowRev((tick) => tick + 1);
		setLockTick((tick) => tick + 1);
	}
	function lockSong(n) {
		if (Date.now() < ignorePickUntil.current) return;
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 곡을 잠글 수 없습니다.");
			return;
		}
		const id = padEp(n) || n;
		if (Date.now() - unlockAt.current < 800) return;
		if (stickEp.current) return;
		lockCache.set(lockKey(genreId, id), true);
		setRowRev((n) => n + 1);
		lockShown.current[id] = true;
		try {
			sessionStorage.setItem("noa-lock-shown", JSON.stringify(lockShown.current));
		} catch {}
		writeRowLock(genreId, id, true);
		setHeldReady((prev) => ({
			...prev,
			[id]: true
		}));
		manualEp.current = "";
		rememberOpen("");
		if (padEp(epN) === id) setEpN("");
		setLockTick((tick) => tick + 1);
	}
	function saveYoutube(url) {
		ytLive.current = url;
		const id = padEp(epN);
		if (id) {
			writeYoutubeUrl(genreId, id, url);
			setYtDraft(url);
			const gid = genreId;
			saveSongLink({ data: {
				genreId: gid,
				ep: id,
				url,
				rev: paneRev.current
			} }).then((saved) => {
				if (!noteLink(saved).ok && url.trim()) setError(failNote("유튜브 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
				else setYtTick((n) => n + 1);
			});
			return;
		}
		writePlaylistYoutubeUrl(genreId, actN, url);
		setYtDraft(url);
		setYtTick((n) => n + 1);
		saveSongLink({ data: {
			genreId,
			act: actN,
			url,
			rev: paneRev.current
		} }).then((saved) => {
			if (!noteLink(saved).ok && url.trim()) setError(failNote("유튜브 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
		});
	}
	function saveMv(url) {
		mvLive.current = url;
		const id = padEp(epN);
		if (id) {
			writeMvUrl(genreId, id, url);
			setMvDraft(url);
			saveSongLink({ data: {
				genreId,
				ep: id,
				url,
				field: "mv",
				rev: paneRev.current
			} }).then((saved) => {
				if (!noteLink(saved).ok && url.trim()) setError(failNote("MV 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
				else setYtTick((n) => n + 1);
			});
			return;
		}
		writePlaylistMvUrl(genreId, actN, url);
		setMvDraft(url);
		setYtTick((n) => n + 1);
		saveSongLink({ data: {
			genreId,
			act: actN,
			url,
			field: "mv",
			rev: paneRev.current
		} }).then((saved) => {
			if (!noteLink(saved).ok && url.trim()) setError(failNote("MV 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
		});
	}
	function saveSuno(url) {
		const clean = sunoAddress(url);
		sunoLive.current = clean;
		const id = padEp(epN);
		if (id) {
			writeSunoUrl(genreId, id, clean, true);
			setSunoDraft(clean);
			if (clean) {
				saveSongLink({ data: {
					genreId,
					ep: id,
					url: clean,
					field: "suno",
					rev: paneRev.current
				} }).then((saved) => {
					if (!noteLink(saved).ok) setError(failNote("수노 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
					else setYtTick((n) => n + 1);
				});
			} else {
				saveExactLink({ data: { kind: "song", genreId, ep: id, act: actN, title: "", sunoSet: true, sunoUrl: "", rev: paneRev.current } }).then((saved) => {
					const plain = plainServer(saved);
					if (!plain || plain.ok === false) setError(failNote("수노 주소를 파일에서 비우지 못했습니다.", plain && "error" in plain ? String(plain.error ?? "") : ""));
					else setYtTick((n) => n + 1);
				});
			}
			return;
		}
		writePlaylistSunoUrl(genreId, actN, clean, true);
		setSunoDraft(clean);
		setYtTick((n) => n + 1);
		if (clean) {
			saveSongLink({ data: {
				genreId,
				act: actN,
				url: clean,
				field: "suno",
				rev: paneRev.current
			} }).then((saved) => {
				if (!noteLink(saved).ok) setError(failNote("수노 주소를 서버에 남기지 못했습니다.", saved && "error" in saved ? String(noteLink(saved).error ?? "") : ""));
			});
			return;
		}
		saveExactLink({ data: { kind: "act", genreId, ep: "", act: actN, title: "", sunoSet: true, sunoUrl: "", rev: paneRev.current } }).then((saved) => {
			const plain = plainServer(saved);
			if (!plain || plain.ok === false) setError(failNote("수노 주소를 파일에서 비우지 못했습니다.", plain && "error" in plain ? String(plain.error ?? "") : ""));
		});
	}
	function savePremium(kind, on) {
		const scope = epN ? "ep" : "act";
		const linkId = epN || String(actN);
		const lockPage = `${genreId}:${linkId}:${scope}`;
		const flag = kind === "song" ? "song" : "mv";
		premiumLock.current = { ...premiumLock.current, page: lockPage, [flag]: on };
		if (kind === "song") setYtPremium(on);
		else setMvPremium(on);
		const field = kind === "song" ? "ytPremium" : "mvPremium";
		const id = padEp(epN);
		if (id) {
			writeLinkPremium(genreId, id, kind, on, "ep");
			const cur = readCachedPackage(id, genreId) ?? emptyStudio();
			const next = { ...cur, [field]: on, savedKeys: [field], baseRev: paneRev.current };
			keepSingle(id, next, true, genreId, false, true, true, true);
			saveMetaNow();
			setYtTick((n) => n + 1);
			void pinShownPremiumFile({ data: { kind: "song", genreId, ep: id, act: 0, title: "", which: kind, on } }).then((saved) => {
				const plain = plainServer(saved);
				if (!plain || plain.ok === false) setError("고음질 체크를 저장하지 못했습니다.");
			}).catch(() => setError("고음질 체크를 저장하지 못했습니다."));
			return;
		}
		writeLinkPremium(genreId, String(actN), kind, on, "act");
		const cur = readCachedPlaylist(actN, genreId) ?? emptyPlaylist();
		keepPlaylist({ ...cur, [field]: on, savedKeys: [field], baseRev: paneRev.current }, true, actN, genreId, true);
		saveMetaNow();
		setYtTick((n) => n + 1);
		void pinShownPremiumFile({ data: { kind: "act", genreId, ep: "", act: actN, title: "", which: kind, on } }).then((saved) => {
			const plain = plainServer(saved);
			if (!plain || plain.ok === false) setError("고음질 체크를 저장하지 못했습니다.");
		}).catch(() => setError("고음질 체크를 저장하지 못했습니다."));
	}
	async function applyThumb(prompt) {
		if (isLocked(locks, "thumb")) return;
		if (busyBlock === "thumb-img") {
			cancelRegen();
			return;
		}
		if (busyBlock) return;
		if (!prompt.trim()) {
			setError("제미나이 프롬프트가 없습니다.");
			return;
		}
		const run = armRegen("thumb-img");
		try {
			const result = await renderThumb({ data: {
				prompt,
				genreId,
				thumbCast
			}, signal: run.signal });
			if (!regenStill(run.job)) return;
			if (!result.ok) {
				setError(koreanFillError(result.error));
				return;
			}
			if (epN) {
				if (isConfirmed("single", genreId, padEp(epN) || epN) && !isAdminDevice()) return;
				const cur = pkgRef.current ?? emptyStudio();
				const edited = [...new Set([...(cur.userEdited || []), "thumb"])];
				keepSingle(padEp(epN) || epN, {
					...cur,
					geminiPrompt: prompt,
					thumbUrl: result.url,
					thumbCast,
					userEdited: edited,
					savedKeys: ["geminiPrompt", "thumbUrl"],
					baseRev: paneRev.current
				}, true, genreId, false, true, true);
			} else if (playlistRef.current) {
				if (isConfirmed("playlist", genreId, String(actN)) && !isAdminDevice()) return;
				keepPlaylist({
					...playlistRef.current,
					geminiPrompt: prompt,
					thumbUrl: result.url,
					thumbCast,
					savedKeys: ["geminiPrompt", "thumbUrl"],
					baseRev: paneRev.current
				}, true, actN, genreId, true);
			}
		} catch {
			if (!regenStill(run.job)) return;
			setError("썸네일을 만들지 못했습니다.");
		} finally {
			if (regenStill(run.job)) {
				regenAbort.current = null;
				setBusyBlock(null);
			}
		}
	}
	async function onRegenImage() {
		if (busyBlock === "thumb-img") {
			cancelRegen();
			return;
		}
		if (busy || busyBlock) return;
		if (isLocked(locks, "thumb")) return;
		await applyThumb((epN && pkgRef.current ? pkgRef.current.geminiPrompt : playlistRef.current?.geminiPrompt) ?? "");
	}
	function placeUnderSong(node) {
		if (!node) return null;
		if (splitOn) {
			const pane = typeof document !== "undefined" ? document.getElementById("studio-split-pane") : null;
			if (pane) return createPortal(/* @__PURE__ */ jsxs("div", {
				className: "min-w-0",
				children: [
					isSingle ? /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "mb-3 ml-auto flex w-fit items-center gap-1.5 text-xs font-medium text-fg",
						onClick: () => dismissResult(epN),
						children: /* @__PURE__ */ jsx(KoText, { text: "결과 닫기" })
					}) : null,
					node
				]
			}), pane);
		}
		if (isSingle) {
			if (resultHost) return createPortal(node, resultHost);
			return node;
		}
		if (playlistHost) return createPortal(node, playlistHost);
		const livePlaylistHost = typeof document !== "undefined" ? document.getElementById("act-playlist-slot") : null;
		if (livePlaylistHost) return createPortal(node, livePlaylistHost);
		return null;
	}
	function scrollToFillTarget() {
		const songId = padEp(epN);
		const id = songId ? `ep-row-${songId}` : actChosen ? "act-picker" : "genre-anchor";
		window.setTimeout(() => {
			followTarget(document.getElementById(id));
		}, 40);
	}
	function beginSongFill(songId) {
		const id = padEp(songId);
		if (!id || masterLocked() || isConfirmed("single", genreId, id)) return;
		const liveRaw = readCachedPackage(id, genreId) ?? emptyStudio();
		const live = liveRaw;
		const edited = new Set(live.userEdited || []);
		const fields = auditStudioFields(genreId, hasPageBody(live) ? live : null, readPref(genreId), id);
		const items = byFillLead(fields.filter((field) => field.kind !== "ok" && !edited.has(field.id))).map((field) => {
			const fix = field.kind === "empty" ? "empty" : fieldFix(live, field.id);
			const action = fix === "empty" ? "생성" : fix === "rewrite" ? "재생성" : "보완";
			return { id: field.id, label: field.label, action, fix };
		});
		setReviewItems(items);
		setReviewNote("");
		fillNoteRef.current = "";
		reviewIdsRef.current = new Set(items.map((item) => item.id));
		fillRequestOnlyRef.current = false;
		fillModeRef.current = "review";
		fillRowsRef.current = [{
			genreId,
			n: id,
			title: live.confirmedTitle?.trim() || getEp(id)?.title || id,
			label: genre.label,
			rank: 4
		}];
		setFillScopeLabel(items.length ? `EP.${id}` : `EP.${id}. 손볼 칸이 없습니다.`);
		setFillAudit({ empty: 0, rough: 0, partial: 0, item: items.length, preview: items.map((item) => item.label) });
		setReportDetail("");
		setFillAsk(false);
		setReviewOpen(true);
	}
	function startFill() {
		if (masterLocked()) {
			setError("열쇠가 잠겨 있어 자동 채우기를 할 수 없습니다.");
			return;
		}
		if (filling) return;
		const songId = padEp(epN);
		if (!songId) return;
		scrollToFillTarget();
		beginSongFill(songId);
	}
	function toggleActBundle(n) {
		if (!gateOpen) return;
		if (bundleOpen && actN === n && !epN) {
			setBundleOpen(false);
			return;
		}
		setActN(n);
		setEpN("");
		setBundleOpen(true);
		fillScopeRef.current = "act";
	}
	const resultShown = Boolean(genrePicked && gateOpen && !isDistinct && (isKpop ? kpopMode !== "compose" : true) && (padEp(epN) || bundleOpen || filling || fillPeek));
	const resultBar = noticeMode === "hidden" && (resultShown || Boolean(error) || pageSloppy || pagePartial);
	const floatLift = resultBar || storyLift;
	const resultNote = error || (busy || busyBlock ? busyBlock === "thumb-img" ? "썸네일 생성 중" : busy && !isSingle ? "묶음 작성 중" : busy ? "단곡 패키지 작성 중" : "생성 중" : !pageConfirmed && playlistGap ? `비어 있는 칸: ${playlistGap}` : "대기");
	const blockName = {
		summary: "요약",
		title: "제목",
		lyrics: "가사",
		suno: "수노",
		thumb: "썸네일",
		"yt-title": "유튜브 제목",
		"yt-desc": "설명",
		letter: "커뮤니티",
		community: "커뮤니티",
		tracks: "수록곡"
	};
	const workLine = busyBlock === "thumb-img" ? "썸네일 생성" : busyBlock ? `${blockName[busyBlock] || "칸"} 재생성` : !isSingle ? "묶음 작성" : "곡 작성";
	const workTitle = isSingle ? [`EP.${padEp(epN) || epN}`, songPkg?.confirmedTitle || songPkg?.youtubeTitle || ""].filter(Boolean).join(" ") : [`ACT.${actN}`, shownPlaylist?.confirmedTitle || ""].filter(Boolean).join(" ");
	return /* @__PURE__ */ jsxs("div", {
		className: "relative min-h-[var(--app-h,100dvh)] bg-bg text-fg",
		children: [
			mainVideo ? /* @__PURE__ */ jsx(MainSplash, {
				clip: mainVideo,
				active: !genrePicked
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: cn("studio-shell relative z-10 mx-auto w-full px-5 pt-8 sm:pt-10", filling ? "pb-[calc(var(--app-h,100dvh)*0.78)]" : "pb-[calc(var(--notice-lift,0px)+var(--jukebox-cover,0px)+3rem)]"),
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "studio-main min-w-0",
						children: [
					/* @__PURE__ */ jsxs("header", {
						className: "studio-head mb-6 flex w-full items-center justify-between gap-3",
						children: [
							/* @__PURE__ */ jsx("img", {
								src: "/papa-logo.png",
								alt: "",
								width: 128,
								height: 128,
								draggable: false,
								className: "size-14 shrink-0 touch-none rounded-full select-none",
								onContextMenu: (event) => event.preventDefault(),
								onPointerDown: (event) => {
									if (event.button != null && event.button !== 0) return;
									event.preventDefault();
									event.currentTarget.setPointerCapture?.(event.pointerId);
									holdPointer.current = event.pointerId;
									logoHeld.current = false;
									window.clearTimeout(holdTimer.current);
									holdTimer.current = window.setTimeout(() => {
										if (holdPointer.current == null) return;
										logoHeld.current = true;
										setLockReveal(true);
									}, 3000);
								},
								onPointerUp: () => {
									const held = logoHeld.current;
									holdPointer.current = null;
									window.clearTimeout(holdTimer.current);
									if (!held) goHome();
								},
								onPointerCancel: () => {
									holdPointer.current = null;
									window.clearTimeout(holdTimer.current);
								}
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("p", {
									className: "whitespace-nowrap text-xs font-medium tracking-widest text-fg-subtle uppercase",
									children: "AI Artist Noa"
								}), /* @__PURE__ */ jsx("h1", {
									className: "mt-1 text-[clamp(1.35rem,4.2vw,1.75rem)] font-semibold leading-none tracking-tight text-fg",
									children: "NOA STUDIO"
								}), /* @__PURE__ */ jsxs("span", {
									className: "mt-1 inline-flex max-w-full flex-nowrap items-center gap-1.5",
									children: [/* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: () => setVersionOpen(true),
										className: "build-mark rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight text-fg",
										children: [buildLabel]
									}), /* @__PURE__ */ jsxs("span", {
										className: "premium-mark shrink-0",
										"aria-label": "음악 프리미엄",
										title: "고품질 프리미엄 사운드",
										children: [/* @__PURE__ */ jsx(Music, {
											className: "size-3 shrink-0",
											"aria-hidden": true
										}), /* @__PURE__ */ jsx("span", { children: "Premium" })]
									})]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "studio-tools flex shrink-0 items-center",
								children: [
									!gateOpen ? /* @__PURE__ */ jsx(MailCompose, {}) : null,
									!gateOpen ? /* @__PURE__ */ jsx(ViewLangPick, {}) : null,
									gateOpen && !genrePicked ? /* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "검사창",
										className: "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface",
										onClick: () => setHealthOpen(true),
										children: /* @__PURE__ */ jsx(ClipboardCheck, { className: "size-6" })
									}) : null,
									showLock ? /* @__PURE__ */ jsx(Link, {
										to: "/settings",
										"aria-label": "사용자 설정",
										className: "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface",
										children: /* @__PURE__ */ jsx(Settings, { className: "size-6" })
									}) : null,
									showLock ? /* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": gateOpen ? "열쇠 잠그기" : "열쇠 열기",
										className: "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface",
										onClick: () => setGateAsk(true),
										children: gateOpen ? /* @__PURE__ */ jsx(LockOpen, { className: "size-6 text-[#8e8e93]" }) : /* @__PURE__ */ jsx(Lock, { className: "size-6 text-white" })
									}) : null
								]
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "studio-body min-w-0",
						children: [
					/* @__PURE__ */ jsx(NoticePanel, {
						mode: noticeMode,
						gap: noticeGap,
						filling,
						current: fillCurrent,
						done: fillDone,
						total: fillTotal,
						errors: fillErrors,
						notes: upgradeNotes,
						filledCount: fillReport?.filled ?? 0,
						failedCount: fillReport?.failed ?? 0,
						limitWait,
						remaining: Math.max(0, fillTotal - fillDone) || (readFillQueue()?.tasks.length ?? 0),
						events: fillEvents,
						fillTrack,
						emptyCount: fillAudit.empty,
						sloppyCount: fillAudit.rough,
						partialCount: fillAudit.partial,
						itemCount: fillAudit.item,
						previewLines: fillAudit.preview,
						onConfirmFill: () => {
							patchApp((d) => {
								d.meta.fillAskAgain = false;
							});
							setFillAsk(false);
							setReviewOpen(false);
							setReportDetail("");
							setFilling(true);
							setFillCurrent("검열한 곡부터 항목을 확인합니다");
							fillEmptyPages();
						},
						onDismissFill: () => {
							patchApp((d) => {
								d.meta.fillAskAgain = true;
							});
							setFillAsk(false);
							setReviewOpen(false);
							setFillSkip(true);
						},
						onPause: () => {
							fillStop.current = true;
							fillResumeRef.current = false;
							fillPausedRef.current = false;
							fillingRef.current = false;
							fillClientRef.current = false;
							setFillPaused(false);
							setFilling(false);
							setBusy(false);
							setFillCurrent("");
							setFillTrack(null);
							setFillStall(false);
							setFillWorkN("");
							setFillFocus(null);
							setFillPeek(false);
							fillPeekRef.current = false;
							try {
								sessionStorage.removeItem("noa-fill-live");
							} catch {}
							persistQueue(null);
							pauseFillWorker();
							clearFillNotify();
							patchApp((d) => {
								d.meta.fillAskAgain = true;
							});
							setFillAsk(false);
						},
						onResume: () => {
							setFillPaused(false);
							fillingRef.current = false;
							if (auditFillTargets() > 0) {
								setFillAsk(true);
								setFillSkip(false);
							}
						},
						onConfirmUpgrade: () => {
							markReleaseSeen();
							setUpgradeAsk(false);
							setUpgradeDone(true);
						},
						onDismissUpgrade: () => {
							markReleaseSeen();
							setUpgradeAsk(false);
						},
						onAckUpgrade: () => setUpgradeDone(false),
						onAckFill: () => {
							setFillReport(null);
							setReportDetail("");
						},
						onOpenSong: openFillSong,
						online,
						stalled: fillStall,
						onRestart: () => {
							if (!online) return;
							if (limitWait > 0) return;
							fillResumeRef.current = true;
						},
						fillScopeLabel,
						reviewItems,
						reviewNote,
						reportDetail,
						onReviewNote: (value) => {
							setReviewNote(value);
							fillNoteRef.current = value;
						},
						onConfirmReview: () => {
							const id = padEp(epN);
							if (!id || masterLocked()) return;
							const ask = (fillNoteRef.current || reviewNote).trim();
							const ids = reviewItems.map((item) => item.id);
							if (!ids.length && !ask) return;
							const live = readCachedPackage(id, genreId);
							fillRequestOnlyRef.current = ids.length === 0;
							reviewIdsRef.current = new Set(ids.length ? ids : requiredStudioFields(genreId, readPref(genreId)).map((field) => field.id));
							fillNoteRef.current = ask;
							fillModeRef.current = "review";
							fillRowsRef.current = [{
								genreId,
								n: id,
								title: live?.confirmedTitle?.trim() || getEp(id)?.title || id,
								label: genre.label,
								rank: 4
							}];
							setReviewOpen(false);
							setFillAsk(false);
							setReportDetail("");
							setFilling(true);
							setFillCurrent(ids.length ? "검수한 항목을 고칩니다" : "요구사항을 반영합니다");
							fillEmptyPages();
						}
					}),
					/* @__PURE__ */ jsxs("div", {
						className: cn(!genrePicked && "home-dock fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))]"),
						children: [!genrePicked && buildOffer ? /* @__PURE__ */ jsxs("div", {
							className: "mb-3 rounded-2xl border border-mark/80 bg-black/75 px-4 py-3 text-white backdrop-blur",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium",
								children: /* @__PURE__ */ jsx(KoText, { text: "새 버전이 있습니다." })
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-3 flex gap-2",
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									className: "min-h-11 flex-1 rounded-xl border border-white/25 text-sm",
									onClick: () => {
										try {
											sessionStorage.setItem("noa-build-dismiss", buildOffer);
										} catch {}
										setBuildOffer("");
									},
									children: /* @__PURE__ */ jsx(KoText, { text: "나중에" })
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "min-h-11 flex-1 rounded-xl bg-mark text-sm font-medium text-mark-fg",
									onClick: () => {
										if (filling || busy || busyBlock) return;
										applyPublishedBuild(buildOffer);
									},
									children: /* @__PURE__ */ jsx(KoText, { text: "적용" })
								})]
							})]
						}) : null, !genrePicked && mainVideo ? /* @__PURE__ */ jsx("p", {
							className: "splash-kicker absolute left-5 top-4 text-[12px] font-medium tracking-wide text-white/90",
							children: /* @__PURE__ */ jsx(KoText, { text: mainVideo.label })
						}) : null, /* @__PURE__ */ jsxs(PickerSheet, {
							open: genreOpen,
							onOpenChange: setGenreOpen,
							title: /* @__PURE__ */ jsx(KoText, { text: "장르" }),
							trigger: /* @__PURE__ */ jsxs("button", {
								id: "genre-anchor",
								type: "button",
								className: "flex min-h-[58px] w-full items-center justify-between rounded-2xl bg-surface/95 px-4 py-3 text-left shadow-lg backdrop-blur",
								children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase",
									children: [/* @__PURE__ */ jsx(KoText, { text: "장르" }), /* @__PURE__ */ jsx("span", {
										className: "rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg",
										children: /* @__PURE__ */ jsx(KoText, { text: "필수" })
									})]
								}), /* @__PURE__ */ jsx("span", {
									className: "mt-0.5 block text-[20px] font-semibold tracking-tight text-fg",
									children: genrePicked ? /* @__PURE__ */ jsx(KoText, { text: genre.label }) : /* @__PURE__ */ jsx(KoText, { text: "장르를 선택하세요" })
								})] }), /* @__PURE__ */ jsx(ChevronDown, { className: "size-5 text-fg-muted" })]
							}),
							children: [
								/* @__PURE__ */ jsx(GenreGroup, {
									heading: "Original",
									items: originalGenres,
									selected: genrePicked ? genreId : "",
									tones: genreTones,
									live: genreLive,
									onPick: pickGenre
								}),
								/* @__PURE__ */ jsx(GenreGroup, {
									heading: "Collection",
									items: collectionGenres,
									selected: genrePicked ? genreId : "",
									tones: genreTones,
									live: genreLive,
									onPick: pickGenre
								}),
								/* @__PURE__ */ jsx(GenreGroup, {
									heading: "Other Genre",
									items: distinctGenres,
									selected: genrePicked ? genreId : "",
									tones: genreTones,
									live: genreLive,
									onPick: pickGenre
								})
							]
						})]
					}),
					genrePicked ? /* @__PURE__ */ jsxs(Fragment, { children: [isDistinct ? /* @__PURE__ */ jsx(Suspense, {
						fallback: /* @__PURE__ */ jsx("p", {
							className: "mt-8 text-sm text-fg-subtle",
							children: /* @__PURE__ */ jsx(KoText, { text: genreId === "cover-reborn" ? "커버곡 여는 중" : "사연곡 여는 중" })
						}),
						children: /* @__PURE__ */ jsx(StoryHome, { genreId: genreId === "cover-reborn" ? "cover-reborn" : "your-story" }, genreId === "cover-reborn" ? "cover-reborn" : "your-story")
					}) : isKpop ? /* @__PURE__ */ jsxs(Fragment, { children: [gateOpen ? /* @__PURE__ */ jsxs("div", {
						className: "mt-5 grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => pickKpopMode("browse"),
							className: cn("flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold", kpopMode === "browse" ? "bg-mark text-mark-fg" : "bg-surface text-fg"),
							children: "열람"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => pickKpopMode("compose"),
							className: cn("flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold", kpopMode === "compose" ? "bg-mark text-mark-fg" : "bg-surface text-fg"),
							children: "신곡 입력"
						})]
					}) : null, gateOpen && kpopMode === "compose" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("label", {
						className: "mt-5 block",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase",
							children: ["EP번호, 제목", /* @__PURE__ */ jsx("span", {
								className: "rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg",
								children: "필수"
							})]
						}), /* @__PURE__ */ jsx("input", {
							value: kpopHead,
							onChange: (e) => setKpopHead(e.target.value),
							placeholder: "EP.41 제목",
							className: "mt-2 w-full rounded-xl border border-mark/70 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
						})]
					}), /* @__PURE__ */ jsxs("label", {
						className: "mt-4 block",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-2 text-xs font-medium tracking-widest text-fg-subtle uppercase",
							children: ["가사", /* @__PURE__ */ jsx("span", {
								className: "rounded-sm bg-mark px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mark-fg",
								children: "필수"
							})]
						}), /* @__PURE__ */ jsx("textarea", {
							value: kpopLyrics,
							onChange: (e) => setKpopLyrics(e.target.value),
							rows: 10,
							className: "mt-2 min-h-52 w-full resize-y rounded-xl border border-mark/70 bg-surface px-3 py-2.5 font-mono text-sm leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark"
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-4",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-xs font-medium tracking-widest text-fg-subtle uppercase",
							children: "보컬정보"
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-2",
							children: /* @__PURE__ */ jsx(CastRadios, {
								value: kpopVocal,
								onChange: (next) => {
									setKpopVocal(next);
									setThumbCast(next);
								}
							})
						})]
					}), /* @__PURE__ */ jsx(Button, {
						type: "button",
						size: "lg",
						variant: composeDirty ? "mark" : "secondary",
						disabled: !composeDirty,
						className: "mt-4 w-full",
						onClick: saveCompose,
						children: "원곡 저장"
					}), /* @__PURE__ */ jsx(GenerateBar, {
						busy: busy || filling,
						savedReady: false,
						label: "생성 · 원곡",
						onGenerate: requestGenerate,
						error
					})] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsx(ActRow, {
							acts: kpopActs,
							actN,
							genreId,
							onPick: pickAct,
							unlocked: gateOpen,
							readyActs,
							bundleAct: bundleOpen && !epN ? actN : 0,
							onToggleBundle: toggleActBundle,
							youtubeUrl: epN ? readPlaylistYoutubeUrl(genreId, actN) : ytDraft.trim() || readPlaylistYoutubeUrl(genreId, actN),
							mvUrl: epN ? readPlaylistMvUrl(genreId, actN) : mvDraft.trim() || readPlaylistMvUrl(genreId, actN),
							playlistConfirmed: isConfirmed("playlist", genreId, String(actN))
						}),
						/* @__PURE__ */ jsxs("section", {
							className: "mt-5",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "text-xs font-medium tracking-widest text-fg-subtle uppercase",
								children: [/* @__PURE__ */ jsx(KoText, { text: "원곡" }), /* @__PURE__ */ jsx("span", {
									className: "ml-1.5 font-normal normal-case tracking-normal text-fg-subtle",
									children: /* @__PURE__ */ jsx(KoText, { text: "(번호 + 제목)" })
								})]
							}), /* @__PURE__ */ jsx(EpSongList, {
								tracks: kpopTracks,
								epN,
								workN: fillWorkN,
								confirmedEps,
								youtubeByEp,
								mvByEp,
								sunoByEp,
								genreId,
								unlocked: gateOpen,
								pinned: filling || fillPeek,
								onPick: pickEp,
								onDismiss: dismissResult
							})]
						}),
						placeUnderSong(!sortOn && !epN && (bundleOpen || filling || fillPeek) ? /* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							id: "studio-result",
							children: [
								busy && !filling ? /* @__PURE__ */ jsx(BusyBox, { text: "묶음 작성 중" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
									/* @__PURE__ */ jsx(SongFileBar, {
										target: {
											kind: "act",
											genreId,
											act: actN,
											title: ""
										}
									}),
									/* @__PURE__ */ jsx(CastBar, {
										value: thumbCast,
										saved: playlist?.thumbCast ?? defaultThumbCast(genreId),
										onChange: (next) => {
											castTouch.current = pageKey;
											setThumbCast(next);
										},
										onSave: saveThumbCast,
										readOnly: false
									}),
									/* @__PURE__ */ jsx(PlaylistView, {
										pkg: paneList ?? shownPlaylist ?? emptyPlaylist(),
										showCommunity: pref.actOutput.letter,
										showDescLyrics: pref.descLyrics,
										output: pref.actOutput,
										locks,
										busyId: busyBlock,
										onToggleLock: toggleLock,
										onRegen,
										onPatch,
										onRegenImage,
										imageBusy: busyBlock === "thumb-img",
										sealed: pageConfirmed && !adminHere,
										focusId: filling ? fillFocus?.id : null,
										focusPhase: filling ? fillFocus?.phase : null,
										markIds: fillMarks,
										order: pref.outputOrder,
										sunoBase: pref.sunoBase,
										draftScope: pageKey,
										sunoUrl: sunoShown,
										audioAnalysis: audioAnalysisText,
										audioLevel: audioLevelText,
										fileFields: snapReady ? fileFields.current.fields : undefined,
										fileKnown: snapReady,
										editKey: pageKey,
										onSunoUrl: (value) => {
											typeSuno(value);
										},
										onAnalysis: (value) => {
											typeAnalysis(value);
										},
										onLevel: (value) => {
											typeLevel(value);
										}
									}),
									/* @__PURE__ */ jsx(ResultActions, {
										busy,
										complete: canConfirm,
										confirmed: pageConfirmed,
								revise: adminHere,
										hasBody: Boolean(shownPlaylist && hasPlaylistBody(shownPlaylist)),
										onSave: () => void saveVisible(),
								saveDirty,
								onPatch,
								draftScope: pageKey,
										onRegenAll: () => requestGenerate("replace"),
										onConfirm: confirmPage,
										error: null,
										lead: /* @__PURE__ */ jsx(YoutubeField, {
											value: ytShown,
											onChange: (value) => {
												setYtDraft(value);
												ytLive.current = value;
											},
											onSave: saveYoutube,
									mvValue: mvDraft,
									onMvChange: (value) => {
										setMvDraft(value);
										mvLive.current = value;
									},
									onMvSave: saveMv,
									songPremium: ytPremium,
									onSongPremium: (on) => savePremium("song", on),
									mvPremium: mvPremium,
									onMvPremium: (on) => savePremium("mv", on),
									fileUrl: snapReady ? String(fileFields.current.fields.youtubeUrl || "") : "",
									fileMv: snapReady ? String(fileFields.current.fields.mvUrl || "") : "",
									fileKnown: snapReady
										}, `act-yt-${actN}`)
									})
								] })
							]
						}) : null),
						placeUnderSong(!sortOn && epN && storedOrig && gateOpen ? /* @__PURE__ */ jsxs("div", {
							id: "studio-result",
							className: "mt-4 flex min-w-0 flex-col gap-4",
							children: [
							/* @__PURE__ */ jsx(OrigSourceFields, {
								ep: epN,
								title: origDraft.title,
								vocal: origDraft.vocal,
								lyrics: origDraft.lyrics,
								showTitle: true,
								showVocal: true,
								showLyrics: true,
								onChange: (next) => setOrigDraft({
									title: next.title,
									vocal: next.vocal,
									lyrics: next.lyrics
								})
							}),
							/* @__PURE__ */ jsx(Button, {
								type: "button",
								size: "lg",
								variant: origDirty ? "mark" : "secondary",
								disabled: !origDirty,
								className: "w-full",
								onClick: saveOriginal,
								children: "원곡 저장"
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-sm font-semibold text-fg",
								children: [
									"결과 · EP.",
									padEp(epN),
									" ",
									origDraft.title || storedOrig.title
								]
							}),
							/* @__PURE__ */ jsx(ResultPane, {
								omitAnchor: true,
								busy: busy && !filling,
								single: paneSong,
								showLetter: pref.community,
								showSuno: false,
								showDescLyrics: pref.descLyrics,
								hideSource: true,
								output: pref.output,
								order: pref.outputOrder,
								source: shownSource,
								sunoBase: pref.sunoBase,
								sunoUrl: sunoShown,
										audioAnalysis: audioAnalysisText,
										audioLevel: audioLevelText,
								fileFields: snapReady ? fileFields.current.fields : undefined,
								fileKnown: snapReady,
								editKey: pageKey,
								fileTarget: {
									kind: "song",
									genreId,
									ep: padEp(epN),
									title: origDraft.title || storedOrig.title || ""
								},
										onSunoUrl: (value) => {
									typeSuno(value);
								},
								onAnalysis: (value) => {
									typeAnalysis(value);
								},
								onLevel: (value) => {
									typeLevel(value);
								},
								thumbCast,
								savedCast: rawSong?.thumbCast ?? defaultThumbCast(genreId),
								onCastChange: (next) => {
									castTouch.current = pageKey;
									setThumbCast(next);
								},
								onCastSave: saveThumbCast,
								locks,
								busyBlock,
								onToggleLock: toggleLock,
								onRegen,
								onPatch,
								onRegenImage,
								focusId: filling ? fillFocus?.id : null,
								focusPhase: filling ? fillFocus?.phase : null,
										markIds: fillMarks,
								onSave: () => void saveVisible(),
								saveDirty,
								draftScope: pageKey,
								onRegenAll: () => requestGenerate("replace"),
								confirmed: pageConfirmed,
								revise: adminHere,
								confirmReady: hasPageBody(songPkg) || urlReady,
								onConfirm: confirmPage,
								error: null,
								lead: /* @__PURE__ */ jsx(YoutubeField, {
									value: ytShown,
									onChange: (value) => {
										setYtDraft(value);
										ytLive.current = value;
									},
									onSave: saveYoutube,
									mvValue: mvDraft,
									onMvChange: (value) => {
										setMvDraft(value);
										mvLive.current = value;
									},
									onMvSave: saveMv,
									songPremium: ytPremium,
									onSongPremium: (on) => savePremium("song", on),
									mvPremium: mvPremium,
									onMvPremium: (on) => savePremium("mv", on),
									fileUrl: snapReady ? String(fileFields.current.fields.youtubeUrl || "") : "",
									fileMv: snapReady ? String(fileFields.current.fields.mvUrl || "") : "",
									fileKnown: snapReady
								}, padEp(epN) || "yt")
							})
						] }) : null)
					] })] }) : /* @__PURE__ */ jsxs(Fragment, { children: [fillPeek ? null : /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsx(ActRow, {
							acts: visibleActs,
							actN,
							genreId,
							onPick: pickAct,
							unlocked: gateOpen,
							readyActs,
							bundleAct: bundleOpen && !epN ? actN : 0,
							onToggleBundle: toggleActBundle,
							youtubeUrl: epN ? readPlaylistYoutubeUrl(genreId, actN) : ytDraft.trim() || readPlaylistYoutubeUrl(genreId, actN),
							mvUrl: epN ? readPlaylistMvUrl(genreId, actN) : mvDraft.trim() || readPlaylistMvUrl(genreId, actN),
							playlistConfirmed: isConfirmed("playlist", genreId, String(actN))
						}),
						/* @__PURE__ */ jsxs("section", {
							className: "mt-5",
							children: [
								/* @__PURE__ */ jsx(EpSongList, {
									tracks: actTracks,
									epN,
									workN: fillWorkN,
									confirmedEps,
									readyEps: [],
									youtubeByEp,
								mvByEp,
								sunoByEp,
									genreId,
									unlocked: gateOpen,
									pinned: filling || fillPeek,
									onPick: pickEp,
									onDismiss: dismissResult
								}),
								ep ? /* @__PURE__ */ jsx("p", {
									className: "mt-2 text-sm text-fg-muted",
									children: `단곡 · EP.${ep.n} ${ep.title}`
								}) : null
							]
						}),
					] }), placeUnderSong(!sortOn && ((isSingle && gateOpen) || bundleOpen || filling || fillPeek) ? /* @__PURE__ */ jsxs("div", {
						className: resultHost && isSingle || playlistHost && !isSingle ? fillPeek ? "min-w-0 pb-36" : "min-w-0" : fillPeek ? "mt-5 pb-36" : "mt-8",
						id: "studio-result",
						children: [fillPeek ? /* @__PURE__ */ jsxs("p", {
							className: "mb-3 text-sm font-medium text-mark",
							children: [
								"EP.",
								padEp(epN),
								" ",
								ep?.title || songPkg?.confirmedTitle || "",
								" 열람"
							]
						}) : null, busy && !filling ? /* @__PURE__ */ jsx(BusyBox, { text: isSingle ? "단곡 패키지 작성 중" : "묶음 작성 중" }) : isSingle ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx(SongFileBar, {
								target: {
									kind: "song",
									genreId,
									ep: padEp(epN),
									title: ep?.title || songPkg?.confirmedTitle || ""
								}
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mb-3 text-sm font-semibold text-fg",
								children: [
									"지금 곡 · EP.",
									padEp(epN),
									" ",
									ep?.title || songPkg?.confirmedTitle || ""
								]
							}),
							/* @__PURE__ */ jsx(CastBar, {
								value: thumbCast,
								saved: rawSong?.thumbCast ?? defaultThumbCast(genreId),
								onChange: (next) => {
									castTouch.current = pageKey;
									setThumbCast(next);
								},
								onSave: saveThumbCast,
								readOnly: false
							}),
							/* @__PURE__ */ jsx(PackageView, {
								pkg: paneSong ?? rawSong ?? emptyStudio(),
								showLetter: pref.community,
								showSuno: genreWantsSuno(genre.id),
								showDescLyrics: pref.descLyrics,
								hideSource: genre.kind === "original",
								output: pref.output,
								source: shownSource,
								locks,
								busyId: busyBlock,
								onToggleLock: toggleLock,
								onRegen,
								onPatch,
								onRegenImage,
								imageBusy: busyBlock === "thumb-img",
								sealed: pageConfirmed && !adminHere,
								focusId: filling ? fillFocus?.id : null,
								focusPhase: filling ? fillFocus?.phase : null,
										markIds: fillMarks,
								order: pref.outputOrder,
								sunoBase: pref.sunoBase,
										draftScope: pageKey,
								sunoUrl: sunoShown,
										audioAnalysis: audioAnalysisText,
										audioLevel: audioLevelText,
								fileFields: snapReady ? fileFields.current.fields : undefined,
								fileKnown: snapReady,
								editKey: pageKey,
										onSunoUrl: (value) => {
									typeSuno(value);
								},
								onAnalysis: (value) => {
									typeAnalysis(value);
								},
								onLevel: (value) => {
									typeLevel(value);
								}
							}),
							/* @__PURE__ */ jsx(ResultActions, {
								busy,
								complete: canConfirm,
								confirmed: pageConfirmed,
								revise: adminHere,
								hasBody: Boolean(pkg && hasPageBody(pkg)),
								onSave: () => void saveVisible(),
								saveDirty,
								onPatch,
								draftScope: pageKey,
								onRegenAll: () => requestGenerate("replace"),
								onConfirm: confirmPage,
								error: null,
								lead: /* @__PURE__ */ jsx(YoutubeField, {
									value: ytShown,
									onChange: (value) => {
										setYtDraft(value);
										ytLive.current = value;
									},
									onSave: saveYoutube,
									mvValue: mvDraft,
									onMvChange: (value) => {
										setMvDraft(value);
										mvLive.current = value;
									},
									onMvSave: saveMv,
									songPremium: ytPremium,
									onSongPremium: (on) => savePremium("song", on),
									mvPremium: mvPremium,
									onMvPremium: (on) => savePremium("mv", on),
									fileUrl: snapReady ? String(fileFields.current.fields.youtubeUrl || "") : "",
									fileMv: snapReady ? String(fileFields.current.fields.mvUrl || "") : "",
									fileKnown: snapReady
								}, padEp(epN) || "yt")
							})
						] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx(SongFileBar, {
								target: {
									kind: "act",
									genreId,
									act: actN,
									title: ""
								}
							}),
							/* @__PURE__ */ jsx(CastBar, {
								value: thumbCast,
								saved: playlist?.thumbCast ?? defaultThumbCast(genreId),
								onChange: (next) => {
									castTouch.current = pageKey;
									setThumbCast(next);
								},
								onSave: saveThumbCast,
								readOnly: false
							}),
							/* @__PURE__ */ jsx(PlaylistView, {
								pkg: paneList ?? shownPlaylist ?? emptyPlaylist(),
								showCommunity: pref.actOutput.letter,
								showDescLyrics: pref.descLyrics,
								output: pref.actOutput,
								locks,
								busyId: busyBlock,
								onToggleLock: toggleLock,
								onRegen,
								onPatch,
								onRegenImage,
								imageBusy: busyBlock === "thumb-img",
								sealed: pageConfirmed && !adminHere,
								focusId: filling ? fillFocus?.id : null,
								focusPhase: filling ? fillFocus?.phase : null,
										markIds: fillMarks,
								order: pref.outputOrder,
								sunoBase: pref.sunoBase,
										draftScope: pageKey,
								sunoUrl: sunoShown,
										audioAnalysis: audioAnalysisText,
										audioLevel: audioLevelText,
								fileFields: snapReady ? fileFields.current.fields : undefined,
								fileKnown: snapReady,
								editKey: pageKey,
										onSunoUrl: (value) => {
									typeSuno(value);
								},
								onAnalysis: (value) => {
									typeAnalysis(value);
								},
								onLevel: (value) => {
									typeLevel(value);
								}
							}),
							/* @__PURE__ */ jsx(ResultActions, {
								busy,
								complete: canConfirm,
								confirmed: pageConfirmed,
								revise: adminHere,
								hasBody: Boolean(shownPlaylist && hasPlaylistBody(shownPlaylist)),
								onSave: () => void saveVisible(),
								saveDirty,
								onPatch,
								draftScope: pageKey,
								onRegenAll: () => requestGenerate("replace"),
								onConfirm: confirmPage,
								error: null,
								lead: /* @__PURE__ */ jsx(YoutubeField, {
									value: ytShown,
									onChange: (value) => {
										setYtDraft(value);
										ytLive.current = value;
									},
									onSave: saveYoutube,
									mvValue: mvDraft,
									onMvChange: (value) => {
										setMvDraft(value);
										mvLive.current = value;
									},
									onMvSave: saveMv,
									songPremium: ytPremium,
									onSongPremium: (on) => savePremium("song", on),
									mvPremium: mvPremium,
									onMvPremium: (on) => savePremium("mv", on),
									fileUrl: snapReady ? String(fileFields.current.fields.youtubeUrl || "") : "",
									fileMv: snapReady ? String(fileFields.current.fields.mvUrl || "") : "",
									fileKnown: snapReady
								}, `act-yt-${actN}`)
							})
						] })]
					}) : null)] })] }) : null
						]
					})
						]
					}),
					/* @__PURE__ */ jsx("div", { id: "studio-split-pane", className: "studio-split-pane min-w-0" })
				]
			}),
			/* @__PURE__ */ jsx(UnlockDialog, {
				open: gateAsk,
				mode: gateOpen ? "close" : "open",
				onClose: () => setGateAsk(false),
				onDone: (opened) => {
					if (!opened) setHealthOpen(false);
				}
			}),
			versionOpen ? /* @__PURE__ */ jsx(VersionSheet, {
				buildLabel,
				onClose: () => setVersionOpen(false)
			}) : null,
			/* @__PURE__ */ jsx(CastDialog, {
				open: castOpen,
				value: thumbCast,
				onChange: setThumbCast,
				onConfirm: confirmCast,
				onCancel: () => setCastOpen(false)
			}),
			healthOpen ? /* @__PURE__ */ jsx(HealthSheet, { onClose: () => {
				holdHealth(false);
				setHealthOpen(false);
			} }) : null,
			unconfirmOpen ? /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 z-[60] flex items-end justify-center bg-fg/50 sm:items-center",
				onClick: () => {
					setUnconfirmOpen(false);
					setUnconfirmEp("");
				},
				children: /* @__PURE__ */ jsxs("section", {
					className: "w-full max-w-md rounded-t-2xl border border-mark/50 bg-bg px-5 py-4 sm:rounded-2xl",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ jsxs("p", {
							className: "flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-fg",
							children: ["Grok ", /* @__PURE__ */ jsx("span", {
								className: "text-mark",
								children: "대기"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-3 text-sm leading-relaxed text-fg",
							children: "진행하시겠습니까?"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs leading-relaxed text-fg-muted",
							children: "확정이 풀리고 잠금이 다시 보입니다. 수정한 뒤 확정을 다시 누르면 열람·복사만 됩니다."
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ jsx(Button, {
								type: "button",
								variant: "secondary",
								size: "lg",
								className: "w-full",
								onClick: () => {
									setUnconfirmOpen(false);
									setUnconfirmEp("");
								},
								children: "아니오"
							}), /* @__PURE__ */ jsx(Button, {
								type: "button",
								variant: "mark",
								size: "lg",
								className: "w-full",
								onClick: unconfirmPage,
								children: "진행"
							})]
						})
					]
				})
			}) : null,
			resultBar ? /* @__PURE__ */ jsxs("div", {
				id: "result-status",
				role: "status",
				className: "fixed inset-x-0 bottom-[var(--jukebox-cover,0px)] z-40 overflow-hidden border-t border-white/25 bg-black text-white",
				children: [
					busy || busyBlock ? /* @__PURE__ */ jsx("span", { "aria-hidden": true, className: "notice-glow" }) : null,
					busy || busyBlock ? /* @__PURE__ */ jsx("span", { "aria-hidden": true, className: "notice-sweep" }) : null,
					busy || busyBlock ? /* @__PURE__ */ jsxs("div", {
						className: "px-4 py-3",
						children: [
							/* @__PURE__ */ jsxs("p", {
								className: "text-[15px] font-semibold tracking-tight text-white",
								children: ["Grok ", /* @__PURE__ */ jsx("span", { className: "text-mark wake-word", children: "작동 중" })]
							}),
							/* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-medium text-white", children: workTitle || "곡" }),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2 h-2 overflow-hidden rounded-full bg-white/15",
								children: /* @__PURE__ */ jsx("div", { className: "h-full bg-mark transition-[width] duration-300", style: { width: busyBlock ? "46%" : "22%" } })
							}),
							/* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-snug text-white", children: workLine })
						]
					}) : /* @__PURE__ */ jsx("p", {
						className: "truncate px-4 py-2 text-left text-[13px] leading-5 text-white",
						title: noticeShown(resultNote),
						children: `Grok 알림 - ${noticeShown(resultNote)}`
					})
				]
			}) : null,
			/* @__PURE__ */ jsx(PlayNotice, {}),
			/* @__PURE__ */ jsx(MiniCorner, {}),
			/* @__PURE__ */ jsx(InstallAsk, {}),
			gateOpen && genrePicked && !isDistinct && noticeMode === "hidden" && padEp(epN) ? /* @__PURE__ */ jsx("button", {
				type: "button",
				"aria-label": "이 곡 검사하고 채우기",
				disabled: filling,
				onPointerDown: (event) => event.stopPropagation(),
				onClick: (event) => {
					event.preventDefault();
					event.stopPropagation();
					startFill();
				},
				className: "fixed right-4 z-40 inline-flex size-11 touch-manipulation items-center justify-center rounded-full border border-mark/45 bg-mark/25 text-mark shadow-lg backdrop-blur-md disabled:opacity-50 bottom-[calc(var(--notice-lift,0px)+var(--jukebox-cover,0px)+4.75rem+env(safe-area-inset-bottom))]",
				"data-float": "1",
				children: /* @__PURE__ */ jsx(ListPlus, { className: "size-5" })
			}) : null,
			genrePicked ? /* @__PURE__ */ jsx("button", {
				type: "button",
				"aria-label": "위로 가기",
				onPointerDown: (event) => event.stopPropagation(),
				onClick: (event) => {
					event.preventDefault();
					event.stopPropagation();
					appScrollTo(0, "smooth");
				},
				className: "fixed right-4 z-40 inline-flex size-11 touch-manipulation items-center justify-center rounded-full border border-white/25 bg-[#1c1c1e]/90 text-white shadow-lg backdrop-blur-md bottom-[calc(var(--notice-lift,0px)+var(--jukebox-cover,0px)+max(1.25rem,env(safe-area-inset-bottom)))]",
				"data-float": "1",
				children: /* @__PURE__ */ jsx(ArrowUp, { className: "size-5" })
			}) : null
		]
	});
}
var healthSheetOwner = 0;
var healthSheetSeq = 1;
var healthTask = null;
function loadHealthReport(onStep) {
	const task = runHealthCheck(onStep).then((result) => {
		writeHealthReport(result);
		return result;
	});
	healthTask = task;
	return task;
}
function HealthSheet({ onClose }) {
	const token = useRef(0);
	const [show, setShow] = useState(false);
	const [step, setStep] = useState("검사를 시작합니다");
	const [pct, setPct] = useState(4);
	const [report, setReport] = useState(null);
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		const mine = healthSheetSeq++;
		token.current = mine;
		if (healthSheetOwner || document.getElementById("noa-health-sheet")) return;
		healthSheetOwner = mine;
		setShow(true);
		return () => {
			if (healthSheetOwner === mine) healthSheetOwner = 0;
		};
	}, []);
	useEffect(() => {
		if (!show) return;
		let live = true;
		setReport(null);
		setStep("앱 내용을 읽는 중");
		setPct(1);
		loadHealthReport((label, n) => {
			if (!live) return;
			setStep(label);
			setPct(n);
		}).then((result) => {
			if (live) setReport(result);
		});
		return () => {
			live = false;
		};
	}, [show]);
	const issues = report?.issues ?? [];
	if (!show || typeof document === "undefined") return null;
	return createPortal(/* @__PURE__ */ jsxs("div", {
		id: "noa-health-sheet",
		className: "fixed inset-x-0 top-0 z-[80] overflow-hidden bg-black text-white",
		children: [
			report ? null : /* @__PURE__ */ jsx("span", { "aria-hidden": true, className: "notice-glow" }),
			report ? null : /* @__PURE__ */ jsx("span", { "aria-hidden": true, className: "notice-sweep" }),
			/* @__PURE__ */ jsxs("section", {
			className: "relative max-h-[62dvh] w-full overflow-y-auto bg-black px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3",
			children: [
				/* @__PURE__ */ jsxs("p", {
					className: "flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-fg",
					children: ["Grok ", /* @__PURE__ */ jsx("span", {
						className: "text-mark",
						children: report ? "대기" : "작동 중"
					})]
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-2 text-[18px] font-semibold tracking-tight text-fg",
					children: report ? issues.length ? "버그 리포트" : "문제 없음" : "완결성 검사"
				}),
				report ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("p", {
					className: "mt-2 text-sm leading-relaxed text-fg-muted",
					children: [
						"확정 ",
						report.counts.confirmed,
						" · 잠금 ",
						report.counts.locked,
						" · 빈 칸 ",
						report.counts.empty,
						" · 대충 ",
						report.counts.rough,
						" · 일부 ",
						report.counts.partial
					]
				}), issues.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("ul", {
						className: "mt-3 flex max-h-40 flex-col gap-2 overflow-y-auto",
						children: issues.slice(0, 8).map((issue, index) => /* @__PURE__ */ jsxs("li", {
							className: "rounded-xl border border-border bg-surface px-3 py-2",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium text-fg",
								children: issue.title
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs leading-relaxed text-fg-muted",
								children: issue.detail
							})]
						}, `${issue.code}-${index}`))
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-xs text-fg-subtle",
						children: "그록에게 보낼 문장"
					}),
					/* @__PURE__ */ jsx("textarea", {
						readOnly: true,
						value: report.paste,
						className: "mt-1 max-h-36 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-fg"
					}),
					/* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "mark",
						size: "lg",
						className: "mt-2 w-full",
						onClick: () => {
							copyText(report.paste).then((ok) => {
								if (!ok) return;
								setCopied(true);
								window.setTimeout(() => setCopied(false), 1600);
							});
						},
						children: copied ? "복사됨" : "복붙문 복사"
					})
				] }) : /* @__PURE__ */ jsx("p", {
					className: "mt-3 text-sm leading-relaxed text-fg",
					children: "저장 위치, 원곡, 설정, 재생목록에서 발견한 문제가 없습니다."
				})] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm leading-relaxed text-fg",
					children: step
				}), /* @__PURE__ */ jsxs("div", {
					className: "relative mt-3 h-7 overflow-hidden rounded-md bg-surface",
					children: [/* @__PURE__ */ jsx("div", {
						className: "absolute inset-y-0 left-0 bg-mark/70",
						style: { width: `${pct}%` }
					}), /* @__PURE__ */ jsxs("span", {
						className: "relative flex h-full items-center justify-center text-[11px] font-medium text-fg",
						children: [pct, "%"]
					})]
				})] }),
				/* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "secondary",
					size: "lg",
					className: "mt-4 w-full",
					onClick: onClose,
					children: "닫기"
				})
			]
		}),
		]
	}), document.body);
}
function snapOf(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
