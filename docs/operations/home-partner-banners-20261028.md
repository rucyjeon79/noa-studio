# Shared catalogue rows and home partner links — 2026-10-28

Request: fix uneven catalogue spacing, insert three home banners, and continue Toss card/KakaoPay integration.

## Implementation

- Audio and video use one 20px title + 44px control grid. Completed cards are 82px high, with identical artwork insets. Video dividers have no extra inter-row gutter; premium cards retain an 8px gutter.
- Title/reaction separation is 8px. Native play/download actions remain visible, with 44px touch targets; the overflow symbol is an SVG with a matching baseline.
- Banner insertion order: notices → goods; NOA WORLD → YouTube; collections → AMT. Banners share dimensions and reserved description space. Links use new windows with noopener/noreferrer. YouTube uses the subscription-intent query; final subscription remains a YouTube user action and its prompt depends on that client.
- Toss setup reports seven local configuration checks, and explicitly distinguishes saved configuration from a successful provider payment. No merchant keys are embedded, emitted in diagnostics, or activated by deployment.

## Validation and rollout

PR: https://github.com/rucyjeon79/noa-studio/pull/254
Candidate: ef2d9cc4034b59ea6c7bfae31efdc5b1bf5ba1c2

Merge: 96d787f440c8fa1ae45b050f12b8a5e5ec18cfd2

- Final candidate rhythm/UI proof: https://github.com/rucyjeon79/noa-studio/actions/runs/40648739365 (104 browser contexts: rhythm 48, voice 32, alignment 8, monthly 8, premium 8).
- Final candidate checkout proof: https://github.com/rucyjeon79/noa-studio/actions/runs/40648739419 (8 additional Chromium/WebKit contexts plus PHP/MySQL/HTTP approval, idempotency, rollback and cancellation tests).
- Existing feature gates, real audio play, native access/SQL invariants: https://github.com/rucyjeon79/noa-studio/actions/runs/40648739382 — passed. HOME preservation guard now permits only the requested banner renderer and three explicit calls, with exact destination checks.
- Main payment release: https://github.com/rucyjeon79/noa-studio/actions/runs/40649420765 — passed. Deployment job 122686379036 changed only toss-config.php, noa-points.css and noa-payment-settings.php; 16 protected sources unchanged, zero database writes/point debits.
- Main shared UI release: https://github.com/rucyjeon79/noa-studio/actions/runs/40649420870 — verify and deployment passed. Deployment job 122688291403 completed source guards and public asset checks.

Visual inspection covered compact video/audio rows, premium cards, all three banners, both material themes, and 320/390/1280 viewport checks. The final AMT/banner screenshots wait for the transient greeting to close. Legacy public-data-only UI extractors still fail before rendering authenticated catalogues; their failures do not justify weakening catalogue permissions. The isolated real-renderer suites exercise authenticated controls.

## Remaining merchant action

The public payment status before rollout was ready=false, mode=disabled. A highest administrator must securely register the merchant MID, matching API individual client/secret keys and webhook security key at /noa-payment-settings.php. Card and KakaoPay must each be verified with the merchant test keys before live credentials and approved point-pack sales are enabled. Isolated mock tests do not constitute merchant sandbox or live approval. No production point writes or real payments were performed in this UI rollout.

## Public post-deploy verification

All five fetched asset hashes match merged source: noa-ui.css, noa-browse.js, noa-engagement.js, noa-engagement.css and noa-points.css. The live root page contains all three exact destinations. Browser DOM verification confirmed notices/goods, world/YouTube, collections/AMT order and equal rendered dimensions (1076 × 170 in the verification desktop). The merchant endpoint still reports ready=false, mode=disabled. Guest access to payment settings remains HTTP 403. This verifies deployment, not a merchant payment.
