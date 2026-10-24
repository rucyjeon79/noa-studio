# N80 whole-app data contract

The authenticated `app-observe.php` endpoint is the single aggregate data contract for MUSIC, JUKEBOX, playlists, YouTube, WORLD, taxonomy, rankings, members, settings, community, AI LAB and database inventory. Its `moduleLinks` maps these stores to the nine existing N80 registry modules without replacing the legacy services.

It counts every base table in the current app database, validates supported parent/child references and JSON payloads, checks all personal playlist track references, and verifies every registered audio/card file by size and SHA-256. Source keys resolve both existing document IDs and current applied `catalog:` recovery editions. No titles, lyrics, usernames, member records, tokens, prompts or SQL contents appear in the report. AI state is reduced to counts and enable flags without decryption or state writes.

All database observations run in a MySQL READ ONLY repeatable-read transaction. Missing schema, unreadable tables and unresolved data are explicit findings. Historical QA assets remain protected. Unavailable/private YouTube media are not automatically deleted or fabricated. Public route checks include protected guest access and bounded real audio/image reads.

The MUSIC adapter now supports recovered catalog keys and the actual 191-byte document key limit. The exact previous 1,148-byte production source (SHA-256 `95a49f20c81aa0cc36c47d21584522419da9490c9bfc1c3687cb1ddc39cf5f2d`) is preserved and re-downloaded from the existing Google Drive deployment folder; receipt: `scripts/n80_music_adapter_drive_receipt.json`. The installer validates that preimage with PHP lint on the runner and refuses unknown concurrent edits. Only this small internal observer library is replaced at its final path while the shared Actions observer/deployment group is held. A failed partial write restores the verified preimage. No hosting backup or staging file is used. The two aggregate runtime files are additive.

Commits marked `[n80-data]` route this repair through the integrated installer and skip the legacy facade installer, which otherwise creates hosting staging files. Existing worker runs are never canceled.

The complete integration runs at minute 19 every hour; the ten-minute bounded observer continues separately. Disable new checks with repository variable `N80_OBSERVER_ENABLED=false`. Neither workflow enables business-event dispatch or durable business ACKs.

## Known independent worker findings

The last AI LAB worker and hourly popularity jobs failed DNS resolution before authentication. Their workflow bindings use the legacy `NOA_FTP_*` secrets, while the verified N80 connection uses `NOA_SSH_*`. Existing workers also create hosting nonce/output intermediate files. They are not silently restarted or declared healthy by this read-only data integration. Their processing/storage migration remains separate from the verified aggregate contract; ongoing uploads and jobs remain untouched.
