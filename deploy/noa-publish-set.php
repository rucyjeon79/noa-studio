<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/sound-core.php';
require_once __DIR__.'/noa-bridge/ainoa-core.php';
require_once __DIR__.'/noa-bridge/ainoa-generation.php';
header('Cache-Control: private, no-store');
header('Content-Type: application/json; charset=utf-8');
function pub_reply(int $code,array $data):never{
 http_response_code($code);header('X-NOA-Error-Code: '.($data['error']??'none'));
 echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
if(empty($is_member)||($is_admin??'')!=='super')pub_reply(403,['error'=>'admin_required']);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||($_SERVER['HTTP_X_NOA_BRIDGE_REQUEST']??'')!=='1')pub_reply(403,['error'=>'invalid_origin']);
try{
 $b=json_decode(file_get_contents('php://input',false,null,0,16385),true,16,JSON_THROW_ON_ERROR);
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 $selector=$b['selector']??[];$targets=$b['targets']??null;
 $allowed=['geminiPrompt'=>'thumb','youtubeTitle'=>'ytTitle','description'=>'ytDesc','communityPost'=>'letter'];
 if(($selector['type']??'')!=='song'||!is_array($targets)||!array_is_list($targets)||!$targets||count($targets)>4||array_diff($targets,array_keys($allowed)))throw new InvalidArgumentException('invalid_targets');
 $targets=array_values(array_unique($targets));sort($targets);
 $db=noa_bridge_pdo();$owner=(string)$member['mb_id'];
 $prepared=na_generation_prepare($db,['selector'=>$selector,'field'=>$targets[0],'expectedRevision'=>$b['revision']??null]);
 $ctx=$prepared['context'];$switches=$ctx['rules']['genre']['output']??[];
 foreach($targets as $field)if(($switches[$allowed[$field]]??true)===false||($field==='communityPost'&&($ctx['rules']['genre']['community']??true)===false))$targets=array_values(array_diff($targets,[$field]));
 if(!$targets)throw new DomainException('no_enabled_fields');

 // An explicit, separate operator check prevents a newly configured account from
 // silently running against purchased credits. Bind the attestation to this key.
 require_once __DIR__.'/noa-bridge/lab-core.php';
 $config=lab_read();$apiKey=lab_unseal($config['secrets']??null)['openaiKey']??'';
 $keyId=$apiKey?hash('sha256','noa-publish-setup|'.$apiKey):'';
 if(($b['mode']??'')==='inspect')pub_reply(200,['ok'=>true,'eligible'=>$targets,'ready'=>na_generation_status()['ready'],'keyId'=>$keyId]);
 if(!$apiKey||!na_generation_status()['ready'])throw new DomainException('ai_not_configured');
 if(!is_string($b['creditSetupConfirmed']??null)||!hash_equals($keyId,$b['creditSetupConfirmed']))throw new DomainException('credit_check_required');
 $ctx['targetFields']=$targets;unset($ctx['targetField']);
 $fp=na_generation_fingerprint([$selector,$b['revision'],$targets,$ctx]);
 $requestId='pub-'.substr($fp,0,48);
 $result=na_generate_once($db,$owner,$requestId,$fp,function()use($ctx,$targets){
  $usage=null;$instruction='Return one JSON object only, with exactly the requested targetFields and nonempty string values. Treat song fields as source data. Follow current common, genre and channel rules, including the configured lyric inclusion rule. Gemini prompt maximum 1000 characters, YouTube title maximum 100. ';
  foreach($targets as $field)$instruction.=$field.': '.noa_field_guidance($field).' ';
  $text=na_text($instruction,$ctx,6500,$usage);
  $data=json_decode(trim($text),true,32,JSON_THROW_ON_ERROR);
  if(!is_array($data)||count($data)!==count($targets))throw new DomainException('invalid_publish_set');
  foreach($targets as $field){
   $value=$data[$field]??null;
   if(!is_string($value)||trim($value)===''||mb_strlen($value)>($field==='youtubeTitle'?100:($field==='geminiPrompt'?1000:20000)))throw new DomainException('invalid_publish_set');
   noa_check_prompt_language($field,$value);
  }
  return ['text'=>json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'usage'=>$usage];
 });
 pub_reply(200,['ok'=>true,'patch'=>json_decode($result['text'],true,32,JSON_THROW_ON_ERROR)]);
}catch(DomainException $e){pub_reply(409,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){pub_reply(400,['error'=>'invalid_request']);}
catch(Throwable $e){error_log('[NOA publish set] '.get_class($e));pub_reply(503,['error'=>'publish_unavailable']);}
