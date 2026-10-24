<?php
/** Service-authenticated current-task evidence recorder; never an execution API. */
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function n80_completion_error(int $status,string $code): never {
    http_response_code($status);echo json_encode(['ok'=>false,'error'=>$code]);exit;
}
try{
    $raw=file_get_contents('php://input',false,null,0,65537);
    $ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
    if($raw===false||($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>65536||!ctype_digit($ts)
       ||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))n80_completion_error(401,'authentication_required');
    require_once __DIR__.'/completion-receipt.php';
    $key=trim((string)@file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
    if(!n80_completion_authenticate('POST',$raw,$ts,$nonce,$sig,$key,time()))n80_completion_error(401,'authentication_required');
    if(getenv('N80_COMPLETION_REPORT_DISABLED')==='1')n80_completion_error(503,'completion_recording_disabled');
    $input=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if(!is_array($input)||!n80_completion_keys($input,['action','event'])||$input['action']!=='record'||!is_array($input['event']))n80_completion_error(400,'invalid_request');
    $result=n80_completion_record('/hosting/noastudio/noa-ai-lab/n80-completion',dirname(__DIR__,2),$input['event'],time());
    if(!$result['ok'])n80_completion_error(in_array($result['error'],['id_conflict','concurrent_target_creation'],true)?409:422,$result['error']);
    $response=json_encode(['ok'=>true,'nonce'=>$nonce,'principal'=>'n80_reporter','result'=>$result],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    header('X-N80-Signature: '.hash_hmac('sha256',"N80-COMPLETION-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));echo $response;
}catch(Throwable $e){n80_completion_error(503,'completion_report_unavailable');}
