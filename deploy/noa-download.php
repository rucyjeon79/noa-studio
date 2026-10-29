<?php
declare(strict_types=1);
// Historical installation links on Apple devices must never download an APK.
if(preg_match('/iPhone|iPad|iPod|Macintosh/i',$_SERVER['HTTP_USER_AGENT']??'')){header('Cache-Control: no-store');header('Location: /noa-install.php',true,302);exit;}
$meta=__DIR__.'/noa-android-release.json';
if(!is_file($meta)){http_response_code(404);exit('안드로이드 앱을 준비하고 있습니다.');}
$release=json_decode((string)file_get_contents($meta),true);
$file=$release['file']??'';$sha=$release['sha256']??'';
if(($release['app']??'')!=='NOA STUDIO'||!is_string($file)||!preg_match('/^noa-studio-android-build-[0-9]+[.]apk$/D',$file)||!is_string($sha)||!preg_match('/^[a-f0-9]{64}$/D',$sha)){http_response_code(503);exit;}
$path=__DIR__.'/'.$file;
if(!is_file($path)||is_link($path)||!hash_equals($sha,hash_file('sha256',$path))){http_response_code(503);exit;}
if(!empty($release['requiresMigrationFromDebugBuild13'])&&($_GET['confirm']??'')!=='release-v1'){
 header('Content-Type: text/html; charset=utf-8');header('Cache-Control: no-store');
 echo '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>정식 Android 앱 설치 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><body class="noa-page"><main class="noa-install-page"><h1>정식 Android 앱 설치</h1><p>기존 테스트 APK(build 13)는 서명이 달라 정식 앱으로 덮어설치할 수 없습니다. 기존 테스트 앱을 삭제한 뒤 정식 앱을 설치해야 합니다.</p><p><strong>앱 삭제 전 이 기기에만 저장한 임시 재생목록을 기록해 주세요.</strong> 앱 내부 설정과 기기 저장 데이터는 삭제될 수 있습니다. 서버의 회원 계정과 음악은 유지됩니다.</p><p>이미 정식 앱을 설치했다면 삭제 없이 업데이트할 수 있습니다.</p><a class="noa-button" href="?confirm=release-v1">안내 확인 · APK 다운로드</a> <a class="noa-button" href="/">홈으로</a></main></body></html>';exit;
}
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="NOA-STUDIO.apk"');
header('Content-Length: '.filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
readfile($path);
