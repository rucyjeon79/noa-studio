<?php
declare(strict_types=1);
/** N80 Media uses existing Lab jobs, leases, final-output validation and storage. */
function n80_media_service_operations():array {
    return [
        'health'=>['module'=>'media','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'GET','store'=>'lab:state.json'],
        'claim'=>['module'=>'media','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json'],
        'asset'=>['module'=>'media','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'GET','store'=>'lab:state.json'],
        ...array_fill_keys(['prepare_final','commit_final','authorize_upload','checkpoint','output','finish_output','complete','failed'],
            ['module'=>'media','handler'=>'worker-media.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json']),
    ];
}
/** Only the verified Engine service dispatcher may invoke these fixed operations. */
function n80_media_service_execute(string $action,array $b,array $context):array {
    require_once __DIR__.'/guard.php';
    $gate=n80_guard_service_check(n80_media_service_operations()[$action]??null,$context);
    if(!$gate['ok'])return $gate;
    return require __DIR__.'/media-worker.php';
}

function n80_media_refresh_covers():array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
 require_once $bridge.'/storage.php';require_once $bridge.'/sound-core.php';require_once $bridge.'/music-readmodel.php';
 require_once $bridge.'/package-record.php';require_once $bridge.'/suno-cover.php';require_once __DIR__.'/media-covers.php';
 return n80_media_covers(noa_bridge_pdo(),n80_hub_root());
}
