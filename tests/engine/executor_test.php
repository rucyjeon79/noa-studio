<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/executor.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
if(noa_engine_execute($e,'music')['error']!=='dispatch_disabled')exit(1);
if(noa_engine_execute($e,'music',['enabled'=>true,'durableStoreReady'=>true,'authenticatedActor'=>true])['ok'])exit(2);
echo "NOA_ENGINE_EXECUTOR_CONTRACT_OK\n";
