<?php
/** Presentation for native social signup; OAuth, consent and account writes stay native. */
if (!defined('_GNUBOARD_')) exit;
function noa_social_signup_assets() {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if ($path !== '/plugin/social/register_member.php') return;
    $root = dirname(__DIR__);
    // The shared router handles /bbs/, but native social signup lives under /plugin/.
    add_javascript('<script>document.documentElement.classList.add("noa-g5","noa-social-signup");</script>', 1);
    foreach (['noa-ui.css', 'noa-account.css', 'noa-gnuboard.css', 'noa-social-signup.css'] as $i => $name) {
        if (is_file($root.'/'.$name)) add_stylesheet('<link rel="stylesheet" href="/'.$name.'?v='.hash_file('sha256', $root.'/'.$name).'">', 1100 + $i);
    }
    // Some installed mobile skins contain an unexpanded PHP tag in this script URL.
    // Register the real native validator; do not replace the native validation functions.
    add_javascript('<script src="'.G5_JS_URL.'/jquery.register_form.js"></script>', 15);
}
if (function_exists('add_event')) add_event('common_header', 'noa_social_signup_assets', 20, 0);
if (function_exists('add_replace')) add_replace('html_process_buffer', static function ($html) {
    if (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) !== '/plugin/social/register_member.php') return $html;
    return str_replace('<script src="<?php echo G5_JS_URL ?>/jquery.register_form.js"></script>', '', $html);
}, 20, 1);
