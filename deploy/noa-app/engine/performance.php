<?php
declare(strict_types=1);
require_once __DIR__.'/n80.php';
/** Read-only performance measurement: no live worker, SQL, or external calls. */
function n80_benchmark_event(array $event,int $iterations=1000): array {
    if($iterations<1||$iterations>10000)throw new InvalidArgumentException('invalid_iterations');
    $samples=['validate'=>[],'route'=>[],'plan'=>[],'gate'=>[]];
    for($i=0;$i<$iterations;$i++){
        $start=hrtime(true);noa_engine_validate_event($event);$samples['validate'][]=(hrtime(true)-$start)/1000000;
        $start=hrtime(true);noa_engine_route_event($event);$samples['route'][]=(hrtime(true)-$start)/1000000;
        $start=hrtime(true);noa_engine_workflow_plan($event);$samples['plan'][]=(hrtime(true)-$start)/1000000;
        $start=hrtime(true);noa_engine_dispatch_gate($event);$samples['gate'][]=(hrtime(true)-$start)/1000000;
    }
    $report=[];
    foreach($samples as $name=>$values){
        sort($values,SORT_NUMERIC);$n=count($values);
        $report[$name]=['p50_ms'=>$values[(int)floor(($n-1)*0.50)],'p95_ms'=>$values[(int)floor(($n-1)*0.95)],'p99_ms'=>$values[(int)floor(($n-1)*0.99)],'samples'=>$n];
    }
    return ['engine'=>'N80 ENGINE','scope'=>'in_process_only','productionLatencyMeasured'=>false,'metrics'=>$report];
}
