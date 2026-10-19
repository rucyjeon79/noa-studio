/**
 * Read-only browser-side library index for the same-origin NOA Bridge.
 * No write endpoints, cross-origin cookies, or legacy data changes.
 */
import { BridgeError } from "./client.ts";

export type LibraryItem = {
  key: string;
  kind: "single" | "playlist" | "story" | "meta" | "prefs";
  revision: number;
  updatedAt: string;
};
export type LibraryPage = {
  ok: true;
  items: LibraryItem[];
  hasMore: boolean;
  nextCursor: string | null;
};
export async function listBridgeLibrary(
  endpoint: string,
  options: { kind?: LibraryItem["kind"]; after?: string } = {},
): Promise<LibraryPage> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const url = new URL(endpoint, window.location.href);
  if (url.origin !== window.location.origin || url.protocol !== "https:" || url.username || url.password) {
    throw new Error("HTTPS same-origin required");
  }
  url.searchParams.set("list", "1");
  if (options.kind) url.searchParams.set("kind", options.kind);
  if (options.after) url.searchParams.set("after", options.after);
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeError(response.status, "library_request_failed");
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true || !("items" in result) || !Array.isArray(result.items)) {
    throw new BridgeError(response.status, "invalid_library_response");
  }
  return result as LibraryPage;
}
