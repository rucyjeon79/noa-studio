<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/durable-store.php';
$dir=sys_get_temp_dir().'/noa-engine-durable-'.getmypid();mkdir($dir,0700);
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$a=noa_engine_store_event($dir,$e);if(!$a['ok']||$a['status']!=='stored')exit(1);
$b=noa_engine_store_event($dir,$e);if(!$b['ok']||$b['status']!=='already_stored')exit(2);
$other=$e;$other['subjectId']='track-2';if(noa_engine_store_event($dir,$other)['error']!=='id_conflict')exit(3);
foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $file){if(is_file($file))unlink($file);}rmdir($dir);
echo "NOA_ENGINE_DURABLE_STORE_OK\n";
