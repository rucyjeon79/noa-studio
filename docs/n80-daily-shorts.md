# 이 노래가 좋아 — daily Shorts production

The user authorized selecting a song, producing a 9:16 Short lasting 49–59 seconds, publishing one daily at 12:00 Asia/Seoul to the existing playlist, and connecting its exact original video. `config/n80-daily-shorts.json` defines the verified channel, playlist and exclusions. The schedule is owned by N80 Auto, called inside the registered ai.daily_shorts operation in the existing worker by the existing 15-minute GitHub Actions runner. It is persisted in lab:state.json:campaigns.daily_shorts, independent of a conversation. No ChatGPT automation is enabled for this campaign.

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
