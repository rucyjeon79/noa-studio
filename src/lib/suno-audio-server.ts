import { createDecipheriv, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readSync, renameSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Readable } from "node:stream";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CACHE_DIR = "/tmp/suno-cache";

type Resolved = { id: string; title: string; image: string; audio: string; kind: "file" | "url" | "local"; at: number };
const cache = new Map<string, Resolved>();
const jobs = new Map<string, Promise<string>>();

function cleanTitle(value: string) {
  return value.replace(/\s*[|\-–—]\s*Suno\s*$/i, "").trim();
}

function usefulTitle(value: string) {
  const title = cleanTitle(value)
    .replace(/&/g, "&")
    .replace(/&#39;|'/g, "'")
    .replace(/"/g, "\"")
    .replace(/</g, "<")
    .replace(/>/g, ">");
  if (!title || /^(suno|song|untitled|home|listen)$/i.test(title)) return "";
  return title;
}

function songIdFrom(value: string) {
  return value.match(/\/song\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] || "";
}

function ownTitle(oembed: string, html: string) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] || "";
  const doc = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  for (const candidate of [oembed, og, doc]) {
    const title = usefulTitle(candidate);
    if (title) return title;
  }
  return "";
}

function playableHead(buf: Uint8Array) {
  if (buf.length >= 8) {
    const box = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
    if (box === "ftyp") return true;
  }
  if (buf.length >= 3 && String.fromCharCode(buf[0], buf[1], buf[2]) === "ID3") return true;
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

async function sniff(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-15" } });
    const buf = new Uint8Array(await res.arrayBuffer());
    return (res.ok || res.status === 206) && playableHead(buf);
  } catch {
    return false;
  }
}

function coverImage(raw: string) {
  const image = raw.trim().replace(/\\+$/g, "").replace(/&/g, "&");
  if (!/^https:\/\//i.test(image) || /ytimg|youtube\.com|youtu\.be|ggpht/i.test(image)) return "";
  const bare = image.split("#")[0].split("?")[0];
  const hostOk = /(?:^|\.)suno\.ai|(?:^|\.)suno\.com|(?:^|\.)suno\.fm|cloudfront\.net/i.test(bare);
  const extOk = /\.(?:jpe?g|png|webp|gif)$/i.test(bare);
  if (!extOk && !hostOk) return "";
  return image;
}

function clipBody(flat: string, id: string) {
  const mark = new RegExp(`"id"\\s*:\\s*"${id}"`, "i").exec(flat);
  if (!mark) return "";
  const slice = flat.slice(mark.index, mark.index + 5000);
  const next = slice.slice(40).search(/"id"\s*:\s*"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/i);
  return next > 0 ? slice.slice(0, next + 40) : slice;
}

async function songMedia(id: string) {
  let html = "";
  try {
    const res = await fetch(`https://suno.com/song/${id}`, { headers: { "User-Agent": UA } });
    html = await res.text();
  } catch {
    html = "";
  }
  const flat = html.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  const body = clipBody(flat, id);
  const pool = `${body}\n${flat}`;
  const urls = pool.match(/https:\/\/[^"'\s<>]+/g) || [];
  const own = urls.filter((url) => url.toLowerCase().includes(id.toLowerCase()));
  const pick = (ext: string) => own.find((url) => new RegExp(`\\.${ext}(?:\\?|$)`, "i").test(url)) || "";
  const near = body.match(/https:\/\/[^"'\s]+\.m4a/i)?.[0] || "";
  const mp3 = pick("mp3") || `https://cdn1.suno.ai/${id}.mp3`;
  const m4a = pick("m4a") || near;
  const mp4 = pick("mp4") || `https://cdn1.suno.ai/${id}.mp4`;
  const og = flat.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || "";
  const owned = coverImage(pick("jpeg") || pick("jpg") || pick("png") || pick("webp") || "");
  const loose = urls.map((url) => coverImage(url)).find(Boolean) || "";
  const image = owned || coverImage(og) || loose;
  return { mp3, m4a, mp4, image };
}

async function findAudio(id: string) {
  const media = await songMedia(id);
  const image = media.image;
  if (await sniff(media.mp3)) return { audio: media.mp3, kind: "url" as const, image };
  if (media.m4a && await sniff(media.m4a)) return { audio: media.m4a, kind: "url" as const, image };
  if (media.m4a) {
    try {
      const path = await unlockM4a(id, media.m4a);
      if (path) return { audio: path, kind: "local" as const, image };
    } catch {
      /* a public file further down can still play */
    }
  }
  if (await sniff(media.mp4)) return { audio: media.mp4, kind: "file" as const, image };
  return { audio: "", kind: "url" as const, image };
}

function mangoUnwrap(wrapped: string, clipId: string, userKey: Buffer) {
  const packed = Buffer.from(wrapped, "base64");
  if (packed.length < 29) throw new Error("wrap");
  const dec = createDecipheriv("aes-256-gcm", userKey, packed.subarray(0, 12));
  dec.setAuthTag(packed.subarray(packed.length - 16));
  dec.setAAD(Buffer.from(clipId));
  return Buffer.concat([dec.update(packed.subarray(12, packed.length - 16)), dec.final()]);
}

async function fetchRights(id: string) {
  const hosts = ["https://studio-api-prod.suno.com", "https://studio-api.prod.suno.com"];
  let last = "rights";
  for (const host of hosts) {
    try {
      const rights = await fetch(`${host}/api/mango/rights`, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://suno.com",
          Referer: `https://suno.com/song/${id}`,
        },
        body: JSON.stringify({ content_params: { content_id: id, content_type: "clip" } }),
      });
      if (!rights.ok) {
        last = `rights ${rights.status}`;
        continue;
      }
      const data = await rights.json() as { key?: string; iv?: string; glt?: string };
      if (data.key && data.iv) return { key: data.key, iv: data.iv, glt: data.glt || "" };
      last = "rights";
    } catch {
      last = "rights";
    }
  }
  throw new Error(last);
}

async function unlockM4a(id: string, url: string) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = safeId(id);
  const ready = `${CACHE_DIR}/${key}.song.m4a`;
  if (existsSync(ready) && statSync(ready).size > 2048 && playableHead(fileHead(ready))) return ready;
  const jobKey = `m4a:${key}`;
  const pending = jobs.get(jobKey);
  if (pending) return pending;
  const job = (async () => {
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://suno.com/" } });
    if (!res.ok) throw new Error(`m4a ${res.status}`);
    const enc = Buffer.from(await res.arrayBuffer());
    let out = enc;
    if (!playableHead(enc.subarray(0, 16))) {
      const data = await fetchRights(id);
      let aesKey: Buffer;
      let counter: Buffer;
      if (data.glt) {
        const userKey = createHash("sha256").update(data.glt).digest();
        aesKey = mangoUnwrap(data.key, id, userKey);
        counter = mangoUnwrap(data.iv, id, userKey);
      } else {
        aesKey = Buffer.from(data.key, "base64");
        counter = Buffer.from(data.iv, "base64");
      }
      if ((aesKey.length !== 16 && aesKey.length !== 32) || counter.length !== 16) throw new Error("key");
      const algo = aesKey.length === 16 ? "aes-128-ctr" : "aes-256-ctr";
      const dec = createDecipheriv(algo, aesKey, counter);
      out = Buffer.concat([dec.update(enc), dec.final()]);
    }
    if (!playableHead(out.subarray(0, 16))) throw new Error("unlock");
    const part = `${ready}.part`;
    await writeFile(part, out);
    renameSync(part, ready);
    return ready;
  })();
  jobs.set(jobKey, job);
  try {
    return await job;
  } finally {
    jobs.delete(jobKey);
  }
}

function safeId(id: string) {
  return id.toLowerCase().replace(/[^0-9a-f-]/g, "");
}

function fileHead(path: string) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    return new Uint8Array(buf);
  } finally {
    closeSync(fd);
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `ffmpeg ${code}`));
    });
  });
}

async function downloadTo(url: string, dest: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!playableHead(buf.subarray(0, 16))) throw new Error("not media");
  await writeFile(dest, buf);
}

async function playableFile(id: string, mp4: string) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = safeId(id);
  const ready = `${CACHE_DIR}/${key}.song.mp4`;
  if (existsSync(ready) && statSync(ready).size > 2048 && playableHead(fileHead(ready))) return ready;
  const pending = jobs.get(key);
  if (pending) return pending;
  const job = (async () => {
    const src = `${CACHE_DIR}/${key}.src.mp4`;
    if (!existsSync(src) || statSync(src).size < 2048) {
      const tmp = `${src}.part`;
      await downloadTo(mp4, tmp);
      renameSync(tmp, src);
    }
    const part = `${CACHE_DIR}/${key}.part.mp4`;
    try {
      await runFfmpeg(["-y", "-i", src, "-vn", "-c:a", "copy", "-f", "mp4", "-movflags", "+faststart", part]);
    } catch {
      await runFfmpeg(["-y", "-i", src, "-vn", "-c:a", "aac", "-b:a", "160k", "-f", "mp4", "-movflags", "+faststart", part]);
    }
    if (!playableHead(fileHead(part))) throw new Error("transcode not playable");
    renameSync(part, ready);
    return ready;
  })();
  jobs.set(key, job);
  try {
    return await job;
  } finally {
    jobs.delete(key);
  }
}

async function wavFile(id: string, source: string, kind: "file" | "url" | "local") {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = `${safeId(id)}:wav`;
  const ready = `${CACHE_DIR}/${safeId(id)}.song.wav`;
  if (existsSync(ready) && statSync(ready).size > 2048) return ready;
  const pending = jobs.get(key);
  if (pending) return pending;
  const job = (async () => {
    let input = source;
    if (kind === "file") input = await playableFile(id, source);
    else if (kind !== "local") {
      const src = `${CACHE_DIR}/${safeId(id)}.src.media`;
      if (!existsSync(src) || statSync(src).size < 2048) {
        const tmp = `${src}.part`;
        await downloadTo(source, tmp);
        renameSync(tmp, src);
      }
      input = src;
    }
    const part = `${CACHE_DIR}/${safeId(id)}.part.wav`;
    await runFfmpeg(["-y", "-i", input, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", "-f", "wav", part]);
    if (!existsSync(part) || statSync(part).size < 2048) throw new Error("wav empty");
    renameSync(part, ready);
    return ready;
  })();
  jobs.set(key, job);
  try {
    return await job;
  } finally {
    jobs.delete(key);
  }
}

function fileResponse(request: Request, path: string, type = "audio/mp4") {
  const size = statSync(path).size;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Type": type,
  });
  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? Number(match[1]) : 0;
    let end = match && match[2] ? Number(match[2]) : size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers });
}

async function resolveSuno(raw: string): Promise<Resolved | null> {
  const key = raw.trim();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit?.audio && Date.now() - hit.at < 10 * 60 * 1000) return hit;
  let page = key;
  if (!/^https?:/i.test(page)) page = `https://${page}`;
  let id = songIdFrom(page);
  if (!id) {
    try {
      const res = await fetch(page, { redirect: "follow", headers: { "User-Agent": UA } });
      id = songIdFrom(res.url);
      if (!id) {
        const html = await res.text();
        const pointed = html.match(/property="og:url"\s+content="([^"]+)"/i)?.[1]
          || html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1]
          || "";
        id = songIdFrom(pointed);
      }
    } catch {
      id = "";
    }
  }
  if (!id) return null;
  const songPage = `https://suno.com/song/${id}`;
  let pageHtml = "";
  try {
    const res = await fetch(songPage, { headers: { "User-Agent": UA } });
    pageHtml = await res.text();
  } catch {
    pageHtml = "";
  }
  let oembed = "";
  let oembedImage = "";
  try {
    const oe = await fetch(`https://studio-api-prod.suno.com/api/oembed?url=${encodeURIComponent(songPage)}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (oe.ok) {
      const json = await oe.json() as { title?: string; thumbnail_url?: string };
      oembed = String(json.title || "");
      oembedImage = coverImage(String(json.thumbnail_url || ""));
    }
  } catch {
    oembed = "";
  }
  const title = ownTitle(oembed, pageHtml);
  const found = await findAudio(id);
  const image = found.image || oembedImage;
  if (!found.audio) {
    if (!image && !title) return null;
    return { id, title, image, audio: "", kind: "url", at: Date.now() };
  }
  const resolved: Resolved = { id, title, image, audio: found.audio, kind: found.kind, at: Date.now() };
  cache.set(key, resolved);
  cache.set(id, resolved);
  return resolved;
}

function audioType(url: string, upstream: string) {
  if (upstream && !/octet-stream|text\/xml|text\/html/i.test(upstream)) return upstream;
  if (/\.m4a($|\?)/i.test(url)) return "audio/mp4";
  if (/\.mp3($|\?)/i.test(url)) return "audio/mpeg";
  return "audio/mpeg";
}

export async function sunoAudioResponse(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("u") || "";
  const song = await resolveSuno(raw);
  if (!song) return new Response(null, { status: 404 });
  if (url.searchParams.get("meta") === "1") {
    return Response.json({ id: song.id, title: song.title, image: song.image });
  }
  if (!song.audio) return new Response(null, { status: 404 });
  if (url.searchParams.get("e")) {
    try {
      const path = await wavFile(song.id, song.audio, song.kind);
      return fileResponse(request, path, "audio/wav");
    } catch {
      /* keep the original stream if the wav step fails */
    }
  }
  if (song.kind === "local") {
    try {
      return fileResponse(request, song.audio);
    } catch {
      cache.delete(raw.trim());
      return new Response(null, { status: 404 });
    }
  }
  if (song.kind === "file") {
    try {
      const path = await playableFile(song.id, song.audio);
      return fileResponse(request, path);
    } catch {
      /* the phone can still play the original file */
    }
  }
  const range = request.headers.get("range");
  const upstream = await fetch(song.audio, {
    headers: {
      "User-Agent": UA,
      ...(range ? { Range: range } : {}),
    },
  });
  if (!upstream.ok && upstream.status !== 206) {
    cache.delete(raw.trim());
    return new Response(null, { status: upstream.status || 502 });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "Content-Type": audioType(song.audio, upstream.headers.get("content-type") || ""),
  });
  const length = upstream.headers.get("content-length");
  const span = upstream.headers.get("content-range");
  if (length) headers.set("Content-Length", length);
  if (span) headers.set("Content-Range", span);
  return new Response(upstream.body, { status: upstream.status, headers });
}
