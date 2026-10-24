<?php
declare(strict_types=1);
require_once __DIR__.'/lease-inbox.php';
/**
 * N80 durable lease state adapter. Opt-in; no workers are invoked.
 * One private-directory lock serializes state transitions. Callers must keep
 * the storage outside the web root and supply authenticated adapter identity.
 */
function n80_lease_state_transition(string $directory,string $eventId,string $consumer,string $action,int $now,?int $generation=null,int $ttl=60,int $maxAttempts=3,?array $receipt=null): array {
    if(!is_dir($directory)||is_link($directory)||!is_writable($directory))return ['ok'=>false,'error'=>'storage_unavailable'];
    foreach([$eventId,$consumer] as $v)if(!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$v))return ['ok'=>false,'error'=>'invalid_identifier'];
    $dir=rtrim($directory,'/');
    $path=$dir.'/'.hash('sha256',$eventId.'|'.$consumer).'.json';
    if(is_link($dir.'/.lease.lock'))return ['ok'=>false,'error'=>'unsafe_lock'];
    $lock=@fopen($dir.'/.lease.lock','c');
    if(!$lock)return ['ok'=>false,'error'=>'lock_unavailable'];
    $temp=null;
    try {
        if(!flock($lock,LOCK_EX))return ['ok'=>false,'error'=>'lock_failed'];
        if(is_link($path))return ['ok'=>false,'error'=>'invalid_state_file'];
        if(is_file($path)){
            $raw=@file_get_contents($path);
            $state=$raw===false?null:json_decode($raw,true);
            if(!is_array($state)||($state['eventId']??null)!==$eventId||($state['consumer']??null)!==$consumer)return ['ok'=>false,'error'=>'corrupt_state'];
        }else{$state=noa_engine_lease_new($eventId,$consumer);}
        $result=n80_lease_apply_fenced($state,$action,$now,$generation,$ttl,$maxAttempts);
        if($receipt!==null){
            if(!$result['ok'])return $result;
            if($action!=='ack'||$consumer!=='music'
               ||($receipt['eventId']??null)!==$eventId||($receipt['consumer']??null)!==$consumer
               ||($receipt['generation']??null)!==$generation
               ||($receipt['effect']??null)!=='music_catalog_availability_verified'
               ||!is_string($receipt['eventSha256']??null)||!preg_match('/^[a-f0-9]{64}$/D',$receipt['eventSha256'])
               ||($receipt['proof']['effect']??null)!=='music_catalog_availability_verified'
               ||($receipt['proof']['mediaIntegrityVerified']??null)!==true
               ||($receipt['proof']['catalogReferenceVerified']??null)!==true
               ||($receipt['proof']['publicDetailVerified']??null)!==true
               ||($receipt['proof']['mutation']??null)!==false||($receipt['proof']['businessDispatch']??null)!==false)
                return ['ok'=>false,'error'=>'invalid_completion_receipt'];
            $result['state']['receipt']=$receipt;
        }
        // Exhausted retries transition to dead_letter and must be durable.
        if(!$result['ok']&&($result['error']??'')!=='retry_exhausted')return $result;
        $payload=json_encode($result['state'],JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
        $temp=tempnam($dir,'.lease-');
        if($temp===false)return ['ok'=>false,'error'=>'staging_failed'];
        chmod($temp,0600);
        $h=@fopen($temp,'wb');
        if(!$h)return ['ok'=>false,'error'=>'staging_open_failed'];
        try{
            $offset=0;$length=strlen($payload);
            while($offset<$length){
                $n=fwrite($h,substr($payload,$offset));
                if($n===false||$n===0)return ['ok'=>false,'error'=>'write_failed'];
                $offset+=$n;
            }
            if(!fflush($h))return ['ok'=>false,'error'=>'flush_failed'];
            if(function_exists('fsync')&&!fsync($h))return ['ok'=>false,'error'=>'fsync_failed'];
        }finally{fclose($h);}
        if(!rename($temp,$path))return ['ok'=>false,'error'=>'rename_failed'];
        $temp=null;
        return $result;
    }finally{
        if($temp!==null&&is_file($temp))@unlink($temp);
        flock($lock,LOCK_UN);fclose($lock);
    }
}
