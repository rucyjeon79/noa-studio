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
