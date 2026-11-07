<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/executor.php';
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/native-consumer.php';
function native_expect(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
$db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$tables=['noa_documents'=>'doc_key TEXT,kind TEXT,payload TEXT','noa_catalog_batches'=>'batch_id TEXT,status TEXT,applied_at TEXT','noa_catalog_songs'=>'song_id TEXT','noa_catalog_acts'=>'act_id TEXT','noa_catalog_playlists'=>'playlist_id TEXT,act_id TEXT','noa_catalog_versions'=>'entity_id TEXT,entity_type TEXT,batch_id TEXT,fields_json TEXT','noa_catalog_tracks'=>'song_id TEXT,playlist_id TEXT','noa_jukebox_assets'=>'song_key TEXT','noa_jukebox_uploads'=>'id TEXT,song_key TEXT','noa_jukebox_audio_jobs'=>'id INT,upload_id TEXT,status TEXT','noa_user_playlists'=>'playlist_id TEXT,owner_id TEXT,tracks TEXT,revision INT','g5_member'=>'mb_id TEXT','noa_youtube_runs'=>'run_id TEXT,created_at TEXT','noa_youtube_videos'=>'run_id TEXT,payload TEXT,match_json TEXT','noa_youtube_playlists'=>'run_id TEXT,playlist_id TEXT,payload TEXT','noa_youtube_items'=>'run_id TEXT','noa_categories'=>'category_id TEXT,parent_id TEXT','noa_content_categories'=>'category_id TEXT','noa_content_matches'=>'id INT','noa_playlist_matches'=>'id INT','noa_ranking_runs'=>'hour_utc TEXT,status TEXT','noa_ranking_rows'=>'hour_utc TEXT','noa_play_sessions'=>'id INT','noa_valid_plays'=>'id INT','g5_board'=>'id INT','g5_board_file'=>'id INT'];
foreach($tables as $name=>$columns)$db->exec('CREATE TABLE '.$name.' ('.$columns.')');
$db->exec("INSERT INTO noa_documents VALUES('song','single','{}');INSERT INTO g5_member VALUES('one');INSERT INTO noa_user_playlists VALUES('list','one','[\"song\"]',1);INSERT INTO noa_youtube_runs VALUES('run','2026-11-07');INSERT INTO noa_youtube_playlists VALUES('run','PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY','{}')");
$db->exec('PRAGMA query_only=ON');
$p=n80_native_projection($db,'playlist','unused');native_expect($p['referencesVerified']&&$p['rows']===1,'actual_playlist_projection');
$root=sys_get_temp_dir().'/n80-native-'.bin2hex(random_bytes(6));foreach(['web','events','leases'] as $dir)mkdir($root.'/'.$dir,0700,true);
try{
 $request=str_repeat('a',40);$event=n80_native_event($db,'admin',$request,'2026-11-07T00:00:00Z');
 $context=['enabled'=>true,'authenticatedByServer'=>true,'authenticatedActor'=>true,'durableStoreReady'=>true,'principal'=>'n80_lab_worker','permission'=>'native:verify','operation'=>'admin.verify_integrity','db'=>$db,'web'=>$root.'/web','directories'=>['events'=>$root.'/events','leases'=>$root.'/leases'],'requestId'=>$request,'requestedAt'=>$event['occurredAt']];
 native_expect(!noa_engine_execute($event,'admin',array_replace($context,['permission'=>'ai:text']))['ok'],'cross_permission_rejected');
 $first=noa_engine_execute($event,'admin',$context);native_expect($first['ok']&&$first['receipt']['proof']['integrityVerified'],'actual_audit_not_acknowledged');
 $repeat=noa_engine_execute($event,'admin',$context);native_expect($repeat['ok']&&$repeat['replayed']&&$repeat['receipt']===$first['receipt'],'native_exact_replay');
 native_expect(!noa_engine_execute(array_replace($event,['subjectId'=>'delete-data']),'admin',$context)['ok'],'arbitrary_admin_action');
 $world=n80_native_event($db,'world',$request);native_expect($world['subjectId']==='run'&&$world['type']==='youtube.synced','actual_sync_identity');
 $bad=$first['receipt'];$bad['proof']['integrityVerified']=false;native_expect(!n80_native_receipt_valid('admin',$bad),'false_ack_accepted');
 $db->exec('PRAGMA query_only=OFF');$db->exec("UPDATE noa_user_playlists SET tracks='[\"missing\"]'");$db->exec('PRAGMA query_only=ON');
 try{n80_native_projection($db,'playlist','unused');throw new RuntimeException('dangling_track_accepted');}catch(RuntimeException $e){native_expect($e->getMessage()==='playlist_reference_missing','wrong_reference_failure');}
 echo "N80_NATIVE_SQL_PROJECTION_AUTH_REPLAY_OK\n";
}finally{foreach(['events','leases'] as $dir){foreach(scandir($root.'/'.$dir) as $file)if($file!=='.'&&$file!=='..')unlink($root.'/'.$dir.'/'.$file);rmdir($root.'/'.$dir);}rmdir($root.'/web');rmdir($root);}
