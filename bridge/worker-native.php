<?php
declare(strict_types=1);
if(!isset($context,$b,$action))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/storage.php';
require_once dirname(__DIR__).'/noa-app/engine/executor.php';
require_once dirname(__DIR__).'/noa-app/engine/native-consumer.php';
$requestId=(string)($b['requestId']??'');if(!preg_match('/^[a-f0-9]{40}$/D',$requestId))throw new InvalidArgumentException('invalid_audit_request');
$db=noa_bridge_pdo();$base=lab_root().'/n80-music-consumer';$directories=['events'=>$base.'/events','leases'=>$base.'/leases'];
$results=[];$evidence=[];$db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
try{foreach(['playlist','world','admin'] as $module){
 $at=gmdate('c');if($module==='admin'){$id='n80-admin-'.hash('sha256','integrity-audit:'.$requestId);$path=$directories['events'].'/'.hash('sha256',$id).'.json';if(is_file($path)&&!is_link($path)){$prior=json_decode(file_get_contents($path),true);$at=$prior['occurredAt']??$at;}}
 $event=n80_native_event($db,$module,$requestId,$at);$operation=noa_engine_adapter_manifest()[$module]['operation'];
 $ctx=['enabled'=>true,'durableStoreReady'=>true,'authenticatedActor'=>true,'authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permission'=>'native:verify','operation'=>$operation,'db'=>$db,'directories'=>$directories,'web'=>dirname(__DIR__),'requestId'=>$requestId,'requestedAt'=>$at];
 $first=noa_engine_execute($event,$module,$ctx);if(!$first['ok'])throw new RuntimeException('native_verification_failed:'.$module.':'.($first['error']??'unknown'));
 $repeat=noa_engine_execute($event,$module,$ctx);if(!$repeat['ok']||empty($repeat['replayed'])||$repeat['receipt']!==$first['receipt'])throw new RuntimeException('native_replay_failed:'.$module);
 $evidence[$operation]=['checkedAt'=>time(),'authenticated'=>true,'durableAck'=>true,'replayVerified'=>true,'effect'=>$first['receipt']['effect']];
 $results[$module]=['operation'=>$operation,'effect'=>$first['receipt']['effect'],'replayVerified'=>true,'projectionSha256'=>$first['receipt']['proof']['projectionSha256'],'verifiedAt'=>$first['receipt']['verifiedAt']];
}$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();error_log('[n80-native] '.substr($e->getMessage(),0,180));throw $e;}
lab_lock(function(&$s)use($evidence){$s['worker']['readiness']=array_replace($s['worker']['readiness']??[],$evidence);});
return ['ok'=>true,'operations'=>$results,'databaseWrites'=>0,'generationRequests'=>0];
