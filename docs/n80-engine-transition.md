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

**Evidence boundary:** policy compliance and registry membership are not runtime conformance. The universal executor currently still returns `executor_not_installed`; the readiness contract does not certify all adapters, durable consumer acknowledgments or production replay tests. Existing specialized workers must be traced individually. Do not turn a policy flag into a fabricated completion receipt or enable universal dispatch to bypass these gaps.

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

### 남은 실제 전환 범위

뮤비 생성의 외부 제공자 응답 대기를 runner 작업으로 옮기는 일, 구 미디어 제작의 최종 파일 전용 게시자, PLAYLIST/WORLD/ADMIN의 정의된 처리 효과 및 replay 검증, 화면 간 공통 조회 조정은 아직 완료되지 않았다. API 생성의 비활성 설정과 예산은 이 배포에서 강제로 변경하지 않는다. 이 변경을 전체 런타임 통합 완료로 보고하지 않는다.
