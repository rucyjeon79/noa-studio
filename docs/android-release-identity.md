# Permanent Android release identity

Created 2026-10-29 with user authorization to replace the temporary debug signing process. Public certificate SHA-256: f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b.

Private vault: /hosting/noastudio/noa-android-signing-v1 (outside web root, directory 0700, files 0600). Existing pinned SSH credentials authorize access; no new credential is committed or logged. The key is created once, never replaced by retries. Existing incomplete or mismatching vaults stop the workflow.

Recovery artifact uses AES-256-GCM with scrypt (N=131072, r=8, p=1), a 16-byte salt and 12-byte nonce. Binary format: ASCII NOA-ANDROID-KEY-V1 plus newline, salt, nonce, ciphertext/tag. AAD: NOA-ANDROID-SIGNING-BACKUP-V1. Recovery needs the SSH password in effect when that backup was made. The artifact has 90-day retention: preserve an encrypted copy externally and refresh backup before credential rotation or expiry. The private server vault is the persistent primary copy.

Run 40809395406 created and verified the vault and encrypted backup. Run 40809591225 reused it to sign non-debuggable release APK and AAB, version 100001. Certificate, package and file hashes were verified. These artifacts are candidates, not published production downloads.

The signed-release workflow runs on native-source main pushes and manual dispatch. It does not replace production build 13 or publish to Play. Build 13 uses a different debug signing identity and cannot receive an in-place upgrade signed by this new key. Plan the user-data transition before advertising the first release. Later direct APK updates must retain this identity. When enrolling in Play App Signing, explicitly choose the app signing identity and distinguish it from the upload key; do not assume Play automatically uses this key.

Native playback HTTP 403 and n80 deployment remain tracked separately in PR #276. Do not bypass device tests or claim signing success is production publication.
