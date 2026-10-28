# Monthly benefits and completed master cards — 2026-10-28

## Banner visual refinement — PR #250

Replaced the decorative `10×` with a filled gold badge reading “매월 첫 활동 / 포인트 10배”. At widths up to 600px the badge occupies a compact row below the heading; desktop keeps it beside the heading. Badge text contrast is at least 5.96:1 across the gold gradient. Reward amounts and eligibility are unchanged.

Runtime merge: `aa0e56b2b85b73f3220bb45a4a50ffd77a735361`. Candidate workflow [40628770778](https://github.com/rucyjeon79/noa-studio/actions/runs/40628770778) and production workflow [40629423726](https://github.com/rucyjeon79/noa-studio/actions/runs/40629423726) passed all existing monthly/native and 96 browser checks. The 320px dark and desktop light candidate captures were reviewed; a fresh public production browser reload and screenshot confirmed the visible gold badge, all four amounts and placement below the hero.

Deployment job `122623578127` changed only `noa-app/monthly-banner.php` (SHA-256 `d9e40d5a0038aa4b1f437d26b4a488d899419f5359dc4888977ba37789a91e46`). All 18 protected files were unchanged. Policy revision stayed 2 (`policyChanged: false`); no member rows changed and no points were granted. The public banner and protected direct include checks passed.

PR #249 addresses the user's screenshots: reserved title/metadata heights made ACT rows look separated, and completed masters retained a large processing table with pending measurement labels.

## Result

- ACT title-to-description and content-to-reaction gaps are 4px in the checked mobile/desktop cases. Copy uses its actual height; buttons retain 44px touch targets.
- Upload/mastering progress remains inside the relevant song while processing. On `ready`, the table is removed and the compact song card receives a restrained champagne background and premium badge. Creator rows use the same completed treatment. The player remains available.
- The home banner “매월 쏟아지는 10배의 혜택.” follows the hero and precedes native notices. It is hidden until the server policy is enabled. Membership guidance also describes the new policy.

## Point policy

| Activity | Ordinary points | First qualifying activity of each KST month |
| --- | ---: | ---: |
| Login | 100P, pending until that day's first post/comment | 1,000P immediately |
| Post | 50P | 500P |
| Comment | 30P | 300P |
| Like | 10P | 100P |

The like baseline was previously unset. An optional clarification received no response, so 10P was used and disclosed in the conversation. This is a total 10× award, not the ordinary award plus an additional 10×.

Slots are independent per member, activity and Asia/Seoul calendar month. A previously paid ordinary login reward on the activation day is topped up by 900P instead of paying 1,100P in total. Other days retain the existing pending-login activity rule. Activation applies to subsequent qualifying activity; no historical bulk awards are run.

Native point credit, balance refresh, monthly slot and event receipt share one InnoDB transaction and the existing member lock. Retries and concurrent requests cannot pay a monthly slot twice. Native deletion/refund relations remain unchanged and do not reopen the monthly slot. Likes are credited once per canonical member/target pair; unlike/re-like does not farm points. Existing pre-activation likes are not retroactively paid. The engagement endpoint still requires the existing session, CSRF and target authorization.

Creator subscription 5,000P, VIP subscription, download 1,000P / owner 500P, native authentication, audio processing workers and push delivery are preserved.

## Verification

Candidate `457c924bba4010427389db633567a34b3227a580` passed monthly workflow [40626046870](https://github.com/rucyjeon79/noa-studio/actions/runs/40626046870), premium workflow 40626046873 and existing engine/playback gates 40626046872.

- Native MySQL: KST month/year boundaries, independent slots and members, ordinary later rewards, replay, first-login migration/top-up, persisted-like eligibility, deletion/re-like abuse resistance, and credit/slot rollback.
- Concurrent PHP requests: one login credit, one 500P first post among eight simultaneous posts, and one first-like multiplier across duplicated/concurrent targets.
- Existing membership, renewal, premium download/owner-share and upload recovery contracts pass.
- 96 browser cases: 8 monthly banner/collection, 8 processing/completed master, 48 shared layout/discovery and 32 voice/access, across Chromium/WebKit, 320/390/1280 widths and dark/light themes. No horizontal overflow in asserted cases. Collection and song reaction gaps measured 4px. Actual processing values were isolated fixtures, not fabricated production measurements.
- Dark mobile collection/completed-master, light desktop banner and light mobile processing screenshots inspected. Missing hero/art thumbnails in isolated fixtures are fixture placeholders, not production failures.

The old initial-flash test still parses a superseded community section class; the old live hero probe constructs a URL from guest-disabled navigation and fails. These are separate legacy probe failures. No authentication bypass or test weakening was introduced. Existing exact-scope preservation tests were updated only for the expressly authorized monthly include and reward modules.

## Deployment

Runtime merge: `6a5c3aca40b6c6310bfcd0edbcb634814836e638`.

The scoped release installs the new reward dependency before callers, preserves source preimages, verifies protected sources and public asset hashes, and activates only the monthly policy after source verification. It performs no synthetic production activities or test point credits. The older membership activation pipeline is routed away for the explicit `[monthly-release]` commit; equivalent native gates and the dedicated activation run in the monthly workflow.

[Production workflow 40626809649](https://github.com/rucyjeon79/noa-studio/actions/runs/40626809649) and deployment job 122615554742 succeeded. Main verification repeated the 96 browser cases and native transactional tests successfully. All 10 scoped source files matched desired hashes; 18 protected files were unchanged. The live public banner appeared after the hero with all four exact amounts, and direct execution of its PHP include returned 403.

A fresh production browser reload at https://noastudio.ai.kr/ confirmed the banner and all four amounts, and the desktop screenshot showed it immediately below the operating hero. The browser was signed out: private member music pages and real account point awards were not exercised in production. Those behaviors were verified with the actual modules in isolated role-aware fixtures and matching deployed source.

The older production membership verifier still assumes pre-monthly login/comment amounts; it was not run or used to create production test credits for this release. Future changes to that legacy verifier should account for the active monthly policy. The dedicated monthly verification is the authoritative gate for this feature.

### Policy receipt

```json
{
  "ok": true,
  "policyChanged": true,
  "policyRevision": 2,
  "monthlyBenefits": {
    "enabled": true,
    "multiplier": 10,
    "likePoints": 10,
    "activatedAt": 1793158544,
    "timezone": "Asia/Seoul"
  },
  "firstMonthlyPoints": {
    "login": 1000,
    "write": 500,
    "comment": 300,
    "like": 100
  },
  "basePoints": {
    "login": 100,
    "write": 50,
    "comment": 30,
    "like": 10
  },
  "memberRowsChanged": 0,
  "pointsGranted": 0,
  "subscriptionPolicyPreserved": true
}
```

### Source receipt

```json
{
  "commit": "6a5c3aca40b6c6310bfcd0edbcb634814836e638",
  "changed": [
    "noa-bridge/monthly-rewards.php",
    "noa-bridge/membership-core.php",
    "noa-bridge/engagement.php",
    "noa-app/monthly-banner.php",
    "noa-membership.php"
  ],
  "sha256": {
    "noa-bridge/monthly-rewards.php": "f98765152ecbcbc21dca062dae411cfec952725db0fddfad400e644f50a3c4a6",
    "noa-bridge/membership-core.php": "5d4d7c369c890af43a3c31c62727d990c00e051bf1cd9654ad7d1ba5bc771795",
    "noa-bridge/engagement.php": "bb2eadcc2c1c25a6fa0d093cf1ed78c3527574a7e2c6230915cb8f24486336f2",
    "noa-app/monthly-banner.php": "91d6564aad4edde10bd6042f204eb5b51e02033e534f07a9fec2b6748a479988",
    "noa-app/home.php": "7351ef1e627c39d2609a2fb5ce699ddc7201d450db2a96201af9943750b207a9",
    "noa-membership.php": "2915ea758005c590052412008e2dc67723ec9cf85516b35daeb9ab9bd4471add",
    "noa-premium.js": "d838d41dcb90071e12ca690f8556f444d08b9f757c7ec512c3fa7ef4d5890658",
    "noa-engagement.css": "2dfab7fe55b28ceef7a14c30d601c7da88f0f40f48314aaecf503923167830d7",
    "noa-creator.js": "2df5d9173e9dce94050fc12eedf77f82ccd724e15318db5f7181240dbd405827",
    "extend/noa.00-membership.php": "215c3f583ce274f2e9bdefd99aa8835580cd36c1a5b881ae47727bcc4f572432"
  },
  "protectedUnchanged": 18,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "pricesSeeded": false
}
```
