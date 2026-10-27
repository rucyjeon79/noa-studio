<?php
/** Render installed native skins offline with invented profile data; no DB or provider calls. */
define('_GNUBOARD_', true);
define('G5_URL', '');
define('G5_JS_URL', '/js');
define('G5_CSS_VER', 'fixture');
define('G5_JS_VER', 'fixture');
function get_text($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function get_social_skin_url() { global $device; return $device === 'mobile' ? '/mobile/skin/social' : '/skin/social'; }
function add_stylesheet($s, $order) { global $styles; $styles[$order][] = $s; }
function add_javascript($s, $order) { global $scripts; $scripts[$order][] = $s; }
function add_event(...$args) {}
function add_replace(...$args) {}
$root = dirname(__DIR__, 2);
$out = $root.'/social-signup-proof/native';
require $root.'/deploy/noa-social-signup.extend.php';
foreach (['mobile', 'pc'] as $device) {
    $file = $out.get_social_skin_url().'/social_register_member.skin.php';
    $source = file_get_contents($file);
    preg_match_all('/\$config\[[\'"]([^\'"]+)[\'"]\]/', $source, $keys);
    $config = array_fill_keys($keys[1], 0);
    $config += ['cf_cert_use'=>0, 'cf_cert_simple'=>0, 'cf_cert_ipin'=>0, 'cf_cert_hp'=>0, 'cf_use_promotion'=>0];
    $config['cf_social_login_use'] = 1;
    $config['cf_nick_modify'] = 30;
    $config['cf_stipulation'] = "NOA STUDIO 이용약관\n이 화면은 가입 화면의 읽기와 조작을 확인하는 오프라인 검수용입니다.";
    preg_match_all('/\$member\[[\'"]([^\'"]+)[\'"]\]/', $source, $keys);
    $member = array_fill_keys($keys[1], '');
    $w = $urlencode = $login_url = '';
    $provider_name = 'Kakao'; $user_id = 'fixture_kakao'; $user_nick = '검수닉네임';
    $user_name = '검수'; $user_phone = ''; $user_email = '';
    $is_exists_email = false; $req_nick = true;
    $register_action_url = '/plugin/social/register_member_update.php'; $login_action_url = '/bbs/login_check.php';
    $styles = $scripts = [];
    $_SERVER['REQUEST_URI'] = '/plugin/social/register_member.php?provider=Kakao';
    noa_social_signup_assets();
    ob_start(); include $file; $body = ob_get_clean();
    // Exercise the same exact malformed-script cleanup as the extension.
    foreach ($scripts as &$items) $items = array_values(array_filter($items, fn($s) => !str_contains($s, '<?php echo G5_JS_URL ?>')));
    unset($items);
    ksort($styles); ksort($scripts);
    $head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/'.($device==='mobile'?'mobile':'default').'.css"><script src="/js/jquery-1.12.4.min.js"></script>';
    foreach ($styles as $items) $head .= implode('', $items);
    // Absolute fixture references for assets selected by the scoped extension.
    foreach (['noa-ui.css','noa-account.css','noa-gnuboard.css','noa-social-signup.css'] as $css) $head .= '<link rel="stylesheet" href="/'.$css.'">';
    foreach ($scripts as $items) $head .= implode('', $items);
    $head .= '<script src="/noa-ui.js" data-noa-theme-only defer></script>';
    file_put_contents($out.'/'.$device.'.html', '<!doctype html><html lang="ko"><head>'.$head.'</head><body><div id="wrapper"><div id="container_wr"><main id="container"><h1 id="container_title">소셜 회원 가입 - 카카오</h1>'.$body.'</main></div></div></body></html>');
}
echo "NATIVE_SOCIAL_FIXTURES_RENDERED\n";
