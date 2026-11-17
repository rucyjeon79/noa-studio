<?php
declare(strict_types=1);
require_once __DIR__.'/github-runtime.php';
/** Explicit N80 text task only. Other retired workers stay disabled. */
function n80_auto_dispatch(string $taskId,string $dispatchToken,string $operation):int {
 return $operation==='song_generation'?n80_github_request($operation,$taskId,$dispatchToken):0;
}
