import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Readable } from "node:stream";

const ID = /^[a-zA-Z0-9_-]{11}$/;
const CACHE = "/tmp/yt-audio-cache";

type Source = { url: string; type: string; ua: string; video: boolean; at: number };
const sources = new Map<string, Source>();

type Raw = { url?: string; mimeType?: string; bitrate?: number; itag?: number };

type ClientTry = {
  name: string;
  version: string;
  ua: string;
  client: Record<string, string | number>;
};

const CLIENTS: ClientTry[] = [
  {
    name: "3",
    version: "21.26.364",
    ua: "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip",
    client: {
      clientName: "ANDROID",
      clientVersion: "21.26.364",
      androidSdkVersion: 30,
      osName: "Android",
      osVersion: "11",
      hl: "en",
      gl: "US",
    },
  },
  {
    name: "5",
    version: "21.26.4",
    ua: "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    client: {
      clientName: "IOS",
      clientVersion: "21.26.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      hl: "en",
    },
  },
];

function pickMedia(formats: Raw[]) {
  const withUrl = formats.filter((item) => item.url);
  const audio = withUrl.filter((item) => String(item.mimeType || "").startsWith("audio/"));
  audio.sort((a, b) => {
    const score = (item: Raw) => (String(item.mimeType).includes("mp4a.40.2") ? 3 : String(item.mimeType).includes("mp4") ? 2 : 1);
    return score(b) - score(a) || (b.bitrate || 0) - (a.bitrate || 0);
  });
  if (audio[0]?.url) {
    const mime = String(audio[0].mimeType || "");
    return { url: audio[0].url, type: mime.includes("webm") ? "audio/webm" : "audio/mp4", video: false };
  }
  const progressive = withUrl.find((item) => item.itag === 18) || withUrl.find((item) => String(item.mimeType || "").startsWith("video/mp4"));
  if (!progressive?.url) return null;
  return { url: progressive.url, type: "video/mp4", video: true };
}

async function playerSource(videoId: string): Promise<Source | null> {
  const hit = sources.get(videoId);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit;
  for (const row of CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": row.ua,
          "X-YouTube-Client-Name": row.name,
          "X-YouTube-Client-Version": row.version,
        },
        body: JSON.stringify({
          context: { client: row.client },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        playabilityStatus?: { status?: string };
        streamingData?: { adaptiveFormats?: Raw[]; formats?: Raw[] };
      };
      if (json.playabilityStatus?.status !== "OK") continue;
      const picked = pickMedia([...(json.streamingData?.formats || []), ...(json.streamingData?.adaptiveFormats || [])]);
      if (!picked) continue;
      const source = { ...picked, ua: row.ua, at: Date.now() };
      sources.set(videoId, source);
      return source;
    } catch {
      /* the next client can still have a file */
    }
  }
  return null;
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-500);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `ffmpeg ${code}`));
    });
  });
}

async function audioOnly(videoId: string, bytes: Uint8Array) {
  mkdirSync(CACHE, { recursive: true });
  const ready = `${CACHE}/${videoId}.m4a`;
  if (existsSync(ready) && statSync(ready).size > 2048) return ready;
  const src = `${CACHE}/${videoId}.src.mp4`;
  const part = `${ready}.part`;
  await writeFile(src, bytes);
  await runFfmpeg(["-y", "-i", src, "-vn", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", part]);
  renameSync(part, ready);
  return ready;
}

function fileResponse(request: Request, path: string) {
  const size = statSync(path).size;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "Content-Type": "audio/mp4",
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

export async function ytAudioResponse(request: Request) {
  const id = new URL(request.url).searchParams.get("v") || "";
  if (!ID.test(id)) return new Response(null, { status: 400 });
  const source = await playerSource(id);
  if (!source) return new Response(null, { status: 404 });
  if (source.video) {
    try {
      const ready = `${CACHE}/${id}.m4a`;
      if (!(existsSync(ready) && statSync(ready).size > 2048)) {
        const upstream = await fetch(source.url, {
          headers: { "User-Agent": source.ua },
          signal: AbortSignal.timeout(25000),
        });
        if (!upstream.ok) {
          sources.delete(id);
          return new Response(null, { status: upstream.status || 502 });
        }
        const bytes = new Uint8Array(await upstream.arrayBuffer());
        await audioOnly(id, bytes);
      }
      return fileResponse(request, `${CACHE}/${id}.m4a`);
    } catch {
      sources.delete(id);
      return new Response(null, { status: 502 });
    }
  }
  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(source.url, {
      headers: {
        "User-Agent": source.ua,
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    sources.delete(id);
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    sources.delete(id);
    return new Response(null, { status: upstream.status || 502 });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "Content-Type": source.type,
  });
  const length = upstream.headers.get("content-length");
  const span = upstream.headers.get("content-range");
  if (length) headers.set("Content-Length", length);
  if (span) headers.set("Content-Range", span);
  return new Response(upstream.body, { status: upstream.status, headers });
}
