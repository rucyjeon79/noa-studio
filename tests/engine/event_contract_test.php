<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/event-contract.php';
$event=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
if (!noa_engine_validate_event($event)['ok']) exit(1);
foreach (['type','id','correlationId'] as $key) { $invalid=$event;unset($invalid[$key]);if(noa_engine_validate_event($invalid)['ok'])exit(2); }
$invalid=$event;$invalid['type']='unknown';if(noa_engine_validate_event($invalid)['ok'])exit(3);
echo "NOA_ENGINE_EVENT_CONTRACT_OK\n";
