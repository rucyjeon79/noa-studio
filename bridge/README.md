# NOA Bridge — staging implementation

This folder contains a **not-deployed** additive MySQL schema and a PHP endpoint for Dothome/GnuBoard. No production data has been changed.

## Existing architecture
- Grok Build music generation remains in Grok Build.
- The React Start app currently persists via `src/lib/pages.ts` into Postgres/PGLite, **not Dothome MySQL**.
- GnuBoard owns `g5_*` tables; Bridge owns only `noa_*` tables.

## Files
- `001_schema.sql`: three InnoDB utf8mb4 tables for documents, history, and idempotency.
- `index.php`: **same-origin GnuBoard administrator-only** GET and PUT API. Do not expose to unauthenticated clients. It is not a Grok cross-origin integration yet.
- `client.ts`: typed HTTPS same-origin client with explicit revision and retry request IDs. Deliberately not enabled in Grok Build.

## Server installation prerequisites (NOT DONE)
1. Restore the private SQL backup in a disposable environment and verify it works. Do not commit it.
2. Run `001_schema.sql` only after a deployment approval.
3. Install `index.php` at `/hosting/noastudio/html/noa-bridge/index.php` so its parent `common.php` exists.
4. Supply server-only `NOA_MYSQL_DSN`, `NOA_MYSQL_USER`, `NOA_MYSQL_PASSWORD` via host configuration. Example DSN: `mysql:host=localhost;dbname=YOUR_DB;charset=utf8mb4`. Dothome support for these environment variables must be checked before deployment.
5. Test with an authenticated admin in the Dothome origin, including 403 unauthorized, 409 conflict, retry idempotency, history and no changes to GnuBoard.

## API contract
- `GET /noa-bridge/index.php?key=single:genre:ep` returns `{ok,key,kind,payload,revision}`.
- `PUT /noa-bridge/index.php?key=single:genre:ep` JSON body: `{kind,payload,expectedRevision,requestId}`.
- Initial write uses revision 0. Every successful write increments revision and appends history. Reusing the same requestId with the same body is safe; a changed body is rejected.
- Document keys accept lowercase letters, numbers, colons, underscores and hyphens. Request IDs must be UUID-shaped. Payload limit 1 MiB.
- The endpoint requires an authenticated GnuBoard administrator, HTTPS same-origin write request, and does not grant CORS permissions.

## Important integration limitation
A Grok-hosted app cannot automatically reuse a Dothome GnuBoard cookie across origins. Do not set `Access-Control-Allow-Origin: *` or embed administrator credentials in browser code. A separate login handoff / token exchange and authenticated cross-origin API must be designed and tested before connecting the existing Grok save functions.

## Pre-deployment review items
- Confirm Dothome PHP/MySQL supports `CHECK (JSON_VALID(...))` and server-side environment variables.
- Add a server-side CSRF token to complement Origin checks if supporting older browsers or clients.
- Implement document key and genre/EP/ACT authorization, a dedicated account permission model, and retention/restore policy.
- Run PHP lint, MySQL migration and concurrency tests, and end-to-end Grok synchronization tests. **None have been run yet.**
