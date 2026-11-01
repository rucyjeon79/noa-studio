<?php
declare(strict_types=1);
header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/inline-edit.php';
require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
$db=noa_bridge_pdo();
try{
 $db->beginTransaction();
 $pool=nup_song_pool($db);$byId=[];$songs=[];
 foreach($pool as $alias=>$matches)foreach($matches as $key=>$doc){
  $byId[nie_song_id((string)$alias)][$key]=true;$songs[$key]=$doc;
 }
 $assets=[];$sample=[];$unmatched=0;
 foreach($db->query("SELECT status,song_key,audio_path,audio_sha256,audio_bytes FROM noa_jukebox_assets WHERE audio_path<>''") as $a){
  $key=$a['song_key'];$assets[$key]=$a;
  if(!isset($songs[$key])&&count($pool[preg_replace('/^catalog:/','',$key)]??[])!==1)$unmatched++;
 }
 foreach($songs as $key=>$doc){
  $fields=nup_fields($doc);
  if((int)($doc['ep']??0)===32&&trim($fields['title'])==='작은 떨림')$sample[]=['vocal'=>$fields['vocal'],'thumbnailCast'=>$fields['cast'],'directAudio'=>isset($assets[$key])];
 }
 $targets=[];
 foreach($songs as $key=>$doc)if(isset($assets[$key])&&(int)($doc['ep']??0)===32&&nup_fields($doc)['title']==='작은 떨림')$targets[]=$key;
 if(count($targets)!==1)throw new RuntimeException('ambiguous_recording');
 $key=$targets[0];
 $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);
 if(!nj_verified($q->fetch(PDO::FETCH_ASSOC)?:null,'audio'))throw new RuntimeException('unverified_recording');
 $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$row=$q->fetch(PDO::FETCH_ASSOC);
 $doc=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$before=nup_fields($doc);
 if(!empty($doc['_noaTrash'])||(int)$doc['ep']!==32||$before['title']!=='작은 떨림'||!in_array($before['vocal'],['','남자솔로'],true))throw new RuntimeException('changed_record');
 if($before['vocal']===''){
  $doc['body']['vocalInfo']='남자솔로';
  if(isset($doc['body']['originalInfo'])&&($doc['packageType']??nup_type($doc,$row['kind']))==='original'&&empty($doc['body']['originalInfo']['vocal']))$doc['body']['originalInfo']['vocal']='남자솔로';
  nup_store($db,$key,$row['kind'],$doc,(int)$row['revision'],'jukebox-vocal-repair');
 }
 $q->execute([$key]);$verified=nup_fields(json_decode($q->fetch(PDO::FETCH_ASSOC)['payload'],true))['vocal'];
 if($verified!=='남자솔로')throw new RuntimeException('vocal_verification_failed');
 $total=0;$removed=0;
 $lock=$db->prepare("SELECT payload FROM noa_documents WHERE doc_key=? FOR UPDATE");
 $delete=$db->prepare("DELETE FROM noa_documents WHERE doc_key=? AND kind='meta' AND revision=?");
 foreach($db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind='meta' AND doc_key LIKE 'meta:inline-song:%' FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC) as $side){
  $total++;$p=json_decode($side['payload'],true);$id=$p['target']['id']??'';
  if(!is_string($id)||($p['inlineEdit']??null)!==1||($p['target']['type']??'')!=='song'||nie_meta_key('song',$id)!==$side['doc_key']||array_diff(array_keys($p),['inlineEdit','target','fields'])||array_diff(array_keys($p['target']),['type','id'])||count($byId[$id]??[])!==1)continue;
  $key=array_key_first($byId[$id]);$a=$assets[$key]??null;
  if(!$a||!nj_verified($a,'audio'))continue;
  $lock->execute([$key]);$doc=json_decode((string)$lock->fetchColumn(),true);
  if(empty($doc['packageSchema'])||!empty($doc['_noaTrash'])||!is_array($p['fields']??null))continue;
  $fields=nup_fields($doc);
  foreach($p['fields'] as $name=>$value)if(!array_key_exists($name,$fields)||$fields[$name]!==$value)continue 2;
  $delete->execute([$side['doc_key'],$side['revision']]);$removed+=$delete->rowCount();
 }
 $db->commit();
 echo json_encode(['ok'=>true,'songs'=>count($songs),'audioAssets'=>count($assets),'withoutDirectOrUniqueDoc'=>$unmatched,'legacySongSidecars'=>$total,'verifiedDuplicatesRemoved'=>$removed,'sampleBefore'=>$sample,'verifiedVocal'=>$verified],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();http_response_code(500);echo json_encode(['ok'=>false,'error'=>get_class($e)]);}
