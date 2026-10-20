# NOA AI LAB implementation checkpoint — 2026-10-20

This release extends the recovered production checkpoint `304b24ec361ecf7a82b3351d7577005a7e4d7411`. It retains the music player repair and all original source, member, world and preference data. No preview site is created.

## Implemented release

- Admin-only `/noa-ai-lab.php`: OpenAI music planning, title/story, lyrics/revision/hooks, Suno styles, translation/localization, YouTube/community text and thumbnail prompts. Uses the archived common/genre rules plus active overrides and administrator additional rules. Legacy `body` keys remain compatible; translations are separate. Generated drafts must be reviewed in the existing versioned editor before saving.
- Actual catalog song selection, 150 MiB chunked original audio upload and checksum. Suno share URL is separate from first-party audio URL. No unofficial Suno API, scraping or browser automation is introduced. Official public API terms could not be established; copy lyrics/style and register result URLs instead.
- Real FFprobe/FFmpeg and DSP analysis: duration, coarse rhythm/BPM confidence, RMS/onset energy, repeat lyric hooks, ranked <=60s highlights with reasons. fal Wizper provides segment ASR when explicitly enabled. Matched lyric timings remain drafts requiring administrator verification for captions; do not claim frame-perfect forced alignment or reliable singing lip sync without review.
- Cinematic video via fal Kling 2.6 Pro image-to-video; avatar/lip sync via Kling AI Avatar v2 Pro. Existing Noa/Noel references, male/female/duet assignment, timed turns and separate stems for overlapping duet vocals. Source portrait resolution is limited; upscaling does not prove identity consistency or singing quality. Actual paid renders need visual validation.
- H.264/AAC MP4, 1920×1080 and/or 1080×1920, <=60 seconds, original selected mixed audio, optional verified timed subtitles. Aspect variants reuse model clips and fit/pad instead of cropping faces.
- Audio mastering: full-file Integrated LUFS/True Peak/LRA before and after, preserve bytes or constant gain by default, optional restricted two-pass loudnorm, peak headroom and dynamics take priority over forcing -14 LUFS. Original private audio remains untouched. Separate result download, original/result listening, explicit public-library attachment with source version conflict protection.
- Official Google OAuth/PKCE, encrypted refresh tokens, channel identity from `channels.list`, auto posting disabled per channel until explicit exact-name confirmation. Save-only, administrator approval, schedule and automatic modes. Lip sync always requires visual approval. Resumable upload checkpoints, channel verification and stored URLs; uncertain provider submissions or expired upload sessions stop for reconciliation instead of blindly inserting duplicates.
- Official analytics: views, average duration, retention, subscriber contribution where provided. Missing impressions/CTR remain unavailable. Daily collection for recent published jobs; observed genre performance contributes a small measured signal to later selection and directing prompts.
- Separate scheduled worker in GitHub Actions (15-minute nominal intervals; execution timing is not guaranteed). Dothome serves PHP/auth/private queue. No assumption of FFmpeg or a long-running Node daemon on shared hosting. Python DSP + FFmpeg process audio; Node worker is an independent orchestration client, not Grok hosting.
- Private state and encrypted secrets outside document root; pinned SSH transfer, HMAC timestamp/nonces/replay protection, per-job leases, retries/backoff, chunk/result checksums, upload size/type verification, provider checkpoints, local temp cleanup, server-side keys and administrator-only access. No music/secret artifacts are uploaded to public workflow artifacts.
- OpenAI response model, actual input/output tokens and estimated cost recorded. Configurable job/daily reserved estimates block unbudgeted requests. fal estimated rates checked Oct 20: video $0.07/sec, avatar $0.115/sec; ASR/text allowance included. Estimates are not provider billing receipts. Consent notices identify data sent externally; FFmpeg mastering sends no data to AI APIs.
- Icon controls with accessible labels/tooltips, visible disabled states and circular on/off indicators. Android WebView gains explicit audio document chooser and authenticated download support; Google authorization opens the system browser, with ordinary NOA login when required.

## Legacy dependency inventory

| Class | Existing source and feature | Replacement/status |
|---|---|---|
| A | `generate-package.server.ts`: package/block/story generation, lyrics/title/summary/Suno/YouTube/fan/community prompts | OpenAI review drafts implemented; real-output comparison awaits configured key. Existing xAI routines retained. |
| A | `translate.server.ts`: xAI translation | Separate OpenAI localizations implemented; original source is preserved. |
| A/E | `runRenderThumb`, `generate-art.server.ts`: actual xAI image rendering | Thumbnail prompt generation implemented. Actual image rendering replacement not implemented; original kept. |
| A/B | ACT playlist generation and EP/ACT world-specific composition | Existing ACT/source structure passed to OpenAI; dedicated full ACT regeneration parity not yet validated. |
| B | `live-files.server.ts`, `live-bind.server.ts`, versioned saves, catalog, source archive, preferences, authentication | Existing PHP/MySQL bridge and GnuBoard retained. AI editor uses current revision; original files/archives and old binding logic retained. |
| B/C | `level-file.ts`, existing audio analysis/display fields | FFmpeg measured loudness and separate mastering output; no inferred or invented LUFS. |
| B/C | `fill-worker.server.ts`: automatic generation queue | New private PHP queue plus independently scheduled worker; original fill worker kept, not silently stopped. |
| D | TanStack/Node dev server, Grok embed/PWA middleware, legacy app-data bindings | Not required by new production PHP UI. Original Node application retained until parity is verified; no Grok external navigation added. |
| E | `suno-audio-server.ts`, unofficial source/proxy pathways | No new dependency on these endpoints. Official creation automation unavailable pending verified service terms. Copy/register/file upload flow used. |
| E | `yt-audio-server.ts`: unofficial YouTube audio extraction | Not used in new pipeline. Requires rights-cleared uploaded/first-party original audio; existing code retained. |

## Validation boundaries

Isolated tests cover real FFmpeg dual-format exports, measured mastering and unchanged source hash, DSP timing/ranking, structured creation field compatibility, paid submission ambiguity, resumable YouTube recovery, channel/approval/budget gates, PHP admin/CSRF/HMAC/replay checks and audio-only lifecycle. Provider responses in unit tests are fixtures; these do not prove actual OpenAI/fal/YouTube integration works with the user's credentials.

Production release runs PHP lint/tests first, then deploys only allowlisted new files and exact known previous hashes; preserves GnuBoard core hashes and makes no SQL writes. Signed health checks validate PHP access to private storage, curl and encryption; public catalog count is checked against the recovered 287 documents. Full member/music DB audit still requires authenticated administrative access under hosting restrictions.

Not complete until actually exercised: administrator visual walkthrough; real OpenAI draft and song save; real rights-cleared audio analysis/master/library attachment; real paid cinematic/lip-sync render and identity/timing review; channel OAuth, approved/scheduled upload, published URL and actual analytics; Android authenticated creation/upload/download walkthrough. API keys must be entered only in the production settings form, not in chat, source or Android package.
