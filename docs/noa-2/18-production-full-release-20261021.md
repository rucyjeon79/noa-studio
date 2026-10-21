# NOA STUDIO 2.0 운영 미배포 조사 및 배포 결과 — 2026-10-21

정식 운영 도메인: https://noastudio.ai.kr
담당: Work_배포 단독
최종 판정: **부분 성공 — main의 확인된 운영 미반영 13개 파일은 배포 성공. 미완성 기능 및 실재생 미검증은 별도 미완료.**

## GitHub와 실제 서버 반영 구분

- 기능 코드 기준 main: `b6638e9cdbff7ca05c0ea8bc9869befc8a0e4e0b`.
- 실제 배포 checkout: `1d3379cbbfc345174e6bb4b8ff7e7d1dc9dca6b0`.
- 운영 검증 workflow checkout: `367902cdf6e19aa4eb7390e192ef70f320f10ce1`.
- 기능 기준 이후 차이는 조사·배포·검증 스크립트와 workflow 6개뿐이다.
- 배포 완료 시각: **2026-10-21 03:34:01 UTC / 12:34:01 KST**.
- 조사: https://github.com/rucyjeon79/noa-studio/actions/runs/39538542668
- 실제 SFTP 배포: https://github.com/rucyjeon79/noa-studio/actions/runs/39538972614
- PC·모바일 운영 검증: https://github.com/rucyjeon79/noa-studio/actions/runs/39539347201

## 조사 범위와 충돌

현재 운영으로 매핑되는 deploy의 상위 파일, noa-app 모듈, NOA 테마, bridge PHP, 기존 배포 자산 및 결정적으로 생성되는 카탈로그 번들 등 230개 대상을 원격 SFTP 바이트의 SHA-256·크기·수정 시각으로 비교했다. 과거 보관용 deploy/noastudio Node 프로젝트는 현재 PHP 운영 대상에 포함하지 않았다.

| 상태 | 파일 수 |
|---|---:|
| 배포 전 동일 | 217 |
| 배포 전 버전 상이 | 7 |
| 배포 전 없음 | 6 |
| 이번 실제 반영 및 업로드 후 SHA-256 확인 | 13 |
| 발견한 13개 중 반영 미완료 | 0 |

기존 7개는 모두 main 이력에서 확인된 버전으로, 미확인 운영 변경 충돌은 없었다. 적용 직전 원격 파일을 다시 읽어 변경 여부를 검사하고, 기존 파일의 백업 해시 확인 후 교체했다. 공통 초기화·인증·DB 설정 파일의 보호 해시를 확인했다. 파일 배포만 수행했고 SQL 마이그레이션·import·초기화는 실행하지 않았다.

## 이번 변경 파일

| 실제 운영 경로 | 적용 | 적용 후 SHA-256 |
|---|---|---|
| `/hosting/noastudio/html/noa-app/home.php` | 교체 | `556f3f8c9b643f3525b443bb602eaca0316f3d10a7a4a43a376108fa40ed56c5` |
| `/hosting/noastudio/html/noa-app/world-view.php` | 신규 | `24f1841f932b9773d63a40f57ea02ac7ccedd3e59311803d5692621fcf758bee` |
| `/hosting/noastudio/html/noa-bridge/home-core.php` | 교체 | `3069fd408b0eaf08f19748dc656e112c372e5676db07afd4dabe5fe3bc56dad3` |
| `/hosting/noastudio/html/noa-bridge/home-store.php` | 신규 | `735700835846bde58c4dd4dc017f086eed7bd16048bd2d53601c3c7807b68dee` |
| `/hosting/noastudio/html/noa-bridge/home.php` | 교체 | `a68e156f93a2b6decba5602ccd5d673842ef3b798691f2209ca73c27b4f34c97` |
| `/hosting/noastudio/html/noa-bridge/world-mv.php` | 신규 | `778e55d7d37d3115230cecd7c5f6e6cf8e39ce757a97e84b210ce8bb9f026adf` |
| `/hosting/noastudio/html/noa-bridge/world-story.php` | 신규 | `ab5b38cef929b7df4017dd874aafe71435caede96e04e569a5397dd53787472e` |
| `/hosting/noastudio/html/noa-home.js` | 교체 | `3702ba8d6894aa3dd6518033637755ca7f7b8db582a3725b1babe1b7544f3512` |
| `/hosting/noastudio/html/noa-icon.svg` | 신규 | `1706a8e989eed842d84489d13c8277df7d2481018777d0996e1511a49ecbd221` |
| `/hosting/noastudio/html/noa-world.css` | 교체 | `cfbd141a702323ced6975d96567a25b4ac88dde9daed43b2d60ec80fefba2c7f` |
| `/hosting/noastudio/html/noa-world.js` | 신규 | `d8d5eaed1e8b7ffc493129dec8f97977dd3c424f055ab325b7b68832ac342fa0` |
| `/hosting/noastudio/html/noa-world.php` | 교체 | `24f40f7cb1b9c5a03813be160b0b8e5d0922461eb4dd7d85c114018f2a5edb24` |
| `/hosting/noastudio/html/noa2.php` | 교체 | `5bd92117087c56b66287d1c2dcdc39d2aa91021e3cde1bd98636e245ebf1221c` |

루트 index.php와 extend/noa.home.php는 이미 앞선 정식 배포에 적용되어 이번 조사에서 동일함을 확인했다. index.php → common.php 초기화 → noa-app/home.php 구조가 유지된다. noa2.php는 호환 주소이며, 실제 요청은 루트로 이동한다. 루트에서 noa2.php로 강제 이동하지 않는다.

## 백업과 복원

- 이번 기존 파일 7개 및 신규 여부 manifest: `/hosting/noastudio/noa-deploy-backups/full-20261021-39538972614`.
- 기존 루트 index.php 원본: `/hosting/noastudio/noa-deploy-backups/root-20261021-39528375168/index.php`.
- 기존 전체 DB 백업: `/hosting/noastudio/noa-db-private/`, 생성 2026-10-21T02:01:36+00:00, 125,000,300 bytes, 56개 테이블.
- DB 백업 SHA-256: `6dac39d8fe1b14a53a6ba198d9374edb0d8b6c6b8b785dfc3a64699fecc31a3c`.
- 관리자 화면에서 기존 백업의 SHA-256 무결성을 실제 재검증하여 성공했다. restoreVerified 표시와 기존 격리 복원 검증 기록(56개 테이블·23,660행)을 확인했다. 이번 파일 배포 중 운영 DB 복원을 실행하지 않았다.
- 배포 스크립트는 교체 실패 시 기존 파일 복원, 신규 파일 제거를 지원한다. 이번에 복구 실행은 필요하지 않았다.

## 실제 검증

### 루트 및 주요 URL

| URL | 실제 결과 |
|---|---|
| https://noastudio.ai.kr/ | 200, NOA STUDIO 홈 직접 표시 |
| https://noastudio.ai.kr/index.php | 200, 동일 메인 |
| https://noastudio.ai.kr/noa2.php | 최종 루트 200, 기존 링크 호환 |
| https://noastudio.ai.kr/noa-bridge/home.php | JSON 정상, 각 영역 10개 |
| https://noastudio.ai.kr/noa-world.php | 공식 MV 30개, ACT 4개 링크 |
| https://noastudio.ai.kr/noa-youtube.php | 200 |
| https://noastudio.ai.kr/noa-music.php | 200, 카탈로그 및 곡 상세 확인 |
| https://noastudio.ai.kr/bbs/login.php | 200, 로그인 폼 표시 |
| https://noastudio.ai.kr/noa-app/database/ | 최고관리자 세션 허용, 익명 403 |
| https://noastudio.ai.kr/noa-ai-lab.php | 관리자 화면 허용, 익명 403 |

1280px PC, 390px·320px 모바일에서 검증 workflow가 모두 성공했다. 홈의 30개 카드 제목·href를 API와 대조하고, 순위 지표 내림차순, 모든 썸네일 decode/naturalWidth, 가로 넘침을 확인했다. PC·모바일 화면 증거와 JSON은 위 검증 실행의 artifacts에 저장했다. JS/PHP 구문 및 관련 데이터·세계관·SQL grammar·재생 상태 테스트도 통과했다. 검증 대상에서 PHP 오류·HTTP 500·404·페이지 오류는 발견되지 않았다. 서버 전체 과거 오류 로그가 모두 없다고 단정하지 않는다.

### 홈 TOP 10

| 영역 | 배포 전 문서 기록 | 실제 배포 후 API·화면 |
|---|---:|---:|
| 사연곡 | 1 | 10 |
| 유명곡 커버 | 0 | 10 |
| 플레이리스트 | 1 | 10 |

홈 API 수집 run `919a87072ef27926264d1d7e1f2dc68c`, 수집 시각 `2026-10-20T17:36:24+00:00`는 관리자 SQL의 noa_youtube_runs 최신 행과 일치한다. 조회수는 이 수집 시점 값이며 YouTube 현재 실시간 조회수라고 보고하지 않는다. 개별 카드와 영상·재생목록 링크, 프록시 썸네일 모두 확인했다. 캐시 URL은 main의 home-data 버전 및 새 world CSS/JS 버전으로 반영됐다.

### NOA WORLD

공식 playlist `PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY`의 공개 MV 30개, EP.1–30 정렬, Noa·Noel 캐릭터, ACT.1–4 소개 및 각 라우트를 확인했다. 다음 정상 수집 run을 읽는 구조는 배포됐지만 이번에 새 영상을 추가·수집하는 실험은 하지 않았다.

EP.1을 실제 클릭하여 공식 YouTube iframe과 영상 메타데이터(2:49)를 확인하고 재생 버튼을 눌렀다. 이 브라우저에서 video.currentTime=0, readyState=0에 머물렀으므로 영상·음성 스트리밍 성공으로 판정하지 않았다. 종료 시 iframe=about:blank 확인했다. 공식 목록 확인과 곡 catalog 연결은 별개이며 30개 카드에 곡 연결 보완 필요 표시가 남아 있다. ACT 본문은 공식 완성 소설이 아닌 소개 초안이다.

### SQL 관리자·데이터 보존

최고관리자 기존 세션에서 MySQL 8.0.46, 56개 테이블, 곡 605개·문서 654개·회원 2개·설정 1개를 확인했다. 읽기 전용 SQL, 최대 3초 제한, 테이블 목록·구조 조회, SELECT 실행 결과와 실행 기록을 확인했다. 익명 접근은 403이었다.

실행한 SELECT:
```sql
SELECT genre_id, COUNT(*) AS songs FROM noa_catalog_songs GROUP BY genre_id ORDER BY genre_id
SELECT run_id, created_at FROM noa_youtube_runs ORDER BY created_at DESC LIMIT 1
```

장르 집계는 16행이며 unclassified 3개가 남아 있다. 기존 1차·2차 카테고리 저장 필드는 없다. 기존 로그의 차단된 변경 SQL 기록은 이전 검증 기록이며 이번 조사에서 변경 SQL을 보내지 않았다.

### 로그인·음악·JUKEBOX·AI LAB

- 기존 최고관리자 회원 세션과 권한이 계속 유효함을 확인했다. 이번 검사에서는 새 로그인·로그아웃을 반복하지 않았다. 익명 로그인 폼·관리자 차단은 별도로 확인했다.
- 공개 음악 카탈로그 544개·ACT 52개, EP.01 하루의 끝에 상세·가사 및 실제 재생 상태 안내를 확인했다.
- Suno 공유 주소 491개, 실제 음원 파일 0개. JUKEBOX 고음질 오디오 실재생은 완료되지 않았다. 기존 결손을 정상으로 보고하지 않는다.
- AI LAB 화면·라이브러리 로드·실행기 상태·YouTube 연결은 확인했다. 영상 모델과 홍보 문구 AI는 연결 필요 상태다. 유료 제작·외부 게시 실행은 수행하지 않았다.

## 미완료 및 다른 Work 인계 사항

파일 미배포 13개는 해소했지만 아래 기능·실사용 검증 5영역이 남아 전체 완료 판정은 보류한다.

| 영역 | 상태·원인 | 필요한 후속 작업 |
|---|---|---|
| 자동 카테고리 | 개발 미완료, MySQL에 요구된 1차·2차 저장 체계 없음 | Work_데이터: schema·mapping·예외 검토 및 백업을 포함한 별도 마이그레이션 제안. 승인 전 SQL 변경 금지 |
| 원본 음원·JUKEBOX | 원본 파일 0개, 공유 URL만 존재 | Work_음악: 사용 가능한 실제 파일 연결 및 고음질 실재생 검증 |
| AI LAB 제작 | 영상 모델·홍보 AI 미연결 | Work_AI: 승인된 API 연결 및 제작 작업 검증 |
| 세계관 완성도 | 소개 초안, 공식 MV와 catalog 곡 매칭 미완료 | Work_세계관/데이터: 정식 본문 및 곡 ID 매칭, 다음 정상 수집 후 자동 반영 검증 |
| 공식 MV 실스트리밍 | iframe 정상, 현재 브라우저에서 재생 시간 미진행 | 실제 미디어 다운로드·시간 진행·음성 재생 추가 검증 필요 |

미병합 PR 2개는 배포하지 않았다:
- #4 chatgpt/playlist-sync-20261021, head `368af6b25141a08f23e2179058964ceb84221999`: 홈 playlist 제목 인식 정규식 2곳의 변경. 요구된 MySQL 계층 분류 구현이 아니다.
- #1 draft fix/noa-save-reliability-20261020, head `d6861439e0189230726338c151e9a140066b0f0d`: 별도 개발 변경. 다른 Work의 미병합 코드를 병합·초기화하지 않았다.

## 오류·조치

초기 조사에서 호스팅 SSH CLI 해시 probe가 지원되지 않아 조사 실행이 실패했다. 임시 probe를 정리하고 SFTP로 파일 자체를 읽는 방식으로 수정하여 조사 및 배포가 성공했다. 운영 앱 교체 실패·복구 실행은 없었다. 실제 스트리밍·원본 음원·모델 연결 미확인은 위 미완료로 분리했다.
