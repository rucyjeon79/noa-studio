# N80 host Node integration

Node is an execution capability of N80 Engine's `ai_lab` module. PHP/MySQL retain
application requests, permissions, jobs and results. `config/n80-automation.json`
registers the runtime, tool permissions and fixed installation/verification operations.

| Operation | Executor | Authority and stored result |
| --- | --- | --- |
| `engine.status` | Host Node → N80 Auto tool channel → signed N80 service | Existing `n80_status`; read-only, no generation |
| `ai.muvy` | Host Node → existing MUVY tools | Existing claim, lease and completion hash |
| Media analysis/render/publication | Existing N80 media worker | Existing media queue and final-only publication checks |

`noa-ai-worker.yml` remains the scheduling owner. Its existing installation lane
activates Node separately from browser startup. `[n80-node]` commits run candidate
tests and activate only the private runtime; PHP, menus and player assets are not
redeployed. Node 24.22.2 uses the host's existing private loader/libraries. Each
activation checks runtime/source hashes, current source ownership, an authenticated
N80 tool roundtrip and the atomic `node-current.json` readback.

Host Node's direct public HTTPS connection timed out in actual testing. Production
therefore reuses N80 Auto's existing signed communication through the same private
SSH stdin/stdout channel. Node sends only five registered tool names, never a URL
or command. The parent validates sequence, operation, claim identity and completion
replays. The provider endpoint, model, prompt, credentials and enablement come from
the existing authorized claim. Provider invocation is allowed once per claim;
unknown responses never cause another paid invocation. Credentials remain in the
existing Auto transport and are omitted from Node requests and public receipts.

There is no HTTP listener, new cron, second queue, npm installation on page access,
new provider or paid-provider enablement. Normal ticks require the installed source
bundle, verify its files and launch short-lived processes. Each process handles one
existing MUVY lease, with a 128 MiB JS heap and a 240-second hard deadline. Completed
processes flush their receipt and exit, even while stdin remains open.

The Auto tick drains at most 24 tasks on one SSH connection, stopping before another
task once its 20-minute budget expires. Remaining work stays in the original queue.
N80 service calls use a 20-second timeout; provider transport retains its existing
95-second limit. The original 300-second lease and canonical validators remain in
force. Unconfirmed Node execution never falls back to local regeneration. The
separate existing media queue is still processed, and Auto reports the Node failure.

Installation hashes run on the host with coreutils or the existing private Node
streaming hash; first-time unavailable runtimes retain SFTP byte verification.
Browser installation remains separately verified. Node integration alone does not
prove Gemini/Flow login, Android SDK availability or a completed music video.

## Production verification — 2026-11-09

Activated source: `f067056357b548e5da8244838a3d67db9601300c`.
Runtime: Node `v24.22.2`, existing NOA host, N80 Auto tool transport.
Bundle SHA-256: `bc0439003acd8a4cc7c630f96dc78eeec1b4f59489bcb7932b8aef1d8625addf`.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Private activation and readback | Success; 36.6-second installation; no new queue/scheduler | [Activation run](https://github.com/rucyjeon79/noa-studio/actions/runs/42601221535) |
| Independent execution after activation | `engine.status=verified`; one signed tool call; zero generation requests | Same run, `engine.node_verify` |
| Ordinary N80 Auto execution | Host Node `ai.muvy=disabled`, processed 0; Auto finished successfully | [Automatic worker](https://github.com/rucyjeon79/noa-studio/actions/runs/42601698841) |
| Existing feature quality | Success, including actual audio/SQL checks | [Quality gates](https://github.com/rucyjeon79/noa-studio/actions/runs/42601221503) |
| N80 contracts | Success | [Contract gates](https://github.com/rucyjeon79/noa-studio/actions/runs/42601221591) |

The existing disabled MUVY provider setting was preserved. These results verify
installed Node execution, authenticated tool routing, queue access and ordinary
Auto operation. They do not claim a newly generated or published music video.
Provider replay protection was verified with isolated failure cases without a
paid provider request. Activation did not change PHP pages, menus or player assets.
