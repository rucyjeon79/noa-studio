# N80 Shorts host check and control-room repair

The control room still sent its trial requests to the retired resident runner.
Its renderer also depended on `NoaDisplay.state` without guaranteeing that helper
was loaded. A cancelled job could interrupt rendering and be shown as a generic
refresh failure. Idle pages repeated the expensive status request every five seconds.

## Implemented behavior

The authenticated administrator form now performs one explicit, read-only check
through the existing `n80_service_execute('n80_daily_shorts_tick')` route. A fixed,
server-owned context selects the snapshot branch of `worker-shorts.php`; request
body commands cannot enable or broaden that branch. The real clock and readiness
functions calculate against a copy of the current Lab state. They never commit
that copy, call a provider, generate media, publish or change activation settings.

Only diagnostic records are appended under `readOnlyChecks` in the existing
`shorts-trial.json`. Legacy trial, execution, request and `ai.batch` evidence is
preserved. An attempt is recorded before dispatch. The same request ID never
dispatches again; an unfinished record blocks another check. No automatic retry
or history pruning is added. Thirty-second spacing and a 32-record limit bound
administrator diagnostics. Observation through GET no longer writes trial data.

`lab_read(750)` bounds shared-lock acquisition for this check and this control
page; other callers retain their original behavior. The bounded snapshot refuses
symlinks and state files larger than 16 MiB. This is not a verified wall-clock
guarantee for the entire host stack or a production executor approval.

The control room renders without the optional display helper, distinguishes the
retired heartbeat from current diagnostic results, and lists specific missing
connections. It polls only while an active production task exists, for at most
12 reads at five-second intervals. A failed read stops polling; manual refresh
remains available. No polling action executes production.

## Validation scope

- Actual monitor code with isolated Hub/service fixtures: fixed route/context,
  duplicate and lost-receipt handling, owner scoping, legacy preservation and
  observation without writes.
- Actual PHP worker, clock, readiness and Lab reader with synthetic data: original
  state remains byte-identical after calculation; body commands are rejected.
- Native PHP shared/exclusive lock contention: bounded wait and unchanged state.
- JavaScript renderer without `NoaDisplay`: cancelled jobs render, idle/error
  polling stops, and active polling stops after 12 reads.
- Deployment must use fresh N80 source hashes and revision, followed by an actual
  administrator form check and receipt inspection on the production host.

This check does not validate signed scheduled admission, hosting permission,
unattended ChatGPT/Gemini/Flow, video production, uploads or related-video linking.
Those production gates remain disabled and must not be marked verified by this check.

## Deployment and observed result — 2026-11-17 KST

Source commit `076ba118013621e2334ac99bb3321599e6cdd9a8` introduced the repair.
Release **2.1.482**, ID `65aed2b7b4ad72e13daea55aa124d7a3`, deployed five files
against fresh revision 481 and their preimage hashes. The subsequent full quality
check found that the newly source-controlled existing control page was missing
from the navigation registry. Commit `a365293c593a3523da03657a7a8771d26660953b`
registered its administrator route without weakening the coverage check.
Release **2.1.483**, ID `c43920085e6091378c0a6f556d185b1a`, applied only that row to
the current live registry, preserving its existing differences from repository
source. A final revision-483 manifest matched all six intended deployed hashes.

Automatic backups:

| Release | Package | Preimage |
| --- | --- | --- |
| 2.1.482 | [Backup](https://drive.google.com/file/d/1-sGvJ1AFxbaDKriBt_1l1BUUv9iSZUGE/view) | [Before change](https://drive.google.com/file/d/1JPdQntQHcJbNROLKAtua8tbMn044u82Z/view) |
| 2.1.483 | [Backup](https://drive.google.com/file/d/1E-5i7-DgjqAMtJdZjyeJGWoK0AS1bhVJ/view) | [Before change](https://drive.google.com/file/d/1wZ23jPeduk6ACB4298y46GhIuF_IKBf3/view) |

At **14:26:50 KST**, the existing authenticated administrator session submitted
the new read-only check exactly once on the actual production control page.
The resulting diagnostic receipt reported:

| Field | Observed value |
| --- | --- |
| Receipt | `b37e109aed408abad3949aadb509ddfe` |
| State / clock state | `checked` / `connection_required` |
| Calculation duration | **46.366 ms** (module calculation, not total HTTP latency) |
| Lab source revision | `17526` (not the site release revision) |
| Business state written | `false` |
| Provider calls | `0` |
| Production verified | `false` |
| Next computed preparation | 2026-11-18 08:00 KST |
| Next computed publication | 2026-11-18 12:00 KST |
| Polling needed | `false` |

The dates are the clock's calculated schedule, not promises that production will
run. The prior cancelled job and its existing media remained present. The old
resident remained retired and paused; the public scheduled wake and production
activation remained disabled. The unresolved `ai.batch` receipt was not replayed.

The snapshot identified these remaining connection blockers:

- `persistent_browser_executor_required`
- `chatgpt_unattended_dispatch_not_verified`
- `youtube_auto_publication_not_enabled`
- `youtube_related_video_adapter_not_verified`

The first item does not authorize resurrection of the retired resident. Hosting
approval, a bounded nonresident execution path, dedicated wake signing setup and
signed public wake verification remain separate requirements. Gemini/Flow media
generation and the complete upload/publish chain were not exercised by this check.

Verification completed:

- [Shorts isolated safety gates](https://github.com/rucyjeon79/noa-studio/actions/runs/44023968849): passed on implementation commit, including monitor, snapshot, UI and native PHP lock tests.
- [Schedule guard](https://github.com/rucyjeon79/noa-studio/actions/runs/44023968915): passed on implementation commit.
- [Full existing-feature quality gates](https://github.com/rucyjeon79/noa-studio/actions/runs/44024639963): passed after administrator route registration.
- [Unified engine contract gates](https://github.com/rucyjeon79/noa-studio/actions/runs/44024640000): passed after administrator route registration.
- Production form result and rendered control screen were inspected; idle refresh
  polling was off and the cancelled job no longer caused a renderer failure.
