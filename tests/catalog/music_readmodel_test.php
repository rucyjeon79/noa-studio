<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/sound-core.php';
require __DIR__.'/../../bridge/music-readmodel.php';
function check($value,string $name):void{if(!$value)throw new RuntimeException($name);}
class CountPDO extends PDO{public int $queries=0;public function query(string $query,?int $fetchMode=null,mixed ...$args):PDOStatement|false{$this->queries++;return $fetchMode===null?parent::query($query):parent::query($query,$fetchMode,...$args);}}
$db=new CountPDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT,payload TEXT);CREATE TABLE noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT);CREATE TABLE noa_catalog_songs(song_id TEXT,identity_json TEXT,genre_id TEXT,ep TEXT);CREATE TABLE noa_catalog_versions(batch_id TEXT,entity_id TEXT,entity_type TEXT,fields_json TEXT,public_verified INT);');
$db->exec("INSERT INTO noa_catalog_batches VALUES('latest','applied','2026-10-24')");
$key=str_repeat('a',64);$identity=json_encode(['song','youtube','UCwYy9xsAqDFat6AV5UKrfgA','abcdefghijk']);
$db->prepare('INSERT INTO noa_catalog_songs VALUES(?,?,?,?)')->execute([$key,$identity,'your-story','']);
$body=['title'=>'Public recovered','privacyStatus'=>'public','lyricsBlock'=>"[Verse]\n원본 그대로\n[Chorus]\n다시",'songDescription'=>'설명'];
$db->prepare('INSERT INTO noa_catalog_versions VALUES(?,?,?,?,?)')->execute(['latest',$key,'song',json_encode($body),1]);
$rows=noa_music_recovered_catalog($db);check($db->queries===2,'bulk lookup must use two queries');check($rows['catalog:'.$key]['body']['lyricsBlock']===$body['lyricsBlock'],'raw source preserved');check(noa_sound_visible($rows['catalog:'.$key],false),'public remains public');
$override=['title'=>'Edited title','visibility'=>'private','body'=>['lyricsBlock'=>'편집 원본','songDescription'=>'편집 설명']];
$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)')->execute(['catalog:'.$key,'story',json_encode($override)]);$db->queries=0;
$rows=noa_music_recovered_catalog($db);check($db->queries===2,'override lookup remains bounded');check($rows['catalog:'.$key]['body']['lyricsBlock']==='편집 원본','document override retained');check(!noa_sound_visible($rows['catalog:'.$key],false),'private override not bypassed');
$detail=noa_music_detail_fields($override);check($detail['rawLyrics']==='편집 원본'&&$detail['description']==='편집 설명','detail uses same original fields');
check(noa_music_detail_fields(['body'=>['source'=>['platform'=>'youtube'],'description'=>'Provider metadata']])['description']==='','provider description rule retained');
check(noa_music_detail_fields(['body'=>['descriptionBlock'=>'Preferred','description'=>'Fallback']])['description']==='Preferred','description precedence retained');
function nj_file(string $path):?string{return is_file($path)?$path:null;}
function nj_url(string $key,string $type):string{return '/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type='.$type;}
check(noa_music_asset_url([],'missing','','audio')==='','missing asset absent');
$tmp=tempnam(sys_get_temp_dir(),'noa-view-');file_put_contents($tmp,'not an MP3');
$asset=['source_url'=>'source','status'=>'ready','audio_path'=>$tmp,'audio_sha256'=>str_repeat('b',64),'audio_bytes'=>10];
check(noa_music_asset_url(['x'=>$asset],'x','other','audio')==='','source mismatch absent');check(noa_music_asset_url(['x'=>$asset],'x','source','audio')==='','wrong mime absent');unlink($tmp);
$stream=file_get_contents(__DIR__.'/../../deploy/noa-app/jukebox/stream.php');check(str_contains($stream,'nj_verified('),'delivery must retain full SHA verification');
echo "MUSIC_BULK_SHADOWING_RAW_DETAILS_AND_DELIVERY_INTEGRITY_OK\n";
