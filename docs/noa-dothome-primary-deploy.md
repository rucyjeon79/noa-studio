# NOA STUDIO — DotHome-primary deployment architecture (phase 1)

## Authority and data flow
- **DotHome is the sole production authority**: deployed file hashes, applied release ID, and rollback status are recorded on the host, not inferred from a GitHub merge.
- **GitHub is a version-history/backup mirror**; publishing a commit does not itself constitute production deployment.
- The ChatGPT developer produces a versioned release package. A separate, authenticated transfer channel stages that package **outside the web root**. The host-side installer validates and activates it. This chat cannot claim unattended delivery until that channel and its credentials are provisioned and tested.
- Production entry remains /index.php. GnuBoard is subordinate and its core files are excluded.

## Protected host paths
- Web root: /hosting/noastudio/html
- Private state: /hosting/noastudio/noa-deploy-private/current-release.json (never web-accessible)
- Private staged packages and rollback backups: outside /html
- Never overwrite member data, SQL, MP3, upload queue, FIFO, FFmpeg work, or Android APK.

## Phase 1 (this PR)
- /noa-deploy-status.php is a **read-only**, super-admin-only JSON endpoint.
- It reads a fixed private status path, with a bounded read and fixed output fields.
- It has no file-upload, URL-fetch, shell execution, deployment activation or credentials.
- It explicitly reports deployment_available=false until an installer is operational.
- No changes to the existing production deploy workflows. Do not disable a working fallback before replacement is proven.

## Phase 2 (requires host capability verification)
1. Confirm DotHome supports a secure CLI/cron or external authenticated SFTP installer, and identify private writable paths and quota.
2. Build a signed, allowlisted release manifest with exact relative paths, SHA-256, expected previous SHA-256, and immutable release ID.
3. Stage files privately, validate signature and hashes, reject symlinks/path traversal, and take recoverable backups.
4. Lock release activation, compare current hashes immediately before each atomic replacement, and conditionally rollback.
5. Postflight verify home, MUSIC, JUKEBOX, YouTube, MY PLAYLIST and administrative authentication without mutating user data.
6. Atomically write the private current-release.json only after successful verification; expose status to super-admin.
7. Only after live validation, retire GitHub as a deploy executor while retaining it for history and backup.

## Acceptance
- No manual Work handoff; delivery is performed through an independently verified host-side path.
- No deployment on source commit alone; host state is the source of truth.
- Failed staging, signature verification, disk quota, hash conflict or postflight causes fail-closed handling.
- Existing active music-processing jobs remain undisturbed.
