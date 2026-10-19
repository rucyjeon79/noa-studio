# Grok Build → NOA Bridge integration contract

## Verified in source
The Grok Build React Start app uses `src/lib/pages.ts` server functions (`saveStudioPages`, `saveStoryPage`, `saveAppMeta`) and `src/lib/db.ts` for Postgres/PGLite persistence. Its database is **not** Dothome MySQL.

## Safe integration architecture
1. Preserve Grok Build AI music generation and all current page save functions.
2. Keep `bridge/index.php` same-origin administrator-only for now; it is not a cross-domain public API.
3. Build a server-side Grok-to-Dothome authentication handshake, with explicit administrator login on Dothome and short-lived, single-use authorization codes. Bind the code to the initiating session, PKCE verifier and a registered callback URL. Never expose database credentials or an administrator bearer token to browser JavaScript.
4. Add a server-to-server write proxy only after both host capabilities are confirmed. Restrict its scope to `noa_*` data and enforce document-level authorization, revision checks and idempotency.
5. Begin with **read-only** bridge connectivity and a shadow-copy comparison of representative EP, ACT, playlist, story and meta records. Do not switch existing Grok persistence before migration and rollback tests.
6. During migration, take a consistent source snapshot, import without overwriting newer data, compare counts and hashes, and only then activate the new storage behind a reversible feature flag.

## Why direct browser fetch cannot work today
The Grok Build origin (`noa-studio.grok.me`) and Dothome origin (`noastudio.ai.kr`) differ. GnuBoard's login cookie is not an authorization mechanism for arbitrary cross-origin requests. The staging `bridge/client.ts` correctly blocks cross-origin access; do not disable that check merely to make the network request appear to work.

## Deployment gate
No production hosting, DNS, Grok Build runtime or database changes are authorized by this document. Before a live switch, confirm the Grok deployment source and server-side secret support, PHP environment variable support on Dothome, TLS and callback registration, PHP/MySQL migrations, tests, and user approval.

## Test cases
- Unauthorized access denied; same-origin administrator access allowed.
- Duplicate request ID with identical content replays once; changed content rejects.
- Stale expected revision returns 409 and does not overwrite.
- History revision returns correct immutable prior payload.
- Reconnect after lost response does not duplicate writes.
- Every legacy genre/EP/ACT slot and story mapping round-trips without collisions.
- Grok music generation continues unchanged before and after cutover.
