# NOA STUDIO 2.0 P0 운영 배포·검증 결과 — 2026-10-21

**판정: 부분 성공.** 검증된 UI 13개 파일과 캐시 주소 갱신은 실제 닷홈 배포 완료. Work_뮤직의 진행 중인 운영본 9개는 보존했으며, 관리자 실사용·YouTube 실스트리밍·최신 전체 DB 복원 검증의 남은 범위를 아래에 명시한다.

| 항목 | 실제 결과 |
|---|---|
| 정식 서비스 | https://noastudio.ai.kr |
| 웹 루트 | `/hosting/noastudio/html` |
| 시작 기준 main | `018335cb6242f0a352ac7e564bc063f018d5bb9e` |
| 최종 보고 기준 main | `3cbf424e13092af27947ceda311cee31e4f78342` |
| UI 운영 적용 소스 | `7305901f00616399c4a1f725bb0015edac3d39c0` |
| 캐시 운영 적용 소스 | `a3ae861de42468fed3ed3cb068958d194e6ff8eb` |
| 전체 서버 비교 소스 | `38c6e662d84e8bd15fa5c4f162753af5a4161798` |
| 미반영 발견·최종 적용 | UI 13개 / 13개. 캐시 변경 4개는 이 13개에 포함 |
| UI 배포 완료 | 2026-10-21 20:55:20 KST |
| 캐시 배포 완료 | 2026-10-21 20:59:20 KST |
| 최종 데이터·백업 확인 | 2026-10-21 21:05:40 KST |
| 최종 257개 매핑 비교 | 248개 main 일치 / 9개 Work_뮤직 브랜치 운영본 보존 |
| 본 배포의 SQL 변경·작업 종료 | 없음 |

보고 기준 main과 전체 비교 소스 사이의 차이는 검증 workflow 및 배포 자동화다. 운영 PHP·JS·CSS의 차이는 없다. 이번 검사는 main의 실제 배포 매핑 257개를 대상으로 원격 바이트 SHA-256·크기·수정 시각을 기록했다. 원격 업로드 음악과 DB 데이터는 별도로 읽기 검증했다. 보관용 과거 Node 프로젝트를 PHP 운영 구조로 배포하지 않았다.

## 실제 서버 반영 파일

아래 경로의 공통 앞부분은 `/hosting/noastudio/html/`이다. 모두 최종 운영 바이트와 main 바이트가 일치한다. 전체 파일별 원격 수정 시각은 동반 JSON의 `inventory.rows[].deployed.mtime`에 Unix 시각으로 기록했다.

| 운영 경로 | 바이트 | 실제 운영 SHA-256 |
|---|---:|---|
| `noa-app/home.php` | 7365 | `b71847337263b261b52dfc0f29bcb9d732879b729cb76a32d82c4c3d2c5f4f03` |
| `noa-app/world-view.php` | 10694 | `5bf0ac9bddcded41a6cbf39f92993f51730e82ffbb70ccb6c7e4439063215fd8` |
| `noa-bridge/home-core.php` | 9890 | `fedfd0d9a51076f336900bd3a8fc8691d2bfb9a89eaf408c9684cda0088947e7` |
| `noa-browse.js` | 9230 | `a6e46dd34937dd630a0c0d372166a6e1783e158ffcac29d56eca7968271ead41` |
| `noa-hero.js` | 2543 | `91adf9deb8863361e05f82d16394f425e10e3e01af655ed9a149fa4bfb881688` |
| `noa-home.js` | 3297 | `c13249041a1c92f0082d3f32bb1a8da4001035e4ccd2bd94f265992e38685bf8` |
| `noa-my.php` | 3938 | `76dcd7690455a1dcf831eda7337b8cceb9572a8e691dbf233bf4cc0200423806` |
| `noa-ui.css` | 26307 | `88b34df5e475d8ad9c368c9e6d3790565cf86f5973b70590f15ae6f6ca1f2de7` |
| `noa-ui.js` | 14186 | `3197d8bc053619393dc709fbdad3e680f2f0f9964a8c0c0bf24bb97b95bbc336` |
| `noa-world.css` | 5387 | `8af747a5ed369fce9c58f9c8f52fba68d3656270b50b1fc5a6d2e90a4da7dcf8` |
| `noa-world.js` | 2704 | `7faa60a323c9798ccc0c37ef7d6c10fa4947e43c7a661f1625e4fa39d21aee60` |
| `noa-youtube.css` | 2389 | `20656ecb779cd03c8b75c43de6db8358e505742ca5fd6c6de017e4d4ceb908b3` |
| `noa-youtube.php` | 7815 | `7be27a56650c402c1ab334077f202723df43f91617c9441c634fefce0615d365` |

`index.php`와 그누보드 공통·인증 파일은 교체하지 않았다. 루트에서 common.php 초기화 후 noa-app/home.php를 호출하는 구조가 유지된다. `/noa2.php`는 기존 링크 호환 주소다. 음원 파일·카드 원본 이미지·업로드/처리 대기열을 이 배포에서 조작하지 않았다.

캐시 버전은 홈·세계관·MY·YouTube의 참조를 `20261021-p0-final`로 갱신했다. 먼저 관련 UI 의존 파일이 모두 운영과 일치하는지 확인한 뒤 4개 PHP 뷰만 교체했다. 음악관 PHP와 JUKEBOX 관련 코드는 보호 대상이므로 이 캐시 배포에서 제외했다.

## 백업·복구 기록

- 성공한 UI 배포의 13개 기존 파일 백업: `/hosting/noastudio/noa-deploy-backups/uiux-20261021-39594832143-1`.
- 캐시 참조 4개 기존 파일 백업: `/hosting/noastudio/noa-deploy-backups/p0-39595679021`.
- 첫 UI 시도 백업: `/hosting/noastudio/noa-deploy-backups/uiux-20261021-39591073647-1`. 영상 검증 실패 후 13개 모두 원래 버전으로 복원됐고 이후 새 검사·보정 버전으로 다시 배포했다. 기존 백업은 삭제하지 않았다.
- index.php는 이번에 교체하지 않았다. 앞선 배포에서 기록된 원본 백업은 `/hosting/noastudio/noa-deploy-backups/root-20261021-39528375168/index.php`다.
- 최신 기존 SQL 백업: `/hosting/noastudio/noa-db-private/d54c43955754a84d1fca3778345f37a0.sql`.
- 생성: 2026-10-21 13:29:07 KST; 125,043,833 bytes; 56개 테이블.
- SHA-256: `91759bcd8bb5b8bdc5ac43653646587b3b0b253ed05c05eebcff81fe8e3fdc01`. 이번 최종 확인에서 실제 SQL 파일을 읽어 해시가 일치함을 확인했다. SQL 내용은 보고 artifact에 저장하지 않았다.
- 이 최신 SQL 백업은 `restoreVerified=false`다. 이전 56개 테이블 백업은 격리 복원 검증 기록이 있으나, 이후 추가된 현재 테이블 전체의 복원 가능성을 이번에 검증한 것은 아니다. 관리자 화면 확인 당시 테이블은 72개였으므로, 후속 SQL 변경 전에 최신 전체 스키마·대기열을 포함한 백업과 복원 검증이 필요하다. 이번 배포에서 운영 DB 복원·마이그레이션·초기화는 실행하지 않았다.

## SFTP 실패 원인 조사와 재발 방지

실패 실행 39585613536에서 직접 실패한 곳은 새 백업 하위 디렉터리의 SFTP mkdir다. 후속 lstat가 FileNotFoundError를 발생시켜 원래 OSError의 원인을 가렸다.

20:10 검사에서 백업 상위 경로는 존재했고 소유자 UID 2297, 권한 0700, 경로 정규화가 정상인데도 새 디렉터리 생성이 거부됐다. 계정 홈에서도 같은 결과였다. 서버 전체 파일시스템에는 여유 블록·inode가 있어 물리 디스크 전체 부족으로 판단할 근거는 없었다. 계정별 quota·호스팅 정책의 내부 오류 이유는 SFTP의 일반 Failure 응답만으로 확정하지 못했다.

20:33:17 KST 재검사에서는 65,541 bytes 파일 생성·쓰기·읽기와 새 백업 폴더 생성이 모두 성공했다. 해당 시점 계정 파일 합계는 1,101,843,841 bytes, 파일 4,766개, 디렉터리 1,061개였다. 기존 파일을 삭제해 공간을 확보하는 조치는 하지 않았다. 일시적 생성 거부가 해소된 상태를 실제 쓰기로 확인했으며, 최초 서버 내부 거부 사유를 용량 초과로 단정하지 않는다.

공통 배포 보호 모듈과 독립 배포·UI 배포기에 다음을 반영했다.

- 상위 경로·정규화·디렉터리 형태 확인, 실제 쓰기·읽기 검증.
- 지원되는 파일시스템 여유 공간 조회. 공유 파일시스템 여유를 계정 quota로 해석하지 않는다.
- 전역 CI 직렬화와 배포 잠금, 원격 바이트 재검사.
- 백업 무결성 확인 전 교체 금지, 배포 후 SHA-256 확인.
- 원인별 차단 코드: BACKUP_PARENT_MISSING, UNSAFE_BACKUP_PATH, BACKUP_MKDIR_FAILED, STORAGE_QUOTA, STORAGE_FULL, WRITE_DENIED, DEPLOYMENT_BUSY, BACKUP_WRITE_FAILED, BACKUP_HASH_MISMATCH 등.
- 변경이 없으면 불필요한 새 백업 생성 생략. 실패 시 기존 백업·작업 상태 보존.
- 백업 경로 실패 무조건 재시도 없음. 보호 모듈 4개 시험과 조건부 복원 5개 시험 통과.

Work_뮤직이 수정 중인 `scripts/noa_jukebox_release.py`와 두 worker 파일은 수정하지 않았다. 해당 경로의 추가 통합은 소유자 작업 완료 후 필요하다.

`cron_read_status=127`은 별도 실행 환경 제약이다. 확인된 처리 환경은 닷홈 PHP 8.2.33 FPM(실행 한도 120초, proc_open 사용 불가)과 GitHub Actions 외부 작업 실행기다. 이 값을 SFTP mkdir 실패의 원인으로 보고하지 않는다.

## 운영 기능 검증

| 항목 | 확인 결과 |
|---|---|
| `/`·`/index.php` | 200, NOA 앱 메인 직접 렌더링 |
| 홈 TOP 10 | 추천 10·EP 10·사연곡 10·커버곡 10·플레이리스트 10 |
| 홈 중복 제거 | 추천 영상과 EP·사연·커버 간 중복 검사 통과. 사연·커버·목록 30개 카드의 고유 링크 30개 |
| 썸네일 | 사연·커버·목록 30개 JPEG 검증 완료. 최초 동시 조회에서 3개 일시 503을 관찰했으며 단건 재확인·디코드 검증에서 모두 200으로 회복. 서버 코드는 이 때문에 변경하지 않음 |
| 홈 원본 영상 | Chrome 실제 H.264 재생, 한 번 재생 후 종료·일시정지 검사 통과 |
| 음악관 | 공개 UI 602곡·52 ACT, 카테고리 탐색·이미지·상세 화면 확인. SQL 관리자 확인 당시 음악 통합 605곡 |
| 실제 MP3 | 공개 API에서 검증된 원본 음원 20개. EP.01 하루의 끝에 재생 시간이 약 2.3초로 진행, readyState 4, 무음 아닌 출력 신호 확인(RMS 약 0.046/0.061) |
| 오디오 HTTP | audio/mpeg, 206, bytes 0-4095/7637805, 4,096 bytes 실제 전송 |
| YouTube | 공식 사연곡 목록 소속·홈 중복 제거·영상/목록 이동 확인 |
| NOA WORLD | 공식 MV 30개, ACT.1–4, EP 챕터 이동, 서로 다른 MV 선택·단일 iframe 전환·닫기 확인 |
| 실제 YouTube 스트리밍 | 이 검증 브라우저가 Sign in to confirm you’re not a bot 응답을 받음. 영상·음성 출력 성공 판정 안 함. 한 번 시도 후 종료·iframe about:blank 확인 |
| SQL 분류 | `/noa-bridge/taxonomy.php`에서 사연곡·커버곡·K-POP 원곡·하위 오리지널/컬렉션 총 5개 분류, 영상 610건 확인 |
| 관리자 세션 | 작업 시작 때 실제 최고관리자 세션으로 DB 상태 화면 확인: MySQL 8.0.46·읽기 전용·3000ms·72테이블·음악605·회원2·설정1 |
| 익명 권한 | SQL 관리자·JUKEBOX 관리자·MP3 다운로드 endpoint 403 |
| 회원·원본 데이터 | 원본 문서 654건의 SHA-256이 배포 전과 동일, 회원 2명 유지 |
| PC·모바일 | 320·390·768·1280px 운영 UI 검사 통과. 390·1280px 별도 최종 실제 이미지·MP3 출력 검사 통과 |
| 화면 오류 | 검사한 페이지에서 가로 넘침·빈 화면·uncaught JS 오류·페이지 500 없음 |

홈 집계 run은 `919a87072ef27926264d1d7e1f2dc68c`, 수집 시각은 `2026-10-20T17:36:24+00:00`이다. 집계 시점 조회수이며 현재 YouTube 실시간 조회수라고 보고하지 않는다. 세계관의 소개 초안 표시는 유지되며 완성된 정식 소설 본문이라고 보고하지 않는다.

최종 확인 URL:

- https://noastudio.ai.kr/
- https://noastudio.ai.kr/index.php
- https://noastudio.ai.kr/noa-music.php
- https://noastudio.ai.kr/noa-world.php
- https://noastudio.ai.kr/noa-youtube.php
- https://noastudio.ai.kr/noa-my.php
- https://noastudio.ai.kr/noa-bridge/home.php
- https://noastudio.ai.kr/noa-app/database/ (시작 시 실제 관리자 세션, 최종 익명 403)

## 진행 중인 Work_뮤직 운영본 보호

최종 main 매핑 257개 중 9개는 운영 버전이 main보다 신규였다. 모두 아래 Work_뮤직 브랜치의 파일별 이력과 SHA-256이 일치했다. 이전 main 파일로 덮어쓰지 않았다. PR #22는 최종 확인 시 미병합이며 head는 `b11deb3c1b89986a53c309aaf47b3209c5323f1f`였다. 이후 진행 중인 소유자 작업에 따라 달라질 수 있다.

| 보호한 운영 파일 | 실제 SHA-256 | 일치한 소유자 브랜치 커밋 |
|---|---|---|
| `noa-app/jukebox/index.php` | `98c1b7ba2298b9c27cfe19262ccc3c52f46686a0faf5b098042faa2b0a912d65` | `51d377acda9bc7ac9f6230093853bab2105744f1` |
| `noa-app/jukebox/operations.php` | `ee57ce3dcd9ca160ef5f3d300c3878d4718ceafa26c2288f7671aed46dd1090e` | `51d377acda9bc7ac9f6230093853bab2105744f1` |
| `noa-app/jukebox/queue-core.php` | `411ba1b3f4d1d9d477eb5c91b1480f5346f1dddcc8938683cb201f9115c3d38e` | `f839c7d7b150c3bc928f3411904ca1f5d7c41bb3` |
| `noa-app/jukebox/service.php` | `779021701ba8eb7c99effd2e03bccacd6ae0afc9396df2aa1261801e367243d8` | `5a90c6a6b7abe5cf2e3686cb1961272ed4c4166f` |
| `noa-app/jukebox/upload-core.php` | `5160d1d1a1294a737a8d7bea817dd5fd6224b7912bf15a6cdc2bd38a60849d3d` | `51d377acda9bc7ac9f6230093853bab2105744f1` |
| `noa-app/jukebox/upload.css` | `e7dbd2df2e48caea432085ab56aac8f14253c1e72e8f137668389e48968551fc` | `f839c7d7b150c3bc928f3411904ca1f5d7c41bb3` |
| `noa-app/jukebox/upload.js` | `a8b85610b43612899875efb9b28047f3ddadef28bce998bb6aa8213b07a9cdfe` | `51d377acda9bc7ac9f6230093853bab2105744f1` |
| `noa-app/jukebox/upload.php` | `2f866110c043407a9045394823da2f041401132c39fb455690a084790ae02c8b` | `5a90c6a6b7abe5cf2e3686cb1961272ed4c4166f` |
| `noa-music.php` | `2593ee05ceb1d6492cfc5d36faafa97d4445aada07febb3f4d03123f3b55f921` | `51d377acda9bc7ac9f6230093853bab2105744f1` |

보호 범위에는 JUKEBOX 전체 앱 폴더, worker/release 스크립트, noa-music.php, catalog API, SQL 업로드·처리 큐, 기존 MP3·카드 이미지가 포함된다. 본 배포에서 job claim/import/maintenance나 대기열 초기화를 호출하지 않았다.

21:04:24 KST 읽기 스냅샷은 업로드 이력 56개, ready 48·failed 7·uploading 1이며 최신 곡 상태 집계는 ready 30·failed 2·uploading 1이다. 검증용 기록과 과거 시도를 포함하므로 실제 공개 곡 수와 구분한다. 원본 음원 공개 20개는 별도 실제 카탈로그 검증 결과다. 처리·업로드는 소유자 작업으로 계속 진행됐으며 본 배포가 종료하거나 초기화하지 않았다. 임시 spool 설정은 읽기 확인 시 512 MiB였다.

PR #4 재생목록 인식 변경과 PR #1 draft 저장 신뢰성 변경도 추가 병합·배포하지 않았다. 개발 브랜치의 신규 파일은 소유자 검증 범위로 남겼으며, main 매핑 감사에 포함되지 않는 파일을 배포 완료라고 보고하지 않는다.

## 오류·복구·남은 사항

1. 최초 SFTP mkdir 거부는 현재 같은 상위 경로에서 쓰기 검사·실제 백업 생성으로 회복 확인. 서버 내부의 최초 제한 이유는 미확정.
2. 첫 UI 배포는 검증용 Chromium의 H.264 미지원으로 영상 검사가 실패하여 13개 모두 정상 복원됐다. 실제 MP4는 HTTP 206으로 정상 전달됐고 Chrome에서 재생됨을 확인했다. Chrome 검증으로 변경했다.
3. Chrome에서 빠른 MV 전환 검사가 클릭 누락을 드러냈다. 미리보기 hit area·지연 이미지 기하 안정화와 프레임/스크롤 준비 검사가 통합된 후 후보·운영 전 폭의 검사가 통과했다. 검사 단계를 생략하지 않았다.
4. 최종 운영 배포와 캐시 변경은 성공했으며, 최종 해시에서 본 배포 13개는 모두 main과 일치한다. 나머지 9개의 소유자 운영본 차이는 보존했다.
5. Work_뮤직 PR #22의 최종 main 통합·정기 실행 검증 및 FIFO/분석·보정 상세 검증은 해당 진행 작업의 완료 후 필요하다. 이 상태에서 전체 main을 무차별 재배포하면 더 최신 운영본을 덮어쓸 수 있다.
6. 관리자 MP3 다운로드 실파일 수신, 새 최고관리자 MY 작업실의 실제 로그인 후 상호작용, 이번 시점의 SQL 콘솔 신규 조회는 브라우저 인증 상태 복구 제한으로 미완료다. 인증을 반복 요구하거나 다른 작업의 로그인 세션을 종료하지 않았다.
7. YouTube 실제 영상·음성 출력은 봇 확인 요구로 미검증이다. 서비스 전체 장애로 판정하지 않는다. [검증 브라우저 차단 안내](https://help.openai.com/articles/20001280-using-cloud-browser-in-chatgpt#when-a-website-blocks-the-task).
8. 최신 56개 테이블 SQL 백업의 SHA는 확인했지만 현 전체 테이블·업로드 큐를 포괄한 새 전체 백업과 복원 시험은 미완료다. 운영 DB 복원을 실행하지 않았다.

## 실행 증거

- 최초 P0 운영 조사: https://github.com/rucyjeon79/noa-studio/actions/runs/39589945669
- 매핑 보정 후 257개 일치 확인: https://github.com/rucyjeon79/noa-studio/actions/runs/39590830706
- 계정 사용량·실제 백업 쓰기 검사: https://github.com/rucyjeon79/noa-studio/actions/runs/39591658646
- Chrome 실제 H.264 재생 확인: https://github.com/rucyjeon79/noa-studio/actions/runs/39592701309
- UI 정식 반영·운영 4폭 검증: https://github.com/rucyjeon79/noa-studio/actions/runs/39594832143
- 안전한 캐시 주소 갱신: https://github.com/rucyjeon79/noa-studio/actions/runs/39595679021
- 최종 전체 서버 해시·원본 데이터·SQL 백업 검증: https://github.com/rucyjeon79/noa-studio/actions/runs/39596059782
- 최종 PC·모바일 이미지·실제 MP3 출력·권한 검사: https://github.com/rucyjeon79/noa-studio/actions/runs/39596390596

파일별 전체 비교 결과·백업 메타데이터·공개 검사 수치는 동반 [50-p0-production-state-20261021.json](50-p0-production-state-20261021.json)에 기록했다. GitHub 코드 반영, 실제 서버 적용, 실제 기능 검증을 이 보고서에서 구분했다.
