<?php
declare(strict_types=1);define('_GNUBOARD_',true);
require dirname(__DIR__,2).'/bridge/sound-core.php';require dirname(__DIR__,2).'/deploy/noa-app/jukebox/operations.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function rejects(callable $fn,string $code):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$code,'expected '.$code.' got '.$e->getMessage());return;}throw new RuntimeException('expected rejection '.$code);}
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=jukebox_test;charset=utf8mb4','root','jukebox-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
check(nj_download_name('별/빛:あ"')==='별_빛_あ_.mp3','unicode download filename');
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload JSON,revision INT,updated_by VARCHAR(32))');nj_schema($db);
$key='single:upload-fixture:01';$doc=['title'=>'업로드 검증곡','genreId'=>'kpop-original','ep'=>'1','body'=>['sunoUrl'=>'https://suno.com/song/12345678-1234-1234-1234-123456789abc']];$raw=json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);$db->prepare('INSERT INTO noa_documents VALUES(?,?,?,1,?)')->execute([$key,'single',$raw,'fixture']);$stored=$db->query('SELECT payload FROM noa_documents')->fetchColumn();
$coverRel='K-POP/EP.01 업로드 검증곡/cover.webp';$coverDir=nj_root().'/K-POP/EP.01 업로드 검증곡';mkdir($coverDir,0700,true);copy('/tmp/noa-jukebox-fixture/cover.webp',$coverDir.'/cover.webp');$coverHash=hash_file('sha256',$coverDir.'/cover.webp');nj_import($db,['song_key'=>$key,'source_url'=>$doc['body']['sunoUrl'],'suno_title'=>'원본제목','cover_path'=>$coverRel,'cover_bytes'=>filesize($coverDir.'/cover.webp'),'cover_sha256'=>$coverHash]);
$bytes=file_get_contents('/tmp/noa-jukebox-fixture/uploaded.wav');$b=['key'=>$key,'filename'=>'원본 음원.wav','bytes'=>strlen($bytes),'fingerprint'=>hash('sha256',$bytes),'originalArtist'=>''];
$u=nu_initialize($db,$b,'admin');$id=$u['id'];check(count(nu_chunks(nu_row($db,$id)))===0,'new upload starts empty');
nu_chunk($db,$id,1,substr($bytes,NU_CHUNK));$resume=nu_initialize($db,$b,'admin');check($resume['id']===$id&&$resume['chunks']===[1],'resume reuses exact chunks');
rejects(fn()=>nu_initialize($db,array_merge($b,['fingerprint'=>str_repeat('a',64)]),'admin'),'another_upload_is_active');
nu_chunk($db,$id,0,substr($bytes,0,NU_CHUNK));nu_chunk($db,$id,0,substr($bytes,0,NU_CHUNK));rejects(fn()=>nu_chunk($db,$id,0,str_repeat('x',NU_CHUNK)),'chunk_conflict');
$finished=nu_finish($db,$id);check($finished['status']==='analyzing','finish queues actual analysis');check(hash_file('sha256',nu_dir($id).'/input.audio')===hash('sha256',$bytes),'assembled source hash');
$jobs=nj_operation($db,'upload_claim')['uploads'];check(count($jobs)===1,'one worker owns job');check(nj_operation($db,'upload_claim')['uploads']===[],'second worker cannot duplicate');$auth=['id'=>$id,'lease'=>$jobs[0]['lease']];
$fixture=json_decode(file_get_contents('/tmp/noa-jukebox-fixture/analysis.json'),true);nj_operation($db,'upload_state',$auth+['status'=>'processing','source_analysis'=>$fixture['source_analysis']]);
$dir=nj_private().'/media/K-POP/EP.01 업로드 검증곡';mkdir($dir,0700,true);copy('/tmp/noa-jukebox-fixture/optimized.mp3',$dir.'/원본제목.mp3');
$r=$fixture+['song_key'=>$key,'source_url'=>$doc['body']['sunoUrl'],'suno_id'=>'12345678-1234-1234-1234-123456789abc','suno_title'=>'원본제목','audio_path'=>'K-POP/EP.01 업로드 검증곡/원본제목.mp3','errors'=>[]];
rejects(fn()=>nj_operation($db,'upload_commit',array_merge($auth,['result'=>array_merge($r,['song_key'=>'wrong-song'])])),'upload_result_identity_mismatch');
$result=nj_operation($db,'upload_commit',$auth+['result'=>$r]);check($result['ready']&&$result['input_removed'],'publish removes temporary WAV');$a=nj_find($db,$key);check(nj_verified($a,'audio'),'only verified MP3 becomes ready');check(hash_file('sha256',nj_file($a['audio_path']))===$fixture['audio_sha256'],'final hash matches SQL');
check(dirname(nj_file($a['cover_path']))===dirname(nj_file($a['audio_path']))&&$a['cover_sha256']===$coverHash,'legacy cover copied intact beside private MP3');
$same=nu_initialize($db,$b,'admin');foreach(str_split($bytes,NU_CHUNK) as $i=>$chunk)nu_chunk($db,$same['id'],$i,$chunk);check(nu_finish($db,$same['id'])['ready'],'identical source reused');check(nj_operation($db,'upload_claim')['uploads']===[],'same source never queued twice');
$bad=nu_initialize($db,array_merge($b,['filename'=>'fake.wav','fingerprint'=>str_repeat('c',64),'bytes'=>1024]),'admin');nu_chunk($db,$bad['id'],0,str_repeat('x',1024));rejects(fn()=>nu_finish($db,$bad['id']),'actual_audio_format_mismatch');check(nj_find($db,$key)['audio_sha256']===$fixture['audio_sha256'],'invalid replacement preserves confirmed MP3');
check($db->query('SELECT payload FROM noa_documents')->fetchColumn()===$stored,'existing document unchanged');
echo "PASS MySQL upload/resume, chunk integrity, duplicate prevention, worker leases, analyzed publication, invalid replacement preservation and temporary WAV deletion\n";
