<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
function nie_reply(int $status,array $value):never{http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||($is_admin??'')!=='super')nie_reply(403,['ok'=>false,'error'=>'admin_required']);
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')nie_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/inline-edit.php';
try{nie_reply(200,nie_resolve(noa_bridge_pdo(),$_GET));}catch(InvalidArgumentException $e){nie_reply(400,['ok'=>false,'error'=>$e->getMessage()]);}catch(DomainException $e){nie_reply(404,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-inline-edit] '.get_class($e));nie_reply(503,['ok'=>false,'error'=>'details_unavailable']);}
