# YouTube channel integration

Target: `https://youtube.com/@ainoa_ramjunpapa`. This extends the applied 601-song / 52-ACT SQL catalog; it never updates `g5_*`, `noa_documents`, archived originals, catalog fields or existing user playlists.

## Implementation

- `bridge/youtube-core.php`: strict YouTube host/ID parsing; unique existing video, Suno or explicitly labelled NOA song IDs auto-match. Title similarity only produces review evidence. Reused identifiers across language/arrangement/cover variants remain conflicts.
- `bridge/youtube-store.php`: owner/handle verification, 50-item page traversal, uploads playlist plus every owned playlist, 50-video detail batches, original item IDs and positions, immutable run snapshots, additive manual decision history, Analytics reports and EP/ACT rollups.
- `bridge/youtube-api.php`: super-admin and same-origin CSRF enforcement, setup, resumable per-page collection, restart preserving a private checkpoint, manual song/MV/playlist decisions, actual Analytics and per-video retention queries.
- `deploy/noa-youtube.php`: official embedded YouTube player, separate NOA WORLD official MV filter, ordered YouTube playlists. Before owner sync, only already-public existing library URLs are displayed, clearly labelled as existing library data.
- `deploy/noa-youtube-admin.php`, `.js`, `.css`: icon controls with disabled states, ownership/config status, separate collected/automatic-match/URL-link/embedding/playback counts, review candidates, separate playlist mapping, Growth reports.
- Existing shared menu, home NOA WORLD, catalog song detail, AI LAB Growth and signed worker link to the new flow. Actual channel Analytics can inform subsequent creative briefs; absent highlight timestamps are never fabricated for full-length historical videos.

Additive MySQL tables: `noa_youtube_runs`, `noa_youtube_videos`, `noa_youtube_playlists`, `noa_youtube_items`, `noa_youtube_decisions`, `noa_youtube_analytics`. All writes are confined to these tables. OAuth credentials and encrypted refresh tokens use the existing private AI LAB storage outside the document root. No tokens enter GitHub or the Android package.

An API failure leaves the completed page checkpoint intact. A lost successful response returns current revision without fetching or applying the same page again. A completed run is committed in one transaction and repeated commits return its saved report. Missing, inaccessible or external playlist videos are separately counted. Playlist count discrepancies produce warnings, never an invented complete total. Original YouTube metadata and original NOA music fields remain separate. Missing YouTube URLs are supplied through confirmed associations in catalog detail, never by overwriting source fields.

Official API references:
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlists/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/analytics/metrics

## Existing upload path

`bridge/lab-oauth.php`, `lab/youtube.mjs`, and the signed worker already implement Google OAuth with state/PKCE, encrypted server tokens, official resumable uploads, persisted session recovery, scheduling, manual approval, and administrator-only channel auto-enable gates. This release reuses them. Channel collection does not enable automatic publishing. No upload, paid generation or public post was initiated by this integration.

## Validation

GitHub validation run 39393206638 passed PHP lint, catalog extraction tests, real MySQL catalog migration tests, and new YouTube tests. Tests cover multi-page playlists/items, membership order, video deduplication, lost-response replay, unchanged original source guard, variant conflicts, title-only review, manual MV classification and separate playlist decisions, persisted Analytics, unique-video and weighted-average rollups. Local player and AI LAB Node/FFmpeg suite: 14 passed.

Production owner authentication and real channel counts remain pending until OAuth Client ID/Secret are configured and the channel owner grants Google consent. Test fixture counts are not channel collection results. API `embeddable=true` is distinct from actual playback verification. The configured Analytics report does not synthesize thumbnail impressions or CTR when unavailable.

## Production observations — 2026-10-20

- Initial release run 39393206638 succeeded; 12 production files were created or updated and their SHA-256 values verified. Ten protected GnuBoard files stayed unchanged. Follow-up run 39393265291 also succeeded.
- Authenticated administrator clicked the production table initialization control. UI returned “YouTube 전용 테이블 준비 완료. 기존 음악·회원 테이블은 보존했습니다.”
- Existing public library YouTube view displays 282 unique video IDs. This is existing library coverage, not a newly collected channel count. Official player loaded the real EP.1 The End of the Day metadata and duration 4:12, but the cloud browser remained buffering at 0 seconds (`readyState=0`), so verified playback count is 0.
- Anonymous HTTP: YouTube menu 200, official MV filter 200, catalog 200, original player catalog 200; YouTube administrator page and status API both 403.
- Authenticated original audit: 731/731 archived files verified; 653/653 music documents match; no missing or changed originals.
- Actual configuration: OAuth app unconfigured; no channel connected; Analytics not fetched. Collection, matching, missing-URL supplementation and playlist totals are **not measured** until owner authentication. UI displays em dashes instead of reporting a completed zero-result collection.
- Production URLs: https://noastudio.ai.kr/noa-youtube.php ; https://noastudio.ai.kr/noa-youtube.php?world=1 ; https://noastudio.ai.kr/noa-youtube-admin.php .

Final follow-up run 39393593118: validation and production release succeeded. Screenshot: `12-youtube-production.jpg`.
