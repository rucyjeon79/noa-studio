<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_ACTIVITY_EXPIRY||!hash_equals('NOA_ACTIVITY_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-enrollment-core.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];if($owner!=='admin')throw new RuntimeException('owner_changed');
 $key=nc_channel_key($owner);$row=nc_row($db,$key);if(!$row||$row['kind']!=='prefs'||!nam_owner($row['document'],['mb_id'=>$owner]))throw new RuntimeException('owner_mismatch');
 $input=json_decode(file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);$action=$input['action']??'inspect';
 $file=nce_symbol_file((string)($row['document']['symbol']??''));if(!$file)throw new RuntimeException('current_symbol_missing');
 $hash=hash_file('sha256',$file['path']);$backup=nce_root().'/activity-profile-transparent-v1.json';if(is_link($backup))throw new RuntimeException('backup_symlink');
 $saved=is_file($backup)?nce_open(file_get_contents($backup)):null;
 $already=$saved&&($row['document']['symbol']??'')===$saved['symbol']&&($row['document']['profileBackgroundOpacity']??null)===0;
 if($action==='inspect'){$result=['ok'=>true,'revision'=>$row['revision'],'hash'=>$hash,'mime'=>$file['mime'],'alreadyApplied'=>$already];}
 elseif($action==='apply'){
  if($already){$result=['ok'=>true,'alreadyApplied'=>true,'revision'=>$row['revision'],'databaseWrites'=>0];}
  else{
   if($row['revision']!==($input['revision']??null)||!hash_equals($hash,(string)($input['hash']??'')))throw new RuntimeException('profile_changed');
   if($file['mime']!=='image/jpeg')throw new RuntimeException('preserve_newer_profile');
   $source=base64_decode('NOA_ACTIVITY_LOGO_BASE64',true);if(!$source||hash('sha256',$source)!=='458a060cf2114e95ea496819c9ea8c5d08999eaa3d3c748b5a56e90a488664ec')throw new RuntimeException('asset_mismatch');
   $png=nce_symbol_png($source);$image=imagecreatefromstring($png);if(((imagecolorat($image,0,0)>>24)&127)!==127)throw new RuntimeException('alpha_missing');imagedestroy($image);
   if($saved){if($saved['row']['revision']!==$row['revision']||$saved['row']['payload']!==$row['payload'])throw new RuntimeException('backup_conflict');$symbol=$saved['symbol'];}
   else{$symbol=bin2hex(random_bytes(24));$saved=['row'=>$row,'symbol'=>$symbol,'originalHash'=>$hash];$bytes=nce_seal($saved);$f=fopen($backup,'xb');if(!$f)throw new RuntimeException('backup_failed');try{chmod($backup,0600);if(fwrite($f,$bytes)!==strlen($bytes))throw new RuntimeException('backup_failed');}finally{fclose($f);}if(nce_open(file_get_contents($backup))!==$saved)throw new RuntimeException('backup_readback');}
   $dest=nce_root().'/symbols/'.$symbol.'.png';if(is_link($dest))throw new RuntimeException('symbol_symlink');
   if(!is_file($dest)){$f=fopen($dest,'xb');if(!$f)throw new RuntimeException('symbol_save_failed');try{chmod($dest,0600);if(fwrite($f,$png)!==strlen($png))throw new RuntimeException('symbol_save_failed');}finally{fclose($f);}}
   if(hash_file('sha256',$dest)!==hash('sha256',$png))throw new RuntimeException('symbol_readback');
   $doc=$row['document'];$doc['symbol']=$symbol;$doc['profileBackgroundOpacity']=0;
   $revision=nc_store($db,$key,'prefs',$doc,$row['revision'],$owner);
   $check=nc_row($db,$key);if($check['revision']!==$revision||$check['document']!==$doc)throw new RuntimeException('profile_readback');
   $result=['ok'=>true,'alreadyApplied'=>false,'revision'=>$revision,'databaseWrites'=>1,'originalImagePreserved'=>hash_file('sha256',$file['path'])===$hash,'privateEncryptedBackup'=>true,'transparentCorners'=>true];
  }
 }elseif($action==='rollback'){
  if(!$saved)throw new RuntimeException('backup_missing');
  if($row['revision']===$saved['row']['revision']&&$row['payload']===$saved['row']['payload'])$result=['ok'=>true,'databaseWrites'=>0];
  else{if(!$already||$row['revision']!==$saved['row']['revision']+1)throw new RuntimeException('rollback_conflict');nc_store($db,$key,'prefs',$saved['row']['document'],$row['revision'],$owner);$result=['ok'=>true,'databaseWrites'=>1,'restored'=>true];}
 }else throw new RuntimeException('invalid_action');
}catch(Throwable $e){http_response_code(409);$result=['ok'=>false,'error'=>$e instanceof RuntimeException?$e->getMessage():'profile_control_failed'];}
while(ob_get_level()>$level)ob_end_clean();header('Content-Type: application/json');echo json_encode($result,JSON_THROW_ON_ERROR);
