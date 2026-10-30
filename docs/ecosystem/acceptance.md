# NOA ecosystem implementation and acceptance — 2026-10-30

The native GnuBoard member identity and existing MySQL document/history store remain authoritative. No copied member database, imported music duplicate, fake social activity, production test charge, or automatic bank transfer is introduced.

| Brief area | Implemented route and behavior | External or operational condition |
|---|---|---|
| SHOP | /noa-shop.php: authentic six-product collection, search, categories, price sorting, gallery/detail, wishlist, persistent member purchase list, quantity/option notes, related goods, official per-product purchase links | Final options, inventory, shipping, orders and refunds are Marpple-owned. No undocumented order API or false completed-order state. Verified price snapshot dated on screen. |
| Native cart | Existing /noa-vip.php and /noa-points.php remain separate native carts, linked from SHOP | Existing payment-provider live contract/configuration remains authoritative; this release does not enable it or change prices. |
| Lounge | /noa-lounge.php: six categories, search/recent/popular, member/private/public visibility, create/edit/soft-delete, image attachments, existing music reference and YouTube link, likes, comments/replies/edit/delete, bookmarks, native share, poll, reports, activity notices, monthly highlights and daily question | Actual fan content is user-created. Native GnuBoard board news is fetched with its original permissions. No fabricated discussions or votes. |
| Creator LAB | /noa-creator-lab.php: works, feedback, collaboration, classes, challenges, growth; scoped feedback topics, resolved feedback, immutable published version records, stage changes, explicit roles/schedule/compensation/rights, private application and accept/decline, channel links | 5/6 creators can collaborate without VIP. AI tools retain existing 6-level rules. Linked source media retains its own access/download ACL; declarations do not override another owner's rights. |
| Support | Existing song/channel buttons, free integer input up to balance, whole balance, optional message, confirm/receipt, native atomic debit, UUID dedup, sender/recipient private history, refund request and administrator atomic refund | Native signed-in real-point flow not exercised by the assistant in production. |
| Provenance | Native paid-point use deltas matched to credited live Toss orders; bonus/free classification; unverifiable legacy points excluded; reversed payment sources excluded | Unknown sources are held, never assumed to be paid. Refunds are not automatically reclassified as new paid sources. Other payment-provider source adapters require verified provider metadata before eligibility. |
| Settlement | /noa-support.php: month/total/paid/free/unverified/available/reserved/paid metrics; identity type submission; administrator evidence review; request→hold/verified→approved→paid/rejected; tax/net audit; immutable document revisions | Cash disabled by default. Administrator must record completed legal, payment-contract and tax review before enabling requests. External evidence and actual transfer are manual; no bank transfer API. No indiscriminate 3.3% assumption. |
| Navigation | Whole-menu entries; home/music/world/MY/channel links; MY channel workspace support/LAB links; native notifications link to community activity | Existing home layout/card counts preserved. |
| Security | Server ownership/role checks, CSRF+Origin, no raw HTML UGC, private images via authorized controller and Apache deny rule, image decode/reencode and size limits, rate limit, version conflict protection, soft deletion/audit, server-authoritative shop data | Source-only deploy; database content written only by authorized user actions. |

## Permission table

| Level | Public read | Member wishlist/cart | Lounge write/react | LAB create/collaborate | AI | Admin review |
|---|---|---|---|---|---|---|
| 1 | Yes | No | No | No | No | No |
| 2 | Yes | Yes | No | No | No | No |
| 3/4 | Yes | Yes | Yes | No | Existing rules | No |
| 5/6 | Yes | Yes | Yes | Yes | Existing 6-level entitlement | No |
| 7–9 | Yes | Yes | Regular member permissions | Only explicit creator capability | Existing rules | No automatic super access |
| 10 super | Yes | Yes | Yes | Yes | Yes | Yes, actual GnuBoard super identity |

## Architecture and data

- Root index remains the NOA app; /bbs remains native community infrastructure.
- New records use ecosystem_* and support_* document kinds and immutable history. Generic bridge writable kinds do not include these.
- Post/reply/version/attachment/application/notice refer to the existing member ID internally. Public projection uses display name and only existing channel links.
- Existing media key references are validated before sharing. Private music is not promoted to a public post by an administrator's broad view permission.
- Scope deployment preserves native GnuBoard, member config, audio streaming/downloading, current point purchase engine and original music catalog.
- Locking and revisions prevent duplicate likes/votes, cross-owner updates and duplicate refund/settlement writes.

## Verification

Automated isolated MySQL checks cover guest/private visibility, owner-only updates, optimistic concurrency, votes, comments/deletion, notification ownership, work versions, collaboration application privacy/dedup, persisted cart isolation, URL validation, native donation dedup/concurrency, fail-closed provenance, cancellation exclusion, refund replay and ordered settlement approval. Mobile browser QA uses isolated fixture data. Production read-only checks verify published pages, product feed, assets and guest denial; no production test payment or social post.

## Sources

- https://marpple.shop/kr/jr_lifestyle and recorded product pages in docs/ecosystem-products.json
- https://www.marppleshop.help/ko/articles/마플샵제작배송-상품을-외부에서-판매하고-싶어요-f08d4378

Marpple product-only composed thumbnails are reused within the official external-promotion allowance. Model cuts, basic product-information images, and generated fictional products are excluded.
