<?php
declare(strict_types=1);ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function ncd_reply(int $code,array $data):never{http_response_code($code);echo ncd_json($data);exit;}
$access=nam_access((array)($member??[]),(string)($is_admin??''));if(empty($access['creatorAI']))ncd_reply(403,['error'=>'creator_ai_required']);$owner=(string)$member['mb_id'];$method=$_SERVER['REQUEST_METHOD']??'GET';$action=(string)($_GET['action']??'list');
if($method==='POST'&&((!is_string($_SERVER['HTTP_X_NOA_CSRF']??null)||empty($_SESSION['n80_creative_csrf'])||!hash_equals($_SESSION['n80_creative_csrf'],$_SERVER['HTTP_X_NOA_CSRF']))||($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'))ncd_reply(403,['error'=>'csrf_required']);
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{$db=noa_bridge_pdo();
 if($method==='GET'){
  if($action==='list'){$offset=max(0,min(100000,(int)($_GET['offset']??0)));$search=ncd_text((string)($_GET['q']??''),200);$filter=(string)($_GET['filter']??'');if(!in_array($filter,['','story','questions','intent','writing','review','published','deleted'],true))throw new InvalidArgumentException('invalid_filter');$stage="JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.summary.stage'))";$title="JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.summary.title'))";$order=match($_GET['sort']??'updated'){'title'=>$title.' ASC','created'=>'c.created_at DESC',default=>'d.updated_at DESC'};$where=$filter!==''?$stage.'=?':$stage."<>'deleted'";$params=[$owner,NCD_KIND];if($filter!=='')$params[]=$filter;if($search!==''){$where.=" AND LOCATE(LOWER(?),LOWER(".$title."))>0";$params[]=$search;}$q=$db->prepare("SELECT JSON_EXTRACT(d.payload,'$._creative.summary') AS summary FROM noa_creative_drafts c JOIN noa_documents d ON d.doc_key=c.doc_key WHERE c.owner_id=? AND d.kind=? AND ".$where." ORDER BY ".$order.",c.draft_id LIMIT 51 OFFSET ".$offset);$q->execute($params);$items=[];foreach($q as $r)$items[]=json_decode($r['summary'],true);$more=count($items)>50;ncd_reply(200,['items'=>array_slice($items,0,50),'hasMore'=>$more]);}
  $r=ncd_row($db,(string)($_GET['id']??''),$owner);
  if($action==='get'){$job=!empty($r['document']['_creative']['jobId'])?ncd_job($db,$r['document']['_creative']['jobId']):null;if($job){ncd_expire($db,$job);$job=ncd_job($db,$job['document']['id']);if(in_array($job['document']['state'],['succeeded','review','failed','canceled'],true))$r=ncd_row($db,(string)$_GET['id'],$owner);}ncd_reply(200,['draft'=>ncd_view($r),'job'=>ncd_job_public($job)]);}
  if($action==='jobResult'){$job=ncd_job($db,(string)($_GET['job']??($r['document']['_creative']['jobId']??'')));if(!$job||$job['document']['owner']!==$owner||$job['document']['draftId']!==$r['document']['_creative']['id'])throw new DomainException('job_not_found');ncd_reply(200,['result'=>$job['document']['result']??$job['document']['rawResult']??[]]);}
  if($action==='jobs'){$q=$db->prepare("SELECT doc_key,payload,revision FROM noa_documents WHERE kind='n80_creative_job' AND updated_by=? AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.draftId'))=? ORDER BY updated_at DESC LIMIT 100");$q->execute([$owner,$r['document']['_creative']['id']]);$jobs=[];foreach($q as $j){$j['document']=json_decode($j['payload'],true);$jobs[]=ncd_job_public($j);}ncd_reply(200,['jobs'=>$jobs]);}
  if($action==='history')ncd_reply(200,['versions'=>ncd_history($db,$r,(string)($_GET['field']??''))]);
  if($action==='assets'){require_once __DIR__.'/creative-publication.php';ncd_reply(200,['assets'=>ncd_assets($db,$r)]);}
  if($action==='collections'){$lists=nup_collections($db);$out=[];foreach($lists as $list)if($list['available']&&($access['admin']||($list['payload']['ownerId']??'')===$owner))$out[]=array_intersect_key($list,array_flip(['key','title','genre']));ncd_reply(200,['collections'=>$out]);}
  throw new InvalidArgumentException('unknown_action');
 }
 if($method!=='POST')ncd_reply(405,['error'=>'method_not_allowed']);
 if(in_array($action,['chunk','cover'],true)){
  require_once __DIR__.'/creative-publication.php';$id=(string)($_GET['id']??'');$r=ncd_row($db,$id,$owner);ncd_editable($r,$action==='chunk'?$r['revision']:(int)($_GET['revision']??-1));
  if($action==='chunk'){$u=nu_row($db,(string)($_GET['upload']??''));if($u['song_key']!==$r['doc_key']||$u['requested_by']!==$owner)throw new DomainException('own_upload_required');$index=filter_var($_GET['index']??'',FILTER_VALIDATE_INT);if($index===false)throw new InvalidArgumentException('invalid_chunk');ncd_reply(200,nu_chunk($db,$u['id'],$index,file_get_contents('php://input',false,null,0,ND_CHUNK+1)));}
  $bytes=file_get_contents('php://input',false,null,0,6291457);if(strlen($bytes)>6291456)throw new InvalidArgumentException('image_too_large');ncd_reply(200,['draft'=>ncd_view(ncd_cover($db,$owner,['id'=>$id,'revision'=>$r['revision']],$bytes))]);
 }
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')ncd_reply(415,['error'=>'json_required']);$raw=file_get_contents('php://input',false,null,0,1048577);if(strlen($raw)>1048576)ncd_reply(413,['error'=>'request_too_large']);$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($b))throw new InvalidArgumentException('invalid_request');
 if($action==='create')ncd_reply(200,['draft'=>ncd_view(ncd_create($db,$owner,(string)($b['id']??''),(string)($b['story']??'')))]);
 if($action==='save')ncd_reply(200,['draft'=>ncd_view(ncd_save($db,$owner,$b))]);
 if(in_array($action,['answer','confirmIntent','proposal','review','restoreField','delete','restoreDeleted'],true))ncd_reply(200,['draft'=>ncd_view(ncd_action($db,$owner,$action,$b))]);
 if($action==='generate')ncd_reply(200,ncd_enqueue($db,$owner,$b));
 require_once __DIR__.'/creative-publication.php';
 if($action==='preview')ncd_reply(200,ncd_preview($db,$owner,$b,$access['admin']));
 if($action==='publish')ncd_reply(200,ncd_publish($db,$owner,$b,$access['admin']));
 $r=ncd_row($db,(string)($b['id']??''),$owner);ncd_editable($r,in_array($action,['finish','retry'],true)?$r['revision']:(int)($b['revision']??-1));
 if($action==='verifyUrl')ncd_reply(200,['draft'=>ncd_view(ncd_verify_video($db,$owner,$b))]);
 if($action==='sunoCover'){$source=noa_sound_suno($r['document']['body']);$prepared=nsc_prepare($db,$r['doc_key'],$source);if(!$prepared){if($source!==''&&nsc_preview(nj_find($db,$r['doc_key']),$r['doc_key'],$source)){$prepared=['source'=>$source,'bytes'=>file_get_contents(nj_file(nj_find($db,$r['doc_key'])['cover_path']))];}else throw new DomainException('suno_verification_failed');}ncd_reply(200,['draft'=>ncd_view(ncd_cover($db,$owner,$b,$prepared['bytes'],$prepared))]);}
 if($action==='init'){$b['key']=$r['doc_key'];ncd_reply(200,nu_initialize($db,$b,$owner));}
 if(in_array($action,['finish','retry'],true)){$u=nu_row($db,(string)($b['upload']??''));if($u['song_key']!==$r['doc_key']||$u['requested_by']!==$owner)throw new DomainException('own_upload_required');if($action==='finish')$result=nu_finish($db,$u['id']);else{nq_retry($db,$u['id']);$result=nu_public($db,$r['doc_key']);}ncd_reply(200,$result);}
 throw new InvalidArgumentException('unknown_action');
}catch(DomainException $e){ncd_reply($e->getMessage()==='draft_not_found'?404:409,['error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){ncd_reply(400,['error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[n80-creative] '.get_class($e));ncd_reply(503,['error'=>'creative_service_unavailable']);}
