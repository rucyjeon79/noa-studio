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

At the initial release, owner authentication and real channel counts were pending. The completed production collection is recorded below. Test fixture counts are not channel collection results. API `embeddable=true` is distinct from actual playback verification. The configured Analytics report does not synthesize thumbnail impressions or CTR when unavailable.

## Production observations — 2026-10-20

- Initial release run 39393206638 succeeded; 12 production files were created or updated and their SHA-256 values verified. Ten protected GnuBoard files stayed unchanged. Follow-up run 39393265291 also succeeded.
- Authenticated administrator clicked the production table initialization control. UI returned “YouTube 전용 테이블 준비 완료. 기존 음악·회원 테이블은 보존했습니다.”
- Existing public library YouTube view displays 282 unique video IDs. This is existing library coverage, not a newly collected channel count. Official player loaded the real EP.1 The End of the Day metadata and duration 4:12, but the cloud browser remained buffering at 0 seconds (`readyState=0`), so verified playback count is 0.
- Anonymous HTTP: YouTube menu 200, official MV filter 200, catalog 200, original player catalog 200; YouTube administrator page and status API both 403.
- Authenticated original audit: 731/731 archived files verified; 653/653 music documents match; no missing or changed originals.
- Initial release configuration: OAuth app unconfigured; no channel connected; Analytics not fetched. Collection, matching, missing-URL supplementation and playlist totals are **not measured** until owner authentication. UI displays em dashes instead of reporting a completed zero-result collection.
- Production URLs: https://noastudio.ai.kr/noa-youtube.php ; https://noastudio.ai.kr/noa-youtube.php?world=1 ; https://noastudio.ai.kr/noa-youtube-admin.php .

Final follow-up run 39393593118: validation and production release succeeded. Screenshot: `12-youtube-production.jpg`.

## OAuth callback recovery — 2026-10-20 18:30 KST

The owner saved Client ID/Secret, corrected the redirect URI, registered the test user and completed Google consent. The former callback returned a hosting-level 503 page and a subsequent retry returned 400. No channel had been saved. The previous implementation cleared OAuth session state before remote exchange and did not retain an intermediate token before channel lookup; therefore the original failure could not be safely resumed or diagnosed. Its underlying provider error is not assumed.

Production fixes: `bridge/lab-oauth.php` and new `bridge/lab-oauth-core.php`, deployed through `scripts/noa_oauth_deploy.py` / `.github/workflows/noa-oauth.yml`. Google requests now have bounded connection/total timeouts, sanitized provider errors, protected explicit success/failure receipts compatible with shared-hosting error pages, and encrypted owner/session/expiry-bound intermediate tokens. Channel lookup can resume without repeating a successful code exchange. Secrets, authorization codes and token values are never displayed. Safe credential probes use an intentionally invalid synthetic code and do not trigger account sign-in or device notifications. Diagnostic outcomes persist across page reloads.

Runs 39400506419 and 39400829444 both passed validation and production release. OAuth tests verify exact scopes, encrypted receipt recovery, actor/session/expiry boundaries, PKCE exchange parameters, server-only refresh storage and automatic publishing remaining off. Protected GnuBoard files stayed unchanged; deployments executed no SQL writes.

Actual production probe returned `invalid_grant` for the deliberately invalid test code, confirming Google transport works and no Client ID/Secret error was reported. This probe is not a successful owner authorization or a channel connection. The old owner request now explicitly reports `oauth_state_invalid`; a fresh owner authorization remains necessary. Actual channel video/playlist/match counts and Analytics remain unmeasured. Screenshot: `13-oauth-diagnostic.jpg`.

## Confirmed Google API activation blocker — 2026-10-20 18:53 KST

Fresh owner authorization succeeded and the token was encrypted in the session/actor-bound private receipt. The subsequent official `channels.list(mine=true)` returned HTTP 403 / `accessNotConfigured`: YouTube Data API v3 is not enabled for the OAuth project. Reopening the callback resumed from the stored token and reproduced that precise error without a new code exchange or device notification. User API activation is the remaining external requirement; actual channel collection has not run.

Release run 39403701950 passed validation and production deployment. Issued-token receipts can now survive the activation delay within the provider token lifetime (at most 55 minutes); the initial unexchanged authorization-code state still expires after 10 minutes. Existing valid old receipts migrate once, retaining the original issue time, actor and session binding. Screenshot: `14-youtube-api-disabled.jpg`.


## Verified owner connection and full channel collection — 2026-10-20

After the owner enabled YouTube Data API v3 and YouTube Analytics API, the encrypted pending receipt resumed without another sign-in notification. Connected channel: `UCwYy9xsAqDFat6AV5UKrfgA` / AI Artist NOA x 람준파파. The target handle and channel ownership were independently checked by official API calls. Automatic posting remains disabled. No video upload or paid generation was started.

The production run completed at 2026-10-20 19:02:45 KST. Checkpoint stage is `done`, revision 78. It traversed 59 playlist/item pages and fetched video detail batches for all IDs; no page-count warnings, inaccessible IDs or external-channel videos were reported.

| Measured result | Count |
| --- | ---: |
| Unique channel videos | 765 |
| Owned playlists, excluding the system uploads list | 23 |
| Confirmed automatic video-to-song associations | 408 |
| Videos retained for administrator review | 357 |
| Missing catalog YouTube URLs supplemented by confirmed association | 0 |
| Public videos permitted for embedding by the API | 610 |
| Actually streaming videos verified in this cloud browser | 0 |
| Inaccessible video IDs / external playlist video IDs / collection warnings | 0 / 0 / 0 |

All 357 unconfirmed videos remain separate; title similarity alone does not merge language, genre, arrangement or cover variants. Source lyrics, Suno URLs and user edits remain unchanged. Public production renders 610 cards and 23 playlists; nonpublic video metadata remains behind administrator authorization. The All Songs playlist preserves 454 original memberships and positions; its public view displayed 316 public members in their original relative order, excluding nonpublic entries. Official YouTube metadata and duration loaded for EP.20 비상, but media stayed at 0 seconds / readyState 0 in this cloud browser; API embedding permission is not claimed as actual streaming verification.

### YouTube playlist source totals

| Playlist | Original item count |
| --- | ---: |
| NOA Original Songs POP Edition | 30 |
| PANPOP | 30 |
| Latin Afrobeats EDM Collection | 30 |
| EDM K-POP Club Remix Collection | 30 |
| English POP | 90 |
| Dreamy Deep House EDM Collection | 30 |
| Shorts 이 노래가 좋아 | 51 |
| 당신의 이야기, 우리의 음악 | 47 |
| NOA’s Diary EP Series M/V | 30 |
| Groovy airy POP Collection | 30 |
| Fantasy Ambient EDM Collection | 30 |
| NOA Dance Vibes | 128 |
| Narrative Piano Indie Collection | 30 |
| NOA Original Songs THAI Edition | 30 |
| Echoes of Joseon EDM Collection | 30 |
| All Songs Playlist | 454 |
| AInoa의 유명곡 커버 | 37 |
| Korean POP | 319 |
| Continuous Listening | 49 |
| NOA Original Songs J-POP Edition | 40 |
| NOA ACT M/V | 3 |
| NOA Original Songs K-POP | 40 |
| Joseon Ballad Collection | 30 |

The first 765-video review rendered too many repeated song options. Production UI now renders 25 videos per review page (31 pages), searches across all titles, and populates song choices only on focus. A fresh page verified 25 review rows and 109 total options; previous/next icon buttons expose the rest. Versioned script URLs replace previously cached code. Runs 39405032373 and 39405432995 passed PHP/Node/MySQL validation and pinned/hash-verified production release. Three web files changed in the final pagination release; ten protected GnuBoard files remained unchanged.

Post-collection original audit again verified 731/731 archived originals and 653/653 music documents, with no missing or changed originals. Existing 601-song / 52-ACT / 53-NOA-playlist migration is unchanged.

Analytics initial live query failed. Shared hosting replaced the HTTP error body with generic HTML, so the safe API response adapter now exposes the official HTTP status/reason only to the authenticated administrator; authorization and CSRF boundaries remain enforced. Google’s channel-report documentation requires descending metric sorting for top-video reports; the previous `sort=video` query was replaced with documented `sort=-views`, with a regression assertion against the request parameters. Actual live revalidation is recorded after deployment below.


### Live Analytics result after query correction

The old request returned official HTTP 400 / badRequest / unsupported query. After replacing the unsupported sort with the documented descending view metric, the production control returned “영상·EP·ACT 성과를 저장했습니다.” Analytics status is connected for 2026-09-20 through 2026-10-19. The official response returned 199 video metric rows; confirmed associations produced 408 EP grouping rows and 41 ACT grouping rows. A returned metric row is not claimed for every one of the 765 collected videos, and absent provider rows are not fabricated as measured zero values. Thumbnail impressions/CTR remain unavailable in this report.

Runs 39405849302 and 39405958246 passed validation and production release. The latter updated only `noa-bridge/youtube-store.php` (SHA-256 `55134aba757b529a7c60d07666333d2b31957b6e18f3f20089cbafbdffb692f2`); ten protected GnuBoard files stayed unchanged. Regression coverage now asserts the documented sort and maximum response size, plus sanitized provider diagnostics. No additional owner sign-in or Google device prompt was requested during API activation recovery and collection.

Changed production files in this completion work: `noa-youtube.js`, `noa-youtube-admin.php`, `noa-youtube.php`, `noa-bridge/youtube-core.php`, `noa-bridge/youtube-api.php`, `noa-bridge/youtube-store.php`. Corresponding source paths use `deploy/` and `bridge/`. Deployment script, workflow, core/MySQL tests and this existing verification document were updated in GitHub. Screenshot `15-youtube-connected.jpg` shows the live channel, automatic publishing off, stored performance confirmation, and real collection counts.

Live retention verification for public Official MV EP.20 비상 returned the official columns `elapsedVideoTimeRatio`, `audienceWatchRatio` and `relativeRetentionPerformance`, with 0 rows for the selected period. The UI displayed the real response; no retention curve or highlight timing was invented from the empty result.
