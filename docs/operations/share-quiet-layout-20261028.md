# Installation sharing and quiet AInoa UI — 2026-10-28

PR: #246. Runtime source: cd5e4bebb0ab1c28f5ceeaedf457eccec868a5d1.
Candidate verification: https://github.com/rucyjeon79/noa-studio/actions/runs/40609328489
Production workflow: https://github.com/rucyjeon79/noa-studio/actions/runs/40609618870

## Behavior

- Header adds a fourth shortcut, Share, to the right of Install. All actions use the public https://noastudio.ai.kr/noa-install.php URL, not a private page or session URL.
- Copy writes the installation URL; SMS opens a compose link with encoded text and URL. Kakao uses navigator.share and explicitly asks the user to select Kakao in the device share list. It does not claim direct Kakao targeting. Unsupported sharing/clipboard access provides a selected read-only URL and AInoa guidance. No message is sent automatically.
- Ordinary AInoa messages use a small dismiss cross and expire after 6–10 seconds. Only requireAcknowledgement=true (including invalid form submission) keeps the confirmation button. Priority notices no longer requeue ordinary messages. Explicit native confirmation dialogs remain unchanged.
- Reaction buttons form a compact group with 44px touch targets. Card content no longer stretches away from its reaction footer. World chapter tools use concise labels and align horizontally; typography, media captions and margins are consistent. Mobile AInoa portrait is 52px and retains bottom navigation/player clearance.
- World CSS uses a content hash query to avoid stale cached styling. Shared account assets already use content hashes.

## Candidate evidence

32 Chromium/WebKit cases passed across guest/member/VIP/admin, dark/light, and 320/390/1280 layouts (WebKit 390). Checks cover four non-overlapping header shortcuts, five discoverable navigation destinations and permission conditions, actual ordinary-message expiry, required acknowledgement, escaped content, modal notice hosting, redirects, copy and native share payloads, unsupported-share fallback, world tool alignment, grouped reactions and 44px targets. Candidate job 122556712727 reports AINOA_VOICE_UI_OK 32. Composer tests, verified welcome facts, member access matrix and sitemap runtime permission tests pass. Reaction regression workflow 40609328523 passes.

Final 320px dark world and 390px WebKit light share screenshots were visually inspected. World fixtures use sample artwork, not a real signed-in production account. Native share and clipboard payloads are stubbed in isolated tests; no physical SMS/Kakao delivery is claimed.

Legacy public catalog visual workflows still assume anonymous access to member-gated catalog data and fail during data parsing. Scoped authenticated fixtures and current access checks are used for this release; access restrictions are not weakened to satisfy those obsolete assumptions.

## Production verification

Production verify/deploy completed successfully (job 122558665975). Live browser confirmed four header shortcuts, 56px header with no horizontal overflow, correct installation URL and encoded SMS destination, copy feedback without acknowledgement, and automatic disappearance of that feedback. Live reaction footer is flex with zero gap. Share dialog was visually inspected. Actual physical device sending is not claimed.

The engagement workflow 40609619060 separately installed the same commit's engagement CSS successfully before the voice release. Seventeen protected files remained unchanged; no database/member/point mutations occurred in the scoped voice release. Public asset hashes and private welcome response checks passed.

Deployment receipt:

```json
{
  "commit": "cd5e4bebb0ab1c28f5ceeaedf457eccec868a5d1",
  "changed": [
    "noa-voice.js",
    "noa-app/world-view.php",
    "noa-account.js",
    "noa-account.css",
    "noa-world.css",
    "noa-ainoa.css",
    "extend/noa.design.php"
  ],
  "sha256": {
    "noa-voice-state.php": "a0970bd07e3c9dd348103a2b3e505012d46d4d1edffbfaf24fdbec03870913ec",
    "noa-voice.js": "1f8942b1ce9362b6a2703fc1b3c3693cf0f0966fa12d57c34241d0a2fbc9d25a",
    "noa-app/world-view.php": "2c79d00e2ecc7bb76055c2f5a96d3ce1b777e948aed2a64cd9fe707ee96d1b28",
    "noa-account.js": "a30f12a5d0551096690f3e970062e9373ec88dc156a1f5f33338b92ab304617e",
    "noa-account.css": "a45af07cb2fe245d1d4d26d3d5406aa5826f4217c7247cb53ae6c1a549abec14",
    "noa-engagement.css": "36616e80aef618a41f589e0f8d289a82a35d4b0b8e6f08ae71223939618bbfd9",
    "noa-world.css": "835f3960a98fe8a1541758e305e0c6564dda96ae6d3ea40729251c72a1b21cc4",
    "noa-ainoa.php": "bebb8f9a3146ffe298087ee1599a7b0e80f1ef513bd8e270bfa1c361d00b8574",
    "noa-ainoa.js": "9ce80e8640ec373d3d30a581dcef607cd13ac664fcf9e7716d89cd664cabfb6a",
    "noa-ainoa.css": "1fd159ab55af236b53a517ce39d606698fe7c1ad0d2b5af3c80e5845d0a733bc",
    "noa-ui.js": "932b204d676a2fdb0bd7d0567699c1bf1c142ec026d1bd5ad261e8a833f91f54",
    "noa-notifications.js": "4bb1e33f6c7691ad1f7c563f6ccef41d116631b94e2e85392dc3a8d0d487d60c",
    "noa-sitemap.php": "52207e1432133b6486e708c27b8bc1f4ba692f45ccb01296d62daf8cbaf0675f",
    "noa-bridge/member-access.php": "a5ce8b9f1fbff9a32d6659a7d38319de14a720f7ae0c340dbc5ef78464f687ce",
    "extend/noa.design.php": "5f61178ba64581952855223cccf1f8353e724fd1ca5fcc8add37736b500ee06c"
  },
  "protectedUnchanged": 17,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "pricesSeeded": false
}
```
