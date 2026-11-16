# N80 / DotHome resource suspension: root-cause containment and recovery

**Incident date:** 2026-11-16 KST  
**Site:** `noastudio.ai.kr` / DotHome shared hosting  
**Priority:** P0, recurrence-prevention rather than general performance optimization  
**Owner rule:** N80 acts only on a user's action or an explicitly approved scheduled wake; ChatGPT assists with unsupported capabilities; Google Drive holds verified backups.

## Reported hosting incident

The prior operator communication stated that an unexpected resident `MainThread` process appeared around 11:42 KST on Nov 16. Long-running N80 Hub background execution and its CPU/RAM consumption interfered with the shared host. The account was released around 16:46 KST with a warning that similar load could cause renewed restrictions.

This is the **operator-reported** cause, not independent CPU profiling. Do not relabel historical error receipts as a successful operating runner. The previously installed Node runner used a roughly 10-second heartbeat loop, standalone detached startup and operation timers.

DotHome's current terms prohibit running schedulers and load-generating scripts on the web server and allow suspension for disproportionate shared server resource use: https://www.dothome.co.kr/rules/service.php?part=dothome . DotHome's help documentation also warns about excess API traffic and recommends separate hosting where resources should be isolated: https://docs.dothome.co.kr/books/faq-nCD/page/7f100 .

## Permanent containment deployed to DotHome

| Revision | Affected source | Permanent protection |
|---|---|---|
| 2.1.408 | `noa-app/engine/hub.php` | Replaces `n80_hub_start` with unconditional `hub_resident_runner_retired`. No `proc_open` or `launch.mjs` path. |
| 2.1.409 | `noa-bridge/hub-worker.php` | Rejects `heartbeat`, `execute` and fresh `codex.claim` before nonce/state writes. Retains authenticated `codex.read/complete/failed` for previous result reconciliation. |
| 2.1.410 | `noa-hub.php` | Removes deprecated Start/Resume/Wake buttons, prevents these POST actions, preserves deploy/backup/receipt inspection. |

All three revisions were applied through the owner-authenticated Hub release path with sha256 checks, PHP parse checks and Drive before/after release backups. Runtime state remained `stop=true`, `paused=true`. A stale `ai.batch` receipt must **not** be replayed.

## Prevention in GitHub

- `.github/workflows/n80-hub-bootstrap.yml` permanently retired: no GitHub SSH bootstrap can reinstall the resident Node runner.
- `.github/workflows/n80-engine-facade-production.yml` permanently retired: no GitHub SFTP production job from the historical route.
- `runtime/hub/launch.mjs`, `runtime/hub/runner.mjs`, `scripts/n80_hub_bootstrap.py` changed to non-executing retired stubs while preserving minimal pure historic protocol helpers.
- `deploy/noa-app/engine/hub.php` mirrors the live retired function and its `host-load-policy.php` dependency.
- `tests/safety/n80-host-stop-latch.mjs` + `scripts/qa/n80_schedule_policy_guard.py` fail if removed runtime execution paths return.
- Approved scheduled job list remains empty pending owner approval and verified signed N80 intake. GitHub must not perform AI, media, database, queue or publication work.
- Retired workflows preserve their history through Git; do not resurrect them under a new name.

## Remaining P0 acceptance criteria — not yet completed

- [ ] Inspect host OS process table under the actual hosting user and confirm zero active `MainThread` / detached `runner.mjs` processes. A stale heartbeat is **not** proof of no OS process.
- [ ] After backup and verified Drive SHA+restore metadata, physically remove obsolete `/hosting/noastudio/noa-hub/runtime/` executable launcher and old unreferenced Node/browser/media runtime binaries. Do not remove task receipts, current job leases, site/core data or canonical production code. No deletion has yet been proven.
- [ ] Determine the real account resource allowance/usage from DotHome panel and operator follow-up; demonstrate no long-running CPU/RAM process and no high-frequency host I/O.
- [ ] Examine JUKEBOX audio/media serving. Prior read-only run logged about **4.86 GB of audio files** hosted; large multimedia streaming can be a separate DotHome terms risk. Preserve original audio, move heavy delivery to a dedicated approved media/object storage/CDN before changing playback URLs. Google Drive is the required backup destination, **not** an assumed audio CDN.
- [ ] Fix any remaining independently triggered GitHub/host workflow that causes host work without user action or a separately approved schedule. Do not replace with short cron polling.
- [ ] Verify end-to-end user action -> N80 bounded work -> ChatGPT assistance request -> canonical task receipt without an unattended ChatGPT background session.
- [ ] Complete scheduled GitHub signed wake -> authenticated N80 intake, only after the owner explicitly approves schedule and hosting permits it. Stay fail-closed meanwhile.
- [ ] Reconcile `ai.batch` receipt `6afa62eb70f166d838d43afca0bac90f` against authoritative job evidence. Do not create a retry.
- [ ] Observe production without invasive polling over a meaningful period; require host resource graphs and operator acceptance before declaring the incident resolved.

## Explicit exclusions

No automatic reactivation of the host runner, no GitHub business worker, no blanket cleanup or deletion, no speculative retry of incomplete audio or AI work, no overwriting member/financial data. Protect NOA originals, drafts, audio, member records, payment records, consent and source versions.

**Definition of done:** physical resident execution removed + host quotas stable + user work preserved + approved one-shot events genuinely verified + DotHome account restrictions not re-triggered. A passing CI test or PHP syntax check alone is not enough.
