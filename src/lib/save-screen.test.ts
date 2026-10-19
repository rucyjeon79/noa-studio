import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { commitJsonFile, readRev } from "./save-rev.ts";

const root = join("/tmp", "noa-screen-probe", "data", "live", "곡", "probe", "ep");
const file = join(root, "01.json");
rmSync(join("/tmp", "noa-screen-probe"), { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const seed = {
  genreId: "probe",
  ep: "01",
  title: "원제목",
  confirmed: true,
  pkg: {
    confirmedTitle: "원제목",
    lyricsBlock: "원래가사",
    youtubeUrl: "https://youtu.be/old",
    sunoUrl: "https://suno.com/song/old",
  },
};
writeFileSync(file, `${JSON.stringify(seed)}\n`);

function shownWrite(path, incoming, expectRev) {
  const prev = JSON.parse(readFileSync(path, "utf8"));
  const prevPkg = prev.pkg && typeof prev.pkg === "object" ? prev.pkg : {};
  return commitJsonFile(path, { ...prev, pkg: { ...prevPkg, ...incoming } }, expectRev, join("/tmp", "noa-screen-probe", "conflicts"));
}

const changed = shownWrite(file, { youtubeUrl: "https://youtu.be/new" }, 0);
assert.equal(changed.ok, true);
let disk = JSON.parse(readFileSync(file, "utf8"));
assert.equal(disk.pkg.youtubeUrl, "https://youtu.be/new");
assert.equal(disk.pkg.sunoUrl, "https://suno.com/song/old");
assert.equal(disk.pkg.lyricsBlock, "원래가사");
assert.equal(disk.confirmed, true);
assert.equal(disk.title, "원제목");
assert.equal(readRev(disk), 1);

const stale = shownWrite(file, { sunoUrl: "https://suno.com/song/stale" }, 0);
assert.equal(stale.ok, false);
assert.equal(stale.error, "conflict");
disk = JSON.parse(readFileSync(file, "utf8"));
assert.equal(disk.pkg.sunoUrl, "https://suno.com/song/old");
assert.equal(disk.pkg.youtubeUrl, "https://youtu.be/new");

const again = shownWrite(file, { sunoUrl: "https://suno.com/song/new" }, readRev(disk));
assert.equal(again.ok, true);
disk = JSON.parse(readFileSync(file, "utf8"));
assert.equal(disk.pkg.sunoUrl, "https://suno.com/song/new");
assert.equal(disk.pkg.lyricsBlock, "원래가사");
assert.equal(disk.confirmed, true);

const source = readFileSync(new URL("./encyclopedia.server.ts", import.meta.url), "utf8");
assert.match(source, /writeShownFields\(path, \{ \[field\]: clean \}/);
assert.match(source, /pinShownString\(genreId, ep, field, value, expectRev\)/);
assert.doesNotMatch(source, /if \(have\) return \{ ok: true, value: have, error: "kept" \}/);

console.log("screen-save-ok", readRev(disk));
