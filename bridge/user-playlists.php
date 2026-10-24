<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/sound-core.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function noa_pl_reply(int $code,array $body):never{http_response_code($code);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
function noa_pl_known_tracks(PDO $db,array $tracks,bool $admin):bool{
 if(!$tracks)return true;
 $q=$db->prepare('SELECT doc_key,kind,payload FROM noa_documents WHERE doc_key IN ('.implode(',',array_fill(0,count($tracks),'?')).')');$q->execute($tracks);
 $known=[];$documents=[];
 foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){
  $documents[$row['doc_key']]=true;$document=json_decode($row['payload'],true);
  if(is_array($document)&&in_array($row['kind'],['single','playlist','story'],true)&&noa_sound_visible($document,$admin))$known[$row['doc_key']]=true;
 }
 $catalog=[];foreach($tracks as $key)if(!isset($documents[$key])&&preg_match('/^catalog:([a-f0-9]{64})$/D',$key,$match))$catalog[$match[1]]=true;
 if($catalog){
  $ids=array_keys($catalog);$q=$db->prepare("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE s.song_id IN (".implode(',',array_fill(0,count($ids),'?')).") AND v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)");$q->execute($ids);
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){$fields=json_decode($row['fields_json'],true);if(noa_sound_recovered($row,$admin)!==null&&is_array($fields)&&noa_sound_visible($fields,$admin))$known['catalog:'.$row['song_id']]=true;}
 }
 foreach($tracks as $key)if(!isset($known[$key]))return false;
 return true;
}
if(empty($is_member)||empty($member['mb_id']))noa_pl_reply(401,['error'=>'login_required']);
$owner=(string)$member['mb_id'];$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!in_array($method,['GET','POST','DELETE'],true))noa_pl_reply(405,['error'=>'method_not_allowed']);
if(empty($_SESSION['noa_playlist_token']))$_SESSION['noa_playlist_token']=bin2hex(random_bytes(32));
if($method!=='GET'){
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_playlist_token'],(string)($_SERVER['HTTP_X_NOA_CSRF']??'')))noa_pl_reply(403,['error'=>'request_verification_failed']);
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
 $data=json_decode($raw,true);if(!is_array($data))noa_pl_reply(400,['error'=>'invalid_playlist']);$id=$data['id']??'';$expected=$data['expectedRevision']??null;
 if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id)||!is_int($expected)||$expected<0)noa_pl_reply(400,['error'=>'invalid_playlist']);
 if($method==='DELETE'||($method==='POST'&&($data['action']??'')==='delete')){
  $db->beginTransaction();$q=$db->prepare('SELECT revision FROM noa_user_playlists WHERE owner_id=? AND playlist_id=? FOR UPDATE');$q->execute([$owner,$id]);$current=$q->fetch(PDO::FETCH_ASSOC);
  if(!$current){$db->rollBack();noa_pl_reply(404,['error'=>'not_found']);}
  if((int)$current['revision']!==$expected){$db->rollBack();noa_pl_reply(409,['error'=>'revision_conflict']);}
  $q=$db->prepare('DELETE FROM noa_user_playlists WHERE owner_id=? AND playlist_id=? AND revision=?');$q->execute([$owner,$id,$expected]);
  if($q->rowCount()!==1){$db->rollBack();noa_pl_reply(409,['error'=>'revision_conflict']);}
  $db->commit();noa_pl_reply(200,['deleted'=>true,'id'=>$id]);
 }
 $title=$data['title']??'';$tracks=$data['tracks']??null;
 if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id)||!is_string($title)||trim($title)===''||mb_strlen($title)>160||!is_array($tracks)||!array_is_list($tracks)||count($tracks)>500||!is_int($expected)||$expected<0)noa_pl_reply(400,['error'=>'invalid_playlist']);
 foreach($tracks as $key)if(!is_string($key)||!preg_match('/^(?:(?:single|playlist|story):[a-z0-9:_-]{1,180}|catalog:[a-f0-9]{64})$/D',$key))noa_pl_reply(400,['error'=>'invalid_track']);
 // Tracks are references to existing source documents, never copied song records.
 if(!noa_pl_known_tracks($db,$tracks,!empty($is_admin)&&$is_admin==='super'))noa_pl_reply(400,['error'=>'unknown_track']);
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
