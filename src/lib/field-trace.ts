const SECRET = /password|secret|token|adminDevice|securityKey|gatePassword/i;
const MAX = 200;

export type FieldTrace = {
  order: number;
  at: string;
  songId: string;
  field: string;
  hash: string;
  source: string;
  reader: string;
  component: string;
  rev: number;
  note: string;
};

const rows: FieldTrace[] = [];
let order = 0;

export function fieldTraceOn() {
  if (typeof process !== "undefined" && process.env.NOA_FIELD_TRACE === "1") return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem("noa-field-trace") === "1";
  } catch {
    return false;
  }
}

export function hashField(value: unknown) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function traceField(input: {
  songId?: string;
  field?: string;
  value?: unknown;
  source: string;
  reader: string;
  component?: string;
  rev?: number;
  note?: string;
}) {
  if (!fieldTraceOn()) return;
  const field = String(input.field || "");
  if (!field || SECRET.test(field) || SECRET.test(input.source) || SECRET.test(input.note || "")) return;
  const row: FieldTrace = {
    order: ++order,
    at: new Date().toISOString(),
    songId: String(input.songId || ""),
    field,
    hash: hashField(input.value),
    source: input.source,
    reader: input.reader,
    component: String(input.component || ""),
    rev: typeof input.rev === "number" ? input.rev : 0,
    note: String(input.note || ""),
  };
  rows.push(row);
  if (rows.length > MAX) rows.shift();
  if (typeof window !== "undefined") {
    (window as unknown as { __noaFieldTrace?: FieldTrace[] }).__noaFieldTrace = rows;
  }
}

export function readFieldTrace() {
  return rows.slice();
}

export function clearFieldTrace() {
  rows.length = 0;
  order = 0;
}
