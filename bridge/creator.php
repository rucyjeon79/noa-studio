<?php
declare(strict_types=1);ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/creator-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/upload-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nc_reply(int $code,array $value):never{http_response_code($code);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_THROW_ON_ERROR);exit;}
$a=nam_access((array)($member??[]),(string)($is_admin??''));if(!$a['creator'])nc_reply(403,['error'=>'creator_required']);$actor=(string)$member['mb_id'];
try{
 $db=noa_bridge_pdo();$action=(string)($_GET['action']??'list');$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'&&$action==='list'){
  $channel=nc_row($db,nc_channel_key($actor));$songs=[];$records=nc_owned_records($db,$actor);$aliases=nc_record_aliases($db,$records);
  foreach($records as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!nam_owner($d,$member)||!empty($d['_noaTrash']))continue;
   $native=$r['kind']==='story'&&str_starts_with($r['doc_key'],'creator:');$state=!$native?['status'=>$r['kind']==='playlist'?'collection':'registered','error'=>'','ready'=>false,'audio'=>'','download'=>'']:nu_public($db,$r['doc_key']);
   $songs[]=['key'=>$r['doc_key'],'aliases'=>$aliases[$r['doc_key']]??[$r['doc_key']],'ep'=>(int)($d['ep']??0),'act'=>(int)($d['act']??0),'members'=>$d['body']['members']??[],'kind'=>$r['kind'],'managed'=>!$native,'editUrl'=>!$native&&$a['admin']?'/noa-editor.php?key='.rawurlencode($r['doc_key']):'','revision'=>(int)$r['revision'],'title'=>nup_fields($d)['title']?:($d['title']??'제목 없음'),'genre'=>$d['genreId']??'','visibility'=>$d['visibility']??'public','fields'=>nup_fields($d),'originalArtist'=>$d['body']['originalArtist']??'','state'=>['status'=>$state['status'],'error'=>$state['error'],'ready'=>$state['ready'],'audio'=>$state['audio'],'download'=>$a['ownDownload']?$state['download']:'']];}
  nc_reply(200,['channel'=>$channel?['fields'=>$channel['document'],'revision'=>$channel['revision'],'href'=>'/noa-channel.php?id='.hash('sha256',$actor)]:null,'songs'=>$songs,'downloadAllowed'=>$a['ownDownload']]);
 }
 if($method==='GET'&&$action==='status'){$r=nc_own($db,(string)($_GET['key']??''),$member);$state=nu_public($db,$r['doc_key']);if(!$a['ownDownload'])$state['download']='';nc_reply(200,$state);}
 if($method!=='POST')nc_reply(405,['error'=>'method_not_allowed']);
 $token=$_SERVER['HTTP_X_NOA_CSRF']??'';if(!is_string($token)||empty($_SESSION['noa_creator_csrf'])||!hash_equals($_SESSION['noa_creator_csrf'],$token)||($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr')nc_reply(403,['error'=>'csrf_required']);
 if($action==='chunk'){
  $u=nu_row($db,(string)($_GET['id']??''));nc_own($db,$u['song_key'],$member);if(!hash_equals($actor,$u['requested_by']))nc_reply(403,['error'=>'own_upload_required']);$index=filter_var($_GET['index']??'',FILTER_VALIDATE_INT);if($index===false)throw new InvalidArgumentException('invalid_chunk');session_write_close();nc_reply(200,nu_chunk($db,$u['id'],$index,file_get_contents('php://input',false,null,0,NU_CHUNK+1)));
 }
 if($action==='symbol'){
  $previous=nc_row($db,nc_channel_key($actor));if(!$previous||!nam_owner($previous['document'],$member))throw new DomainException('create_channel_first');
  $revision=filter_var($_POST['revision']??'',FILTER_VALIDATE_INT);if($revision===false||$revision!==$previous['revision'])throw new DomainException('revision_conflict');
  require_once __DIR__.'/creator-enrollment-core.php';$symbol=nce_symbol_upload($_FILES['symbol']??[]);if($symbol==='')throw new InvalidArgumentException('invalid_symbol');
  try{$d=$previous['document'];$d['symbol']=$symbol;$next=nc_store($db,nc_channel_key($actor),'prefs',$d,$revision,$actor);}catch(Throwable $e){unlink(nce_root().'/symbols/'.$symbol.'.jpg');throw $e;}nc_reply(200,['revision'=>$next]);
 }
 $raw=file_get_contents('php://input',false,null,0,262145);if(strlen($raw)>262144)nc_reply(413,['error'=>'request_too_large']);$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($b))throw new InvalidArgumentException('invalid_request');
 if($action==='channel'){$previous=nc_row($db,nc_channel_key($actor));$d=array_replace($previous['document']??[],nc_channel($b),['ownerId'=>$actor,'channelId'=>hash('sha256',$actor)]);$revision=$b['revision']??null;if(!is_int($revision)||$revision<0)throw new InvalidArgumentException('revision_required');$next=nc_store($db,nc_channel_key($actor),'prefs',$d,$revision,$actor);nc_reply(200,['revision'=>$next]);}
 if($action==='rules'){$previous=nc_row($db,nc_channel_key($actor));if(!$previous||!nam_owner($previous['document'],$member))throw new DomainException('create_channel_first');if(!is_int($b['revision']??null)||$b['revision']!==$previous['revision'])throw new DomainException('revision_conflict');$d=$previous['document'];$d['productionRules']=nc_rules($b);nc_reply(200,['revision'=>nc_store($db,nc_channel_key($actor),'prefs',$d,$b['revision'],$actor)]);}
 if($action==='save'){
  if(!nc_row($db,nc_channel_key($actor)))throw new DomainException('create_channel_first');$key=(string)($b['key']??'');$r=$key!==''?nc_own($db,$key,$member):null;
  if(!$r){$q=$db->prepare("SELECT COUNT(*) FROM noa_documents WHERE kind='story' AND doc_key LIKE ?");$q->execute(['creator:'.hash('sha256',$actor).':%']);if((int)$q->fetchColumn()>=100)throw new DomainException('channel_song_limit');$key='creator:'.hash('sha256',$actor).':'.bin2hex(random_bytes(16));}
  $d=$r['document']??['ownerId'=>$actor,'title'=>'','genreId'=>'your-story','ep'=>'','act'=>'','visibility'=>'private','body'=>[]];$d=nc_patch($d,$b);$expected=$b['revision']??null;if(!is_int($expected)||$expected!==($r['revision']??0))throw new DomainException('revision_conflict');
  if($d['visibility']==='public'){$asset=nj_find($db,$key);if(!nj_verified($asset,'audio'))throw new DomainException('verified_audio_required');if(($b['rightsConfirmed']??false)!==true)throw new DomainException('rights_confirmation_required');}
  $next=nc_store($db,$key,'story',$d,$expected,$actor);nc_reply(200,['key'=>$key,'revision'=>$next]);
 }
 if($action==='init'){
  $r=nc_own($db,(string)($b['key']??''),$member);$q=$db->prepare("SELECT COALESCE(SUM(a.audio_bytes),0) FROM noa_jukebox_assets a JOIN noa_documents d ON d.doc_key=a.song_key WHERE d.doc_key LIKE ?");$q->execute(['creator:'.hash('sha256',$actor).':%']);if((int)$q->fetchColumn()+(int)($b['bytes']??0)>1073741824)throw new DomainException('channel_storage_limit');session_write_close();nc_reply(200,nu_initialize($db,$b,$actor));
 }
 if(in_array($action,['finish','cancel','retry'],true)){
  $u=nu_row($db,(string)($b['id']??''));nc_own($db,$u['song_key'],$member);if(!hash_equals($actor,$u['requested_by']))nc_reply(403,['error'=>'own_upload_required']);session_write_close();
  if($action==='finish')$out=nu_finish($db,$u['id']);elseif($action==='cancel')$out=nu_cancel_pending($db,$u['id']);else{nq_retry($db,$u['id']);$out=nu_public($db,$u['song_key']);}if(!$a['ownDownload'])$out['download']='';nc_reply(200,$out);
 }
 throw new InvalidArgumentException('unknown_action');
}catch(DomainException $e){nc_reply(409,['error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nc_reply(400,['error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-creator] '.get_class($e));nc_reply(503,['error'=>'creator_service_unavailable']);}
