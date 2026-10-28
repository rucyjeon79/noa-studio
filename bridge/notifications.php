<?php
declare(strict_types=1);
ini_set('display_errors','0');$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$level)ob_end_clean();
require_once __DIR__.'/storage.php';require_once __DIR__.'/notifications-sources.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('Vary: Cookie');header('X-Content-Type-Options: nosniff');
function nnt_reply(array $data,int $status=200):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
try{
 $db=noa_bridge_pdo();if(!nnt_ready($db))throw new DomainException('not_ready');$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='POST'&&($_GET['receipt']??'')==='1'){
  if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr')nnt_reply(['ok'=>false],403);
  $b=json_decode(file_get_contents('php://input',false,null,0,513),true,4,JSON_THROW_ON_ERROR);
  if(!is_array($b)||!is_int($b['id']??null)||!preg_match('/^[a-f0-9]{64}$/D',(string)($b['receipt']??'')))throw new DomainException('invalid_input');
  nnt_exec($db,"UPDATE noa_notification_delivery d JOIN noa_push_subscriptions s ON s.endpoint_hash=d.endpoint_hash AND s.generation=d.generation SET d.received_at=COALESCE(d.received_at,?) WHERE d.notification_id=? AND d.receipt_hash=? AND d.state IN ('leased','sent') AND s.active=1",[time(),$b['id'],hash('sha256',$b['receipt'])]);nnt_reply(['ok'=>true]);
 }
 $owner=(string)($member['mb_id']??'');if(!nnt_member($db,$owner))nnt_reply(['ok'=>false,'error'=>'login_required'],401);
 $_SESSION['noa_notification_csrf']??=bin2hex(random_bytes(32));$csrf=$_SESSION['noa_notification_csrf'];
 if($method==='GET'){
  if(isset($_GET['thread']))nnt_reply(['ok'=>true,'thread'=>nnt_thread($db,$owner,(int)$_GET['thread'])]);
  // A bounded, serialised collector also keeps the open inbox fresh between push runs.
  nnt_exec($db,"INSERT IGNORE INTO noa_notification_cursor VALUES ('last_collect',0)");
  if(nnt_exec($db,"UPDATE noa_notification_cursor SET position=? WHERE source='last_collect' AND position<?",[time(),time()-15]))nnt_collect($db,time());
  $cfg=nnt_config();$devices=nnt_rows($db,'SELECT endpoint_hash FROM noa_push_subscriptions WHERE owner=? AND active=1',[$owner]);
  $status=nnt_one($db,'SELECT d.notification_id,d.endpoint_hash,d.state,d.sent_at,d.received_at,n.created_at FROM noa_notification_delivery d JOIN noa_notifications n ON n.id=d.notification_id WHERE n.recipient=? AND n.kind=? ORDER BY n.id DESC LIMIT 1',[$owner,'test']);
  nnt_reply(['ok'=>true,'csrf'=>$csrf,'owner'=>$owner,'publicKey'=>$cfg['publicKey'],'preferences'=>nnt_settings($db,$owner),'devices'=>array_column($devices,'endpoint_hash'),'testStatus'=>['id'=>(int)($status['notification_id']??0),'device'=>$status['endpoint_hash']??'','state'=>$status['state']??'','accepted'=>(int)isset($status['sent_at']),'received'=>(int)isset($status['received_at']),'age'=>isset($status['created_at'])?max(0,time()-(int)$status['created_at']):0]]+nnt_inbox($db,$owner,max(0,(int)($_GET['before']??0))));
 }
 if($method!=='POST'){header('Allow: GET, POST');nnt_reply(['ok'=>false,'error'=>'method_not_allowed'],405);}
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($csrf,(string)($_SERVER['HTTP_X_NOA_CSRF']??'')))nnt_reply(['ok'=>false,'error'=>'csrf_required'],403);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nnt_reply(['ok'=>false,'error'=>'invalid_input'],415);
 $raw=file_get_contents('php://input',false,null,0,10001);if(strlen($raw)>10000)throw new DomainException('invalid_input');$b=json_decode($raw,true,12,JSON_THROW_ON_ERROR);if(!is_array($b))throw new DomainException('invalid_input');
 switch($b['action']??''){
  case 'subscribe':$hash=nnt_subscribe($db,$owner,(array)($b['subscription']??[]),time());nnt_reply(['ok'=>true,'device'=>$hash]);
  case 'unsubscribe':$hash=(string)($b['device']??'');$all=($b['all']??false)===true;if(!$all&&!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new DomainException('invalid_input');nnt_unsubscribe($db,$owner,$hash,$all);break;
  case 'preferences':nnt_preferences($db,$owner,(array)($b['preferences']??[]));break;
  case 'read':nnt_mark($db,$owner,max(0,(int)($b['id']??0)),($b['all']??false)===true);break;
  case 'test':
   $hash=(string)($b['device']??'');if(!nnt_one($db,'SELECT 1 FROM noa_push_subscriptions WHERE owner=? AND endpoint_hash=? AND active=1',[$owner,$hash]))throw new DomainException('device_not_registered');
   // One test per owned device per five minutes; only this requesting device gets it.
   $db->beginTransaction();try{$id=nnt_enqueue($db,$owner,'test:'.$owner.':'.$hash.':'.intdiv(time(),300),'test','test',$owner,'test',0,'/noa-notifications.php',time());nnt_exec($db,'DELETE FROM noa_notification_delivery WHERE notification_id=? AND endpoint_hash<>? AND state=?',[$id,$hash,'pending']);$job=nnt_one($db,'SELECT state FROM noa_notification_delivery WHERE notification_id=? AND endpoint_hash=?',[$id,$hash]);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}nnt_reply(['ok'=>true,'id'=>$id,'queued'=>in_array($job['state']??'',['pending','leased'],true)]);
  default:throw new DomainException('invalid_input');
 }
 nnt_reply(['ok'=>true]);
}catch(DomainException $e){nnt_reply(['ok'=>false,'error'=>$e->getMessage()],in_array($e->getMessage(),['not_ready'],true)?503:400);}
catch(JsonException $e){nnt_reply(['ok'=>false,'error'=>'invalid_input'],400);}
catch(Throwable $e){error_log('[noa-notifications] '.get_class($e));nnt_reply(['ok'=>false,'error'=>'temporarily_unavailable'],503);}
