import { patchApp, readAppDump, saveMetaNow } from "./app-memory";

export type ReleaseNote = {
  id: string;
  title: string;
  body: string;
};

export type AppRelease = {
  version: number;
  notes: ReleaseNote[];
};

export const APP_RELEASE: AppRelease = {
  version: 5,
  notes: [
    {
      id: "app-encyclopedia",
      title: "앱 백과에만 저장",
      body: "결과·잠금·설정·원곡은 폰이 아니라 앱 백과에 남습니다.",
    },
    {
      id: "fill-resume",
      title: "빈 결과 이어서 채우기",
      body: "수락한 채우기는 앱에 남아 있고, 다시 열면 0순위로 이어서 적용합니다.",
    },
    {
      id: "notice-only",
      title: "필요할 때만 알림",
      body: "적용할 빈 페이지나 업그레이드가 있을 때만 알림이 뜹니다.",
    },
    {
      id: "upgrade-ask",
      title: "업그레이드 확인",
      body: "이후 개선이 생기면 실행 여부를 물은 뒤 적용하고, 바뀐 점을 알려 드립니다.",
    },
  ],
};

const SEEN_KEY = "noa-release-seen";

export function seenRelease(): number {
  const saved = readAppDump().meta.releaseSeen || 0;
  if (typeof localStorage === "undefined") return saved;
  const local = Number(localStorage.getItem(SEEN_KEY) || 0);
  return Math.max(saved, Number.isFinite(local) ? local : 0);
}

export function pendingRelease(): AppRelease | null {
  return seenRelease() >= APP_RELEASE.version ? null : APP_RELEASE;
}

export function markReleaseSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(APP_RELEASE.version));
  } catch {
    /* private mode */
  }
  patchApp((d) => {
    d.meta.releaseSeen = APP_RELEASE.version;
  });
  saveMetaNow();
}
