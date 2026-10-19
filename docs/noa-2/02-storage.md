# 2. 현재 데이터와 저장 구조

`data/live` JSON 716개. 파싱 실패 0. 최상위 `rev`가 있는 파일 0.

| 위치 | 파일 수 | 역할 |
|---|---:|---|
| `곡/` | 653 | 곡·ACT·사연·커버 |
| `사용자설정/` | 16 | 공통 1, 장르 15 |
| `원곡정보/` | 40 | K-POP EP 01–40 |
| `앱관리/` | 6 | 확정, 상태, 잠금, 탐색, 자동채우기 |
| `번역/화면.json` | 1 | 화면 문구 121키 |

곡 파일 구성:

| 종류 | 수 |
|---|---:|
| EP 곡, 13장르 × 40 | 520 |
| ACT, 13장르 × 4 | 52 |
| `your-story/기본` | 44 |
| `cover-reborn/기본` | 37 |

곡 파일 최상위는 `genreId`, `ep` 또는 `act`, `title`, `pkg`, 일부 `confirmed`다. 내용 필드는 `pkg` 안에 있다. 키별 존재/값이 찬 개수:

| 필드 | 키 있음 | 값 있음 |
|---|---:|---:|
| confirmedTitle | 653 | 653 |
| lyricsBlock | 601 | 601 |
| sunoUrl | 652 | 491 |
| youtubeUrl | 571 | 415 |
| summary, sunoStyle | 571 | 479 |
| youtubeTitle, youtubeDescription, thumbCast | 571 | 571 |
| geminiPrompt | 571 | 565 |
| thumbUrl | 571 | 54 |
| fanLetter | 519 | 159 |
| audioAnalysis | 653 | 2 |
| audioLevel | 653 | 3 |
| mvUrl | 1 | 0 |
| ytPremium, mvPremium | 0 | 0 |

저장 경로:

1. 공식 파일: `data/live/**/*.json`. 화면 저장은 `saveResultFields`, `saveStudioPages`, `saveCommonPref`, `saveGenrePref`로 이어진다.
2. 복제본: PGLite `studio_pages`. 파일이 있으면 파일을 먼저 읽는다. DB가 파일을 역으로 덮으면 안 된다.
3. 중복 상태: `앱관리/확정.json` 63키와 곡 파일 `confirmed` 63건은 같은 대상을 가리킨다. `앱관리/상태.json`의 `confirmed`도 63건이다.
4. 유튜브: 상태 목록 402키와 곡 파일 주소가 맞은 399건은 값이 같았다. 값이 다른 충돌은 0이었다. 곡 파일에만 있는 주소가 16개다. 이 숫자는 합치지 않았다.
5. `자동채우기.json`은 JSON null이다. `잠금.json`은 빈 객체다.
6. 브라우저: 음원 저장 위치용 IndexedDB `noa-wav-save`. 곡 본문의 원본은 아니다.
7. Google Drive: 이 대화의 업로드·검색 도구는 연결되어 있다. 앱은 곡 JSON을 Drive에 저장하지 않는다. Drive를 운영 DB로 쓰지 않는다.

현재 저장 오류의 구조적 원인: 파일, `studio_pages`, `상태.json`이 같은 곡의 주소를 따로 갖고, 파일에는 버전 번호가 없다. 2.0에서는 MySQL 행의 `rev`만 저장 기준으로 둔다. 이번 분석에서 운영 JSON은 수정하지 않았다.
