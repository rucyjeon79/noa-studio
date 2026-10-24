<?php
declare(strict_types=1);
require_once __DIR__.'/music-availability.php';
require_once __DIR__.'/lease-state.php';
/** Fixed private policy in production; an alternate path is for isolated tests. */
function n80_music_policy_enabled(string $path='/hosting/noastudio/noa-ai-lab/n80-music-consumer-policy.json'):bool {
    $real=realpath($path);$info=@lstat($path);
    if(!$real||$real!==$path||!$info||is_link($path)||!is_file($path)||!is_readable($path)
       ||($info['mode']&0777)!==0600||$info['size']<1||$info['size']>1024)return false;
    $raw=@file_get_contents($path,false,null,0,1025);if($raw===false||strlen($raw)>1024)return false;
    $value=json_decode($raw,true);
    return is_array($value)&&count($value)===3&&!array_diff(array_keys($value),['version','enabled','exactConsumer'])
        &&($value['version']??null)===1&&($value['enabled']??null)===true
        &&($value['exactConsumer']??null)==='music_catalog_availability_verified';
}
/** Narrow availability consumer. Does not change the generic executor or route. */
function n80_music_consume(PDO $db,array $directories,int $jobId,array $context,?callable $read=null):array {
    if(($context['enabled']??false)!==true)return ['ok'=>false,'error'=>'music_consumer_disabled'];
    if(($context['authenticatedByServer']??false)!==true||($context['principal']??null)!=='n80_music_consumer'
       ||($context['permission']??null)!=='music:verify')return ['ok'=>false,'error'=>'unauthorized'];
    $web=realpath(dirname(__DIR__,2));
    foreach(['events','leases'] as $kind){
        $dir=$directories[$kind]??'';$real=realpath($dir);
        if(!$web||!$real||$real!==rtrim($dir,'/')||!is_dir($dir)||!is_writable($dir)||is_link($dir)
           ||$real===$web||str_starts_with($real,$web.'/')||((fileperms($dir)&0077)!==0))
            return ['ok'=>false,'error'=>'unsafe_private_store'];
    }
    $ready=n80_ready_event_from_job($db,$jobId);if(!$ready['ok'])return $ready;
    $event=$ready['event'];$eventHash=hash('sha256',json_encode($event,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    $stored=noa_engine_store_event($directories['events'],$event);if(!$stored['ok'])return $stored;
    $now=time();$claim=n80_lease_state_transition($directories['leases'],$event['id'],'music','claim',$now,null,120,3);
    if(!$claim['ok']){
        $state=$claim['state']??[];$receipt=$state['receipt']??[];
        if(($state['status']??null)==='succeeded'&&($receipt['eventSha256']??null)===$eventHash
           &&($receipt['eventId']??null)===$event['id']&&($receipt['consumer']??null)==='music'
           &&($receipt['correlationId']??null)===$event['correlationId']&&($receipt['generation']??null)===($state['generation']??null)
           &&($receipt['effect']??null)==='music_catalog_availability_verified'
           &&($receipt['proof']['mediaIntegrityVerified']??null)===true
           &&($receipt['proof']['catalogReferenceVerified']??null)===true&&($receipt['proof']['publicDetailVerified']??null)===true
           &&($receipt['proof']['mutation']??null)===false&&($receipt['proof']['businessDispatch']??null)===false)
            return ['ok'=>true,'status'=>'already_acknowledged','receipt'=>$receipt,'replayed'=>true];
        return $claim;
    }
    $generation=$claim['state']['generation'];
    try{
        $verified=n80_music_availability($db,$jobId,$read??'n80_music_public_get');
        if(!$verified['ok']||$verified['event']!==$event)throw new RuntimeException($verified['error']??'event_changed');
        $receipt=['eventId'=>$event['id'],'eventSha256'=>$eventHash,'correlationId'=>$event['correlationId'],
            'consumer'=>'music','generation'=>$generation,'effect'=>'music_catalog_availability_verified',
            'verifiedAt'=>gmdate('c'),'proof'=>$verified['proof']];
        // Receipt and succeeded state share one fsynced atomic rename under the
        // existing fenced lease lock: no ACK can exist without its proof.
        $ack=n80_lease_state_transition($directories['leases'],$event['id'],'music','ack',time(),$generation,120,3,$receipt);
        if(!$ack['ok'])return $ack;
        $path=$directories['leases'].'/'.hash('sha256',$event['id'].'|music').'.json';
        $readback=json_decode((string)file_get_contents($path),true);
        if($readback!==$ack['state'])return ['ok'=>false,'error'=>'ack_readback_failed'];
        return ['ok'=>true,'status'=>'acknowledged','receipt'=>$ack['state']['receipt'],'replayed'=>false];
    }catch(Throwable $error){
        $fail=n80_lease_state_transition($directories['leases'],$event['id'],'music','fail',time(),$generation,120,3);
        return ['ok'=>false,'error'=>'music_availability_not_verified','retryStatus'=>$fail['state']['status']??'lease_changed'];
    }
}
