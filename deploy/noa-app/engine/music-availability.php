<?php
declare(strict_types=1);
require_once __DIR__.'/readonly-pipeline.php';
require_once dirname(__DIR__).'/jukebox/core.php';
require_once dirname(__DIR__,2).'/noa-bridge/sound-core.php';
require_once dirname(__DIR__,2).'/noa-bridge/music-readmodel.php';
/** Fixed-origin, unauthenticated GET only; never accept a caller URL. */
function n80_music_public_get(string $kind,string $key):array {
    $paths=['catalog'=>'/noa-music.php','detail'=>'/noa-music-detail.php?key='.rawurlencode($key),
        'audio'=>'/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type=audio'];
    if(!isset($paths[$kind]))throw new InvalidArgumentException('unsupported_public_read');
    $limit=$kind==='audio'?4096:4194304;
    $headers="X-N80-Availability-Check: 1\r\nAccept: ".($kind==='detail'?'application/json':'*/*')."\r\n";
    if($kind==='audio')$headers.="Range: bytes=0-4095\r\n";
    $ctx=stream_context_create(['http'=>['method'=>'GET','header'=>$headers,'timeout'=>25,'follow_location'=>0,'ignore_errors'=>true],
        'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
    $body=@file_get_contents('https://noastudio.ai.kr'.$paths[$kind],false,$ctx,0,$limit+($kind==='audio'?0:1));
    $response=$http_response_header??[];
    if($body===false||strlen($body)>$limit||!preg_match('~^HTTP/\S+ (200|206) ~',$response[0]??'',$match))
        throw new RuntimeException('public_read_failed');
    return ['status'=>(int)$match[1],'body'=>$body];
}
/** Verify this exact job, local MP3 and the same public MUSIC read model. No SQL writes. */
function n80_music_availability(PDO $db,int $jobId,callable $read):array {
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
    if(!nj_verified($asset,'audio'))return ['ok'=>false,'error'=>'ready_audio_integrity_failed'];
    $audio=noa_music_asset_url([$key=>$asset],$key,noa_sound_suno($document['body']??[]),'audio');
    if($audio===''||$audio!==nj_url($key,'audio'))return ['ok'=>false,'error'=>'public_audio_reference_mismatch'];
    $catalog=$read('catalog',$key);$detail=$read('detail',$key);$stream=$read('audio',$key);
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
