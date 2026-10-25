<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
function nie_reply(int $status,array $value):never{http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||($is_admin??'')!=='super')nie_reply(403,['ok'=>false,'error'=>'admin_required']);
$method=$_SERVER['REQUEST_METHOD']??'GET';if(!in_array($method,['GET','POST'],true))nie_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/inline-edit.php';
try{
 $db=noa_bridge_pdo();
 if($method==='GET'){
  $resolved=nie_resolve($db,$_GET);
  if(($_GET['download']??'')==='1'){
   header('Content-Disposition: attachment; filename="noa-record-'.substr(hash('sha256',$resolved['writeKey']),0,20).'.json"');
   nie_reply(200,['key'=>$resolved['writeKey'],'revision'=>$resolved['revision'],'record'=>$resolved['payload'],'original'=>$resolved['original']]);
  }
  nie_reply(200,$resolved);
 }
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||($_SERVER['HTTP_X_NOA_BRIDGE_REQUEST']??'')!=='1'||(isset($_SERVER['HTTP_SEC_FETCH_SITE'])&&$_SERVER['HTTP_SEC_FETCH_SITE']!=='same-origin'))nie_reply(403,['ok'=>false,'error'=>'origin_required']);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nie_reply(415,['ok'=>false,'error'=>'json_required']);
 $raw=file_get_contents('php://input',false,null,0,1048577);if($raw===false||strlen($raw)>1048576)nie_reply(413,['ok'=>false,'error'=>'too_large']);
 $request=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$patch=$request['patch']??null;$expected=$request['expectedRevision']??null;$requestId=$request['requestId']??null;$selector=$request['selector']??null;
 if(!is_array($selector)||!is_array($patch)||array_is_list($patch)||!is_int($expected)||$expected<0||!is_string($requestId)||!preg_match('/^[a-f0-9-]{36}$/iD',$requestId))throw new InvalidArgumentException('invalid_write');
 $hash=hash('sha256',json_encode([$selector,$patch,$expected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));$db->beginTransaction();
 $q=$db->prepare('SELECT doc_key,request_hash,revision FROM noa_request_log WHERE request_id=? FOR UPDATE');$q->execute([$requestId]);$retry=$q->fetch(PDO::FETCH_ASSOC);
 if($retry){if(!hash_equals($retry['request_hash'],$hash))throw new DomainException('idempotency_reuse');$db->commit();nup_snapshot($db,$retry['doc_key'],dirname(__DIR__).'/noa-ai-lab/packages/records');nie_reply(200,['ok'=>true,'revision'=>(int)$retry['revision'],'replayed'=>true]);}
 $resolved=nie_resolve($db,$selector);$key=$resolved['writeKey'];$kind=$resolved['kind'];
 $q=$db->prepare('SELECT revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$actual=$q->fetchColumn();if(($actual===false?0:(int)$actual)!==$expected||$resolved['revision']!==$expected)throw new DomainException('revision_conflict');
 $payload=nup_patch($resolved['payload'],$kind,$patch);if(array_key_exists('members',$patch))nup_validate_members($db,$payload);
 if($payload['packageType']==='ep'&&($resolved['original']['status']??'')==='linked')$payload['sourceRef']=$resolved['original']['key'];
 if($payload['packageType']==='original'&&isset($patch['ep'])){
  $q=$db->query("SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key FOR UPDATE");
  foreach($q as $r){$d=json_decode($r['payload'],true);if($r['doc_key']!==$key&&($d['genreId']??'')==='kpop-original'&&(int)($d['ep']??0)===(int)$payload['ep'])throw new DomainException('original_ep_conflict');}
 }
 $next=nup_store($db,$key,$kind,$payload,$expected,(string)$member['mb_id']);
 if($payload['packageType']==='original'&&isset($patch['ep'])&&(int)$payload['ep']!==(int)($resolved['payload']['ep']??0)){
  $q=$db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key FOR UPDATE");$all=$q->fetchAll(PDO::FETCH_ASSOC);
  foreach($all as $r){$child=json_decode($r['payload'],true);if(($child['sourceRef']??'')!==$key)continue;
   foreach($all as $other){$p=json_decode($other['payload'],true);if($other['doc_key']!==$r['doc_key']&&($p['genreId']??'')===$child['genreId']&&(int)($p['ep']??0)===(int)$payload['ep'])throw new DomainException('derived_ep_conflict');}
   $child['ep']=$payload['ep'];$child['act']=(string)(int)ceil((int)$payload['ep']/10);nup_store($db,$r['doc_key'],$r['kind'],$child,(int)$r['revision'],(string)$member['mb_id']);
  }
 }

 $q=$db->prepare('INSERT INTO noa_request_log(request_id,doc_key,request_hash,revision) VALUES(?,?,?,?)');$q->execute([$requestId,$key,$hash,$next]);$db->commit();nup_snapshot($db,$key,dirname(__DIR__).'/noa-ai-lab/packages/records');nie_reply(200,['ok'=>true,'revision'=>$next,'replayed'=>false]);
}catch(InvalidArgumentException|JsonException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();nie_reply(400,['ok'=>false,'error'=>$e->getMessage()]);}catch(DomainException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();nie_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('[noa-inline-edit] '.get_class($e));nie_reply(503,['ok'=>false,'error'=>'details_unavailable']);}
