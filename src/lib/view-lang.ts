import { useEffect, useSyncExternalStore } from "react";
import dict from "../../data/live/번역/화면.json";
import { GATE_EVENT, masterLocked } from "./gate";
import { OUTPUT_LANGS, type OutputLang } from "./user-prefs";

const KEY = "noa-view-lang";
const EVENT = "noa-view-lang";
let viewNow: OutputLang = "ko";
let lockedNow = false;
let viewReady = false;
const viewListeners = new Set<() => void>();

function viewSnap() {
  return lockedNow ? viewNow : "ko";
}

function pullView() {
  viewNow = readViewLang();
  lockedNow = typeof window !== "undefined" && masterLocked();
  viewListeners.forEach((fn) => fn());
}

function watchView(fn: () => void) {
  viewListeners.add(fn);
  if (!viewReady && typeof window !== "undefined") {
    viewReady = true;
    viewNow = readViewLang();
    lockedNow = masterLocked();
    window.addEventListener(EVENT, pullView);
    window.addEventListener("storage", pullView);
    window.addEventListener(GATE_EVENT, pullView);
    window.addEventListener("noa-prefs", pullView);
  }
  return () => {
    viewListeners.delete(fn);
  };
}

const MARK: Record<string, { code: string; flag: string }> = {
  ko: { code: "KR", flag: "🇰🇷" },
  en: { code: "US", flag: "🇺🇸" },
  ja: { code: "JP", flag: "🇯🇵" },
  th: { code: "TH", flag: "🇹🇭" },
};

export function viewLangChoices() {
  return OUTPUT_LANGS.map((item) => ({
    id: item.id,
    code: MARK[item.id]?.code ?? item.id.toUpperCase(),
    flag: MARK[item.id]?.flag ?? "🏳️",
  }));
}

export function hasHangul(text: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

export function readViewLang(): OutputLang {
  if (typeof localStorage === "undefined") return "ko";
  try {
    const raw = localStorage.getItem(KEY) || "";
    if (OUTPUT_LANGS.some((item) => item.id === raw)) return raw as OutputLang;
  } catch {
    /* keep Korean */
  }
  return "ko";
}

export function writeViewLang(id: OutputLang) {
  if (!OUTPUT_LANGS.some((item) => item.id === id)) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* the choice still applies this visit */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useViewLang(): OutputLang {
  const lang = useSyncExternalStore(watchView, () => viewNow, () => "ko" as OutputLang);
  useEffect(() => {
    pullView();
  }, []);
  return lang;
}

export function useLockedViewLang(): OutputLang {
  return useSyncExternalStore(watchView, viewSnap, () => "ko" as OutputLang);
}

const lines = dict as Record<string, Partial<Record<"en" | "ja" | "th", string>>>;

export function viewText(text: string, lang: OutputLang) {
  const source = text.trim();
  if (!source || lang === "ko" || !hasHangul(source)) return text;
  return lines[source]?.[lang] || text;
}
