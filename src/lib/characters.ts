import type { GenreId } from "./catalog";

export type CastId = "noa" | "noel";

export interface CastMember {
  id: CastId;
  nameKo: string;
  nameEn: string;
  role: string;
  face: string;
  sheet: string;
  lock: string;
}

export const CAST: Record<CastId, CastMember> = {
  noa: {
    id: "noa",
    nameKo: "노아",
    nameEn: "NOA",
    role: "여주",
    face: "/characters/noa-face.jpg",
    sheet: "/characters/noa-sheet.png",
    lock: "Korean woman NOA, 165cm, long legs, long straight black hair, oval face, warm ivory skin, full lips, defined brows, dark brown eyes. Same face every time.",
  },
  noel: {
    id: "noel",
    nameKo: "노엘",
    nameEn: "NOEL",
    role: "남주",
    face: "/characters/noel-face.jpg",
    sheet: "/characters/noel-sheet.png",
    lock: "Korean man NOEL, 180cm, short black hair, strong brows, defined jaw, warm skin. Same face every time.",
  },
};

export const CAST_ORDER: CastId[] = ["noa", "noel"];

export const STORY_BRAND = {
  series: "당신의 이야기, 우리의 음악",
  line1: "당신의 이야기, 우리의 음악 🎧",
  line2: "오늘의 사연이 음악이 됩니다",
  hashtags: "#AIArtistNoa #당신의이야기우리의음악 #별무리",
  fan: "별무리",
};

export type ThumbCast = "female" | "male" | "duet";

export const THUMB_CASTS: { id: ThumbCast; label: string }[] = [
  { id: "female", label: "여자솔로" },
  { id: "male", label: "남자솔로" },
  { id: "duet", label: "남녀듀엣" },
];

export function castFromLabel(value: string): ThumbCast {
  const clean = value.replace(/\s+/g, "");
  return THUMB_CASTS.find((item) => item.id === value || item.label === clean)?.id ?? "female";
}

export function labelForCast(id: ThumbCast): string {
  return THUMB_CASTS.find((item) => item.id === id)?.label ?? "여자솔로";
}

export function asThumbCast(value: unknown): ThumbCast {
  return value === "male" || value === "duet" || value === "female" ? value : "female";
}

export function defaultThumbCast(id: GenreId): ThumbCast {
  if (id === "echoes-of-joseon" || id === "fantasy-ambient-edm") return "duet";
  return "female";
}

export function idsForThumbCast(mode: ThumbCast): CastId[] {
  if (mode === "male") return ["noel"];
  if (mode === "duet") return ["noa", "noel"];
  return ["noa"];
}

export function thumbCastFromVocal(vocal: string): ThumbCast {
  const text = vocal.trim();
  if (!text) return "female";
  const hasF = /여자|female|여주|여솔/i.test(text);
  const hasM = /남자|male|남주|남솔/i.test(text);
  if (/듀엣|duet|혼성/i.test(text) || (hasF && hasM)) return "duet";
  if (hasM) return "male";
  if (hasF) return "female";
  return "female";
}

export function identityPrompt(ids: CastId[]): string {
  if (!ids.length) {
    return "Do not copy any character-sheet grid or labels. Photoreal cinematic 16:9.";
  }
  const lines = [
    "Identity lock is mandatory. Match the attached reference face(s) exactly.",
    "Do not reproduce the character-sheet grid, captions, or navy business suits unless the scene is corporate.",
    "Costume, hair styling, and setting follow the scene and genre. Face bone structure, eyes, brows, and identity stay locked.",
    "Photoreal cinematic 16:9. No logos, no watermarks, no artist name, no CGI/anime faces. Do not cover faces with text.",
  ];
  if (ids.includes("noa")) {
    lines.push(
      ids.includes("noel")
        ? `IMAGE_0 / left reference is the woman ${CAST.noa.lock}`
        : `The woman in the reference is ${CAST.noa.lock}`,
    );
  }
  if (ids.includes("noel")) {
    lines.push(
      ids.includes("noa")
        ? `IMAGE_1 / right reference is the man ${CAST.noel.lock}`
        : `The man in the reference is ${CAST.noel.lock}`,
    );
  }
  return lines.join(" ");
}

export function geminiIdentityLine(ids: CastId[]): string {
  if (!ids.length) return "사람 없어도 됨. 캐릭터 시트 격자 금지.";
  const bits = ids.map((id) => {
    const c = CAST[id];
    return `${c.role} ${c.nameEn} (${c.nameKo}): ${c.lock}`;
  });
  return `인물 고정. ${bits.join(" ")} 정장 수트 복제 금지. 의상은 장르 세계. 얼굴은 시트와 동일.`;
}
