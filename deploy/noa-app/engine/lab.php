<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
require_once __DIR__.'/task-status.php';
/** Fixed operation ownership; an HTTP request cannot supply a handler, file or principal. */
function n80_lab_service_operations():array {
    require_once __DIR__.'/media.php';
    return [
        ...array_fill_keys(['muvy_claim','muvy_complete','muvy_failed'],['module'=>'lab','handler'=>'worker-muvy.php','permission'=>'ai:muvy','method'=>'POST','store'=>'lab:muvy.json']),
        'n80_native_verify'=>['module'=>'admin','handler'=>'worker-native.php','permission'=>'native:verify','method'=>'POST','store'=>'existing_native_stores'],
        'n80_status'=>['module'=>'lab','handler'=>'worker-status.php','permission'=>'ai:read','method'=>'POST','store'=>'existing_native_stores'],
        'n80_daily_shorts_tick'=>['module'=>'lab','handler'=>'worker-shorts.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json:campaigns.daily_shorts'],
        'n80_browser_tick'=>['module'=>'lab','handler'=>'worker-browser.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json:browserControl'],
        'n80_text_tick'=>['module'=>'lab','handler'=>'worker-text.php','permission'=>'ai:text','method'=>'POST','store'=>'noa_documents:n80_ai_task'],
        'n80_batch_watchdog'=>['module'=>'creator_lab','handler'=>'worker-batch.php','permission'=>'batch:recover','method'=>'POST','store'=>'gpt-action'],
        'n80_listening_index'=>['module'=>'catalog','handler'=>'worker-index.php','permission'=>'catalog:index','method'=>'POST','store'=>'mysql'],
    ]+n80_media_service_operations();
}
function n80_lab_service_check(string $action,array $context):array {
    require_once __DIR__.'/guard.php';
    return n80_guard_service_check(n80_lab_service_operations()[$action]??null,$context);
}
/** Called only after the bridge verifies HMAC, timestamp and replay nonce. Loads one specialist. */
function n80_lab_service_execute(string $action,array $body,array $context):array {
    $gate=n80_lab_service_check($action,$context);if(!$gate['ok'])return $gate;
    $operation=$gate['operation'];$start=hrtime(true);
    $handler=dirname(__DIR__,2).'/noa-bridge/'.$operation['handler'];
    if(!is_file($handler))return ['ok'=>false,'error'=>'handler_not_installed'];
    // Included specialists return a result; media streams intentionally terminate their response.
    $result=$operation['module']==='media'?n80_media_service_execute($action,$body,$context):
        (static function(string $file,string $action,array $b,array $context):array {return require $file;})($handler,$action,$body,$context);
    $result['runtime']=['engine'=>'N80 Engine','module'=>$operation['module'],'operation'=>$action,
        'elapsedMs'=>round((hrtime(true)-$start)/1000000,2),'store'=>$operation['store']];
    if(isset($result['state']))$result['taskStatus']=n80_task_status($operation['module'],(string)($result['taskId']??''),(string)$result['state'],['operation'=>$action]);
    return $result;
}

/** Host Hub delegates AI orchestration; no queue or additional scheduler is created. */
function n80_lab_hub_execute(string $operation):array {
    $actions=['ai.text'=>'n80_text_tick','ai.daily_shorts_clock'=>'n80_daily_shorts_tick'];
    if(!isset($actions[$operation]))throw new InvalidArgumentException('lab_operation_unsupported');
    return n80_lab_host_service($actions[$operation]);
}
function n80_lab_host_service(string $action):array {
    global $config;
    require_once dirname(__DIR__,2).'/noa-bridge/lab-core.php';
    return n80_lab_service_execute($action,[],['authenticatedByServer'=>true,'principal'=>'n80_lab_worker',
        'permissions'=>['ai:text','batch:recover','catalog:index','media:worker'],'method'=>'POST','admin'=>(string)($config['cf_admin']??'')]);
}
