<?php
declare(strict_types=1);
/** N80 owns requests and state. GitHub receives one fixed, bounded execution ID. */
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function n80_github_request(string $operation,string $id,string $token):int {
 $target=match($operation){
  'browser_connection'=>['noa-studio','n80-browser-connect.yml','connection_id'],
  'song_generation'=>['noa-private-worker','noa-worker.yml','task_id'],
  default=>null
 };
 if($target===null||!preg_match('/^[a-f0-9]{32}$/D',$id)||!preg_match('/^[A-Za-z0-9_]{20,255}$/D',$token)||!function_exists('curl_init'))return 0;
 $request=curl_init('https://api.github.com/repos/rucyjeon79/'.$target[0].'/actions/workflows/'.$target[1].'/dispatches');
 if($request===false)return 0;
 try{
  curl_setopt_array($request,[CURLOPT_POST=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>7,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
   CURLOPT_HTTPHEADER=>['User-Agent: NOA-STUDIO-N80','Accept: application/vnd.github+json','Content-Type: application/json','Authorization: Bearer '.$token],
   CURLOPT_POSTFIELDS=>json_encode(['ref'=>'main','inputs'=>[$target[2]=>$id]],JSON_THROW_ON_ERROR),
   CURLOPT_WRITEFUNCTION=>static fn($handle,string $data):int=>strlen($data)]);
  if(curl_exec($request)===false)return 0;
  return (int)curl_getinfo($request,CURLINFO_RESPONSE_CODE);
 }finally{curl_close($request);}
}
function n80_github_dispatch_token():string {
 // Reuse the private dispatch credential; never include it in a response.
 $directory=dirname(G5_PATH).'/noa-jukebox-private';$file=$directory.'/upload-wake-token';
 if(is_link($directory)||is_link($file))return '';
 if(is_file($file)){
  if((fileperms($file)&0077)!==0)return '';
  return trim((string)file_get_contents($file,false,null,0,1024));
 }
 $token=trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'));if($token!=='')return $token;
 $file=dirname(G5_PATH).'/noa-ai-lab/gpt-action/state.json';
 if(is_link($file)||!is_file($file)||(fileperms($file)&0077)!==0||filesize($file)>16777216)return '';
 $state=json_decode((string)file_get_contents($file),true);
 return is_array($state)&&is_string($state['dispatchToken']??null)?$state['dispatchToken']:'';
}
function n80_github_browser_wake(string $id):string {
 $code=n80_github_request('browser_connection',$id,n80_github_dispatch_token());
 return $code===204?'browser_dispatch_accepted':($code===401||$code===403?'browser_dispatch_auth_required':'browser_dispatch_unconfirmed');
}
