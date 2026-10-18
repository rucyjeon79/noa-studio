#!/usr/bin/env node
/**
 * The published server has no workspace disk. Copy the studio files into the
 * Vercel function so songs, settings, and originals are readable after publish.
 * Local PGLite folders stay out — production uses the hosted database.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "data/live");
const destRoot = join(root, ".vercel/output/functions/__server.func");
const dest = join(destRoot, "data/live");
const skip = new Set(["pglite", "pglite-broken"]);

if (!existsSync(src) || !existsSync(destRoot)) {
  console.log("[bundle-live] no live data or function output — skip");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
let files = 0;
for (const name of readdirSync(src)) {
  if (skip.has(name)) continue;
  const from = join(src, name);
  const to = join(dest, name);
  cpSync(from, to, { recursive: true });
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else files += 1;
    }
  };
  walk(to);
}
console.log(`[bundle-live] copied ${files} files into the publish function`);
