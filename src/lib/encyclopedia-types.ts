export type EncPkg = {
  summary?: string;
  confirmedTitle?: string;
  lyricsBlock?: string;
  sunoStyle?: string;
  geminiPrompt?: string;
  youtubeTitle?: string;
  youtubeDescription?: string;
  fanLetter?: string;
  thumbUrl?: string;
  thumbCast?: string;
  tracklist?: string;
  communityPost?: string;
  youtubeUrl?: string;
  sunoUrl?: string;
  mvUrl?: string;
  audioLevel?: string;
  audioAnalysis?: string;
  ytPremium?: boolean;
  mvPremium?: boolean;
};

export type EncPref = {
  lang?: string;
  titleFormat?: string;
  titleMode?: string;
  langRule?: string;
  titleModeRule?: string;
  focus?: string;
  reality?: number;
  motion?: number;
  extra?: string;
  community?: boolean;
  descLyrics?: boolean;
  lockDescLyrics?: boolean;
  actPlaylist?: boolean;
  output?: Record<string, boolean>;
  actOutput?: Record<string, boolean>;
  sunoBase?: string;
  vocalStyle?: string;
  musicStyle?: string;
  descRules?: string;
  communityRules?: string;
  thumbImage?: string;
  thumbFont?: string;
  thumbDecor?: string;
  thumbLayout?: string;
  youtubeSeo?: string;
  sunoLimit?: string;
  outputOrder?: string;
  thumbCastRule?: string;
  rewriteRules?: string;
  structure?: string;
  moodLineRule?: string;
  thumbGenreLine?: string;
  forbidList?: string;
  guideText?: string;
  adminDevice?: string;
  fixRule?: string;
  fillAudit?: string;
  fieldAudit?: string;
  lockRule?: string;
  matchRule?: string;
  liveRule?: string;
  fillNotice?: string;
  splashRule?: string;
  buildGuide?: string;
  designRule?: string;
  listRule?: string;
  healthRule?: string;
  saveRule?: string;
  placeRule?: string;
  linkRule?: string;
  playRule?: string;
};

export type EncFillEvent = { label: string; state: string; reason?: string };

export type EncFillJob = {
  genreId: string;
  tasks: { kind: string; n?: string; title?: string; act?: number; genreId?: string; rank?: number }[];
  acceptedAt: number;
  total: number;
  limitUntil?: number;
  paused?: boolean;
  status?: string;
  current?: string;
  lastError?: string;
  filled?: number;
  events?: EncFillEvent[];
  userPaused?: boolean;
  busyUntil?: number;
};

export type EncMeta = {
  locks: Record<string, Record<string, boolean>>;
  rowLocks: Record<string, boolean>;
  confirmed: Record<string, boolean>;
  settingLocks: { common: Record<string, boolean>; genre: Record<string, boolean> };
  needRegen: string[];
  slots: Record<string, { ep: string; act: number }>;
  youtube: Record<string, string>;
  ui: { genreId?: string; mode?: string; kpopMode?: string; genrePicked?: boolean; ep?: string; act?: number };
  releaseSeen: number;
  gatePassword: string;
  securityKey: string;
  fillAskAgain?: boolean;
  lockSweep?: number;
  /** 메인 자물쇠. 없으면 잠금. true만 풀림. 재접속 때도 이 값을 유지한다. */
  gateOpen?: boolean;
  /** 목록 키별 저장 순서. act:장르:번호, story:장르:default, story:장르:pl:아이디. 없는 곡은 맨 위. */
  listOrder?: Record<string, string[]>;
};

export type EncyclopediaDump = {
  packages: Record<string, { genreId: string; ep: string; title: string; pkg: EncPkg; updatedAt?: number }>;
  playlists: Record<string, { genreId: string; act: number; title: string; pkg: EncPkg; updatedAt?: number }>;
  stories: Record<string, { title: string; pkg: EncPkg; savedAt?: number; registeredAt?: number }>;
  prefs: Record<string, EncPref>;
  originals: Record<string, Record<string, { n: string; title: string; vocal: string; lyrics: string }>>;
  titles: Record<string, Record<string, string>>;
  fillJob?: EncFillJob | null;
  meta?: EncMeta;
};

export function parseListOrder(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || !Array.isArray(ids)) continue;
    const clean = ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    if (clean.length) out[key] = clean;
  }
  return out;
}

export function blankMeta(): EncMeta {
  return {
    locks: {},
    rowLocks: {},
    confirmed: {},
    settingLocks: { common: {}, genre: {} },
    needRegen: [],
    slots: {},
    youtube: {},
    ui: {},
    releaseSeen: 0,
    gatePassword: "",
    securityKey: "7999",
    fillAskAgain: false,
    listOrder: {},
  };
}

export function emptyEncyclopedia(): EncyclopediaDump {
  return {
    packages: {},
    playlists: {},
    stories: {},
    prefs: {},
    originals: {},
    titles: {},
    fillJob: null,
    meta: blankMeta(),
  };
}
