<?php
declare(strict_types=1);
$meta=__DIR__.'/noa-android-release.json';
if(!is_file($meta)){http_response_code(404);exit('안드로이드 앱을 준비하고 있습니다.');}
$release=json_decode((string)file_get_contents($meta),true);
$file=$release['file']??'';$sha=$release['sha256']??'';
if(($release['app']??'')!=='NOA STUDIO'||!is_string($file)||!preg_match('/^noa-studio-android-build-[0-9]+[.]apk$/D',$file)||!is_string($sha)||!preg_match('/^[a-f0-9]{64}$/D',$sha)){http_response_code(503);exit;}
$path=__DIR__.'/'.$file;
if(!is_file($path)||is_link($path)||!hash_equals($sha,hash_file('sha256',$path))){http_response_code(503);exit;}
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="NOA-STUDIO.apk"');
header('Content-Length: '.filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
readfile($path);
