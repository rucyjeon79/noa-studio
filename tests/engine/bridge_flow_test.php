<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/bridge-flow.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$r=n80_bridge_simulate($e,['music'=>true,'playlist'=>false]);
if(!$r['ok']||$r['mode']!=='simulation_only'||$r['results']!==['music'=>'succeeded','playlist'=>'pending'])exit(1);
echo "N80_BRIDGE_FLOW_SIMULATION_OK\n";
