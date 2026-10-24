<?php
declare(strict_types=1);
/** NOA ENGINE event envelope: validation only, no dispatch or side effects. */
function noa_engine_validate_event(array $event): array {
    $required=['id','type','source','subjectId','occurredAt','schemaVersion','correlationId'];
    foreach ($required as $key) {
        if (!array_key_exists($key,$event)) return ['ok'=>false,'error'=>'missing_'.$key];
    }
    foreach (['id','type','source','subjectId','occurredAt','correlationId'] as $key) {
        if (!is_string($event[$key]) || trim($event[$key])==='' || strlen($event[$key])>256) return ['ok'=>false,'error'=>'invalid_'.$key];
    }
    if (!is_int($event['schemaVersion']) || $event['schemaVersion']!==1) return ['ok'=>false,'error'=>'unsupported_schema'];
    if (strtotime($event['occurredAt'])===false) return ['ok'=>false,'error'=>'invalid_occurredAt'];
    $types=['audio.ready','audio.failed','playback.started','playlist.updated','sync.requested','youtube.synced','world.updated','ai.requested','ai.completed','ai.failed','operation.requested','operation.approved','upload.requested','deploy.verified','work.completed'];
    if (!in_array($event['type'],$types,true)) return ['ok'=>false,'error'=>'unknown_event_type'];
    return ['ok'=>true,'error'=>null];
}
