<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/inbox.php';
$dir=sys_get_temp_dir().'/noa-inbox-'.getmypid();mkdir($dir,0700);
$a=noa_engine_inbox_claim($dir,'evt-1','music');if(!$a['ok'])exit(1);
$b=noa_engine_inbox_claim($dir,'evt-1','music');if($b['ok'])exit(2);
$c=noa_engine_inbox_claim($dir,'evt-1','playlist');if(!$c['ok'])exit(3);
foreach(glob($dir.'/*.json') as $file)unlink($file);
rmdir($dir);
echo "NOA_ENGINE_INBOX_OK\n";
