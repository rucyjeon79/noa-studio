# 이 노래가 좋아 — N80 automatic Shorts production

The user authorized selecting a song, producing a 9:16 Short lasting 49–59 seconds, publishing one every Monday, Wednesday and Friday at 12:00 Asia/Seoul (updated 2026-11-09) to the existing playlist, and connecting its exact original video. `config/n80-daily-shorts.json` defines the verified channel, playlist and exclusions. The schedule is owned by N80 Auto, called inside the registered ai.daily_shorts operation in the existing worker by the existing 15-minute GitHub Actions runner. It is persisted in lab:state.json:campaigns.daily_shorts, independent of a conversation. No ChatGPT automation is enabled for this campaign.

## GitHub execution and storage (2026-11-09)

The user replaced the blocked Drive setup with GitHub. The existing N80 daily
Shorts worker now transfers only registered generated media to Actions artifacts.
It derives an asset-bound AES-256-GCM key from the existing worker secret, uploads
ciphertext, downloads it again, and checks decryption, byte count and source hash
before committing a receipt. The public repository never receives plaintext media
or the encryption key. Names are opaque. Source files and Gem knowledge are not
copied. GitHub retention is at most 90 days here; the authoritative host copy is
retained. Losing or rotating the worker secret prevents old artifact decryption,
so artifacts must never become the only surviving copy.

The existing N80 queue, owner, source revision, 15-minute lease and three-attempt
budget own transfer/recovery. Run identities are reserved before upload and
reconciled on the next run after an ambiguous response. A storage receipt neither
accepts a scene nor resumes the paused job. Post-publication deletion is still
blocked until public video, destination playlist and native related-video evidence
and a real deletion executor exist. Do not claim cleanup is active.

Gemini text review is registered in the existing private ChatGPT worker. Its
`NOA_GEMINI_OAUTH` secret must contain a deliberately connected Gemini CLI personal
login; browser sessions and Gem/Flow credentials are never extracted or assumed.
The pinned CLI runs in an isolated temporary working directory with all tools
denied and without N80, SSH, GitHub or Codex credentials. No paid API or Vertex
fallback is enabled. A real nonce response is required for each worker before it
advertises the text capability to N80; renewed credentials are retained using the
existing private secret-rotation path. Missing login leaves ChatGPT operational.
Gemini only returns feedback; ChatGPT reviews and the existing N80 save validator
owns completion. This does **not** connect existing Gem image generation or Flow
motion generation, which remain unverified persistent executors.

## Current completion requirement (2026-11-09)

The user requires N80 to generate and publish without this conversation or manual
image/video downloading, uploading or handoff. The session executor is a temporary
operator interface, not the requested finished automation. Existing MP3s, song
metadata, character sheets and generation receipts must be reused. A working
subscription browser executor and original-file recovery are still missing;
registering this schedule must never imply those stages are complete.

`publishIsoWeekdays` uses ISO weekdays `[1,3,5]`. Preparation starts at 08:00 KST
on those same days for the noon publication target. The existing N80 worker clock
is unchanged; it does not provide second-accurate publication. A verified upload
must be scheduled ahead in YouTube for noon. At or after a missed noon, select
the next configured weekday, never backdate or compensate with duplicate uploads.
Unstarted off-day slots are cleared. Existing job/upload identities and evidence
are retained; they are not silently re-dated. Empty startup and subtitle claims
cannot create work on a removed weekday.

## One execution

1. Read current configuration and N80 tasks. In signed-in YouTube Studio verify the channel ID, destination playlist, and scheduled/published Shorts. Reconcile any previous unfinished upload before doing anything new. If today already has this series scheduled or public, finish its missing playlist/related-video association only. Do not upload another. Do not delete or change unrelated uploads.
2. Inspect the other genre playlists and the current original/Shorts exclusion playlists. Exclude all Shorts regardless of playlist overlap, videos also in K-POP originals, unpublished originals, genre/record mismatches and songs already used in this series. Other genre arrangements remain eligible even when their name contains KPOP. Use recent engagement and retention where available, normalized for exposure; low raw views or playlist totals alone do not establish potential. Compare at least three eligible tracks and record the selection rationale without claiming predicted virality.
3. Resolve the selected version to its authoritative NOA track key and source revision. `noa_agent_read(trackKey)` returns the current lyrics/genre/title and verified source hash. `noa_agent_source_file` downloads bounded chunks without creating disposable analysis jobs; write bytes locally and verify the full SHA-256. Never ask for the already-uploaded MP3 again. Check the exact source video and genre/EP, not title alone.
4. Analyze actual MP3 with `lab/analyze.py`, request `lengths:[49,55,59]`. Listen to candidate hooks and compare lyrical impact, immediate recognizable vocals, rhythmic transition and complete phrases. Waveform energy is only a candidate signal, never a fabricated vocal timestamp. Choose an actual 49–59s window, normally 55s, with strong opening and a natural ending.
5. Start a `format:shorts` N80 agent job with `selection:{start,end}`, current revision and deterministic request ID. The goal must contain campaign name, KST target date, selected original video ID, source playlist, selection rationale and intended destination. Reuse an existing current task on resume. The original source hash remains the full file hash; the timeline covers only the selected window.
6. Use the existing begin/file/review workflow to create and inspect matching portrait visuals through available authorized Gemini/Flow subscriptions. Read `characterReferences` from N80 and attach the actual official NOA/NOEL sheet files for visible characters; prose descriptions or URLs without image attachments are insufficient. Match the reference faces and body proportions, changing only scene-appropriate clothing and styling. Compare faces with the sheets before acceptance. Preserve provider marks. Download original-resolution base images, not UI previews. Choose video resolution using the actual provider options, available credits and visual review, rather than hard-coding 720p: a low-resolution motion draft can be useful, but an upscaled file is not native high-resolution footage. Generated clip audio is discarded; final sound is only the selected source MP3. For Korean lyrics use the existing real-audio subtitle aligner and actual listening review; the assembler clips and shifts reviewed cues. Never invent evenly spaced subtitle timings. For non-Korean tracks use properly aligned original lyrics and separately reviewed Korean translation if available; do not label a translation as exact registered Korean lyrics.
7. Assemble with `lab/session-assemble.mjs` using the job's manifest; keep `sourceDuration`, `selection`, and full-source checksum. Check actual frames, sound, readable mobile text, subtitle sync, and the entire file with ffmpeg. Verify final portrait dimensions, 49–59s duration and receipt before accepting/storing it in N80. No blank/test/placeholder media may be uploaded.
8. Upload the accepted final to the verified channel once. Set appropriate title/description, original link, audience and truthful synthetic-content disclosure. Add the existing destination playlist. Set YouTube Studio's native Related video to the exact selected original, not merely a description URL. Schedule public visibility for 12:00 Asia/Seoul on the intended date; confirm displayed timezone/date. Verify the actual scheduled row, video ID, playlist and related-video field. An upload action without a confirmed result is not completion.
9. Report the selected song, hook time range, short URL and confirmed publication time. If authentication, provider quota, processing, rights checks or native related-video access blocks completion, preserve the task with a precise reason and report the real blocker; do not silently publish incorrectly or pretend scheduled output exists. If noon has passed, use the next available noon and never backfill multiple public posts on one date.

## Current execution boundary

The N80 runner persists the policy, next preparation/publication times, last tick and one resumable pending slot. It checks the actual offline YouTube connection without exposing tokens. A missing connection leaves a durable connection_required state and does not create empty production jobs or consume paid API budget.

The registered worker now also performs read-only preparation: it claims a fenced 30-minute lease in `campaigns.daily_shorts.preparation`, refreshes actual playlist membership and public video statistics through the existing hosting OAuth connection, resolves exact registered track keys, downloads the existing MP3 over the existing verified SFTP connection, verifies its full SHA-256/duration, and measures 49/55/59-second windows for three eligible candidates. Recent retention is optional and explicitly marked unavailable when the provider has no report. Playlist taxonomy reuses the N80 genre classifier. K-POP-original overlap, Shorts playlists, private videos, duplicate/ambiguous source identities and uncertain short-video aspect are excluded. Source titles alone never establish identity.

The first preparation bootstraps immediately; following dates respect 08:00 KST. Same-day completed reports are reused, failed attempts are bounded to three, and an abandoned lease can be recovered after expiry. Audio is temporary on the existing GitHub runner and removed after measurement; reports persist in the hosting store, with no new SQL jobs or permanent source copies. A preparation failure does not prevent unrelated N80 text/music work. Only a successful main-branch deployment can wake this same worker; no additional cron or conversation task is created.

Measured candidate reports are not a movie approval, listening review, subtitle alignment, complete duplicate-publication check, or YouTube upload. Prior source IDs in descriptions are supporting evidence only; native Related-video fields still require a real adapter to verify. The report keeps `publicationReady:false` and the campaign retains its execution blockers until those remaining stages actually run.

The currently installed Gemini/Flow and native YouTube related-video operations are ChatGPT session browser tools. They are NOT a persistent server executor. There is no server browser adapter yet. The scheduler therefore explicitly reports productionReady:false and persistent_browser_executor_required until an actual separately connected execution adapter is implemented and verified. It does not claim to have generated, scheduled or published a video. Do not clear this blocker merely by toggling a configuration flag or by creating another conversation automation.

The procedure above remains the authorized production contract for that adapter or an explicitly active operator. A schedule tick is not proof of successful media production. YouTube controls exact public timing only after a real, verified scheduled upload.

## Actual preparation and Korean recognition continuation

Run 42512503071, attempt 2, completed actual preparation after renewing the
existing YouTube authorization. At 2026-11-08 19:07 UTC the hosting retained
284 eligible sources, three measured MP3 candidates and their original-video
identities: `single:echoes-of-joseon:13` / `ovdE-E9Rjm4`,
`single:narrative-piano-indie:18` / `dUsmsp1ZgbE`, and
`single:echoes-of-joseon:12` / `arTmkUxdaBU`. These are candidate results,
not a listening decision or a publication receipt. Google identified the current
OAuth application as Testing. Its production audience setting could not be
opened in the available browser; no production-status change is claimed.

Korean recognition now follows preparation inside the same registered worker.
The highest ranked measured source receives a fenced 20-minute subtitle lease
in `preparation.subtitlePreparation`, three bounded attempts, source revision
and audio/lyrics hash checks. Already saved results are reused. A paused campaign,
expired publication date or changed source cannot proceed. No new media job,
queue, timer, provider API account or permanent MP3 copy is created.

The runner installs the existing pinned local recognizer only after claiming work,
with a three-minute installation timeout and twelve-minute recognition timeout.
It downloads the existing private MP3, verifies the checksum, and runs CPU/int8
faster-whisper against the actual audio. The existing subtitle validator checks
the returned timestamps against exact registered lyrics. Explicit parenthetical
production directions are omitted from both Python and PHP lyric parsing;
ordinary parenthetical lyrics remain. English-only lyric lines remain identified
for translation review. Recognition outputs are `aligned` or `needs_review`;
neither sets `audioListeningReviewed` or `publicationReady` to true.

This stage does not implement automatic English-to-Korean translation, audio
listening review, portrait generation or the native Related-video adapter.
Production remains blocked until those required execution/review steps succeed.

Visual work may proceed while subtitle timing awaits review. Both stages remain
inside the same leased N80 task. Unresolved subtitles still block final assembly,
file acceptance and publication; creating a scene never counts as audio review.

The first concrete 49-second pilot uses source `single:echoes-of-joseon:13`,
152.24–201.24 seconds, in task `b3479a0ca5aa45692fbcd117c6852e86`.
Seven scene plans are stored in that task. A local medium-model pass over the
actual excerpt exposed a greedy repeated-chorus alignment error: recognized
early words were assigned to a later chorus. Minimum-edit ordered alignment
recovers 11 of the 12 registered excerpt lines from the same measured transcript,
instead of seven. The remaining mixed Korean/English line still fails matching
and must not be approved automatically. No listening review, finished movie or
scheduled upload is implied by these results.

That pilot was cancelled after the user identified that its first image had been
generated without attaching the official sheet. Its image must not be reused;
no Flow video was generated. Successor `aea753a2aaee25d7f361265e24c1c03e`
retains the same measured source window and explicitly references both existing
official sheets. N80 now supplies the sheet URLs and actual SHA-256 values on
source/job reads, snapshots those identities in new jobs, and refuses image
generation when a required file is absent or has changed since planning.
The operator must still attach the actual files and compare the result; the
metadata check does not prove a provider received a reference or matched a face.

The reference-based Gemini image was recovered only as a 572×1024 preview and
was rejected as a production base. A subsequent built-in ChatGPT image request
attached the same official NOA sheet and returned a native 941×1672 PNG. The
image receiver records `provider:chatgpt` with `https://chatgpt.com/` as the
provider origin (not a fabricated result URL); the review note records the
actual tool output filename and reference sheet. Gemini result URLs remain
supported, and video sources still require Flow. All checksum and review gates
remain mandatory.

The assembler previously forced every final to 720p. It now supports explicit
720p or 1080p delivery, with N80 Shorts manifests requesting 1080×1920. Legacy
manifests retain 720p compatibility. Actual stream dimensions and full decode
are still checked; higher delivery dimensions never imply the source footage
was generated natively at that resolution. Approved frames are padded rather
than cropped so provider marks remain visible.

The matcher uses a bounded eight-million-cell traceback and reports
`transcript_alignment_too_large` for inputs exceeding that limit. It maps only
actual matching recognized characters to their measured word intervals; it
does not fill missing lyrics, interpolate times or waive confidence checks.

## Automatic editing inside the existing worker (2026-11-09)

The registered `ai.daily_shorts` execution now calls the automatic assembler after
preparation and recognition. A campaign must explicitly attach an existing,
owner-matching Shorts job with an exact analyzed original video/source revision
and hash. Attachment does not resume a paused job, create a replacement song,
accept generated scenes or alter its source window.

Once all actual scene videos are accepted and required subtitles are ready, N80
claims that same job with an exclusive, expiring lease. The existing authenticated
worker automatically downloads the original and accepted clips from bounded
N80 file operations, verifies each checksum, builds the 1080×1920 manifest, runs
the existing full-decode assembler, and returns the actual final file and receipt
in bounded chunks. Hosting credentials are not inherited by media subprocesses.
No person needs to download or transfer these files.

A lost worker can retry the same final operation at most three times; stale
leases are fenced. Identical partial transfers resume, and conflicting bytes
stop rather than overwriting prior output. A completed receipt is never rendered
again. Paused jobs, missing motion footage, changed originals and unresolved
subtitles remain blocked. No extra scheduler, provider API or SQL queue is added.

The received final remains `agent_review`, with `accepted:false`. Full decode and
correct original-audio mapping are technical checks, not visual or listening
review. This editor cannot call review, publish, or waive provider-policy holds.
The subscription browser executor, original image/video recovery, final quality
review and native related-video publication still require their actual runtime
integration; automatic editing alone is not complete unattended production.

## User-confirmed source and temporary media ownership (2026-11-09)

N80 must own execution from the M/W/F schedule through publication and cleanup.
The existing hosted ChatGPT worker is the intended planner and reviewer, with
the user's existing `Music Drama MV Creator` Gem (`21f716bf5427`) handling images.
Opening Gemini in a ChatGPT conversation is not a verified server executor.
Do not replace this with manual one-off production and call it automation.

Read current MP3, title, lyrics and genre image rules from the host by track key.
Use the character knowledge already stored in the Gem. Do not copy these source
assets to a new Drive folder or rebuild the song information or character setup.
Only newly generated images, video clips and editing outputs belong in the
existing private `NOA STUDIO/업로드 임시저장` Drive area. Keep each temporary file ID
associated with its owning N80 job, source hash and provider result.

After actual public YouTube publication, membership in the specified Shorts
playlist and the exact native related original video are all verified, delete
that job's registered temporary Drive media and local generated caches. An
upload request, scheduled/private video, model assertion or incomplete check is
not publication. Failed/ambiguous jobs retain their media for recovery. Never
delete the original host MP3/metadata/rules, Gem knowledge or unrelated files.

The policy now records these constraints. The Drive executor, deletion executor
and persistent Gem executor flags remain **false**: policy persistence does not
prove those adapters are implemented, connected or exercised.


## Generated media Drive spool (2026-11-09 continuation)

The existing `ai.daily_shorts` worker now archives registered generated images,
scene clips and final edits through `session-shorts-storage.php` and
`noa_shorts_storage.py`. It reuses the existing private Drive credential and
configured temporary parent. It never copies source audio, metadata, genre rules
or Gem knowledge. Each job owns one folder and records each generated file ID,
source audio hash, provider URL and byte hash in its existing N80 record.

The worker persists pre-generated Drive IDs before any external creation, reuses
those identities on interrupted attempts, and validates ownership, private
visibility, parentage, size, provider checksum and a full downloaded SHA-256.
An expired lease fences the old worker; three attempts per immutable asset and
three assets per tick bound retries and work. Idle ticks do not open Drive.
Storage preservation can run for a paused production job without resuming
creation, accepting an image or approving subtitles. Cancelled jobs are excluded.

Only disposable transfer copies are removed locally. The registered host media
and Drive files are retained; cleanup remains `publication_verification_required`.
This change has no deletion endpoint. Actual public visibility, destination
playlist and native related-video verification plus a deletion executor still
must be connected before automatic cleanup can run. Gemini/Flow persistent
execution and final review/publication are also still incomplete. Storage
receipts are not generation, review or publication receipts.

Protocol reference: https://developers.google.com/workspace/drive/api/guides/create-file
(pre-generated IDs make create retries conflict instead of duplicate) and
https://developers.google.com/workspace/drive/api/guides/manage-uploads
(resumable binary upload). Missing credentials, ambiguous metadata and different
bytes fail closed without deleting the existing generated source.

### Observed deployment and connection blocker

PR #452 was deployed by Actions run 42552846448 at commit
`168e594c405771c40e7d35fac3d42f61da24779a`. The host verified the two
changed bridge files and preserved all 11 protected sources. The existing N80
worker then ran automatically (42553364560), but its Drive credential setting
was empty. Its first storage attempt stopped before reserving any Drive IDs;
no Drive storage receipt or public video exists. Do not call this a successful
Drive connection. ChatGPT's connected Drive tools do not supply this worker's
credential. Never export browser cookies or connector credentials as a shortcut.

The worker now checks that its existing Drive credential configuration is
present before claiming media. Missing configuration reports
`storage_connection_required / drive_credentials_missing` without using another
asset retry or changing the production job. Actual token refresh, upload and
readback must still pass after the approved worker connection is configured.


### Host-owned Drive authorization

`/noa-bridge/lab-oauth.php?action=drive` is an administrator-only connection page,
linked from AI LAB settings. It reuses the existing Google OAuth client and
registered callback; YouTube tokens and channel settings are unchanged. Starting
consent requires a POST with exact-origin CSRF validation. OAuth state and PKCE
are tied to the administrator, session, destination, client and current connection,
expire after ten minutes, and cannot replace a connection changed concurrently.

This route requests the full Drive scope to access the existing fixed parent;
`drive.file` would require separately selecting that existing folder through a
Picker. The page discloses the requested permission. Google approval is explicit;
merging or deploying this code does not grant access. Never automate consent to
broader or persistent account permissions without the user's confirmation.

The host verifies an actual refresh and the exact private, owned, writable parent
before committing encrypted credentials outside the web root. An encrypted,
session-bound pending receipt permits retry after a folder/provider failure;
rotated refresh credentials are retained before the folder lookup. Public status
and HTML never contain tokens or client secrets. OAuth projects in Testing may
issue time-limited offline authorization; this connection does not guarantee
indefinite access or change the project's publishing status.

When the existing runner has no rclone configuration, it checks host authorization
before claiming an asset. Each claimed asset receives only an expiring access
token, following owner/source/lease validation before and after refresh and a
connection-identity check at commit. Refresh tokens and the OAuth client secret
remain on the host. The bearer token itself has the granted Drive scope; N80's
fixed-folder and job-ownership checks constrain this trusted runner's operations,
not the token's Google permissions. Tokens stay in memory and are not logged.
The existing rclone path remains compatible. No extra worker or paid service is
added. Only a verified stored-file receipt marks the current connection as
worker-tested. Deployment, consent, token refresh and successful file storage
are separate evidence states. Persistent Gemini/Flow execution, reviewed final
production, publication and deletion remain unimplemented until actually proven.
