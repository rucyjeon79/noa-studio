# N80 mobile keyboard correction — 2026-11-10

User report: “키보드 입력 안되네”. The phone displayed Google's sign-in input through the remote screenshot while the local controls were disabled. The screenshot itself is not a native editable field; the frontend also disabled the local password input whenever a remote click awaited acknowledgement.

PR #479 / operating commit `1c94607649f33cfa5018e68beeb73196bb823ec9` adds a visible **키보드 열기** button that focuses the local native input synchronously from the user's gesture. Local typing remains available while remote input is pending and during polling. The submit button and remote operations still wait for the existing N80 acknowledgement; this introduces no second queue or executor. Text is cleared only after the input POST is accepted, and a rejected submission retains its local text. The interface explains where text is entered and sent.

The browser's existing click/type/key/scroll/navigation dispatcher is shared with its isolated proof. The proof types Korean and English dummy strings and exercises select-all and backspace before visiting Gemini and Flow. The proof never uses a real account value. Its read-only host observation adds only boolean `inputPending` / `inputAcknowledged` fields, without exposing input, account, frame, owner or lease contents.

## Verified checks

- Six local encryption, privacy, handoff and workflow-order tests plus JavaScript syntax and whitespace checks passed.
- Scoped PR verification run `42718861214`, job `129507370087`, succeeded. Mobile touch contexts and desktop views at widths 360, 390, 768 and 1440 were checked in light and dark themes, using isolated fixture images.
- The UI proof verifies native input focus from the keyboard button, typing while a remote click is pending, focus and text preservation across polling, rejection of duplicate submission during pending input, accepted-text clearing, and text retention after a rejected request. This verifies browser focus behavior, not the physical Android keyboard on the user's handset.
- Mobile light-theme and desktop dark-theme screenshots were visually inspected; the keyboard button and local input remain visible and fit the page width.
- Host candidate job `129507376105` and wider existing-feature gates passed. The unrelated workspace fixture still omits `engine/workspaces.php` and fails before testing that fixture's administrator page; no gate was weakened.

## Actual browser evidence

Main browser probe run `42719831774`, job `129510802991`, succeeded with Chrome `156.0.8078.79`, sandbox enabled, JavaScript/canvas verification and `inputVerified=true`. The Korean/English input and select-all/backspace check used the same dispatcher as administrator input against an isolated local DOM, then Gemini and Flow each returned HTTP 200. The proof was stored privately on N80 with readback SHA-256 `fb15447e0dc91f5418b0301b2c21850b0dace9b104d36c460b566eca4feeae8d`, 825 bytes.

At that observation the user's existing session was active with a live lease and actual frames; `inputPending=false` and `inputAcknowledged=true`. At least one remote command had therefore completed. This supports the local keyboard/focus diagnosis, without reading the user's input or proving authentication. The probe reports `authenticated=false` and `productionReady=false`.

The same run's host handoff job `129510804826` succeeded: 24 files / 133054 bytes, bundle SHA-256 `c73353a274df705285f14b370fffef97af4e533734d4705da0d94e49a9deb56f`, state `source_verified_on_host`. The updated dispatcher and transport are present in N80 private storage.

The main-commit verification run `42719831431`, job `129510657299`, also passed the full scoped UI, PHP/HTTP, existing media and layout checks before publication.

Production publish job `129512995220` in that run succeeded. Only `noa-browser-connect.css`, `noa-browser-connect.php` and `noa-browser-connect.js` changed. All deployed file hashes matched the committed versions; 11 protected files remained unchanged, with zero database writes in the scoped deployment. The input changes are deployed, not just prepared in the repository.

## Continuation

Reload `/noa-browser-connect.php`, open a fresh connection if the old one has expired, select the Google field in the displayed screen, press **키보드 열기**, type locally and press **입력하기**. The saved connection and original movie task retain their existing ownership and production gates. Google authentication, provider generation/download and a complete movie are not established by this keyboard correction.
