import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { capturePairs, noteMovedPairs, noteRemoved, ownersOf, relFromAbs } from "./live-bind.server";

const LIVE = join(process.cwd(), "data/live");
const TEXT_EXT = new Set([".json", ".txt", ".md", ".csv", ".html", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".svg", ".xml", ".yml", ".yaml", ".log"]);

function rootReal() {
  return realpathSync(LIVE);
}

function inside(abs: string) {
  const root = rootReal();
  const full = resolve(abs);
  return full === root || full.startsWith(root + sep);
}

function absOf(rel: string) {
  const clean = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean) return rootReal();
  const parts = clean.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return "";
  const abs = resolve(LIVE, ...parts);
  if (!inside(abs)) return "";
  if (!existsSync(abs)) {
    const parent = dirname(abs);
    if (!existsSync(parent)) return "";
    const realParent = realpathSync(parent);
    if (!inside(realParent) && realParent !== rootReal() && !realParent.startsWith(rootReal() + sep)) return "";
    return abs;
  }
  const real = realpathSync(abs);
  return inside(real) ? real : "";
}

function relOf(abs: string) {
  const root = rootReal();
  const norm = abs.replace(/\\/g, "/");
  const base = root.replace(/\\/g, "/");
  if (norm === base) return "";
  return norm.startsWith(`${base}/`) ? norm.slice(base.length + 1) : "";
}

function gatePassword() {
  try {
    const raw = JSON.parse(readFileSync(join(LIVE, "앱관리", "상태.json"), "utf8")) as { gatePassword?: string };
    return String(raw.gatePassword || "").trim() || "7999";
  } catch {
    return "7999";
  }
}

function textFile(abs: string) {
  if (!TEXT_EXT.has(extname(abs).toLowerCase())) return false;
  const buf = readFileSync(abs);
  if (buf.length > 1_500_000) return false;
  return !buf.includes(0);
}

export function liveList(rel = "") {
  const abs = absOf(rel);
  if (!abs || !existsSync(abs) || !statSync(abs).isDirectory()) return { ok: false as const, error: "그 폴더를 열 수 없습니다.", dir: "", parent: "", dirs: [] as { name: string; path: string }[], files: [] as { name: string; path: string; text: boolean }[] };
  const dir = relOf(abs);
  const parent = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : dir ? "" : "";
  const dirs: { name: string; path: string }[] = [];
  const files: { name: string; path: string; text: boolean }[] = [];
  for (const name of readdirSync(abs)) {
    if (name.startsWith(".")) continue;
    const full = join(abs, name);
    const child = dir ? `${dir}/${name}` : name;
    try {
      if (statSync(full).isDirectory()) dirs.push({ name, path: child });
      else files.push({ name, path: child, text: textFile(full) });
    } catch {
      /* skip one unreadable entry */
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  files.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { ok: true as const, error: "", dir, parent: dir ? parent : "", dirs, files };
}

export function liveRead(rel: string) {
  const abs = absOf(rel);
  if (!abs || !existsSync(abs) || statSync(abs).isDirectory()) return { ok: false as const, error: "파일을 열 수 없습니다.", text: "", binary: false };
  if (!textFile(abs)) return { ok: false as const, error: "글 파일이 아니어서 열지 않습니다.", text: "", binary: true };
  return { ok: true as const, error: "", text: readFileSync(abs, "utf8"), binary: false };
}

export function liveWrite(rel: string, text: string) {
  const abs = absOf(rel);
  if (!abs || !existsSync(abs) || statSync(abs).isDirectory()) return { ok: false as const, error: "파일을 저장할 수 없습니다." };
  if (!textFile(abs) && !TEXT_EXT.has(extname(abs).toLowerCase())) return { ok: false as const, error: "글 파일이 아니어서 저장하지 않습니다." };
  if (text.includes("\u0000")) return { ok: false as const, error: "글이 아닌 내용은 저장하지 않습니다." };
  if (extname(abs).toLowerCase() === ".json") {
    try {
      JSON.parse(text);
    } catch {
      return { ok: false as const, error: "JSON 형식이 아닙니다." };
    }
  }
  writeFileSync(abs, text);
  return { ok: true as const, error: "" };
}

function cleanName(name: string) {
  const next = String(name || "").trim();
  if (!next || next === "." || next === ".." || next.includes("/") || next.includes("\\") || next.includes("\u0000")) return "";
  return next;
}

export function liveRename(rel: string, name: string) {
  const abs = absOf(rel);
  const next = cleanName(name);
  if (!abs || !existsSync(abs) || relOf(abs) === "") return { ok: false as const, error: "그 이름은 바꿀 수 없습니다." };
  if (!next) return { ok: false as const, error: "이름을 확인하세요." };
  const dest = join(dirname(abs), next);
  if (!inside(dest)) return { ok: false as const, error: "그 위치는 앱 밖입니다." };
  if (existsSync(dest)) return { ok: false as const, error: "그 이름이 이미 있습니다." };
  const fromRel = relOf(abs);
  const toRel = relOf(dest);
  const pairs = capturePairs(fromRel, toRel);
  renameSync(abs, dest);
  noteMovedPairs(pairs);
  return { ok: true as const, error: "", path: relOf(dest) };
}

export function liveMakeDir(rel: string, name: string) {
  const abs = absOf(rel);
  const next = cleanName(name);
  if (!abs || !existsSync(abs) || !statSync(abs).isDirectory() || !next) return { ok: false as const, error: "폴더를 만들지 못했습니다." };
  const dest = join(abs, next);
  if (!inside(dest)) return { ok: false as const, error: "그 위치는 앱 밖입니다." };
  if (existsSync(dest)) return { ok: false as const, error: "그 이름이 이미 있습니다." };
  mkdirSync(dest);
  return { ok: true as const, error: "", path: relOf(dest) };
}

function destFile(dirRel: string, fromAbs: string) {
  const dir = absOf(dirRel);
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) return "";
  const dest = join(dir, fromAbs.split("/").pop() || "");
  return inside(dest) ? dest : "";
}

export function liveMove(rel: string, dirRel: string) {
  const from = absOf(rel);
  if (!from || !existsSync(from) || relOf(from) === "") return { ok: false as const, error: "옮길 파일이 없습니다." };
  const picked = absOf(dirRel);
  if (!picked || !existsSync(picked)) return { ok: false as const, error: "그 위치로 옮길 수 없습니다." };
  const fromFile = statSync(from).isFile();
  const pickedFile = statSync(picked).isFile();
  if (!fromFile && pickedFile) return { ok: false as const, error: "폴더를 파일 위에 덮을 수 없습니다." };
  const dest = pickedFile ? picked : destFile(dirRel, from);
  if (!dest) return { ok: false as const, error: "그 폴더로 옮길 수 없습니다." };
  if (dest === from) return { ok: true as const, error: "" };
  const fromNorm = from.replace(/\\/g, "/");
  const destNorm = dest.replace(/\\/g, "/");
  if (destNorm.startsWith(`${fromNorm}/`)) return { ok: false as const, error: "폴더를 자기 안으로 옮길 수 없습니다." };
  if (existsSync(dest) && statSync(dest).isDirectory()) return { ok: false as const, error: "폴더 위에는 덮을 수 없습니다." };
  const fromRel = relOf(from);
  const toRel = relFromAbs(dest) || relOf(dest);
  const prior: Record<string, string[]> = {};
  const overwrite = existsSync(dest) && statSync(dest).isFile();
  if (overwrite) prior[toRel] = ownersOf(toRel);
  const pairs = capturePairs(fromRel, toRel);
  try {
    if (overwrite && statSync(from).isFile()) {
      copyFileSync(from, dest);
      rmSync(from, { recursive: false, force: false });
    } else {
      if (overwrite) rmSync(dest, { recursive: false, force: false });
      renameSync(from, dest);
    }
  } catch {
    return { ok: false as const, error: overwrite ? "파일을 덮어쓰지 못했습니다." : "파일을 옮기지 못했습니다." };
  }
  noteMovedPairs(pairs, { prior });
  return { ok: true as const, error: "" };
}

export function liveCopy(rel: string, dirRel: string) {
  const from = absOf(rel);
  if (!from || !existsSync(from) || relOf(from) === "") return { ok: false as const, error: "복사할 파일이 없습니다." };
  const dest = destFile(dirRel, from);
  if (!dest) return { ok: false as const, error: "그 폴더로 복사할 수 없습니다." };
  if (existsSync(dest) && statSync(dest).isDirectory()) return { ok: false as const, error: "폴더 위에는 덮을 수 없습니다." };
  const fromRel = relOf(from);
  const toRel = relFromAbs(dest) || relOf(dest);
  const prior: Record<string, string[]> = {};
  if (existsSync(dest) && statSync(dest).isFile()) prior[toRel] = ownersOf(toRel);
  const pairs = capturePairs(fromRel, toRel);
  try {
    cpSync(from, dest, { recursive: true, force: true });
  } catch {
    return { ok: false as const, error: "복사하지 못했습니다." };
  }
  noteMovedPairs(pairs, { prior, keepSource: true });
  return { ok: true as const, error: "" };
}

export function liveRemove(rel: string, password: string) {
  if (String(password || "").trim() !== gatePassword()) return { ok: false as const, error: "비밀번호가 다릅니다." };
  const abs = absOf(rel);
  if (!abs || !existsSync(abs) || relOf(abs) === "") return { ok: false as const, error: "지울 수 없는 위치입니다." };
  noteRemoved(relOf(abs));
  rmSync(abs, { recursive: true, force: false });
  return { ok: true as const, error: "" };
}
