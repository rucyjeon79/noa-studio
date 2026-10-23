<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/workflow.php';
$event=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$p=noa_engine_workflow_plan($event);
if(!$p['ok']||count($p['steps'])!==2||$p['mode']!=='plan_only')exit(1);
$step=$p['steps'][0];
for($i=0;$i<3;$i++){
 $r=noa_engine_transition($step,'running');if(!$r['ok'])exit(2);
 $step=$r['step'];$r=noa_engine_transition($step,'failed');if(!$r['ok'])exit(3);$step=$r['step'];
}
if(noa_engine_transition($step,'running')['ok'])exit(4);
if(noa_engine_transition($step,'succeeded')['ok'])exit(5);
echo "NOA_ENGINE_WORKFLOW_OK\n";
