# NOA STUDIO 2.0 — N80 unified modernization

## Scope
One integrated release for app UI/UX, JUKEBOX, MUSIC, MY PLAYLIST, YouTube, NOA WORLD, members, data, automation, Guardian and maintenance. Existing features and data remain in place.

## Repository baseline (2026-10-23)
- 5,581 tracked tree entries; 15 CSS, 24 JS, 210 PHP files and 94 GitHub workflows.
- App-owned CSS includes `p0-media.css`, `jukebox/upload.css`, `database/style.css`, `taxonomy/style.css`.
- JUKEBOX upload CSS hardcodes gold-colored buttons and controls instead of consistently consuming shared theme tokens.
- N80 already has an integrated release for core engine modules. Some legacy feature-specific workflows remain and must be inventoried before consolidation.
- N80 actual autonomous dispatch and durable business-effect ACK remain disabled; source hash checks do not prove business workflow completion.

## Non-negotiable architecture
- Root `index.php` is the app entry point; Gnuboard is a lower-level member/board provider.
- Keep app source separated from Gnuboard core.
- One design token source, one shared component layer, and scoped feature-specific CSS only for genuinely different behavior.
- One N80 Bridge contract and one orchestrated release. Preserve legacy aliases until equivalent regression tests pass.
- Chat Assistant and Guardian are peers; user-approved decisions are the architecture reference subject to authorization and data integrity.
- Never discard or reset existing MP3, artwork, playlists, members, MySQL records, JUKEBOX FIFO, FFmpeg jobs or other teams' edits.

## Integrated implementation order
1. Inventory page entry points, CSS/JS loading, server route dependencies, DB tables and active workflows.
2. Map and preserve each existing component; identify duplicated selectors, handlers, SQL queries and automation jobs.
3. Extract shared design tokens and reusable controls; keep JUKEBOX upload/dialog-specific rules scoped. Test dark/light, button shapes, mobile layout and accessibility.
4. Normalize module interfaces to N80 contracts without replacing running queues.
5. Wire real authenticated event source and durable consumers, with a tested transactional outbox, idempotent ACK, recovery, kill switch and Guardian telemetry.
6. Run static, unit, integration, browser, mobile and production smoke checks. Use canary and rollback before live dispatch.
7. Release all verified changes through the single production pipeline, then compare remote hashes and real feature outcomes.

## Release acceptance
Do not call the modernization complete until public root, JUKEBOX, MUSIC, MY PLAYLIST, YouTube, NOA WORLD, login, database views, responsive design, and engine/Guardian operational receipts have been verified on the production domain. Report pass/fail per subsystem.
