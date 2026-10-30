<?php
declare(strict_types=1);
ini_set('display_errors','0');set_time_limit(180);header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
function verified_cached(array $a,string $type):bool{static $cache=[];$k=$a['song_key'].'|'.$type;return $cache[$k]??=nj_verified($a,$type);}
$db=noa_bridge_pdo();
try{
 $db->beginTransaction();
 $assets=$db->query('SELECT * FROM noa_jukebox_assets ORDER BY song_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 $uploads=$db->query('SELECT id,song_key,status FROM noa_jukebox_uploads ORDER BY id FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
 foreach($uploads as $u)if(!in_array($u['status'],['ready','failed','canceled','cancelled'],true))throw new RuntimeException('upload_active');
 $documents=$db->query('SELECT doc_key,kind,payload FROM noa_documents ORDER BY doc_key')->fetchAll(PDO::FETCH_ASSOC);
 $qa=[];$texts='';foreach($documents as $d){if($d['kind']==='jukebox_qa')$qa[$d['doc_key']]=true;else $texts.="\n".rawurldecode(str_replace('\\/','/',$d['payload']));}
 foreach($db->query('SELECT fields_json FROM noa_catalog_versions')as $r)$texts.="\n".rawurldecode(str_replace('\\/','/',$r['fields_json']));
 foreach(array_merge(glob(dirname(__DIR__).'/*.php'),glob(dirname(__DIR__).'/*.js'),glob(dirname(__DIR__).'/*.css'))as $f)$texts.=rawurldecode((string)file_get_contents($f));
 $root=nj_private().'/media';$public=nj_root();$protected=[];$current=[];$bad=[];$candidates=[];$qaAssets=[];
 function safe_file(string $p,string $root):bool{return !is_link($p)&&is_file($p)&&realpath($p)===$p&&str_starts_with($p,$root.'/');}
 function candidate(string $p,string $sha,string $why,string $root):void{global $protected,$candidates,$texts;
  if(isset($protected[$p])||!safe_file($p,$root)||!preg_match('/^[a-f0-9]{64}$/D',$sha))return;
  $relative=substr($p,strlen($root)+1);if(str_contains($texts,'/noa-jukebox/'.$relative)||str_contains($texts,'"'.$relative.'"'))return;
  if(!hash_equals($sha,hash_file('sha256',$p)))return;
  $candidates[$p]=['path'=>$p,'sha256'=>$sha,'bytes'=>filesize($p),'reason'=>$why];
 }
 foreach($assets as $a){$current[$a['song_key']]=$a;if(isset($qa[$a['song_key']])){$qaAssets[]=$a;continue;}
  foreach(['audio','cover']as $type){if(empty($a[$type.'_path']))continue;$p=nj_file($a[$type.'_path']);if(!$p||!verified_cached($a,$type)){$bad[]=['key'=>$a['song_key'],'type'=>$type];continue;}$protected[$p]=['sha256'=>$a[$type.'_sha256'],'bytes'=>(int)$a[$type.'_bytes']];}
 }
 if($bad)throw new RuntimeException('current_media_verification_failed:'.count($bad));
 // When both copies are identical, retain the public copy so existing direct URLs
 // and nj_file's fallback keep working without any database rewrite.
 $duplicatePrivate=[];
 foreach($assets as $a){$rel=$a['cover_path']??'';$privatePath=$root.'/'.$rel;$publicPath=$public.'/'.$rel;
  if(!$rel||!isset($protected[$privatePath])||!safe_file($publicPath,$public))continue;
  if(filesize($publicPath)!==(int)$a['cover_bytes']||!hash_equals((string)$a['cover_sha256'],hash_file('sha256',$publicPath)))continue;
  $protected[$publicPath]=$protected[$privatePath];unset($protected[$privatePath]);
  $duplicatePrivate[$privatePath]=['path'=>$privatePath,'sha256'=>$a['cover_sha256'],'bytes'=>(int)$a['cover_bytes'],'reason'=>'duplicate_private_cover'];
 }
 $candidates=$duplicatePrivate;
 foreach($db->query('SELECT song_key,result FROM noa_jukebox_history ORDER BY id')as $r){$h=json_decode($r['result'],true);$a=$current[$r['song_key']]??null;
  foreach(['audio','cover']as $type){$relative=$h[$type.'_path']??'';if(!$relative||str_contains($relative,'..')||str_starts_with($relative,'/'))continue;
   $isQa=isset($qa[$r['song_key']]);if(!$isQa&&(!$a||empty($a[$type.'_path'])||!verified_cached($a,$type)))continue;
   foreach([$root,$public]as $base)candidate($base.'/'.$relative,(string)($h[$type.'_sha256']??''),$isQa?'synthetic_qa':'superseded_history',$base);
  }
 }
 foreach($qaAssets as $a)foreach(['audio','cover']as $type){$relative=$a[$type.'_path']??'';if(!$relative||str_contains($relative,'..')||str_starts_with($relative,'/'))continue;foreach([$root,$public]as $base)candidate($base.'/'.$relative,(string)($a[$type.'_sha256']??''),'synthetic_qa',$base);}
 // Public duplicates of the exact verified private cover are redundant.
 foreach($assets as $a){$rel=$a['cover_path']??'';if(!$rel||!isset($protected[$root.'/'.$rel]))continue;candidate($public.'/'.$rel,(string)$a['cover_sha256'],'duplicate_public_cover',$public);}
 ksort($candidates);ksort($protected);$plan=array_values($candidates);$digest=hash('sha256',json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
 $apply=($_POST['apply']??'')==='1';$removed=[];
 if($apply){if(!hash_equals('__PLAN_SHA__',$digest))throw new RuntimeException('plan_changed');
  foreach($plan as $c){if(!safe_file($c['path'],str_starts_with($c['path'],$root.'/')?$root:$public)||filesize($c['path'])!==$c['bytes']||!hash_equals($c['sha256'],hash_file('sha256',$c['path'])))throw new RuntimeException('candidate_changed');}
  foreach($plan as $c){if(!unlink($c['path']))throw new RuntimeException('delete_failed');$removed[]=$c;}
  // Only synthetic asset rows whose files were removed; song documents/history are preserved.
  foreach($qaAssets as $a){$has=false;foreach(['audio','cover']as $type)if(!empty($a[$type.'_path'])&&nj_file($a[$type.'_path']))$has=true;if(!$has)$db->prepare('DELETE FROM noa_jukebox_assets WHERE song_key=?')->execute([$a['song_key']]);}
  $dirs=[];foreach([$root,$public]as $scanRoot){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($scanRoot,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f)if($f->isDir()&&!$f->isLink())$dirs[$f->getPathname()]=true;}foreach($removed as $c){$p=dirname($c['path']);while($p!==$root&&$p!==$public&&str_starts_with($p,'/hosting/noastudio/')){$dirs[$p]=true;$p=dirname($p);}}uksort($dirs,fn($a,$b)=>strlen($b)<=>strlen($a));foreach(array_keys($dirs) as $p)if(is_dir($p)&&!is_link($p)&&count(scandir($p))===2)rmdir($p);
  foreach($protected as $p=>$v)if(!is_file($p)||filesize($p)!==$v['bytes']||!hash_equals($v['sha256'],hash_file('sha256',$p)))throw new RuntimeException('protected_file_changed');
 }
 $extra=[];foreach([$root,$public]as $scanRoot){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($scanRoot,FilesystemIterator::SKIP_DOTS));foreach($it as $f){$p=$f->getPathname();if($f->isFile()&&!$f->isLink()&&!isset($protected[$p])&&preg_match('/\.(mp3|webp)$/i',$p))$extra[]=['path'=>$p,'bytes'=>$f->getSize()];}}
 $db->commit();echo json_encode(['ok'=>true,'mode'=>$apply?'apply':'audit','planSha256'=>$digest,'candidates'=>$plan,'remainingUnmappedMedia'=>$extra,'duplicatePrivateCovers'=>count($duplicatePrivate),'candidateCount'=>count($plan),'candidateBytes'=>array_sum(array_column($plan,'bytes')),'removedCount'=>count($removed),'protectedFiles'=>count($protected),'backupCreated'=>false,'realSongRowsChanged'=>0],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();echo json_encode(['ok'=>false,'error'=>$e instanceof PDOException?'database_error':$e->getMessage()]);}
