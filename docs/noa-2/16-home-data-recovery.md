# 홈 TOP 10 데이터 복구 · Work_데이터 → Work_배포

상태: 코드 수정 및 격리 검증. 운영 배포를 수행하지 않음. DB 마이그레이션 없음.

## 확인한 원인

운영 `/noa-bridge/home.php`의 수집 회차 `919a87072ef27926264d1d7e1f2dc68c`에서 사연곡 1개, 커버곡 0개, 플레이리스트 1개가 반환됐다. 공개 영상 페이지에는 610개 영상이 있었지만 홈은 확정 카탈로그 곡 ID가 연결된 285개만 사용했다. 사연곡·유명곡 커버 전용 채널 목록의 소속과 명시적 영상 분류가 홈 선정에 반영되지 않았다. 플레이리스트 선정은 제목에 연속듣기가 있는 공식 목록에 한정돼 ACT Playlist 합본 단일 영상을 누락했다.

전용 목록:
- 사연곡: `PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB` · 당신의 이야기, 우리의 음악 🎧
- 유명곡 커버: `PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb` · 🎤 AInoa의 유명곡 커버

## 수정 범위

- `bridge/home-core.php`: 확정 장르 / 공개 소유 채널 전용 목록 소속 / 명시적 사연곡·Cover by AInoa 제목을 분류 근거로 사용. 제목만으로 곡 ID를 추정하지 않으며 DB 연결 관계를 쓰거나 변경하지 않는다. 일반적인 `[Cover] POP Original / J-POP Ver.`는 유명곡 커버 근거가 아니다. 분류 충돌과 명시적 매칭 거절은 제외한다.
- `bridge/home-store.php`: 기존 DB 연결의 SELECT 전용 로더. 운영 엔드포인트와 격리 검증이 같은 함수를 사용한다.
- `bridge/home.php`: 공용 로더 사용. API/DB 실패는 HTTP 503, `ok:false`와 세 빈 배열 및 오류 진단을 반환한다.
- `deploy/noa-home.js`: 공식 목록과 단일 영상의 카드 조회수 문구, 링크 종류, 선정 기준을 구분한다. 기존 배치·CSS·카드 구조 유지.
- `deploy/noa-app/home.php`, `deploy/noa2.php`: 홈 JS 버전 `20261021-home-data1`; 플레이리스트 기준 안내와 실제 전용 목록의 전체 보기 링크. 기존 섹션과 디자인 유지.
- 테스트: `tests/catalog/home_test.php`, `tests/home/router.php`, `scripts/qa/noa-home-{db.php,render.mjs,deployed.py}`, `.github/workflows/noa-home-data-check.yml`.

## 순위와 누락 처리

사연곡·커버곡은 해당 채널의 공개·임베드 허용 영상 중 실제 조회수가 확인된 영상의 조회수 내림차순, 동률은 영상 ID 순. 각각 최대 10개. 실제 0은 유효하지만 미수집/null/잘못된 값은 0으로 바꾸지 않는다. 합본으로 식별되는 영상은 곡 순위에서 제외한다.

플레이리스트는 `contentType=youtube_playlist`일 때 `scoreKind=sum_public_owner_member_video_views`로 공개·임베드 허용·조회수 확인된 소유 채널 수록 영상의 합을 사용한다. 중복 수록은 한 번, 미확인/비공개/외부/거절 영상은 제외하며 합계와 집계·제외 건수를 표시한다. 이것은 공식 재생목록 자체의 조회수가 아니다. `contentType=video`, `scoreKind=video_view_count`인 ACT Playlist/연속듣기 합본은 해당 단일 영상의 실제 조회수를 사용한다. 두 지표가 다름을 화면에 명시하고 score 내림차순으로 정렬한다.

`diagnostics`는 후보·순위 가능·반환·곡 ID 미연결 건수, 등록된 장르 곡 및 수집 영상 미연결 수를 제공한다. `missing_view_count`, `not_public_owner_embeddable`, `rejected_match`, `classification_conflict`, `compilation_in_playlist_chart`, `no_rankable_member_metrics`, `no_collected_members`로 제외 사유를 구분한다. 빈 결과는 `no_registered_or_collected_data`, `catalog_video_mapping_missing`, `no_category_evidence`, `all_candidates_excluded`로 구분한다. 증거 없는 영상을 억지로 분류하거나 생성하지 않는다.

## Work_배포 적용 절차

1. 검증 완료 커밋을 고정하고 현재 운영 파일 SHA256을 `quality-home/deployed-source-hashes.json`과 대조한다. 다르면 덮어쓰기 전에 차이를 확인한다. 기존 파일을 웹 루트 밖에 백업한다.
2. 아래 6개 파일만 대상으로 PHP 문법·프런트 정적 검사 후 임시 파일 업로드와 원자적 rename을 사용한다. 의존성 `home-store.php`, `home-core.php`를 먼저 준비하고 새 엔드포인트/JS/홈 템플릿을 같은 유지보수 구간에 적용한다. 중간 버전이 노출되지 않도록 전체 검증 후 전환한다.

| 저장소 | 운영 상대 경로 |
|---|---|
| bridge/home-core.php | noa-bridge/home-core.php |
| bridge/home-store.php | noa-bridge/home-store.php |
| bridge/home.php | noa-bridge/home.php |
| deploy/noa-home.js | noa-home.js |
| deploy/noa-app/home.php | noa-app/home.php |
| deploy/noa2.php | noa2.php |

테스트·CI·문서는 배포하지 않는다. `index.php`, 그누보드 코어·DB 설정·음악 원본·SQL 데이터는 변경하지 않는다. 기존 전체 배포 워크플로를 무조건 재실행하지 말고 이 범위만 적용한다.

3. 운영 `/noa-bridge/home.php`에서 `ok:true`, 동일 수집 회차의 배열/진단/실제 조회수 정렬 및 콘텐츠 유형을 확인한다. `/`와 `/noa2.php`의 모바일·PC 카드 제목·썸네일·링크·목록 종류·표시 건수를 확인한다. 수집 회차가 달라지면 고정된 건수를 강제하지 않고 새 실제 데이터를 검증한다.
4. 실패 시 백업한 같은 6개 파일 버전을 복원하고 API/홈을 재검증한다. DB 변경이 없어 SQL 복원은 필요하지 않다. `home-store.php`는 이전 엔드포인트가 참조하지 않으므로 롤백 시 사용되지 않는다.

## 검증 한계와 남은 연결 작업

격리 CI는 기존 private 백업의 SHA256, 56개 테이블 전체 행 체크섬과 스키마를 검증한 뒤 복원 DB에서 홈 읽기 모델을 실행한다. 운영 API와 같은 수집 회차인지 확인하며 카탈로그/원본 가드가 변하지 않는지 비교한다. 산출물에는 공개 순위 응답·집계 진단·화면만 포함하고 private SQL이나 비공개 원본은 업로드하지 않는다.

홈 분류 복구는 영구적인 곡 ID/YouTube URL 매칭 완료와 다르다. `unlinkedRankable`에 남은 곡은 명시적 ID·URL 증거 확인 후 별도 승인된 카탈로그 매칭 절차로 정리해야 한다. 제목 유사도만으로 자동 매칭하지 않았다. 수집 시점 이후 YouTube에서 바뀐 공개 상태·조회수는 새로운 수집 전에는 확인할 수 없다. 링크 HTTP 확인은 전체 영상 재생 완료 검증을 의미하지 않는다.

## 실제 데이터 검증 결과

코드 커밋: `fe496f789962580a620612f38fe9694ec5fb1784` 및 `6b46321bc2a7a55a09c4ae58752d25180805ee7a`.

첫 격리 검증: https://github.com/rucyjeon79/noa-studio/actions/runs/39534620066 — 성공. 최신 코드의 재검증 결과는 GitHub의 `NOA home data recovery isolated verification`을 확인한다.

| 영역 | 현재 운영 API | 동일 회차 수정 읽기 모델 | 순위 가능 데이터 |
|---|---:|---:|---:|
| 사연곡 | 1 | 10 | 35 |
| 유명곡 커버 | 0 | 10 | 37 |
| 플레이리스트/연속듣기 | 1 | 10 | 32 |

수정 결과 TOP 1:
- 사연곡: `KaNazxjbg2A` · 한번만 기대도 될까 · 실제 조회수 207
- 커버곡: `9c4XIzMOVkE` · 이젠 잊기로 해요 - 김완선 · 실제 조회수 996
- 공식 연속듣기 목록: `PLEPMKciKgvcjWh_2gHLZL4GCUFueEnZ5H` · 확인된 수록 영상 조회수 합계 1,550 (단일 영상 조회수와 다른 지표)

수집 원본과 카탈로그 대조: 사연곡 장르 등록 45곡, 커버곡 장르 등록 37곡. 홈 순위 가능 영상 중 사연곡 34개와 커버곡 37개는 영구 곡 ID가 미연결이다. 사연곡 후보 49개 중 14개, 연속듣기 후보 48개 중 16개는 공개·소유 채널·임베드 허용 조건을 충족하지 않아 제외됐다. 커버곡 후보의 합본 3개는 곡 순위 대신 연속듣기 순위로 분리했다. 이번 수집 회차의 순위 후보에는 조회수 누락으로 제외된 항목이 없었다.

공개 순위 응답 `candidate.json`, 진단 `report.json`, 모바일/PC 화면 및 `render-report.json`은 위 검증 실행의 `noa-home-public-data-verification` 아티팩트에서 확인할 수 있다. 격리 화면은 각각 390px/1280px에서 세 영역 10개, 동일 제목·ID·링크·순서, 가로 넘침 없음, JS 런타임 오류 없음이 확인됐다. 운영 결과는 배포 후 재검증 전까지 기존 1/0/1이다.
