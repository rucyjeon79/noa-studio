# Android / PWA release boundary

The production origin https://noastudio.ai.kr is the sole source of screens, menus, design, classification and account features. Android starts at / and renders that live document with HTTP cache reuse disabled. The shared service worker uses network-only navigation. No web design JSON or separate native playlist/editor screen is packaged.

A website deployment becomes available on the next page request or reload, without an APK release. An already-open document is not forcibly replaced: this preserves forms, uploads and playback, just as in the PWA. This is not an offline copy and requires a network connection. Do not describe an unchanged open DOM as automatically live-synchronized.

Only the native media engine/bridge, Android host/security behavior, signing/release tooling or launcher resources require an Android build. Web changes and n80 engine source alone must not trigger APK publication. The n80 release metadata continues to point to the last tested native release.

Preserve cookies and web storage. Existing legacy local playlist preferences are not deleted; the app uses the PWA's playlist management. Playback metadata, queue and controls come from the live PWA; the media service handles background audio, media keys and playback restoration.

The Android host honors the page viewport, allows normal pinch zoom without native zoom buttons, disables algorithmic recoloring, and mirrors the PWA theme color into Android system bars. It does not replace page CSS or force a theme choice. Cookies and device-specific theme preferences remain separate from Chrome, as required by Android sandboxing.

The homepage's same-origin `iframe.nl-play-shell` music document uses the same native media engine through the trusted top document. Only that exact current frame at `/noa-music.php` may relay media commands. Other embedded content does not gain bridge privileges; native origin/main-frame validation remains unchanged.

## N80 host Node integration

`jukebox.android_bridge` belongs to N80 JukeBox and is dispatched through
`scripts/n80_auto.py` by the existing Android workflow. Before a production APK
is compiled, the existing NOA host's private Node 24 runtime executes the actual
native bridge behavior and live PWA contract tests. The remote test bundle is
bounded to the bridge, native sources, test files and build contract; its private
temporary directory is removed after execution. This operation does not install
Node or npm, start a server, add a cron, or change website files.

The host checks its pinned Node executable's checksum and runs tests in one
process with a test timeout. A zero process exit alone is insufficient: all TAP
tests must pass without skips, cancellations or TODOs. The resulting receipt
binds the source commit, source hashes, Node version, runtime hash and bridge hash.
Gradle embeds that receipt as `assets/n80-android-bridge.json` and rejects a changed
bridge. After signing, the release step checks the actual APK's bridge and receipt;
publication refuses an APK without matching host evidence. The existing signing,
device playback and independent Chrome comparison gates remain required.

Java/Gradle/Android SDK compilation still runs in the existing Android builder.
Node runs on the host during APK production, not on the phone or on every playback
request. Installed APKs need no Node process and continue using the live PWA plus
Android Media3. Host Java, npm packages and host-side APK compilation are not
implied by this integration. Local debug builds can omit host proof and cannot
pass the production publication gate.

Validation: `PwaRenderingTest` captures home and music in light/dark themes from the actual APK, with viewport, current asset URLs, computed CSS and geometry. `chrome_parity.mjs` opens those live URLs in independent Chrome with mobile emulation, the same isolated QA member, theme and viewport; it compares the snapshots and saves reference screenshots. This is not a second-WebView comparison or a claim of pixel-identical fonts across operating systems. Device media tests cover normal music, homepage recommendation audio, background/screen-off playback and process restoration. The user's physical phone and an installed Chrome WebAPK remain outside CI coverage.
