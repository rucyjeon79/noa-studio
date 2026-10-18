# EP Series Studio — 통일 마스터

사용자가 올린 모든 지침을 시리즈/장르로 최적화해 한 장으로 고정한다.
충돌 시 **해당 장르 카드가 공통 규칙보다 우선**한다.
한 번에 한 장르만 출력한다.
Distinct 시리즈 「당신의 이야기, 우리의 음악」은 EP/ACT를 쓰지 않는다.

브랜드: AI Artist Noa
원곡 저장소: `original-library.md` (EP.01–40)
수노 베이스: `suno-prompts.md` (컬렉션 9종 저장 완료)
조선 작품명 장부: `joseon-title-ledger.md`

---

## 0. 공통 절대 규칙

1. EP 번호는 사용자/라이브러리 값 그대로. 번역·재번호 금지.
2. 원곡의 핵심 이야기·감정·상징은 유지. 문장 직역은 컬렉션에서 금지.
3. 한 출력에 장르를 섞지 않는다. 이미 뽑은 과거 EP 전문을 다시 붙이지 않는다.
4. 수노 스타일 프롬프트는 영어, 1000자 이하, 권장 700–900. 저장된 베이스를 먼저 쓰고 곡 감정만 한 줄 보정.
5. 유튜브 제목 100자 이내. 기본형:
   `EP.번호 | 확정 제목 | 감성 한줄 | 장르라벨 | AI Artist Noa`
   넘치면 감성 한줄부터 줄인다.
6. 썸네일 공통: 16:9 실사 시네마틱. 텍스트 4줄만 (EP / 제목 / 감성 / 장르). 얼굴 가림 금지. 로고·워터마크·아티스트명 금지. 애니/일러스트/CGI 얼굴 금지.
7. 설명란 가사가 예이면 `━━━━━━━━━━━━━━━━━━━━` 사이에 부른 가사만. K-POP 원곡은 입력한 원문. 사연곡은 그 사연 가사. 그 외 EP는 주사용 언어로 장르에 맞게 개사한 가사. 아니오이면 가사를 넣지 않는다.
8. K-POP / J-POP / POP / Thai는 수노 베이스를 저장하지 않는다.

---

## 1. 시리즈 구분

### A. 오리지널 송 시리즈
K-POP 원곡만 입력 가사를 그대로 둔다. J-POP·POP·Thai는 같은 EP의 K-POP 원곡을 그 언어로 장르에 맞게 개사한다.
- K-POP Original Song
- J-POP Original Song
- POP Original Song
- Thai Original Song

추가 출력: 팬 편지 (설명란 다음)

### B. 컬렉션 시리즈
원곡을 장르 목소리로 다시 쓴다. 확정 제목 다음에 개작 가사 + 수노 스타일을 둔다.
- 조선 발라드
- PANPOP
- Echoes of Joseon
- Latin Afrobeats EDM
- EDM K-POP Club Remix
- Dreamy Deep House
- Fantasy Ambient EDM
- Groovy airy POP
- Narrative Piano Indie

---

## 2. 공통 출력 순서

1. 자동화 처리내용 요약 (평문)
2. 확정 제목 (코드블럭)
3. 가사 (코드블럭) — 첫 줄에 제목 넣지 말 것. 섹션/가사부터 시작
3b. 컬렉션만 SUNO STYLE (별도 코드블럭, 영어 ≤1000, 생략 금지)
4. 썸네일 이미지 먼저 생성해 보여 줌 (Grok Imagine, 16:9)
4b. 그 아래 Gemini 썸네일 프롬프트 영어 ≤1000 (코드블럭)
5. YouTube 제목 ≤100 (코드블럭)
6. 영상 설명란 (코드블럭) — 문단마다 이모지 1개
7. 오리지널만: 팬 편지 (코드블럭) — 문단마다 이모지 1개

---

## 3. 오리지널 송 시리즈

### 공통 개사(번역) 규칙
- 이야기·감정·섹션 태그 유지
- 원곡에 이미 있는 영어 훅은 번역하지 않음 (I’ll remain, Sway, Afterglow, Maybe, it's us 등)
- 수노 명령줄이 원곡에 있으면 유지
- 제목: 해당 언어로 의미 유지 번역. 새 이야기 창작 금지
- 썸네일: 텍스트 중심. 보컬 구성 = 주인공
- 실사 100%. 판타지는 가사가 요구할 때만 90/10
- 설명란 언어 = 선택 장르 언어
- 편지 언어 = 선택 장르 언어

| 장르라벨 | 언어 | 팬 호칭 | 해시태그 |
|---|---|---|---|
| K-POP Original Song | 한국어 | 별무리 | #AIArtistNoa #OriginalSong #KPOP |
| J-POP Original Song | 일본어 | 星群れ | #AIArtistNoa #OriginalSong #JPOP |
| POP Original Song | 영어 | Starlight | #AIArtistNoa #OriginalSong #POP |
| Thai Original Song | 태국어 | กลุ่มดาว | #AIArtistNoa #OriginalSong #ThaiSong |

K-POP 제목은 원제 유지. `31_제목`이면 번호와 제목만 분리.

---

## 4. 컬렉션 카드

각 카드 순서: 정체성 → 제목 → 개사 → 구조 → 보컬 → 사운드 → 썸네일 → 유튜브

### 4.1 조선 발라드
정체성: 말하지 못한 사랑을 전하는 조선 귀족 여성. 한. 여백.
제목: 새 `한글(한문)`. 기계 한자 번역 금지. 원제가 이미 한글(한문)이면 유지. EP.01–30은 장부 고정. 재사용 금지. 속편: 여휘→재휘, 소생→답광, 심등→점등, 비상→화광, 조익→야익→완익.
개사: 한국어만. 1인칭 규수/귀부인. 그대/임/연모. 현대 연애 말·외국어 훅 금지. 시적이되 이해 가능하게.
구조: Intro–V–Pre–Chorus–V2–Bridge–Final–Outro. 모든 섹션에 [Female Vocal] + 영어 연출.
사운드: 가야금/해금/대금/거문고/아쟁 최소 사용. 소프트 패드·서브만 바닥. EDM·클럽·남성 리드 금지. 70–78 BPM 기본.
썸네일: 조선 귀족 여성 + 시대 의상. 텍스트 중심. 한옥·달빛·등불.
유튜브 장르: 조선 발라드
수노: 저장본 846자.

### 4.2 PANPOP
정체성: The New Korean Pop. 판소리 보컬 × 현대 K-pop. Bass Only. Vocals First.
제목: 원제 유지. 짧고 훅이 안 될 때만 개선.
개사: 현대 한국어 압축 + 판소리 말맛(어허/가거라는 자연스러울 때만). 짧은 영어 훅 가능. 명사만 선택적 영어.
구조: Intro / V1 / Pre / Chorus+Hook / Bass Drop / V2 / Pre2 / Chorus / Bridge 판소리 / Pre-Drop / Final Chorus / Final Bass Drop / Outro
사운드: 베이스만. 드럼·피아노·국악·신스 전부 금지. Vocal→Space→Bass Drop→Hook.
썸네일: 다이나믹 현대 한복 여성. 블랙+골드. 브랜드 문구는 이미지 장르란에만.
유튜브 장르: PANPOP : The New Korean Pop
수노: 저장본 919자. 수노 문장에 PANPOP 단어만 넣지 말 것.

### 4.3 Echoes of Joseon (조선의 울림)
정체성: Traditional First → EDM Second. 국악으로 EDM을 만든다. 100–110 BPM.
제목: 원제 글자 그대로. 번역·개명 금지.
개사: 한 60 + 영 40, 한 줄 안에서도 섞음. Hook 3회 이상 직접 기입. Male English Rap 필수.
구조: Intro / V1 / Pre / BUILD / DROP / Chorus / V2 / Rap / BUILD2 / DROP2 / Final / Outro
드롭: 0.5–1초 긴장 → 베이스+국악타악 → 0.3초 내 태평소/아쟁. 꽹가리=긴장, 징=여운. 현대 신스 리드 금지.
썸네일: 한복 여성 필수 + 갓 쓴 무사. 조선 밤·달빛. Edition은 곡마다 새로.
감성 한줄: 한국어.
유튜브 장르: Echoes of Joseon
수노: 저장본 999자.

### 4.4 Latin Afrobeats EDM
정체성: 밝은 메이저. 여름·네온·페스티벌. 114–118 BPM.
제목: 원제 유지. [LKE]는 유튜브에 안 넣음.
개사: 서사·상징 유지, 톤만 밝게. 고독·절망·비/눈/찬바람 중심 금지. 한국어 몸통 + 영어 훅 1–2줄. 후렴 반복 직접 기입.
구조: Bass Intro / Groove Build / V1 / Pre / Chorus / V2 / Pre-Drop / Chorus / Dance Break(연주) / Energy Build / Final / Outro
보컬: 밝고 귀여운 여성.
썸네일: 밝은 여성, 네온·해변·페스티벌.
유튜브 장르: Latin Afrobeats EDM
수노: 저장본 747자.

### 4.5 EDM K-POP Club Remix
정체성: 노래가 아니라 클럽 무기. 베이스가 주인. 120–128 BPM. 0–2초 즉시 드롭.
제목: 원제 유지. 아웃트로용 영어 제목 토큰만 추가 가능.
개사: 영어 남성 챈트 90%. 한 줄 3–6단어. Verse/Chorus 스토리 금지. 가사에 EP 번호 금지.
강제 맵: Intro 남성 TITLE+RESET NOW → 즉시 드롭 → 드롭 2–4회 → 그루브 → Fake GO-STOP-DROP → 변주 → Mini Drop → Dance Break 32–48마디 → Super Build → Super Drop → 여성 한국어 Anti Drop 2–3줄만 → Final Mega Drop 떼창 → Outro 15초+ REBORN / RESET COMPLETE / TITLE
떼창 최소 1세트.
썸네일: 클럽·페스티벌, 강대비, 볼드 산세리프.
유튜브 장르: EDM K-POP Club Remix
보조: Bass Drop Version
수노: 저장본 908자.

### 4.6 Dreamy Deep House
정체성: 잠들기 전 흡수. 작은 방. 자극 금지. 65–72 BPM.
제목: 원제 코어 유지.
개사: 한 줄 = 한국어 시작 + 짧은 영어 감정어(번역 커플릿 아님). 섹션당 2–4줄.
강제 구조: Intro / Verse 1 / Soft Build / Break / Verse 2 / Emotional Peak / Outro. 모든 섹션에 (영어 사운드 지시).
보컬: 남성 only. 수노 믹스는 가깝고 낮은 톤. 여성 리드 금지. 피아노가 맑게 앞.
썸네일 예외: 공간 우선. 어두운 방·창빛·물·별. 사람 없어도 됨.
유튜브 장르: Dreamy Deep House
수노: 저장본 906자.

### 4.7 Fantasy Ambient EDM
정체성: 세계에 들어가는 음악. SPACE > EMOTION > SCALE > RHYTHM. 70 BPM. 킥 그루브 없음.
제목: 원제 그대로.
개사: Fantasy Language only. 한/영 가사 금지. 원곡 구호·이름콜·욕설 남기지 않음. Light 모음훅 / Dark 자음훅은 EP마다 새로.
보컬: 여성=빛 속삭임, 남성=어둠 속삭임. 허밍은 공간 레이어.
드롭: 에너지 웨이브. 킥 임팩트 아님.
썸네일: 실사 50 + 판타지 50. 제목 정중앙 고정. 날개·뿔·애니 금지. 감성 한줄은 영어.
유튜브 장르: Fantasy Ambient EDM
수노: 저장본 874자.

### 4.8 Groovy airy POP
정체성: 공기감 일렉트팝 + 힙합 그루브. 노래보다 리듬 발화. 92 BPM, behind the beat.
제목: 영어 작품명 새로. 직역 금지. 확정 후 고정.
개사: 영어 spoken-word / rap cadence. 짧은 토막 문장. phonetic hook. Rap 섹션 필수. 전통 가창 금지.
보컬: raspy airy 여성 + vocal fry.
썸네일: 여성 1인, 밤 도시·창가·청보라. 감성 한줄 영어.
유튜브 장르: Groovy Airy POP
수노: 저장본 890자.

### 4.9 Narrative Piano Indie
정체성: 긴 시집. 피아노가 감정, 가사가 이야기. 80–92 BPM.
제목: 영어 인디 작품명 새로. 직역 금지.
개사: 영어 관찰형. 서사 순서 유지. 운명·폭발·영원·클라이맥스 말 금지.
구조: Intro 피아노 / V1 / (Pre) / Chorus / V2 / Piano Solo / Bridge / Chorus / Outro
보컬: 친밀, 고음 폭발 없음.
썸네일: 1인 담담, 창가·실내·여백. 에디토리얼 세리프.
유튜브 장르: Narrative Piano Indie
보조: Indie POP Edition
수노: 저장본 463자.

---

## 5. 썸네일 기본 맵

| 장르 | 레이아웃 | 주인공 | 세계 | 글씨 |
|---|---|---|---|---|
| 오리지널 4종 | 텍스트 중심 | 보컬 구성 | 곡 장면 / 실사 100 | 아이보리 세리프 |
| 조선 발라드 | 텍스트 중심 | 조선 귀족 여성 | 한옥 달빛 | 고전 세리프 |
| PANPOP | 다이나믹 | 현대 한복 여성 | 블랙+골드 | 볼드 시네마틱 |
| Echoes | 텍스트+인물 | 한복 여성+무사 | 조선 밤 | 전통 에디토리얼 |
| Fantasy | 제목 정중앙 | 빛/어둠 | 50/50 | 얇은 몽환 |
| Groovy | 텍스트 중심 | 여성 1인 | 밤 도시 | 에어리 산세 |
| Dreamy | 공간 우선 | 선택 | 어두운 방 | 얇은 미니멀 |
| Club Remix | 에너지 | 클럽 인물 | 강대비 | 기하 볼드 |
| Latin | 캐릭터 | 밝은 여성 | 네온 페스티벌 | 트렌디 산세 |
| Narrative | 텍스트 중심 | 1인 담담 | 창가 여백 | 에디토리얼 세리프 |

실사용 후 수정 가능. 수정 전엔 이 표가 기본값.

---

## 6. 제목 결정표 (충돌 정리)

| 장르 | 제목 |
|---|---|
| K-POP | 원제 유지 |
| J-POP / POP / Thai | 해당 언어 번역 |
| 조선 발라드 | 새 한글(한문), 장부 우선 |
| PANPOP | 원제 유지, 훅 실패 시만 개선 |
| Echoes / Fantasy / Latin / Club / Dreamy | 원제 유지 (Fantasy·Echoes는 철자까지 고정) |
| Groovy / Narrative | 새 영어 작품명 |

---

## 7. 실행 한 줄

단곡:
`EP.{번호} / {장르}`

10곡 묶음. 단곡 패키지를 10번 만들지 않는다:
`Act.{n} / EP.{a}~{b} / {장르}`

선택 순서:
ACT → 그 ACT의 EP 목록 → 장르
ACT + 장르만 = 플레이리스트
ACT + EP + 장르 = 단곡

블록별 잠금:
메인에 확정/재생성 버튼을 두지 않는다.
각 코드블럭 옆에만 [잠금] [재생성] [요구사항].
기본은 잠금. 자물쇠를 열어 잠금을 푼 뒤에만 재생성과 입력이 된다.

묶음 출력:
1. 묶음 요약
2. 수록곡 목록 (EP + 확정 제목만)
3. 썸네일 프롬프트
4. 유튜브 제목 ≤100
   `Act.{n} Playlist EP.{a}~{b} | {감성 한줄} | {장르} | AI Artist Noa`
5. 영상 설명란
6. 오리지널 시리즈만 커뮤니티 글

묶음에 곡별 가사·수노 전문 금지.
썸네일 텍스트: 좌상단 Act.N / 중앙 Playlist EP.x~EP.y / 아래 감성 / 아래 장르. 트랙리스트를 이미지에 넣지 않음.

조선 발라드 Act 기본:
Act.1 EP.01–10 / Act.2 EP.11–20 / Act.3 EP.21–30 / Act.4 EP.31–40


---

## 8. Distinct — 당신의 이야기, 우리의 음악

EP 번호 금지. ACT 금지.
입력: 곡 제목 + 가사 (+ 선택 장르)
실행 예: `사연곡 / 제목: ...` + 가사

출력만:
1. 썸네일 이미지 + Gemini 영어 프롬프트
2. 유튜브 제목 ≤100
3. 설명란 + 해시태그
4. 별무리 편지
수노는 요청 있을 때만.

브랜드 문구(썸네일 4·5순위, 제목보다 작게):
당신의 이야기, 우리의 음악 🎧
오늘의 사연이 음악이 됩니다

여자 주인공 필수. 얼굴 가림 금지. 실사 + 아주 약한 빛만.
설명란에 가사 전문 금지. 이야기 2-4줄 요약.
