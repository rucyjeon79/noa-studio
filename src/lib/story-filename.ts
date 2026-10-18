/** 곡 파일 이름. 한글은 그대로 두고, 경로로 쓰이면 안 되는 글자만 뺀다. */

export function storyFileStem(label: string) {
  const cleaned = label
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  let out = "";
  let bytes = 0;
  const encode = new TextEncoder();
  for (const ch of cleaned) {
    const n = encode.encode(ch).length;
    if (bytes + n > 180) break;
    out += ch;
    bytes += n;
  }
  return out.trim().replace(/[. ]+$/g, "");
}

/** 사연곡은 곡이름. 커버곡은 곡이름 - 원곡가수. 보컬 종류는 파일 이름에 넣지 않는다. */
const CAST_VOCALS = new Set(["여자솔로", "남자솔로", "남녀듀엣"]);

export function isCastVocal(value: string) {
  return CAST_VOCALS.has(value.trim());
}

/** 커버 파일 이름의 원곡 가수. 보컬 버튼 글자는 가수로 쓰지 않는다. */
export function coverArtistOf(sourceGenre = "", sourceVocal = "") {
  const genre = sourceGenre.trim();
  const vocal = sourceVocal.trim();
  if (genre && !isCastVocal(genre)) return genre;
  if (vocal && !isCastVocal(vocal)) return vocal;
  return "";
}

export function storyDiskName(genreId: string, songName: string, artist = "") {
  const song = songName.trim();
  if (!song) return "";
  const name = genreId === "cover-reborn" ? artist.trim() : "";
  const label = name && !isCastVocal(name) && name !== song ? `${song} - ${name}` : song;
  return storyFileStem(label);
}
