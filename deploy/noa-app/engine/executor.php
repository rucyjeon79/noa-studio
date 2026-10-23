<?php
declare(strict_types=1);
require_once __DIR__.'/adapter-contract.php';
require_once __DIR__.'/dispatch-gate.php';
/** Safe execution contract. No production adapters installed or invoked. */
function noa_engine_execute(array $event,string $consumer,array $context=[]): array {
    $gate=noa_engine_dispatch_gate($event,[
        'enabled'=>$context['enabled']??false,
        'durableStoreReady'=>$context['durableStoreReady']??false,
        'authenticatedActor'=>$context['authenticatedActor']??false,
    ]);
    if(!$gate['ok'])return ['ok'=>false,'status'=>'blocked','error'=>$gate['error'],'consumer'=>$consumer];
    $adapter=noa_engine_adapter_check($event,$consumer);
    if(!$adapter['ok'])return ['ok'=>false,'status'=>'blocked','error'=>$adapter['error'],'consumer'=>$consumer];
    return ['ok'=>false,'status'=>'blocked','error'=>'executor_not_installed','consumer'=>$consumer];
}
