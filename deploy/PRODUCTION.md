# NOA STUDIO 2.0 — production deployment checklist

Target: `https://noastudio.ai.kr` (Dothome PHP 8.2 / MySQL 8.0 / GnuBoard 5).

## Current deployment boundary
- `deploy/noa2.php` is a PHP 8.2 entry page using the existing GnuBoard login session. It does **not** implement the full Grok app, nor replace the GnuBoard homepage.
- `deploy/check.php` is a read-only CLI environment checker.
- `bridge/index.php` is a separate, **not yet authenticated cross-domain** API. Do not expose it as a Grok write endpoint or switch music storage to it.
- The current React Start application needs a compatible server runtime. FTP-copying its source into PHP hosting will not run its server functions.

## Safe live steps
1. Confirm the current production `index.php`, `common.php`, `.htaccess` and `bbs/` remain untouched.
2. Upload only `deploy/noa2.php` to `/hosting/noastudio/html/noa2.php`. If that filename already exists, stop instead of overwriting it.
3. Visit `https://noastudio.ai.kr/noa2.php` as an authenticated and unauthenticated visitor. Confirm no PHP fatal errors and GnuBoard navigation works.
4. Do not replace the site's root entry point until its current routing and features have been compared with the new page and the user has approved that exact change.
5. No `g5_*` or `noa_*` database writes are required for the page. Do not run `bridge/001_schema.sql` as part of this deployment.
6. Test existing music generation separately at `https://noa-studio.grok.me`; the PHP page links there and does not claim native generation.

## Release report required
List actual FTP paths changed, exact URLs fetched, HTTP status, authenticated/anonymous behavior, any existing file overwritten, and any missing functionality. Never call a GitHub commit a successful production deployment.
