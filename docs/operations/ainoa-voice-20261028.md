# AInoa speech, personal welcome and menu conditions — 2026-10-28

User request: all in-site notifications use AInoa speech bubbles with varied artist-like wording, visible bottom navigation and condition explanations for unavailable destinations, and a personalized first-visit greeting with subscription, remaining days and points.

PR: https://github.com/rucyjeon79/noa-studio/pull/242
Candidate: 63f0be2656d2c0e48868d9770abdeeaa058460a4
Merge: 0d2a0e593680949cd1d5dee8bcf44de377791d82
Scoped production workflow: https://github.com/rucyjeon79/noa-studio/actions/runs/40602355093

## Behavior

- A shared speech queue handles in-site status/alert elements, validation messages, activity notifications, song guidance, native alert messages and locked navigation conditions. Native alerts survive redirects for at most 30 seconds. Confirmation/prompt decision semantics are unchanged.
- Each composed message uses Korea-local time, season and an emotional phrase or the actual selected song title. The default pool has 54 distinct combinations, sequenced per browser session. No weather assertions, invented lyrics or paid AI calls are added. Facts and account amounts are retained separately from expressive copy.
- Welcome starts with the authenticated nickname plus 님. Guest values are explicitly unavailable; read failure is not interpreted as an empty subscription. Expired subscriptions have zero days; legacy VIP with no registered end date has unknown remaining days. Native member point balance is read without writes or charges.
- Welcome appears on the first visit in a browser session and after 30 minutes between page visits. Ordinary navigation does not repeat it. Same-origin embedded music-shell pages forward messages to the parent instead of duplicating portraits/greetings.
- All five bottom navigation slots remain visible. Unavailable destination anchors omit href, expose their condition and support click/Enter/Space without leaving the current page. Server destination authorization remains enforced.
- The sitemap is public discovery only. Static services and native board menus show enabled links or disabled navigation with access explanations. Restricted board posts and group membership data are not exposed. Native admin notices use widget-local colors without changing the administrator theme or core files.
- The bubble is readable above an open comment dialog and has an explicit acknowledgement control. Existing Web Push identity, encryption, dispatch, consent and delivery queues are unchanged.

## Verification

Candidate voice run 40601988003 / job 122532117188: success.
- 54 unique default combinations, four seasons, Korea timezone and literal song-title handling.
- Guest, active, expired, legacy VIP and read-failure account facts; no raw owner ID.
- Member access matrix, native board permissions, sitemap disabled conditions.
- 32 Chromium/WebKit combinations across guest/member/VIP/admin, widths 320/390/1280, dark/light. Verified five menus, keyboard access explanations, no navigation for locked items, welcome amounts, text escaping, modal notices, redirect alerts and native admin notices.
- Initial mobile dark and desktop light screenshots inspected visually. Fixture hero art is deliberately not production content; no hero assets were changed.
- Notification regression 40601988103: success. Integrated checks 40601987982: success.
- Legacy approved-UI and UIUX scrape gates still fail when attempting to scrape protected music as anonymous (missing records / observed.length). These assertions were not weakened. The former member-menu count was updated from hidden menus to the explicitly requested five visible slots.

Production release verification is recorded below after activation; authenticated user balances are validated using isolated fixtures, not an unapproved login or synthetic production account.

## Initial operating activation

Workflow 40602355093 completed successfully at 2026-10-28 08:32 KST. Its scoped receipt installed seven files; the same-commit notification workflow 40602355107 installed the other three shared presentation files first. Total feature scope is ten files. Seventeen protected files were unchanged; native member rows, point debits and content writes were zero.

Live browser checks:
- Home displays all five navigation destinations; guest music selection stays on the current page and shows the VIP requirement in AInoa.
- Public sitemap displays usable links and locked destinations with conditions. Selecting MUSIC leaves the browser at https://noastudio.ai.kr/noa-sitemap.php and displays the condition.
- A fresh visitor tab shows a greeting starting 방문자님 followed by seasonal/time/emotional wording and an explicit explanation that account subscription/days/points require login.
- No application JavaScript errors were observed; the browser extension itself logged unrelated metadata errors.
- A single transient browser upstream connection reset recovered with one reload.

Live home inspection also found that empty-board status copy was being spoken. Follow-up PR 243 excludes empty-list descriptions from operational notices and preserves an interrupted notice when a priority access explanation appears. The static empty-state description remains on the page.

## Final deployment and follow-up verification

PR 243 candidate 2fe9592c8d673ccb3163db0cd8a79ca94fdeb8d3 passed workflow 40603196109. Merge afeba62ef721d9608726787323131c6d88a4c2fd passed verification and production deployment in workflow 40603423224. Final activation completed 2026-10-28 08:40:37 KST. Only noa-voice.js changed in this follow-up; its deployed SHA256 is 83052ef46b8ea9fe087791c6225931e3dd267c0a4e58e67603aa33ff7ff01259. Seventeen protected files remained unchanged; database writes, member changes and point debits were zero. Public sitemap, private welcome response and current assets passed post-deployment checks.

Regression verification includes 32 Chromium/WebKit cases, three composer/classifier tests, and preservation of an interrupted unread notice. A subsequent live home navigation showed no unsolicited empty-board speech. Initial visitor greeting and locked sitemap/menu explanations were confirmed on production. Existing push delivery state is preserved; no additional phone notification was sent during this release.
