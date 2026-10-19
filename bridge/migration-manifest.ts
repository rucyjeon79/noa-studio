import type { BridgeMappedDocument } from "./grok-mapping.ts";
import { mapGrokStudioPage, mapGrokStory } from "./grok-mapping.ts";

type Row = { genreId: string; ep?: string; act?: number; title?: string; pkg: unknown };
type Story = { title: string; pkg: unknown };
export type MigrationSnapshot = {
  packages: Record<string, Row>;
  playlists: Record<string, Row>;
  stories: Record<string, Story>;
};
export type MigrationManifest = {
  documents: BridgeMappedDocument[];
  skipped: Array<{ slot: string; reason: string }>;
};
const record = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);

/** Pure read-only transformation. No network, storage, or database writes. */
export function makeMigrationManifest(snapshot: MigrationSnapshot): MigrationManifest {
  const documents: BridgeMappedDocument[] = [];
  const skipped: MigrationManifest["skipped"] = [];
  const keys = new Set<string>();
  const add = (slot: string, doc: BridgeMappedDocument) => {
    if (keys.has(doc.key)) {
      skipped.push({ slot, reason: "duplicate_key" });
      return;
    }
    keys.add(doc.key);
    documents.push(doc);
  };
  for (const [slot, row] of Object.entries(snapshot.packages)) {
    try {
      if (!record(row.pkg)) throw Error("invalid_body");
      add(slot, mapGrokStudioPage({
        kind: "single", genreId: row.genreId, ep: row.ep,
        title: row.title, body: row.pkg,
      }));
    } catch { skipped.push({ slot, reason: "invalid_single" }); }
  }
  for (const [slot, row] of Object.entries(snapshot.playlists)) {
    try {
      if (!record(row.pkg)) throw Error("invalid_body");
      add(slot, mapGrokStudioPage({
        kind: "playlist", genreId: row.genreId, act: row.act,
        title: row.title, body: row.pkg,
      }));
    } catch { skipped.push({ slot, reason: "invalid_playlist" }); }
  }
  for (const [slot, row] of Object.entries(snapshot.stories)) {
    try {
      if (!record(row.pkg) || typeof row.pkg.songId !== "string") throw Error("missing_id");
      const genreId = row.pkg.genreId;
      if (genreId !== "your-story" && genreId !== "cover-reborn") throw Error("missing_genre");
      add(slot, mapGrokStory({ title: row.title, genreId, body: row.pkg }, row.pkg.songId));
    } catch { skipped.push({ slot, reason: "missing_or_invalid_story_identity" }); }
  }
  documents.sort((a, b) => a.key.localeCompare(b.key, "en"));
  return { documents, skipped };
}
