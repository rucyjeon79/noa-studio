<?php
declare(strict_types=1);
require_once __DIR__.'/workflow.php';
/**
 * NOA ENGINE dispatch gate. Fail closed until durable receipts and module
 * adapters are explicitly configured. Never invoke legacy workers directly.
 */
function noa_engine_dispatch_gate(array $event,array $policy=[]): array {
    $plan=noa_engine_workflow_plan($event);
    if(!$plan['ok'])return ['ok'=>false,'status'=>'rejected','error'=>$plan['error'],'steps'=>[]];
    if(($policy['enabled']??false)!==true)return ['ok'=>false,'status'=>'blocked','error'=>'dispatch_disabled','steps'=>$plan['steps']];
    if(($policy['durableStoreReady']??false)!==true)return ['ok'=>false,'status'=>'blocked','error'=>'durable_store_not_ready','steps'=>$plan['steps']];
    if(($policy['authenticatedActor']??false)!==true)return ['ok'=>false,'status'=>'blocked','error'=>'unauthenticated_actor','steps'=>$plan['steps']];
    // Runtime adapters not yet installed: do not report success or send events.
    return ['ok'=>false,'status'=>'blocked','error'=>'consumer_adapters_not_installed','steps'=>$plan['steps']];
}
