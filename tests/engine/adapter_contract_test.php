<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/adapter-contract.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
if(noa_engine_adapter_check($e,'music')['error']!=='adapter_disabled')exit(1);
if(noa_engine_adapter_check($e,'world')['error']!=='consumer_not_routed')exit(2);
foreach(noa_engine_adapter_manifest() as $a)if($a['enabled'])exit(3);
echo "NOA_ENGINE_ADAPTER_CONTRACT_OK\n";
