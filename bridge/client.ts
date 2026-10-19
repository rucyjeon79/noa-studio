/**
 * Same-origin client for the Dothome NOA Bridge staging API.
 * This is intentionally NOT wired into the Grok app: cross-origin GnuBoard
 * authentication has not been implemented. Never put DB credentials in JS.
 */
export type BridgeKind = "single" | "playlist" | "story" | "meta" | "prefs";
export type BridgeDocument<T extends Record<string, unknown>> = {
  ok: true;
  key: string;
  kind: BridgeKind;
  payload: T;
  revision: number;
};
export type BridgeWriteResult = { ok: true; revision: number; replayed: boolean };

export class BridgeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(
    status: number,
    code: string,
  ) {
    super(`NOA Bridge: ${code} (HTTP ${status})`);
    this.name = "BridgeError";
    this.status = status;
    this.code = code;
  }
}

function assertSameOrigin(endpoint: string): URL {
  if (typeof window === "undefined") throw new Error("Bridge client is browser-only");
  const url = new URL(endpoint, window.location.href);
  if (url.origin !== window.location.origin || url.protocol !== "https:") {
    throw new Error("NOA Bridge must use an HTTPS same-origin endpoint");
  }
  if (url.username || url.password) throw new Error("Credentials in URL are forbidden");
  return url;
}

async function decode<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : "http_error";
    throw new BridgeError(response.status, error);
  }
  if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
    throw new BridgeError(response.status, "invalid_response");
  }
  return body as T;
}

export async function readBridgeDocument<T extends Record<string, unknown>>(
  endpoint: string,
  key: string,
  revision?: number,
): Promise<BridgeDocument<T>> {
  const url = assertSameOrigin(endpoint);
  url.searchParams.set("key", key);
  if (revision !== undefined) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid history revision");
    url.searchParams.set("revision", String(revision));
  }
  return decode<BridgeDocument<T>>(await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  }));
}

export async function writeBridgeDocument(
  endpoint: string,
  data: {
    key: string;
    kind: BridgeKind;
    payload: Record<string, unknown>;
    expectedRevision: number;
    /** Keep the same UUID when retrying the exact same write. */
    requestId: string;
  },
): Promise<BridgeWriteResult> {
  if (!Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0) {
    throw new Error("Invalid expected revision");
  }
  const url = assertSameOrigin(endpoint);
  url.searchParams.set("key", data.key);
  return decode<BridgeWriteResult>(await fetch(url, {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      kind: data.kind,
      payload: data.payload,
      expectedRevision: data.expectedRevision,
      requestId: data.requestId,
    }),
  }));
}
