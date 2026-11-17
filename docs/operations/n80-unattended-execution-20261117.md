# N80 unattended Shorts execution — scheduled one-shot ownership

## Owner clarification, 2026-11-17

The owner reaffirmed: **N80 must not run continuously because hosting sanctions
must not recur. GitHub wakes N80 at the scheduled time; N80 processes the
scheduled work.** The previously proposed separate production execution
environment was not accepted and is withdrawn as the continuation plan.

The authorized lifecycle is one signed scheduled signal, N80 admission and
duplicate checks, bounded execution of the existing task, durable result/state
storage, then exit. There is no idle daemon, heartbeat loop, second queue or
GitHub business execution. At timeout or quota exhaustion preserve the task and
exit; a later approved wake must reconcile the original result before resuming.
Do not retry an unconfirmed provider operation just because a wake reappears.

This is the owner execution contract, not proof that hosting permits a specific
workload or that browser generation works. The next implementation target is
the missing bounded N80 production adapter on this route. The currently installed
route dispatches only a schedule/readiness check; its publication phase has no
verified handler. Historical browser and Google authorization failures below
remain separate implementation blockers. No production activation was performed
as part of this instruction correction.

## Verified current state

The user requested completion of unattended production after authorizing the
channel's automatic/scheduled publication. The administrator screen confirmed
that publication setting is enabled. This does not activate the scheduled wake
receiver or prove a completed production run.

The authenticated Hub inventory after the runtime metadata patch reports production
revision 496. This patch is diagnostic, not a production executor:

- The legacy resident is retired; its four files remain absent. It must not be
  reinstated to satisfy a missing-executor check.
- The signed scheduled-wake receiver is installed but inactive. Its dedicated
  key metadata, hosting approval, bounded executor and owner activation checks
  have not passed.
- Gemini and Flow unattended services report `authorization_blocked`.
- ChatGPT transport is configured, but its unattended integration pilot has not
  passed. A saved task or configured transport is not an execution receipt.
- Actual Shorts publication, native related-video attachment and production
  media Drive readback remain unverified.

## Concrete execution boundary

The existing host's earlier real browser trial returned `SIGTRAP` on page
startup. A subsequent read-only probe returned `ENOENT` for `/proc`,
`/proc/self/exe` and `/proc/self/status`; the saved result was
`host_proc_unavailable`. See [the host runtime evidence](n80-host-runtime.md).
This is historical SSH execution evidence. A fresh read-only observation from
the PHP-FPM web request on November 17 returned **true** for `/proc` directory,
`/proc/self/exe` accessibility and `/proc/self/status` readability. It returned
**false** for `proc_open` availability and **true** for `shell_exec` availability.
The SSH and PHP views must not be conflated: these results neither prove the old
SSH failure persists in the web context nor prove Node/Chromium can launch there.
The host's prior successful Node and FFmpeg trials are separate capabilities.

The metadata probe took 0.096 ms and launched zero processes or provider calls.
PHP reported execution limit `0` and memory limit `-1`; these settings are **not**
a resource budget, hosting authorization or evidence of safe workload termination.
Actual bounded subprocess termination, browser sandbox startup and provider login
still need verification in the intended execution context before activation.

Release `294d558ea7d71cc3a0db8f077c35e949` installed only
`runtime-prerequisites.php` and its system-status integration, with verified
preimage and release Drive backups. Fresh Hub readback exposed the observations
under `system.runtimePrerequisites`; the resident remains retired and wake remains
inactive. No new executor, provider authorization or generation was completed.

The previous browser relay used GitHub Actions. The November 16 policy now
allows GitHub only to send scheduled wake signals, so that historical relay is
not an authorized production execution path. The current wake implementation
only calls the schedule/readiness clock; it has no verified publication handler.
Do not convert readiness flags to true in place of implementing and verifying
an executor.

A pre-existing ChatGPT Shorts automation was found paused. Its old daily cadence
also differs from N80's Monday/Wednesday/Friday policy. It was not reactivated;
its environment and actual unattended execution are unverified. Do not use it
as a duplicate scheduler or call its registration a production fix. No other
automations were changed.

## Continuation under the confirmed contract

- Keep existing N80 ownership of schedules, source versions, task IDs, fenced
  leases, cancellation, provider receipts and publication decisions.
- Preserve the retired resident, existing queue and source media. Do not
  reactivate the paused conversation automation or the old GitHub browser relay.
- Verify the host's actual bounded execution and each required provider call;
  do not replace an OS/authentication failure with a successful readiness flag.
- Existing subscriptions remain preferred. No profile/cookie export, browser
  sandbox relaxation or paid API switch is authorized by this clarification.
- Validate the real lifecycle through an existing task and saved file receipts,
  then assembly, audio/subtitle review, upload and native related-video checks.
- Record policy adoption, code deployment, signed admission, actual production
  and process/resource acceptance as separate facts.

No new server, subscription, paid API, provider session, media-generation request
or public video was created during this investigation. The only subsequent
deployment was the read-only runtime metadata check described above.
The continuation is the confirmed N80 scheduled one-shot route. There is no
pending request for a separate always-on execution environment.
