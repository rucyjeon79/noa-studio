import assert from "node:assert/strict";
import { test } from "node:test";
import { makeMigrationManifest } from "./migration-manifest.ts";

test("manifest is read-only and preserves EP and ACT separation", () => {
  const source = {
    packages: { one: { genreId: "kpop-original", ep: "01", title: "One", pkg: { lyrics: "original" } } },
    playlists: { act: { genreId: "kpop-original", act: 1, title: "ACT 1", pkg: { songs: [] } } },
    stories: {},
  };
  const before = structuredClone(source);
  const result = makeMigrationManifest(source);
  assert.deepEqual(source, before);
  assert.deepEqual(result.documents.map((d) => d.key), ["playlist:kpop-original:act-1", "single:kpop-original:01"]);
  assert.equal(result.skipped.length, 0);
});

test("duplicate keys are skipped instead of overwritten", () => {
  const result = makeMigrationManifest({
    packages: {
      first: { genreId: "kpop-original", ep: "31", pkg: { title: "A" } },
      second: { genreId: "kpop-original", ep: "31", pkg: { title: "B" } },
    }, playlists: {}, stories: {},
  });
  assert.equal(result.documents.length, 1);
  assert.equal(result.skipped[0].reason, "duplicate_key");
});

test("story without a stable ID is not migrated", () => {
  const result = makeMigrationManifest({
    packages: {}, playlists: {},
    stories: { titleKey: { title: "Story", pkg: { genreId: "your-story" } } },
  });
  assert.equal(result.documents.length, 0);
  assert.equal(result.skipped[0].reason, "missing_or_invalid_story_identity");
});
