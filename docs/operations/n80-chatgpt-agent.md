# N80 AI — ChatGPT commander

The existing ChatGPT subscription worker is the brain. N80 owns its permitted
tools and durable execution state. This release upgrades the currently authorized
song-field, multi-field, creative-analysis, creative-generation and revision jobs.
It does not add another cron, worker queue, engine, API account or UI menu.

## Execution

1. The existing song worker claims one job. N80 returns an opaque execution lease.
2. ChatGPT reads current accepted inputs and chooses a concise plan and candidate.
3. N80 runs the same canonical output validators used for the final save. Invalid
   output becomes feedback; it does not prematurely fail the job.
4. ChatGPT examines the candidate and feedback, then chooses to revise, refresh
   source data, delegate to a registered specialist, or request a save.
5. Only a validated candidate with an unchanged source may enter the existing save
   path. An actual SQL/legacy receipt establishes completion. Creative revisions
   retain their existing user-accepted proposal workflow.

The commander can make at most six decisions within 480 seconds. The execution
lease lasts 240 seconds between engine interactions. An abandoned process may be
resumed within its original deadline; its old lease is fenced off. The plan,
candidate, decision count and observations stay in the original N80 job. Creative
checkpoints update one row without multiplying song history. Saving discards the
duplicate working candidate. Lost acknowledgements replay the same checkpoint or
save, never a new generation request.

## Specialist boundary

Direct ChatGPT work is the default. Delegation requires BOTH a server-registered
connected capability AND an explicitly installed worker adapter. Model-generated
commands, URLs and tool names cannot load adapters. The initial connected
specialist list is empty. Image/video browser operation, media retrieval and full
music-video assembly are **not connected by this release**. Nor is the general
site administration chat given arbitrary server or publishing authority.

`agent.py` is a reusable commander loop; `agent-runtime.php` owns the N80 contract,
fencing, checkpoints and validator feedback. They execute through the existing
`noa-gpt.php` transport and `creative.php` SQL owner. No public model API is used.

## Release and evidence

The N80 commander workflow exclusively activates four hosting files, preserving
preimage guards, deployment concurrency, readback and owned rollback. Existing
GPT and creative workflows do not also deploy a commit tagged `[n80-agent]`.
Activate the server before replacing the private `noa-worker.yml` consumer.
Jobs already claimed by the previous worker retain their legacy completion path.

Tests cover multi-step repair, absent/registered specialists, source identity,
budget/deadline, exact save receipts, checkpoint replay, stale lease rejection,
real PHP transport and real MySQL creative jobs. The private workflow's live
ChatGPT probe uses explicitly synthetic tools and never edits a production song;
it proves model decisions, not a live end-to-end production save.

## Verified first activation — 2026-11-08

- Application source: `9f3010db96bb1532bb91312e919ec3bef5cf6040`.
  [Commander checks and guarded production activation](https://github.com/rucyjeon79/noa-studio/actions/runs/42465163580)
  succeeded. All four operating files matched their source hashes; eleven protected
  files were unchanged. This activation made no database or point-balance writes.
- Python commander tests: ten passed. The real PHP bridge and MySQL creative job
  tests passed, including invalid-output repair, current-source rejection, lease
  fencing, idempotency and proposal persistence. The existing creative, N80
  contract (PHP 8.2/8.3) and feature quality checks also passed.
- Private consumer source: `789d904da3621a1f3f1572d23e4196e4caaec7bc`.
  [Existing subscription worker verification](https://github.com/rucyjeon79/noa-private-worker/actions/runs/42465391794)
  succeeded. Actual ChatGPT inference completed two commander decisions, one
  validation and a synthetic save acknowledgement. Production song writes: zero.
- Connected external specialists: none. Broad administrative chat and actual
  image/video service execution remain outside this first activation's scope.

## Browser media pilot and native receipt — 2026-11-08

ChatGPT operated the user's signed-in Gemini and Google Flow interfaces, retrieved
one actual generated scene, reviewed its frames and decoded file, and returned the
MP4 through the existing N80 AI LAB store. This is an observed browser-session
execution, **not an installed unattended browser adapter**. The subscription
commander's connected specialist list is still empty.

- Gemini produced a new Noa cafe starting frame (1024×572 WEBP). Flow generated
  one 16:9 clip using Veo 3.1 Lite, eight-second setting, 720p, one output, ten
  available free credits. No new subscription or paid model API was configured.
- Actual MP4: 1,959,362 bytes, H.264 1280×720 at 24 fps, AAC audio, container
  duration 7.930 seconds. SHA-256:
  `696f2aacb777c3a774d0395f7dc06a0dbfc2d7cb868e3e9059c887b3e5cea1e8`.
  Full local decoding passed. Provider watermarks were preserved. Original song
  audio has not been mixed into this clip.
- Live N80 job `e63d2285e4bab6c383de9e3cdfac2982` has type `browser_clip` and
  existing state `saved`. It is explicitly an unlinked test scene; no catalog song
  was created or replaced. Repeating the same import returned the existing job.
  Reloading preserved it. Native playback reached 7.930 seconds with readyState 4
  and no media error. The N80 download matched the Flow file hash exactly.
- `lab-browser-assets.php` receives bounded H.264 MP4 uploads under the existing
  administrator, same-origin and CSRF gates. It checks the container, dimensions,
  duration and SHA-256; it does not claim server-side decoding. Optional song
  linking reads the current SQL title and revision and rejects stale revisions.
  File bytes remain in the private existing lab job store. Native authenticated
  playback and download use `lab-file.php`; no public media URL is created.
- Application source `7b79217a5b134e69e5c72aa9bddfd9e55d405037` deployed six
  files in [run 42469358259](https://github.com/rucyjeon79/noa-studio/actions/runs/42469358259).
  Test/deployment ownership follow-up `43a054563b85e52938df401efdee7b9c4d953d3e`
  passed [run 42469673601](https://github.com/rucyjeon79/noa-studio/actions/runs/42469673601).
  The final readback found all six files unchanged and matching; eleven protected
  files were unchanged. Deployment made no database or point-balance writes.
  The later browser import added one native lab job and one private MP4.
- Targeted PHP/HTTP checks cover upload authentication, CSRF, same-origin,
  checksum, source revision, idempotent replay, tamper detection, private readback
  and range streaming. Existing feature quality checks passed in run 42469673542.
  `tests/lab/clip_fixture.b64` is a real 0.5-second 512×288 blue H.264 fixture,
  generated with FFmpeg/libx264; shared HTTP checks need no installed encoder.
  The dedicated helper check also generates a fresh FFmpeg fixture in CI.
- Other triggered checks were not all green: AInoa points verification failed
  `regular_or_creator_required` (run 42469358090); the record test fixture lacked
  `personal-listening.php` (42469358149); home render reported horizontal overflow
  (42469358134). Those results are unresolved here, not claimed as passing. The
  new shared-test FFmpeg dependency failure in 42469358206 was corrected with the
  fixed real clip fixture. `[n80-browser]` now has one deployment owner.

Remaining integration: a registered durable browser executor, current-song scene
planning and sequential generation, original-audio assembly, and full music-video
review. Mobile live interaction for the new intake has not yet been verified.
The pilot does not establish any of these as complete.
