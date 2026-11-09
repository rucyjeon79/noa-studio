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

Deployment evidence will be appended after the operating readback and probe complete.
