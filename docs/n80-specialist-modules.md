# N80 specialist modules

The seven requested foundation modules and three common specialists are owned by N80 Engine. CREATOR LAB, AI LAB and 홈페이지 설정 remain the user-facing workspaces. A module is not another queue, daemon, database, provider account or payment ledger.

| Module | Execution boundary | Existing entry points |
|---|---|---|
| N80 Node | Host runtime contract and bounded installation evidence; existing N80 Auto transport | Signed worker status, existing Node worker |
| N80 Setup | Workspace definitions, routes and access classification | workspaces.php → setup.php |
| N80 Install | Release/update manifest validation and installation-operation ownership | app-lifecycle.php → install.php; existing installer commands |
| N80 Lab | AI operation selection and one selected handler; Guard supplies the permission gate | service-runtime.php → lab.php |
| N80 DB | Application PDO and separate read-only administration connections | storage.php / database/core.php → db.php |
| N80 Sign | Member roles, document ownership and route access | member-access.php → sign.php |
| N80 Pay | Server-side cart prices, benefits and verified settlement checks | toss-core.php / youngcart-core.php → pay.php |
| N80 Guard | Service authorization and policy audit | lab.php / media.php / guardian.php → guard.php |
| N80 Notify | Notification delivery and retry | notifications-inline.php / Hub → notify.php |
| N80 Media | Audio processing, image repair and media completion | queue-core.php / worker-media.php / Hub → media.php and its implementations |

Old identifiers resolve without duplicate registration: ai_lab→lab, database→db, identity→sign, commerce→pay, app_lifecycle→install, guardian→guard, notifications→notify. Historic receipts and observer data retain their original keys and hashes. The registry retains the existing specialists and the installed Hub administrator route. The common-module release owns the specialized Hub adapters; the Hub release retains host-runner installation and source custody.

Registry inclusion must not start work or connect a database. Node installation evidence reports `runtimeHealth=not_checked` until a real signed probe. Provider approval, OAuth/session bootstrap, payment transactions, refunds, original stores and replay guards remain in their established services beneath these boundaries. Setup is currently responsible for configuration navigation, not a replacement settings database.

N80 Auto operation IDs, scripts and authorization are preserved. All 26 registered operations have one functional owner; installation and Android publication belong to Install, Node verification to Node, and AI execution to Lab. Existing signed operation permission and method checks remain mandatory.

## Activation and verification

For `[n80-specialists]` commits, the existing N80 single-session deployment limits activation to the 20 changed module/caller sources and installs new dependencies before compatibility callers, requires exact known preimages, checks protected source hashes, and rolls back only its own bytes. `[n80-specialists]` releases retain member/payment checks and use this one activation instead of overlapping legacy deployments. The two reviewed Hub preimages are accepted only because both Hub registration and its menu route are explicitly preserved; other drift still fails closed.

Candidate checks cover PHP syntax, all engine tests, permissions, SELECT-only database grammar, Drive-only backup policy, MySQL settlement/point idempotency and concurrent callbacks, signed service execution, and Node contract/runtime tests. Candidate success does not prove host activation. Production completion additionally requires the existing deploy receipt and signed runtime verification.

## Common specialists and Hub handoff — 2026-11-10

N80 Guard, N80 Notify and N80 Media are canonical modules. `guardian` and
`notifications` resolve as aliases; they do not register second executors.

| Existing operation | Functional owner | Preserved execution/store |
| --- | --- | --- |
| Hub verification, source custody and deployment receipts | Hub | Existing host runner and Hub receipts |
| AI text and daily shorts orchestration | Lab | Existing signed service and Lab state |
| Creator batch recovery | creator_lab | Existing batch tasks |
| Song indexing and readback | catalog | Existing MySQL index |
| Missing cover artwork repair | Media | Existing revision checks, verified publication and Hub retry state |
| Notifications | Notify | Existing outbox, SQL leases, inline/scheduled drain |
| Popularity calculation | personalization | Existing popularity store |
| Member renewal and fan-credit maintenance | Sign | Existing subscription transactions and maintenance receipt |
| Execution permission checks and Guardian audit | Guard | Existing server-authenticated principal, permissions, methods and policy |
| Audio FIFO, media worker and final file publication | Media | Existing audio tables and Lab jobs; no queue creation or migration |
| Playback and its user controls | JukeBox | Existing player and OS media controls |
| Runtime/APK installation and artifact delivery | Install | Existing checked install and publication commands |

Hub's `owner=n80_hub` continues to mean **execution custody on the host** and
still fences GitHub re-execution. `module` separately identifies the functional
owner. Hub dispatch loads only its fixed handler and new receipts record that
module. `n80_status.moduleOwnership` reports the canonical service and Hub maps.

The media bridge and audio queue paths remain compatible delegates. Their actual
implementations live in `engine/media-worker.php` and `engine/media-queue.php`.
The existing table names, jobs, leases, consent, retry and publication checks are
preserved. No schema/data reset, new queue, scheduler, key or provider is added.

`config/n80-hub-dependencies.json` assigns owners to registered operations and
remaining runtime migrations. Workflow sources with no registered operation
are marked `source_custody_only`: storing their source in Hub is not proof that
their former execution has migrated. Browser authentication, external media
runtime transfer, Android build/signing and end-to-end shorts proof remain
separate acceptance items; ownership assignment does not mark them complete.

The `[n80-common]` unified source release owns this cutover, installs dependencies
before compatibility callers, validates exact preimages and supports rollback.
It does not run the Hub bootstrap or change active operations and intervals.

## Verified direct activation

On 2026-11-10, the ChatGPT → N80 Hub direct release `bb52593a6215d446b33e639606b8d591` activated the 23 reviewed source files at source revision 11. All 23 remote hashes matched. The live Hub connection source references added concurrently at revision 10 were retained. The obsolete Actions publisher stopped before changing any operating files.

Specialist acceptance job `129570244159` in run `42737513738` passed PHP/MySQL ownership, authorization and settlement checks, notification crypto, the migrated audio FIFO, zero-pixel shared design comparison and Hub mobile/desktop interaction checks. Host acceptance job `129575328301` in run `42739058685` independently verified all 23 source files and the signed live status: 21 canonical modules, Notify ownership of notification dispatch, and Media ownership of final completion. This verification created zero generation requests and no new scheduler.

The existing host runner had stopped reporting before this release. Its installed launcher was resumed with the same control state and queue. The eight already active Hub operations then produced successful receipts naming their specialized owners. `ai.daily_shorts_clock` remains assigned to Lab but is not activated; browser login, external media runtimes, Android publication and full Shorts production remain separately unverified. Details are recorded in `docs/operations/n80-common-cutover-20261110.json`.
