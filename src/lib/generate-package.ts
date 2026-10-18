import { createServerFn } from "@tanstack/react-start";
import { ACTS, GENRES, isEpNumber, padEp } from "./catalog";
import { asThumbCast } from "./characters";
import { normalizePref } from "./user-prefs";

function takePref(id: string, raw: unknown) {
  return normalizePref(id as never, raw);
}
function isGenreId(id: unknown): id is string {
  return GENRES.some((g) => g.id === id);
}
function isActId(n: unknown): n is number {
  return ACTS.some((a) => a.n === n);
}

const SINGLE_FIELDS: Record<string, string> = {
  summary: "summary",
  title: "confirmedTitle",
  lyrics: "lyricsBlock",
  suno: "sunoStyle",
  thumb: "geminiPrompt",
  "yt-title": "youtubeTitle",
  "yt-desc": "youtubeDescription",
  letter: "fanLetter",
};
const PLAYLIST_FIELDS: Record<string, string> = {
  summary: "summary",
  title: "confirmedTitle",
  tracks: "tracklist",
  suno: "sunoStyle",
  thumb: "geminiPrompt",
  "yt-title": "youtubeTitle",
  "yt-desc": "youtubeDescription",
  community: "communityPost",
};
const STORY_FIELDS: Record<string, string> = {
  thumb: "geminiPrompt",
  "yt-title": "youtubeTitle",
  "yt-desc": "youtubeDescription",
  letter: "fanLetter",
  suno: "sunoStyle",
};

export const renderThumb = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown>) => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 1600) : "";
    if (!prompt) throw new Error("invalid prompt");
    return {
      prompt,
      genreId: typeof input.genreId === "string" ? input.genreId : "",
      story: Boolean(input.story),
      thumbCast: asThumbCast(input.thumbCast),
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runRenderThumb } = await import("./generate-package.server");
    return runRenderThumb(data);
  });

export const generatePackage = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown>) => {
    const epN = padEp(String(input.epN ?? ""));
    if (!isEpNumber(epN)) throw new Error("invalid ep");
    if (!isGenreId(input.genreId)) throw new Error("invalid genre");
    return {
      epN,
      genreId: input.genreId,
      note: typeof input.note === "string" ? input.note.slice(0, 2e3) : "",
      originalLyrics: typeof input.originalLyrics === "string" ? input.originalLyrics.slice(0, 8e3) : "",
      originalTitle: typeof input.originalTitle === "string" ? input.originalTitle.slice(0, 120) : "",
      vocal: typeof input.vocal === "string" ? input.vocal.slice(0, 400) : "",
      prefs: takePref(input.genreId, input.prefs),
      thumbCast: asThumbCast(input.thumbCast),
      skipThumb: Boolean(input.skipThumb),
      fast: Boolean(input.fast),
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runGeneratePackage } = await import("./generate-package.server");
    return runGeneratePackage(data);
  });

export const generatePlaylist = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown>) => {
    if (!isActId(input.act)) throw new Error("invalid act");
    if (!isGenreId(input.genreId)) throw new Error("invalid genre");
    return {
      act: input.act,
      genreId: input.genreId,
      note: typeof input.note === "string" ? input.note.slice(0, 2e3) : "",
      extraTracks: Array.isArray(input.extraTracks) ? input.extraTracks : [],
      prefs: takePref(input.genreId, input.prefs),
      thumbCast: asThumbCast(input.thumbCast),
      skipThumb: Boolean(input.skipThumb),
      fast: Boolean(input.fast),
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runGeneratePlaylist } = await import("./generate-package.server");
    return runGeneratePlaylist(data);
  });

export const generateBlock = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown> & { kind?: string; blockId?: string }) => {
    if (!isGenreId(input.genreId)) throw new Error("invalid genre");
    if (input.kind === "single") {
      const epN = padEp(String(input.epN ?? ""));
      if (!isEpNumber(epN)) throw new Error("invalid ep");
      if (!input.single) throw new Error("missing package");
      if (!SINGLE_FIELDS[String(input.blockId)]) throw new Error("invalid block");
    } else {
      if (!input.act || !isActId(input.act)) throw new Error("invalid act");
      if (!input.playlist) throw new Error("missing playlist");
      if (!PLAYLIST_FIELDS[String(input.blockId)]) throw new Error("invalid block");
    }
    return {
      kind: input.kind,
      epN: padEp(String(input.epN ?? "")) || String(input.epN ?? ""),
      act: (input.act as number) ?? 1,
      genreId: input.genreId as string,
      blockId: input.blockId,
      note: typeof input.note === "string" ? input.note.slice(0, 2e3) : "",
      originalLyrics: typeof input.originalLyrics === "string" ? input.originalLyrics.slice(0, 8e3) : "",
      originalTitle: typeof input.originalTitle === "string" ? input.originalTitle.slice(0, 120) : "",
      vocal: typeof input.vocal === "string" ? input.vocal.slice(0, 400) : "",
      extraTracks: Array.isArray(input.extraTracks) ? input.extraTracks : [],
      prefs: takePref(String(input.genreId), input.prefs),
      thumbCast: asThumbCast(
        (input.single as { thumbCast?: unknown } | undefined)?.thumbCast ??
          (input.playlist as { thumbCast?: unknown } | undefined)?.thumbCast,
      ),
      skipThumb: Boolean(input.skipThumb),
      single: input.single,
      playlist: input.playlist,
      storyPlaylist: Boolean(input.storyPlaylist),
      theme: typeof input.theme === "string" ? input.theme.trim().slice(0, 120) : "",
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runGenerateBlock } = await import("./generate-package.server");
    return runGenerateBlock(data);
  });

export const generateStory = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown>) => {
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
    const lyrics = typeof input.lyrics === "string" ? input.lyrics.trim().slice(0, 8e3) : "";
    if (!title) throw new Error("invalid title");
    if (!lyrics) throw new Error("invalid lyrics");
    const genreId = input.genreId === "cover-reborn" ? "cover-reborn" : "your-story";
    const genre = typeof input.genre === "string" ? input.genre.trim().slice(0, 200) : "";
    if (genreId === "cover-reborn" && !genre) throw new Error("원곡 가수를 입력하세요.");
    return {
      title,
      lyrics,
      note: typeof input.note === "string" ? input.note.slice(0, 2e3) : "",
      genre,
      vocal: typeof input.vocal === "string" ? input.vocal.trim().slice(0, 400) : "",
      genreId,
      prefs: takePref(input.genreId === "cover-reborn" ? "cover-reborn" : "your-story", input.prefs),
      thumbCast: asThumbCast(input.thumbCast),
      skipThumb: Boolean(input.skipThumb),
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runGenerateStory } = await import("./generate-package.server");
    return runGenerateStory(data);
  });

export const generateStoryBlock = createServerFn({ method: "POST" })
  .validator((input: Record<string, unknown> & { blockId?: string }) => {
    if (!STORY_FIELDS[String(input.blockId)]) throw new Error("invalid block");
    if (!input.story) throw new Error("missing package");
    return {
      blockId: input.blockId,
      note: typeof input.note === "string" ? input.note.slice(0, 2e3) : "",
      title: typeof input.title === "string" ? input.title.slice(0, 120) : "",
      lyrics: typeof input.lyrics === "string" ? input.lyrics.slice(0, 4e3) : "",
      story: input.story,
      genre: typeof input.genre === "string" ? input.genre.trim().slice(0, 200) : "",
      genreId: input.genreId === "cover-reborn" ? "cover-reborn" : "your-story",
      prefs: takePref(input.genreId === "cover-reborn" ? "cover-reborn" : "your-story", input.prefs),
      thumbCast: asThumbCast((input.story as { thumbCast?: unknown } | undefined)?.thumbCast),
    };
  })
  .handler(async ({ data }): Promise<any> => {
    const { runGenerateStoryBlock } = await import("./generate-package.server");
    return runGenerateStoryBlock(data);
  });
