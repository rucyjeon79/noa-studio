<?php
declare(strict_types=1);
/**
 * NOA ENGINE consumer receipt: opt-in idempotency marker.
 * This does not execute jobs, consume JUKEBOX FIFO or modify legacy data.
 */
function noa_engine_inbox_claim(string $directory,string $eventId,string $consumer): array {
    if (!is_dir($directory)||is_link($directory)||!is_writable($directory))return ['ok'=>false,'error'=>'inbox_unavailable'];
    foreach ([$eventId,$consumer] as $value) {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$value))return ['ok'=>false,'error'=>'invalid_identifier'];
    }
    $key=hash('sha256',$eventId.'|'.$consumer);
    $path=rtrim($directory,'/').'/'.$key.'.json';
    $handle=@fopen($path,'x');
    if($handle===false)return ['ok'=>false,'error'=>'already_claimed_or_io_error'];
    try {
        if(!flock($handle,LOCK_EX))return ['ok'=>false,'error'=>'lock_failed'];
        $payload=json_encode(['eventId'=>$eventId,'consumer'=>$consumer,'claimedAt'=>gmdate('c'),'state'=>'claimed'],JSON_THROW_ON_ERROR);
        if(fwrite($handle,$payload)!==strlen($payload))return ['ok'=>false,'error'=>'write_failed'];
        fflush($handle);
        if(function_exists('fsync'))fsync($handle);
        return ['ok'=>true,'status'=>'claimed','key'=>$key];
    } finally {flock($handle,LOCK_UN);fclose($handle);}
}
