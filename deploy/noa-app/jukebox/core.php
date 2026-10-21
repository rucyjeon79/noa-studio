<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function nj_root():string{return dirname(__DIR__,2).'/noa-jukebox';}
function nj_private():string{return dirname(__DIR__,3).'/noa-jukebox-private';}
function nj_download_name(string $title):string{
 $title=preg_replace('/[\x00-\x1f\x7f]/u','_',$title)??'NOA';
 return str_replace(['\\','/',':','*','?','"','<','>','|'],'_',$title?:'NOA').'.mp3';
}
function nj_document(PDO $db,string $key):?array{
 if(strlen($key)>191)return null;
 $q=$db->prepare('SELECT payload,kind FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);
 if($r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$d['_kind']=$r['kind'];return $d;}
 if(!preg_match('/^catalog:([a-f0-9]{64})$/D',$key,$m))return null;
 $q=$db->prepare("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE s.song_id=? AND v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)");$q->execute([$m[1]]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return null;
 $item=noa_sound_recovered($r,true);if(!$item)return null;$b=json_decode($r['fields_json'],true,512,JSON_THROW_ON_ERROR);
 return ['_kind'=>'story','_catalog_id'=>$m[1],'title'=>$item['title'],'genreId'=>$item['genre'],'ep'=>$item['ep'],'act'=>'','visibility'=>$r['public_verified']?'public':'private','body'=>$b+['sunoUrl'=>$item['sunoUrl']]];
}
function nj_catalog(PDO $db,bool $qa=false):array{
 $out=[];$sql="SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story'".($qa?",'jukebox_qa'":"").") ORDER BY doc_key";
 foreach($db->query($sql) as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$d['_kind']=$r['kind'];$out[$r['doc_key']]=$d;}
 try{foreach($db->query("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $r){$item=noa_sound_recovered($r,true);if($item){$key=$item['key'];$out[$key]=nj_document($db,$key);}}}catch(PDOException $e){error_log('[jukebox-catalog] recovery unavailable');}
 return $out;
}
function nj_taxonomy(PDO $db,string $key,array $doc):array{
 $out=['catalogId'=>$doc['_catalog_id']??null,'category1'=>[],'category2'=>[],'categoryIds'=>[]];
 $file=dirname(__DIR__,2).'/noa-bridge/taxonomy-store.php';if(!is_file($file)||($doc['_kind']??'')==='jukebox_qa')return $out;
 try{require_once $file;$row=nt_annotate_records($db,[['key'=>$key,'kind'=>$doc['_kind'],'catalogId'=>$out['catalogId']]])[0];$out['catalogId']=$row['catalogSongId'];$out['categoryIds']=$row['categories'];$map=array_column(nt_categories($db),null,'category_id');$levels=[[],[]];
  foreach($row['categories'] as $id){$chain=[];for($n=0;$n<16&&isset($map[$id]);$n++){$chain[]=$map[$id];$id=$map[$id]['parent_id'];if($id===null)break;}$chain=array_reverse($chain);foreach([0,1] as $i)if(isset($chain[$i]))$levels[$i][$chain[$i]['category_id']]=['id'=>$chain[$i]['category_id'],'name'=>$chain[$i]['name']];}
  $out['category1']=array_values($levels[0]);$out['category2']=array_values($levels[1]);
 }catch(PDOException $e){error_log('[jukebox-taxonomy] read unavailable');}return $out;
}
function nj_file(string $relative):?string{
 if($relative===''||str_contains($relative,"\0")||str_contains($relative,'\\')||str_starts_with($relative,'/')||preg_match('~(?:^|/)\.{1,2}(?:/|$)~',$relative))return null;
 foreach([nj_private().'/media',nj_root()] as $base){$root=realpath($base);$path=realpath($base.'/'.$relative);
  if($root&&$path&&str_starts_with($path,$root.'/')&&is_file($path)&&is_readable($path))return $path;}
 return null;
}
function nj_schema(PDO $db):void{
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_assets (song_key VARCHAR(191) PRIMARY KEY, source_url TEXT NOT NULL, suno_id VARCHAR(64) NOT NULL DEFAULT '', suno_title TEXT NULL, genre VARCHAR(128) NOT NULL DEFAULT '', ep VARCHAR(32) NOT NULL DEFAULT '', title TEXT NULL, cover_path TEXT NULL, cover_bytes BIGINT NULL, cover_sha256 CHAR(64) NULL, audio_path TEXT NULL, audio_bytes BIGINT NULL, audio_sha256 CHAR(64) NULL, source_analysis JSON NULL, correction JSON NULL, final_analysis JSON NULL, source_evidence JSON NULL, status VARCHAR(32) NOT NULL DEFAULT 'audio_pending', errors JSON NULL, verified_at DATETIME NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 if(!$db->query("SHOW COLUMNS FROM noa_jukebox_assets LIKE 'source_evidence'")->fetch())$db->exec("ALTER TABLE noa_jukebox_assets ADD COLUMN source_evidence JSON NULL");
 if(!$db->query("SHOW COLUMNS FROM noa_jukebox_assets LIKE 'catalog_context'")->fetch())$db->exec("ALTER TABLE noa_jukebox_assets ADD COLUMN catalog_context JSON NULL");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_history (id BIGINT AUTO_INCREMENT PRIMARY KEY, song_key VARCHAR(191) NOT NULL, result JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY(song_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_jobs (id BIGINT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(32) NOT NULL, requested_by VARCHAR(191) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'queued', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_uploads (id CHAR(32) PRIMARY KEY,sequence BIGINT NOT NULL AUTO_INCREMENT UNIQUE,song_key VARCHAR(191) NOT NULL,source_url TEXT NOT NULL,filename TEXT NOT NULL,extension VARCHAR(4) NOT NULL,file_bytes BIGINT NOT NULL,fingerprint CHAR(64) NOT NULL,total_chunks INT NOT NULL,status VARCHAR(32) NOT NULL,sha256 CHAR(64) NULL,previous_sha256 CHAR(64) NULL,context JSON NOT NULL,source_analysis JSON NULL,correction JSON NULL,final_analysis JSON NULL,error VARCHAR(191) NULL,lease CHAR(32) NULL,lease_until DATETIME NULL,requested_by VARCHAR(191) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY(song_key),KEY(status,lease_until)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_downloads (id BIGINT AUTO_INCREMENT PRIMARY KEY,song_key VARCHAR(191) NOT NULL,sha256 CHAR(64) NOT NULL,bytes BIGINT NOT NULL,requested_by VARCHAR(191) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY(song_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function nj_find(PDO $db,string $key):?array{
 $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=?');$q->execute([$key]);return $q->fetch(PDO::FETCH_ASSOC)?:null;
}
function nj_url(string $key,string $type):string{return 'https://noastudio.ai.kr/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type='.$type;}
function nj_verified(?array $asset,string $type):bool{
 if(!$asset||($type==='audio'&&$asset['status']!=='ready'))return false;
 $p=nj_file((string)($asset[$type.'_path']??''));$hash=(string)($asset[$type.'_sha256']??'');
 if(!$p||!preg_match('/^[a-f0-9]{64}$/D',$hash)||filesize($p)!==(int)$asset[$type.'_bytes'])return false;
 if(!hash_equals($hash,hash_file('sha256',$p)))return false;
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($p);
 return $mime===($type==='cover'?'image/webp':'audio/mpeg');
}
function nj_assets(PDO $db):array{
 try{$out=[];foreach($db->query('SELECT * FROM noa_jukebox_assets') as $r)$out[$r['song_key']]=$r;return $out;}
 catch(PDOException $e){error_log('[jukebox] assets unavailable');return [];}
}
function nj_resolve(array $assets,string $key,string $source,string $type):string{
 $r=$assets[$key]??null;
 return $r&&hash_equals($r['source_url'],$source)&&nj_verified($r,$type)?nj_url($key,$type):'';
}
function nj_range(?string $header,int $size):array{
 if($size<=0)throw new InvalidArgumentException('empty');
 if(!$header)return [0,$size-1,200];
 if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$header,$m)||($m[1]===''&&$m[2]===''))throw new InvalidArgumentException('range');
 if($m[1]===''){$n=(int)$m[2];if($n<1)throw new InvalidArgumentException('range');$start=max(0,$size-$n);$end=$size-1;}
 else{$start=(int)$m[1];$end=$m[2]===''?$size-1:min($size-1,(int)$m[2]);}
 if($start>=$size||$start>$end)throw new InvalidArgumentException('range');
 return [$start,$end,206];
}
function nj_import(PDO $db,array $r,bool $replace=false,?string $expected=null):void{
 $key=(string)($r['song_key']??'');$doc=nj_document($db,$key);
 if(!$doc)throw new DomainException('unknown_song');
 $source=noa_sound_suno($doc['body']??[]);if(!hash_equals($source,(string)$r['source_url']))throw new DomainException('source_changed');
 $old=nj_find($db,$key);
 if(!$replace&&!empty($r['cover_path'])&&$old&&$old['source_url']===$source&&nj_verified($old,'audio')){
  $cover=nj_file((string)$r['cover_path']);$audio=nj_file($old['audio_path']);$target=dirname($audio).'/cover.webp';
  if(!$cover)throw new DomainException('cover_source_missing');if(!is_file($target)){if(!copy($cover,$target))throw new RuntimeException('cover_copy_failed');chmod($target,0600);}
  if(!hash_equals((string)$r['cover_sha256'],hash_file('sha256',$target)))throw new DomainException('cover_copy_conflict');$r['cover_path']=dirname($old['audio_path']).'/cover.webp';
 }
 $new=['song_key'=>$key,'source_url'=>$source,'suno_id'=>(string)($r['suno_id']??''),'suno_title'=>$r['suno_title']??null,'genre'=>$doc['genreId']??'','ep'=>$doc['ep']??'','title'=>(($doc['body']['confirmedTitle']??'')?:($doc['title']??'')), 'status'=>'audio_pending'];
 foreach(['cover','audio'] as $type){
  if(empty($r[$type.'_path']))continue;
  $candidate=$r;if($type==='audio')$candidate['status']='ready';
  if(!nj_verified($candidate,$type))throw new DomainException('file_verification_failed');
  if($type==='cover'){if(!getimagesize(nj_file($r['cover_path'])))throw new DomainException('cover_decode_failed');}
  else{
   $a=$r['final_analysis']??[];
   if(($a['codec']??'')!=='mp3'||($a['channels']??0)!==2||($a['decode_errors']??true)||!is_numeric($a['true_peak']??null)||$a['true_peak']>-1||($a['duration']??0)<=0)throw new DomainException('audio_analysis_invalid');
   $new['status']='ready';
  }
  foreach(['path','bytes','sha256'] as $f)$new[$type.'_'.$f]=$r[$type.'_'.$f];
 }
 foreach(['source_analysis','correction','final_analysis','errors'] as $f)if(isset($r[$f]))$new[$f]=json_encode($r[$f],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $new['source_evidence']=isset($r['audio_discovery'])?json_encode($r['audio_discovery'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR):null;
 $new['catalog_context']=json_encode(($r['catalog_context']??[])+['act'=>$doc['act']??'','category1'=>$doc['category1']??'','category2'=>$doc['category2']??''],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $new['verified_at']=gmdate('Y-m-d H:i:s');
 $db->beginTransaction();
 try{
  // Never overwrite a verified edition implicitly; retain it and append new evidence.
  $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$old=$q->fetch(PDO::FETCH_ASSOC);
  if($replace&&($old['audio_sha256']??null)!==$expected)throw new DomainException('confirmed_audio_changed');
  if($old&&$old['source_url']===$source){
   $new['catalog_context']=json_encode(json_decode($new['catalog_context'],true)+json_decode($old['catalog_context']??'{}',true),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
   if($new['source_evidence']===null)$new['source_evidence']=$old['source_evidence']??null;
   foreach(['suno_id','suno_title'] as $field)if(empty($new[$field])&&!empty($old[$field]))$new[$field]=$old[$field];
   foreach(['cover','audio'] as $type)if(nj_verified($old,$type)&&!($replace&&!empty($new[$type.'_path']))){
    foreach(['path','bytes','sha256'] as $f)$new[$type.'_'.$f]=$old[$type.'_'.$f];
    if($type==='audio'){$new['status']='ready';foreach(['source_analysis','correction','final_analysis'] as $f)$new[$f]=$old[$f];}
   }
  }
  $columns=array_keys($new);$sql='INSERT INTO noa_jukebox_assets (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($new),'?')).') ON DUPLICATE KEY UPDATE '.implode(',',array_map(fn($k)=>'`'.$k.'`=VALUES(`'.$k.'`)',$columns));
  $db->prepare($sql)->execute(array_values($new));
  $db->prepare('INSERT INTO noa_jukebox_history(song_key,result) VALUES(?,?)')->execute([$key,json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
