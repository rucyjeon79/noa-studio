import { padEp, type GenreId } from "./catalog";

export const JOSEON_ACT_MOOD: Record<number, string> = {
  1: "말하지 못한 연모가 달빛처럼 깊어지는 밤",
  2: "혼자 남은 사랑을 건너, 하늘을 향해 일어서는 밤",
  3: "불꽃을 지나, 별이 되어 하늘에 남는 밤",
};

export const JOSEON_TITLES: Record<string, string> = {
  "01": "여휘(餘暉)",
  "02": "소생(蘇生)",
  "03": "심등(心燈)",
  "04": "천애(天涯)",
  "05": "세화(歲華)",
  "06": "잔성(殘星)",
  "07": "망문(望門)",
  "08": "퇴락(頹落)",
  "09": "회명(回明)",
  "10": "환혼곡(還魂曲)",
  "11": "독연(獨戀)",
  "12": "심연(深淵)",
  "13": "정중월(井中月)",
  "14": "잔향(殘響)",
  "15": "착심(錯心)",
  "16": "한향(寒響)",
  "17": "미안(未安)",
  "18": "묵거(默去)",
  "19": "근상(近傷)",
  "20": "비상(飛上)",
  "21": "화광(火光)",
  "22": "재휘(再暉)",
  "23": "답광(答光)",
  "24": "점등(點燈)",
  "25": "조익(朝翼)",
  "26": "야익(夜翼)",
  "27": "완익(完翼)",
  "28": "염풍(焰風)",
  "29": "고천(高天)",
  "30": "화성(化星)",
};

export const JOSEON_SEQUEL = [
  "여휘 → 재휘",
  "소생 → 답광",
  "심등 → 점등",
  "비상 → 화광",
  "조익 → 야익 → 완익",
];

const ORIGINAL_TITLE_LOCK = new Set<GenreId>([
  "echoes-of-joseon",
  "latin-afrobeats-edm",
  "edm-kpop-club",
  "dreamy-deep-house",
  "fantasy-ambient-edm",
]);

export function joseonLockedTitle(epN: string) {
  return JOSEON_TITLES[padEp(epN)] ?? "";
}

export function genreLockedTitle(genreId: GenreId, epN: string, originalTitle: string) {
  if (genreId === "joseon-ballad") return joseonLockedTitle(epN);
  if (ORIGINAL_TITLE_LOCK.has(genreId)) return originalTitle.trim();
  return "";
}

export function joseonActMood(act: number) {
  return JOSEON_ACT_MOOD[act] ?? "";
}

export function joseonLedgerPrompt() {
  const rows = Object.entries(JOSEON_TITLES)
    .map(([n, title]) => `EP.${n} → ${title}`)
    .join("\n");
  return [
    "[조선 발라드 작품명 장부 — EP.01–30 확정 제목. 바꾸지 마.]",
    "현재 마지막 장부 페이지: EP.30 화성(化星) / Act.3",
    "EP.31–40은 장부 없음. 새 한글(한문) 제목. 재사용 금지.",
    "속편 고정:",
    ...JOSEON_SEQUEL,
    "",
    "Act.1 감성: " + JOSEON_ACT_MOOD[1],
    "Act.2 감성: " + JOSEON_ACT_MOOD[2],
    "Act.3 감성: " + JOSEON_ACT_MOOD[3],
    "",
    rows,
  ].join("\n");
}
