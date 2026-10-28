# Audio cards and Toss point checkout — 2026-10-28

User authorization: balance song-card whitespace, keep download visible beside play, and use TossPayments with card/KakaoPay point packs. Existing download charge (1,000P), owner credit (500P), and creator monthly price (5,000P) are preserved.

## Delivered source

- Audio rows share a 64px content block with balanced artwork insets, a title line and a 44px controls line. Play, download and overflow have fixed columns. Download delegates to the existing authorized native handler and is excluded from the overflow menu. A missing native source leaves a visible disabled control.
- `/noa-points.php` offers 1,000/3,000/5,000/10,000/30,000/50,000 won packs. Paid points equal won; the last three include 1,000/3,000/5,000 bonus points. Product selection and purchase consent precede checkout.
- Card opens the default Toss card window. KakaoPay uses `method: CARD`, `card.flowMode: DIRECT`, `card.easyPay: KAKAOPAY`. The chosen method is read from the checked radio, including while inputs are disabled during submission.
- The server stores an immutable quote before checkout. Confirmations check member ownership, CSRF, exact amount, order ID, payment key, merchant MID, KRW currency and current mode. Only a successful authoritative server API response can credit points.
- Paid/bonus credits and receipts share the existing native member transaction. Duplicate confirmations and concurrent webhook arrivals cannot issue another credit. Stable provider idempotency keys and GET lookup recover ambiguous confirmation timeouts.
- Signed webhooks verify timestamp, transmission ID and HMAC before fetching authoritative payment status. Partial/full refunds reverse paid and bonus points proportionally, including previously spent points; refunded value cannot remain as spendable credit. A full cancellation is terminal and stale events cannot recredit it.
- Test-mode approvals create test order records but never issue operating points. No real payment or production point mutation is part of deployment or automated validation.

## Activation still required

Highest administrator: open **작업실 → 운영 설정 → 토스 결제 연결** (`/noa-payment-settings.php`). Enter the mode-specific **API 개별 연동** client key (`test_ck_` / `live_ck_`), secret key (`test_sk_` / `live_sk_`), MID and the developer console's security key. Do not use payment-widget keys or send credentials in chat. Settings are stored with restricted permissions outside the webroot; secrets are not echoed in HTML, API results or release receipts.

Register `PAYMENT_STATUS_CHANGED` at `https://noastudio.ai.kr/noa-bridge/toss-webhook.php`. First test real Toss card and Kakao success, return/cancel, and webhook verification using the merchant's test keys. Confirm actual merchant approval for point-charge goods and enabled card/Kakao methods before switching to live mode and checking the merchant-approval confirmation. No keys or approval were fabricated by this change. Real provider end-to-end verification is pending until merchant keys are supplied through the protected page.

Cancellation is initiated through Toss merchant administration; the signed webhook and the buyer's status-refresh control reconcile the point ledger. No unreviewed automatic refund API was added.

## Validation

- Isolated MySQL: immutable six-pack quotes, ownership and amount rejection before provider calls, paid and bonus credit, duplicate and eight concurrent callbacks, partial/full cancellations, stale callbacks, native SQL rollback, ambiguous provider timeout lookup, and no operating points in test mode.
- Isolated HTTP: guest/order privacy, exact-origin CSRF, disabled configuration, protected settings/includes, signature-required webhook and no credit at order creation.
- Browser: Chromium 320/390/1280 and WebKit 390, both themes; six equal-height point packs, card/Kakao method selection, result-retry recovery, guest/disabled controls, seven real rendered audio cards, equal insets and visible native-delegating download controls.
- Existing legacy public-page extraction checks can fail before loading the candidate because they assume older public content/selectors. Authentication and the source guards have not been weakened.

Audio release: PR #252, merge `9db04c61c856f2df3981fbc02083b84160946f00`, production run `40642583529` passed. Dedicated final payment candidate run `40643269945` passed all native/HTTP checks and eight browser contexts. At 390px, audio-card artwork has 13px upper/lower insets, reaction icons are 4px beneath the title, and play/download glyph top deltas are both zero. Payment source merge: PR #253, `bc15dbdfbde700e76747c20cf537e80c31e01de2`. Production run `40643558443` passed its native/HTTP/browser verification and scoped deployment. Public checks confirmed six products, guest privacy, protected settings/includes, and `ready:false`, `mode:disabled`. The release preserved 16 protected files and made zero database writes, member changes or point debits. The real public purchase page was also opened in the browser and showed all six packs and the disabled checkout control. Deployment code does not enable the gateway, enroll a merchant, populate credentials, alter the membership policy, or run financial tests against production.

## Primary integration references

- https://docs.tosspayments.com/guides/v2/payment-window/integration
- https://docs.tosspayments.com/sdk/v2/js/payment-direct
- https://docs.tosspayments.com/reference/using-api/authorization
- https://docs.tosspayments.com/reference/using-api/webhook-events
