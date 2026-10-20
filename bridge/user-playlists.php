<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function noa_pl_reply(int $code,array $body):never{http_response_code($code);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||empty($member['mb_id']))noa_pl_reply(401,['error'=>'login_required']);
$owner=(string)$member['mb_id'];$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!in_array($method,['GET','POST'],true))noa_pl_reply(405,['error'=>'method_not_allowed']);
if(empty($_SESSION['noa_playlist_token']))$_SESSION['noa_playlist_token']=bin2hex(random_bytes(32));
if($method==='POST'){
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||($_SERVER['HTTP_X_NOA_CSRF']??'')!==$_SESSION['noa_playlist_token'])noa_pl_reply(403,['error'=>'request_verification_failed']);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')noa_pl_reply(415,['error'=>'json_required']);
}
try{
 $db=noa_bridge_pdo();
 if($method==='GET'){
  $q=$db->prepare('SELECT playlist_id,title,tracks,revision FROM noa_user_playlists WHERE owner_id=? ORDER BY created_at,playlist_id');$q->execute([$owner]);$items=[];
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $r){$r['tracks']=json_decode($r['tracks'],true,512,JSON_THROW_ON_ERROR);$r['revision']=(int)$r['revision'];$items[]=$r;}
  noa_pl_reply(200,['items'=>$items,'csrf'=>$_SESSION['noa_playlist_token']]);
 }
 $raw=file_get_contents('php://input',false,null,0,65537);
 if($raw===false||strlen($raw)>65536)noa_pl_reply(413,['error'=>'too_large']);
 $data=json_decode($raw,true);$id=$data['id']??'';$title=$data['title']??'';$tracks=$data['tracks']??null;$expected=$data['expectedRevision']??null;
 if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id)||!is_string($title)||trim($title)===''||mb_strlen($title)>160||!is_array($tracks)||!array_is_list($tracks)||count($tracks)>500||!is_int($expected)||$expected<0)noa_pl_reply(400,['error'=>'invalid_playlist']);
 foreach($tracks as $key)if(!is_string($key)||!preg_match('/^(single|playlist|story):[a-z0-9:_-]{1,180}$/D',$key))noa_pl_reply(400,['error'=>'invalid_track']);
 // Tracks are references to existing source documents, never copied song records.
 if($tracks){$q=$db->prepare('SELECT doc_key FROM noa_documents WHERE doc_key IN ('.implode(',',array_fill(0,count($tracks),'?')).')');$q->execute($tracks);$known=array_fill_keys($q->fetchAll(PDO::FETCH_COLUMN),true);foreach($tracks as $key)if(!isset($known[$key]))noa_pl_reply(400,['error'=>'unknown_track']);}
 $encoded=json_encode($tracks,JSON_THROW_ON_ERROR);
 $db->beginTransaction();
 if($expected===0){$q=$db->prepare('SELECT COUNT(*) FROM noa_user_playlists WHERE owner_id=?');$q->execute([$owner]);if((int)$q->fetchColumn()>=50){$db->rollBack();noa_pl_reply(409,['error'=>'playlist_limit']);}
  $q=$db->prepare("INSERT IGNORE INTO noa_user_playlists(owner_id,playlist_id,title,tracks,revision) VALUES(?,?,'','[]',0)");$q->execute([$owner,$id]);
 }
 $q=$db->prepare('SELECT title,tracks,revision FROM noa_user_playlists WHERE owner_id=? AND playlist_id=? FOR UPDATE');$q->execute([$owner,$id]);$current=$q->fetch(PDO::FETCH_ASSOC);
 if(!$current){$db->rollBack();noa_pl_reply(404,['error'=>'not_found']);}
 if((int)$current['revision']===$expected+1&&$current['title']===$title&&$current['tracks']===$encoded){$db->commit();noa_pl_reply(200,['revision'=>(int)$current['revision'],'replayed'=>true]);}
 if((int)$current['revision']!==$expected){$db->rollBack();noa_pl_reply(409,['error'=>'revision_conflict']);}
 $q=$db->prepare('UPDATE noa_user_playlists SET title=?,tracks=?,revision=revision+1 WHERE owner_id=? AND playlist_id=?');$q->execute([$title,$encoded,$owner,$id]);$db->commit();
 noa_pl_reply(200,['revision'=>$expected+1,'replayed'=>false]);
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('[noa-user-playlists] '.get_class($e));noa_pl_reply(503,['error'=>'storage_unavailable']);}
