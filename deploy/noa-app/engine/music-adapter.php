<?php
declare(strict_types=1);
require_once __DIR__.'/event-contract.php';
/**
 * N80 MUSIC read-only adapter. Uses the existing noa_documents catalog,
 * never mutates data or claims that a playback refresh has happened.
 * Only a server-authenticated dispatcher may provide its PDO connection.
 */
function n80_music_catalog_probe(PDO $db,array $event): array {
    $check=noa_engine_validate_event($event);
    if(!$check['ok'])return ['ok'=>false,'error'=>$check['error']];
    if($event['type']!=='audio.ready'||$event['source']!=='jukebox')
        return ['ok'=>false,'error'=>'unsupported_event_source'];
    $key=$event['subjectId'];
    if(strlen($key)>128||preg_match('/[\x00-\x1F]/',$key))
        return ['ok'=>false,'error'=>'invalid_catalog_key'];
    $q=$db->prepare("SELECT doc_key FROM noa_documents WHERE doc_key=? AND kind IN ('single','playlist','story') LIMIT 1");
    $q->execute([$key]);
    $found=$q->fetchColumn()!==false;
    return ['ok'=>true,'status'=>$found?'catalog_present':'catalog_missing',
        'consumer'=>'music','correlationId'=>$event['correlationId'],
        'mutation'=>false,'ackEligible'=>false];
}
