<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}

/** Called only after the existing owner, source and lease fences. */
function nd_github_operation(array &$s,array &$j,array &$m,array &$file,array $b,int $now):array {
 $name='n80-media-'.hash('sha256',$j['id'].'|'.$b['key']);
 if($b['command']==='storage_reserve'){
  $run=$b['run']??[];
  if(($run['repository']??'')!=='rucyjeon79/noa-studio'||($run['name']??'')!==$name
   ||!is_int($run['runId']??null)||$run['runId']<1||!is_int($run['attempt']??null)||$run['attempt']<1)throw new InvalidArgumentException('invalid_artifact_identity');
  $runs=$file['artifactRuns']??[];
  if(!in_array($run,$runs,true)){
   if(count($runs)>=3)throw new DomainException('artifact_retry_limit');
   $runs[]=$run;
  }
  $file['artifactRuns']=$runs;
  return ['ok'=>true,'artifactRuns'=>$runs];
 }
 $r=$b['receipt']??[];$run=$r['run']??[];
 if(!in_array($run,$file['artifactRuns']??[],true)||!is_int($r['artifactId']??null)||$r['artifactId']<1
  ||($r['sha256']??'')!==$file['sha256']||($r['bytes']??0)!==$file['bytes']
  ||($r['readbackVerified']??false)!==true||($r['encryption']??'')!=='AES-256-GCM'
  ||!preg_match('/^[a-f0-9]{64}$/D',(string)($r['ciphertextSha256']??'')))throw new DomainException('storage_receipt_invalid');
 if($file['state']==='stored'&&($file['receipt']??[])!==$r)throw new DomainException('storage_identity_conflict');
 $file['state']='stored';$file['receipt']=$r;$file['storedAt']=gmdate('c',$now);unset($file['reason']);
 // GitHub storage never accepts a scene or enables YouTube publication.
 $m['cleanup']=['state'=>'publication_verification_required','deleted'=>0];
 $s['campaigns']['daily_shorts']['storage']=['provider'=>'github_actions_artifact','jobId'=>$j['id'],'state'=>'stored',
  'stored'=>count(array_filter($m['files'],fn($f)=>$f['state']==='stored')),'lastVerifiedAt'=>gmdate('c',$now),
  'encrypted'=>true,'cleanupState'=>'publication_verification_required','deletionExecutorVerified'=>false];
 return ['ok'=>true,'state'=>'stored','artifactId'=>$r['artifactId'],'publicationReady'=>false];
}
