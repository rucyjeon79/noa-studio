# N80 창작 보관함

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

- `noa_creative_drafts`는 draft_id·소유자·문서 키만 색인한다. `owner_created` 인덱스로 소유자별 목록을 제한한다. 생성된 노래는 기존 MySQL `noa_documents`와 `noa_document_history`를 사용한다.
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

초안과 AI 작업에는 TTL이 없다. 삭제는 소유자의 ID 재확인 후 soft delete이며 이력·파일은 유지된다. 삭제 보관함에서 복구한다. 정식 등록 이후에도 초안 이력을 자동 삭제하지 않는다.

JUKEBOX `nu_cleanup_verified`는 creative draft 원본을 자동 삭제하지 않는다. 기존 미완성 업로드 정리도 만료 삭제가 없다. 미디어 정리 스크립트는 retained draft의 모든 document history를 파일 보호 참조에 포함한다. 파일명 기반 중복 정리는 이 보호 참조를 우선한다.

## 검증·배포

`tests/creative/core.php`는 실제 MySQL 8에서 권한, optimistic revision, idempotency, 질문 검증, AI 실패·지연 결과, 후보 적용·취소, 이력 복원, 삭제·복구, 실제 파일 확인, 중복 없는 게시와 초안 링크를 검증한다. 브라우저 검증은 실제 PHP API·MySQL을 사용하되 CI의 AI 응답만 결정된 fixture로 공급한다.

운영 검증은 고유 `[N80 운영 검증용, 실제 곡 아님]` 초안에 한정한다. 기존 private AI runner로 분석·곡정보·개별 수정, 실제 합성 음원 업로드와 최적화, 이미지 검증, 게시·재시도·공개 프로젝션을 확인한다. 검증 곡은 확인 즉시 삭제 표시하고 초안은 삭제 보관함으로 옮긴다. 연결 파일·이력은 유지한다. 짧은 수명의 서명된 점검 파일은 검증 후 제거한다. 다른 회원·기존 곡은 변경하지 않는다.

`noa-creative-drafts.yml`만 이번 공유 소스를 배포한다. 다른 배포 경로는 `[creative-drafts]` 커밋에서 제외한다. 배포는 현재 main 검사·운영 preimage·동시 변경 보호·해시 대조·복구를 사용한다. 운영 증거는 Actions의 `creative-live-*`, 화면 증거는 `creative-proof-*` artifact에 남긴다. 검증 실행 결과는 해당 Actions 실행을 기준으로 확인하며 이 문서 자체는 성공 증거를 대신하지 않는다.
