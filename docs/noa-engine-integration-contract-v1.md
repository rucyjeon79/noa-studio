# NOA ENGINE — Integration Contract v1

Status: foundation specification; **not yet active in production**.

## Ownership
Chat Assistant is the orchestration interface; NOA ENGINE owns shared policies and workflow contracts. Feature modules retain ownership of their data and operations. GnuBoard remains a lower-level identity/community service.

## Common contracts
- Command: `id`, `type`, `actor`, `module`, `payload`, `requestedAt`, `idempotencyKey`.
- Event: `id`, `type`, `source`, `subjectId`, `occurredAt`, `schemaVersion`, `correlationId`.
- Result: `status` (accepted, running, succeeded, failed, blocked), `correlationId`, `errorCode`, `retryable`.

## Module responsibilities
| Module | Owns | Publishes | Consumes |
|---|---|---|---|
| JUKEBOX | uploads, FIFO, conversion | audio.ready, audio.failed | upload.requested |
| MUSIC | catalog playback/read models | playback.started | audio.ready |
| MY PLAYLIST | user lists and entries | playlist.updated | audio.ready |
| YOUTUBE | remote sync and video metadata | youtube.synced | sync.requested |
| NOA WORLD | official EP/MV read model | world.updated | youtube.synced |
| AI LAB | AI jobs | ai.completed, ai.failed | ai.requested |
| ADMIN | approved actions and audit | operation.approved | operation.requested |

## Required engine safeguards
1. Durable idempotency and unique event IDs; never retry an upload by blindly duplicating it.
2. Authentication/authorization enforced by server endpoints, not by chat text.
3. One module failure must not halt other modules. Bounded retries, backoff, dead-letter handling.
4. No SQL schema migration, file deletion, or production mutation in this foundation phase.
5. GitHub merge is not a deployment receipt. Require production URL and remote checksum proof.
6. Sensitive credentials never enter events or logs.

## Rollout
1. Inventory existing module interfaces, queues, scheduled jobs, ownership and dependencies.
2. Introduce read-only module health and contract adapters.
3. Add idempotent event outbox/inbox with schema and migration reviewed separately.
4. Connect one verified end-to-end workflow (JUKEBOX audio.ready -> MUSIC catalog refresh) without replacing active FIFO.
5. Expand only after regression tests and safe rollback evidence.

## Definition of done
An automated workflow has an authenticated command, durable event, correlated result, isolated failure path, regression coverage, rollback plan and verified production execution. This document alone does not satisfy completion.
