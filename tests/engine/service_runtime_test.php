<?php
declare(strict_types=1);
/** Real dispatcher and specialist, isolated storage/SQL boundaries; no provider or operating data. */
$source=dirname(__DIR__,2);$root=sys_get_temp_dir().'/n80-service-'.bin2hex(random_bytes(8));
function service_assert(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
function service_remove(string $p):void {if(!is_dir($p)){unlink($p);return;}foreach(scandir($p) as $n)if($n!=='.'&&$n!=='..')service_remove($p.'/'.$n);rmdir($p);}
try{
    mkdir($root.'/noa-app/engine',0700,true);mkdir($root.'/noa-bridge',0700,true);
    foreach(glob($source.'/deploy/noa-app/engine/*.php') as $file)copy($file,$root.'/noa-app/engine/'.basename($file));
    file_put_contents($root.'/noa-app/engine/creative.php','<?php function ncd_cleanup_recovery($db){$GLOBALS["cleanupCalls"]++;return ["examined"=>0,"removed"=>0,"protected"=>0];}');
    $GLOBALS['cleanupCalls']=0;
    copy($source.'/bridge/worker-text.php',$root.'/noa-bridge/worker-text.php');
    file_put_contents($root.'/noa-bridge/ainoa-core.php','<?php');
    file_put_contents($root.'/noa-bridge/storage.php','<?php function noa_bridge_pdo(){return null;}');
    file_put_contents($root.'/noa-bridge/ainoa-automation.php','<?php function n80_ai_tick($db,$owner){$GLOBALS["calls"]++;return ["processed"=>0,"state"=>"idle"];}');
    $GLOBALS['state']=['config'=>['workerEnabled'=>true]];$GLOBALS['calls']=0;
    function lab_read(){return $GLOBALS['state'];}
    function lab_lock(callable $fn){return $fn($GLOBALS['state']);}
    require $root.'/noa-app/engine/service-runtime.php';
    $context=['authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['ai:text'],'method'=>'POST','admin'=>'fixture'];
    service_assert(!n80_service_execute('n80_text_tick',[],[])['ok']&&$GLOBALS['calls']===0,'unauthenticated_execution');
    service_assert(!n80_service_execute('n80_listening_index',[],$context)['ok']&&$GLOBALS['calls']===0,'other_module_execution');
    $result=n80_service_execute('n80_text_tick',[],$context);
    service_assert($result['ok']&&$GLOBALS['calls']===1&&$result['taskStatus']['state']==='idle','specialist_not_executed_once');
    service_assert($result['runtime']['operation']==='n80_text_tick'&&$result['runtime']['module']==='ai_lab','operation_identity_lost');
    service_assert($GLOBALS['state']['worker']['operations']['n80_text_tick']['state']==='idle','operating_state_not_reported');
    $GLOBALS['state']['config']['workerEnabled']=false;
    $paused=n80_service_execute('n80_text_tick',[],$context);
    service_assert($paused['state']==='paused'&&$GLOBALS['calls']===1&&$GLOBALS['cleanupCalls']===2,'disabled_worker_called');
    foreach(get_included_files() as $file)service_assert(!str_ends_with($file,'worker-index.php')&&!str_ends_with($file,'worker-media.php'),'unselected_module_loaded');
    echo "N80_SERVICE_EXECUTION_OK\n";
}finally{service_remove($root);}
