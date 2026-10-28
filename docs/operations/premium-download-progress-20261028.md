# Premium downloads and in-card mastering — 2026-10-28

PR #248 implements the user's vertical-spacing correction, premium badges, member downloads for 1,000P with 500P to the song owner, creator monthly pricing at 5,000P and progress within the corresponding song card.

## Delivered behavior

- Song title and reaction icons are 4px apart vertically in the verified Chrome/WebKit cases. 44px touch targets remain. Home/world reaction footers also remove excess top spacing.
- Verified uploaded audio receives a small gold diamond/PREMIUM badge.
- Logged-in members can browse music and explicitly confirm a 1,000P download. Existing administrator downloads remain free; streaming entitlement is preserved.
- Explicit document ownership is used first, then matching verified upload provenance. Missing ownership prevents payment. Debit, owner credit and an immutable file receipt share one native InnoDB transaction.
- Request replay and file/range retry do not charge twice. Insufficient funds, changed audio, failed owner credit, private songs and another account's receipt are rejected appropriately.
- The existing creator points plan is 5,000P per calendar month. The VIP plan is unchanged.
- Upload percentages come from actual transfer. Mastering shows server analysis/correction/verification stages, measured before/after LUFS and true peak, and applied gain. No fabricated waveform or processing percentage is shown. The bottom player remains visible.

## Verification

Current PR head 7dae0c0b6557655bf3b1ba6da1cf25e9d85e3714 passed premium run 40621234830, subscription purchase run 40621234771 and creator UI run 40621234729. Main runtime 53c542e28c98727d3e3e4a122c23269f25c2ed3c passed the same premium suite and existing integrated engine/playback quality gate 40621761261.

Isolated native MySQL tests cover exact debit/credit, replay, receipt binding, insufficient funds, audio changes, missing owner, rollback and unsafe storage. Concurrent PHP requests verify no overdraft and exact-once intent handling. Actual HTTP confirmation and generated MP3 delivery cover CSRF, private visibility, redirects, whole-file and range responses without extra payment.

Actual shared UI modules passed 8 premium Chrome/WebKit cases across 320/390/1280 widths and both themes, plus 48 layout/discovery and 32 voice/access cases. All premium cases measured exactly 4px title-to-reaction spacing, progress inside the song card, visible player and no horizontal overflow. Dark mobile and light desktop processing/completed screenshots were inspected. Processing values were isolated fixtures; production songs were not reprocessed for QA.

Legacy anonymous-content smoke jobs still assume private music/world content in guest responses. The unrelated member release's live hero probe failed constructing a URL and restored its own source snapshot before this premium deployment. No test/authentication bypass was introduced.

## Production

[Successful deployment, attempt 2](https://github.com/rucyjeon79/noa-studio/actions/runs/40621761983), job 122599214573, completed after the first pending deployment was cancelled in the shared production queue. Only deployment was re-run; successful verification was retained.

All source bytes were read back; public JS/CSS hashes matched. A separate post-deploy HTTP check confirmed the premium JS, reaction CSS and voice JS return 200 with current bytes. The browser environment disconnected during the final production reload, so a fresh post-deployment screenshot was not obtained. Authenticated behavior is established by isolated role-aware fixtures and identical deployed source, not a production account login.

The production policy audit confirmed 20 ready public assets, 20 resolved owner accounts and zero unresolved owners. No member balances were changed by deployment.

### Policy receipt

```json
{
  "ok": true,
  "creatorMonthlyPoints": 5000,
  "period": "calendar-month",
  "policyRevision": 3,
  "policyChanged": true,
  "vipPreserved": true,
  "downloadPoints": 1000,
  "ownerSharePoints": 500,
  "nativePointsReady": true,
  "catalog": {
    "ready": 20,
    "ownerResolved": 20,
    "ownerUnresolved": 0
  },
  "memberRowsChanged": 0,
  "pointDebits": 0
}
```

### Source receipt

```json
{
  "commit": "53c542e28c98727d3e3e4a122c23269f25c2ed3c",
  "changed": [
    "noa-bridge/music-download-core.php",
    "noa-music-download.php",
    "noa-premium.js",
    "noa-app/jukebox/download.php",
    "noa-app/jukebox/upload.js",
    "noa-app/jukebox/index.php",
    "noa-music.php",
    "noa-creator.php",
    "noa-creator.js",
    "noa-ui.js",
    "noa-voice.js"
  ],
  "sha256": {
    "noa-bridge/music-download-core.php": "8feecc0c11b901f224726b5f315f910e7ade056968fdcfbdf58f197530765d5f",
    "noa-music-download.php": "f722a7d784881cc81949799f62d5f10ad02d96dc705abdc37e1bd6c7f98b6a31",
    "noa-premium.js": "c87b9999ad5aad2cefe1eff630908108a5f1769950ef174a9e3fc2b3ea802044",
    "noa-app/jukebox/upload.css": "41e151a6042f383c082113e3aea2c1e519866010dc06816f21b357d0281aada0",
    "noa-engagement.css": "bab964ed8042d9d8d8f6429e14bffb07cacfbee4238c3bfb921603fd89b4dfc3",
    "noa-app/jukebox/download.php": "d26ff60cfe30db07aa0437f55fa28da9cc8e44c946f44c83b8127f16a2a41785",
    "noa-app/jukebox/upload.js": "48bcea1e96136452023be575419aace8e6a2dea9b02203cbf0c1a04fea21dc88",
    "noa-app/jukebox/index.php": "f0b079926190b9382a7fb94fc4eb8707a3cc4dea3a35bb8b4e257c7a28249203",
    "noa-music.php": "0e444d1117fa226eb342b2aee9dd50c285aad82739ffc01fd8329f912d8be1b5",
    "noa-creator.php": "0f13b6a6afd9787b02389a2af3b8e1780189484c72a9f752d1bb052a82ee77d4",
    "noa-creator.js": "9b1d11b3f27a1bba57fd07dd79eb639f8619f563d55858b0bdd77886bddef68c",
    "noa-ui.js": "5a669d3e6d918c309da4c118f5444aeb523187be997d7598319d7e4855e4e174",
    "noa-voice.js": "51163e3bf83d51d560cab60a624b315bb049ea9a7720739c58baa77c60c6eec9",
    "noa-subscription.js": "faa93257af16673d8e5b5a868372a26d3e76d8dcef51e8b62feaade24af5c024",
    "noa-sitemap.php": "1ae52b69c285a1d9b650f41b4e502abfd0a83299abc96ce3a5b0f95852f78fb8",
    "noa-bridge/member-access.php": "6764ec693f3f7bad140ab7a6181a4f7d81adf8dc45252d7af00601c152bc7e48"
  },
  "protectedUnchanged": 16,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "pricesSeeded": false
}
```
