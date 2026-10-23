<?php
declare(strict_types=1);
/** Pure N80 consumer receipt validation; no side effects or dispatch. */
function n80_receipt_validate(array $event,array $observation): array {
    if(($event['type']??null)!=='audio.ready'||($event['source']??null)!=='jukebox')
        return ['ok'=>false,'error'=>'unsupported_event'];
    if(($observation['ok']??false)!==true
       ||($observation['consumer']??null)!=='music'
       ||($observation['status']??null)!=='catalog_present'
       ||($observation['mutation']??null)!==false
       ||($observation['correlationId']??null)!==($event['correlationId']??null))
        return ['ok'=>false,'error'=>'observation_mismatch'];
    return ['ok'=>true,'effect'=>'catalog_observation_only',
        'eventId'=>$event['id'],'correlationId'=>$event['correlationId']];
}
