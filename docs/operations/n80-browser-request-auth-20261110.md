# Browser request authentication — 2026-11-10

The 09:56 KST screenshot shows an active, signed-out Gemini page and a generic NOA connection-request error. It does not show a Google 403 page. The screenshot alone does not identify which command failed or its HTTP response. The user did not answer the optional error-trigger question and instead asked whether direct login is necessary.

The current browser UI retained only its initial NOA session CSRF token, collapsed most request errors into one message, and hid the refresh control even when the message advised checking the state. A failed startup response could remain visible after a frame arrived. These defects are corrected without claiming they prove the exact original failure.

## Changes

- Owner/admin-protected, no-store GET returns the current session CSRF token; the UI refreshes it during the existing poll.
- Only explicit HTTP403 `request_verification_failed` permits one retry after a successful authenticated refresh. Connection identity and input frame must still match. A changed connection, uncertain network response or second rejection is never replayed automatically.
- Failed text stays in the local input. It clears only after an accepted request.
- Distinguish authorization, expired connection, changed frame/session and unreadable response. Keep the state-refresh control visible with errors and clear resolved startup/read errors after verified recovery.
- Existing Origin checks, administrator checks, N80 lease/state owner, encryption, queue and worker remain in place.

## Verification and release

Source commit: `c943d41d509bcf66ee3a3a1be8c029e5f2f3942b`.
Verification run `42734774540`, job `129561214536`, passed the browser ownership/lease/encryption controls, actual HTTP session renewal and accepted/duplicate input, service runtime and single-owner policy, and responsive light/dark mobile/desktop UI checks. The UI checks include bounded CSRF retry, no replay into a replacement connection, no replay after uncertain transport, and preserving rejected text.

Commit `022a65e19a4f500b6bd1934fedd9092433f0aaf2` scopes this existing workflow to browser-owned files when every changed path is allowlisted. Unknown, empty, manual or mixed changes retain the full gate. Browser-only releases retain every browser/security/input/UI check and the existing protected-source/preimage/freshness/rollback/hash checks, and target only the five browser-owned public/bridge files. The original full run `42734043645` was delayed installing unrelated video dependencies. The scoped publish job `129562159781` stopped before touching operating files because main advanced (`obsolete_candidate_no_operating_files_changed`).

The latest-source check at `2613993f2117524aa364e2523645c5e2224d449a` additionally verifies that administrator denial is never retried as CSRF renewal (run `42735838619`, verification job `129564731911`, success). Parallel Hub commits then advanced main again.

Commit `251f7536d31d24e2270b2b166feb34e272de91e1` uses the existing freshness check's unrelated-path support only for documentation, Hub tests, the separate Hub facade workflow and its separate deployment script. Browser files, shared runtime dependencies, this release workflow and its publisher remain protected. Both existing real-git freshness suites passed (7 cases each). An actual history check accepted only the reviewed Hub changes from `2613993` to `92db643` and rejected the earlier candidate with changed browser source. The operating-file preimage checks, second freshness check, concurrent-write detection and readback hashes remain unchanged.

The verification run for that workflow-only change (`42736347860`, job `129566407726`) reached a mobile UI failure: the tap did not dispatch the compatibility click observed by the focus assertion. This did not reach publication. Commit `96b0ed3e83f5a86d2af5c2e198202d79a5a5c771` additionally focuses the local input synchronously on a primary non-mouse pointer release, preserving the normal click handler for desktop/keyboard activation. The test observes focus inside the trusted pointer-release event on mobile and trusted click on desktop; it never focuses the input itself. Final run `42736717659` passed verification (job `129567630886`) and publication (job `129568381279`). The host changed exactly `noa-browser-connect.php` and `noa-browser-connect.js`. All five browser-owned files matched the candidate and public static-asset readback passed. Eleven protected files remained unchanged; production database writes, changed member rows and point debits were all zero.

Verified source: `96b0ed3e83f5a86d2af5c2e198202d79a5a5c771`.
- PHP SHA256: `a65681a67f8a7596cb3a57f4391e3509d858d1516450f09fcf42b3c8e18e2465`
- JavaScript SHA256: `fee2eab617e694c87c5d3b6158042ec7dc100713fcaec6f416d0b61e836e7582`

This verifies the connection transport changes, not Google authentication, account eligibility or unattended Shorts production. The separate AI worker can still wait on unrelated media dependency installation after its bounded browser step; no second queue or runner was introduced in this change.

## Authentication boundary

N80's browser is separate from the user's phone browser. Initial Google sign-in and account verification remain user-operated; encrypted saved-state restoration is implemented, but Google authentication success and reuse have not been established. Google documents that it may reject sign-in from software-controlled browsers: https://support.google.com/accounts/answer/7675428 . Do not promise that manual input alone will make this browser acceptable, or equate HTTP200/frame reception/saved snapshot with authenticated Shorts automation. No browser security bypass, imported phone cookies or paid API change is authorized by this question.
