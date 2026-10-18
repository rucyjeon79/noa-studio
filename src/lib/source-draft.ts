import { padEp } from "./catalog";

export type SourceDraft = {
  ep: string;
  title: string;
  genre: string;
  vocal: string;
  lyrics: string;
};

const EP_LINE = /(?:^|\b)(?:ep|이피)\s*[.\-:]?\s*(\d{1,3})\b/i;

type Field = "ep" | "title" | "genre" | "vocal" | "lyrics";

function fieldOf(line: string): { field: Field; rest: string } | null {
  const m = line.match(
    /^(ep번호|ep|이피|제목|title|장르|genre|보컬정보|보컬|vocal|가사|lyrics)\s*[:：]?\s*(.*)$/i,
  );
  if (!m) return null;
  const key = m[1].toLowerCase();
  const rest = m[2].trim();
  if (key === "가사" || key === "lyrics") return { field: "lyrics", rest };
  if (key === "제목" || key === "title") return { field: "title", rest };
  if (key === "장르" || key === "genre") return { field: "genre", rest };
  if (key === "보컬정보" || key === "보컬" || key === "vocal") return { field: "vocal", rest };
  return { field: "ep", rest };
}

export function parseSource(raw: string): SourceDraft {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const empty: SourceDraft = { ep: "", title: "", genre: "", vocal: "", lyrics: "" };
  if (!text) return empty;

  const lines = text.split("\n");
  const out: SourceDraft = { ...empty };
  const vocalLines: string[] = [];
  let i = 0;
  let mode: Field | "" = "";

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const labeled = line ? fieldOf(line) : null;

    if (labeled?.field === "lyrics") {
      const rest = [labeled.rest, ...lines.slice(i + 1)].filter((x, idx) => x.length || idx > 0);
      out.lyrics = rest.join("\n").replace(/^\n+/, "").trim();
      break;
    }

    if (labeled) {
      mode = labeled.field;
      if (labeled.field === "ep" && /\d/.test(labeled.rest)) out.ep = padEp(labeled.rest);
      else if (labeled.field === "title" && labeled.rest) out.title = labeled.rest;
      else if (labeled.field === "genre" && labeled.rest) out.genre = labeled.rest;
      else if (labeled.field === "vocal" && labeled.rest) vocalLines.push(labeled.rest);
      i += 1;
      continue;
    }

    if (!line) {
      i += 1;
      continue;
    }

    const epHit = line.match(EP_LINE);
    if (epHit && !out.ep) {
      out.ep = padEp(epHit[1]);
      const rest = line.replace(EP_LINE, "").replace(/^[\s|/\-–—:：]+/, "").trim();
      if (rest && !out.title) out.title = rest;
      mode = "";
      i += 1;
      continue;
    }

    if (mode === "vocal") {
      vocalLines.push(rawLine.trimEnd());
      i += 1;
      continue;
    }
    if (mode === "title" && !out.title) {
      out.title = line;
      mode = "";
      i += 1;
      continue;
    }
    if (mode === "genre" && !out.genre) {
      out.genre = line;
      mode = "";
      i += 1;
      continue;
    }
    if (mode === "ep" && !out.ep && /\d/.test(line)) {
      out.ep = padEp(line);
      mode = "";
      i += 1;
      continue;
    }

    if (line.startsWith("[")) {
      out.lyrics = lines.slice(i).join("\n").trim();
      break;
    }
    if (!out.title) {
      out.title = line;
      i += 1;
      continue;
    }
    out.lyrics = lines.slice(i).join("\n").trim();
    break;
  }

  if (vocalLines.length) out.vocal = vocalLines.join("\n").trim();
  return out;
}

export function formatSource(d: Partial<SourceDraft>): string {
  const lines: string[] = [];
  if (d.ep) lines.push(`EP.${padEp(d.ep) || d.ep}`);
  if (d.title) lines.push(`제목: ${d.title}`);
  if (d.genre) lines.push(`장르: ${d.genre}`);
  if (d.vocal) {
    lines.push("보컬:");
    lines.push(d.vocal);
  }
  if (d.lyrics) {
    lines.push("가사:");
    lines.push(d.lyrics);
  }
  return lines.join("\n");
}
