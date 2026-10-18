import { createServerFn } from "@tanstack/react-start";

export const THIS_BUILD = __NOA_BUILD__;

export const readLiveBuild = createServerFn({ method: "POST" }).handler(async () => {
  return { id: __NOA_BUILD__ };
});

export async function findPublishedBuild() {
  try {
    const remote = await readLiveBuild();
    const id = String(remote?.id || "");
    if (!id || id === THIS_BUILD) return "";
    return id;
  } catch {
    return "";
  }
}

export function formatBuildLabel(id: string) {
  const n = Number.parseInt(String(id || ""), 36);
  if (!Number.isFinite(n) || n < 1e12) return "v1.0";
  const elapsed = Math.max(0, n - Date.UTC(2026, 0, 1));
  const major = Math.floor(elapsed / 86400000) + 1;
  const minor = Math.floor((elapsed % 86400000) / 60000);
  return `v${major}.${minor}`;
}

export function applyPublishedBuild(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("b", id);
  window.location.replace(url.toString());
}
