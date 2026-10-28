<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CONTROL_EXPIRY||!hash_equals('NOA_CONTROL_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$base=ob_get_level();ob_start();
try{
 require dirname(__DIR__).'/common.php';require_once __DIR__.'/subscription-core.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';require_once __DIR__.'/music-download-core.php';
 $body=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);if(($body['approvedPolicy']??'')!=='NOA-20261028-PREMIUM-1000-50-CREATOR-5000')throw new DomainException('policy_identity_required');
 $storage=ns_storage(true);if(!$storage['ready'])throw new DomainException('points_storage_not_ready');
 $before=ns_policy();$next=$before['values'];$next['enabled']=$next['pointsEnabled']=true;$next['plans']['creator']['enabled']=true;$next['plans']['creator']['points']=5000;unset($next['plans']['creator']['durationDays']);$next=ns_policy_validate($next);
 $changed=$next!==$before['values'];if($changed)ns_atomic('policy',false,fn()=>ns_put(NS_POLICY,'prefs',$next,$before['revision'],'premium-policy'));
 $after=ns_policy();if($after['values']['plans']['creator']['points']!==5000||$after['values']['plans']['vip']!==$before['values']['plans']['vip'])throw new RuntimeException('policy_verification_failed');
 $db=noa_bridge_pdo();$counts=['ready'=>0,'ownerResolved'=>0,'ownerUnresolved'=>0];foreach(nj_assets($db) as $key=>$asset){if($asset['status']!=='ready')continue;$doc=nj_document($db,$key);if(!$doc||!noa_sound_visible($doc,false))continue;$counts['ready']++;try{$owner=nmd_owner($db,$doc,$asset);$m=ns_one('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($owner));if(!$m)throw new DomainException('owner_missing');$counts['ownerResolved']++;}catch(Throwable $e){$counts['ownerUnresolved']++;}}
 $result=['ok'=>true,'creatorMonthlyPoints'=>5000,'period'=>'calendar-month','policyRevision'=>$after['revision'],'policyChanged'=>$changed,'vipPreserved'=>true,'downloadPoints'=>NMD_PRICE,'ownerSharePoints'=>NMD_OWNER_SHARE,'nativePointsReady'=>true,'catalog'=>$counts,'memberRowsChanged'=>0,'pointDebits'=>0];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>$e instanceof DomainException?$e->getMessage():'premium_policy_failed'];}
while(ob_get_level()>$base)ob_end_clean();echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
