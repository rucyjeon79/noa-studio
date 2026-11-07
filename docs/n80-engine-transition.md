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
