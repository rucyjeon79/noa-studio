<?php
declare(strict_types=1);
// Temporary, HMAC-authenticated, fixed-scope backup migration control.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('display_errors','0');
@set_time_limit(180);ignore_user_abort(true);
$root='/hosting/noastudio';
$raw=file_get_contents('php://input');
$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';
$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';
$sig=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';
$key=trim((string)@file_get_contents($root.'/noa-ai-lab/worker.key'));
$message="NOA-BACKUP-MIGRATION-1\n".$ts."\n".$nonce."\n".hash('sha256',$raw);
if($_SERVER['REQUEST_METHOD']!=='POST'||strlen($key)!==64||!ctype_digit($ts)||abs(time()-(int)$ts)>300||!preg_match('/^[a-f0-9]{32}$/D',$nonce)||!hash_equals(hash_hmac('sha256',$message,$key),$sig)){
 http_response_code(403);echo '{"ok":false,"error":"unauthorized"}';exit;
}
function inventory(string $root): array {
 $totals=[];$files=0;$errors=0;$candidates=[];$stack=[$root];
 while($stack){$dir=array_pop($stack);$entries=@scandir($dir);if($entries===false){$errors++;continue;}
  foreach($entries as $name){if($name==='.'||$name==='..')continue;$path=$dir.'/'.$name;$s=@lstat($path);if(!$s){$errors++;continue;}
   $kind=$s['mode']&0170000;if($kind===0040000){$stack[]=$path;continue;}if($kind!==0100000)continue;
   $rel=substr($path,strlen($root)+1);$top=explode('/',$rel)[0];if(!isset($totals[$top]))$totals[$top]=['bytes'=>0,'files'=>0];
   $totals[$top]['bytes']+=$s['size'];$totals[$top]['files']++;$files++;
   if(str_starts_with($rel,'noa-deploy-backups/')||preg_match('/(?:\.stage-|\.tmp$|synthetic|test-tone|sine-wave|qa-tone)/i',$name))$candidates[]=['path'=>$rel,'bytes'=>$s['size'],'mtime'=>$s['mtime']];
  }
 }
 return ['folders'=>$totals,'files'=>$files,'unreadable'=>$errors,'candidates'=>$candidates];
}
function protectedHashes(string $root): array {
 $out=[];foreach(['html/index.php','html/common.php','html/config.php','html/data/dbconfig.php','html/noa-app/database/core.php','html/noa-app/jukebox/core.php','html/noa-app/jukebox/service.php'] as $rel){$h=@hash_file('sha256',$root.'/'.$rel);if($h===false)throw new RuntimeException('protected_file_unreadable');$out[$rel]=$h;}return $out;
}
function sqlReferences(string $root): array {
 $needles=['15133165eb1e1d6529158ed051d94e9a','fda4138b6ba4d525f337e4a86038218f','d54c43955754a84d1fca3778345f37a0','ce1beb1a0ad64e9dc4b50654625c6618','362dfee5ef4c3df496fdbc83cb482a5a'];
 $found=[];$errors=0;$checked=0;$stack=[$root.'/html'];
 while($stack){$dir=array_pop($stack);$entries=@scandir($dir);if($entries===false){$errors++;continue;}
  foreach($entries as $name){if($name==='.'||$name==='..')continue;$p=$dir.'/'.$name;if(is_link($p))continue;if(is_dir($p)){$stack[]=$p;continue;}
   if($p===__FILE__||!preg_match('/\.(?:php|js|json)$/i',$name))continue;$f=@fopen($p,'rb');if(!$f){$errors++;continue;}$checked++;$tail='';$match=false;
   while(!feof($f)){$chunk=fread($f,131072);if($chunk===false){$errors++;break;}$text=$tail.$chunk;foreach($needles as $needle)if(strpos($text,$needle)!==false){$match=true;break 2;}$tail=substr($text,-64);}
   fclose($f);if($match)$found[]=substr($p,strlen($root)+1);
  }
 }
 return ['files_checked'=>$checked,'unreadable'=>$errors,'literal_references'=>$found];
}
try {
 $request=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$mode=$request['mode']??'';
 if(!in_array($mode,['inspect','cleanup'],true))throw new RuntimeException('invalid_mode');
 $before=inventory($root);$protected=protectedHashes($root);$refs=sqlReferences($root);
 $lockPath=$root.'/noa-db-private/operation.lock';if(is_link($lockPath))throw new RuntimeException('operation_lock_symlink');
 $lock=fopen($lockPath,'c');if(!$lock)throw new RuntimeException('operation_lock_unavailable');
 $locked=flock($lock,LOCK_EX|LOCK_NB);$active=[];
 foreach(glob($root.'/noa-db-private/*.partial')?:[] as $p)$active[]=basename($p);
 foreach(glob($root.'/noa-db-private/restore-plan-*.json')?:[] as $p){$plan=json_decode((string)file_get_contents($p),true);if(($plan['expiresAt']??PHP_INT_MAX)>time())$active[]=basename($p);}
 $removed=[];$skipped=[];$reclaimed=0;$deployLock=false;
 if($mode==='cleanup'){
  if(!$locked||$active||$refs['unreadable']||$refs['literal_references'])throw new RuntimeException('database_operation_or_reference_not_clear');
  $receipts=$request['receipts']??[];if(!$receipts||count($receipts)>500)throw new RuntimeException('invalid_receipts');
  $known=['15133165eb1e1d6529158ed051d94e9a','fda4138b6ba4d525f337e4a86038218f','d54c43955754a84d1fca3778345f37a0','ce1beb1a0ad64e9dc4b50654625c6618','362dfee5ef4c3df496fdbc83cb482a5a'];
  $ready=[];
  foreach($receipts as $r){if(str_starts_with($r['path']??'','noa-deploy-backups/')||str_starts_with($r['path']??'','noa-ai-lab/taxonomy-release-')){$deployLock=@mkdir($root.'/noa-deploy-backups/.work-deploy-lock',0700);if(!$deployLock)throw new RuntimeException('deployment_busy_preserved');break;}}
  foreach($receipts as $row){
   $rel=$row['path']??'';
   $sql=preg_match('/^noa-db-private\/([a-f0-9]{32})\.(sql|json)$/D',$rel,$m)&&in_array($m[1],$known,true);
   $deploy=(bool)preg_match('/^(?:noa-deploy-backups\/(?:p0-|jukebox-|jukebox-interface-|uiux-|full-|root-)[A-Za-z0-9_-]+|noa-ai-lab\/taxonomy-release-[0-9]+)\/[A-Za-z0-9_.\/-]+$/D',$rel);
   if((!$sql&&!$deploy)||str_contains($rel,'..')||str_contains($rel,'//'))throw new RuntimeException('path_not_allowlisted');
   if(empty($row['drive_file_id'])||($row['drive_readback_verified']??false)!==true||($row['isolated_restore_verified']??false)!==true)throw new RuntimeException('proof_missing');
   if(!preg_match('/^[a-f0-9]{64}$/D',$row['sha256']??'')||!is_int($row['bytes'])||$row['bytes']<0)throw new RuntimeException('invalid_proof');
   $path=$root.'/'.$rel;if(realpath(dirname($path))!==realpath($root).'/'.dirname($rel))throw new RuntimeException('parent_symlink_preserved');$s=@lstat($path);if(!$s){$skipped[]=['path'=>$rel,'reason'=>'already_absent'];continue;}
   if(($s['mode']&0170000)!==0100000||$s['size']!==$row['bytes']||!hash_equals($row['sha256'],hash_file('sha256',$path))){$skipped[]=['path'=>$rel,'reason'=>'source_changed_preserved'];continue;}
   $ready[]=$row;
  }
  if(protectedHashes($root)!==$protected)throw new RuntimeException('protected_changed');
  foreach($ready as $row){$path=$root.'/'.$row['path'];clearstatcache(true,$path);
   if(filesize($path)!==$row['bytes']||!hash_equals($row['sha256'],hash_file('sha256',$path))){$skipped[]=['path'=>$row['path'],'reason'=>'source_changed_before_delete'];continue;}
   if(!unlink($path)){$skipped[]=['path'=>$row['path'],'reason'=>'unlink_failed'];continue;}
   clearstatcache(true,$path);if(file_exists($path))throw new RuntimeException('delete_not_confirmed');$removed[]=$row;$reclaimed+=$row['bytes'];
  }
 }
 if($mode==='cleanup'){$dirs=[];foreach($removed as $row){$p=dirname($root.'/'.$row['path']);while(str_starts_with($p,$root.'/noa-deploy-backups/')||preg_match('#^'.preg_quote($root,'#').'/noa-ai-lab/taxonomy-release-[0-9]+(?:/|$)#',$p)){$dirs[$p]=true;$p=dirname($p);}}$paths=array_keys($dirs);usort($paths,fn($a,$b)=>strlen($b)<=>strlen($a));foreach($paths as $p)if(!is_link($p))@rmdir($p);}
 $after=inventory($root);$unchanged=protectedHashes($root)===$protected;
 if($deployLock)rmdir($root.'/noa-deploy-backups/.work-deploy-lock');
 if($locked)flock($lock,LOCK_UN);fclose($lock);
 echo json_encode(['ok'=>true,'mode'=>$mode,'before'=>$before,'after'=>$after,'sql_reference_check'=>$refs,'database_lock_acquired'=>$locked,'active_database_operations'=>$active,'removed'=>$removed,'skipped'=>$skipped,'reclaimed_bytes'=>$reclaimed,'protected_hashes'=>$protected,'protected_files_unchanged'=>$unchanged,'production_mysql_modified'=>false],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
} catch(Throwable $e){if(!empty($deployLock))@rmdir($root.'/noa-deploy-backups/.work-deploy-lock');http_response_code(409);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
