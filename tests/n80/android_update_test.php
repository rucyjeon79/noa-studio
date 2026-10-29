<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/n80.php';
$dir=sys_get_temp_dir().'/n80-android-'.bin2hex(random_bytes(6));mkdir($dir,0700);
function check(bool $ok): void {if(!$ok)throw new RuntimeException('update contract failed');}
try {
 check(n80_android_update_status($dir)['available']===false);
 $r=['schemaVersion'=>1,'app'=>'NOA STUDIO','applicationId'=>'kr.ai.noastudio','versionCode'=>42,
 'file'=>'noa-studio-android-build-42.apk','sha256'=>str_repeat('a',64),'commit'=>str_repeat('b',40),'runId'=>'123'];
 file_put_contents($dir.'/noa-android-release.json',json_encode($r));
 check(n80_android_update_status($dir)['versionCode']===42);
 check(n80_android_update_status($dir)['automaticInstall']===false);
 foreach(['file'=>'../other.apk','applicationId'=>'other.app','sha256'=>'bad','versionCode'=>-1] as $key=>$value){
  file_put_contents($dir.'/noa-android-release.json',json_encode(array_replace($r,[$key=>$value])));
  check(n80_android_update_status($dir)['available']===false);
 }
 echo "N80_ANDROID_UPDATE_OK\n";
} finally {unlink($dir.'/noa-android-release.json');rmdir($dir);}
