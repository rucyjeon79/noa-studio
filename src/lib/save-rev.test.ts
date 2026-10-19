import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyLiveWrite, commitJsonFile, readRev } from "./save-rev.ts";

test("stale revision does not replace the saved file", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-rev-"));
  const file = join(dir, "song.json");
  const conflicts = join(dir, "conflicts");
  const first = commitJsonFile(file, { title: "B", pkg: { lyricsBlock: "신규" } }, 0, conflicts);
  assert.equal(first.ok, true);
  assert.equal(first.rev, 1);
  const stale = commitJsonFile(file, { title: "A", pkg: { lyricsBlock: "과거" } }, 0, conflicts);
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "conflict");
  const kept = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(kept.pkg.lyricsBlock, "신규");
  assert.equal(readRev(kept), 1);
  const next = commitJsonFile(file, { title: "C", pkg: { lyricsBlock: "그다음" } }, 1, conflicts);
  assert.equal(next.ok, true);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).pkg.lyricsBlock, "그다음");
  rmSync(dir, { recursive: true, force: true });
});

test("refresh, navigation, and restart read the same saved file", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-read-"));
  const file = join(dir, "곡", "ep.json");
  const conflicts = join(dir, "conflicts");
  const saved = applyLiveWrite(file, { genreId: "kpop-original", ep: "21", confirmed: true, pkg: { lyricsBlock: "B", youtubeUrl: "https://youtu.be/new" }, baseRev: 0 }, conflicts);
  assert.equal(saved.ok, true);
  const refresh = JSON.parse(readFileSync(file, "utf8"));
  const moved = JSON.parse(readFileSync(file, "utf8"));
  const restarted = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(refresh.pkg.lyricsBlock, "B");
  assert.equal(moved.pkg.youtubeUrl, "https://youtu.be/new");
  assert.equal(restarted.rev, refresh.rev);
  rmSync(dir, { recursive: true, force: true });
});

test("delayed and second-device saves do not overwrite, and the conflict keeps both copies", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-race-"));
  const file = join(dir, "곡", "ep.json");
  const conflicts = join(dir, "conflicts");
  assert.equal(applyLiveWrite(file, { pkg: { lyricsBlock: "B", sunoUrl: "https://suno.com/new" }, baseRev: 0 }, conflicts).ok, true);
  const delayed = applyLiveWrite(file, { pkg: { lyricsBlock: "A", sunoUrl: "https://suno.com/old" }, baseRev: 0 }, conflicts);
  assert.equal(delayed.ok, false);
  assert.equal(delayed.error, "conflict");
  const disk = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(disk.pkg.lyricsBlock, "B");
  const copies = readdirSync(conflicts).filter((name) => name.endsWith(".json"));
  assert.equal(copies.length, 1);
  const conflict = JSON.parse(readFileSync(join(conflicts, copies[0]), "utf8"));
  assert.equal(conflict.current.pkg.lyricsBlock, "B");
  assert.equal(conflict.rejected.pkg.lyricsBlock, "A");
  rmSync(dir, { recursive: true, force: true });
});

test("a versioned partial save changes only the sent field", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-part-"));
  const file = join(dir, "곡", "ep.json");
  const conflicts = join(dir, "conflicts");
  applyLiveWrite(file, { confirmed: true, pkg: { lyricsBlock: "가사", youtubeUrl: "https://youtu.be/keep" }, baseRev: 0 }, conflicts);
  const rev = readRev(JSON.parse(readFileSync(file, "utf8")));
  const saved = applyLiveWrite(file, { pkg: { youtubeUrl: "https://youtu.be/changed" }, baseRev: rev }, conflicts);
  assert.equal(saved.ok, true);
  const disk = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(disk.pkg.youtubeUrl, "https://youtu.be/changed");
  assert.equal(disk.pkg.lyricsBlock, "가사");
  assert.equal(disk.confirmed, true);
  rmSync(dir, { recursive: true, force: true });
});

test("a save without a version cannot replace a confirmed song or a filled setting", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-unversioned-"));
  const song = join(dir, "곡", "ep.json");
  const pref = join(dir, "사용자설정", "공통.json");
  const conflicts = join(dir, "conflicts");
  applyLiveWrite(song, { confirmed: true, pkg: { lyricsBlock: "확정가사", youtubeUrl: "https://youtu.be/keep" }, baseRev: 0 }, conflicts);
  applyLiveWrite(pref, { rule: "최신규칙", baseRev: 0 }, conflicts);
  const staleSong = applyLiveWrite(song, { confirmed: false, pkg: { lyricsBlock: "과거가사", youtubeUrl: "https://youtu.be/old" } }, conflicts);
  const stalePref = applyLiveWrite(pref, { rule: "과거규칙" }, conflicts);
  assert.equal(staleSong.ok, true);
  assert.equal(stalePref.ok, true);
  assert.equal(JSON.parse(readFileSync(song, "utf8")).pkg.lyricsBlock, "확정가사");
  assert.equal(JSON.parse(readFileSync(song, "utf8")).confirmed, true);
  assert.equal(JSON.parse(readFileSync(pref, "utf8")).rule, "최신규칙");
  rmSync(dir, { recursive: true, force: true });
});

test("a failed write leaves the file unchanged and the same version can retry", () => {
  const dir = mkdtempSync(join(tmpdir(), "noa-net-"));
  const file = join(dir, "곡", "ep.json");
  const conflicts = join(dir, "conflicts");
  assert.equal(applyLiveWrite(file, { pkg: { lyricsBlock: "B" }, baseRev: 0 }, conflicts).ok, true);
  const blocked = applyLiveWrite(join(file, "child.json"), { pkg: { lyricsBlock: "C" }, baseRev: 1 }, conflicts);
  assert.equal(blocked.ok, false);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).pkg.lyricsBlock, "B");
  const retried = applyLiveWrite(file, { pkg: { lyricsBlock: "C" }, baseRev: 1 }, conflicts);
  assert.equal(retried.ok, true);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).pkg.lyricsBlock, "C");
  rmSync(dir, { recursive: true, force: true });
});
