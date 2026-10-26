<?php
declare(strict_types=1);
/** Private SQL receipts are not song records. A lost response must never start a second paid call. */
function na_generation_fingerprint(array $value):string{
 $sort=function(&$v)use(&$sort){if(!is_array($v))return;if(!array_is_list($v))ksort($v);foreach($v as &$item)$sort($item);};$sort($value);
 return hash('sha256',json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
}
function na_generation_reply(array $receipt,bool $replayed):array{
 if(($receipt['status']??'')==='succeeded')return ['text'=>$receipt['text'],'saved'=>false,'requestId'=>$receipt['requestId'],'usage'=>$receipt['usage']??null,'replayed'=>$replayed];
 if(($receipt['status']??'')==='failed')throw new DomainException($receipt['error']??'ai_result_unconfirmed');
 throw new DomainException(time()-(int)($receipt['startedAt']??0)>90?'ai_result_unconfirmed':'ai_request_pending');
}
function na_generate_once(PDO $db,string $owner,string $requestId,string $fingerprint,callable $generate):array{
 if($owner===''||!preg_match('/^[a-zA-Z0-9_-]{16,128}$/D',$requestId)||!preg_match('/^[a-f0-9]{64}$/D',$fingerprint))throw new InvalidArgumentException('invalid_generation_request');
 $key='ainoa:generation:'.hash('sha256',$owner.'|'.$requestId);
 $q=$db->prepare("SELECT payload FROM noa_documents WHERE doc_key=? AND kind='ainoa_generation'");$q->execute([$key]);$old=$q->fetchColumn();
 if($old!==false){$receipt=json_decode($old,true,512,JSON_THROW_ON_ERROR);if(!hash_equals($receipt['fingerprint']??'',$fingerprint))throw new DomainException('ai_request_conflict');return na_generation_reply($receipt,true);}
 $receipt=['requestId'=>$requestId,'ownerId'=>$owner,'fingerprint'=>$fingerprint,'status'=>'pending','startedAt'=>time()];$raw=json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 try{$q=$db->prepare("INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'ainoa_generation',?,1,?)");$q->execute([$key,$raw,$owner]);}
 catch(PDOException $e){if($e->getCode()!=='23000')throw $e;$q=$db->prepare("SELECT payload FROM noa_documents WHERE doc_key=? AND kind='ainoa_generation'");$q->execute([$key]);$stored=$q->fetchColumn();if($stored===false)throw new DomainException('ai_request_conflict');$receipt=json_decode($stored,true,512,JSON_THROW_ON_ERROR);if(!hash_equals($receipt['fingerprint']??'',$fingerprint))throw new DomainException('ai_request_conflict');return na_generation_reply($receipt,true);}
 // The pending receipt is durable before contacting the provider; no long SQL or PHP-session lock.
 try{
  $generated=$generate();if(!is_string($generated['text']??null)||trim($generated['text'])==='')throw new RuntimeException('empty_ai_result');
  $receipt+=['text'=>$generated['text'],'usage'=>$generated['usage']??null];$receipt['status']='succeeded';$receipt['finishedAt']=time();
 }catch(Throwable $e){
  $allowed=['ai_not_configured','ai_budget_exceeded','ai_model_not_supported','ai_provider_auth','ai_provider_rate_limit','ai_provider_unavailable','ai_result_unconfirmed','ai_revision_changed'];
  $receipt['status']='failed';$receipt['error']=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'ai_result_unconfirmed';$receipt['finishedAt']=time();
 }
 $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=2 WHERE doc_key=? AND revision=1 AND payload=?');$q->execute([json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$key,$raw]);if($q->rowCount()!==1)throw new DomainException('ai_result_unconfirmed');
 return na_generation_reply($receipt,false);
}
function na_generation_status():array{
 try{
  require_once __DIR__.'/lab-core.php';$s=lab_read();$c=$s['config'];$key=lab_unseal($s['secrets']??null);$missing=[];
  if(empty($key['openaiKey']))$missing[]='api_key';if(empty($c['textEnabled']))$missing[]='text_enabled';
  if(($c['maxJobUsd']??0)<.1)$missing[]='per_request_budget';if(($c['dailyBudgetUsd']??0)<.1)$missing[]='daily_budget';
  if(!in_array($c['model']??'',['gpt-5-mini','gpt-4.1-mini'],true))$missing[]='model';
  $today=gmdate('Y-m-d');$used=(float)($s['ainoaUsage'][$today]??0);foreach($s['jobs']??[]as $job)if(substr($job['costReservedAt']??'',0,10)===$today)$used+=(float)($job['costReservedUsd']??0);
  if(!$missing&&$used+.1>(float)$c['dailyBudgetUsd'])$missing[]='daily_budget_exhausted';
  return ['ready'=>!$missing,'missing'=>$missing,'model'=>$c['model']??null,'reservedTodayUsd'=>$used,'dailyBudgetUsd'=>$c['dailyBudgetUsd']??0,'settingsUrl'=>'/noa-ai-lab.php','lastConnectionCheck'=>$s['ainoaConnection']??null];
 }catch(Throwable $e){return ['ready'=>false,'missing'=>['settings_unavailable'],'settingsUrl'=>'/noa-ai-lab.php'];}
}
/** Explicit administrator connection check: model access only, no generation and no points. */
function na_generation_check():array{
 require_once __DIR__.'/lab-core.php';$s=lab_read();$key=lab_unseal($s['secrets']??null)['openaiKey']??'';$model=$s['config']['model']??'';
 if($key==='')throw new DomainException('ai_not_configured');if(!in_array($model,['gpt-5-mini','gpt-4.1-mini'],true))throw new DomainException('ai_model_not_supported');
 $r=na_provider_request('/models/'.rawurlencode($model),$key);if(($r['data']['id']??'')!==$model)throw new DomainException('ai_model_not_supported');
 $proof=['ok'=>true,'model'=>$model,'checkedAt'=>gmdate('c'),'generationRequests'=>0,'chargedPoints'=>0];lab_lock(function(&$s)use($proof){$s['ainoaConnection']=$proof;});return $proof;
}
