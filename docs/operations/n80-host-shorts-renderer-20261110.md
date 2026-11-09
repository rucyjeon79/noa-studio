# Host Shorts rendering

The existing N80 campaign retains the only assembly queue, lease, retry count,
source revision checks and final review. `noa_shorts_assembly.py` now transports
the accepted input files to a bounded executor on the existing NOA host. It does
not encode on GitHub or start a second renderer when a host response is lost.

`ai.media_install` is owned by `noa-ai-worker.yml` in the existing production
installation lane. A main push marked `[n80-media]` stages Ubuntu system FFmpeg,
FFprobe, Fontconfig, their linked libraries and the Korean Noto font in the private
host runtime. All files are verified before execution; an atomic activation
receipt is written only after actual host encoding, full decoding, crossfade
pixels and visible Korean subtitle pixels pass. The fixture is a private 1.5s
red/blue clip with synthetic audio, never a user's accepted movie or publication.

The renderer uses the existing verified host Node runtime, two encoding threads,
one filter thread, private temporary files and local file/pipe protocols. A job
has a 600s host process-group deadline, below the existing 1200s assembly lease.
An unconfirmed response retains the lease and private job for diagnosis; it does
not call `assembly_fail` or release the job for immediate duplicate execution.
Confirmed completed jobs are removed after the final bytes are retrieved and
their hash matches. No daemon, new cron, new queue or external rendering fallback
is added. Media/renderer source drift blocks execution until the host package is
verified again.

This change does not satisfy the independent Gemini/Flow browser requirement.
The host account's missing `/proc` remains a provider-side browser prerequisite;
no fake filesystem, sandbox removal, API switch or alternate host is introduced.
The paused seven-scene production task is not resumed or accepted by the runtime
check. Its accepted source clips, reviewed subtitles, final visual review and
verified YouTube publication remain required. The production host check result
must be reported separately from source and test completion.

## Verified production-host result

- Source/adapter PRs: #472 (`625a0c4`) and #473 (`0b74eda`).
- First host attempt: run `42698040569`, job `129435142667`. All 221 files
  passed hash verification; FFmpeg failed to locate `libpulsecommon-16.1.so`.
  The fix passes the verified private library directory to media child processes.
- Successful host execution: run `42699755587`, job `129441124881`, completed
  2026-11-09 21:17 UTC (2026-11-10 06:17 KST), N80 Auto exit code 0.
- 221 files / 269,324,013 bytes verified. 215 unchanged libraries/fonts were
  reused with individual hash checks and hard links; old executable paths were
  never reused.
- Actual host output: 1080×1920, 1.5 seconds, 116,623 bytes. Full decode,
  crossfade pixels and visible Korean subtitle pixels passed.
- Output SHA-256: `417f5be6432bf45f792b364e76add622da4b1498954b731f6a76dfe3cff5ee80`.
- Activated bundle: `8a67dc2a0abbc8a09fdfb21c3c138743c51ddd32d8355c238ed34c7cd34047c4`.
- Package manifest SHA-256: `b929756e65c48996d69176d1965da23da585e700fc836ef8559013e7f0b78483`.
- Private pointer: `/hosting/noastudio/noa-ai-lab/host-runtime/media-runtime-current.json`.
  State is `host_media_verified`; `authenticatedBrowser` and
  `productionMovieVerified` remain false. The private fixture was removed.

The current production task `8491b2cebbdb452ac654d152f3455685` (우물에 빠진 달빛,
source revision 5) remains paused with its 49-second / seven-scene plan.
The last task read still showed zero accepted images, zero accepted videos,
zero final outputs and subtitles requiring timing/voice review. No production
review, Gemini/Flow generation or YouTube publication was performed by this
runtime installation. Browser `/proc` availability, accepted source clips,
subtitle timing review and final publication verification remain open.
