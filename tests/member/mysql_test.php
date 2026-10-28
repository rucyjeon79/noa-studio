<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/sound-core.php';require __DIR__.'/../../bridge/creator-core.php';require __DIR__.'/../../deploy/noa-app/jukebox/upload-core.php';
function check($v,string $m):void{if(!$v)throw new RuntimeException($m);}
$db=noa_bridge_pdo();$db->exec("CREATE TABLE noa_documents(doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,kind VARCHAR(32),payload LONGTEXT,revision BIGINT,updated_by VARCHAR(20),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB");$db->exec('CREATE TABLE noa_document_history(doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin,revision BIGINT,payload LONGTEXT,changed_by VARCHAR(20),PRIMARY KEY(doc_key,revision)) ENGINE=InnoDB');nj_schema($db);
$owner='qa_owner_a';$key='creator:'.hash('sha256',$owner).':'.str_repeat('a',32);$d=nc_patch(['ownerId'=>$owner,'title'=>'My private track','genreId'=>'your-story','visibility'=>'private','ep'=>'','act'=>'','body'=>[]],['fields'=>['title'=>'My private track','lyrics'=>'Only lyrics']]);nc_store($db,$key,'story',$d,0,$owner);check(nc_own($db,$key,['mb_id'=>$owner])['revision']===1,'own_read');
try{nc_own($db,$key,['mb_id'=>'qa_owner_b']);throw new RuntimeException('cross_owner_read');}catch(DomainException $e){check($e->getMessage()==='own_song_required','owner_error');}
try{nc_store($db,$key,'story',$d,0,$owner);throw new RuntimeException('revision_overwrite');}catch(DomainException $e){check($e->getMessage()==='revision_conflict','revision_error');}
$d['title']='Updated';nc_store($db,$key,'story',$d,1,$owner);check((int)$db->query('SELECT COUNT(*) FROM noa_document_history')->fetchColumn()===2,'complete_history');check(count($db->query("SELECT * FROM noa_documents WHERE kind='story'")->fetchAll())===1,'one_complete_record');
$raw='RIFF'.pack('V',36+32000).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',32000).str_repeat("\0",32000);$fp=hash('sha256',$raw);$u=nu_initialize($db,['key'=>$key,'filename'=>'own.wav','bytes'=>strlen($raw),'fingerprint'=>$fp],$owner);$row=nu_row($db,$u['id']);check(json_decode($row['context'],true)['authorization']==='creator_owned_upload','creator_authorization');nu_chunk($db,$u['id'],0,$raw);$resume=nu_initialize($db,['key'=>$key,'filename'=>'own.wav','bytes'=>strlen($raw),'fingerprint'=>$fp],$owner);check($resume['id']===$u['id']&&$resume['chunks']===[0],'same_file_resume');nu_finish($db,$u['id']);$j=nq_latest($db,$u['id']);check($j['status']==='queued'&&$j['attempt']===1,'verified_wav_enqueued');
try{nu_chunk($db,$u['id'],0,$raw);throw new RuntimeException('queued_chunk_write');}catch(DomainException $e){check($e->getMessage()==='upload_not_accepting_chunks','immutable_queue');}
check(count($db->query('SELECT * FROM noa_jukebox_uploads')->fetchAll())===1,'one_upload');
// Reusable browser fixture: legitimate isolated member and canonical song only.
nc_store($db,nc_channel_key($owner),'prefs',['title'=>'테스트 창작자 채널','description'=>'내 곡과 이야기'],0,$owner);
echo "CREATOR_MYSQL_OK record_history revision_CAS cross_owner_denied upload_chunks resume MIME queue\n";
// Legacy system records bind once; foreign and personal records are preserved.
$legacy=['title'=>'기존 등록곡','genreId'=>'kpop-original','ep'=>'1','body'=>['lyrics'=>'원본 가사'],'visibility'=>'public'];
nc_store($db,'single:legacy','single',$legacy,0,'old-import');
nc_store($db,'playlist:legacy','playlist',['title'=>'기존 ACT','genreId'=>'kpop-original','body'=>['members'=>[['key'=>'single:legacy']]]],0,'old-import');
nc_store($db,'story:other','story',['title'=>'다른 창작자','ownerId'=>'qa_owner_b','body'=>[]],0,'qa_owner_b');
$before=nco_row($db,'single:legacy');$audit=nco_bind($db,$owner,'/tmp/noa-channel-test-backup',false);check($audit['planned']>=2&&nco_row($db,'single:legacy')===$before,'audit is read only');
$bound=nco_bind($db,$owner,'/tmp/noa-channel-test-backup');check($bound['foreignPreserved']===1&&$bound['contentPreserved'],'foreign owner and exact payload preserved');
$after=json_decode(nco_row($db,'single:legacy')['payload'],true);check($after['ownerId']===$owner&&$after['channelId']===hash('sha256',$owner),'explicit owner and channel');unset($after['ownerId'],$after['channelId']);check($after===$legacy,'legacy metadata retained');
check(nco_bind($db,$owner,'/tmp/noa-channel-test-backup')['updated']===0,'binding replay no revisions');
check(count(nc_owned_records($db,'qa_owner_b'))===1,'other creator only own data');
try{nc_store($db,'single:legacy','single',array_replace($legacy,['ownerId'=>'qa_owner_b']),2,'qa_owner_b');throw new RuntimeException('transfer accepted');}catch(DomainException $e){check($e->getMessage()==='ownership_transfer_forbidden','transfer blocked');}
nc_store($db,'story:new-system','story',['title'=>'후속 등록곡','body'=>[]],0,'catalog-register');check(json_decode(nco_row($db,'story:new-system')['payload'],true)['ownerId']===$owner,'future imports retain installed owner');
try{nco_bind($db,'qa_owner_b','/tmp/noa-channel-test-backup');throw new RuntimeException('owner drift');}catch(DomainException $e){check($e->getMessage()==='installed_owner_mismatch','administrator change is not ownership transfer');}
echo "CHANNEL_BINDING_MYSQL_OK\n";
