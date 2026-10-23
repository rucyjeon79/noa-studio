<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/bridge.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$r=n80_bridge_plan($e);
if(!$r['ok']||count($r['links'])!==2||$r['links'][0]['to']!=='music')exit(1);
foreach($r['links'] as $link)if($link['executionEnabled'])exit(2);
$e['type']='youtube.synced';if(n80_bridge_plan($e)['links'][0]['to']!=='world')exit(3);
echo "N80_BRIDGE_CONTRACT_OK\n";
