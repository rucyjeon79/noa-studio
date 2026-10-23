<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/outbox.php';
$dir=sys_get_temp_dir().'/noa-outbox-'.getmypid();mkdir($dir,0700);
$event=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$a=noa_engine_outbox_put($dir,$event);if(!$a['ok'])exit(1);
$b=noa_engine_outbox_put($dir,$event);if($b['ok'])exit(2);
foreach(glob($dir.'/*.json') as $file)unlink($file);
rmdir($dir);
echo "NOA_ENGINE_OUTBOX_OK\n";
