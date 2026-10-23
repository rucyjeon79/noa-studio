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
