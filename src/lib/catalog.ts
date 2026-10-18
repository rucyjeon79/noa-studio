import { patchApp, readAppDump } from "./app-memory";

export type GenreKind = "original" | "collection" | "distinct";
export type GenreId =
  | "kpop-original"
  | "jpop-original"
  | "pop-original"
  | "thai-original"
  | "joseon-ballad"
  | "panpop"
  | "echoes-of-joseon"
  | "latin-afrobeats-edm"
  | "edm-kpop-club"
  | "dreamy-deep-house"
  | "fantasy-ambient-edm"
  | "groovy-airy-pop"
  | "narrative-piano-indie"
  | "your-story"
  | "cover-reborn";

export const GENRE_THUMB_TYPE: Record<GenreId, string> = {
  "kpop-original": "Ivory fashion-editorial serif, medium weight, generous tracking.",
  "jpop-original": "Ivory editorial serif or clean Japanese-editorial sans, medium, airy tracking.",
  "pop-original": "Ivory contemporary serif, medium, cinematic tracking.",
  "thai-original": "Ivory editorial serif, medium-light, generous tracking.",
  "joseon-ballad": "Classical elegant serif, thin-to-medium, wide tracking, literary.",
  panpop: "Bold cinematic sans or strong serif, heavy weight, tight tracking, gold/ivory type.",
  "echoes-of-joseon": "Traditional editorial serif, medium, cinematic.",
  "latin-afrobeats-edm": "Trendy contemporary sans, semi-bold, clean edges.",
  "edm-kpop-club": "Bold geometric sans, heavy, tight spacing, high-contrast fill.",
  "dreamy-deep-house": "Thin minimal sans or light serif, very wide tracking.",
  "fantasy-ambient-edm": "Thin dreamy serif or light sans, wide tracking, pale type.",
  "groovy-airy-pop": "Airy modern sans, light-to-medium, open tracking.",
  "narrative-piano-indie": "Elegant editorial serif, thin or medium, generous tracking, cinematic-literary.",
  "your-story": "Elegant serif or clean sans matched to this story. Title largest. No real font names.",
  "cover-reborn": "Clean serif or sans. Title largest. No real font names.",
};

export function genreThumbFont(id: GenreId) {
  return [
    `이 장르 글씨체만 쓴다. 다른 장르 글씨로 바꾸지 마. ${GENRE_THUMB_TYPE[id]}`,
    "제목이 가장 크고 가장 강하다.",
    "장르 라벨과 감성 한줄은 제목보다 약하다.",
    "실제 폰트 이름은 쓰지 마.",
  ].join("\n");
}

export type EpEntry = { n: string; title: string };
export type ActId = number;
export type ActEntry = { n: ActId; from: string; to: string };
export type StudioMode = "single" | "playlist";
export type GenreSlot = { ep: string; act: number };

export type GenreEntry = {
  id: GenreId;
  kind: GenreKind;
  label: string;
  youtubeLabel: string;
  identity: string;
  titleRule: string;
  rewrite: string;
  thumbnail: string;
  structure?: string;
  vocal?: string;
  sound?: string;
  drop?: string;
  language?: string;
  fanLetter?: string;
  hashtags?: string;
  moodLine?: string;
  extra?: string[];
  sunoChars?: number;
  sunoNote?: string;
};

export const EPS: EpEntry[] = [
  { n: "01", title: "하루의 끝에" },
  { n: "02", title: "난 다시 살아가" },
  { n: "03", title: "빛으로 널" },
  { n: "04", title: "세상 끝에서도" },
  { n: "05", title: "너와의 모든 순간" },
  { n: "06", title: "Remember" },
  { n: "07", title: "아직 그 자리에" },
  { n: "08", title: "무너진 날들" },
  { n: "09", title: "빛의 자리" },
  { n: "10", title: "환혼곡(還魂曲)" },
  { n: "11", title: "혼잣말" },
  { n: "12", title: "심연(深淵)" },
  { n: "13", title: "우물에 빠진 달빛" },
  { n: "14", title: "잔향(殘響)" },
  { n: "15", title: "엇갈린 진심" },
  { n: "16", title: "시린 울림" },
  { n: "17", title: "미안(未安)" },
  { n: "18", title: "한마디도 없이" },
  { n: "19", title: "가까울수록" },
  { n: "20", title: "비상(飛上)" },
  { n: "21", title: "불꽃(비상-II)" },
  { n: "22", title: "하루의 끝에 - Reborn" },
  { n: "23", title: "Touch You(난 다시 살아가-II)" },
  { n: "24", title: "Light It Up(빛으로 널-II)" },
  { n: "25", title: "날아올라 Part.1 아침편" },
  { n: "26", title: "날아올라 Part.2 밤하늘편" },
  { n: "27", title: "날아올라 Part.3 Final" },
  { n: "28", title: "BLAZESTORM(DDD)" },
  { n: "29", title: "SKYHIGH(HA!ram&HA!jun)" },
  { n: "30", title: "FINALE : 별이 되다" },
  { n: "31", title: "사랑이 스며든 날" },
  { n: "32", title: "작은 떨림" },
  { n: "33", title: "마음결" },
  { n: "34", title: "나란히" },
  { n: "35", title: "Remain" },
  { n: "36", title: "남은 자리" },
  { n: "37", title: "느린 발걸음" },
  { n: "38", title: "Sway" },
  { n: "39", title: "Maybe" },
  { n: "40", title: "Afterglow" },
];

export const COMMON_LOCKS = [
  "EP 번호는 사용자/라이브러리 값 그대로. 번역·재번호 금지.",
  "원곡의 핵심 이야기·감정·상징은 유지. 문장 직역은 컬렉션에서 금지.",
  "한 출력에 장르를 섞지 않는다. 이미 뽑은 과거 EP 전문을 다시 붙이지 않는다.",
  "수노 스타일 프롬프트는 영어 완성본, 1000자 이하. 중간에서 끊거나 뒤를 자르지 마. 길면 처음부터 더 짧게 다시 쓴다.",
  "유튜브 제목 100자 이내. 넘치면 감성 한줄부터 줄인다.",
  "썸네일 공통: 16:9 실사 시네마틱. 텍스트 4줄만 (EP / 제목 / 감성 / 장르). 얼굴 가림 금지. 로고·워터마크·아티스트명 금지. 애니/일러스트/CGI 얼굴 금지.",
  "설명란 가사가 예이면 ━━━━━━━━━━━━━━━━━━━━ 사이에 부른 가사만. K-POP 원곡은 입력한 원문. 사연곡은 그 사연 가사. 그 외 EP는 주사용 언어로 장르에 맞게 개사한 가사. 아니오이면 가사를 넣지 마.",
  "K-POP Original / 사연곡은 수노를 출력하지 않는다.",
];

export const YOUTUBE_TITLE_FORMAT = "EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa";

export const GENRES: GenreEntry[] = [
  {
    id: "kpop-original",
    kind: "original",
    label: "K-POP Original Song",
    youtubeLabel: "K-POP Original Song",
    identity: "원곡을 언어만 옮긴다. 개사하지 않는다.",
    titleRule: "원제 유지. 31_제목 형이면 번호와 제목만 분리.",
    rewrite: "사용자가 입력한 이 EP 가사를 그대로 쓴다. 개사·번역·삭제·추가 금지.",
    thumbnail: "텍스트 중심. 보컬 구성 = 주인공. 곡 장면. 실사 100%. 아이보리 세리프. 판타지는 가사가 요구할 때만 90/10. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "한국어",
    fanLetter: "별무리",
    hashtags: "#AIArtistNoa #OriginalSong #KPOP",
  },
  {
    id: "jpop-original",
    kind: "original",
    label: "J-POP Original Song",
    youtubeLabel: "J-POP Original Song",
    identity: "같은 EP의 K-POP 원곡을 일본어로 장르에 맞게 개사한다.",
    titleRule: "일본어로 의미 유지 번역. 새 이야기 창작 금지.",
    rewrite: "같은 EP의 K-POP 원곡을 일본어로 개사. 이야기·감정·섹션 태그 유지. 원문을 그대로 붙이지 마. 원곡에 이미 있는 영어 훅은 번역하지 않음.",
    thumbnail: "텍스트 중심. 보컬 구성 = 주인공. 곡 장면. 실사 100%. 아이보리 세리프. 판타지는 가사가 요구할 때만 90/10. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "일본어",
    fanLetter: "星群れ",
    hashtags: "#AIArtistNoa #OriginalSong #JPOP",
  },
  {
    id: "pop-original",
    kind: "original",
    label: "POP Original Song",
    youtubeLabel: "POP Original Song",
    identity: "같은 EP의 K-POP 원곡을 영어로 장르에 맞게 개사한다.",
    titleRule: "영어로 의미 유지 번역. 새 이야기 창작 금지.",
    rewrite: "같은 EP의 K-POP 원곡을 영어로 개사. 이야기·감정·섹션 태그 유지. 원문을 그대로 붙이지 마. 원곡에 이미 있는 영어 훅은 유지.",
    thumbnail: "텍스트 중심. 보컬 구성 = 주인공. 곡 장면. 실사 100%. 아이보리 세리프. 판타지는 가사가 요구할 때만 90/10. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "영어",
    fanLetter: "Starlight",
    hashtags: "#AIArtistNoa #OriginalSong #POP",
  },
  {
    id: "thai-original",
    kind: "original",
    label: "Thai Original Song",
    youtubeLabel: "Thai Original Song",
    identity: "같은 EP의 K-POP 원곡을 태국어로 장르에 맞게 개사한다.",
    titleRule: "태국어로 의미 유지 번역. 새 이야기 창작 금지.",
    rewrite: "같은 EP의 K-POP 원곡을 태국어로 개사. 이야기·감정·섹션 태그 유지. 원문을 그대로 붙이지 마. 원곡에 이미 있는 영어 훅은 번역하지 않음.",
    thumbnail: "텍스트 중심. 보컬 구성 = 주인공. 곡 장면. 실사 100%. 아이보리 세리프. 판타지는 가사가 요구할 때만 90/10. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "태국어",
    fanLetter: "กลุ่มดาว",
    hashtags: "#AIArtistNoa #OriginalSong #ThaiSong",
  },
  {
    id: "joseon-ballad",
    kind: "collection",
    label: "조선 발라드",
    youtubeLabel: "조선 발라드",
    identity: "말하지 못한 사랑을 전하는 조선 귀족 여성. 한. 여백.",
    titleRule: "새 한글(한문). 기계 한자 번역 금지. 원제가 이미 한글(한문)이면 유지. EP.01–30은 joseon-title-ledger 고정. 재사용 금지. 속편: 여휘→재휘, 소생→답광, 심등→점등, 비상→화광, 조익→야익→완익.",
    rewrite: "한국어만. 1인칭 규수/귀부인. 그대/임/연모. 현대 연애 말·외국어 훅 금지. 시적이되 이해 가능하게.",
    structure: "Intro–V–Pre–Chorus–V2–Bridge–Final–Outro. 모든 섹션에 [Female Vocal] + 영어 연출.",
    sound: "가야금/해금/대금/거문고/아쟁 최소 사용. 소프트 패드·서브만 바닥. EDM·클럽·남성 리드 금지. 70–78 BPM 기본.",
    thumbnail: "텍스트 중심. 조선 귀족 여성 + 시대 의상. 한옥·달빛·등불. 고전 세리프. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    sunoChars: 846,
  },
  {
    id: "panpop",
    kind: "collection",
    label: "PANPOP",
    youtubeLabel: "PANPOP : The New Korean Pop",
    identity: "The New Korean Pop. 판소리 보컬 × 현대 K-pop. Bass Only. Vocals First.",
    titleRule: "원제 유지. 짧고 훅이 안 될 때만 개선.",
    rewrite: "현대 한국어 압축 + 판소리 말맛(어허/가거라는 자연스러울 때만). 짧은 영어 훅 가능. 명사만 선택적 영어.",
    structure: "Intro / V1 / Pre / Chorus+Hook / Bass Drop / V2 / Pre2 / Chorus / Bridge 판소리 / Pre-Drop / Final Chorus / Final Bass Drop / Outro",
    sound: "베이스만. 드럼·피아노·국악·신스 전부 금지. Vocal→Space→Bass Drop→Hook.",
    thumbnail: "다이나믹. 현대 한복 여성. 블랙+골드. 볼드 시네마틱. 브랜드 문구는 이미지 장르란에만. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    sunoChars: 919,
    sunoNote: "수노 문장에 PANPOP 단어만 넣지 말 것.",
  },
  {
    id: "echoes-of-joseon",
    kind: "collection",
    label: "Echoes of Joseon",
    youtubeLabel: "Echoes of Joseon",
    identity: "Traditional First → EDM Second. 국악으로 EDM을 만든다. 100–110 BPM.",
    titleRule: "원제 글자 그대로. 번역·개명 금지. 철자까지 고정.",
    rewrite: "한 60 + 영 40, 한 줄 안에서도 섞음. Hook 3회 이상 직접 기입. Male English Rap 필수.",
    structure: "Intro / V1 / Pre / BUILD / DROP / Chorus / V2 / Rap / BUILD2 / DROP2 / Final / Outro",
    drop: "0.5–1초 긴장 → 베이스+국악타악 → 0.3초 내 태평소/아쟁. 꽹가리=긴장, 징=여운. 현대 신스 리드 금지.",
    thumbnail: "텍스트+인물. 한복 여성 필수 + 갓 쓴 무사. 조선 밤·달빛. 전통 에디토리얼. Edition은 곡마다 새로. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    moodLine: "한국어",
    sunoChars: 999,
  },
  {
    id: "latin-afrobeats-edm",
    kind: "collection",
    label: "Latin Afrobeats EDM",
    youtubeLabel: "Latin Afrobeats EDM",
    identity: "밝은 메이저. 여름·네온·페스티벌. 114–118 BPM.",
    titleRule: "원제 유지. [LKE]는 유튜브에 안 넣음.",
    rewrite: "서사·상징 유지, 톤만 밝게. 고독·절망·비/눈/찬바람 중심 금지. 한국어 몸통 + 영어 훅 1–2줄. 후렴 반복 직접 기입.",
    structure: "Bass Intro / Groove Build / V1 / Pre / Chorus / V2 / Pre-Drop / Chorus / Dance Break(연주) / Energy Build / Final / Outro",
    vocal: "밝고 귀여운 여성.",
    thumbnail: "캐릭터. 밝은 여성, 네온·해변·페스티벌. 트렌디 산세. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    sunoChars: 747,
  },
  {
    id: "edm-kpop-club",
    kind: "collection",
    label: "EDM K-POP Club Remix",
    youtubeLabel: "EDM K-POP Club Remix",
    identity: "노래가 아니라 클럽 무기. 베이스가 주인. 120–128 BPM. 0–2초 즉시 드롭.",
    titleRule: "원제 유지. 아웃트로용 영어 제목 토큰만 추가 가능.",
    rewrite: "영어 남성 챈트 90%. 한 줄 3–6단어. Verse/Chorus 스토리 금지. 가사에 EP 번호 금지. 떼창 최소 1세트.",
    structure: "Intro 남성 TITLE+RESET NOW → 즉시 드롭 → 드롭 2–4회 → 그루브 → Fake GO-STOP-DROP → 변주 → Mini Drop → Dance Break 32–48마디 → Super Build → Super Drop → 여성 한국어 Anti Drop 2–3줄만 → Final Mega Drop 떼창 → Outro 15초+ REBORN / RESET COMPLETE / TITLE",
    thumbnail: "에너지. 클럽·페스티벌, 강대비, 기하 볼드 산세리프. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    extra: ["보조 표기: Bass Drop Version"],
    sunoChars: 908,
  },
  {
    id: "dreamy-deep-house",
    kind: "collection",
    label: "Dreamy Deep House",
    youtubeLabel: "Dreamy Deep House",
    identity: "잠들기 전 흡수. 작은 방. 자극 금지. 65–72 BPM.",
    titleRule: "원제 코어 유지.",
    rewrite: "한 줄 = 한국어 시작 + 짧은 영어 감정어(번역 커플릿 아님). 섹션당 2–4줄.",
    structure: "Intro / Verse 1 / Soft Build / Break / Verse 2 / Emotional Peak / Outro. 모든 섹션에 (영어 사운드 지시).",
    vocal: "남성 only. 수노 믹스는 가깝고 낮은 톤. 여성 리드 금지. 피아노가 맑게 앞.",
    thumbnail: "공간 우선. 어두운 방·창빛·물·별. 사람 없어도 됨. 얇은 미니멀. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    sunoChars: 906,
  },
  {
    id: "fantasy-ambient-edm",
    kind: "collection",
    label: "Fantasy Ambient EDM",
    youtubeLabel: "Fantasy Ambient EDM",
    identity: "세계에 들어가는 음악. SPACE > EMOTION > SCALE > RHYTHM. 70 BPM. 킥 그루브 없음.",
    titleRule: "원제 그대로. 철자까지 고정.",
    rewrite: "Fantasy Language only. 한/영 가사 금지. 원곡 구호·이름콜·욕설 남기지 않음. Light 모음훅 / Dark 자음훅은 EP마다 새로.",
    vocal: "여성=빛 속삭임, 남성=어둠 속삭임. 허밍은 공간 레이어.",
    drop: "에너지 웨이브. 킥 임팩트 아님.",
    thumbnail: "제목 정중앙 고정. 빛/어둠. 실사 50 + 판타지 50. 얇은 몽환. 날개·뿔·애니 금지. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    moodLine: "영어",
    sunoChars: 874,
  },
  {
    id: "groovy-airy-pop",
    kind: "collection",
    label: "Groovy airy POP",
    youtubeLabel: "Groovy Airy POP",
    identity: "공기감 일렉트팝 + 힙합 그루브. 노래보다 리듬 발화. 92 BPM, behind the beat.",
    titleRule: "영어 작품명 새로. 직역 금지. 확정 후 고정.",
    rewrite: "영어 spoken-word / rap cadence. 짧은 토막 문장. phonetic hook. Rap 섹션 필수. 전통 가창 금지.",
    vocal: "raspy airy 여성 + vocal fry.",
    thumbnail: "텍스트 중심. 여성 1인, 밤 도시·창가·청보라. 에어리 산세. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    moodLine: "영어",
    sunoChars: 890,
  },
  {
    id: "narrative-piano-indie",
    kind: "collection",
    label: "Narrative Piano Indie",
    youtubeLabel: "Narrative Piano Indie",
    identity: "긴 시집. 피아노가 감정, 가사가 이야기. 80–92 BPM.",
    titleRule: "영어 인디 작품명 새로. 직역 금지.",
    rewrite: "영어 관찰형. 서사 순서 유지. 운명·폭발·영원·클라이맥스 말 금지.",
    structure: "Intro 피아노 / V1 / (Pre) / Chorus / V2 / Piano Solo / Bridge / Chorus / Outro",
    vocal: "친밀, 고음 폭발 없음.",
    thumbnail: "텍스트 중심. 1인 담담, 창가·실내·여백. 에디토리얼 세리프. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    extra: ["보조 표기: Indie POP Edition"],
    sunoChars: 463,
  },
  {
    id: "your-story",
    kind: "distinct",
    label: "당신의 이야기, 우리의 음악",
    youtubeLabel: "당신의 이야기, 우리의 음악",
    identity: "시청자 사연을 음악으로 바꾼다. 누군가의 이야기 = 나의 이야기.",
    titleRule: "입력 제목 유지. EP/ACT 금지.",
    rewrite: "개사하지 않는다. 제목과 가사에서 감정·이야기를 뽑아 결과물에 반영.",
    thumbnail: "여주 NOA 필수. 실사 + 아주 약한 판타지. 텍스트 5개: 제목/감성/장르/브랜드/서브. 얼굴 가림 금지. 브랜드가 제목보다 강해지지 않음. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "한국어",
    fanLetter: "별무리",
    hashtags: "#AIArtistNoa #당신의이야기우리의음악 #사연곡",
  },
  {
    id: "cover-reborn",
    kind: "distinct",
    label: "재탄생, 유명곡 커버",
    youtubeLabel: "재탄생, 유명곡 커버",
    identity: "유명곡을 커버한다. 사연곡이 아니다. 입력한 제목과 가사를 그대로 쓴다.",
    titleRule: "입력 제목 유지. EP/ACT 금지.",
    rewrite: "개사하지 않는다. 원곡 가수는 입력한 글자 그대로.",
    thumbnail: "여주 NOA 필수. 실사. 글은 곡제목, 원곡 가수, 감성 한줄, Cover by AInoa. 당신의 이야기는 넣지 마. 썸네일에는 보컬에 따라 기본 등장 인물을 정하고 곡의 분위기나 내용에 따라 추가 인물을 등장 시킬수 있다.",
    language: "한국어",
    fanLetter: "별무리",
    hashtags: "#AIArtistNoa #재탄생 #유명곡커버",
  },
];

export const DEFAULT_GENRE: GenreId = "joseon-ballad";
export const DEFAULT_ACT: ActId = 1;

export const ACTS: ActEntry[] = [
  { n: 1, from: "01", to: "10" },
  { n: 2, from: "11", to: "20" },
  { n: 3, from: "21", to: "30" },
  { n: 4, from: "31", to: "40" },
];

export const STORAGE_EP = "ep-series-studio:ep";
export const STORAGE_GENRE = "ep-series-studio:genre";
export const STORAGE_NOTE = "ep-series-studio:note";
export const STORAGE_CONFIRMED = "ep-series-studio:confirmed";
export const STORAGE_MODE = "ep-series-studio:mode";
export const STORAGE_ACT = "ep-series-studio:act";
export const STORAGE_LYRICS = "ep-series-studio:lyrics";
export const STORAGE_LOCKS = "ep-series-studio:locks";
export const STORAGE_NEED_REGEN = "ep-series-studio:need-regen";
export const STORAGE_TITLES = "ep-series-studio:genre-titles";
export const STORAGE_MENU = "ep-series-studio:menu";
export const STORAGE_STORY_TITLE = "ep-series-studio:story-title";
export const STORAGE_STORY_LYRICS = "ep-series-studio:story-lyrics";
export const STORAGE_STORY_GENRE = "ep-series-studio:story-genre";
export const STORAGE_STORY_VOCAL = "ep-series-studio:story-vocal";
export const STORAGE_STORY_PASTE = "ep-series-studio:story-paste";
export const STORAGE_KPOP_PASTE = "ep-series-studio:kpop-paste";
export const STORAGE_KPOP_MODE = "ep-series-studio:kpop-mode";
export const STORAGE_ORIGINALS = "ep-series-studio:originals";
export const STORAGE_KPOP_TITLE = "ep-series-studio:kpop-title";
export const STORAGE_KPOP_VOCAL = "ep-series-studio:kpop-vocal";
export const STORAGE_SLOT = "ep-series-studio:genre-slot";

export function padEp(n: string | number): string {
  const num = Number(String(n).replace(/[^\d]/g, ""));
  if (!Number.isInteger(num) || num < 1) return "";
  return String(num).padStart(2, "0");
}

export function isEpNumber(n: string): boolean {
  const num = Number(n);
  return Number.isInteger(num) && num >= 1 && padEp(n) === String(num).padStart(2, "0");
}

export function getEp(n: string): EpEntry {
  const key = padEp(n);
  return EPS.find((e) => e.n === key) ?? EPS[0];
}

export function getGenre(id: string): GenreEntry {
  return GENRES.find((g) => g.id === id) ?? GENRES[4];
}

export function isStoryGenre(id: string) {
  return id === "your-story" || id === "cover-reborn";
}

export function genreWantsSuno(id: GenreId | string) {
  return id !== "kpop-original" && !isStoryGenre(id);
}

/** K-POP 원곡·사연곡은 입력 가사를 그대로 쓴다. 결과창 가사칸 없음. */
export function genreShowsLyrics(id: GenreId | string) {
  return id !== "kpop-original" && !isStoryGenre(id);
}

function sunoInstruction(genre: GenreEntry) {
  if (!genre.sunoChars) return "이 장르는 수노 베이스를 저장하지 않는다.";
  const note = genre.sunoNote ? ` ${genre.sunoNote}` : "";
  return `suno-prompts.md 저장본으로 시작하되, 곡 감정을 넣은 완성본이 1000자 이하다. 중간에서 끊거나 뒤를 자르지 마.${note}`;
}

export function formatGenreCard(genre: GenreEntry) {
  const lines = [
    `장르: ${genre.label}`,
    `유튜브 장르라벨: ${genre.youtubeLabel}`,
    `정체성: ${genre.identity}`,
    `제목: ${genre.titleRule}`,
    `개사: ${genre.rewrite}`,
  ];
  if (genre.structure) lines.push(`구조: ${genre.structure}`);
  if (genre.vocal) lines.push(`보컬: ${genre.vocal}`);
  if (genre.sound) lines.push(`사운드: ${genre.sound}`);
  if (genre.drop) lines.push(`드롭: ${genre.drop}`);
  lines.push(`썸네일: ${genre.thumbnail}`);
  if (genre.moodLine) lines.push(`감성 한줄 언어: ${genre.moodLine}`);
  if (genre.language) lines.push(`언어: ${genre.language}`);
  if (genre.fanLetter) lines.push(`팬 호칭: ${genre.fanLetter}`);
  if (genre.hashtags) lines.push(`해시태그: ${genre.hashtags}`);
  if (genre.extra) for (const item of genre.extra) lines.push(`추가: ${item}`);
  lines.push(`수노: ${sunoInstruction(genre)}`);
  return lines.join("\n");
}

export function getAct(n: number): ActEntry {
  return ACTS.find((a) => a.n === n) ?? ACTS[0];
}

export function tracksForAct(n: number, extras: EpEntry[] = []): EpEntry[] {
  const act = getAct(n);
  const from = Number(act.from);
  const to = Number(act.to);
  const pool = extras.length ? mergeEpEntries(EPS, extras) : EPS;
  return pool.filter((e) => {
    const i = Number(e.n);
    return i >= from && i <= to;
  });
}

export function formatTracklist(n: number, extras: EpEntry[] = []) {
  return tracksForAct(n, extras).map((e) => `EP.${e.n} ${e.title}`).join("\n");
}

export function actTrackLine(n: string, title: string) {
  const id = padEp(n) || String(n).replace(/\D/g, "");
  const head = id ? `EP.${id}` : "";
  let name = title.trim().replace(/^\d{1,2}:\d{2}\s+/, "");
  if (head && name.toUpperCase().startsWith(head.toUpperCase())) name = name.slice(head.length).trim();
  if (head && name) return `${head} ${name}`;
  if (head) return head;
  return name;
}

export function formatTimedTracklist(n: number, extras: EpEntry[] = []) {
  return tracksForAct(n, extras)
    .map((e) => actTrackLine(e.n, e.title))
    .filter(Boolean)
    .join("\n");
}

export function asTimedTracklist(tracklist: string) {
  return tracklist
    .split("\n")
    .map((line) => {
      const text = line.trim();
      if (!text) return "";
      const timed = text.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      const body = (timed ? timed[2] : text).trim();
      const ep = body.match(/^(EP\.(\d+))\s*(.*)$/i);
      if (ep) {
        const id = padEp(ep[2]) || ep[2];
        const rest = ep[3].trim();
        return rest ? `EP.${id} ${rest}` : `EP.${id}`;
      }
      const bare = body.replace(/^\d{1,2}:\d{2}\s+/, "").trim();
      return bare;
    })
    .filter(Boolean)
    .join("\n");
}

export function ensureDescTracklist(description: string, timed: string) {
  const lines = timed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return description.trim();
  const body = description.trim();
  const titles = lines.map((line) => line.replace(/^\d{1,2}:\d{2}\s+/, "").trim()).filter(Boolean);
  const hasAll = titles.every((title) => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\n)(?:\\d{1,2}:\\d{2}\\s+)?${escaped}(?:\\s|$)`, "m").test(body);
  });
  if (hasAll) return body;
  return body ? `${body}\n\n${lines.join("\n")}` : lines.join("\n");
}

export function playlistTitlePrefix(act: ActEntry) {
  return `Act.${act.n} Playlist EP.${act.from}~${act.to}`;
}

/** 다른 ACT 본문이 붙었을 때 Act 번호와 EP 범위만 지금 ACT로 맞춘다. */
export function alignActCopy(text: string, actN: number) {
  const act = getAct(actN);
  if (!text || !text.trim() || !act) return text;
  const prefix = playlistTitlePrefix(act);
  let next = text.replace(
    /Act\.\d+\s+Playlist\s+EP\.\d{1,2}\s*[~～\-–]\s*(?:EP\.)?\d{1,2}/gi,
    prefix,
  );
  next = next.replace(/Act\.(\d+)/g, (full, n) => (Number(n) === act.n ? full : `Act.${act.n}`));
  const range = `EP.${act.from}~${act.to}`;
  next = next.replace(/EP\.(\d{2})\s*~\s*(\d{2})/g, (full, from, to) => {
    const known = ACTS.some((item) => item.from === from && item.to === to);
    if (!known || (from === act.from && to === act.to)) return full;
    return range;
  });
  return next;
}

export function mergeEpEntries(base: EpEntry[], extra: EpEntry[]): EpEntry[] {
  const map = new Map<string, EpEntry>();
  for (const item of base) map.set(item.n, item);
  for (const item of extra) {
    const n = padEp(item.n);
    if (!n) continue;
    const prev = map.get(n);
    map.set(n, { n, title: item.title.trim() || prev?.title || `EP.${n}` });
  }
  return [...map.values()].sort((a, b) => Number(a.n) - Number(b.n));
}

export function actFromEp(n: string): ActId {
  const num = Number(padEp(n));
  if (num >= 31) return 4;
  if (num >= 21) return 3;
  if (num >= 11) return 2;
  return 1;
}

export function actsForEntries(entries: EpEntry[]): ActEntry[] {
  const max = Math.max(0, ...entries.map((e) => Number(e.n) || 0));
  const last = Math.max(1, Math.ceil(max / 10));
  return Array.from({ length: last }, (_, i) => {
    const n = i + 1;
    return {
      n,
      from: String((n - 1) * 10 + 1).padStart(2, "0"),
      to: String(n * 10).padStart(2, "0"),
    };
  });
}

export function readGenreSlot(genreId: string): GenreSlot | null {
  return readAppDump().meta.slots?.[genreId] ?? null;
}

export function writeGenreSlot(genreId: string, ep: string, act: number) {
  const next: GenreSlot = {
    ep: padEp(ep) && isEpNumber(padEp(ep)) ? padEp(ep) : "",
    act: Number.isInteger(act) && act >= 1 ? act : 1,
  };
  patchApp((d) => {
    d.meta.slots = { ...(d.meta.slots ?? {}), [genreId]: next };
  });
}
