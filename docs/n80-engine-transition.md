# N80 Engine — canonical identity and transition

The official name is **N80 Engine**, controlled by Chat Assistant within NOA STUDIO 2.0.

The existing NOA ENGINE PHP libraries, deployed paths, Git history, media, member data, queues, and service contracts are preserved. No mass rename or removal is authorized.

## Integration rule
Use `n80_engine_identity()` for branding and canonical engine identity. Existing `noa_engine_*` functions remain supported compatibility interfaces until verified replacements exist.

## Completion gate
N80 Engine is **not operationally complete** until authenticated producers, durable storage, leased consumer acknowledgments, actual module adapters, bounded execution, monitoring, rollback, and production end-to-end recovery tests all pass.

Existing `dispatch-gate.php` remains fail-closed. Do not activate workers simply to claim completion.


## Workspace contract (2026-11-07)

The N80 Engine workspace registry (`deploy/noa-app/engine/workspaces.php`) owns specialist menu placement and access requirements. The application is above GnuBoard; native member and board functions remain lower-level services.

| Category | Entry | Responsibility |
| --- | --- | --- |
| 홈페이지 설정 | `/noa-library.php` | Member operations, service connections and system diagnostics |
| CREATOR LAB | `/noa-channel-workspace.php` | Channel content, uploads, production rules and catalog management |
| AI LAB | `/noa-ai-lab.php` | AI creation, conversation, music suggestions and production results |

Workspace entry pages render navigation metadata only. They must not load the catalog, scan media, start AI production or poll job queues. Selected tools use canonical `?tool=` routes; old hash links redirect once. A specialist belongs to one category. Diagnostic tools remain reachable behind a collapsed group.

N80 탐색기 is the shared selection surface. Adapters supply authorized candidates and preserve original keys, ownership, ordering, cancellation and scope. Titles are never identity. Metadata browsing must not hash all audio files; media verification runs for the selected song. Creating or saving a job retains the existing server authorization and idempotency checks.

The integrated N80 workflow owns deployment of shared menus, selection and MUVY sources. It requires role, metadata, selection, batch and deterministic MUVY browser checks before source activation. Entry pages and dependencies are released together with preimage checks and rollback; credentials, production data and paid provider jobs are not changed by this migration.


## N80-only execution rule (2026-11-07)

The user's explicit rule is binding: no function may run as a separate system outside N80 Engine. `AGENTS.project.md` defines the development contract; `policy.php` publishes the same requirements to the N80 facade and Guardian. A specialist module may execute in its existing PHP/JS process or leased worker, but N80 must own its invocation policy, role checks, task identity, duplicate prevention and result reporting. A single engine does not mean eager loading of every module.

No new standalone engine, parallel legacy worker, independent job queue or duplicated background scheduler is an acceptable shortcut. Preserve active data and queues during a verified adapter migration, then retire the independent initiator. Compatibility URLs must delegate to one owner.

**Evidence boundary:** policy compliance and registry membership are not runtime conformance. The executor installs exactly four authenticated operations: MUSIC availability, PLAYLIST read-model verification, WORLD read-model verification and ADMIN integrity verification. Each operation requires its own durable receipt and exact replay evidence. General business mutations and arbitrary dispatch remain disabled. Do not turn installation or evidence from another module into a fabricated completion receipt.

The integration audit now compares registry and health module IDs with the N80 registry itself; it no longer assumes a separate fixed list of nine modules after CREATOR LAB was added. The unified N80 facade workflow owns facade, policy, Guardian and integration-audit source activation together. The old integration-audit workflow only delegates a manual request to that workflow.


## 2026-11-07 실행 연결 및 전담 처리기 통합

- 음악 가용성 확인 endpoint는 `executor.php`의 `music.verify_availability`를 통해 기존 MUSIC consumer를 호출한다. 인증된 서버 문맥, 실제 작업에서 재구성한 이벤트, 기존 private event/lease/receipt를 재사용한다. 다른 consumer나 임의 이벤트는 실행하지 않는다.
- `lab-worker.php`는 HMAC·nonce·메서드를 확인하고 `service-runtime.php`에 위임한다. 텍스트 작업, 묶음 복구, 곡 색인, 미디어 작업, 읽기 전용 준비상태가 전담 처리기로 분리된다. 이전 `n80_tick`은 같은 처리기에 위임하는 호환 별칭이다.
- `task-status.php`는 기존 SQL/JSON 상태를 읽기 전용으로 공통 상태에 투영한다. 새 큐나 중복 작업 저장소는 만들지 않는다. 초안 검토 및 응답 불명은 완료가 아니다.
- 중앙 등록부가 소스 목록과 점검 연결을 함께 소유한다. `creator_lab` 누락을 해소하고 회원·권한/상거래/알림/곡 색인/개인화/앱 수명의 책임을 등록한다. 화면의 세 분류는 그대로 유지한다.
- N80 facade의 개인화 사전 로딩을 제거하고 APK 업데이트 판정을 app-lifecycle 모듈로 옮긴다.
- `config/n80-automation.json`과 `scripts/n80_auto.py`가 13개 예약 작업의 실행 소유자, 허용 workflow, 고정 명령, 실행 전제조건을 관리한다. GitHub의 기존 concurrency/timeout을 유지하고 중복 scheduler를 만들지 않는다.
- 공통 소스 배포는 unified facade가 담당한다. 예전 단일 파일 배포 workflow는 수동 별칭이다. AI 및 운영 점검은 성공한 배포 후 실행한다.
- 운영 준비상태는 설치와 실행 증거를 구분한다. MUSIC 증거가 있어도 PLAYLIST/WORLD/ADMIN을 자동으로 정상 표시하지 않는다.

### 후속 전환 구현 및 검증 범위

- 뮤비는 기존 `muvy.json` 큐와 프로젝트 식별자를 보존한다. 웹 요청은 등록 후 반환하며 기존 N80 AI runner가 8단계를 이어간다. 제공자 응답이 불명확하거나 lease가 만료되면 자동 유료 재호출 없이 확인 필요 상태로 멈춘다. 완료 전달만 같은 결과로 재시도한다.
- 미디어 분석·마스터링·렌더 중간 산출물은 runner 임시 공간에서 처리한다. 최종 산출물만 체크섬을 이름에 포함하여 기존 private 작업 폴더에 게시하고, 서버 크기·체크섬·lease 확인 후 완료 상태에서 노출한다. 구 host chunk 게시 경로는 거부한다.
- PLAYLIST는 실제 곡 참조와 소유자, WORLD는 기존 공식 재생목록 기반 투영, ADMIN은 기존 데이터 무결성 점검을 실행한다. 세 작업은 읽기 전용 DB 트랜잭션과 기존 durable event/lease/receipt를 사용하며 실제 결과와 동일 재호출을 확인한 경우에만 준비상태를 기록한다.
- `N80Runtime`이 AI LAB·MUVY·묶음 작업·관리 작업실의 반복 조회를 조정한다. 같은 요청은 진행 중 Promise를 공유하고 화면이 숨겨지거나 도구가 닫히면 조회를 멈춘다. 메뉴 진입만으로 생성하거나 큐를 처리하지 않는다.
- 기존 N80 AI workflow와 dispatch 자격증명을 재사용한다. 새 scheduler·큐·API 키·유료 테스트 요청을 만들지 않는다. 제공자 활성화·예산·승인 규칙은 기존 설정을 유지한다.

배포 검증은 PHP/SQL 권한·중복 방지·lease·receipt 테스트, 플레이어 회귀, 비동기 뮤비 PC/모바일 동작, 실제 서버 소스 대조와 네 작업의 readback/replay를 요구한다. 이 범위의 통과가 모든 가능한 기능이나 외부 제공자 사용 가능 여부를 인증하는 것은 아니다.
