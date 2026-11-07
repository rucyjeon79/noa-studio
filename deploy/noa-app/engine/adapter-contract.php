<?php
declare(strict_types=1);
require_once __DIR__.'/router.php';
/** Installation is separate from activation. Only explicitly authenticated operations may run. */
function noa_engine_adapter_manifest(): array {
    return [
        'music'=>['events'=>['audio.ready'],'mode'=>'availability_verification','enabled'=>false,'installed'=>true,'operation'=>'music.verify_availability'],
        'playlist'=>['events'=>['audio.ready'],'mode'=>'read_model_refresh','enabled'=>false,'installed'=>true,'operation'=>'playlist.verify_read_model'],
        'world'=>['events'=>['youtube.synced'],'mode'=>'read_model_refresh','enabled'=>false,'installed'=>true,'operation'=>'world.verify_read_model'],
        'admin'=>['events'=>['operation.requested'],'mode'=>'readonly_integrity_audit','enabled'=>false,'installed'=>true,'operation'=>'admin.verify_integrity'],
    ];
}
function noa_engine_adapter_check(array $event,string $consumer,array $context=[]): array {
    $route=noa_engine_route_event($event);
    if(!$route['ok'])return ['ok'=>false,'error'=>$route['error']];
    if(!in_array($consumer,$route['consumers'],true))return ['ok'=>false,'error'=>'consumer_not_routed'];
    $adapter=noa_engine_adapter_manifest()[$consumer]??null;
    if($adapter===null)return ['ok'=>false,'error'=>'adapter_missing'];
    if(!in_array($event['type'],$adapter['events'],true))return ['ok'=>false,'error'=>'event_not_supported'];
    if($consumer==='music'&&($context['operation']??'')==='music.verify_availability'){
        if(($context['authenticatedByServer']??false)!==true||($context['principal']??'')!=='n80_music_consumer'
           ||($context['permission']??'')!=='music:verify')return ['ok'=>false,'error'=>'unauthorized'];
        if(($context['enabled']??false)!==true)return ['ok'=>false,'error'=>'adapter_disabled'];
        if($event['source']!=='jukebox')return ['ok'=>false,'error'=>'unsupported_event_source'];
        return ['ok'=>true,'operation'=>$adapter['operation']];
    }
    if(in_array($consumer,['playlist','world','admin'],true)&&($context['operation']??'')===$adapter['operation']){
        if(($context['authenticatedByServer']??false)!==true||($context['principal']??'')!=='n80_lab_worker'||($context['permission']??'')!=='native:verify')return ['ok'=>false,'error'=>'unauthorized'];
        if(($context['enabled']??false)!==true)return ['ok'=>false,'error'=>'adapter_disabled'];
        if($event['source']!==['playlist'=>'jukebox','world'=>'youtube','admin'=>'admin'][$consumer])return ['ok'=>false,'error'=>'unsupported_event_source'];
        if($consumer==='admin'&&!str_starts_with($event['subjectId'],'integrity-audit:'))return ['ok'=>false,'error'=>'unsupported_admin_operation'];
        return ['ok'=>true,'operation'=>$adapter['operation']];
    }
    if(!$adapter['enabled'])return ['ok'=>false,'error'=>'adapter_disabled'];
    return ['ok'=>false,'error'=>'adapter_executor_not_installed'];
}
