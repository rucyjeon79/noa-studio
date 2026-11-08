<?php
declare(strict_types=1);
/** Media locations belong to the existing N80 Jukebox publisher, never a separate mover. */
require_once __DIR__.'/core.php';
function nml_component(string $name):string {
 $name=trim(preg_replace('~[\x00-\x1f\x7f/\\\\:*?"<>|]~u','_',$name)??'');
 $name=rtrim(mb_strcut($name,0,160,'UTF-8'),'. ');return $name!==''&&$name!=='.'?$name:'제목 없음';
}
function nml_directory(string $key,array $doc):string {
 $genre=(string)($doc['genreId']??'');
 if(isset($doc['_creative'])&&empty($doc['_creative']['locationConfirmed'])&&empty($doc['_creative']['publication']))$genre='';
 $title='';foreach([$doc['body']['displayTitle']??'',$doc['body']['confirmedTitle']??'',$doc['title']??''] as $candidate)if(is_string($candidate)&&trim($candidate)!==''){$title=$candidate;break;}$title=nml_component($title);
 $ep=(string)($doc['ep']??'');$base=['kpop-original'=>'K-POP','jpop-original'=>'J-POP','pop-original'=>'POP','thai-original'=>'Thai'];
 if($genre===''||$genre==='unclassified')return '기타/'.$title;
 if($genre==='your-story')$dir='사연곡/'.$title;
 elseif($genre==='cover-reborn')$dir='커버곡/'.$title;
 elseif(isset($base[$genre]))$dir=$base[$genre].'/'.($ep!==''?'EP.'.str_pad($ep,2,'0',STR_PAD_LEFT).' ':'').$title;
 elseif(preg_match('/^[a-z][a-z0-9-]*$/D',$genre))$dir='컬렉션/'.nml_component($genre).'/'.$title;
 else return '기타/'.$title;
 return $dir;
}
/** Reserve readable names outside the media tree; identity never becomes a folder label.
 * flock serializes competing uploads before either writes bytes. Reservations survive
 * rollback/retry, and draft/publication aliases retain the same stable identity.
 */
function nml_reserve_directory(string $key,array $doc):string {
 $base=nml_directory($key,$doc);$owner=hash('sha256',(string)($doc['creativeDraftId']??$doc['_creative']['id']??$key));
 if(is_link(nj_private()))throw new DomainException('unsafe_media_path');
 if(!is_dir(nj_private())&&!@mkdir(nj_private(),0700)&&!is_dir(nj_private()))throw new RuntimeException('media_directory_failed');
 $root=nj_private().'/media-directory-owners';
 if(is_link($root))throw new DomainException('unsafe_media_path');
 if(!is_dir($root)&&!@mkdir($root,0700)&&!is_dir($root))throw new RuntimeException('media_directory_failed');
 for($number=1;$number<=10000;$number++){
  $directory=$base.($number===1?'':' ('.$number.')');$file=$root.'/'.hash('sha256',$directory);
  if(is_link($file))throw new DomainException('unsafe_media_path');
  $lock=fopen($file,'c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('media_directory_lock_failed');
  try{
   $reserved=stream_get_contents($lock);
   if($reserved!==''){if(hash_equals($reserved,$owner))return $directory;continue;}
   // Never claim an existing unowned folder, even when its bytes happen to match.
   $path=nj_private().'/media/'.$directory;
   if(file_exists($path)||is_link($path)||file_exists(nj_root().'/'.$directory)||is_link(nj_root().'/'.$directory))continue;
   rewind($lock);if(fwrite($lock,$owner)!==strlen($owner)||!fflush($lock))throw new RuntimeException('media_directory_reservation_failed');
   chmod($file,0600);return $directory;
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 throw new DomainException('media_directory_names_exhausted');
}
function nml_replace(mixed $value,array $map):mixed {
 if(is_string($value))return $map[$value]??$value;
 if(is_array($value))foreach($value as $key=>$item)$value[$key]=nml_replace($item,$map);
 return $value;
}
/** Runs after commit (or rollback); only exact, now-unreferenced owned bytes are removed. */
function nml_cleanup(PDO $db):void {
 if($db->inTransaction())return;
 $pending=$GLOBALS['nml_cleanup'][spl_object_id($db)]??[];
 foreach($pending as $relative=>$entry){
  try {
   $q=$db->prepare('SELECT 1 FROM noa_jukebox_assets WHERE audio_path=? OR cover_path=? LIMIT 1');$q->execute([$relative,$relative]);if($q->fetchColumn())continue;
   $q=$db->prepare("SELECT 1 FROM noa_documents WHERE JSON_SEARCH(payload,'one',?,NULL,'$.body') IS NOT NULL LIMIT 1");$q->execute(['%'.$relative]);if($q->fetchColumn())continue;
   $path=nj_file($relative);if(!$path||$path!==$entry['path']||is_link($path)||!hash_equals($entry['sha'],hash_file('sha256',$path)))continue;
   if(unlink($path)){unset($GLOBALS['nml_cleanup'][spl_object_id($db)][$relative]);$dir=dirname($path);if(is_dir($dir)&&!is_link($dir)&&count(scandir($dir))===2)rmdir($dir);}
  }catch(Throwable $e){error_log('[n80-media-location] cleanup deferred');}
 }
}
function nml_track(PDO $db,string $relative,string $path,string $sha):void {
 $id=spl_object_id($db);if(!isset($GLOBALS['nml_cleanup'][$id])){ $GLOBALS['nml_cleanup'][$id]=[];register_shutdown_function(static function()use($db){nml_cleanup($db);}); }
 $GLOBALS['nml_cleanup'][$id][$relative]=['path'=>$path,'sha'=>$sha];
}
/** Caller owns the SQL transaction. Hard links keep playback available through commit. */
function nml_sync(PDO $db,string $key,array $doc,bool $uploadCommit=false):array {
 if(!$db->inTransaction())throw new LogicException('media_location_transaction_required');
 try{$q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$asset=$q->fetch(PDO::FETCH_ASSOC);}
 catch(PDOException $e){if($e->getCode()==='42S02')return $doc;throw $e;}
 if(!$asset)return $doc;
 $directory=nml_reserve_directory($key,$doc);$moves=[];$map=[];$next=$asset;
 foreach(['audio','cover'] as $type){
  $old=(string)($asset[$type.'_path']??'');if($old==='')continue;
  $target=$directory.'/'.basename($old);if($target===$old)continue;
  $existing=nj_file($target);if($existing&&!hash_equals((string)$asset[$type.'_sha256'],hash_file('sha256',$existing)))$target=$directory.'/'.pathinfo($old,PATHINFO_FILENAME).'-'.substr((string)$asset[$type.'_sha256'],0,12).'.'.pathinfo($old,PATHINFO_EXTENSION);
  if(!nj_verified($asset,$type))throw new DomainException('file_verification_failed');
  $source=nj_file($old);if(is_link($source)||realpath($source)!==$source)throw new DomainException('unsafe_media_path');
  $moves[]=[$old,$target,$source,$asset[$type.'_sha256'],(int)$asset[$type.'_bytes']];$next[$type.'_path']=$target;$map[$old]=$target;$map['/noa-jukebox/'.$old]='/noa-jukebox/'.$target;$map['https://noastudio.ai.kr/noa-jukebox/'.$old]=nj_url($key,$type);
 }
 if($moves){
  if(!$uploadCommit){$q=$db->prepare("SELECT 1 FROM noa_jukebox_uploads WHERE song_key=? AND status NOT IN ('ready','failed','canceled','cancelled') LIMIT 1 FOR UPDATE");$q->execute([$key]);if($q->fetchColumn())throw new DomainException('upload_busy');}
  $root=nj_private().'/media';if(!is_dir($root)&&!mkdir($root,0700,true))throw new RuntimeException('media_directory_failed');
  $dir=$root;foreach(explode('/',$directory) as $part){$dir.='/'.$part;if(is_link($dir))throw new DomainException('unsafe_media_path');if(!is_dir($dir)&&!mkdir($dir,0700))throw new RuntimeException('media_directory_failed');if(realpath($dir)!==$dir)throw new DomainException('unsafe_media_path');}
  foreach($moves as [$old,$target,$source,$sha,$bytes]){
   $dest=$root.'/'.$target;if(is_link($dest))throw new DomainException('unsafe_media_path');
   if(!file_exists($dest)){if(!link($source,$dest))throw new RuntimeException('media_move_failed');nml_track($db,$target,$dest,$sha);}
   if(!is_file($dest)||filesize($dest)!==$bytes||!hash_equals($sha,hash_file('sha256',$dest)))throw new DomainException('media_destination_conflict');
   nml_track($db,$old,$source,$sha);
  }
  $db->prepare('UPDATE noa_jukebox_assets SET audio_path=?,cover_path=?,genre=?,ep=?,title=? WHERE song_key=?')->execute([$next['audio_path'],$next['cover_path'],$doc['genreId']??'',$doc['ep']??'',$doc['title']??'',$key]);
  $next=nj_find($db,$key);$doc['body']=nml_replace($doc['body']??[],$map);
 }
 $doc['body']['uploadedAsset']=$next;
 foreach(['audio'=>'audioFileLocation','cover'=>'cardImageLocation'] as $type=>$field)if(!empty($next[$type.'_path']))$doc['body'][$field]=$next[$type.'_path'];
 return $doc;
}
