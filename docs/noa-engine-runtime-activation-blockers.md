# NOA ENGINE — Runtime activation blockers

The eight installed libraries are **not an active orchestration engine**. Do not enable dispatch until these issues are resolved and verified:

1. `outbox.php` uses `fopen(..., 'x')` with one `fwrite`; a partial write can leave a truncated event file that permanently blocks retries. Implement atomic temp + rename with directory permissions, crash recovery, durable fsync, and same-event idempotency semantics.
2. `inbox.php` marks a message as claimed before consumer work; a crash after claim can permanently suppress processing. Add leased claims, expiry, acknowledged completion, retry, dead-letter and replay policy.
3. `dispatch-gate.php` intentionally rejects every request even when its policy flags are true. There are no installed consumer adapters; it must remain fail-closed.
4. No production-safe engine event storage path, worker identity, ACL, bounded executor, observability, or operational rollback is provisioned.
5. Module `health.php` reports source presence, not service health. Do not present it as uptime.
6. Existing JUKEBOX FIFO and other workers remain independent and must not be replaced or replayed by a new engine.
7. Validate source contracts against existing catalog and playlist schemas before enabling any real audio.ready consumers.

## Activation acceptance
- No missing, duplicated or stuck events under crash/restart and concurrency tests.
- Verified authenticated producer and consumer identities; allowlisted event types.
- Isolated writable storage outside public web root; explicit file permissions.
- Operational kill switch, dead-letter queue, correlation IDs, rate limits and audit logs.
- Existing music/member/queue data remain unchanged, with production rollback proof.

**Decision:** do not activate automatic event dispatch from the current foundation code.
