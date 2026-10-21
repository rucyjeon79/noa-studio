# JUKEBOX media pipeline

Source: `chatgpt/jukebox-20261021`, PR #7. Production evidence must be read from the latest successful `NOA JUKEBOX public cards and authorized audio` run and the live administrator page. A commit alone does not prove deployment or playback.

## Production layout

- Application: `/hosting/noastudio/html/noa-app/jukebox/`
- Media: `/hosting/noastudio/html/noa-jukebox/`
- Main entry remains root `index.php`; this change does not replace the application entry or GnuBoard core.
- `bridge/catalog.php` deploys as `noa-bridge/catalog.php`.
- `deploy/noa-music.php` deploys as root `noa-music.php`.
- `deploy/noa-app/jukebox/{core,operations,service,stream,index,cli}.php` deploy to the corresponding application folder.
- `media.htaccess` deploys as `noa-jukebox/.htaccess` and denies raw access to all media files.

The release compares exact reviewed hashes before replacing either existing integration file. Unknown versions cause a stop; original application bytes are backed up privately before replacement. New helper upgrades are accepted only against the explicitly recorded prior hashes. No root index, GnuBoard configuration, membership, song document or YouTube record is rewritten.

## Media and identities

Normal songs use `K-POP|J-POP|POP|Thai / EP.nn title /`. Collections use `컬렉션 / genre / EP.nn title /`; stories use `사연곡 / title /`; covers require `커버곡 / title - original artist /`. Missing original artists are reported rather than guessed. Duplicate folder identities receive a stable version suffix. The unmodified Suno title is retained in SQL; only filesystem-unsafe characters are converted for filenames.

Public Suno metadata supplies the resolved song ID, original title and actual image URL. No CDN audio URL is synthesized. Cards are decoded, converted to WebP and checked before publication. A provider error stays an error; no unrelated image is substituted.

Audio accepts only explicitly authorized user-owned download files, bound to both song key and resolved Suno ID. `scripts/noa_jukebox_worker.py --sources <manifest>` reads that binding. MP3 processing measures codec, duration, bitrate, channels, sample rate, loudness, loudness range and true peak, and decodes the whole input and output. Constant gain preserves dynamics; peak headroom takes precedence over the default -14 LUFS target. Suitable existing MP3s are copied rather than needlessly encoded. Encodes request 320 kbps stereo and retain supported source sample rates. Failed output validation never publishes a playable asset. WAV is never written; decoding uses a pipe and temporary output is bounded and deleted.

**Current limitation:** a public share page is not download authorization. Without official account access or an already owned source file, the worker records `audio_pending`. The release does not infer an authenticated Suno session and does not extract a playback stream. Actual song MP3 generation and audio playback must remain unverified until a real authorized source has passed the complete pipeline.

## SQL and playback

Only three additive tables are created: `noa_jukebox_assets`, `noa_jukebox_history`, `noa_jukebox_jobs`. Existing document keys remain the binding identity. File paths, bytes, SHA-256, Suno metadata, source/final analysis, correction settings, status, errors and verification times are recorded. Verified editions survive failed retries, and new evidence is appended to history.

The existing web catalogue and player read the asset overlay without changing source music documents or Android keys. Stream URLs contain a song key and media type; internal paths are not returned to clients. `stream.php` checks document visibility, source identity, file boundary, SHA-256 and MIME before serving. GET/HEAD and single HTTP byte ranges are supported. Missing MP3s produce 404 and remain disabled in the player.

## Operations

The administrator screen requires the existing GnuBoard super-administrator session and CSRF verification. It registers bounded requests, shows verified assets, errors, analysis and correction evidence, and checks for missing files.

The runner uses the existing pinned SSH host identity and private service key. Server work uses a scoped HMAC request with timestamp and replay nonce; only fixed export/import/audit/job operations are accepted. No submitted SQL, shell command or arbitrary target URL is executed. The hosting environment has no PHP CLI, so production DB work uses the authenticated PHP service.

The worker runs 25-record batches, imports only after server-side file verification, and reuses acquired cards on retries. Its dedicated concurrency group does not cancel other development or deployment workflows. Scheduled checks on main run every 15 minutes; an empty administrator queue exits without Suno acquisition. Failed or interrupted requests can be retried. Schedule activation requires merging the workflow to main.

## Validation

- `python3 -m unittest discover -s tests/jukebox -p 'test_*.py'`
- `php tests/jukebox/range_test.php`
- PHP lint on all application helpers and both integration files.
- Live image decoding, SQL file checks and HTTP Range probes.
- Live browser checks for administrator queue registration, counts, card loading and disabled missing-audio controls.

Codec tests use disposable synthetic test audio. They are never counted as acquired catalogue songs or as real playback verification. Mobile rendering, real song playback, advancing playback time, sound output, track switching and Android background playback require separate live evidence; do not infer them from PHP lint or an HTTP 200.


## Public-source audit added on 2026-10-21

The legacy `suno-audio-server.ts` was inspected together with `loudness.ts`, `music-player.ts` and `lab/mastering.mjs`. The old route guesses CDN names and can request rights material to decrypt M4A. Neither behavior is used by this worker. Its old browser master also creates temporary WAV blobs and measures sample peaks; that is not evidence of a stored, true-peak-verified MP3.

`--inspect-audio` reads the actual public serialized song object. It records public status, creator handle, ownership reason and exactly published audio/video/media URLs in `source_evidence` and history. It never treats an accessible playback resource or creator metadata as download authorization. The sample public video answered HTTP 206; the alternate M4A bytes were not an ordinary playable MP4 header, and the audio field pointed to `/api/forbidden`. No encrypted resource was decrypted or copied as an audio input.

An official, already-owned download can be bound by a private registry at `/hosting/noastudio/noa-jukebox-owned/sources.json`. Each song-key entry requires `authorization: user_owned_download`, `suno_id` and a `file` basename; optional SHA-256 is checked. Sources stay outside the web root, must be regular files, and are limited to 160 MiB each and 512 MiB per staged batch. Invalid entries do not block subsequent songs. Staged inputs are deleted after each batch; final output remains MP3 only. Do not populate this registry with copied playback streams or resources obtained by bypassing download controls.

Suno's terms effective 2026-09-03 require a permitted download channel and prohibit stream ripping (https://suno.com/terms, permitted commercial use section). An account sign-in remains a separate user-authorized action. Playback availability, ownership, download authorization, successful decoding and final stored MP3 readiness are distinct evidence states.

## Legacy corrected-download path: code review 2026-10-21

The legacy implementation does generate a corrected downloadable file. This is a code-path finding; it is not a new end-to-end test of every live Grok song. `src/lib/download.ts` is the generic image downloader (its caller in `package-view.tsx` downloads a thumbnail). The actual music download starts in `src/components/studio/studio-chrome.tsx`.

| Question | Actual code path and behavior |
| --- | --- |
| Download entry | `MasteredDownload` obtains the Suno title, then calls `saveMasteredWav(id, url, wavFileName(title), ...)`. The name is `<Suno title>_NS.wav`. |
| Shared playback/download input | `music-player.ts:masteredWavUrl` calls `prepareMastered(id, masteredClipSrc(...))`. The source is `/api/suno-audio?u=<share URL>&e=2`. Playback's `levelThen` also calls `prepareMastered`, assigns `ready.url`, marks the element mastered, and sets volume to 1 to avoid applying the correction twice. |
| Server acquisition | `suno-audio-server.ts:resolveSuno → findAudio` selects media. `url` streams the upstream response and its Range headers; `file` downloads MP4 and uses `playableFile` to strip video, first with audio stream copy and then AAC 160k fallback; `local` reads a cached M4A. With `e=2`, `wavFile` decodes to stereo 44100 Hz PCM16 WAV before responding. If that preparation fails the route falls back to the selected source, not a successfully mastered WAV. |
| Analysis data | `loudness.ts:prepareMastered` fetches the complete response into an ArrayBuffer and `decodeAudioData` produces PCM channel samples. `measureChannels` applies K-weighting and absolute/relative gates but measures at most the first 120 seconds. `measurePeakDb` is sample peak, without true-peak oversampling; this browser path does not measure LRA. |
| File correction | `masterBuffer` uses intensity 50: low shelf +1.5 dB at 120 Hz, high shelf +1.2 dB at 8 kHz, compressor threshold -18 dB / ratio 2.5 / knee 8 / attack 12 ms / release 140 ms, then a mild tanh waveshaper. It remeasures the processed buffer, calculates target gain toward -14 LUFS and `renderTarget` applies that gain and a hard sample ceiling at -1 dB. |
| Encoded download | `wavBlob(played)` writes a RIFF/WAVE header and interleaved signed little-endian 16-bit PCM. This is a genuine WAV encoder, not MP3 and not a filename change. Successful download saves the processed `played` samples. `showSaveFilePicker → createWritable → write(blob)` is used when supported; otherwise an anchor downloads the same Blob URL. Failure does not silently substitute the original. |
| Live gain versus file correction | `setTrackGain` adjusts `HTMLAudioElement.volume` only and cannot change saved samples. The normal mastered path renders a new buffer and sets playback volume to 1. The live meter can publish provisional values after about 3 seconds and locks after about 20 seconds; that is distinct from final whole-file analysis. |
| Permissions | `MasteredDownload` is hidden unless `isAdminDevice()` passes. That is a client-side NOA device gate, not Suno ownership/download authorization. The route handler forwards GET requests with no per-song account/entitlement check in the reviewed route/helper. `fetchRights` is part of encrypted-media handling, not a download permission decision; URL guessing, rights/key fetching and AES unwrap/decryption are excluded from the new pipeline. This finding is limited to the reviewed code, not unseen platform-level controls. |

`lab/mastering.mjs` is a separate server/worker path, imported by `lab/worker.mjs`, not by the browser's `masteredWavUrl`. It measures FFmpeg LUFS/true peak/LRA, plans preserve/transparent/limited correction, writes PCM24 WAV when corrected, remeasures and corrects overshoot, then returns a manifest. The preserve mode copies the original container/codec. `lab/worker.mjs` uploads `optimized` output with that manifest and deletes its temporary working directory. Thus the browser's PCM16 download and lab's PCM24/preserve output must not be conflated.

### Reuse in the existing MP3 worker

Keep the already deployed cards, SQL overlay, source evidence and stored-MP3-first player. Reuse audio-only extraction, decode-to-PCM analysis, a shared corrected-file result, the lab's transparent constant-gain planning and final-output remeasurement. The default MP3 worker retains dynamics rather than adding the browser's tonal EQ/compression/saturation automatically.

The worker now also reuses the lab's measured-output peak correction: if the first MP3 encode exceeds -1 dBTP, it adjusts gain once and re-encodes **from the original authorized source**, avoiding a second lossy generation. SQL correction JSON records planned gain, actual total gain, first encoded true peak and codec-headroom adjustment separately. Failure after the retry leaves the song pending. No permanent or temporary WAV is created by this MP3 worker.

Nine worker tests pass, including real authorized-input fixture MP4/AAC → analyzed/corrected MP3 beside an unchanged WebP, plus a controlled encoder-overshoot test proving the retry uses the original source and records the actual gain. Fixtures are synthetic and are not counted as acquired catalogue songs, production MP3s or audible playback verification. Main production run `39548313447` also completed successfully after PR #7 merged; at that point the verified catalogue totals remained 491 records, 454 WebPs, 0 MP3s, 0 missing/mismatched files. A private authorized-download registry is supported, but no usable catalogue input has yet been supplied through it. Existing authentication approval rejection remains unresolved; this review does not retry sign-in.
