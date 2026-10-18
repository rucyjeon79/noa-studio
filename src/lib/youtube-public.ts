import { createServerFn } from "@tanstack/react-start";

const VIDEO_ID = /^[\w-]{11}$/;

async function oembedPublic(id: string) {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": "NOA-STUDIO" } });
  return res.ok;
}

export const youtubeIsPublic = createServerFn({ method: "POST" })
  .validator((input: { id?: string }) => {
    const id = String(input?.id ?? "");
    if (!VIDEO_ID.test(id)) throw new Error("영상 주소가 아닙니다.");
    return { id };
  })
  .handler(async ({ data }) => oembedPublic(data.id));

export const youtubeArePublic = createServerFn({ method: "POST" })
  .validator((input: { ids?: string[] }) => {
    const ids = [...new Set((input?.ids ?? []).map((id) => String(id)))].filter((id) => VIDEO_ID.test(id)).slice(0, 80);
    return { ids };
  })
  .handler(async ({ data }) => {
    const out: Record<string, boolean> = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < data.ids.length) {
        const id = data.ids[cursor];
        cursor += 1;
        try {
          out[id] = await oembedPublic(id);
        } catch {
          out[id] = false;
        }
      }
    };
    const width = Math.min(16, data.ids.length);
    if (width > 0) await Promise.all(Array.from({ length: width }, () => worker()));
    return out;
  });
