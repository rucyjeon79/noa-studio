<?php
declare(strict_types=1);
/** Release pointer is published only after APK signing, device tests and hash verification. */
function n80_app_update_status(string $root): array {
    $path=rtrim($root,'/').'/noa-android-release.json';
    $pending=['available'=>false,'status'=>'not_published','automaticInstall'=>false];
    if(!is_file($path)||is_link($path)||filesize($path)>16384)return $pending;
    $r=json_decode((string)file_get_contents($path),true);
    if(!is_array($r)||($r['schemaVersion']??null)!==1||($r['app']??'')!=='NOA STUDIO'
       ||($r['applicationId']??'')!=='kr.ai.noastudio'||!is_int($r['versionCode']??null)
       ||$r['versionCode']<1||$r['versionCode']>2100000000
       ||($r['file']??'')!=='noa-studio-android-build-'.$r['versionCode'].'.apk'
       ||!preg_match('/^[a-f0-9]{64}$/D',$r['sha256']??'')
       ||!preg_match('/^[a-f0-9]{40}$/D',$r['commit']??'')
       ||!preg_match('/^[1-9][0-9]*$/D',(string)($r['runId']??'')))return $pending;
    return ['available'=>true,'status'=>'published','versionCode'=>$r['versionCode'],
        'url'=>'https://noastudio.ai.kr/'.$r['file'],'sha256'=>$r['sha256'],
        'commit'=>$r['commit'],'runId'=>$r['runId'],'automaticInstall'=>false,
        'delivery'=>'user_confirmed_apk','playPublication'=>'not_connected'];
}
