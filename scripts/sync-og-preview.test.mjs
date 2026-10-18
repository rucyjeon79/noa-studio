import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncOgPreview } from "./sync-og-preview.mjs";

function paint(path, color) {
  const py = `
from PIL import Image
Image.new("RGB", (320, 180), ${color}).save(${JSON.stringify(path)}, "JPEG", quality=80)
`;
  const run = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
}

function siteOf(root) {
  return JSON.parse(readFileSync(join(root, "src/lib/og/site.json"), "utf8"));
}

test("a new preview image bumps the corner number once", () => {
  const root = mkdtempSync(join(tmpdir(), "og-sync-"));
  mkdirSync(join(root, "public"), { recursive: true });
  mkdirSync(join(root, "src/lib/og"), { recursive: true });
  const og = join(root, "public/og.jpg");
  paint(og, "(20, 20, 20)");
  writeFileSync(
    join(root, "src/lib/og/site.json"),
    JSON.stringify({ title: "NOA STUDIO", card: "custom", imageRev: "5" }, null, 2),
  );

  const first = syncOgPreview(root);
  assert.equal(first.bumped, false);
  assert.equal(siteOf(root).imageRev, "5");
  const baseline = siteOf(root).stampedHash;
  assert.equal(typeof baseline, "string");

  const again = syncOgPreview(root);
  assert.equal(again.bumped, false);
  assert.equal(siteOf(root).imageRev, "5");

  paint(og, "(180, 40, 40)");
  const next = syncOgPreview(root);
  assert.equal(next.bumped, true);
  assert.equal(next.rev, "6");
  assert.equal(siteOf(root).imageRev, "6");
  assert.notEqual(siteOf(root).stampedHash, baseline);

  const stay = syncOgPreview(root);
  assert.equal(stay.bumped, false);
  assert.equal(siteOf(root).imageRev, "6");
});
