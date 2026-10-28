# Compact music presentation — 2026-10-28

User reported crowded music rows and home cards with large repeated buttons and reaction-load error paragraphs.

PRs: #244 and #245. Final source: 014cc8ca657ce13e54be41dde468e94039e75ee6.
Production workflow: https://github.com/rucyjeon79/noa-studio/actions/runs/40606643021

## Delivered

- Music rows prioritize thumbnail, title and play. Authorized add/download/edit actions are collected in a native dialog. Each secondary action invokes its original handler; no permission or ownership checks are removed. Empty secondary menus are omitted.
- Flat artwork cards, compact heart/comment counters, 44px touch targets, one-line social controls and no repeated reaction-score paragraphs.
- Reaction batch queries are decoded from the original query string after native bootstrap, with size/type/count validation and existing member/target authorization. Native bootstrap escaping of JSON GET input is reproduced by the isolated fixture; batch reads and mutations pass.
- Background reaction failures produce one AInoa notice instead of a paragraph under every card. No synthetic reaction data or account login was used on production.

## Regression checks

Candidate workflows 40605869729 and 40606493465 passed. Main workflows 40606031083 and 40606643021 passed verification and deployment. Ten layout cases cover 320/390/1280 compact views and 390/1280 comment dialogs in dark/light. Checks include no horizontal overflow, aligned controls, 44px targets, compact row height, original add/edit handlers, valid batch decoding, malformed batch rejection, guest/CSRF/origin/private-target denial, idempotent likes/comments, unlike and owner-only deletion, and existing native reaction preservation.

Mobile dark and desktop light main-content screenshots were visually inspected. The fixture uses existing sample art. Its theme-variable override is limited to the tested content; it is not evidence of a production theme setting change.

Live inspection initially found the shared precision-card/action selectors overriding presentation. PR #245 adds scoped precedence and runs the actual common UI script in the fixture, with explicit flat-card and decorated guest-control assertions.

Final live https://noastudio.ai.kr/ browser inspection confirmed card border 0px, transparent background, block layout, 44px guest footer, footer border 0px and horizontal layout. Production artwork/cards were visually inspected. Authenticated interaction is verified in isolated fixtures, not claimed as a physical-user production test.

## Deployment receipts

Initial three changed files: noa-bridge/engagement.php, noa-engagement.css, noa-engagement.js. Final follow-up changed only noa-engagement.css. Sixteen protected files remained unchanged. Member rows and point debits were zero. Schema setup was idempotent (created=[]); existing tables retained; syntheticReactionsCreated=0.

Final receipt:

```json
{
  "commit": "014cc8ca657ce13e54be41dde468e94039e75ee6",
  "changed": [
    "noa-engagement.css"
  ],
  "sha256": {
    "noa-bridge/engagement-core.php": "6a502cec421067759dcffc1b54a3b752d0abe43f399a3b0990f983aac2557ca1",
    "noa-bridge/engagement-targets.php": "b2eaee0e3ca13b16e48450a5c9459f778de531addb5fae3ab29a735f8b4bcf4d",
    "noa-bridge/engagement.php": "e2824dc2e6c7feef3d6915d67e4393c5efa2834bd2b9ddc59b30de1c098c79b7",
    "noa-engagement.css": "df7aa34194276532ebd6cad7e6c0db567f77b431d74e8ba20e4ef078bf66480b",
    "noa-engagement.js": "35a344e8781ad36d169fe7c80a51759b9e9935c15bcf37d0acb3f4ab93620509",
    "noa-bridge/popularity-core.php": "9bd7527a8c82b419920a2ba3298b09415eb41b5539828986ed6cf93efbc6dd99",
    "noa-bridge/popularity-store.php": "edad5bd410e0540a0b8610d308653e4b92a455046c3ba02e71cab2f041d475c6",
    "extend/zz.noa-engagement.php": "b3c4fc938d0882dffdead474c606047cd2843c2d59931be0dfc33f8b48e55a2b"
  },
  "protectedUnchanged": 16,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "pricesSeeded": false
}
```
