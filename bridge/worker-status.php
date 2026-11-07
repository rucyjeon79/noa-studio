<?php
declare(strict_types=1);
if(!isset($context))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/storage.php';
require_once __DIR__.'/ainoa-generation.php';
$state=lab_read();$ready=na_generation_status($state);
$query=noa_bridge_pdo()->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.state')) AS state,COUNT(*) AS total FROM noa_documents WHERE kind='n80_ai_task' AND updated_by=? GROUP BY state");
$query->execute([(string)$context['admin']]);$counts=[];
foreach($query as $row)$counts[(string)$row['state']]=(int)$row['total'];
return ['ok'=>true,'contractVersion'=>2,'workerEnabled'=>(bool)($state['config']['workerEnabled']??false),
    'generation'=>array_intersect_key($ready,array_flip(['ready','missing','model'])),
    'taskCounts'=>$counts,'checkedAt'=>gmdate('c'),'generationRequests'=>0];
