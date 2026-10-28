# Site-wide action rhythm and home discovery — 2026-10-28

User reported persistent spacing/placement problems across ACT, music lists and MY, and requested diverse home recommendations. PR #247.

## Delivered behavior

- Ordinary actions use one horizontal icon/label row across standalone pages and native board toolbars. Specialized media, workspace cards, navigation and social controls retain their own layouts.
- Like and comment targets remain at least 44×44px. Their visible counter/icon edges are 4px apart, with no gap between adjacent hit boxes. Song rows remove excess vertical padding and use a 40px cover.
- ACT selectors stay on one line at 320px. ACT video headings, thumbnails, descriptions and reaction footers share a compact reading rhythm. MY facts remain in two columns, with inline account actions and a grouped membership action area.
- Home presents 골고루 / 인기 / 상승세 / 새 영상. Mixed selection interleaves pools without repeated video IDs. Popularity uses current integrated ranking metrics where available and the existing verified public view fallback; new selection uses actual known publication dates, rejecting unknown/future dates. Growth requires a positive increase between verified public snapshots about 24–72 hours apart. Missing comparison history never fabricates a rising list.
- Discovery is SELECT-only and operates on currently eligible, confirmed public owner videos. Rankings, points, members, reaction persistence and processing workers are unchanged. Home script and shared CSS URLs are content-hashed.

## Validation

Deterministic discovery tests cover distinct mixed selection, integrated scores, current versus ranking-snapshot views, growth ordering, no-history/stale-history fallbacks, known publish dates and private video exclusion. Existing home read-model and reaction persistence tests are retained. Browser fixtures load actual common UI and social-wrapper scripts, actual MY/world renderers, and isolated data only. Chrome 320/390/1280 and WebKit 390, both themes, cover home, MY, ACT, music, settings and native board actions; existing 32 voice/access cases also run.

The broad recovery ownership test now recognizes the user's explicit home-discovery request for three exact read-only home files and asserts no discovery SQL write statements. No music processing paths were exempted.

## Production

Candidate 40614706087 passed: SITE_RHYTHM_AND_DISCOVERY_UI_OK 48 and AINOA_VOICE_UI_OK 32. Reaction 40614706159 and home source 40614706143 passed. Final main follow-up additionally removes selected recommendation IDs from EP/story/cover panels and asserts no duplicate across those panels. The guarded main deployment must pass the same full suite before activation.

Mobile dark home/world and WebKit light MY screenshots were inspected. The independent engagement fixture uses existing sample cover artwork; the combined music layout fixture has no /cover.jpg file, so its thumbnail loading is not evidence of production media health. Production source image paths are unchanged.

Initial runtime 818b7052a8c348500b9db9be073d85b421b656e2 deployed successfully via 40615304658. All 48 layout/discovery plus 32 voice/access cases passed in main. The superseded 4904c9f attempt was refused before any writes by the existing freshness guard.

Live https://noastudio.ai.kr/ verified 8 mixed cards, every thumbnail loaded, no horizontal overflow, popularity/growth/recent labels, functional rising and new tabs, and real publication dates. The current comparison window was 59.3 hours, accurately displayed. Public postflight reported mixed=8/popular=8/rising=8/new=8.

Live inspection found the catalog sentinel `unspecified` displayed as a version label. Follow-up 249bbb2de127a6010f7d1f6843534fe1897f20ed filters known internal version placeholders, preserving actual version names, and adds a UI assertion. Final follow-up deployed successfully via workflow 40616011707, deploy job 122579695669. Its full 48 layout/discovery and 32 voice/access cases passed. A fresh production page load confirmed 8 loaded recommendation images, no horizontal overflow and no internal version placeholder. Earlier live checks confirmed no overlap with secondary panels and working rising/new tabs.

## Final guarded deployment receipt

```json
{
  "commit": "249bbb2de127a6010f7d1f6843534fe1897f20ed",
  "changed": [
    "noa-home.js"
  ],
  "sha256": {
    "noa-bridge/home-discovery.php": "86f7d215d460226661ed01f85bd39e35f56708a78761163b1194c796bb916227",
    "noa-bridge/home-core.php": "b2edc6fd461d98977e27ca872bc11e70e14b9e7f37c5857dfd36440881a76358",
    "noa-bridge/home.php": "e6bd9de23ed48036b4c952e2a380b5c9c57f997d6cb6e9225b1ed79b1de46b19",
    "noa-home.js": "6b1ed9e90a9551fd9f35717e6e52d10a3823363000894271eee89c9c24393048",
    "noa-ui.css": "fcac23ea5141394c6a8d9c45d865ae59c397accf524945f72b2f83a4c402737f",
    "noa-engagement.css": "c259102f8cc2f87293917adefee7a3f6896d687980026a1c83039e2b2f8e2f98",
    "noa-world.css": "0d0da84a5a428ddac443b3f28dce6de7ead353316b7d6ceb8af4d4c87c6b4d01",
    "noa-account.css": "570ec9814b0148d3a68104e16a78eb309e7f3f8d6fce8c1638d49d6347dd4c26",
    "noa-my.php": "47e81c129546978f4b4e2c38c9ea20908d3e5b5dd8bb4870617cee7f559fda3b",
    "extend/noa.design.php": "9dd02e259094abbe79fc5de643c727b8dfa071327eabbde6d842f7a5317d7db6"
  },
  "protectedUnchanged": 17,
  "databaseWrites": 0,
  "memberRowsChanged": 0,
  "pointDebits": 0,
  "pricesSeeded": false
}
```
