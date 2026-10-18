import { X } from "lucide-react";
import { cloneElement, isValidElement, useEffect, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  trigger: ReactNode;
  children: ReactNode;
};

export function PickerSheet({
  open,
  onOpenChange,
  title,
  trigger,
  children,
}: PickerSheetProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const unlock = () => {
      const node = document.getElementById("play-notice");
      if (!node) return;
      node.removeAttribute("inert");
      if (node.getAttribute("aria-hidden") === "true") node.removeAttribute("aria-hidden");
    };
    unlock();
    const watch = new MutationObserver(unlock);
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert", "aria-hidden"] });
    return () => watch.disconnect();
  }, [open]);
  const opener = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
        onClick: () => onOpenChange(true),
      })
    : trigger;
  const sheet = open ? (
    <>
      <div className="genre-sheet-overlay pointer-events-none fixed inset-x-0 top-0 z-[89] bg-black/45" />
      <div
        className="genre-sheet fixed inset-x-0 top-0 z-[90] flex flex-col rounded-none border-0 bg-[#1c1c1e] outline-none"
        role="dialog"
        aria-modal="false"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-[max(0.85rem,env(safe-area-inset-top))] pb-2">
          <h2 className="min-w-0 text-[17px] font-semibold tracking-tight text-fg">{title}</h2>
          <button
            type="button"
            aria-label="장르 선택 닫기"
            onClick={() => onOpenChange(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-fg"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="genre-sheet-body flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </>
  ) : null;
  return (
    <>
      {opener}
      {typeof document !== "undefined" && sheet ? createPortal(sheet, document.body) : null}
    </>
  );
}
