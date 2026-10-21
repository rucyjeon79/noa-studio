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
