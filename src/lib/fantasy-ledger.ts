import { padEp } from "./catalog";

export const FANTASY_ACT_MOOD: Record<number, string> = {
  1: "Ten worlds where light first meets the dark.",
  2: "Where love breaks, then learns to rise.",
  3: "From fallen flame to a name in the sky.",
};

export const FANTASY_PLAYLIST_TITLE = "빛과 어둠의 판타지 여정";

export const FANTASY_MOOD: Record<string, string> = {
  "01": "Where the day ends, light meets the dark.",
  "02": "From longing, warmth learns to live again.",
  "03": "In the dark, one lantern holds you.",
  "04": "At the world's end, warmth remains.",
  "05": "Every moment with you remains.",
  "06": "What love refuses to forget.",
  "07": "The place you left still waits.",
  "08": "Even ruin remembers you.",
  "09": "After the fall, light takes its place.",
  "10": "What was released returns as light.",
  "11": "One voice left in the dark.",
  "12": "Can love rise from the abyss?",
  "13": "Moonlight lets go in the well.",
  "14": "After goodbye, the air still rings.",
  "15": "Two truths that miss each other.",
  "16": "Love sounds, but never warms.",
  "17": "Sorry for the love I could not keep.",
  "18": "The word we never said remains.",
  "19": "The closer we stand, the deeper it hurts.",
  "20": "A fallen self learns the sky.",
  "21": "The fallen flame remembers the sky.",
  "22": "At the day's end, a quiet heart is reborn.",
  "23": "Where your light touches, life returns.",
  "24": "I become the lantern you lost.",
  "25": "Morning opens, the heart learns flight.",
  "26": "Above the clouds, night becomes the wing.",
  "27": "The wing that opened will not fold.",
  "28": "The cage burns. The storm remains.",
  "29": "After the fall, hope is louder.",
  "30": "The last note becomes a star.",
};

export const FANTASY_HOOKS: Record<string, { light: string; dark: string }> = {
  "21": { light: "Aelia noae siya", dark: "Krath voren dak" },
  "22": { light: "Oena lumaer sioel", dark: "Thol ven mur" },
  "23": { light: "Yenae tiala elya", dark: "Skor vreth nuld" },
  "24": { light: "Faela lumei orai", dark: "Gorth brak vuld" },
  "25": { light: "Aurel siona eluai", dark: "Morun vesh lorth" },
  "26": { light: "Selia nyora vaeni", dark: "Drav korth uln" },
  "27": { light: "Kaela rionae velae", dark: "Threx voln gadr" },
  "28": { light: "Zaera pyrel othae", dark: "Brakk dreln voth" },
  "29": { light: "Haeli oruen viala", dark: "Nhor belk udra" },
  "30": { light: "Aestra novae sirel", dark: "Khur dast vren" },
};

export function fantasyMood(epN: string) {
  return FANTASY_MOOD[padEp(epN)] ?? "";
}

export function fantasyHook(epN: string) {
  return FANTASY_HOOKS[padEp(epN)] ?? null;
}

export function fantasyLockedWords() {
  return Object.values(FANTASY_HOOKS)
    .flatMap((h) => [h.light, h.dark])
    .join(" / ");
}

export function fantasyLedgerPrompt(epN: string) {
  const n = padEp(epN);
  const mood = fantasyMood(n);
  const hook = fantasyHook(n);
  const lines = [
    "[Fantasy Ambient — 장부]",
    mood ? `이 EP 영어 감성 한줄 고정: ${mood}` : "EP.31+ 영어 감성 한줄은 새로. 원제 번역 금지.",
    hook
      ? `이 EP Light 훅 고정: ${hook.light}\n이 EP Dark 훅 고정: ${hook.dark}`
      : `새 Light/Dark 훅. 재사용 금지 목록: ${fantasyLockedWords()}`,
    "원곡 구호·이름콜·욕설을 영어/한글로 남기지 말 것. Fantasy Language only.",
  ];
  return lines.join("\n");
}
