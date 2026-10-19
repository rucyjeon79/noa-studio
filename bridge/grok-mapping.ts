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

export function mapGrokMeta(meta: Record<string, unknown>): BridgeMappedDocument {
  return { key: "meta:studio", kind: "meta", payload: structuredClone(meta) };
}
