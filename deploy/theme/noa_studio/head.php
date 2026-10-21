<?php
if(!defined('_GNUBOARD_'))exit;
// Core head.sub remains responsible for CSRF-related scripts, sessions and plugin assets.
include_once G5_PATH.'/head.sub.php';
add_stylesheet('<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery1">',99);
add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261022-recovery1" defer></script>',99);
?>
<div id="wrapper"><div id="container_wr"><main id="container">
<?php if(!defined('_INDEX_')):?><h1 id="container_title"><?=get_text($g5['title'])?></h1><?php endif;?>
