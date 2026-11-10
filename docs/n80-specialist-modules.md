# N80 specialist modules

Seven on-demand modules are owned by N80 Engine. CREATOR LAB, AI LAB and 홈페이지 설정 remain the user-facing workspaces. A module is not another queue, daemon, database, provider account or payment ledger.

| Module | Execution boundary | Existing entry points |
|---|---|---|
| N80 Node | Host runtime contract and bounded installation evidence; existing N80 Auto transport | Signed worker status, existing Node worker |
| N80 Setup | Workspace definitions, routes and access classification | workspaces.php → setup.php |
| N80 Install | Release/update manifest validation and installation-operation ownership | app-lifecycle.php → install.php; existing installer commands |
| N80 Lab | Authenticated operation selection, permissions and one selected handler | service-runtime.php → lab.php |
| N80 DB | Application PDO and separate read-only administration connections | storage.php / database/core.php → db.php |
| N80 Sign | Member roles, document ownership and route access | member-access.php → sign.php |
| N80 Pay | Server-side cart prices, benefits and verified settlement checks | toss-core.php / youngcart-core.php → pay.php |

Old identifiers resolve without duplicate registration: ai_lab→lab, database→db, identity→sign, commerce→pay, app_lifecycle→install. Historic receipts and observer data retain their original keys and hashes. The normal registry contains 18 canonical modules; an already installed Hub adds its existing module and administrator route. Hub source and activation remain under the Hub release.

Registry inclusion must not start work or connect a database. Node installation evidence reports `runtimeHealth=not_checked` until a real signed probe. Provider approval, OAuth/session bootstrap, payment transactions, refunds, original stores and replay guards remain in their established services beneath these boundaries. Setup is currently responsible for configuration navigation, not a replacement settings database.

N80 Auto operation IDs, scripts, authorization and workflow ownership are unchanged. Node installation/media installation/Android publication are assigned to Install, Node verification to Node, and production tool operations to Lab. Existing signed operation permission and method checks remain mandatory.

## Activation and verification

The existing N80 single-session deployment installs new dependencies before compatibility callers, requires exact known preimages, checks protected source hashes, and rolls back only its own bytes. `[n80-specialists]` releases retain member/payment checks and use this one activation instead of overlapping legacy deployments. The two reviewed Hub preimages are accepted only because both Hub registration and its menu route are explicitly preserved; other drift still fails closed.

Candidate checks cover PHP syntax, all engine tests, permissions, SELECT-only database grammar, Drive-only backup policy, MySQL settlement/point idempotency and concurrent callbacks, signed service execution, and Node contract/runtime tests. Candidate success does not prove host activation. Production completion additionally requires the existing deploy receipt and signed runtime verification.

## Further specialization candidates

- N80 Guard: consolidate existing Guardian/policy/lease/replay checks; no second security policy.
- N80 Notify: consolidate existing notifications and delivery/retry state.
- N80 Media: consolidate existing asset validation, conversion/mastering and temporary-file lifecycle; JukeBox retains playback ownership.

These three candidates are recommendations, not activated modules in this change.
