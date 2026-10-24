# N80 ENGINE — current automation and activation status

Updated: 2026-10-24. This supersedes the original eight-library assessment.

## Implemented and tested

| Capability | Evidence | Meaning |
|---|---|---|
| Unified facade and single Bridge | `n80.php`, `bridge.php`, facade/bridge tests | Plans routes; does not execute a worker |
| Durable event persistence | durable-store and security tests | Isolated persistence contract; not a transactional outbox with production SQL |
| Lease fencing, retries and dead letter | lease-state, fencing, replay and persistence tests | Isolated recovery behavior; production cutover is still unverified |
| Ready-event identity and read-only catalog probe | readonly-pipeline, authenticated-probe and ready-event tests | Stable event identity; catalog observation is not a business-effect ACK |
| Receipt validation | receipt-contract test | Validates a read-only observation only |
| Production integrity audit | `n80_guardian_remote_audit.py` | Discovers engine PHP files and verifies SHA-256 plus JUKEBOX CLI without writing to host |
| Automated regression | Unified Contract Gates, PHP 8.2/8.3 with PDO SQLite | Runs all engine contracts and audit failure tests on pull requests, main changes and daily schedule |

The production audit treats only `bridge-flow.php` and `performance.php` as optional isolated diagnostics. An absent diagnostic is reported; a changed deployed diagnostic fails. Every other discovered engine library and JUKEBOX CLI is required. Hash equality proves deployed source integrity, not runtime execution or service uptime. Reports explicitly retain `runtimeExecutionVerified=false` and `operationalReady=false`.

## First production observation runtime

The bounded authenticated production observer is documented in `n80-live-observer.md`. It invokes actual ready-event and MUSIC observation contracts using a READ ONLY transaction. Its activation does not enable business dispatch or business ACKs.

## Still required before autonomous execution

1. Derive producer identity from an authenticated server process. A caller-supplied context flag alone is not authentication.
2. Provision restricted private operational event storage and verify its retention and recovery. Runtime event/lease data are service state, not expendable temporary files.
3. Couple committed audio-ready changes with transactional event delivery; the existing separate event file write does not establish atomicity with MySQL.
4. Install idempotent consumers and acknowledge only a defined completed effect. Catalog observation remains read-only.
5. Exercise concurrent claims, crashes, lease expiry, stale ACK, retry exhaustion and replay against the actual production backend.
6. Connect runtime Guardian telemetry, kill switch and a monitored canary while preserving existing FIFO/FFmpeg work and data.

`dispatch-gate.php` intentionally blocks execution; adapters remain disabled. Successful contract tests and hash audits do not authorize or prove live autonomous orchestration. No production event emission or replay is part of the verification workflow.

## Fixed storage policy

- All permanent backups and recovery copies: the existing Google Drive backup folders.
- Work files and intermediate outputs: GitHub Actions runner temporary storage; hash-only audit artifacts expire after one day.
- Hosting: completed runtime outputs and necessary operational state only. Verification creates zero hosting files.
- Do not run a legacy installer that creates hosting `.tmp` staging files under this policy. A replacement deployment mechanism must satisfy this rule and verify Drive recovery evidence before replacing live files.
- Drive backup authentication and the database offsite provider were not configured by this N80 verification. Backup-dependent changes must remain blocked until verified.

Daily checks remain separate and non-destructive: engine contracts at 02:23 UTC and production source integrity at 03:41 UTC. Neither check terminates uploads, writes production database rows or activates dispatch.
