# N80 browser reconnect — 2026-11-10

The 09:17 KST screenshot shows N80 startup still queued after 68 seconds, not a Google OAuth error page. The 09:15 browser run failed before its first accepted frame; the old generic exception did not establish the original failure phase. A replacement connection remained queued. The shared 60-second wake debounce plus a worker that had already passed its single browser claim could leave that replacement waiting.

## Operating change

PR482 (`a70910788bcfb6a1c70c212cdd9006f9e73b5e6f`) adds fixed, credential-free failure phase/reason diagnostics and verifies saved-profile restoration in the existing browser probe. PR483 (`8fb4da91dd0d0f51a182c680dcdd56de088b5753`) reserves at most three wakes for the same owner-bound connection, at least 60 seconds apart, under the existing N80 state lock. The existing page poll requests retries through POST with CSRF; GET, duplicate open, active connection, cancellation and another owner cannot create duplicate execution. Queued startup ends after 180 seconds and can be reopened; stale queued requests cannot be claimed. The separate 15-minute active session is preserved.

The original media task, its source and review state, Google credentials, publication policy and existing N80 authority were not replaced. No new server, scheduler or queue was introduced.

## Verification

- PR CI 42728896454 / 129541547767 passed the responsive shared-shell UI (360/390/768/1440, light/dark), same-session retry, timeout recovery, pending-click keyboard focus, rejection retention, PHP control, HTTP ownership/Origin/CSRF and existing media contracts.
- The first main verification stopped before deployment on a mobile focus assertion. Commit `f5059003e94aceecdbb0059a295e35409ee3e40a` makes the test inspect focus synchronously inside the actual trusted click, rather than racing touchend against its compatibility click. It neither focuses the field from the test nor weakens the required focus assertion.
- Actual user connection run 42728438187 / 129540001763 accepted a Gemini frame at 00:28:15Z, saved at 00:35:58Z and exited 0. This verifies browser-frame transport, not Google authentication.
- Saved-profile probe 42729745996 / 129544573920: Chrome 156.0.8078.79, sandbox enabled, profileRestored/scriptVerified/canvasVerified/inputVerified true, Gemini and Flow HTTP200. Host observation: saved, framesObserved true, profileStored true, inputAcknowledged false. Authentication and production readiness remain unverified/false.
- Host proof SHA256 `76b0803dd06c7a416cbe1cd69bfae85a93e33676c731375e9ec9e02d131e1844`, 852 bytes.
- Source handoff job 129544575242 succeeded: 24 files, 136531 bytes, source verified on the existing host. Handoff alone does not establish execution readiness.

## Deployment

Final verification run 42730256709 / job 129546166163 passed, including trusted-click focus, queue recovery, state and HTTP tests. Publish job 129548116008 succeeded for source `f5059003e94aceecdbb0059a295e35409ee3e40a`.

The guarded deployment changed exactly `noa-browser-connect.php`, `noa-browser-connect.js` and `noa-bridge/browser-control.php`; server hashes matched. Eleven protected files stayed unchanged, database writes and member-row changes were zero. The browser page fix is deployed on the existing N80 host.

User next step: reload the connection page and open a fresh connection, then perform Google login directly. A stored browser snapshot and HTTP200 do not establish Google authentication or Shorts production readiness.
