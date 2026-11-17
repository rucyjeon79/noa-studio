# N80 unattended Shorts execution — deployment boundary

## Verified current state

The user requested completion of unattended production after authorizing the
channel's automatic/scheduled publication. The administrator screen confirmed
that publication setting is enabled. This does not activate the scheduled wake
receiver or prove a completed production run.

The latest authenticated Hub inventory reports production revision 491:

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
This is historical execution evidence, not a fresh OS probe in this session.
The host's prior successful Node and FFmpeg trials are separate capabilities.

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

## Scoped execution-environment proposal

To preserve the current hosting site and GitHub signal-only policy, the remaining
candidate is one N80-controlled execution environment with supported browser
sandbox/procfs facilities. This is a proposed change of execution location, not
an installed service or an approval to purchase one.

- Existing N80 retains schedule, source versions, task IDs, fenced leases,
  retries, cancellation, provider receipts and publication decisions.
- The execution environment accepts only an authenticated, fixed N80 task;
  one task runs at a time with bounded duration. It does not add a queue,
  independent scheduler or unrestricted remote-command interface.
- Existing subscriptions remain preferred. Credentials are connected explicitly
  in the intended environment; no ChatGPT browser profiles/cookies are exported.
- Google authentication and actual Gemini/Flow generation must pass there.
  Changing the machine alone does not prove that Google will accept it.
- After environment authorization, first verify browser startup and provider
  login, then one leased scene with actual file readback, then a complete Short
  with audio/subtitle review, upload and native related-video verification.
- Keep the signed production schedule inactive until those receipts support it.

No new server, subscription, paid API, provider session, source deployment,
media-generation request or public video was created during this investigation.
The remaining decision is permission for the new execution location; provider,
cost, credential grants and any purchase need concrete review before commitment.
