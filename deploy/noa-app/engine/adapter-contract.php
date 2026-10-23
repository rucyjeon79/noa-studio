<?php
declare(strict_types=1);
require_once __DIR__.'/router.php';
/** Read-only adapter manifest: no callback execution or legacy worker invocation. */
function noa_engine_adapter_manifest(): array {
    return [
        'music'=>['events'=>['audio.ready'],'mode'=>'read_model_refresh','enabled'=>false],
        'playlist'=>['events'=>['audio.ready'],'mode'=>'read_model_refresh','enabled'=>false],
        'world'=>['events'=>['youtube.synced'],'mode'=>'read_model_refresh','enabled'=>false],
        'admin'=>['events'=>['operation.requested'],'mode'=>'approval_required','enabled'=>false],
    ];
}
function noa_engine_adapter_check(array $event,string $consumer): array {
    $route=noa_engine_route_event($event);
    if(!$route['ok'])return ['ok'=>false,'error'=>$route['error']];
    if(!in_array($consumer,$route['consumers'],true))return ['ok'=>false,'error'=>'consumer_not_routed'];
    $adapter=noa_engine_adapter_manifest()[$consumer]??null;
    if($adapter===null)return ['ok'=>false,'error'=>'adapter_missing'];
    if(!in_array($event['type'],$adapter['events'],true))return ['ok'=>false,'error'=>'event_not_supported'];
    if(!$adapter['enabled'])return ['ok'=>false,'error'=>'adapter_disabled'];
    return ['ok'=>false,'error'=>'adapter_executor_not_installed'];
}
