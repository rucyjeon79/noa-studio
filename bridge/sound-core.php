<?php
declare(strict_types=1);
// Separate media contracts. No network fetches, private Suno API or guessed CDN URLs.
function noa_sound_suno(array $body): string {
    foreach(['sunoShareUrl','sunoUrl'] as $key){
        $value=$body[$key]??'';if(!is_string($value)||!filter_var($value,FILTER_VALIDATE_URL))continue;
        $u=parse_url($value);
        if(($u['scheme']??'')==='https'&&in_array(strtolower($u['host']??''),['suno.com','www.suno.com','suno.ai','www.suno.ai'],true)&&empty($u['user'])&&empty($u['pass'])&&!isset($u['port']))return $value;
    }
    return '';
}
function noa_sound_visible(array $document,bool $admin): bool {
    // YouTube's private/public state is not Suno's publication state.
    // Preserve explicit editorial privacy for the complete record.
    return $admin||!in_array($document['visibility']??$document['publicStatus']??'public',['private','draft','unlisted','hidden'],true);
}
function noa_sound_audio(array $body,string $webRoot): string {
    $url=$body['audioUrl']??'';$check=$body['audioVerification']??[];
    if(!is_string($url)||!preg_match('~^https://noastudio[.]ai[.]kr/data/noa-audio/([A-Za-z0-9_-][A-Za-z0-9_.-]*[.](?:mp3|m4a|ogg|wav|flac|aac))$~D',$url,$m))return '';
    if(!is_array($check)||($check['status']??'')!=='verified'||!preg_match('/^[a-f0-9]{64}$/D',(string)($check['sha256']??'')))return '';
    $base=realpath($webRoot.'/data/noa-audio');$path=realpath($webRoot.'/data/noa-audio/'.$m[1]);
    if(!$base||!$path||dirname($path)!==$base||!is_file($path)||!is_readable($path)||filesize($path)===0)return '';
    if(!hash_equals($check['sha256'],hash_file('sha256',$path)))return '';
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
    return in_array($mime,['audio/mpeg','audio/mp4','audio/x-m4a','audio/ogg','application/ogg','audio/x-wav','audio/wav','audio/flac','audio/x-flac','audio/aac','audio/x-hx-aac-adts'],true)?$url:'';
}
function noa_sound_cover(array $body): string {
    // Only acquired, verified local cover files. YouTube thumbnails and Suno share
    // pages never stand in for original square covers. Unacquired art stays in source.
    $source=$body['coverImageUrl']??$body['thumbUrl']??'';
    static $map=null;if($map===null)$map=is_file(__DIR__.'/asset-covers.php')?require __DIR__.'/asset-covers.php':[];
    return is_string($source)&&is_array($map)&&isset($map[$source])?(string)$map[$source]:'';
}
