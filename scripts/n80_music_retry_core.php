<?php
declare(strict_types=1);
/** One explicitly reviewed retry cycle, preserving the failed state and its generation fence. */
function n80_music_repair_retry(string $directory,string $eventId,string $expectedSha,array $verified,int $now):array {
 if(($verified['ok']??false)!==true||($verified['event']['id']??null)!==$eventId||($verified['proof']['effect']??null)!=='music_catalog_availability_verified'||($verified['proof']['mediaIntegrityVerified']??false)!==true||($verified['proof']['catalogReferenceVerified']??false)!==true||($verified['proof']['publicDetailVerified']??false)!==true||($verified['proof']['mutation']??true)!==false||($verified['proof']['businessDispatch']??true)!==false)throw new RuntimeException('actual_verification_required');
 if(!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$eventId)||!preg_match('/^[a-f0-9]{64}$/D',$expectedSha)||realpath($directory)!==$directory||is_link($directory)||(fileperms($directory)&0077)!==0)throw new RuntimeException('unsafe_private_state');
 $path=$directory.'/'.hash('sha256',$eventId.'|music').'.json';$lockPath=$directory.'/.lease.lock';
 if(is_link($lockPath)||is_link($path))throw new RuntimeException('unsafe_state_file');$lock=fopen($lockPath,'c');$temp=null;
 try{
  if(!flock($lock,LOCK_EX))throw new RuntimeException('lock_failed');$raw=file_get_contents($path);if(!hash_equals($expectedSha,hash('sha256',$raw)))throw new RuntimeException('concurrent_state_preserved');$state=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
  if(($state['eventId']??null)!==$eventId||($state['consumer']??null)!=='music'||($state['status']??null)!=='dead_letter'||($state['attempts']??null)!==3||($state['generation']??null)!==3||($state['leaseUntil']??null)!==null||isset($state['receipt'])||isset($state['repair']))throw new RuntimeException('unreviewed_state_preserved');
  $archive=$directory.'/.pre-repair-'.$expectedSha;
  if(is_link($archive))throw new RuntimeException('unsafe_archive');
  if(is_file($archive)){if(file_get_contents($archive)!==$raw)throw new RuntimeException('archive_mismatch');}
  else{$h=fopen($archive,'x');chmod($archive,0600);try{if(fwrite($h,$raw)!==strlen($raw)||!fflush($h)||(function_exists('fsync')&&!fsync($h)))throw new RuntimeException('archive_write_failed');}finally{fclose($h);}}
  if(file_get_contents($archive)!==$raw)throw new RuntimeException('archive_readback_failed');
  $state['status']='pending';$state['attempts']=0;$state['lastError']=null;$state['repair']=['previousStateSha256'=>$expectedSha,'previousAttempts'=>3,'generationPreserved'=>3,'verifiedAt'=>$now,'reason'=>'signed_music_read_and_inline_detail_fixed'];
  $payload=json_encode($state,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);$temp=tempnam($directory,'.retry-');chmod($temp,0600);$h=fopen($temp,'wb');try{if(fwrite($h,$payload)!==strlen($payload)||!fflush($h)||(function_exists('fsync')&&!fsync($h)))throw new RuntimeException('state_write_failed');}finally{fclose($h);}
  if(!rename($temp,$path))throw new RuntimeException('atomic_replace_failed');$temp=null;if(file_get_contents($path)!==$payload)throw new RuntimeException('retry_readback_failed');
  return ['ok'=>true,'retryPrepared'=>true,'priorStateArchived'=>true,'generationPreserved'=>3,'businessAck'=>false,'databaseWrites'=>0];
 }finally{if($temp!==null&&is_file($temp))unlink($temp);flock($lock,LOCK_UN);fclose($lock);}
}
