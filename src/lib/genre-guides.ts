import type { GenreId } from "./catalog";

const GUIDES = import.meta.glob("../data/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const SUNO = import.meta.glob("../data/suno/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function fromGlob(map: Record<string, string>, file: string) {
  const needle = `/${file}`;
  for (const [path, text] of Object.entries(map)) {
    if (path.replace(/\\/g, "/").endsWith(needle)) return String(text ?? "").trim();
  }
  return "";
}

export function readGenreGuide(genreId: GenreId) {
  return fromGlob(GUIDES, `${genreId}.md`);
}

export function readSunoBase(genreId: GenreId) {
  return fromGlob(SUNO, `${genreId}.txt`);
}
