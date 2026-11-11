# N80 subscription executor connection

User approval on 2026-11-11: N80 Hub replaces GitHub by default; functions proven
impossible on the host may use the existing GitHub environment as N80's subordinate
executor. N80 retains ownership. Paid model API fallback is disabled.

The official Codex 0.167.1 native executable starts on Dothome but cannot initialize
login/configuration without `/proc/self/exe`. Runs 42929865264 and 42930565208 record
the actual results. The unusable binary was removed in run 42931117813. Do not
repeat that installation or weaken host sandbox facilities.

## Connection ownership

The existing `noa-ai-worker.yml` contains the bounded connection job. It has no new
cron, queue, or always-on service. Only the specified connection request may start
it. The host owns `noa-hub/codex/connection.json` and its exclusive connection lock.
An unresolved or failed request cannot silently restart. Successful connections
are reused, not replaced.

The official pinned Codex binary runs on the temporary GitHub runner. Its normal
ChatGPT device login is presented only to the requesting operator: the one-time
challenge is RSA-OAEP encrypted before uploading the small artifact. The matching
private key stays with the requesting Work session. No authentication token or
plaintext login code enters repository source, logs, or uploaded artifacts.

After login, `codex login status` must confirm ChatGPT. The account credentials are
AES-256-GCM encrypted and checksum/readback verified in the host's private vault.
The temporary runner's credential file is removed. An existing credential vault
cannot be overwritten by this first-connection procedure. No Work-session account
credentials are copied. A connection lasts at most 15 minutes and does not invoke
any model.

## Completion boundaries

Connection states are connecting, authenticated, failed, or receipt-unconfirmed.
Authentication alone does not activate a worker. The existing SQL text queue,
request IDs, revisions, leases, and draft/review rules must be attached and a real
single task verified before enabling automatic text generation. Limit calls and
run time, preserve ambiguous results, and prohibit automatic API fallback or
unbounded retries. Gemini/Flow, media assembly and YouTube publication remain
separate verification stages.

Changing this connection request ID is an operator action, not a retry strategy.
First reconcile any running process, persisted host state, and encrypted vault.
