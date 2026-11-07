<?php
declare(strict_types=1);
require_once __DIR__.'/adapter-contract.php';
require_once __DIR__.'/dispatch-gate.php';
/** Fixed specialist dispatch. Reuses the existing durable consumer, receipt and fenced lease. */
function noa_engine_execute(array $event,string $consumer,array $context=[],?callable $read=null): array {
    $gate=noa_engine_dispatch_gate($event,$context);
    if(!$gate['ok'])return ['ok'=>false,'status'=>'blocked','error'=>$gate['error'],'consumer'=>$consumer];
    $adapter=noa_engine_adapter_check($event,$consumer,$context);
    if(!$adapter['ok'])return ['ok'=>false,'status'=>'blocked','error'=>$adapter['error'],'consumer'=>$consumer];
    if(in_array($consumer,['playlist','world','admin'],true)){
        if(!(($context['db']??null) instanceof PDO)||!is_array($context['directories']??null)||!is_string($context['web']??null))return ['ok'=>false,'error'=>'runtime_context_required'];
        require_once __DIR__.'/native-consumer.php';$result=n80_native_consume($context['db'],$event,$consumer,$context);$result['runtime']=['engine'=>'N80 Engine','module'=>$consumer,'operation'=>$adapter['operation']];return $result;
    }
    if($consumer!=='music'||($context['operation']??'')!=='music.verify_availability')
        return ['ok'=>false,'status'=>'blocked','error'=>'executor_not_installed','consumer'=>$consumer];
    if(!(($context['db']??null) instanceof PDO)||!is_int($context['jobId']??null)||$context['jobId']<1||!is_array($context['directories']??null))
        return ['ok'=>false,'status'=>'blocked','error'=>'runtime_context_required','consumer'=>$consumer];
    require_once __DIR__.'/music-consumer.php';
    $ready=n80_ready_event_from_job($context['db'],$context['jobId']);
    if(!$ready['ok'])return $ready;
    if($ready['event']!==$event)return ['ok'=>false,'error'=>'event_identity_mismatch'];
    $result=n80_music_consume($context['db'],$context['directories'],$context['jobId'],$context,$read);
    $result['runtime']=['engine'=>'N80 Engine','module'=>'music','operation'=>$adapter['operation']];
    return $result;
}
