<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$id='__DRAFT_ID__';$nonce='__REQUEST_ID__';$b=json_decode(file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);$op=$b['op']??'';$result=[];
 if($op==='audit'){
  // Read only the exact title reported by the owner, within the last day. No other song content.
  $q=$db->prepare("SELECT payload FROM noa_documents WHERE kind='n80_creative_job' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.owner'))=? AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.operation'))='revise' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.field'))='title' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.input.fields.title'))=? AND JSON_EXTRACT(payload,'$.createdAt')>=? ORDER BY updated_at DESC LIMIT 5");
  $q->execute([$owner,'A Song Between the Lines',time()-86400]);$result=['matchingJobs'=>[],'userDraftWrites'=>0];
  foreach($q as $row){$j=json_decode($row['payload'],true);$result['matchingJobs'][]=['id'=>$j['id'],'state'=>$j['state'],'createdAt'=>$j['createdAt'],'startedAt'=>$j['startedAt']??null,'finishedAt'=>$j['finishedAt']??null,'currentTitle'=>$j['input']['fields']['title'],'request'=>$j['input']['request'],'result'=>$j['result']['fields']['title']??null];}
 }elseif($op==='init'){
  $r=ncd_create($db,$owner,$id,'[N80 수정 검증 전용 __DRAFT_ID__] 오래된 메모를 떠올리는 한국어 노래.');$d=$r['document'];
  $values=['theme'=>'오래된 메모와 추억','emotion'=>'그리움','genre'=>'인디 팝','instruments'=>'피아노','vocal'=>'남녀듀엣','structure'=>'절과 후렴','language'=>'한국어','prohibitions'=>'결말 단정 금지'];
  foreach(NCD_CONDITIONS as $k)$d['_creative']['intent'][$k]=['value'=>$values[$k],'evidence'=>$values[$k],'source'=>'answer'];
  $d['_creative']['intentConfirmed']=true;$d['_creative']['intentHash']=ncd_hash($d['_creative']['intent']);$r=ncd_atomic($db,fn()=>ncd_put($db,$r,$d,$owner));
  $r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision'],'fields'=>['title'=>'메모 사이로 흐르는 노래','vocal'=>'남녀듀엣']]);
  $r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision'],'fields'=>['title'=>'A Song Between the Lines'],'requests'=>['title'=>'더 짧게 줄여죠']]);
  $result=ncd_enqueue($db,$owner,['id'=>$id,'revision'=>$r['revision'],'operation'=>'revise','field'=>'title','requestId'=>$nonce]);$result=['draftId'=>$id,'job'=>$result['job']];
 }else{
  $r=ncd_row($db,$id,$owner);if($r['document']['_creative']['story']!=='[N80 수정 검증 전용 __DRAFT_ID__] 오래된 메모를 떠올리는 한국어 노래.')throw new RuntimeException('probe_scope_changed');
  if($op==='status'){$j=ncd_job($db,substr(hash('sha256',$owner.':'.$nonce),0,32))['document'];$v=ncd_view($r);$result=['jobId'=>$j['id'],'state'=>$j['state'],'error'=>$j['error']??null,'currentTitle'=>nup_fields($r['document'])['title'],'submittedTitle'=>$j['input']['fields']['title'],'request'=>$j['input']['request'],'result'=>$j['result']['fields']['title']??null,'proposal'=>$v['creative']['proposals']['title']['value']??null,'startedAt'=>$j['startedAt']??null,'finishedAt'=>$j['finishedAt']??null];}
  elseif($op==='cleanup'){
   if(!empty($r['document']['_creative']['publication'])||nj_find($db,$r['doc_key']))throw new RuntimeException('probe_cleanup_scope');
   $jobKey='n80:creative-job:'.substr(hash('sha256',$owner.':'.$nonce),0,32);
   ncd_atomic($db,function()use($db,$r,$jobKey,$id,$owner){foreach(['noa_document_history','noa_documents'] as $table){$q=$db->prepare('DELETE FROM '.$table.' WHERE doc_key IN (?,?)');$q->execute([$r['doc_key'],$jobKey]);}$db->prepare('DELETE FROM noa_creative_drafts WHERE draft_id=? AND owner_id=?')->execute([$id,$owner]);});$result=['probeRemoved'=>true,'userDraftWrites'=>0,'publishedSongs'=>0];
  }else throw new InvalidArgumentException('invalid_probe_operation');
 }
 $out=['ok'=>true,'result'=>$result];
}catch(Throwable $e){http_response_code(500);$out=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
