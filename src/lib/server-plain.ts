/** 서버 함수 응답은 함수가 돌려준 값이다. 한 겹 더 감싸져 있으면 그 안을 연다. */

function seroPlain(node: unknown, seen: unknown[] = []): unknown {
  if (!node || typeof node !== "object") return node;
  const row = node as { i?: number; t?: number; s?: unknown; a?: unknown[]; p?: { k?: string[]; v?: unknown[] } };
  if (typeof row.i === "number" && seen[row.i]) return seen[row.i];
  if (row.t === 1 || row.t === 0) return row.s;
  if (row.t === 2) return row.s === 2 ? true : row.s === 3 ? false : row.s === 0 ? null : undefined;
  if (row.t === 9) {
    const list: unknown[] = [];
    if (typeof row.i === "number") seen[row.i] = list;
    for (const item of row.a || []) list.push(seroPlain(item, seen));
    return list;
  }
  if (row.t === 10 || row.t === 11) {
    const obj: Record<string, unknown> = {};
    if (typeof row.i === "number") seen[row.i] = obj;
    const keys = row.p?.k || [];
    const vals = row.p?.v || [];
    keys.forEach((key, index) => {
      obj[String(seroPlain(key, seen))] = seroPlain(vals[index], seen);
    });
    return obj;
  }
  return null;
}

function looksSaved(row: Record<string, unknown>) {
  if (row.ok === true || row.ok === false) return true;
  if (row.fields && typeof row.fields === "object") return true;
  if (typeof row.error === "string" && ("dir" in row || "text" in row || "path" in row || "files" in row)) return true;
  return false;
}

export function serverPlain<T = Record<string, unknown>>(saved: unknown): T | null {
  if (!saved || typeof saved !== "object") return null;
  const row = saved as Record<string, unknown>;
  if (looksSaved(row)) return row as T;
  const inner = row.result;
  if (inner && typeof inner === "object" && looksSaved(inner as Record<string, unknown>)) return inner as T;
  const plain = row.t === 10 || row.t === 11 ? seroPlain(saved) : null;
  if (!plain || typeof plain !== "object") return null;
  const body = plain as Record<string, unknown>;
  if (looksSaved(body)) return body as T;
  if (body.result && typeof body.result === "object" && looksSaved(body.result as Record<string, unknown>)) return body.result as T;
  return body as T;
}

export function serverOk(saved: unknown) {
  const plain = serverPlain<{ ok?: boolean; error?: unknown }>(saved);
  return Boolean(plain && plain.ok === true);
}

export function serverError(saved: unknown) {
  const plain = serverPlain<{ error?: unknown }>(saved);
  return plain && typeof plain.error === "string" ? plain.error : "";
}
