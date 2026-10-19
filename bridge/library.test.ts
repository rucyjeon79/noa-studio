import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { listBridgeLibrary } from "./library.ts";
import { BridgeError } from "./client.ts";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});

function browser() {
  (globalThis as unknown as { window: { location: { href: string; origin: string } } }).window = {
    location: { href: "https://noastudio.ai.kr/", origin: "https://noastudio.ai.kr" },
  };
}

test("library listing passes kind and cursor and sends same-origin credentials", async () => {
  browser();
  let request: Request | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({
      ok: true, items: [{ key: "single:kpop-original:31", kind: "single", revision: 1, updatedAt: "2026-10-20" }],
      hasMore: false, nextCursor: null,
    }), { status: 200 });
  }) as typeof fetch;
  const result = await listBridgeLibrary("/noa-bridge/library.php", {
    kind: "single", after: "single:kpop-original:30",
  });
  assert.equal(result.items.length, 1);
  assert.equal(request?.credentials, "same-origin");
  assert.equal(request?.method, "GET");
  assert.equal(new URL(request!.url).searchParams.get("kind"), "single");
  assert.equal(new URL(request!.url).searchParams.get("after"), "single:kpop-original:30");
});

test("library blocks cross-origin requests", async () => {
  browser();
  let called = false;
  globalThis.fetch = (async () => { called = true; throw new Error("unexpected fetch"); }) as typeof fetch;
  await assert.rejects(listBridgeLibrary("https://noa-studio.grok.me/noa-bridge/library.php"), /same-origin/);
  assert.equal(called, false);
});

test("library surfaces server failures", async () => {
  browser();
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: "admin_required" }), { status: 403 })) as typeof fetch;
  await assert.rejects(listBridgeLibrary("/noa-bridge/library.php"), (error: unknown) =>
    error instanceof BridgeError && error.status === 403);
});

test("library rejects malformed successful responses", async () => {
  browser();
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, items: null }), { status: 200 })) as typeof fetch;
  await assert.rejects(listBridgeLibrary("/noa-bridge/library.php"), (error: unknown) =>
    error instanceof BridgeError && error.code === "invalid_library_response");
});
