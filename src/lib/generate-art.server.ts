import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAST } from "./characters";

export function fileDataUri(rel: string) {
  const cwd = globalThis.process?.cwd?.();
  if (!cwd) return "";
  const abs = join(cwd, "public", rel.replace(/^\//, ""));
  if (!existsSync(abs)) return "";
  const buf = readFileSync(abs);
  return `data:${rel.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`;
}

export function refUris(ids: string[]) {
  return ids.map((id) => fileDataUri(CAST[id as keyof typeof CAST].face.replace(/^\//, ""))).filter(Boolean);
}

export function xaiKey() {
  return globalThis.process?.env?.XAI_API_KEY ?? "";
}
