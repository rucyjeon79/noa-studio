# Android API 36 / Play flexible update handoff

This change is based on main 8f1e9b0 and the user's V3 package. The original
build.gradle, MainActivity and AppUpdateChecker Git blob hashes matched the
V3 preconditions before application. No live host source was overwritten.

## Behavior

- Package kr.ai.noastudio; minSdk 26; compileSdk/targetSdk 36; Java 17.
- Play 2.1.0 uses FLEXIBLE only. Downloading does not invoke any player command.
- Completion requires a second user confirmation and a durable playback checkpoint.
  A failed checkpoint prevents installation. Postponement, activity recreation,
  missing focus and update failures preserve the pending update and player use.
- Play installation never falls back to a website APK. Installer lookup failure
  uses the Play path conservatively. Direct installations keep same-origin APK
  notices and the debug-13 migration warning.
- Insets include system bars, display cutouts and the IME. Insets are consumed
  after padding to prevent duplicate safe-area application. API 33+ back callbacks
  replace the deprecated Activity callback; root back keeps media in background.

## One-shot build

Use official SDK Platform 36, Build Tools 35.0.0, JDK 17, Gradle 8.11.1,
AGP 8.10.1. Do not use GitHub Actions. Check the Play all-bundles list immediately
before choosing versions. Its observed maximum on 2026-11-17 KST was 1794632996.
The candidate pair is 1794632997 and 1794632998, not uploaded or signed yet.

For clearly labelled unsigned review artifacts only:

```sh
NOA_UNSIGNED_BUILD=1 NOA_RELEASE_VERSION_CODE=1794632997 gradle --no-daemon \
  :app:assembleRelease :app:bundleRelease :app:lintRelease :app:testReleaseUnitTest
```

Unit tests use Robolectric SDK 35 and Google's FakeAppUpdateManager. They are
not real-device, Android 16 system UI, Play acquisition or install evidence.
The existing instrumentation tests still require an authorized test device.

## Release gates

A normal release build now rejects a missing N80 host receipt. The receipt must
come from the approved N80 execution path on the new source, with all input
hashes and actual tests passing. Set NOA_SOURCE_COMMIT (legacy GITHUB_SHA is
also accepted by the Gradle verifier) to the verified commit. Do not reuse any
prior receipt. Do not restart the paused N80 resident runner.

The existing scripts/noa_android_host_bridge.py needs its approved SSH route;
its legacy GITHUB_SHA/GITHUB_RUN_ID variable names do not authorize Actions.
Only run it after N80 confirms that the one-shot host route is still permitted.

Sign with the existing private key through scripts/qa/noa-sign-release.py's
approved vault path. Keys and passwords must remain outside git, Drive,
artifacts and reports. Never replace the release identity with a temporary key.
An unsigned artifact is neither installable nor a Play upload candidate.

Direct APK/upload certificate:
f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b

Observed Play distribution certificate:
c829bac3fc0f11ddfeb9a247741a97a5c91a156d740fd34ce7d87400c81a3bca

These differ. Do not promise an in-place cross-channel APK-to-Play update.
Keep each channel's approved identity. Do not change Play App Signing keys.

## Remaining acceptance

- Obtain a new N80 bridge receipt and sign both candidate versions securely.
- Install old official APK, update to new APK, verify account/queue/position.
- Test debug-13 migration separately without deleting user data automatically.
- On Play, install lower test version, offer higher version, download flexible,
  postpone/approve, verify app return and preserved data.
- Use Android 16 hardware/emulator for rotation, IME, cutout, system back,
  network transitions, background audio and relaunch. Record real evidence.
- Finish factual Data Safety, app access account, content rating, audience,
  advertising, store assets and account deletion audit.
- Public production release requires final user approval after all gates pass.

Existing main still contains a historical Android Actions workflow. This work
has not invoked or pushed to it. Disable/archive it through the approved
repository operations path before merging any Android change to main.
