# Upload completion wake

Both local and Drive uploads call `nq_enqueue`. After the queue transaction commits,
request the existing `noa-jukebox.yml` workflow on `main`. Do not call GitHub inside
the SQL transaction or set an upload to `processing` before the worker claims it.
Existing FIFO, worker ownership, leases and source hash validation are unchanged.

A fixed HTTPS GitHub endpoint accepts no URL, branch or credential from a browser.
The request has a two-second total timeout and does not follow redirects. Dispatch
failure never invalidates an uploaded source. Duplicate requests are coalesced for
60 seconds after acceptance and 10 seconds after failures. The existing scheduled
worker remains the recovery mechanism. Dispatch bypasses redundant media validation
on the execution path; PR/push validation remains enabled.

## Required before activation

Provision a dedicated fine-grained GitHub credential restricted to repository
`rucyjeon79/noa-studio`, Actions write (and required metadata read), with expiration.
Store the credential in the production environment GitHub Actions secret
`NOA_JUKEBOX_WAKE_TOKEN`. Run the upload completion wake verification workflow on
main to install or rotate it under the private directory with mode 0600. The
workflow logs only its configuration state. If no new secret was supplied, it
leaves an existing private credential untouched. A missing credential leaves the
scheduled worker responsible for recovery. Never use a short-lived workflow token.

The release installs the helper before the queue caller, using scoped preimage
checks. An installed file alone does not prove GitHub accepted a dispatch.

## Acceptance evidence

Run `php tests/jukebox/wake_test.php` and existing upload queue integration tests.
Then complete one authorized upload with no active worker and correlate its queue
commit timestamp with a `workflow_dispatch` run and the same upload's claimed job.
Confirm another completed upload preserves FIFO while a worker is busy. Confirm
revoked credentials preserve uploads and scheduled recovery. Never announce
production completion until this live evidence exists.

GitHub runner provisioning can still take time: this triggers execution immediately,
not a guarantee of zero-latency FFmpeg startup. A continuously running dedicated
worker is required for strict real-time processing.
