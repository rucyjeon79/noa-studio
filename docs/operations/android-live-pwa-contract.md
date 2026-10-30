# Android / PWA release boundary

The production origin https://noastudio.ai.kr is the sole source of screens, menus, design, classification and account features. Android starts at / and renders that live document with HTTP cache reuse disabled. The shared service worker uses network-only navigation. No web design JSON or separate native playlist/editor screen is packaged.

A website deployment becomes available on the next page request or reload, without an APK release. An already-open document is not forcibly replaced: this preserves forms, uploads and playback, just as in the PWA. This is not an offline copy and requires a network connection. Do not describe an unchanged open DOM as automatically live-synchronized.

Only the native media engine/bridge, Android host/security behavior, signing/release tooling or launcher resources require an Android build. Web changes and n80 engine source alone must not trigger APK publication. The n80 release metadata continues to point to the last tested native release.

Preserve cookies and web storage. Existing legacy local playlist preferences are not deleted; the app uses the PWA's playlist management. Playback metadata, queue and controls come from the live PWA; the media service handles background audio, media keys and playback restoration.

Validation: Android WebParityTest compares the live PWA layout/order and checks the no-cache policy and absence of packaged web assets, then tests actual media and restoration. live_web_contract_test.mjs guards the release boundary and prevents reintroducing alternate native screens.
