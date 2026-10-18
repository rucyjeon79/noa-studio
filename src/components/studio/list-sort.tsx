import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_EVENT = "noa-list-sort";
let sortingKey = "";

export function readSortingKey() {
  return sortingKey;
}

export function setSortingKey(key: string) {
  if (sortingKey === key) return;
  sortingKey = key;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SORT_EVENT));
}

export function useSortingKey() {
  const [key, setKey] = useState(sortingKey);
  useEffect(() => {
    const pull = () => setKey(sortingKey);
    window.addEventListener(SORT_EVENT, pull);
    return () => window.removeEventListener(SORT_EVENT, pull);
  }, []);
  return key;
}

export function SortRadio({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
        on ? "border-mark bg-mark text-mark-fg" : "border-current/40",
      )}
    >
      <span className={cn("size-2.5 rounded-full", on ? "bg-current" : "bg-transparent")} />
    </button>
  );
}

export function SortGrip({ onPointerDown }: { onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      aria-label="순서 이동"
      className="inline-flex size-9 shrink-0 touch-none items-center justify-center text-fg-subtle"
      onPointerDown={onPointerDown}
      onClick={(event) => event.preventDefault()}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function rowAt(listKey: string, y: number) {
  if (!listKey || typeof document === "undefined") return "";
  const rows = document.querySelectorAll(`[data-sort-list="${listKey}"] [data-sort-id]`);
  let best = "";
  let bestDist = Number.POSITIVE_INFINITY;
  rows.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const id = node.getAttribute("data-sort-id") || "";
    if (!id) return;
    const dist = Math.abs(y - (rect.top + rect.height / 2));
    if (dist < bestDist) {
      bestDist = dist;
      best = id;
    }
  });
  return best;
}

export function useListDrag(listKey: string, enabled: boolean, onMove: (fromId: string, toId: string) => void) {
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const drag = useRef<{ id: string; pointer: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const move = (event: PointerEvent) => {
      const cur = drag.current;
      if (!cur || event.pointerId !== cur.pointer) return;
      event.preventDefault();
      const over = rowAt(listKey, event.clientY);
      if (!over || over === cur.id) return;
      moveRef.current(cur.id, over);
    };
    const end = (event: PointerEvent) => {
      if (drag.current?.pointer === event.pointerId) drag.current = null;
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      drag.current = null;
    };
  }, [enabled, listKey]);
  return (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = { id, pointer: event.pointerId };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer still moves the row */
    }
  };
}
