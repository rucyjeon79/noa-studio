# AInoa personal activity notifications — 2026-10-27

The requested behavior is an owner-scoped inbox and opt-in Web Push for personal activity. Existing post, comment, member, music and ranking writers are unchanged.

## Recipient and privacy rules

- A new like or comment goes to the stored post/document owner. Official legacy catalog and channel records without a creator use the site's configured administrator account.
- New flat comments notify previous active participants as thread activity. Native GnuBoard comment/post replies use the actual parent reply path.
- Private song-request answers notify only the request owner after the configured administrator replies. Titles, names, post contents and private answers never enter push payloads.
- Self-activity is excluded. Public targets are checked at collection and dispatch; separately certified/group/secret boards fail closed. Deleted comments, revoked likes, unavailable posts, withdrawn/blocked members, disabled categories and superseded device registrations are checked before delivery.
- Only the authenticated account can view or mark its inbox, update preferences, register devices or request a self-test. Writes require same-origin JSON and a session CSRF token. Guests get HTTP 401; the frontend also handles the host's HTML error replacement.

## Durable delivery

Five new InnoDB tables store inbox events, preferences, push subscriptions, delivery leases and source cursors. Installation starts at the current source maxima, with bounded cursor overlap thereafter; it never floods members with historical activity. Recipient/event uniqueness deduplicates native/app likes and collector replay. Existing native and engagement tables are read only.

Push registration happens only after an explicit button click and browser consent. Device ownership has a generation token; transfer, revocation and renewal cancel previous queued leases. Expired providers (404/410) deactivate only the matching generation. Failed sends retry with backoff, capped at eight attempts. Provider acceptance and browser `showNotification()` receipts are separate fields; neither a successful deployment nor provider acceptance is described as a physical phone test.

The scheduled workflow runs at five-minute intervals, subject to GitHub scheduling and device/provider delays. A bounded inbox collector also updates the open inbox. Delivery uses pywebpush 2.4.0, real VAPID ES256 signing and aes128gcm payload encryption. HTTPS push endpoints are allowlisted and redirects refused. The HMAC worker uses expiring timestamps and one-time nonces. Credentials and endpoints are not included in logs/artifacts.

The stable VAPID key and worker token are created exclusively at `/hosting/noastudio/noa-notifications-private/config.json`, outside the web root, with mode 0600. Redeployment does not rotate keys. Public source rollback preserves that identity and additive data. The existing source-hash and protected-file checks govern deployment.

Inbox history expires after 90 days; inactive subscriptions after 30 days. Signing out through the site's logout link detaches the current browser subscription. Account withdrawal or blocking stops dispatch.

## Device support and UI

AInoa's panel contains **내 활동 알림**, with unread counts on the panel and launcher. The dedicated `/noa-notifications.php` page provides device opt-in/out, category preferences, mark-read, pagination, a self-test and all-device revocation. Dark/light themes and 390/1280-pixel layouts use existing NOA design tokens and 44-pixel controls.

Android Chrome and supported installed web apps use the existing root service worker. iPhone users add the site to the home screen from Safari. The current native Android WebView APK is not silently represented as Web Push capable: its notification page directs members to Chrome for push registration; its in-app inbox remains available. No native binary or unrelated Android PR is changed.

## Validation and release evidence

- Isolated MySQL: additive/replayed installation, baseline cursors, recipient derivation, private answers, self-exclusion, deletion, preference enforcement, leases, transfer/revocation, expired devices and cross-account read denial.
- Actual HTTP APIs: CSRF/origin/session enforcement, account isolation, endpoint validation, signed worker/nonce replay, provider acknowledgement and browser receipt.
- Real crypto with an in-memory transport: decrypt the emitted aes128gcm body with the recipient private key; verify the ES256 VAPID signature and audience. No external device is messaged by tests.
- Service worker: notification display, receipt payload, safe same-origin click target and malformed payload fallback.
- Browser: explicit-permission gesture, registration/revocation UI, preference persistence, AInoa navigation, mobile/desktop screenshots and host HTML 401 recovery. Browser capability adapters are explicitly test fixtures, not proof of physical phone delivery.

Deployment/run identifiers and final evidence are appended after verification. Production verification creates no fixture members or synthetic comments/notifications.
