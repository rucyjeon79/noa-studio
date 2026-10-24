<?php
declare(strict_types=1);
require_once __DIR__.'/readonly-pipeline.php';
require_once dirname(__DIR__).'/jukebox/core.php';
require_once dirname(__DIR__,2).'/noa-bridge/sound-core.php';
require_once dirname(__DIR__,2).'/noa-bridge/music-readmodel.php';
function n80_music_safe_reason(string $reason):string {
    $known=['unsupported_public_read','public_read_failed','public_url_access_disabled','public_http_non_success','public_read_too_large',
        'public_tls_failed','public_read_timeout','public_network_failed','invalid_job_id','source_not_ready','superseded_job','missing_commit_timestamp',
        'job_upload_identity_mismatch','public_catalog_missing','ready_audio_integrity_failed','public_audio_reference_mismatch',
        'public_route_failed','public_readmodel_invalid','public_asset_reference_mismatch','public_detail_mismatch',
        'public_audio_bytes_mismatch','source_changed_during_verification','event_changed'];
    return in_array($reason,$known,true)?$reason:'verification_error';
}
function n80_music_safe_phase():string {
    $phase=$GLOBALS['n80_music_phase']??'bootstrap';
    return in_array($phase,['bootstrap','load_runtime','policy','db_config','db_connect','db_readonly','consumer','ready_identity',
        'local_media','public_catalog','public_detail','public_audio','public_readmodel','final_source'],true)?$phase:'unknown';
}
/** Fixed-origin, unauthenticated GET only; never accept a caller URL. */
function n80_music_public_get(string $kind,string $key):array {
    $paths=['catalog'=>'/noa-music.php','detail'=>'/noa-music-detail.php?key='.rawurlencode($key),
        'audio'=>'/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type=audio'];
    if(!isset($paths[$kind]))throw new InvalidArgumentException('unsupported_public_read');
    $GLOBALS['n80_music_phase']='public_'.$kind;
    $GLOBALS['n80_music_http_status']=0;
    if(!filter_var(ini_get('allow_url_fopen'),FILTER_VALIDATE_BOOLEAN))throw new RuntimeException('public_url_access_disabled');
    $limit=$kind==='audio'?4096:4194304;
    $headers="X-N80-Availability-Check: 1\r\nAccept: ".($kind==='detail'?'application/json':'*/*')."\r\n";
    if($kind==='audio')$headers.="Range: bytes=0-4095\r\n";
    $ctx=stream_context_create(['http'=>['method'=>'GET','header'=>$headers,'timeout'=>25,'follow_location'=>0,'ignore_errors'=>true],
        'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
    error_clear_last();$started=microtime(true);
    $body=@file_get_contents('https://noastudio.ai.kr'.$paths[$kind],false,$ctx,0,$limit+($kind==='audio'?0:1));
    $response=$http_response_header??[];
    if(preg_match('~^HTTP/\S+ ([0-9]{3})(?: |$)~',$response[0]??'',$status))$GLOBALS['n80_music_http_status']=(int)$status[1];
    if($body===false){
        $warning=(string)(error_get_last()['message']??'');
        if(stripos($warning,'crypto')!==false||stripos($warning,'SSL')!==false||stripos($warning,'certificate')!==false)throw new RuntimeException('public_tls_failed');
        if(microtime(true)-$started>=24||stripos($warning,'timed out')!==false)throw new RuntimeException('public_read_timeout');
        throw new RuntimeException('public_network_failed');
    }
    if(strlen($body)>$limit)throw new RuntimeException('public_read_too_large');
    if(!preg_match('~^HTTP/\S+ (200|206)(?: |$)~',$response[0]??'',$match))throw new RuntimeException('public_http_non_success');
    return ['status'=>(int)$match[1],'body'=>$body];
}
/** Verify this exact job, local MP3 and the same public MUSIC read model. No SQL writes. */
function n80_music_availability(PDO $db,int $jobId,callable $read):array {
    $GLOBALS['n80_music_phase']='ready_identity';
    $ready=n80_ready_event_from_job($db,$jobId);
    if(!$ready['ok'])return $ready;
    $event=$ready['event'];$key=$event['subjectId'];
    $identity=$db->prepare('SELECT j.song_key AS job_song,u.song_key AS upload_song FROM noa_jukebox_audio_jobs j JOIN noa_jukebox_uploads u ON u.id=j.upload_id WHERE j.id=?');
    $identity->execute([$jobId]);$identityRow=$identity->fetch(PDO::FETCH_ASSOC);
    if(!$identityRow||$identityRow['job_song']!==$key||$identityRow['upload_song']!==$key)
        return ['ok'=>false,'error'=>'job_upload_identity_mismatch'];
    $document=nj_document($db,$key);
    if(!$document||!in_array($document['_kind']??'', ['single','story'],true)||!noa_sound_visible($document,false))
        return ['ok'=>false,'error'=>'public_catalog_missing'];
    $asset=nj_find($db,$key);
    $GLOBALS['n80_music_phase']='local_media';
    if(!nj_verified($asset,'audio'))return ['ok'=>false,'error'=>'ready_audio_integrity_failed'];
    $audio=noa_music_asset_url([$key=>$asset],$key,noa_sound_suno($document['body']??[]),'audio');
    if($audio===''||$audio!==nj_url($key,'audio'))return ['ok'=>false,'error'=>'public_audio_reference_mismatch'];
    $catalog=$read('catalog',$key);$detail=$read('detail',$key);$stream=$read('audio',$key);
    $GLOBALS['n80_music_phase']='public_readmodel';
    if(($catalog['status']??0)!==200||($detail['status']??0)!==200||!in_array($stream['status']??0,[200,206],true))
        return ['ok'=>false,'error'=>'public_route_failed'];
    if(!preg_match('/const records=(.*?);\s*const collections=/s',$catalog['body']??'',$m))
        return ['ok'=>false,'error'=>'public_readmodel_invalid'];
    $rows=json_decode($m[1],true);$matched=[];
    foreach(is_array($rows)?$rows:[] as $row)if(($row['key']??null)===$key)$matched[]=$row;
    if(count($matched)!==1||($matched[0]['audio']??null)!==$audio
        ||($matched[0]['audioSha']??null)!==$asset['audio_sha256']||(int)($matched[0]['audioBytes']??0)!==(int)$asset['audio_bytes'])
        return ['ok'=>false,'error'=>'public_asset_reference_mismatch'];
    $fields=['key'=>$key]+noa_music_detail_fields($document);$actual=json_decode($detail['body']??'',true);
    if($actual!==$fields)return ['ok'=>false,'error'=>'public_detail_mismatch'];
    $path=nj_file((string)$asset['audio_path']);$prefix=file_get_contents($path,false,null,0,4096);
    if($prefix===false||$prefix===''||!hash_equals(hash('sha256',$prefix),hash('sha256',$stream['body']??'')))
        return ['ok'=>false,'error'=>'public_audio_bytes_mismatch'];
    // Recheck latest committed identity and physical bytes after HTTP work.
    $GLOBALS['n80_music_phase']='final_source';
    $again=n80_ready_event_from_job($db,$jobId);$latest=nj_find($db,$key);
    if(!$again['ok']||$again['event']!==$event||!$latest||$latest['audio_sha256']!==$asset['audio_sha256']
       ||(int)$latest['audio_bytes']!==(int)$asset['audio_bytes']||!nj_verified($latest,'audio'))
        return ['ok'=>false,'error'=>'source_changed_during_verification'];
    return ['ok'=>true,'event'=>$event,'proof'=>['effect'=>'music_catalog_availability_verified','jobId'=>$jobId,
        'subjectId'=>$key,'assetSha256'=>$asset['audio_sha256'],'assetBytes'=>(int)$asset['audio_bytes'],
        'detailSha256'=>hash('sha256',json_encode($fields,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)),
        'streamPrefixSha256'=>hash('sha256',$prefix),'catalogReferenceVerified'=>true,'publicDetailVerified'=>true,
        'mediaIntegrityVerified'=>true,'mutation'=>false,'businessDispatch'=>false]];
}
/** Authenticated diagnostics never store an event, claim a lease or issue ACK. */
function n80_music_diagnose(PDO $db,int $jobId,?callable $read=null):array {
    $result=['ok'=>true,'effect'=>'music_availability_diagnostic_only','jobId'=>$jobId,'available'=>false,
        'businessAck'=>false,'automaticDispatch'=>false,'queueMutation'=>false,'databaseWrites'=>0,
        'urlFopenEnabled'=>filter_var(ini_get('allow_url_fopen'),FILTER_VALIDATE_BOOLEAN)];
    try{
        $verified=n80_music_availability($db,$jobId,$read??'n80_music_public_get');
        $result['available']=$verified['ok'];$result['reason']=$verified['ok']?'verified':n80_music_safe_reason($verified['error']??'verification_error');
    }catch(Throwable $e){
        $result['reason']=n80_music_safe_reason($e->getMessage());
        $result['exceptionClass']=in_array(get_class($e),['PDOException','RuntimeException','TypeError','Error'],true)?get_class($e):'other';
        if($e instanceof PDOException&&preg_match('/^[A-Z0-9]{5}$/D',(string)$e->getCode()))$result['sqlState']=(string)$e->getCode();
    }
    $result['phase']=n80_music_safe_phase();$result['httpStatus']=(int)($GLOBALS['n80_music_http_status']??0);return $result;
}
