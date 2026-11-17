# N80 signed wake to existing Shorts clock

The signed endpoint previously stopped after recording a wake ticket. This change
connects a newly admitted `prepare` signal to the existing N80 specialist
`ai.daily_shorts_clock` once, in the same request. That specialist only reconciles
the existing Shorts schedule and readiness. It does not create media or publish.

## Ownership and failure behavior

- Authentication, schedule and approval gates run before application bootstrap.
- `scheduled-wakes.json` keeps the attempt and receipt in the existing slot;
  no new queue, daemon, workflow schedule, process launcher or provider is added.
- A durable `started_unconfirmed` receipt precedes the fixed specialist call.
  Duplicate signals never bootstrap the application or repeat that call.
- Policy, legacy retirement and independent one-shot stop are checked under the
  Hub lock before claiming, then checked again after application bootstrap.
- Exceptions, unexpected module responses and lost final receipts stay uncertain;
  they block another clock attempt until independently reconciled. No retry or
  pruning is added. Existing `ai.batch` receipts are outside this path.
- Only a Lab response with a known clock state, zero processed work and zero
  uploads becomes `clock_checked_not_produced`. Raw results are never persisted.
- A `publish` signal stays recorded with `publish_handler_not_verified`; it cannot
  accidentally invoke the preparation clock for the next day.
- The public top-level state remains the admission acknowledgement. The nested
  `clockDispatch` reports the separate clock outcome; it never proves production.
- Clock/readiness evidence is projected through the existing read-only ticket
  audit. Every business result remains unresolved and unsafe to replay.

## Bounds and deployment

The existing Lab store lock accepts an optional wait limit. Only this one-shot
clock requests a 750 ms limit; existing callers retain their original semantics.
The PHP CPU limit is 30 seconds, including a reset after GnuBoard bootstrap. These
limits are not a verified wall-clock guarantee for host bootstrap, storage or
database I/O. They do not justify setting the bounded-executor approval flag.

Live sources were read at revision 480. `bridge/worker-shorts.php` also catches up
with the already deployed ownership check and in-lock readiness snapshot; those
are not new production behavior in this release. Production deployment is only
through N80 Hub with fresh revision/preimage checks and a backup receipt.

## Validation

- Local PHP 8.2 isolated tests: admission, retention, clock attempt/final receipt,
  stop and approval revocation, unconfirmed-result preservation and read-only audit.
- Native PHP CI fixtures: real signed HTTP entrypoint with synthetic private
  state, bootstrap globals/output, duplicate requests, publisher rejection,
  exception receipts and post-bootstrap stop; actual OS Lab lock contention.
- Existing schedule guard, disabled wake workflow and signed sender contracts.
- None of these fixtures are hosting approval, a production signed canary, a
  verified unattended ChatGPT/Gemini/Flow executor or a finished video/upload.

Activation remains disabled. Legacy resident files remain retired and legacy
stop/paused stay true. Dedicated-key provisioning, hosting evidence, real bounded
execution and production adapters still require independent verification.

## Verified deployment receipt

- Deployed version: **2.1.481**, revision 480 -> 481.
- Source commit: `6ad632a7e5e99679445a2d3a4334bbaac3541542`.
- N80 release ID: `6ee9dad79ce9b6bbf4f4ce45a7dfe057`.
- Package SHA-256: `6d7c919de85ad9254c0028d008cdecbe1d80d24ab0ccf1aba29bfb5e2d301214`.
- All five deployed files matched fresh host manifest hashes and byte counts.
- [Release backup](https://drive.google.com/file/d/1vqSQrptkf7KmXDQ-E9GYz2Q775vpggWz/view).
- [Preimage backup](https://drive.google.com/file/d/1loFvnmHhfD-AVyYCd1aLD3kuWaOsqZp2/view).
- [PHP 8.2 isolated checks](https://github.com/rucyjeon79/noa-studio/actions/runs/44003499995):
  passed, including all 11 HTTP tests and the actual OS lock test (0.852 seconds).
- [Engine contracts](https://github.com/rucyjeon79/noa-studio/actions/runs/44003500019),
  [schedule guard](https://github.com/rucyjeon79/noa-studio/actions/runs/44003500084),
  and [existing feature checks](https://github.com/rucyjeon79/noa-studio/actions/runs/44003500137): passed.
- Authenticated post-release status confirmed retired resident sources absent,
  legacy pause/stop preserved, wake activation false, zero signed tickets and zero
  clock calls. The unresolved `ai.batch` receipt remains preserved.
- An unsigned public POST received HTTP 503 with an HTML server error page,
  not the endpoint's JSON envelope. This confirms no successful public admission;
  it does **not** verify the precise runtime rejection reason or a signed canary.
  The authenticated read-only host canary separately passed its admission gate
  checks. Public error-response behavior remains a pre-activation check.

Next executable milestone: verify hosting permission and the actual bounded
host application/clock path, with the dedicated key and owner controls still
requiring their own evidence. Do not activate the retired runner, enable GitHub
business execution, erase unresolved receipts, or call a clock result a video.
