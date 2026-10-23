# N80 ENGINE live execution activation prerequisites

This is the operational cutover gate for issue #108. Existing live JUKEBOX, catalog, member data, and workflows must be preserved.

## Verified implemented
- Single N80 BRIDGE route planner and fail-closed dispatch gate.
- Read-only MUSIC catalog probe and opt-in private event persistence.
- Durable lease transitions with fencing, ACK/retry/dead-letter state.
- Guardian source drift audit and production deployment.

## Required before live activation
1. **Producer trust:** Identify the actual JUKEBOX worker entrypoint and its server-only credential context. A client-provided `authenticatedByServer` flag is not authentication. Require trusted server-side principal derivation and permissions.
2. **Storage:** Provision event and lease directories outside the web root, owned by the application user with restricted permissions. Validate disk capacity, backup/retention and restore.
3. **Atomic delivery:** Record the producer's committed audio-ready event in the same transaction or via a transactional outbox. Avoid claiming that a separate file write is atomic with existing SQL.
4. **Consumer contract:** Confirm MUSIC catalog read is a diagnostic check only, not a completed refresh. ACK only after an actual idempotent effect or an explicitly defined read-only receipt.
5. **Recovery:** Exercise concurrent claims, process crash, expired lease, stale ACK, retry exhaustion, dead letter and manual replay with the real storage backend.
6. **Guardian:** Connect runtime telemetry and kill switch; verify user policy and authorization remain enforced.
7. **Cutover:** Start with one controlled canary, confirm live receipts, monitor error rates, and preserve immediate rollback. Do not enable JUKEBOX upload or FFmpeg changes as part of this cutover.

## Release criterion
Only enable N80 dispatch when the above gates have concrete production evidence. Until then `automaticDispatch=disabled` is intentional.
