<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/engine/personal-listening.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nlp_reply(int $code,array $data):never{http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
$method=$_SERVER['REQUEST_METHOD']??'GET';if(!in_array($method,['GET','POST','DELETE'],true))nlp_reply(405,['error'=>'method_not_allowed']);
$logged=!empty($is_member)&&!empty($member['mb_id']);$access=nam_access((array)($member??[]),(string)($is_admin??''));
if(!$logged){if($method!=='GET')nlp_reply(401,['error'=>'login_required']);nlp_reply(200,['member'=>false,'canPlay'=>false,'genres'=>n80_listening_genres(),'profile'=>null,'theme'=>n80_listening_theme([])]);}
$_SESSION['noa_listening_csrf']??=bin2hex(random_bytes(32));
if($method!=='GET'&&((string)($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_listening_csrf'],(string)($_SERVER['HTTP_X_NOA_CSRF']??''))))nlp_reply(403,['error'=>'request_verification_failed']);
try{
 $db=noa_bridge_pdo();$owner=(string)$member['mb_id'];$key='listening:user:'.hash('sha256',$owner);$q=$db->prepare("SELECT payload,revision FROM noa_documents WHERE doc_key=? AND kind='prefs'");$q->execute([$key]);$row=$q->fetch(PDO::FETCH_ASSOC);$profile=$row?json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR):null;$revision=(int)($row['revision']??0);
 if($method!=='GET'){
  if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nlp_reply(415,['error'=>'json_required']);
  $raw=file_get_contents('php://input',false,null,0,4097);if($raw===false||strlen($raw)>4096)nlp_reply(413,['error'=>'too_large']);$data=json_decode($raw,true);
  if(!is_array($data)||!is_int($data['revision']??null)||$data['revision']<0)nlp_reply(400,['error'=>'invalid_revision']);
  if($method==='POST'&&!is_array($data['profile']??null))nlp_reply(400,['error'=>'invalid_preference']);
  $next=$method==='DELETE'?null:n80_listening_profile(is_array($data['profile']??null)?$data['profile']:[]);
  if(!empty($next['fortuneAlerts']))$next['fortuneAlertsSince']=!empty($profile['fortuneAlerts'])?(int)($profile['fortuneAlertsSince']??time()):time();
  $encoded=json_encode($next,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
  $db->beginTransaction();$q=$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'prefs','null',0,?)");$q->execute([$key,$owner]);
  $q=$db->prepare('SELECT kind,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$current=$q->fetch(PDO::FETCH_ASSOC);
  if(!$current||$current['kind']!=='prefs'||(int)$current['revision']!==$data['revision']){$db->rollBack();nlp_reply(409,['error'=>'revision_conflict']);}
  $revision=$data['revision']+1;$q=$db->prepare('UPDATE noa_documents SET payload=?,revision=?,updated_by=? WHERE doc_key=?');$q->execute([$encoded,$revision,$owner,$key]);$db->commit();$profile=$next;
  // Deliberately no document-history entry: removing consent erases the stored birth fields.
 }
 $library=[];if($access['music']){try{$q=$db->prepare('SELECT playlist_id,title,tracks FROM noa_user_playlists WHERE owner_id=? ORDER BY created_at DESC LIMIT 50');$q->execute([$owner]);foreach($q as $r){$r['tracks']=json_decode($r['tracks'],true,512,JSON_THROW_ON_ERROR);$library[]=$r;}}catch(PDOException $e){error_log('[listening-library] unavailable');}}
 $popular=[];try{foreach($db->query('SELECT s.song_key,COUNT(*) AS plays FROM noa_valid_plays v JOIN noa_play_sessions s ON s.token=v.token GROUP BY s.song_key') as $r)$popular[$r['song_key']]=(int)$r['plays'];}catch(PDOException $e){error_log('[listening-popularity] unavailable');}
 $now=new DateTimeImmutable('now');$theme=n80_listening_theme($profile??[],$now);
 nlp_reply(200,['member'=>true,'canPlay'=>$access['music'],'profile'=>$profile,'revision'=>$revision,'csrf'=>$_SESSION['noa_listening_csrf'],'genres'=>n80_listening_genres(),'theme'=>$theme,'fortune'=>n80_daily_fortune($theme['pillars'],$now),'library'=>$library,'popular'=>$popular]);
}catch(DomainException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();nlp_reply(400,['error'=>$e->getMessage()]);}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('[listening] '.get_class($e));nlp_reply(503,['error'=>'listening_unavailable']);}
