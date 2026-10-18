import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { lockGate, readGatePassword, readSecurityKey, unlockGate, writeGatePassword } from "@/lib/gate";

export function UnlockDialog({
  open,
  mode = "open",
  onClose,
  onDone,
}: {
  open: boolean;
  mode?: "open" | "close";
  onClose: () => void;
  onDone?: (opened: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const closing = mode === "close";
  useEffect(() => {
    if (!open) return;
    setValue("");
    setError("");
  }, [open, mode]);
  if (!open) return null;
  function submit() {
    const ok = closing ? lockGate(value) : unlockGate(value);
    if (!ok) {
      setError("비밀번호가 다릅니다.");
      return;
    }
    onDone?.(!closing);
    onClose();
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/50 sm:items-center" onClick={onClose}>
      <section
        className="w-full max-w-md rounded-t-2xl border border-mark/50 bg-bg px-5 py-4 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-medium tracking-widest text-fg-subtle uppercase">열쇠</p>
        <p className="mt-3 text-sm text-fg">{closing ? "잠그려면 비밀번호를 입력하세요." : "비밀번호를 입력하세요."}</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        {error ? <p className="mt-2 text-xs text-mark">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onClose}>
            취소
          </Button>
          <Button type="button" variant="mark" size="lg" className="w-full" onClick={submit}>
            {closing ? "잠그기" : "열기"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [security, setSecurity] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (!open) return null;
  function save() {
    if (current !== readGatePassword()) {
      setError("기존 비밀번호가 다릅니다.");
      return;
    }
    if (!next.trim()) {
      setError("바꿀 비밀번호를 입력하세요.");
      return;
    }
    if (next !== again) {
      setError("바꿀 비밀번호가 같지 않습니다.");
      return;
    }
    if (security !== readSecurityKey()) {
      setError("보안키가 다릅니다.");
      return;
    }
    writeGatePassword(next);
    setDone(true);
    setError("");
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/50 sm:items-center" onClick={onClose}>
      <section
        className="w-full max-w-md rounded-t-2xl border border-mark/50 bg-bg px-5 py-4 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-medium tracking-widest text-fg-subtle uppercase">비밀번호</p>
        <p className="mt-3 text-sm text-fg">기존 비밀번호를 확인한 뒤 바꿉니다.</p>
        <label className="mt-3 block text-xs text-fg-subtle">
          기존 비밀번호
          <input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
          />
        </label>
        <label className="mt-3 block text-xs text-fg-subtle">
          바꿀 비밀번호
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
          />
        </label>
        <label className="mt-3 block text-xs text-fg-subtle">
          바꿀 비밀번호 확인
          <input
            type="password"
            value={again}
            autoComplete="off"
            onChange={(event) => setAgain(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
          />
        </label>
        <label className="mt-3 block text-xs text-fg-subtle">
          보안키
          <input
            type="password"
            value={security}
            autoComplete="off"
            onChange={(event) => setSecurity(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-fg"
          />
        </label>
        {error ? <p className="mt-2 text-xs text-mark">{error}</p> : null}
        {done ? <p className="mt-2 text-xs text-mark">비밀번호를 바꿨습니다.</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onClose}>
            닫기
          </Button>
          <Button type="button" variant="mark" size="lg" className="w-full" onClick={save}>
            저장
          </Button>
        </div>
      </section>
    </div>
  );
}
