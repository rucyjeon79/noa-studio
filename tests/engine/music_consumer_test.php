<?php
declare(strict_types=1);
/** Entire test tree is temporary; uses SQLite and a generated, synthetic MP3. */
$source=dirname(__DIR__,2);$root=sys_get_temp_dir().'/n80-music-test-'.bin2hex(random_bytes(8));
function n80_test_tree_remove(string $path):void {if(!is_dir($path)){@unlink($path);return;}foreach(scandir($path) as $p)if($p!=='.'&&$p!=='..')n80_test_tree_remove($path.'/'.$p);rmdir($path);}
function n80_test_check(bool $value,string $name):void {global $assertions;$assertions++;if(!$value)throw new RuntimeException($name);}
$assertions=0;
try{
    foreach(['web/noa-app/engine','web/noa-app/jukebox','web/noa-bridge','noa-jukebox-private/media','events','leases','race'] as $dir)mkdir($root.'/'.$dir,0700,true);
    foreach(glob($source.'/deploy/noa-app/engine/*.php') as $file)copy($file,$root.'/web/noa-app/engine/'.basename($file));
    copy($source.'/deploy/noa-app/jukebox/core.php',$root.'/web/noa-app/jukebox/core.php');
    foreach(['sound-core.php','music-readmodel.php'] as $file)copy($source.'/bridge/'.$file,$root.'/web/noa-bridge/'.$file);
    define('_GNUBOARD_',true);require $root.'/web/noa-app/engine/music-consumer.php';
    $policy=$root.'/policy.json';n80_test_check(!n80_music_policy_enabled($policy),'missing_policy_disabled');
    $policyValue=['version'=>1,'enabled'=>true,'exactConsumer'=>'music_catalog_availability_verified'];
    file_put_contents($policy,json_encode($policyValue));chmod($policy,0600);
    n80_test_check(n80_music_policy_enabled($policy),'exact_policy');
    chmod($policy,0644);clearstatcache(true,$policy);n80_test_check(!n80_music_policy_enabled($policy),'public_policy_rejected');chmod($policy,0600);clearstatcache(true,$policy);
    file_put_contents($policy,json_encode($policyValue+['extra'=>true]));n80_test_check(!n80_music_policy_enabled($policy),'unknown_policy_fields_rejected');
    file_put_contents($policy,json_encode($policyValue));symlink($policy,$root.'/policy-link.json');n80_test_check(!n80_music_policy_enabled($root.'/policy-link.json'),'symlink_policy_rejected');unlink($root.'/policy-link.json');
    $mp3=$root.'/noa-jukebox-private/media/test.mp3';
    $command=['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=1','-c:a','libmp3lame',$mp3];
    $proc=proc_open($command,[['pipe','r'],['pipe','w'],['pipe','w']],$pipes);fclose($pipes[0]);stream_get_contents($pipes[1]);fclose($pipes[1]);stream_get_contents($pipes[2]);fclose($pipes[2]);
    n80_test_check(proc_close($proc)===0,'synthetic_audio');
    $db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT,payload TEXT)');
    $db->exec('CREATE TABLE noa_jukebox_uploads(id TEXT PRIMARY KEY,song_key TEXT,status TEXT)');
    $db->exec('CREATE TABLE noa_jukebox_audio_jobs(id INTEGER PRIMARY KEY,upload_id TEXT,song_key TEXT,status TEXT,finished_at TEXT)');
    $db->exec('CREATE TABLE noa_jukebox_assets(song_key TEXT PRIMARY KEY,status TEXT,audio_path TEXT,audio_sha256 TEXT,audio_bytes INTEGER,source_url TEXT)');
    $key='single:test:01';$suno='https://suno.com/song/12345678-1234-1234-1234-123456789abc';
    $document=['title'=>'Fixture','visibility'=>'public','body'=>['sunoUrl'=>$suno,'lyricsBlock'=>'Fixture lyrics','songDescription'=>'Fixture description']];
    $db->prepare('INSERT INTO noa_documents VALUES(?,?,?)')->execute([$key,'single',json_encode($document)]);
    $db->prepare('INSERT INTO noa_jukebox_uploads VALUES(?,?,?)')->execute([str_repeat('1',32),$key,'ready']);
    $db->prepare('INSERT INTO noa_jukebox_audio_jobs VALUES(?,?,?,?,?)')->execute([1,str_repeat('1',32),$key,'ready','2026-10-24 10:00:00']);
    $digest=hash_file('sha256',$mp3);$bytes=filesize($mp3);
    $db->prepare('INSERT INTO noa_jukebox_assets VALUES(?,?,?,?,?,?)')->execute([$key,'ready','test.mp3',$digest,$bytes,$suno]);
    $read=static function(string $kind,string $requested)use($document,$key,$digest,$bytes,$mp3):array{
        if($requested!==$key)throw new RuntimeException('unexpected_subject');
        if($kind==='catalog')return ['status'=>200,'body'=>'const records='.json_encode([['key'=>$key,'audio'=>nj_url($key,'audio'),'audioSha'=>$digest,'audioBytes'=>$bytes]]).";\nconst collections=[];"];
        if($kind==='detail')return ['status'=>200,'body'=>json_encode(['key'=>$key]+noa_music_detail_fields($document))];
        return ['status'=>206,'body'=>file_get_contents($mp3,false,null,0,4096)];
    };
    $ctx=['enabled'=>true,'authenticatedByServer'=>true,'principal'=>'n80_music_consumer','permission'=>'music:verify'];
    $dirs=['events'=>$root.'/events','leases'=>$root.'/leases'];
    n80_test_check(!n80_music_consume($db,$dirs,1,[],$read)['ok'],'disabled_default');
    n80_test_check(!n80_music_consume($db,$dirs,1,['enabled'=>true],$read)['ok'],'server_auth_required');
    $result=n80_music_consume($db,$dirs,1,$ctx,$read);
    n80_test_check($result['ok']&&$result['status']==='acknowledged','verified_ack');
    n80_test_check($result['receipt']['effect']==='music_catalog_availability_verified'&&$result['receipt']['proof']['mutation']===false,'narrow_effect');
    $state=json_decode(file_get_contents(glob($root.'/leases/*.json')[0]),true);
    n80_test_check($state['status']==='succeeded'&&$state['receipt']===$result['receipt'],'receipt_atomic_with_ack');
    $never=static function(){throw new RuntimeException('must_not_reexecute');};
    n80_test_check(n80_music_consume($db,$dirs,1,$ctx,$never)['status']==='already_acknowledged','response_loss_replay');
    // A new committed job is a new event and must not inherit the old receipt.
    $db->prepare('INSERT INTO noa_jukebox_audio_jobs VALUES(?,?,?,?,?)')->execute([2,str_repeat('1',32),$key,'ready','2026-10-24 10:01:00']);
    n80_test_check(!n80_music_consume($db,$dirs,1,$ctx,$read)['ok'],'superseded_job');
    $bad=static fn(string $kind,string $subject):array=>$kind==='audio'?['status'=>206,'body'=>'wrong bytes']:$read($kind,$subject);
    n80_test_check(!n80_music_consume($db,$dirs,2,$ctx,$bad)['ok'],'stream_mismatch_no_ack');
    $second=n80_ready_event_from_job($db,2)['event'];$path=$root.'/leases/'.hash('sha256',$second['id'].'|music').'.json';
    $pending=json_decode(file_get_contents($path),true);
    n80_test_check($pending['status']==='pending'&&!isset($pending['receipt']),'failed_probe_no_receipt');
    // A crash after claim is recovered only after expiry, with generation fence.
    $claim=n80_lease_state_transition($dirs['leases'],$second['id'],'music','claim',time()-121,null,120,3);
    n80_test_check($claim['ok'],'crash_claim');
    $resumed=n80_music_consume($db,$dirs,2,$ctx,$read);
    n80_test_check($resumed['ok']&&$resumed['receipt']['generation']===3,'crash_replay_ack');
    $stale=n80_lease_state_transition($dirs['leases'],$second['id'],'music','ack',time(),2,120,3,$result['receipt']);
    n80_test_check(!$stale['ok'],'stale_completion_rejected');
    $db->prepare('UPDATE noa_jukebox_assets SET audio_sha256=? WHERE song_key=?')->execute([str_repeat('0',64),$key]);
    n80_test_check(!n80_music_availability($db,2,$read)['ok'],'actual_media_hash_required');
    $db->prepare('UPDATE noa_jukebox_assets SET audio_sha256=? WHERE song_key=?')->execute([$digest,$key]);
    $badDetail=static fn(string $kind,string $subject):array=>$kind==='detail'?['status'=>200,'body'=>'{}']:$read($kind,$subject);
    n80_test_check(!n80_music_availability($db,2,$badDetail)['ok'],'public_detail_required');
    $db->prepare('INSERT INTO noa_jukebox_audio_jobs VALUES(?,?,?,?,?)')->execute([3,str_repeat('1',32),$key,'ready','2026-10-24 10:02:00']);
    foreach([1,2,3] as $_)n80_test_check(!n80_music_consume($db,$dirs,3,$ctx,$bad)['ok'],'failed_attempt');
    $third=n80_ready_event_from_job($db,3)['event'];
    $dead=json_decode(file_get_contents($root.'/leases/'.hash('sha256',$third['id'].'|music').'.json'),true);
    n80_test_check($dead['status']==='dead_letter'&&!isset($dead['receipt']),'retry_exhaustion_durable_without_ack');
    n80_test_check(!n80_music_consume($db,$dirs,3,$ctx,$read)['ok'],'no_implicit_deadletter_redrive');
    $db->prepare('INSERT INTO noa_jukebox_audio_jobs VALUES(?,?,?,?,?)')->execute([4,str_repeat('1',32),$key,'ready','2026-10-24 10:03:00']);
    $fourth=n80_ready_event_from_job($db,4)['event'];$conflict=$fourth;$conflict['subjectId']='other-song';
    noa_engine_store_event($dirs['events'],$conflict);
    n80_test_check((n80_music_consume($db,$dirs,4,$ctx,$read)['error']??'')==='id_conflict','event_conflict_preserved');
    // Two real PHP processes race for one lease; only one can claim it.
    $child=$root.'/claim.php';file_put_contents($child,'<?php require '.var_export($root.'/web/noa-app/engine/lease-state.php',true).';echo json_encode(n80_lease_state_transition('.var_export($root.'/race',true).',"race","music","claim",100,null,120,3));');
    $children=[];foreach([1,2] as $_){$p=proc_open([PHP_BINARY,$child],[['pipe','r'],['pipe','w'],['pipe','w']],$ps);fclose($ps[0]);$children[]=[$p,$ps];}
    $winners=0;foreach($children as [$p,$ps]){$value=json_decode(stream_get_contents($ps[1]),true);fclose($ps[1]);stream_get_contents($ps[2]);fclose($ps[2]);n80_test_check(proc_close($p)===0,'race_process');if($value['ok'])$winners++;}
    n80_test_check($winners===1,'single_concurrent_owner');
    echo json_encode(['ok'=>true,'assertions'=>$assertions,'productionDatabaseWrites'=>0,'syntheticAudioOnly'=>true]).PHP_EOL;
}finally{if(is_dir($root))n80_test_tree_remove($root);}
