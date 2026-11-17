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
