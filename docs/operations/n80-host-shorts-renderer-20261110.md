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
