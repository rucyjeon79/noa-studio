import type { GenreId } from "./catalog";
import dreamy from "@/data/suno/dreamy-deep-house.txt?raw";
import echoes from "@/data/suno/echoes-of-joseon.txt?raw";
import club from "@/data/suno/edm-kpop-club.txt?raw";
import fantasy from "@/data/suno/fantasy-ambient-edm.txt?raw";
import groovy from "@/data/suno/groovy-airy-pop.txt?raw";
import joseon from "@/data/suno/joseon-ballad.txt?raw";
import jpop from "@/data/suno/jpop-original.txt?raw";
import latin from "@/data/suno/latin-afrobeats-edm.txt?raw";
import piano from "@/data/suno/narrative-piano-indie.txt?raw";
import panpop from "@/data/suno/panpop.txt?raw";
import pop from "@/data/suno/pop-original.txt?raw";
import thai from "@/data/suno/thai-original.txt?raw";

const MAP: Partial<Record<GenreId, string>> = {
  "dreamy-deep-house": dreamy,
  "echoes-of-joseon": echoes,
  "edm-kpop-club": club,
  "fantasy-ambient-edm": fantasy,
  "groovy-airy-pop": groovy,
  "joseon-ballad": joseon,
  "jpop-original": jpop,
  "latin-afrobeats-edm": latin,
  "narrative-piano-indie": piano,
  panpop,
  "pop-original": pop,
  "thai-original": thai,
};

export function defaultSunoBase(id: GenreId) {
  return (MAP[id] ?? "").trim();
}

export function genreHasSuno(id: GenreId) {
  return Boolean(MAP[id]);
}