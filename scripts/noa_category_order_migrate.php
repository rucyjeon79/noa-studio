<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
 $raw=file_get_contents('php://input',false,null,0,4097);$ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
 if(time()>__EXPIRY__||($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($raw)||strlen($raw)>4096||!ctype_digit($ts)||abs(time()-(int)$ts)>120||!preg_match('/^[a-f0-9]{32}$/D',$nonce))throw new DomainException('authentication_required');
 $key=trim((string)file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
 if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',"NOA-ORDER-MIGRATE-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key),$sig))throw new DomainException('authentication_required');
 $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);if(array_keys($input)!==['action','legacySha256']||$input['action']!=='migrate'||!preg_match('/^[a-f0-9]{64}$/D',$input['legacySha256']))throw new DomainException('invalid_action');
 require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();require_once __DIR__.'/storage.php';require_once __DIR__.'/package-record.php';require_once __DIR__.'/category-order-store.php';
 $path='/hosting/noastudio/noa-ai-lab/category-order.json';$lock=fopen(dirname($path).'/.category-order.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('lock_failed');
 try{
  $legacy=is_file($path)?hash_file('sha256',$path):hash('sha256','{}');if(!hash_equals($legacy,$input['legacySha256']))throw new DomainException('legacy_changed');$db=noa_bridge_pdo();
  $fingerprint=static function()use($db):string{$hash=hash_init('sha256');$q=$db->prepare('SELECT doc_key,kind,payload,revision FROM noa_documents WHERE doc_key<>? ORDER BY doc_key');$q->execute([NCO_KEY]);foreach($q as $row)hash_update($hash,json_encode($row,JSON_THROW_ON_ERROR));return hash_final($hash);};
  $beforeHash=$fingerprint();$before=nco_read($db,$path);$after=nco_migrate($db,$path);$again=nco_migrate($db,$path);
  foreach(['story','cover','playlists']as $group)if(($before['data'][$group]??[])!==($after['data'][$group]??[]))throw new RuntimeException('order_changed');
  if($again!==$after||$beforeHash!==$fingerprint()||$legacy!==(is_file($path)?hash_file('sha256',$path):hash('sha256','{}')))throw new RuntimeException('preservation_failed');
  $result=['source'=>$after['source'],'revision'=>$after['revision'],'created'=>$before['source']==='legacy','storyCount'=>count($after['data']['story']),'coverCount'=>count($after['data']['cover']),'legacyPlaylists'=>count($after['data']['playlists']??[]),'legacySha256'=>$legacy,'legacyUnchanged'=>true,'unrelatedDocumentsSha256'=>$beforeHash,'unrelatedDocumentsUnchanged'=>true,'replayUnchanged'=>true,'songWrites'=>0,'memberWrites'=>0,'audioWrites'=>0];
 }finally{flock($lock,LOCK_UN);fclose($lock);}
 $response=json_encode(['ok'=>true,'nonce'=>$nonce,'result'=>$result],JSON_THROW_ON_ERROR);header('X-N80-Signature: '.hash_hmac('sha256',"NOA-ORDER-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));echo $response;
}catch(DomainException $e){http_response_code(409);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-order-migrate] '.get_class($e));http_response_code(503);echo '{"ok":false,"error":"migration_unverified"}';}
