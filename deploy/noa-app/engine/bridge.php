<?php
declare(strict_types=1);
require_once __DIR__.'/n80.php';
/**
 * N80 BRIDGE: single non-mutating module interconnect facade.
 * Reuses the existing registry/router/adapter contracts without duplicating
 * legacy Bridge logic. No worker dispatch until activation gates are satisfied.
 */
function n80_bridge_plan(array $event): array {
    $validation=noa_engine_validate_event($event);
    if(!$validation['ok'])return ['ok'=>false,'error'=>$validation['error'],'links'=>[]];
    $route=noa_engine_route_event($event);
    if(!$route['ok'])return ['ok'=>false,'error'=>$route['error'],'links'=>[]];
    $registered=noa_engine_modules();
    $adapters=noa_engine_adapter_manifest();
    $links=[];
    foreach($route['consumers'] as $consumer){
        if(!isset($registered[$consumer]))return ['ok'=>false,'error'=>'unknown_module','links'=>[]];
        $links[]=[
            'from'=>$event['source'],
            'to'=>$consumer,
            'event'=>$event['type'],
            'correlationId'=>$event['correlationId'],
            'adapterAvailable'=>isset($adapters[$consumer]),
            'executionEnabled'=>false,
        ];
    }
    return ['ok'=>true,'bridge'=>'N80 BRIDGE','mode'=>'plan_only','links'=>$links];
}
