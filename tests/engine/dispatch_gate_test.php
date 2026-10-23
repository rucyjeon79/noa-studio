<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/dispatch-gate.php';
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
if(noa_engine_dispatch_gate($e)['error']!=='dispatch_disabled')exit(1);
if(noa_engine_dispatch_gate($e,['enabled'=>true])['error']!=='durable_store_not_ready')exit(2);
if(noa_engine_dispatch_gate($e,['enabled'=>true,'durableStoreReady'=>true,'authenticatedActor'=>true])['error']!=='consumer_adapters_not_installed')exit(3);
echo "NOA_ENGINE_DISPATCH_GATE_OK\n";
