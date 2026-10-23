<?php
declare(strict_types=1);
require_once __DIR__.'/authenticated-probe.php';
require_once __DIR__.'/durable-store.php';
/**
 * N80 verified read-only pipeline.
 * Caller must be trusted server code with a server-authenticated principal.
 * No public endpoint, no worker execution, no ACK or legacy data mutation.
 */
function n80_readonly_pipeline(PDO $db,string $privateEventDir,array $event,array $serverContext): array {
    if(($serverContext['authenticatedByServer']??false)!==true
       ||($serverContext['principal']??'')!=='jukebox_worker'
       ||($serverContext['permission']??'')!=='catalog:read')
        return ['ok'=>false,'error'=>'unauthorized'];
    // Never persist event payloads in the publicly served application tree.
    $storage=realpath($privateEventDir);
    $webRoot=realpath(dirname(__DIR__,2));
    if($storage===false||$webRoot===false||!is_dir($storage)||is_link($privateEventDir)
       ||($storage===$webRoot||str_starts_with($storage,$webRoot.DIRECTORY_SEPARATOR))
       ||((fileperms($storage)&0007)!==0))
        return ['ok'=>false,'error'=>'unsafe_event_storage','ackEligible'=>false];
    $probe=n80_music_probe_authorized($db,$event,$serverContext);
    if(!$probe['ok'])return $probe;
    if($probe['status']!=='catalog_present')
        return ['ok'=>false,'error'=>'catalog_missing','ackEligible'=>false];
    $stored=noa_engine_store_event($privateEventDir,$event);
    if(!$stored['ok'])return ['ok'=>false,'error'=>$stored['error'],'ackEligible'=>false];
    return ['ok'=>true,'mode'=>'read_only','status'=>'event_recorded',
      'storageStatus'=>$stored['status'],'consumer'=>'music',
      'correlationId'=>$event['correlationId'],'ackEligible'=>false,
      'workerExecuted'=>false];
}

/**
 * Opt-in source-of-truth check before accepting an audio.ready event.
 * The trusted caller supplies the DB handle; no public endpoint or job trigger.
 * A ready upload and its ready audio job must agree on song key and upload id.
 */
function n80_verified_ready_pipeline(PDO $db,string $privateEventDir,array $event,array $serverContext): array {
    if(($serverContext['authenticatedByServer']??false)!==true
       ||($serverContext['principal']??'')!=='jukebox_worker'
       ||($serverContext['permission']??'')!=='catalog:read')
        return ['ok'=>false,'error'=>'unauthorized'];
    $validation=noa_engine_validate_event($event);
    if(!$validation['ok'])return ['ok'=>false,'error'=>$validation['error']];
    if($event['source']!=='jukebox'||$event['type']!=='audio.ready')
        return ['ok'=>false,'error'=>'unsupported_event_source'];
    $q=$db->prepare("SELECT u.id FROM noa_jukebox_uploads u
        JOIN noa_jukebox_audio_jobs j ON j.upload_id=u.id
        WHERE u.song_key=? AND u.status='ready' AND j.status='ready'
        ORDER BY j.id DESC LIMIT 1");
    $q->execute([$event['subjectId']]);
    if($q->fetchColumn()===false)
        return ['ok'=>false,'error'=>'source_not_ready','ackEligible'=>false];
    return n80_readonly_pipeline($db,$privateEventDir,$event,$serverContext);
}
