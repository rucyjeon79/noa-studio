import { createServerFn } from "@tanstack/react-start";

export type SongFileTarget = {
  kind: "song" | "act" | "story" | "cover" | "playlist";
  genreId: string;
  ep?: string;
  act?: number;
  title: string;
  artist?: string;
};

function targetOf(input: SongFileTarget): SongFileTarget {
  const kind: SongFileTarget["kind"] = input.kind === "act" || input.kind === "story" || input.kind === "cover" || input.kind === "playlist" ? input.kind : "song";
  return {
    kind,
    genreId: String(input.genreId || ""),
    ep: String(input.ep || ""),
    act: Number(input.act) || 0,
    title: String(input.title || "").trim(),
    artist: String(input.artist || "").trim(),
  };
}

export const shownFileRel = createServerFn({ method: "POST" })
  .validator((input: SongFileTarget) => targetOf(input))
  .handler(async ({ data }) => {
    const store = await import("./encyclopedia.server");
    return { path: store.shownFileRel(data.kind, data.genreId, data.ep, data.act, data.title, data.artist) };
  });

export const listSongFolder = createServerFn({ method: "POST" })
  .validator((input: { dir?: string }) => ({ dir: String(input?.dir || "") }))
  .handler(async ({ data }) => {
    const store = await import("./encyclopedia.server");
    return store.listSongFolder(data.dir);
  });

export const moveSongFile = createServerFn({ method: "POST" })
  .validator((input: SongFileTarget & { dest?: string }) => ({ ...targetOf(input), dest: String(input.dest || "") }))
  .handler(async ({ data }) => {
    const store = await import("./encyclopedia.server");
    return store.moveShownSong(data.kind, data.genreId, data.ep, data.act, data.title, data.artist, data.dest);
  });

export const deleteSongFile = createServerFn({ method: "POST" })
  .validator((input: SongFileTarget & { password?: string }) => ({ ...targetOf(input), password: String(input.password || "") }))
  .handler(async ({ data }) => {
    const store = await import("./encyclopedia.server");
    return store.deleteShownSong(data.kind, data.genreId, data.ep, data.act, data.title, data.artist, data.password);
  });
