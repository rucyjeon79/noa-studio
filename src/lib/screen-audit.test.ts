import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { omitUnsavedFields, planLiveWrite, viewTitleForSave } from "./save-rev.ts";

const livePath = "/workspace/data/live/곡/kpop-original/ep/01.json";
const before = readFileSync(livePath);
const disk = JSON.parse(before.toString("utf8"));
const lyrics = String(disk.pkg.lyricsBlock || "");
const title = String(disk.pkg.confirmedTitle || "");
const suno = String(disk.pkg.sunoUrl || "");
const youtube = String(disk.pkg.youtubeUrl || "");
assert.ok(lyrics && title && suno && youtube);

function screenSave(savedKeys: string[], patch: Record<string, unknown>, baseRev = 3, diskRev = baseRev) {
  const incomingPkg = omitUnsavedFields(
    { ...disk.pkg, ...patch, fieldSavedAt: Object.fromEntries(savedKeys.map((key) => [key, "2099-01-01T00:00:00.000Z"])) },
    savedKeys,
    false,
  );
  const current = { ...disk, rev: diskRev, title: disk.title, pkg: { ...disk.pkg } };
  const planned = planLiveWrite(current, { baseRev, title: viewTitleForSave(disk.title, patch.confirmedTitle, savedKeys, false), pkg: incomingPkg });
  const reread = planned.ok ? planned.next : current;
  return { planned, reread };
}

const lyricSave = screenSave(["lyricsBlock"], { lyricsBlock: "화면 가사", confirmedTitle: "옛 제목", sunoUrl: "https://suno.com/old", youtubeUrl: "https://youtu.be/old" });
assert.equal(lyricSave.planned.ok, true);
assert.equal(lyricSave.reread.pkg.lyricsBlock, "화면 가사");
assert.equal(lyricSave.reread.pkg.confirmedTitle, title);
assert.equal(lyricSave.reread.pkg.sunoUrl, suno);
assert.equal(lyricSave.reread.pkg.youtubeUrl, youtube);
assert.equal(lyricSave.reread.title, disk.title);

const titleSave = screenSave(["confirmedTitle"], { confirmedTitle: "새 제목", lyricsBlock: "옛 가사" });
assert.equal(titleSave.reread.pkg.confirmedTitle, "새 제목");
assert.equal(titleSave.reread.pkg.lyricsBlock, lyrics);
assert.equal(viewTitleForSave(disk.title, "새 제목", ["confirmedTitle"], false), "새 제목");

const sunoSave = screenSave(["sunoUrl"], { sunoUrl: "https://suno.com/new", lyricsBlock: "옛 가사" });
assert.equal(sunoSave.reread.pkg.sunoUrl, "https://suno.com/new");
assert.equal(sunoSave.reread.pkg.lyricsBlock, lyrics);
assert.equal(sunoSave.reread.pkg.youtubeUrl, youtube);

const youtubeSave = screenSave(["youtubeUrl"], { youtubeUrl: "https://youtu.be/new", sunoUrl: "https://suno.com/old" });
assert.equal(youtubeSave.reread.pkg.youtubeUrl, "https://youtu.be/new");
assert.equal(youtubeSave.reread.pkg.sunoUrl, suno);
assert.equal(youtubeSave.reread.pkg.lyricsBlock, lyrics);

const confirmLinks = screenSave(["youtubeUrl", "mvUrl", "sunoUrl", "ytPremium", "mvPremium"], { youtubeUrl: youtube, sunoUrl: suno, lyricsBlock: "옛 가사" });
assert.equal(confirmLinks.reread.pkg.lyricsBlock, lyrics);
assert.equal(confirmLinks.reread.pkg.confirmedTitle, title);

const thumb = screenSave(["geminiPrompt", "thumbUrl"], { geminiPrompt: "새 프롬프트", thumbUrl: "https://img.example/new.png", lyricsBlock: "옛 가사" });
assert.equal(thumb.reread.pkg.geminiPrompt, "새 프롬프트");
assert.equal(thumb.reread.pkg.lyricsBlock, lyrics);

const stale = screenSave(["lyricsBlock"], { lyricsBlock: "늦은 가사" }, 2, 3);
assert.equal(stale.planned.ok, false);
assert.equal(stale.reread.pkg.lyricsBlock, lyrics);
const keptInput = "늦은 가사";
assert.notEqual(stale.reread.pkg.lyricsBlock, keptInput);

assert.equal(createHash("sha256").update(readFileSync(livePath)).digest("hex"), createHash("sha256").update(before).digest("hex"));
console.log(JSON.stringify({
  liveUntouched: true,
  lyricOnly: true,
  titleOnly: true,
  sunoOnly: true,
  youtubeOnly: true,
  confirmKeepsLyrics: true,
  thumbKeepsLyrics: true,
  conflictKeepsFileAndInput: true,
}, null, 2));
