import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
const STALE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

async function hardReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* still reload */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = errorMessage(error);
  const stale = STALE.test(message);

  useEffect(() => {
    if (!stale) return;
    try {
      if (sessionStorage.getItem("noa-stale-reload") === "1") return;
      sessionStorage.setItem("noa-stale-reload", "1");
    } catch {
      /* private */
    }
    void hardReload();
  }, [stale]);

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">{stale ? "앱이 업데이트됐습니다" : "Something went wrong"}</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {stale ? "최신 화면으로 다시 여는 중입니다. 안 되면 아래를 누르세요." : message}
      </p>
      <button
        type="button"
        className="mt-2 min-h-12 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        onClick={() => void hardReload()}
      >
        다시 열기
      </button>
    </main>
  );
}