# Shared alignment and ten recommendations — 2026-10-28

Runtime PR: #251. Merge: `13b6afa3d27bb7149721ed1060b926f36e6ba1a3`.

## Interface

- Home discovery selects ten unique items, alternating measured popularity, growth and actual publication date. Popular/new filters also allow ten; a short or unmeasured rising pool is not padded with fabricated entries.
- ACT collections, nested videos and mastered audio use shared 44px artwork/action columns and 8px column gaps. Artwork, title and controls start at one top edge. Reactions start at the title's left edge, 4px below content. Nested rows do not accumulate indentation.
- ACT tools use compact icons while retaining accessible labels and 44px targets. Existing expansion and edit actions remain unchanged.
- Mobile EP selection is five equal cells per row; desktop is ten. Chapter actions have equal widths.
- Home cards use one title line with ellipsis, complete accessible text and the existing title tooltip. Metadata and reactions align across each row. Completed masters keep their champagne background and no processing table.

## Validation

Candidate `4eabc956e49bdc2a983a777b5fe9c841e74d1d29`: [rhythm workflow 40632980818](https://github.com/rucyjeon79/noa-studio/actions/runs/40632980818) and monthly workflow 40632980822 passed. Existing engine, engagement, home-source and unified-category gates passed.

104 browser cases passed: 48 shared layout/discovery, 32 voice/access, eight alignment, eight monthly and eight premium. The alignment cases cover Chromium 320/390/1280 and WebKit 390 in both themes, including real renderer output, collection expansion, nested video rows, chapter disclosure, a long title and rank badge. Collection/song title-to-heart horizontal mismatch was 0px; content-to-heart gap was 4px; all eight contexts rendered ten recommendations. Candidate mobile/desktop light/dark captures and completed-master rendering were inspected.

The legacy UIUX pipeline fails before candidate styles are applied: its signed-out production extractor expects private world content (`observed.length > 0`, `scripts/qa/noa-uiux-release.mjs:23`). No authentication bypass or weakened assertion was introduced. Member screens are validated with isolated role-aware fixtures and deployed source verification, not synthetic production activities.

The separate main-branch world-diary probe (run 40633579743) similarly times out while extracting `#official-mvs a[target="_blank"]` from signed-out production, before starting its local renderer. This release does not alter world access or content; the dedicated alignment suite uses the current real renderer with isolated member fixtures.

## Point-pack proposal (not activated)

The user specified six point packs and a 10% bonus for packs of 10,000P or more. Using the existing 1P = KRW 1 ratio:

| Price (KRW) | Paid points | Bonus points | Total points |
| ---: | ---: | ---: | ---: |
| 1,000 | 1,000 | 0 | 1,000 |
| 3,000 | 3,000 | 0 | 3,000 |
| 5,000 | 5,000 | 0 | 5,000 |
| 10,000 | 10,000 | 1,000 | 11,000 |
| 30,000 | 30,000 | 3,000 | 33,000 |
| 50,000 | 50,000 | 5,000 | 55,000 |

Recommend evaluating TossPayments as the first PG for card and KakaoPay, with Samsung Pay subject to approval for the actual point-top-up business. Phone billing is secondary because of digital-content fees; Danal is an alternative if phone billing is essential. General payment-method support does not establish acceptance of this merchant or these point packs. No provider contract, payment configuration, product activation, member balance or purchase transaction was changed in this release.

Official sources checked 2026-10-28:

- https://www.tosspayments.com/services — integrated card/easy-pay and carrier billing support.
- https://www.tosspayments.com/about/fee — published general card/easy-pay 3.4%; phone digital content 7%, app-only 8%; VAT extra and contract/tier differences apply.
- https://help.portone.io/content/point-service — point/credit top-up requires separate PG/card review and method/usage/refund conditions. Toss list includes card, bank transfer, virtual account and hub Kakao/Naver; phone/Samsung availability must be confirmed for the specific contract. Danal lists card/phone. Do not assume regular card billing is available for point charging.

Future implementation should keep paid and promotional points distinguishable, credit only after server-side payment verification, make duplicate callbacks idempotent, and reverse the corresponding bonus on cancellation. This is implementation guidance, not an enabled payment flow.

## Production receipt

Main verification repeated the 104 browser cases successfully. [Production rhythm run 40633579904](https://github.com/rucyjeon79/noa-studio/actions/runs/40633579904) completed successfully. The same-commit engagement deployment installed the shared CSS first; the rhythm job then changed only home-discovery.php and noa-world.css, confirming all desired hashes. Monthly verification also passed with policy revision 2 unchanged and zero points granted.

A fresh signed-out production browser reload at https://noastudio.ai.kr/ rendered exactly ten recommended cards. All titles measured 20px high with 4px title-to-metadata gaps; a screenshot confirmed aligned card rows with real cover images and a mix of popularity, rising and newly published recommendations. Guest login guidance remains a padded link rather than member reaction buttons. Private member controls were checked in role-aware fixtures, not by creating production likes/comments or account transactions.

```json
{
  "commit": "13b6afa3d27bb7149721ed1060b926f36e6ba1a3",
  "rhythmRun": 40633579904,
  "rhythmDeployJob": 122637131748,
  "engagementDeployJob": 122635555521,
  "sourceHashes": {
    "noa-bridge/home-discovery.php": "8b2550970a68a5a996583875a8f6e3102fbce6cbf58e11d04a52b9c43814f76a",
    "noa-engagement.css": "bd99b3184da7b6ad25fc8a3a7dfcce8850580708b03b8b8bea98f54da6765109",
    "noa-world.css": "17c3dcf0249774c32e7d4cdc8313973f7b37abcf50aa358b9c309eb2fd4a4d75"
  },
  "publicDiscovery": {
    "mixed": 10,
    "popular": 10,
    "rising": 10,
    "new": 10
  },
  "rhythmProtectedUnchanged": 17,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "paymentRuntimeChanged": false,
  "monthlyPolicyChanged": false,
  "monthlyPolicyRevision": 2
}
```

