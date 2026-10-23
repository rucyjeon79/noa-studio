<?php
declare(strict_types=1);
require_once __DIR__.'/workflow.php';
/**
 * Additive, opt-in event store. Writes are atomic via same-directory staging and rename.
 * No dispatcher, public endpoint, database migration or legacy worker invocation.
 */
function noa_engine_store_event(string $directory,array $event): array {
    $plan=noa_engine_workflow_plan($event);
    if(!$plan['ok'])return ['ok'=>false,'error'=>$plan['error']];
    if(!is_dir($directory)||is_link($directory)||!is_writable($directory))return ['ok'=>false,'error'=>'store_unavailable'];
    $id=$event['id'];
    if(!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$id))return ['ok'=>false,'error'=>'invalid_id'];
    $dir=rtrim($directory,'/');
    $target=$dir.'/'.hash('sha256',$id).'.json';
    $payload=json_encode(['event'=>$event,'plan'=>$plan],JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
    $lock=@fopen($dir.'/.engine.lock','c');
    if(!$lock)return ['ok'=>false,'error'=>'lock_unavailable'];
    $temp=null;
    try {
        if(!flock($lock,LOCK_EX))return ['ok'=>false,'error'=>'lock_failed'];
        if(is_file($target)){
            $existing=@file_get_contents($target);
            if($existing===false)return ['ok'=>false,'error'=>'existing_unreadable'];
            $decoded=json_decode($existing,true);
            return ($decoded!==null&&($decoded['event']??null)===$event)
                ? ['ok'=>true,'status'=>'already_stored','id'=>$id]
                : ['ok'=>false,'error'=>'id_conflict'];
        }
        $temp=tempnam($dir,'.engine-');
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
        if(!rename($temp,$target))return ['ok'=>false,'error'=>'rename_failed'];
        $temp=null;
        return ['ok'=>true,'status'=>'stored','id'=>$id];
    }finally{
        if($temp!==null&&is_file($temp))@unlink($temp);
        flock($lock,LOCK_UN);fclose($lock);
    }
}
