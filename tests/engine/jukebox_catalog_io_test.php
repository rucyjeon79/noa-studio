<?php
declare(strict_types=1);
/** Offline shared-host performance gate; never contacts production. */
require_once __DIR__.'/../../deploy/noa-app/jukebox/core.php';
$root=dirname(__DIR__,2);
$dir=$root.'/noa-jukebox-private/media';
$made=!is_dir($dir);
if($made&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('fixture_directory_failed');
$name='n80-io-test-'.bin2hex(random_bytes(8)).'.mp3';
$path=$dir.'/'.$name;
if(file_put_contents($path,'abc')!==3)throw new RuntimeException('fixture_write_failed');
try {
 $key='jukebox:qa:catalog-io';
 $source='https://suno.com/s/n80-catalog-fixture';
 $row=['status'=>'ready','source_url'=>$source,'audio_path'=>$name,'audio_bytes'=>3,
       'audio_sha256'=>str_repeat('0',64),'cover_path'=>'','cover_bytes'=>0,'cover_sha256'=>''];
 $target='https://noastudio.ai.kr/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type=audio';
 $check=static function(bool $pass,string $name):void {
  if(!$pass)throw new RuntimeException('catalog_io_test_failed_'.$name);
 };
 // Listing only checks publication metadata and never hashes the content.
 $check(nj_resolve([$key=>$row],$key,$source,'audio')===$target,'metadata_route');
 // A stream request still verifies the actual bytes and rejects this forged digest.
 $check(nj_verified($row,'audio')===false,'stream_deep_sha_guard');
 $check(nj_resolve([$key=>$row],$key,$source.'-wrong','audio')==='','identity_guard');
 $bad=$row;$bad['audio_bytes']=9;
 $check(nj_resolve([$key=>$bad],$key,$source,'audio')==='','size_guard');
 $bad=$row;$bad['audio_sha256']='bad';
 $check(nj_resolve([$key=>$bad],$key,$source,'audio')==='','hash_format_guard');
 $bad=$row;$bad['status']='audio_pending';
 $check(nj_resolve([$key=>$bad],$key,$source,'audio')==='','ready_guard');
 $bad=$row;$bad['audio_path']='../outside.mp3';
 $check(nj_resolve([$key=>$bad],$key,$source,'audio')==='','path_guard');
 echo "N80_JUKEBOX_CATALOG_IO_PASS checks=7 host_writes=0 media_replayed=0\n";
} finally {
 @unlink($path);
 if($made){@rmdir($dir);@rmdir(dirname($dir));}
}
