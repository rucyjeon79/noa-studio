<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/session-shorts-assemble.php';

/** Generated media only. Source audio, rules and character knowledge never enter this spool. */
function nd_storage_assets(array $j):array {
 $assets=[];
 foreach($j['agent']['scenes']??[] as $scene)foreach(['image','video'] as $kind){
  if(isset($scene[$kind]['file']))$assets[]=['kind'=>$kind,'scene'=>$scene['n'],'asset'=>$scene[$kind]];
 }
 if(isset($j['outputs'][0]['file']))$assets[]=['kind'=>'final','scene'=>0,'asset'=>$j['outputs'][0]];
 elseif(($j['agent']['active']['kind']??'')==='final'&&isset($j['agent']['active']['asset']['file']))$assets[]=['kind'=>'final','scene'=>0,'asset'=>$j['agent']['active']['asset']];
 $out=[];
 foreach($assets as $row){
  $a=$row['asset'];$file=$a['file'];
  if(!is_string($file)||!preg_match('/^[a-zA-Z0-9_-]+\.(png|jpg|webp|mp4)$/D',$file)||!preg_match('/^[a-f0-9]{64}$/D',(string)($a['sha256']??''))||!is_int($a['bytes']??null)||$a['bytes']<1||$a['bytes']>512*1048576)throw new DomainException('storage_asset_invalid');
  $row['key']=$row['kind'].':'.$row['scene'].':'.$a['sha256'];$out[$row['key']]=$row;
 }
 return $out;
}
function nd_storage_claim(array &$s,string $owner,int $now,callable $readSource):array {
 if(!nd_assembly_enabled($s))return ['ok'=>true,'claimed'=>false,'state'=>'paused'];
 if(empty($s['campaigns']['daily_shorts']['current']['jobId']))return ['ok'=>true,'claimed'=>false,'state'=>'campaign_job_required'];
 $snapshot=nd_assembly_job($s,$owner);$id=$snapshot['id'];$j=&$s['jobs'][$id];
 if($j['state']==='cancelled')return ['ok'=>true,'claimed'=>false,'state'=>'cancelled'];
 sa_require_current($j,$readSource($j['trackKey']));
 $policy=$s['campaigns']['daily_shorts']['policy']['mediaStorage']??[];
 if(($policy['provider']??'')!=='github_actions_artifact'&&(($policy['provider']??'')!=='google_drive'||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',(string)($policy['temporaryParentFolderId']??''))))throw new DomainException('storage_policy_required');
 $slot=($policy['provider']??'')==='github_actions_artifact'?'temporaryGithubMedia':'temporaryMedia';
 $m=&$j['agent'][$slot];$m??=['folderId'=>null,'files'=>[]];
 if(($m['active']['leaseUntil']??0)>$now&&($m['files'][$m['active']['key']]['state']??'')!=='stored')return ['ok'=>true,'claimed'=>false,'state'=>'storage_busy'];
 foreach(nd_storage_assets($j) as $key=>$row){
  $old=$m['files'][$key]??[];
  if(($old['state']??'')==='stored'||($old['attempts']??0)>=3)continue;
  $m['files'][$key]=array_merge($old,['kind'=>$row['kind'],'scene'=>$row['scene'],'sha256'=>$row['asset']['sha256'],'bytes'=>$row['asset']['bytes'],'sourceUrl'=>$row['asset']['sourceUrl']??'','state'=>'storing','attempts'=>($old['attempts']??0)+1]);
  $m['active']=['key'=>$key,'lease'=>bin2hex(random_bytes(24)),'leaseUntil'=>$now+900];
  return ['ok'=>true,'claimed'=>true,'id'=>$id,'title'=>$j['title'],'key'=>$key,'lease'=>$m['active']['lease'],'provider'=>$policy['provider'],'artifactRuns'=>$old['artifactRuns']??[],'artifactName'=>'n80-media-'.hash('sha256',$id.'|'.$key),'parentFolderId'=>$policy['temporaryParentFolderId']??null,'folderId'=>$m['folderId'],'fileId'=>$old['fileId']??null,'sourceAudioSha256'=>$j['audioSha256'],'asset'=>$row];
 }
 $files=$m['files'];$failed=count(array_filter($files,fn($f)=>($f['state']??'')!=='stored'&&($f['attempts']??0)>=3));
 return ['ok'=>true,'claimed'=>false,'state'=>$failed?'storage_retry_limit':(count($files)?'stored':'no_generated_media'),'stored'=>count(array_filter($files,fn($f)=>($f['state']??'')==='stored'))];
}
function nd_storage_operation(array &$s,array $b,string $owner,int $now,callable $readSource):array {
 if(!nd_assembly_enabled($s))throw new DomainException('daily_shorts_paused');
 $snapshot=nd_assembly_job($s,$owner);$j=&$s['jobs'][$snapshot['id']];$github=($s['campaigns']['daily_shorts']['policy']['mediaStorage']['provider']??'')==='github_actions_artifact';$slot=$github?'temporaryGithubMedia':'temporaryMedia';$m=&$j['agent'][$slot];$active=$m['active']??[];
 if($j['state']==='cancelled'||($b['id']??'')!==$j['id']||($b['key']??'')!==($active['key']??null)||!is_string($b['lease']??null)||!hash_equals($active['lease']??'',$b['lease'])||($active['leaseUntil']??0)<=$now)throw new DomainException('storage_lease_expired');
 sa_require_current($j,$readSource($j['trackKey']));
 $row=nd_storage_assets($j)[$active['key']]??null;if(!$row)throw new DomainException('storage_asset_changed');
 $file=&$m['files'][$active['key']];$command=$b['command'];
 if($command==='storage_fail'){
  if($file['state']!=='stored'){$file['state']='failed';$file['reason']=preg_match('/^[a-z_]{1,80}$/D',(string)($b['reason']??''))?$b['reason']:'storage_failed';}
  $m['active']['leaseUntil']=0;return ['ok'=>true,'state'=>$file['state']];
 }
 $m['active']['leaseUntil']=$now+900;
 if($command==='storage_credentials'&&$github)throw new DomainException('github_runtime_identity_required');
 if($command==='storage_credentials')return ['ok'=>true,'authorizationAllowed'=>true];
 if($github&&in_array($command,['storage_reserve','storage_complete'],true)){
  require_once __DIR__.'/session-shorts-github.php';return nd_github_operation($s,$j,$m,$file,$b,$now);
 }
 if($command==='storage_reserve'){
  foreach(['folderId','fileId'] as $field)if(!is_string($b[$field]??null)||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$b[$field]))throw new InvalidArgumentException('invalid_drive_id');
  $parent=$s['campaigns']['daily_shorts']['policy']['mediaStorage']['temporaryParentFolderId'];
  if($b['folderId']===$b['fileId']||in_array($parent,[$b['folderId'],$b['fileId']],true)||(!empty($m['folderId'])&&$m['folderId']!==$b['folderId'])||(!empty($file['fileId'])&&$file['fileId']!==$b['fileId']))throw new DomainException('storage_identity_conflict');
  foreach($m['files'] as $key=>$f)if($key!==$active['key']&&($f['fileId']??'')===$b['fileId'])throw new DomainException('storage_identity_conflict');
  $m['folderId']=$b['folderId'];$file['fileId']=$b['fileId'];
  return ['ok'=>true,'folderId'=>$m['folderId'],'fileId'=>$file['fileId']];
 }
 if($command==='storage_read'){
  $offset=$b['offset']??null;$path=lab_job_dir($j['id']).'/'.$row['asset']['file'];clearstatcache(true,$path);
  if(!is_int($offset)||$offset<0||$offset>=$file['bytes'])throw new InvalidArgumentException('invalid_file_offset');
  if(!is_file($path)||is_link($path)||filesize($path)!==$file['bytes'])throw new DomainException('storage_asset_changed');
  $input=fopen($path,'rb');try{fseek($input,$offset);$data=fread($input,min(524288,$file['bytes']-$offset));}finally{fclose($input);}
  if(strlen($data)!==min(524288,$file['bytes']-$offset))throw new DomainException('storage_asset_changed');
  // The runner validates the full received SHA-256 once. Avoid rehashing a
  // 512-MiB movie on the host for each of its 1,024 bounded chunks.
  return ['ok'=>true,'data'=>base64_encode($data),'offset'=>$offset,'nextOffset'=>$offset+strlen($data),'bytes'=>$file['bytes'],'sha256'=>$file['sha256'],'done'=>$offset+strlen($data)===$file['bytes']];
 }
 if($command==='storage_complete'){
  $receipt=$b['receipt']??[];
  if(empty($file['fileId'])||($receipt['fileId']??'')!==$file['fileId']||($receipt['folderId']??'')!==$m['folderId']||($receipt['sha256']??'')!==$file['sha256']||($receipt['bytes']??0)!==$file['bytes']||($receipt['readbackVerified']??false)!==true||($receipt['privateVerified']??false)!==true)throw new DomainException('storage_receipt_invalid');
  $file['state']='stored';$file['readbackVerified']=true;$file['privateVerified']=true;$file['storedAt']=gmdate('c',$now);unset($file['reason']);
  // No receipt from a model, schedule or private upload can authorize deletion.
  $m['cleanup']=['state'=>'publication_verification_required','deleted'=>0];
  $s['campaigns']['daily_shorts']['storage']=['jobId'=>$j['id'],'state'=>'stored','stored'=>count(array_filter($m['files'],fn($f)=>$f['state']==='stored')),'lastVerifiedAt'=>gmdate('c',$now),'cleanupState'=>'publication_verification_required','deletionExecutorVerified'=>false];
  if(($s['driveConnection']['owner']??'')===$owner&&($file['driveConnectionId']??'')===($s['driveConnection']['id']??''))$s['driveConnection']['workerVerifiedAt']=gmdate('c',$now);
  return ['ok'=>true,'state'=>'stored','fileId'=>$file['fileId'],'publicationReady'=>false];
 }
 throw new InvalidArgumentException('unknown_storage_command');
}
function nd_storage_dispatch(array $b,string $owner):array {
 if($owner==='')throw new DomainException('campaign_owner_required');
 if(($b['command']??'')==='storage_credentials'){
  require_once __DIR__.'/session-shorts-drive.php';
  lab_lock(fn(&$s)=>nd_storage_operation($s,$b,$owner,time(),'sa_source'));
  $snapshot=lab_read();$policy=nd_shorts_policy();$access=nsd_access($snapshot,$policy,$owner,time());
  return lab_lock(function(&$s)use($b,$owner,$policy,$access){
   nd_storage_operation($s,$b,$owner,time(),'sa_source');$result=nsd_access_commit($s,$policy,$owner,$access);
   $s['jobs'][$b['id']]['agent']['temporaryMedia']['files'][$b['key']]['driveConnectionId']=$access['connectionId'];return $result;
  });
 }
 if(($b['command']??'')==='storage_claim')return lab_lock(fn(&$s)=>nd_storage_claim($s,$owner,time(),'sa_source'));
 return lab_lock(fn(&$s)=>nd_storage_operation($s,$b,$owner,time(),'sa_source'));
}
