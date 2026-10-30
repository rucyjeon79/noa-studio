<?php
declare(strict_types=1);
ini_set('display_errors','0');set_time_limit(180);header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
$db=noa_bridge_pdo();$links=[];$committed=false;
function nc_replace($v,array $map){if(is_string($v))return $map[$v]??$v;if(is_array($v))foreach($v as $k=>$x)$v[$k]=nc_replace($x,$map);return $v;}
try{
 $db->beginTransaction();$assets=$db->query('SELECT * FROM noa_jukebox_assets ORDER BY song_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 foreach($db->query('SELECT status FROM noa_jukebox_uploads FOR UPDATE')as $u)if(!in_array($u['status'],['ready','failed','canceled','cancelled'],true))throw new RuntimeException('active_upload');
 $docs=$db->query('SELECT doc_key,kind,payload,revision FROM noa_documents ORDER BY doc_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 $roots=[nj_private().'/media',nj_root()];$moves=[];$updates=[];$targets=[];$protectedAudio=[];$coverOnly=0;$allCovers=[];$duplicates=[];$urlMap=[];
 foreach($assets as $a){$cover=(string)($a['cover_path']??'');$audio=(string)($a['audio_path']??'');
  if($audio){if(!nj_verified($a,'audio'))throw new RuntimeException('audio_invalid');$protectedAudio[nj_file($audio)]=[$a['audio_sha256'],(int)$a['audio_bytes']];}
  if(!$cover)continue;if(!nj_verified($a,'cover'))throw new RuntimeException('cover_invalid');$allCovers[]=['key'=>$a['song_key'],'sha256'=>$a['cover_sha256'],'bytes'=>(int)$a['cover_bytes']];
  if(!$audio){$coverOnly++;continue;}
  $src=nj_file($cover);$dst=dirname(nj_file($audio)).'/cover.webp';$relative=dirname($audio).'/cover.webp';
  if(is_link($src)||realpath($src)!==$src||realpath(dirname($dst))!==dirname($dst))throw new RuntimeException('unsafe_path');
  if(isset($targets[$dst])&&$targets[$dst]!==$a['cover_sha256'])throw new RuntimeException('shared_directory_conflict');$targets[$dst]=$a['cover_sha256'];
  if($src!==$dst&&str_starts_with($src,nj_root().'/')){
   $url=nj_url($a['song_key'],'cover');$urlMap['https://noastudio.ai.kr/noa-jukebox/'.$cover]=$url;$urlMap['/noa-jukebox/'.$cover]=$url;
   $encoded=implode('/',array_map('rawurlencode',explode('/',$cover)));$urlMap['https://noastudio.ai.kr/noa-jukebox/'.$encoded]=$url;$urlMap['/noa-jukebox/'.$encoded]=$url;
  }
  if($src!==$dst){if(file_exists($dst)&&(!is_file($dst)||is_link($dst)||!hash_equals($a['cover_sha256'],hash_file('sha256',$dst))))throw new RuntimeException('target_conflict');
   $moves[$dst]=['source'=>$src,'target'=>$dst,'sha256'=>$a['cover_sha256'],'bytes'=>(int)$a['cover_bytes']];
  }
  if($cover!==$relative)$updates[$a['song_key']]=['old'=>$cover,'new'=>$relative,'target'=>$dst];
 }
 ksort($moves);ksort($updates);$plan=array_values($moves);$digest=hash('sha256',json_encode([$plan,$updates],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
 $apply=($_POST['apply']??'')==='1';$changedDocs=0;$removed=0;
 if($apply){if(!hash_equals('__PLAN_SHA__',$digest))throw new RuntimeException('plan_changed');
  foreach($plan as $m){if(!file_exists($m['target'])){if(!link($m['source'],$m['target']))throw new RuntimeException('link_failed');$links[]=$m['target'];}
   if(filesize($m['target'])!==$m['bytes']||!hash_equals($m['sha256'],hash_file('sha256',$m['target'])))throw new RuntimeException('target_verification_failed');
  }
  foreach($updates as $key=>$u)$db->prepare('UPDATE noa_jukebox_assets SET cover_path=? WHERE song_key=? AND cover_path=?')->execute([$u['new'],$key,$u['old']]);
  foreach($docs as $r){$u=$updates[$r['doc_key']]??null;$old=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$map=$urlMap;if($u){$map[$u['old']]=$u['new'];
   foreach($roots as $root)$map[$root.'/'.$u['old']]=$u['target'];
   $map['https://noastudio.ai.kr/noa-jukebox/'.$u['old']]=nj_url($r['doc_key'],'cover');$map['/noa-jukebox/'.$u['old']]=nj_url($r['doc_key'],'cover');}
   $new=nc_replace($old,$map);if($new===$old)continue;$encoded=json_encode($new,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
   $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=revision+1,updated_by=? WHERE doc_key=? AND revision=?');$q->execute([$encoded,'media-layout',$r['doc_key'],(int)$r['revision']]);if($q->rowCount()!==1)throw new RuntimeException('revision_conflict');
   $db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)')->execute([$r['doc_key'],(int)$r['revision']+1,$encoded,'media-layout']);$changedDocs++;
  }
  // Prefer the verified audio directory even when the old public cover has the same relative path.
  $current=$db->query('SELECT * FROM noa_jukebox_assets')->fetchAll(PDO::FETCH_ASSOC);$keep=[];
  foreach($current as $a){foreach(['audio','cover']as $type){if(empty($a[$type.'_path']))continue;$p=nj_file($a[$type.'_path']);if(!nj_verified($a,$type))throw new RuntimeException('post_switch_invalid');$keep[$p]=true;}}
  foreach($plan as $m)if(!isset($keep[$m['source']])&&$m['source']!==$m['target'])$duplicates[$m['source']]=$m['sha256'];
  foreach($current as $a){$rel=$a['cover_path']??'';if(!$rel)continue;$chosen=nj_file($rel);foreach($roots as $root){$p=$root.'/'.$rel;if($p!==$chosen&&!isset($keep[$p])&&is_file($p)&&!is_link($p)&&hash_equals($a['cover_sha256'],hash_file('sha256',$p)))$duplicates[$p]=$a['cover_sha256'];}}
  $db->commit();$committed=true;
  foreach($duplicates as $p=>$sha){if(realpath($p)!==$p||!hash_equals($sha,hash_file('sha256',$p)))throw new RuntimeException('duplicate_changed');if(!unlink($p))throw new RuntimeException('duplicate_remove_failed');$removed++;}
  $dirs=[];foreach(array_keys($duplicates)as $p){$dir=dirname($p);while(!in_array($dir,$roots,true)&&str_starts_with($dir,'/hosting/noastudio/')){$dirs[$dir]=true;$dir=dirname($dir);}}uksort($dirs,fn($a,$b)=>strlen($b)<=>strlen($a));foreach(array_keys($dirs)as $p)if(is_dir($p)&&!is_link($p)&&count(scandir($p))===2)rmdir($p);
 }else $db->commit();
 $paired=0;$mismatch=[];$verified=0;$checks=[];
 foreach($db->query('SELECT * FROM noa_jukebox_assets')as $a){foreach(['audio','cover']as $type)if(!empty($a[$type.'_path'])){if(!nj_verified($a,$type))throw new RuntimeException('final_asset_invalid');$verified++;}
  if(!empty($a['audio_path'])&&!empty($a['cover_path'])){if(dirname(nj_file($a['audio_path']))===dirname(nj_file($a['cover_path'])))$paired++;else $mismatch[]=$a['song_key'];}
  if(!empty($a['cover_path'])){$d=nj_document($db,$a['song_key']);if($d&&noa_sound_visible($d,false)&&hash_equals(nj_asset_source($a,'cover'),noa_sound_suno($d['body']??[])))$checks[]=['url'=>nj_url($a['song_key'],'cover'),'sha256'=>$a['cover_sha256'],'bytes'=>(int)$a['cover_bytes']];}
 }
 foreach($protectedAudio as $p=>$v)if(!is_file($p)||filesize($p)!==$v[1]||!hash_equals($v[0],hash_file('sha256',$p)))throw new RuntimeException('audio_changed');
 echo json_encode(['ok'=>true,'mode'=>$apply?'apply':'audit','planSha256'=>$digest,'moves'=>$plan,'pathUpdates'=>count($updates),'documentUpdates'=>$changedDocs,'duplicatesRemoved'=>$removed,'pairedSongs'=>$paired,'remainingMismatches'=>$mismatch,'coverOnlySongs'=>$coverOnly,'audioUnchanged'=>count($protectedAudio),'verifiedFiles'=>$verified,'httpChecks'=>$checks,'backupCreated'=>false],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();if(!$committed)foreach($links as $p)if(is_file($p))unlink($p);echo json_encode(['ok'=>false,'committed'=>$committed,'error'=>$e instanceof PDOException?'database_error':$e->getMessage()]);}
