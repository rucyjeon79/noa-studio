<?php
/** HMAC authenticated parent-work journal; never a dispatcher or completion API. */
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function n80_work_error(int $status,string $code):never{http_response_code($status);echo json_encode(['ok'=>false,'error'=>$code]);exit;}
try{
 $raw=file_get_contents('php://input',false,null,0,32769);$ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';
 $nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
 if($raw===false||($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>32768||!ctype_digit($ts)||abs(time()-(int)$ts)>180
   ||!preg_match('/^[a-f0-9]{32}$/D',$nonce)||!preg_match('/^[a-f0-9]{64}$/D',$sig))n80_work_error(401,'authentication_required');
 $key=trim((string)@file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
 $message="N80-WORKSTATE-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;
 if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$message,$key),$sig))n80_work_error(401,'authentication_required');
 if(getenv('N80_WORKSTATE_DISABLED')==='1')n80_work_error(503,'workstate_disabled');
 require_once __DIR__.'/work-state.php';$input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 $directory='/hosting/noastudio/noa-ai-lab/n80-workstate';$completion='/hosting/noastudio/noa-ai-lab/n80-completion';
 if(is_array($input)&&n80_completion_keys($input,['action'])&&$input['action']==='read'){
  $result=n80_work_read($directory);$result['summary']=n80_work_summary($directory,$completion,$result);
 }elseif(is_array($input)&&n80_completion_keys($input,['action','request'])&&$input['action']==='revise'&&is_array($input['request'])){
  $result=n80_work_revise($directory,$completion,$input['request'],time());
 }else n80_work_error(400,'invalid_request');
 if(!$result['ok'])n80_work_error(in_array($result['error'],['revision_conflict','request_identity_conflict','instruction_identity_conflict'],true)?409:422,$result['error']);
 $response=n80_work_json(['ok'=>true,'nonce'=>$nonce,'principal'=>'n80_work_controller','result'=>$result,
  'automaticDispatch'=>false,'databaseWrites'=>0,'workCompletedEventEmitted'=>false]);
 header('X-N80-Signature: '.hash_hmac('sha256',"N80-WORKSTATE-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));echo $response;
}catch(Throwable $e){n80_work_error(503,'workstate_unavailable');}
