// @ts-nocheck
import unifiedMaster from "../data/unified-master.md?raw";
import {
  ACTS,
  COMMON_LOCKS,
  GENRES,
  formatGenreCard,
  formatTracklist,
  formatTimedTracklist,
  asTimedTracklist,
  genreWantsSuno,
  getAct,
  getEp,
  getGenre,
  isEpNumber,
  padEp,
  playlistTitlePrefix,
} from "./catalog";
import {
  CAST,
  STORY_BRAND,
  asThumbCast,
  geminiIdentityLine,
  idsForThumbCast,
  identityPrompt,
} from "./characters";
import { cleanDescriptionLyrics, descriptionWithTracklist, descriptionWithoutLyrics, sungLyrics, withCoverCredit, coverYoutubeTitle } from "./lyrics-clean";
import {
  BLOCK_JSON_SCHEMA,
  GROK_THUMB_SCHEMA,
  PACKAGE_JSON_SCHEMA,
  PLAYLIST_JSON_SCHEMA,
  STORY_JSON_SCHEMA,
  normalizePackage,
  normalizePlaylist,
  normalizeStory,
  titleOwnedByOtherEp,
} from "./package";
import { defaultPref, langLabel, langScope, mergeStoredPref, normalizePref, prefOutputLang } from "./user-prefs";
import { applyPrefToStudio } from "./fill-local";
import { SEED_ORIGINALS } from "./originals-seed";
import { getOriginal } from "./originals";
import { readGenreGuide, readSunoBase } from "./genre-guides";
import { joseonActMood, joseonLedgerPrompt } from "./joseon-ledger";
import { FANTASY_ACT_MOOD, FANTASY_PLAYLIST_TITLE, fantasyLedgerPrompt, fantasyMood } from "./fantasy-ledger";
import { readEncPref } from "./encyclopedia.server";

const COMMON_KEYS = ["titleFormat", "fixRule", "descRules", "communityRules", "thumbImage", "thumbFont", "thumbDecor", "thumbLayout", "youtubeSeo", "sunoLimit", "outputOrder", "thumbCastRule", "fillAudit", "fieldAudit", "lockRule", "matchRule", "liveRule", "fillNotice", "splashRule", "buildGuide", "designRule", "listRule", "healthRule", "saveRule", "placeRule", "linkRule"];

function livePref(id, client) {
	try {
		const diskCommon = { ...(readEncPref("__common") || {}) };
		const loaded = client && typeof client.listRule === "string" && client.listRule.includes("주크위치=");
		if (loaded) {
			for (const key of COMMON_KEYS) {
				const value = client[key];
				if (typeof value !== "string" || !value.trim()) continue;
				if (key === "thumbFont" && !value.includes("글씨 크기는 공통")) continue;
				diskCommon[key] = value;
			}
		}
		const genre = loaded ? client : readEncPref(id);
		return mergeStoredPref(id, genre, diskCommon);
	} catch {
		return client;
	}
}

function scopeOf(pref) {
	return langScope(String(pref?.langRule || ""));
}
function namedTargets(pref) {
	const scope = scopeOf(pref);
	const names = [];
	if (scope.has("title")) names.push("제목");
	if (scope.has("lyrics")) names.push("가사");
	if (scope.has("thumbText")) names.push("썸네일 표시 텍스트");
	if (scope.has("desc")) names.push("설명란");
	if (scope.has("letter")) names.push("커뮤니티 작성글");
	if (scope.has("summary")) names.push("요약");
	if (scope.has("ytTitle")) names.push("유튜브 제목");
	return names;
}
function keepLang(on, langName) {
	return on ? langName : "주사용 언어로 번역하지 마. 언어 규칙에 이 항목이 없다.";
}
function wrongSpoken(lang, text) {
	const body = String(text || "").replace(/https?:\/\/\S+/g, "").replace(/#[^\s#]+/g, "");
	const hangul = (body.match(/[가-힣]/g) ?? []).length;
	const kana = (body.match(/[\u3040-\u30ff]/g) ?? []).length;
	const thai = (body.match(/[\u0E00-\u0E7F]/g) ?? []).length;
	const latin = (body.match(/[A-Za-z]/g) ?? []).length;
	if (lang === "ja") return kana < 8 && hangul > 12;
	if (lang === "th") return thai < 8 && hangul > 12;
	if (lang === "en") return latin < 24 && hangul > 20;
	return false;
}
function fanName(genre, pref) {
	if (genre?.fanLetter) return genre.fanLetter;
	const lang = prefOutputLang(genre?.id, pref?.lang ?? "default");
	if (lang === "ja") return "星群れ";
	if (lang === "en") return "Starlight";
	if (lang === "th") return "กลุ่มดาว";
	return "별무리";
}
function fanHello(fan, lang) {
	if (lang === "ja" || fan === "星群れ") return "星群れの皆さん";
	if (lang === "en" || fan === "Starlight") return "Starlight";
	if (lang === "th" || fan === "กลุ่มดาว") return "กลุ่มดาว";
	return "별무리 여러분";
}
function ensureGreeting(text, hello) {
	const raw = String(text || "").trim();
	if (!raw || !hello) return raw;
	const body = raw.replace(/^(?:\s|\p{Extended_Pictographic}|\uFE0F|\u200D)+/u, "");
	if (body.startsWith(hello)) return raw;
	return `✨ ${hello}\n\n${raw}`;
}
function sealFan(text, fan, lang) {
	const raw = String(text || "");
	if (!raw || lang === "ko" || !fan || fan === "별무리") return raw;
	return raw.replace(/별무리의/g, fan).replace(/별무리/g, fan);
}
function finishLetter(text, genre, pref) {
	const lang = prefOutputLang(genre?.id, pref?.lang ?? "default");
	const fan = fanName(genre, pref);
	return ensureGreeting(sealFan(text, fan, lang), fanHello(fan, lang));
}
function greetOrder(genre, pref) {
	const lang = prefOutputLang(genre?.id, pref?.lang ?? "default");
	const hello = fanHello(fanName(genre, pref), lang);
	return `첫 문단은 팬 인사로 시작한다. 첫 인사는 「${hello}」. 이 인사를 지우거나 본문 한가운데로만 넣지 마.`;
}
function alignYoutubeConfirmed(text, confirmed) {
	const title = String(confirmed || "").trim();
	if (!title) return text;
	const parts = String(text || "").split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
	if (!/^EP\.\d+$/i.test(parts[0] || "") || parts.includes(title) || parts.length < 3) return text;
	parts[1] = title;
	const next = parts.join(" | ");
	return next.length <= 100 ? next : text;
}
function summaryFieldRule(langName, translate) {
	return [
		`summary: 01 요약. ${keepLang(translate, langName)} 절대 한 줄로 끝내지 마. 감성 한줄만 쓰면 실패다.`,
		"형식:",
		"첫 줄 = 시적 감성 한줄. 한 문장. 18~44자. 유튜브 제목·썸네일용.",
		"이 한 줄은 확정 제목과 다른 말이어야 한다. 제목을 조금 늘리거나 줄인 문장, 제목이 그대로 들어 있는 문장은 실패다.",
		"빈 줄.",
		"이어서 곡 진행 4~7문장: ① 누가 어떤 상황인지 ② 감정·관계가 어떻게 바뀌는지 ③ 후렴에서 무엇이 열리는지 ④ 이 장르로 원곡이 어떻게 다시 노래되는지.",
		"원곡 가사 사건 순서를 따른다. 이 곡만의 이야기여야 한다.",
		"금지: \"~의 장면\", 제목만 반복, 장르명만 나열, EP번호, 작업 메모, 한 문장 요약, 광고 문장."
	].join("\n");
}
/** 0순위. UNIFIED-MASTER / 장르 카드 / 원곡 / 요구사항보다 앞선다. */
function userPrefZeroLock(p, genreId) {
	const langName = langLabel(p.lang, genreId);
	const spoken = prefOutputLang(genreId ?? "kpop-original", p.lang);
		const guide = String(p.guideText || "").trim() || (genreId ? readGenreGuide(genreId) : "");
		return [
		"[0순위 강제 조항]",
		"결과창을 만들기 직전에 공통 설정과 이 장르 설정을 다시 읽었다. 아래 숫자가 그 읽기 결과다.",
		"공통 설정, 장르 설정, 장르 지침(0-28)은 같은 0순위다. 0-1부터 0-27과 0-28이 충돌하면 0-1부터 0-27이 이긴다. 그 외 재해석·완화·생략은 실패다.",
		`0-00 잠금 규칙. 메인 자물쇠만 잠그고 푼다. 설정 안 항목 잠금은 없다.\n${p.lockRule || ""}`,
		`0-00a 곡 번호 매치. 이 EP 번호의 결과만 이 칸에 저장하고 읽는다. 다른 곡 결과를 붙이면 실패다.\n${p.matchRule || ""}`,
		`0-00a2 저장 규칙. 이 칸만 저장한다. 빈 글로 있는 곡을 지우지 마. 확정곡과 직접 고친 칸은 덮지 마.\n${p.saveRule || ""}`,
		`0-00a3 저장 위치. 지정한 파일 밖에 곡과 ACT를 두지 마.\n${p.placeRule || ""}`,
		`0-00a4 연결 규칙. 결과창은 그 파일을 먼저 읽는다. 파일이 없으면 연결되지 않은 것이다.\n${p.linkRule || ""}`,
		`0-00b 실시간 현행화. 사용자 설정과 빌드 창은 저장되는 즉시 지금 규칙을 읽는다. 예전 문장을 남겨 두면 실패다.\n${p.liveRule || ""}`,
		`0-00c 알림창·자동 채우기. 아래 규칙대로만 채운다. 확정곡과 잠긴 칸은 건너뛰고, 잘 된 칸은 다시 쓰지 마.\n${p.fillNotice || ""}`,
		`0-00d 메인 화면 영상. 접속할 때 하나만 무작위로 보여주고 반복하지 마.\n${p.splashRule || ""}`,
		`0-00e 곡 목록. 확정은 금색, 순서는 바꾸지 마. 잠긴 곡 결과는 열지 마.\n${p.listRule || ""}`,
		`0-00f 수정 원칙. 요청한 문제만 고친다.\n${p.fixRule || ""}`,
		`0-00g 완결성 검사. 검사 아이콘을 눌렀을 때만 한다.\n${p.healthRule || ""}`,
		`0-00h 디자인. 화면은 이 규칙을 따른다.\n${p.designRule || ""}`,
		`0-0 자동 채우기 사전검열. 곡을 고르고 통과 여부를 가르는 기준이다. 이 줄을 어기면 실패다.\n${p.fillAudit || ""}`,
		`0-0b 결과창 항목 검열. 아래 수치·금지를 못 채운 칸은 실패다. 그 칸만 다시 쓴다.\n${p.fieldAudit || ""}`,
		`0-1 주사용 언어 = ${langName} → 실제 출력 ${langLabel(spoken)}. 규칙에 적힌 항목만 이 언어로 번역한다. 적히지 않은 칸은 번역하지 마. ${String(p.langRule || "").trim() || "제목, 가사, 썸네일 표시 텍스트, 설명란, 커뮤니티 작성글은 이 언어로 변환되어 표시된다."} 수노 프롬프트와 이미지 지시문은 영어.`,
		`0-2 제목 형식 = ${p.titleFormat}  (100자 이내. 형식을 바꾸지 마.)`,
		`0-3 확정 제목 = 결과창의 확정 제목이 그 곡의 제목이다. 제목 고정이라고 원곡 제목을 복사하지 마. 이미 있는 확정 제목은 고정이든 변환이든 유지한다. 사용자가 확정 제목을 바꾸면 그 제목을 따른다. ${p.titleMode === "lock" ? "고정. 확정 제목이 비어 새로 쓸 때도 원곡 제목을 베끼지 마." : scopeOf(p).has("title") ? "변환. 확정 제목이 비어 새로 쓸 때만 원곡 제목을 장르 언어로 바꾼다. 이미 있으면 유지한다." : "변환이어도 언어 규칙에 제목이 없다. 주사용 언어로 번역하지 마."} ${String(p.titleModeRule || "").trim()}`,
		`0-4 썸네일 중심 = ${p.focus === "character" ? "인물. 사람이 훅. 글자는 얼굴 밖." : "텍스트. 제목이 훅. 인물은 글자 자리를 비킨다."}`,
		`0-5 실사 비중 = ${p.reality}%. 나머지는 분위기/빛만. 애니·일러스트·CGI 얼굴 금지.`,
		`0-6 인물 역동성 = ${p.motion}/100 기준. 곡에 따라 ±10만. 창 밖 금지.`,
		`0-7 썸네일 추가사항 = ${p.extra.trim() || "(없음)"}`,
		`0-8 설명란 가사 = ${p.descLyrics ? `예. ━━━━━━━━━━━━━━━━━━━━ 사이에 부른 가사만. 위쪽 선 바로 다음 줄은 주사용 언어다. 한국어는 가사, 일본어는 歌詞, 영어는 Lyrics, 태국어는 เนื้อเพลง. K-POP 원곡은 입력한 원문. ${genreId === "cover-reborn" ? "커버곡은 입력한 커버 가사." : "사연곡은 그 사연 가사."} 그 외 EP는 주사용 언어로 장르에 맞게 개사한 lyricsBlock만. 원곡 원문을 설명란에 넣지 마.` : "아니오. 설명란에 가사·가사 구간을 넣지 마."}`,
		`0-9 커뮤니티 글 = ${p.community ? "예. 반드시 작성." : "아니오. fanLetter/communityPost 는 빈 문자열. 쓰지 마."}`,
		`0-10 설명란 글작성 규칙:\n${p.descRules}`,
		`0-11 커뮤니티 글작성 규칙:\n${p.communityRules}`,
		`0-12 썸네일 이미지 생성규칙:\n${p.thumbImage}`,
		`0-13 글씨체. 크기는 공통 설정, 종류는 이 장르만:\n${p.thumbFont}`,
		`0-14 텍스트 꾸밈:\n${p.thumbDecor}`,
		`0-15 텍스트 배치:\n${p.thumbLayout}`,
		`0-16 수노 기본 프롬프트 = ${p.sunoBase.trim() || "(이 장르 수노 없음)"}`,
		`0-17 보컬 스타일 = ${p.vocalStyle.trim() || "(장르 카드)"}`,
		`0-18 음악 스타일 = ${p.musicStyle.trim() || "(장르 카드)"}`,
		`0-19 유튜브 제목 SEO:\n${p.youtubeSeo}`,
		`0-20 수노 글자 한도 = ${p.sunoLimit}`,
		`0-21 출력 순서 = ${p.outputOrder}`,
		`0-22 썸네일 기본 캐스트:\n${p.thumbCastRule}`,
		`0-23 개사 규칙:\n${p.rewriteRules || "(없음)"}`,
		`0-24 곡 구조 = ${p.structure || "(장르 카드)"}`,
		`0-25 감성 한줄 = ${p.moodLineRule}`,
		`0-26 썸네일 장르표기(보조줄) = ${p.thumbGenreLine}`,
		`0-27 금지 목록 = ${p.forbidList}`,
		outputRule(p),
		genreId === "cover-reborn"
			? "0-29b 커버 플레이리스트 = 자동 생성 아니오. 이 장르 규칙대로, 사용자가 열람에서 곡을 고르고 주제를 입력한 뒤에만 만든다. 사연곡 장르 규칙을 읽지 마. 이 줄은 플레이리스트만이다. 한 곡 영상 설명란과 커뮤니티 글에 쓰지 마. 플레이리스트 설명란의 ━━ 자리에만 고른 곡명을 넣는다. 시간 표시는 붙이지 마. 본문은 공통 설명란 규칙을 따른다. 사연곡으로 부르지 마."
			: genreId === "your-story"
			? "0-29b 사연곡 플레이리스트 = 자동 생성 아니오. 사용자가 생성곡 목록에서 곡을 고르고 주제를 입력한 뒤에만 만든다. 이 줄은 플레이리스트만이다. 한 곡 영상 설명란과 커뮤니티 글에 쓰지 마. 플레이리스트 설명란의 ━━ 자리에만 고른 곡명을 넣는다. 시간 표시는 붙이지 마. 본문은 다른 플레이리스트와 같은 설명란 규칙을 따른다."
			: `0-29b ACT 플레이리스트 = ${p.actPlaylist === false ? "아니오. 10곡이 확정돼도 자동으로 만들지 마." : "예. 10곡이 모두 확정되면 자동으로 만든다. 곡 본문이 캐시에 없어도 확정만으로 만든다."} ACT 결과 칸은 그 장르 곡 결과창과 같다. 0-29에서 아니오인 칸은 비운다. 설명란에서 가사가 들어갈 ━━ 자리는 트랙리스트로 바꾼다. 설명란 가사 설정이 아니오여도 트랙리스트는 무조건 넣는다. 각 줄은 "EP.번호 곡명". 시간은 붙이지 마. 곡명은 받은 제목 그대로. 부른 가사 전문은 쓰지 마.`,
		guide
			? `0-28 장르 지침. 사용자 설정에 저장된 이 장르의 규칙이다. 0-1부터 0-27의 스위치·숫자·직접 고친 문장과 충돌하면 그 설정이 이긴다. 그 외에는 이 지침을 그대로 따른다.\n${guide}`
			: "0-28 장르 지침 = (이 장르 통 지침 없음)",
	].join("\n");
}
function lyricsOrder(genre, prefs, langName, genreId) {
	const structure = String(prefs?.structure || genre.structure || "").trim();
	const rewrite = String(prefs?.rewriteRules || genre.rewrite || "").trim();
	const music = String(prefs?.musicStyle || genre.sound || "").trim();
	const vocal = String(prefs?.vocalStyle || "").trim();
	const forbid = String(prefs?.forbidList || "").trim();
	const cue = genreId === "joseon-ballad"
		? "이 장르만 섹션마다 [Female Vocal]과 영어 연출을 넣는다."
		: "[Female Vocal]과 영어 믹스·드럼 연출은 넣지 마. 조선 발라드가 아니다.";
	return [
		"첫 줄에 제목 금지. 섹션은 수노 명령어다. 반드시 한 줄에 [Intro] [V1] [Chorus]처럼 대괄호만 쓴다. Intro, V1처럼 괄호 없이 쓰면 수노가 그 단어를 가사로 부른다. 실패다.",
		genreId === "kpop-original" ? "입력한 K-POP 원곡 가사를 그대로 둔다. 개사하지 마." : `상단 원곡을 ${langName}로 이 장르 개사 규칙에 맞게 다시 쓴다. 원곡 문장을 그대로 붙이지 마.`,
		structure ? `곡 구조. 이 순서를 빼지 마. 태그 아래에는 반드시 부른 가사를 쓴다. 태그만 두면 실패다. 절은 4줄 이상, 후렴은 6줄 이상.\n${structure}` : "섹션 태그 아래에 가사를 쓴다. 태그만 두면 실패다.",
		rewrite ? `개사 규칙:\n${rewrite}` : "",
		music ? `음악 스타일:\n${music}` : "",
		vocal ? `보컬:\n${vocal}` : "",
		forbid ? `금지:\n${forbid}` : "",
		cue,
		"장르 이름을 가사 줄로 쓰지 마. 악기 목록을 가사에 적지 마.",
		"사용자 요구가 있으면 그 문장대로 고친다."
	].filter(Boolean).join("\n");
}
function sunoCommandLine(line) {
	const row = String(line || "").trim();
	if (!row || /^\[[^\]]+\]$/.test(row)) return row;
	const name = row.replace(/^\[+|\]+$/g, "").trim();
	if (/^(intro|outro|end|hook|drop|break|instrumental|verse(?:\s*\d+)?|v\d+|pre(?:\s*-?\s*chorus|\d+)?|chorus(?:\s*\+\s*hook)?|bass\s*drop|final\s+chorus|final\s+bass\s+drop|pre-?\s*drop|bridge(?:\s+\S+)*)$/i.test(name)) return `[${name}]`;
	return line;
}
function applyGenreLyrics(genreId, value) {
	let text = String(value || "").trim();
	if (!text || genreId === "kpop-original") return text;
	const label = String(getGenre(genreId)?.label || "").trim();
	text = text.split("\n").filter((line) => {
		const row = line.trim();
		if (!row) return true;
		if (row === "..." || row === "…") return false;
		if (label && row.toLowerCase() === label.toLowerCase()) return false;
		if (genreId !== "joseon-ballad" && !/[가-힣]/.test(row) && /\b(reverb|echo|drum|vocal|mix)\b/i.test(row)) return false;
		return true;
	}).map((line) => genreId === "joseon-ballad" ? line : line.replace(/\[Female Vocal\]\s*/gi, "")).map(sunoCommandLine).join("\n");
	return text.replace(/\n{3,}/g, "\n\n").trim();
}
function fieldLock(p, genreId, blockId) {
	const langName = langLabel(prefOutputLang(genreId || "kpop-original", p.lang));
	const lines = [
		"한 칸만 다시 쓴다. JSON {\"value\": string} 만.",
		`언어: ${langName}. 번역 대상인 칸만 이 언어. 수노와 이미지 지시문은 영어.`,
	];
	if (blockId === "title") lines.push(p.titleMode === "lock" ? "확정 제목은 그 곡의 제목이다. 원곡 제목을 복사하지 마. 이미 있는 확정 제목은 유지한다." : `확정 제목이 비어 있을 때만 원곡 제목을 장르에 맞게 바꾼다. 이미 있는 확정 제목은 유지한다. ${String(p.titleModeRule || "").slice(0, 180)}`);
	if (blockId === "lyrics") lines.push(
		String(p.rewriteRules || ""),
		String(p.structure || ""),
		String(p.musicStyle || ""),
		String(p.vocalStyle || ""),
		String(p.forbidList || "")
	);
	if (blockId === "suno") lines.push(`영어. ${p.sunoLimit || 1000}자 이하.`, String(p.sunoBase || "").slice(0, 280));
	if (blockId === "yt-desc" || blockId === "summary") lines.push(String(p.descRules || "").slice(0, 420));
	if (blockId === "letter" || blockId === "community") lines.push(String(p.communityRules || "").slice(0, 360));
	if (blockId === "thumb") lines.push(String(p.thumbImage || "").slice(0, 280));
	if (blockId === "yt-title") lines.push(`형식: ${p.titleFormat}`, String(p.youtubeSeo || "").slice(0, 180));
	return lines.filter((line) => String(line || "").trim()).join("\n");
}
function isGenreId(id) {
	return GENRES.some((g) => g.id === id);
}
function spokenName(genreId, pref) {
	return langLabel(prefOutputLang(genreId, pref?.lang ?? "default"));
}
function cardForUser(genre, pref) {
	const spoken = spokenName(genre.id, pref);
	const card = formatGenreCard(genre);
	const names = namedTargets(pref);
	const line = names.length
		? `언어: ${spoken}. 이 줄은 사용자 설정 0-1이다. 규칙에 적힌 항목만 이 언어: ${names.join("·")}. 적히지 않은 칸은 번역하지 마.`
		: `언어: ${spoken}. 주사용 언어 규칙에 번역 항목이 없다. 결과 글을 이 언어로 바꾸지 마.`;
	const titled = pref?.titleMode === "lock"
		? `${card}\n제목: 사용자 설정 0-3. 결과창의 확정 제목이 그 곡의 제목이다. 원곡 제목을 복사하지 마. 이미 있는 확정 제목은 유지한다.`
		: scopeOf(pref).has("title")
			? `${card}\n제목: 사용자 설정 0-3 변환. 확정 제목이 비어 새로 쓸 때만 원곡 제목을 ${spoken}로 바꾼다. 이미 있는 확정 제목은 유지한다.`
			: `${card}\n제목: 언어 규칙에 제목이 없다. 주사용 언어로 번역하지 마. 이미 있는 확정 제목은 유지한다.`;
	return /^언어:/m.test(titled) ? titled.replace(/^언어:.*$/m, line) : `${titled}\n${line}`;
}
function titleOrder(genre, ep, pref) {
	if (pref?.titleMode === "lock") {
		return `확정 제목은 그 곡의 제목이다. 원곡 「${ep.title}」를 확정 제목에 복사하지 마. 이미 있는 확정 제목은 유지한다. 비어 있을 때만 이 곡의 제목을 새로 쓴다.`;
	}
	return `확정 제목이 비어 있을 때만 원제 「${ep.title}」를 바꾼다. 이미 있는 확정 제목은 고정이든 변환이든 유지한다. 다른 EP의 제목을 가져오면 실패다. ${genre.titleRule} ${scopeOf(pref).has("title") ? `새로 쓸 글자는 ${spokenName(genre.id, pref)}만.` : "언어 규칙에 제목이 없으면 주사용 언어로 바꾸지 마."}`;
}
function lockedTitleFor(_genreId, _epN, _original, _pref) {
	return "";
}
function resolveEp(epN, originalTitle = "") {
	const n = padEp(epN) || epN;
	return {
		n,
		title: originalTitle.trim() || (isEpNumber(n) ? getEp(n).title : "")
	};
}
function fitPlaylistTitle(prefix, mood, genreLabel) {
	const tail = ` | ${genreLabel} | AI Artist Noa`;
	const head = `${prefix} | `;
	let moodLine = mood.trim().replace(/\|/g, "/");
	const maxMood = 100 - head.length - tail.length;
	if (maxMood < 1) return `${prefix}${tail}`.slice(0, 100);
	if (moodLine.length > maxMood) moodLine = moodLine.slice(0, maxMood).trim();
	return `${head}${moodLine}${tail}`;
}
const GEMINI_THUMB = {
	"kpop-original": {
		focus: "TEXT-FIRST. Offset the woman left or right so the title has clear air. She stays fully in frame.",
		reality: "Photoreal 100%. Real skin, fabric, natural light. Fantasy only if lyrics demand, then 90/10.",
		type: "Ivory fashion-editorial serif, medium weight, generous tracking.",
		extra: "Who appears follows the vocal lineup. Solo woman unless vocal notes require more."
	},
	"jpop-original": {
		focus: "TEXT-FIRST. Offset subject for a clean title field. Japanese album-poster calm.",
		reality: "Photoreal 100%. Fantasy only if lyrics demand, then 90/10.",
		type: "Ivory editorial serif or clean Japanese-editorial sans, medium, airy tracking.",
		extra: "Youth-film still, not idol-ad clutter."
	},
	"pop-original": {
		focus: "TEXT-FIRST. Western premium album frame. Subject off-center.",
		reality: "Photoreal 100%. Fantasy only if lyrics demand, then 90/10.",
		type: "Ivory contemporary serif, medium, cinematic tracking.",
		extra: "Quiet prestige, no tour-poster junk."
	},
	"thai-original": {
		focus: "TEXT-FIRST. Warm night or golden hour. Subject off-center for type.",
		reality: "Photoreal 100%. Fantasy only if lyrics demand, then 90/10.",
		type: "Ivory editorial serif, medium-light, generous tracking.",
		extra: "Humid cinematic color, not tropical-cliché collage."
	},
	"joseon-ballad": {
		focus: "TEXT-FIRST. Joseon noble woman in period dress. Hanok, moonlight, lanterns. Title in open sky or empty court.",
		reality: "Photoreal historical 100%. Real silk, wood, night air. No fantasy creatures.",
		type: "Classical elegant serif, thin-to-medium, wide tracking, literary.",
		extra: "8K photoreal. No modern clothes. Face uncovered. Overlay only: EP / title / mood / 조선 발라드."
	},
	panpop: {
		focus: "CHARACTER-DYNAMIC. Modern-hanbok woman in motion. Black and gold. Title still readable and off the face.",
		reality: "Photoreal cinematic 100%. Hard rim light, real fabric sheen.",
		type: "Bold cinematic sans or strong serif, heavy weight, tight tracking, gold/ivory type.",
		extra: "Black + gold + natural skin. Dynamic freeze-frame, not a posed shot. Genre line exactly PANPOP : The New Korean Pop. No neon, cyberpunk, fireworks."
	},
	"echoes-of-joseon": {
		focus: "BALANCED text + two figures. Hanbok woman REQUIRED plus gat-wearing warrior. Joseon night, moonlight.",
		reality: "Photoreal 100%. Period cloth, night grain. No CGI faces.",
		type: "Traditional editorial serif, medium, cinematic.",
		extra: "Invent a short Edition for THIS song only under the title with the genre label. Joseon night dominant, not neon EDM. Warrior + dancer. Face uncovered. Title string is the original title exactly."
	},
	"latin-afrobeats-edm": {
		focus: "CHARACTER-FIRST. Bright woman, neon / beach / festival. Body language carries the hook. Type around her, never on the face.",
		reality: "Photoreal 100%. Sun-skin, night-neon, real sweat-light, not plastic CGI.",
		type: "Trendy contemporary sans, semi-bold, clean edges.",
		extra: "Major-key summer. Neon / beach / festival. No rain, snow, loneliness, despair. Cute bright woman. Series overlay still EP / title / mood / genre."
	},
	"edm-kpop-club": {
		focus: "CHARACTER-ENERGY. Club or festival, high contrast, bass-as-weapon. Type is geometric and loud but off the face.",
		reality: "Photoreal 100%. Stage haze, real strobes, skin under colored light. No illustration.",
		type: "Bold geometric sans, heavy, tight spacing, high-contrast fill.",
		extra: "Under-title line may read Bass Drop Version | EDM K-POP Club Remix. Club/festival energy, bass-as-weapon. Face uncovered."
	},
	"dreamy-deep-house": {
		focus: "SPACE-FIRST. Dark room, window light, water, stars. People optional. Empty is allowed.",
		reality: "Photoreal 100%. Quiet interior, practical light, no club energy.",
		type: "Thin minimal sans or light serif, very wide tracking.",
		extra: "No crowd, no female lead if a figure appears; keep the room as the subject."
	},
	"fantasy-ambient-edm": {
		focus: "TITLE dead-center largest. Light woman / dark man if people appear. Vast space over emotion.",
		reality: "Photoreal 50 + subtle fantasy light 50. No wings, horns, anime, elf ears.",
		type: "Thin dreamy serif or light sans, wide tracking, pale type.",
		extra: "Mood line in English. No creature features."
	},
	"groovy-airy-pop": {
		focus: "TEXT-FIRST. One woman, night city / window / blue-violet air. Type hierarchy louder than pose.",
		reality: "Photoreal 100%. Night grain, neon bounce, real skin.",
		type: "Airy modern sans, light-to-medium, open tracking.",
		extra: "Mood line in English."
	},
	"narrative-piano-indie": {
		focus: "TEXT-FIRST. One quiet figure, window or interior negative space. Literary still.",
		reality: "Photoreal 100%. Soft daylight or lamp. No stage, no crowd.",
		type: "Elegant editorial serif, thin or medium, generous tracking, cinematic-literary.",
		extra: "Under-title line is exactly Indie POP Edition | Narrative Piano Indie."
	},
	"your-story": {
		focus: "STORY POSTER. Woman NOA required. Title not forced to center if the story composition needs otherwise, but title is still the largest text.",
		reality: "Photoreal cinematic with only a whisper of fantasy light. Not a fantasy world.",
		type: "Match inferred genre. Describe category/weight/tracking. No font names.",
		extra: "Five strings only. Title largest, not forced center. Brand weaker than title. Extra people only if the story needs them. Subtle fantasy light only, not a fantasy world."
	},
	"cover-reborn": {
		focus: "COVER POSTER. Woman NOA required. Title is the largest text. Original artist is smaller than the title.",
		reality: "Photoreal cinematic. Not a fantasy world.",
		type: "Clean serif or sans. Title largest. No font names.",
		extra: "Famous-song cover poster. On-image credit is exactly Cover by AInoa. Do not paint 당신의 이야기 or the story five-line poster."
	}
};
function underTitleLine(genre, pref) {
	const custom = pref?.thumbGenreLine?.trim();
	if (custom) return `"${custom}"`;
	if (genre.id === "narrative-piano-indie") return `"Indie POP Edition | ${genre.youtubeLabel}"`;
	if (genre.id === "edm-kpop-club") return `"Bass Drop Version | ${genre.youtubeLabel}"`;
	if (genre.id === "echoes-of-joseon") return `a short new Edition invented for THIS song | "${genre.youtubeLabel}"`;
	return `"${genre.youtubeLabel}"`;
}
function geminiFieldRule(genre, epN, playlist = false, pref, thumbCast = "female", musicGenre = "", songTitle = "") {
	const spec = GEMINI_THUMB[genre.id];
	const p = pref ?? defaultPref(genre.id);
	const artistLine = musicGenre && String(musicGenre).trim() ? `"${String(musicGenre).trim()}"` : "";
	const exactTitle = String(songTitle || "").trim();
	const titleLock = exactTitle
		? `The largest on-image song title must be exactly "${exactTitle}". Copy those characters. Do not translate this title. Do not replace it with the genre name.`
		: "The largest on-image song title is the confirmed title, the same characters. Do not translate it. Do not replace it with the genre name.";
	const overlay = playlist
		? `top-left small "Act.{n}"; center largest "Playlist EP.{from}~EP.{to}"; under it the mood line; bottom "${genre.youtubeLabel}". World of the Act, not one song. No tracklist on the image.`
		: genre.id === "cover-reborn"
			? `Cover poster. Do not use the EP layout and do not use the story five-line poster. The common line "좌상단 EP" does not apply here. geminiPrompt must be a full English production prompt about THIS song, not a short caption. A one-paragraph caption is a failure. Write these as real sentences: one-frame composition of lead plus text plus background; exact on-image strings only — song title largest at center, original artist ${artistLine || "(the entered singer, do not invent)"} directly under the title and smaller, one short Korean mood line smaller again, then the exact credit "Cover by AInoa" weaker than the title; no EP number, no edition, no genre label; woman NOA large, duet only if the cast says so; face sharp, no text on eyes nose or mouth, move the body if the title would hit the face; one specific scene from this lyric with place, time of day, light, color, camera, and wardrobe, not a generic room and not the same place as other covers; typography category, weight, and tracking that fit this song, no real font names; high contrast; photoreal; negative prompt; 16:9.`
			: genre.kind === "distinct"
				? `Five strings only: 1 song title (largest, not forced to center) 2 mood line 3 genre 4 "${STORY_BRAND.line1}" 5 "${STORY_BRAND.line2}". Brand weaker than title. The song title is the confirmed title exactly. Extra people only if the story needs them.`
				: `top-left small "EP.${epN}"; dead-center largest the confirmed song title; immediately under the title smaller ${underTitleLine(genre, p)}; under that smallest readable mood line. ${titleLock} The genre line stays under the title. It is not the title.`;
	const focus = p.focus === "character" ? "CHARACTER-FIRST. The person is the visual hook. Place type around them, never covering the face." : "TEXT-FIRST. Offset the subject so the title has clear air. Type hierarchy leads the frame.";
	const reality = `Photoreal ${p.reality}%. Remaining ${100 - p.reality}% atmosphere/fantasy light only. No illustration, no anime, no CGI faces.`;
	const motionLo = Math.max(0, p.motion - 10);
	const motionHi = Math.min(100, p.motion + 10);
	return [
		"geminiPrompt = paste-ready Google Gemini / Imagen prompt, English. No character cap.",
		"NOT a Grok Imagine prompt. Never write Grok, xAI, or Imagine-as-product.",
		"Open: Create a 16:9 photorealistic cinematic YouTube thumbnail, premium music album artwork, high-end, atmospheric, sophisticated.",
		"Compose character + text region + background as ONE frame. Do not generate a photo then stamp type on top.",
		overlay,
		genre.id === "cover-reborn"
			? `On-image words are the song title, the original artist, one mood line, and the exact credit "Cover by AInoa". Do not paint 당신의 이야기 or 우리의 음악. The song title is not translated. Instruction sentences in this prompt stay English.`
			: `On-image song title is the confirmed title exactly. Do not translate the song title. Do not put the genre name in the title. Mood line and genre line ${scopeOf(p).has("thumbText") ? `are ${spokenName(genre.id, p)} only.` : "are not translated."} Instruction sentences in this prompt stay English.`,
		`Typography lock for this genre. Do not change this category: ${spec.type}`,
		`Genre thumbnail lock: ${genre.thumbnail}`,
		"USER THUMBNAIL LOCKS — 0순위 사용자 설정. do not reinterpret, soften, or ignore:",
		focus,
		reality,
		`Subject motion baseline ${p.motion}/100 from user settings. You MAY vary only ±10 for THIS song's mood, lyric, and genre (allowed ${motionLo}–${motionHi}). Do not go outside that window. 0=still freeze, 100=peak kinetic dance freeze-frame. Face stays sharp and uncovered.`,
		p.extra.trim() ? `User extra (mandatory): ${p.extra.trim()}` : "",
		p.thumbCastRule.trim() ? `Cast rule (0-rank): ${p.thumbCastRule.trim()} Final on-page radio still wins.` : "",
		p.forbidList.trim() ? `Forbidden: ${p.forbidList.trim()}` : "",
		p.moodLineRule.trim() ? `Mood line: ${p.moodLineRule.trim()}` : "",
		p.thumbFont.includes("장르 분위기에 맞는") ? `Type rules: ${spec.type}. Do not swap this category.` : p.thumbFont.trim() ? `Type rules: ${p.thumbFont.trim()}` : `Type rules: ${spec.type}. Do not swap this category.`,
		p.thumbImage.trim() ? `Image rules: ${p.thumbImage.trim()}` : "",
		p.thumbDecor.trim() ? `Type decor: ${p.thumbDecor.trim()}` : "",
		p.thumbLayout.trim() ? `Type layout: ${p.thumbLayout.trim()}` : "",
		"Female protagonist face (when present) must be sharp. No text over eyes, nose, mouth, or the face.",
		"If face and title would collide, move the body left/right, change angle or pose. Keep both readable.",
		genre.id === "cover-reborn"
			? `Exact overlay strings only. The image must show "Cover by AInoa". The original artist is smaller than the title. Do not paint 당신의 이야기 or 우리의 음악.`
			: "Exact overlay strings only. No extra words, logos, watermarks, artist names, album names, hashtags.",
		"Negative prompt: logos, watermarks, extra captions, anime, illustration, CGI faces, plastic skin.",
		"Aspect ratio: 16:9",
		`Identity: ${geminiIdentityLine(idsForThumbCast(thumbCast))}`,
		musicGenre && String(musicGenre).trim()
			? genre.id === "cover-reborn"
				? `On-image original artist must be exactly "${String(musicGenre).trim()}". Do not invent a singer or a story.`
				: `On-image genre line must be exactly "${String(musicGenre).trim()}". Do not invent a different genre name.`
			: ""
	].filter(Boolean).join(" ");
}
function lockCoverThumb(raw: string, title = "", artist = "") {
	const song = title.trim();
	const name = artist.trim();
	let text = String(raw || "")
		.replaceAll("당신의 이야기, 우리의 음악", "")
		.replaceAll("당신의 이야기", "")
		.replace(/\s{2,}/g, " ")
		.trim();
	const complete = text.length >= 1400
		&& text.includes("Cover by AInoa")
		&& /face|eyes/i.test(text)
		&& /serif|sans|typograph|letter spacing|tracking/i.test(text)
		&& /scene|lighting|camera|background/i.test(text)
		&& (!song || text.includes(song))
		&& (!name || text.includes(name));
	if (complete) return text;
	const strings = song && name
		? `exact title "${song}" largest at center; exact original artist "${name}" directly under it and smaller; one short Korean mood line smaller again; exact credit "Cover by AInoa" weaker than the title`
		: `song title largest at center; the entered original artist directly under it and smaller; one short Korean mood line smaller again; exact credit "Cover by AInoa" weaker than the title`;
	return [
		"Create a 16:9 photorealistic cinematic YouTube thumbnail, premium music album artwork, high-end, atmospheric, sophisticated, elegant.",
		"Compose the lead, the text region, and the background as one frame. Do not generate a photograph and then stamp type on top.",
		`On-image text only: ${strings}. No EP number, no edition line, no music-genre name, and no story brand.`,
		text
			? `Keep this song's scene and make the place, time, light, color, camera, and wardrobe specific: ${text}`
			: "Build one cinematic scene from this song's title and lyric. Do not reuse a generic empty room.",
		"Woman NOA is required and large. Add Korean man NOEL beside her only when the cast is a duet. Faces stay sharp and uncovered. No text over the eyes, nose, or mouth. If the title would touch a face, move the body, change the angle, or change the pose.",
		"Typography: describe the category, weight, and letter spacing that fit this song. No real font names. The title is the strongest text. The artist, the mood line, and Cover by AInoa are weaker. High contrast, with only a soft shadow that does not cover the face.",
		"Photoreal. No illustration, no anime, no CGI faces.",
		"Negative prompt: logos, watermarks, extra captions, anime, illustration, CGI faces, plastic skin, EP numbers, story-brand lines.",
		"Aspect ratio: 16:9",
	].join(" ");
}
function pinThumbTitle(raw, title) {
	const song = String(title || "").trim();
	let text = String(raw || "").trim();
	if (!song || !text) return text;
	const lock = `Exact on-image song title, the largest text, these characters only, do not translate, do not replace with the genre: "${song}".`;
	text = text.replace(/Exact on-image song title, the largest text, these characters only, do not translate, do not replace with the genre: "[^"]*"\.?\s*/g, "");
	text = text.replace(/Song title overlay:\s*.+?(?=\s+Mood:|\s+Genre:)/g, () => `Song title overlay: ${song}.`);
	text = text.replace(/The largest on-image song title must be exactly "[^"]*"\./g, () => `The largest on-image song title must be exactly "${song}".`);
	text = text.replace(/dead-center largest the confirmed song title "[^"]*"/g, () => `dead-center largest the confirmed song title "${song}"`);
	if (!text.includes(`Song title overlay: ${song}.`) && !text.includes(song)) {
		text = `Song title overlay: ${song}. ${text}`;
	}
	if (/Mood:\s*[^.]{1,80}의 장면\./.test(text) && !text.includes(`Mood: ${song}`)) {
		text = text.replace(/Mood:\s*[^.]{1,80}의 장면\./, `Mood: ${song}.`);
	}
	return `${lock} ${text}`.replace(/\s{2,}/g, " ").trim();
}
function sanitizeGeminiPrompt(raw) {
	const cleaned = raw.replace(/\bGrok Imagine\b/gi, "Gemini Imagen").replace(/\bNatural Grok[^.]*\.?/gi, "").replace(/\bGrok\b/gi, "Gemini").replace(/\bxAI\b/g, "Google").replace(/\s{2,}/g, " ").trim();
	if (!cleaned) return cleaned;
	if (/gemini|imagen|create a 16:9|negative prompt|aspect ratio:\s*16:9/i.test(cleaned)) return cleaned;
	return [
		"Create a 16:9 photorealistic cinematic YouTube thumbnail with Gemini Imagen.",
		cleaned,
		"Negative prompt: logos, watermarks, artist names, extra captions, anime, illustration, CGI faces.",
		"Aspect ratio: 16:9"
	].join(" ");
}
function readMaster() {
	return typeof unifiedMaster === "string" ? unifiedMaster : "";
}
function resolveSource(epN, title, lyrics, vocal) {
	const n = padEp(epN);
	const seed = SEED_ORIGINALS.find((item) => item.n === n);
	const stored = getOriginal(n);
	return {
		n,
		title: title.trim() || stored?.title || seed?.title || "",
		lyrics: lyrics.trim() || stored?.lyrics || seed?.lyrics || "",
		vocal: vocal.trim() || stored?.vocal || seed?.vocal || ""
	};
}
function buildMessages(epN, genreId, note, originalLyrics, originalTitle = "", vocal = "", pref, thumbCast = "female") {
	const ep = resolveEp(epN, originalTitle);
	const genre = getGenre(genreId);
	const p = pref ?? defaultPref(genreId);
	const langName = langLabel(prefOutputLang(genre.id, p.lang));
	const scope = scopeOf(p);
	const sunoBase = (p.sunoBase || "").trim() || (genreWantsSuno(genre.id) ? readSunoBase(genre.id) : "");
	const sunoLine = !genreWantsSuno(genre.id) ? "sunoStyle = 빈 문자열. 이 장르는 수노 없음." : sunoBase ? `sunoStyle = 영어만. 공백 포함 1000자 이하 완성본만. 1000자를 넘기면 줄이거나 자르지 말고 아래 저장 베이스를 그대로 넣어라. ${p.sunoLimit} 가사 블록에 넣지 마.\n[수노 저장 베이스]\n${sunoBase}` : `sunoStyle = 영어만. 공백 포함 1000자 이하 완성본. 넘기면 기본 프롬프트. 가사 블록에 넣지 마.`;
	const letterLine = p.community ? `fanLetter = 커뮤니티 글. ${keepLang(scope.has("letter"), langName)} ${greetOrder(genre, p)} 사용자 설정 커뮤니티 규칙을 따른다:\n${p.communityRules}` : "fanLetter = 빈 문자열. 사용자 설정: 커뮤니티 글 작성 아니오.";
	const sourceLine = `기본 데이터=원곡 제목 「${ep.title}」와 아래 원곡 가사는 소재다. 결과창에 보이는 곡 제목은 확정 제목이다. 원곡 제목을 결과 제목, 유튜브 제목, 썸네일 제목, 설명에 그대로 쓰지 마. 다른 EP 제목·가사를 가져오면 실패다. 언어 규칙에 적힌 칸만 ${langName}로 쓴다.`;
	const descLine = p.descLyrics
		? `youtubeDescription: ${keepLang(scope.has("desc"), langName)} 해시태그 ${genre.hashtags ?? ""}. 사용자 설정 설명란 규칙을 따른다:\n${p.descRules}\n가사 전문을 ━━━━━━━━━━━━━━━━━━━━ 사이에 넣음. 위쪽 선 바로 다음 줄은 주사용 언어다. 한국어는 가사, 일본어는 歌詞, 영어는 Lyrics, 태국어는 เนื้อเพลง. 그 아래는 부른 가사 문장만. ${genre.id === "kpop-original" ? "설명란 가사는 입력한 K-POP 원곡 가사." : "설명란 가사는 개사한 lyricsBlock의 부른 가사만. K-POP 원문을 넣지 마."}`
		: `youtubeDescription: ${keepLang(scope.has("desc"), langName)} 사용자 설정: 설명란 가사 아니오. 사용자 설정 설명란 규칙을 따른다:\n${p.descRules}`;
	return {
		system: [
			userPrefZeroLock(p, genre.id),
			"",
			"너는 AI Artist Noa의 Noa Studio 작성기다.",
			"우선순위: 0 사용자 설정 > 1 장르 카드 > 2 UNIFIED-MASTER 원문. 충돌하면 위가 이긴다.",
			"한 장르만. 다른 장르를 섞지 마. 다른 EP를 다시 붙이지 마.",
			"EP 번호는 받은 값 그대로. 번역하거나 재번호하지 마.",
			"원곡 가사 원문이 있으면 그것을 소스로 쓴다. 없으면 만들지 마.",
			sourceLine,
			"JSON만 출력한다.",
			"",
			"[UNIFIED-MASTER 원문]",
			readMaster() || "(마스터 파일 없음 — 장르 카드만 따른다)",
			"",
			"[공통 절대 규칙]",
			...COMMON_LOCKS.map((r, i) => `${i + 1}. ${r}`),
			"",
			"[필드]",
			summaryFieldRule(langName, scope.has("summary")),
			"confirmedTitle: 확정 제목만. " + titleOrder(genre, ep, p),
			genre.id === "kpop-original"
				? "lyricsBlock: 사용자가 입력한 이 EP의 K-POP 원곡 가사를 한 글자도 바꾸지 말고 그대로 넣는다. 개사·번역·삭제·추가 금지. 다른 곡 가사 금지."
				: `lyricsBlock: 같은 EP의 K-POP 원곡 가사를 소스로 가져와 이 장르로 개사한다. 부른 가사의 언어는 ${langName}만. 원곡 언어를 유지하지 마. 첫 줄에 제목을 넣지 마. 섹션 태그 또는 가사부터 시작. 보컬 스타일: ${p.vocalStyle || "(장르 카드)"}. 음악 스타일: ${p.musicStyle || "(장르 카드)"}. 개사 규칙: ${p.rewriteRules || genre.rewrite}. 구조: ${p.structure || genre.structure || "(곡에 맞게)"}. 금지: ${p.forbidList || "(없음)"}. 원곡을 그대로 붙이지 마. 다른 EP 가사를 가져오지 마. 섹션은 수노 명령어라 [Intro]처럼 대괄호로만 쓴다. ${genre.id === "joseon-ballad" ? "이 장르만 섹션마다 [Female Vocal]을 넣는다." : "[Female Vocal]과 영어 믹스 지시는 넣지 마."}`,
			sunoLine,
			geminiFieldRule(genre, ep.n, false, pref, thumbCast),
			`인물 고정: ${geminiIdentityLine(idsForThumbCast(thumbCast))}`,
			`youtubeTitle: 완성된 검색 제목만. 100자 이하. 형식: ${(p.titleFormat || "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa").slice(0, 100)}. 장르라벨=${p.thumbGenreLine || genre.youtubeLabel}. ${scope.has("ytTitle") ? `제목 문장도 ${langName}.` : "유튜브 제목은 번역 대상이 아니다. 넣은 제목과 감성 한줄은 그 칸 언어 그대로."} 형식 설명·고정·원제 유지·작업 메모를 제목에 넣지 마. 감성 한줄은 summary 첫 줄(시적 한 문장)만. 요약 전체를 제목에 넣지 마. 확정 제목과 같은 말, 제목을 조금 바꾼 말을 감성 한줄에 쓰지 마. 같은 구절을 두 번 쓰지 마.`,
			descLine,
			letterLine
		].join("\n"),
		user: [
			`EP.${ep.n} 원곡 제목=${ep.title}. 결과 칸의 곡 제목은 확정 제목만 쓴다.`,
			`장르: ${genre.label}`,
			genre.kind === "original" ? "시리즈: Original" : "시리즈: Collection",
			vocal.trim() ? genre.kind === "original" ? `원곡 보컬 잠금: ${vocal.trim()}. 가사 섹션 태그·보컬 구성·썸네일 인물을 이 값 그대로 쓴다. 재캐스팅 금지.` : `보컬: ${vocal.trim()}` : "",
			"",
			"[이번 장르 카드 — 이 장르만. 0순위 사용자 설정보다 아래]",
			cardForUser(genre, p),
			genre.id === "joseon-ballad" && p.titleMode !== "lock" ? joseonLedgerPrompt() : "",
			genre.id === "fantasy-ambient-edm" ? fantasyLedgerPrompt(ep.n) : "",
			sourceLine,
			originalLyrics.trim()
				? genre.id === "kpop-original"
					? `\n[K-POP 원곡 가사 — 이 EP만. 가사와 설명란 가사에 그대로 사용]\n${originalLyrics.trim().slice(0, 8e3)}`
					: `\n[K-POP 원곡 가사 — 같은 EP. 개사 소스. 그대로 붙이지 마. 설명란 가사는 개사한 lyricsBlock만]\n${originalLyrics.trim().slice(0, 8e3)}`
				: "",
			note.trim() ? `\n[이 작성 요구]\n${note.trim().slice(0, 2e3)}` : ""
		].filter(Boolean).join("\n"),
		kind: genre.kind
	};
}
function buildPlaylistMessages(actN, genreId, note, extraTracks = [], pref, thumbCast = "female") {
	const act = getAct(actN);
	const genre = getGenre(genreId);
	const p = pref ?? defaultPref(genreId);
	const langName = langLabel(prefOutputLang(genre.id, p.lang));
	const scope = scopeOf(p);
	const prefix = playlistTitlePrefix(act);
	const tracks = formatTracklist(actN, extraTracks);
	const community = p.community ? `communityPost = 커뮤니티 글. ${keepLang(scope.has("letter"), langName)} ${greetOrder(genre, p)} 짧은 문단마다 첫 글자 이모지 1개. 가사 전문 금지. 비우지 마.` : "communityPost = 빈 문자열. 사용자 설정: 커뮤니티 글 작성 아니오.";
	return {
		system: [
			userPrefZeroLock(p, genre.id),
			"",
			"너는 AI Artist Noa의 Noa Studio 플레이리스트 작성기다.",
			"우선순위: 0 사용자 설정 > 1 장르 카드 > 2 UNIFIED-MASTER 원문. 충돌하면 위가 이긴다.",
			"ACT 결과는 그 장르의 곡 결과창과 같은 칸이다. 0-29에서 아니오인 칸은 빈 문자열.",
			"부른 가사 전문은 쓰지 마. 설명란에서 가사가 들어갈 ━━ 자리에는 트랙리스트만 넣는다. 설명란 가사 설정이 아니오여도 그 트랙리스트는 넣는다.",
			"한 장르만. 수록곡 제목은 받은 목록 그대로. 번역·재번호 금지.",
			"JSON만 출력한다.",
			"",
			"[필드]",
			`summary: ${keepLang(scope.has("summary"), langName)} 평문. 이번 Act와 장르의 세계만. 이모지 넣지 마. 출력 아니오이면 빈 문자열.`,
			`confirmedTitle: ${keepLang(scope.has("title"), langName)} 이 ACT의 확정 제목 한 줄. 곡 제목을 나열하지 마. 출력 아니오이면 빈 문자열.`,
			`sunoStyle: 영어. Act 전체 스타일. 1000자 이내. 출력 아니오이면 빈 문자열.`,
			genre.id === "joseon-ballad" && joseonActMood(actN) ? `moodLine 고정: ${joseonActMood(actN)}` : genre.id === "fantasy-ambient-edm" && FANTASY_ACT_MOOD[actN] ? `playlist 중앙 제목: ${FANTASY_PLAYLIST_TITLE}. moodLine 고정: ${FANTASY_ACT_MOOD[actN]}` : "moodLine: 유튜브 감성 한줄. 짧고 시적. 파이프(|) 쓰지 마.",
			geminiFieldRule(genre, "", true, pref, thumbCast),
			`인물 고정: ${geminiIdentityLine(idsForThumbCast(thumbCast))}`,
			"youtubeDescription: 짧은 문단마다 첫 글자 이모지 1개. 가사 전문 금지. " + keepLang(scope.has("desc"), langName) + " 본문 뒤에 ━━━━━━━━━━━━━━━━━━━━ 를 열고, 그 안에 EP.번호 곡명 트랙리스트만 넣고, ━━━━━━━━━━━━━━━━━━━━ 로 닫는다. 시간 표시는 붙이지 마. 설명란 가사 설정과 상관없이 트랙리스트는 반드시 넣는다. EP 번호와 곡명은 받은 목록 그대로. 다른 Act 번호로 바꾸지 마.",
			community
		].join("\n"),
		user: [
			prefix,
			`장르: ${genre.label}`,
			genre.kind === "original" ? "시리즈: Original" : "시리즈: Collection",
			"",
			"[수록곡 — 제목만, 가사 쓰지 마]",
			tracks,
			"",
			"[이번 장르 카드 — 이 장르만. 0순위 사용자 설정보다 아래]",
			cardForUser(genre, p),
			genre.id === "joseon-ballad" && p.titleMode !== "lock" ? joseonLedgerPrompt() : "",
			note.trim() ? `\n[사용자 입력 — 이번 작성에 반영]\n${note.trim().slice(0, 2e3)}` : ""
		].filter(Boolean).join("\n"),
		kind: genre.kind,
		prefix,
		tracks,
		youtubeLabel: genre.youtubeLabel
	};
}
function outputRule(p) {
	const out = p.output && typeof p.output === "object" ? p.output : null;
	const on = (key, fallback) => (out && typeof out[key] === "boolean" ? out[key] : fallback);
	const line = (label, key, fallback) => `${label} = ${on(key, fallback) ? "예. 반드시 쓴다." : "아니오. 빈 문자열. 쓰지 마."}`;
	return [
		"0-29 출력 여부. 아니오인 칸은 빈 문자열이다. 예인 칸만 결과다.",
		line("원곡 제목", "origTitle", false),
		line("원곡 보컬정보", "origVocal", false),
		line("원곡 가사", "origLyrics", false),
		line("요약", "summary", true),
		line("확정 제목", "title", true),
		line("가사", "lyrics", true),
		line("수노", "suno", true),
		line("제미나이 썸네일", "thumb", true),
		line("유튜브 제목", "ytTitle", true),
		line("영상 설명란", "ytDesc", true),
		line("커뮤니티", "letter", Boolean(p.community)),
	].join("\n");
}
function asPackage(raw, kind, community = false, descLyrics = false, output, genreId = "") {
	if (!raw || typeof raw !== "object") return null;
	const o = raw;
	const str = (k) => typeof o[k] === "string" ? o[k] : "";
	const show = output && typeof output === "object" ? output : null;
	const on = (key, fallback) => (show && typeof show[key] === "boolean" ? show[key] : fallback);
	const wantSummary = on("summary", true);
	const wantLyrics = on("lyrics", true);
	const wantSuno = on("suno", genreId ? genreWantsSuno(genreId) : kind !== "original");
	const wantThumb = on("thumb", true);
	const wantTitle = on("ytTitle", true);
	const wantDesc = on("ytDesc", true);
	const wantLetter = on("letter", community);
	const pkg = normalizePackage({
		summary: wantSummary ? str("summary") : "",
		confirmedTitle: str("confirmedTitle"),
		lyricsBlock: wantLyrics ? str("lyricsBlock") : "",
		sunoStyle: wantSuno ? str("sunoStyle") : "",
		geminiPrompt: wantThumb ? sanitizeGeminiPrompt(str("geminiPrompt")) : "",
		youtubeTitle: wantTitle ? str("youtubeTitle") : "",
		youtubeDescription: wantDesc ? str("youtubeDescription") : "",
		fanLetter: wantLetter ? str("fanLetter") : "",
		thumbUrl: "",
		thumbCast: "female"
	});
	if (wantThumb && pkg.confirmedTitle) pkg.geminiPrompt = pinThumbTitle(pkg.geminiPrompt, pkg.confirmedTitle);
	if (!pkg.confirmedTitle) return null;
	if (wantSummary && !pkg.summary) return null;
	if (wantLyrics && !pkg.lyricsBlock) return null;
	if (wantThumb && !pkg.geminiPrompt) return null;
	if (wantDesc && descLyrics) pkg.youtubeDescription = cleanDescriptionLyrics(pkg.youtubeDescription, str("lyricsBlock") || pkg.lyricsBlock);
	else if (wantDesc) pkg.youtubeDescription = descriptionWithoutLyrics(pkg.youtubeDescription);
	return pkg;
}
function asPlaylist(raw, kind, prefix, tracks, youtubeLabel, community = false, output) {
	if (!raw || typeof raw !== "object") return null;
	const o = raw;
	const str = (k) => typeof o[k] === "string" ? o[k] : "";
	const show = output && typeof output === "object" ? output : null;
	const on = (key, fallback) => (show && typeof show[key] === "boolean" ? show[key] : fallback);
	const wantSummary = on("summary", true);
	const wantSongTitle = on("title", true);
	const wantSuno = on("suno", true);
	const wantThumb = on("thumb", true);
	const wantTitle = on("ytTitle", true);
	const wantDesc = on("ytDesc", true);
	const wantLetter = on("letter", community);
	const timed = asTimedTracklist(typeof tracks === "string" ? tracks : "");
	const mood = str("moodLine");
	if (wantSummary && !str("summary")) return null;
	if (wantThumb && !str("geminiPrompt")) return null;
	if (wantTitle && !mood) return null;
	if (wantDesc && !str("youtubeDescription") && !timed) return null;
	const pkg = normalizePlaylist({
		summary: wantSummary ? str("summary") : "",
		confirmedTitle: wantSongTitle ? str("confirmedTitle").trim() || String(prefix || "") : "",
		tracklist: timed,
		sunoStyle: wantSuno ? str("sunoStyle") : "",
		geminiPrompt: wantThumb ? sanitizeGeminiPrompt(str("geminiPrompt")) : "",
		youtubeTitle: wantTitle ? fitPlaylistTitle(prefix, mood, youtubeLabel) : "",
		youtubeDescription: wantDesc ? descriptionWithTracklist(str("youtubeDescription"), timed) : "",
		communityPost: wantLetter ? str("communityPost") : "",
		thumbUrl: "",
		thumbCast: "female",
		youtubeUrl: typeof o.youtubeUrl === "string" ? o.youtubeUrl : "",
		mvUrl: typeof o.mvUrl === "string" ? o.mvUrl : ""
	});
	if (!wantLetter) pkg.communityPost = "";
	if (wantThumb && pkg.confirmedTitle) pkg.geminiPrompt = pinThumbTitle(pkg.geminiPrompt, pkg.confirmedTitle);
	return pkg;
}
function isLimitStatus(status, detail) {
	if (status === 429) return true;
	const text = String(detail || "").toLowerCase();
	return /rate limit|too many|quota|resource exhausted|usage limit|spending-limit|out of credits|personal-team-blocked/.test(text);
}
let grokLimitedUntil = 0;
function markGrokLimit(sec: number) {
	const wait = Math.min(30 * 60, Math.max(60, Math.ceil(sec) || 180));
	grokLimitedUntil = Math.max(grokLimitedUntil, Date.now() + wait * 1000);
	return Math.ceil((grokLimitedUntil - Date.now()) / 1000);
}
function grokLimitNow() {
	if (grokLimitedUntil <= Date.now()) return 0;
	return Math.ceil((grokLimitedUntil - Date.now()) / 1000);
}
function retrySeconds(res: Response) {
	const retry = Number(res.headers.get("retry-after") || 0);
	if (Number.isFinite(retry) && retry > 0) return retry;
	const reset = Number(res.headers.get("x-ratelimit-reset") || res.headers.get("x-ratelimit-reset-requests") || 0);
	if (Number.isFinite(reset) && reset > 1_000_000_000) return Math.max(0, Math.ceil(reset - Date.now() / 1000));
	if (Number.isFinite(reset) && reset > 0 && reset < 86_400) return reset;
	return 0;
}
function limitResult(sec = 0) {
	const retryAfter = markGrokLimit(sec || 180);
	return {
		ok: false as const,
		error: "한도가 부족합니다. 복구되면 생성됩니다.",
		retryAfter
	};
}
async function chatJson(system, user, schemaName, schema, useSchema, maxTokens, timeoutMs = 18e4, model = "grok-4.5", heat, effort = "low") {
	const apiKey = globalThis.process?.env?.XAI_API_KEY ?? "";
	if (!apiKey) return {
		ok: false,
		error: "AI 기능을 이 환경에서 쓸 수 없습니다."
	};
	const paused = grokLimitNow();
	if (paused) return limitResult(paused);
	const body = {
		model,
		temperature: typeof heat === "number" ? heat : model === "grok-4.5" ? .6 : .4,
		max_tokens: maxTokens,
		...(model === "grok-4.5" && effort ? { reasoning_effort: effort } : {}),
		messages: [{
			role: "system",
			content: system
		}, {
			role: "user",
			content: user
		}]
	};
	if (useSchema) body.response_format = {
		type: "json_schema",
		json_schema: {
			name: schemaName,
			strict: true,
			schema
		}
	};
	else body.response_format = { type: "json_object" };
	let res;
	try {
		res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : "";
		if (/timeout|abort/i.test(msg)) return {
			ok: false,
			error: "시간이 초과되었습니다"
		};
		return {
			ok: false,
			error: "연결이 끊겼습니다"
		};
	}
	if (!res.ok) {
		let detail = "";
		try {
			detail = (await res.text()).slice(0, 200);
		} catch {
			detail = "";
		}
		if (isLimitStatus(res.status, detail)) return limitResult(retrySeconds(res));
		if (effort && res.status === 400 && /reasoning/i.test(detail)) {
			return chatJson(system, user, schemaName, schema, useSchema, maxTokens, timeoutMs, model, heat, "");
		}
		if (model !== "grok-4.5" && (res.status === 400 || res.status === 404)) {
			return chatJson(system, user, schemaName, schema, useSchema, maxTokens, timeoutMs, "grok-4.5", heat, effort);
		}
		return {
			ok: false,
			error: detail ? `생성 실패 (${res.status}): ${detail}` : `생성 실패 (${res.status})`
		};
	}
	const text = (await res.json()).choices?.[0]?.message?.content ?? "";
	const data = readModelJson(text);
	if (data) return { ok: true, data };
	return { ok: false, error: "패키지 형식을 읽지 못했습니다." };
}
function readModelJson(text) {
	const raw = String(text || "").trim();
	if (!raw) return null;
	const slice = (() => {
		const start = raw.indexOf("{");
		const end = raw.lastIndexOf("}");
		return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
	})();
	try {
		return JSON.parse(slice);
	} catch {}
	try {
		return JSON.parse(escapeRawBreaks(slice));
	} catch {}
	const repaired = slice.replace(/"value"\s*:\s*"([\s\S]*)"\s*}\s*$/, (_all, body) => {
		return `"value":${JSON.stringify(body)}`;
	});
	try {
		const parsed = JSON.parse(repaired.endsWith("}") ? repaired : `${repaired}}`);
		if (parsed && typeof parsed === "object") return parsed;
	} catch {}
	if (!raw.includes("{") && raw.length > 40) return { value: raw };
	return null;
}
function escapeRawBreaks(slice) {
	let out = "";
	let inStr = false;
	let esc = false;
	for (const ch of String(slice || "")) {
		if (inStr) {
			if (esc) {
				out += ch;
				esc = false;
				continue;
			}
			if (ch === "\\") {
				out += ch;
				esc = true;
				continue;
			}
			if (ch === "\"") {
				inStr = false;
				out += ch;
				continue;
			}
			if (ch === "\n") {
				out += "\\n";
				continue;
			}
			if (ch === "\r") {
				out += "\\r";
				continue;
			}
			if (ch === "\t") {
				out += "\\t";
				continue;
			}
			out += ch;
			continue;
		}
		if (ch === "\"") inStr = true;
		out += ch;
	}
	return out;
}
async function postImage(body) {
	const { xaiKey } = await import("./generate-art.server");
	const apiKey = xaiKey();
	if (!apiKey) return "";
	const res = await fetch("https://api.x.ai/v1/images/generations", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		if (res.status === 429 || res.status === 403) return null;
		return "";
	}
	return (await res.json()).data?.[0]?.url ?? "";
}
async function makeImage(prompt, ids) {
	const art = await import("./generate-art.server");
	if (!art.xaiKey() || !prompt.trim()) return "";
	const refs = art.refUris(ids);
	const locked = `${identityPrompt(ids)}\n\n${prompt}`.trim();
	const base = {
		model: "grok-imagine-image",
		n: 1,
		resolution: "1k",
		response_format: "url",
		aspect_ratio: "16:9"
	};
	if (refs.length >= 2) {
		const url = await postImage({
			...base,
			prompt: locked.slice(0, 1600),
			image_urls: refs
		});
		if (url || url === null) return url || "";
		const pair = art.fileDataUri("characters/cast-pair.jpg");
		if (pair) {
			const fromPair = await postImage({
				...base,
				prompt: locked.slice(0, 1600),
				image_url: pair
			});
			if (fromPair || fromPair === null) return fromPair || "";
		}
	}
	if (refs.length >= 1) {
		const url = await postImage({
			...base,
			prompt: locked.slice(0, 1600),
			image_url: refs[0]
		});
		if (url || url === null) return url || "";
	}
	const body = {
		...base,
		prompt: prompt.slice(0, 1e3)
	};
	const url = await postImage(body);
	if (url || url === null) return url || "";
	const { aspect_ratio: _ar, ...rest } = body;
	return postImage(rest);
}
function fallbackGrokPrompt(gemini) {
	return [
		"Photoreal cinematic YouTube thumbnail, 16:9 wide frame.",
		"Keep the same people, lighting, composition, and overlay text exactly. Never cover faces with type. No logos, no watermarks, no extra captions.",
		gemini.replace(/\b(gemini|imagen|nano banana|google)\b/gi, "").replace(/\([^)]{0,40}:\s*\d(?:\.\d)?\)/g, "").replace(/--\S+/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 900)
	].join(" ");
}
async function adaptGeminiForGrok(gemini) {
	const source = gemini.trim();
	if (!source) return "";
	const result = await chatJson([
		"Rewrite a Gemini/Imagen YouTube-thumbnail prompt into a Grok Imagine prompt.",
		"Keep the same scene, people, wardrobe, lighting, camera, mood, and every overlay text string exactly (EP, title, mood line, genre).",
		"16:9 photoreal cinematic still. Faces sharp and uncovered. No extra logos or watermarks.",
		"Drop Gemini-only syntax, model names, weight tags, --no lists, and 'prompt for Gemini' boilerplate.",
		"Write dense natural English for Grok Imagine. ≤900 characters.",
		"JSON {\"prompt\": string} only."
	].join(" "), source.slice(0, 1400), "grok_thumb", GROK_THUMB_SCHEMA, true, 700);
	if (result.ok && result.data && typeof result.data === "object") {
		const prompt = String(result.data.prompt ?? "").trim();
		if (prompt) return prompt.slice(0, 1e3);
	}
	return fallbackGrokPrompt(source);
}
async function withThumb(pkg, ids) {
	const url = await makeImage(await adaptGeminiForGrok(pkg.geminiPrompt) || pkg.geminiPrompt, ids);
	if (url) pkg.thumbUrl = url;
	return pkg;
}
export async function runRenderThumb(data: any) {
	const ids = idsForThumbCast(data.thumbCast);
	const url = await makeImage(await adaptGeminiForGrok(data.prompt) || data.prompt, ids);
	if (!url) return {
		ok: false,
		error: "썸네일을 만들지 못했습니다."
	};
	return {
		ok: true,
		url
	};
}
export async function runGeneratePackage(data: any): Promise<any> {
	data.prefs = livePref(data.genreId, data.prefs);
	try {
		const source = resolveSource(data.epN, data.originalTitle ?? "", data.originalLyrics ?? "", data.vocal ?? "");
		if (!source.lyrics.trim()) return {
			ok: false,
			error: `원곡 가사가 없습니다. EP.${source.n} 원곡을 먼저 넣으세요.`
		};
		const { system, user, kind } = buildMessages(source.n, data.genreId, data.note ?? "", source.lyrics, source.title, source.vocal, data.prefs, data.thumbCast);
		const lockedTitle = lockedTitleFor(data.genreId, source.n, source.title, data.prefs);
		let last = "패키지를 만들지 못했습니다.";
		let parsed = null;
		for (let i = 0; i < 1 && !parsed; i += 1) {
			const shot = await chatJson(system, user, "ep_package", PACKAGE_JSON_SCHEMA, i === 0, 12e3, 18e4);
			if (!shot.ok) {
				last = shot.error;
				if (shot.error.includes("한도")) return shot;
				continue;
			}
			let pkg = asPackage(shot.data, kind, data.prefs.community, data.prefs.descLyrics, data.prefs.output, data.genreId);
			if (pkg?.fanLetter) pkg.fanLetter = finishLetter(pkg.fanLetter, getGenre(data.genreId), data.prefs);
			if (!pkg) {
				last = "패키지 형식을 읽지 못했습니다.";
				continue;
			}
			if (lockedTitle) pkg.confirmedTitle = lockedTitle;
			pkg.thumbCast = data.thumbCast;
			pkg = applyPrefToStudio(pkg, data.prefs, {
				epN: data.epN,
				lockedTitle,
				genreLabel: (data.prefs.thumbGenreLine || "").trim() || getGenre(data.genreId).youtubeLabel,
				moodOverride: data.genreId === "fantasy-ambient-edm" ? fantasyMood(source.n) : "",
				genreId: data.genreId
			});
			if (data.genreId === "kpop-original" && source.lyrics.trim()) {
				pkg.lyricsBlock = source.lyrics.trim();
				if (data.prefs.descLyrics) pkg.youtubeDescription = cleanDescriptionLyrics(pkg.youtubeDescription, source.lyrics);
			}
			if (lockedTitle) pkg.confirmedTitle = lockedTitle;
			else if (titleOwnedByOtherEp(pkg.confirmedTitle, source.n)) pkg.confirmedTitle = "";
			if (pkg.sunoStyle.trim().length > 1000) pkg.sunoStyle = await settleSuno(pkg.sunoStyle, data.genreId, data.prefs);
			parsed = pkg;
		}
		if (!parsed) return {
			ok: false,
			error: last
		};
		if (data.skipThumb) return {
			ok: true,
			pkg: parsed
		};
		try {
			return {
				ok: true,
				pkg: await withThumb(parsed, idsForThumbCast(data.thumbCast))
			};
		} catch {
			return {
				ok: true,
				pkg: parsed
			};
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "";
		if (/한도|403|429/.test(msg)) return {
			ok: false,
			error: "한도가 부족합니다. 복구되면 생성됩니다.",
			retryAfter: 90
		};
		return {
			ok: false,
			error: msg || "패키지를 만들지 못했습니다."
		};
	}
}
function playlistOutput(prefs) {
	const act = prefs?.actOutput;
	if (act && typeof act === "object") return act;
	return prefs?.output;
}
function playlistLetter(prefs) {
	const show = playlistOutput(prefs);
	if (show && typeof show.letter === "boolean") return show.letter;
	return Boolean(prefs?.community);
}
export async function runGeneratePlaylist(data: any) {
	data.prefs = livePref(data.genreId, data.prefs);
	const built = buildPlaylistMessages(data.act, data.genreId, data.note, data.extraTracks, data.prefs, data.thumbCast);
	const show = playlistOutput(data.prefs);
	const first = await chatJson(built.system, built.user, "ep_playlist", PLAYLIST_JSON_SCHEMA, !data.fast, data.fast ? 900 : 2500);
	let parsed = first.ok ? asPlaylist(first.data, built.kind, built.prefix, built.tracks, built.youtubeLabel, playlistLetter(data.prefs), show) : null;
	if (!parsed && !data.fast && (first.ok || first.error.includes("생성 실패 (400)"))) {
		const second = await chatJson(built.system, built.user, "ep_playlist", PLAYLIST_JSON_SCHEMA, false, 2500);
		if (!second.ok) return second;
		parsed = asPlaylist(second.data, built.kind, built.prefix, built.tracks, built.youtubeLabel, playlistLetter(data.prefs), show);
	}
	if (!parsed) {
		if (!first.ok) return first;
		return {
			ok: false,
			error: "묶음 필드가 비었습니다."
		};
	}
	parsed.thumbCast = data.thumbCast;
	if (parsed.communityPost) parsed.communityPost = finishLetter(parsed.communityPost, getGenre(data.genreId), data.prefs);
	if (String(parsed.sunoStyle || "").trim().length > 1000) parsed.sunoStyle = await settleSuno(parsed.sunoStyle, data.genreId, data.prefs);
	if (data.skipThumb) return {
		ok: true,
		pkg: parsed
	};
	try {
		return {
			ok: true,
			pkg: await withThumb(parsed, idsForThumbCast(data.thumbCast))
		};
	} catch {
		return {
			ok: true,
			pkg: parsed
		};
	}
}

function blockBudget(blockId) {
	const timeout = 18e4;
	if (blockId === "lyrics") return { tokens: 8000, timeout };
	if (blockId === "yt-desc") return { tokens: 5000, timeout };
	if (blockId === "thumb") return { tokens: 5000, timeout };
	if (blockId === "suno" || blockId === "letter" || blockId === "community") return { tokens: 4000, timeout };
	return { tokens: 3000, timeout };
}
function dropCarriedText(next, prev) {
	let fresh = String(next || "").replace(/\r\n/g, "\n").trim();
	const old = String(prev || "").replace(/\r\n/g, "\n").trim();
	if (!fresh || !old) return fresh;
	const squash = (text) => text.replace(/\s+/g, "");
	if (squash(fresh) === squash(old)) return "";
	const structural = /^(?:━+|가사|歌詞|Lyrics|เนื้อเพลง|AI Artist Noa)$/;
	const cutSpan = (text, bit) => {
		const target = squash(bit);
		if (target.length < 8) return text;
		const map = [];
		let flat = "";
		for (let i = 0; i < text.length; i += 1) {
			if (/\s/.test(text[i])) continue;
			flat += text[i];
			map.push(i);
		}
		const spans = [];
		let from = 0;
		while (from <= flat.length - target.length) {
			const at = flat.indexOf(target, from);
			if (at < 0) break;
			spans.push([map[at], map[at + target.length - 1] + 1]);
			from = at + target.length;
		}
		let out = text;
		for (let i = spans.length - 1; i >= 0; i -= 1) out = `${out.slice(0, spans[i][0])}\n${out.slice(spans[i][1])}`;
		return out;
	};
	const bits = [];
	if (old.length >= 8) bits.push(old);
	for (const part of old.split(/\n{2,}/)) {
		const bit = part.trim();
		if (bit.length >= 8 && !structural.test(bit)) bits.push(bit);
	}
	for (const line of old.split(/\n/)) {
		const bit = line.trim();
		if (bit.length >= 8 && !structural.test(bit)) bits.push(bit);
		for (const chunk of line.split(/(?<=[\.!?。…])\s+/)) {
			const sentence = chunk.trim();
			if (sentence.length >= 8 && !structural.test(sentence)) bits.push(sentence);
		}
	}
	bits.sort((a, b) => squash(b).length - squash(a).length);
	const seen = new Set();
	for (const bit of bits) {
		const key = squash(bit);
		if (seen.has(key)) continue;
		seen.add(key);
		fresh = cutSpan(fresh, bit);
	}
	fresh = fresh.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	if (!fresh || squash(fresh) === squash(old) || squash(old).includes(squash(fresh)) || squash(fresh).includes(squash(old))) return "";
	return fresh;
}
function valueFromChat(raw) {
	if (!raw.ok || !raw.data || typeof raw.data !== "object") return "";
	const direct = String(raw.data.value ?? "").trim();
	if (direct) return direct;
	const strings = Object.values(raw.data).filter((item) => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 12);
	strings.sort((a, b) => b.length - a.length);
	return strings[0] || "";
}
async function completeBlockValue(system, user, blockId) {
	const { tokens, timeout } = blockBudget(blockId);
	const ask = () => chatJson(`${system}\nJSON {"value": string} 만. 문장 중간에서 끊지 마.`, user, "block_value", BLOCK_JSON_SCHEMA, false, tokens, timeout);
	let result = await ask();
	let value = result.ok ? valueFromChat(result) : "";
	if (!value && (result.ok || /시간|timeout|빈/.test(String(result.error || "")))) {
		result = await ask();
		value = result.ok ? valueFromChat(result) : "";
	}
	if (!result.ok) return result;
	if (!value) return { ok: false, error: "이 칸을 쓰지 못했습니다. 있던 글은 그대로 둡니다." };
	return { ok: true, value };
}
async function finishSuno(text) {
	let out = String(text || "").trim();
	if (!out || out.length <= 1000) return out;
	const rule = "영어 수노 스타일 프롬프트 한 편만. JSON {\"value\": string} 만. 마지막은 완성된 문장으로 끝내라. 단어나 문장 중간에서 끊지 마. 뒤를 잘라 내지 마. 공백 포함 1000자 이하다. 길면 끝만 자르지 말고 처음부터 더 짧게 다시 써서 1000자 안에 끝내라.";
	for (let i = 0; i < 2; i += 1) {
		const shot = await completeBlockValue(rule, `이 프롬프트는 ${out.length}자다. 1000자 이하 완성본으로 다시 써라.\n\n${out}`, "suno");
		if (!shot.ok) return "";
		out = String(shot.value || "").trim();
		if (out && out.length <= 1000) return out;
	}
	return "";
}
function sunoDefault(genreId, prefs) {
	const saved = String(prefs?.sunoBase || "").trim();
	if (saved) return saved;
	return String(readSunoBase(genreId) || "").trim();
}
async function settleSuno(text, genreId, prefs) {
	const raw = String(text || "").trim();
	const base = sunoDefault(genreId, prefs);
	const same = base && raw.replace(/\s+/g, " ") === base.replace(/\s+/g, " ");
	if (raw && raw.length < 1000) return raw;
	if (same) return raw;
	return base || raw;
}
const SINGLE_FIELDS = {
	summary: "summary",
	title: "confirmedTitle",
	lyrics: "lyricsBlock",
	suno: "sunoStyle",
	thumb: "geminiPrompt",
	"yt-title": "youtubeTitle",
	"yt-desc": "youtubeDescription",
	letter: "fanLetter"
};
const PLAYLIST_FIELDS = {
	summary: "summary",
	title: "confirmedTitle",
	tracks: "tracklist",
	suno: "sunoStyle",
	thumb: "geminiPrompt",
	"yt-title": "youtubeTitle",
	"yt-desc": "youtubeDescription",
	community: "communityPost"
};
export async function runGenerateBlock(data: any) {
	data.prefs = livePref(data.genreId, data.prefs);
	const genre = getGenre(data.genreId);
	if (data.kind === "playlist") {
		if (data.storyPlaylist) {
			const current = { ...data.playlist };
			const titles = (Array.isArray(data.extraTracks) ? data.extraTracks : [])
				.map((row) => (typeof row === "string" ? row : String(row?.title || "")))
				.map((row) => row.trim())
				.filter(Boolean);
			const theme = String(data.theme || current.confirmedTitle || "").trim();
			if (data.blockId === "tracks") {
				current.tracklist = titles.join("\n");
				return { ok: true, kind: "playlist", pkg: normalizePlaylist(current) };
			}
			const field = PLAYLIST_FIELDS[data.blockId];
			if (!field) return { ok: false, error: "이 칸은 다시 쓰지 않습니다." };
			const gid = data.genreId === "cover-reborn" ? "cover-reborn" : "your-story";
			const genre = getGenre(gid);
			const keepStory = /보완|그대로 유지|현재 글/.test(String(data.note || ""));
			const first = await completeBlockValue([
				fieldLock(data.prefs, gid, data.blockId),
				gid === "cover-reborn"
					? "커버 플레이리스트 한 칸만 다시 쓴다. EP와 ACT 번호를 넣지 마. 다른 칸은 출력하지 마."
					: "사연 플레이리스트 한 칸만 다시 쓴다. EP와 ACT 번호를 넣지 마. 다른 칸은 출력하지 마.",
				keepStory ? "요구에 보완·유지가 있으면 잘 된 문장은 남긴다." : "이 칸만 처음부터 다시 쓴다. 현재 문장을 한 줄도 남기지 마.",
				`주제: ${theme}`,
				`수록곡:\n${titles.join("\n")}`,
				data.blockId === "title" ? "value는 주제에서 나온 플레이리스트 제목 한 줄이다. 곡 제목을 제목 칸에 나열하지 마." : "",
				data.blockId === "suno" ? "value는 영어 완성본. 중간에서 끊거나 뒤를 자르지 마. 1000자 이하." : "",
				data.blockId === "yt-title" ? `value는 100자 이하. 주제 | 감성 한줄 | ${genre.youtubeLabel} | AI Artist Noa` : "",
				data.blockId === "thumb" ? geminiFieldRule(genre, "", true, data.prefs, data.thumbCast) : "",
				data.blockId === "yt-desc" || data.blockId === "community" ? "짧은 문단마다 첫 글자 이모지 1개. 가사 전문 금지. 수록곡 줄은 넣지 마." : ""
			].filter(Boolean).join("\n"), [
				`필드: ${field}`,
				data.note ? `요구: ${data.note}` : "요구: 이 칸만 처음부터 완성본으로 다시 쓴다. 현재 글은 남기지 마.",
				keepStory ? `현재값:\n${String(current[field] ?? "").slice(0, 2000)}` : "현재값은 보내지 않는다. 베끼지 마."
			].join("\n"), data.blockId);
			if (!first.ok) return first;
			let value = String(first.value || "").trim();
			if (!keepStory) value = dropCarriedText(value, current[field]);
			if (!value) return { ok: false, error: "이전 글이 남아 저장하지 않았습니다. 있던 글은 그대로 둡니다." };
			if (data.blockId === "suno") current[field] = await settleSuno(value, gid, data.prefs);
			else if (data.blockId === "yt-desc") current[field] = descriptionWithTracklist(value, titles.join("\n"));
			else current[field] = data.blockId === "thumb" ? sanitizeGeminiPrompt(value) : value;
			return { ok: true, kind: "playlist", pkg: normalizePlaylist(current) };
		}
		const current = { ...data.playlist };
		if (data.blockId === "community" && !playlistLetter(data.prefs)) {
			current.communityPost = "";
			return {
				ok: true,
				kind: "playlist",
				pkg: normalizePlaylist(current)
			};
		}
		if (data.blockId === "tracks") {
			current.tracklist = formatTimedTracklist(data.act, data.extraTracks);
			return {
				ok: true,
				kind: "playlist",
				pkg: normalizePlaylist(current)
			};
		}
		const show = playlistOutput(data.prefs);
		if (data.blockId === "title" && show?.title === false) {
			current.confirmedTitle = "";
			return { ok: true, kind: "playlist", pkg: normalizePlaylist(current) };
		}
		if (data.blockId === "suno" && show?.suno === false) {
			current.sunoStyle = "";
			return { ok: true, kind: "playlist", pkg: normalizePlaylist(current) };
		}
		const field = PLAYLIST_FIELDS[data.blockId];
		const act = getAct(data.act);
		const prefix = playlistTitlePrefix(act);
		const langName = langLabel(prefOutputLang(data.genreId, data.prefs.lang));
		const scope = scopeOf(data.prefs);
		const redoList = !/보완|그대로 유지|현재 글/.test(String(data.note || ""));
		const first = await completeBlockValue([
			fieldLock(data.prefs, data.genreId, data.blockId),
			"사용자 설정 중 이 칸 규칙만 적용한다. 잠긴 필드는 이 요청에 오지 않는다.",
			redoList ? "이 칸만 처음부터 다시 쓴다. 현재 문장을 한 줄도 남기지 마." : "요구에 보완·유지가 있으면 잘 된 문장은 남긴다.",
			"한 장르만. 다른 블록을 출력하지 마. 부른 가사 전문은 쓰지 마.",
			`장르: ${genre.label}`,
			"" ,
			data.blockId === "title" ? `value는 ${keepLang(scope.has("title"), langName)} ACT 확정 제목 한 줄. 곡 원곡 제목을 이 칸에 복사하지 마.` : "",
			data.blockId === "suno" ? "value는 영어 완성본. 중간에서 끊거나 뒤를 자르지 마. 1000자 이하." : "",
			data.blockId === "yt-title" ? `value는 100자 이하. ${prefix} | 감성 한줄 | ${genre.youtubeLabel} | AI Artist Noa. ${scope.has("ytTitle") ? langName : "유튜브 제목은 번역하지 마."}` : "",
			data.blockId === "thumb" ? geminiFieldRule(genre, "", true, data.prefs, data.thumbCast) : "",
			data.blockId === "summary" ? `value는 ${keepLang(scope.has("summary"), langName)} ${data.prefs.langRule || ""}` : "",
			data.blockId === "yt-desc" || data.blockId === "community" ? `짧은 문단마다 첫 글자 이모지 1개. 가사 전문 금지. ${data.blockId === "community" ? keepLang(scope.has("letter"), langName) : keepLang(scope.has("desc"), langName)} 트랙리스트 줄은 넣지 마.` : ""
		].filter(Boolean).join("\n"), [
			`필드: ${field}`,
			data.note ? `요구: ${data.note}` : "요구: 이 칸만 처음부터 완성본으로 다시 쓴다. 현재 글은 남기지 마.",
			redoList ? "현재값은 보내지 않는다. 베끼지 마." : `현재값:\n${String(current[field] ?? "")}`
		].join("\n"), data.blockId);
		if (!first.ok) return first;
		let value = first.value;
		if (redoList) value = dropCarriedText(value, current[field]);
		if (!String(value || "").trim()) return { ok: false, error: "이전 글이 남아 저장하지 않았습니다. 있던 글은 그대로 둡니다." };
		if (data.blockId === "suno" && value.trim().length > 1000) current[field] = await settleSuno(value, data.genreId, data.prefs); else if (data.blockId === "yt-desc") current[field] = descriptionWithTracklist(value, String(current.tracklist || formatTimedTracklist(data.act, data.extraTracks)));
		else current[field] = data.blockId === "thumb" ? sanitizeGeminiPrompt(value) : value;
		const next = normalizePlaylist(current);
		if (data.blockId === "thumb" && !data.skipThumb) await withThumb(next, idsForThumbCast(data.thumbCast));
		return {
			ok: true,
			kind: "playlist",
			pkg: next
		};
	}
	const current = { ...data.single };
	if ((data.blockId === "letter" || data.blockId === "community") && !data.prefs.community) {
		current.fanLetter = "";
		return {
			ok: true,
			kind: "single",
			pkg: normalizePackage(current)
		};
	}
	if (data.genreId === "kpop-original" && data.blockId === "lyrics" && String(data.originalLyrics || "").trim()) {
		current.lyricsBlock = String(data.originalLyrics).trim();
		if (data.prefs.descLyrics) current.youtubeDescription = cleanDescriptionLyrics(current.youtubeDescription || "", current.lyricsBlock);
		return {
			ok: true,
			kind: "single",
			pkg: normalizePackage(current)
		};
	}
	const field = SINGLE_FIELDS[data.blockId];
	const ep = resolveEp(data.epN, data.originalTitle);
	const scope = scopeOf(data.prefs);
	const langName = langLabel(prefOutputLang(data.genreId, data.prefs.lang));
	const redo = !/보완|그대로 유지|현재 글/.test(String(data.note || ""));
	const systemText = [
		fieldLock(data.prefs, data.genreId, data.blockId),
		redo
			? "이 칸만 처음부터 다시 쓴다. 현재값은 버린다. 현재 문장, 다른 EP 제목, 다른 곡 가사를 한 줄이라도 남기면 실패다. JSON {\"value\": string} 만."
			: "이미 있는 글을 보완한다. 잘 된 문장과 구조는 유지하고 부족한 곳만 채운다. 통째로 새로 쓰지 마. JSON {\"value\": string} 만.",
		"한 장르만. 다른 블록을 출력하지 마.",
		`EP.${ep.n} 확정 제목=${String(current.confirmedTitle || "").trim() || "(아직 없음)"} 원곡 제목=${ep.title}`,
		`장르: ${genre.label}`,
		data.blockId === "summary" ? summaryFieldRule(langName, scope.has("summary")) : "",
		data.blockId === "lyrics" ? lyricsOrder(genre, data.prefs, langName, data.genreId) : "",
		data.blockId === "title" ? "이 칸의 확정 제목을 그 곡의 제목으로 쓴다. 원곡 제목을 복사하지 마. 다른 EP 제목은 쓰지 마. 사용자가 이미 확정 제목을 바꿔 두었고 이 칸을 비우라는 요구가 없으면 그 확정 제목을 유지한다." : "",
		data.blockId === "suno" ? `영어만. 완성된 문장으로 끝내라. 중간에서 끊거나 뒤를 자르지 마. 공백 포함 1000자 이하. 길면 처음부터 더 짧게 다시 써라. ${readSunoBase(genre.id) ? `저장 베이스로 시작한다.\n[수노 저장 베이스]\n${readSunoBase(genre.id)}` : ""}` : "",
		data.blockId === "yt-title" ? `완성된 검색 제목만 100자 이하. 형식: ${data.prefs.titleFormat}. 장르라벨=${genre.youtubeLabel}. ${scope.has("ytTitle") ? langName : "유튜브 제목은 번역하지 마. 넣은 제목과 감성 한줄은 그 칸 언어 그대로."} 감성 한줄은 이 곡에서만 쓸 새 시적 문장 하나. 확정 제목과 같거나, 제목을 조금 늘린 문장은 넣지 마. 같은 구절 반복 금지. 고정·원제 유지·형식 설명을 제목에 넣지 마.` : "",
		data.blockId === "thumb" ? `이미지에 쓸 곡 제목은 확정 제목 「${current.confirmedTitle}」이다. 한 글자도 바꾸지 마. 번역하지 마. 장르명을 제목 자리에 넣지 마. 장르명은 제목 아래 작은 줄만. ${geminiFieldRule(genre, ep.n, false, data.prefs, data.thumbCast, "", current.confirmedTitle)}` : "",
		data.blockId === "yt-desc" ? `${keepLang(scope.has("desc"), langName)} ${data.prefs.descLyrics ? "짧은 문단마다 첫 글자 이모지 1개. 가사 구간은 ━━━━━━━━━━━━━━━━━━━━ 다음 줄에 그 언어의 가사 표시 한 단어만 쓴다. 한국어는 가사, 일본어는 歌詞, 영어는 Lyrics, 태국어는 เนื้อร้อง. 그 아래 부른 가사만. 아래쪽 선으로 닫는다. 수노 명령어·섹션태그·보컬/악기 지시 금지." : "가사 전문 금지. 사용자 설정: 설명란 가사 아니오. 짧은 문단마다 첫 글자 이모지 1개."}\n한 줄·두 줄은 실패다. 문단 3개 이상. 160자는 가사를 뺀 본문만이다. 가사 길이는 포함하지 마. 곡 소개, 이 곡만의 감정, 장르, 댓글 CTA, 해시태그를 빠뜨리지 마. 곡 제목이 필요하면 확정 제목만 쓴다.\n사용자 설정 설명란 규칙:\n${data.prefs.descRules}` : "",
		data.blockId === "letter" ? `${keepLang(scope.has("letter"), langName)} 커뮤니티 글. 한 줄은 실패다. 문단 3개 이상, 90자 이상. ${greetOrder(genre, data.prefs)} 이 곡의 사연, 공감, 댓글 CTA. 가사 전문 금지. 문단마다 첫 글자 이모지.\n사용자 설정 커뮤니티 규칙:\n${data.prefs.communityRules}` : "",
	].filter(Boolean).join("\n");
	const confirmedNow = String(current.confirmedTitle || "").trim();
	const userText = [
		`필드: ${field}`,
		confirmedNow ? `결과창 상단 확정 제목은 「${confirmedNow}」이다. 결과 칸의 곡 제목은 이 글자만 쓴다. 원곡 제목을 결과 제목으로 쓰지 마.` : "확정 제목이 아직 없다.",
		redo && data.blockId !== "thumb" ? "현재값은 베끼지 마. 확정 제목을 결과의 제목으로 쓰고, 원곡은 소재로만 쓴다." : data.blockId === "thumb" ? `확정 제목(이미지 제목, 번역 금지): ${confirmedNow}` : `현재 확정 제목: ${confirmedNow}`,
		redo ? "" : `감성 한줄(요약 첫 줄): ${current.summary.split(/\n/)[0] || ""}`,
		redo ? "" : `현재값:\n${String(current[field])}`,
		data.originalLyrics ? `원곡은 소재다. 다른 EP로 바꾸지 마.\n원곡 제목: ${ep.title}\n원곡 가사:\n${data.originalLyrics.slice(0, data.blockId === "lyrics" ? 1600 : 700)}` : `원곡 제목: ${ep.title}`,
		data.note ? `요구: ${data.note}` : redo ? "요구: 현재 글을 버리고 상단 확정 제목을 따른 완성본을 작성한다. 원곡 제목을 결과에 복사하지 마." : "요구: 빈 칸이다. 장르 지침대로 처음부터 완성본을 작성한다. 대충 채우지 마."
	].filter(Boolean).join("\n");
	const first = await completeBlockValue(systemText, userText, data.blockId);
	if (!first.ok) return first;
	let value = first.value;
	const prevText = String(current[field] || "").trim();
	const moodSlot = (text) => {
		const parts = String(text || "").split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
		return parts.length >= 3 ? parts[2] : "";
	};
	const sameMood = data.blockId === "yt-title" && prevText && moodSlot(value) === moodSlot(prevText);
	if (redo && prevText && (String(value || "").trim() === prevText || sameMood)) {
		const again = await completeBlockValue(systemText, `${userText}\n직전 결과와 같으면 실패다. 감성 한줄은 이전과 다른 새 문장으로 써라.\n금지:\n${prevText.slice(0, 500)}`, data.blockId);
		if (again.ok && String(again.value || "").trim()) {
			const nextValue = String(again.value).trim();
			const nextSame = data.blockId === "yt-title" && moodSlot(nextValue) === moodSlot(prevText);
			if (nextValue !== prevText && !nextSame) value = again.value;
		}
	}
	if (redo) value = dropCarriedText(value, prevText);
	if (data.blockId === "yt-title" && redo && prevText && moodSlot(value) === moodSlot(prevText)) {
		return { ok: false, error: "감성 한줄이 바뀌지 않았습니다. 있던 글은 그대로 둡니다." };
	}
	const langCode = prefOutputLang(data.genreId, data.prefs.lang);
	const langField = data.blockId === "title" ? "title" : data.blockId === "lyrics" ? "lyrics" : data.blockId === "yt-desc" ? "desc" : data.blockId === "letter" ? "letter" : data.blockId === "summary" ? "summary" : "";
	if (langField && scope.has(langField) && langCode !== "ko" && data.genreId !== "kpop-original" && wrongSpoken(langCode, value)) {
		const againLang = await completeBlockValue(systemText, `${userText}\n언어가 틀렸다. 이 칸은 ${langName}로만 다시 써라. 한국어로 쓰지 마. 확정 제목은 그대로 둔다.`, data.blockId);
		if (againLang.ok && String(againLang.value || "").trim() && !wrongSpoken(langCode, againLang.value)) value = againLang.value;
	}
	if (data.blockId === "yt-title") value = alignYoutubeConfirmed(value, current.confirmedTitle);
	const descLyrics = data.genreId === "kpop-original" && String(data.originalLyrics || "").trim() ? String(data.originalLyrics).trim() : current.lyricsBlock;
	if (data.blockId === "yt-desc" && data.prefs.descLyrics) current[field] = cleanDescriptionLyrics(value, descLyrics);
	else if (data.blockId === "yt-desc" && !data.prefs.descLyrics) current[field] = descriptionWithoutLyrics(value);
	else if (data.blockId === "thumb") current[field] = pinThumbTitle(sanitizeGeminiPrompt(value), current.confirmedTitle);
	else if (data.blockId === "suno") current[field] = await settleSuno(value, data.genreId, data.prefs);
	else current[field] = data.blockId === "lyrics" ? applyGenreLyrics(data.genreId, value) : data.blockId === "letter" ? finishLetter(value, getGenre(data.genreId), data.prefs) : value;
	if (data.blockId === "lyrics" && data.prefs.descLyrics && data.genreId !== "kpop-original") {
		current.youtubeDescription = cleanDescriptionLyrics(current.youtubeDescription || "", value);
	}
	if (data.blockId === "title") {
		const locked = lockedTitleFor(data.genreId, ep.n, data.originalTitle || ep.title, data.prefs);
		if (locked) current.confirmedTitle = locked;
	}
	const next = normalizePackage(current);
	if (data.blockId === "thumb" && !data.skipThumb) await withThumb(next, idsForThumbCast(data.thumbCast));
	return {
		ok: true,
		kind: "single",
		pkg: next
	};
}
function asStory(raw, _title, lyrics = "", community = true, descLyrics = true) {
	if (!raw || typeof raw !== "object") return null;
	const o = raw;
	const str = (k) => typeof o[k] === "string" ? o[k] : "";
	const yt = str("youtubeTitle").trim();
	const gemini = sanitizeGeminiPrompt(str("geminiPrompt"));
	const desc = descLyrics ? cleanDescriptionLyrics(str("youtubeDescription"), lyrics) : descriptionWithoutLyrics(str("youtubeDescription"));
	const letter = community ? str("fanLetter") : "";
	if (!yt || !gemini || !desc) return null;
	if (community && !letter) return null;
	return normalizeStory({
		geminiPrompt: gemini,
		youtubeTitle: yt.slice(0, 100),
		youtubeDescription: desc,
		fanLetter: letter,
		sunoStyle: str("sunoStyle").trim(),
		thumbUrl: "",
		thumbCast: "female"
	});
}
function storyDescOrder(pref, langName, scopeHas, genreId = "your-story") {
	const rules = String(pref?.descRules || "").trim();
	const tags = getGenre(genreId).hashtags || (genreId === "cover-reborn" ? "#재탄생 #유명곡커버" : "#사연곡 #당신의이야기우리의음악");
	const shared = "다른 곡 설명란과 같은 사용자 설정 설명란 규칙을 한 글자도 빠뜨리지 마. 플레이리스트용 곡명만 규칙으로 줄이지 마.";
	const sung = genreId === "cover-reborn" ? "이 커버의 부른 가사만. 개사 금지. 트랙리스트로 넣지 마." : "이 사연의 부른 가사만.";
	const coverNote = genreId === "cover-reborn"
		? `설명란 본문에 원곡 가수 이름을 적는다. 마지막에 이 문장을 그대로 넣는다. ${"본 영상은 커버곡이며, 모든 저작권은 원저작권자에게 있습니다."} 원곡 가수가 없으면 설명란을 만들지 마. 가수 이름을 만들지 마.`
		: "장르 칸이 비어 있으면 장르 이름을 만들지 마.";
	if (pref?.descLyrics) return `${keepLang(scopeHas, langName)} 해시태그 ${tags}. ${shared}\n${rules}\n가사 전문을 ━━━━━━━━━━━━━━━━━━━━ 사이에 넣음. 위쪽 선 바로 다음 줄은 주사용 언어다. 한국어는 가사, 일본어는 歌詞, 영어는 Lyrics, 태국어는 เนื้อเพลง. 그 아래는 ${sung} 수노 명령어 금지. 다른 곡 가사 금지. ${coverNote}`;
	return `${keepLang(scopeHas, langName)} 사용자 설정: 설명란 가사 아니오. ${shared}\n${rules}\n${coverNote}`;
}
function storyLetterOrder(pref, langName, scopeHas) {
	if (!pref?.community) return "빈 문자열. 사용자 설정: 커뮤니티 글 작성 아니오.";
	const rules = String(pref?.communityRules || "").trim();
	return `${keepLang(scopeHas, langName)} 커뮤니티 글. 호칭 ${STORY_BRAND.fan}. 다른 곡과 같은 사용자 설정 커뮤니티 규칙을 한 글자도 빠뜨리지 마.\n${rules}`;
}
function storySystem(pref, thumbCast = "female", musicGenre = "", genreId = "your-story") {
	const cover = genreId === "cover-reborn";
	const langName = langLabel(prefOutputLang(genreId, pref.lang));
	const scope = scopeOf(pref);
	return [
		userPrefZeroLock(pref, genreId),
		"",
		cover ? "너는 AI Artist Noa의 유명곡 커버 작성기다." : "너는 AI Artist Noa의 사연곡 작성기다.",
		cover
			? "우선순위: 사용자 설정 0순위. 이 장르는 독립이다. 공통 규칙을 따르고, 그 아래는 재탄생 커버곡 장르 규칙만 따른다. 사연곡 장르 규칙을 읽지 마. 0-1~0-27과 충돌하면 공통 설정이 이긴다."
			: "우선순위: 사용자 설정 0순위. 사연곡 지침은 0-28에 들어 있다. 0-1~0-27과 충돌하면 그 설정이 이긴다.",
		cover
			? "화면, 설명란, 커뮤니티, 플레이리스트는 공통 규칙을 따른다. 이 장르만 다른 점은 이 장르 규칙에 적힌 것만이다. 사연곡 장르 규칙을 가져오지 마."
			: "사연곡의 디자인, 자동화, 화면, 설명란, 커뮤니티는 다른 곡과 같은 공통 사용자 설정을 따른다. 사연만 다른 점은 0-00e의 사연 항목뿐이다. 한 곡 설명란을 플레이리스트 규칙으로 줄이지 마.",
		cover ? "시리즈: 재탄생, 유명곡 커버. 유명곡을 커버한다." : "시리즈: 당신의 이야기, 우리의 음악. 사람의 이야기를 음악으로 바꾼다. 누군가의 이야기 = 나의 이야기.",
		"EP/ACT 금지. JSON만.",
		cover ? "입력 가사를 그대로 쓴다. 개사하지 마." : "가사를 전체 흐름으로 분석한다. 한 감정만 제목·썸네일·설명·편지에 관통시킨다.",
		cover ? "원곡 가수를 지어내지 마. 과장 금지." : "과장·낚시·억지 눈물·유행어 금지. 실제 사연처럼.",
		"사용자가 넣은 곡 제목 철자·기호를 바꾸지 마.",
		"",
		formatGenreCard(getGenre(genreId)),
		"",
		"[필드]",
		`moodLine: ${keepLang(scope.has("thumbText"), langName)} 감성 한줄. 짧고 자연. 파이프 금지. 제목과 연결. 광고·장르 설명 금지.`,
		cover
			? "inferredGenre: 사용자가 원곡 가수를 줬으면 그 글자를 그대로 복사한다. 띄어쓰기와 기호를 바꾸지 마. 없으면 빈 문자열. 가수 이름을 만들지 마."
			: "inferredGenre: 사용자가 장르를 줬으면 그 글자를 그대로 복사한다. 띄어쓰기와 기호를 바꾸지 마. 없으면 빈 문자열. 가사로 장르를 만들지 마.",
		cover
			? `youtubeTitle: 100자 이하. 형식: ${pref.titleFormat}. 곡제목과 원곡 가수 사이는 - 다. 그 사이에 | 를 넣지 마. 원곡 가수 자리는 사용자가 입력한 원곡 가수 글자만 쓴다. 다른 가수 이름으로 바꾸거나 아는 원곡 가수로 넣지 마. 제목 맨 끝은 반드시 Cover by AInoa 다. 이 문구를 빼거나 바꾸지 마. ${scope.has("ytTitle") ? langName : "유튜브 제목은 번역하지 마."} EP 래퍼 금지.`
			: `youtubeTitle: 100자 이하. 형식: ${pref.titleFormat}. 이 형식을 바꾸지 마. ${scope.has("ytTitle") ? langName : "유튜브 제목은 번역하지 마."} 곡 제목을 검색 키워드로. EP 래퍼 금지. 브랜드 문장 강제 삽입 금지.`,
		geminiFieldRule(getGenre(genreId), "", false, pref, thumbCast, musicGenre),
		`youtubeDescription: ${storyDescOrder(pref, langName, scope.has("desc"), genreId)}`,
		`fanLetter: ${storyLetterOrder(pref, langName, scope.has("letter"))}`,
		cover
			? "sunoStyle = 빈 문자열. 이 장르는 수노를 기본 출력하지 않는다. 사용자가 수노를 요청한 경우에만 영어 700–900자."
			: "sunoStyle = 빈 문자열. 사연곡은 수노를 기본 출력하지 않는다. 사용자가 수노를 요청한 경우에만 영어 700–900자.",
	].join("\n");
}
export async function runGenerateStory(data: any) {
	data.prefs = livePref(data.genreId || "your-story", data.prefs);
	const system = storySystem(data.prefs, data.thumbCast, data.genre || "", data.genreId || "your-story");
	const cover = data.genreId === "cover-reborn";
	const user = [
		`제목: ${data.title}`,
		data.genre
			? cover
				? `원곡 가수(사용자 지정, 글자 그대로): ${data.genre}`
				: `장르(사용자 지정, 글자 그대로): ${data.genre}`
			: cover
				? "원곡 가수: 비어 있음. 만들지 마."
				: "장르: 비어 있음. 만들지 마. 제목과 가사로 추론하지 마.",
		data.vocal ? `보컬: ${data.vocal}` : "보컬: 가사에서 판단. 썸네일 여자 주인공 NOA는 유지",
		"",
		"[가사]",
		data.lyrics,
		"썸네일 제목은 위 제목 글자 그대로다. 번역하지 마. 장르명을 제목 자리에 넣지 마.",
		`\n[설명란용 가사 — 수노 명령 제거]\n${sungLyrics(data.lyrics)}`,
		data.note ? `\n[요구]\n${data.note}` : ""
	].filter(Boolean).join("\n");
	const first = await chatJson(system, user, "story_package", STORY_JSON_SCHEMA, true, 12000, 18e4);
	let parsed = first.ok ? asStory(first.data, data.title, data.lyrics, data.prefs.community, data.prefs.descLyrics) : null;
	if (!parsed && (first.ok || first.error.includes("생성 실패 (400)"))) {
		const second = await chatJson(system, user, "story_package", STORY_JSON_SCHEMA, false, 12000, 18e4);
		if (!second.ok) return second;
		parsed = asStory(second.data, data.title, data.lyrics, data.prefs.community, data.prefs.descLyrics);
	}
	if (!parsed) {
		if (!first.ok) return first;
		return {
			ok: false,
			error: cover ? "커버곡 필드가 비었습니다." : "사연곡 필드가 비었습니다."
		};
	}
	parsed.thumbCast = data.thumbCast;
	parsed.sourceGenre = String(data.genre || "").trim();
	if (cover) {
		parsed.youtubeTitle = coverYoutubeTitle(parsed.youtubeTitle, data.title, String(data.genre || ""));
		parsed.youtubeDescription = withCoverCredit(parsed.youtubeDescription, parsed.sourceGenre);
		parsed.geminiPrompt = lockCoverThumb(parsed.geminiPrompt, String(data.title || ""), String(data.genre || ""));
	} else {
		parsed.geminiPrompt = pinThumbTitle(parsed.geminiPrompt, String(data.title || ""));
	}
	if (String(parsed.sunoStyle || "").trim().length > 1000) parsed.sunoStyle = await settleSuno(parsed.sunoStyle, data.genreId || "your-story", data.prefs);
	if (data.skipThumb) return {
		ok: true,
		pkg: parsed
	};
	try {
		return {
			ok: true,
			pkg: await withThumb(parsed, idsForThumbCast(data.thumbCast))
		};
	} catch {
		return {
			ok: true,
			pkg: parsed
		};
	}
}
const STORY_FIELDS = {
	thumb: "geminiPrompt",
	"yt-title": "youtubeTitle",
	"yt-desc": "youtubeDescription",
	letter: "fanLetter",
	suno: "sunoStyle"
};
export async function runGenerateStoryBlock(data: any) {
	data.prefs = livePref(data.genreId || "your-story", data.prefs);
	const current = { ...data.story };
	current.sourceGenre = String(data.genre || "").trim();
	if (data.blockId === "letter" && !data.prefs.community) {
		current.fanLetter = "";
		return {
			ok: true,
			pkg: normalizeStory(current)
		};
	}
	const field = STORY_FIELDS[data.blockId];
	const keep = /보완|그대로 유지|현재 글/.test(String(data.note || ""));
	const gid = data.genreId === "cover-reborn" ? "cover-reborn" : "your-story";
	const langName = langLabel(prefOutputLang(gid, data.prefs?.lang));
	const scope = scopeOf(data.prefs);
	const first = await completeBlockValue([
		fieldLock(data.prefs, gid, data.blockId),
		gid === "cover-reborn" ? "EP 금지. 시리즈: 재탄생, 유명곡 커버. 사연곡이 아니다." : "EP 금지. 사연곡 시리즈: 당신의 이야기, 우리의 음악.",
		keep ? "요구에 보완·유지가 있으면 잘 된 문장과 구조는 남기고 부족한 밀도만 채운다. 통째로 짧게 줄이지 마." : "처음부터 다시 쓰는 요구면 현재 문장을 남기지 마.",
		data.blockId === "yt-title"
			? gid === "cover-reborn"
				? `value는 100자 이하. 형식: ${data.prefs.titleFormat}. 곡 제목 "${data.title}"과 원곡 가수 "${String(data.genre || data.story?.sourceGenre || "").trim()}" 사이는 - 다. 그 가수 글자만 쓴다. 다른 가수 이름으로 바꾸지 마. 그 사이에 | 금지. 맨 끝은 반드시 Cover by AInoa.`
				: `value는 100자 이하. 형식: ${data.prefs.titleFormat}. 곡 제목 "${data.title}" 포함. EP/브랜드 강제 삽입 금지.`
			: "",
		data.blockId === "thumb" ? `${geminiFieldRule(getGenre(gid), "", false, data.prefs, data.thumbCast, data.genre || data.story?.sourceGenre || "", data.title || "")} 이미지 제목은 「${data.title || ""}」 그대로. 번역하지 마. 장르명을 제목에 넣지 마.` : "",
		data.blockId === "suno" ? "영어만. 완성된 문장으로 끝내라. 중간에서 끊거나 뒤를 자르지 마. 1000자 이하." : "",
		data.blockId === "yt-desc" ? storyDescOrder(data.prefs, langName, scope.has("desc"), gid) : "",
		data.blockId === "letter" ? storyLetterOrder(data.prefs, langName, scope.has("letter")) : ""
	].filter(Boolean).join("\n"), [
		`필드: ${field}`,
		`제목: ${data.title}`,
		keep ? `현재값:\n${String(current[field] || "").slice(0, 4000)}` : gid === "cover-reborn" ? "현재값은 베끼지 마. 이 커버만 보고 처음부터 완성본을 쓴다." : "현재값은 베끼지 마. 이 사연만 보고 처음부터 완성본을 쓴다.",
		data.note ? `요구: ${data.note}` : gid === "cover-reborn" ? "요구: 같은 커버로 다른 곡처럼 자세하고 완성된 글을 다시 쓴다." : "요구: 같은 사연으로 다른 곡처럼 자세하고 완성된 글을 다시 쓴다.",
		data.lyrics ? `가사:\n${String(data.lyrics).slice(0, data.blockId === "yt-desc" ? 4000 : 1200)}` : ""
	].filter(Boolean).join("\n"), data.blockId);
	if (!first.ok) return first;
	let value = first.value;
	if (!keep) value = dropCarriedText(value, current[field]);
	if (!String(value || "").trim()) return { ok: false, error: "이전 글이 남아 저장하지 않았습니다. 있던 글은 그대로 둡니다." };
	if (data.blockId === "suno") current[field] = await settleSuno(value, gid, data.prefs);
	else current[field] = data.blockId === "yt-desc" && data.prefs.descLyrics ? cleanDescriptionLyrics(value, data.lyrics) : data.blockId === "yt-desc" && !data.prefs.descLyrics ? descriptionWithoutLyrics(value) : data.blockId === "thumb" ? sanitizeGeminiPrompt(value) : value;
	if (gid === "cover-reborn" && data.blockId === "yt-title") {
		current[field] = coverYoutubeTitle(String(current[field] || ""), String(data.title || ""), String(data.genre || data.story?.sourceGenre || ""));
	}
	if (gid === "cover-reborn" && data.blockId === "thumb") {
		current[field] = lockCoverThumb(String(current[field] || ""), String(data.title || ""), String(data.genre || data.story?.sourceGenre || ""));
	}
	if (gid !== "cover-reborn" && data.blockId === "thumb") {
		current[field] = pinThumbTitle(String(current[field] || ""), String(data.title || ""));
	}
	if (gid === "cover-reborn" && data.blockId === "yt-desc") {
		current[field] = withCoverCredit(String(current[field] || ""), String(data.genre || data.story?.sourceGenre || ""));
	}
	const next = normalizeStory(current);
	return {
		ok: true,
		pkg: next
	};
}
