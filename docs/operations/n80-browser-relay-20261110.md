# N80 browser alternative — 2026-11-10

User direction: “호스팅사 불가 다른조치 시행”. The existing host has no `/proc`, and a real Chromium page launch failed. The already verified host FFmpeg renderer remains the renderer; see `n80-host-shorts-renderer-20261110.md`.

## Narrow alternative

The existing `noa-ai-worker.yml` runner supplies only the browser process. N80 Engine on the existing NOA host owns the administrator connection, one lease, encrypted pending input, encrypted screenshots, encrypted saved profile and all production task state. `ai.browser_session` is a registered N80 Auto operation in the existing workflow/concurrency lane, with no additional schedule or daemon. An unrequested tick exits before installing browser dependencies. An administrator request wakes the same workflow and allows at most 15 minutes of browser use.

`/noa-browser-connect.php` is a hidden administrator tool linked from AI·YouTube settings. Super-admin session, exact Origin, CSRF and one outstanding acknowledged input are required. Other users cannot read the screenshot. Google navigation is restricted to Gemini, accounts and Flow hosts. Browser sandbox remains enabled. Credentials are not supplied to npm/browser processes. The browser uses private pipes; user input, screenshots and profile contents never enter workflow logs/artifacts/caches. Ephemeral browser files are removed after the browser process group terminates. Profiles are AES-256-GCM encrypted using a purpose-separated key derived from the existing N80 worker key, written privately on the host, and accepted only after byte count and SHA-256 readback.

The source handoff includes the relay, its N80 dispatcher and transport dependencies. Browser execution location is external to the host by this explicit alternative; ownership/storage/rendering remain on host N80. No VPS or new paid AI API is introduced.

## Verification and limits

PR #474 contains PHP owner/lease/replay/expiry/profile-integrity tests, actual HTTP administrator/CSRF tests, responsive UI checks, encryption/tamper/file-permission tests and an actual browser probe. The probe executes JavaScript and a canvas pixel check with sandbox enabled, visits Gemini and Flow without authentication, and returns a sanitized proof to N80 private storage. A saved browser profile is **not** authenticated-generation proof or a finished movie.

Current production task remains `8491b2cebbdb452ac654d152f3455685`, “우물에 빠진 달빛”, source revision 5, original Gemini Gem `21f716bf5427`. Do not recreate the task, revive cancelled tasks, accept a rejected character image, replace the original audio or alter publication settings merely because the relay is installed.

Next gate: the user signs into Gemini and Flow in the N80 connection screen and saves. Respect Google authentication challenges; do not mask automation, bypass checks or copy cookies from another browser. Then verify restored authentication and implement/verify the provider generation/download adapter against actual UI, using existing task claims, begin/receipt/review operations. Scene acceptance, subtitle review and a complete host-rendered movie still require actual results. YouTube auto publication remains a separate disabled gate.

## Verified operating checkpoint

- PRs #474 and #475 merged; operating code commit `0ffeef2a6b0a01e5b95671b8822bd7dd753d9e49`.
- Initial deployment: run `42710489225`, publish job `129480809567`, seven changed files; 11 protected files unchanged, zero database writes.
- Flow origin correction: the actual legacy URL redirected to `flow.google.com`; the official page was independently opened and verified. Only that exact hostname was added, with deceptive-host rejection retained.
- Final deployment: run `42711807083`, publish job `129484795364`, SUCCESS. Only `noa-bridge/browser-control.php` changed in this follow-up; 11 protected files unchanged, zero database writes. Both scoped CI verification jobs passed before the respective releases.
- Actual browser proof: run `42711807104`, job `129483130733`, SUCCESS. Chrome `156.0.8078.79`, sandbox enabled, JavaScript nonce and canvas pixel checks passed. Gemini and Flow both returned HTTP 200 at their expected Google hosts. Authentication and production readiness remain false.
- Host proof: private `host-runtime/browser-relay-proof-6d9950570ade177df02ef79ddd89e13ad3702e61e1ca576d374b4d641dc06035.json`, 622 bytes, verified readback.
- Final source handoff: same run, job `129483133089`, SUCCESS; 24 files / 130624 bytes. Bundle SHA-256 `73f9bf96a2072668b58630e9de0b377a133ce5e12742230efbf7397df8681709`.
- Actual signed host control dispatch: run `42711495947`, job `129481909027`, `N80_BROWSER_IDLE`, exit 0. An unrequested connection starts no browser.
- Browser UI inspection reached the normal N80 administrator login gate. This session has no authenticated N80 browser session; no Google authentication was attempted or copied from another browser.
- Final canonical task reread: same task and source, revision 33 / source revision 5, `sourceCurrent=true`, `agent_paused`, zero outputs; subtitles remain `needs_review`. Scheduled campaign remains `connection_required` / `productionReady=false`.

Independent wider suites still report untouched fixture/data failures: WORLD visual sampling has no public cards, the workspace fixture omits `engine/workspaces.php`, and the inline-edit fixture waits for an absent title-edit button. These tests were not relaxed; the selected AI LAB deployment is gated by its own full passing PHP/HTTP/media/UI verification.

User continuation: sign into N80 as its administrator, open AI LAB → AI·YouTube 연결 → Gemini·Flow 브라우저 연결, open the connection, sign into Google on the shown browser, visit Gemini and Flow, then select 연결 저장 후 닫기. Connecting does not auto-resume the production task. The authenticated provider execution/download adapter and end-to-end movie verification remain the next development gates.
