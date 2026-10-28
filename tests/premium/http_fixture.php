<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/storage.php';
$site='/tmp/noa-download-fixture';@mkdir($site.'/noa-app/jukebox',0700,true);@mkdir($site.'/noa-bridge',0700,true);@mkdir('/tmp/noa-jukebox-private/media',0700,true);
foreach(['subscription-access.php','subscription-core.php','music-download-core.php','storage.php','sound-core.php','member-access.php']as $f)copy('bridge/'.$f,$site.'/noa-bridge/'.$f);
foreach(['core.php','download.php']as $f)copy('deploy/noa-app/jukebox/'.$f,$site.'/noa-app/jukebox/'.$f);copy('deploy/noa-music-download.php',$site.'/noa-music-download.php');
file_put_contents($site.'/noa-bridge/subscription-core.php','<?php require_once '.var_export(realpath('bridge/subscription-core.php'),true).';');
$native=realpath(__DIR__.'/../subscription/native_fixture.php');file_put_contents($site.'/common.php','<?php session_start();require_once '.var_export($native,true).';$id=$_COOKIE["qa_download_user"]??"";$member=$id?ns_one("SELECT * FROM g5_member WHERE mb_id=".ns_e($id)):[];$is_member=!!$member;$is_admin=$id==="qa_admin_dl"?"super":"";if(($_SERVER["HTTP_ORIGIN"]??"")==="http://127.0.0.1:18089")$_SERVER["HTTP_ORIGIN"]="https://noastudio.ai.kr";');
ns_q("INSERT INTO g5_member VALUES ('httpbuyer',2,2000),('httpother',3,2000),('qa_admin_dl',10,0)");foreach(['httpbuyer','httpother']as $id)insert_point($id,2000,'fixture','premium_fixture',$id,'seed');
require $site.'/noa-app/jukebox/core.php';$db=noa_bridge_pdo();nj_schema($db);
exec('ffmpeg -hide_banner -loglevel error -f lavfi -i sine=frequency=440:duration=1 -codec:a libmp3lame -y /tmp/noa-jukebox-private/media/download-fixture.mp3',$out,$code);if($code!==0)throw new RuntimeException('fixture_audio_failed');
$path='/tmp/noa-jukebox-private/media/download-fixture.mp3';$doc=['ownerId'=>'owner','title'=>'HTTP 검증곡','visibility'=>'public','body'=>[]];ns_put('http-song','single',$doc,0,'fixture');ns_put('http-private','single',array_replace($doc,['visibility'=>'private']),0,'fixture');
foreach(['http-song','http-private']as $key)$db->prepare("INSERT INTO noa_jukebox_assets(song_key,source_url,audio_path,audio_bytes,audio_sha256,status,title) VALUES(?,'','download-fixture.mp3',?,?,'ready','HTTP 검증곡')")->execute([$key,filesize($path),hash_file('sha256',$path)]);
file_put_contents($site.'/proof.php','<?php require __DIR__."/common.php";header("Content-Type: application/json");echo json_encode(["buyer"=>get_point_sum("httpbuyer"),"owner"=>get_point_sum("owner")]);');echo "DOWNLOAD_HTTP_FIXTURE_READY\n";
