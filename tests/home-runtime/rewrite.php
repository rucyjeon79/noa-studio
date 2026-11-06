<?php
require dirname(__DIR__, 2).'/deploy/noa-app/home-assets.php';
echo nha_rewrite(stream_get_contents(STDIN), dirname(__DIR__, 2).'/deploy');
