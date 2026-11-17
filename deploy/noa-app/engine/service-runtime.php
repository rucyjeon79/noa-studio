<?php
declare(strict_types=1);
/** Shared Engine dispatcher; each operation loads only its fixed specialist. */
require_once __DIR__.'/service-contract.php';
require_once __DIR__.'/task-status.php';
function n80_service_check(string $action,array $context):array {
    require_once __DIR__.'/guard.php';
    return n80_guard_service_check(n80_service_operations()[$action]??null,$context);
}
function n80_service_execute(string $action,array $body,array $context):array {
    // Either half of the old combined tick may have a different execution owner.
    if($action==='n80_tick'){
        $gate=n80_service_check('n80_text_tick',$context);if(!$gate['ok'])return $gate;
        try{n80_service_execute('n80_batch_watchdog',[],$context);}
        catch(Throwable $error){error_log('[n80-channel-batch] '.get_class($error));}
        $action='n80_text_tick';
    }
    $gate=n80_service_check($action,$context);if(!$gate['ok'])return $gate;
    $operation=$gate['operation'];$start=hrtime(true);
    require_once __DIR__.'/hub.php';
    $hostOperation=n80_hub_service_operation($action,$body);
    if($hostOperation!==null&&($context['hostOperation']??null)!==$hostOperation
        &&n80_hub_owner($hostOperation)==='n80_hub'){
        if($action==='n80_listening_index'&&!empty($body['verifyCatalog'])){
            require_once __DIR__.'/catalog.php';return n80_catalog_readback(!empty($body['verifyMoods']));
        }
        return ['ok'=>true,'state'=>'host_owned','processed'=>0,'module'=>$operation['module'],'operation'=>$hostOperation];
    }
    $handler=dirname(__DIR__,2).'/noa-bridge/'.$operation['handler'];
    if(!is_file($handler))return ['ok'=>false,'error'=>'handler_not_installed'];
    $result=$operation['module']==='media'?n80_media_service_execute($action,$body,$context):
        (static function(string $file,string $action,array $b,array $context):array {return require $file;})($handler,$action,$body,$context);
    $result['runtime']=['engine'=>'N80 Engine','module'=>$operation['module'],'operation'=>$action,
        'elapsedMs'=>round((hrtime(true)-$start)/1000000,2),'store'=>$operation['store']];
    if(isset($result['state']))$result['taskStatus']=n80_task_status($operation['module'],(string)($result['taskId']??''),(string)$result['state'],['operation'=>$action]);
    return $result;
}
/** Internal Hub call: one fixed action with only its required service permission. */
function n80_host_service(string $action):array {
    global $config;
    require_once __DIR__.'/hub.php';
    $operation=n80_service_operations()[$action]??null;$hostOperation=n80_hub_service_operation($action);
    if(!$operation||$hostOperation===null)throw new InvalidArgumentException('hub_service_unsupported');
    require_once dirname(__DIR__,2).'/noa-bridge/lab-core.php';
    return n80_service_execute($action,[],['authenticatedByServer'=>true,'principal'=>'n80_lab_worker',
        'permissions'=>[$operation['permission']],'method'=>'POST','admin'=>(string)($config['cf_admin']??''),'hostOperation'=>$hostOperation]);
}
