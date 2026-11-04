<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/member-access.php';
require_once __DIR__.'/listening-care-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
$method=$_SERVER['REQUEST_METHOD']??'';$worker=array_key_exists('HTTP_X_NOA_ACTION_KEY',$_SERVER);
$dir=dirname(__DIR__,2).'/noa-ai-lab/gpt-action';
try{
 if(!$worker){
  if(empty($is_member))nwc_reply(401,['error'=>'login_required']);
  if(!nam_access((array)$member,(string)($is_admin??''))['weatherVip'])nwc_reply(403,['error'=>'vip_required']);
  $owner=(string)$member['mb_id'];
  if($method==='POST'&&(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||empty($_SESSION['noa_listening_csrf'])||!hash_equals($_SESSION['noa_listening_csrf'],(string)($_SERVER['HTTP_X_NOA_CSRF']??''))))nwc_reply(403,['error'=>'verification']);
 }
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 if(!$worker&&$method==='GET'){
  $id=(string)($_GET['id']??'');$r=nwc_store($dir,static function(&$s)use($owner,$id){
   $j=$s['jobs'][$id]??null;return $j&&$j['owner']===$owner?nwc_public($j):null;
  });nwc_reply($r?200:404,$r??['error'=>'missing']);
 }
 if($method!=='POST')nwc_reply(405,['error'=>'method']);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nwc_reply(415,['error'=>'json_required']);
 $raw=file_get_contents('php://input',false,null,0,8193);if($raw===false||strlen($raw)>8192)nwc_reply(413,['error'=>'too_large']);
 $b=json_decode($raw,true);$id=$b['id']??'';$action=$b['action']??'';
 if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))nwc_reply(400,['error'=>'invalid']);
 $cfg=is_file($dir.'/state.json')?json_decode(file_get_contents($dir.'/state.json'),true,32,JSON_THROW_ON_ERROR):[];
 if(empty($cfg['workerHash'])||empty($cfg['owner'])||$cfg['owner']!==($config['cf_admin']??''))nwc_reply(503,['error'=>'worker_unavailable']);
 if($worker){
  $key=(string)$_SERVER['HTTP_X_NOA_ACTION_KEY'];
  if(!preg_match('/^[a-f0-9]{64}$/D',$key)||!hash_equals($cfg['workerHash'],hash('sha256',$key)))nwc_reply(403,['error'=>'worker_required']);
  if(!in_array($action,['claim','save','fail','check'],true))nwc_reply(400,['error'=>'invalid']);
  if($action==='check')nwc_reply(200,['ok'=>true,'version'=>1]);
  require_once __DIR__.'/subscription-access.php';
  $eligible=static function($owner){$m=get_member($owner);return !empty($m['mb_id'])&&nam_access(ns_apply_native_member($m,time()))['weatherVip'];};
  $r=nwc_store($dir,static function(&$s)use($id,$action,$b,$eligible){return nwc_worker($s,$id,$action,$b,$eligible);});nwc_reply(200,$r);
 }
 if($action!=='start'||($b['consent']??false)!==true)nwc_reply(400,['error'=>'invalid']);
 $dispatchToken=trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'))?:($cfg['dispatchToken']??'');
 if(!$dispatchToken)nwc_reply(503,['error'=>'worker_unavailable']);
 require_once __DIR__.'/listening-weather-editions.php';
 $editions=noa_weather_editions();$sky=$b['sky']??null;$intent=$b['intent']??null;$note=$b['note']??null;$keys=$b['keys']??null;
 if(!is_string($sky)||!is_int($intent)||!isset($editions[$sky][2][$intent])||!is_string($note)||mb_strlen($note)>180||!is_array($keys)||!array_is_list($keys)||!count($keys)||count($keys)>12)nwc_reply(400,['error'=>'invalid']);
 foreach($keys as $key)if(!is_string($key)||strlen($key)>512)nwc_reply(400,['error'=>'invalid']);
 require_once __DIR__.'/storage.php';require_once __DIR__.'/listening-video-catalog.php';
 require_once dirname(__DIR__).'/noa-app/engine/personal-song-index.php';
 $db=noa_bridge_pdo();$features=n80_song_features($db);$byKey=[];
 foreach(ny_listener_catalog($db,false,nie_overrides($db)) as $r)if($r['kind']!=='playlist')$byKey[$r['key']]=$r;
 $tracks=[];foreach(array_unique($keys) as $key){if(!isset($byKey[$key]))continue;$r=$byKey[$key];$tracks[]=['key'=>$key,'title'=>mb_substr($r['title'],0,100),'genre'=>$r['genre'],'moods'=>$features[$key]['moodScores']??[]];}
 if(!$tracks)nwc_reply(422,['error'=>'no_tracks']);
 $payload=['weather'=>$editions[$sky][1],'intent'=>$editions[$sky][2][$intent][0],'note'=>trim($note),'tracks'=>$tracks];
 [$new,$result]=nwc_store($dir,static function(&$s)use($id,$owner,$payload){return nwc_enqueue($s,$id,$owner,$payload);});
 if($new){
  require_once dirname(__DIR__).'/noa-app/engine/song-generation.php';$code=n80_song_dispatch($id,$dispatchToken,'noa-vip-weather.yml');
  if($code<200||$code>=300){if($code>=400&&$code<500)nwc_store($dir,static function(&$s)use($id){if(($s['jobs'][$id]['state']??null)==='queued')unset($s['jobs'][$id]);});nwc_reply(503,['error'=>'dispatch_unconfirmed','id'=>$id]);}
 }
 nwc_reply(202,$result);
}catch(DomainException $e){$reason=$e->getMessage();nwc_reply(match($reason){'slow_down','quota'=>429,'pending'=>409,'missing'=>404,default=>400},['error'=>$reason]);}
catch(Throwable $e){error_log('[noa-listening-care] '.get_class($e));nwc_reply(503,['error'=>'unavailable']);}
