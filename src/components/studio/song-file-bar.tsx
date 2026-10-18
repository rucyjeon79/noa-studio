import { useState } from "react";
import { createPortal } from "react-dom";
import { FolderInput, Trash2 } from "lucide-react";
import { deleteSongFile, shownFileRel, type SongFileTarget } from "@/lib/song-files";
import { LiveFiles } from "@/components/studio/live-files";
import { serverError, serverOk, serverPlain } from "@/lib/server-plain";

export function SongFileBar({ target }: { target: SongFileTarget }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState<{ path: string; nonce: number } | null>(null);

  async function openExplorer() {
    setNote("");
    const listed = await shownFileRel({ data: target }).catch(() => null);
    const row = listed && typeof listed === "object" ? listed as { path?: unknown; result?: { path?: unknown } } : null;
    const nested = row?.result && typeof row.result === "object" ? row.result.path : "";
    const path = String(row?.path || nested || "");
    if (!path) {
      setNote("없는 곡 파일입니다.");
      return;
    }
    setSeed({ path, nonce: Date.now() });
  }

  async function remove() {
    if (!password.trim()) {
      setNote("삭제 비밀번호를 입력하세요.");
      return;
    }
    setBusy(true);
    setNote("");
    const result = serverPlain<{ ok?: boolean; error?: string }>(await deleteSongFile({ data: { ...target, password } }).catch(() => null));
    setBusy(false);
    if (!serverOk(result)) {
      setNote(serverError(result) || "파일을 지우지 못했습니다.");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <div className="save-row mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          aria-label="곡 파일 이동"
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/30 text-fg"
          onClick={() => void openExplorer()}
        >
          <FolderInput className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="곡 삭제"
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/30 text-fg"
          onClick={() => {
            setPassword("");
            setNote("");
            setOpen(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {note && !open ? <p className="mb-2 text-right text-xs text-mark">{note}</p> : null}
      <LiveFiles seed={seed} hideButton />
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => !busy && setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-[#1c1c1e] text-fg" onClick={(event) => event.stopPropagation()}>
            <div className="p-4">
              <p className="text-sm font-medium">이 곡 파일을 지웁니다.</p>
              <p className="mt-1 text-xs text-fg-muted">비밀번호가 맞아야 이 게시곡만 지웁니다.</p>
              <input
                type="password"
                value={password}
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
                className="mt-3 w-full rounded-xl border border-white/20 bg-black px-3 py-2 text-sm"
              />
              {note ? <p className="mt-2 text-xs text-mark">{note}</p> : null}
              <button type="button" className="mt-3 w-full rounded-full bg-mark px-4 py-2 text-sm font-medium text-mark-fg disabled:opacity-50" disabled={busy} onClick={() => void remove()}>
                삭제
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
