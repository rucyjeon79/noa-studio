<?php
declare(strict_types=1);
if(!isset($context))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/storage.php';
require_once __DIR__.'/ainoa-generation.php';
require_once dirname(__DIR__).'/noa-app/engine/readiness.php';
require_once __DIR__.'/muvy-core.php';
require_once dirname(__DIR__).'/noa-app/engine/node.php';
$state=lab_read();$ready=na_generation_status($state);
$query=noa_bridge_pdo()->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.state')) AS state,COUNT(*) AS total FROM noa_documents WHERE kind='n80_ai_task' AND updated_by=? GROUP BY state");
$query->execute([(string)$context['admin']]);$counts=[];
foreach($query as $row)$counts[(string)$row['state']]=(int)$row['total'];
$creativeQuery=noa_bridge_pdo()->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.state')) AS state,COUNT(*) AS total FROM noa_documents WHERE kind='n80_creative_job' AND updated_by=? GROUP BY state");$creativeQuery->execute([(string)$context['admin']]);$creativeCounts=[];foreach($creativeQuery as $row)$creativeCounts[(string)$row['state']]=(int)$row['total'];
return ['ok'=>true,'contractVersion'=>2,'workerEnabled'=>(bool)($state['config']['workerEnabled']??false),
    'generation'=>array_intersect_key($ready,array_flip(['ready','missing','model'])),
    'moduleOwnership'=>['modules'=>array_keys(noa_engine_modules()),'services'=>array_map(static fn($row)=>$row['module'],n80_service_operations()),'hub'=>function_exists('n80_hub_operations')?array_map(static fn($row)=>$row['module'],n80_hub_operations()):[]],
    'node'=>n80_node_installation_status(),'operations'=>n80_operation_readiness($state['worker']['readiness']??[]),'muvy'=>mu_config(),'mediaPublication'=>'runner_final_only','taskCounts'=>$counts,'creativeTaskCounts'=>$creativeCounts,'checkedAt'=>gmdate('c'),'generationRequests'=>0];
