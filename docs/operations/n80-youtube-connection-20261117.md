# Shorts YouTube connection check — deployed; YouTube reauthorization remains

## Current result after explicit Drive approval, 2026-11-17

The user explicitly approved renewing NOA STUDIO's full Drive access. The
existing account reconnection completed, including the unverified-testing-app
warning and the consent screen. No OAuth client configuration or app publishing
state was changed.

- **17:25:16 KST:** the existing server storage check saved its synthetic file,
  read it back with matching contents, and moved that test file to trash. The
  page confirmed the new check; this was not the old November 10 receipt.
- **17:26:21 KST:** N80 Hub deployed preserved package
  `6ec04cc6544c24d2c4a33eee16a7c017`, advancing production to **2.1.484**.
  Package SHA-256 is
  `36d55b1e1bfce3471325b2bae883cf551c450be8d444aef06dc39e6909c331f9`.
  Both mandatory Drive backups were verified: 597,943-byte preimage transaction
  (`5d81f107bc724e19fba9634c76df31b67b3e7eb3bf9471bb304646eeb498a8de`)
  and 51,815-byte package. The authenticated release receipt retains their
  private Drive locations. A fresh manifest independently matched all five
  candidate file hashes below; recovery was not required.
- **17:26:47 KST:** exactly one live channel/playlist check ran through the new
  administrator button. It returned `youtube_reauthorize_required`, and the UI
  displayed that Google authorization had expired or been revoked. The channel
  and playlist ownership checks did not pass. This is a confirmed diagnostic
  failure, not an unknown/lost result, and was not automatically replayed.

Thus the **deployment error is resolved**. The remaining issue is the separately
stored YouTube authorization. The existing YouTube connection-management link
opened Google's account/brand chooser, but no YouTube account or consent was
submitted. This renewal requests `youtube.upload`, `youtube.readonly`, and
`yt-analytics.readonly`, which are outside the user's latest Drive-only approval.
Obtain explicit approval for those permissions and the intended account before
renewal. After renewal, confirm the channel ID still matches policy, then make
one new channel/playlist diagnostic request; do not replay the old failed ID.

The original cancelled media job remains cancelled with 7 planned scenes,
3 accepted images, 2 accepted videos, and no final file. The resident remains
retired, `paused=true`, scheduled execution remains off, and production readiness
remains false. No video was uploaded or published. Desktop rendering of the new
section and the real authorization error was verified. A live mobile viewport
check and successful YouTube ownership check remain outstanding.

The following sections retain earlier diagnosis and validation history; their
revision-483 deployment block was superseded by the successful release above.

## Follow-up diagnosis, 2026-11-17

At **16:50:37 KST**, the existing administrator Google integration page ran its
real, bounded **Google Drive API check**. It reported that account authorization
had expired and reconnection was required. The check calls the existing OAuth
refresh endpoint before reading the fixed private folder, and records a sanitized
`google_reconnect_required` outcome. This supplies current evidence that was
missing from the earlier deployment investigation; the old storage-check receipt
from November 10 was not current access verification.

The deployment manifest remained revision **483**, with all four preimages
unchanged and the new YouTube adapter absent. The newest Drive release backups
listed by the connected Drive service were still the successful revision-483
package and preimage. Mandatory Drive preimage backup occurs before activation;
do not bypass it or retry deployment until account access is restored.

The administrator opened the existing Drive reconnection flow and selected the
saved account. Google displayed its **unverified / testing app** warning. The
requested scope is the pre-existing full Drive scope, which permits viewing,
editing, creating and deleting all Drive files; the app's fixed-folder behavior
does not narrow Google's granted scope. Automatic approval review rejected the
Continue action because explicit approval for that broad access was absent.
No consent was granted, no replacement authorization was saved, and no new
release was attempted during this diagnosis. User approval for this precise
scope is required before continuing; account selection alone is not that approval.

The earlier saved connection date and current testing warning are consistent with
Google's documented seven-day testing refresh-token expiry, but are not proof of
the exact token invalidation reason. See
[Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
The OAuth app publishing configuration has not been changed. Reauthorization can
restore current access without resolving the recurring testing-state lifetime.

Continuation after explicit approval: restart the existing reconnection flow if
its ten-minute state has expired, use the already selected account, inspect the
actual consent scope, finish the same-scope renewal, verify the server's real
Drive response, obtain a fresh deployment manifest, and submit the preserved
five-file package only if revision and preimages still match. Then perform one
live YouTube diagnostic and preserve its actual outcome. Do not claim either
deployment or YouTube verification is complete yet.

## Earlier implementation and deployment investigation

As of 2026-11-17 16:35 KST, production remains **2.1.483**. No new YouTube
diagnostic was executed against the live Google account. The change below is in
source commit `36a553ac3a1c1533d2e3d4423edd7bf758eac3a2`, but is **not deployed**.

## Implemented behavior

The existing administrator Shorts control page gains an explicit channel and
destination-playlist check. It uses the existing authenticated N80 Lab service
route and diagnostic receipt store, without another queue, scheduler or worker.
The server chooses the diagnostic context; request-body flags or targets cannot
select or expand it.

One request refreshes the already-authorized YouTube credential in memory, reads
`channels.list(mine=true)` and checks the fixed policy channel ID, then reads the
fixed destination playlist and checks its owning channel. At most three calls
use the existing HTTPS transport with eight-second per-call timeouts. There is
no automatic retry or pagination. A successful read does not assert upload,
publication, related-video support or unattended execution.

The existing diagnostic store records the request before any provider call.
Repeating a request ID returns its receipt; a lost final response stays
unconfirmed and blocks another check. Request IDs also bind the diagnostic kind
and owner. Existing clock checks remain separate. Only approved result fields
are recorded; OAuth tokens, provider response bodies and raw exception messages
are excluded. The original Lab state, jobs, publication settings and stopped
resident flags are not changed by this diagnostic.

The UI reports verified channel/playlist titles, the observation time and whether
an upload scope was recorded. It distinguishes reauthorization, missing API
permission, quota limits, channel mismatch and playlist mismatch. It never
promotes the production-readiness flag. The result is explicitly a point-in-time
read-access observation.

References used for the fixed API queries:

- [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [YouTube channel resource](https://developers.google.com/youtube/v3/docs/channels)

## Verification

- PHP 8.2 local tests exercised the actual adapter with isolated transport:
  channel and playlist identity, bounded calls, no mutation, absent credentials,
  expired grant, quota rejection and credential redaction.
- Actual worker/snapshot tests rejected injected body commands and preserved the
  original state bytes. Monitor tests covered kind/owner scoping, exact replay,
  lost receipt and invalid/over-budget result rejection.
- JavaScript checks rendered success and reauthorization states without HTML
  insertion and without enabling idle polling.
- [Shorts safety gates](https://github.com/rucyjeon79/noa-studio/actions/runs/44037973383): passed.
- [Schedule guard](https://github.com/rucyjeon79/noa-studio/actions/runs/44037973120): passed.
- [Engine contracts](https://github.com/rucyjeon79/noa-studio/actions/runs/44037973131): passed.
- [Existing feature quality gates](https://github.com/rucyjeon79/noa-studio/actions/runs/44037973117): passed.
- The current live release package validator and UI/payment gates were downloaded,
  hash-verified and exercised locally against all five candidate files: passed.
- Live rendering of the **new** section and live Google access remain unverified
  because deployment did not complete. The existing production screen still
  renders and does not contain the new button.

## Deployment blocker and preserved state

The full five-file package ID is `6ec04cc6544c24d2c4a33eee16a7c017`, prepared from
fresh production revision 483 with exact preimage hashes. The connector returned
`INVALID_ARGUMENT`; repeated status checks reported `found=false` and
`recoveryRequired=false`. Uploading the same package through the existing N80 Hub
administrator form also displayed a generic request failure. It did not return
a new revision or completed release receipt.

Two narrower diagnostic package attempts also returned `INVALID_ARGUMENT` and
had no receipt: new-module-only `16dab5b5d354303181cf39d19247707c` and the
worker-only `9f95a16db6716be403754e88a842eee5`. No file from either package
was activated. Do not assume the error identifies the new file, null preimage,
package size or a PHP syntax problem.

An exact replay of already completed package
`587b86dbae6873b1474ca27d317f1646` returned its historical revision-479 receipt with
`duplicate=true`. This replay did not redeploy or downgrade production. It proves
the existing authenticated tool can reach the idempotent receipt path; it does
not prove that new deployment, backup or activation is working.

The final manifest still reported revision **483**, all four existing target
files unchanged, and the new file absent. The last-release-error field still
contained an older unrelated checksum error, so it is not evidence for this
failure. No Drive-authentication failure, hosting denial or automatic approval
rejection was explicitly returned; do not invent one as the cause.

Candidate hashes:

| Host path | Bytes | SHA-256 |
| --- | ---: | --- |
| `noa-bridge/worker-shorts.php` | 3111 | `64c3768032c83eb33ab4bf3d05eb1a2c176530eb0ee7df84b8c27c3242731b68` |
| `noa-bridge/session-shorts-youtube.php` | 4874 | `3ac428e23b7f7434d712f66936f19e8ef899136f9463c699fb5dff18d6e6a880` |
| `noa-app/engine/shorts-monitor.php` | 11032 | `f2448374e743ea21cfb5bce09828316e846321f8c692d5238f867faace183b7c` |
| `noa-shorts-control.php` | 8607 | `7cb942c3e6bcd974d40199fd21a81835d0965a00ef75d0b0913c94f3785e230a` |
| `noa-shorts-control.js` | 10320 | `2c97bf29db14f1416befa9d1b4205e64997fdad18d47db19864300f09964bc65` |

Next continuation: diagnose the new-release failure through the existing N80
deployment/backup path, preserving mandatory preimage backups, hash checks and
revision checks. Do not bypass these gates or use a retired GitHub production
workflow. Once deployment succeeds, submit exactly one live diagnostic through
the new administrator button, inspect the actual receipt, and verify the rendered
desktop/mobile result. The existing unresolved `ai.batch` receipt and cancelled
media job must remain untouched.
