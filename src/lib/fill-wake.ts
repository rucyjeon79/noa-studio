let lock: WakeLockSentinel | null = null;
let wanted = false;

async function requestLock() {
  if (!wanted || typeof navigator === "undefined") return;
  const api = navigator.wakeLock;
  if (!api?.request) return;
  try {
    lock = await api.request("screen");
    lock.addEventListener("release", () => {
      lock = null;
      if (wanted && document.visibilityState === "visible") void requestLock();
    });
  } catch {
    /* 권한·미지원 */
  }
}

export function holdFillWake() {
  wanted = true;
  void requestLock();
}

export function dropFillWake() {
  wanted = false;
  const cur = lock;
  lock = null;
  void cur?.release().catch(() => {});
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted) void requestLock();
  });
}
