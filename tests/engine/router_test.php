<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/router.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$r=noa_engine_route_event($e);
if(!$r['ok']||$r['consumers']!==['music','playlist']||$r['mode']!=='plan_only')exit(1);
$e['type']='youtube.synced';if(noa_engine_route_event($e)['consumers']!==['world'])exit(2);
$e['type']='invalid';if(noa_engine_route_event($e)['ok'])exit(3);
echo "NOA_ENGINE_ROUTER_OK\n";
