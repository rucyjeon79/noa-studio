<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/sound-core.php';
require_once __DIR__.'/noa-app/jukebox/core.php';
require_once __DIR__.'/noa-bridge/music-readmodel.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function noa_detail_reply(int $status,array $value):never{http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')noa_detail_reply(405,['error'=>'method_not_allowed']);
$key=$_GET['key']??'';
if(!is_string($key)||!preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$key))noa_detail_reply(400,['error'=>'invalid_key']);
try{
 $admin=!empty($is_member)&&($is_admin??'')==='super';$d=nj_document(noa_bridge_pdo(),$key);
 if(!$d||!in_array($d['_kind']??'', ['single','story','playlist'],true)||!noa_sound_visible($d,$admin))noa_detail_reply(404,['error'=>'not_found']);
 $fields=noa_music_detail_fields($d);if(is_file(__DIR__.'/noa-bridge/inline-edit.php')){require_once __DIR__.'/noa-bridge/inline-edit.php';$db=noa_bridge_pdo();$edits=nie_overrides($db);$f=($d['_kind']??'')==='playlist'&&(int)($d['act']??0)>0?($edits[nie_meta_key('act',$d['genreId'].':'.(int)$d['act'])]['fields']??[]):nie_fields($edits,['key'=>$key,'orderKey'=>nie_identity($db,$key)]);if(array_key_exists('lyrics',$f))$fields['rawLyrics']=$f['lyrics'];if(array_key_exists('description',$f))$fields['description']=$f['description'];}
 noa_detail_reply(200,['key'=>$key]+$fields);
}catch(Throwable $e){error_log('[music-detail] '.get_class($e));noa_detail_reply(503,['error'=>'detail_unavailable']);}
