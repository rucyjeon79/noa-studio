import { createFileRoute } from "@tanstack/react-router";

function allowed(url: URL) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "i.ytimg.com" || host.endsWith(".ytimg.com") || host.endsWith(".ggpht.com") || host.includes("youtube") || host === "youtu.be") return false;
  return host.endsWith(".suno.ai") || host.endsWith(".suno.com") || host.endsWith(".suno.fm") || host.endsWith(".cloudfront.net");
}

function imageType(bytes: Uint8Array, header: string) {
  const named = header.split(";")[0].trim().toLowerCase();
  if (named.startsWith("image/")) return named;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "";
}

export const Route = createFileRoute("/api/card-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("u") || "";
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("bad", { status: 400 });
        }
        if (!allowed(target)) return new Response("no", { status: 400 });
        const res = await fetch(target, {
          headers: {
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
            accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            referer: "https://suno.com/",
          },
        });
        if (!res.ok) return new Response("miss", { status: 404 });
        const typeHeader = res.headers.get("content-type") || "";
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = imageType(bytes, typeHeader);
        if (!type) return new Response("no", { status: 415 });
        if (bytes.byteLength > 4_000_000) return new Response("big", { status: 413 });
        return new Response(bytes, {
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
