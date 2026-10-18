import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  configFile: "/workspace/vite.config.ts",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
});
const store = await vite.ssrLoadModule("/src/lib/encyclopedia.server.ts");
const genre = "_saveprobe";
const dir = "/workspace/data/live/곡/_saveprobe/ep";
const file = `${dir}/01.json`;
const real = "/workspace/data/live/곡/dreamy-deep-house/ep/01.json";
const map = "/workspace/data/live/앱관리/탐색연결.json";
const mapBefore = existsSync(map) ? readFileSync(map, "utf8") : null;
const realBefore = readFileSync(real);

function audioOf(path) {
  const pkg = JSON.parse(readFileSync(path, "utf8")).pkg || {};
  return { level: pkg.audioLevel || "", analysis: pkg.audioAnalysis || "", summary: String(pkg.summary || "").slice(0, 12) };
}

try {
  mkdirSync(dir, { recursive: true });
  copyFileSync(real, file);
  const row = JSON.parse(readFileSync(file, "utf8"));
  row.genreId = genre;
  row.confirmed = true;
  writeFileSync(file, JSON.stringify(row));
  const before = audioOf(file);
  const pinned = store.pinShownAudio("song", genre, "01", 0, "", "lufs=-16.20;gain=2.20;peak=1.10", "lufs=-18.40;peak=-3.20;lift=1.50");
  const afterPin = audioOf(file);
  const shown = store.writeShownFields(file, { summary: `${before.summary}X` }, { genreId: genre, ep: "01" }, true, false);
  const afterShown = audioOf(file);
  const pkg = JSON.parse(readFileSync(file, "utf8")).pkg;
  const lyricsBefore = String(pkg.lyricsBlock || "");
  const saved = store.putEncMany([{
    kind: "single",
    genreId: genre,
    ep: "01",
    title: row.title || "",
    pkg: { ...pkg, summary: "나중 저장 요약", audioLevel: "", audioAnalysis: "", ytPremium: true, savedKeys: ["summary"] },
    rewrite: true,
  }]);
  const afterSave = audioOf(file);
  const afterPkg = JSON.parse(readFileSync(file, "utf8")).pkg || {};
  const premiumOff = store.pinShownPremium("song", genre, "01", 0, "", "song", false);
  const afterOff = JSON.parse(readFileSync(file, "utf8")).pkg || {};
  const flipped = store.putEncMany([{
    kind: "single",
    genreId: genre,
    ep: "01",
    title: row.title || "",
    pkg: { ...afterOff, ytPremium: true, summary: "나중 저장 요약", savedKeys: ["summary"] },
    rewrite: true,
  }]);
  const afterFlip = JSON.parse(readFileSync(file, "utf8")).pkg || {};
  const latest = await vite.ssrLoadModule("/src/lib/latest-text.ts");
  const filled = latest.mergeLatestBody({ audioLevel: "", sunoUrl: "" }, { audioLevel: "lufs=-14.00;gain=1.00;peak=1.00", sunoUrl: "https://suno.com/song/abc" });
  const kept = latest.mergeLatestBody({ audioLevel: "lufs=-14.00;gain=1.00;peak=1.00" }, { audioLevel: "" });
  console.log(JSON.stringify({
    before,
    pinned,
    afterPin,
    shownOk: shown.ok,
    afterShown,
    saved,
    afterSave,
    lyricsSame: String(afterPkg.lyricsBlock || "") === lyricsBefore,
    summary: afterPkg.summary,
    premiumOff,
    offFlag: afterOff.ytPremium,
    flipped,
    flagAfterStale: afterFlip.ytPremium,
    levelAfterStale: afterFlip.audioLevel || "",
    mergeFillsEmpty: filled.audioLevel,
    mergeKeepsPrev: kept.audioLevel,
    realUntouched: readFileSync(real).equals(realBefore),
  }, null, 2));
} finally {
  rmSync("/workspace/data/live/곡/_saveprobe", { recursive: true, force: true });
  if (mapBefore == null) {
    if (existsSync(map)) rmSync(map, { force: true });
  } else writeFileSync(map, mapBefore);
  await vite.close();
}
