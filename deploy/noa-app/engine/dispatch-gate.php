<?php
declare(strict_types=1);
require_once __DIR__.'/workflow.php';
require_once __DIR__.'/adapter-contract.php';
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
    if(($policy['operation']??'')==='music.verify_availability'){
        $adapter=noa_engine_adapter_check($event,'music',$policy);
        return $adapter+['status'=>$adapter['ok']?'authorized':'blocked','steps'=>$plan['steps']];
    }
    foreach(['playlist','world','admin'] as $module)if(($policy['operation']??'')===(noa_engine_adapter_manifest()[$module]['operation']??null)){
        $adapter=noa_engine_adapter_check($event,$module,$policy);return $adapter+['status'=>$adapter['ok']?'authorized':'blocked','steps'=>$plan['steps']];
    }
    // Unknown operations remain blocked; an installed specialist is not a global enable flag.
    return ['ok'=>false,'status'=>'blocked','error'=>'consumer_adapters_not_installed','steps'=>$plan['steps']];
}
