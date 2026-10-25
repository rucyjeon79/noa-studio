<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/lab-core.php';require_once __DIR__.'/package-migration.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();header('Cache-Control: private, no-store');
try{
 $raw=file_get_contents('php://input',false,null,0,4097);$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';$sig=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>4096||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))lab_json(401,['ok'=>false,'error'=>'service_auth_required']);
 $key=trim((string)file_get_contents(lab_root().'/worker.key'));$signed="NOA-PACKAGE-1\nPOST\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$signed,$key),$sig))lab_json(401,['ok'=>false,'error'=>'service_auth_required']);
 $path=lab_root().'/package-nonce-'.$nonce;$f=@fopen($path,'x');if(!$f)lab_json(409,['ok'=>false,'error'=>'replayed_request']);chmod($path,0600);fwrite($f,$ts);fclose($f);foreach(glob(lab_root().'/package-nonce-*') as $p)if(filemtime($p)<time()-600&&!is_link($p))unlink($p);
 set_time_limit(120);$b=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$db=noa_bridge_pdo();$order=lab_root().'/category-order.json';$root=lab_root().'/packages';$plan=nup_plan(nup_inventory($db,$order));$action=$b['action']??'';
 if($action==='inspect')lab_json(200,['ok'=>true,'sourceHash'=>$plan['sourceHash'],'changed'=>count($plan['changes']),'counts'=>$plan['counts'],'review'=>$plan['review'],'principleZero'=>nup_policy()]);
 if($action==='apply'){
  if(($b['sourceHash']??'')!==$plan['sourceHash'])throw new DomainException('source_changed_replan_required');
  lab_json(200,nup_apply($db,$plan,$order,$root));
 }
 lab_json(400,['ok'=>false,'error'=>'unknown_operation']);
}catch(DomainException $e){lab_json(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-package-worker] '.get_class($e).':'.$e->getMessage());lab_json(503,['ok'=>false,'error'=>'package_service_unavailable']);}
