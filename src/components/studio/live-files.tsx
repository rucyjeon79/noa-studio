import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Copy, FileJson, FileText, Folder, FolderInput, FolderOpen, FolderPlus, Pencil, Save, Trash2, X } from "lucide-react";
import { copyLiveFile, listLiveFiles, makeLiveDir, moveLiveFile, readLiveFile, removeLiveFile, renameLiveFile, writeLiveFile } from "@/lib/live-files";
import { pullEncyclopedia } from "@/lib/pages";
import { ingestEncyclopedia } from "@/lib/package";
import { serverError, serverOk, serverPlain } from "@/lib/server-plain";

type DirRow = { name: string; path: string };
type FileRow = { name: string; path: string; text: boolean };

export function LiveFiles({ seed, hideButton = false }: { seed?: { path: string; nonce: number } | null; hideButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState("");
  const [parent, setParent] = useState("");
  const [dirs, setDirs] = useState<DirRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ path: string; mode: "move" | "copy" } | null>(null);
  const [chosen, setChosen] = useState("");
  const [renamePath, setRenamePath] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editText, setEditText] = useState("");
  const [dropPath, setDropPath] = useState("");
  const [password, setPassword] = useState("");
  const [folderName, setFolderName] = useState("");

  async function load(next = dir) {
    setBusy(true);
    setNote("");
    const listed = serverPlain<{ ok?: boolean; error?: string; dir?: string; parent?: string; dirs?: DirRow[]; files?: FileRow[] }>(await listLiveFiles({ data: { dir: next } }).catch(() => null));
    setBusy(false);
    if (!listed?.ok) {
      setNote(listed?.error || "폴더를 열지 못했습니다.");
      return;
    }
    setDir(listed.dir || "");
    setParent(listed.parent || "");
    setDirs(listed.dirs || []);
    setFiles(listed.files || []);
  }

  async function openFile(path: string) {
    setBusy(true);
    setNote("");
    const row = serverPlain<{ ok?: boolean; error?: string; text?: string }>(await readLiveFile({ data: { path } }).catch(() => null));
    setBusy(false);
    if (!row?.ok) {
      setNote(row?.error || "파일을 열지 못했습니다.");
      return;
    }
    setEditPath(path);
    setEditText(row.text || "");
  }

  async function saveFile() {
    if (!editPath) {
      setNote(chosen ? "그 파일을 한 번 더 눌러 연 다음 저장하세요." : "저장할 파일을 고르세요.");
      return;
    }
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(await writeLiveFile({ data: { path: editPath, text: editText } }).catch(() => null));
    setBusy(false);
    setNote(serverOk(saved) ? "저장했습니다." : serverError(saved) || "저장하지 못했습니다.");
    if (serverOk(saved)) await reflect();
  }

  async function rename() {
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(await renameLiveFile({ data: { path: renamePath, name: renameValue } }).catch(() => null));
    setBusy(false);
    if (!serverOk(saved)) {
      setNote(serverError(saved) || "이름을 바꾸지 못했습니다.");
      return;
    }
    setRenamePath("");
    await load(dir);
    await reflect();
  }

  async function putHere() {
    if (!pick) return;
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(pick.mode === "move"
      ? await moveLiveFile({ data: { path: pick.path, dir } }).catch(() => null)
      : await copyLiveFile({ data: { path: pick.path, dir } }).catch(() => null));
    setBusy(false);
    if (!serverOk(saved)) {
      setNote(serverError(saved) || "끝내지 못했습니다.");
      return;
    }
    setPick(null);
    await load(dir);
    await reflect();
  }

  async function moveOnto(dest: string) {
    if (!pick || pick.mode !== "move") return;
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(await moveLiveFile({ data: { path: pick.path, dir: dest } }).catch(() => null));
    setBusy(false);
    if (!serverOk(saved)) {
      setNote(serverError(saved) || "끝내지 못했습니다.");
      return;
    }
    setPick(null);
    await load(dir);
    await reflect();
  }

  async function remove() {
    const path = dropPath || chosen;
    if (!path) {
      setNote("지울 파일이나 폴더를 고르세요.");
      return;
    }
    if (!dropPath) setDropPath(path);
    if (!password.trim()) {
      setNote("삭제 비밀번호를 입력하세요.");
      return;
    }
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(await removeLiveFile({ data: { path, password } }).catch(() => null));
    setBusy(false);
    if (!serverOk(saved)) {
      setNote(serverError(saved) || "지우지 못했습니다.");
      return;
    }
    setDropPath("");
    setPassword("");
    setChosen("");
    await load(dir);
    await reflect();
  }

  async function makeFolder() {
    setBusy(true);
    setNote("");
    const saved = serverPlain<{ ok?: boolean; error?: string }>(await makeLiveDir({ data: { dir, name: folderName } }).catch(() => null));
    setBusy(false);
    if (!serverOk(saved)) {
      setNote(serverError(saved) || "폴더를 만들지 못했습니다.");
      return;
    }
    setFolderName("");
    await load(dir);
  }

  async function reflect() {
    const dump = await pullEncyclopedia().catch(() => null);
    if (dump) ingestEncyclopedia(dump);
    window.dispatchEvent(new Event("noa-explorer-sync"));
  }

  useEffect(() => {
    if (!seed?.path) return;
    const parent = seed.path.includes("/") ? seed.path.slice(0, seed.path.lastIndexOf("/")) : "";
    setOpen(true);
    setPick({ path: seed.path, mode: "move" });
    setChosen(seed.path);
    setEditPath("");
    setRenamePath("");
    setDropPath("");
    void load(parent);
  }, [seed?.nonce]);

  return (
    <>
      <button
        type="button"
        className={hideButton ? "hidden" : "flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-fg"}
        onClick={() => {
          setOpen(true);
          setPick(null);
          setChosen("");
          setEditPath("");
          void load("");
        }}
      >
        <FolderOpen className="size-4" aria-hidden />
        파일 탐색기
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => !busy && setOpen(false)}>
          <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-bg text-fg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{dir || "앱 파일"}</p>
              <button type="button" className="inline-flex size-9 items-center justify-center text-fg-muted" aria-label="닫기" onClick={() => setOpen(false)}>
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex gap-2 px-4 py-2">
              {dir ? (
                <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg border border-border" aria-label="위로" onClick={() => void load(parent)}>
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              ) : null}
              {pick ? (
                <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-mark px-3 py-2 text-xs text-mark" disabled={busy} onClick={() => void putHere()}>
                  <FolderInput className="size-3.5" aria-hidden />
                  이 폴더로 {pick.mode === "move" ? "이동" : "복사"}
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
              {pick?.mode === "move" ? <p className="pb-2 text-[11px] text-fg-muted">파일을 고르면 그 파일을 덮어씁니다.</p> : null}
              {chosen ? <p className="pb-2 text-[11px] text-mark">선택: {chosen.split("/").pop()}</p> : null}
              {dirs.map((row) => (
                <div key={row.path} className={`flex items-center gap-2 border-b border-border/70 py-2 ${pick?.path === row.path || chosen === row.path ? "rounded-lg border border-[#e8c547] bg-[#e8c547]/25" : ""}`}>
                  <button type="button" className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-sm" aria-pressed={chosen === row.path || pick?.path === row.path} onClick={() => {
                    if (pick?.mode === "move" && pick.path !== row.path) {
                      void moveOnto(row.path);
                      return;
                    }
                    setChosen(row.path);
                    void load(row.path);
                  }}>
                    <Folder className="size-4 shrink-0" aria-hidden />
                    {pick?.path === row.path || chosen === row.path ? <span className="size-2 shrink-0 rounded-full bg-[#e8c547]" aria-hidden /> : null}
                    <span className="truncate">{row.name}</span>
                  </button>
                  <RowTools
                    onRename={() => { setChosen(row.path); setRenamePath(row.path); setRenameValue(row.name); }}
                    onMove={() => { setChosen(row.path); setPick({ path: row.path, mode: "move" }); }}
                    onCopy={() => { setChosen(row.path); setPick({ path: row.path, mode: "copy" }); }}
                    onDelete={() => { setChosen(row.path); setDropPath(row.path); setPassword(""); }}
                  />
                </div>
              ))}
              {files.map((row) => (
                <div key={row.path} className={`flex items-center gap-2 border-b border-border/70 py-2 ${pick?.path === row.path || chosen === row.path ? "rounded-lg border border-[#e8c547] bg-[#e8c547]/25" : ""}`}>
                  <button type="button" className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-sm" aria-pressed={chosen === row.path || pick?.path === row.path} onClick={() => {
                    if (pick?.mode === "move" && pick.path !== row.path) {
                      void moveOnto(row.path);
                      return;
                    }
                    if (chosen === row.path) {
                      void openFile(row.path);
                      return;
                    }
                    setChosen(row.path);
                  }}>
                    {row.name.toLowerCase().endsWith(".json") ? <FileJson className="size-4 shrink-0" aria-hidden /> : <FileText className="size-4 shrink-0" aria-hidden />}
                    {pick?.path === row.path || chosen === row.path ? <span className="size-2 shrink-0 rounded-full bg-[#e8c547]" aria-hidden /> : null}
                    <span className="truncate">{row.name}</span>
                  </button>
                  <RowTools
                    onRename={() => { setChosen(row.path); setRenamePath(row.path); setRenameValue(row.name); }}
                    onMove={() => { setChosen(row.path); setPick({ path: row.path, mode: "move" }); }}
                    onCopy={() => { setChosen(row.path); setPick({ path: row.path, mode: "copy" }); }}
                    onDelete={() => { setChosen(row.path); setDropPath(row.path); setPassword(""); }}
                  />
                </div>
              ))}
              {renamePath ? (
                <label className="mt-3 block text-xs text-fg-subtle">
                  이름
                  <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg" />
                </label>
              ) : null}
              {editPath ? (
                <label className="mt-3 block text-xs text-fg-subtle">
                  {editPath.split("/").pop()}
                  <textarea value={editText} onChange={(event) => setEditText(event.target.value)} className="mt-1 h-40 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg" />
                </label>
              ) : null}
              {dropPath ? (
                <label className="mt-3 block text-xs text-fg-subtle">
                  삭제 비밀번호
                  <input type="password" value={password} autoComplete="off" onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg" />
                </label>
              ) : null}
              <label className="mt-3 block text-xs text-fg-subtle">
                새 폴더
                <input value={folderName} onChange={(event) => setFolderName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg" />
              </label>
              {note ? <p className="mt-2 text-xs text-mark">{note}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm" disabled={busy || !renamePath} onClick={() => void rename()}>
                <Pencil className="size-4" aria-hidden />
                이름 저장
              </button>
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm" disabled={busy} onClick={() => void saveFile()}>
                <Save className="size-4" aria-hidden />
                파일 저장
              </button>
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm" disabled={busy || !folderName.trim()} onClick={() => void makeFolder()}>
                <FolderPlus className="size-4" aria-hidden />
                폴더 만들기
              </button>
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm text-mark" disabled={busy} onClick={() => void remove()}>
                <Trash2 className="size-4" aria-hidden />
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

function RowTools({ onRename, onMove, onCopy, onDelete }: { onRename: () => void; onMove: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0 gap-0.5 text-fg-muted">
      <button type="button" className="inline-flex size-8 items-center justify-center rounded-md" aria-label="이름" onClick={onRename}><Pencil className="size-3.5" aria-hidden /></button>
      <button type="button" className="inline-flex size-8 items-center justify-center rounded-md" aria-label="이동" onClick={onMove}><FolderInput className="size-3.5" aria-hidden /></button>
      <button type="button" className="inline-flex size-8 items-center justify-center rounded-md" aria-label="복사" onClick={onCopy}><Copy className="size-3.5" aria-hidden /></button>
      <button type="button" className="inline-flex size-8 items-center justify-center rounded-md" aria-label="삭제" onClick={onDelete}><Trash2 className="size-3.5" aria-hidden /></button>
    </span>
  );
}
