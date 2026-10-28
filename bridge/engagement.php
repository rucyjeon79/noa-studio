<?php
declare(strict_types=1);
ini_set('display_errors','0');$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$level)ob_end_clean();
require_once __DIR__.'/storage.php';require_once __DIR__.'/engagement-targets.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('Vary: Cookie');header('X-Content-Type-Options: nosniff');
function ne_reply(array $data,int $code=200): never {http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
try{
 $access=nam_access((array)$member,(string)$is_admin);if(!$access['member'])ne_reply(['ok'=>false,'error'=>'login_required'],401);
 $_SESSION['noa_engagement_csrf']??=bin2hex(random_bytes(32));$csrf=$_SESSION['noa_engagement_csrf'];$db=noa_bridge_pdo();if(!ne_ready($db))throw new DomainException('not_ready');
 $method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'){
  // Native bootstrap SQL-escapes $_GET. Decode the original query for JSON,
  // then apply the same bounded type checks and authorization below.
  parse_str((string)($_SERVER['QUERY_STRING']??''),$ne_query);
  if(isset($ne_query['targets'])){
   if(!is_string($ne_query['targets'])||strlen($ne_query['targets'])>16000)throw new DomainException('invalid_input');
   $targets=json_decode($ne_query['targets'],true,8,JSON_THROW_ON_ERROR);if(!is_array($targets)||count($targets)>30)throw new DomainException('invalid_input');$items=[];
   foreach($targets as $t){if(!is_array($t)||!is_string($t['type']??null)||!is_string($t['key']??null))throw new DomainException('invalid_input');try{$items[]=['type'=>$t['type'],'key'=>$t['key']]+ne_stats($db,ne_target($db,$t['type'],$t['key']));}catch(DomainException $e){$items[]=['type'=>$t['type'],'key'=>$t['key'],'unavailable'=>true];}}
   ne_reply(['ok'=>true,'csrf'=>$csrf,'items'=>$items]);
  }
  $target=ne_target($db,(string)($ne_query['type']??''),(string)($ne_query['key']??''));ne_reply(['ok'=>true,'csrf'=>$csrf,'stats'=>ne_stats($db,$target),'comments'=>ne_comments($db,$target,max(0,(int)($ne_query['page']??0)))]);
 }
 if($method!=='POST'){header('Allow: GET, POST');ne_reply(['ok'=>false,'error'=>'method_not_allowed'],405);}
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($csrf,(string)($_SERVER['HTTP_X_NOA_CSRF']??'')))ne_reply(['ok'=>false,'error'=>'csrf_required'],403);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')ne_reply(['ok'=>false,'error'=>'invalid_input'],415);
 $raw=file_get_contents('php://input',false,null,0,12001);if(strlen($raw)>12000)throw new DomainException('invalid_input');$b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);if(!is_array($b))throw new DomainException('invalid_input');$owner=(string)$member['mb_id'];
 if(($b['action']??'')==='delete'){
  $old=ne_delete($db,(int)($b['id']??0),$owner,$access['admin']);
  if(function_exists('delete_point')){try{delete_point($old['owner'],'noa_reaction',(string)$old['id'],'댓글');}catch(Throwable $e){error_log('[noa-engagement-point-reversal] '.get_class($e));}}
  ne_reply(['ok'=>true,'deleted'=>true]);
 }
 $target=ne_target($db,(string)($b['type']??''),(string)($b['key']??''));
 if(($b['action']??'')==='like'){
  if(!is_bool($b['active']??null))throw new DomainException('invalid_input');ne_like($db,$target['entity'],$owner,$b['active'],isset(ne_legacy_likes($db,$target)[$owner]));
  if($b['active']&&function_exists('nmb_like'))nmb_like($owner,$target['entity'],time());
 }elseif(($b['action']??'')==='comment'){
  if(!$target['canComment'])throw new DomainException('comment_not_allowed');$id=ne_comment($db,$target['entity'],$owner,(string)($b['requestId']??''),(string)($b['body']??''));
  // Existing activity policy and idempotent point receipts apply to real saved app comments.
  if(function_exists('nr_policy')&&!empty(nr_policy()['enabled'])){try{nr_pending_login($owner,time());nr_reward($owner,'comment','noa_reaction',$id,time());}catch(Throwable $e){error_log('[noa-engagement-comment-reward] '.get_class($e));}}
 }else throw new DomainException('invalid_input');
 ne_reply(['ok'=>true,'csrf'=>$csrf,'stats'=>ne_stats($db,$target),'comments'=>ne_comments($db,$target,0)]);
}catch(DomainException $e){ne_reply(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='try_later'?429:($e->getMessage()==='post_not_available'?404:403));}
catch(JsonException $e){ne_reply(['ok'=>false,'error'=>'invalid_input'],400);}
catch(Throwable $e){error_log('[noa-engagement] '.get_class($e));ne_reply(['ok'=>false,'error'=>'temporarily_unavailable'],503);}
