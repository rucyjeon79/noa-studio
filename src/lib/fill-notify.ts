export function fillProgressLabel(done: number, total: number) {
  const t = Math.max(0, total);
  const d = Math.max(0, Math.min(done, t || done));
  return `${d}/${t}`;
}

function stateKo(state: string) {
  if (state === "ok") return "성공";
  if (state === "fail") return "실패";
  if (state === "wait") return "대기";
  return "진행";
}

export function fillNotifyDetail(
  current: string,
  events: { label: string; state: string; reason?: string }[] = [],
) {
  const lines: string[] = [];
  const now = current.trim();
  if (now) lines.push(now);
  const seen = new Set(now ? [now] : []);
  for (const item of events.slice(-6)) {
    const line = `${stateKo(item.state)} · ${item.label}${item.reason ? ` · ${item.reason}` : ""}`;
    if (seen.has(line) || (now && item.state === "run" && now.includes(item.label))) continue;
    seen.add(line);
    lines.push(line);
  }
  if (!lines.length) lines.push("적용 중");
  lines.push("누르면 앱으로");
  return lines.join("\n");
}

const TAG = "noa-fill";
const SW_URL = "/fill/sw.js";
const SW_SCOPE = "/fill/";

let registration: ServiceWorkerRegistration | null = null;

export async function registerFillSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    return registration;
  } catch {
    return null;
  }
}

export async function askFillNotify() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  } catch {
    return false;
  }
}

export async function showFillNotify(title: string, body: string, keep = true) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const reg = (await registerFillSw()) ?? registration;
  const opts: NotificationOptions & { renotify?: boolean } = {
    body,
    tag: TAG,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    silent: true,
    requireInteraction: keep,
    renotify: true,
    data: { open: true },
  };
  try {
    if (reg) {
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* page notification */
  }
  try {
    const note = new Notification(title, opts);
    note.onclick = () => {
      window.focus();
      window.dispatchEvent(new Event("noa-fill-open"));
      note.close();
    };
  } catch {
    /* preview may block */
  }
}

export async function clearFillNotify() {
  try {
    const reg =
      registration ??
      (typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration(SW_SCOPE)
        : null);
    const list = await reg?.getNotifications({ tag: TAG });
    list?.forEach((item) => item.close());
  } catch {
    /* ignore */
  }
}
