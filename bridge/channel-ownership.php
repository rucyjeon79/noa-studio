<?php
declare(strict_types=1);
const NCO_POLICY='meta:channel-ownership-v1';
function nco_row(PDO $db,string $key):?array{$q=$db->prepare('SELECT doc_key,kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);return $q->fetch(PDO::FETCH_ASSOC)?:null;}
function nco_library(string $key,string $kind,array $d):bool{return in_array($kind,['single','story','playlist'],true)&&!str_starts_with($key,'creator:')&&($d['genreId']??'')!=='user-library'&&!str_starts_with($key,'user:');}
/** The installed owner is stable: a later administrator change is not a transfer. */
function nco_attach(PDO $db,string $key,string $kind,array $d):array{
 if(!in_array($kind,['single','story','playlist'],true))return $d;
 $old=nco_row($db,$key);$old=$old?json_decode($old['payload'],true,512,JSON_THROW_ON_ERROR):[];
 $owner=(string)($old['ownerId']??'');
 if($owner!==''){
  if(isset($d['ownerId'])&&$d['ownerId']!==$owner)throw new DomainException('ownership_transfer_forbidden');
  $d['ownerId']=$owner;
 }elseif(empty($d['ownerId'])&&nco_library($key,$kind,$d)){
  $p=nco_row($db,NCO_POLICY);$p=$p?json_decode($p['payload'],true,512,JSON_THROW_ON_ERROR):[];
  if(!empty($p['ownerId']))$d['ownerId']=$p['ownerId'];
 }
 if(!empty($d['ownerId']))$d['channelId']=hash('sha256',(string)$d['ownerId']);
 return $d;
}
/** Only an explicit, authenticated release invokes this one-time binding. */
function nco_bind(PDO $db,string $owner,string $backupDir,bool $apply=true):array{
 if($owner==='')throw new DomainException('administrator_required');
 $db->beginTransaction();try{
  $rows=$db->query("SELECT doc_key,kind,payload,revision FROM noa_documents ORDER BY doc_key FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
  $policy=null;foreach($rows as $r)if($r['doc_key']===NCO_POLICY)$policy=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
  if($policy&&($policy['ownerId']??'')!==$owner)throw new DomainException('installed_owner_mismatch');
  $changes=[];$foreign=0;$excluded=0;$owned=0;
  foreach($rows as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!in_array($r['kind'],['single','story','playlist'],true))continue;
   if(!empty($d['ownerId'])&&$d['ownerId']!==$owner){$foreign++;continue;}
   if(empty($d['ownerId'])&&!nco_library($r['doc_key'],$r['kind'],$d)){$excluded++;continue;}
   $next=$d;$next['ownerId']=$owner;$next['channelId']=hash('sha256',$owner);$owned++;
   if($next!==$d)$changes[]=[$r,$next];
  }
  $channelKey='creator-channel:'.hash('sha256',$owner);$channel=nco_row($db,$channelKey);
  if(!$apply){$db->rollBack();return ['ok'=>true,'channelId'=>hash('sha256',$owner),'linked'=>$owned,'planned'=>count($changes),'foreignPreserved'=>$foreign,'excludedPersonal'=>$excluded];}
  if(!$policy||!$channel||$changes){
   if(!is_dir($backupDir)&&!mkdir($backupDir,0700,true))throw new RuntimeException('backup_directory');
   if(is_link($backupDir))throw new RuntimeException('backup_directory');
   $path=$backupDir.'/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(8)).'.json';
   $backup=json_encode(['owner'=>$owner,'records'=>array_column($changes,0),'channel'=>$channel,'policy'=>$policy],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
   $f=fopen($path,'x');if(!$f)throw new RuntimeException('backup_create');chmod($path,0600);$written=fwrite($f,$backup);fclose($f);if($written!==strlen($backup)||hash_file('sha256',$path)!==hash('sha256',$backup))throw new RuntimeException('backup_verify');
  }
  if(!$policy)nup_store($db,NCO_POLICY,'meta',['ownerId'=>$owner,'channelId'=>hash('sha256',$owner),'sourceChannelId'=>'UCwYy9xsAqDFat6AV5UKrfgA','installed'=>true],0,'channel-binding');
  if(!$channel)nup_store($db,$channelKey,'prefs',['title'=>'NOA STUDIO','description'=>'AInoa의 음악과 이야기','ownerId'=>$owner,'channelId'=>hash('sha256',$owner)],0,'channel-binding');
  foreach($changes as [$r,$d]){
   // Save the exact preimage even for old records without a history row.
   $q=$db->prepare('INSERT IGNORE INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)');$q->execute([$r['doc_key'],$r['revision'],$r['payload'],'channel-binding']);
   nup_store($db,$r['doc_key'],$r['kind'],$d,(int)$r['revision'],'channel-binding');
   $after=json_decode(nco_row($db,$r['doc_key'])['payload'],true);unset($after['ownerId'],$after['channelId']);$before=json_decode($r['payload'],true);unset($before['ownerId'],$before['channelId']);if($after!==$before)throw new RuntimeException('content_changed');
  }
  $db->commit();return ['ok'=>true,'channelId'=>hash('sha256',$owner),'linked'=>$owned,'updated'=>count($changes),'foreignPreserved'=>$foreign,'excludedPersonal'=>$excluded,'channelCreated'=>!$channel,'contentPreserved'=>true];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
