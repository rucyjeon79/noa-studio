# n80 Android update delivery

Native-scoped main pushes run `.github/workflows/noa-android.yml`: build, lint,
native playback/device tests, original-key signing, signing/package/version checks,
pinned SFTP upload, public APK hash verification, and atomic release pointer publication.
No Play upload credentials or Play release have been configured by this change.

`n80_engine_snapshot()` exposes validated `androidUpdate` release status. The facade
is deployed only when its live SHA matches the reviewed predecessor or candidate.
Unknown runtime changes stop publication. The production concurrency group is shared
with existing deployment jobs. An older run cannot replace a newer release pointer.

The APK checks the same-origin release pointer when resumed, at most once per six
hours. A newer version is offered at most once per day; Music > Update allows a
manual check. Invalid/offline responses never interrupt playback. APK download opens
only after the user chooses Update; Android retains installation confirmation and
signature checks. Existing apps without this checker need one manual update first.
Play-installed apps use the Play listing on manual check, never the website APK.

Publication records commit, run ID, version, SHA-256 and timestamp in
`noa-android-release.json` and the Actions `n80-android-release-*` artifact. This is a
release receipt, not a fabricated n80 completion-event acknowledgement.

The existing workflow still builds a debug variant and signs it with the existing
installation identity. Play AAB/release-variant work and Play publishing are separate
pending steps. Never replace the original signing key to get a green workflow.
