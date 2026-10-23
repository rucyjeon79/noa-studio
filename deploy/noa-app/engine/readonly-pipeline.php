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
    // Check the latest job, not any historical ready job for this song.
    // A newer in-progress replacement must not inherit an old ready receipt.
    $q=$db->prepare("SELECT u.status AS upload_status,j.status AS job_status
        FROM noa_jukebox_audio_jobs j
        JOIN noa_jukebox_uploads u ON u.id=j.upload_id
        WHERE u.song_key=? ORDER BY j.id DESC LIMIT 1");
    $q->execute([$event['subjectId']]);
    $latest=$q->fetch(PDO::FETCH_ASSOC);
    if(!$latest||$latest['upload_status']!=='ready'||$latest['job_status']!=='ready')
        return ['ok'=>false,'error'=>'source_not_ready','ackEligible'=>false];
    return n80_readonly_pipeline($db,$privateEventDir,$event,$serverContext);
}

/**
 * Derive a stable audio.ready envelope from an actual committed JUKEBOX job.
 * A retry uses the same event ID; a replacement job gets a distinct ID.
 * No side effects, no public endpoint, no claims of worker authentication.
 */
function n80_ready_event_from_job(PDO $db,int $jobId): array {
    if($jobId<1)return ['ok'=>false,'error'=>'invalid_job_id'];
    $q=$db->prepare("SELECT j.id AS job_id,j.status AS job_status,
        u.id AS upload_id,u.song_key,u.status AS upload_status
        FROM noa_jukebox_audio_jobs j
        JOIN noa_jukebox_uploads u ON u.id=j.upload_id
        WHERE j.id=? LIMIT 1");
    $q->execute([$jobId]);
    $row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row||$row['job_status']!=='ready'||$row['upload_status']!=='ready')
        return ['ok'=>false,'error'=>'source_not_ready'];
    $latest=$db->prepare("SELECT MAX(j.id) FROM noa_jukebox_audio_jobs j
        JOIN noa_jukebox_uploads u ON u.id=j.upload_id WHERE u.song_key=?");
    $latest->execute([$row['song_key']]);
    if((int)$latest->fetchColumn()!==$jobId)
        return ['ok'=>false,'error'=>'superseded_job'];
    $id='n80-jukebox-'.hash('sha256',(string)$row['upload_id'].'|'.$jobId);
    $event=['id'=>$id,'type'=>'audio.ready','source'=>'jukebox',
        'subjectId'=>(string)$row['song_key'],'occurredAt'=>gmdate('c'),
        'schemaVersion'=>1,'correlationId'=>$id];
    $validation=noa_engine_validate_event($event);
    return $validation['ok']?['ok'=>true,'event'=>$event]:$validation;
}
