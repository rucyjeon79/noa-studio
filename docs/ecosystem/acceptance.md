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

## Remaining-brief completion pass

- SHOP now exposes editorial featured/recommended collections, real unique-member wishlist ranking, registration ordering, reversible hidden products and editable availability/options/shipping/return notes. Existing gallery metadata survives edits. Administrators can associate actual music, genre, ACT and creator channel IDs; related goods only appear on matched content. Music also deep-links into a prefilled Lounge composer.
- Lounge landing assembles category news, current popular posts, recent real music and playlists without fabricated activity or repeated post cards. LAB landing introduces recent publicly shared creator channels and category feeds.
- VIP publication is restricted to delegated community operators/super administrators and official notices/diaries/events. Server read/list/image gates use the active, unexpired subscription grant, not numeric level alone; scheduled release is interpreted as Korean time. Ordinary fan conversation remains available to regular members.
- LAB compares two immutable published versions and links resolved feedback to a validated version with a concrete improvement note. Feedback keeps its original reviewed version even after later edits.
- Levels 7–9 have no automatic administrator powers. The actual super administrator may independently delegate/revoke community moderation and shop operations. Finance and super access are never inherited from these grants.
- Support history now includes an account-scoped transaction/settlement detail view and immutable processing history, excluding another member's balance and provider funding identifiers.
- New database tests cover VIP expiry and list protection, scheduled public release, scoped staff revocation, feedback-version linkage, contextual product selection, gallery preservation and private financial audit projection.

## Functional completion pass

- Lounge events and LAB works may attach up to six existing visible goods; detail links resolve to actual SHOP products and hidden products stop appearing. Product management includes new registrations.
- Collaboration consent records the exact terms hash and revision. Changed terms cannot be silently accepted. Pending applicants may withdraw and reapply with fresh consent; terminal reviews cannot be overwritten. Applicants see their own status, while private messages remain hidden from others.
- Notifications use the original post's Lounge/LAB route. Report outcomes remain readable when moderation removes post access, without revealing private content. Moderation notifies the author and reporter and rejects repeat processing.
- Deleted comments decrement the live count once and cannot be resurrected through editing. Failed cart writes reload authoritative state. Music selection only lists public references.
- `tests/ecosystem/completion.php` exercises these transitions on the disposable MySQL fixture, in addition to the existing payment, support, permissions and endpoint suite.

## Full brief reconciliation — 2026-10-31 KST

| Brief sections | Actual implementation / evidence | Status |
|---|---|---|
| 1–2, 24–25 | Existing native PHP app, member identity, MySQL documents, separate NOA files and scoped release; shared ecosystem UI | Implemented; no data migration or replacement |
| 3–4 SHOP discovery and comparison | Product catalog, collections, search/category/price filters, real prices and metadata, explicit 2–3 product comparison table; filters retained when returning from detail | Implemented; browser flows exercise comparison and return navigation |
| 4 SHOP detail/cart/checkout | Gallery, detail, member wishlist and persistent goods list; native VIP/points carts remain separate; official Marpple product checkout | Implemented; external orders are not represented as NOA-completed orders |
| 5 Cross-service shopping | Contextual music/genre/ACT/channel associations and explicit Lounge/LAB product references | Implemented; empty associations do not fabricate recommendations |
| 6–10 Lounge | Category/discovery feeds, public/member/private post CRUD, images, media references, comments/replies, likes, bookmarks, polls, report review/results, activity notices, monthly highlights, questions, music/news and VIP timed publication | Implemented; real user/operator content is required for populated feeds |
| 11–17 LAB | Creator feeds, work and feedback topics, immutable versions, comparison, resolution records, stages, classes/challenges, rights declarations, collaboration consent/withdrawal/reapply/review | Implemented; original media access controls stay authoritative |
| 18–20 Support | Song/channel/work entry points; integer 1P through actual available balance, full balance, optional message, confirmation, receipt, atomic debit, duplicate guard, refund and funding provenance | Implemented and tested in isolated native ledger; no live test transfer |
| 21–22 Settlement | MY workspace link, month/total/source metrics, personal/business review, request/hold/verify/approve/pay/reject workflow and immutable audit | Implemented; cash activation requires recorded legal/provider/tax approvals, actual bank transfer remains external |
| 23 Membership | Existing 1–6 permissions, unexpired VIP grant, 7–9 scoped community/SHOP delegation and revocation, real super administrator | Implemented; no parallel member DB |
| 26 Journeys | `journeys.md`, native links, browser flow tests and endpoint tests | Connected; duplicate workspace Support/LAB links removed |
| 27–28 Screens and states | Shipped SHOP/Lounge/LAB/Support templates; loading/empty/failure/success, guest/owner/staff denial and transaction states | Implemented; responsive browser checks accompany release |
| 29–30 Deliverables and subsequent authorization | This acceptance record, journeys, deployed native screens and existing permissions/data descriptions | User's later explicit implementation/deployment instructions supersede original design-only phase |

External operational boundaries are not unfinished internal buttons: live payment provider credentials/contract readiness, Marpple-owned stock/order/shipping, and legal/tax-approved cash settlement activation remain authoritative outside this source release. No contract approval or completed payment is fabricated.
