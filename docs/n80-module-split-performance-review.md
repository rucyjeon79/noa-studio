# N80 ENGINE — Module workload separation review (2026-10-23)

## Measured baseline
CI-only 1,000 samples; p95: validate 0.014838ms, route 0.016892ms, plan 0.018254ms, gate 0.018785ms. These are nested in-process functions, **not** end-to-end production timings and cannot establish bottlenecks.

## Existing module inspection
- JUKEBOX `queue-core.php`: 12 functions; transaction and locking operations present. Candidate for *instrumentation of claim/recovery/position phases*, not an immediate split. Keep FIFO, upload leases, and FFmpeg worker ownership intact.
- AI LAB `lab-worker.php`: separate worker source already exists; measure external inference wait, local processing and persistence separately before further subdivision.
- YouTube `youtube-core.php`: core functions already separated from store/API files. Measure API rate limits, sync time and DB persistence independently.
- Popularity `popularity-worker.php`: separate worker exists. Measure aggregation and storage independently.
- N80 validate/route/plan/gate: p95 under 0.02ms in CI; **do not split** these tiny functions into network services.

## Split decision
Split only if a measured phase repeatedly dominates end-to-end p95, competes for different resources, and can be isolated without breaking ordering or transaction guarantees. First prefer extracting pure code into shared functions, batching reads, reducing redundant queries, or separating worker concurrency pools. Never parallelize JUKEBOX FIFO or duplicate audio jobs.

## Required next measurements
Instrument queue_wait_ms, claim_lock_ms, transform_ms, persist_ms, external_api_ms, retry_count, queue_depth, failure_rate, and per-module p50/p95/p99 under real load. Store aggregated telemetry without user content, tokens or credentials.

## Deployment policy
This review changes no production worker behavior. A split requires a baseline, rollback plan, idempotency tests, FIFO proof and verified production improvement.
