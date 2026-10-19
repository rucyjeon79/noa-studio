import assert from "node:assert/strict";
import { test } from "node:test";
import { mapGrokStudioPage, mapGrokStory } from "./grok-mapping.ts";

test("two distinct EPs preserve original genre and padded IDs", () => {
  const first = mapGrokStudioPage({ kind: "single", genreId: "kpop-original", ep: "01", body: { title: "One" } });
  const second = mapGrokStudioPage({ kind: "single", genreId: "kpop-original", ep: "1", body: { title: "One" } });
  assert.notEqual(first.key, second.key);
});

test("story keys stay stable across edits when songId is unchanged", () => {
  const a = mapGrokStory({ title: "Before", genreId: "your-story", body: { songId: "s1" } }, "s1");
  const b = mapGrokStory({ title: "After", genreId: "your-story", body: { songId: "s1" } }, "s1");
  assert.equal(a.key, b.key);
});

test("invalid story identifiers are rejected before network operations", () => {
  assert.throws(() => mapGrokStory({ title: "Story", genreId: "your-story", body: {} }, "../bad"));
});
