<?php
declare(strict_types=1);
require_once __DIR__.'/inline-edit.php';
/** Reversible deletion only. Source snapshots, history, memberships and media are never deleted. */
function nrt_change(PDO $db,array $request,string $actor):array{
 $action=$request['action']??'';$selector=$request['selector']??null;$expected=$request['expectedRevision']??null;$requestId=$request['requestId']??'';
 if(!in_array($action,['trash','restore'],true)||!is_array($selector)||($selector['type']??'')!=='song'||($selector['source']??'')!=='music'||!is_int($expected)||$expected<0||!is_string($requestId)||!preg_match('/^[a-f0-9-]{36}$/iD',$requestId))throw new InvalidArgumentException('invalid_action');
 $hash=hash('sha256',json_encode([$action,$selector,$expected],JSON_THROW_ON_ERROR));$db->beginTransaction();
 try{
  $q=$db->prepare('SELECT doc_key,request_hash,revision FROM noa_request_log WHERE request_id=? FOR UPDATE');$q->execute([$requestId]);$retry=$q->fetch(PDO::FETCH_ASSOC);
  if($retry){if(!hash_equals($retry['request_hash'],$hash))throw new DomainException('idempotency_reuse');$db->commit();return ['ok'=>true,'revision'=>(int)$retry['revision'],'replayed'=>true];}
  $r=nie_resolve($db,$selector);if(!in_array($r['kind'],['single','story'],true))throw new InvalidArgumentException('song_required');
  $q=$db->prepare('SELECT payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$r['writeKey']]);$current=$q->fetch(PDO::FETCH_ASSOC);
  if(($current?(int)$current['revision']:0)!==$expected||$r['revision']!==$expected)throw new DomainException('revision_conflict');
  $payload=$current?json_decode($current['payload'],true,512,JSON_THROW_ON_ERROR):$r['payload'];
  if($action==='trash'){if(!empty($payload['_noaTrash']))throw new DomainException('already_deleted');$payload['_noaTrash']=['at'=>gmdate('c'),'by'=>$actor];}
  else{if(empty($payload['_noaTrash']))throw new DomainException('not_deleted');unset($payload['_noaTrash']);}
  $next=nup_store($db,$r['writeKey'],$r['kind'],$payload,$expected,$actor);
  $q=$db->prepare('INSERT INTO noa_request_log(request_id,doc_key,request_hash,revision) VALUES(?,?,?,?)');$q->execute([$requestId,$r['writeKey'],$hash,$next]);$db->commit();return ['ok'=>true,'revision'=>$next,'replayed'=>false];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
