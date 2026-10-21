# NOA STUDIO 2.0 — P0 후속 운영 검증 (2026-10-21)

검증 종료: 2026-10-21 22:24:34 KST. 마지막 완료 지점부터 이어서 확인했다. GitHub 코드, 실제 운영 서버, 실사용 검증을 구분한다.

| 항목 | 실제 확인 결과 |
|---|---|
| GitHub 최신 기준 | `827b46b71112db66b09490e3d78f232b3a70daa5` (공개 QA 변경까지, 보고서 커밋 제외) |
| 운영 UI 기준 | `a6d9c63eb8c139773a1258b71c1bcf59c89cd4dc` |
| JUKEBOX 통합 | PR #22 병합 완료, `fe8a43cc9a5f54ad6c878b91b7ecccc865413c1b` |
| 전체 운영 파일 대조 | 매핑 259개 전부 SHA-256 일치, missing/different 0 |
| 현재 main 미배포 | 감사 범위 내 0개. 기존 9개 음악 운영본 차이도 main 통합 후 해소 |
| 최근 실제 운영 반영 | 아래 UI 7개. 이번 감사에서는 이미 일치한 파일을 재업로드하지 않음 |
| 홈 TOP 10 | 추천·EP·사연곡·커버곡·플레이리스트 각각 10개. 사연·커버·플레이리스트 카드 30개, 링크 30개 고유 |
| NOA WORLD | 공식 MV 카드 30개. 실제 YouTube 영상·음성 출력은 미검증 |
| PC·모바일 | 최신 공개 Chrome 검사 390/1280 통과. UI 배포 검사 320/390/768/1280 통과 |
| 실제 음악 | 공개 원본 음원 20개, verified 20개. 양 화면에서 재생 시간 증가·비무음 신호·206 Range 응답 확인 |
| 데이터 보존 | 원본 문서 654개 해시 이전과 일치, 회원 2명. 감사 SQL 쓰기·worker 중단 없음 |
| 관리자 SQL | 익명 403 확인. 관리자 로그인 후 신규 조회·다운로드는 브라우저 인증 상태 복구 제한으로 미완료 |
| 최종 판정 | **부분 성공** — 현재 main 런타임 반영 완료, 인증 필요 검증·현 전체 DB 복원 시험 미완료 |

## 실제 운영 파일과 백업

웹 루트 `/hosting/noastudio/html` 아래 최근 반영:

- `noa-ui.css`, `noa-ui.js`: 균형 카드 배열, 대표 카드 디자인. 소스 `33e484354168a9170c046d2ef4c805c5127d2944`, 22:00:46 KST 반영.
- `noa-app/home.php`, `noa-app/world-view.php`, `noa-my.php`, `noa-youtube.php`, `noa-catalog.php`: 공유 CSS·JS 캐시 버전 `20261021-balance1`. 소스 `a6d9c63eb8c139773a1258b71c1bcf59c89cd4dc`, 22:09:47 KST 반영.

위 적용은 Work_디자인의 기존 정식 배포 실행과 이번 독립 서버 감사에서 확인했다. 동일 파일을 중복 배포하지 않았다. 두 배포의 운영 해시·변경 목록·코어와 음악 파일 16개 보호 해시는 동반 JSON에 기록했다.

백업:
- 균형 카드: `/hosting/noastudio/noa-deploy-backups/p0-39603649396-1`
- 캐시 주소: `/hosting/noastudio/noa-deploy-backups/p0-39604948546-1`
- 최초 루트 index 원본: `/hosting/noastudio/noa-deploy-backups/root-20261021-39528375168/index.php`

초기 SFTP mkdir 오류의 서버 내부 최초 원인은 여전히 미확정이다. 이번 실제 배포 기록에서는 사전 검사·백업·해시 검증이 성공했다. 기존 백업을 삭제하거나 기존 음악 작업을 재실행하지 않았다.

## 실제 URL 결과

직접 HTTP 확인 및 최신 공개 Chrome 검사 기준:

| URL | 결과 |
|---|---|
| https://noastudio.ai.kr/ | 200, NOA 메인, 새 공유 자산 버전 |
| https://noastudio.ai.kr/index.php | 200, NOA 메인 |
| https://noastudio.ai.kr/noa2.php | 최종 루트 200, 기존 주소 호환 |
| https://noastudio.ai.kr/noa-bridge/home.php | 200, 5영역 각 10개 |
| https://noastudio.ai.kr/noa-world.php | 200, MV 30개 |
| https://noastudio.ai.kr/noa-youtube.php | 200, 렌더링 정상 |
| https://noastudio.ai.kr/noa-music.php | 200, 실제 MP3 재생·비무음 출력 |
| https://noastudio.ai.kr/noa-my.php | 200, 익명 화면 |
| https://noastudio.ai.kr/noa-catalog.php | 200 |
| https://noastudio.ai.kr/bbs/login.php | 200, 로그인 폼 |
| https://noastudio.ai.kr/noa-bridge/taxonomy.php | 최초 503, 후속 200: 카테고리 5개·영상 610개. 일시 오류 기록 유지 |
| https://noastudio.ai.kr/noa-app/database/ | 익명 403, 권한 차단 |
| https://noastudio.ai.kr/noa-app/jukebox/ | 익명 403 |
| https://noastudio.ai.kr/noa-app/jukebox/download.php | 익명 샘플 key 요청 403. 관리자 파일 수신 미검증 |

PC 1280 및 모바일 390에서 페이지 오류·가로 넘침·보이는 이미지 로딩 실패 0. 실제 MP3 샘플 길이 190.88초, 재생 시간 약 2.19/2.29초, 음성 RMS 0.05085/0.06356, Content-Type audio/mpeg, Range 206. 검증은 소프트웨어 화면 폭 기준이며 물리 Android 기기 검증이 아니다.

카드 균형 검사는 관측 공개 카드를 브라우저 메모리에만 복사한 33개 경우를 포함한다. 대표형·순서·너비·메뉴 제외·재생 동작은 UI 배포 검사를 통과했다. 관리자 화면 fixture를 실제 관리자 로그인 검증으로 취급하지 않는다.

## 음악 작업·DB 보호 및 남은 항목

22:23:22 KST 읽기 스냅샷: 업로드 이력 78개(ready 68, failed 9, uploading 1), 현재 곡 집계 ready 31·failed 1·uploading 1. 과거 시도와 QA 이력이 포함되므로 공개 음원 수와 다르다. Work_뮤직의 진행 중 worker·업로드를 종료·초기화하지 않았다. 본 감사는 claim/import/maintenance/SQL 변경을 호출하지 않았다.

원본 문서 SHA-256: `79661fa849e474a534b69d836a46498fbc9d62c3848f3445490c375cf8beffa9`.

최신 기존 SQL 백업 `/hosting/noastudio/noa-db-private/d54c43955754a84d1fca3778345f37a0.sql`: 125,043,833 bytes, SHA-256 `91759bcd8bb5b8bdc5ac43653646587b3b0b253ed05c05eebcff81fe8e3fdc01`, 실제 파일 크기·스트리밍 해시 재검증 통과. 56개 테이블 시점의 백업이며 restoreVerified=false. 현재 전체 테이블·큐를 포괄한 새 전체 백업과 격리 복원 시험은 여전히 미완료다. 운영 DB 복원이나 새 인증 우회 경로를 만들지 않았다.

로그인·로그아웃 후 세션/권한 유지, 실제 최고관리자 작업실·SQL 조회·MP3 다운로드는 브라우저가 인증 상태를 안전하게 복구할 수 없다고 응답해 미완료다. 다른 Work의 로그인 세션을 종료하거나 재인증을 반복 요구하지 않았다.

YouTube 실제 재생은 앞선 봇 확인 차단 이후 재시도하지 않았다. 최신 검사는 직접 호스팅 MP3·히어로 영상, 화면·카드·경로 검증으로 구분했다.

미병합 PR #4(분류), draft #1(기존 Node 저장)은 적용하지 않았다. 해당 Work의 미완성 변경이나 확정 SQL 분류를 덮어쓰지 않았다.

## GitHub 변경과 검증 증거

이번 Work_배포는 운영과 일치한 코드를 재배포하지 않고 감사·검증 자동화만 갱신했다:
- 전체 감사 실행의 동시성 그룹을 읽기 전용으로 분리하여 음악 배포의 대기 작업을 밀어내지 않도록 변경: `0786ceca71f4d3b46dbe01b7acca071fdda519d3`
- 공개 QA는 이전 YouTube 차단을 기본 재시도하지 않고 실제 MP3 시간·음성 신호·206 응답을 성공 조건으로 강화: `fcfddb5592d714fcb4edca61bf2e96cc9cb0aa9a`, `827b46b71112db66b09490e3d78f232b3a70daa5`

- [균형 카드 정식 배포](https://github.com/rucyjeon79/noa-studio/actions/runs/39603649396)
- [5개 화면 캐시 갱신·4폭 운영 검증](https://github.com/rucyjeon79/noa-studio/actions/runs/39604948546)
- [259개 운영 파일 해시·원본 데이터·SQL 백업 감사](https://github.com/rucyjeon79/noa-studio/actions/runs/39606931803)
- [최신 PC·모바일 실제 MP3 출력 검증](https://github.com/rucyjeon79/noa-studio/actions/runs/39607314662)
- [QA 변경 후 기존 품질 검사](https://github.com/rucyjeon79/noa-studio/actions/runs/39607308733)

전체 파일별 실제 SHA-256·크기·수정 시각은 [51-p0-resumed-production-state-20261021.json](51-p0-resumed-production-state-20261021.json)에 보관했다.
