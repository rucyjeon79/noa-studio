<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Server-only wake credential; never supplied by an upload or returned to a client. */
function nw_dispatch(string $token):int{
 if(!function_exists('curl_init'))return 0;
 $ch=curl_init('https://api.github.com/repos/rucyjeon79/noa-studio/actions/workflows/noa-jukebox.yml/dispatches');
 curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>'{"ref":"main"}',CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token,'Accept: application/vnd.github+json','Content-Type: application/json','X-GitHub-Api-Version: 2022-11-28'],CURLOPT_USERAGENT=>'NOA-upload-wake',CURLOPT_CONNECTTIMEOUT_MS=>750,CURLOPT_TIMEOUT_MS=>2000,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_WRITEFUNCTION=>static fn($ch,$data)=>strlen($data)]);
 curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);return $status;
}
/** Failure never rolls back an accepted upload; the scheduled recovery remains enabled. */
function nw_request(string $directory,?callable $send=null,?int $now=null):string{
 $lock=null;
 try{
  $credential=$directory.'/upload-wake-token';
  if(is_link($directory)||!is_dir($directory)||is_link($credential)||!is_file($credential))return 'not_configured';
  if((fileperms($credential)&0077)!==0)return 'unsafe_permissions';
  $token=trim((string)file_get_contents($credential,false,null,0,1024));
  if(!preg_match('/^[A-Za-z0-9_]{20,255}$/D',$token))return 'invalid_configuration';
  $path=$directory.'/upload-wake-state';if(is_link($path))return 'unsafe_state';
  $lock=@fopen($path,'c+');if(!$lock)return 'unavailable';@chmod($path,0600);
  if(!flock($lock,LOCK_EX|LOCK_NB))return 'already_requested';
  $now=$now??time();$state=json_decode(stream_get_contents($lock)?:'{}',true)?:[];
  $last=(int)($state['at']??0);$delay=($state['accepted']??false)?60:10;
  if($last>0&&$now>=$last&&$now-$last<$delay)return 'already_requested';
  rewind($lock);ftruncate($lock,0);fwrite($lock,json_encode(['at'=>$now,'accepted'=>false]));fflush($lock);
  $accepted=(($send??'nw_dispatch')($token)===204);
  rewind($lock);ftruncate($lock,0);fwrite($lock,json_encode(['at'=>$now,'accepted'=>$accepted]));fflush($lock);
  return $accepted?'requested':'recovery_pending';
 }catch(Throwable $e){return 'recovery_pending';}
 finally{if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}}
}
function nw_after_enqueue():void{nw_request(nj_private());}
