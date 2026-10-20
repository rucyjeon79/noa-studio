# Music SQL integration — 2026-10-20

Priority continuation of the already deployed OpenAI/FFmpeg/video lab. No preview host. Existing player, user data, GnuBoard, source JSON and archived source bytes remain intact.

## Evidence collected

Authenticated production `/noa-bridge/source-audit.php`: all 731 archived files verify; all 653 original music documents match the repository snapshot. Those documents are 520 EP songs, 81 story/cover songs, and 52 ACT playlists across 15 genres. Existing nonempty fields: lyrics601, Suno491, YouTube415, thumbnail54. Public catalog remains287.

The connected GitHub installation exposes one relevant repository, `rucyjeon79/noa-studio`, main. Inventory includes three independent JSON roots (current, backup, deploy copy), plus 40 original-source JSONs in `src/data/originals`. These produce 2,119 source occurrences and 733 unique byte contents. `src/data/encyclopedia.json` contains no music records; private settings are not sent to the music catalog.

All 52 ACT tracklists explicitly name 10 ordered EP references. They are parsed as order evidence, not guessed from ACT numbers. Incomplete but identifiable EP references create retained song records. Genre/language/version separates different recordings; unknown version is recorded as unspecified. Existing document keys remain aliases.

## Important collection limit

The old Grok app remains reachable at `https://noa-studio.grok.me/`. Its source skips SQL single/story/playlist rows in `pullEncyclopedia` before merging them into the UI. Other read paths may repair files or drop stale SQL fields, so those are not used for bulk recovery. There is no raw PostgreSQL export in the visible existing UI.

Both tracked PGlite databases were copied with `git archive` before opening. Empty PostgreSQL directories omitted by Git were recreated only in the disposable copies. PGlite 0.5.4 and the lockfile's 0.5.8 both reject the checkpoint at `0/1D392A8` with an invalid WAL prev-link. Original binary files are unchanged. No reset-WAL, destructive repair, or invented recovery count is used. Additional SQL-only live Grok rows cannot be counted or claimed migrated until an intact database or authorized raw export is available.

## Implementation

`noa_catalog_*` tables separate sources, immutable import batches, stable song identities, ACT identities, playlists, versioned resolved fields, legacy aliases, ordered track variants and field conflicts. Original bytes have SHA-256 evidence and are retained. Current MySQL documents, archived music files, recognized older SQL tables and private user playlists are collected server-side. Private playlist owners retain their access scope.

Field merge keeps complementary nonempty values. Conflicting nonempty values stay in alternatives, with no canonical value selected. Track order variants are preserved and flagged for review. Playlist display labels remain ordered membership evidence; they are not promoted over an existing song title. Title alone is not used to merge unrelated songs. Identity uses genre/language/version plus EP, explicit ID or preserved source path; repeated runs use the same source and batch identities.

Preparation reads and verifies all source checksums and writes a private review snapshot. Registration uses bounded stages and parameterized writes only to `noa_catalog_*`. No existing `g5_*`, `noa_documents`, history, source archive or user-playlist row is updated. A source fingerprint prevents applying stale analysis. Counts, field hashes, raw source SHA-256 and every ordered membership are checked before the batch becomes visible. Partial batches remain hidden; repeating the same completed import returns its existing batch.

Public `/noa-catalog.php` displays only records already verified public by the existing production catalog, and the signed-in user's private playlists. Super-administrators see all retained songs and pending fields. `/noa-catalog-admin.php` provides extraction, counts, registration and conflict evidence. Existing music playback remains available independently.

CI validates actual MySQL 8 import and repeatability, member/document preservation, conflicting lyrics, partial records, genre/language separation, all 601 known songs and all 520 ordered ACT memberships. Authenticated production execution and resulting counts are recorded after deployment, never inferred from unit fixtures.
