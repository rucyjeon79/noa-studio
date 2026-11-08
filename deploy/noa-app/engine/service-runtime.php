<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
require_once __DIR__.'/task-status.php';
/** Fixed operation ownership; an HTTP request cannot supply a handler, file or principal. */
function n80_service_operations():array {
    return [
        ...array_fill_keys(['muvy_claim','muvy_complete','muvy_failed'],['module'=>'ai_lab','handler'=>'worker-muvy.php','permission'=>'ai:muvy','method'=>'POST','store'=>'lab:muvy.json']),
        'n80_native_verify'=>['module'=>'admin','handler'=>'worker-native.php','permission'=>'native:verify','method'=>'POST','store'=>'existing_native_stores'],
        'n80_status'=>['module'=>'ai_lab','handler'=>'worker-status.php','permission'=>'ai:read','method'=>'POST','store'=>'existing_native_stores'],
        'n80_daily_shorts_tick'=>['module'=>'ai_lab','handler'=>'worker-shorts.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json:campaigns.daily_shorts'],
        'n80_text_tick'=>['module'=>'ai_lab','handler'=>'worker-text.php','permission'=>'ai:text','method'=>'POST','store'=>'noa_documents:n80_ai_task'],
        'n80_batch_watchdog'=>['module'=>'creator_lab','handler'=>'worker-batch.php','permission'=>'batch:recover','method'=>'POST','store'=>'gpt-action'],
        'n80_listening_index'=>['module'=>'catalog','handler'=>'worker-index.php','permission'=>'catalog:index','method'=>'POST','store'=>'mysql'],
        'health'=>['module'=>'ai_lab','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'GET','store'=>'lab:state.json'],
        'claim'=>['module'=>'ai_lab','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json'],
        'asset'=>['module'=>'ai_lab','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'GET','store'=>'lab:state.json'],
        ...array_fill_keys(['prepare_final','commit_final','authorize_upload','checkpoint','output','finish_output','complete','failed'],
            ['module'=>'ai_lab','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json']),
    ];
}
function n80_service_check(string $action,array $context):array {
    $operation=n80_service_operations()[$action]??null;
    if(!$operation)return ['ok'=>false,'error'=>'unknown_operation'];
    if(($context['authenticatedByServer']??null)!==true||($context['principal']??'')!=='n80_lab_worker'
       ||!in_array($operation['permission'],$context['permissions']??[],true))return ['ok'=>false,'error'=>'unauthorized'];
    if(($context['method']??'')!==$operation['method'])return ['ok'=>false,'error'=>'method_not_allowed'];
    if(!isset(noa_engine_modules()[$operation['module']]))return ['ok'=>false,'error'=>'unregistered_module'];
    return ['ok'=>true,'operation'=>$operation];
}
/** Called only after the bridge verifies HMAC, timestamp and replay nonce. Loads one specialist. */
function n80_service_execute(string $action,array $body,array $context):array {
    $gate=n80_service_check($action,$context);if(!$gate['ok'])return $gate;
    $operation=$gate['operation'];$start=hrtime(true);
    $handler=dirname(__DIR__,2).'/noa-bridge/'.$operation['handler'];
    if(!is_file($handler))return ['ok'=>false,'error'=>'handler_not_installed'];
    // Included specialists return a result; media streams intentionally terminate their response.
    $result=(static function(string $file,string $action,array $b,array $context):array {return require $file;})($handler,$action,$body,$context);
    $result['runtime']=['engine'=>'N80 Engine','module'=>$operation['module'],'operation'=>$action,
        'elapsedMs'=>round((hrtime(true)-$start)/1000000,2),'store'=>$operation['store']];
    if(isset($result['state']))$result['taskStatus']=n80_task_status($operation['module'],(string)($result['taskId']??''),(string)$result['state'],['operation'=>$action]);
    return $result;
}
