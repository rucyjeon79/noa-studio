# Upload completion and optimization

A new authorized upload reserves the source and asks the production JUKEBOX workflow to start while bytes are in transit. The final accepted chunk schedules server-side finalization for both hosting and Drive uploads. The browser may still send an explicit finish. Both paths lock the same upload, verify the complete source and enqueue the same SQL job exactly once. Manual retries also request the worker after committing. Only a worker holding the queue lease can report that analysis has started.

The upload hook dispatches one fixed GitHub workflow on main. It first uses the private 0600 upload-wake-token installed from the production environment secret NOA_JUKEBOX_WAKE_TOKEN. In its absence the hook can use the site's existing server-side Actions credential if GitHub grants that credential access to this repository. A rejected request leaves the source and queue intact. The private wake receipt contains only time, acceptance and the HTTP status. Scheduled workers remain available for recovery.

For a dedicated credential, restrict a fine-grained token to rucyjeon79/noa-studio with Actions write. Set the production environment secret NOA_JUKEBOX_WAKE_TOKEN and run the NOA upload completion wake verification workflow on main. Never use a workflow's temporary GITHUB_TOKEN as a hosted credential.

The release submits a synthetic WAV to a private QA song using the normal upload functions and deliberately omits the browser's finish call. It checks the stored source hash, real worker run, queue timestamps, verified final MP3 and decode analysis. A rejected dispatch fails acceptance even when a scheduled worker later drains the queue. A cold GitHub runner may take time to start, and busy workers preserve FIFO.
