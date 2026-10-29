# NOA STUDIO 2.0 — 2026-10-29 P0 운영 감사 및 부분 복구

전체 정상화는 **미완료**다. 이전 55~65% 추정치를 폐기한다. 전체 Grok 1.0 화면·기능의 검증 가능한 분모와 최신 회원별 운영 시험이 확보되지 않았으므로 전체 완성도를 숫자로 확정하지 않는다. AI 실제 생성이 차단되어 있어 90% 완료 판정은 불가하다. 단위검사 수나 소스 해시 일치율을 제품 완성도로 환산하지 않는다.

## 실제 운영에서 확인한 결과

- 기준 운영 커밋: `22b7bb15e04139d5d3dc2f1be8b5c566e99fdbf1` ([PR #282](https://github.com/rucyjeon79/noa-studio/pull/282)). 기존 main의 스크롤 보정과 진행 중인 Android PR #281을 보존했다.
- [운영 감사 Run 40813209671](https://github.com/rucyjeon79/noa-studio/actions/runs/40813209671): 2026-10-29 12:38 KST, SQL·N80·큐 조회 성공. 감사 DB 쓰기 0, 서비스 파일 쓰기 0.
- [배포 Run 40813209675](https://github.com/rucyjeon79/noa-studio/actions/runs/40813209675): PHP 8.2, Chromium/WebKit 검증 후 실제 배포 성공. 바뀐 서비스 파일은 `noa-app/p0-player.js` 하나다. 보호 파일 10개 동일, 회원 변경·포인트 차감·DB 쓰기 모두 0.
- 배포 전 감사 대상 25개 파일 중 24개 일치, 플레이어 1개가 이전본이었다. 배포 후 해당 파일을 공개 HTTP로 별도 읽어 SHA256 `c1dc07ee1d3d16a1e02d08ad1ff6e18dac55549f258a15a533ba04e2a6afd301`, 11,887바이트 일치를 확인했다. 이 결과는 파일 배포 정합성이지 전체 기능 통과율이 아니다.
- [기계 판독 증거](NOA_20261029_P0_EVIDENCE.json)에 감사 시각·파일별 해시·필드별 집계·배포 영수증·롤백 사본 검증을 보관했다. 감사 로그의 도메인 `***`는 GitHub 비밀값 마스킹이며 실제 도메인은 `noastudio.ai.kr`이다.

## 복구 사항

비활성 메뉴 링크에는 `href`가 없는데 플레이어가 `new URL(a.href)`를 호출해 예외가 발생했다. MUSIC에서 HOME으로 이동할 때 재생 유지용 화면이 만들어지지 않는 문제를 재현했다. 주소가 있는 링크만 비교하도록 수정하고 동일 조건을 회귀 검사에 넣었다.

기존 테스트의 실제 플레이어 파일 누락, 승인된 음원 출처 분리·새로고침 재생·검색 등록 태그·크리에이터 가입 경로와 검사 기준의 불일치를 정정했다. 보호 범위를 삭제하지 않고 실제 출처·회원 접근·행동 검사를 유지했다.

## 요구사항별 검증표

아래 운영 경로의 기준 도메인은 `https://noastudio.ai.kr`이다. 코드 일치만으로 운영 기능을 통과 처리하지 않는다. 핵심 P0는 가중치 3, 그 외 검사는 가중치 1로 추후 고정된 세부 목록에 적용한다. 미검증·외부 응답 대기는 통과 분자에서 제외하며, 핵심 장애가 있으면 전체 완료를 차단한다. 현재 표는 영역별 증거 목록이며 최종 세부 기능 분모가 아니다.

| 요구사항 | 실제 구현 | 운영 경로 | 현재 판정·오류·증거 |
|---|---|---|---|
| 기존 1.0 승계 | `deploy/noastudio/`, `bridge/p0-inventory.php` | `/noa-library.php` | 부분 확인. 원본 연결 653개 문서 대조. Grok 화면·버튼·설정 전수 대조는 확인 불가 |
| SQL 기준 저장·보존 | `bridge/package-record.php`, `catalog-store.php` | `/noa-editor.php` | 운영 테이블 8개 InnoDB 확인. 이번 감사 쓰기 0. 회원 편집·화면 간 최종 일치 재시험 필요 |
| 원본 필드 누락 | `bridge/p0-inventory.php` | `/noa-bridge/p0-audit.php` (서명 필요) | 원본 연결 653개, 소실 필드 0, 차이 3. 차이는 승인된 수정일 수 있어 덮어쓰지 않음 |
| AI 생성 | `bridge/ainoa-generation.php`, `deploy/noa-browse-edit.js` | `/noa-ai-lab.php`, `/noa-ainoa.php` | 외부 설정 대기. 키 없음, 텍스트·대화 비활성, 비용 한도 0. 실제 생성·과금 통과 아님 |
| UI/UX·모바일 | `deploy/noa-ui.css`, `noa-ui.js`, `noa-app/p0-media.css` | 주요 8개 화면 | 플레이어 격리 화면 10개 크기×2테마 통과. 390px 이미지 시각 확인. 전체 운영 관리자·태블릿 검수 미완료 |
| MUSIC·YouTube 분류 | `deploy/noa-browse.js`, `bridge/category-order-store.php` | `/noa-music.php`, `/noa-youtube.php` | 운영 코드 해시 일치. 격리 분류·정렬 회귀 통과. 실제 회원 전체 콘텐츠 재시험 필요 |
| JUKEBOX 페이지 이동 | `deploy/noa-app/p0-player.js` | `/noa-music.php` → `/` | 오류 수정·배포 완료. 격리 실제 오디오로 이동·뒤로가기 연속 재생 확인. 운영 회원 브라우저 재현 검사는 별도 필요 |
| JUKEBOX 잠금·백그라운드 | 동일 파일, `android/` | `/noa-music.php` | 확인 불가/진행. 실제 iOS·Android 기기 검증을 데스크톱 WebKit 검사로 대체하지 않음. PR #281 담당 작업 보존 |
| 업로드 FIFO·상태 | `deploy/noa-app/jukebox/queue-core.php`, `operations.php` | `/noa-app/jukebox/` | 운영 대기 0·처리 중 0·ready 242·failed 3. 기존 실패를 이번 실행에서 복구 완료로 처리하지 않음. 신규 실음원 업로드 시험 안 함 |
| HOME | `deploy/noa-app/home.php`, `deploy/noa-home.js` | `/` | 비회원 실제 카드·추천·목록 로드 확인. 전체 순위 정확성/모든 링크 검수 미완료 |
| NOA WORLD | `deploy/noa-world.php` | `/noa-world.php` | 코드 일치. 모든 실제 YouTube 영상 재생·중복 검수 미완료 |
| MY | `deploy/noa-my.php` | `/noa-my.php` | 코드 일치. 기존 운영 회원의 목록 저장·복원은 이번 실행에서 미검증 |
| 사이트맵·권한 | `deploy/noa-sitemap.php`, `bridge/member-access.php` | `/noa-sitemap.php` | 코드 일치, 회원 전용 경로 302 확인. 전체 역할별 모든 링크 미검증 |
| N80 | `deploy/noa-app/engine/work-state.php` | `/noa-work-status.php` | 감사 revision 24, 기존 12영역 모두 미완료 유지. 신규 지시는 동일 상위 작업에 누적하고 기존 상태 덮어쓰기 금지 |
| 자동배포 | `.github/workflows/noa-playback-reload.yml` | 위 배포 Run | 실제 플레이어 한 파일 배포 성공·HTTP 해시 일치. 다른 실패 파이프라인까지 정상 완료는 아님 |
| 백업 | 기존 Drive 및 배포 보호 검사 | Drive 과거 배포 폴더 | 바뀐 플레이어 이전본 업로드·다운로드 SHA 일치 확인. SQL 전체 복원 및 과거 원본 음원 전수 백업 재검증 미완료. 서버 파일 삭제 없음 |
| 성능 | 기존 브라우저 검사 | 주요 페이지 | 비교 가능한 운영 전후 성능 표본 미확보. 이번 변경은 예외 수정이며 속도 개선 수치를 주장하지 않음 |

## 곡 정보·데이터 결과

음악 문서는 **666개**: 곡 520, 사연 87, 플레이리스트 59. 카탈로그 기록은 669개다. 전체 무결성 스냅샷의 문서 817개는 다른 종류를 포함하므로 음악 문서 666개와 구분한다.

원본과 연결된 문서 653개에서 소실 필드 0건, 다른 값 3건이다. **이번 실행의 원본 필드 복원은 0건**이다. 기존 검증된 값을 덮어쓰거나 빈 필드를 생성하지 않았다. 번역·제작 프롬프트 등 빈 필드가 있으나 원본 부재와 승계 오류를 동일하게 취급하지 않는다. MP3/이미지 필드 빈칸 수는 자산 테이블의 실제 파일 부재 수가 아니다. 정렬은 별도 SQL 문서와 EP/플레이리스트 구성으로 결정하므로 `sortOrder` 빈칸만으로 정렬 누락을 판정하지 않는다.

## 실패·미검증·재개 지점

- AI: 운영 `keyConfigured=false`, `textEnabled=false`, `chatEnabled=false`, `maxJobUsd=0`, `dailyBudgetUsd=0`, `chatPoints=null`. 키 선택·비용 정책 없이는 실제 생성과 포인트 차감 검증을 완료할 수 없다. 비밀값은 출력하지 않았다.
- 기존 Approved UI 검사: 비회원 요청으로 회원 전용 MUSIC의 `const records`를 찾다 실패한다. [실패 Run 40812330866](https://github.com/rucyjeon79/noa-studio/actions/runs/40812330866). 접근 권한을 풀거나 실패를 성공으로 바꾸지 않았다. 활성 구독 임시 QA 계정과 정리 검사를 갖춘 회원 검증으로 교체해야 한다.
- 가입 경로: 기존 승인 소스는 `/bbs/register.php`를 `/noa-creator-apply.php`로 보낸다. 검사도 정확한 경로·동일 호스트를 확인하도록 수정했다. 로컬 후속 읽기에서 503 응답을 한 번 관찰했다. 이후 main의 [품질 검사 Run 40813209664](https://github.com/rucyjeon79/noa-studio/actions/runs/40813209664)에서 18개 공개·보호 경로와 실제 MP3/단일 MySQL 재생 집계 검사가 통과했다. 일시 오류의 장기 안정성은 별도 관찰이 필요하다.
- 원본 대조 차이 3건: 필드별 수정 이력과 최신 원본을 확인한 후 보존/복원 결정. 원본 없는 정보는 외부 원본 확보 전까지 확인 불가.
- 다른 Work: Android PR #281은 진행 중이며 이번 작업에서 병합하거나 수정하지 않았다.
- N80의 완료 이벤트는 발행하지 않는다. 플레이어 수정 배포와 감사는 마지막 성공 단계이며, 회원 실제 운영 시험·AI 준비·원본 전체 대조·성능 및 실제 기기 검증부터 이어간다.

## 검증과 백업

로컬 엔진 PHP 39/39, 플레이어/PWA 21개, UIUX 소스 계약 7개 통과. 별도의 분류·정렬·YouTube 지연 로딩 검사 45개도 통과했다. 이들은 서로 다른 단위·통합 검사이며 합계로 기능 완성도를 계산하지 않는다. 로컬 PHP는 8.3, 배포 게이트 PHP는 운영과 같은 8.2다.

[배포 전 플레이어 사본](https://drive.google.com/file/d/1-wVzEEXwJdtcymscJAAfFP-k8iG4QGOY/view): 11,833바이트, SHA256 `399304c092658191c7e995f484686e96e178b46d4da33b0f9b3fc29abe950ada`. 실제 배포 전 파일과 일치하고 Drive에서 재다운로드한 값도 같았다. 서비스·회원·DB·음원·이미지·진행 중 큐는 정리하지 않았다.
