export function koreanFillError(msg: string) {
  const t = msg.trim().replace(/\s+/g, " ");
  const low = t.toLowerCase();
  if (!t) return "만들지 못했습니다";
  if (/한도|403|429/.test(t) || /spending-limit|out of credits|personal-team-blocked|quota|rate limit/.test(low)) {
    return "한도가 부족합니다. 복구되면 생성됩니다.";
  }
  if (/만들지 못했|패키지를 만들지/.test(t)) return "잠시 응답이 없었습니다. 같은 곡을 다시 생성합니다";
  if (/failed to fetch|networkerror|load failed|network/.test(low)) return "연결이 끊겼습니다";
  if (/timeout/.test(low)) return "시간이 초과되었습니다";
  if (/abort/.test(low)) return "요청이 중단되었습니다";
  if (/502|503|504/.test(t)) return "서버가 잠시 응답하지 않습니다";
  if (/400/.test(t)) return "요청 형식 오류입니다";
  if (/비었/.test(t)) return "결과 내용이 비었습니다";
  if (/invalid ep/.test(low)) return "EP 번호가 올바르지 않습니다";
  if (/invalid genre/.test(low)) return "장르가 올바르지 않습니다";
  if (/형식을 읽지/.test(t)) return "결과 형식을 읽지 못했습니다";
  if (/AI 기능을 이 환경/.test(t)) return "이 환경에서 생성을 쓸 수 없습니다";
  if (/ENOENT|EROFS|EPERM|EACCES|mkdir|read-only file system|\/var\/task|no such file or directory/i.test(t)) {
    return "저장 위치를 지금 열 수 없습니다. 다시 시도해 주세요.";
  }
  if (/is not defined|is not a function|cannot read propert/.test(low)) return "생성 기능을 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 해 주세요.";
  if (/[가-힣]/.test(t)) return t.length > 80 ? t.slice(0, 80) : t;
  return "만들지 못했습니다. 다시 시도해 주세요.";
}

export function quietDiskFault(msg: string) {
  const t = String(msg || "");
  if (/ENOENT|EROFS|EPERM|EACCES|mkdir|read-only file system|\/var\/task|no such file or directory/i.test(t)) return "write";
  return t;
}

export function noticeFault(msg: string) {
  const t = quietDiskFault(msg).trim();
  if (!t) return "";
  if (/^(write|file|read|throw|request|path|empty|url|level|suno)$/i.test(t)) return "";
  if (/ENOENT|EROFS|mkdir|\/var\/|no such file/i.test(t)) return "";
  if (!/[가-힣]/.test(t)) return "";
  return t.length > 80 ? t.slice(0, 80) : t;
}

export function noticeLead(msg: string) {
  const clean = noticeFault(msg);
  return clean ? `${clean} — ` : "";
}

export function noticeShown(msg: string) {
  const t = String(msg || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (!/ENOENT|EROFS|EPERM|EACCES|mkdir|read-only file system|\/var\/task|no such file or directory/i.test(t)) return t;
  const kept = t
    .split("—")
    .map((part) => part.trim())
    .filter((part) => /[가-힣]/.test(part) && !/ENOENT|mkdir|\/var\/|no such file|read-only/i.test(part));
  if (kept.length) return kept.join(" — ").slice(0, 180);
  return "저장하지 못했습니다.";
}

export type FillEvent = {
  label: string;
  state: "run" | "ok" | "fail" | "wait";
  reason?: string;
};
