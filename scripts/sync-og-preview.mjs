import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE_REL = "src/lib/og/site.json";
const OG_REL = "public/og.jpg";

export function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readSite(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stamp(path, label) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
import sys
path, label = sys.argv[1], sys.argv[2]
im = Image.open(path).convert("RGB")
w, h = im.size
size = max(28, round(w * 78 / 1792))
font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", size)
draw = ImageDraw.Draw(im)
bbox = draw.textbbox((0, 0), label, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
pad_x, pad_y = max(14, round(size * 0.28)), max(8, round(size * 0.16))
margin = max(18, round(w * 36 / 1792))
box = [w - margin - tw - pad_x * 2, h - margin - th - pad_y * 2, w - margin, h - margin]
draw.rounded_rectangle(box, radius=max(8, round(size * 0.2)), fill=(12, 10, 8))
draw.text((box[0] + pad_x - bbox[0], box[1] + pad_y - bbox[1]), label, font=font, fill=(232, 197, 71))
im.save(path, "JPEG", quality=88, optimize=True)
`;
  const run = spawnSync("python3", ["-c", py, path, label], { encoding: "utf8" });
  return run.status === 0;
}

/** If public/og.jpg changed, stamp the next number and save it on the card. */
export function syncOgPreview(root = process.cwd()) {
  const og = join(root, OG_REL);
  const sitePath = join(root, SITE_REL);
  if (!existsSync(og) || !existsSync(sitePath)) return { bumped: false, rev: "" };
  const site = readSite(sitePath);
  const hash = hashFile(og);
  const rev = String(site.imageRev ?? "").trim();
  if (site.stampedHash === hash) return { bumped: false, rev };
  if (!site.stampedHash) {
    site.stampedHash = hash;
    writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`);
    return { bumped: false, rev };
  }
  const next = String((Number(rev) || 0) + 1);
  if (!stamp(og, `v${next}`)) return { bumped: false, rev };
  site.imageRev = next;
  site.stampedHash = hashFile(og);
  writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`);
  return { bumped: true, rev: next };
}

export function ogPreviewPlugin() {
  let root = process.cwd();
  let writing = false;
  const run = () => {
    writing = true;
    try {
      return syncOgPreview(root);
    } finally {
      writing = false;
    }
  };
  return {
    name: "app-builder:og-preview",
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      run();
    },
    configureServer(server) {
      run();
      const og = join(root, OG_REL);
      server.watcher.add(og);
      server.watcher.on("change", (file) => {
        if (writing || !file.endsWith("og.jpg")) return;
        const result = run();
        if (result.bumped) server.ws.send({ type: "full-reload" });
      });
    },
  };
}
