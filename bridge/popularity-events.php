<?php
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/popularity-plays.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function npe_reply(int $status,array $data):never{http_response_code($status);echo np_json($data);exit;}
try{
 if(empty($_SESSION['noa_play_csrf']))$_SESSION['noa_play_csrf']=bin2hex(random_bytes(32));
 if(($_SERVER['REQUEST_METHOD']??'')==='GET')npe_reply(200,['ok'=>true,'csrf'=>$_SESSION['noa_play_csrf'],'contractVersion'=>1]);
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')npe_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_play_csrf'],$_SERVER['HTTP_X_NOA_PLAY_CSRF']??''))npe_reply(403,['ok'=>false,'error'=>'csrf_denied']);
 if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)npe_reply(413,['ok'=>false,'error'=>'body_too_large']);$b=json_decode(file_get_contents('php://input',false,null,0,4097),true,32,JSON_THROW_ON_ERROR);
 $db=noa_bridge_pdo();if(!np_ready($db))throw new DomainException('ranking_not_installed');$key=trim((string)file_get_contents(dirname(G5_PATH).'/noa-ai-lab/worker.key'));if(strlen($key)!==64)throw new RuntimeException('key_unavailable');$identity=(!empty($member['mb_id'])?'member:'.$member['mb_id']:'anonymous:'.($_SERVER['REMOTE_ADDR']??'').':'.substr($_SERVER['HTTP_USER_AGENT']??'',0,256));$actor=hash_hmac('sha256','NOA-PLAY-ACTOR-1:'.$identity,$key);$admin=($is_admin??'')!=='';
 if(($b['action']??'')==='start'){
  require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';$songKey=$b['songKey']??'';if(!is_string($songKey)||strlen($songKey)>191)throw new DomainException('invalid_song_key');$doc=nj_document($db,$songKey);if(!$doc||!noa_sound_visible($doc,false))throw new DomainException('public_song_required');$asset=nj_find($db,$songKey);if(!$asset||$asset['status']!=='ready'||empty($asset['audio_sha256']))throw new DomainException('ready_audio_required');$rows=nt_annotate_records($db,[['key'=>$songKey,'kind'=>$doc['_kind'],'catalogId'=>$doc['_catalog_id']??null]]);$sid=$rows[0]['catalogSongId']??null;if(!$sid)throw new DomainException('confirmed_song_mapping_required');$result=np_start_play($db,$actor,$sid,$songKey,$admin);
 }elseif(($b['action']??'')==='progress'){$pos=$b['position']??null;if(!is_int($pos)&&!is_float($pos))throw new DomainException('invalid_position');$result=np_progress_play($db,(string)($b['token']??''),$actor,(float)$pos,(string)($b['event']??''),$admin);}
 else throw new DomainException('unknown_action');npe_reply(200,['ok'=>true]+$result);
}catch(DomainException $e){npe_reply(422,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-play-event] '.get_class($e));npe_reply(503,['ok'=>false,'error'=>'play_event_unavailable']);}
