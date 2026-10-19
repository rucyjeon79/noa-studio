import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BridgeError, readBridgeDocument, writeBridgeDocument } from "./client.ts";

const oldWindow = globalThis.window;
const oldFetch = globalThis.fetch;
afterEach(() => {
  if (oldWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else globalThis.window = oldWindow;
  globalThis.fetch = oldFetch;
});

function browser() {
  (globalThis as unknown as { window: { location: { href: string; origin: string } } }).window = {
    location: { href: "https://noastudio.ai.kr/", origin: "https://noastudio.ai.kr" },
  };
}

test("cross-origin writes are blocked before fetch", async () => {
  browser();
  let called = false;
  globalThis.fetch = (async () => { called = true; throw new Error("unexpected fetch"); }) as typeof fetch;
  await assert.rejects(
    writeBridgeDocument("https://noa-studio.grok.me/noa-bridge/index.php", {
      key: "single:kpop:31", kind: "single", payload: {},
      expectedRevision: 0, requestId: "00000000-0000-4000-8000-000000000001",
    }),
    /same-origin/,
  );
  assert.equal(called, false);
});

test("write forwards revision and idempotency request unchanged", async () => {
  browser();
  let request: Request | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ ok: true, revision: 3, replayed: false }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const result = await writeBridgeDocument("/noa-bridge/index.php", {
    key: "single:kpop:31", kind: "single", payload: { title: "First Glance" },
    expectedRevision: 2, requestId: "00000000-0000-4000-8000-000000000002",
  });
  assert.equal(result.revision, 3);
  assert.equal(request?.credentials, "same-origin");
  assert.equal(request?.method, "PUT");
  assert.equal(request?.headers.get("X-NOA-Bridge-Request"), "1");
  assert.equal(new URL(request!.url).searchParams.get("key"), "single:kpop:31");
  const body = JSON.parse(await request!.text());
  assert.equal(body.expectedRevision, 2);
  assert.equal(body.requestId, "00000000-0000-4000-8000-000000000002");
});

test("history read requests exact revision", async () => {
  browser();
  let url = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    url = String(input);
    return new Response(JSON.stringify({
      ok: true, key: "single:kpop:31", kind: "single", payload: {}, revision: 2,
    }), { status: 200 });
  }) as typeof fetch;
  await readBridgeDocument("/noa-bridge/index.php", "single:kpop:31", 2);
  assert.equal(new URL(url).searchParams.get("revision"), "2");
});

test("revision conflict is surfaced without overwriting", async () => {
  browser();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ok: false, error: "revision_conflict",
  }), { status: 409 })) as typeof fetch;
  await assert.rejects(
    writeBridgeDocument("/noa-bridge/index.php", {
      key: "single:kpop:31", kind: "single", payload: {},
      expectedRevision: 1, requestId: "00000000-0000-4000-8000-000000000003",
    }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 409 && error.code === "revision_conflict",
  );
});
