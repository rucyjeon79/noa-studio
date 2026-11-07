# N80 노래 창작하기

작업 지시서 #431의 신규 오리지널·사연곡 흐름. `/noa-ai-lab.php?tool=creative`에서 시작한다. 기존 `creatorAI` 권한(8레벨·최고관리자)을 적용한다. 오리지널 EP 등록은 기존 관리자 권한을 유지한다. EP 재해석·유명곡 커버는 기존 원곡 관계 흐름을 사용한다.

## 현행 곡정보창 필드 매핑

`NoaRecordForm.visibleKeys()`가 곡정보창과 창작 보관함의 공통 표시 목록이다. `nup_fields`/`nup_patch`가 같은 canonical DB 필드로 변환한다.

| 현재 항목 | 키·타입 | 생성·필수 여부 | canonical 저장 경로 |
|---|---|---|---|
| EP 번호 | ep, text | 오리지널 게시 시 필수, 사용자 지정 | ep / body.originalInfo.ep |
| 곡 제목 | title, text | AI·필수 | title / body.confirmedTitle |
| 보컬 | vocal, select | 확정 의도 기반·필수 | body.vocalInfo / body.thumbCast |
| 가사 | lyrics, textarea | AI·필수 | body.lyricsBlock |
| Suno 음악 제목 명명 지시문 | sunoTitle, readonly | 기존 파일명 함수로 계산·복사 | 별도 중복 저장 없음 |
| Suno 제작 지시문 | sunoPrompt, textarea | AI·필수·1,000자 이내 | body.sunoPrompt |
| 썸네일 제작 지시문 | geminiPrompt, textarea | AI·필수 | body.geminiPrompt |
| YouTube 제목 | youtubeTitle, text | AI·필수 | body.youtubeTitle |
| YouTube 설명 | description, textarea | AI·필수 | body.youtubeDescription |
| 커뮤니티 글 | communityPost, textarea | AI·필수 | body.communityPost |
| Suno 공유 주소 | sunoUrl, text | 선택·입력 시 실제 Suno 카드 확인 | body.sunoUrl |
| YouTube 주소 | youtubeUrl, text | 선택·입력 시 실제 영상 확인 | body.youtubeUrl |
| 뮤직비디오 주소 | mvUrl, text | 선택·입력 시 실제 영상 확인 | body.mvUrl |
| 카드 이미지 위치 | cardImageLocation, readonly | 실제 파일·게시 필수 | body.cardImageLocation / uploadedAsset |
| 음원 파일 위치 | audioFileLocation, readonly | 실제 파일·게시 필수 | body.audioFileLocation / uploadedAsset |
| 추가 제작 자료 | creativeFields, JSON textarea | AI·storyPlan 필수 | body.storyPlan 및 기존 NUP_EXTRA_FIELDS |

삭제된 곡소개·가사번역·제작프롬프트·캐릭터 프롬프트·중간 제작확정은 표시하지 않는다. `originalArtist`는 커버 전용, `tracklist`는 ACT/플레이리스트 전용이므로 신규 원곡 폼에 표시하지 않는다.

## 저장·실행

- `noa_creative_drafts`는 draft_id·소유자·문서 키와 보관·복구 만료 상태를 색인한다. `owner_created` 인덱스로 소유자별 목록을 제한한다. 생성된 노래는 기존 MySQL `noa_documents`와 `noa_document_history`를 사용한다.
- `kind=n80_creative_draft`, `doc_key=n80:draft:<id>`. 일반 곡과 동일한 canonical `body`에 현재 필드, `_creative`에 이야기·질문·답변·의도·수정 요구·후보·검토 상태·정식 곡 링크를 저장한다. JSON 파일/localStorage를 기준 저장소로 사용하지 않는다.
- AI 작업은 `kind=n80_creative_job`, immutable 입력 스냅샷과 요청 ID, 실행 상태, 출력, 오류를 보존한다. N80 Engine `creative.php`가 관리하고 N80 Auto가 기존 private `noa-worker.yml`을 호출한다. 기존 worker가 `noa-gpt.php`에서 명시적 작업 ID로 읽고 결과를 같은 작업에 저장한다. 새 실행기·cron·독립 엔진을 추가하지 않는다.
- 첫 입력, 사지선다 답변, 사용자 지정 답변 작성 중 내용, 필드 값, 수정 요구와 선택을 서버에 저장한다. 응답을 확인한 경우만 저장 완료를 표시한다. 네트워크 실패는 현재 화면 입력을 보존한다. revision 충돌은 덮어쓰지 않으며 서버 버전을 명시적으로 다시 읽을 수 있다.
- 확정된 의도 해시가 없으면 생성이 거절된다. 미지정 조건마다 정확히 4개 서로 다른 선택지를 검증한다. 명시 조건은 원문·답변의 실제 인용 근거가 있어야 한다. 생성된 매체 URL은 받지 않는다.
- per-field 후보는 현재 필드의 기준 해시와 함께 저장된다. 적용 시 다시 비교한다. 이력 복원은 해당 필드만 변경한다. 연관 내용이 바뀌면 검토 대상을 표시한다.

## API와 게시

`noa-bridge/creative.php`는 공통 회원 권한·소유자·CSRF·Origin 검사 후 N80 모듈로 위임한다.

- GET: list, get, history, jobResult, assets, collections.
- POST: create, save, answer, confirmIntent, generate, proposal, review, restoreField, delete, restoreDeleted.
- 실제 자산: cover, sunoCover, verifyUrl, init, chunk, finish, retry. MP3/WAV는 기존 N80 JUKEBOX 업로드·최적화·검증 큐를 사용한다.
- 게시: preview, publish. 창작 정보 완성률과 실제 게시 준비를 구분한다. 게시 미리보기·파일 해시·분류·EP 중복·묶음 revision·권리 확인을 검증하고 한 트랜잭션으로 정식 곡·자산 참조·묶음·초안 연결을 기록한다. 실패 시 파일과 초안을 남긴다. 이미 등록된 draft_id는 같은 정식 곡을 반환한다.
- 원본 초안과 정식 곡은 파일을 복제하지 않고 검증한 동일 자산을 참조한다. 초안은 별도 kind와 draft visibility로 공개 카탈로그에서 제외한다.

## 보존

곡정보까지 완성된 초안과 AI 작업은 유지한다. 미완성 입력은 기존 N80 복구 체크포인트 한 건을 갱신하며 마지막 입력부터 24시간 동안 복구할 수 있다. 버튼 클릭·공백만으로 문서를 만들지 않는다. 보관된 초안의 삭제는 소유자의 ID 재확인 후 soft delete이며 이력·파일은 유지된다. 삭제 보관함에서 복구한다. 정식 등록 이후에도 초안 이력을 자동 삭제하지 않는다.

JUKEBOX `nu_cleanup_verified`는 creative draft 원본을 자동 삭제하지 않는다. 기존 미완성 업로드 정리도 만료 삭제가 없다. 미디어 정리 스크립트는 retained draft의 모든 document history를 파일 보호 참조에 포함한다. 파일명 기반 중복 정리는 이 보호 참조를 우선한다.

## 검증·배포

`tests/creative/core.php`는 실제 MySQL 8에서 권한, optimistic revision, idempotency, 질문 검증, AI 실패·지연 결과, 후보 적용·취소, 이력 복원, 삭제·복구, 실제 파일 확인, 중복 없는 게시와 초안 링크를 검증한다. 브라우저 검증은 실제 PHP API·MySQL을 사용하되 CI의 AI 응답만 결정된 fixture로 공급한다.

운영 검증은 고유 `[N80 운영 검증용, 실제 곡 아님]` 초안에 한정한다. 기존 private AI runner로 분석·곡정보·개별 수정, 실제 합성 음원 업로드와 최적화, 이미지 검증, 게시·재시도·공개 프로젝션을 확인한다. 검증 곡은 확인 즉시 삭제 표시하고 초안은 삭제 보관함으로 옮긴다. 연결 파일·이력은 유지한다. 짧은 수명의 서명된 점검 파일은 검증 후 제거한다. 다른 회원·기존 곡은 변경하지 않는다.

`noa-creative-drafts.yml`만 이번 공유 소스를 배포한다. 다른 배포 경로는 `[creative-drafts]` 커밋에서 제외한다. 배포는 현재 main 검사·운영 preimage·동시 변경 보호·해시 대조·복구를 사용한다. 운영 증거는 Actions의 `creative-live-*`, 화면 증거는 `creative-proof-*` artifact에 남긴다. 검증 실행 결과는 해당 Actions 실행을 기준으로 확인하며 이 문서 자체는 성공 증거를 대신하지 않는다.


## 2026-11-07 검수 기록

- 최초 운영 실행: https://github.com/rucyjeon79/noa-studio/actions/runs/42369262475
- 배포 코드: `df7e806c8d366eec2ab1f1b587640297cf96b6bb`. 운영 파일 17개를 대조하고 보호 대상 11개가 유지되었음을 확인했다.
- 실제 N80 AI: 이야기 분석 → 부족한 조건 7개에 각각 4개 선택지 → 의도 확정 → 생성 정보 100% → 커뮤니티 글 개별 수정·적용. 분석·생성·수정 3개 작업 모두 succeeded.
- 실제 기존 음원 처리기: 2초 합성 MP3 업로드·최적화, WebP 카드 연결, 실제 파일 검증, 정식 사연곡 등록, 공개 데이터 투영, 동일 요청 재전송 시 동일 곡 반환을 확인했다.
- 검증용 곡은 확인 즉시 공개 목록에서 제외했다. 검증용 초안은 삭제 보관함으로 이동했고 이력과 연결 파일은 유지했다. 기존 회원의 곡을 검증 데이터로 사용하지 않았다.
- CI: PHP 8.2/MySQL 8의 소유권·리비전 충돌·응답 유실 후 재시도·사지선다 검증·작업 중복 방지·후보 적용·이력 복원·명시적 삭제/복구·원본 보존·실제 자산 조건·등록 재시도 검증 통과. 실제 PHP/MySQL을 사용하는 브라우저 흐름은 모바일 320/390px, PC 1280px에서 통과했다. 브라우저 CI의 AI 결과만 고정 fixture이며 운영 검증에서는 실제 AI 응답을 받았다.
- 사이트맵 보완: AI LAB에 등록된 내부 화면을 동일 레지스트리에서 인식하도록 수정했고 `tests/sitemap/registry_test.php`가 통과했다. 운영 사이트맵에도 ‘내 창작 보관함’과 로그인 조건이 노출된다.

영구 보관한 실행 증거: [최초 운영 검증 JSON](operations/creative-drafts-20261107/first-live-verification.json). 작업 ID·등록 결과·소스 해시·정리 결과를 포함하며 인증정보는 포함하지 않는다.

최종 사이트맵 보완 배포도 [Actions 42369612114](https://github.com/rucyjeon79/noa-studio/actions/runs/42369612114)에서 검증·배포·실제 AI/미디어/게시 점검이 모두 통과했다. 운영 소스 기준 커밋은 `4d387ee350dbd13c4e017bfb5886c3689c248848`이며, [최종 운영 검증 JSON](operations/creative-drafts-20261107/final-live-verification.json)에 전체 소스 해시와 마지막 실행 결과를 보존한다. 이 배포에서 실제 변경한 운영 파일은 `noa-sitemap.php` 한 개다.

### 확인한 범위와 남은 검증

운영 실증은 표시된 각 실행에서 고유한 합성 테스트 사연곡 한 건으로 수행했다. 실제 사용자 Suno/YouTube URL의 외부 응답, 오리지널 EP 신규 번호·사용자 플레이리스트에 대한 운영 게시, 장시간·대용량 실제 음원, 장기간 보관·다중 기기 세션은 이번 운영 점검에서 실증하지 않았다. 구현·서버 검증 조건과 실증한 범위를 구분한다. 외부 서비스 실패 시 초안은 보존하고 성공으로 표시하지 않는다.

저장소 전체의 기존 별도 검사에는 다음 실패가 남았다. 이 창작 모듈의 성공을 저장소 전체 정상화로 해석하지 않는다.

- `tests/youtube/coming_fixture.py`: 기존 음악 페이지가 사용하는 `personal-listening.php`가 격리 fixture에 없어 렌더 중단. 해당 음악 페이지 의존성은 이번 작업 이전에도 존재했다.
- 기존 AInoa 포인트 검사: `regular_or_creator_required` 기대값 관련 실패. 이번 권한 변경은 창작 페이지/API 경로 추가에 한정되며 회원 등급 기준을 변경하지 않았다.
- 기존 회원 메뉴 검사: 데스크톱 메뉴 개수 기대값 불일치.
- 전체 품질 검사: 병행 반영된 AMT 배너 목적지와 `tests/sitemap/home_patch_test.py`의 기존 기대값 불일치.
- 회원 화면 검사: 기존 ‘음악으로 이어지는 순간’ 제목 대기 시간 초과.

### 변경 파일과 연결

| 구분 | 파일 |
|---|---|
| 문서·초안·버전 | `bridge/creative-core.php` |
| API·권한·자산·확정 | `bridge/creative.php`, `bridge/creative-publication.php`, `bridge/member-access.php` |
| N80 실행·메뉴·모니터링 | `deploy/noa-app/engine/creative.php`, `registry.php`, `ai-lab.php`, `deploy/noa-sitemap.php`, `bridge/worker-status.php`, `deploy/noa-work-status.php` |
| 화면·공통 폼 | `deploy/noa-lab-creative.php`, `deploy/noa-creative.js`, `deploy/noa-creative.css`, `deploy/noa-record-form.js`, `deploy/noa-browse-edit.js` |
| 기존 작업기·보존 | `deploy/noa-gpt.php`, `integrations/private-worker/worker.py`, `deploy/noa-app/jukebox/upload-core.php`, `drive-core.php`, `scripts/noa_media_retention.php` |
| 배포·실증·검증 | `.github/workflows/noa-creative-drafts.yml`, `scripts/noa_creative_release.py`, `scripts/noa_creative_live.py`, `scripts/noa_creative_live.php`, `tests/creative/*`, 기존 GPT/메뉴 검사 fixture |

기존 공유 배포 workflow에는 `[creative-drafts]` 변경을 이번 배포 경로에 맡기는 조건을 추가했다. 다른 기존 검사 자체를 통과 처리하거나 삭제하지 않았다. private worker의 실제 `worker.py`도 작업 ID를 명시해 읽도록 갱신했다(`rucyjeon79/noa-private-worker`, `c09084196beaf38a77ffa07591b74c8772c73d9e`).


## 창작 대화·키보드·운세 (2026-11-07 추가)

- 메뉴/제목은 AI 아이콘 + **노래 창작하기**, 시작은 **새 노래 만들기**, 완료 초안 목록은 **창작 중인 노래**다. 기존 N80 메뉴 레지스트리와 권한을 그대로 사용한다.
- 창작 조건은 단계별 네 가지 중 복수 선택과 추가 설명을 함께 반영한다. 선택만으로 넘어가지 않고 **다음**에서 저장·진행한다. 선택 상태와 입력 중 설명은 기존 `answerDrafts` 복구 필드에 버전이 있는 JSON 문자열로 저장한다. AI에는 선택한 문구 전체와 추가 설명을 평문 답변으로 전달한다.
- **오늘의 운세로 스토리 만들기**는 클릭할 때만 기존 `/noa-bridge/listening.php`를 조회한다. 로그인한 회원의 기존 운세가 소재이며 생년월일을 중복 수집하거나 다른 회원/대화 기억을 사용하지 않는다. 생년월일 미설정은 기존 설정 화면으로 안내한다.
- 운세 기반 네 가지 이야기 방향은 고정된 창작 출발점이다. 선택한 방향과 그날의 운세 원문을 기존 N80 창작 분석 입력에 함께 담는다. 별도 운세 AI 생성/worker/자동화를 만들지 않는다. 허구의 창작이며 실제 사건이나 예언으로 표현하지 않도록 입력에 명시한다. 조회/선택만으로 빈 초안을 만들지 않고 다음에서 실제 이야기로 저장한다.
- 공유 `NoaAInoa.openConversation`은 열린 동안만 VisualViewport resize/scroll과 창 resize를 구독한다. 높이·너비·pan offset으로 대화창 크기/위치를 조절하고 메시지 영역과 입력 영역 내부만 스크롤한다. 작은 화면은 헤더를 줄이고 입력 폰트를 16px로 유지한다. 닫을 때 구독/rAF/문서 스크롤 잠금을 해제한다. API가 없으면 innerHeight/innerWidth를 사용한다.
- 검증은 실제 PHP/MySQL + 브라우저 흐름에 VisualViewport 축소/이동/가로 화면/복원, API 없는 WebView 대체 경로, 재열기 시 구독 해제, 복수 선택·추가 설명 복구, 운세 오류/미설정/정상 흐름을 포함한다. 키보드는 브라우저에서 모사하며 물리 Android/iOS 키보드 실기기 검증과 구분한다. AI/운세 응답은 브라우저 검사에서 fixture로 제공하며 이번 UI 수정 때문에 운영 AI 작업/미디어 처리를 재실행하지 않는다.

검증 브랜치의 [Actions 42425062739](https://github.com/rucyjeon79/noa-studio/actions/runs/42425062739)는 PHP/MySQL 계약과 모바일/PC 전체 창작 흐름을 통과했다. 화면 증거는 해당 실행의 `creative-proof-42425062739`에 보관한다. 운영 배포 완료 여부는 이후 main 실행의 배포 영수증으로 확인한다.
