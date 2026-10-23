<?php
declare(strict_types=1);
require_once __DIR__.'/workflow.php';
/** NOA ENGINE durable outbox store; requires a separately provisioned writable directory.
 * Does not dispatch to legacy workers or alter their queues.
 */
function noa_engine_outbox_put(string $directory,array $event): array {
    $plan=noa_engine_workflow_plan($event);
    if(!$plan['ok'])return ['ok'=>false,'error'=>$plan['error']];
    if(!is_dir($directory)||is_link($directory)||!is_writable($directory))return ['ok'=>false,'error'=>'outbox_unavailable'];
    $id=$event['id'];
    if(!preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$id))return ['ok'=>false,'error'=>'invalid_event_id'];
    $path=rtrim($directory,'/').'/'.hash('sha256',$id).'.json';
    $data=json_encode(['event'=>$event,'plan'=>$plan,'createdAt'=>gmdate('c')],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $handle=@fopen($path,'x');
    if($handle===false)return ['ok'=>false,'error'=>'already_exists_or_io_error'];
    try {
        if(!flock($handle,LOCK_EX))return ['ok'=>false,'error'=>'lock_failed'];
        $written=fwrite($handle,$data);
        if($written===false||$written!==strlen($data)){ftruncate($handle,0);return ['ok'=>false,'error'=>'write_failed'];}
        fflush($handle);
        if(function_exists('fsync'))fsync($handle);
        return ['ok'=>true,'status'=>'stored','id'=>$id];
    } finally {flock($handle,LOCK_UN);fclose($handle);}
}
