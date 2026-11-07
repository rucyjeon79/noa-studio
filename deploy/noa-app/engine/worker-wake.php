<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Reuse the existing dispatch credential, with a fixed N80 AI workflow and separate debounce. */
function n80_ai_wake():string {
 require_once dirname(__DIR__).'/jukebox/wake-core.php';
 return nw_request(dirname(G5_PATH).'/noa-jukebox-private',null,null,'noa-ai-worker.yml');
}
