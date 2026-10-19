import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { planLiveWrite } from "./save-rev.ts";

const live = "/workspace/data/live/곡/kpop-original/ep/01.json";
const liveHash = createHash("sha256").update(readFileSync(live)).digest("hex");
const dir = "/tmp/noa-ghost-probe";
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const copy = join(dir, "01.json");
copyFileSync(live, copy);
const original = JSON.parse(readFileSync(copy, "utf8"));
const lyricsA = String(original.pkg?.lyricsBlock || "");
const titleA = String(original.pkg?.confirmedTitle || "");
const sunoA = String(original.pkg?.sunoUrl || "");
const youtubeA = String(original.pkg?.youtubeUrl || "");
assert.ok(lyricsA.length > 0, "copy has lyrics");

const diskB = { ...original, rev: 1, pkg: { ...original.pkg, lyricsBlock: "B-가사", youtubeUrl: "https://youtu.be/B", sunoUrl: "https://suno.com/song/B" } };
const stale = planLiveWrite(diskB, { pkg: { ...original.pkg, lyricsBlock: lyricsA, youtubeUrl: youtubeA, sunoUrl: sunoA } });
assert.equal(stale.ok, true);
assert.equal(stale.next.pkg.lyricsBlock, "B-가사");
assert.equal(stale.next.pkg.youtubeUrl, "https://youtu.be/B");
assert.equal(stale.next.pkg.sunoUrl, "https://suno.com/song/B");

const exact = planLiveWrite(diskB, {
  pkg: {
    ...diskB.pkg,
    sunoUrl: sunoA,
    fieldSavedAt: { sunoUrl: "2099-01-01T00:00:00.000Z" },
  },
});
assert.equal(exact.ok, true);
assert.equal(exact.next.pkg.sunoUrl, sunoA);
assert.equal(exact.next.pkg.lyricsBlock, "B-가사");

const versioned = planLiveWrite(diskB, {
  baseRev: 1,
  pkg: { ...original.pkg, lyricsBlock: lyricsA, youtubeUrl: youtubeA, sunoUrl: sunoA },
});
assert.equal(versioned.ok, true);
assert.equal(versioned.next.pkg.lyricsBlock, lyricsA);
assert.equal(versioned.next.pkg.youtubeUrl, youtubeA);

const blocked = planLiveWrite(diskB, { baseRev: 0, pkg: { lyricsBlock: lyricsA } });
assert.equal(blocked.ok, false);
assert.equal(createHash("sha256").update(readFileSync(live)).digest("hex"), liveHash);
assert.equal(createHash("sha256").update(readFileSync(copy)).digest("hex"), liveHash);
console.log(JSON.stringify({
  liveUntouched: true,
  lyricsHash: createHash("sha256").update(lyricsA).digest("hex").slice(0, 12),
  titleHash: createHash("sha256").update(titleA).digest("hex").slice(0, 12),
  sunoHash: createHash("sha256").update(sunoA).digest("hex").slice(0, 12),
  youtubeHash: createHash("sha256").update(youtubeA).digest("hex").slice(0, 12),
  versionlessKeepsB: stale.next.pkg.lyricsBlock === "B-가사",
  newerSunoStampWritesA: exact.next.pkg.sunoUrl === sunoA,
  matchingRevWritesA: versioned.next.pkg.lyricsBlock === lyricsA,
  staleRevBlocked: blocked.ok === false,
}, null, 2));
