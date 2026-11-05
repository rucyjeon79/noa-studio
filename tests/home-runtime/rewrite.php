<?php
require dirname(__DIR__, 2).'/deploy/noa-home-assets-lib.php';
echo nha_rewrite(stream_get_contents(STDIN), dirname(__DIR__, 2).'/deploy');
