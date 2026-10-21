# Work_디자인 UI recovery · 2026-10-22

Continue production `54f1adb`, preserving all existing worktrees and original uncommitted changes. This is an implementation recovery, not a restart.

## Observed cause and evidence

Read-only production inventory run `39687517312`, artifact `12387112918`, found all 19 inspected UI PHP/CSS/JS/JSON sources byte-identical to `54f1adb`. No server mutation, SQL operation or worker interruption occurred. Unshipped code or stale cache was not the cause for these inspected files.

- `deploy/noa-app/world-view.php` still rendered plain character-sheet, linked-song, MV description and community actions. Shared `decorate()` only opted selected controls into icon presentation. Live DOM reproduced underlined links without SVG icons.
- `deploy/noa-music.php` still rendered taxonomy selectors and a second search/type/genre filter block, loaded `noa-taxonomy-browse.js`, and attached filter listeners. Previous UI acceptance checked broad overflow and playback, not removal of these controls.
- `deploy/noa-app/home.php` still rendered a hero toggle. `deploy/noa-hero.js`, its unit tests and the visual gate explicitly required the toggle and manual replay. An older active production-flow script even required loop=true and removed category controls. Those acceptance contracts were obsolete.
- The automatic plan made a three-column ten-card layout use a two-track-wide first card plus nine others, leaving one third of the first row empty. Container-based balanced two-column rows now take precedence in that case.
- No YouTube iframe, YouTube card or thumbnail was reproduced in the observed public sound page. Sound rows already use empty video IDs. The new sound-navigation filter rejects video-shaped records defensively; preserve existing source relationships and do not claim a reproduced data corruption.

- Additional live computed-style evidence: `.noa-page .noa-browse-card` used a fixed portrait ratio with an absolutely positioned image. Desktop cards measured about 520×650px, with text sharing the image area. This legacy rule affected both music collections and YouTube collections; common intrinsic 16:9 media/copy rows replace it and are now measured by the DOM gate.

## Scoped implementation

Shared `noa-ui.js` enhances text actions in main content using the existing SVG icon registry, retaining nodes, links, native summary semantics and handlers. Full card links, native navigation, footer legal links and marked document references are excluded. Translation attributes transfer onto the label node so language changes do not erase icons. New simple action links receive the same component.

Music edits remove only search markup, its script/listeners and obsolete filter branches. A small in-memory compatibility state preserves the existing personal-playlist and ACT player integration. The database/permission prefix, requestPlayback/queue and select/move/upload-event blocks retain their production SHA-256 hashes in `tests/uiux/music-processing-contract.json`. No source under `deploy/noa-app/jukebox`, bridge/SQL or music-worker scripts is changed. Existing source controls preserve owner permissions. Shared sound status rendering uses actual provided status and audio availability; it never creates audio paths or queue state.

Hero source has no control node or control dependency. One muted playsInline automatic attempt, no loop, no reorientation/visibility/reduced-motion replay. Rejection and reduced motion retain the matching original poster. End leaves the final video frame visible. Contain preserves the foreground performer; the same already-selected poster forms a quiet background behind portrait letterboxing without blur or another media request. Media and copy share their container edges.

Cards use measured host width. Ten cards use 5+5 where readable or two columns; features are allowed in compact two-column groups only, avoiding a large vacant third track. Existing data order and IDs are unchanged. Actual bottom-navigation and player heights are observed and reserved, including safe-area height already reflected in the navigation box.

## Acceptance and ownership limits

`noa-recovery.mjs` checks both themes and nine portrait/landscape/desktop sizes on public routes, with additional isolated member/admin music templates. It verifies absent DOM/scripts, audio/video separation, no false MP3 play icon, action SVG/label/touch semantics, shared edges and final-control hit testing. Existing glass/card/media/player regression gates remain. Former production-flow checks delegate to the current shared gate.

Authenticated templates are not authenticated production transactions. Do not claim upload, download, member writes, physical-device or Safari operations as passed unless actually exercised. Candidate fixtures never submit upload/download/SQL writes or run owner processing scripts. Guarded SFTP compares production bytes, privately verifies backup and protects processing sources; rollback requires current bytes to remain release-owned. Final acceptance requires successful production live gates and direct public UI checks, not the audit/PR alone.
