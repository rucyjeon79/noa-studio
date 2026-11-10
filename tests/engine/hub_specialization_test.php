<?php
declare(strict_types=1);
/** Exercise real Hub routing and module code against disposable storage/provider boundaries. */
$source=dirname(__DIR__,2);$root=sys_get_temp_dir().'/n80-owners-'.bin2hex(random_bytes(6));
function owners_assert(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function owners_remove(string $p):void{if(!is_dir($p)){unlink($p);return;}foreach(scandir($p)as $n)if($n!=='.'&&$n!=='..')owners_remove($p.'/'.$n);rmdir($p);}
try{
 mkdir($root.'/noa-app/engine',0700,true);mkdir($root.'/noa-bridge',0700,true);
 foreach(glob($source.'/deploy/noa-app/engine/*.php')as $p)copy($p,$root.'/noa-app/engine/'.basename($p));
 foreach(['lab-core.php','lab-publication.php','youtube-store.php','membership-core.php','notifications-sources.php']as $p)file_put_contents($root.'/noa-bridge/'.$p,'<?php');
 copy($source.'/bridge/notifications-inline.php',$root.'/noa-bridge/notifications-inline.php');
 copy($source.'/bridge/worker-media.php',$root.'/noa-bridge/worker-media.php');
 file_put_contents($root.'/noa-bridge/storage.php', <<<'STORAGE'
<?php
class OwnersPDO extends PDO {public function __construct(){parent::__construct('sqlite::memory:');} public function exec(string $sql):int|false{return str_starts_with($sql,'SET time_zone')?0:parent::exec($sql);}}
function noa_bridge_pdo(){static $db;return $db??=new OwnersPDO;}
STORAGE);
 file_put_contents($root.'/noa-bridge/popularity-store.php','<?php function np_ready($db){return true;} function np_calculate($db){$GLOBALS["popularityCalls"]++;return ["computed"=>0];}');
 file_put_contents($root.'/noa-bridge/subscription-core.php', <<<'MEMBERS'
<?php
function nr_policy(){return ['enabled'=>true];}
function ns_q($sql){return [];}
function ns_table($name){return 'g5_member';}
function sql_fetch_array($rows){return false;}
function ns_atomic($key,$flag,$fn){return $fn();}
function ns_doc($key,$lock){return [];}
function ns_put($key,$kind,$value,$rev,$owner){$GLOBALS['membershipReceipts'][]=$value;}
MEMBERS);
 foreach(['worker-text.php','worker-batch.php','worker-index.php','worker-shorts.php']as $p)file_put_contents($root.'/noa-bridge/'.$p,'<?php $GLOBALS["handlerCalls"][]=$action;return ["ok"=>true];');
 define('_GNUBOARD_',true);$config=['cf_admin'=>'fixture'];$GLOBALS['handlerCalls']=[];$GLOBALS['membershipReceipts']=[];$GLOBALS['popularityCalls']=0;$GLOBALS['jobs']=[];$GLOBALS['acks']=[];$GLOBALS['lockCalls']=0;$GLOBALS['released']=0;
 function lab_read(){return $GLOBALS['labState']??[];}
 function lab_id($id){return $id;}
 function lab_json($code,$body){throw new RuntimeException($body['error']??'response');}
 function nnt_ready($db){return true;}
 function nnt_fortune_morning($db,$now){}
 function nnt_prune($db,$now){}
 function nnt_config(){return ['inlineDispatch'=>true];}
 function nnt_collect($db,$now){}
 function nnt_claim($db,$now,$limit){$jobs=$GLOBALS['jobs'];$GLOBALS['jobs']=[];return $jobs;}
 function nnt_one($db,$sql){if(str_contains($sql,'GET_LOCK'))$GLOBALS['lockCalls']++;else $GLOBALS['released']++;return ['acquired'=>1,'released'=>1];}
 function nnt_exec($db,$sql,$args){}
 function nnt_ack($db,$rows,$now){$GLOBALS['acks']=array_merge($GLOBALS['acks'],$rows);}
 require $root.'/noa-app/engine/hub-specialists.php';
 $manifest=json_decode(file_get_contents($source.'/config/n80-hub-operations.json'),true,512,JSON_THROW_ON_ERROR);
 foreach(n80_hub_operations()as $id=>$row){
  owners_assert($manifest[$id]['module']===$row['module'],'scheduler_owner_drift:'.$id);
  if($id==='covers.refresh'){owners_assert($row['module']==='media','artwork_owner');continue;}
  $r=n80_hub_specialist($id);owners_assert($r['ok']&&$r['module']===$row['module'],'wrong_actual_owner:'.$id);
 }
 owners_assert(count($GLOBALS['handlerCalls'])===4&&count(array_unique($GLOBALS['handlerCalls']))===4,'business_handler_not_once');
 owners_assert($GLOBALS['popularityCalls']===1&&count($GLOBALS['membershipReceipts'])===1,'business_logic_not_delegated');
 try{n80_hub_specialist('../../arbitrary');throw new RuntimeException('arbitrary_route_accepted');}catch(InvalidArgumentException $expected){}
 // Notification success, failure and transaction boundaries retain the same leases.
 $db=noa_bridge_pdo();$cfg=['inlineDispatch'=>true];$job=['id'=>1,'device'=>'fixture','lease'=>'lease'];
 $GLOBALS['jobs']=[$job];$r=nnt_inline_drain($db,$cfg,fn()=>201);owners_assert($r['accepted']===1&&$GLOBALS['acks'][0]['lease']==='lease','notification_lease_lost');
 owners_assert(nnt_inline_drain($db,$cfg,fn()=>201)['claimed']===0,'notification_sent_twice');
 $GLOBALS['jobs']=[$job];$r=nnt_inline_drain($db,$cfg,fn()=>throw new RuntimeException('transport'));owners_assert($r['retry']===1&&end($GLOBALS['acks'])['http']===0,'notification_retry_lost');
 $locks=$GLOBALS['lockCalls'];$db->beginTransaction();owners_assert(nnt_inline_drain($db,$cfg)['claimed']===0&&$GLOBALS['lockCalls']===$locks,'nested_transaction_send');$db->rollBack();
 owners_assert($GLOBALS['lockCalls']===$GLOBALS['released'],'notification_lock_leaked');
 // Guard rejects unauthenticated/wrong-method Media calls before loading the worker.
 require_once $root.'/noa-app/engine/service-runtime.php';
 owners_assert(!n80_service_execute('complete',[],[])['ok'],'unauthenticated_media');
 $ctx=['authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['media:worker'],'method'=>'GET'];
 owners_assert(!n80_service_execute('complete',[],$ctx)['ok'],'media_GET_mutation');
 foreach(get_included_files()as $p)owners_assert(!str_ends_with($p,'media-worker.php'),'unauthorized_worker_loaded');
 $body=['id'=>str_repeat('1',32),'lease'=>str_repeat('a',32),'stage'=>'render'];
 $GLOBALS['labState']=['jobs'=>[$body['id']=>['completionReceipts'=>[hash('sha256',$body['lease'])=>hash('sha256',json_encode($body,JSON_THROW_ON_ERROR))],'revision'=>7]]];
 $ctx['method']='POST';$r=n80_service_execute('complete',$body,$ctx);
 owners_assert($r['ok']&&$r['replayed']&&$r['runtime']['module']==='media'&&$r['revision']===7,'media_completion_replay');
 try{n80_service_execute('complete',$body+['changed'=>true],$ctx);throw new RuntimeException('conflicting_completion_accepted');}catch(RuntimeException $e){owners_assert($e->getMessage()==='completion_conflict','wrong_replay_error');}
 echo "N80_HUB_SPECIALIZATION_OK eight routes, guard denial, notification leases, media replay\n";
}finally{owners_remove($root);}
