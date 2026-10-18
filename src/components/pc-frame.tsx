import { useLayoutEffect, type ReactNode } from "react";

function applyFrame() {
  const root = document.documentElement;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const viewport = window.visualViewport;
  const keyboard = !!viewport && height - viewport.height > 140;
  const wide = !keyboard && width > height;
  const split = wide && height >= 720;
  const roomy = !wide && (width > 411 || height > 891);
  const frame = wide ? "wide" : "tall";
  const nextSplit = split ? "1" : "0";
  const nextRoomy = roomy ? "1" : "0";
  const changed = root.dataset.frame !== frame || root.dataset.split !== nextSplit || root.dataset.roomy !== nextRoomy;
  root.dataset.frame = frame;
  root.dataset.split = nextSplit;
  root.dataset.roomy = nextRoomy;
  root.style.setProperty("--phone-port-h", "891px");
  root.style.setProperty("--phone-land-h", "411px");
  root.classList.remove("pc-fit");
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* a page that never locked orientation cannot unlock it */
  }
  if (changed) window.dispatchEvent(new Event("noa-frame"));
}

export function PcFrame({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    applyFrame();
    window.addEventListener("resize", applyFrame);
    window.addEventListener("orientationchange", applyFrame);
    window.visualViewport?.addEventListener("resize", applyFrame);
    screen.orientation?.addEventListener?.("change", applyFrame);
    return () => {
      window.removeEventListener("resize", applyFrame);
      window.removeEventListener("orientationchange", applyFrame);
      window.visualViewport?.removeEventListener("resize", applyFrame);
      screen.orientation?.removeEventListener?.("change", applyFrame);
      document.documentElement.classList.remove("pc-fit");
    };
  }, []);
  return children;
}
