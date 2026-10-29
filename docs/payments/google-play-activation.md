# Google Play point packs: implementation and activation

Status: source candidate, disabled by default. No production credentials, Play products,
charges, balances or release APKs were changed. On 2026-10-29 Play Console showed
identity review pending, telephone verification blocked by that review, and Create app disabled.

The existing NOA economy uses point packs, then points for VIP/creator access and
music downloads. This implementation preserves that model. It does **not** turn
those memberships into Google auto-renewing subscriptions. Web and app share the
native member ledger. Points purchased through Play must be used within NOA.

## Implemented path

The native `/noa-points.php` navigation queries the signed-in server account and
then Play ProductDetails. Google supplies the displayed price and payment sheet.
The server calls Google with the fixed package `kr.ai.noastudio`, validates
completed state, the HMAC account ID, product and single-unit quantity, and
commits the receipt and points together. Consume happens only after commit.
Repeated purchase tokens cannot credit twice; pending purchases cannot credit.
Test purchases never affect operating balances, even in live mode. On app resume,
unconsumed purchases are retried. Refund reconciliation reverses the complete
single-unit pack including its bonus once, even if the balance becomes negative.
No purchase tokens, Google credentials or account secrets are returned in status,
written to logs, or stored in the generic documents/history table.

## Product mapping (registration still required)

| Play product ID | Base points | Bonus points | Current web reference price |
| --- | ---: | ---: | ---: |
| noa_points_1000 | 1,000 | 0 | KRW 1,000 |
| noa_points_3000 | 3,000 | 0 | KRW 3,000 |
| noa_points_5000 | 5,000 | 0 | KRW 5,000 |
| noa_points_10000 | 10,000 | 1,000 | KRW 10,000 |
| noa_points_30000 | 30,000 | 3,000 | KRW 30,000 |
| noa_points_50000 | 50,000 | 5,000 | KRW 50,000 |

Create single-quantity consumable BUY products, without rental/preorder offers.
Play Console prices must be reviewed before activation; the reference prices do
not create products or configure Google's regional prices. Users see actual Play
prices before buying. Do not enable multi-quantity purchase.

## Activation gates

1. Complete Google identity/telephone verification and create the app.
2. Register the six products and an internal-test release using the correct signing
   identity. Do not replace the existing sideload APK with a different signer.
3. Configure Play Developer API access for a dedicated service account. A person
   with account authority must approve any new permission grant. Keep its JSON at
   `noa-private/google-play-service-account.json`, outside the web root (0600).
4. Put configuration in the sibling private `google-play.php` returning an array:
   `enabled` false initially, `packageName` `kr.ai.noastudio`, `mode` `test`,
   a generated stable `accountSecret` of at least 32 bytes, and
   `refundSyncVerified` false. Never rotate accountSecret without a migration.
5. Deploy the three `bridge/google-play*.php` files under `noa-bridge/`. Install
   `scripts/noa_google_play_refunds.php` outside the public root. Configure a
   five-minute CLI schedule with `NOA_WEB_ROOT` set to the hosting web root.
   It replays the available 30-day voided-purchase window and follows pagination.
   Monitor failures; outages over 30 days require manual reconciliation. Run the
   reconciler even when new sales are disabled. No HTTP refund trigger exists.
6. Enable test mode and use license testers through Play's internal distribution.
   Verify purchase, cancel, pending completion, force-stop/relaunch, wrong NOA
   account, consume retry and refund. Test purchases must leave operating points
   unchanged. Verify signed-in web/app access to the same point balance.
7. Only after refund scheduling and real provider integration are verified, set
   `refundSyncVerified` true and switch `mode` to `live`. Until then live mode is
   rejected. No credentials or activation settings are included in source.

## Validation

`NOA Google Play billing checks` runs PHP syntax, isolated policy checks, native
MySQL ledger/refund/rollback tests, Android compilation/lint and the existing
native audio bridge regression tests. Provider transport is substituted only in
CLI fixtures; no HTTP request can activate a fixture transport. End-to-end Play
payment and visual purchase-sheet validation remain blocked on account setup.

Official references:
- https://developer.android.com/google/play/billing/integrate
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases/list
