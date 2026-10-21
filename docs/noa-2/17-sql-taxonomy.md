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
