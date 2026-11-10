<?php
declare(strict_types=1);define('_GNUBOARD_',true);
function check(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);echo "PASS $label\n";}
$repo=dirname(__DIR__,2);$base=sys_get_temp_dir().'/n80-covers-test-'.bin2hex(random_bytes(8));$web=$base.'/html';$root=$base.'/noa-hub';mkdir($root,0700,true);
foreach(['noa-app/engine/hub.php','noa-app/engine/hub-covers.php','noa-app/engine/media-covers.php','noa-app/jukebox/core.php','noa-app/jukebox/media-location.php'] as $name){@mkdir(dirname($web.'/'.$name),0700,true);copy($repo.'/deploy/'.$name,$web.'/'.$name);}
foreach(['suno-cover.php','sound-core.php','music-readmodel.php','package-record.php','channel-ownership.php'] as $name){@mkdir($web.'/noa-bridge',0700,true);copy($repo.'/bridge/'.$name,$web.'/noa-bridge/'.$name);}
require $web.'/noa-app/engine/hub.php';require $web.'/noa-app/engine/hub-covers.php';
require $web.'/noa-bridge/sound-core.php';require $web.'/noa-bridge/music-readmodel.php';require $web.'/noa-bridge/package-record.php';require $web.'/noa-bridge/suno-cover.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=noa_hub_test;charset=utf8mb4','root',getenv('NOA_HUB_TEST_PASSWORD')?:'hub-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload JSON,revision INT,updated_by VARCHAR(32))');
$db->exec('CREATE TABLE noa_document_history(doc_key VARCHAR(191),revision INT,payload JSON,changed_by VARCHAR(32),PRIMARY KEY(doc_key,revision))');nj_schema($db);
$source='https://suno.com/song/12345678-1234-1234-1234-123456789abc';
$html='<meta property="og:image" content="https://cdn2.suno.ai/card.png">';[$id,$url]=nsc_metadata($source,$html);check($url==='https://cdn2.suno.ai/card.png','reuse public metadata parser');
$image=imagecreatetruecolor(64,64);imagefill($image,0,0,imagecolorallocate($image,20,50,180));ob_start();imagepng($image);$bytes=nsc_webp(ob_get_clean());check(getimagesizefromstring($bytes)['mime']==='image/webp','reuse bounded image conversion');
file_put_contents($web.'/own-cover.webp',$bytes);file_put_contents($web.'/noa-bridge/asset-covers.php',"<?php return ['fixture:owned'=>'https://noastudio.ai.kr/own-cover.webp'];");
$create=function(string $key,bool $package=false)use($db,$source){$doc=['title'=>'보존 '.$key,'genreId'=>'your-story','ownerId'=>'owner-a','body'=>['sunoUrl'=>$source,'lyricsBlock'=>'사용자 원문']];if($package)$doc['packageSchema']=1;$db->prepare('INSERT INTO noa_documents VALUES(?,?,?,1,?)')->execute([$key,'story',json_encode($doc),'fixture']);return $doc;};
$doc=$create('audio',true);$dir=nml_reserve_directory('audio',$doc);mkdir(nj_private().'/media/'.$dir,0700,true);$audio=$dir.'/original.mp3';$audioBytes='opaque original bytes; artwork processing must never rewrite them';file_put_contents(nj_private().'/media/'.$audio,$audioBytes);
$db->prepare('INSERT INTO noa_jukebox_assets(song_key,source_url,suno_id,suno_title,audio_path,audio_bytes,audio_sha256,status,source_evidence,source_analysis,correction,final_analysis,catalog_context) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute(['audio',$source,$id,'기존 음원 제목',$audio,strlen($audioBytes),hash('sha256',$audioBytes),'ready','{"permission":"original"}','{"input":1}','{"preserve":true}','{"output":1}','{"act":"1"}']);
$old=nj_find($db,'audio');$create('cover-only');$override=$create('override');$override['body']['coverImageUrl']='https://noastudio.ai.kr/own-cover.webp';$db->prepare('UPDATE noa_documents SET payload=? WHERE doc_key=?')->execute([json_encode($override),'override']);
$prepare=static fn($db,$key,$source)=>['source'=>$source,'id'=>$id,'bytes'=>$bytes];
$result=n80_hub_covers($db,$root,$prepare);echo 'ISOLATED_COVER_RESULT '.json_encode($result)."\n";check($result['recovered']===2&&$result['remaining']===0,'missing artwork published through native services');
$after=nj_find($db,'audio');foreach(['source_url','suno_id','suno_title','audio_path','audio_bytes','audio_sha256','source_analysis','correction','final_analysis','status','catalog_context'] as $field)check($after[$field]===$old[$field],'preserved '.$field);
check(file_get_contents(nj_file($audio))===$audioBytes,'audio file bytes untouched');check(nj_verified($after,'cover')&&dirname($after['cover_path'])===dirname($audio),'verified artwork beside existing audio');
check(nj_find($db,'override')===null,'explicit user artwork preserved');
$saved=json_decode($db->query("SELECT payload FROM noa_documents WHERE doc_key='audio'")->fetchColumn(),true);check($saved['body']['lyricsBlock']==='사용자 원문'&&$saved['ownerId']==='owner-a'&&!empty($saved['body']['cardImageLocation']),'package content and ownership preserved');
check(n80_hub_covers($db,$root,$prepare)['attempted']===0,'repeated run never republishes artwork');
$create('unavailable');$result=n80_hub_covers($db,$root,static fn()=>null);check($result['unavailable']===1&&$result['remaining']===1,'provider failure remains an explicit pending item');
check(n80_hub_covers($db,$root,static function(){throw new RuntimeException('must_not_retry');})['attempted']===0,'private retry state survives next run');
$create('race');$result=n80_hub_covers($db,$root,static function($db,$key,$source)use($prepare){$db->prepare('UPDATE noa_documents SET revision=revision+1 WHERE doc_key=?')->execute([$key]);return $prepare($db,$key,$source);});
check($result['conflicts']===1&&nj_find($db,'race')===null,'concurrent document edit is preserved');
$row=['key'=>'backoff','sunoUrl'=>$source];$state=[];for($i=0;$i<20;$i++)n80_hub_cover_retry($state,$row,100);check($state[n80_hub_cover_identity($row)]['next']===86500,'retry delay capped at one day');
check(n80_hub_cover_identity($row)!==n80_hub_cover_identity(['key'=>'backoff','sunoUrl'=>$source.'?new']),'changed source has distinct retry identity');
echo "N80_HUB_COVER_MYSQL_VERIFIED\n";
