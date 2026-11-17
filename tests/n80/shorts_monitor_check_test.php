<?php
declare(strict_types=1);
/** Actual monitor against an isolated Hub and fixed-service fixture. No host calls. */
$root=sys_get_temp_dir().'/n80-monitor-'.bin2hex(random_bytes(8));mkdir($root,0700);
copy(__DIR__.'/../../deploy/noa-app/engine/shorts-monitor.php',$root.'/shorts-monitor.php');
file_put_contents($root.'/hub.php','<?php');file_put_contents($root.'/service-runtime.php','<?php');
register_shutdown_function(static function()use($root):void {
 foreach(['shorts-monitor.php','hub.php','service-runtime.php'] as $f)unlink($root.'/'.$f);rmdir($root);
});
$store=['control.json'=>['paused'=>true,'stop'=>true],
 'shorts-trial.json'=>['id'=>str_repeat('a',32),'owner'=>'admin','requestedAt'=>1,'receipt'=>['state'=>'succeeded','id'=>'historic','startedAt'=>2]],
 'requests.json'=>['preserve'=>'legacy'],'receipts.json'=>[['state'=>'running','operation'=>'ai.batch']]];
$legacy=$store['shorts-trial.json'];$writes=[];$calls=0;$failFinal=false;
$serviceResult=['ok'=>true,'state'=>'connection_required','processed'=>0,'uploads'=>0,
 'runtime'=>['module'=>'lab','operation'=>'n80_daily_shorts_tick'],
 'readOnlyCheck'=>['scope'=>'existing_clock_on_snapshot','sourceRevision'=>42,'businessStateWritten'=>false,'providerCalls'=>0,'productionVerified'=>false],
 'private'=>'must_not_be_stored'];
function n80_hub_read(string $root,string $name,array $default=[]):array {global $store;return $store[$name]??$default;}
function n80_hub_write(string $root,string $name,array $value):void {
 global $store,$writes,$failFinal,$calls;
 if($failFinal&&$calls>0)throw new RuntimeException('simulated_receipt_failure');
 $store[$name]=$value;$writes[]=$name;
}
function n80_hub_locked(string $root,callable $fn,int $waitMs=750):mixed {return $fn();}
function n80_hub_status(string $root):array {return ['operations'=>[],'receipts'=>[],'paused'=>true,'runnerState'=>'retired'];}
function n80_service_execute(string $action,array $body,array $context):array {
 global $calls,$serviceResult;
 if($action!=='n80_daily_shorts_tick'||$body!==[]||$context!==[
  'authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['media:worker'],'method'=>'POST','admin'=>'admin',
  'hostOperation'=>'ai.daily_shorts_clock','readOnlyClockCheck'=>true])throw new RuntimeException('wrong_dispatch_scope');
 $calls++;return $serviceResult;
}
function must(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
function rejects(callable $fn,string $message):void {
 try{$fn();}catch(Throwable $e){must($e->getMessage()===$message,'wrong error '.$e->getMessage());return;}
 throw new RuntimeException('expected '.$message);
}
require $root.'/shorts-monitor.php';
$baseline=$store;$id=str_repeat('b',32);
$r=n80_shorts_monitor_start($root,'admin',$id);
must($calls===1&&$r['state']==='checked'&&$r['sourceRevision']===42&&!$r['productionVerified'],'real route check');
must($store['control.json']===$baseline['control.json']&&$store['requests.json']===$baseline['requests.json']
 &&$store['receipts.json']===$baseline['receipts.json'],'legacy and pending evidence preserved');
must(array_diff_key($store['shorts-trial.json'],['readOnlyChecks'=>true])===$legacy,'historical trial preserved');
must(!str_contains(json_encode($store),'must_not_be_stored'),'raw results excluded');
$before=$store;$beforeWrites=$writes;
must(n80_shorts_monitor_start($root,'admin',$id)===$r&&$calls===1&&$before===$store&&$writes===$beforeWrites,'same ID never repeated');
n80_shorts_monitor_observe($root);must($store===$before&&$writes===$beforeWrites,'GET observation has no writes');
rejects(fn()=>n80_shorts_monitor_start($root,'other',$id),'clock_check_owner_mismatch');
rejects(fn()=>n80_shorts_monitor_start($root,'admin',str_repeat('c',32)),'trial_recently_requested');
$snap=n80_shorts_monitor_snapshot(n80_hub_status($root),[],$store['shorts-trial.json'],'admin',time());
must($snap['moduleCheck']['state']==='checked'&&!$snap['needsPolling'],'retired idle does not poll');
$onlyChecks=['readOnlyChecks'=>$store['shorts-trial.json']['readOnlyChecks']];
must(n80_shorts_monitor_snapshot(n80_hub_status($root),[],$onlyChecks,'admin',time())['trial']===null,'no invented legacy trial');
must(n80_shorts_monitor_snapshot(n80_hub_status($root),[],$onlyChecks,'other',time())['moduleCheck']===null,'owner scoped');
$store=$baseline;$calls=0;$failFinal=true;
rejects(fn()=>n80_shorts_monitor_start($root,'admin',$id),'simulated_receipt_failure');
$failFinal=false;
must(n80_shorts_monitor_start($root,'admin',$id)['state']==='checking'&&$calls===1,'lost receipt not replayed');
rejects(fn()=>n80_shorts_monitor_start($root,'admin',str_repeat('c',32)),'clock_check_unconfirmed');
$store=$baseline;$store['control.json']['stop']=false;$calls=0;
rejects(fn()=>n80_shorts_monitor_start($root,'admin',$id),'clock_check_requires_retired_runner');
must($calls===0,'stop state never bypassed');
$store=$baseline;$serviceResult['uploads']=1;
$r=n80_shorts_monitor_start($root,'admin',$id);
must($r['state']==='check_failed'&&!$r['productionVerified'],'production result is not a diagnostic success');
must(array_unique($writes)===['shorts-trial.json'],'only diagnostic history written');
echo "N80_SHORTS_MONITOR_CHECK_PASS fixed route, duplicate/lost-receipt protection, legacy preservation, no GET writes\n";
