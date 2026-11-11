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

## Verified subscription execution — 2026-11-11

The operator completed device login. Run 42932778459 verified ChatGPT authentication
and encrypted credential readback on the host. The temporary credential file was
removed from that runner; reconnecting is not required.

N80 Hub native release 72 installed only `noa-app/engine/codex.php` and the signed
`noa-bridge/hub-worker.php` adapter. The existing SQL `n80_ai_task` queue owns the
trial; no new business queue or scheduler was created. An insert and claim share
one SQL transaction, preventing the legacy API worker from seeing a queued trial.

Run 42934425096 executed one real Codex subscription task and verified an independent
host SQL readback. A repeated claim returned the stored result without another
generation. Ten Python checks and the MySQL claim/result/replay tests passed.

- Request: `0dfa27a9a1d5800d2badb1e9d689589b`
- SQL task: `n80:ai:bbb455b30e1fa6308818e0a91037cca98d042426cff869c45d9a8580a3f3a629`
- State: `succeeded`, revision 3.
- Result SHA-256: `228cb0b56d4959b655eb9757725444e41d5e7389c010844594a461b1defb9358`
- Auth: ChatGPT subscription. Model: gpt-6.1-sol. Actual recorded usage: 9,173 input
  tokens, 67 output tokens. This is usage evidence, not a dollar charge estimate.
- One model invocation, no paid API fallback, no media generation or publication.

The current adapter deliberately permits this one host-authorized trial. General
automatic SQL task dispatch is not activated (`workerActivated=false`). This is
not full unattended N80, Flow, or YouTube completion. The next implementation is
to connect regular eligible N80 SQL tasks to the same bounded subordinate worker,
with daily invocation limits and reconciliation of ambiguous results. Do not
repeat the successful trial or create a replacement request merely to re-prove it.

Evidence: https://github.com/rucyjeon79/noa-studio/actions/runs/42934425096
