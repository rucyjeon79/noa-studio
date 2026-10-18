import { patchApp, readAppDump } from "./app-memory";
import { COMMON_ID, lockPolicy, readCommon, writeCommonField, type CommonPref } from "./user-prefs";

export const DEFAULT_GATE_PASSWORD = "7999";
export const SECURITY_KEY = "7999";
const OPEN_KEY = "noa-gate-open";
const DEVICE_KEY = "noa-device-id";
export const GATE_EVENT = "noa-gate";

let gateTouched = false;
let guestOpen = false;
let visitUnlock = false;

export function gateWasTouched() {
  return gateTouched;
}

function handsOffBrowser() {
  if (typeof navigator === "undefined") return true;
  if (navigator.webdriver) return true;
  return /HeadlessChrome/i.test(navigator.userAgent || "");
}

export function deviceId() {
  if (typeof localStorage === "undefined") return "";
  try {
    const saved = localStorage.getItem(DEVICE_KEY)?.trim() || "";
    if (saved) return saved;
    const next = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function deviceKind(): "phone" | "pc" {
  if (typeof navigator === "undefined") return "pc";
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return "phone";
  return "pc";
}

export function deviceLabel() {
  if (typeof navigator === "undefined") return "이 기기";
  const ua = navigator.userAgent || "";
  const android = ua.match(/Android\s[\d.]+;\s*([^);]+)/);
  if (android) {
    const model = android[1].replace(/\s*Build\/.*$/, "").trim();
    if (model && model !== "K" && model.length > 1) return `Android · ${model}`;
    return "Android 폰";
  }
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux PC";
  return "이 브라우저";
}

function splitAdmin(raw: string) {
  const cut = raw.indexOf("|");
  if (cut < 0) return { id: raw.trim(), label: "" };
  return { id: raw.slice(0, cut).trim(), label: raw.slice(cut + 1).trim() };
}

function readAdminRaw() {
  const raw = readAppDump().prefs[COMMON_ID] as Partial<CommonPref> | undefined;
  return typeof raw?.adminDevice === "string" ? raw.adminDevice.trim() : "";
}

export const ADMIN_DEVICE_LIMIT = 2;

export function readAdminSlots() {
  const seen = new Set<string>();
  const slots: { id: string; label: string }[] = [];
  for (const line of readAdminRaw().split("\n")) {
    const row = splitAdmin(line.trim());
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    slots.push(row);
    if (slots.length >= ADMIN_DEVICE_LIMIT) break;
  }
  return slots;
}

export function readAdminDevice() {
  return readAdminSlots()[0]?.id || "";
}

export function readAdminLabel() {
  return readAdminSlots()[0]?.label || "";
}

export function isAdminDevice() {
  const mine = deviceId();
  if (!mine) return false;
  return readAdminSlots().some((row) => row.id === mine);
}

export function canReviseConfirmed() {
  return isAdminDevice();
}

export function adminSealDenied() {
  return "잠금이 풀려 있어도 최고 관리자 기기만 확정, 확정 해제, 확정된 결과 수정과 저장을 할 수 있습니다.";
}

function writeAdminSlots(slots: { id: string; label: string }[]) {
  const text = slots
    .slice(0, ADMIN_DEVICE_LIMIT)
    .filter((row) => row.id)
    .map((row) => `${row.id}|${row.label}`)
    .join("\n");
  writeCommonField("adminDevice", text);
}

function refuseSandboxAdmin() {
  const label = deviceLabel();
  return label === "Linux PC" || label === "이 브라우저";
}

export function claimAdminDevice() {
  if (handsOffBrowser() || refuseSandboxAdmin()) return;
  if (readAdminSlots().length) return;
  const mine = deviceId();
  if (!mine) return;
  writeAdminSlots([{ id: mine, label: deviceLabel() }]);
}

export function assignAdminDevice() {
  if (handsOffBrowser() || refuseSandboxAdmin()) return "이 브라우저에서는 관리 기기를 등록하지 않습니다.";
  const mine = deviceId();
  if (!mine) return "이 기기를 확인하지 못했습니다.";
  const slots = readAdminSlots();
  if (slots.some((row) => row.id === mine)) return "";
  if (slots.length >= ADMIN_DEVICE_LIMIT) return "최고 관리자 기기는 2대까지입니다.";
  writeAdminSlots([...slots, { id: mine, label: deviceLabel() }]);
  return "";
}

export function releaseAdminSlot(id: string, security: string) {
  if (security.trim() !== readSecurityKey()) return "보안키가 다릅니다.";
  const slots = readAdminSlots();
  if (!slots.some((row) => row.id === id)) return "그 기기가 없습니다.";
  const mine = deviceId();
  writeAdminSlots(slots.filter((row) => row.id !== id));
  if (mine && mine === id) {
    gateTouched = true;
    guestOpen = false;
    patchApp((d) => {
      d.meta.gateOpen = false;
    }, "meta");
    try {
      sessionStorage.removeItem(OPEN_KEY);
    } catch {
      /* private mode */
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GATE_EVENT));
  }
  return "";
}

export function confirmAssignAdmin(password: string, security: string) {
  if (password !== readGatePassword()) return "비밀번호가 다릅니다.";
  if (security !== readSecurityKey()) return "보안키가 다릅니다.";
  return assignAdminDevice();
}

export function readGatePassword() {
  const saved = readAppDump().meta.gatePassword?.trim();
  return saved || DEFAULT_GATE_PASSWORD;
}

export function readSecurityKey() {
  return SECURITY_KEY;
}

export function ensureSecurityKey() {
  if (readAppDump().meta.securityKey === SECURITY_KEY) return;
  patchApp((d) => {
    d.meta.securityKey = SECURITY_KEY;
  }, "meta");
}

export function writeGatePassword(next: string) {
  patchApp((d) => {
    d.meta.gatePassword = next.trim();
    d.meta.securityKey = SECURITY_KEY;
  }, "meta");
}

export function isGateOpen() {
  if (!isAdminDevice()) return visitUnlock;
  if (gateTouched) return guestOpen;
  return readAppDump().meta.gateOpen === true;
}

export function masterLocked() {
  if (!lockPolicy(readCommon().lockRule).master) return false;
  return !isGateOpen();
}

export function setGateOpen(open: boolean) {
  if (handsOffBrowser()) return;
  gateTouched = true;
  guestOpen = open;
  if (!isAdminDevice()) {
    visitUnlock = open;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GATE_EVENT));
    return;
  }
  visitUnlock = false;
  patchApp((d) => {
    d.meta.gateOpen = open;
  }, "meta");
  if (typeof sessionStorage !== "undefined") {
    try {
      if (open) sessionStorage.setItem(OPEN_KEY, "1");
      else sessionStorage.removeItem(OPEN_KEY);
    } catch {
      /* private mode */
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GATE_EVENT));
}

/** 최고 관리자 기기만 접속하면 풀린 메인으로 연다. 다른 기기는 잠긴 채로 둔다. 기기를 새로 관리자로 올리지 않는다. */
export function restoreAdminGate() {
  if (handsOffBrowser()) return;
  if (gateWasTouched()) return;
  if (!isAdminDevice()) return;
  if (isGateOpen()) return;
  setGateOpen(true);
}

/** 예전 세션만 풀려 있고 저장값이 없으면 그 풀림을 유지해 서버에 남긴다. */
export function hydrateGate() {
  if (typeof window === "undefined") return;
  if (!isAdminDevice()) return;
  if (typeof readAppDump().meta.gateOpen === "boolean") return;
  try {
    if (sessionStorage.getItem(OPEN_KEY) === "1") setGateOpen(true);
  } catch {
    /* private mode */
  }
}

export function unlockGate(password: string) {
  if (password.trim() !== readGatePassword()) return false;
  setGateOpen(true);
  return true;
}

export function lockGate(password: string) {
  if (password.trim() !== readGatePassword()) return false;
  setGateOpen(false);
  return true;
}