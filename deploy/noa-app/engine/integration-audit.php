<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
require_once __DIR__.'/health.php';
require_once __DIR__.'/event-contract.php';
require_once __DIR__.'/router.php';
require_once __DIR__.'/workflow.php';
require_once __DIR__.'/dispatch-gate.php';
require_once __DIR__.'/adapter-contract.php';
/** Read-only integrated acceptance report; never triggers a worker or writes storage. */
function noa_engine_integration_audit(string $root): array {
    $event=['id'=>'audit-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'audit-only','occurredAt'=>gmdate('c'),'schemaVersion'=>1,'correlationId'=>'audit-1'];
    $registry=noa_engine_registry_snapshot();
    $health=noa_engine_health_snapshot($root);
    $route=noa_engine_route_event($event);
    $plan=noa_engine_workflow_plan($event);
    $gate=noa_engine_dispatch_gate($event,['enabled'=>true,'durableStoreReady'=>true,'authenticatedActor'=>true]);
    $adapter=noa_engine_adapter_check($event,'music');
    $checks=[
        'registry_count'=>count($registry['modules'])===9,
        'source_inventory_count'=>count($health['modules'])===9,
        'event_valid'=>noa_engine_validate_event($event)['ok'],
        'routing'=>($route['consumers']??[])===['music','playlist'],
        'workflow_plan'=>count($plan['steps']??[])===2,
        'dispatch_fail_closed'=>($gate['error']??'')==='consumer_adapters_not_installed',
        'adapter_disabled'=>($adapter['error']??'')==='adapter_disabled',
    ];
    return ['ok'=>!in_array(false,$checks,true),'mode'=>'read_only','checks'=>$checks,'automaticDispatch'=>'disabled','modules'=>$health['modules']];
}
