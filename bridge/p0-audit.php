<?php
declare(strict_types=1);
/** Fixed read-only inventory. Production text and credentials never leave this endpoint. */
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
 $raw=file_get_contents('php://input',false,null,0,4097);$ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($raw)||strlen($raw)>4096||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))throw new DomainException('authentication_required');
 $key=trim((string)@file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
 if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',"NOA-P0-AUDIT-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key),$sig))throw new DomainException('authentication_required');
 $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);if($input!==['action'=>'inventory'])throw new DomainException('invalid_action');
 require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 require_once __DIR__.'/storage.php';require_once __DIR__.'/package-record.php';require_once __DIR__.'/lab-core.php';require_once __DIR__.'/p0-inventory.php';
 $result=np0_inventory(noa_bridge_pdo());$state=lab_read();$secrets=lab_unseal($state['secrets']??null);
 $result['aiSettings']=['textEnabled'=>!empty($state['config']['textEnabled']),'keyConfigured'=>!empty($secrets['openaiKey']),'model'=>$state['config']['model']??null,'maxJobUsd'=>$state['config']['maxJobUsd']??0,'dailyBudgetUsd'=>$state['config']['dailyBudgetUsd']??0,'chatEnabled'=>!empty($state['config']['chatEnabled']),'chatPoints'=>$state['config']['chatPoints']??null,'videoEnabled'=>!empty($state['config']['generationEnabled']),'videoKeyConfigured'=>!empty($secrets['falKey'])];
 $response=json_encode(['ok'=>true,'nonce'=>$nonce,'databaseWrites'=>0,'result'=>$result],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 header('X-N80-Signature: '.hash_hmac('sha256',"NOA-P0-AUDIT-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));echo $response;
}catch(DomainException $e){http_response_code($e->getMessage()==='authentication_required'?401:400);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('[noa-p0-audit] '.get_class($e));http_response_code(503);echo '{"ok":false,"error":"inventory_unavailable"}';}
