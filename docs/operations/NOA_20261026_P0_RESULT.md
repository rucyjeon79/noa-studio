# NOA STUDIO — 2026-10-26 P0 운영 검증 기록

상위 작업 `integration-finish-20261024`와 기존 12개 영역을 유지했다. 추가 7개 항목은 `NOA-20261026-P0-01`부터 `07`까지 별도 ID로 누적했다. 이 기록은 부분 배포·검증 증거이며 전체 정상화 완료 선언이 아니다. 지시 원문은 [추가 지시 원문](requests/NOA_20261026_P0_ADDITIONS.md)에 보존했다.

## 배포와 검증 증거

| 항목 | 커밋 / Actions | 검증 범위 |
|---|---|---|
| 업로드 상태 복구 | `1d00a07f1c335faf569311c8e79286135126bd7c` · [성공 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40268367174) | 상태·대기열 요청 분리, 세션 잠금 해제, 예약 복원, 조회 실패 격리, 완료 상태 보존 |
| 원본 보존 | `b4e5e4910db00c6b2a8635e053ce7764dd58b121` · [성공 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40271382876) | 원본 자동 삭제 차단, 검증된 조립 원본이 있을 때만 중복 청크 정리, 실제 대상 MP3 해시 확인 |
| AI 편집·조회·관리 상태 | `ece60ab4184349f44e151b6cedc969f86b73c866` · [성공 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40273140280) | 11개 변경 파일 반영, 보호 파일 11개 동일, 운영 SQL 읽기 및 배포 JS 검사 |
| 최종 화면 수정 | `66434b7ded30643ecb4afcce96aca3e16b1fb301` · [실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40274802455) | AI 버튼 Purple, 모바일 수정 버튼 겹침 방지, 필수 디자인 검사, 운영 반영과 재검사 성공 |
| 통합 후보 검증 | [성공 후보 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40274802405) | 네이티브 순서 저장·재조회·CSRF, 실제 PHP/JS와 합성 WAV로 상세 조회 중 재생 연속성·이전 응답 격리; 운영 전체 배포는 실행하지 않음 |
| 카테고리 정렬 SQL 이전 | `0aad60e1d82f89aa8d3eacf60cfc1386e44d72f1` · [성공 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40275787762) | 사연 정렬 89개·커버 정렬 74개, revision 1; 원본 파일·다른 문서·음원 보존, 재실행과 공개 목록 재조회 일치 |
| 실제 회원 검사 | [실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40274802407) | 임시 QA 계정으로 실제 로그인·권한·소유 음원과 모바일 화면, 생성한 자료만 정리; 6개 모바일·테마 조합, 주요 화면 24개 확인 성공 |

운영 코드 최종 커밋은 `0aad60e1d82f89aa8d3eacf60cfc1386e44d72f1`이다. [영구 검증 메타데이터](NOA_20261026_RELEASE_EVIDENCE.json)에 배포 파일 해시·이전 영수증·회원 검사·현재 큐 상태를 기록했다.

후속 후보 검사 수정 커밋 `c4c161a51ae8e27b8bff322bd1a7e21f774daa02`는 운영 코드를 바꾸지 않는다. 승인된 SQL 정렬 파일을 기존 범위 검사에 등록하고 PHP 확장 설정의 YAML 표기를 바로잡았다. [통합 문서 후보 검사](https://github.com/rucyjeon79/noa-studio/actions/runs/40276530056)에서 네이티브 저장·revision 충돌·재시도·모바일 편집 검사가 통과했다.

## 업로드

신고된 `single:kpop-original:05` / **너와의 모든 순간**은 업로드 `e4249fc5e2169339c3e3a9998a139d8c`, 작업 83이다. 2026-10-26 13:09:10 KST에 `ready`가 됐으며, 13:56:05 KST 운영 검사에서 `final_verified`와 처리 원본·최종본의 연결을 확인했다. 정상 MP3는 7,653,165바이트, SHA-256 `4da0d43439bb63c6be1a0effc5efdc1519ccda7767746485ca80f1d03ecc6cf8`이다.

14:51:09 KST 최종 전수 조회는 대기 0건·진행 0건·완료 76건이었으며 실패 3건은 이전 QA 작업으로 구분했다. 최종 처리기 기록은 idle이다.

수정 전 화면은 조회가 실패해도 이전 대기 순서를 계속 표시했고, 한 곡의 조회 실패가 다른 곡의 갱신도 중단했다. 현재는 상태와 대기열 조회를 분리하고, 연결 복귀·화면 재진입 때 재조회하며, 확인되지 않은 대기 순서는 숨긴다. 같은 파일의 중복 작업 생성과 완료 후 재전송을 막는 검사도 유지했다.

원본 보존 수정은 이후 자동 정리에 적용된다. 과거 실제 업로드 23개 행(21개 곡 키)의 `incoming/input.audio` 부재가 관찰됐다. 이것은 다른 백업에도 원본이 없다는 증거가 아니며, 과거 원본 복원 완료로 표시하지 않았다. 기존 GitHub 예약 실행 지연 때문에 최적화가 즉시 시작된다고 보장하지 않는다.

## AI 생성과 대화

버튼 클릭 → 설정 확인 → 요청 중 표시 → 생성 초안 → 사용자의 적용 → 별도 저장 순서를 구현했다. 요청 식별자와 결과 영수증은 MySQL에 저장하고, 중복 클릭·불확실한 응답의 자동 재과금과 오래된 revision의 저장을 차단한다. 사용자가 요청 중 입력을 바꾸면 생성 결과를 자동 적용하지 않는다. HTML 오류 응답도 화면에서 안내한다.

AI LAB에 설정 상태와 관리자 연결 검사, 모델·사용량·예약 비용을 표시한다. API 키는 서버 비공개 설정으로만 취급한다. 실제 청구 비용은 제공자 청구 확인 전까지 미확정이며 예약액을 실청구로 표시하지 않는다. 곡 검색과 기존 곡 안내는 자체 데이터 처리다.

운영 설정에서 텍스트 활성화 false, API 키 없음, 일일 한도·작업 한도 0, 대화 활성화 false, 대화 단가 미설정이 확인됐다. 실제 외부 생성·유료 대화·실제 포인트 차감 검증은 미완료다. 격리된 응답 시험을 실제 모델 생성 성공으로 계산하지 않았다.

## 곡 정보와 저장 구조

[필드 감사](NOA_20261026_FIELD_AUDIT.json)와 [Drive 원본 대조](NOA_20261026_SOURCE_COMPARISON.json)를 남겼다. 운영 음악 문서 660개(곡 520·사연 85·플레이리스트 55), 카탈로그 기록 662개를 구분했다. 검증된 Drive SQL 백업과 현재 보관 원본 파일 731개의 해시가 모두 일치했다.

원본 경로가 연결된 문서 653개를 비교한 결과, 원본의 비어 있지 않은 필드가 현재 문서에서 사라진 사례는 0건이다. J-POP ACT 1의 `thumbCast` 차이 1건은 수정 이력을 보존하고 관리자 검토 대상으로 남겼다. 추가 4개 카탈로그 복구 문서와 사용자 생성 플레이리스트 3개는 기존 원본 경로가 없어 별도 분류했다. **이번 대조로 자동 복원한 원본 필드는 0건**이다.

곡 소개 486개가 공통 편집 조회에 나타나도록 기존 `summary` 등을 연결했고, YouTube 설명 수정이 곡 소개를 덮어쓰지 않도록 분리했다. 번역·제작 프롬프트·캐릭터 프롬프트의 조회·편집 필드는 연결했으나, 원본에 없는 값은 AI로 채우지 않았다. 필드의 빈 값 수는 MP3·이미지 파일의 실제 부재 수와 같지 않다. 정렬 필드 수 또한 EP 번호 기반·플레이리스트 멤버·카테고리 순서를 포함한 실제 순서 유무와 구분한다. 파일 저장소·자산 테이블의 상태는 별도 증거로 판정한다.

| 저장 위치 | 역할과 충돌 규칙 |
|---|---|
| `noa_documents.payload` | 편집 가능한 운영 문서 기준. revision 비교와 트랜잭션으로 동시 수정 차단. 기존 알 수 없는 필드 보존 |
| `noa_document_history` | 수정 전후 문서 이력. 기존 원본 보존 |
| `noa_catalog_versions.fields_json`, batches·aliases | 수집 시점의 검증된 스냅샷·식별자. 실시간 조회는 최신 문서를 우선 투영하며 과거 스냅샷을 임의 재작성하지 않음 |
| `packages/records/*.json` | SQL 문서·revision에서 만든 내보내기 스냅샷. 편집 기준으로 재수입하지 않음 |
| 복구·수집 계획 JSON | 해시 검증된 임시 실행 계획. 적용 전 승인·revision 규칙 유지 |
| `meta:category-order` (SQL 문서) | 사연·커버 기본 목록의 정렬 기준. expectedRevision과 기존 순서가 모두 일치할 때만 저장. SQL 이력 보존 |
| `category-order.json` | 이전 전 원본으로 보관. 89개·74개 정렬 항목을 그대로 SQL로 이전했으며, 이후 파일 변경은 운영 순서에 영향 없음. 기존 파일 해시 불변 확인 |

## 디자인·운영 상태

배포는 후보 검증과 디자인 검증을 모두 필요로 한다. 360·390·430·1280px, 두 테마에서 JUKEBOX 2줄·가로 넘침·버튼 겹침·44px 터치 영역·정사각형 이미지·중첩 장식·하단 메뉴 간격을 검사한다. 운영 자산과 후보 자산은 같은 격리 콘텐츠로 화면을 비교한다. 표준 pixelmatch의 안티앨리어싱 제외와 임계값 0.1을 사용하며 의미 있는 변경 픽셀은 0개만 허용한다. 실제 고대비 변경을 탐지하는 검사도 포함한다. N80 8개 화면과 창작자 6개 화면을 추가 검사한다.

실제 회원 검사에서는 2~6레벨의 메뉴·직접 URL·관리자 접근 차단, 소유 음원 Range 206·다운로드 해시·다른 회원 접근 거부, 원본 파일 선택 재개, 만료 권한 복귀를 확인했다. 기존 회원은 수정하지 않았고 생성한 임시 계정 2개 및 소유 자료만 정리했다. MUSIC 602곡이 YouTube 목록 876개에 연결되는 것도 확인했다.

운영 모바일 검증은 Chromium 뷰포트 검사이며 실제 Android 기기 검증과 구분한다. 기존 모든 페이지의 디자인 완료를 선언하지 않는다.

[N80 증거 등록 성공 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40276489474): revision 9, 추가 7개 작업에 `n80-completion-09acbfdb17b4545c0c08403d78a51504b1f09df49aff79edd83ef6f50c59da92`를 연결했다. 실제 서버 파일 8개와 성공한 검증 아티팩트 해시를 다시 확인했다.

[운영 창작자 모바일 화면](20261026/creator-mobile.jpg) · [운영 MUSIC 모바일 화면](20261026/music-mobile.jpg)

N80 관리자 화면: https://noastudio.ai.kr/noa-work-status.php . 고유 작업 ID·원문·현재 단계·마지막 성공·활동 시각·오류·증거와 미완료 복원을 제공한다. ChatGPT Work 내부 실행을 제어한다고 표시하지 않는다. 상위 12개 영역은 완료 증거가 없는 상태를 그대로 유지한다.

## 변경 파일

업로드: `deploy/noa-app/jukebox/upload.php`, `upload.js`, `upload-core.php`, `operations.php`, `index.php`, `deploy/noa-music.php`.

AI·정보: `bridge/ainoa-generation.php`, `ainoa-core.php`, `lab-core.php`, `lab-api.php`, `package-record.php`, `index.php`, `deploy/noa-ainoa.php`, `noa-browse-edit.js`, `noa-editor.php`, `noa-ai-lab.php`, `noa-ai-lab.js`.

상태·디자인: `deploy/noa-app/engine/work-state.php`, `deploy/noa-work-status.php`, `deploy/noa-sitemap.php`, `deploy/noa-creator.php`, `deploy/noa-creator.css`.

정렬: `bridge/category-order-store.php`, `deploy/noa-category-order.php`, `deploy/noa-category-order-admin.php`, `deploy/noa-browse.js`, `deploy/noa-browse-order.js`, `scripts/noa_category_order_migrate.py`, `scripts/noa_category_order_migrate.php`.

감사·증거·검증: `bridge/p0-audit.php`, `bridge/p0-inventory.php`, `scripts/noa_p0_*`, `scripts/noa_ainoa_deploy.py`, `scripts/qa/noa-design-gate.mjs`, `scripts/qa/noa-p0-generation.mjs`, 회원·카테고리 회귀 검사와 관련 GitHub Actions. 각 커밋의 정확한 변경 목록을 기준으로 하며 서버 전체 덮어쓰기를 하지 않았다.

## 남은 항목

- AI 운영 키·활성화·비용 한도·대화 단가 설정 후 실제 생성과 과금 검증. 회원·포인트 저장소의 안전한 백업·엔진 전환 검증도 기존 미완료 항목으로 유지한다. 이전 자동 승인 검토에서 암호화 회원/포인트 백업과 복호화 키의 Drive 동시 전송이 민감정보·자격정보 전송 사유로 거절됐으며 재시도하지 않았다.
- 과거 원본 음원의 별도 백업 확인·복원, J-POP ACT 1 보컬 차이 검토, 원본이 없는 필드 자료 확보.
- 전체 12개 영역의 저장 경로 최종 검수. 이번 곡·플레이리스트·카테고리 정렬의 SQL 통합 범위와 구분한다.
- 전체 12개 영역의 미완료 작업, 전체 화면 디자인·실제 기기 검증. 이 기록의 성공한 부분 검사로 완료 상태를 올리지 않음.
