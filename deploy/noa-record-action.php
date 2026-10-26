<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nra_reply(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||($is_admin??'')!=='super')nra_reply(403,['ok'=>false,'error'=>'admin_required']);
if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')nra_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||($_SERVER['HTTP_SEC_FETCH_SITE']??'same-origin')!=='same-origin'||!is_string($_SESSION['noa_catalog_csrf']??null)||!hash_equals($_SESSION['noa_catalog_csrf'],$_SERVER['HTTP_X_NOA_CSRF']??''))nra_reply(403,['ok'=>false,'error'=>'csrf_required']);
if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nra_reply(415,['ok'=>false,'error'=>'json_required']);
require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/record-trash.php';
try{$raw=file_get_contents('php://input',false,null,0,16385);if($raw===false||strlen($raw)>16384)throw new InvalidArgumentException('too_large');$request=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($request))throw new InvalidArgumentException('invalid_request');nra_reply(200,nrt_change(noa_bridge_pdo(),$request,(string)$member['mb_id']));}
catch(InvalidArgumentException|JsonException $e){nra_reply(400,['ok'=>false,'error'=>'invalid_request']);}
catch(DomainException $e){nra_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('[noa-record-action] '.get_class($e));nra_reply(503,['ok'=>false,'error'=>'storage_unavailable']);}
