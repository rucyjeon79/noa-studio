<?php
declare(strict_types=1);
require dirname(__DIR__, 2).'/deploy/noa-app/home-assets.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$root = dirname(__DIR__, 2).'/deploy';
foreach (['../common.php','common.php','noa-ui.js,noa-ui.css','noa-ui.js,noa-ui.js','https://example.test/x.js',''] as $bad) check(nha_files($bad) === [], 'unsafe asset list accepted');
$html = '<!doctype html><html><head><link rel="stylesheet" href="/noa-ui.css"><style>#x{color:red}</style><link rel="stylesheet" href="/noa-community.css"><script src="/noa-brand.js" defer></script><script type="application/json" id="member">{"member":true}</script><script defer src="/noa-home.js"></script><script src="/noa-launch.js"></script><script src="/noa-ui.js" defer></script><script src="/noa-ui.js" data-noa-theme-only defer></script></head><body><p>Preserve member content</p></body></html>';
$result = nha_rewrite($html, $root);
check(substr_count($result, '/noa-home-assets.php?') === 4, 'CSS and blocking script boundaries not retained');
check(str_contains($result, 'files=noa-brand.js,noa-home.js'), 'deferred order lost across JSON');
check(str_contains($result, '<script type="application/json" id="member">{"member":true}</script>'), 'member context changed');
check(str_contains($result, '<script src="/noa-launch.js"></script>'), 'blocking script changed');
check(str_contains($result, 'data-noa-theme-only defer'), 'script attributes lost');
check(substr_count($result, '<style>#x{color:red}</style>') === 1, 'inline cascade boundary changed');
check(substr($result, strpos($result, '</head>')) === substr($html, strpos($html, '</head>')), 'body modified');
check(nha_rewrite($html, '/no-such-directory') === $html, 'missing files must preserve original tags');
check(nha_rewrite('{"member":true}', $root) === '{"member":true}', 'non-HTML response changed');
$tmp = sys_get_temp_dir().'/noa-asset-version-'.bin2hex(random_bytes(8)); mkdir($tmp);
try {
    file_put_contents($tmp.'/noa-ui.js', 'first'); $before = nha_version(['noa-ui.js'], $tmp);
    file_put_contents($tmp.'/noa-ui.js', 'second');
    check(nha_version(['noa-ui.js'], $tmp) !== $before, 'future deployments must invalidate bundles automatically');
} finally { unlink($tmp.'/noa-ui.js'); rmdir($tmp); }
echo "HOME_ASSET_ORDER_PRIVACY_AND_INVALIDATION_OK\n";
