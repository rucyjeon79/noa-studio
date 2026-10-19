/** Pure mapping between Grok page-save records and NOA Bridge documents.
 * No network calls, no production save behavior changes.
 */
import type { BridgeKind } from "./client.ts";

export type GrokStudioSave = {
  kind: "single" | "playlist";
  genreId: string;
  ep?: string;
  act?: number;
  title?: string;
  body: Record<string, unknown>;
  rewrite?: boolean;
};

export type BridgeMappedDocument = {
  key: string;
  kind: BridgeKind;
  payload: Record<string, unknown>;
};

function segment(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(clean)) {
    throw new Error("Invalid bridge key segment");
  }
  return clean;
}

export function mapGrokStudioPage(page: GrokStudioSave): BridgeMappedDocument {
  const genre = segment(page.genreId);
  if (page.kind === "single") {
    const ep = segment(page.ep ?? "");
    return {
      key: `single:${genre}:${ep}`,
      kind: "single",
      payload: {
        genreId: page.genreId,
        ep: page.ep,
        title: page.title ?? "",
        body: structuredClone(page.body),
        rewrite: page.rewrite === true,
      },
    };
  }
  if (!Number.isSafeInteger(page.act) || (page.act ?? 0) < 1) {
    throw new Error("Invalid ACT number");
  }
  return {
    key: `playlist:${genre}:act-${page.act}`,
    kind: "playlist",
    payload: {
      genreId: page.genreId,
      act: page.act,
      title: page.title ?? "",
      body: structuredClone(page.body),
      rewrite: page.rewrite === true,
    },
  };
}

export type GrokStorySave = {
  title: string;
  genreId: "your-story" | "cover-reborn";
  body: Record<string, unknown>;
};

/** A deterministic story key cannot use the title: titles are mutable and non-unique.
 * A stable opaque story ID must come from the existing Grok record.
 */
export function mapGrokStory(story: GrokStorySave, stableId: string): BridgeMappedDocument {
  const id = segment(stableId);
  if (story.genreId !== "your-story" && story.genreId !== "cover-reborn") {
    throw new Error("Invalid story genre");
  }
  if (!story.title.trim()) throw new Error("Story title is required");
  return {
    key: `story:${story.genreId}:${id}`,
    kind: "story",
    payload: {
      title: story.title,
      genreId: story.genreId,
      body: structuredClone(story.body),
    },
  };
}

export function mapGrokMeta(meta: Record<string, unknown>): BridgeMappedDocument {
  return { key: "meta:studio", kind: "meta", payload: structuredClone(meta) };
}
