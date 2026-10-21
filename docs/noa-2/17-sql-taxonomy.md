# SQL 카테고리·자동분류 운영

NOA STUDIO 앱이 상위 플랫폼이며 그누보드 회원·세션·게시판을 하부 서비스로 재사용한다. 운영 원본은 닷홈 MySQL이다. GitHub에는 배포 코드와 최초 이전용 규칙만 있으며 운영 편집값을 재배포로 덮어쓰지 않는다.

## 추가형 저장 구조

기존 기능 조사: `noa_catalog_songs.genre_id`는 기존 장르, `noa_catalog_tracks`는 ACT 수록 순서, `noa_youtube_items`는 영상의 다중 재생목록 소속, `noa_youtube_decisions`는 기존 관리자 확정·거절이다. 이 네 기능은 유지하고 재사용한다. 계층 카테고리와 운영 규칙 버전 관리는 없으므로 아래 테이블을 추가한다.

| 테이블 | 목적 |
|---|---|
| noa_categories | 확장 가능한 부모·자식 계층, 정렬·사용·revision |
| noa_content_categories | 곡·영상·목록의 다중 카테고리 관계, 자동/관리자 근거 |
| noa_classification_rules | 제한된 조건 종류와 단계 내 우선순위 |
| noa_classification_logs | 분류·매칭·충돌·관리자 수정 이력 |
| noa_production_rules | 공통·장르별 운영 제작 규칙, 해시·revision |
| noa_production_rule_revisions | 제작 규칙 이전 버전과 변경 사유 |
| noa_content_matches | 영상→곡 연결, 기존 확정값을 덮지 않는 별도 overlay |
| noa_playlist_matches | 공식 목록/ACT 합본 영상→카탈로그 ACT 연결 |
| noa_classification_runs | 입력 해시별 실행 결과와 재실행 방지 |

삭제·ALTER·기존 장르/EP/ACT/언어/버전 변경은 없다. CREATE IF NOT EXISTS 후 기존 동명 테이블의 필수 컬럼을 확인한다. 최초 seed는 INSERT IGNORE, 운영 편집은 revision 비교와 트랜잭션, 분류 writer는 MySQL 이름 잠금으로 직렬화한다. 기존 확정 매칭과 충돌하면 유지하고 검토 기록을 남긴다.

## 초기 카테고리 정책

- 사연곡 `your-story`
- 커버곡 `cover-reborn`
- K-POP 원곡 `kpop-original`
  - 오리지널 `original`: 기존 `kpop-original` 장르
  - 컬렉션 `collection`: 기존 통일 마스터 §1.B의 조선 발라드·PANPOP·Echoes of Joseon·Latin Afrobeats EDM·EDM K-POP Club Remix·Dreamy Deep House·Fantasy Ambient EDM·Groovy Airy POP·Narrative Piano Indie 9개 장르

컬렉션의 기존 언어가 영어여도 원래 컬렉션 정책에 따라 관계만 연결하고 원본 언어는 바꾸지 않는다. J-POP·POP·Thai와 기타 미확정 장르는 그대로 보존하며 새 계층을 임의로 만들지 않는다. 격리 백업 기준 605곡 중 사연곡 45, 커버곡 37, K-POP 원곡 400(오리지널40+컬렉션360)이며 나머지123곡은 기존 장르로 보존된다. 실제 운영 수치는 적용 후 재검증한다.

## 분류와 매칭

분류 단계는 관리자 확정 → 공식 목록 ID → 공식 목록 제목 → 기존 카탈로그 장르 → 명시적 영상 제목이다. 같은 단계·우선순위의 상충 분류는 보류한다. 공식 목록 ID와 제목은 기존 수집 자료에서 확인한 값만 seed한다. `[Cover]`라는 단어만으로 번역 버전을 유명곡 커버로 만들지 않는다. 영상 공개 여부와 개별 곡 ID 매칭은 분류와 별도다. 공개 표시 시 기존 채널·privacyStatus·embeddable 검증을 유지한다.

곡 연결은 제목 정규화(EP 접두사·구분자·가수 접미사·괄호 표기), EP, 언어, 장르/공식 목록, 버전을 비교한다. **제목 일치 + 확인 가능한 언어 + EP 또는 분류 근거**가 있고 후보가 하나일 때만 자동 확정한다. 복수 후보·언어 불명·버전 불일치·기존 확정/거절 충돌은 자동으로 덮어쓰지 않는다. 공식 MV는 확인된 Diary 목록 소속 + Official MV + Original Song + 언어 표기 근거로 같은 제목의 컬렉션과 구분한다.

ACT 연결은 ACT 번호·명시된 장르·언어·버전으로 유일 후보만 확정한다. 장르 전체를 모은 공식 YouTube 재생목록은 특정 ACT와 같다고 추정하지 않는다. ACT 합본은 곡 매칭 대상이 아니다. 기존 다중 목록 소속은 `noa_youtube_items`를 그대로 읽는다.

새 YouTube 수집 commit 후 자동분류를 실행한다. 수집 자료는 이미 commit된 뒤이므로 분류 실패가 나면 `collection_saved_classification_retry_required`를 반환하고 분류 실행을 재시도할 수 있다. 기존 데이터는 되돌리지 않는다. 동일 입력 해시의 실행은 기존 결과를 반환하며 중복 관계·로그를 생성하지 않는다.

## 제작 규칙

`src/data/unified-master.md` 1개, `guides/*.md` 11개, `suno/*.txt` 12개를 원문 SHA256 그대로 이전한다. 기존 SQL `noa_source_files`의 사용자 설정과 `noa_documents.kind=prefs`의 현재 편집값도 production 필드 allowlist만 가져온다. 현재 DB prefs가 보관 파일보다 우선한다. 운영 편집 내용, 이전 버전, 수정자·사유를 SQL에 보존하며 재배포 시 source SHA가 달라도 기존 내용을 유지하고 차이만 보고한다.

AI LAB `lab_inherit_rules()`는 설치 후 SQL을 읽는다. 공통과 장르를 분리하고 장르 예외를 유지한다. 제작 요청 생성 시 적용 규칙을 job snapshot에 저장하므로 이미 요청된 작업을 중간에 바꾸지 않고 **다음 제작 요청부터 새 규칙이 적용**된다. 외부 유료 AI 생성 호출은 검증 목적으로 실행하지 않는다.

## 관리·탐색

최고관리자: `/noa-app/taxonomy/`. 그누보드 super 및 `cf_admin` ID 일치, 관리자 세션, 모든 POST의 same-origin·CSRF를 검증한다. 상태 조회도 POST+CSRF다. 카테고리 계층·자동분류 규칙·운영 제작 규칙 편집, 실행, 검토 및 이력을 제공한다. YouTube 동기화는 기존 인증된 수집 API와 CSRF를 사용한다. 관리자 입력은 textContent/HTML escaping으로 렌더링한다. DB 비밀번호나 접속 문자열을 화면으로 보내지 않는다.

공개 API `/noa-bridge/taxonomy.php`는 공개·임베드 허용·공식 채널 영상만 제공한다. 제작 규칙·비공개 제목·전체 관리자 로그는 공개하지 않는다. 음악관 `/noa-music.php`에 1차/2차·언어·EP·ACT 필터와 매칭 상태를 제공하며 기존 원본 음원 플레이어를 유지한다. 홈은 SQL 카테고리 overlay와 기존 실제 조회수 집계를 사용한다. NOA WORLD는 원래 공식 목록·EP 정렬·미매칭 MV 표시를 유지하면서 확인된 SQL 곡 연결을 읽는다.

## 배포와 보호

`.github/workflows/noa-taxonomy-release.yml`:
1. PHP·분류·기존 홈/MV 회귀 검증.
2. 고정 동작 모듈만 업로드, 실제 운영 DB inventory, 웹 밖 private 최신 전체 백업 생성.
3. pinned SFTP로 그 백업을 가져와 SHA256·전체 테이블 행 체크섬·스키마를 검증하며 격리 MySQL에만 복원.
4. 실제 운영 스냅샷에서 추가형 migration·재실행·기존 56개 테이블 보존·규칙 편집 보존·홈/세계관 검사 및 PC/모바일 관리자 렌더링.
5. 검증 통과 후 고정 migration/sync와 검토된 연결 파일 적용.
6. 실제 정식 사이트의 공개 API·음악관 카테고리 필터·홈·MV·익명 관리자 차단·서명 없는 service 차단 검사.

서버 자동화는 기존 private worker key를 사용한 별도의 HMAC namespace·POST body hash·180초 시간 제한·일회 nonce로 인증한다. 관리자 브라우저의 세션/CSRF 경로를 대체하지 않는다. 이 엔드포인트는 고정된 inspect/backup/bootstrap/sync/verify만 지원하고 SQL·파일 경로·셸 명령을 받지 않는다. bootstrap에는 최근의 private 백업 해시와 복원 검증 결과, 백업 당시 전체 기존 데이터 가드 일치를 요구한다.

배포는 SSH host key와 현재 서버 파일 해시를 확인하고, 웹 밖 private 폴더에 이전 코드 및 manifest를 남긴 뒤 임시 파일을 원자적 rename한다. 기존 root index.php·common.php·설정·그누보드 로그인은 보호한다. 실패 시 해당 release manifest의 이전 **코드만** 복원하고 자동화 hook을 해제한다. 추가 테이블은 삭제하지 않고 보존한다. 기존 데이터 보호 가드가 달라지면 덮어쓰기/SQL 복원하지 말고 원인을 조사한다.

운영 코드 파일: `bridge/taxonomy*.php`, 기존 `youtube-store.php`, `lab-creator.php`, `home-core.php`, `world-mv.php`, `deploy/noa-music.php`, `deploy/noa-taxonomy-browse.js`, `deploy/noa-app/taxonomy/*`, `extend/noa.taxonomy.php`. 테스트·seed 생성 스크립트·문서는 서버에 공개하지 않는다. 기존 그누보드·회원·음악·설정 테이블은 전체 체크섬으로 전후 대조한다.

인증된 운영 관리자 UI 조작은 native credential 브라우저 상태 재개 불가로 관찰할 수 없었다. 이를 익명 브라우저나 로그인 우회로 대체하지 않는다. 격리된 관리자 화면 동작 및 실제 운영의 세션 없는 접근 차단과 SQL 서비스 처리를 각각 검증하고, 실제 관리자 로그인 후 편집 조작 검증은 별도로 남긴다.


## 운영 방문 집계와 데이터 보호

운영 적용 전 실제 서버의 백업 차이를 조사한 결과 `g5_login`, `g5_visit`, `g5_visit_sum` 및 `g5_config.cf_visit`만 정상 요청 처리로 바뀌었다. 설정 테이블의 다른 컬럼은 백업 원문과 모두 일치했다. 전체 설정 테이블을 보호에서 제외하지 않는다.

운영 배포 보호는 기존 56개 테이블의 스키마(가변 AUTO_INCREMENT 위치 제외), 회원·음악·설정 전체의 동일성, `cf_visit` 외 설정 컬럼의 동일성을 확인한다. 기존 방문 이력은 행별 체크섬으로 변경·삭제를 금지하고 새 방문 추가만 허용한다. 과거 날짜의 방문 집계는 삭제·감소를 금지한다. 정상적으로 생성·정리되는 현재 접속 세션 `g5_login` 및 방문 요약 `cf_visit`는 정상 변동 항목으로 별도 보고한다. 격리 검증에서는 원래 56개 테이블의 전체 행 체크섬도 그대로 비교한다. 이를 ‘운영의 모든 방문 통계가 고정됐다’고 보고하지 않는다.

첫 보호 실패 시 SQL 생성 없이 중단했고, `noa-taxonomy-probe` 진단에서 테이블·설정 컬럼 이름만 확인했다. 사용자 데이터 값·설정값·비밀번호는 로그에 출력하지 않았다. 익명 설치 POST 검사는 자동 승인 검토에서 차단돼 제거했으며, 서명 없는 접근은 상태 변경이 없는 GET으로 검증한다.

## 실제 운영 적용 결과 · 2026-10-21

정식 SQL 적용: 커밋 `62b479804f7f6d5a92b92dcfcb7874253a31e4ed`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39544071213 성공.

- 실제 MySQL 8.0.46, 기존 56개 테이블 → 65개 테이블. 위 9개만 추가 생성했다. 음악 카탈로그 605곡 유지.
- 적용 직전 전체 백업 125,043,833 bytes / 56개 테이블 / 23,735행. SHA256 `91759bcd8bb5b8bdc5ac43653646587b3b0b253ed05c05eebcff81fe8e3fdc01`. 격리 MySQL 실제 복원·전체 행 체크섬·스키마 대조 성공. SQL 원문은 private 경로에만 보존.
- 운영 전후 보호 데이터·기존 스키마 일치, 과거 방문 행 변경/삭제 없음, 과거 방문 집계 감소 없음. 정상 요청의 방문 요약·접속 세션만 위 정책으로 별도 관찰했다. 회원·음악·일반 설정을 수정하는 SQL은 실행하지 않았다.
- 최초 운영 분류: 수집 영상765 / 공식 공개 목록23 / 자동분류448 / 미분류317 / 곡 연결106 / 기존 연결412 유지 / 곡 매칭 검토8 / 오류0. ACT 단일 영상23개가 카탈로그 ACT와 연결되고 ACT 후보21건은 근거·버전 검토로 남았다. 장르 전체 공식 목록을 임의로 특정 ACT에 연결하지 않았다.
- 파일24개 + 기존 SQL 사용자 설정16개 = 운영 제작 규칙40개와 최초 이력40개 이전. 운영 규칙을 변경하는 GitHub 자동 덮어쓰기는 없다.

| SQL 카테고리 | 실제 곡 수 |
|---|---:|
| 사연곡 |45|
| 커버곡 |37|
| K-POP 원곡 합계 |400|
| ↳ 오리지널 |40|
| ↳ 컬렉션 |360|

추가 계층 정책이 없는 기존 장르123곡은 그대로 보존된다. 상위400곡과 하위40/360곡은 중복 집계하지 않는다.

홈 권위 기준 및 EP.22 Reborn 보완: 커밋 `63651791130354ea65c36050120891ca547f4e37`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39544636276 성공.
- SQL의 최초 분류 완료 후에는 홈에서 SQL 카테고리를 우선하며, 기존 제목/장르 fallback이 비활성·변경된 분류를 되살리지 않는다.
- EP.22 `하루의 끝에 - Reborn`은 카탈로그 제목 자체의 표기다. 미등록 리마스터와 구분해 공식 목록 + 원곡 표기 + EP22 + 언어 + 제목의 유일 후보로 자동 연결했다. 버전 컬럼은 변경하지 않았다.
- 자동 곡 연결 누계107개(기존 원시 연결412개 보존), 공식 MV30개 전부 곡 ID 연결 확인. 이후 동일 입력 재실행은 기존 결과를 반환한다. 분류 알고리즘 SHA256도 입력 해시에 포함해 코드가 바뀐 분류를 이전 결과로 잘못 건너뛰지 않는다.
- 마지막 실제 분류 결과: 자동분류449 / 미분류316 / 곡 매칭 검토8 / 분류 충돌0 / ACT 검토21 / 오류0. 미분류316은 초기 계층 정책 밖의 기존 장르104건과 분류 근거 부족212건이다. 이 수치는 수집 영상 기준이고 음악605곡의 등록 수와 다르다.
- 운영 홈 stories/covers/playlists 각각10개, 공개 카테고리 영상610개, 음악관 K-POP→컬렉션 필터87개 및 PC/모바일 동일 결과, 공식 MV 표시30개 확인. 익명 관리자 접근403, 서명 없는 서비스 GET401, 코어 직접 접근403 확인.

관리자 URL: https://noastudio.ai.kr/noa-app/taxonomy/
공개 분류 API: https://noastudio.ai.kr/noa-bridge/taxonomy.php
음악관: https://noastudio.ai.kr/noa-music.php
세계관: https://noastudio.ai.kr/noa-world.php

### 남은 운영 검증과 담당

- Work_데이터: 곡 매칭 검토8건·ACT 검토21건의 추가 근거 및 초기 계층 밖/근거 부족 항목을 규칙 수준에서 보완한다. 복수 후보를 제목만으로 병합하지 않고 대표에게 개별 ID 매칭을 전가하지 않는다.
- Work_배포: 새 인증 브라우저에서 최고관리자 로그인 후 카테고리 편집·제작 규칙 저장·revision 충돌·CSRF 차단 및 YouTube 새 수집→자동분류 실운영 사이클을 최종 확인한다. 기존 native credential 상태가 안전하게 재개되지 않아 이 **인증된 화면 조작만 미검증**이다. 관리자 기능의 격리 UI/SQL 저장·수정 이력·재배포 보존·실패 롤백 검증은 통과했다.
- 신규 SQL 마이그레이션은 더 필요하지 않다. 운영 반영은 이미 완료됐으며 남은 항목을 ‘GitHub에만 구현됨’으로 혼동하지 않는다. 새 수정 배포는 각 파일의 현재 SHA와 release manifest를 대조하고 그누보드 코어를 수정하지 않는다.

### 최종 ACT 표시 검증 및 운영 테이블 재대조

운영 코드 커밋 `22a564c38ac69c087fb90e31fe85d279b4182a1a`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39544954421 — 검증·실제 반영·정식 사이트 PC/모바일 검사 모두 성공.

- ACT 합본의 `catalogPlaylistId`, ACT 번호·장르·언어·버전을 곡 연결과 구분해 제공하며, 음악관에 ‘ACT 목록 연결 확인’으로 표시한다. 확정 ACT 연결은 전체23개, 그중 공개·재생 허용 조건을 만족하는15개가 공개 API에 포함된다. 비공개 영상8개를 공개 표시하지 않는다.
- 실제 홈 10/10/10, 공개 영상610, K-POP 원곡→컬렉션 결과87개, PC/모바일 동일 제목·링크·순서, 첫 화면 썸네일 실제 로드, ACT 정보 구분, 공식 MV30개 표시 및 카탈로그 연결30개를 확인했다.
- 마지막 코드 갱신에서는 SQL 마이그레이션을 실행하지 않았고, 동일 입력 분류는 `replayed=true`였다. 자동 곡 연결 누계107개·운영 제작 규칙40개·revision40개를 유지했다.
- 2026-10-21 13:42 한국시간의 최종 읽기 전용 inventory는 전체68개 테이블·카탈로그605곡이다. 초기56개와 본 작업9개 외에 `noa_jukebox_assets`, `noa_jukebox_history`, `noa_jukebox_jobs` 3개가 별도로 추가된 상태를 확인했다. 이3개는 본 분류 작업의 생성 목록에 포함하지 않으며 변경하지 않았다.
- 최종 inventory 실행: https://github.com/rucyjeon79/noa-studio/actions/runs/39545415001 — 새 코드 업로드0개·SQL 적용 없음, 일반 설정 변경은 여전히 `cf_visit`만 확인했다.

최종 잔여 사항은 곡 매칭 검토8건·ACT 검토21건, 계층 정책/분류 근거 보완, 새 인증 브라우저에서의 관리자 실제 편집 및 새 YouTube 수집을 포함한 전체 주기 확인이다. 카테고리/규칙/매칭 시스템과 공개 화면 연동은 이미 닷홈 운영 서버에 반영돼 있다.


### 운영 재개 후 현재 SQL 재점검 · 2026-10-21 20:34 KST

읽기 전용 점검 커밋 `7a3c56bae08e90a47bac6350944464f136b8a345`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39592629893 성공. 신규 코드 배포·마이그레이션·동기화·복원·업무 데이터 변경 없이 기존 서명 인증의 고정 `verify` 작업과 공개 API만 확인했다. 인증 과정의 일회용 replay 방지 nonce만 기존 방식으로 생성된다.

- 실제 MySQL 8.0.46 / 전체72개 테이블 / 카탈로그605곡 / 분류 설치 상태 정상. 앞선68개와 다른 전체 수치는 동시 운영 작업 이후 현재 inventory이며, 이번 점검에서 테이블을 생성하지 않았다. 본 분류 모듈이 생성한 테이블은 위9개다. 전체 증분 테이블의 담당·용도 재분류는 이번 점검 범위에 포함하지 않았다.
- 실제 카테고리: 사연곡45 / 커버곡37 / K-POP 원곡400(오리지널40·컬렉션360). 제작 규칙40 / 수정 이력40 / 자동 곡 연결 누계107 유지.
- 마지막 분류 결과는 04:35:48 UTC 실행 그대로다. 수집765 / 분류449 / 미분류316(정책 밖104·근거 부족212) / 곡 검토8 / ACT 검토21 / 분류 충돌0 / 오류0. 누계 연결107과 마지막 실행 신규 연결1을 구분한다.
- 공식 공개 YouTube 목록23개를 분류 근거로 읽었다. ACT 단일 영상→카탈로그 ACT 연결23개는 공식 YouTube 재생목록 매칭23개를 의미하지 않는다. 특정 ACT로 자동 확정된 공식 목록은0개이며 임의 매칭하지 않는다.
- 운영 홈 API는 stories/covers/playlists 각각10개, 분류 API는5개 카테고리·공개 영상610개. 기존 수집시각은 2026-10-21 02:36:24 KST로 유지돼 **신규 YouTube 수집 완료로 보고하지 않는다**.
- 현재 main의 순수 분류·매칭·홈·세계관 회귀 검증은 CI에서 통과했다. 로컬 최소 PHP에는 mbstring이 없어 분류 테스트는 CI PHP에서 검증했다.
- 독립 파일 대조 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39592048571 은257개 중244개 일치, 홈·UI13개 차이를 보고했다. SQL 분류 모듈의 현재 배포와 별개로 최신 main 전체 배포 완료를 의미하지 않는다. Work_배포는 해당 inventory를 기준으로 차이를 검토하고 기존 백업 preflight 및 동시 작업 보호를 유지해야 한다. 본 점검에서 차이 파일을 덮어쓰지 않았다.
- 관리자 실제 로그인 편집·새 수집→자동분류 전체 주기 검증은 남아 있다. 현재 브라우저도 native credential state를 안전하게 재개할 수 없어 인증 UI 검증을 성공으로 표시하지 않았다. 익명/서명 없는 접근 차단과 격리 UI·SQL 검증은 기존 성공 기록을 유지한다.

추가한 점검 파일: `scripts/noa_taxonomy_audit.py`, `.github/workflows/noa-taxonomy-audit.yml`. 기존 production 동시 실행 그룹을 사용하고 작업 중인 미디어·JUKEBOX·큐·백업을 삭제하거나 중단하지 않는다.
