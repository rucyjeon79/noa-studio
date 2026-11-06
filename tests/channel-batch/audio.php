<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require_once __DIR__.'/../../bridge/storage.php';
require_once __DIR__.'/../../bridge/creator-core.php';
require_once __DIR__.'/../../bridge/sound-core.php';
require_once __DIR__.'/../../deploy/noa-app/jukebox/upload-core.php';
require_once __DIR__.'/../../bridge/channel-batch-audio.php';

function verify_audio(bool $ok,string $label): void {
    if (!$ok) throw new RuntimeException($label);
}
function reject_audio(callable $call,string $label): void {
    try { $call(); } catch (DomainException|InvalidArgumentException $e) {
        verify_audio($label===$e->getMessage(),'unexpected rejection '.$e->getMessage()); return;
    }
    throw new RuntimeException('expected '.$label);
}
$db=noa_bridge_pdo();
verify_audio($db->query('SELECT DATABASE()')->fetchColumn()==='noa_test','requires isolated MySQL');
verify_audio(getenv('NOA_GITHUB_DISPATCH_TOKEN')==='' || !getenv('NOA_GITHUB_DISPATCH_TOKEN'),'isolated wake');
verify_audio(!is_file(nj_private().'/upload-wake-token') && !is_file(dirname(nj_private()).'/noa-ai-lab/gpt-action/state.json'),'isolated storage only');
nj_schema($db); nr_schema($db);
$owner='batch_audio_fixture'; $native='creator:'.hash('sha256',$owner).':';
$keys=[$native.'ready',$native.'missing',$native.'queue',$native.'failed'];
foreach ($keys as $key) nc_store($db,$key,'story',['ownerId'=>$owner,'genreId'=>'your-story','title'=>$key,'body'=>[]],0,$owner);
$managed='single:batch-audio-managed'; $foreign='single:batch-audio-foreign';
foreach ([$managed=>$owner,$foreign=>'other_owner'] as $key=>$actor)
    nc_store($db,$key,'single',['ownerId'=>$actor,'genreId'=>'cover-reborn','title'=>'같은 제목','body'=>['originalSinger'=>'원곡 가수']],0,$actor);
verify_audio(ncb_keys([$keys[0],$keys[0],$keys[1]])===array_slice($keys,0,2),'dedup overlapping selections');
verify_audio(ncb_documents($db,[$managed],$owner)[$managed]['artist']==='원곡 가수','canonical cover credit');
reject_audio(fn()=>ncb_preview($db,[$foreign],$owner,true),'own_song_required');
reject_audio(fn()=>ncb_start($db,['keys'=>[$managed],'requestId'=>str_repeat('a',32)],$owner,false,'upload'),'managed_song_requires_admin');
verify_audio(ncb_preview($db,[$managed],$owner,false)['skipped']===1,'managed role');
$dir=nj_private().'/media'; if (!is_dir($dir)) mkdir($dir,0700,true);
$media='batch-receipt-test.mp3'; $content=str_repeat('M',1024); file_put_contents($dir.'/'.$media,$content);
$db->prepare("INSERT INTO noa_jukebox_assets(song_key,source_url,audio_path,audio_bytes,audio_sha256,status)
    VALUES(?,'',?,?,?,'ready')")->execute([$keys[0],$media,strlen($content),hash('sha256',$content)]);
$ids=[];
foreach ([2=>'queued',3=>'failed'] as $i=>$state) {
    $id=$ids[$i]=bin2hex(random_bytes(16)); $source=str_repeat('S',256);
    file_put_contents(nu_dir($id).'/input.audio',$source);
    $db->prepare("INSERT INTO noa_jukebox_uploads(id,song_key,source_url,filename,extension,file_bytes,fingerprint,total_chunks,status,sha256,context,requested_by)
        VALUES(?,?,'','sample.mp3','mp3',256,?,1,?,?,'{}',?)")->execute([$id,$keys[$i],hash('sha256',$source),$state,hash('sha256',$source),$owner]);
    $db->prepare("INSERT INTO noa_jukebox_audio_jobs(upload_id,song_key,status,attempt,error) VALUES(?,?,?,1,?)")
       ->execute([$id,$keys[$i],$state,$state==='failed'?'upload_processing_failed':null]);
}
$p=ncb_preview($db,$keys,$owner,false);
verify_audio([$p['eligible'],$p['missing'],$p['skipped'],$p['processing']] === [1,1,1,1],'preview partition');
$body=['keys'=>$keys,'requestId'=>str_repeat('b',32)];
$r=ncb_start($db,$body,$owner,false,'audio');
verify_audio(array_column($r['items'],'status')===['skipped','missing','queued','queued'],'stored batch states');
verify_audio($r===ncb_start($db,$body,$owner,false,'audio'),'replay same batch');
verify_audio(ncb_receipt($db,'another',$r['id'])===null,'cross-owner history');
reject_audio(fn()=>ncb_start($db,['keys'=>[$keys[1]],'requestId'=>$r['id']],$owner,false,'audio'),'request_conflict');
$count=$db->prepare('SELECT count(*) FROM noa_jukebox_audio_jobs WHERE upload_id=?');
$count->execute([$ids[3]]); verify_audio((int)$count->fetchColumn()===2,'retry once');
$failed=$ids[3];
$db->prepare("UPDATE noa_jukebox_uploads SET status='failed' WHERE id=?")->execute([$failed]);
$db->prepare("UPDATE noa_jukebox_audio_jobs SET status='failed',error='upload_processing_failed' WHERE upload_id=?")->execute([$failed]);
$snapshot=ncb_snapshot($db,ncb_receipt($db,$owner));
verify_audio($snapshot['items'][3]['status']==='failed','history follows the accepted upload');
$retry=ncb_start($db,['id'=>$r['id'],'requestId'=>str_repeat('c',32)],$owner,false,'retry');
verify_audio(count($retry['items'])===1 && $retry['items'][0]['key']===$keys[3],'only failed song retried');
$uploads=ncb_start($db,['keys'=>[$managed],'requestId'=>str_repeat('d',32)],$owner,true,'upload');
verify_audio($uploads['items'][0]['reason']==='file_transfer_required','page may be closed before upload');
reject_audio(fn()=>ncb_upload_init($db,['batchId'=>$uploads['id'],'key'=>$keys[0],'filename'=>'song.wav','bytes'=>256,'fingerprint'=>str_repeat('e',64)],$owner,true),'song_not_selected');
$input=['batchId'=>$uploads['id'],'key'=>$managed,'filename'=>'mapped.wav','bytes'=>256,'fingerprint'=>str_repeat('e',64)];
$u=ncb_upload_init($db,$input,$owner,true); $receipt=ncb_receipt($db,$owner,$uploads['id']);
verify_audio($u['id']===$receipt['items'][0]['upload'] && ncb_upload_init($db,$input,$owner,true)['id']===$u['id'],'upload receipt replay');
verify_audio(json_decode(nu_row($db,$u['id'])['context'],true)['originalArtist']==='원곡 가수','file mapped to canonical cover artist');
reject_audio(fn()=>ncb_upload_init($db,array_replace($input,['filename'=>'changed.wav']),$owner,true),'upload_file_changed');
reject_audio(fn()=>ncb_authorized_upload($db,$u['id'],'another',true),'own_upload_required');
echo "CHANNEL_BATCH_AUDIO_MYSQL_OK\n";
