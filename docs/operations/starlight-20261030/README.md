# Starlight — 2026-10-30

User requested one dark site-wide design based on the JR company pages, and a music-first WORLD without repeated character biographies.

- The sole public palette is `noa-studio` / Starlight. Early CSS works before JavaScript. Removed the retired ivory option and visible theme/radius pickers. Local and account legacy selections are normalized on read; language persists. No preference records are migrated or rewritten by this release.
- Shared app, native community, authentication forms and admin surfaces use charcoal, warm white, restrained champagne, flatter controls and editorial spacing. Status colors retain their meaning. Existing player, upload, queue, permissions and membership contracts are preserved.
- WORLD now has a four-ACT table of contents, real official MV images, ACT reading introductions, ten EP chapters per ACT, forty distinct listening notes and previous/next reading links. Canonical saved prologue/chapter/epilogue text takes priority. Reading notes are explicitly editorial guides, never saved as canonical catalog fields. Character introductions link to About.
- Homepage WORLD entrance uses the already published piano/ocean image. No additional generated characters or remote assets.
- Dedicated checks validate account/local retired-theme fallback, contrast, canonical story priority, escaped titles, chapter anchors and single-player structure, plus existing world visibility, ACT membership, home and player regression tests.
- Deployment reuses the established pinned-host SFTP runner with source-preimage guards, exact hash readback, protected-file checks and conditional rollback. No database writes.
- Public production pages can be visually checked anonymously. WORLD/music/member UI may require a member session; report any missing live-session validation separately from fixture tests.
