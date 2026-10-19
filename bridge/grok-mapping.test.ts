import assert from "node:assert/strict";
import { test } from "node:test";
import { mapGrokMeta, mapGrokStudioPage } from "./grok-mapping.ts";

test("single pages preserve genre and EP in unique bridge key", () => {
  const input = { kind: "single" as const, genreId: "kpop", ep: "31", title: "First Glance", body: { lyrics: "test" } };
  const mapped = mapGrokStudioPage(input);
  assert.equal(mapped.key, "single:kpop:31");
  assert.equal(mapped.kind, "single");
  assert.deepEqual(mapped.payload.body, { lyrics: "test" });
  input.body.lyrics = "edited";
  assert.deepEqual(mapped.payload.body, { lyrics: "test" });
});

test("ACT playlist does not collide with a single EP", () => {
  const mapped = mapGrokStudioPage({ kind: "playlist", genreId: "kpop", act: 4, body: {} });
  assert.equal(mapped.key, "playlist:kpop:act-4");
});

test("different languages use different keys", () => {
  const korean = mapGrokStudioPage({ kind: "single", genreId: "kpop", ep: "31", body: {} });
  const japanese = mapGrokStudioPage({ kind: "single", genreId: "jpop", ep: "31", body: {} });
  assert.notEqual(korean.key, japanese.key);
});

test("invalid key fragments and ACT are rejected", () => {
  assert.throws(() => mapGrokStudioPage({ kind: "single", genreId: "../admin", ep: "31", body: {} }));
  assert.throws(() => mapGrokStudioPage({ kind: "playlist", genreId: "kpop", act: 0, body: {} }));
});

test("metadata is snapshotted", () => {
  const meta = { locks: { ep31: true } };
  const mapped = mapGrokMeta(meta);
  meta.locks.ep31 = false;
  assert.equal((mapped.payload.locks as { ep31: boolean }).ep31, true);
});

test("real catalog genre IDs and zero-padded EP remain intact", () => {
  const kr = mapGrokStudioPage({ kind: "single", genreId: "kpop-original", ep: "01", body: {} });
  const jp = mapGrokStudioPage({ kind: "single", genreId: "jpop-original", ep: "01", body: {} });
  assert.equal(kr.key, "single:kpop-original:01");
  assert.equal(jp.key, "single:jpop-original:01");
  assert.notEqual(kr.key, jp.key);
});

test("independent collection genre is not forced into original EP namespace", () => {
  const page = mapGrokStudioPage({ kind: "playlist", genreId: "groovy-airy-pop", act: 1, body: {} });
  assert.equal(page.key, "playlist:groovy-airy-pop:act-1");
});
