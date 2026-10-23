<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
require_once __DIR__.'/event-contract.php';
/**
 * Pure routing planner: returns intended consumers without dispatching, writing or
 * invoking legacy modules. Dispatch requires a separately approved durable outbox.
 */
function noa_engine_route_event(array $event): array {
    $valid=noa_engine_validate_event($event);
    if (!$valid['ok']) return ['ok'=>false,'error'=>$valid['error'],'consumers'=>[]];
    $routes=[
        'audio.ready'=>['music','playlist'],
        'youtube.synced'=>['world'],
        'operation.requested'=>['admin'],
    ];
    $consumers=$routes[$event['type']]??[];
    $registered=array_column(noa_engine_modules(),'label');
    $ids=array_keys(noa_engine_modules());
    foreach($consumers as $id) {
        if(!in_array($id,$ids,true)) return ['ok'=>false,'error'=>'unregistered_consumer','consumers'=>[]];
    }
    return ['ok'=>true,'error'=>null,'consumers'=>$consumers,'correlationId'=>$event['correlationId'],'mode'=>'plan_only'];
}
