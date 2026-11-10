<?php
// Exercise the extension against the native session contract, without site data.
define('_GNUBOARD_', true);
define('G5_URL', 'https://example.test');
$bo_table = '';
$wr_id = 0;
$board = [];
$_SESSION = [];
$hooks = [];
function add_replace($name, $callback, $priority = 10, $arguments = 1) {
    global $hooks;
    $hooks[$name][$priority][] = $callback;
}
function add_stylesheet($html, $priority) {}
function add_event($name, $callback) {}
function set_session($name, $value) { $_SESSION[$name] = $value; }
function ensure($ok, $message) {
    if (!$ok) throw new RuntimeException($message);
}
require dirname(__DIR__, 2).'/deploy/busan/newsroom/news.extend.php';

$key = 'ss_view_busan_news_17';
$cases = [
    ['ordinary', '', 'busan_news', 0, [], false],
    ['diagnostic', '1', 'busan_news', 0, [], true],
    ['already_read', '1', 'busan_news', 0, [$key => true], true],
    ['false_marker', '1', 'busan_news', 0, [$key => false], true],
    ['null_marker', '1', 'busan_news', 0, [$key => null], true],
    ['other_board', '1', 'notice', 0, [], false],
    ['paid_reading', '1', 'busan_news', -10, [], false],
    ['awarded_reading', '1', 'busan_news', 10, [], false],
    ['unknown_points', '1', 'busan_news', null, [], false],
    ['wrong_marker', 'true', 'busan_news', 0, [], false],
];
foreach ($cases as [$name, $marker, $bo_table, $points, $initial, $exclude]) {
    foreach (['board_content_head', 'board_mobile_content_head'] as $head) {
        $wr_id = 17;
        $board = ['bo_read_point' => $points];
        $_SESSION = $initial + ['unrelated' => 'retained'];
        $expected = $_SESSION;
        $_SERVER['SCRIPT_NAME'] = '/bbs/board.php';
        $_SERVER['HTTP_X_BUSAN_NEWS_CHECK'] = $marker;
        $hooks = [];
        busan_news_exclude_check_view();
        if (!$exclude) {
            ensure($_SESSION === $expected, $name.' altered an ordinary request');
            continue;
        }
        ensure($_SESSION[$key] === true, $name.' did not suppress the native view guard');
        $callback = $hooks[$head][1][0];
        ensure($callback('original header') === 'original header', 'changed rendered content');
        ensure($_SESSION === $expected, $name.' changed later ordinary visit eligibility');
        $callback('original header');
        ensure($_SESSION === $expected, 'restore is not idempotent');
    }
}
// A redirect or failed render must also restore the session on shutdown.
$bo_table = 'busan_news';
$board = ['bo_read_point' => 0];
$_SERVER['HTTP_X_BUSAN_NEWS_CHECK'] = '1';
$_SESSION = ['unrelated' => 'retained'];
busan_news_exclude_check_view();
ensure($_SESSION[$key] === true, 'shutdown fixture did not enter exclusion');
register_shutdown_function(static function () {
    ensure($_SESSION === ['unrelated' => 'retained'], 'early exit polluted the reader session');
    echo "PASS diagnostic view exclusion, ordinary reading, points and session restoration\n";
});
