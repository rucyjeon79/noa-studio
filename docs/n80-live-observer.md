# N80 production observation runtime

The first production canary observes actual committed JUKEBOX ready jobs and checks their existing MUSIC catalog entries. It invokes the installed N80 ready-event, catalog-probe, receipt and Guardian contracts against production PDO inside a MySQL READ ONLY transaction. It excludes synthetic QA records and superseded jobs; each sample is bounded to ten jobs.

This is an active **observation runtime**, not activated business-event dispatch. Receipts mean `catalog_observation_only`; no catalog refresh, playlist mutation, queue claim, durable business ACK or FFmpeg execution is asserted. The existing fail-closed dispatch gate remains unchanged. Authenticated consumers, transactional delivery, durable business ACK and production crash/replay verification remain prerequisites for broader execution.

## Operation

- `N80 Live Production Observer` runs after its main changes and every ten minutes at minutes 7/17/27/37/47/57 UTC (same minute offsets in Korea).
- Repository variable `N80_OBSERVER_ENABLED=false` stops new observer jobs. Disabling the workflow also stops scheduling. Neither action terminates existing music workers.
- A server-side `N80_OBSERVER_DISABLED=1` immediately rejects new observation requests.
- Requests use the existing NOA-only private service key, pinned SSH host identity, HTTPS without redirects, timestamp bounds, and body-bound HMAC. Responses are authenticated and bound to the request nonce.
- No nonce file is required: repeating an authenticated observation has no writes, claims, ACKs or emitted events.
- Each run rejects unauthenticated access, verifies source hashes and performs two live observations. A changed deployed file stops the run before installation; known runtime files are never overwritten by this installer.
- New PHP files are linted and tested before exclusive installation at their final runtime paths. No hosting `.tmp`, `.stage` or backup path is created. Subsequent runs are source-read-only.
- Reports contain event hashes and counts, not SQL contents, filenames, member records or credentials. They are working receipts in GitHub Actions with one-day expiry. Permanent backups remain exclusively in the existing Google Drive folders.

## Boundaries

An empty sample is not accepted as first-live canary evidence. Missing catalog entries or unsafe source drift fail the run. Each run samples the latest completed jobs; this is not a durable event delivery cursor and does not guarantee processing every historical event. No production schema, member, playlist, upload, source audio or worker state is altered.
