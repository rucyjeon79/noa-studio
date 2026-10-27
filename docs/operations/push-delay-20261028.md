# Personal push delay prevention — 2026-10-28

Incident: 2026-10-28 KST. A five-minute GitHub Actions schedule actually ran at roughly 30–37 minute intervals. User's subscribed phone waited on a pending self-test. Manually rerunning dispatch job 122508391097 produced attempt job 122511968544, accepted one real pending message at 2026-10-27T22:36:04Z; user screenshot confirmed Android notification at 07:36 KST.

Fix PR 241: bounded event-driven encrypted Web Push after authenticated POST requests and notification inbox GET requests. The same source permissions, subscription generation, cancellation, SQL leases and acknowledgements apply. A non-blocking database named lock prevents concurrent inline drains. At most two deliveries per request, with 1s connect and 2.5s request deadlines per delivery. An unfinished application DB transaction is left untouched. No replacement of the stable signing key, native member rows, music, or native board writers.

P-256 ephemeral ECDH, RFC8291 HKDF and RFC8188 aes128gcm payloads retain generic activity text and per-message receipt tokens. Cross-implementation tests decrypt with Python http_ece and verify ES256 signatures with cryptography, including deterministic leading-zero P-256 coordinates. HTTPS provider allowlisting, TLS verification and redirect refusal are retained.

Scheduled dispatch remains a fallback for overflow and failed deliveries. This does not make GitHub cron punctual and does not guarantee an immediate phone notification during network/OS delays or a large queue. Oldest due queue age is included in signed health and warnings after ten minutes. UI distinguishes a delayed test after sixty seconds and removes the misleading five-minute delivery promise.

Tests: notification candidate 40597641675, existing engines 40597641666 passed. UIUX's pre-existing guest scrape failure assert(observed.length>0) remains recorded; it is not silenced. Workspace/navigation candidate 40597641636 passed. Production verification and deployment run 40598135714 succeeded. Seven scoped files changed and all 17 protected files were unchanged. Signed health confirmed inlineCapable=true, subscriptions=1, pending=0, oldestDueAge=0, accepted=1, received=1. The received count is the previously confirmed manual test, not a new end-to-end test of inline delivery.

Release commit: `0dd0d848e26035dfab638d3a76c87d02a087c79c`.
