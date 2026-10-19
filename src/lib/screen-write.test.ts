import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bodyLinkValue, fileMayReplaceShown, omitUnsavedFields, planLiveWrite, viewTitleForSave } from "./save-rev.ts";

const live = "/workspace/data/live/곡/kpop-original/ep/01.json";
const before = readFileSync(live);
const disk = JSON.parse(before.toString("utf8"));
const lyrics = String(disk.pkg?.lyricsBlock || "");
const title = String(disk.pkg?.confirmedTitle || "");
const suno = String(disk.pkg?.sunoUrl || "");
const youtube = String(disk.pkg?.youtubeUrl || "");
assert.ok(lyrics && title);

const screen = {
  ...disk.pkg,
  confirmedTitle: "오래된 화면 제목",
  lyricsBlock: "새 가사",
  sunoUrl: "https://suno.com/old",
  youtubeUrl: "https://youtu.be/old",
  fieldSavedAt: { lyricsBlock: "2099-01-01T00:00:00.000Z", sunoUrl: "2099-01-01T00:00:00.000Z", confirmedTitle: "2099-01-01T00:00:00.000Z" },
};
const saved = omitUnsavedFields(screen, ["lyricsBlock"], false);
assert.equal(saved.lyricsBlock, "새 가사");
assert.equal("confirmedTitle" in saved, false);
assert.equal("sunoUrl" in saved, false);
assert.equal("youtubeUrl" in saved, false);
assert.equal(viewTitleForSave(disk.title, "오래된 화면 제목", ["lyricsBlock"], false), String(disk.title || ""));
assert.equal(viewTitleForSave(disk.title, "새 제목", ["confirmedTitle"], false), "새 제목");

const staged = planLiveWrite(
  { ...disk, rev: 4, pkg: { ...disk.pkg, lyricsBlock: lyrics, sunoUrl: suno, youtubeUrl: youtube, confirmedTitle: title } },
  { baseRev: 4, pkg: saved },
);
assert.equal(staged.ok, true);
assert.equal(staged.next.pkg.lyricsBlock, "새 가사");
assert.equal(staged.next.pkg.confirmedTitle, title);
assert.equal(staged.next.pkg.sunoUrl, suno);
assert.equal(staged.next.pkg.youtubeUrl, youtube);
assert.equal(staged.next.title, disk.title);

const late = planLiveWrite(staged.next, { baseRev: 4, pkg: { lyricsBlock: lyrics, sunoUrl: "https://suno.com/old", youtubeUrl: "https://youtu.be/old" } });
assert.equal(late.ok, false);

const held = bodyLinkValue("https://suno.com/new", "https://suno.com/old", false);
assert.equal(held, "https://suno.com/new");
assert.equal(fileMayReplaceShown("입력중", "파일값", ["lyrics"], "lyrics"), false);
assert.equal(fileMayReplaceShown("화면", "파일", [], "lyrics"), true);

assert.equal(createHash("sha256").update(readFileSync(live)).digest("hex"), createHash("sha256").update(before).digest("hex"));
console.log(JSON.stringify({
  liveUntouched: true,
  lyricsOnly: staged.next.pkg.lyricsBlock === "새 가사" && staged.next.pkg.sunoUrl === suno && staged.next.pkg.youtubeUrl === youtube,
  oldTitleExcluded: viewTitleForSave(disk.title, "오래된 화면 제목", ["lyricsBlock"], false) === String(disk.title || ""),
  staleRevBlocked: late.ok === false,
  heldIgnored: held === "https://suno.com/new",
  editedNotReplaced: fileMayReplaceShown("입력중", "파일값", ["lyrics"], "lyrics") === false,
}, null, 2));
