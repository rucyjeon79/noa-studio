<?php
declare(strict_types=1);
require_once __DIR__.'/bridge.php';
require_once __DIR__.'/lease-inbox.php';
/**
 * N80 bridge flow simulation. Pure planning only; does not execute workers.
 * Proves that independent consumers can be acknowledged without cross-blocking.
 */
function n80_bridge_simulate(array $event,array $consumerResults): array {
    $plan=n80_bridge_plan($event);
    if(!$plan['ok'])return ['ok'=>false,'error'=>$plan['error'],'results'=>[]];
    $results=[];
    foreach($plan['links'] as $link){
        $consumer=$link['to'];
        $state=noa_engine_lease_new($event['id'],$consumer);
        $claim=noa_engine_lease_apply($state,'claim',100,30);
        if(!$claim['ok'])return ['ok'=>false,'error'=>'claim_failed','results'=>$results];
        $state=$claim['state'];
        $action=($consumerResults[$consumer]??false)===true?'ack':'fail';
        $outcome=noa_engine_lease_apply($state,$action,101);
        $results[$consumer]=$outcome['state']['status'];
    }
    return ['ok'=>true,'mode'=>'simulation_only','results'=>$results,'correlationId'=>$event['correlationId']];
}
