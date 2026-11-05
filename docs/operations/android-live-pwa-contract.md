# Android / PWA release boundary

The production origin https://noastudio.ai.kr is the sole source of screens, menus, design, classification and account features. Android starts at / and renders that live document with HTTP cache reuse disabled. The shared service worker uses network-only navigation. No web design JSON or separate native playlist/editor screen is packaged.

A website deployment becomes available on the next page request or reload, without an APK release. An already-open document is not forcibly replaced: this preserves forms, uploads and playback, just as in the PWA. This is not an offline copy and requires a network connection. Do not describe an unchanged open DOM as automatically live-synchronized.

Only the native media engine/bridge, Android host/security behavior, signing/release tooling or launcher resources require an Android build. Web changes and n80 engine source alone must not trigger APK publication. The n80 release metadata continues to point to the last tested native release.

Preserve cookies and web storage. Existing legacy local playlist preferences are not deleted; the app uses the PWA's playlist management. Playback metadata, queue and controls come from the live PWA; the media service handles background audio, media keys and playback restoration.

The Android host honors the page viewport, allows normal pinch zoom without native zoom buttons, disables algorithmic recoloring, and mirrors the PWA theme color into Android system bars. It does not replace page CSS or force a theme choice. Cookies and device-specific theme preferences remain separate from Chrome, as required by Android sandboxing.

The homepage's same-origin `iframe.nl-play-shell` music document uses the same native media engine through the trusted top document. Only that exact current frame at `/noa-music.php` may relay media commands. Other embedded content does not gain bridge privileges; native origin/main-frame validation remains unchanged.

Validation: `PwaRenderingTest` captures home and music in light/dark themes from the actual APK, with viewport, current asset URLs, computed CSS and geometry. `chrome_parity.mjs` opens those live URLs in independent Chrome with mobile emulation, the same isolated QA member, theme and viewport; it compares the snapshots and saves reference screenshots. This is not a second-WebView comparison or a claim of pixel-identical fonts across operating systems. Device media tests cover normal music, homepage recommendation audio, background/screen-off playback and process restoration. The user's physical phone and an installed Chrome WebAPK remain outside CI coverage.
