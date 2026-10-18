import { Button } from "@/components/ui/button";
import { THUMB_CASTS, type ThumbCast } from "@/lib/characters";
import { cn } from "@/lib/utils";

export function CastRadios({
  value,
  onChange,
  readOnly = false,
}: {
  value: ThumbCast;
  onChange: (value: ThumbCast) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THUMB_CASTS.map((item) => {
        const on = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              onChange(item.id);
            }}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-xl border px-2 text-center text-sm",
              on
                ? "border-mark bg-mark text-mark-fg"
                : "border-border bg-surface text-fg hover:bg-surface-2",
              readOnly ? "cursor-default opacity-80" : "",
            )}
            aria-pressed={on}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function CastBar({
  value,
  saved,
  onChange,
  onSave,
  readOnly = false,
  className,
}: {
  value: ThumbCast;
  saved: ThumbCast;
  onChange: (value: ThumbCast) => void;
  onSave: () => void;
  readOnly?: boolean;
  className?: string;
}) {
  const dirty = value !== saved;
  return (
    <section className={cn("mb-4 overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-sm font-medium text-fg">썸네일 인물</p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <CastRadios value={value} onChange={onChange} readOnly={readOnly} />
        {readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant={dirty ? "mark" : "secondary"}
            className="w-full"
            disabled={!dirty}
            onClick={onSave}
          >
            {dirty ? "인물 저장" : "저장됨"}
          </Button>
        )}
      </div>
    </section>
  );
}

export function CastDialog({
  open,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  value: ThumbCast;
  onChange: (value: ThumbCast) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <p className="font-display text-lg text-fg">썸네일 인물</p>
        <p className="mt-2 text-sm text-fg-muted">이 결과의 썸네일 인물을 고르세요.</p>
        <div className="mt-4">
          <CastRadios value={value} onChange={onChange} />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" variant="mark" size="lg" className="w-full" onClick={onConfirm}>
            확인
          </Button>
          <Button type="button" variant="ghost" size="lg" className="w-full" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
