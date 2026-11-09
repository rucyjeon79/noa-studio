# N80 host Node integration

Node is an execution capability of N80 Engine's `ai_lab` module. PHP/MySQL still
own application requests, permissions, jobs and results. `config/n80-automation.json`
registers the runtime and fixed installation/verification operations.

| Operation | Executor | Authority and stored result |
| --- | --- | --- |
| `engine.status` | Host Node → signed N80 service | Existing `n80_status`; read-only, no generation |
| `ai.muvy` | Host Node → existing MUVY worker | Existing `muvy_claim`, lease, `muvy_complete` completion hash |
| Media analysis/render/publication | Existing N80 media worker | Existing media queue and final-only publication checks |

`noa-ai-worker.yml` remains the single scheduling owner. Its existing installation
lane activates Node separately from the browser startup attempt. `[n80-node]`
commits run the candidate tests and activate only the private runtime; they do not
redeploy PHP, menus or player assets. Installations pin Node 24.22.2, use the existing
private loader/libraries, verify source hashes, check the current commit, perform
an authenticated host roundtrip and atomically activate `node-current.json`.

Normal Auto ticks read the installed manifest, require the exact source bundle,
and launch short-lived task processes. There is no HTTP listener, new cron, secondary
queue, npm installation on page access, or paid-provider enablement. Credentials
travel through SSH stdin and remain in memory. Public logs contain only bounded
receipts. Runtime sources/manifests stay outside the web root.

Each host invocation claims at most one MUVY task. The existing Auto tick drains
up to 24 tasks on one SSH connection, stopping before a new task once its 20-minute
budget is reached. Remaining work stays in the existing queue. It uses the existing server approval,
provider settings, job lock, lease and replay-safe completion. Lost replies never
fall back to local generation. The Node process is limited to 128 MiB JS heap and
240 seconds; HTTP calls are bounded to 20 seconds (provider generation retains
its existing 95-second limit). The 300-second canonical lease remains authoritative.
Media queue processing continues independently within the same N80 Auto invocation
if the Node operation fails; the overall invocation reports failure.

Activation proves Node execution and signed N80 access, not Gemini/Flow login,
browser sandbox availability, Android SDK availability or a completed music video.
Provider/browser operations require their own actual verification.
