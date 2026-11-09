<?php
declare(strict_types=1);
require_once __DIR__.'/hub.php';
/** Administrator-owned source packages. No archive extraction, URLs, shell or user-data paths. */
function n80_hub_target(string $web,string $path):string {
 if(strlen($path)>240||str_contains($path,'..')||str_contains($path,'//')||!preg_match('~^(?:noa-[a-z0-9-]+\.(?:php|js|css|json)|noa-(?:app|bridge)/[a-zA-Z0-9_/-]+\.(?:php|js|css|json|mjs))$~D',$path))throw new InvalidArgumentException('hub_target_not_allowed');
 $target=$web.'/'.$path;$parent=dirname($target);
 if(is_link($target)||!is_dir($parent)||realpath($parent)!==$parent||!str_starts_with($parent.'/',$web.'/'))throw new RuntimeException('hub_target_unsafe');
 if(file_exists($target)&&(!is_file($target)||filesize($target)>4194304))throw new RuntimeException('hub_target_unsafe');
 return $target;
}
function n80_hub_package(array $package,string $web):array {
 if(($package['version']??null)!==1||!is_string($package['id']??null)||!preg_match('/^[a-f0-9]{32}$/D',$package['id'])||!is_array($package['files']??null)||!array_is_list($package['files'])||count($package['files'])<1||count($package['files'])>100)throw new InvalidArgumentException('hub_package_invalid');
 $seen=[];$files=[];$total=0;
 foreach($package['files']as $row){
  if(!is_array($row)||!is_string($row['path']??null)||isset($seen[$row['path']]))throw new InvalidArgumentException('hub_package_duplicate');
  $path=$row['path'];$seen[$path]=true;$target=n80_hub_target($web,$path);
  if(!array_key_exists('beforeSha256',$row)||($row['beforeSha256']!==null&&(!is_string($row['beforeSha256'])||!preg_match('/^[a-f0-9]{64}$/D',$row['beforeSha256']))))throw new InvalidArgumentException('hub_preimage_required');
  $bytes=is_string($row['data']??null)?base64_decode($row['data'],true):false;
  if($bytes===false||strlen($bytes)!==($row['bytes']??null)||strlen($bytes)<1||strlen($bytes)>4194304||hash('sha256',$bytes)!==($row['sha256']??''))throw new InvalidArgumentException('hub_source_checksum');
  $total+=strlen($bytes);if($total>8388608)throw new InvalidArgumentException('hub_package_too_large');
  if(str_ends_with($path,'.php')){try{token_get_all($bytes,TOKEN_PARSE);}catch(ParseError $e){throw new InvalidArgumentException('hub_php_syntax');}}
  $files[]=['path'=>$path,'target'=>$target,'beforeSha256'=>$row['beforeSha256'],'sha256'=>$row['sha256'],'bytes'=>$row['bytes'],'data'=>$bytes];
 }
 return $files;
}
/** Restore only files still matching this transaction. A concurrent edit is never overwritten. */
function n80_hub_release_restore(string $root,string $web,array $journal):bool {
 $restored=true;
 foreach(array_reverse($journal['files']??[])as $row){
  $p=n80_hub_target($web,$row['path']);$current=is_file($p)?hash_file('sha256',$p):null;
  $before=$row['before']===null?null:base64_decode($row['before'],true);
  if($before===false)throw new RuntimeException('hub_journal_invalid');
  $previous=$before===null?null:hash('sha256',$before);
  if($current===$previous)continue;
  if($current!==$row['after']){$restored=false;continue;}
  if($before===null){if(!unlink($p))$restored=false;}
  else{$tmp=$p.'.restore-'.bin2hex(random_bytes(8));if(file_put_contents($tmp,$before,LOCK_EX)!==strlen($before))throw new RuntimeException('hub_restore_failed');chmod($tmp,0644);if(!rename($tmp,$p))throw new RuntimeException('hub_restore_failed');}
  if(function_exists('opcache_invalidate'))opcache_invalidate($p,true);
 }
 if($restored){
  n80_hub_write($root,'source.json',$journal['source']);n80_hub_write($root,'releases.json',$journal['history']);
  $stored=$root.'/releases/'.$journal['id'].'.json';
  if(is_file($stored)&&!is_link($stored)&&hash_file('sha256',$stored)===$journal['packageSha256'])unlink($stored);
  n80_hub_write($root,'journal.json',[]);
 }
 return $restored;
}
function n80_hub_release_recover(string $root,string $web):bool {
 return n80_hub_locked($root,function()use($root,$web){$journal=n80_hub_read($root,'journal.json');return !$journal||n80_hub_release_restore($root,$web,$journal);});
}
function n80_hub_release_apply(string $root,string $web,array $package,int $revision):array {
 $files=n80_hub_package($package,$web);
 return n80_hub_locked($root,function()use($root,$web,$package,$files,$revision){
  $source=n80_hub_read($root,'source.json');$history=n80_hub_read($root,'releases.json');
  $packageHash=hash('sha256',json_encode($package,JSON_THROW_ON_ERROR));
  foreach($history as $r)if($r['id']===$package['id']){if($r['packageSha256']!==$packageHash)throw new DomainException('hub_release_identity_conflict');return $r+['duplicate'=>true];}
  if(($source['revision']??0)!==$revision)throw new DomainException('hub_source_revision_changed');
  if(n80_hub_read($root,'journal.json'))throw new DomainException('hub_deploy_recovery_required');
  $journal=[];$oldTotal=0;
  foreach($files as $row){$old=is_file($row['target'])?(string)file_get_contents($row['target']):null;
   $oldTotal+=strlen($old??'');if($oldTotal>8388608)throw new InvalidArgumentException('hub_preimage_too_large');
   if(($old===null?null:hash('sha256',$old))!==$row['beforeSha256'])throw new DomainException('hub_source_changed');
   $journal[]=['path'=>$row['path'],'before'=>$old===null?null:base64_encode($old),'after'=>$row['sha256']];
  }
  $transaction=['id'=>$package['id'],'packageSha256'=>$packageHash,'source'=>$source,'history'=>$history,'files'=>$journal];
  n80_hub_write($root,'journal.json',$transaction);$temps=[];
  try{
   foreach($files as $row){$temp=$row['target'].'.hub-'.bin2hex(random_bytes(8));$f=fopen($temp,'x');try{chmod($temp,0644);if(fwrite($f,$row['data'])!==strlen($row['data'])||!fflush($f))throw new RuntimeException('hub_stage_failed');if(function_exists('fsync'))fsync($f);}finally{fclose($f);}$temps[$row['path']]=$temp;
    if(hash_file('sha256',$temp)!==$row['sha256'])throw new RuntimeException('hub_stage_checksum');
   }
   foreach($files as $row){clearstatcache(true,$row['target']);$hash=is_file($row['target'])?hash_file('sha256',$row['target']):null;
    if($hash!==$row['beforeSha256'])throw new DomainException('hub_concurrent_source_change');
    if(!rename($temps[$row['path']],$row['target']))throw new RuntimeException('hub_activation_failed');
    if(function_exists('opcache_invalidate'))opcache_invalidate($row['target'],true);
    if(hash_file('sha256',$row['target'])!==$row['sha256'])throw new RuntimeException('hub_activation_checksum');
   }
   $receipt=['ok'=>true,'id'=>$package['id'],'packageSha256'=>$packageHash,'revision'=>$revision+1,'verifiedAt'=>time(),'files'=>array_map(fn($r)=>array_intersect_key($r,array_flip(['path','sha256','bytes'])),$files),'githubRequired'=>false];
   // The native source package is preserved outside the web root with its exact checksums.
   $folder=$root.'/releases';if(!is_dir($folder))mkdir($folder,0700);if(is_link($folder)||realpath($folder)!==$folder)throw new RuntimeException('hub_source_unsafe');
   $stored=$folder.'/'.$package['id'].'.json';if(file_exists($stored))throw new RuntimeException('hub_release_file_conflict');
   $out=fopen($stored,'x');try{chmod($stored,0600);$data=json_encode($package,JSON_THROW_ON_ERROR);if(fwrite($out,$data)!==strlen($data))throw new RuntimeException('hub_source_store_failed');}finally{fclose($out);}
   $source['revision']=$revision+1;$source['lastPackage']=$package['id'];$source['lastPackageSha256']=$packageHash;
   n80_hub_write($root,'source.json',$source);$history[]=$receipt;n80_hub_write($root,'releases.json',$history);n80_hub_write($root,'journal.json',[]);
   return $receipt;
  }catch(Throwable $e){
   n80_hub_release_restore($root,$web,$transaction);throw $e;
  }finally{foreach($temps as $temp)if(is_file($temp)&&!is_link($temp))unlink($temp);}
 });
}
