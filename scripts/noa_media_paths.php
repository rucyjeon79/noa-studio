<?php
declare(strict_types=1);
ini_set('display_errors','0');set_time_limit(180);header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
$db=noa_bridge_pdo();$links=[];$createdDirs=[];$committed=false;
function clean_media_path(string $p):string{$dir=dirname($p);$dir=preg_replace('/ \[v-[a-f0-9]{12}\]$/D','',$dir);return $dir.'/'.basename($p);}
function replace_paths($v,array $map){if(is_string($v))return $map[$v]??$v;if(is_array($v))foreach($v as $k=>$x)$v[$k]=replace_paths($x,$map);return $v;}
try{
 $db->beginTransaction();$assets=$db->query('SELECT * FROM noa_jukebox_assets ORDER BY song_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 foreach($db->query('SELECT status FROM noa_jukebox_uploads FOR UPDATE')as $u)if(!in_array($u['status'],['ready','failed','canceled','cancelled'],true))throw new RuntimeException('active_upload');
 $docs=$db->query('SELECT doc_key,kind,payload,revision FROM noa_documents ORDER BY doc_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 $moves=[];$updates=[];$map=[];$targets=[];$verified=0;
 foreach($assets as $a){$new=$a;
  foreach(['audio','cover']as $type){$rel=(string)($a[$type.'_path']??'');if(!$rel)continue;if(!nj_verified($a,$type))throw new RuntimeException('current_asset_invalid');$verified++;
   $next=clean_media_path($rel);if($next===$rel)continue;$src=nj_file($rel);$root=str_starts_with($src,nj_private().'/media/')?nj_private().'/media':nj_root();$dst=$root.'/'.$next;
   if(is_link($src)||realpath($src)!==$src||str_contains($next,'..'))throw new RuntimeException('unsafe_path');
   if(file_exists($dst)||is_link($dst))throw new RuntimeException('destination_exists');
   if(isset($targets[$dst])&&$targets[$dst]!==$src)throw new RuntimeException('destination_collision');$targets[$dst]=$src;
   $moves[$src]=['source'=>$src,'target'=>$dst,'bytes'=>(int)$a[$type.'_bytes'],'sha256'=>$a[$type.'_sha256']];$new[$type.'_path']=$next;
   $map[$rel]=$next;$map[$src]=$dst;
   if($root===nj_root()){$map['/noa-jukebox/'.$rel]='/noa-jukebox/'.$next;$map['https://noastudio.ai.kr/noa-jukebox/'.$rel]='https://noastudio.ai.kr/noa-jukebox/'.$next;}
  }
  if($new!==$a)$updates[]=['key'=>$a['song_key'],'audio_path'=>$new['audio_path'],'cover_path'=>$new['cover_path']];
 }
 ksort($moves);$moves=array_values($moves);$digest=hash('sha256',json_encode([$moves,$updates],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
 $apply=($_POST['apply']??'')==='1';$docChanges=0;
 if($apply){if(!hash_equals('__PLAN_SHA__',$digest))throw new RuntimeException('plan_changed');
  // Hard links keep the old path readable until the database transaction commits.
  // They do not copy audio bytes and are removed after the switch.
  foreach($moves as $m){$dir=dirname($m['target']);if(!is_dir($dir)){if(!mkdir($dir,0700))throw new RuntimeException('mkdir_failed');$createdDirs[]=$dir;}if(realpath($dir)!==$dir)throw new RuntimeException('unsafe_directory');
   if(!link($m['source'],$m['target']))throw new RuntimeException('link_failed');$links[]=$m['target'];
   if(filesize($m['target'])!==$m['bytes']||!hash_equals($m['sha256'],hash_file('sha256',$m['target'])))throw new RuntimeException('target_verification_failed');
  }
  $q=$db->prepare('UPDATE noa_jukebox_assets SET audio_path=?,cover_path=? WHERE song_key=?');foreach($updates as $u)$q->execute([$u['audio_path'],$u['cover_path'],$u['key']]);
  foreach($docs as $r){$old=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$new=replace_paths($old,$map);if($old===$new)continue;$encoded=json_encode($new,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
   $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=revision+1,updated_by=? WHERE doc_key=? AND revision=?');$q->execute([$encoded,'path-fix',$r['doc_key'],(int)$r['revision']]);if($q->rowCount()!==1)throw new RuntimeException('revision_conflict');
   $db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)')->execute([$r['doc_key'],(int)$r['revision']+1,$encoded,'path-fix']);$docChanges++;
  }
  foreach($db->query('SELECT * FROM noa_jukebox_assets')as $a)foreach(['audio','cover']as $type)if(!empty($a[$type.'_path'])&&!nj_verified($a,$type))throw new RuntimeException('post_switch_verification_failed');
  $db->commit();$committed=true;
  foreach($moves as $m){if(!hash_equals($m['sha256'],hash_file('sha256',$m['source'])))throw new RuntimeException('source_changed');if(!unlink($m['source']))throw new RuntimeException('old_link_removal_failed');}
  $dirs=array_unique(array_map(fn($m)=>dirname($m['source']),$moves));foreach($dirs as $dir)if(is_dir($dir)&&!is_link($dir)&&count(scandir($dir))===2)rmdir($dir);
  foreach($moves as $m)if(file_exists($m['source'])||!is_file($m['target'])||!hash_equals($m['sha256'],hash_file('sha256',$m['target'])))throw new RuntimeException('final_path_verification_failed');
 }else $db->commit();
 $remaining=[];foreach([nj_private().'/media',nj_root()]as $root){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::SELF_FIRST);foreach($it as $f)if($f->isDir()&&preg_match('/ \[v-[a-f0-9]{12}\]$/D',$f->getFilename()))$remaining[]=$f->getPathname();}
 echo json_encode(['ok'=>true,'mode'=>$apply?'apply':'audit','planSha256'=>$digest,'moves'=>$moves,'filesMoved'=>$apply?count($moves):0,'assetRows'=>count($updates),'documentRows'=>$docChanges,'verifiedAssets'=>$verified,'remainingVersionFolders'=>$remaining,'backupCreated'=>false],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();if(!$committed){foreach(array_reverse($links)as $p)if(is_file($p))unlink($p);foreach(array_reverse($createdDirs)as $p)if(is_dir($p)&&count(scandir($p))===2)rmdir($p);}echo json_encode(['ok'=>false,'committed'=>$committed,'error'=>$e instanceof PDOException?'database_error':$e->getMessage()]);}
