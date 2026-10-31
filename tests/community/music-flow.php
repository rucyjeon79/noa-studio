<?php
declare(strict_types=1);
$root='/tmp/noa-community-fixture';@mkdir($root.'/noa-bridge',0700,true);
foreach(['community-navigation.php','community-music.php']as $f)copy('bridge/'.$f,$root.'/noa-bridge/'.$f);
require __DIR__.'/fixture.php';require_once __DIR__.'/../../bridge/catalog-store.php';
foreach(['storage.php','sound-core.php','community-audio.php']as $f)copy('bridge/'.$f,$root.'/noa-bridge/'.$f);
@mkdir($root.'/noa-app/jukebox',0700,true);copy('deploy/noa-app/jukebox/core.php',$root.'/noa-app/jukebox/core.php');
@mkdir($root.'/noa-jukebox',0700,true);
exec('ffmpeg -hide_banner -loglevel error -f lavfi -i sine=frequency=440:duration=2 -codec:a libmp3lame -y /tmp/noa-community-fixture/noa-jukebox/reply.mp3',$unused,$code);if($code)throw new RuntimeException('fixture_audio');
putenv('NOA_MYSQL_DSN=mysql:host=127.0.0.1;dbname=noa_community;charset=utf8mb4');putenv('NOA_MYSQL_USER=root');putenv('NOA_MYSQL_PASSWORD=fixture-only');
nc_query('CREATE TABLE noa_documents (doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(30),payload JSON,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
nc_query("CREATE TABLE noa_jukebox_assets (song_key VARCHAR(191) PRIMARY KEY,source_url TEXT,status VARCHAR(30),audio_path TEXT,audio_bytes BIGINT,audio_sha256 CHAR(64))");
foreach(['mine'=>'qa_creator','other'=>'qa_other']as $key=>$owner){$d=['ownerId'=>$owner,'title'=>'완성곡 '.$key,'visibility'=>'public','body'=>['sunoUrl'=>'https://suno.com/song/reply-test']];nc_query('INSERT INTO noa_documents (doc_key,kind,payload) VALUES ('.nc_q($key).",'story',".nc_q(json_encode($d)).')');nc_query('INSERT INTO noa_jukebox_assets VALUES ('.nc_q($key).",'https://suno.com/song/reply-test','ready','reply.mp3',".filesize($root.'/noa-jukebox/reply.mp3').','.nc_q(hash_file('sha256',$root.'/noa-jukebox/reply.mp3')).')');}
// Recovered catalog songs must be searchable, using their canonical player key.
nc_query('CREATE TABLE noa_catalog_batches (batch_id VARCHAR(30),status VARCHAR(30),applied_at DATETIME)');
nc_query("INSERT INTO noa_catalog_batches VALUES ('fixture','applied',NOW())");
nc_query('CREATE TABLE noa_catalog_songs (song_id CHAR(64),identity_json JSON,genre_id VARCHAR(30),ep VARCHAR(30))');
nc_query('CREATE TABLE noa_catalog_versions (entity_id CHAR(64),entity_type VARCHAR(30),fields_json JSON,public_verified INT,batch_id VARCHAR(30))');
nc_query('CREATE TABLE noa_catalog_aliases (entity_id CHAR(64),alias_key VARCHAR(191),batch_id VARCHAR(30))');
$catalogId=str_repeat('a',64);$catalogKey='catalog:'.$catalogId;
nc_query("INSERT INTO noa_catalog_songs VALUES (".nc_q($catalogId).",'[]','pop','1')");
nc_query("INSERT INTO noa_catalog_versions VALUES (".nc_q($catalogId).",'song',".nc_q(json_encode(['confirmedTitle'=>'내일은 우리','sunoUrl'=>'https://suno.com/song/reply-test'])).",1,'fixture')");
nc_query("INSERT INTO noa_jukebox_assets SELECT ".nc_q($catalogKey).",source_url,status,audio_path,audio_bytes,audio_sha256 FROM noa_jukebox_assets WHERE song_key='mine'");
function actor(string $id,int $level):void{global $member,$is_admin;$member=['mb_id'=>'qa_'.$id,'mb_level'=>$level,'mb_nick'=>$id];$is_admin='';}
function check(bool $v,string $label):void{if(!$v)throw new RuntimeException($label);}
function denied(callable $fn,string $label):void{try{$fn();}catch(DomainException $e){return;}throw new RuntimeException($label);}
actor('admin',10);$is_admin='super';
check((nc_music_search('내일은 우리')[0]['key']??'')===$catalogKey,'catalog_song_search');
check((nc_music_search('내일은우리')[0]['key']??'')===$catalogKey,'catalog_spacing_search');
nc_query("UPDATE noa_catalog_versions SET public_verified=0");check(nc_music_search('내일은 우리')===[],'private_catalog_hidden');nc_query("UPDATE noa_catalog_versions SET public_verified=1");
actor('creator',7);check(nc_music_search('내일은 우리')===[],'catalog_unowned_denied');
actor('owner',3);$input=['title'=>'우리의 이야기','body'=>'비공개 사연 본문','name'=>'신청자','password'=>'test-password','requestId'=>'11111111-1111-4111-8111-111111111111'];$id=nc_create($input)['id'];
actor('creator',7);check(nc_read('song_request',$id)['locked']===true,'private_default');denied(fn()=>nc_comment(['id'=>$id,'body'=>'답변','requestId'=>'22222222-2222-4222-8222-222222222222']),'private_comment_blocked');
actor('owner',3);nc_unlock($id,'test-password');nc_share($id,true);
actor('creator',7);check(nc_read('song_request',$id)['body']==='비공개 사연 본문','consented_creator_read');check(count(nc_music_search('완성곡'))===1,'only_own_ready_songs');
$reply=['id'=>$id,'body'=>'사연으로 만든 곡입니다.','musicKey'=>'other','requestId'=>'33333333-3333-4333-8333-333333333333'];denied(fn()=>nc_comment($reply),'other_owner_song_blocked');$reply['musicKey']='mine';$result=nc_comment($reply);nc_comment($reply);check(count($result['comments'])===1,'single_reply');check(count(nc_read('song_request',$id)['comments'])===1,'idempotency');$reply['musicKey']='other';denied(fn()=>nc_comment($reply),'replay_changed_song');
actor('stranger',3);check(nc_read('song_request',$id)['locked']===true,'stranger_cannot_read');check(!nc_request_audio_allowed($id,'mine'),'stranger_audio_denied');denied(fn()=>nc_unlock($id,'test-password'),'other_account_password_denied');
actor('owner',3);$detail=nc_unlock($id,'test-password');check($detail['comments'][0]['music']['title']==='완성곡 mine','requester_card');check(nc_request_audio_allowed($id,'mine'),'requester_attached_playback');check(!nc_request_audio_allowed($id,'other'),'unattached_key_denied');nc_share($id,false);
actor('creator',7);check(nc_read('song_request',$id)['locked']===true,'consent_revoked');check(!nc_request_audio_allowed($id,'mine'),'revoked_stream_denied');
actor('owner',3);check(nc_request_audio_allowed($id,'mine'),'requester_keeps_attached_audio');
$common=file_get_contents($root.'/common.php');$common.="\nfunction nr_activity(...\$args){if((\$_COOKIE['qa_role']??'')==='creator'){echo 'NATIVE_REWARD_OUTPUT_MUST_NOT_CORRUPT_JSON';exit;}}\n";$common=str_replace("(\$role==='temp'?2:4)","(\$role==='creator'?7:(\$role==='owner'?3:(\$role==='temp'?2:4)))",$common);file_put_contents($root.'/common.php',$common);
file_put_contents($root.'/request-test.php','<?php require __DIR__."/common.php"; ?><!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-community.css"><body class="noa-page"><main class="noa-main"><section class="noa-community" data-noa-community="song_request"></section></main><script src="/noa-community.js" defer></script>');
file_put_contents($root.'/request-id.json',json_encode(['id'=>$id]));echo "REQUEST_CONSENT_OWNER_ATTACHMENT_REPLAY_AND_STREAM_ACL_OK\n";

copy($root.'/request-test.php',$root.'/noa-lounge.php');
copy('deploy/noa-notifications.js',$root.'/noa-notifications.js');
$inbox=file_get_contents('deploy/noa-notifications.php');$inbox=preg_replace('~<script[^>]+src=[^>]+></script>~','',$inbox);
$inbox=str_replace('</body>','<script id="noa-notifications-context" type="application/json">{"member":true}</script><script src="/noa-notifications.js"></script></body>',$inbox);file_put_contents($root.'/noa-notifications.php',$inbox);
